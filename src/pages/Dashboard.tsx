import { useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  BarChart, Bar,
} from "recharts";
import { EXPENSE_LABELS } from "@/lib/types";
import { format, subDays, startOfDay } from "date-fns";
import { TrendingUp, DollarSign, FolderOpen, Activity, ArrowUpRight } from "lucide-react";
import { Link } from "react-router-dom";

const CATEGORY_COLORS: Record<string, string> = {
  expense: "hsl(0 84% 50%)",
  labor: "hsl(38 92% 50%)",
  materials: "hsl(217 91% 55%)",
  equipment: "hsl(142 70% 40%)",
  other: "hsl(0 0% 35%)",
};

export default function Dashboard() {
  const projects = useStore((s) => s.projects);
  const expenses = useStore((s) => s.expenses);
  const [range, setRange] = useState(30);

  const filtered = useMemo(() => {
    const cutoff = startOfDay(subDays(new Date(), range)).getTime();
    return expenses.filter((e) => new Date(e.date).getTime() >= cutoff);
  }, [expenses, range]);

  const totalSpend = filtered.reduce((s, e) => s + e.amount, 0);
  const activeProjects = projects.filter((p) => p.status === "active");

  const byCategory = useMemo(() => {
    const m = new Map<string, number>();
    filtered.forEach((e) => m.set(e.type, (m.get(e.type) ?? 0) + e.amount));
    return Array.from(m, ([k, v]) => ({ name: EXPENSE_LABELS[k as keyof typeof EXPENSE_LABELS], key: k, value: v }));
  }, [filtered]);

  const overTime = useMemo(() => {
    const days = range;
    const buckets = Array.from({ length: days }, (_, i) => {
      const d = subDays(new Date(), days - 1 - i);
      return { date: format(d, "MMM d"), iso: format(d, "yyyy-MM-dd"), amount: 0 };
    });
    filtered.forEach((e) => {
      const b = buckets.find((x) => x.iso === e.date);
      if (b) b.amount += e.amount;
    });
    return buckets;
  }, [filtered, range]);

  const topVendors = useMemo(() => {
    const m = new Map<string, number>();
    filtered.forEach((e) => m.set(e.vendor, (m.get(e.vendor) ?? 0) + e.amount));
    return Array.from(m, ([name, amount]) => ({ name, amount }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);
  }, [filtered]);

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

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        <KPI label="Total Spend" value={`$${totalSpend.toLocaleString(undefined, { maximumFractionDigits: 0 })}`} icon={DollarSign} accent />
        <KPI label="Entries" value={filtered.length.toString()} icon={Activity} />
        <KPI label="Active Projects" value={activeProjects.length.toString()} icon={FolderOpen} />
        <KPI label="Avg / Entry" value={`$${filtered.length ? Math.round(totalSpend / filtered.length).toLocaleString() : 0}`} icon={TrendingUp} />
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 stat-card">
          <SectionTitle>Spend Over Time</SectionTitle>
          <div className="h-64 mt-2">
            <ResponsiveContainer>
              <LineChart data={overTime}>
                <defs>
                  <linearGradient id="lg" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(0 84% 50%)" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="hsl(0 84% 50%)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(0 0% 90%)" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="hsl(0 0% 50%)" />
                <YAxis tick={{ fontSize: 11 }} stroke="hsl(0 0% 50%)" tickFormatter={(v) => `$${v / 1000}k`} />
                <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid hsl(0 0% 90%)" }} formatter={(v: number) => `$${v.toLocaleString()}`} />
                <Line type="monotone" dataKey="amount" stroke="hsl(0 84% 50%)" strokeWidth={2.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="stat-card">
          <SectionTitle>By Category</SectionTitle>
          <div className="h-48 mt-2">
            <ResponsiveContainer>
              <PieChart>
                <Pie data={byCategory} dataKey="value" nameKey="name" innerRadius={45} outerRadius={75} paddingAngle={2}>
                  {byCategory.map((c) => <Cell key={c.key} fill={CATEGORY_COLORS[c.key]} />)}
                </Pie>
                <Tooltip formatter={(v: number) => `$${v.toLocaleString()}`} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-1.5 mt-2">
            {byCategory.map((c) => (
              <div key={c.key} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-sm" style={{ background: CATEGORY_COLORS[c.key] }} />
                  <span>{c.name}</span>
                </div>
                <span className="font-semibold">${c.value.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
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

        <div className="stat-card">
          <div className="flex items-center justify-between">
            <SectionTitle>Active Projects</SectionTitle>
            <Link to="/projects" className="text-xs font-semibold text-primary flex items-center gap-1">
              View all <ArrowUpRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="space-y-2 mt-3">
            {activeProjects.length === 0 && (
              <div className="text-sm text-muted-foreground py-8 text-center border border-dashed rounded-lg">
                No active projects yet.
              </div>
            )}
            {activeProjects.map((p) => {
              const spent = expenses.filter((e) => e.projectId === p.id).reduce((s, e) => s + e.amount, 0);
              const pct = p.budget ? Math.min(100, (spent / p.budget) * 100) : 0;
              return (
                <Link key={p.id} to={`/projects/${p.id}`} className="block p-3 rounded-lg border border-border hover:border-primary transition group">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold group-hover:text-primary transition">{p.name}</span>
                    <span className="text-sm font-display font-bold">${spent.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                  </div>
                  {p.budget ? (
                    <div className="mt-2">
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                        <div
                          className={`h-full ${pct > 90 ? "bg-primary" : pct > 70 ? "bg-warning" : "bg-success"}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {pct.toFixed(0)}% of ${p.budget.toLocaleString()} budget
                      </div>
                    </div>
                  ) : (
                    <div className="text-xs text-muted-foreground mt-1">No budget set</div>
                  )}
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function KPI({ label, value, icon: Icon, accent }: { label: string; value: string; icon: any; accent?: boolean }) {
  return (
    <div className={`rounded-xl p-4 md:p-5 border ${accent ? "bg-surface-dark text-white border-transparent" : "bg-card border-border"}`}>
      <div className="flex items-center justify-between">
        <span className={`text-xs uppercase tracking-wider font-semibold ${accent ? "text-white/60" : "text-muted-foreground"}`}>{label}</span>
        <Icon className={`w-4 h-4 ${accent ? "text-primary" : "text-muted-foreground"}`} />
      </div>
      <div className="font-display font-bold text-2xl md:text-3xl mt-2">{value}</div>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="font-display font-semibold text-sm uppercase tracking-wider text-muted-foreground">{children}</h3>;
}
