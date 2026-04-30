import {
  startOfMonth, subMonths, differenceInCalendarDays,
  getDaysInMonth, startOfDay, format, subDays,
} from "date-fns";
import type { Expense, Income, Project, ExpenseCategory } from "./types";
import { CATEGORY_LABELS } from "./types";

// ─── Statistical helpers ──────────────────────────────────────────────────────

const median = (xs: number[]): number => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

const mad = (xs: number[], med?: number): number => {
  // Median Absolute Deviation — robust to outliers (vs std-dev)
  if (xs.length < 2) return 0;
  const m = med ?? median(xs);
  return median(xs.map((x) => Math.abs(x - m)));
};

// Modified Z-score using MAD: |0.6745 * (x - median) / MAD|
const modZ = (x: number, med: number, m: number): number => {
  if (m === 0) return 0;
  return Math.abs(0.6745 * (x - med) / m);
};

// Simple linear regression on (x, y) -> { slope, intercept, r2 }
const linreg = (xs: number[], ys: number[]) => {
  const n = xs.length;
  if (n < 2) return { slope: 0, intercept: ys[0] ?? 0, r2: 0 };
  const mx = xs.reduce((s, v) => s + v, 0) / n;
  const my = ys.reduce((s, v) => s + v, 0) / n;
  let num = 0, den = 0, tss = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i] - mx) * (ys[i] - my);
    den += (xs[i] - mx) ** 2;
    tss += (ys[i] - my) ** 2;
  }
  const slope = den === 0 ? 0 : num / den;
  const intercept = my - slope * mx;
  let rss = 0;
  for (let i = 0; i < n; i++) {
    const yhat = intercept + slope * xs[i];
    rss += (ys[i] - yhat) ** 2;
  }
  const r2 = tss === 0 ? 0 : Math.max(0, 1 - rss / tss);
  return { slope, intercept, r2 };
};

// Exponentially weighted average — more weight to recent values
const ewma = (xs: number[], alpha = 0.25): number => {
  if (!xs.length) return 0;
  let v = xs[0];
  for (let i = 1; i < xs.length; i++) v = alpha * xs[i] + (1 - alpha) * v;
  return v;
};

// Build a daily expense series for the last `days` days (oldest -> newest)
const dailySeries = (expenses: Expense[], days: number): number[] => {
  const today = startOfDay(new Date());
  const buckets = new Array(days).fill(0);
  expenses.forEach((e) => {
    const diff = differenceInCalendarDays(today, new Date(e.date));
    if (diff >= 0 && diff < days) buckets[days - 1 - diff] += Number(e.amount);
  });
  return buckets;
};

// ─── Burn Rate (EWMA + trend-aware projection) ───────────────────────────────

export interface BurnRate {
  dailyRate: number;          // EWMA-smoothed recent daily spend
  rawDailyRate: number;       // simple month-to-date average
  projectedMonthTotal: number;
  daysElapsed: number;
  daysRemaining: number;
  trend: "accelerating" | "decelerating" | "stable";
  trendPct: number;           // % change vs prior 14-day window
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
  const rawDailyRate = totalSpent / daysElapsed;

  // EWMA over the last 30 daily buckets — more weight on recent days
  const series30 = dailySeries(expenses, 30);
  const dailyRate = ewma(series30, 0.22) || rawDailyRate;

  // Trend: compare last 14d avg vs prior 14d avg
  const last14 = series30.slice(-14).reduce((s, v) => s + v, 0) / 14;
  const prev14 = series30.slice(-28, -14).reduce((s, v) => s + v, 0) / 14;
  const trendPct = prev14 === 0 ? 0 : ((last14 - prev14) / prev14) * 100;
  const trend: BurnRate["trend"] =
    Math.abs(trendPct) < 8 ? "stable" : trendPct > 0 ? "accelerating" : "decelerating";

  const projectedMonthTotal = totalSpent + dailyRate * daysRemaining;
  const dataPoints = monthEx.length;
  const confidence: BurnRate["confidence"] =
    dataPoints >= 12 && daysElapsed >= 10 ? "high" :
    dataPoints >= 5 && daysElapsed >= 5 ? "medium" : "low";

  return { dailyRate, rawDailyRate, projectedMonthTotal, daysElapsed, daysRemaining, trend, trendPct, confidence };
}

// ─── Cash Runway ──────────────────────────────────────────────────────────────

export interface CashRunway {
  netDailyBurn: number;        // expenses minus paid income, daily
  estimatedDays: number | null;
  status: "healthy" | "watch" | "critical";
}

