import {
  startOfMonth, subMonths, differenceInCalendarDays,
  getDaysInMonth, startOfDay, format,
} from "date-fns";
import type { Expense, Income, Project, ExpenseCategory } from "./types";
import { CATEGORY_LABELS } from "./types";

// ─── Burn Rate ────────────────────────────────────────────────────────────────

export interface BurnRate {
  dailyRate: number;
  projectedMonthTotal: number;
  daysElapsed: number;
  daysRemaining: number;
  confidence: "high" | "medium" | "low";
}

export function calcBurnRate(expenses: Expense[]): BurnRate {
  const now = new Date();
  const moStart = startOfMonth(now);
  const daysElapsed = Math.max(1, differenceInCalendarDays(now, moStart) + 1);
  const daysInMonth = getDaysInMonth(now);
  const daysRemaining = daysInMonth - daysElapsed;

  const monthEx = expenses.filter((e) => new Date(e.date) >= moStart);
  const totalSpent = monthEx.reduce((s, e) => s + Number(e.amount), 0);
  const dailyRate = totalSpent / daysElapsed;
  const projectedMonthTotal = dailyRate * daysInMonth;
  const confidence = daysElapsed >= 15 ? "high" : daysElapsed >= 7 ? "medium" : "low";

  return { dailyRate, projectedMonthTotal, daysElapsed, daysRemaining, confidence };
}

// ─── Project Predictions ──────────────────────────────────────────────────────

export interface ProjectPrediction {
  project: Project;
  totalSpent: number;
  dailyRate: number;
  projectedFinal: number;
  daysToOverrun: number | null;
  budgetRisk: "safe" | "warn" | "danger" | null;
}

export function calcProjectPredictions(
  projects: Project[],
  expenses: Expense[],
): ProjectPrediction[] {
  return projects
    .filter((p) => p.status === "active")
    .map((p) => {
      const pEx = expenses.filter((e) => e.project_id === p.id);
      const totalSpent = pEx.reduce((s, e) => s + Number(e.amount), 0);

      const sorted = [...pEx].sort((a, b) => a.date.localeCompare(b.date));
      let dailyRate = 0;
      if (sorted.length >= 2) {
        const firstDate = new Date(sorted[0].date);
        const lastDate = new Date(sorted[sorted.length - 1].date);
        const span = Math.max(1, differenceInCalendarDays(lastDate, firstDate) + 1);
        dailyRate = totalSpent / span;
      }

      const budget = p.budget ? Number(p.budget) : null;
      let budgetRisk: ProjectPrediction["budgetRisk"] = null;
      let daysToOverrun: number | null = null;

      if (budget) {
        const pct = (totalSpent / budget) * 100;
        if (pct >= 100) {
          budgetRisk = "danger";
        } else if (pct >= 80) {
          budgetRisk = "warn";
        } else {
          budgetRisk = "safe";
        }
        if (dailyRate > 0 && budget > totalSpent) {
          daysToOverrun = Math.ceil((budget - totalSpent) / dailyRate);
        }
      }

      const projectedFinal = dailyRate > 0 ? totalSpent + dailyRate * 30 : totalSpent;

      return { project: p, totalSpent, dailyRate, projectedFinal, daysToOverrun, budgetRisk };
    });
}

// ─── Category Trends ─────────────────────────────────────────────────────────

export interface CategoryTrend {
  category: ExpenseCategory;
  label: string;
  thisMonth: number;
  lastMonth: number;
  pctChange: number;
  trend: "up" | "down" | "stable";
}

export function calcCategoryTrends(expenses: Expense[]): CategoryTrend[] {
  const now = new Date();
  const moStart = startOfMonth(now);
  const lastMoStart = startOfMonth(subMonths(now, 1));
  const lastMoEnd = new Date(moStart.getTime() - 1);

  const categories = [...new Set(expenses.map((e) => e.category))];

  return categories.map((cat) => {
    const thisMonth = expenses
      .filter((e) => e.category === cat && new Date(e.date) >= moStart)
      .reduce((s, e) => s + Number(e.amount), 0);
    const lastMonth = expenses
      .filter((e) => e.category === cat && new Date(e.date) >= lastMoStart && new Date(e.date) <= lastMoEnd)
      .reduce((s, e) => s + Number(e.amount), 0);

    const pctChange = lastMonth === 0 ? (thisMonth > 0 ? 100 : 0) : ((thisMonth - lastMonth) / lastMonth) * 100;
    const trend: CategoryTrend["trend"] =
      Math.abs(pctChange) < 10 ? "stable" : pctChange > 0 ? "up" : "down";

    return { category: cat, label: CATEGORY_LABELS[cat] ?? cat, thisMonth, lastMonth, pctChange, trend };
  }).filter((t) => t.thisMonth > 0 || t.lastMonth > 0)
    .sort((a, b) => b.thisMonth - a.thisMonth);
}

// ─── Anomaly Detection ────────────────────────────────────────────────────────

