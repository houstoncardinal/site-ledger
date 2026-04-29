import type { ExpenseCategory } from "./types";

const API_URL = "https://api.openai.com/v1/chat/completions";

function getKey(): string | null {
  return import.meta.env.VITE_OPENAI_API_KEY || null;
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
  vendor: string | null;
  amount: number | null;
  date: string | null; // YYYY-MM-DD
  category: ExpenseCategory | null;
  description: string | null;
  tax: number | null;
  payment_method: string | null;
}

export async function analyzeReceipt(imageDataUrl: string): Promise<ReceiptData> {
  const result = await chat({
    model: "gpt-4o",
    max_tokens: 400,
    messages: [
      {
        role: "system",
        content: `You are a receipt analysis assistant for a construction company bookkeeping app. Extract data from receipts and return ONLY valid JSON — no markdown, no explanation.`,
      },
      {
        role: "user",
        content: [
          {
            type: "image_url",
            image_url: { url: imageDataUrl, detail: "high" },
          },
          {
            type: "text",
            text: `Analyze this receipt and return JSON with these exact keys (use null for anything you cannot determine):
{
  "vendor": "store or company name",
  "amount": 0.00,
  "date": "YYYY-MM-DD or null",
  "category": "one of: materials, labor, equipment, subcontractor, operating, other",
  "description": "short description of what was purchased (max 60 chars)",
  "tax": 0.00,
  "payment_method": "Cash, Credit Card, Debit Card, Check, or null"
}

Category rules for construction:
- materials: lumber, hardware, concrete, pipes, electrical, plumbing supplies, tools bought
- equipment: equipment rental, machinery, compressors, generators
- labor: payroll, wages, worker payments
- subcontractor: contractor payments, trade services
- operating: fuel, office supplies, insurance, software, vehicle, meals
- other: anything else`,
          },
        ],
      },
    ],
  });

  return {
    vendor: result.vendor ?? null,
    amount: typeof result.amount === "number" ? result.amount : null,
    date: result.date ?? null,
    category: result.category ?? null,
    description: result.description ?? null,
    tax: typeof result.tax === "number" ? result.tax : null,
    payment_method: result.payment_method ?? null,
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
