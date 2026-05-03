export type ProjectStatus = "active" | "completed" | "archived";

export type ExpenseCategory =
  | "labor"
  | "materials"
  | "equipment"
  | "subcontractor"
  | "cogs"
  | "operating"
  | "other";

export type PaymentStatus = "paid" | "unpaid" | "partial";
export type AccountType = "cash" | "bank" | "credit_card";
export type CheckStatus = "outstanding" | "cleared" | "voided";

export interface Check {
  id: string;
  check_number: string;
  payee: string;
  amount: number;
  date: string;
  memo: string | null;
  status: CheckStatus;
  cleared_date: string | null;
  project_id: string | null;
  account_id: string | null;
  category: ExpenseCategory | null;
  created_at: string;
  updated_at: string;
}

export const CHECK_STATUS_LABELS: Record<CheckStatus, string> = {
  outstanding: "Outstanding",
  cleared: "Cleared",
  voided: "Voided",
};

export interface Project {
  id: string;
  name: string;
  project_number: string | null;
  client_name: string | null;
  address: string | null;
  start_date: string;
  budget: number | null;
  status: ProjectStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Account {
  id: string;
  name: string;
  type: AccountType;
  starting_balance: number;
  is_active: boolean;
  created_at: string;
}

export interface Vendor {
  id: string;
  name: string;
  default_category: ExpenseCategory | null;
  created_at: string;
}

export interface Expense {
  id: string;
  project_id: string | null;
  account_id: string | null;
  date: string;
  category: ExpenseCategory;
  vendor: string;
  description: string | null;
  amount: number;
  payment_method: string | null;
  payment_status: PaymentStatus;
  due_date: string | null;
  receipt_url: string | null;
  notes: string | null;
  hours: number | null;
  rate: number | null;
  quantity: number | null;
  unit_price: number | null;
  created_at: string;
  updated_at: string;
}

export interface Income {
  id: string;
  project_id: string | null;
  account_id: string | null;
  date: string;
  client_name: string | null;
  description: string | null;
  invoice_number: string | null;
  amount: number;
  payment_status: PaymentStatus;
  due_date: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export const CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  labor: "Labor",
  materials: "Materials",
  equipment: "Equipment",
  subcontractor: "Subcontractor",
  cogs: "Cost of Goods",
  operating: "Operating",
  other: "Other",
};

export const CATEGORY_COLORS: Record<ExpenseCategory, string> = {
  labor: "hsl(38 92% 50%)",
  materials: "hsl(217 91% 55%)",
  equipment: "hsl(142 70% 40%)",
  subcontractor: "hsl(280 70% 55%)",
  cogs: "hsl(0 84% 50%)",
  operating: "hsl(190 80% 45%)",
  other: "hsl(0 0% 35%)",
};

export const PAYMENT_METHODS = [
  "Cash",
  "Credit Card",
  "Debit Card",
  "Check",
  "Bank Transfer",
  "ACH",
  "Other",
];

export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  cash: "Cash",
  bank: "Bank Account",
  credit_card: "Credit Card",
};
