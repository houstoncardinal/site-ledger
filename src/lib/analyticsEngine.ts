import { format, subDays, startOfWeek, startOfMonth, parseISO } from "date-fns";
import type { Expense, Income, Project, ExpenseCategory } from "./types";
import { CATEGORY_LABELS, CATEGORY_COLORS } from "./types";
import type { FilterState } from "@/context/FiltersContext";

// ─── Filter Application ───────────────────────────────────────────────────────

export function applyFilters(
  expenses: Expense[],
  incomes: Income[],
  filters: FilterState,
): { expenses: Expense[]; incomes: Income[] } {
  const cutoff = filters.range === 0
    ? null
    : subDays(new Date(), filters.range);

  const fx = expenses.filter((e) => {
    if (cutoff && new Date(e.date) < cutoff) return false;
    if (filters.projectId && e.project_id !== filters.projectId) return false;
    if (filters.category && e.category !== filters.category) return false;
    if (filters.vendor && !e.vendor.toLowerCase().includes(filters.vendor.toLowerCase())) return false;
    return true;
  });

  const fi = incomes.filter((i) => {
    if (cutoff && new Date(i.date) < cutoff) return false;
    if (filters.projectId && i.project_id !== filters.projectId) return false;
    return true;
  });

  return { expenses: fx, incomes: fi };
}

// ─── Time Series ──────────────────────────────────────────────────────────────

export type TimeGrouping = "daily" | "weekly" | "monthly";

export interface TimeSeriesPoint {
  label: string;
  iso: string;
  expenses: number;
  income: number;
  net: number;
}

export function buildTimeSeries(
  expenses: Expense[],
  incomes: Income[],
  range: number,
  grouping: TimeGrouping = "daily",
): TimeSeriesPoint[] {
  if (grouping === "monthly") {
    const m = new Map<string, TimeSeriesPoint>();
    const addM = (date: string) => {
      const key = date.slice(0, 7);
      if (!m.has(key)) {
        const d = parseISO(date + "-01");
        m.set(key, { label: format(d, "MMM yy"), iso: key, expenses: 0, income: 0, net: 0 });
      }
      return m.get(key)!;
    };
    expenses.forEach((e) => { const p = addM(e.date); p.expenses += Number(e.amount); p.net -= Number(e.amount); });
    incomes.filter((i) => i.payment_status === "paid").forEach((i) => { const p = addM(i.date); p.income += Number(i.amount); p.net += Number(i.amount); });
    return Array.from(m.values()).sort((a, b) => a.iso.localeCompare(b.iso));
  }

  if (grouping === "weekly") {
    const m = new Map<string, TimeSeriesPoint>();
    const weekKey = (date: string) => format(startOfWeek(parseISO(date)), "yyyy-MM-dd");
    expenses.forEach((e) => {
      const key = weekKey(e.date);
      const p = m.get(key) ?? { label: format(parseISO(key), "MMM d"), iso: key, expenses: 0, income: 0, net: 0 };
      p.expenses += Number(e.amount); p.net -= Number(e.amount);
      m.set(key, p);
    });
    incomes.filter((i) => i.payment_status === "paid").forEach((i) => {
      const key = weekKey(i.date);
      const p = m.get(key) ?? { label: format(parseISO(key), "MMM d"), iso: key, expenses: 0, income: 0, net: 0 };
      p.income += Number(i.amount); p.net += Number(i.amount);
      m.set(key, p);
    });
    return Array.from(m.values()).sort((a, b) => a.iso.localeCompare(b.iso));
  }

  // daily
  const days = range === 0 ? 90 : range;
  const buckets: TimeSeriesPoint[] = Array.from({ length: days }, (_, i) => {
    const d = subDays(new Date(), days - 1 - i);
    return { label: format(d, "MMM d"), iso: format(d, "yyyy-MM-dd"), expenses: 0, income: 0, net: 0 };
  });
  expenses.forEach((e) => {
    const b = buckets.find((x) => x.iso === e.date);
    if (b) { b.expenses += Number(e.amount); b.net -= Number(e.amount); }
  });
  incomes.filter((i) => i.payment_status === "paid").forEach((i) => {
    const b = buckets.find((x) => x.iso === i.date);
    if (b) { b.income += Number(i.amount); b.net += Number(i.amount); }
  });
  return buckets;
}

// ─── Category Breakdown ───────────────────────────────────────────────────────

export interface CategoryPoint {
  key: ExpenseCategory;
  name: string;
  value: number;
  pct: number;
  color: string;
}

