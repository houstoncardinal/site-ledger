import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Sparkles, Plus, FolderKanban, Receipt, Camera, Users,
  ArrowRight, Zap, LayoutDashboard, TrendingUp, TrendingDown,
  DollarSign, Activity, ChevronRight, Clock, Layers,
  BarChart3, Building2, FileText, Package, Check, X as XIcon,
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
    <div className="px-4 py-5 md:px-8 md:py-7 max-w-6xl mx-auto space-y-6">

      {/* ── Header ── */}
      <div className="flex items-end justify-between gap-3">
        <div className="animate-rise">
          <div className="text-[10px] font-bold tracking-[0.22em] uppercase text-muted-foreground/70">
            Workspace · {format(now, "EEEE")}
          </div>
          <h1 className="font-display text-3xl md:text-[40px] font-bold tracking-[-0.02em] mt-1">
            Quick <span className="font-serif-luxe italic text-gold">Start</span>
          </h1>
          <p className="text-muted-foreground text-[13px] mt-1">
            {format(now, "MMMM d, yyyy")} · {stats.activeProjects} active project{stats.activeProjects !== 1 ? "s" : ""} · {stats.vendorCount} vendor{stats.vendorCount !== 1 ? "s" : ""}
          </p>
        </div>
        <Link
          to="/dashboard"
          className="inline-flex items-center gap-2 h-10 px-4 rounded-2xl bg-[hsl(var(--ink))] text-white hover:bg-[hsl(var(--ink-soft))] transition shadow-md text-[13px] font-semibold shrink-0"
        >
          <LayoutDashboard className="w-4 h-4" /> Dashboard
        </Link>
      </div>

      {/* ── Quick action tiles · luxury glass ── */}
      <div className="animate-rise">
        <div className="flex items-end justify-between mb-3">
          <div className="text-[10px] uppercase tracking-[0.22em] font-bold text-muted-foreground/70">Quick Actions</div>
          <div className="hidden sm:flex items-center gap-1.5 text-[10px] font-semibold tracking-[0.18em] uppercase text-muted-foreground/60">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Live ledger
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {([
            { key: "expense" as ActionKey, icon: Receipt, label: "Log Expense", sub: "Fast entry · 5s", accent: "hsl(0 82% 48%)", glowA: "hsl(0 82% 48% / 0.55)", glowB: "hsl(0 88% 58% / 0.35)" },
            { key: "receipt" as ActionKey, icon: Camera, label: "Scan Receipt", sub: "Camera or upload", accent: "hsl(41 70% 52%)", glowA: "hsl(41 78% 68% / 0.55)", glowB: "hsl(41 60% 40% / 0.35)" },
            { key: "project" as ActionKey, icon: FolderKanban, label: "New Project", sub: "Track a job", accent: "hsl(0 0% 95%)", glowA: "hsl(0 0% 100% / 0.45)", glowB: "hsl(0 0% 50% / 0.25)" },
            { key: "vendor" as ActionKey, icon: Users, label: "Add Vendor", sub: "Reuse anywhere", accent: "hsl(0 70% 55%)", glowA: "hsl(0 82% 48% / 0.45)", glowB: "hsl(41 70% 52% / 0.30)" },
          ]).map((a, i) => (
            <button
              key={a.key}
              onClick={() => openAction(a.key)}
              style={{ animationDelay: `${0.05 + i * 0.06}s` }}
              className={cn(
                "group relative h-[124px] sm:h-[136px] rounded-[22px] overflow-hidden text-left",
                "animate-rise active:scale-[0.97] transition-all duration-200",
                "hover:-translate-y-0.5",
              )}
            >
              {/* Glass base — dark luxe with sheen */}
              <div className="absolute inset-0 rounded-[22px] bg-[linear-gradient(160deg,hsl(220_25%_10%)_0%,hsl(220_22%_14%)_55%,hsl(0_0%_5%)_100%)]" />
              {/* Aurora glow */}
              <div
                aria-hidden
                className="absolute inset-0 rounded-[22px] opacity-90"
                style={{
                  backgroundImage: `radial-gradient(120% 80% at 0% 0%, ${a.glowA}, transparent 55%), radial-gradient(120% 80% at 100% 100%, ${a.glowB}, transparent 60%)`,
                }}
              />
              {/* Glass sheen */}
              <div
                aria-hidden
                className="absolute inset-0 rounded-[22px] opacity-70 mix-blend-overlay"
                style={{
                  backgroundImage:
                    "linear-gradient(180deg, hsl(0 0% 100% / 0.18) 0%, hsl(0 0% 100% / 0.04) 32%, transparent 60%)",
                }}
              />
              {/* Hairline gold border */}
              <div
                aria-hidden
                className="absolute inset-0 rounded-[22px]"
                style={{
                  padding: "1px",
                  background:
                    "linear-gradient(140deg, hsl(41 78% 78% / 0.55), hsl(0 0% 100% / 0.05) 35%, hsl(0 0% 100% / 0.02) 65%, hsl(0 82% 48% / 0.45))",
                  WebkitMask:
                    "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)",
                  WebkitMaskComposite: "xor" as any,
                  maskComposite: "exclude" as any,
                  pointerEvents: "none",
                }}
              />
              {/* Specular highlight on hover */}
              <div
                aria-hidden
                className="absolute -inset-1 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                style={{
                  background:
                    "radial-gradient(220px circle at var(--x,50%) var(--y,0%), hsl(0 0% 100% / 0.10), transparent 60%)",
                }}
              />

              {/* Content */}
              <div className="relative z-10 h-full p-4 flex flex-col justify-between">
                <div className="flex items-start justify-between">
                  <div className="w-10 h-10 rounded-2xl bg-white/8 border border-white/10 backdrop-blur-md flex items-center justify-center shadow-inner">
                    <a.icon className="w-[18px] h-[18px] text-white/95" strokeWidth={2} />
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 text-white/40 group-hover:text-white/80 group-hover:translate-x-0.5 transition" />
                </div>
                <div>
                  <div className="font-display font-bold text-[15px] text-white leading-tight tracking-tight">{a.label}</div>
                  <div className="text-[11px] text-white/55 font-medium mt-0.5 tracking-wide">{a.sub}</div>
                </div>
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
