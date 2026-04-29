import { useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import { useStore } from "@/lib/store";
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
  LineChart, Line, XAxis, YAxis, CartesianGrid,
} from "recharts";
import { EXPENSE_LABELS } from "@/lib/types";
import { format, parseISO } from "date-fns";
import { ArrowLeft } from "lucide-react";
import TransactionList from "@/components/TransactionList";

const CATEGORY_COLORS: Record<string, string> = {
  expense: "hsl(0 84% 50%)",
  labor: "hsl(38 92% 50%)",
  materials: "hsl(217 91% 55%)",
  equipment: "hsl(142 70% 40%)",
  other: "hsl(0 0% 35%)",
};

export default function ProjectDetail() {
  const { id } = useParams();
  const project = useStore((s) => s.projects.find((p) => p.id === id));
  const expenses = useStore((s) => s.expenses.filter((e) => e.projectId === id));

  const total = expenses.reduce((s, e) => s + e.amount, 0);
  const byCategory = useMemo(() => {
    const m = new Map<string, number>();
    expenses.forEach((e) => m.set(e.type, (m.get(e.type) ?? 0) + e.amount));
    return Array.from(m, ([k, v]) => ({ key: k, name: EXPENSE_LABELS[k as keyof typeof EXPENSE_LABELS], value: v }));
  }, [expenses]);

  const timeline = useMemo(() => {
    const m = new Map<string, number>();
    expenses.forEach((e) => m.set(e.date, (m.get(e.date) ?? 0) + e.amount));
    return Array.from(m, ([date, amount]) => ({ date, amount, label: format(parseISO(date), "MMM d") }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [expenses]);

  if (!project) {
    return (
      <div className="p-8 text-center">
        <p>Project not found.</p>
        <Link to="/projects" className="text-primary underline">Back to projects</Link>
      </div>
    );
  }

  const remaining = project.budget ? project.budget - total : null;
  const pct = project.budget ? (total / project.budget) * 100 : 0;

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
      <Link to="/projects" className="text-sm text-muted-foreground hover:text-primary flex items-center gap-1">
        <ArrowLeft className="w-4 h-4" /> All Projects
      </Link>

      <div className="bg-surface-dark text-white rounded-xl p-6 md:p-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-primary/20 rounded-full blur-3xl" />
        <div className="relative">
          <div className="text-xs uppercase tracking-wider text-white/50">{project.id}</div>
          <h1 className="font-display text-3xl md:text-4xl font-bold mt-1">{project.name}</h1>
          <div className="text-sm text-white/60 mt-1">
            Started {format(parseISO(project.startDate), "MMM d, yyyy")} · {project.status}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
            <div>
              <div className="text-xs text-white/50 uppercase">Total Spent</div>
              <div className="font-display font-bold text-2xl mt-1">${total.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
            </div>
            <div>
              <div className="text-xs text-white/50 uppercase">Budget</div>
              <div className="font-display font-bold text-2xl mt-1">{project.budget ? `$${project.budget.toLocaleString()}` : "—"}</div>
            </div>
            <div>
              <div className="text-xs text-white/50 uppercase">Remaining</div>
              <div className={`font-display font-bold text-2xl mt-1 ${remaining !== null && remaining < 0 ? "text-primary" : ""}`}>
                {remaining !== null ? `$${remaining.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : "—"}
              </div>
            </div>
            <div>
              <div className="text-xs text-white/50 uppercase">Entries</div>
              <div className="font-display font-bold text-2xl mt-1">{expenses.length}</div>
            </div>
          </div>
          {project.budget && (
            <div className="mt-5">
              <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-primary" style={{ width: `${Math.min(100, pct)}%` }} />
              </div>
              <div className="text-xs text-white/60 mt-1">{pct.toFixed(1)}% of budget used</div>
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
                <Pie data={byCategory} dataKey="value" nameKey="name" innerRadius={50} outerRadius={85}>
                  {byCategory.map((c) => <Cell key={c.key} fill={CATEGORY_COLORS[c.key]} />)}
                </Pie>
                <Tooltip formatter={(v: number) => `$${v.toLocaleString()}`} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="stat-card">
          <h3 className="font-display font-semibold text-sm uppercase tracking-wider text-muted-foreground">Expense Timeline</h3>
          <div className="h-56 mt-3">
            <ResponsiveContainer>
              <LineChart data={timeline}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(0 0% 90%)" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `$${v / 1000}k`} />
                <Tooltip formatter={(v: number) => `$${v.toLocaleString()}`} />
                <Line type="monotone" dataKey="amount" stroke="hsl(0 84% 50%)" strokeWidth={2.5} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="stat-card">
        <h3 className="font-display font-semibold text-sm uppercase tracking-wider text-muted-foreground mb-3">Transactions</h3>
        <TransactionList expenses={expenses} hideProject />
      </div>
    </div>
  );
}
