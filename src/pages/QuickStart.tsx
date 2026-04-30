import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Sparkles, Plus, FolderKanban, Receipt, Camera, Users,
  ArrowRight, Zap, LayoutDashboard, TrendingUp, TrendingDown,
  DollarSign, Activity, ChevronRight, Clock, Layers,
  BarChart3, Building2, FileText, Package,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useCreateProject, useExpenses, useIncomes, useProjects, useVendors } from "@/lib/hooks";
import { vendorsApi } from "@/lib/api";
import { toast } from "sonner";
import type { ExpenseCategory } from "@/lib/types";
import { CATEGORY_LABELS } from "@/lib/types";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { format, startOfMonth, isToday, parseISO } from "date-fns";

type ActionKey = "project" | "expense" | "receipt" | "vendor";

export default function QuickStart() {
  const nav = useNavigate();
  const createProject = useCreateProject();
  const qc = useQueryClient();

  const { data: projects = [] } = useProjects();
  const { data: expenses = [] } = useExpenses();
  const { data: incomes = [] } = useIncomes();
  const { data: vendors = [] } = useVendors();

  const [projectOpen, setProjectOpen] = useState(false);
  const [vendorOpen, setVendorOpen] = useState(false);

  const [projectForm, setProjectForm] = useState({
    name: "",
    client_name: "",
    start_date: new Date().toISOString().slice(0, 10),
    budget: "",
  });
  const [vendorName, setVendorName] = useState("");
  const [vendorCategory, setVendorCategory] = useState<ExpenseCategory>("materials");

  // ── Live stats ──
  const now = new Date();
  const monthStart = startOfMonth(now).toISOString().slice(0, 10);

  const stats = useMemo(() => {
    const activeProjects = projects.filter((p) => p.status === "active");
    const monthExpenses = expenses.filter((e) => e.date >= monthStart);
    const monthIncome = incomes.filter((i) => i.date >= monthStart && i.payment_status === "paid");
    const todayExpenses = expenses.filter((e) => isToday(parseISO(e.date)));
    const totalSpentMonth = monthExpenses.reduce((s, e) => s + Number(e.amount), 0);
    const totalIncomeMonth = monthIncome.reduce((s, i) => s + Number(i.amount), 0);
    const todayTotal = todayExpenses.reduce((s, e) => s + Number(e.amount), 0);
    const net = totalIncomeMonth - totalSpentMonth;
    return { activeProjects: activeProjects.length, totalSpentMonth, totalIncomeMonth, net, todayTotal, vendorCount: vendors.length };
  }, [projects, expenses, incomes, vendors, monthStart]);

  // ── Recent activity (last 5 entries) ──
  const recentActivity = useMemo(() => {
    const exp = expenses.slice(0, 10).map((e) => ({
      id: e.id,
      type: "expense" as const,
      label: e.vendor,
      sub: CATEGORY_LABELS[e.category],
      amount: -e.amount,
      date: e.date,
    }));
    const inc = incomes.slice(0, 10).map((i) => ({
      id: i.id,
      type: "income" as const,
      label: i.client_name || "Income",
      sub: i.description || "Payment received",
      amount: i.amount,
      date: i.date,
    }));
    return [...exp, ...inc]
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 5);
  }, [expenses, incomes]);

  const openAction = (k: ActionKey) => {
    if (k === "expense") { nav("/dashboard?add=quick"); return; }
    if (k === "receipt") { nav("/dashboard?add=camera"); return; }
    if (k === "project") { setProjectOpen(true); return; }
    if (k === "vendor") { setVendorOpen(true); return; }
  };

  const submitProject = async () => {
    if (!projectForm.name.trim()) return toast.error("Project name required");
    const created = await createProject.mutateAsync({
      name: projectForm.name.trim(),
      client_name: projectForm.client_name.trim() || null,
      start_date: projectForm.start_date,
      budget: projectForm.budget ? parseFloat(projectForm.budget) : null,
      status: "active",
    });
    setProjectOpen(false);
    setProjectForm({ name: "", client_name: "", start_date: new Date().toISOString().slice(0, 10), budget: "" });
    toast.success("Project created");
    if (created?.id) nav(`/projects/${created.id}`);
  };

  const submitVendor = async () => {
    if (!vendorName.trim()) return toast.error("Vendor name required");
    try {
      const created = await vendorsApi.upsert(vendorName.trim(), vendorCategory);
      qc.invalidateQueries({ queryKey: ["vendors"] });
      toast.success("Vendor created");
      setVendorName(""); setVendorCategory("materials"); setVendorOpen(false);
      if (created?.id) nav(`/vendors/${created.id}`);
      else nav("/vendors");
    } catch (e: any) { toast.error(e?.message ?? "Failed to create vendor"); }
  };

  const fmt = (n: number) => `$${Math.abs(n).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

  return (
    <div className="px-4 py-5 md:px-8 md:py-6 max-w-5xl mx-auto space-y-5">

      {/* ── Header ── */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl md:text-3xl font-bold tracking-tight">Quick Start</h1>
          <p className="text-muted-foreground text-sm mt-0.5">{format(now, "EEEE, MMMM d")} · {stats.activeProjects} active project{stats.activeProjects !== 1 ? "s" : ""}</p>
        </div>
        <Link
          to="/dashboard"
          className="inline-flex items-center gap-2 h-10 px-4 rounded-2xl bg-surface-dark text-white hover:opacity-90 transition shadow-sm text-sm font-medium shrink-0"
        >
          <LayoutDashboard className="w-4 h-4" /> Dashboard
        </Link>
      </div>

      {/* ── Hero / primary CTA ── */}
      <section className="relative rounded-[28px] overflow-hidden hero-luxe animate-rise">
        {/* Floating orbs */}
        <div aria-hidden className="pointer-events-none absolute -top-24 -left-16 w-72 h-72 rounded-full bg-primary/30 blur-3xl animate-float-slow z-0" />
        <div aria-hidden className="pointer-events-none absolute -bottom-24 -right-12 w-80 h-80 rounded-full bg-[hsl(41_70%_52%/0.18)] blur-3xl animate-float-slow z-0" style={{ animationDelay: "1.5s" }} />
        {/* Subtle grid */}
        <div aria-hidden className="absolute inset-0 z-0 opacity-[0.07] mix-blend-overlay"
          style={{
            backgroundImage:
              "linear-gradient(hsl(0 0% 100% / 0.7) 1px, transparent 1px), linear-gradient(90deg, hsl(0 0% 100% / 0.7) 1px, transparent 1px)",
            backgroundSize: "44px 44px",
            maskImage: "radial-gradient(ellipse at 50% 30%, black 40%, transparent 80%)",
          }}
        />

        <div className="relative z-10 px-6 md:px-10 pt-8 md:pt-10 pb-7 md:pb-9">
          {/* Top row: brand mark + meta */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="pill-gold animate-glow-pulse">
                <Sparkles className="w-3.5 h-3.5" />
                Built for the jobsite
              </div>
              <span className="hidden sm:inline-flex items-center gap-1.5 text-[10px] font-semibold tracking-[0.18em] uppercase text-white/40">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Live ledger
              </span>
            </div>
            <div className="hidden md:block text-[10px] font-semibold tracking-[0.18em] uppercase text-white/30">
              {format(now, "MMM d · yyyy").toUpperCase()}
            </div>
          </div>

          {/* Headline */}
          <h2 className="font-display font-bold text-[34px] md:text-[56px] leading-[0.98] tracking-[-0.025em] max-w-3xl">
            <span className="block text-white/95">Fast, accurate</span>
            <span className="block">
              <span className="font-serif-luxe italic text-luxe-shimmer">bookkeeping.</span>
            </span>
            <span className="block text-white/55 text-[22px] md:text-[30px] font-medium tracking-tight mt-3">
              No accountant required.
            </span>
          </h2>

          {/* Hairline rule */}
          <div className="rule-gold mt-6 md:mt-7 max-w-[420px]" />

          {/* Sub copy */}
          <p className="text-white/55 mt-5 text-[14px] md:text-[15px] max-w-xl leading-relaxed">
            Capture expenses in seconds, scan receipts on site, and watch project profit move in real time —
            engineered for the field, designed like a private office.
          </p>

          {/* CTAs */}
          <div className="mt-7 flex flex-wrap gap-2.5">
            <Button
              onClick={() => openAction("expense")}
              className="h-11 rounded-2xl bg-gradient-primary shadow-red font-semibold text-[13px] px-5 hover:scale-[1.02] active:scale-[0.98] transition-transform"
            >
              <Plus className="w-4 h-4 mr-1.5" /> Log Expense
            </Button>
            <Button
              onClick={() => openAction("receipt")}
              variant="outline"
              className="h-11 rounded-2xl border-white/15 bg-white/5 text-white hover:bg-white/15 hover:text-white font-semibold text-[13px] px-5 backdrop-blur"
            >
              <Camera className="w-4 h-4 mr-1.5" /> Scan Receipt
            </Button>
            <Button
              onClick={() => openAction("project")}
              variant="outline"
              className="h-11 rounded-2xl border-white/15 bg-white/5 text-white hover:bg-white/15 hover:text-white font-semibold text-[13px] px-5 backdrop-blur"
            >
              <FolderKanban className="w-4 h-4 mr-1.5" /> New Project
            </Button>
          </div>
        </div>

        {/* Live stat strip */}
        <div className="relative z-10 border-t border-white/[0.08] bg-black/25 backdrop-blur-xl px-5 md:px-10 py-3.5">
          <div className="flex items-center gap-7 overflow-x-auto">
            <Stat label="Spent · MTD" value={fmt(stats.totalSpentMonth)} icon={TrendingDown} tone="red" />
            <Divider />
            <Stat label="Income · MTD" value={fmt(stats.totalIncomeMonth)} icon={TrendingUp} tone="emerald" />
            <Divider />
            <Stat label="Net" value={`${stats.net >= 0 ? "+" : "−"}${fmt(Math.abs(stats.net))}`} icon={Activity} tone={stats.net >= 0 ? "emerald" : "red"} />
            <Divider />
            <Stat label="Active jobs" value={stats.activeProjects.toString()} icon={Layers} tone="gold" />
            <Divider />
            <Stat label="Today" value={stats.todayTotal > 0 ? fmt(stats.todayTotal) : "—"} icon={Clock} tone="muted" />
          </div>
        </div>
      </section>

      {/* ── Quick action tiles ── */}
      <div>
        <div className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground/50 mb-2.5">Quick Actions</div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {[
            { key: "expense" as ActionKey, icon: Receipt, label: "Log Expense", sub: "Fast entry", color: "from-red-500 to-rose-700", iconColor: "text-rose-100" },
            { key: "receipt" as ActionKey, icon: Camera, label: "Scan Receipt", sub: "Camera or upload", color: "from-violet-500 to-violet-700", iconColor: "text-violet-100" },
            { key: "project" as ActionKey, icon: FolderKanban, label: "New Project", sub: "Track a job", color: "from-blue-500 to-blue-700", iconColor: "text-blue-100" },
            { key: "vendor" as ActionKey, icon: Users, label: "Add Vendor", sub: "Reuse in Quick Add", color: "from-amber-500 to-orange-600", iconColor: "text-amber-100" },
          ].map((a) => (
            <button
              key={a.key}
              onClick={() => openAction(a.key)}
              className={cn(
                "group relative h-[90px] rounded-2xl overflow-hidden text-left p-3.5 flex flex-col justify-between",
                "bg-gradient-to-br", a.color,
                "border border-white/10 shadow-sm",
                "active:scale-[0.97] transition-all duration-150",
              )}
            >
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(255,255,255,0.12),transparent)] pointer-events-none" />
              <a.icon className={cn("w-5 h-5", a.iconColor)} />
              <div>
                <div className="font-display font-bold text-sm text-white leading-tight">{a.label}</div>
                <div className="text-[11px] text-white/60 font-medium">{a.sub}</div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* ── Stats row ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        {[
          { icon: Layers, label: "Active Projects", value: stats.activeProjects.toString(), link: "/projects", color: "text-blue-500" },
          { icon: DollarSign, label: "Today's Spend", value: stats.todayTotal > 0 ? fmt(stats.todayTotal) : "—", link: "/transactions", color: "text-red-500" },
          { icon: BarChart3, label: "This Month Net", value: stats.net !== 0 ? `${stats.net >= 0 ? "+" : ""}${fmt(stats.net)}` : "—", link: "/dashboard", color: stats.net >= 0 ? "text-emerald-500" : "text-red-500" },
          { icon: Building2, label: "Vendors Saved", value: stats.vendorCount.toString(), link: "/vendors", color: "text-amber-500" },
        ].map((s) => (
          <Link
            key={s.label}
            to={s.link}
            className="stat-card p-3.5 flex flex-col gap-2 hover:shadow-md transition group"
          >
            <div className="flex items-center justify-between">
              <s.icon className={cn("w-4 h-4", s.color)} />
              <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/30 group-hover:text-muted-foreground transition" />
            </div>
            <div>
              <div className="font-display font-bold text-lg leading-none">{s.value}</div>
              <div className="text-xs text-muted-foreground mt-1">{s.label}</div>
            </div>
          </Link>
        ))}
      </div>

      {/* ── Recent Activity + Nav tiles ── */}
      <div className="grid md:grid-cols-[1fr_220px] gap-3">
        {/* Recent activity */}
        <div className="stat-card p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-muted-foreground" />
              <span className="font-display font-bold text-sm">Recent Activity</span>
            </div>
            <Link to="/transactions" className="text-xs text-primary font-medium hover:underline">View all</Link>
          </div>
          {recentActivity.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center mb-2">
                <Activity className="w-5 h-5 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground">No entries yet</p>
              <p className="text-xs text-muted-foreground mt-1">Log an expense to get started</p>
            </div>
          ) : (
            <div className="space-y-0.5">
              {recentActivity.map((a) => (
                <div key={a.id} className="flex items-center gap-3 py-2 px-2 rounded-xl hover:bg-muted/50 transition">
                  <div className={cn("w-8 h-8 rounded-xl flex items-center justify-center shrink-0", a.type === "income" ? "bg-emerald-100 text-emerald-600" : "bg-red-100 text-red-600")}>
                    {a.type === "income" ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold truncate">{a.label}</div>
                    <div className="text-xs text-muted-foreground">{a.sub} · {format(parseISO(a.date), "MMM d")}</div>
                  </div>
                  <div className={cn("text-sm font-bold tabular-nums shrink-0", a.amount >= 0 ? "text-emerald-600" : "text-foreground")}>
                    {a.amount >= 0 ? "+" : "−"}{fmt(Math.abs(a.amount))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Navigation tiles */}
        <div className="flex flex-col gap-2.5">
          {[
            { to: "/dashboard", icon: LayoutDashboard, label: "Dashboard", sub: "Overview & charts", color: "text-zinc-600" },
            { to: "/projects", icon: FolderKanban, label: "Projects", sub: "Profit by job", color: "text-blue-600" },
            { to: "/transactions", icon: FileText, label: "Transactions", sub: "Filter & review", color: "text-purple-600" },
            { to: "/vendors", icon: Package, label: "Vendors", sub: "Manage suppliers", color: "text-amber-600" },
          ].map((n) => (
            <Link
              key={n.to}
              to={n.to}
              className="stat-card px-4 py-3 flex items-center gap-3 hover:shadow-md transition group"
            >
              <div className="w-8 h-8 rounded-xl bg-muted flex items-center justify-center shrink-0">
                <n.icon className={cn("w-4 h-4", n.color)} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-display font-bold text-sm">{n.label}</div>
                <div className="text-xs text-muted-foreground">{n.sub}</div>
              </div>
              <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/30 group-hover:text-muted-foreground transition shrink-0" />
            </Link>
          ))}
        </div>
      </div>

      {/* Create Project dialog */}
      <Dialog open={projectOpen} onOpenChange={setProjectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display text-2xl">Create Project</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">Project Name</Label>
              <Input value={projectForm.name} onChange={(e) => setProjectForm((f) => ({ ...f, name: e.target.value }))} className="h-10 mt-1.5" placeholder="e.g. Riverside Tower" />
            </div>
            <div>
              <Label className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">Client</Label>
              <Input value={projectForm.client_name} onChange={(e) => setProjectForm((f) => ({ ...f, client_name: e.target.value }))} className="h-10 mt-1.5" placeholder="Client name" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">Start Date</Label>
                <Input type="date" value={projectForm.start_date} onChange={(e) => setProjectForm((f) => ({ ...f, start_date: e.target.value }))} className="h-10 mt-1.5" />
              </div>
              <div>
                <Label className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">Budget ($)</Label>
                <Input type="number" inputMode="decimal" value={projectForm.budget} onChange={(e) => setProjectForm((f) => ({ ...f, budget: e.target.value }))} className="h-10 mt-1.5" placeholder="Optional" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={submitProject} disabled={createProject.isPending} className="bg-gradient-primary shadow-red w-full h-10">
              <Plus className="w-4 h-4 mr-1" /> Create Project
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Vendor dialog */}
      <Dialog open={vendorOpen} onOpenChange={setVendorOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display text-2xl">Create Vendor</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">Vendor Name</Label>
              <Input value={vendorName} onChange={(e) => setVendorName(e.target.value)} className="h-10 mt-1.5" placeholder="e.g. Home Depot" />
            </div>
            <div>
              <Label className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">Default Category</Label>
              <Select value={vendorCategory} onValueChange={(v) => setVendorCategory(v as ExpenseCategory)}>
                <SelectTrigger className="h-10 mt-1.5"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.entries(CATEGORY_LABELS) as [ExpenseCategory, string][]).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={submitVendor} className="bg-gradient-primary shadow-red w-full h-10">
              <Plus className="w-4 h-4 mr-1" /> Create Vendor
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Divider() {
  return <span aria-hidden className="w-px h-5 bg-white/10 shrink-0" />;
}

function Stat({
  label, value, icon: Icon, tone = "muted",
}: { label: string; value: string; icon: any; tone?: "red" | "emerald" | "gold" | "muted" }) {
  const toneClass =
    tone === "red" ? "text-red-300" :
    tone === "emerald" ? "text-emerald-300" :
    tone === "gold" ? "text-[hsl(41_78%_78%)]" :
    "text-white/55";
  return (
    <div className="flex items-center gap-2 shrink-0">
      <Icon className={cn("w-3.5 h-3.5", toneClass)} />
      <div className="flex flex-col leading-tight">
        <span className="text-[9px] font-bold tracking-[0.18em] uppercase text-white/40">{label}</span>
        <span className="text-[13px] font-bold text-white tabular-nums">{value}</span>
      </div>
    </div>
  );
}
