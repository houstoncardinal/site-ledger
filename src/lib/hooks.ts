import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { accountsApi, expensesApi, incomesApi, projectsApi, vendorsApi } from "./api";
import { toast } from "sonner";
import type { Expense, Income, Project, Account } from "./types";

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

export const useCreateExpense = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (e: Partial<Expense> & { _vendorCategory?: string }) => {
      const { _vendorCategory, ...rest } = e;
      const res = await expensesApi.create(rest);
      // remember vendor for autofill
      if (e.vendor) {
        await vendorsApi.upsert(e.vendor, _vendorCategory ?? e.category);
      }
      return res;
    },
    onSuccess: () => { invalidate(qc, "expenses", "vendors"); toast.success("Expense logged"); },
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
    mutationFn: (i: Partial<Income>) => incomesApi.create(i),
    onSuccess: () => { invalidate(qc, "incomes"); toast.success("Income recorded"); },
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
