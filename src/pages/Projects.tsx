import { useState } from "react";
import { useStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import { Plus, Archive, ArrowUpRight } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";

export default function Projects() {
  const projects = useStore((s) => s.projects);
  const expenses = useStore((s) => s.expenses);
  const addProject = useStore((s) => s.addProject);
  const archiveProject = useStore((s) => s.archiveProject);

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: "",
    startDate: new Date().toISOString().slice(0, 10),
    budget: "",
  });

  const submit = () => {
    if (!form.name.trim()) return toast.error("Project name required");
    addProject({
      name: form.name.trim(),
      startDate: form.startDate,
      budget: form.budget ? parseFloat(form.budget) : undefined,
      status: "active",
    });
    toast.success("Project created");
    setOpen(false);
    setForm({ name: "", startDate: new Date().toISOString().slice(0, 10), budget: "" });
  };

  const active = projects.filter((p) => p.status === "active");
  const completed = projects.filter((p) => p.status === "completed");

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl md:text-4xl font-bold">Projects</h1>
          <p className="text-muted-foreground mt-1">{projects.length} total · {active.length} active</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="bg-gradient-primary shadow-red h-11">
              <Plus className="w-4 h-4 mr-1" /> New Project
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle className="font-display text-2xl">Create Project</DialogTitle></DialogHeader>
            <div className="space-y-4 py-2">
              <div>
                <Label className="text-xs uppercase tracking-wider font-semibold">Project Name *</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Riverside Tower" className="h-11 mt-1.5" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs uppercase tracking-wider font-semibold">Start Date</Label>
                  <Input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} className="h-11 mt-1.5" />
                </div>
                <div>
                  <Label className="text-xs uppercase tracking-wider font-semibold">Budget ($)</Label>
                  <Input type="number" value={form.budget} onChange={(e) => setForm({ ...form, budget: e.target.value })} placeholder="Optional" className="h-11 mt-1.5" />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={submit} className="bg-gradient-primary shadow-red w-full h-11">Create Project</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Section title="Active" projects={active} expenses={expenses} onArchive={(id) => { archiveProject(id); toast.success("Project archived"); }} />
      {completed.length > 0 && (
        <Section title="Completed" projects={completed} expenses={expenses} muted />
      )}
    </div>
  );
}

function Section({ title, projects, expenses, onArchive, muted }: any) {
  if (projects.length === 0) {
    return (
      <div>
        <h2 className="font-display font-semibold text-sm uppercase tracking-wider text-muted-foreground mb-3">{title}</h2>
        <div className="border border-dashed rounded-xl p-12 text-center text-muted-foreground">
          No {title.toLowerCase()} projects.
        </div>
      </div>
    );
  }
  return (
    <div>
      <h2 className="font-display font-semibold text-sm uppercase tracking-wider text-muted-foreground mb-3">{title}</h2>
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {projects.map((p: any) => {
          const spent = expenses.filter((e: any) => e.projectId === p.id).reduce((s: number, e: any) => s + e.amount, 0);
          const count = expenses.filter((e: any) => e.projectId === p.id).length;
          const pct = p.budget ? Math.min(100, (spent / p.budget) * 100) : 0;
          return (
            <div key={p.id} className={`stat-card group ${muted ? "opacity-70" : ""}`}>
              <div className="flex items-start justify-between">
                <div>
                  <Link to={`/projects/${p.id}`} className="font-display font-bold text-lg group-hover:text-primary transition">
                    {p.name}
                  </Link>
                  <div className="text-xs text-muted-foreground mt-0.5">{p.id} · {count} entries</div>
                </div>
                <Link to={`/projects/${p.id}`} className="w-8 h-8 rounded-md bg-muted flex items-center justify-center hover:bg-primary hover:text-primary-foreground transition">
                  <ArrowUpRight className="w-4 h-4" />
                </Link>
              </div>
              <div className="mt-4">
                <div className="text-xs text-muted-foreground uppercase tracking-wider">Spent</div>
                <div className="font-display font-bold text-2xl">${spent.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
              </div>
              {p.budget ? (
                <div className="mt-3">
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div className={`h-full ${pct > 90 ? "bg-primary" : pct > 70 ? "bg-warning" : "bg-success"}`} style={{ width: `${pct}%` }} />
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground mt-1">
                    <span>{pct.toFixed(0)}% used</span>
                    <span>of ${p.budget.toLocaleString()}</span>
                  </div>
                </div>
              ) : (
                <div className="text-xs text-muted-foreground mt-3">No budget set</div>
              )}
              {onArchive && (
                <button
                  onClick={() => onArchive(p.id)}
                  className="mt-4 text-xs text-muted-foreground hover:text-primary flex items-center gap-1"
                >
                  <Archive className="w-3 h-3" /> Mark complete
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