export function calcCashRunway(expenses: Expense[], incomes: Income[]): CashRunway {
  const exSeries = dailySeries(expenses, 30);
  const inSeries = dailySeries(
    incomes.filter((i) => i.payment_status === "paid") as any,
    30,
  );
  const exRate = ewma(exSeries, 0.22);
  const inRate = ewma(inSeries, 0.22);
  const netDailyBurn = exRate - inRate;
  if (netDailyBurn <= 0) return { netDailyBurn, estimatedDays: null, status: "healthy" };
  // We don't know cash on hand without account snapshots; estimate using
  // unpaid income that should land soon as a proxy buffer.
  const buffer = incomes
    .filter((i) => i.payment_status !== "paid")
    .reduce((s, i) => s + Number(i.amount), 0);
  const estimatedDays = buffer > 0 ? Math.floor(buffer / netDailyBurn) : 0;
  const status: CashRunway["status"] = estimatedDays > 60 ? "healthy" : estimatedDays > 21 ? "watch" : "critical";
  return { netDailyBurn, estimatedDays, status };
}

// ─── Project Predictions (linear regression over project history) ─────────────

export interface ProjectPrediction {
  project: Project;
  totalSpent: number;
  dailyRate: number;
  projectedFinal: number;
  daysToOverrun: number | null;
  budgetRisk: "safe" | "warn" | "danger" | null;
  forecastConfidence: number;  // 0..1 (R²)
  velocityPctChange: number;   // last 14d vs prior 14d on this project
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

      // Build cumulative-spend time series, then fit a line.
      const sorted = [...pEx].sort((a, b) => a.date.localeCompare(b.date));
      let dailyRate = 0;
      let r2 = 0;
      if (sorted.length >= 2) {
        const t0 = new Date(sorted[0].date).getTime();
        const xs: number[] = [];
        const ys: number[] = [];
        let cum = 0;
        for (const e of sorted) {
          const day = (new Date(e.date).getTime() - t0) / 86400000;
          cum += Number(e.amount);
          xs.push(day);
          ys.push(cum);
        }
        const fit = linreg(xs, ys);
        dailyRate = Math.max(0, fit.slope);
        r2 = fit.r2;
      }

      // Velocity change: last 14d vs prior 14d on this project
      const today = startOfDay(new Date());
      const last14 = pEx.filter((e) => differenceInCalendarDays(today, new Date(e.date)) < 14)
        .reduce((s, e) => s + Number(e.amount), 0);
      const prev14 = pEx.filter((e) => {
        const d = differenceInCalendarDays(today, new Date(e.date));
        return d >= 14 && d < 28;
      }).reduce((s, e) => s + Number(e.amount), 0);
      const velocityPctChange = prev14 === 0 ? (last14 > 0 ? 100 : 0) : ((last14 - prev14) / prev14) * 100;

      const budget = p.budget ? Number(p.budget) : null;
      let budgetRisk: ProjectPrediction["budgetRisk"] = null;
      let daysToOverrun: number | null = null;

      if (budget) {
        const pct = (totalSpent / budget) * 100;
        if (pct >= 100) budgetRisk = "danger";
        else if (pct >= 80) budgetRisk = "warn";
        else budgetRisk = "safe";
        if (dailyRate > 0 && budget > totalSpent) {
          daysToOverrun = Math.ceil((budget - totalSpent) / dailyRate);
        }
      }

