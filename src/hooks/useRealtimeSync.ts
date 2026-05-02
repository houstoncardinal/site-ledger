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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (channel as any).on(
        "postgres_changes",
        { event: "*", schema: "public", table },
        () => {
          qc.invalidateQueries({ queryKey: [table] });
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
