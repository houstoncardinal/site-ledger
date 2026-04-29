import { format, parseISO } from "date-fns";
import { Income } from "@/lib/types";
import { useDeleteIncome, useUpdateIncome, useProjects } from "@/lib/hooks";
import { Trash2, DollarSign, CircleDot } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function IncomeList({
  incomes, hideProject,
}: { incomes: Income[]; hideProject?: boolean }) {
  const del = useDeleteIncome();
  const upd = useUpdateIncome();
  const { data: projects = [] } = useProjects();
  const projectName = (id: string | null) => projects.find((p) => p.id === id)?.name ?? "—";

  if (incomes.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground border border-dashed rounded-lg">
        No income recorded yet.
      </div>
    );
  }

  return (
    <div className="divide-y divide-border">
      {incomes.map((i) => (
        <div key={i.id} className="flex items-center gap-3 p-3 hover:bg-muted/40 transition group rounded-lg">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 bg-emerald-100 text-emerald-700">
            <DollarSign className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold truncate">{i.client_name ?? "Income"}</span>
              {i.invoice_number && <span className="text-[10px] text-muted-foreground">#{i.invoice_number}</span>}
              {i.payment_status !== "paid" && (
                <Badge variant="outline" className="text-[10px] border-warning text-warning h-4 px-1.5">
                  {i.payment_status.toUpperCase()}
                </Badge>
              )}
            </div>
            <div className="text-xs text-muted-foreground truncate">
              {format(parseISO(i.date), "MMM d, yyyy")}
              {!hideProject && ` · ${projectName(i.project_id)}`}
              {i.description && ` · ${i.description}`}
            </div>
          </div>
          <div className="text-right shrink-0">
            <div className="font-display font-bold text-emerald-700">+${Number(i.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
          </div>
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
            {i.payment_status !== "paid" && (
              <button
                onClick={() => upd.mutate({ id: i.id, payment_status: "paid" })}
                className="w-8 h-8 rounded-md hover:bg-success/20 text-success flex items-center justify-center"
                title="Mark as paid"
              >
                <CircleDot className="w-4 h-4" />
              </button>
            )}
            <button onClick={() => del.mutate(i.id)} className="w-8 h-8 rounded-md hover:bg-primary hover:text-primary-foreground flex items-center justify-center">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
