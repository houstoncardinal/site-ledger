import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { accountsApi, checksApi, expensesApi, incomesApi, projectsApi, vendorsApi } from "./api";
import { toast } from "sonner";
import type { Check, Expense, Income, Project, Account, Vendor } from "./types";
import { queueAdd } from "./offlineQueue";

export const useChecks = () =>
  useQuery({ queryKey: ["checks"], queryFn: checksApi.list });

export const useCreateCheck = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (c: Partial<Check>) => checksApi.create(c),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["checks"] }); toast.success("Check recorded"); },
    onError: (e: any) => toast.error(e.message),
  });
};

export const useUpdateCheck = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...c }: Partial<Check> & { id: string }) => checksApi.update(id, c),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["checks"] }); toast.success("Check updated"); },
    onError: (e: any) => toast.error(e.message),
  });
};

export const useDeleteCheck = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => checksApi.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["checks"] }); toast.success("Check deleted"); },
    onError: (e: any) => toast.error(e.message),
  });
};

export const useProjects = () =>
  useQuery({ queryKey: ["projects"], queryFn: projectsApi.list });

export const useProject = (id?: string) =>
  useQuery({ queryKey: ["projects", id], queryFn: () => projectsApi.get(id!), enabled: !!id });

export const useExpenses = () =>
  useQuery({ queryKey: ["expenses"], queryFn: expensesApi.list });

export const useIncomes = () =>
  useQuery({ queryKey: ["incomes"], queryFn: incomesApi.list });

export const useAccounts = () =>
  useQuery({ queryKey: ["accounts"], queryFn: accountsApi.list });

export const useVendors = () =>
  useQuery({ queryKey: ["vendors"], queryFn: vendorsApi.list });

const invalidate = (qc: ReturnType<typeof useQueryClient>, ...keys: string[]) =>
  keys.forEach((k) => qc.invalidateQueries({ queryKey: [k] }));

export const useUpdateVendor = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...v }: Partial<Vendor> & { id: string }) => vendorsApi.update(id, v),
    onSuccess: () => {
      invalidate(qc, "vendors");
      toast.success("Vendor updated");
    },
    onError: (e: any) => toast.error(e.message),
  });
};

export const useDeleteVendor = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => vendorsApi.delete(id),
    onSuccess: () => {
      invalidate(qc, "vendors");
      toast.success("Vendor deleted");
    },
    onError: (e: any) => toast.error(e.message),
  });
};

export const useCreateProject = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (p: Partial<Project>) => projectsApi.create(p),
    onSuccess: () => { invalidate(qc, "projects"); toast.success("Project created"); },
    onError: (e: any) => toast.error(e.message),
  });
};

export const useUpdateProject = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...p }: Partial<Project> & { id: string }) => projectsApi.update(id, p),
    onSuccess: () => invalidate(qc, "projects"),
    onError: (e: any) => toast.error(e.message),
  });
};

export const useDeleteProject = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => projectsApi.delete(id),
    onSuccess: () => {
      invalidate(qc, "projects");
      toast.success("Project deleted");
    },
    onError: (e: any) => toast.error(e.message),
  });
};

export const useCreateExpense = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (e: Partial<Expense> & { _vendorCategory?: string }) => {
      const { _vendorCategory, ...rest } = e;
      if (!navigator.onLine) {
        queueAdd({ type: "expense", payload: rest });
        return null;
      }
      const res = await expensesApi.create(rest);
      if (e.vendor) {
        await vendorsApi.upsert(e.vendor, _vendorCategory ?? e.category);
      }
      return res;
    },
    onSuccess: (res) => {
      invalidate(qc, "expenses", "vendors");
      toast.success(res ? "Expense logged" : "Saved offline — will sync when connected");
    },
    onError: (e: any) => toast.error(e.message),
  });
};

export const useUpdateExpense = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...e }: Partial<Expense> & { id: string }) => expensesApi.update(id, e),
    onSuccess: () => invalidate(qc, "expenses"),
    onError: (e: any) => toast.error(e.message),
  });
};

export const useDeleteExpense = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => expensesApi.delete(id),
    onSuccess: () => { invalidate(qc, "expenses"); toast.success("Deleted"); },
    onError: (e: any) => toast.error(e.message),
  });
};

export const useCreateIncome = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (i: Partial<Income>) => {
      if (!navigator.onLine) {
        queueAdd({ type: "income", payload: i });
        return null;
      }
      return incomesApi.create(i);
    },
    onSuccess: (res) => {
      invalidate(qc, "incomes");
      toast.success(res ? "Income recorded" : "Saved offline — will sync when connected");
    },
    onError: (e: any) => toast.error(e.message),
  });
};

export const useUpdateIncome = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...i }: Partial<Income> & { id: string }) => incomesApi.update(id, i),
    onSuccess: () => invalidate(qc, "incomes"),
    onError: (e: any) => toast.error(e.message),
  });
};

export const useDeleteIncome = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => incomesApi.delete(id),
    onSuccess: () => { invalidate(qc, "incomes"); toast.success("Deleted"); },
    onError: (e: any) => toast.error(e.message),
  });
};

export const useCreateAccount = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (a: Partial<Account>) => accountsApi.create(a),
    onSuccess: () => { invalidate(qc, "accounts"); toast.success("Account added"); },
    onError: (e: any) => toast.error(e.message),
  });
};
