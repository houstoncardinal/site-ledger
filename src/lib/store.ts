import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Expense, Project } from "./types";

interface State {
  projects: Project[];
  expenses: Expense[];
  addProject: (p: Omit<Project, "id" | "createdAt">) => Project;
  updateProject: (id: string, p: Partial<Project>) => void;
  archiveProject: (id: string) => void;
  addExpense: (e: Omit<Expense, "id" | "createdAt" | "projectName">) => Expense | null;
  deleteExpense: (id: string) => void;
}

const uid = () => Math.random().toString(36).slice(2, 10).toUpperCase();

export const useStore = create<State>()(
  persist(
    (set, get) => ({
      projects: [],
      expenses: [],
      addProject: (p) => {
        const project: Project = {
          ...p,
          id: "PRJ-" + uid(),
          createdAt: new Date().toISOString(),
        };
        set((s) => ({ projects: [project, ...s.projects] }));
        return project;
      },
      updateProject: (id, p) =>
        set((s) => ({
          projects: s.projects.map((x) => (x.id === id ? { ...x, ...p } : x)),
          expenses: s.expenses.map((e) =>
            e.projectId === id && p.name ? { ...e, projectName: p.name } : e
          ),
        })),
      archiveProject: (id) =>
        set((s) => ({
          projects: s.projects.map((x) =>
            x.id === id ? { ...x, status: "completed" } : x
          ),
        })),
      addExpense: (e) => {
        const project = get().projects.find((p) => p.id === e.projectId);
        if (!project) return null;
        // dedupe: same project, amount, date, vendor within 3s
        const now = Date.now();
        const dup = get().expenses.find(
          (x) =>
            x.projectId === e.projectId &&
            x.amount === e.amount &&
            x.date === e.date &&
            x.vendor === e.vendor &&
            now - new Date(x.createdAt).getTime() < 3000
        );
        if (dup) return dup;
        const expense: Expense = {
          ...e,
          id: "EXP-" + uid(),
          projectName: project.name,
          createdAt: new Date().toISOString(),
        };
        set((s) => ({ expenses: [expense, ...s.expenses] }));
        return expense;
      },
      deleteExpense: (id) =>
        set((s) => ({ expenses: s.expenses.filter((e) => e.id !== id) })),
    }),
    { name: "buildledger-store-v1" }
  )
);

// Seed once for demo feel
export const seedIfEmpty = () => {
  const s = useStore.getState();
  if (s.projects.length > 0) return;
  const p1 = s.addProject({
    name: "Riverside Office Tower",
    startDate: new Date(Date.now() - 60 * 86400000).toISOString().slice(0, 10),
    budget: 850000,
    status: "active",
  });
  const p2 = s.addProject({
    name: "Maple St Residential",
    startDate: new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10),
    budget: 320000,
    status: "active",
  });
  const vendors = ["Home Depot", "Sunbelt Rentals", "Acme Lumber", "Crew Payroll", "Steel Co"];
  const types = ["materials", "equipment", "labor", "expense", "other"] as const;
  for (let i = 0; i < 28; i++) {
    const proj = i % 2 === 0 ? p1 : p2;
    const type = types[i % types.length];
    const daysAgo = Math.floor(Math.random() * 55);
    s.addExpense({
      projectId: proj.id,
      date: new Date(Date.now() - daysAgo * 86400000).toISOString().slice(0, 10),
      type,
      vendor: vendors[i % vendors.length],
      description:
        type === "labor"
          ? "Crew hours"
          : type === "materials"
          ? "Lumber & fasteners"
          : type === "equipment"
          ? "Equipment rental"
          : "Site expense",
      amount: Math.round((500 + Math.random() * 4500) * 100) / 100,
      paymentMethod: ["Credit Card", "Check", "ACH"][i % 3],
      notes: "",
    });
  }
};
