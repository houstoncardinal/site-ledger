import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Subscribes to realtime changes on every core table and invalidates the
 * matching React-Query caches. This keeps multiple devices / browser tabs in
 * perfect sync — any insert/update/delete on one client appears on all
 * others within a few hundred milliseconds.
 */
const TABLES = ["projects", "expenses", "incomes", "accounts", "vendors"] as const;

export function useRealtimeSync() {
  const qc = useQueryClient();

  useEffect(() => {
    const channel = supabase.channel("app-sync");

    for (const table of TABLES) {
      channel.on(
        "postgres_changes" as never,
        // @ts-ignore
        { event: "*", schema: "public", table },
        { event: "*", schema: "public", table },
        () => {
          // Invalidate the query that maps to this table plus any derived ones.
          qc.invalidateQueries({ queryKey: [table] });
          // Cross-table summaries (dashboard, analytics) — refresh anything
          // that depends on transactions.
          if (table === "expenses" || table === "incomes") {
            qc.invalidateQueries({ queryKey: ["transactions"] });
          }
        },
      );
    }

    channel.subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc]);
}
