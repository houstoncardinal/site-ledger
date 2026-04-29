import { useMemo, useState } from "react";
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  BarChart, Bar,
} from "recharts";
import { CATEGORY_COLORS, CATEGORY_LABELS, ExpenseCategory } from "@/lib/types";
import { format, subDays, startOfDay, startOfMonth, startOfWeek } from "date-fns";
import {
  TrendingUp, DollarSign, FolderOpen, Activity,
  ArrowUpRight, AlertTriangle, TrendingDown, Wallet,
} from "lucide-react";
import { Link } from "react-router-dom";
import { useExpenses, useIncomes, useProjects } from "@/lib/hooks";
import { calcProjectInsights } from "@/lib/insights";
import { Skeleton } from "@/components/ui/skeleton";

export default function Dashboard() {
  const { data: projects = [], isLoading: lp } = useProjects();
  const { data: expenses = [], isLoading: le } = useExpenses();
  const { data: incomes = [] } = useIncomes();
  const [range, setRange] = useState(30);

  const filteredExpenses = useMemo(() => {
    const cutoff = startOfDay(subDays(new Date(), range)).getTime();
    return expenses.filter((e) => new Date(e.date).getTime() >= cutoff);
  }, [expenses, range]);

  const filteredIncomes = useMemo(() => {
    const cutoff = startOfDay(subDays(new Date(), range)).getTime();
    return incomes.filter((i) => new Date(i.date).getTime() >= cutoff && i.payment_status === "paid");
  }, [incomes, range]);

  const totalSpend = filteredExpenses.reduce((s, e) => s + Number(e.amount), 0);
  const totalRevenue = filteredIncomes.reduce((s, i) => s + Number(i.amount), 0);
  const netProfit = totalRevenue - totalSpend;
  const unpaidIn = incomes.filter((i) => i.payment_status !== "paid").reduce((s, i) => s + Number(i.amount), 0);
  const unpaidEx = expenses.filter((e) => e.payment_status !== "paid").reduce((s, e) => s + Number(e.amount), 0);
  const activeProjects = projects.filter((p) => p.status === "active");

  const byCategory = useMemo(() => {
    const m = new Map<ExpenseCategory, number>();
    filteredExpenses.forEach((e) => m.set(e.category, (m.get(e.category) ?? 0) + Number(e.amount)));
    return Array.from(m, ([k, v]) => ({ name: CATEGORY_LABELS[k], key: k, value: v })).sort((a, b) => b.value - a.value);
  }, [filteredExpenses]);

  const overTime = useMemo(() => {
    const days = range;
    const buckets = Array.from({ length: days }, (_, i) => {
      const d = subDays(new Date(), days - 1 - i);
      return { date: format(d, "MMM d"), iso: format(d, "yyyy-MM-dd"), expenses: 0, income: 0 };
    });
    filteredExpenses.forEach((e) => {
      const b = buckets.find((x) => x.iso === e.date);
      if (b) b.expenses += Number(e.amount);
    });
    filteredIncomes.forEach((i) => {
      const b = buckets.find((x) => x.iso === i.date);
      if (b) b.income += Number(i.amount);
    });
    return buckets;
  }, [filteredExpenses, filteredIncomes, range]);

  const topVendors = useMemo(() => {
    const m = new Map<string, number>();
    filteredExpenses.forEach((e) => m.set(e.vendor, (m.get(e.vendor) ?? 0) + Number(e.amount)));
    return Array.from(m, ([name, amount]) => ({ name, amount }))
      .sort((a, b) => b.amount - a.amount).slice(0, 5);
  }, [filteredExpenses]);

  // Project comparison
  const projectComparison = useMemo(() => {
    return activeProjects.map((p) => {
      const ins = calcProjectInsights(p, expenses, incomes);
      return { name: p.name.slice(0, 18), spent: ins.totalSpent, income: ins.totalIncome };
    });
  }, [activeProjects, expenses, incomes]);

  // Weekly/Monthly summary
  const summaries = useMemo(() => {
    const wk = startOfWeek(new Date()).getTime();
    const mo = startOfMonth(new Date()).getTime();
    const wkEx = expenses.filter((e) => new Date(e.date).getTime() >= wk).reduce((s, e) => s + Number(e.amount), 0);
    const wkIn = incomes.filter((i) => new Date(i.date).getTime() >= wk && i.payment_status === "paid").reduce((s, i) => s + Number(i.amount), 0);
    const moEx = expenses.filter((e) => new Date(e.date).getTime() >= mo).reduce((s, e) => s + Number(e.amount), 0);
    const moIn = incomes.filter((i) => new Date(i.date).getTime() >= mo && i.payment_status === "paid").reduce((s, i) => s + Number(i.amount), 0);
    return { wk: { ex: wkEx, in: wkIn }, mo: { ex: moEx, in: moIn } };
  }, [expenses, incomes]);

  const allAlerts = useMemo(() => {
    return activeProjects.flatMap((p) => {
      const ins = calcProjectInsights(p, expenses, incomes);
      return ins.alerts.filter((a) => a.level !== "info").map((a) => ({ ...a, project: p }));
    }).slice(0, 4);
  }, [activeProjects, expenses, incomes]);

  if (lp || le) return <DashboardSkeleton />;

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl md:text-4xl font-bold">Command Center</h1>
          <p className="text-muted-foreground mt-1">Real-time view of your build economics.</p>
        </div>
        <div className="flex gap-1 bg-muted rounded-lg p-1">
          {[7, 30, 90].map((d) => (
            <button
              key={d}
              onClick={() => setRange(d)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition ${
                range === d ? "bg-card shadow-sm text-foreground" : "text-muted-foreground"
              }`}
            >
              {d}D
            </button>
          ))}
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        <KPI label="Revenue" value={fmt(totalRevenue)} icon={TrendingUp} color="emerald" />
        <KPI label="Expenses" value={fmt(totalSpend)} icon={TrendingDown} accent />
        <KPI label="Net Profit" value={fmt(netProfit)} icon={DollarSign} color={netProfit >= 0 ? "emerald" : "red"} />
        <KPI label="Active Projects" value={activeProjects.length.toString()} icon={FolderOpen} />
      </div>

      {/* AR/AP row */}
      <div className="grid grid-cols-2 gap-3 md:gap-4">
        <SubCard label="Outstanding to receive" value={fmt(unpaidIn)} sub={`${incomes.filter((i) => i.payment_status !== "paid").length} unpaid invoices`} positive />
        <SubCard label="Owed to vendors" value={fmt(unpaidEx)} sub={`${expenses.filter((e) => e.payment_status !== "paid").length} unpaid expenses`} />
      </div>

      {/* Alerts */}
      {allAlerts.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-4 space-y-2">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider font-semibold text-muted-foreground">
            <AlertTriangle className="w-3.5 h-3.5 text-warning" /> Smart Alerts
          </div>
          {allAlerts.map((a, i) => (
            <Link key={i} to={`/projects/${a.project.id}`} className="flex items-center gap-2 text-sm hover:bg-muted/50 p-2 -m-2 rounded">
              <span className={`w-1.5 h-1.5 rounded-full ${a.level === "danger" ? "bg-primary" : "bg-warning"}`} />
              <span className="font-semibold">{a.project.name}:</span>
              <span className="text-muted-foreground">{a.message}</span>
            </Link>
          ))}
        </div>
      )}

      {/* Time chart + category */}
      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 stat-card">
          <SectionTitle>Cash Flow Over Time</SectionTitle>
          <div className="h-64 mt-2">
            <ResponsiveContainer>
              <LineChart data={overTime}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(0 0% 90%)" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="hsl(0 0% 50%)" />
                <YAxis tick={{ fontSize: 11 }} stroke="hsl(0 0% 50%)" tickFormatter={(v) => `$${v / 1000}k`} />
                <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid hsl(0 0% 90%)" }} formatter={(v: number) => `$${v.toLocaleString()}`} />
                <Line type="monotone" dataKey="expenses" stroke="hsl(0 84% 50%)" strokeWidth={2.5} dot={false} name="Expenses" />
                <Line type="monotone" dataKey="income" stroke="hsl(142 70% 40%)" strokeWidth={2.5} dot={false} name="Income" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="stat-card">
          <SectionTitle>By Category</SectionTitle>
          <div className="h-44 mt-2">
            <ResponsiveContainer>
              <PieChart>
                <Pie data={byCategory} dataKey="value" nameKey="name" innerRadius={42} outerRadius={70} paddingAngle={2}>
                  {byCategory.map((c) => <Cell key={c.key} fill={CATEGORY_COLORS[c.key]} />)}
                </Pie>
                <Tooltip formatter={(v: number) => `$${v.toLocaleString()}`} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-1.5 mt-2">
            {byCategory.slice(0, 5).map((c) => (
              <Link
                key={c.key}
                to={`/transactions?category=${c.key}`}
                className="flex items-center justify-between text-sm hover:bg-muted/50 px-1 py-0.5 rounded"
              >
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-sm" style={{ background: CATEGORY_COLORS[c.key] }} />
                  <span>{c.name}</span>
                </div>
                <span className="font-semibold">${c.value.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* Project comparison + top vendors */}
      <div className="grid lg:grid-cols-2 gap-4">
        <div className="stat-card">
          <SectionTitle>Project vs Project</SectionTitle>
          <div className="h-56 mt-2">
            <ResponsiveContainer>
              <BarChart data={projectComparison}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(0 0% 90%)" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="hsl(0 0% 50%)" />
                <YAxis tick={{ fontSize: 11 }} stroke="hsl(0 0% 50%)" tickFormatter={(v) => `$${v / 1000}k`} />
                <Tooltip formatter={(v: number) => `$${v.toLocaleString()}`} />
                <Bar dataKey="income" fill="hsl(142 70% 40%)" radius={[4, 4, 0, 0]} name="Income" />
                <Bar dataKey="spent" fill="hsl(0 84% 50%)" radius={[4, 4, 0, 0]} name="Spent" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="stat-card">
          <SectionTitle>Top Vendors</SectionTitle>
          <div className="h-56 mt-2">
            <ResponsiveContainer>
              <BarChart data={topVendors} layout="vertical" margin={{ left: 8 }}>
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 12 }} stroke="hsl(0 0% 50%)" />
                <Tooltip formatter={(v: number) => `$${v.toLocaleString()}`} />
                <Bar dataKey="amount" fill="hsl(0 0% 8%)" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Period summaries */}
      <div className="grid sm:grid-cols-2 gap-4">
        <PeriodCard title="This Week" income={summaries.wk.in} expenses={summaries.wk.ex} />
        <PeriodCard title="This Month" income={summaries.mo.in} expenses={summaries.mo.ex} />
      </div>

      {/* Active projects */}
      <div className="stat-card">
        <div className="flex items-center justify-between">
          <SectionTitle>Active Projects</SectionTitle>
          <Link to="/projects" className="text-xs font-semibold text-primary flex items-center gap-1">
            View all <ArrowUpRight className="w-3 h-3" />
          </Link>
        </div>
        <div className="grid md:grid-cols-2 gap-2 mt-3">
          {activeProjects.length === 0 && (
            <div className="text-sm text-muted-foreground py-8 text-center border border-dashed rounded-lg col-span-2">
              No active projects yet. Create one to get started.
            </div>
          )}
          {activeProjects.map((p) => {
            const ins = calcProjectInsights(p, expenses, incomes);
            const pct = ins.budgetUsedPct ?? 0;
            return (
              <Link key={p.id} to={`/projects/${p.id}`} className="block p-3 rounded-lg border border-border hover:border-primary transition group">
                <div className="flex items-center justify-between">
                  <span className="font-semibold group-hover:text-primary transition">{p.name}</span>
                  <span className={`text-sm font-display font-bold ${ins.profit >= 0 ? "text-emerald-700" : "text-primary"}`}>
                    {ins.profit >= 0 ? "+" : "-"}${Math.abs(ins.profit).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </span>
                </div>
                {p.budget ? (
                  <div className="mt-2">
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className={`h-full ${pct > 90 ? "bg-primary" : pct > 70 ? "bg-warning" : "bg-success"}`}
                        style={{ width: `${Math.min(100, pct)}%` }}
                      />
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      ${ins.totalSpent.toLocaleString(undefined, { maximumFractionDigits: 0 })} of ${Number(p.budget).toLocaleString()} budget · {pct.toFixed(0)}%
                    </div>
                  </div>
                ) : (
                  <div className="text-xs text-muted-foreground mt-1">Spent ${ins.totalSpent.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                )}
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}

const fmt = (n: number) => `${n < 0 ? "-" : ""}$${Math.abs(n).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

function KPI({ label, value, icon: Icon, accent, color }: { label: string; value: string; icon: any; accent?: boolean; color?: "emerald" | "red" }) {
  const valueColor = color === "emerald" ? "text-emerald-400" : color === "red" ? "text-primary" : "";
  return (
    <div className={`rounded-xl p-4 md:p-5 border ${accent ? "bg-surface-dark text-white border-transparent" : "bg-card border-border"}`}>
      <div className="flex items-center justify-between">
        <span className={`text-xs uppercase tracking-wider font-semibold ${accent ? "text-white/60" : "text-muted-foreground"}`}>{label}</span>
        <Icon className={`w-4 h-4 ${accent ? "text-primary" : "text-muted-foreground"}`} />
      </div>
      <div className={`font-display font-bold text-2xl md:text-3xl mt-2 ${accent ? valueColor || "" : valueColor}`}>{value}</div>
    </div>
  );
}

function SubCard({ label, value, sub, positive }: { label: string; value: string; sub: string; positive?: boolean }) {
  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <div className="flex items-center gap-2">
        <Wallet className={`w-4 h-4 ${positive ? "text-emerald-700" : "text-primary"}`} />
        <span className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">{label}</span>
      </div>
      <div className={`font-display font-bold text-xl md:text-2xl mt-1 ${positive ? "text-emerald-700" : "text-primary"}`}>{value}</div>
      <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>
    </div>
  );
}

function PeriodCard({ title, income, expenses }: { title: string; income: number; expenses: number }) {
  const profit = income - expenses;
  return (
    <div className="stat-card">
      <SectionTitle>{title}</SectionTitle>
      <div className="grid grid-cols-3 gap-2 mt-3">
        <Cell2 label="Income" value={income} positive />
        <Cell2 label="Expenses" value={expenses} />
        <Cell2 label="Net" value={profit} positive={profit >= 0} bold />
      </div>
    </div>
  );
}

function Cell2({ label, value, positive, bold }: { label: string; value: number; positive?: boolean; bold?: boolean }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{label}</div>
      <div className={`font-display ${bold ? "font-bold text-lg" : "font-semibold text-base"} ${positive ? "text-emerald-700" : "text-primary"}`}>
        {fmt(value)}
      </div>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="font-display font-semibold text-sm uppercase tracking-wider text-muted-foreground">{children}</h3>;
}

function DashboardSkeleton() {
  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-4">
      <Skeleton className="h-10 w-64" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3"><Skeleton className="h-24" /><Skeleton className="h-24" /><Skeleton className="h-24" /><Skeleton className="h-24" /></div>
      <Skeleton className="h-64" />
    </div>
  );
}
