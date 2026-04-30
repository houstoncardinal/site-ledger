import { useMemo, useState } from "react";
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  BarChart, Bar,
} from "recharts";
import { CATEGORY_COLORS, CATEGORY_LABELS, ExpenseCategory } from "@/lib/types";
import { format, subDays, startOfDay, startOfMonth, startOfWeek } from "date-fns";
import {
  TrendingUp, DollarSign, FolderOpen,
  ArrowUpRight, AlertTriangle, TrendingDown, Wallet,
  Flame, Zap, Brain,
} from "lucide-react";
import { Link } from "react-router-dom";
import { useExpenses, useIncomes, useProjects } from "@/lib/hooks";
import ReportButton from "@/components/ReportButton";
import { calcProjectInsights } from "@/lib/insights";
import { calcBurnRate, detectAnomalies, generateInsights, calcProjectPredictions } from "@/lib/predictions";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { TerminalChartContainer, TerminalSharedTooltip } from "@/components/ui/chart";

export default function Dashboard() {
  const { data: projects = [], isLoading: lp } = useProjects();
  const { data: expenses = [], isLoading: le } = useExpenses();
  const { data: incomes = [] } = useIncomes();
  const [range, setRange] = useState(30);
  const [detailsOpen, setDetailsOpen] = useState(false);


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

  // Intelligence signals
  const burnRate = useMemo(() => calcBurnRate(expenses), [expenses]);
  const anomalies = useMemo(() => detectAnomalies(expenses), [expenses]);
  const insights = useMemo(() => generateInsights(expenses, incomes, projects), [expenses, incomes, projects]);
  const predictions = useMemo(() => calcProjectPredictions(activeProjects, expenses), [activeProjects, expenses]);

  if (lp || le) return <DashboardSkeleton />;

  return (
    <div className="px-4 py-6 md:px-8 md:py-8 space-y-6 max-w-7xl mx-auto">
      {/* ── Luxe page header ── */}
      <section className="relative rounded-[28px] overflow-hidden hero-luxe animate-rise">
        <div aria-hidden className="pointer-events-none absolute -top-20 -right-16 w-72 h-72 rounded-full bg-primary/30 blur-3xl animate-float-slow z-0" />
        <div aria-hidden className="pointer-events-none absolute -bottom-24 -left-12 w-80 h-80 rounded-full bg-[hsl(41_70%_52%/0.18)] blur-3xl animate-float-slow z-0" style={{ animationDelay: "1.4s" }} />
        <div className="relative z-10 px-5 md:px-9 py-6 md:py-7 flex flex-col md:flex-row md:items-end md:justify-between gap-5">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold tracking-[0.18em] uppercase text-white/90 bg-white/5 border border-white/15 backdrop-blur animate-glow-pulse">
                <Zap className="w-3 h-3 text-[hsl(var(--primary))]" /> Command Center
              </span>
              <span className="hidden sm:inline-flex items-center gap-1.5 text-[10px] font-semibold tracking-[0.18em] uppercase text-white/40">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Live
              </span>
            </div>
            <h1 className="font-display text-3xl md:text-[44px] font-bold tracking-[-0.02em] text-white">
              Financial <span className="font-serif-luxe italic text-luxe-shimmer">overview</span>
            </h1>
            <p className="text-white/55 text-[13px] md:text-sm mt-1.5 max-w-xl">
              Real-time profit, burn rate, and project health — every dollar accounted for.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <ReportButton size="sm" />
            <div className="flex gap-0.5 bg-white/8 border border-white/10 rounded-xl p-1 backdrop-blur">
              {[7, 30, 90].map((d) => (
                <button
                  key={d}
                  onClick={() => setRange(d)}
                  className={cn(
                    "px-3 py-1.5 text-xs font-semibold rounded-lg transition-all",
                    range === d
                      ? "bg-white text-foreground shadow-sm"
                      : "text-white/55 hover:text-white"
                  )}
                >
                  {d}D
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="rule-gold" />
        {/* Live KPI strip in hero */}
        <div className="relative z-10 px-5 md:px-9 py-3.5 grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-3 bg-black/20 backdrop-blur-xl">
          <HeroStat label="Revenue" value={fmt(totalRevenue)} tone="emerald" />
          <HeroStat label="Expenses" value={fmt(totalSpend)} tone="red" />
          <HeroStat label="Net Profit" value={`${netProfit >= 0 ? "+" : "−"}${fmt(Math.abs(netProfit))}`} tone={netProfit >= 0 ? "emerald" : "red"} highlight />
          <HeroStat label="Active Projects" value={activeProjects.length.toString()} tone="gold" />
        </div>
      </section>

      {/* Mobile primary actions */}
      <div className="md:hidden grid grid-cols-2 gap-3">
        <Link
          to="/projects"
          className="luxe-card p-4 flex items-center justify-between"
        >
          <div className="min-w-0">
            <div className="text-[10px] font-bold text-muted-foreground tracking-[0.16em] uppercase">Projects</div>
            <div className="font-display font-bold text-xl mt-1">{activeProjects.length}</div>
            <div className="text-xs text-muted-foreground mt-1">Tap to manage</div>
          </div>
          <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
            <FolderOpen className="w-5 h-5 text-primary" />
          </div>
        </Link>
        <Link
          to="/transactions"
          className="luxe-card p-4 flex items-center justify-between"
        >
          <div className="min-w-0">
            <div className="text-[10px] font-bold text-muted-foreground tracking-[0.16em] uppercase">Logs</div>
            <div className="font-display font-bold text-xl mt-1">Entries</div>
            <div className="text-xs text-muted-foreground mt-1">Filter & review</div>
          </div>
          <div className="w-10 h-10 rounded-2xl bg-muted flex items-center justify-center shrink-0">
            <DollarSign className="w-5 h-5 text-muted-foreground" />
          </div>
        </Link>
      </div>

      {/* (KPI row promoted to hero) */}

      {/* AR/AP row */}
      <div className="grid grid-cols-2 gap-3 md:gap-4">
        <SubCard label="Outstanding to receive" value={fmt(unpaidIn)} sub={`${incomes.filter((i) => i.payment_status !== "paid").length} unpaid invoices`} positive />
        <SubCard label="Owed to vendors" value={fmt(unpaidEx)} sub={`${expenses.filter((e) => e.payment_status !== "paid").length} unpaid expenses`} />
      </div>

      {/* Intelligence panel (kept high, condensed) */}
      {(insights.length > 0 || anomalies.length > 0) && (
        <div className="grid md:grid-cols-2 gap-4">
          {/* Contextual insights */}
          {insights.length > 0 && (
            <div className="stat-card space-y-1">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-md bg-primary/10 flex items-center justify-center">
                    <Brain className="w-3.5 h-3.5 text-primary" />
                  </div>
                  <SectionTitle>AI Insights</SectionTitle>
                </div>
                <Link to="/analytics" className="flex items-center gap-1 text-xs text-primary hover:opacity-70 transition font-semibold">
                  View all <ArrowUpRight className="w-3 h-3" />
                </Link>
              </div>
              {insights.map((ins, i) => (
                <div key={i} className={cn(
                  "flex items-start gap-2.5 text-sm px-3 py-2.5 rounded-xl",
                  ins.type === "positive" ? "bg-emerald-50 text-emerald-800" : ins.type === "warning" ? "bg-red-50 text-primary" : "bg-muted/60 text-foreground"
                )}>
                  <span className={cn("w-1.5 h-1.5 rounded-full mt-[5px] shrink-0", ins.type === "positive" ? "bg-emerald-500" : ins.type === "warning" ? "bg-primary" : "bg-muted-foreground")} />
                  <span className="leading-snug">{ins.text}</span>
                </div>
              ))}
            </div>
          )}

          {/* Burn rate + anomalies */}
          <div className="stat-card space-y-3">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-6 h-6 rounded-md bg-orange-100 flex items-center justify-center">
                <Flame className="w-3.5 h-3.5 text-orange-500" />
              </div>
              <SectionTitle>Burn Rate</SectionTitle>
            </div>
            <div>
              <div className="flex items-baseline gap-1.5">
                <span className="font-display font-bold text-3xl">${burnRate.dailyRate.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                <span className="text-sm text-muted-foreground font-medium">/day</span>
              </div>
              <div className="text-sm text-muted-foreground mt-1">
                Projected <span className="font-semibold text-foreground">${burnRate.projectedMonthTotal.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span> this month
                <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">{burnRate.confidence}</span>
              </div>
            </div>
            {anomalies.length > 0 && (
              <Link
                to="/analytics?tab=anomalies"
                className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-orange-50 text-orange-700 text-sm font-medium hover:bg-orange-100 transition"
              >
                <AlertTriangle className="w-4 h-4 shrink-0" />
                {anomalies.length} unusual {anomalies.length === 1 ? "entry" : "entries"} detected
                <ArrowUpRight className="w-3.5 h-3.5 ml-auto" />
              </Link>
            )}
            {predictions.some((p) => p.budgetRisk === "danger" || p.budgetRisk === "warn") && (
              <div className="space-y-1">
                {predictions.filter((p) => p.budgetRisk !== "safe" && p.budgetRisk !== null).map((p) => (
                  <Link
                    key={p.project.id}
                    to={`/projects/${p.project.id}`}
                    className={cn("flex items-center gap-2 text-xs px-3 py-2 rounded-xl hover:bg-muted transition", p.budgetRisk === "danger" ? "text-primary" : "text-orange-600")}
                  >
                    <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", p.budgetRisk === "danger" ? "bg-primary" : "bg-orange-400")} />
                    <span className="font-semibold truncate">{p.project.name}</span>
                    <span className="ml-auto text-muted-foreground">
                      {p.budgetRisk === "danger" ? "Over budget" : p.daysToOverrun ? `~${p.daysToOverrun}d to overrun` : "At risk"}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Keep projects visible (important), everything else collapsible */}

      {/* Active projects */}
      <div className="stat-card">
        <div className="flex items-center justify-between mb-4">
          <SectionTitle>Active Projects</SectionTitle>
          <Link to="/projects" className="text-xs font-semibold text-primary flex items-center gap-1 hover:opacity-70 transition">
            View all <ArrowUpRight className="w-3 h-3" />
          </Link>
        </div>
        <div className="grid md:grid-cols-2 gap-2.5">
          {activeProjects.length === 0 && (
            <div className="text-sm text-muted-foreground py-10 text-center border-2 border-dashed border-border rounded-2xl col-span-2">
              No active projects yet — create one to get started.
            </div>
          )}
          {activeProjects.map((p) => {
            const ins = calcProjectInsights(p, expenses, incomes);
            const pct = ins.budgetUsedPct ?? 0;
            const profitPositive = ins.profit >= 0;
            return (
              <Link
                key={p.id}
                to={`/projects/${p.id}`}
                className="block p-4 rounded-2xl border border-border bg-card hover:border-primary/40 hover:shadow-md transition-all duration-200 group"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="font-semibold text-[14px] group-hover:text-primary transition leading-snug">{p.name}</span>
                  <span className={cn(
                    "font-display font-bold text-sm shrink-0",
                    profitPositive ? "text-emerald-600" : "text-primary"
                  )}>
                    {profitPositive ? "+" : "−"}${Math.abs(ins.profit).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </span>
                </div>
                {p.budget ? (
                  <div className="mt-3">
                    <div className="h-1 bg-muted rounded-full overflow-hidden">
                      <div
                        className={cn("h-full rounded-full transition-all", pct > 90 ? "bg-primary" : pct > 70 ? "bg-orange-400" : "bg-emerald-500")}
                        style={{ width: `${Math.min(100, pct)}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-muted-foreground mt-1.5">
                      <span>${ins.totalSpent.toLocaleString(undefined, { maximumFractionDigits: 0 })} spent</span>
                      <span className={cn("font-semibold", pct > 90 ? "text-primary" : "text-muted-foreground")}>{pct.toFixed(0)}% of ${Number(p.budget).toLocaleString()}</span>
                    </div>
                  </div>
                ) : (
                  <div className="text-[11px] text-muted-foreground mt-2">
                    ${ins.totalSpent.toLocaleString(undefined, { maximumFractionDigits: 0 })} spent
                  </div>
                )}
              </Link>
            );
          })}
        </div>
      </div>

      {/* Details (collapsed by default) */}
      <Collapsible open={detailsOpen} onOpenChange={setDetailsOpen}>
        <div className="flex items-center justify-between">
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">More details</div>
          <CollapsibleTrigger asChild>
            <button className="text-xs font-semibold text-primary hover:opacity-80 transition">
              {detailsOpen ? "Hide" : "Show"}
            </button>
          </CollapsibleTrigger>
        </div>
        <CollapsibleContent>
          <div className="space-y-4 mt-3">
            {/* Alerts */}
            {allAlerts.length > 0 && (
              <div className="stat-card">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-6 h-6 rounded-md bg-red-50 flex items-center justify-center">
                    <AlertTriangle className="w-3.5 h-3.5 text-primary" />
                  </div>
                  <SectionTitle>Smart Alerts</SectionTitle>
                </div>
                <div className="space-y-1">
                  {allAlerts.map((a, i) => (
                    <Link key={i} to={`/projects/${a.project.id}`} className="flex items-center gap-3 text-sm px-3 py-2.5 rounded-xl hover:bg-muted/60 transition">
                      <span className={`w-2 h-2 rounded-full shrink-0 ${a.level === "danger" ? "bg-primary" : "bg-orange-400"}`} />
                      <span className="font-semibold">{a.project.name}</span>
                      <span className="text-muted-foreground truncate">{a.message}</span>
                      <ArrowUpRight className="w-3.5 h-3.5 text-muted-foreground/50 ml-auto shrink-0" />
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Time chart + category */}
            <div className="grid lg:grid-cols-3 gap-4">
              <div className="lg:col-span-2 stat-card">
                <SectionTitle>Cash Flow Over Time</SectionTitle>
                <div className="h-64 mt-2">
                  <TerminalChartContainer config={{ expenses: { label: "Expenses" }, income: { label: "Income" } }} className="h-full">
                    <LineChart data={overTime} margin={{ top: 8, right: 10, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="4 6" vertical={false} />
                      <XAxis dataKey="date" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                      <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={(v) => `$${v / 1000}k`} width={46} />
                      <TerminalSharedTooltip />
                      <Line type="monotone" dataKey="expenses" stroke="hsl(0 84% 55%)" strokeWidth={2.5} dot={false} name="Expenses" />
                      <Line type="monotone" dataKey="income" stroke="hsl(142 70% 45%)" strokeWidth={2.5} dot={false} name="Income" />
                    </LineChart>
                  </TerminalChartContainer>
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
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

const fmt = (n: number) => `${n < 0 ? "-" : ""}$${Math.abs(n).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

function KPI({ label, value, icon: Icon, accent, color }: { label: string; value: string; icon: any; accent?: boolean; color?: "emerald" | "red" }) {
  const valueColor = color === "emerald" ? "text-emerald-600" : color === "red" ? "text-primary" : "text-foreground";
  if (accent) {
    return (
      <div className="rounded-2xl p-4 md:p-5 bg-[#111] text-white" style={{ boxShadow: "var(--shadow-md)" }}>
        <div className="flex items-center justify-between mb-3">
          <span className="text-[11px] font-semibold text-white/50 tracking-wide">{label}</span>
          <div className="w-7 h-7 rounded-lg bg-white/[0.07] flex items-center justify-center">
            <Icon className="w-3.5 h-3.5 text-primary" />
          </div>
        </div>
        <div className="font-display font-bold text-2xl md:text-[28px] leading-none text-white">{value}</div>
      </div>
    );
  }
  return (
    <div className="metric-card">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[11px] font-semibold text-muted-foreground tracking-wide">{label}</span>
        <div className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center">
          <Icon className="w-3.5 h-3.5 text-muted-foreground" />
        </div>
      </div>
      <div className={`font-display font-bold text-2xl md:text-[28px] leading-none ${valueColor}`}>{value}</div>
    </div>
  );
}

function SubCard({ label, value, sub, positive }: { label: string; value: string; sub: string; positive?: boolean }) {
  return (
    <div className="metric-card">
      <div className="flex items-center gap-2 mb-2">
        <div className={`w-6 h-6 rounded-md flex items-center justify-center ${positive ? "bg-emerald-50" : "bg-red-50"}`}>
          <Wallet className={`w-3.5 h-3.5 ${positive ? "text-emerald-600" : "text-primary"}`} />
        </div>
        <span className="text-[11px] font-semibold text-muted-foreground tracking-wide">{label}</span>
      </div>
      <div className={`font-display font-bold text-xl md:text-2xl ${positive ? "text-emerald-600" : "text-primary"}`}>{value}</div>
      <div className="text-xs text-muted-foreground mt-1">{sub}</div>
    </div>
  );
}

function PeriodCard({ title, income, expenses }: { title: string; income: number; expenses: number }) {
  const profit = income - expenses;
  return (
    <div className="stat-card">
      <SectionTitle>{title}</SectionTitle>
      <div className="grid grid-cols-3 gap-3 mt-4">
        <Cell2 label="Income" value={income} positive />
        <Cell2 label="Expenses" value={expenses} />
        <Cell2 label="Net" value={profit} positive={profit >= 0} bold />
      </div>
    </div>
  );
}

function Cell2({ label, value, positive, bold }: { label: string; value: number; positive?: boolean; bold?: boolean }) {
  return (
    <div className="min-w-0">
      <div className="text-[10px] font-semibold text-muted-foreground tracking-wide mb-1">{label}</div>
      <div className={`font-display truncate ${bold ? "font-bold text-base md:text-lg" : "font-semibold text-sm md:text-base"} ${positive ? "text-emerald-600" : "text-primary"}`}>
        {fmt(value)}
      </div>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="font-display font-semibold text-[13px] text-muted-foreground">{children}</h3>;
}

function DashboardSkeleton() {
  return (
    <div className="px-4 py-6 md:px-8 md:py-8 max-w-7xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div className="space-y-1.5">
          <Skeleton className="h-8 w-44" />
          <Skeleton className="h-4 w-56" />
        </div>
        <Skeleton className="h-9 w-32 rounded-xl" />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-[88px] rounded-2xl" />)}
      </div>
      <div className="grid grid-cols-2 gap-3 md:gap-4">
        <Skeleton className="h-20 rounded-2xl" />
        <Skeleton className="h-20 rounded-2xl" />
      </div>
      <Skeleton className="h-72 rounded-2xl" />
      <div className="grid lg:grid-cols-2 gap-4">
        <Skeleton className="h-64 rounded-2xl" />
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    </div>
  );
}

function HeroStat({ label, value, tone, highlight }: { label: string; value: string; tone: "emerald" | "red" | "gold"; highlight?: boolean }) {
  const toneClass =
    tone === "emerald" ? "text-emerald-300" :
    tone === "red" ? "text-red-300" :
    "text-[hsl(41_78%_78%)]";
  return (
    <div className={cn("flex flex-col leading-tight", highlight && "md:border-l md:border-white/10 md:pl-6")}>
      <span className="text-[9px] font-bold tracking-[0.20em] uppercase text-white/40">{label}</span>
      <span className={cn("font-display font-bold text-[20px] md:text-[26px] tabular-nums tracking-tight mt-0.5", highlight ? toneClass : "text-white")}>
        {value}
      </span>
    </div>
  );
}
