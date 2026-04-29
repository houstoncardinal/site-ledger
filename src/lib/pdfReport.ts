import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format, startOfWeek, startOfMonth, endOfWeek, endOfMonth, subMonths, subWeeks } from "date-fns";
import type { Expense, Income, Project } from "./types";
import { CATEGORY_LABELS } from "./types";

const fmt = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 });

const BRAND = [220, 38, 38] as [number, number, number]; // red-600
const DARK = [24, 24, 27] as [number, number, number];
const GRAY = [113, 113, 122] as [number, number, number];
const LIGHT = [244, 244, 245] as [number, number, number];
const GREEN = [22, 163, 74] as [number, number, number];

function header(doc: jsPDF, title: string, subtitle: string) {
  doc.setFillColor(...DARK);
  doc.rect(0, 0, 210, 30, "F");
  // Brand accent line
  doc.setFillColor(...BRAND);
  doc.rect(0, 30, 210, 1.5, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.text("HOU INC", 14, 11);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(150, 150, 155);
  doc.text("Bookkeeper AI", 14, 18);

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text(title, 14, 26);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(180, 180, 180);
  doc.text(subtitle, 105, 26, { align: "center" });
  doc.setTextColor(120, 120, 125);
  doc.setFontSize(7.5);
  doc.text(`Generated ${format(new Date(), "MMMM d, yyyy 'at' h:mm a")}`, 196, 26, { align: "right" });
}

function kpiRow(
  doc: jsPDF,
  y: number,
  items: { label: string; value: string; color?: [number, number, number] }[],
) {
  const colW = 182 / items.length;
  items.forEach((item, i) => {
    const x = 14 + i * colW;
    doc.setFillColor(...LIGHT);
    doc.roundedRect(x, y, colW - 3, 18, 2, 2, "F");
    doc.setTextColor(...GRAY);
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.text(item.label.toUpperCase(), x + 4, y + 6);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...(item.color ?? DARK));
    doc.text(item.value, x + 4, y + 14);
  });
  return y + 24;
}

export type ReportPeriod = "week" | "month" | "last_month" | "last_week";

interface ReportData {
  expenses: Expense[];
  incomes: Income[];
  projects: Project[];
}

function getRange(period: ReportPeriod): { from: Date; to: Date; label: string } {
  const now = new Date();
  switch (period) {
    case "week":
      return { from: startOfWeek(now), to: endOfWeek(now), label: `Week of ${format(startOfWeek(now), "MMM d, yyyy")}` };
    case "last_week": {
      const lw = subWeeks(now, 1);
      return { from: startOfWeek(lw), to: endOfWeek(lw), label: `Week of ${format(startOfWeek(lw), "MMM d, yyyy")}` };
    }
    case "month":
      return { from: startOfMonth(now), to: endOfMonth(now), label: format(now, "MMMM yyyy") };
    case "last_month": {
      const lm = subMonths(now, 1);
      return { from: startOfMonth(lm), to: endOfMonth(lm), label: format(lm, "MMMM yyyy") };
    }
  }
}

