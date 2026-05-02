import type { ExpenseCategory } from "./types";
import { supabase } from "@/integrations/supabase/client";

const API_URL = "https://api.openai.com/v1/chat/completions";

function getKey(): string | null {
  return import.meta.env.VITE_OPENAI_API_KEY || null;
}

// Receipt scanning runs on Lovable Cloud (edge function + AI Gateway), so it
// is always available — no user-supplied key required.
export function isReceiptScanEnabled(): boolean {
  return true;
}

export function isAIEnabled(): boolean {
  const k = getKey();
  return !!k && k.length > 10;
}

async function chat(body: object): Promise<any> {
  const key = getKey();
  if (!key) throw new Error("OpenAI API key not configured. Add VITE_OPENAI_API_KEY to your .env file.");

  const res = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message ?? `OpenAI error ${res.status}`);
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content ?? "";
  try {
    return JSON.parse(content);
  } catch {
    // Try extracting JSON from markdown code block
    const match = content.match(/```(?:json)?\s*([\s\S]+?)```/);
    if (match) return JSON.parse(match[1]);
    throw new Error("Could not parse AI response");
  }
}

// ─── Receipt Analysis ─────────────────────────────────────────────────────────

export interface ReceiptData {
  // Vendor / merchant
  vendor: string | null;
  vendor_address: string | null;
  vendor_phone: string | null;

  // Receipt meta
  receipt_number: string | null;
  date: string | null; // YYYY-MM-DD
  time: string | null; // HH:MM (24h) or null

  // Totals
  subtotal: number | null;
  tax: number | null;
  tip: number | null;
  total: number | null;
  // Back-compat alias (older UI expects amount)
  amount: number | null;

  // Payment
  payment_method: string | null;
  card_last4: string | null;

  // Categorization
  category: ExpenseCategory | null;
  description: string | null;

  // Itemization
  line_items: {
    description: string;
    quantity: number | null;
    unit_price: number | null;
    total: number | null;
  }[];
}

export async function analyzeReceipt(imageDataUrl: string): Promise<ReceiptData> {
  const { data, error } = await supabase.functions.invoke("scan-receipt", {
    body: { imageDataUrl },
  });
  if (error) throw new Error(error.message || "Receipt scan failed");
  if (!data?.data) throw new Error("Receipt scan returned no data");
  const r = data.data;
  return {
    vendor: r.vendor ?? null,
    vendor_address: r.vendor_address ?? null,
    vendor_phone: r.vendor_phone ?? null,
    receipt_number: r.receipt_number ?? null,
    date: r.date ?? null,
    time: r.time ?? null,
    subtotal: typeof r.subtotal === "number" ? r.subtotal : null,
    tax: typeof r.tax === "number" ? r.tax : null,
    tip: typeof r.tip === "number" ? r.tip : null,
    total: typeof r.total === "number" ? r.total : null,
    amount: typeof r.amount === "number"
      ? r.amount
      : (typeof r.total === "number" ? r.total : null),
    payment_method: r.payment_method ?? null,
    card_last4: r.card_last4 ?? null,
    category: r.category ?? null,
    description: r.description ?? null,
    line_items: Array.isArray(r.line_items)
      ? r.line_items.map((x: any) => ({
          description: typeof x.description === "string" ? x.description : "",
          quantity: typeof x.quantity === "number" ? x.quantity : null,
          unit_price: typeof x.unit_price === "number" ? x.unit_price : null,
          total: typeof x.total === "number" ? x.total : null,
        }))
      : [],
  };
}

// ─── Smart Categorization ─────────────────────────────────────────────────────

