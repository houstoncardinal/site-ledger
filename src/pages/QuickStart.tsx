import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Sparkles, Plus, FolderKanban, Receipt, Camera, Users,
  ArrowRight, Wand2, Zap, LayoutDashboard,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useCreateProject } from "@/lib/hooks";
import { vendorsApi } from "@/lib/api";
import { toast } from "sonner";
import type { ExpenseCategory } from "@/lib/types";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";

const QUICK_ACTIONS = [
  {
    title: "Create a Project",
    description: "Start tracking spend and profit for a job.",
    icon: FolderKanban,
    tone: "bg-white",
    action: "project",
  },
  {
    title: "Log an Expense",
    description: "Fast entry. Vendor, amount, category — done.",
    icon: Receipt,
    tone: "bg-white",
    action: "expense",
  },
  {
    title: "Scan a Receipt",
    description: "Camera → AI fills vendor/amount/category.",
    icon: Camera,
    tone: "bg-white",
    action: "receipt",
  },
  {
    title: "Create a Vendor",
    description: "Save vendors for 1-tap reuse in Quick Add.",
    icon: Users,
    tone: "bg-white",
    action: "vendor",
  },
] as const;

type ActionKey = typeof QUICK_ACTIONS[number]["action"]; 

export default function QuickStart() {
  const nav = useNavigate();
  const createProject = useCreateProject();
  const qc = useQueryClient();

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

  const openAction = (k: ActionKey) => {
    if (k === "expense") {
      nav("/dashboard?add=quick");
      return;
    }
    if (k === "receipt") {
      nav("/dashboard?add=camera");
      return;
    }
    if (k === "project") {
      setProjectOpen(true);
      return;
    }
    if (k === "vendor") {
      setVendorOpen(true);
      return;
    }
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
      const nextId = created?.id;
      const nextName = vendorName.trim();
      setVendorName("");
      setVendorCategory("materials");
      setVendorOpen(false);
      if (nextId) nav(`/vendors/${nextId}`);
      else nav("/vendors");
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to create vendor");
    }
  };

  return (
    <div className="px-4 py-6 md:px-8 md:py-8 space-y-5 max-w-7xl mx-auto">
      {/* Top strip: always-prominent Dashboard CTA */}
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm text-muted-foreground">
          <span className="font-semibold text-foreground">Quick Start</span> · Do more in seconds
        </div>
        <Link
          to="/dashboard"
          className="inline-flex items-center gap-2 h-10 px-4 rounded-2xl bg-surface-dark text-white hover:opacity-90 transition shadow-sm"
        >
          <LayoutDashboard className="w-4 h-4" /> Go to Dashboard
        </Link>
      </div>

      {/* Hero */}
      <div
        className={cn(
          "group relative rounded-3xl overflow-hidden",
          "bg-white/70 backdrop-blur-xl border border-white/60",
          "shadow-[0_24px_70px_-45px_rgba(0,0,0,0.45)]",
          "hover:shadow-[0_30px_90px_-55px_rgba(0,0,0,0.55)]",
          "transition-all duration-300",
          "hover:-translate-y-0.5",
        )}
      >
        {/* Soft glass highlights */}
        <div className="absolute inset-0 bg-[radial-gradient(900px_circle_at_20%_0%,rgba(220,38,38,0.12),transparent_55%),radial-gradient(700px_circle_at_100%_20%,rgba(16,185,129,0.10),transparent_55%)]" />
        <div className="absolute -top-24 -right-24 w-72 h-72 rounded-full bg-primary/10 blur-3xl group-hover:bg-primary/15 transition" />

        <div className="relative p-6 md:p-8">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/70 border border-black/5 text-xs font-semibold text-foreground shadow-sm">
            <Sparkles className="w-3.5 h-3.5 text-primary" />
            Quick Start
          </div>

          <h1 className="font-display text-[28px] md:text-4xl font-bold tracking-tight mt-3 leading-[1.08] text-foreground">
            Fast, clean bookkeeping
            <span className="text-primary"> built for the jobsite</span>.
          </h1>
          <p className="text-muted-foreground mt-2.5 max-w-2xl text-[14px] md:text-[15px]">
            Create projects, log expenses, and keep your books accurate in seconds.
          </p>

          <div className="mt-5 flex flex-col sm:flex-row gap-2.5">
            <Button
              onClick={() => openAction("expense")}
              className="h-11 rounded-2xl bg-gradient-primary shadow-red font-semibold transition-transform duration-200 hover:scale-[1.01] active:scale-[0.99]"
            >
              <Plus className="w-4 h-4" /> Log an Expense
            </Button>
            <Button
              onClick={() => openAction("receipt")}
              variant="outline"
              className="h-11 rounded-2xl border-border/60 bg-white/60 hover:bg-white/80 transition-all"
            >
              <Camera className="w-4 h-4" /> Scan a Receipt
            </Button>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {QUICK_ACTIONS.map((a) => (
          <button
            key={a.action}
            onClick={() => openAction(a.action)}
            className="stat-card p-4 text-left hover:shadow-lg hover:-translate-y-[1px] transition-all"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="w-11 h-11 rounded-2xl bg-primary/10 flex items-center justify-center">
                <a.icon className="w-5 h-5 text-primary" />
              </div>
              <ArrowRight className="w-4 h-4 text-muted-foreground" />
            </div>
            <div className="font-display font-bold mt-3">{a.title}</div>
            <div className="text-sm text-muted-foreground mt-1 leading-snug">{a.description}</div>
          </button>
        ))}
      </div>

      {/* Secondary links */}
      <div className="grid md:grid-cols-3 gap-4">
        <Link
          to="/dashboard"
          className="stat-card p-4 flex items-center gap-3 hover:shadow-md transition"
        >
          <div className="w-10 h-10 rounded-2xl bg-muted flex items-center justify-center">
            <Zap className="w-5 h-5 text-muted-foreground" />
          </div>
          <div>
            <div className="font-display font-bold">Go to Dashboard</div>
            <div className="text-sm text-muted-foreground">Financial overview and insights.</div>
          </div>
        </Link>

        <Link
          to="/projects"
          className="stat-card p-4 flex items-center gap-3 hover:shadow-md transition"
        >
          <div className="w-10 h-10 rounded-2xl bg-muted flex items-center justify-center">
            <FolderKanban className="w-5 h-5 text-muted-foreground" />
          </div>
          <div>
            <div className="font-display font-bold">Manage Projects</div>
            <div className="text-sm text-muted-foreground">Add, archive, and view profit.</div>
          </div>
        </Link>

        <Link
          to="/transactions"
          className="stat-card p-4 flex items-center gap-3 hover:shadow-md transition"
        >
          <div className="w-10 h-10 rounded-2xl bg-muted flex items-center justify-center">
            <Wand2 className="w-5 h-5 text-muted-foreground" />
          </div>
          <div>
            <div className="font-display font-bold">Review Transactions</div>
            <div className="text-sm text-muted-foreground">Swipe-to-delete and filter.</div>
          </div>
        </Link>
      </div>

      {/* Create Project dialog */}
      <Dialog open={projectOpen} onOpenChange={setProjectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display text-2xl">Create Project</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">Project Name</Label>
              <Input value={projectForm.name} onChange={(e) => setProjectForm((f) => ({ ...f, name: e.target.value }))} className="h-11 mt-1.5" />
            </div>
            <div>
              <Label className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">Client</Label>
              <Input value={projectForm.client_name} onChange={(e) => setProjectForm((f) => ({ ...f, client_name: e.target.value }))} className="h-11 mt-1.5" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">Start Date</Label>
                <Input type="date" value={projectForm.start_date} onChange={(e) => setProjectForm((f) => ({ ...f, start_date: e.target.value }))} className="h-11 mt-1.5" />
              </div>
              <div>
                <Label className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">Budget ($)</Label>
                <Input type="number" inputMode="decimal" value={projectForm.budget} onChange={(e) => setProjectForm((f) => ({ ...f, budget: e.target.value }))} className="h-11 mt-1.5" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={submitProject} disabled={createProject.isPending} className="bg-gradient-primary shadow-red w-full h-11">
              <Plus className="w-4 h-4" /> Create Project
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
          <div className="space-y-4">
            <div>
              <Label className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">Vendor Name</Label>
              <Input value={vendorName} onChange={(e) => setVendorName(e.target.value)} className="h-11 mt-1.5" placeholder="e.g. Home Depot" />
            </div>
            <div>
              <Label className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">Default Category</Label>
              <div className="mt-1.5">
                <Select value={vendorCategory} onValueChange={(v) => setVendorCategory(v as ExpenseCategory)}>
                  <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="materials">Materials</SelectItem>
                    <SelectItem value="labor">Labor</SelectItem>
                    <SelectItem value="equipment">Equipment</SelectItem>
                    <SelectItem value="subcontractor">Subcontractor</SelectItem>
                    <SelectItem value="operating">Operating</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={submitVendor} className="bg-gradient-primary shadow-red w-full h-11">
              <Plus className="w-4 h-4" /> Create Vendor
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
