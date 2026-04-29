import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { queueRead, queueRemove } from "@/lib/offlineQueue";
import { expensesApi, incomesApi, vendorsApi } from "@/lib/api";
import { toast } from "sonner";
import type { Expense, Income } from "@/lib/types";

export function useOfflineSync() {
  const qc = useQueryClient();
  const [pendingCount, setPendingCount] = useState(() => queueRead().length);
  const syncing = useRef(false);

  const refreshCount = () => setPendingCount(queueRead().length);

  const flush = async () => {
    if (syncing.current || !navigator.onLine) return;
    const ops = queueRead();
    if (!ops.length) return;
    syncing.current = true;
    let synced = 0;
    for (const op of ops) {
      try {
        if (op.type === "expense") {
          const e = op.payload as Partial<Expense>;
          await expensesApi.create(e);
          if (e.vendor) await vendorsApi.upsert(e.vendor, e.category);
        } else {
          await incomesApi.create(op.payload as Partial<Income>);
        }
        queueRemove(op.id);
        synced++;
      } catch {
        // leave failed ops in queue for next retry
      }
    }
    syncing.current = false;
    refreshCount();
    if (synced > 0) {
      qc.invalidateQueries({ queryKey: ["expenses"] });
      qc.invalidateQueries({ queryKey: ["incomes"] });
      qc.invalidateQueries({ queryKey: ["vendors"] });
      toast.success(`${synced} offline entr${synced === 1 ? "y" : "ies"} synced`);
    }
  };

  useEffect(() => {
    const handleOnline = () => flush();
    window.addEventListener("online", handleOnline);
    // also try on mount in case we were offline before
    flush();
    return () => window.removeEventListener("online", handleOnline);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Storage events from other tabs
  useEffect(() => {
    const handler = () => refreshCount();
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, []);

  return { pendingCount, flush, refreshCount };
}

export function useIsOnline() {
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, []);
  return online;
}