export function generatePDFReport(period: ReportPeriod, { expenses, incomes, projects }: ReportData) {
  const { from, to, label } = getRange(period);
  const periodType = period.includes("week") ? "Weekly" : "Monthly";

  const rangeEx = expenses.filter((e) => {
    const d = new Date(e.date);
    return d >= from && d <= to;
  });
  const rangeIn = incomes.filter((i) => {
    const d = new Date(i.date);
    return d >= from && d <= to;
  });

  const totalSpend = rangeEx.reduce((s, e) => s + Number(e.amount), 0);
  const totalRevenue = rangeIn.filter((i) => i.payment_status === "paid").reduce((s, i) => s + Number(i.amount), 0);
  const netProfit = totalRevenue - totalSpend;
  const unpaidIn = rangeIn.filter((i) => i.payment_status !== "paid").reduce((s, i) => s + Number(i.amount), 0);

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  header(doc, `${periodType} Report`, label);

  let y = 36;

  // KPIs
  y = kpiRow(doc, y, [
    { label: "Total Revenue", value: fmt(totalRevenue), color: GREEN },
    { label: "Total Expenses", value: fmt(totalSpend), color: BRAND },
    { label: "Net Profit", value: fmt(netProfit), color: netProfit >= 0 ? GREEN : BRAND },
    { label: "Outstanding", value: fmt(unpaidIn), color: GRAY },
  ]);

  // Category breakdown
  const byCat = new Map<string, number>();
  rangeEx.forEach((e) => byCat.set(e.category, (byCat.get(e.category) ?? 0) + Number(e.amount)));
  const catRows = Array.from(byCat, ([k, v]) => [CATEGORY_LABELS[k as keyof typeof CATEGORY_LABELS] ?? k, fmt(v), totalSpend ? `${((v / totalSpend) * 100).toFixed(1)}%` : "—"])
    .sort((a, b) => parseFloat(b[1].replace(/[^0-9.]/g, "")) - parseFloat(a[1].replace(/[^0-9.]/g, "")));

  if (catRows.length) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...DARK);
    doc.text("Expenses by Category", 14, y);
    y += 4;
    autoTable(doc, {
      startY: y,
      head: [["Category", "Amount", "% of Total"]],
      body: catRows,
      styles: { fontSize: 9, cellPadding: 3 },
      headStyles: { fillColor: DARK, textColor: [255, 255, 255], fontStyle: "bold" },
      alternateRowStyles: { fillColor: LIGHT },
      columnStyles: { 1: { halign: "right" }, 2: { halign: "right" } },
      margin: { left: 14, right: 14 },
    });
    y = (doc as any).lastAutoTable.finalY + 8;
  }

  // Income breakdown
  const incomeRows = rangeIn.map((i) => [
    i.date,
    i.client_name ?? "—",
    i.invoice_number ?? "—",
    fmt(Number(i.amount)),
    i.payment_status.charAt(0).toUpperCase() + i.payment_status.slice(1),
  ]);

  if (incomeRows.length) {
    if (y > 230) { doc.addPage(); y = 20; }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...DARK);
    doc.text("Income Entries", 14, y);
    y += 4;
    autoTable(doc, {
      startY: y,
      head: [["Date", "Client", "Invoice #", "Amount", "Status"]],
      body: incomeRows,
      styles: { fontSize: 8, cellPadding: 2.5 },
      headStyles: { fillColor: GREEN, textColor: [255, 255, 255], fontStyle: "bold" },
      alternateRowStyles: { fillColor: LIGHT },
      columnStyles: { 3: { halign: "right" } },
      margin: { left: 14, right: 14 },
    });
    y = (doc as any).lastAutoTable.finalY + 8;
  }

  // Project summary
  const activeProjects = projects.filter((p) => p.status === "active");
  if (activeProjects.length) {
    const projRows = activeProjects.map((p) => {
      const pEx = rangeEx.filter((e) => e.project_id === p.id).reduce((s, e) => s + Number(e.amount), 0);
      const pIn = rangeIn.filter((i) => i.project_id === p.id && i.payment_status === "paid").reduce((s, i) => s + Number(i.amount), 0);
      const net = pIn - pEx;
      return [p.name, fmt(pIn), fmt(pEx), net >= 0 ? fmt(net) : `(${fmt(-net)})`, p.status];
    }).filter((r) => r[1] !== fmt(0) || r[2] !== fmt(0));

    if (projRows.length) {
      if (y > 230) { doc.addPage(); y = 20; }
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(...DARK);
      doc.text("Project Summary", 14, y);
      y += 4;
      autoTable(doc, {
        startY: y,
        head: [["Project", "Revenue", "Expenses", "Net", "Status"]],
        body: projRows,
        styles: { fontSize: 8, cellPadding: 2.5 },
        headStyles: { fillColor: DARK, textColor: [255, 255, 255], fontStyle: "bold" },
        alternateRowStyles: { fillColor: LIGHT },
        columnStyles: { 1: { halign: "right" }, 2: { halign: "right" }, 3: { halign: "right" } },
        margin: { left: 14, right: 14 },
      });
      y = (doc as any).lastAutoTable.finalY + 8;
    }
  }

  // Expense detail
  if (rangeEx.length) {
    if (y > 200) { doc.addPage(); y = 20; }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...DARK);
    doc.text("Expense Detail", 14, y);
    y += 4;
    const exRows = rangeEx
      .sort((a, b) => b.date.localeCompare(a.date))
      .map((e) => [
        e.date,
        e.vendor,
        CATEGORY_LABELS[e.category] ?? e.category,
        projects.find((p) => p.id === e.project_id)?.name ?? "—",
        fmt(Number(e.amount)),
        e.payment_status,
      ]);
    autoTable(doc, {
      startY: y,
      head: [["Date", "Vendor", "Category", "Project", "Amount", "Status"]],
      body: exRows,
      styles: { fontSize: 7.5, cellPadding: 2 },
      headStyles: { fillColor: BRAND, textColor: [255, 255, 255], fontStyle: "bold" },
      alternateRowStyles: { fillColor: LIGHT },
      columnStyles: { 4: { halign: "right" } },
      margin: { left: 14, right: 14 },
    });
  }

  // Footer on all pages
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(...GRAY);
    doc.text(`Page ${i} of ${totalPages}`, 196, 290, { align: "right" });
    doc.text("SiteLedger — Confidential", 14, 290);
  }

  doc.save(`SiteLedger-${periodType}-${label.replace(/[^a-zA-Z0-9]/g, "-")}.pdf`);
}
