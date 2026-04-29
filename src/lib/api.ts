import { supabase } from "@/integrations/supabase/client";
import type {
  Account, Expense, Income, Project, Vendor,
} from "./types";

// ---------- Projects ----------
export const projectsApi = {
  list: async (): Promise<Project[]> => {
    const { data, error } = await supabase
      .from("projects")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []) as Project[];
  },
  get: async (id: string): Promise<Project | null> => {
    const { data, error } = await supabase.from("projects").select("*").eq("id", id).maybeSingle();
    if (error) throw error;
    return data as Project | null;
  },
  create: async (p: Partial<Project>) => {
    const { data, error } = await supabase.from("projects").insert(p as any).select().single();
    if (error) throw error;
    return data as Project;
  },
  update: async (id: string, p: Partial<Project>) => {
    const { data, error } = await supabase.from("projects").update(p as any).eq("id", id).select().single();
    if (error) throw error;
    return data as Project;
  },
  delete: async (id: string) => {
    const { error } = await supabase.from("projects").delete().eq("id", id);
    if (error) throw error;
  },
};

// ---------- Expenses ----------
export const expensesApi = {
  list: async (): Promise<Expense[]> => {
    const { data, error } = await supabase
      .from("expenses")
      .select("*")
      .order("date", { ascending: false })
      .limit(1000);
    if (error) throw error;
    return (data ?? []) as Expense[];
  },
  create: async (e: Partial<Expense>) => {
    const { data, error } = await supabase.from("expenses").insert(e as any).select().single();
    if (error) throw error;
    return data as Expense;
  },
  update: async (id: string, e: Partial<Expense>) => {
    const { data, error } = await supabase.from("expenses").update(e as any).eq("id", id).select().single();
    if (error) throw error;
    return data as Expense;
  },
  delete: async (id: string) => {
    const { error } = await supabase.from("expenses").delete().eq("id", id);
    if (error) throw error;
  },
};

// ---------- Incomes ----------
export const incomesApi = {
  list: async (): Promise<Income[]> => {
    const { data, error } = await supabase
      .from("incomes")
      .select("*")
      .order("date", { ascending: false })
      .limit(1000);
    if (error) throw error;
    return (data ?? []) as Income[];
  },
  create: async (i: Partial<Income>) => {
    const { data, error } = await supabase.from("incomes").insert(i as any).select().single();
    if (error) throw error;
    return data as Income;
  },
  update: async (id: string, i: Partial<Income>) => {
    const { data, error } = await supabase.from("incomes").update(i as any).eq("id", id).select().single();
    if (error) throw error;
    return data as Income;
  },
  delete: async (id: string) => {
    const { error } = await supabase.from("incomes").delete().eq("id", id);
    if (error) throw error;
  },
};

// ---------- Accounts ----------
export const accountsApi = {
  list: async (): Promise<Account[]> => {
    const { data, error } = await supabase
      .from("accounts")
      .select("*")
      .order("created_at", { ascending: true });
    if (error) throw error;
    return (data ?? []) as Account[];
  },
  create: async (a: Partial<Account>) => {
    const { data, error } = await supabase.from("accounts").insert(a as any).select().single();
    if (error) throw error;
    return data as Account;
  },
  delete: async (id: string) => {
    const { error } = await supabase.from("accounts").delete().eq("id", id);
    if (error) throw error;
  },
};

// ---------- Vendors (smart autofill) ----------
export const vendorsApi = {
  list: async (): Promise<Vendor[]> => {
    const { data, error } = await supabase.from("vendors").select("*").order("name");
    if (error) throw error;
    return (data ?? []) as Vendor[];
  },
  upsert: async (name: string, default_category?: string) => {
    const { error } = await supabase
      .from("vendors")
      .upsert({ name, default_category: default_category ?? null } as any, { onConflict: "name" });
    if (error) throw error;
  },
};

// ---------- Receipts (storage) ----------
export const receiptsApi = {
  upload: async (file: File): Promise<string> => {
    const ext = file.name.split(".").pop() ?? "jpg";
    const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error } = await supabase.storage.from("receipts").upload(path, file, {
      contentType: file.type,
      upsert: false,
    });
    if (error) throw error;
    const { data } = supabase.storage.from("receipts").getPublicUrl(path);
    return data.publicUrl;
  },
};
