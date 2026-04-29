import { useEffect, useMemo, useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useStore } from "@/lib/store";
import { EXPENSE_LABELS, ExpenseType, PAYMENT_METHODS } from "@/lib/types";
import { HardHat, Package, Truck, Receipt, MoreHorizontal, ArrowLeft, Check } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const TYPES: { type: ExpenseType; icon: any; color: string }[] = [
  { type: "expense", icon: Receipt, color: "from-primary to-primary-glow" },
  { type: "labor", icon: HardHat, color: "from-yellow-500 to-amber-600" },
  { type: "materials", icon: Package, color: "from-blue-500 to-blue-700" },
  { type: "equipment", icon: Truck, color: "from-emerald-500 to-emerald-700" },
  { type: "other", icon: MoreHorizontal, color: "from-zinc-600 to-zinc-800" },
];

export default function QuickAddSheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const projects = useStore((s) => s.projects.filter((p) => p.status === "active"));
  const addExpense = useStore((s) => s.addExpense);

  const [step, setStep] = useState<"pick" | "form">("pick");
  const [type, setType] = useState<ExpenseType>("expense");
  const today = new Date().toISOString().slice(0, 10);

  const [form, setForm] = useState({
    projectId: "",
    date: today,
    vendor: "",
    description: "",
    amount: "",
    paymentMethod: "Credit Card",
    notes: "",
    hours: "",
    rate: "",
    quantity: "",
    unitPrice: "",
  });

  useEffect(() => {
    if (open) {
      setStep("pick");
      setForm((f) => ({
        ...f,
        projectId: projects[0]?.id ?? "",
        date: today,
        vendor: "",
        description: "",
        amount: "",
        notes: "",
        hours: "",
        rate: "",
        quantity: "",
        unitPrice: "",
      }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const computedAmount = useMemo(() => {
    if (type === "labor" && form.hours && form.rate)
      return (parseFloat(form.hours) * parseFloat(form.rate)).toFixed(2);
    if (type === "materials" && form.quantity && form.unitPrice)
      return (parseFloat(form.quantity) * parseFloat(form.unitPrice)).toFixed(2);
    return form.amount;
  }, [type, form]);

  const pick = (t: ExpenseType) => {
    setType(t);
    setStep("form");
  };

  const submit = () => {
    if (!form.projectId) return toast.error("Select a project");
    const amount = parseFloat(computedAmount);
    if (!amount || amount <= 0) return toast.error("Enter a valid amount");
    if (!form.vendor.trim()) return toast.error("Vendor is required");

    const ok = addExpense({
      projectId: form.projectId,
      date: form.date,
      type,
      vendor: form.vendor.trim(),
      description: form.description.trim(),
      amount,
      paymentMethod: form.paymentMethod,
      notes: form.notes.trim(),
      hours: form.hours ? parseFloat(form.hours) : undefined,
      rate: form.rate ? parseFloat(form.rate) : undefined,
      quantity: form.quantity ? parseFloat(form.quantity) : undefined,
      unitPrice: form.unitPrice ? parseFloat(form.unitPrice) : undefined,
    });
    if (ok) {
      toast.success(`${EXPENSE_LABELS[type]} logged`, {
        description: `$${amount.toLocaleString()} → ${ok.projectName}`,
      });
      onOpenChange(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[92vh] sm:max-w-xl sm:mx-auto rounded-t-2xl p-0 flex flex-col">
        <div className="h-1.5 industrial-stripe rounded-t-2xl" />
        <SheetHeader className="p-5 pb-3 text-left">
          <SheetTitle className="font-display text-2xl flex items-center gap-3">
            {step === "form" && (
              <button
                onClick={() => setStep("pick")}
                className="w-8 h-8 rounded-md bg-muted flex items-center justify-center"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}
            {step === "pick" ? "What did you spend on?" : `Log ${EXPENSE_LABELS[type]}`}
          </SheetTitle>
          <SheetDescription>
            {step === "pick"
              ? "Tap a category to log in seconds."
              : "Fill the essentials. We'll calculate the rest."}
          </SheetDescription>
        </SheetHeader>

        {step === "pick" ? (
          <div className="p-5 grid grid-cols-2 gap-3 overflow-y-auto">
            {TYPES.map((t) => (
              <button
                key={t.type}
                onClick={() => pick(t.type)}
                className={cn(
                  "group relative aspect-square rounded-xl bg-gradient-to-br text-white p-4 flex flex-col justify-between text-left shadow-md hover:scale-[1.02] active:scale-95 transition",
                  t.color
                )}
              >
                <t.icon className="w-8 h-8" />
                <div>
                  <div className="font-display font-bold text-lg leading-tight">
                    {EXPENSE_LABELS[t.type]}
                  </div>
                  <div className="text-xs text-white/80 mt-1">Tap to log</div>
                </div>
              </button>
            ))}
            {projects.length === 0 && (
              <div className="col-span-2 text-center text-sm text-muted-foreground p-4 border border-dashed rounded-lg">
                Create a project first to start logging.
              </div>
            )}
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            <Field label="Project" required>
              <Select
                value={form.projectId}
                onValueChange={(v) => setForm({ ...form, projectId: v })}
              >
                <SelectTrigger className="h-12"><SelectValue placeholder="Select project" /></SelectTrigger>
                <SelectContent>
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Date" required>
                <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="h-12" />
              </Field>
              <Field label="Payment">
                <Select value={form.paymentMethod} onValueChange={(v) => setForm({ ...form, paymentMethod: v })}>
                  <SelectTrigger className="h-12"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PAYMENT_METHODS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
            </div>

            <Field label="Vendor" required>
              <Input
                placeholder="e.g. Home Depot"
                value={form.vendor}
                onChange={(e) => setForm({ ...form, vendor: e.target.value })}
                className="h-12"
              />
            </Field>

            {type === "labor" && (
              <div className="grid grid-cols-2 gap-3">
                <Field label="Hours" required>
                  <Input type="number" inputMode="decimal" value={form.hours} onChange={(e) => setForm({ ...form, hours: e.target.value })} className="h-12" />
                </Field>
                <Field label="Rate ($/hr)" required>
                  <Input type="number" inputMode="decimal" value={form.rate} onChange={(e) => setForm({ ...form, rate: e.target.value })} className="h-12" />
                </Field>
              </div>
            )}

            {type === "materials" && (
              <div className="grid grid-cols-2 gap-3">
                <Field label="Quantity" required>
                  <Input type="number" inputMode="decimal" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} className="h-12" />
                </Field>
                <Field label="Unit Price" required>
                  <Input type="number" inputMode="decimal" value={form.unitPrice} onChange={(e) => setForm({ ...form, unitPrice: e.target.value })} className="h-12" />
                </Field>
              </div>
            )}

            {type !== "labor" && type !== "materials" && (
              <Field label="Amount ($)" required>
                <Input type="number" inputMode="decimal" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className="h-12 text-lg font-semibold" />
              </Field>
            )}

            <Field label="Description">
              <Input
                placeholder="What was it for?"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="h-12"
              />
            </Field>

            <Field label="Notes">
              <Textarea
                placeholder="Optional"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                rows={2}
              />
            </Field>

            <div className="bg-surface-dark text-white rounded-xl p-4 flex items-center justify-between">
              <span className="text-white/70 text-sm uppercase tracking-wider">Total</span>
              <span className="font-display font-bold text-2xl">
                ${computedAmount ? parseFloat(computedAmount).toLocaleString(undefined, { minimumFractionDigits: 2 }) : "0.00"}
              </span>
            </div>
          </div>
        )}

        {step === "form" && (
          <div className="p-5 border-t border-border bg-card">
            <Button onClick={submit} className="w-full h-14 text-base font-semibold bg-gradient-primary hover:opacity-95 shadow-red">
              <Check className="w-5 h-5 mr-2" /> Save Entry
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
        {label} {required && <span className="text-primary">*</span>}
      </Label>
      {children}
    </div>
  );
}
