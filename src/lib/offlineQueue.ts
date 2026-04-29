import type { Expense, Income } from "./types";

export type QueuedOp =
  | { type: "expense"; payload: Partial<Expense>; id: string; ts: number }
  | { type: "income"; payload: Partial<Income>; id: string; ts: number };

const KEY = "sl_offline_queue";

export function queueRead(): QueuedOp[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]");
  } catch {
    return [];
  }
}

export function queueAdd(op: Omit<QueuedOp, "id" | "ts">) {
  const ops = queueRead();
  ops.push({ ...op, id: crypto.randomUUID(), ts: Date.now() } as QueuedOp);
  localStorage.setItem(KEY, JSON.stringify(ops));
}

export function queueRemove(id: string) {
  const ops = queueRead().filter((o) => o.id !== id);
  localStorage.setItem(KEY, JSON.stringify(ops));
}

export function queueClear() {
  localStorage.removeItem(KEY);
}
