import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { FileText, Loader2, ChevronDown } from "lucide-react";
import { generatePDFReport, type ReportPeriod } from "@/lib/pdfReport";
import { useExpenses, useIncomes, useProjects } from "@/lib/hooks";
import { toast } from "sonner";

const OPTIONS: { period: ReportPeriod; label: string }[] = [
  { period: "week", label: "This Week" },
  { period: "last_week", label: "Last Week" },
  { period: "month", label: "This Month" },
  { period: "last_month", label: "Last Month" },
];

export default function ReportButton({ size = "default" }: { size?: "default" | "sm" | "icon" }) {
  const { data: expenses = [] } = useExpenses();
  const { data: incomes = [] } = useIncomes();
  const { data: projects = [] } = useProjects();
  const [generating, setGenerating] = useState(false);

  const generate = async (period: ReportPeriod) => {
    setGenerating(true);
    try {
      await new Promise((r) => setTimeout(r, 50)); // let UI update
      generatePDFReport(period, { expenses, incomes, projects });
      toast.success("PDF report downloaded");
    } catch (e: any) {
      toast.error(e.message ?? "Failed to generate report");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size={size} disabled={generating} className="gap-1.5">
          {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
          {size !== "icon" && "PDF Report"}
          {size !== "icon" && <ChevronDown className="w-3 h-3 opacity-60" />}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Download Report</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {OPTIONS.map((o) => (
          <DropdownMenuItem key={o.period} onClick={() => generate(o.period)}>
            {o.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
