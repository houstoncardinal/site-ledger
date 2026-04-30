import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Mic, Send, Sparkles, ShieldAlert, X, Minus } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { planAgent, type AgentPlan, type AgentStep } from "@/lib/openai";
import { useVoiceInput } from "@/hooks/useVoiceInput";
import { useAccounts, useProjects, useVendors } from "@/lib/hooks";
import { projectsApi, expensesApi, incomesApi, vendorsApi } from "@/lib/api";
import { exportToCSV } from "@/lib/insights";
import { generatePDFReport, type ReportPeriod } from "@/lib/pdfReport";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

type ExecResult = { ok: true } | { ok: false; error: string };

function normalizeName(s: string) {
  return s.trim().toLowerCase();
}

export default function AIAgentSheet({ open, onOpenChange }: Props) {
  const loc = useLocation();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: projects = [] } = useProjects();
  const { data: vendors = [] } = useVendors();
  const { data: accounts = [] } = useAccounts();

  const [input, setInput] = useState("");
  const [planning, setPlanning] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [plan, setPlan] = useState<AgentPlan | null>(null);
  const [needs, setNeeds] = useState<string | null>(null);
  const [log, setLog] = useState<{ role: "user" | "agent"; text: string }[]>([]);
  const [confirmIndex, setConfirmIndex] = useState<number | null>(null);
  const [resumeFrom, setResumeFrom] = useState(0);
  const [minimized, setMinimized] = useState(false);

  // If the Agent asks a clarifying question, we keep the original request
  // so the user's next message is treated as an answer, not a new task.
  const [pendingRequest, setPendingRequest] = useState<string | null>(null);

  // Auto-unminimize on open
  useEffect(() => {
    if (open) setMinimized(false);
  }, [open]);

  const projectNames = useMemo(() => projects.map((p) => p.name), [projects]);
  const vendorNames = useMemo(() => vendors.map((v) => v.name), [vendors]);
  const accountNames = useMemo(() => accounts.map((a) => a.name), [accounts]);

  const append = (entry: { role: "user" | "agent"; text: string }) =>
    setLog((l) => [...l, entry]);

  const voice = useVoiceInput((text) => {
    setInput(text);
    // Auto-submit for a hands-free experience.
    void submit(text);
  });

  async function submit(textOverride?: string) {
    const raw = (textOverride ?? input).trim();
    const text = raw;
    if (!text) return;

    append({ role: "user", text });
    setInput("");
    setPlanning(true);
    setNeeds(null);
    setPlan(null);
    setConfirmIndex(null);
    setResumeFrom(0);

    try {
      // If the previous plan had a clarifying question, treat this as the answer.
      const effectiveInput = pendingRequest
        ? `${pendingRequest}\n\nAdditional info from the user (answer to your question): ${text}`
        : text;

      const p = await planAgent(effectiveInput, {
        currentPath: `${loc.pathname}${loc.search}`,
        projectNames,
        vendorNames,
        accountNames,
        recentMessages: log,
      });

      setPlan(p);
      setNeeds(p.needs ?? null);
      append({ role: "agent", text: p.needs ? p.needs : p.reply });

      // Track if we need a follow-up answer.
      setPendingRequest(p.needs ? effectiveInput : null);

      // If there's no clarifying question and the plan is non-empty,
      // start executing immediately (luxury “just do it” feel).
      if (!p.needs && (p.steps?.length ?? 0) > 0) {
        setTimeout(() => {
          void executePlan(p);
        }, 0);
      }
    } catch (e: any) {
      append({ role: "agent", text: e?.message ?? "Could not plan actions." });
    } finally {
      setPlanning(false);
    }
  }

  function matchProjectId(nameOrId?: string | null): string | null {
    if (!nameOrId) return null;
    const direct = projects.find((p) => p.id === nameOrId);
    if (direct) return direct.id;
    const n = normalizeName(nameOrId);
    const byName = projects.find((p) => normalizeName(p.name) === n);
    return byName?.id ?? null;
  }

  function matchVendorId(nameOrId?: string | null): string | null {
    if (!nameOrId) return null;
    const direct = vendors.find((v) => v.id === nameOrId);
    if (direct) return direct.id;
    const n = normalizeName(nameOrId);
    const byName = vendors.find((v) => normalizeName(v.name) === n);
    return byName?.id ?? null;
  }

  async function runStep(step: AgentStep): Promise<ExecResult> {
    try {
      switch (step.type) {
        case "navigate": {
          const path = step.args?.path;
          if (typeof path !== "string") return { ok: false, error: "Missing path" };
          navigate(path);
          return { ok: true };
        }
        case "open_quick_add": {
          const stepArg = step.args?.step;
          const add = stepArg === "camera" ? "camera" : "quick";
          navigate({ pathname: "/dashboard", search: `?add=${add}` });
          return { ok: true };
        }
        case "create_project": {
          const name = step.args?.name;
          if (typeof name !== "string" || !name.trim()) return { ok: false, error: "Missing project name" };
          await projectsApi.create({ name: name.trim(), status: step.args?.status ?? "active" } as any);
          qc.invalidateQueries({ queryKey: ["projects"] });
          return { ok: true };
        }
        case "update_project": {
          const patch = step.args?.patch;
          if (!patch || typeof patch !== "object") return { ok: false, error: "Missing patch" };
          const id = typeof step.args?.id === "string" ? step.args.id : matchProjectId(step.args?.name);
          if (!id) return { ok: false, error: "Could not match project" };
          await projectsApi.update(id, patch);
          qc.invalidateQueries({ queryKey: ["projects"] });
          return { ok: true };
        }
        case "delete_project": {
          const id = typeof step.args?.id === "string" ? step.args.id : matchProjectId(step.args?.name);
          if (!id) return { ok: false, error: "Could not match project" };
          await projectsApi.delete(id);
          qc.invalidateQueries({ queryKey: ["projects"] });
          return { ok: true };
        }
        case "update_vendor": {
          const patch = step.args?.patch;
          if (!patch || typeof patch !== "object") return { ok: false, error: "Missing patch" };
          const id = typeof step.args?.id === "string" ? step.args.id : matchVendorId(step.args?.name);
          if (!id) return { ok: false, error: "Could not match vendor" };
          await vendorsApi.update(id, patch);
          qc.invalidateQueries({ queryKey: ["vendors"] });
          return { ok: true };
        }
        case "delete_vendor": {
          const id = typeof step.args?.id === "string" ? step.args.id : matchVendorId(step.args?.name);
          if (!id) return { ok: false, error: "Could not match vendor" };
          await vendorsApi.delete(id);
          qc.invalidateQueries({ queryKey: ["vendors"] });
          return { ok: true };
        }
        case "create_expense": {
          const vendor = step.args?.vendor;
          const amount = step.args?.amount;
          const category = step.args?.category;
          if (typeof vendor !== "string" || !vendor.trim()) return { ok: false, error: "Missing vendor" };
          if (typeof amount !== "number") return { ok: false, error: "Missing/invalid amount" };
          if (typeof category !== "string") return { ok: false, error: "Missing category" };
          const project_id = matchProjectId(step.args?.project) ?? null;
          const date = typeof step.args?.date === "string" ? step.args.date : new Date().toISOString().slice(0, 10);
          await expensesApi.create({
            vendor: vendor.trim(),
            amount,
            category,
            project_id,
            date,
            description: typeof step.args?.description === "string" ? step.args.description : null,
            payment_status: "paid",
          } as any);
          // Keep vendors fresh (smart autofill)
          await vendorsApi.upsert(vendor.trim(), category);
          qc.invalidateQueries({ queryKey: ["expenses"] });
          qc.invalidateQueries({ queryKey: ["vendors"] });
          return { ok: true };
        }
        case "create_income": {
          const client_name = step.args?.client_name;
          const amount = step.args?.amount;
          if (typeof client_name !== "string" || !client_name.trim()) return { ok: false, error: "Missing client_name" };
          if (typeof amount !== "number") return { ok: false, error: "Missing/invalid amount" };
          const project_id = matchProjectId(step.args?.project) ?? null;
          const date = typeof step.args?.date === "string" ? step.args.date : new Date().toISOString().slice(0, 10);
          await incomesApi.create({
            client_name: client_name.trim(),
            amount,
            project_id,
            date,
            description: typeof step.args?.description === "string" ? step.args.description : null,
            payment_status: "paid",
          } as any);
          qc.invalidateQueries({ queryKey: ["incomes"] });
          return { ok: true };
        }
        case "export_transactions_csv": {
          const filters = (step.args?.filters ?? {}) as Record<string, any>;

          const [projectsAll, expensesAll, incomesAll] = await Promise.all([
            projectsApi.list(),
            expensesApi.list(),
            incomesApi.list(),
          ]);

          const projectFilter = typeof filters.project === "string" ? filters.project : "all";
          const categoryFilter = typeof filters.category === "string" ? filters.category : "all";
          const q = typeof filters.q === "string" ? filters.q : "";
          const from = typeof filters.from === "string" ? filters.from : "";
          const to = typeof filters.to === "string" ? filters.to : "";

          const filteredExpenses = expensesAll.filter((e: any) => {
            if (projectFilter !== "all" && e.project_id !== projectFilter) return false;
            if (categoryFilter !== "all" && e.category !== categoryFilter) return false;
            if (from && e.date < from) return false;
            if (to && e.date > to) return false;
            if (q) {
              const s = q.toLowerCase();
              if (!String(e.vendor ?? "").toLowerCase().includes(s) && !String(e.description ?? "").toLowerCase().includes(s)) return false;
            }
            return true;
          });

          const filteredIncomes = incomesAll.filter((i: any) => {
            if (projectFilter !== "all" && i.project_id !== projectFilter) return false;
            if (from && i.date < from) return false;
            if (to && i.date > to) return false;
            if (q) {
              const s = q.toLowerCase();
              if (!String(i.client_name ?? "").toLowerCase().includes(s) && !String(i.description ?? "").toLowerCase().includes(s)) return false;
            }
            return true;
          });

          const projectName = (id: string | null) => projectsAll.find((p) => p.id === id)?.name ?? "";

          const rows = [
            ...filteredExpenses.map((e: any) => ({
              type: "Expense",
              date: e.date,
              category: e.category,
              vendor: e.vendor,
              project: projectName(e.project_id),
              description: e.description ?? "",
              amount: -Number(e.amount),
              status: e.payment_status,
              payment: e.payment_method ?? "",
            })),
            ...filteredIncomes.map((i: any) => ({
              type: "Income",
              date: i.date,
              category: "Income",
              vendor: i.client_name ?? "",
              project: projectName(i.project_id),
              description: i.description ?? "",
              amount: Number(i.amount),
              status: i.payment_status,
              payment: i.invoice_number ?? "",
            })),
          ].sort((a, b) => b.date.localeCompare(a.date));

          exportToCSV(rows, `transactions-${new Date().toISOString().slice(0, 10)}.csv`);
          return { ok: true };
        }
        case "generate_report_pdf": {
          const period = step.args?.period as ReportPeriod | undefined;
          if (!period) return { ok: false, error: "Missing period" };

          const [projectsAll, expensesAll, incomesAll] = await Promise.all([
            projectsApi.list(),
            expensesApi.list(),
            incomesApi.list(),
          ]);
          generatePDFReport(period, { expenses: expensesAll as any, incomes: incomesAll as any, projects: projectsAll as any });
          return { ok: true };
        }
        default:
          return { ok: false, error: `Unsupported action: ${step.type}` };
      }
    } catch (e: any) {
      return { ok: false, error: e?.message ?? "Action failed" };
    }
  }

  async function executePlan(planOverride?: AgentPlan) {
    const p = planOverride ?? plan;
    if (!p?.steps?.length) return;

    setExecuting(true);

    for (let i = resumeFrom; i < p.steps.length; i++) {
      const step = p.steps[i];

      if (step.destructive) {
        // For destructive actions, we still require explicit user confirmation.
        setConfirmIndex(i);
        setExecuting(false);
        append({ role: "agent", text: `About to do something destructive: “${step.label}”. Tap Confirm to continue.` });
        return;
      }

      append({ role: "agent", text: `→ ${step.label}` });
      const res: ExecResult = await runStep(step);
      if (!res.ok) {
        append({ role: "agent", text: `Stopped: ${(res as { ok: false; error: string }).error}` });
        setExecuting(false);
        setResumeFrom(0);
        return;
      }
    }
    append({ role: "agent", text: "Done." });
    setExecuting(false);
    setResumeFrom(0);

    // Smart auto-minimize: if we navigated or completed quickly, tuck away.
    setTimeout(() => {
      setMinimized(true);
    }, 650);
  }

  async function confirmAndContinue() {
    if (confirmIndex == null || !plan?.steps?.length) return;
    setExecuting(true);

    const step = plan.steps[confirmIndex];
    append({ role: "agent", text: `→ ${step.label}` });
    const res: ExecResult = await runStep(step);
    if (!res.ok) {
      append({ role: "agent", text: `Stopped: ${(res as { ok: false; error: string }).error}` });
      setExecuting(false);
      setConfirmIndex(null);
      setResumeFrom(0);
      return;
    }

    setConfirmIndex(null);
    setExecuting(false);
    setResumeFrom(confirmIndex + 1);
    void executePlan();
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-[520px] p-0">
        <div className={cn(
          "h-full text-foreground flex flex-col",
          "bg-white",
        )}>
          <SheetHeader className="px-5 py-4 border-b border-black/5 bg-white">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-white border border-black/5 flex items-center justify-center shadow-sm">
                <Sparkles className="w-5 h-5 text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <SheetTitle className="text-foreground font-display tracking-tight">Agent</SheetTitle>
                <div className="text-xs text-muted-foreground">Voice + text control for the entire platform</div>
              </div>

                <button
                onClick={() => setMinimized((m) => !m)}
                  className="w-9 h-9 rounded-xl hover:bg-black/5 flex items-center justify-center"
                aria-label={minimized ? "Expand" : "Minimize"}
              >
                <Minus className="w-4 h-4" />
              </button>

              <button
                onClick={() => onOpenChange(false)}
                className="w-9 h-9 rounded-xl hover:bg-black/5 flex items-center justify-center"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </SheetHeader>

          {/* Conversation */}
           <div className={cn("flex-1 overflow-y-auto px-5 py-4 space-y-3 bg-white", minimized && "hidden")}
          >
            {log.length === 0 && (
              <div className="rounded-2xl border border-black/5 bg-white p-4 shadow-sm">
                <div className="text-sm font-semibold">Try:</div>
                <ul className="text-sm text-muted-foreground mt-2 space-y-1">
                  <li>• “Log $78.32 at Home Depot for materials on Maple St project”</li>
                  <li>• “Create a new project called River Oaks Remodel”</li>
                  <li>• “Take me to analytics and show profitability”</li>
                </ul>
              </div>
            )}
            {log.map((m, idx) => (
              <div
                key={idx}
                className={cn(
                  "max-w-[88%] rounded-3xl px-4 py-2.5 text-sm leading-relaxed border shadow-sm",
                   m.role === "user"
                     ? "ml-auto bg-surface-dark text-white border-black/10"
                     : "mr-auto bg-white border-black/5 text-foreground",
                )}
              >
                <div className={cn("text-[11px] uppercase tracking-wider mb-1", m.role === "user" ? "text-primary-foreground/70" : "text-muted-foreground")}>
                  {m.role === "user" ? "You" : "Agent"}
                </div>
                <div className={cn(m.role === "user" ? "text-primary-foreground" : "text-foreground")}>{m.text}</div>
              </div>
            ))}
          </div>

          {/* Plan preview + actions */}
          {(plan?.steps?.length ?? 0) > 0 && (
            <div className={cn("px-5 pb-3", minimized && "hidden")}>
              <div className="rounded-2xl border border-black/5 bg-white p-4 shadow-sm">
                <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Planned actions</div>
                <div className="mt-2 space-y-2">
                  {plan!.steps.map((s, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm">
                      <div className={cn("w-2 h-2 rounded-full", s.destructive ? "bg-orange-400" : "bg-emerald-400")} />
                      <div className="flex-1 text-foreground/90">{s.label}</div>
                      {s.destructive && (
                        <div className="text-[10px] px-2 py-0.5 rounded-full border border-orange-500/20 bg-orange-500/10 text-orange-800 flex items-center gap-1">
                          <ShieldAlert className="w-3 h-3" /> destructive
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                <div className="mt-3 flex gap-2">
                  {confirmIndex != null ? (
                    <>
                      <Button
                        className="flex-1 h-11 bg-orange-500 text-white hover:bg-orange-500/90"
                        disabled={executing}
                        onClick={() => void confirmAndContinue()}
                      >
                        Confirm
                      </Button>
                      <Button
                        variant="outline"
                        className="h-11 border-black/10 bg-white/40 hover:bg-white/70"
                        disabled={executing}
                        onClick={() => setConfirmIndex(null)}
                      >
                        Cancel
                      </Button>
                    </>
                  ) : null}
                </div>
              </div>
            </div>
          )}

          {/* Input */}
          <div className="px-5 py-4 border-t border-black/5 bg-white">
            <div className="flex items-center gap-2">
              <div className="flex-1">
                <Input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void submit();
                  }}
                  placeholder={planning ? "Thinking…" : "Tell the Agent what to do"}
                  className="h-12 bg-white border-black/10 text-foreground placeholder:text-muted-foreground"
                />
              </div>
              <Button
                variant="outline"
                className="h-12 w-12 p-0 border-black/10 bg-white hover:bg-muted"
                onClick={() => void submit()}
                disabled={planning || executing}
                aria-label="Send"
              >
                <Send className="w-4 h-4" />
              </Button>
              <Button
                variant="outline"
                className={cn(
                  "h-12 w-12 p-0 border-black/10 bg-white hover:bg-muted",
                  voice.listening && "bg-white",
                )}
                onClick={() => {
                  if (!voice.supported) {
                    append({ role: "agent", text: "Voice input is not supported on this browser. You can still type." });
                    return;
                  }
                  voice.listening ? voice.stop() : voice.start();
                }}
                aria-label="Voice"
              >
                <Mic className="w-4 h-4" />
              </Button>
            </div>
            <div className="mt-2 text-[11px] text-muted-foreground">
              {voice.supported ? "Voice: tap mic and speak." : "Voice may not be supported on this device/browser."}
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