export interface Anomaly {
  expense: Expense;
  type: "high_amount" | "unusual_category" | "spike";
  message: string;
  severity: "warn" | "danger";
}

export function detectAnomalies(expenses: Expense[]): Anomaly[] {
  const anomalies: Anomaly[] = [];
  const now = startOfDay(new Date());
  const recent = expenses.filter((e) => {
    const d = new Date(e.date);
    return differenceInCalendarDays(now, d) <= 90;
  });

  // Per-vendor average (using all historical data)
  const vendorStats = new Map<string, { sum: number; count: number }>();
  expenses.forEach((e) => {
    const s = vendorStats.get(e.vendor) ?? { sum: 0, count: 0 };
    s.sum += Number(e.amount);
    s.count++;
    vendorStats.set(e.vendor, s);
  });

  // Per-category average
  const catStats = new Map<string, { sum: number; count: number }>();
  expenses.forEach((e) => {
    const s = catStats.get(e.category) ?? { sum: 0, count: 0 };
    s.sum += Number(e.amount);
    s.count++;
    catStats.set(e.category, s);
  });

  recent.forEach((e) => {
    const vStats = vendorStats.get(e.vendor);
    if (vStats && vStats.count >= 3) {
      const avg = vStats.sum / vStats.count;
      if (Number(e.amount) > avg * 2.5) {
        anomalies.push({
          expense: e,
          type: "high_amount",
          message: `${e.vendor} — this entry is ${(Number(e.amount) / avg).toFixed(1)}× your usual amount ($${avg.toFixed(0)} avg)`,
          severity: Number(e.amount) > avg * 4 ? "danger" : "warn",
        });
      }
    }

    const cStats = catStats.get(e.category);
    if (cStats && cStats.count >= 5) {
      const avg = cStats.sum / cStats.count;
      if (Number(e.amount) > avg * 3) {
        anomalies.push({
          expense: e,
          type: "spike",
          message: `${CATEGORY_LABELS[e.category]} spike — $${Number(e.amount).toLocaleString()} is 3× the category average`,
          severity: "warn",
        });
      }
    }
  });

  // Dedup by expense id, keep most severe
  const seen = new Map<string, Anomaly>();
  anomalies.forEach((a) => {
    const existing = seen.get(a.expense.id);
    if (!existing || (a.severity === "danger" && existing.severity === "warn")) {
      seen.set(a.expense.id, a);
    }
  });

  return Array.from(seen.values())
    .sort((a, b) => b.expense.date.localeCompare(a.expense.date))
    .slice(0, 8);
}

// ─── Contextual Insight Lines ─────────────────────────────────────────────────

export interface InsightLine {
  text: string;
  type: "positive" | "warning" | "info";
}

export function generateInsights(
  expenses: Expense[],
  incomes: Income[],
  projects: Project[],
): InsightLine[] {
  const lines: InsightLine[] = [];
  const now = new Date();
  const moStart = startOfMonth(now);

  const moEx = expenses.filter((e) => new Date(e.date) >= moStart);
  const moIn = incomes.filter((i) => new Date(i.date) >= moStart && i.payment_status === "paid");
  const moSpend = moEx.reduce((s, e) => s + Number(e.amount), 0);
  const moRev = moIn.reduce((s, i) => s + Number(i.amount), 0);
  const net = moRev - moSpend;

  if (net > 0) lines.push({ text: `Net profit is +$${net.toLocaleString(undefined, { maximumFractionDigits: 0 })} so far this month.`, type: "positive" });
  else if (net < 0) lines.push({ text: `Running at a $${Math.abs(net).toLocaleString(undefined, { maximumFractionDigits: 0 })} loss this month.`, type: "warning" });

  // Trending category
  const trends = calcCategoryTrends(expenses);
  const topUp = trends.filter((t) => t.trend === "up" && t.pctChange > 20).sort((a, b) => b.pctChange - a.pctChange)[0];
  if (topUp) {
    lines.push({
      text: `${topUp.label} spending is up ${topUp.pctChange.toFixed(0)}% vs last month ($${topUp.thisMonth.toLocaleString(undefined, { maximumFractionDigits: 0 })}).`,
      type: "warning",
    });
  }

  // Unpaid invoices
  const unpaidIn = incomes.filter((i) => i.payment_status !== "paid").reduce((s, i) => s + Number(i.amount), 0);
  if (unpaidIn > 0) {
    lines.push({ text: `$${unpaidIn.toLocaleString(undefined, { maximumFractionDigits: 0 })} in outstanding invoices waiting to be collected.`, type: "info" });
  }

  // Budget risks
  const predictions = calcProjectPredictions(projects, expenses);
  const atRisk = predictions.filter((p) => p.budgetRisk === "danger" || p.budgetRisk === "warn");
  if (atRisk.length > 0) {
    const names = atRisk.map((p) => p.project.name).join(", ");
    lines.push({ text: `Budget alert on ${atRisk.length} project${atRisk.length > 1 ? "s" : ""}: ${names}.`, type: "warning" });
  }

  return lines.slice(0, 5);
}
