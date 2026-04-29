import { useEffect, useMemo, useState } from "react";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  CATEGORY_LABELS, ExpenseCategory, PAYMENT_METHODS,
} from "@/lib/types";
import {
  useAccounts, useCreateExpense, useCreateIncome, useProjects, useVendors,
} from "@/lib/hooks";
import {
  HardHat, Package, Truck, Receipt as ReceiptIcon, MoreHorizontal,
  ArrowLeft, Check, Camera, DollarSign, Briefcase, Wallet, Wrench,
} from "lucide-react";
import { receiptsApi } from "@/lib/api";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Mode = "expense" | "income";

const CATS: { type: ExpenseCategory; icon: any; color: string }[] = [
  { type: "labor", icon: HardHat, color: "from-amber-500 to-orange-600" },
  { type: "materials", icon: Package, color: "from-blue-500 to-blue-700" },
  { type: "equipment", icon: Truck, color: "from-emerald-500 to-emerald-700" },
  { type: "subcontractor", icon: Briefcase, color: "from-purple-500 to-purple-700" },
  { type: "operating", icon: Wallet, color: "from-cyan-600 to-cyan-800" },
  { type: "other", icon: MoreHorizontal, color: "from-zinc-600 to-zinc-800" },
];

export default function QuickAddSheet({
  open, onOpenChange, defaultProjectId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  defaultProjectId?: string;
}) {
  const { data: projects = [] } = useProjects();
  const { data: accounts = [] } = useAccounts();
  const { data: vendors = [] } = useVendors();
  const createExpense = useCreateExpense();
  const createIncome = useCreateIncome();

  const activeProjects = useMemo(() => projects.filter((p) => p.status === "active"), [projects]);
  const today = new Date().toISOString().slice(0, 10);

  const [mode, setMode] = useState<Mode>("expense");
  const [step, setStep] = useState<"pick" | "form">("pick");
  const [category, setCategory] = useState<ExpenseCategory>("materials");
  const [uploading, setUploading] = useState(false);

  const [form, setForm] = useState({
    project_id: "" as string | "none",
    account_id: "" as string | "none",
    date: today,
    vendor: "",
    description: "",
    amount: "",
    payment_method: "Credit Card",
    payment_status: "paid" as "paid" | "unpaid",
    notes: "",
    hours: "", rate: "",
    quantity: "", unit_price: "",
    receipt_url: "" as string,
    invoice_number: "",
    client_name: "",
  });

  useEffect(() => {
    if (open) {
      setStep("pick");
      setMode("expense");
      setForm((f) => ({
        ...f,
        project_id: defaultProjectId ?? activeProjects[0]?.id ?? "none",
        account_id: accounts[0]?.id ?? "none",
        date: today,
        vendor: "", description: "", amount: "",
        notes: "", hours: "", rate: "", quantity: "", unit_price: "",
        receipt_url: "", invoice_number: "", client_name: "",
        payment_status: "paid",
      }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const computedAmount = useMemo(() => {
    if (mode === "expense" && category === "labor" && form.hours && form.rate)
      return (parseFloat(form.hours) * parseFloat(form.rate)).toFixed(2);
    if (mode === "expense" && category === "materials" && form.quantity && form.unit_price)
      return (parseFloat(form.quantity) * parseFloat(form.unit_price)).toFixed(2);
    return form.amount;
  }, [category, form, mode]);

  // Smart vendor autofill suggestions
  const vendorSuggestions = useMemo(() => {
    if (!form.vendor || form.vendor.length < 1) return [];
    const q = form.vendor.toLowerCase();
    return vendors.filter((v) => v.name.toLowerCase().includes(q) && v.name.toLowerCase() !== q).slice(0, 3);
  }, [form.vendor, vendors]);

  const pickVendor = (name: string, defaultCat?: string | null) => {
    setForm((f) => ({ ...f, vendor: name }));
    if (defaultCat && mode === "expense") setCategory(defaultCat as ExpenseCategory);
  };

  const handleReceipt = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const url = await receiptsApi.upload(file);
      setForm((f) => ({ ...f, receipt_url: url }));
      toast.success("Receipt attached");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setUploading(false);
    }
  };

  const submit = async () => {
    const amount = parseFloat(computedAmount);
    if (!amount || amount <= 0) return toast.error("Enter a valid amount");

    if (mode === "expense") {
      if (!form.vendor.trim()) return toast.error("Vendor is required");
      await createExpense.mutateAsync({
        project_id: form.project_id !== "none" ? form.project_id : null,
        account_id: form.account_id !== "none" ? form.account_id : null,
        date: form.date,
        category,
        vendor: form.vendor.trim(),
        description: form.description.trim() || null,
        amount,
        payment_method: form.payment_method,
        payment_status: form.payment_status,
        receipt_url: form.receipt_url || null,
        notes: form.notes.trim() || null,
        hours: form.hours ? parseFloat(form.hours) : null,
        rate: form.rate ? parseFloat(form.rate) : null,
        quantity: form.quantity ? parseFloat(form.quantity) : null,
        unit_price: form.unit_price ? parseFloat(form.unit_price) : null,
      });
    } else {
      await createIncome.mutateAsync({
        project_id: form.project_id !== "none" ? form.project_id : null,
        account_id: form.account_id !== "none" ? form.account_id : null,
        date: form.date,
        client_name: form.client_name.trim() || null,
        description: form.description.trim() || null,
        invoice_number: form.invoice_number.trim() || null,
        amount,
        payment_status: form.payment_status,
        notes: form.notes.trim() || null,
      });
    }
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[94vh] sm:max-w-xl sm:mx-auto rounded-t-2xl p-0 flex flex-col">
        <div className="h-1.5 industrial-stripe rounded-t-2xl" />
        <SheetHeader className="p-5 pb-3 text-left">
          <SheetTitle className="font-display text-2xl flex items-center gap-3">
            {step === "form" && (
              <button onClick={() => setStep("pick")} className="w-8 h-8 rounded-md bg-muted flex items-center justify-center">
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}
            {step === "pick" ? "Quick Add" : mode === "income" ? "Record Income" : `Log ${CATEGORY_LABELS[category]}`}
          </SheetTitle>
          <SheetDescription>
            {step === "pick" ? "What are you logging?" : "Fill the essentials. We'll calculate the rest."}
          </SheetDescription>
        </SheetHeader>

        {step === "pick" ? (
          <div className="px-5 pb-5 overflow-y-auto">
            <div className="grid grid-cols-2 gap-3 mb-4">
              <button
                onClick={() => { setMode("income"); setStep("form"); }}
                className="aspect-[2.2/1] rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-700 text-white p-4 flex flex-col justify-between text-left shadow-md active:scale-95 transition"
              >
                <DollarSign className="w-7 h-7" />
                <div>
                  <div className="font-display font-bold text-lg">Income</div>
                  <div className="text-xs text-white/80">Client payment</div>
                </div>
              </button>
              <button
                onClick={() => { setMode("expense"); setCategory("other"); setStep("form"); }}
                className="aspect-[2.2/1] rounded-xl bg-gradient-to-br from-primary to-primary-glow text-white p-4 flex flex-col justify-between text-left shadow-red active:scale-95 transition"
              >
                <ReceiptIcon className="w-7 h-7" />
                <div>
                  <div className="font-display font-bold text-lg">Expense</div>
                  <div className="text-xs text-white/80">Generic cost</div>
                </div>
              </button>
            </div>

            <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-2 mt-4">By Category</div>
            <div className="grid grid-cols-3 gap-2.5">
              {CATS.map((t) => (
                <button
                  key={t.type}
                  onClick={() => { setMode("expense"); setCategory(t.type); setStep("form"); }}
                  className={cn(
                    "aspect-square rounded-xl bg-gradient-to-br text-white p-3 flex flex-col justify-between text-left shadow-md active:scale-95 transition",
                    t.color
                  )}
                >
                  <t.icon className="w-6 h-6" />
                  <div className="font-display font-bold text-sm leading-tight">
                    {CATEGORY_LABELS[t.type]}
                  </div>
                </button>
              ))}
            </div>
            {activeProjects.length === 0 && (
              <div className="mt-4 text-center text-sm text-muted-foreground p-4 border border-dashed rounded-lg">
                Create a project to organize entries.
              </div>
            )}
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            <Field label="Project">
              <Select value={form.project_id} onValueChange={(v) => setForm({ ...form, project_id: v })}>
                <SelectTrigger className="h-12"><SelectValue placeholder="Select project" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No project</SelectItem>
                  {activeProjects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Date" required>
                <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="h-12" />
              </Field>
              <Field label="Account">
                <Select value={form.account_id} onValueChange={(v) => setForm({ ...form, account_id: v })}>
                  <SelectTrigger className="h-12"><SelectValue placeholder="Account" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">—</SelectItem>
                    {accounts.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
            </div>

            {mode === "expense" ? (
              <>
                <Field label="Vendor" required>
                  <Input
                    placeholder="e.g. Home Depot"
                    value={form.vendor}
                    onChange={(e) => setForm({ ...form, vendor: e.target.value })}
                    className="h-12"
                    list="vendor-suggestions"
                  />
                  {vendorSuggestions.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {vendorSuggestions.map((v) => (
                        <button
                          key={v.id}
                          type="button"
                          onClick={() => pickVendor(v.name, v.default_category)}
                          className="text-xs px-2.5 py-1 rounded-full bg-muted hover:bg-primary hover:text-primary-foreground transition"
                        >
                          {v.name}
                        </button>
                      ))}
                    </div>
                  )}
                </Field>

                <Field label="Category" required>
                  <Select value={category} onValueChange={(v) => setCategory(v as ExpenseCategory)}>
                    <SelectTrigger className="h-12"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(Object.keys(CATEGORY_LABELS) as ExpenseCategory[]).map((k) => (
                        <SelectItem key={k} value={k}>{CATEGORY_LABELS[k]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>

                {category === "labor" && (
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Hours" required>
                      <Input type="number" inputMode="decimal" value={form.hours} onChange={(e) => setForm({ ...form, hours: e.target.value })} className="h-12" />
                    </Field>
                    <Field label="Rate ($/hr)" required>
                      <Input type="number" inputMode="decimal" value={form.rate} onChange={(e) => setForm({ ...form, rate: e.target.value })} className="h-12" />
                    </Field>
                  </div>
                )}
                {category === "materials" && (
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Quantity" required>
                      <Input type="number" inputMode="decimal" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} className="h-12" />
                    </Field>
                    <Field label="Unit Price" required>
                      <Input type="number" inputMode="decimal" value={form.unit_price} onChange={(e) => setForm({ ...form, unit_price: e.target.value })} className="h-12" />
                    </Field>
                  </div>
                )}
                {category !== "labor" && category !== "materials" && (
                  <Field label="Amount ($)" required>
                    <Input type="number" inputMode="decimal" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className="h-12 text-lg font-semibold" />
                  </Field>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <Field label="Payment">
                    <Select value={form.payment_method} onValueChange={(v) => setForm({ ...form, payment_method: v })}>
                      <SelectTrigger className="h-12"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {PAYMENT_METHODS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="Status">
                    <Select value={form.payment_status} onValueChange={(v) => setForm({ ...form, payment_status: v as any })}>
                      <SelectTrigger className="h-12"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="paid">Paid</SelectItem>
                        <SelectItem value="unpaid">Unpaid</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                </div>
              </>
            ) : (
              <>
                <Field label="Client" >
                  <Input value={form.client_name} onChange={(e) => setForm({ ...form, client_name: e.target.value })} className="h-12" placeholder="Client name" />
                </Field>
                <Field label="Amount ($)" required>
                  <Input type="number" inputMode="decimal" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className="h-12 text-lg font-semibold" />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Invoice #">
                    <Input value={form.invoice_number} onChange={(e) => setForm({ ...form, invoice_number: e.target.value })} className="h-12" />
                  </Field>
                  <Field label="Status">
                    <Select value={form.payment_status} onValueChange={(v) => setForm({ ...form, payment_status: v as any })}>
                      <SelectTrigger className="h-12"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="paid">Paid</SelectItem>
                        <SelectItem value="unpaid">Unpaid</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                </div>
              </>
            )}

            <Field label="Description">
              <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="h-12" placeholder="Optional" />
            </Field>

            {mode === "expense" && (
              <Field label="Receipt">
                <label className="flex items-center justify-center gap-2 h-12 border border-dashed rounded-md cursor-pointer hover:border-primary hover:text-primary transition text-sm">
                  <Camera className="w-4 h-4" />
                  {uploading ? "Uploading…" : form.receipt_url ? "✓ Receipt attached" : "Tap to capture or upload"}
                  <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handleReceipt} />
                </label>
              </Field>
            )}

            <Field label="Notes">
              <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} placeholder="Optional" />
            </Field>

            <div className={cn(
              "rounded-xl p-4 flex items-center justify-between text-white",
              mode === "income" ? "bg-emerald-700" : "bg-surface-dark"
            )}>
              <span className="text-white/70 text-sm uppercase tracking-wider">Total</span>
              <span className="font-display font-bold text-2xl">
                {mode === "income" ? "+" : "-"}${computedAmount ? parseFloat(computedAmount).toLocaleString(undefined, { minimumFractionDigits: 2 }) : "0.00"}
              </span>
            </div>
          </div>
        )}

        {step === "form" && (
          <div className="p-5 border-t border-border bg-card">
            <Button
              onClick={submit}
              disabled={createExpense.isPending || createIncome.isPending}
              className={cn(
                "w-full h-14 text-base font-semibold shadow-red",
                mode === "income" ? "bg-emerald-600 hover:bg-emerald-700" : "bg-gradient-primary hover:opacity-95"
              )}
            >
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
