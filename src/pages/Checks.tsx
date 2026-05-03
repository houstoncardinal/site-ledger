import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Tabs, TabsContent, TabsList, TabsTrigger,
} from "@/components/ui/tabs";
import {
  Search, Plus, CheckCircle2, Clock, XCircle, Download, Pencil, Trash2,
  TrendingUp, Wallet, Users, FileSignature,
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
              Concierge tracking for every check your team writes. See who was paid, when it cleared, and what's still outstanding —
              all in one luxe register.
            </p>
          </div>
          <div className="flex gap-2 shrink-0">
            <Button variant="outline" size="sm" onClick={exportCsv}>
              <Download className="w-4 h-4 mr-1.5" /> Export CSV
            </Button>
            <Button size="sm" onClick={openNew} className="bg-gradient-primary text-white shadow-md">
              <Plus className="w-4 h-4 mr-1.5" /> Write Check
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
                    <TableHead className="w-[80px]" />
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
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
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

      {/* Editor */}
      <CheckEditor
        open={open}
        onOpenChange={setOpen}
        check={editing}
        projects={projects}
        accounts={accounts}
        suggestions={byPayee.map(p => p.payee)}
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

/* ─────────── Editor ─────────── */

function CheckEditor({
  open, onOpenChange, check, projects, accounts, suggestions, onSubmit,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  check: Check | null;
  projects: any[];
  accounts: any[];
  suggestions: string[];
  onSubmit: (payload: Partial<Check>) => void;
}) {
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

  // sync when opening
  useMemoSync(open, () => {
    setCheckNumber(check?.check_number ?? "");
    setPayee(check?.payee ?? "");
    setAmount(check ? String(check.amount) : "");
    setDate(check?.date ?? today());
    setMemo(check?.memo ?? "");
    setStatus(check?.status ?? "outstanding");
    setClearedDate(check?.cleared_date ?? "");
    setProjectId(check?.project_id ?? "");
    setAccountId(check?.account_id ?? "");
    setCategory(check?.category ?? "");
  });

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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">{check ? "Edit check" : "Write a check"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-1">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Check #">
              <Input value={check_number} onChange={(e) => setCheckNumber(e.target.value)} placeholder="1042" autoFocus />
            </Field>
            <Field label="Date">
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </Field>
          </div>

          <Field label="Payee">
            <Input
              list="payee-suggestions"
              value={payee}
              onChange={(e) => setPayee(e.target.value)}
              placeholder="Who is the check written to?"
            />
            <datalist id="payee-suggestions">
              {suggestions.map(s => <option key={s} value={s} />)}
            </datalist>
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Amount">
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                <Input className="pl-7" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" />
              </div>
            </Field>
            <Field label="Status">
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
            <Field label="Cleared date">
              <Input type="date" value={cleared_date} onChange={(e) => setClearedDate(e.target.value)} />
            </Field>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Field label="Project (optional)">
              <Select value={project_id || "none"} onValueChange={(v) => setProjectId(v === "none" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {projects.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Account (optional)">
              <Select value={account_id || "none"} onValueChange={(v) => setAccountId(v === "none" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {accounts.map((a: any) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
          </div>

          <Field label="Category (optional)">
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

          <Field label="Memo">
            <Textarea rows={2} value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="What was this check for?" />
          </Field>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} className="bg-gradient-primary text-white">
            {check ? "Save changes" : "Record check"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

// Tiny helper to re-run a setter block whenever `open` flips to true.
function useMemoSync(trigger: boolean, fn: () => void) {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useMemo(() => { if (trigger) fn(); }, [trigger]);
}
