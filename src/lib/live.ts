import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type OrderEvent = {
  id: string;
  order_id: string;
  kind: "new" | "status" | string;
  status: string;
  mode: string | null;
  created_at: string;
};

/**
 * Subscribes to the PII-free public `order_events` feed so Admin, Delivery and
 * Chef screens update the instant an order is created or changes status.
 */
export function useOrderEvents(onEvent: (event: OrderEvent) => void, enabled = true) {
  const handler = useRef(onEvent);
  handler.current = onEvent;

  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;
    const channel = supabase
      .channel(`order-events-${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "order_events" },
        (payload) => handler.current(payload.new as OrderEvent),
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [enabled]);
}

/**
 * Keeps the customer menu and store settings in sync with admin edits in real
 * time — a photo, price or availability change appears without a reload.
 */
export function useMenuRealtime() {
  const qc = useQueryClient();

  useEffect(() => {
    if (typeof window === "undefined") return;
    const invalidate = () => {
      void qc.invalidateQueries({ queryKey: ["menu"] });
      void qc.invalidateQueries({ queryKey: ["settings"] });
    };
    const channel = supabase
      .channel(`store-live-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "menu_items" }, invalidate)
      .on("postgres_changes", { event: "*", schema: "public", table: "categories" }, invalidate)
      .on("postgres_changes", { event: "*", schema: "public", table: "addons" }, invalidate)
      .on("postgres_changes", { event: "*", schema: "public", table: "settings" }, invalidate)
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [qc]);
}
