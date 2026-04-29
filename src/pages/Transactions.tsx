import { useState, useMemo } from "react";
import { useStore } from "@/lib/store";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import TransactionList from "@/components/TransactionList";
import { Search } from "lucide-react";
import { EXPENSE_LABELS, ExpenseType } from "@/lib/types";

export default function Transactions() {
  const projects = useStore((s) => s.projects);
  const expenses = useStore((s) => s.expenses);

  const [project, setProject] = useState("all");
  const [type, setType] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    return expenses.filter((e) => {
      if (project !== "all" && e.projectId !== project) return false;
      if (type !== "all" && e.type !== type) return false;
      if (from && e.date < from) return false;
      if (to && e.date > to) return false;
      if (q) {
        const s = q.toLowerCase();
        if (!e.vendor.toLowerCase().includes(s) && !e.description.toLowerCase().includes(s)) return false;
      }
      return true;
    });
  }, [expenses, project, type, from, to, q]);

  const total = filtered.reduce((s, e) => s + e.amount, 0);

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl md:text-4xl font-bold">Transactions</h1>
          <p className="text-muted-foreground mt-1">{filtered.length} entries · ${total.toLocaleString(undefined, { maximumFractionDigits: 0 })} total</p>
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl p-4 grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="col-span-2 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search vendor or description" value={q} onChange={(e) => setQ(e.target.value)} className="pl-9 h-10" />
        </div>
        <Select value={project} onValueChange={setProject}>
          <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Projects</SelectItem>
            {projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={type} onValueChange={setType}>
          <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {(Object.keys(EXPENSE_LABELS) as ExpenseType[]).map((k) => (
              <SelectItem key={k} value={k}>{EXPENSE_LABELS[k]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="grid grid-cols-2 gap-2 col-span-2 md:col-span-1">
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-10" />
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-10" />
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl p-2">
        <TransactionList expenses={filtered} />
      </div>
    </div>
  );
}
