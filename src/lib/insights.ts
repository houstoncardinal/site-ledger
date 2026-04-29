import { Expense, Income, Project, ExpenseCategory } from "./types";

export interface ProjectInsights {
  totalSpent: number;
  totalIncome: number;
  unpaidExpenses: number;
  unpaidIncome: number;
  profit: number;
  budgetUsedPct: number | null;
  alerts: Alert[];
  byCategory: { category: ExpenseCategory; amount: number; pct: number }[];
}

export interface Alert {
  level: "warn" | "danger" | "info";
  message: string;
}

export const calcProjectInsights = (
  project: Project,
  expenses: Expense[],
  incomes: Income[],
): ProjectInsights => {
  const projExpenses = expenses.filter((e) => e.project_id === project.id);
  const projIncomes = incomes.filter((i) => i.project_id === project.id);
  const totalSpent = projExpenses.reduce((s, e) => s + Number(e.amount), 0);
  const totalIncome = projIncomes
    .filter((i) => i.payment_status === "paid")
    .reduce((s, i) => s + Number(i.amount), 0);
  const unpaidExpenses = projExpenses
    .filter((e) => e.payment_status !== "paid")
    .reduce((s, e) => s + Number(e.amount), 0);
  const unpaidIncome = projIncomes
    .filter((i) => i.payment_status !== "paid")
    .reduce((s, i) => s + Number(i.amount), 0);
  const profit = totalIncome - totalSpent;
  const budgetUsedPct = project.budget ? (totalSpent / Number(project.budget)) * 100 : null;

  const alerts: Alert[] = [];
  if (budgetUsedPct !== null) {
    if (budgetUsedPct >= 100) alerts.push({ level: "danger", message: `Project is over budget by $${(totalSpent - Number(project.budget)).toLocaleString(undefined, { maximumFractionDigits: 0 })}.` });
    else if (budgetUsedPct >= 80) alerts.push({ level: "warn", message: `Project is at ${budgetUsedPct.toFixed(0)}% of budget.` });
  }
  if (unpaidExpenses > 0)
    alerts.push({ level: "info", message: `$${unpaidExpenses.toLocaleString(undefined, { maximumFractionDigits: 0 })} in unpaid expenses.` });
  if (unpaidIncome > 0)
    alerts.push({ level: "info", message: `$${unpaidIncome.toLocaleString(undefined, { maximumFractionDigits: 0 })} in outstanding invoices.` });

  // category-level
  const byCatMap = new Map<ExpenseCategory, number>();
  projExpenses.forEach((e) => byCatMap.set(e.category, (byCatMap.get(e.category) ?? 0) + Number(e.amount)));
  const byCategory = Array.from(byCatMap, ([category, amount]) => ({
    category,
    amount,
    pct: totalSpent ? (amount / totalSpent) * 100 : 0,
  })).sort((a, b) => b.amount - a.amount);

  // anomaly: labor > 60% of total when total > $5k
  const labor = byCategory.find((c) => c.category === "labor");
  if (labor && totalSpent > 5000 && labor.pct > 60)
    alerts.push({ level: "warn", message: `Labor is ${labor.pct.toFixed(0)}% of project spend — unusually high.` });

  return { totalSpent, totalIncome, unpaidExpenses, unpaidIncome, profit, budgetUsedPct, alerts, byCategory };
};

export const exportToCSV = (rows: Record<string, any>[], filename: string) => {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const escape = (v: any) => {
    if (v === null || v === undefined) return "";
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [
    headers.join(","),
    ...rows.map((r) => headers.map((h) => escape(r[h])).join(",")),
  ].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};
