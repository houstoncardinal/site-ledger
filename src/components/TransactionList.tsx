import { format, parseISO } from "date-fns";
import { useStore } from "@/lib/store";
import { Expense, EXPENSE_LABELS } from "@/lib/types";
import { Trash2, HardHat, Package, Truck, Receipt, MoreHorizontal } from "lucide-react";
import { toast } from "sonner";

const ICONS: Record<string, any> = {
  labor: HardHat, materials: Package, equipment: Truck, expense: Receipt, other: MoreHorizontal,
};
const COLORS: Record<string, string> = {
  labor: "bg-amber-100 text-amber-700",
  materials: "bg-blue-100 text-blue-700",
  equipment: "bg-emerald-100 text-emerald-700",
  expense: "bg-red-100 text-primary",
  other: "bg-zinc-100 text-zinc-700",
};

export default function TransactionList({ expenses, hideProject }: { expenses: Expense[]; hideProject?: boolean }) {
  const del = useStore((s) => s.deleteExpense);

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
        const Icon = ICONS[e.type];
        return (
          <div key={e.id} className="flex items-center gap-3 p-3 hover:bg-muted/50 transition group rounded-lg">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${COLORS[e.type]}`}>
              <Icon className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-semibold truncate">{e.vendor}</span>
                <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">{EXPENSE_LABELS[e.type]}</span>
              </div>
              <div className="text-xs text-muted-foreground truncate">
                {format(parseISO(e.date), "MMM d, yyyy")}
                {!hideProject && ` · ${e.projectName}`}
                {e.description && ` · ${e.description}`}
              </div>
            </div>
            <div className="text-right shrink-0">
              <div className="font-display font-bold">${e.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
              <div className="text-xs text-muted-foreground">{e.paymentMethod}</div>
            </div>
            <button
              onClick={() => { del(e.id); toast.success("Deleted"); }}
              className="opacity-0 group-hover:opacity-100 transition w-8 h-8 rounded-md hover:bg-primary hover:text-primary-foreground flex items-center justify-center"
              aria-label="Delete"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