export async function smartCategorize(vendor: string, description?: string): Promise<ExpenseCategory | null> {
  if (!isAIEnabled()) return null;

  try {
    const result = await chat({
      model: "gpt-4o-mini",
      max_tokens: 60,
      messages: [
        {
          role: "system",
          content: "You categorize construction company expenses. Return ONLY JSON.",
        },
        {
          role: "user",
          content: `Categorize this expense for a construction/contracting company.
Vendor: "${vendor}"${description ? `\nDescription: "${description}"` : ""}

Categories (pick the best one):
- materials: lumber, concrete, steel, hardware, electrical/plumbing supplies, building materials
- labor: wages, payroll, worker pay, hourly workers
- equipment: rentals, machinery, heavy equipment, compressors, generators, scaffolding
- subcontractor: specialty contractors, trade subs (electricians, plumbers, HVAC, roofers)
- operating: fuel, gas, office supplies, insurance, software, vehicles, tools (small), meals
- other: anything that doesn't clearly fit above

Return: {"category": "one_of_above", "confidence": 0.0_to_1.0}`,
        },
      ],
    });

    return result.category as ExpenseCategory ?? null;
  } catch {
    return null;
  }
}

// ─── Contextual Entry Suggestions ────────────────────────────────────────────

export interface EntrySuggestion {
  vendor: string;
  amount: number;
  category: ExpenseCategory;
  description: string;
  reasoning: string;
}

export async function suggestEntryFromNote(note: string): Promise<Partial<EntrySuggestion> | null> {
  if (!isAIEnabled()) return null;

  try {
    const result = await chat({
      model: "gpt-4o-mini",
      max_tokens: 150,
      messages: [
        {
          role: "system",
          content: "You help construction workers log expenses from natural language notes. Return ONLY JSON.",
        },
        {
          role: "user",
          content: `Extract expense details from this note: "${note}"

Return JSON with any fields you can determine (omit fields you can't):
{
  "vendor": "vendor/store name",
  "amount": 0.00,
  "category": "materials|labor|equipment|subcontractor|operating|other",
  "description": "clean description (max 60 chars)",
  "reasoning": "one sentence explaining your interpretation"
}`,
        },
      ],
    });

    return result;
  } catch {
    return null;
  }
}

// ─── Voice Logging Assistant (guided) ─────────────────────────────────────────

export interface VoiceLogResult {
  mode: "expense" | "income";
  vendor?: string | null;
  client_name?: string | null;
  amount?: number | null;
  category?: ExpenseCategory | null;
  project?: string | null;
  notes?: string | null;
  // If missing required info, return a concise question for the user.
  needs?: string | null;
}

export async function voiceLogAssistant(
  utterance: string,
  projectNames: string[] = [],
): Promise<VoiceLogResult> {
  if (!isAIEnabled()) {
    throw new Error("AI disabled");
  }

  const result = await chat({
    model: "gpt-4o-mini",
    max_tokens: 220,
    messages: [
      {
        role: "system",
        content: `You are an elite bookkeeping assistant for a construction company.
Your job: take a single voice utterance and extract a structured entry.

Return ONLY valid JSON.

Rules:
- If the user indicates income, set mode=income and use client_name.
- Otherwise mode=expense and use vendor.
- Amount must be a number (no $ sign).
- Category must be one of: materials, labor, equipment, subcontractor, operating, other.
- Project must be matched to one of the provided project names when possible.
- If required fields are missing (amount, vendor/client), set needs to a short question.
`,
      },
      {
        role: "user",
        content: `Known projects: ${projectNames.length ? projectNames.join(", ") : "(none)"}

Utterance: "${utterance}"

Return JSON with keys:
{
  "mode": "expense|income",
  "vendor": string|null,
  "client_name": string|null,
  "amount": number|null,
  "category": "materials|labor|equipment|subcontractor|operating|other"|null,
  "project": string|null,
  "notes": string|null,
  "needs": string|null
}
`,
      },
    ],
  });

  return {
    mode: result.mode === "income" ? "income" : "expense",
    vendor: result.vendor ?? null,
    client_name: result.client_name ?? null,
    amount: typeof result.amount === "number" ? result.amount : null,
    category: result.category ?? null,
    project: result.project ?? null,
    notes: result.notes ?? null,
    needs: result.needs ?? null,
  };
}

// ─── Platform Agent (multi-step) ─────────────────────────────────────────────

export type AgentActionType =
  | "navigate"
  | "open_quick_add"
  | "create_expense"
  | "create_income"
  | "create_project"
  | "update_project"
  | "delete_project"
  | "update_vendor"
  | "delete_vendor"
  | "export_transactions_csv"
  | "generate_report_pdf";

export type AgentStep = {
  type: AgentActionType;
  label: string;
  destructive?: boolean;
  args?: Record<string, any>;
};

