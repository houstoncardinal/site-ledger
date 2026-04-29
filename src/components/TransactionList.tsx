import { format, parseISO } from "date-fns";
import { Expense, CATEGORY_LABELS, PaymentStatus } from "@/lib/types";
import { useDeleteExpense, useUpdateExpense, useProjects } from "@/lib/hooks";
import { Trash2, HardHat, Package, Truck, Receipt, MoreHorizontal, Briefcase, Wallet, Wrench, FileImage, CircleDot } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const ICONS: Record<string, any> = {
  labor: HardHat, materials: Package, equipment: Truck, subcontractor: Briefcase,
  cogs: Wrench, operating: Wallet, other: MoreHorizontal,
};
const COLORS: Record<string, string> = {
  labor: "bg-amber-100 text-amber-700",
  materials: "bg-blue-100 text-blue-700",
  equipment: "bg-emerald-100 text-emerald-700",
  subcontractor: "bg-purple-100 text-purple-700",
  cogs: "bg-red-100 text-primary",
  operating: "bg-cyan-100 text-cyan-700",
  other: "bg-zinc-100 text-zinc-700",
};

export default function TransactionList({
  expenses, hideProject,
}: { expenses: Expense[]; hideProject?: boolean }) {
  const del = useDeleteExpense();
  const upd = useUpdateExpense();
  const { data: projects = [] } = useProjects();
  const projectName = (id: string | null) => projects.find((p) => p.id === id)?.name ?? "—";

  if (expenses.length === 0) {
    return (
      <div className="text-center py-16 text-muted-foreground border border-dashed rounded-lg">
        No transactions match.
      </div>
    );
  }

  return (
    <div className="divide-y divide-border">
      {expenses.map((e) => {
        const Icon = ICONS[e.category];
        return (
          <div key={e.id} className="flex items-center gap-3 p-3 hover:bg-muted/40 transition group rounded-lg">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${COLORS[e.category]}`}>
              <Icon className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold truncate">{e.vendor}</span>
                <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
                  {CATEGORY_LABELS[e.category]}
                </span>
                {e.payment_status !== "paid" && (
                  <Badge variant="outline" className="text-[10px] border-warning text-warning h-4 px-1.5">
                    {e.payment_status.toUpperCase()}
                  </Badge>
                )}
                {e.receipt_url && (
                  <a href={e.receipt_url} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-primary">
                    <FileImage className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>
              <div className="text-xs text-muted-foreground truncate">
                {format(parseISO(e.date), "MMM d, yyyy")}
                {!hideProject && ` · ${projectName(e.project_id)}`}
                {e.description && ` · ${e.description}`}
              </div>
            </div>
            <div className="text-right shrink-0">
              <div className="font-display font-bold">${Number(e.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
              <div className="text-xs text-muted-foreground">{e.payment_method ?? "—"}</div>
            </div>
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
              {e.payment_status !== "paid" && (
                <button
                  onClick={() => upd.mutate({ id: e.id, payment_status: "paid" as PaymentStatus })}
                  className="w-8 h-8 rounded-md hover:bg-success/20 text-success flex items-center justify-center"
                  title="Mark as paid"
                >
                  <CircleDot className="w-4 h-4" />
                </button>
              )}
              <button
                onClick={() => del.mutate(e.id)}
                className="w-8 h-8 rounded-md hover:bg-primary hover:text-primary-foreground flex items-center justify-center"
                aria-label="Delete"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
