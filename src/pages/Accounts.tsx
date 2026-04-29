import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Wallet, Landmark, CreditCard } from "lucide-react";
import { useAccounts, useCreateAccount, useExpenses, useIncomes } from "@/lib/hooks";
import { ACCOUNT_TYPE_LABELS, AccountType } from "@/lib/types";
import { toast } from "sonner";

const ICONS: Record<AccountType, any> = {
  cash: Wallet, bank: Landmark, credit_card: CreditCard,
};

export default function Accounts() {
  const { data: accounts = [] } = useAccounts();
  const { data: expenses = [] } = useExpenses();
  const { data: incomes = [] } = useIncomes();
  const create = useCreateAccount();

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", type: "bank" as AccountType, starting_balance: "" });

  const submit = async () => {
    if (!form.name.trim()) return toast.error("Name required");
    await create.mutateAsync({
      name: form.name.trim(),
      type: form.type,
      starting_balance: form.starting_balance ? parseFloat(form.starting_balance) : 0,
    });
    setOpen(false);
    setForm({ name: "", type: "bank", starting_balance: "" });
  };

  const balanceFor = (id: string, starting: number) => {
    const inflow = incomes.filter((i) => i.account_id === id && i.payment_status === "paid").reduce((s, i) => s + Number(i.amount), 0);
    const outflow = expenses.filter((e) => e.account_id === id && e.payment_status === "paid").reduce((s, e) => s + Number(e.amount), 0);
    const isCredit = accounts.find((a) => a.id === id)?.type === "credit_card";
    return isCredit ? -(starting + outflow - inflow) : starting + inflow - outflow;
  };

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl md:text-4xl font-bold">Accounts</h1>
          <p className="text-muted-foreground mt-1">{accounts.length} financial accounts</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="bg-gradient-primary shadow-red h-11">
              <Plus className="w-4 h-4 mr-1" /> New Account
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle className="font-display text-2xl">Add Account</DialogTitle></DialogHeader>
            <div className="space-y-4 py-2">
              <div>
                <Label className="text-xs uppercase tracking-wider font-semibold">Name *</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="h-11 mt-1.5" placeholder="e.g. Chase Business" />
              </div>
              <div>
                <Label className="text-xs uppercase tracking-wider font-semibold">Type</Label>
                <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v as AccountType })}>
                  <SelectTrigger className="h-11 mt-1.5"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(ACCOUNT_TYPE_LABELS) as AccountType[]).map((t) => (
                      <SelectItem key={t} value={t}>{ACCOUNT_TYPE_LABELS[t]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs uppercase tracking-wider font-semibold">Starting Balance</Label>
                <Input type="number" inputMode="decimal" value={form.starting_balance} onChange={(e) => setForm({ ...form, starting_balance: e.target.value })} className="h-11 mt-1.5" />
              </div>
            </div>
            <DialogFooter>
              <Button onClick={submit} disabled={create.isPending} className="bg-gradient-primary shadow-red w-full h-11">Add Account</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {accounts.length === 0 && (
          <div className="col-span-full border border-dashed rounded-xl p-12 text-center text-muted-foreground">
            No accounts yet.
          </div>
        )}
        {accounts.map((a) => {
          const Icon = ICONS[a.type];
          const balance = balanceFor(a.id, Number(a.starting_balance));
          const isCredit = a.type === "credit_card";
          return (
            <div key={a.id} className="stat-card">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${isCredit ? "bg-primary/10 text-primary" : "bg-muted text-foreground"}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="font-display font-bold">{a.name}</div>
                    <div className="text-xs text-muted-foreground">{ACCOUNT_TYPE_LABELS[a.type]}</div>
                  </div>
                </div>
              </div>
              <div className="mt-4">
                <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">{isCredit ? "Owed" : "Balance"}</div>
                <div className={`font-display font-bold text-2xl mt-1 ${isCredit ? "text-primary" : balance < 0 ? "text-primary" : ""}`}>
                  ${Math.abs(balance).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
