export type ProjectStatus = "active" | "completed";

export type ExpenseType = "labor" | "materials" | "equipment" | "expense" | "other";

export interface Project {
  id: string;
  name: string;
  startDate: string;
  budget?: number;
  status: ProjectStatus;
  createdAt: string;
}

export interface Expense {
  id: string;
  projectId: string;
  projectName: string;
  date: string;
  type: ExpenseType;
  vendor: string;
  description: string;
  amount: number;
  paymentMethod: string;
  receiptUrl?: string;
  notes?: string;
  // type-specific
  hours?: number;
  rate?: number;
  quantity?: number;
  unitPrice?: number;
  createdAt: string;
}

export const EXPENSE_LABELS: Record<ExpenseType, string> = {
  expense: "Expense",
  labor: "Labor",
  materials: "Materials",
  equipment: "Equipment",
  other: "Other Cost",
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
