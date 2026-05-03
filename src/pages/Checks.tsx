import { useEffect, useMemo, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Tabs, TabsContent, TabsList, TabsTrigger,
} from "@/components/ui/tabs";
import {
  Search, Plus, CheckCircle2, Clock, XCircle, Download, Pencil, Trash2,
  TrendingUp, Wallet, Users, FileSignature, ArrowRight, ArrowLeft,
  Sparkles, Calendar as CalendarIcon, Hash, User2, DollarSign, StickyNote,
  Building2, ChevronDown, Zap,
} from "lucide-react";
import { useChecks, useCreateCheck, useUpdateCheck, useDeleteCheck, useProjects, useAccounts } from "@/lib/hooks";
import type { Check, CheckStatus, ExpenseCategory } from "@/lib/types";
import { CATEGORY_LABELS, CHECK_STATUS_LABELS } from "@/lib/types";
import { exportToCSV } from "@/lib/insights";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const STATUS_STYLES: Record<CheckStatus, { dot: string; chip: string; icon: any }> = {
  outstanding: { dot: "bg-amber-500", chip: "bg-amber-500/10 text-amber-700 border-amber-500/20", icon: Clock },
  cleared:     { dot: "bg-emerald-500", chip: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20", icon: CheckCircle2 },
  voided:      { dot: "bg-rose-500", chip: "bg-rose-500/10 text-rose-700 border-rose-500/20", icon: XCircle },
};

const fmt = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const today = () => new Date().toISOString().slice(0, 10);

export default function Checks() {
  const { data: checks = [], isLoading } = useChecks();
  const { data: projects = [] } = useProjects();
  const { data: accounts = [] } = useAccounts();
  const createMut = useCreateCheck();
  const updateMut = useUpdateCheck();
  const deleteMut = useDeleteCheck();

  const [q, setQ] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [editing, setEditing] = useState<Check | null>(null);
  const [open, setOpen] = useState(false);

  const filtered = useMemo(() => {
    return checks.filter((c) => {
      if (status !== "all" && c.status !== status) return false;
      if (from && c.date < from) return false;
      if (to && c.date > to) return false;
      if (q) {
        const s = q.toLowerCase();
        if (
          !c.payee.toLowerCase().includes(s) &&
          !c.check_number.toLowerCase().includes(s) &&
          !(c.memo ?? "").toLowerCase().includes(s)
        ) return false;
      }
      return true;
    });
  }, [checks, q, status, from, to]);

  const stats = useMemo(() => {
    const total = filtered.reduce((s, c) => s + Number(c.amount), 0);
    const outstanding = filtered.filter(c => c.status === "outstanding").reduce((s, c) => s + Number(c.amount), 0);
    const cleared = filtered.filter(c => c.status === "cleared").reduce((s, c) => s + Number(c.amount), 0);
    const payees = new Set(filtered.map(c => c.payee.trim().toLowerCase())).size;
    return { total, outstanding, cleared, payees, count: filtered.length };
  }, [filtered]);

  const byPayee = useMemo(() => {
    const map = new Map<string, { payee: string; total: number; count: number; last: string }>();
    for (const c of checks) {
      const key = c.payee.trim();
      const cur = map.get(key) ?? { payee: key, total: 0, count: 0, last: c.date };
      cur.total += Number(c.amount);
      cur.count += 1;
      if (c.date > cur.last) cur.last = c.date;
      map.set(key, cur);
    }
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [checks]);

  // Suggest the next check number based on the highest numeric check#
  const nextCheckNumber = useMemo(() => {
    const nums = checks
      .map(c => parseInt(c.check_number.replace(/\D/g, ""), 10))
      .filter(n => Number.isFinite(n));
    if (!nums.length) return "1001";
    return String(Math.max(...nums) + 1);
  }, [checks]);

  const exportCsv = () => {
    exportToCSV(filtered.map(c => ({
      check_number: c.check_number,
      date: c.date,
      payee: c.payee,
      amount: Number(c.amount),
      status: c.status,
      cleared_date: c.cleared_date ?? "",
      memo: c.memo ?? "",
      project: projects.find(p => p.id === c.project_id)?.name ?? "",
      account: accounts.find(a => a.id === c.account_id)?.name ?? "",
      category: c.category ? CATEGORY_LABELS[c.category] : "",
    })), `checks-${today()}.csv`);
  };

  const openNew = () => { setEditing(null); setOpen(true); };
  const openEdit = (c: Check) => { setEditing(c); setOpen(true); };

  const quickClear = (c: Check) => {
    updateMut.mutate({ id: c.id, status: "cleared", cleared_date: today() });
  };

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-3xl border border-border/60 bg-gradient-to-br from-white via-white to-primary/5 p-6 md:p-8 shadow-sm">
        <div className="absolute -top-24 -right-24 w-72 h-72 rounded-full bg-primary/10 blur-3xl pointer-events-none" />
        <div className="relative flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 text-[10px] font-bold tracking-[0.2em] uppercase text-primary mb-2">
              <FileSignature className="w-3.5 h-3.5" /> Check Register
            </div>
            <h1 className="font-display text-3xl md:text-4xl font-bold tracking-tight">Every check, every payee, every dollar.</h1>
            <p className="text-muted-foreground mt-2 max-w-2xl">
              A concierge register for your team's checks. Walk through each one in seconds — payee, amount, done.
            </p>
          </div>
          <div className="flex gap-2 shrink-0">
            <Button variant="outline" size="sm" onClick={exportCsv}>
              <Download className="w-4 h-4 mr-1.5" /> Export
            </Button>
            <Button size="sm" onClick={openNew} className="bg-gradient-primary text-white shadow-md">
              <Sparkles className="w-4 h-4 mr-1.5" /> Write Check
            </Button>
          </div>
        </div>
      </div>

      {/* Stat grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard icon={Wallet}        label="Total written"      value={`$${fmt(stats.total)}`}        accent="from-primary/15 to-transparent" />
        <StatCard icon={Clock}         label="Outstanding"        value={`$${fmt(stats.outstanding)}`}  accent="from-amber-400/20 to-transparent" />
        <StatCard icon={CheckCircle2}  label="Cleared"            value={`$${fmt(stats.cleared)}`}      accent="from-emerald-400/20 to-transparent" />
        <StatCard icon={Users}         label="Unique payees"      value={`${stats.payees}`}             accent="from-sky-400/20 to-transparent" />
      </div>

      {/* Filters */}
      <div className="bg-card border border-border rounded-xl p-3 grid grid-cols-2 md:grid-cols-5 gap-2">
        <div className="col-span-2 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search payee, check #, memo…" value={q} onChange={(e) => setQ(e.target.value)} className="pl-9 h-10" />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All status</SelectItem>
            <SelectItem value="outstanding">Outstanding</SelectItem>
            <SelectItem value="cleared">Cleared</SelectItem>
            <SelectItem value="voided">Voided</SelectItem>
          </SelectContent>
        </Select>
        <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-10" />
        <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-10" />
      </div>

      {/* Tabs */}
      <Tabs defaultValue="register" className="bg-card border border-border rounded-xl p-2">
        <TabsList className="bg-muted">
          <TabsTrigger value="register">Register ({filtered.length})</TabsTrigger>
          <TabsTrigger value="payees">By Payee ({byPayee.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="register" className="mt-2">
          {isLoading ? (
            <div className="p-12 text-center text-muted-foreground text-sm">Loading checks…</div>
          ) : filtered.length === 0 ? (
            <EmptyState onClick={openNew} />
          ) : (
            <div className="rounded-lg border border-border/60 overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40">
                    <TableHead className="w-[90px]">Check #</TableHead>
                    <TableHead className="w-[110px]">Date</TableHead>
                    <TableHead>Payee</TableHead>
                    <TableHead>Memo / Project</TableHead>
                    <TableHead className="w-[140px]">Status</TableHead>
                    <TableHead className="text-right w-[120px]">Amount</TableHead>
                    <TableHead className="w-[110px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((c) => {
                    const st = STATUS_STYLES[c.status];
                    const proj = projects.find(p => p.id === c.project_id);
                    return (
                      <TableRow key={c.id} className="group">
                        <TableCell className="font-mono font-semibold">#{c.check_number}</TableCell>
                        <TableCell className="text-sm">{c.date}</TableCell>
                        <TableCell className="font-medium">{c.payee}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          <div className="line-clamp-1">{c.memo || "—"}</div>
                          {proj && <div className="text-[11px] text-primary/80 mt-0.5">{proj.name}</div>}
                        </TableCell>
                        <TableCell>
                          <span className={cn("inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-[11px] font-semibold border", st.chip)}>
                            <span className={cn("w-1.5 h-1.5 rounded-full", st.dot)} />
                            {CHECK_STATUS_LABELS[c.status]}
                          </span>
                        </TableCell>
                        <TableCell className="text-right font-mono font-semibold">
                          ${fmt(Number(c.amount))}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity justify-end">
                            {c.status === "outstanding" && (
                              <Button size="icon" variant="ghost" className="h-7 w-7 text-emerald-600 hover:text-emerald-700"
                                title="Mark cleared" onClick={() => quickClear(c)}>
                                <CheckCircle2 className="w-3.5 h-3.5" />
                              </Button>
                            )}
                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(c)}>
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              size="icon" variant="ghost" className="h-7 w-7 text-rose-600 hover:text-rose-700"
                              onClick={() => { if (confirm(`Delete check #${c.check_number}?`)) deleteMut.mutate(c.id); }}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="payees" className="mt-2">
          {byPayee.length === 0 ? (
            <EmptyState onClick={openNew} />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {byPayee.map((p) => (
                <div key={p.payee} className="rounded-xl border border-border/60 bg-card p-4 flex items-center gap-4">
                  <div className="w-11 h-11 rounded-xl bg-gradient-primary text-white flex items-center justify-center font-bold text-sm shrink-0">
                    {p.payee.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold truncate">{p.payee}</div>
                    <div className="text-[11px] text-muted-foreground">{p.count} checks · last {p.last}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-mono font-bold text-base">${fmt(p.total)}</div>
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center justify-end gap-1">
                      <TrendingUp className="w-3 h-3" /> Lifetime
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Wizard editor */}
      <CheckWizard
        open={open}
        onOpenChange={setOpen}
        check={editing}
        projects={projects}
        accounts={accounts}
        payeeHistory={byPayee}
        defaultCheckNumber={nextCheckNumber}
        onSubmit={(payload) => {
          if (editing) {
            updateMut.mutate({ id: editing.id, ...payload }, { onSuccess: () => setOpen(false) });
          } else {
            createMut.mutate(payload, { onSuccess: () => setOpen(false) });
          }
        }}
      />
    </div>
  );
}

function StatCard({ icon: Icon, label, value, accent }: { icon: any; label: string; value: string; accent: string }) {
  return (
    <div className={cn("relative overflow-hidden rounded-xl border border-border/60 bg-card p-4")}>
      <div className={cn("absolute inset-0 bg-gradient-to-br pointer-events-none", accent)} />
      <div className="relative">
        <div className="flex items-center gap-2 text-[10px] font-bold tracking-[0.18em] uppercase text-muted-foreground">
          <Icon className="w-3.5 h-3.5" /> {label}
        </div>
        <div className="font-display text-2xl md:text-3xl font-bold mt-2 tracking-tight">{value}</div>
      </div>
    </div>
  );
}

function EmptyState({ onClick }: { onClick: () => void }) {
  return (
    <div className="p-12 text-center space-y-3">
      <div className="mx-auto w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
        <FileSignature className="w-6 h-6 text-primary" />
      </div>
      <div className="font-semibold">No checks yet</div>
      <p className="text-sm text-muted-foreground max-w-sm mx-auto">
        Record your first check to start a precise, auditable register your partner can rely on.
      </p>
      <Button onClick={onClick} className="bg-gradient-primary text-white"><Plus className="w-4 h-4 mr-1.5" /> Write Check</Button>
    </div>
  );
}

/* ───────────────────────── Wizard editor ───────────────────────── */

type WizStep = "payee" | "amount" | "details" | "context" | "review";

const STEPS: { id: WizStep; label: string; icon: any }[] = [
  { id: "payee",   label: "Payee",   icon: User2 },
  { id: "amount",  label: "Amount",  icon: DollarSign },
  { id: "details", label: "Date & #", icon: CalendarIcon },
  { id: "context", label: "Where",   icon: Building2 },
  { id: "review",  label: "Review",  icon: CheckCircle2 },
];

function CheckWizard({
  open, onOpenChange, check, projects, accounts, payeeHistory, defaultCheckNumber, onSubmit,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  check: Check | null;
  projects: any[];
  accounts: any[];
  payeeHistory: { payee: string; total: number; count: number; last: string }[];
  defaultCheckNumber: string;
  onSubmit: (payload: Partial<Check>) => void;
}) {
  const [step, setStep] = useState<WizStep>("payee");
  const [advanced, setAdvanced] = useState(false);

  const [check_number, setCheckNumber] = useState("");
  const [payee, setPayee] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(today());
  const [memo, setMemo] = useState("");
  const [status, setStatus] = useState<CheckStatus>("outstanding");
  const [cleared_date, setClearedDate] = useState<string>("");
  const [project_id, setProjectId] = useState<string>("");
  const [account_id, setAccountId] = useState<string>("");
  const [category, setCategory] = useState<string>("");

  // reset/sync when opening
  useEffect(() => {
    if (!open) return;
    setStep("payee");
    setAdvanced(false);
    setCheckNumber(check?.check_number ?? defaultCheckNumber);
    setPayee(check?.payee ?? "");
    setAmount(check ? String(check.amount) : "");
    setDate(check?.date ?? today());
    setMemo(check?.memo ?? "");
    setStatus(check?.status ?? "outstanding");
    setClearedDate(check?.cleared_date ?? "");
    setProjectId(check?.project_id ?? "");
    setAccountId(check?.account_id ?? accounts[0]?.id ?? "");
    setCategory(check?.category ?? "");
  }, [open, check, defaultCheckNumber, accounts]);

  // Suggest a memo / project / category based on history of this payee
  useEffect(() => {
    if (!payee.trim() || check) return;
    const past = payeeHistory.find(p => p.payee.toLowerCase() === payee.trim().toLowerCase());
    if (past) {
      // No memo defaulting needed; left blank for user
    }
  }, [payee, payeeHistory, check]);

  const stepIndex = STEPS.findIndex(s => s.id === step);
  const canNext = (() => {
    if (step === "payee") return payee.trim().length > 0;
    if (step === "amount") {
      const n = Number(amount);
      return Number.isFinite(n) && n > 0;
    }
    if (step === "details") return !!date && !!check_number.trim();
    return true;
  })();

  const goNext = () => {
    if (!canNext) return;
    const i = STEPS.findIndex(s => s.id === step);
    if (i < STEPS.length - 1) setStep(STEPS[i + 1].id);
  };
  const goBack = () => {
    const i = STEPS.findIndex(s => s.id === step);
    if (i > 0) setStep(STEPS[i - 1].id);
  };

  const submit = () => {
    if (!check_number.trim()) return toast.error("Check number is required");
    if (!payee.trim()) return toast.error("Payee is required");
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) return toast.error("Enter a valid amount");
    onSubmit({
      check_number: check_number.trim(),
      payee: payee.trim(),
      amount: amt,
      date,
      memo: memo.trim() || null,
      status,
      cleared_date: status === "cleared" ? (cleared_date || today()) : null,
      project_id: project_id || null,
      account_id: account_id || null,
      category: (category || null) as ExpenseCategory | null,
    });
  };

  // Enter to advance / submit on the wizard steps
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (step === "review") submit();
      else goNext();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl p-0 overflow-hidden gap-0">
        {/* Header */}
        <DialogHeader className="px-6 pt-6 pb-3 border-b border-border/60 bg-gradient-to-br from-white via-white to-primary/5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 text-[10px] font-bold tracking-[0.2em] uppercase text-primary">
                <FileSignature className="w-3.5 h-3.5" />
                {check ? "Edit check" : "Write a check"}
              </div>
              <DialogTitle className="font-display text-2xl mt-1 tracking-tight">
                {advanced
                  ? "All fields"
                  : STEPS[stepIndex]?.label === "Payee"   ? "Who is this check to?"
                  : STEPS[stepIndex]?.label === "Amount"  ? "How much?"
                  : STEPS[stepIndex]?.label === "Date & #" ? "Date & check number"
                  : STEPS[stepIndex]?.label === "Where"   ? "What's it for?"
                  : "Looks good?"}
              </DialogTitle>
            </div>
            <div className="flex items-center gap-2 text-[11px] text-muted-foreground shrink-0 pt-1">
              <Zap className="w-3.5 h-3.5 text-primary" />
              <Switch checked={advanced} onCheckedChange={setAdvanced} />
              <span>Advanced</span>
            </div>
          </div>

          {!advanced && (
            <Stepper steps={STEPS} active={stepIndex} />
          )}
        </DialogHeader>

        {/* Body */}
        <div className="px-6 py-6 min-h-[260px]" onKeyDown={onKeyDown}>
          {advanced ? (
            <AdvancedForm
              {...{
                check_number, setCheckNumber, payee, setPayee, amount, setAmount, date, setDate,
                memo, setMemo, status, setStatus, cleared_date, setClearedDate,
                project_id, setProjectId, account_id, setAccountId, category, setCategory,
                projects, accounts, suggestions: payeeHistory.map(p => p.payee),
              }}
            />
          ) : step === "payee" ? (
            <PayeeStep value={payee} onChange={setPayee} history={payeeHistory} onPick={(name) => { setPayee(name); }} />
          ) : step === "amount" ? (
            <AmountStep value={amount} onChange={setAmount} />
          ) : step === "details" ? (
            <DetailsStep
              date={date} setDate={setDate}
              check_number={check_number} setCheckNumber={setCheckNumber}
              defaultCheckNumber={defaultCheckNumber}
            />
          ) : step === "context" ? (
            <ContextStep
              project_id={project_id} setProjectId={setProjectId}
              account_id={account_id} setAccountId={setAccountId}
              category={category} setCategory={setCategory}
              memo={memo} setMemo={setMemo}
              projects={projects} accounts={accounts}
            />
          ) : (
            <ReviewStep
              check_number={check_number} payee={payee} amount={amount} date={date} memo={memo}
              status={status} setStatus={setStatus}
              cleared_date={cleared_date} setClearedDate={setClearedDate}
              project_id={project_id} account_id={account_id} category={category}
              projects={projects} accounts={accounts}
              jumpTo={(s) => setStep(s)}
            />
          )}
        </div>

        {/* Footer */}
        <DialogFooter className="px-6 py-4 border-t border-border/60 bg-muted/30 flex sm:justify-between gap-2">
          {advanced ? (
            <>
              <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button onClick={submit} className="bg-gradient-primary text-white">
                {check ? "Save changes" : "Record check"}
              </Button>
            </>
          ) : (
            <>
              <div className="flex gap-2">
                <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
                {stepIndex > 0 && (
                  <Button variant="outline" onClick={goBack}>
                    <ArrowLeft className="w-4 h-4 mr-1.5" /> Back
                  </Button>
                )}
              </div>
              {step === "review" ? (
                <Button onClick={submit} className="bg-gradient-primary text-white">
                  <CheckCircle2 className="w-4 h-4 mr-1.5" /> {check ? "Save check" : "Record check"}
                </Button>
              ) : (
                <Button onClick={goNext} disabled={!canNext} className="bg-gradient-primary text-white">
                  Continue <ArrowRight className="w-4 h-4 ml-1.5" />
                </Button>
              )}
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Stepper({ steps, active }: { steps: { id: WizStep; label: string; icon: any }[]; active: number }) {
  return (
    <div className="flex items-center gap-1.5 mt-4 pb-1">
      {steps.map((s, i) => {
        const done = i < active;
        const cur = i === active;
        const Icon = s.icon;
        return (
          <div key={s.id} className="flex items-center gap-1.5 flex-1">
            <div className={cn(
              "flex items-center gap-1.5 px-2 py-1 rounded-full text-[11px] font-semibold border transition-colors",
              cur ? "bg-primary/10 text-primary border-primary/30"
                  : done ? "bg-emerald-500/10 text-emerald-700 border-emerald-500/20"
                         : "bg-muted text-muted-foreground border-transparent"
            )}>
              {done ? <CheckCircle2 className="w-3 h-3" /> : <Icon className="w-3 h-3" />}
              <span className="hidden sm:inline">{s.label}</span>
            </div>
            {i < steps.length - 1 && (
              <div className={cn("flex-1 h-px", done ? "bg-emerald-500/40" : "bg-border")} />
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ── Step components ── */

function PayeeStep({
  value, onChange, history, onPick,
}: {
  value: string;
  onChange: (v: string) => void;
  history: { payee: string; total: number; count: number; last: string }[];
  onPick: (name: string) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { ref.current?.focus(); }, []);
  const top = useMemo(() => {
    const q = value.trim().toLowerCase();
    return history
      .filter(h => !q || h.payee.toLowerCase().includes(q))
      .slice(0, 6);
  }, [value, history]);

  return (
    <div className="space-y-4">
      <Input
        ref={ref}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="e.g. ABC Plumbing"
        className="h-14 text-lg"
      />
      {top.length > 0 && (
        <div>
          <div className="text-[10px] uppercase tracking-[0.18em] font-bold text-muted-foreground mb-2">
            {value ? "Match from history" : "Recent payees"}
          </div>
          <div className="flex flex-wrap gap-2">
            {top.map((h) => (
              <button
                key={h.payee}
                type="button"
                onClick={() => onPick(h.payee)}
                className="group flex items-center gap-2 px-3 py-2 rounded-full border border-border/70 bg-card hover:border-primary/40 hover:bg-primary/5 transition-colors text-sm"
              >
                <span className="w-6 h-6 rounded-full bg-gradient-primary text-white text-[10px] font-bold flex items-center justify-center">
                  {h.payee.slice(0, 2).toUpperCase()}
                </span>
                <span className="font-medium">{h.payee}</span>
                <span className="text-[11px] text-muted-foreground">· {h.count}×</span>
              </button>
            ))}
          </div>
        </div>
      )}
      <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
        <Sparkles className="w-3 h-3 text-primary" /> Press <kbd className="px-1.5 py-0.5 rounded bg-muted text-[10px] font-mono">Enter</kbd> to continue.
      </p>
    </div>
  );
}

function AmountStep({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { ref.current?.focus(); }, []);
  return (
    <div className="space-y-4">
      <div className="relative">
        <span className="absolute left-5 top-1/2 -translate-y-1/2 text-3xl font-display font-bold text-muted-foreground">$</span>
        <Input
          ref={ref}
          inputMode="decimal"
          value={value}
          onChange={(e) => onChange(e.target.value.replace(/[^\d.]/g, ""))}
          placeholder="0.00"
          className="h-20 text-4xl font-display font-bold pl-12 tracking-tight"
        />
      </div>
      <div className="flex flex-wrap gap-2">
        {[100, 250, 500, 1000, 2500, 5000].map(n => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(String(n))}
            className="px-3 py-1.5 rounded-full border border-border/70 bg-card hover:border-primary/40 hover:bg-primary/5 text-sm font-medium transition-colors"
          >
            ${n.toLocaleString()}
          </button>
        ))}
      </div>
    </div>
  );
}

function DetailsStep({
  date, setDate, check_number, setCheckNumber, defaultCheckNumber,
}: {
  date: string; setDate: (v: string) => void;
  check_number: string; setCheckNumber: (v: string) => void;
  defaultCheckNumber: string;
}) {
  return (
    <div className="space-y-5">
      <Field label="Date" icon={CalendarIcon}>
        <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-12" />
        <div className="flex gap-2 mt-2">
          {[
            { l: "Today", d: today() },
            { l: "Yesterday", d: new Date(Date.now() - 864e5).toISOString().slice(0, 10) },
          ].map(o => (
            <button key={o.l} type="button" onClick={() => setDate(o.d)}
              className="px-3 py-1 rounded-full border border-border/70 bg-card hover:bg-primary/5 hover:border-primary/40 text-xs font-medium">
              {o.l}
            </button>
          ))}
        </div>
      </Field>

      <Field label="Check number" icon={Hash}>
        <Input value={check_number} onChange={(e) => setCheckNumber(e.target.value)} placeholder="1042" className="h-12 font-mono" />
        {check_number !== defaultCheckNumber && (
          <button type="button" onClick={() => setCheckNumber(defaultCheckNumber)}
            className="mt-2 text-[11px] font-medium text-primary hover:underline">
            Use suggested next: #{defaultCheckNumber}
          </button>
        )}
      </Field>
    </div>
  );
}

function ContextStep({
  project_id, setProjectId, account_id, setAccountId, category, setCategory, memo, setMemo,
  projects, accounts,
}: {
  project_id: string; setProjectId: (v: string) => void;
  account_id: string; setAccountId: (v: string) => void;
  category: string; setCategory: (v: string) => void;
  memo: string; setMemo: (v: string) => void;
  projects: any[]; accounts: any[];
}) {
  return (
    <div className="space-y-4">
      <Field label="Account" icon={Wallet}>
        <Select value={account_id || "none"} onValueChange={(v) => setAccountId(v === "none" ? "" : v)}>
          <SelectTrigger className="h-11"><SelectValue placeholder="Select account (optional)" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="none">— No account —</SelectItem>
            {accounts.map((a: any) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Project" icon={Building2}>
          <Select value={project_id || "none"} onValueChange={(v) => setProjectId(v === "none" ? "" : v)}>
            <SelectTrigger className="h-11"><SelectValue placeholder="Optional" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">— None —</SelectItem>
              {projects.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Category" icon={Sparkles}>
          <Select value={category || "none"} onValueChange={(v) => setCategory(v === "none" ? "" : v)}>
            <SelectTrigger className="h-11"><SelectValue placeholder="Optional" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">— None —</SelectItem>
              {(Object.keys(CATEGORY_LABELS) as ExpenseCategory[]).map(k => (
                <SelectItem key={k} value={k}>{CATEGORY_LABELS[k]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>

      <Field label="Memo" icon={StickyNote}>
        <Textarea rows={2} value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="What was this for? (optional)" />
      </Field>
    </div>
  );
}

function ReviewStep({
  check_number, payee, amount, date, memo, status, setStatus, cleared_date, setClearedDate,
  project_id, account_id, category, projects, accounts, jumpTo,
}: {
  check_number: string; payee: string; amount: string; date: string; memo: string;
  status: CheckStatus; setStatus: (s: CheckStatus) => void;
  cleared_date: string; setClearedDate: (v: string) => void;
  project_id: string; account_id: string; category: string;
  projects: any[]; accounts: any[];
  jumpTo: (s: WizStep) => void;
}) {
  const proj = projects.find((p: any) => p.id === project_id);
  const acct = accounts.find((a: any) => a.id === account_id);
  const amt = Number(amount) || 0;

  return (
    <div className="space-y-4">
      {/* Check preview */}
      <div className="relative rounded-2xl border border-border/60 bg-gradient-to-br from-white via-white to-primary/5 p-5 shadow-sm overflow-hidden">
        <div className="absolute top-3 right-4 font-mono text-xs text-muted-foreground">#{check_number}</div>
        <div className="text-[10px] uppercase tracking-[0.2em] font-bold text-primary mb-2">Pay to the order of</div>
        <div className="font-display text-2xl font-bold tracking-tight">{payee || "—"}</div>
        <div className="flex items-end justify-between mt-4">
          <div>
            <div className="text-[10px] uppercase tracking-[0.18em] font-bold text-muted-foreground">Date</div>
            <div className="font-medium text-sm">{date}</div>
          </div>
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-[0.18em] font-bold text-muted-foreground">Amount</div>
            <div className="font-display text-3xl font-bold tracking-tight">${fmt(amt)}</div>
          </div>
        </div>
        {memo && <div className="mt-3 text-xs text-muted-foreground italic">Memo: {memo}</div>}
      </div>

      {/* Summary chips */}
      <div className="flex flex-wrap gap-2">
        <SumChip label="Account" value={acct?.name ?? "—"} onClick={() => jumpTo("context")} />
        <SumChip label="Project" value={proj?.name ?? "—"} onClick={() => jumpTo("context")} />
        <SumChip label="Category" value={category ? CATEGORY_LABELS[category as ExpenseCategory] : "—"} onClick={() => jumpTo("context")} />
      </div>

      {/* Status */}
      <div className="rounded-xl border border-border/60 p-3 bg-card">
        <div className="text-[10px] uppercase tracking-[0.18em] font-bold text-muted-foreground mb-2">Status</div>
        <div className="grid grid-cols-3 gap-2">
          {(["outstanding", "cleared", "voided"] as CheckStatus[]).map(s => {
            const sty = STATUS_STYLES[s];
            const active = status === s;
            return (
              <button key={s} type="button" onClick={() => setStatus(s)}
                className={cn(
                  "flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-semibold transition-colors",
                  active ? sty.chip : "bg-card border-border/60 text-muted-foreground hover:border-primary/30"
                )}>
                <span className={cn("w-1.5 h-1.5 rounded-full", sty.dot)} />
                {CHECK_STATUS_LABELS[s]}
              </button>
            );
          })}
        </div>
        {status === "cleared" && (
          <div className="mt-3">
            <Label className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground">Cleared date</Label>
            <Input type="date" value={cleared_date || today()} onChange={(e) => setClearedDate(e.target.value)} className="mt-1 h-10" />
          </div>
        )}
      </div>
    </div>
  );
}

function SumChip({ label, value, onClick }: { label: string; value: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick}
      className="px-3 py-2 rounded-lg border border-border/60 bg-card hover:border-primary/40 hover:bg-primary/5 transition-colors text-left">
      <div className="text-[9px] uppercase tracking-[0.18em] font-bold text-muted-foreground">{label}</div>
      <div className="text-xs font-medium truncate max-w-[140px]">{value}</div>
    </button>
  );
}

/* ── Advanced (single-page) ── */

function AdvancedForm(props: any) {
  const {
    check_number, setCheckNumber, payee, setPayee, amount, setAmount, date, setDate,
    memo, setMemo, status, setStatus, cleared_date, setClearedDate,
    project_id, setProjectId, account_id, setAccountId, category, setCategory,
    projects, accounts, suggestions,
  } = props;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Check #" icon={Hash}>
          <Input value={check_number} onChange={(e: any) => setCheckNumber(e.target.value)} placeholder="1042" />
        </Field>
        <Field label="Date" icon={CalendarIcon}>
          <Input type="date" value={date} onChange={(e: any) => setDate(e.target.value)} />
        </Field>
      </div>

      <Field label="Payee" icon={User2}>
        <Input list="payee-suggestions" value={payee} onChange={(e: any) => setPayee(e.target.value)} placeholder="Who is the check written to?" />
        <datalist id="payee-suggestions">
          {suggestions.map((s: string) => <option key={s} value={s} />)}
        </datalist>
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Amount" icon={DollarSign}>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
            <Input className="pl-7" inputMode="decimal" value={amount} onChange={(e: any) => setAmount(e.target.value)} placeholder="0.00" />
          </div>
        </Field>
        <Field label="Status" icon={CheckCircle2}>
          <Select value={status} onValueChange={(v) => setStatus(v as CheckStatus)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="outstanding">Outstanding</SelectItem>
              <SelectItem value="cleared">Cleared</SelectItem>
              <SelectItem value="voided">Voided</SelectItem>
            </SelectContent>
          </Select>
        </Field>
      </div>

      {status === "cleared" && (
        <Field label="Cleared date" icon={CalendarIcon}>
          <Input type="date" value={cleared_date} onChange={(e: any) => setClearedDate(e.target.value)} />
        </Field>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Field label="Project" icon={Building2}>
          <Select value={project_id || "none"} onValueChange={(v) => setProjectId(v === "none" ? "" : v)}>
            <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None</SelectItem>
              {projects.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Account" icon={Wallet}>
          <Select value={account_id || "none"} onValueChange={(v) => setAccountId(v === "none" ? "" : v)}>
            <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None</SelectItem>
              {accounts.map((a: any) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>
      </div>

      <Field label="Category" icon={Sparkles}>
        <Select value={category || "none"} onValueChange={(v) => setCategory(v === "none" ? "" : v)}>
          <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="none">None</SelectItem>
            {(Object.keys(CATEGORY_LABELS) as ExpenseCategory[]).map(k => (
              <SelectItem key={k} value={k}>{CATEGORY_LABELS[k]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      <Field label="Memo" icon={StickyNote}>
        <Textarea rows={2} value={memo} onChange={(e: any) => setMemo(e.target.value)} placeholder="What was this check for?" />
      </Field>
    </div>
  );
}

function Field({ label, icon: Icon, children }: { label: string; icon?: any; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground flex items-center gap-1.5">
        {Icon && <Icon className="w-3 h-3" />} {label}
      </Label>
      {children}
    </div>
  );
}