export type AgentPlan = {
  reply: string;
  needs?: string | null;
  steps: AgentStep[];
};

/**
 * Plans a multi-step set of actions to control the app.
 * This returns ONLY the plan; execution happens client-side with confirmations.
 */
export async function planAgent(
  input: string,
  context: {
    currentPath?: string;
    projectNames?: string[];
    vendorNames?: string[];
    accountNames?: string[];
    recentMessages?: { role: "user" | "agent"; text: string }[];
  } = {},
): Promise<AgentPlan> {
  if (!isAIEnabled()) {
    return {
      reply: "AI is disabled. Add VITE_OPENAI_API_KEY to your .env to enable the Agent.",
      needs: null,
      steps: [],
    };
  }

  const result = await chat({
    model: "gpt-4o-mini",
    max_tokens: 650,
    messages: [
      {
        role: "system",
        content: `You are a powerful AI agent embedded inside a construction bookkeeping web app.

You MUST return ONLY valid JSON (no markdown, no extra text).

Your job:
- Understand the user's request.
- Either ask ONE concise clarifying question in needs (if required info is missing), OR produce a safe multi-step plan.

High-quality behavior requirements:
- If info is missing, ask the *best* single question that unblocks the workflow.
- When helpful, your reply should include 1–3 short suggestions to make the task easier (e.g. suggest using Quick Add, suggest a category, suggest a date range).
- Prefer the fewest steps needed; avoid unnecessary navigation.
- If the user's request is ambiguous, do NOT guess—use needs.

Safety rules:
- Any delete action MUST be marked destructive=true.
- Never assume irreversible deletes unless explicitly requested.
- Prefer navigation + showing the user the right page when edits require user review.

Output shape:
{
  "reply": "short helpful response",
  "needs": "string or null",
  "steps": [
    {
      "type": "navigate|open_quick_add|create_expense|create_income|create_project|update_project|delete_project|update_vendor|delete_vendor|export_transactions_csv|generate_report_pdf",
      "label": "human readable",
      "destructive": true|false,
      "args": { }
    }
  ]
}

Args conventions:
- navigate: {"path":"/dashboard|/projects|/vendors|/transactions|/analytics|/accounts|/receipts|/"}
- open_quick_add: {"step":"quick"|"camera"}
- create_project: {"name":"...","status":"active"}
- update_project: {"id":"..." or "name":"match-by-name", "patch": { ...fields... }}
- delete_project: {"id":"..." or "name":"match-by-name"}
- update_vendor: {"id":"..." or "name":"match-by-name", "patch": {"name"?:string, "default_category"?:string}}
- delete_vendor: {"id":"..." or "name":"match-by-name"}
- create_expense: {"vendor":"...","amount":123.45,"category":"materials|labor|equipment|subcontractor|operating|other", "project":"match-by-name"|null, "date":"YYYY-MM-DD"|null, "description":string|null}
- create_income: {"client_name":"...","amount":123.45, "project":"match-by-name"|null, "date":"YYYY-MM-DD"|null, "description":string|null}
- export_transactions_csv: {"filters": {"project"?:string, "category"?:string, "q"?:string, "from"?:string, "to"?:string }}
- generate_report_pdf: {"period":"week"|"last_week"|"month"|"last_month"}
`,
      },
      {
        role: "user",
        content: `Current path: ${context.currentPath ?? "(unknown)"}
Known projects: ${(context.projectNames ?? []).slice(0, 80).join(", ") || "(none)"}
Known vendors: ${(context.vendorNames ?? []).slice(0, 80).join(", ") || "(none)"}
Known accounts: ${(context.accountNames ?? []).slice(0, 80).join(", ") || "(none)"}

Recent conversation (most recent last):
${(context.recentMessages ?? []).slice(-12).map((m) => `${m.role.toUpperCase()}: ${m.text}`).join("\n") || "(none)"}

User request: ${JSON.stringify(input)}`,
      },
    ],
  });

  return {
    reply: result.reply ?? "",
    needs: result.needs ?? null,
    steps: Array.isArray(result.steps) ? (result.steps as AgentStep[]) : [],
  };
}
