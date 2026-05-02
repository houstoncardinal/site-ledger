import { useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
  LineChart, Line, XAxis, YAxis, CartesianGrid,
} from "recharts";
import { CATEGORY_COLORS, CATEGORY_LABELS } from "@/lib/types";
import { format, parseISO } from "date-fns";
import { ArrowLeft, AlertTriangle, Download } from "lucide-react";
import TransactionList from "@/components/TransactionList";
import IncomeList from "@/components/IncomeList";
import { useExpenses, useIncomes, useProject } from "@/lib/hooks";
import { calcProjectInsights, exportToCSV } from "@/lib/insights";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { TerminalChartContainer, TerminalSharedTooltip } from "@/components/ui/chart";

export default function ProjectDetail() {
  const { id } = useParams();
  const { data: project } = useProject(id);
  const { data: allExpenses = [] } = useExpenses();
  const { data: allIncomes = [] } = useIncomes();

  const expenses = useMemo(() => allExpenses.filter((e) => e.project_id === id), [allExpenses, id]);
  const incomes = useMemo(() => allIncomes.filter((i) => i.project_id === id), [allIncomes, id]);
  const insights = useMemo(() => project ? calcProjectInsights(project, allExpenses, allIncomes) : null, [project, allExpenses, allIncomes]);

  const timeline = useMemo(() => {
    const m = new Map<string, { expenses: number; income: number }>();
    expenses.forEach((e) => {
      const cur = m.get(e.date) ?? { expenses: 0, income: 0 };
      cur.expenses += Number(e.amount);
      m.set(e.date, cur);
    });
    incomes.forEach((i) => {
      const cur = m.get(i.date) ?? { expenses: 0, income: 0 };
      cur.income += Number(i.amount);
      m.set(i.date, cur);
    });
    return Array.from(m, ([date, v]) => ({ date, ...v, label: format(parseISO(date), "MMM d") }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [expenses, incomes]);

  if (!project || !insights) {
    return (
      <div className="p-8 text-center">
        <p>Loading project…</p>
        <Link to="/projects" className="text-primary underline">Back to projects</Link>
      </div>
    );
  }

  const exportCsv = () => {
    const rows = [
      ...expenses.map((e) => ({
        type: "Expense", date: e.date, category: CATEGORY_LABELS[e.category], vendor: e.vendor,
        description: e.description ?? "", amount: -Number(e.amount), status: e.payment_status,
        payment: e.payment_method ?? "",
      })),
      ...incomes.map((i) => ({
        type: "Income", date: i.date, category: "Income", vendor: i.client_name ?? "",
        description: i.description ?? "", amount: Number(i.amount), status: i.payment_status,
        payment: i.invoice_number ?? "",
      })),
    ].sort((a, b) => b.date.localeCompare(a.date));
    exportToCSV(rows, `${project.name}-transactions.csv`);
  };

  const remaining = project.budget ? Number(project.budget) - insights.totalSpent : null;

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <Link to="/projects" className="text-sm text-muted-foreground hover:text-primary flex items-center gap-1">
          <ArrowLeft className="w-4 h-4" /> All Projects
        </Link>
        <Button variant="outline" size="sm" onClick={exportCsv}>
          <Download className="w-4 h-4 mr-1" /> Export CSV
        </Button>
      </div>

      <div className="relative overflow-hidden rounded-2xl p-6 md:p-8 border border-border bg-gradient-to-br from-white via-white to-[hsl(var(--muted))] shadow-md">
        <div className="absolute -top-16 -right-16 w-64 h-64 rounded-full blur-3xl bg-[hsl(var(--primary)/0.10)]" />
        <div className="absolute -bottom-20 -left-10 w-72 h-72 rounded-full blur-3xl bg-[hsl(var(--primary)/0.06)]" />
        <div className="relative">
          <div className="text-xs uppercase tracking-wider text-white/50">{project.client_name ?? "Project"}</div>
          <h1 className="font-display text-3xl md:text-4xl font-bold mt-1">{project.name}</h1>
          <div className="text-sm text-white/60 mt-1">
            Started {format(parseISO(project.start_date), "MMM d, yyyy")} · {project.status}
            {project.address && ` · ${project.address}`}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
            <Stat label="Spent" value={`$${insights.totalSpent.toLocaleString(undefined, { maximumFractionDigits: 0 })}`} />
            <Stat label="Income" value={`$${insights.totalIncome.toLocaleString(undefined, { maximumFractionDigits: 0 })}`} />
            <Stat label="Profit" value={`${insights.profit >= 0 ? "+" : "-"}$${Math.abs(insights.profit).toLocaleString(undefined, { maximumFractionDigits: 0 })}`} accent={insights.profit >= 0 ? "emerald" : "red"} />
            <Stat label="Budget" value={project.budget ? `$${Number(project.budget).toLocaleString()}` : "—"} />
          </div>
          {project.budget && (
            <div className="mt-5">
              <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-primary" style={{ width: `${Math.min(100, insights.budgetUsedPct ?? 0)}%` }} />
              </div>
              <div className="text-xs text-white/60 mt-1">
                {(insights.budgetUsedPct ?? 0).toFixed(1)}% used · {remaining !== null ? `$${remaining.toLocaleString(undefined, { maximumFractionDigits: 0 })} remaining` : ""}
              </div>
            </div>
          )}
          {insights.alerts.length > 0 && (
            <div className="mt-5 space-y-1.5">
              {insights.alerts.map((a, i) => (
                <div key={i} className={`flex items-center gap-2 text-sm ${a.level === "danger" ? "text-primary" : a.level === "warn" ? "text-yellow-400" : "text-white/70"}`}>
                  <AlertTriangle className="w-4 h-4 shrink-0" /> {a.message}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="stat-card">
          <h3 className="font-display font-semibold text-sm uppercase tracking-wider text-muted-foreground">Category Breakdown</h3>
          <div className="h-56 mt-3">
            <ResponsiveContainer>
              <PieChart>
                <Pie data={insights.byCategory.map((c) => ({ name: CATEGORY_LABELS[c.category], value: c.amount, key: c.category }))}
                  dataKey="value" nameKey="name" innerRadius={50} outerRadius={85}>
                  {insights.byCategory.map((c) => <Cell key={c.category} fill={CATEGORY_COLORS[c.category]} />)}
                </Pie>
                <Tooltip formatter={(v: number) => `$${v.toLocaleString()}`} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-1 mt-2">
            {insights.byCategory.map((c) => (
              <div key={c.category} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-sm" style={{ background: CATEGORY_COLORS[c.category] }} />
                  <span>{CATEGORY_LABELS[c.category]}</span>
                </div>
                <span className="font-semibold">${c.amount.toLocaleString(undefined, { maximumFractionDigits: 0 })} <span className="text-xs text-muted-foreground">({c.pct.toFixed(0)}%)</span></span>
              </div>
            ))}
          </div>
        </div>

        <div className="stat-card">
          <h3 className="font-display font-semibold text-sm uppercase tracking-wider text-muted-foreground">Cash Flow</h3>
          <div className="h-72 mt-3">
            <TerminalChartContainer config={{ expenses: { label: "Expenses" }, income: { label: "Income" } }} className="h-full">
              <LineChart data={timeline} margin={{ top: 8, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="4 6" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={(v) => `$${v / 1000}k`} width={46} />
                <TerminalSharedTooltip />
                <Line type="monotone" dataKey="expenses" stroke="hsl(0 84% 55%)" strokeWidth={2.5} dot={false} name="Expenses" />
                <Line type="monotone" dataKey="income" stroke="hsl(142 70% 45%)" strokeWidth={2.5} dot={false} name="Income" />
              </LineChart>
            </TerminalChartContainer>
          </div>
        </div>
      </div>

      <Tabs defaultValue="expenses" className="stat-card">
        <TabsList className="bg-muted">
          <TabsTrigger value="expenses">Expenses ({expenses.length})</TabsTrigger>
          <TabsTrigger value="income">Income ({incomes.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="expenses" className="mt-3">
          <TransactionList expenses={expenses} hideProject />
        </TabsContent>
        <TabsContent value="income" className="mt-3">
          <IncomeList incomes={incomes} hideProject />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: "emerald" | "red" }) {
  const c = accent === "emerald" ? "text-emerald-400" : accent === "red" ? "text-primary" : "";
  return (
    <div>
      <div className="text-xs text-white/50 uppercase">{label}</div>
      <div className={`font-display font-bold text-2xl mt-1 ${c}`}>{value}</div>
    </div>
  );
}
