import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import { Plus, Archive, ArrowUpRight, AlertTriangle, Trash2, Recycle } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useCreateProject, useDeleteProject, useExpenses, useIncomes, useProjects, useUpdateProject } from "@/lib/hooks";
import { calcProjectInsights } from "@/lib/insights";
import { toast } from "sonner";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export default function Projects() {
  const nav = useNavigate();
  const { data: projects = [] } = useProjects();
  const { data: expenses = [] } = useExpenses();
  const { data: incomes = [] } = useIncomes();
  const createProject = useCreateProject();
  const updateProject = useUpdateProject();
  const deleteProject = useDeleteProject();

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: "",
    client_name: "",
    address: "",
    start_date: new Date().toISOString().slice(0, 10),
    budget: "",
  });

  const submit = async () => {
    if (!form.name.trim()) return toast.error("Project name required");
    const created = await createProject.mutateAsync({
      name: form.name.trim(),
      client_name: form.client_name.trim() || null,
      address: form.address.trim() || null,
      start_date: form.start_date,
      budget: form.budget ? parseFloat(form.budget) : null,
      status: "active",
    });
    setOpen(false);
    setForm({ name: "", client_name: "", address: "", start_date: new Date().toISOString().slice(0, 10), budget: "" });
    if (created?.id) nav(`/projects/${created.id}`);
  };

  const active = projects.filter((p) => p.status === "active");
  const completed = projects.filter((p) => p.status === "completed");
  const archived = projects.filter((p) => p.status === "archived");

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
              <Field label="Project Name" required>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Riverside Tower" className="h-11" />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Client">
                  <Input value={form.client_name} onChange={(e) => setForm({ ...form, client_name: e.target.value })} className="h-11" />
                </Field>
                <Field label="Start Date">
                  <Input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} className="h-11" />
                </Field>
              </div>
              <Field label="Address">
                <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} className="h-11" />
              </Field>
              <Field label="Budget ($)">
                <Input type="number" inputMode="decimal" value={form.budget} onChange={(e) => setForm({ ...form, budget: e.target.value })} placeholder="Optional" className="h-11" />
              </Field>
            </div>
            <DialogFooter>
              <Button onClick={submit} disabled={createProject.isPending} className="bg-gradient-primary shadow-red w-full h-11">Create Project</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Section
        title="Active"
        projects={active}
        expenses={expenses}
        incomes={incomes}
        onComplete={(id) => updateProject.mutate({ id, status: "completed" })}
        onArchive={(id) => updateProject.mutate({ id, status: "archived" })}
        onDelete={(id) => deleteProject.mutate(id)}
        busy={updateProject.isPending || deleteProject.isPending}
      />
      {completed.length > 0 && (
        <Section
          title="Completed"
          projects={completed}
          expenses={expenses}
          incomes={incomes}
          muted
          onArchive={(id) => updateProject.mutate({ id, status: "archived" })}
          onDelete={(id) => deleteProject.mutate(id)}
          busy={updateProject.isPending || deleteProject.isPending}
        />
      )}

      {archived.length > 0 && (
        <Section
          title="Archived"
          projects={archived}
          expenses={expenses}
          incomes={incomes}
          muted
          onRestore={(id) => updateProject.mutate({ id, status: "active" })}
          onDelete={(id) => deleteProject.mutate(id)}
          busy={updateProject.isPending || deleteProject.isPending}
        />
      )}
    </div>
  );
}

function Section({
  title,
  projects,
  expenses,
  incomes,
  onComplete,
  onArchive,
  onRestore,
  onDelete,
  muted,
  busy,
}: any) {
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
          const ins = calcProjectInsights(p, expenses, incomes);
          const pct = ins.budgetUsedPct ?? 0;
          return (
            <div key={p.id} className={`stat-card group ${muted ? "opacity-70" : ""}`}>
              <div className="flex items-start justify-between">
                <div className="min-w-0">
                  <Link to={`/projects/${p.id}`} className="font-display font-bold text-lg group-hover:text-primary transition truncate block">
                    {p.name}
                  </Link>
                  <div className="text-xs text-muted-foreground mt-0.5 truncate">
                    {p.client_name ?? "No client"}{p.address ? ` · ${p.address}` : ""}
                  </div>
                </div>
                <Link to={`/projects/${p.id}`} className="w-8 h-8 rounded-md bg-muted flex items-center justify-center hover:bg-primary hover:text-primary-foreground transition shrink-0">
                  <ArrowUpRight className="w-4 h-4" />
                </Link>
              </div>
              <div className="grid grid-cols-3 gap-2 mt-4">
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Spent</div>
                  <div className="font-display font-bold text-base">${ins.totalSpent.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Income</div>
                  <div className="font-display font-bold text-base text-emerald-700">${ins.totalIncome.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Profit</div>
                  <div className={`font-display font-bold text-base ${ins.profit >= 0 ? "text-emerald-700" : "text-primary"}`}>
                    {ins.profit >= 0 ? "+" : "-"}${Math.abs(ins.profit).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </div>
                </div>
              </div>
              {p.budget && (
                <div className="mt-3">
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div className={`h-full ${pct > 90 ? "bg-primary" : pct > 70 ? "bg-warning" : "bg-success"}`} style={{ width: `${Math.min(100, pct)}%` }} />
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground mt-1">
                    <span>{pct.toFixed(0)}% used</span>
                    <span>of ${Number(p.budget).toLocaleString()}</span>
                  </div>
                </div>
              )}
              {ins.alerts.find((a) => a.level !== "info") && (
                <div className="mt-3 flex items-center gap-1.5 text-xs text-warning font-semibold">
                  <AlertTriangle className="w-3 h-3" /> {ins.alerts.find((a) => a.level !== "info")!.message}
                </div>
              )}
              {onArchive && (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {onComplete && (
                    <button
                      disabled={busy}
                      onClick={() => onComplete(p.id)}
                      className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1.5 px-2 py-1 rounded-lg hover:bg-muted transition disabled:opacity-50"
                    >
                      <Archive className="w-3.5 h-3.5" /> Mark complete
                    </button>
                  )}
                  {onArchive && (
                    <button
                      disabled={busy}
                      onClick={() => onArchive(p.id)}
                      className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1.5 px-2 py-1 rounded-lg hover:bg-muted transition disabled:opacity-50"
                    >
                      <Recycle className="w-3.5 h-3.5" /> Archive
                    </button>
                  )}
                  {onRestore && (
                    <button
                      disabled={busy}
                      onClick={() => onRestore(p.id)}
                      className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1.5 px-2 py-1 rounded-lg hover:bg-muted transition disabled:opacity-50"
                    >
                      <Recycle className="w-3.5 h-3.5" /> Restore
                    </button>
                  )}

                  {onDelete && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <button
                          disabled={busy}
                          className="text-xs text-primary hover:text-primary flex items-center gap-1.5 px-2 py-1 rounded-lg hover:bg-red-50 transition disabled:opacity-50 ml-auto"
                        >
                          <Trash2 className="w-3.5 h-3.5" /> Delete
                        </button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete project permanently?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will delete the project and all linked transactions (expenses/income) forever. This cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            onClick={() => onDelete(p.id)}
                          >
                            Delete forever
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <Label className="text-xs uppercase tracking-wider font-semibold">
        {label} {required && <span className="text-primary">*</span>}
      </Label>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}
