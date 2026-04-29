import { useState, useMemo, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import TransactionList from "@/components/TransactionList";
import IncomeList from "@/components/IncomeList";
import { Search, Download } from "lucide-react";
import { CATEGORY_LABELS, ExpenseCategory } from "@/lib/types";
import { useExpenses, useIncomes, useProjects } from "@/lib/hooks";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { exportToCSV } from "@/lib/insights";
import { useSearchParams } from "react-router-dom";

export default function Transactions() {
  const { data: projects = [] } = useProjects();
  const { data: expenses = [] } = useExpenses();
  const { data: incomes = [] } = useIncomes();
  const [searchParams] = useSearchParams();

  const [project, setProject] = useState("all");
  const [category, setCategory] = useState("all");
  const [status, setStatus] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [q, setQ] = useState("");

  useEffect(() => {
    const c = searchParams.get("category");
    if (c) setCategory(c);
  }, [searchParams]);

  const filteredExpenses = useMemo(() => {
    return expenses.filter((e) => {
      if (project !== "all" && e.project_id !== project) return false;
      if (category !== "all" && e.category !== category) return false;
      if (status !== "all" && e.payment_status !== status) return false;
      if (from && e.date < from) return false;
      if (to && e.date > to) return false;
      if (q) {
        const s = q.toLowerCase();
        if (!e.vendor.toLowerCase().includes(s) && !(e.description ?? "").toLowerCase().includes(s)) return false;
      }
      return true;
    });
  }, [expenses, project, category, status, from, to, q]);

  const filteredIncomes = useMemo(() => {
    return incomes.filter((i) => {
      if (project !== "all" && i.project_id !== project) return false;
      if (status !== "all" && i.payment_status !== status) return false;
      if (from && i.date < from) return false;
      if (to && i.date > to) return false;
      if (q) {
        const s = q.toLowerCase();
        if (!(i.client_name ?? "").toLowerCase().includes(s) && !(i.description ?? "").toLowerCase().includes(s)) return false;
      }
      return true;
    });
  }, [incomes, project, status, from, to, q]);

  const totalEx = filteredExpenses.reduce((s, e) => s + Number(e.amount), 0);
  const totalIn = filteredIncomes.reduce((s, i) => s + Number(i.amount), 0);

  const exportAll = () => {
    const rows = [
      ...filteredExpenses.map((e) => ({
        type: "Expense", date: e.date, category: CATEGORY_LABELS[e.category],
        vendor: e.vendor, project: projects.find((p) => p.id === e.project_id)?.name ?? "",
        description: e.description ?? "", amount: -Number(e.amount),
        status: e.payment_status, payment: e.payment_method ?? "",
      })),
      ...filteredIncomes.map((i) => ({
        type: "Income", date: i.date, category: "Income",
        vendor: i.client_name ?? "", project: projects.find((p) => p.id === i.project_id)?.name ?? "",
        description: i.description ?? "", amount: Number(i.amount),
        status: i.payment_status, payment: i.invoice_number ?? "",
      })),
    ].sort((a, b) => b.date.localeCompare(a.date));
    exportToCSV(rows, `transactions-${new Date().toISOString().slice(0, 10)}.csv`);
  };

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl md:text-4xl font-bold">Transactions</h1>
          <p className="text-muted-foreground mt-1">
            <span className="text-primary font-semibold">-${totalEx.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
            {" / "}
            <span className="text-emerald-700 font-semibold">+${totalIn.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
          </p>
        </div>
        <Button variant="outline" onClick={exportAll}>
          <Download className="w-4 h-4 mr-1" /> Export CSV
        </Button>
      </div>

      <div className="bg-card border border-border rounded-xl p-4 grid grid-cols-2 md:grid-cols-6 gap-3">
        <div className="col-span-2 md:col-span-2 relative">
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
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {(Object.keys(CATEGORY_LABELS) as ExpenseCategory[]).map((k) => (
              <SelectItem key={k} value={k}>{CATEGORY_LABELS[k]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="paid">Paid</SelectItem>
            <SelectItem value="unpaid">Unpaid</SelectItem>
          </SelectContent>
        </Select>
        <div className="grid grid-cols-2 gap-2 col-span-2 md:col-span-1">
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-10" />
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-10" />
        </div>
      </div>

      <Tabs defaultValue="expenses" className="bg-card border border-border rounded-xl p-2">
        <TabsList className="bg-muted">
          <TabsTrigger value="expenses">Expenses ({filteredExpenses.length})</TabsTrigger>
          <TabsTrigger value="income">Income ({filteredIncomes.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="expenses" className="mt-2">
          <TransactionList expenses={filteredExpenses} />
        </TabsContent>
        <TabsContent value="income" className="mt-2">
          <IncomeList incomes={filteredIncomes} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