export function buildCategoryBreakdown(expenses: Expense[]): CategoryPoint[] {
  const m = new Map<ExpenseCategory, number>();
  expenses.forEach((e) => m.set(e.category, (m.get(e.category) ?? 0) + Number(e.amount)));
  const total = expenses.reduce((s, e) => s + Number(e.amount), 0);
  return Array.from(m, ([key, value]) => ({
    key,
    name: CATEGORY_LABELS[key] ?? key,
    value,
    pct: total ? (value / total) * 100 : 0,
    color: CATEGORY_COLORS[key] ?? "#888",
  })).sort((a, b) => b.value - a.value);
}

// ─── Project Comparison ───────────────────────────────────────────────────────

export interface ProjectPoint {
  name: string;
  id: string;
  income: number;
  expenses: number;
  net: number;
  budgetPct: number | null;
}

export function buildProjectComparison(
  projects: Project[],
  expenses: Expense[],
  incomes: Income[],
): ProjectPoint[] {
  return projects
    .filter((p) => p.status !== "archived")
    .map((p) => {
      const spent = expenses.filter((e) => e.project_id === p.id).reduce((s, e) => s + Number(e.amount), 0);
      const revenue = incomes.filter((i) => i.project_id === p.id && i.payment_status === "paid").reduce((s, i) => s + Number(i.amount), 0);
      return {
        name: p.name.slice(0, 20),
        id: p.id,
        income: revenue,
        expenses: spent,
        net: revenue - spent,
        budgetPct: p.budget ? Math.round((spent / Number(p.budget)) * 100) : null,
      };
    })
    .filter((p) => p.income > 0 || p.expenses > 0)
    .sort((a, b) => b.expenses - a.expenses);
}

// ─── Vendor Analysis ─────────────────────────────────────────────────────────

export interface VendorPoint {
  name: string;
  amount: number;
  count: number;
  avgAmount: number;
  category: string;
}

export function buildVendorAnalysis(expenses: Expense[]): VendorPoint[] {
  const m = new Map<string, { amount: number; count: number; category: ExpenseCategory }>();
  expenses.forEach((e) => {
    const v = m.get(e.vendor) ?? { amount: 0, count: 0, category: e.category };
    v.amount += Number(e.amount);
    v.count++;
    m.set(e.vendor, v);
  });
  return Array.from(m, ([name, v]) => ({
    name,
    amount: v.amount,
    count: v.count,
    avgAmount: v.amount / v.count,
    category: CATEGORY_LABELS[v.category] ?? v.category,
  })).sort((a, b) => b.amount - a.amount);
}

// ─── Custom Chart Builder ─────────────────────────────────────────────────────

export type DatasetType = "expenses" | "incomes" | "both";
export type GroupByType = "date" | "project" | "category" | "vendor" | "payment_method";
export type MetricType = "sum" | "count" | "avg";

export interface ChartDataPoint {
  name: string;
  value: number;
  fill?: string;
  id?: string;
}

export function buildCustomChartData(
  expenses: Expense[],
  incomes: Income[],
  projects: Project[],
  dataset: DatasetType,
  groupBy: GroupByType,
  metric: MetricType,
): ChartDataPoint[] {
  const rows: { key: string; amount: number; id?: string }[] = [];

  if (dataset !== "incomes") {
    expenses.forEach((e) => {
      let key = "";
      let id: string | undefined;
      if (groupBy === "date") key = e.date.slice(0, 7);
      else if (groupBy === "project") {
        const p = projects.find((x) => x.id === e.project_id);
        key = p?.name ?? "No Project";
        id = e.project_id ?? undefined;
      } else if (groupBy === "category") { key = CATEGORY_LABELS[e.category] ?? e.category; }
      else if (groupBy === "vendor") key = e.vendor;
      else if (groupBy === "payment_method") key = e.payment_method ?? "Unknown";
      rows.push({ key, amount: Number(e.amount), id });
    });
  }

  if (dataset !== "expenses") {
    incomes.filter((i) => i.payment_status === "paid").forEach((i) => {
      let key = "";
      if (groupBy === "date") key = i.date.slice(0, 7);
      else if (groupBy === "project") {
        const p = projects.find((x) => x.id === i.project_id);
        key = p?.name ?? "No Project";
      } else key = "Income";
      rows.push({ key, amount: Number(i.amount) });
    });
  }

  const m = new Map<string, { sum: number; count: number; id?: string }>();
  rows.forEach(({ key, amount, id }) => {
    const v = m.get(key) ?? { sum: 0, count: 0, id };
    v.sum += amount;
    v.count++;
    m.set(key, v);
  });

  return Array.from(m, ([name, v]) => ({
    name,
    value: metric === "sum" ? v.sum : metric === "count" ? v.count : v.sum / v.count,
    id: v.id,
  }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 20);
}
