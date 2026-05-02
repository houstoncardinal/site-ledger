import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ReferenceLine, Brush,
} from "recharts";
import { FiltersProvider, useFilters, type DateRange, type FilterState } from "@/context/FiltersContext";
import {
  applyFilters, buildTimeSeries, buildCategoryBreakdown,
  buildProjectComparison, buildVendorAnalysis, buildCustomChartData,
  type DatasetType, type GroupByType, type MetricType, type TimeGrouping,
} from "@/lib/analyticsEngine";
import { calcCategoryTrends, detectAnomalies, calcBurnRate } from "@/lib/predictions";
import { useExpenses, useIncomes, useProjects } from "@/lib/hooks";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  TrendingUp, TrendingDown, BarChart2, PieChart as PieIcon,
  Table as TableIcon, Zap, AlertTriangle, ChevronRight, Flame, ArrowRight,
} from "lucide-react";
import { CATEGORY_LABELS, CATEGORY_COLORS, type ExpenseCategory } from "@/lib/types";
import { cn } from "@/lib/utils";
import {
  TerminalChartContainer,
  TerminalSharedTooltip,
  TerminalLegendToggle,
} from "@/components/ui/chart";

const $n = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

// ─── Filter Bar ───────────────────────────────────────────────────────────────

function FilterBar() {
  const { state, dispatch } = useFilters();
  const { data: projects = [] } = useProjects();

  const ranges: { label: string; value: DateRange }[] = [
    { label: "7D", value: 7 },
    { label: "30D", value: 30 },
    { label: "90D", value: 90 },
    { label: "1Y", value: 365 },
    { label: "All", value: 0 },
  ];

  return (
    <div className="sticky top-0 z-20 bg-background/95 backdrop-blur border-b border-border">
      <div className="max-w-7xl mx-auto px-4 md:px-8 py-3 flex flex-wrap items-center gap-2">
        <div className="flex gap-1 bg-muted rounded-lg p-1">
          {ranges.map((r) => (
            <button
              key={r.value}
              onClick={() => dispatch({ type: "SET_RANGE", range: r.value })}
              className={cn(
                "px-3 py-1 text-xs font-semibold rounded-md transition",
                state.range === r.value
                  ? "bg-card shadow-sm text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {r.label}
            </button>
          ))}
        </div>

        <Select
          value={state.projectId ?? "all"}
          onValueChange={(v) => dispatch({ type: "SET_PROJECT", projectId: v === "all" ? null : v })}
        >
          <SelectTrigger className="h-8 text-xs w-36">
            <SelectValue placeholder="All Projects" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Projects</SelectItem>
            {projects.map((p) => (
              <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={state.category ?? "all"}
          onValueChange={(v) => dispatch({ type: "SET_CATEGORY", category: v === "all" ? null : v })}
        >
          <SelectTrigger className="h-8 text-xs w-36">
            <SelectValue placeholder="All Categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {(state.projectId || state.category) && (
          <button
            onClick={() => dispatch({ type: "RESET" })}
            className="text-xs text-muted-foreground hover:text-foreground underline"
          >
            Clear filters
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Overview Tab ─────────────────────────────────────────────────────────────

function OverviewTab({ filtered, raw }: { filtered: ReturnType<typeof applyFilters>; raw: { expenses: any[]; incomes: any[] } }) {
  const { state } = useFilters();
  const navigate = useNavigate();
  const grouping: TimeGrouping = state.range <= 30 ? "daily" : state.range <= 90 ? "weekly" : "monthly";
  const series = useMemo(() => buildTimeSeries(filtered.expenses, filtered.incomes, state.range, grouping), [filtered, state.range, grouping]);
  const categories = useMemo(() => buildCategoryBreakdown(filtered.expenses), [filtered.expenses]);
  const burnRate = useMemo(() => calcBurnRate(raw.expenses), [raw.expenses]);
  const trends = useMemo(() => calcCategoryTrends(raw.expenses), [raw.expenses]);

  const totalSpend = filtered.expenses.reduce((s, e) => s + Number(e.amount), 0);
  const totalRevenue = filtered.incomes.filter((i: any) => i.payment_status === "paid").reduce((s: number, i: any) => s + Number(i.amount), 0);
  const net = totalRevenue - totalSpend;

  const drillTo = (params: Record<string, string>) => {
    const sp = new URLSearchParams(params);
    navigate(`/transactions?${sp}`);
  };

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KPICard label="Revenue" value={$n(totalRevenue)} delta={null} positive />
        <KPICard label="Expenses" value={$n(totalSpend)} delta={null} />
        <KPICard label="Net" value={$n(net)} delta={null} positive={net >= 0} />
        <KPICard
          label="Daily Burn"
          value={$n(burnRate.dailyRate)}
          sub={`~${$n(burnRate.projectedMonthTotal)}/mo`}
        />
      </div>

      {/* Cash flow chart */}
      <ChartCard
        title="Cash Flow"
        subtitle={`${grouping === "daily" ? "Daily" : grouping === "weekly" ? "Weekly" : "Monthly"} income vs expenses`}
        onDrill={() => drillTo({})}
      >
        <TerminalChartContainer config={{ income: { label: "Income" }, expenses: { label: "Expenses" } }}>
          <LineChart data={series} margin={{ top: 8, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="4 6" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
            <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={(v) => `$${v / 1000}k`} width={46} />
            <TerminalSharedTooltip />
            <ReferenceLine y={0} stroke="rgba(255,255,255,0.18)" />
            <Line type="monotone" dataKey="income" stroke="hsl(142 70% 45%)" strokeWidth={2.5} dot={false} name="Income" />
            <Line type="monotone" dataKey="expenses" stroke="hsl(0 84% 55%)" strokeWidth={2.5} dot={false} name="Expenses" />
            {series.length > 14 && (
              <Brush
                dataKey="label"
                height={24}
                stroke="rgba(255,255,255,0.25)"
                fill="rgba(255,255,255,0.06)"
                travellerWidth={14}
              />
            )}
          </LineChart>
        </TerminalChartContainer>
      </ChartCard>

      {/* Category breakdown + trends */}
      <div className="grid lg:grid-cols-2 gap-4">
        <ChartCard
          title="Spend by Category"
          onDrill={() => drillTo({})}
        >
          <div className="flex items-center gap-4">
            <div className="w-44 h-44 shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categories}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={40}
                    outerRadius={68}
                    paddingAngle={2}
                    onClick={(d) => drillTo({ category: d.key })}
                    style={{ cursor: "pointer" }}
                  >
                    {categories.map((c) => (
                      <Cell key={c.key} fill={c.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number) => $n(v)} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex-1 space-y-2 min-w-0">
              {categories.slice(0, 6).map((c) => (
                <button
                  key={c.key}
                  onClick={() => drillTo({ category: c.key })}
                  className="w-full flex items-center gap-2 text-sm hover:bg-muted/60 px-2 py-1 rounded-md transition text-left"
                >
                  <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: c.color }} />
                  <span className="flex-1 truncate text-xs">{c.name}</span>
                  <span className="font-semibold text-xs shrink-0">{c.pct.toFixed(0)}%</span>
                </button>
              ))}
            </div>
          </div>
        </ChartCard>

        <ChartCard title="Category Trends" subtitle="vs last month">
          <div className="space-y-3">
            {trends.slice(0, 6).map((t) => (
              <button
                key={t.category}
                onClick={() => drillTo({ category: t.category })}
                className="w-full flex items-center gap-3 text-left hover:bg-muted/50 px-2 py-1.5 rounded-md transition"
              >
                <span className="text-sm flex-1 truncate">{t.label}</span>
                <span className="text-xs text-muted-foreground shrink-0">{$n(t.thisMonth)}</span>
                <TrendBadge pct={t.pctChange} trend={t.trend} />
              </button>
            ))}
            {trends.length === 0 && <p className="text-sm text-muted-foreground py-4 text-center">No data for comparison yet.</p>}
          </div>
        </ChartCard>
      </div>
    </div>
  );
}

// ─── Projects Tab ─────────────────────────────────────────────────────────────

function ProjectsTab({ filtered }: { filtered: ReturnType<typeof applyFilters> }) {
  const { data: projects = [] } = useProjects();
  const { dispatch } = useFilters();
  const navigate = useNavigate();
  const [hidden, setHidden] = useState<Record<string, boolean>>({});
  const comparison = useMemo(() => buildProjectComparison(projects, filtered.expenses, filtered.incomes), [projects, filtered]);

  return (
    <div className="space-y-6">
      <ChartCard title="Revenue vs Expenses by Project" subtitle="Click a bar to filter">
        <TerminalChartContainer config={{ income: { label: "Revenue" }, expenses: { label: "Expenses" } }}>
          <BarChart data={comparison} margin={{ top: 8, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="4 6" vertical={false} />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
            <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={(v) => `$${v / 1000}k`} width={46} />
            <TerminalSharedTooltip />
            <Legend
              verticalAlign="bottom"
              content={(p) => (
                <TerminalLegendToggle
                  payload={p.payload}
                  hiddenKeys={hidden}
                  onToggle={(k) => setHidden((h) => ({ ...h, [k]: !h[k] }))}
                  className="pt-3"
                />
              )}
            />
            {!hidden.income && (
              <Bar
                dataKey="income"
                fill="hsl(142 70% 45%)"
                radius={[6, 6, 0, 0]}
                name="Revenue"
                onClick={(d) => { dispatch({ type: "SET_PROJECT", projectId: (d as any).id }); navigate(`/transactions?project=${(d as any).id}`); }}
                style={{ cursor: "pointer" }}
              />
            )}
            {!hidden.expenses && (
              <Bar
                dataKey="expenses"
                fill="hsl(0 84% 55%)"
                radius={[6, 6, 0, 0]}
                name="Expenses"
                onClick={(d) => { dispatch({ type: "SET_PROJECT", projectId: (d as any).id }); navigate(`/transactions?project=${(d as any).id}`); }}
                style={{ cursor: "pointer" }}
              />
            )}
          </BarChart>
        </TerminalChartContainer>
      </ChartCard>

      <div className="grid gap-3">
        {comparison.map((p) => (
          <div
            key={p.id}
            className="bg-card border border-border rounded-xl p-4 flex items-center gap-4 hover:border-primary/50 transition cursor-pointer"
            onClick={() => navigate(`/transactions?project=${p.id}`)}
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <span className="font-semibold truncate">{p.name}</span>
                <span className={cn("text-sm font-display font-bold ml-auto shrink-0", p.net >= 0 ? "text-emerald-700" : "text-primary")}>
                  {p.net >= 0 ? "+" : ""}{$n(p.net)}
                </span>
              </div>
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span className="text-emerald-700 font-medium">Rev: {$n(p.income)}</span>
                <span className="text-primary font-medium">Exp: {$n(p.expenses)}</span>
                {p.budgetPct !== null && (
                  <span className={cn("font-medium", p.budgetPct >= 100 ? "text-primary" : p.budgetPct >= 80 ? "text-warning" : "")}>
                    Budget: {p.budgetPct}%
                  </span>
                )}
              </div>
              {p.budgetPct !== null && (
                <div className="h-1.5 bg-muted rounded-full mt-2 overflow-hidden">
                  <div
                    className={cn("h-full rounded-full transition-all", p.budgetPct >= 100 ? "bg-primary" : p.budgetPct >= 80 ? "bg-warning" : "bg-emerald-600")}
                    style={{ width: `${Math.min(100, p.budgetPct)}%` }}
                  />
                </div>
              )}
            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
          </div>
        ))}
        {comparison.length === 0 && (
          <div className="text-center py-16 text-muted-foreground border border-dashed rounded-xl">No project data in this period.</div>
        )}
      </div>
    </div>
  );
}

// ─── Categories Tab ───────────────────────────────────────────────────────────

function CategoriesTab({ filtered }: { filtered: ReturnType<typeof applyFilters> }) {
  const navigate = useNavigate();
  const { dispatch } = useFilters();
  const categories = useMemo(() => buildCategoryBreakdown(filtered.expenses), [filtered.expenses]);
  const vendors = useMemo(() => buildVendorAnalysis(filtered.expenses).slice(0, 10), [filtered.expenses]);

  return (
    <div className="space-y-6">
      <div className="grid lg:grid-cols-2 gap-4">
        <ChartCard title="Category Breakdown" subtitle="Tap to drill down">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={categories} layout="vertical" margin={{ top: 0, right: 8, left: 4, bottom: 0 }}>
              <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={(v) => `$${v / 1000}k`} stroke="hsl(0 0% 60%)" tickLine={false} />
              <YAxis type="category" dataKey="name" width={88} tick={{ fontSize: 11 }} stroke="hsl(0 0% 60%)" tickLine={false} />
              <Tooltip formatter={(v: number) => $n(v)} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
              <Bar
                dataKey="value"
                radius={[0, 6, 6, 0]}
                onClick={(d) => { dispatch({ type: "SET_CATEGORY", category: d.key }); navigate(`/transactions?category=${d.key}`); }}
                style={{ cursor: "pointer" }}
              >
                {categories.map((c) => <Cell key={c.key} fill={c.color} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Top Vendors" subtitle="By total spend">
          <div className="space-y-2">
            {vendors.slice(0, 8).map((v, i) => (
              <button
                key={v.name}
                onClick={() => navigate(`/transactions?q=${encodeURIComponent(v.name)}`)}
                className="w-full flex items-center gap-3 text-left hover:bg-muted/50 px-2 py-2 rounded-md transition"
              >
                <span className="text-xs text-muted-foreground w-4 shrink-0">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{v.name}</div>
                  <div className="text-xs text-muted-foreground">{v.count} entries · avg {$n(v.avgAmount)}</div>
                </div>
                <span className="font-bold text-sm shrink-0">{$n(v.amount)}</span>
              </button>
            ))}
          </div>
        </ChartCard>
      </div>

      {/* Category % bar */}
      {categories.length > 0 && (
        <ChartCard title="Spend Distribution">
          <div className="flex h-6 rounded-full overflow-hidden gap-0.5">
            {categories.map((c) => (
              <div
                key={c.key}
                style={{ width: `${c.pct}%`, background: c.color }}
                title={`${c.name}: ${c.pct.toFixed(1)}%`}
                className="cursor-pointer hover:opacity-80 transition"
                onClick={() => navigate(`/transactions?category=${c.key}`)}
              />
            ))}
          </div>
          <div className="flex flex-wrap gap-3 mt-3">
            {categories.map((c) => (
              <button
                key={c.key}
                onClick={() => navigate(`/transactions?category=${c.key}`)}
                className="flex items-center gap-1.5 text-xs hover:opacity-70 transition"
              >
                <span className="w-2.5 h-2.5 rounded-sm" style={{ background: c.color }} />
                {c.name} ({c.pct.toFixed(0)}%)
              </button>
            ))}
          </div>
        </ChartCard>
      )}
    </div>
  );
}

// ─── Profitability Tab ────────────────────────────────────────────────────────

function ProfitabilityTab({ filtered }: { filtered: ReturnType<typeof applyFilters> }) {
  const { state } = useFilters();
  const grouping: TimeGrouping = state.range <= 30 ? "daily" : state.range <= 90 ? "weekly" : "monthly";
  const series = useMemo(
    () => buildTimeSeries(filtered.expenses, filtered.incomes, state.range, grouping),
    [filtered, state.range, grouping]
  );

  const totalRevenue = filtered.incomes.filter((i: any) => i.payment_status === "paid").reduce((s: number, i: any) => s + Number(i.amount), 0);
  const totalExpenses = filtered.expenses.reduce((s, e) => s + Number(e.amount), 0);
  const net = totalRevenue - totalExpenses;
  const margin = totalRevenue > 0 ? (net / totalRevenue) * 100 : 0;

  const cumSeries = useMemo(() => {
    let cumNet = 0;
    return series.map((p) => {
      cumNet += p.net;
      return { ...p, cumNet };
    });
  }, [series]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPICard label="Revenue" value={$n(totalRevenue)} positive />
        <KPICard label="Expenses" value={$n(totalExpenses)} />
        <KPICard label="Net Profit" value={$n(net)} positive={net >= 0} />
        <KPICard label="Margin" value={`${margin.toFixed(1)}%`} positive={margin >= 0} />
      </div>

      <ChartCard title="Net Profit Over Time" subtitle="Cumulative net position">
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={cumSeries} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(0 0% 90%)" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 10 }} stroke="hsl(0 0% 60%)" tickLine={false} />
            <YAxis tick={{ fontSize: 10 }} stroke="hsl(0 0% 60%)" tickLine={false} tickFormatter={(v) => `$${v / 1000}k`} width={44} />
            <Tooltip formatter={(v: number) => $n(v)} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
            <ReferenceLine y={0} stroke="hsl(0 0% 60%)" strokeDasharray="4 4" />
            <Line
              type="monotone"
              dataKey="cumNet"
              stroke={net >= 0 ? "hsl(142 70% 40%)" : "hsl(0 84% 50%)"}
              strokeWidth={2.5}
              dot={false}
              name="Cumulative Net"
            />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Period Net Profit" subtitle="Income minus expenses per period">
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={series} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(0 0% 90%)" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 10 }} stroke="hsl(0 0% 60%)" tickLine={false} />
            <YAxis tick={{ fontSize: 10 }} stroke="hsl(0 0% 60%)" tickLine={false} tickFormatter={(v) => `$${v / 1000}k`} width={44} />
            <Tooltip formatter={(v: number) => $n(v)} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
            <ReferenceLine y={0} stroke="hsl(0 0% 60%)" />
            <Bar dataKey="net" radius={[4, 4, 0, 0]} name="Net">
              {series.map((p, i) => (
                <Cell key={i} fill={p.net >= 0 ? "hsl(142 70% 40%)" : "hsl(0 84% 50%)"} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  );
}

// ─── Anomalies Tab ────────────────────────────────────────────────────────────

function AnomaliesTab({ raw }: { raw: { expenses: any[]; incomes: any[] } }) {
  const navigate = useNavigate();
  const anomalies = useMemo(() => detectAnomalies(raw.expenses), [raw.expenses]);

  return (
    <div className="space-y-4">
      {anomalies.length === 0 ? (
        <div className="text-center py-20 border border-dashed rounded-xl">
          <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto mb-3">
            <Zap className="w-6 h-6" />
          </div>
          <p className="font-semibold">No anomalies detected</p>
          <p className="text-sm text-muted-foreground mt-1">All entries look normal based on your history.</p>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <AlertTriangle className="w-4 h-4 text-warning" />
            {anomalies.length} unusual {anomalies.length === 1 ? "entry" : "entries"} detected in the last 90 days
          </div>
          {anomalies.map((a) => (
            <button
              key={a.expense.id}
              onClick={() => navigate(`/transactions`)}
              className={cn(
                "w-full text-left p-4 rounded-xl border flex items-start gap-3 hover:shadow-sm transition",
                a.severity === "danger" ? "border-primary/40 bg-primary/5" : "border-warning/40 bg-warning/5"
              )}
            >
              <AlertTriangle className={cn("w-5 h-5 mt-0.5 shrink-0", a.severity === "danger" ? "text-primary" : "text-warning")} />
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm">{a.message}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{a.expense.date} · {a.expense.category}</p>
              </div>
              <div className="font-display font-bold text-sm shrink-0">${Number(a.expense.amount).toLocaleString()}</div>
            </button>
          ))}
        </>
      )}
    </div>
  );
}

// ─── Custom Chart Builder ─────────────────────────────────────────────────────

type ChartType = "line" | "bar" | "horizontal_bar" | "pie" | "table";

function BuilderTab({ filtered }: { filtered: ReturnType<typeof applyFilters> }) {
  const { data: projects = [] } = useProjects();
  const [dataset, setDataset] = useState<DatasetType>("expenses");
  const [groupBy, setGroupBy] = useState<GroupByType>("category");
  const [metric, setMetric] = useState<MetricType>("sum");
  const [chartType, setChartType] = useState<ChartType>("bar");
  const [built, setBuilt] = useState(false);

  const chartData = useMemo(
    () => built ? buildCustomChartData(filtered.expenses, filtered.incomes, projects, dataset, groupBy, metric) : [],
    [built, filtered, projects, dataset, groupBy, metric]
  );

  const metricLabel = metric === "sum" ? "Total ($)" : metric === "count" ? "Count" : "Average ($)";

  return (
    <div className="space-y-6">
      <div className="bg-card border border-border rounded-xl p-5 space-y-4">
        <h3 className="font-display font-semibold text-sm uppercase tracking-wider text-muted-foreground">Build a Chart</h3>

        <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-3">
          <div className="space-y-1.5">
            <label className="text-xs uppercase font-semibold text-muted-foreground">Dataset</label>
            <Select value={dataset} onValueChange={(v) => { setDataset(v as DatasetType); setBuilt(false); }}>
              <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="expenses">Expenses</SelectItem>
                <SelectItem value="incomes">Income</SelectItem>
                <SelectItem value="both">Both</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs uppercase font-semibold text-muted-foreground">Group By</label>
            <Select value={groupBy} onValueChange={(v) => { setGroupBy(v as GroupByType); setBuilt(false); }}>
              <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="date">Date (Month)</SelectItem>
                <SelectItem value="project">Project</SelectItem>
                <SelectItem value="category">Category</SelectItem>
                <SelectItem value="vendor">Vendor</SelectItem>
                <SelectItem value="payment_method">Payment Method</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs uppercase font-semibold text-muted-foreground">Metric</label>
            <Select value={metric} onValueChange={(v) => { setMetric(v as MetricType); setBuilt(false); }}>
              <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="sum">Total Amount</SelectItem>
                <SelectItem value="count">Count</SelectItem>
                <SelectItem value="avg">Average Amount</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs uppercase font-semibold text-muted-foreground">Chart Type</label>
            <div className="flex gap-1">
              {([
                { t: "bar", icon: BarChart2 },
                { t: "line", icon: TrendingUp },
                { t: "pie", icon: PieIcon },
                { t: "table", icon: TableIcon },
              ] as const).map(({ t, icon: Icon }) => (
                <button
                  key={t}
                  onClick={() => { setChartType(t); setBuilt(false); }}
                  className={cn(
                    "flex-1 h-10 rounded-md flex items-center justify-center transition",
                    chartType === t ? "bg-primary text-primary-foreground shadow-sm" : "bg-muted hover:bg-muted/80 text-foreground"
                  )}
                >
                  <Icon className="w-4 h-4" />
                </button>
              ))}
            </div>
          </div>
        </div>

        <Button className="w-full h-12 bg-gradient-primary shadow-red" onClick={() => setBuilt(true)}>
          <Zap className="w-4 h-4 mr-2" /> Generate Chart
        </Button>
      </div>

      {built && chartData.length > 0 && (
        <ChartCard title={`${metricLabel} by ${groupBy.replace("_", " ")}`} subtitle={`${dataset} · ${chartData.length} groups`}>
          {chartType === "table" ? (
            <div className="divide-y divide-border">
              <div className="grid grid-cols-2 text-xs uppercase font-semibold text-muted-foreground py-2 px-2">
                <span>Group</span><span className="text-right">{metricLabel}</span>
              </div>
              {chartData.map((d) => (
                <div key={d.name} className="grid grid-cols-2 py-2 px-2 text-sm hover:bg-muted/40">
                  <span className="truncate">{d.name}</span>
                  <span className="text-right font-semibold">{metric !== "count" ? $n(d.value) : d.value.toLocaleString()}</span>
                </div>
              ))}
            </div>
          ) : chartType === "pie" ? (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie data={chartData} dataKey="value" nameKey="name" innerRadius={50} outerRadius={100} paddingAngle={2}>
                  {chartData.map((_, i) => (
                    <Cell key={i} fill={`hsl(${(i * 47) % 360} 70% 50%)`} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: number) => metric !== "count" ? $n(v) : v} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          ) : chartType === "line" ? (
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(0 0% 90%)" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} stroke="hsl(0 0% 60%)" tickLine={false} />
                <YAxis tick={{ fontSize: 10 }} stroke="hsl(0 0% 60%)" tickLine={false} tickFormatter={(v) => metric !== "count" ? `$${v / 1000}k` : v} width={44} />
                <Tooltip formatter={(v: number) => metric !== "count" ? $n(v) : v} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                <Line type="monotone" dataKey="value" stroke="hsl(0 84% 50%)" strokeWidth={2.5} dot={false} name={metricLabel} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(0 0% 90%)" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} stroke="hsl(0 0% 60%)" tickLine={false} />
                <YAxis tick={{ fontSize: 10 }} stroke="hsl(0 0% 60%)" tickLine={false} tickFormatter={(v) => metric !== "count" ? `$${v / 1000}k` : v} width={44} />
                <Tooltip formatter={(v: number) => metric !== "count" ? $n(v) : v} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                <Bar dataKey="value" fill="hsl(0 84% 50%)" radius={[4, 4, 0, 0]} name={metricLabel}>
                  {chartData.map((_, i) => (
                    <Cell key={i} fill={`hsl(${(i * 47) % 360} 70% 50%)`} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      )}

      {built && chartData.length === 0 && (
        <div className="text-center py-12 border border-dashed rounded-xl text-muted-foreground">
          No data matches the selected filters and dataset.
        </div>
      )}
    </div>
  );
}

// ─── Shared Components ────────────────────────────────────────────────────────

function ChartCard({ title, subtitle, children, onDrill }: {
  title: string; subtitle?: string; children: React.ReactNode; onDrill?: () => void;
}) {
  return (
    <div className="bg-card border border-border rounded-xl p-4 md:p-5">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="font-display font-semibold text-sm">{title}</h3>
          {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
        </div>
        {onDrill && (
          <button onClick={onDrill} className="text-xs text-primary flex items-center gap-1 hover:opacity-70 transition">
            All <ArrowRight className="w-3 h-3" />
          </button>
        )}
      </div>
      {children}
    </div>
  );
}

function KPICard({ label, value, positive, sub, delta }: {
  label: string; value: string; positive?: boolean; sub?: string; delta?: null | number;
}) {
  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <div className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">{label}</div>
      <div className={cn("font-display font-bold text-xl md:text-2xl mt-1", positive ? "text-emerald-700" : positive === false ? "text-primary" : "")}>
        {value}
      </div>
      {sub && <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>}
    </div>
  );
}

function TrendBadge({ pct, trend }: { pct: number; trend: "up" | "down" | "stable" }) {
  if (trend === "stable") return <Badge variant="secondary" className="text-[10px] h-4 px-1.5">stable</Badge>;
  const up = trend === "up";
  return (
    <Badge className={cn("text-[10px] h-4 px-1.5 gap-0.5", up ? "bg-red-100 text-primary border-0" : "bg-emerald-100 text-emerald-700 border-0")}>
      {up ? <TrendingUp className="w-2.5 h-2.5" /> : <TrendingDown className="w-2.5 h-2.5" />}
      {Math.abs(pct).toFixed(0)}%
    </Badge>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

function AnalyticsInner() {
  const { state } = useFilters();
  const { data: expenses = [] } = useExpenses();
  const { data: incomes = [] } = useIncomes();

  const filtered = useMemo(
    () => applyFilters(expenses, incomes, state),
    [expenses, incomes, state]
  );

  const anomalyCount = useMemo(() => detectAnomalies(expenses).length, [expenses]);

  return (
    <div className="min-h-screen">
      <FilterBar />
      <div className="max-w-7xl mx-auto px-4 md:px-8 py-6 space-y-6">
        <div className="flex items-end justify-between">
          <div>
            <h1 className="font-display text-3xl md:text-4xl font-bold">Intelligence</h1>
            <p className="text-muted-foreground mt-1">Financial analytics and insights.</p>
          </div>
          {anomalyCount > 0 && (
            <button className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-warning/10 text-warning text-sm font-medium border border-warning/30">
              <Flame className="w-4 h-4" />
              {anomalyCount} anomal{anomalyCount === 1 ? "y" : "ies"}
            </button>
          )}
        </div>

        <Tabs defaultValue="overview">
          <TabsList className="bg-muted h-10 flex-wrap">
            <TabsTrigger value="overview" className="text-xs">Overview</TabsTrigger>
            <TabsTrigger value="projects" className="text-xs">Projects</TabsTrigger>
            <TabsTrigger value="categories" className="text-xs">Categories</TabsTrigger>
            <TabsTrigger value="profitability" className="text-xs">Profitability</TabsTrigger>
            <TabsTrigger value="anomalies" className="text-xs">
              Anomalies {anomalyCount > 0 && <span className="ml-1 w-4 h-4 rounded-full bg-warning text-black text-[9px] font-bold flex items-center justify-center">{anomalyCount}</span>}
            </TabsTrigger>
            <TabsTrigger value="builder" className="text-xs">Builder</TabsTrigger>
          </TabsList>

          <div className="mt-6">
            <TabsContent value="overview">
              <OverviewTab filtered={filtered} raw={{ expenses, incomes }} />
            </TabsContent>
            <TabsContent value="projects">
              <ProjectsTab filtered={filtered} />
            </TabsContent>
            <TabsContent value="categories">
              <CategoriesTab filtered={filtered} />
            </TabsContent>
            <TabsContent value="profitability">
              <ProfitabilityTab filtered={filtered} />
            </TabsContent>
            <TabsContent value="anomalies">
              <AnomaliesTab raw={{ expenses, incomes }} />
            </TabsContent>
            <TabsContent value="builder">
              <BuilderTab filtered={filtered} />
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </div>
  );
}

export default function Analytics() {
  return (
    <FiltersProvider>
      <AnalyticsInner />
    </FiltersProvider>
  );
}