      const projectedFinal = dailyRate > 0 ? totalSpent + dailyRate * 30 : totalSpent;
      return {
        project: p, totalSpent, dailyRate, projectedFinal, daysToOverrun, budgetRisk,
        forecastConfidence: r2, velocityPctChange,
      };
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

// ─── Anomaly Detection (robust, MAD-based modified Z-score) ──────────────────

export interface Anomaly {
  expense: Expense;
  type: "high_amount" | "unusual_category" | "spike" | "duplicate";
  message: string;
  severity: "warn" | "danger";
  score: number;
}

export function detectAnomalies(expenses: Expense[]): Anomaly[] {
  const anomalies: Anomaly[] = [];
  const now = startOfDay(new Date());
  const recent = expenses.filter((e) => differenceInCalendarDays(now, new Date(e.date)) <= 90);

  // Group by vendor & category
  const byVendor = new Map<string, number[]>();
  const byCat = new Map<string, number[]>();
  expenses.forEach((e) => {
    const a = Number(e.amount);
    if (!byVendor.has(e.vendor)) byVendor.set(e.vendor, []);
    byVendor.get(e.vendor)!.push(a);
    if (!byCat.has(e.category)) byCat.set(e.category, []);
    byCat.get(e.category)!.push(a);
  });

  // Precompute median/MAD per vendor & category
  const vStats = new Map<string, { med: number; mad: number; n: number }>();
  byVendor.forEach((arr, k) => vStats.set(k, { med: median(arr), mad: mad(arr), n: arr.length }));
  const cStats = new Map<string, { med: number; mad: number; n: number }>();
  byCat.forEach((arr, k) => cStats.set(k, { med: median(arr), mad: mad(arr), n: arr.length }));

  // Duplicate detection — same vendor+amount within 2 days
  const seenKey = new Map<string, Expense>();
  recent.forEach((e) => {
    const key = `${e.vendor}|${Number(e.amount).toFixed(2)}`;
    const prior = seenKey.get(key);
    if (prior && Math.abs(differenceInCalendarDays(new Date(e.date), new Date(prior.date))) <= 2 && prior.id !== e.id) {
      anomalies.push({
        expense: e,
        type: "duplicate",
        message: `Possible duplicate of ${prior.vendor} on ${format(new Date(prior.date), "MMM d")} ($${Number(prior.amount).toLocaleString()})`,
        severity: "warn",
        score: 1,
      });
    }
    seenKey.set(key, e);
  });

  recent.forEach((e) => {
    const a = Number(e.amount);

    const v = vStats.get(e.vendor);
    if (v && v.n >= 4 && v.mad > 0) {
      const z = modZ(a, v.med, v.mad);
      if (z > 3.5) {
        anomalies.push({
          expense: e,
          type: "high_amount",
          message: `${e.vendor} is ${(a / Math.max(1, v.med)).toFixed(1)}× your typical $${v.med.toFixed(0)} — z=${z.toFixed(1)}`,
          severity: z > 6 ? "danger" : "warn",
          score: z,
        });
      }
    }

    const c = cStats.get(e.category);
    if (c && c.n >= 6 && c.mad > 0) {
      const z = modZ(a, c.med, c.mad);
      if (z > 4) {
        anomalies.push({
          expense: e,
          type: "spike",
          message: `${CATEGORY_LABELS[e.category]} spike — $${a.toLocaleString()} far above typical $${c.med.toFixed(0)}`,
          severity: z > 7 ? "danger" : "warn",
          score: z,
        });
      }
    }
  });

  // Dedup by expense id, keep most severe
  const seen = new Map<string, Anomaly>();
  anomalies.forEach((a) => {
    const k = `${a.expense.id}|${a.type}`;
    const prior = seen.get(k);
    if (!prior || a.score > prior.score) seen.set(k, a);
  });

  return Array.from(seen.values())
    .sort((a, b) => b.score - a.score || b.expense.date.localeCompare(a.expense.date))
    .slice(0, 10);
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
  const lastMoStart = startOfMonth(subMonths(now, 1));
  const lastMoEnd = new Date(moStart.getTime() - 1);

  const moEx = expenses.filter((e) => new Date(e.date) >= moStart);
  const moIn = incomes.filter((i) => new Date(i.date) >= moStart && i.payment_status === "paid");
  const moSpend = moEx.reduce((s, e) => s + Number(e.amount), 0);
  const moRev = moIn.reduce((s, i) => s + Number(i.amount), 0);
  const net = moRev - moSpend;
  const margin = moRev > 0 ? (net / moRev) * 100 : null;

  if (net > 0)
    lines.push({
      text: `Net profit is +$${net.toLocaleString(undefined, { maximumFractionDigits: 0 })} this month${margin !== null ? ` (${margin.toFixed(0)}% margin)` : ""}.`,
      type: "positive",
    });
  else if (net < 0)
    lines.push({
      text: `Running at a $${Math.abs(net).toLocaleString(undefined, { maximumFractionDigits: 0 })} loss this month — review spend.`,
      type: "warning",
    });

  // Month-over-month spend
  const lastMoSpend = expenses
    .filter((e) => new Date(e.date) >= lastMoStart && new Date(e.date) <= lastMoEnd)
    .reduce((s, e) => s + Number(e.amount), 0);
  if (lastMoSpend > 0) {
    const delta = ((moSpend - lastMoSpend) / lastMoSpend) * 100;
    if (Math.abs(delta) > 15) {
      lines.push({
        text: `Total spend is ${delta > 0 ? "up" : "down"} ${Math.abs(delta).toFixed(0)}% vs last month.`,
        type: delta > 0 ? "warning" : "positive",
      });
    }
  }

  // Trending category
  const trends = calcCategoryTrends(expenses);
  const topUp = trends.filter((t) => t.trend === "up" && t.pctChange > 20).sort((a, b) => b.pctChange - a.pctChange)[0];
  if (topUp)
    lines.push({
      text: `${topUp.label} is up ${topUp.pctChange.toFixed(0)}% MoM ($${topUp.thisMonth.toLocaleString(undefined, { maximumFractionDigits: 0 })}).`,
      type: "warning",
    });

  // Cash runway
  const runway = calcCashRunway(expenses, incomes);
  if (runway.status === "critical" && runway.estimatedDays !== null)
    lines.push({ text: `Cash runway tight — ~${runway.estimatedDays} days at current burn.`, type: "warning" });

  // Unpaid invoices
  const unpaidIn = incomes.filter((i) => i.payment_status !== "paid").reduce((s, i) => s + Number(i.amount), 0);
  if (unpaidIn > 0)
    lines.push({ text: `$${unpaidIn.toLocaleString(undefined, { maximumFractionDigits: 0 })} outstanding to collect.`, type: "info" });

  // Budget risks
  const predictions = calcProjectPredictions(projects, expenses);
  const atRisk = predictions.filter((p) => p.budgetRisk === "danger" || p.budgetRisk === "warn");
  if (atRisk.length > 0) {
    const names = atRisk.map((p) => p.project.name).join(", ");
    lines.push({ text: `${atRisk.length} project${atRisk.length > 1 ? "s" : ""} at budget risk: ${names}.`, type: "warning" });
  }

  return lines.slice(0, 5);
}
