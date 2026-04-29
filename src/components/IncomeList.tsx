import { useRef, useState } from "react";
import { format, parseISO } from "date-fns";
import { Income } from "@/lib/types";
import { useDeleteIncome, useUpdateIncome, useProjects } from "@/lib/hooks";
import { Trash2, DollarSign, Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";

function SwipeRow({
  children, onDelete, onMarkPaid, canMarkPaid,
}: {
  children: React.ReactNode;
  onDelete: () => void;
  onMarkPaid?: () => void;
  canMarkPaid?: boolean;
}) {
  const startX = useRef(0);
  const [offset, setOffset] = useState(0);
  const [swiped, setSwiped] = useState(false);
  const ACTION_W = canMarkPaid ? 128 : 64;

  const onTouchStart = (e: React.TouchEvent) => { startX.current = e.touches[0].clientX; };
  const onTouchMove = (e: React.TouchEvent) => {
    const dx = startX.current - e.touches[0].clientX;
    if (dx < 0) { setOffset(0); return; }
    setOffset(Math.min(dx, ACTION_W + 16));
  };
  const onTouchEnd = () => {
    if (offset > ACTION_W / 2) { setOffset(ACTION_W); setSwiped(true); }
    else { setOffset(0); setSwiped(false); }
  };
  const close = () => { setOffset(0); setSwiped(false); };

  return (
    <div className="relative overflow-hidden">
      <div className="absolute right-0 top-0 bottom-0 flex items-center" style={{ width: ACTION_W }}>
        {canMarkPaid && (
          <button onClick={() => { onMarkPaid?.(); close(); }} className="w-16 h-full flex flex-col items-center justify-center bg-emerald-600 text-white text-[10px] font-semibold gap-1">
            <Check className="w-4 h-4" /> Paid
          </button>
        )}
        <button onClick={() => { onDelete(); close(); }} className="w-16 h-full flex flex-col items-center justify-center bg-primary text-white text-[10px] font-semibold gap-1">
          <Trash2 className="w-4 h-4" /> Delete
        </button>
      </div>
      <div
        style={{ transform: `translateX(-${offset}px)`, transition: offset === 0 || offset === ACTION_W ? "transform 0.2s ease" : "none" }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onClick={() => swiped && close()}
        className="bg-background relative z-10"
      >
        {children}
      </div>
    </div>
  );
}

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
      {incomes.map((i) => {
        const canMarkPaid = i.payment_status !== "paid";
        return (
          <SwipeRow
            key={i.id}
            onDelete={() => del.mutate(i.id)}
            onMarkPaid={() => upd.mutate({ id: i.id, payment_status: "paid" })}
            canMarkPaid={canMarkPaid}
          >
            <div className="flex items-center gap-3 p-3 hover:bg-muted/40 transition group rounded-lg">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 bg-emerald-100 text-emerald-700">
                <DollarSign className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold truncate">{i.client_name ?? "Income"}</span>
                  {i.invoice_number && <span className="text-[10px] text-muted-foreground">#{i.invoice_number}</span>}
                  {canMarkPaid && (
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
              {/* Desktop hover actions */}
              <div className="hidden md:flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                {canMarkPaid && (
                  <button
                    onClick={() => upd.mutate({ id: i.id, payment_status: "paid" })}
                    className="w-8 h-8 rounded-md hover:bg-emerald-100 text-emerald-700 flex items-center justify-center"
                    title="Mark as paid"
                  >
                    <Check className="w-4 h-4" />
                  </button>
                )}
                <button onClick={() => del.mutate(i.id)} className="w-8 h-8 rounded-md hover:bg-primary hover:text-primary-foreground flex items-center justify-center">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </SwipeRow>
        );
      })}
    </div>
  );
}
