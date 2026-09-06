import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ChevronUp, CookingPot, Truck, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useCart } from "@/lib/cart";
import { rupees, type CartLine, type OrderRow } from "@/lib/menu-types";
import { cancelMyOrder, CANCELLATION_FEE } from "@/lib/customer-orders.functions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

/** Orders the customer is still waiting for. */
export function useActiveOrders() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["active-orders", user?.id],
    enabled: !!user,
    refetchInterval: 15000,
    refetchOnWindowFocus: true,
    queryFn: async () => {
      const { data } = await supabase
        .from("orders")
        .select("*")
        .in("status", ["pending", "out_for_delivery"])
        .order("created_at", { ascending: false });
      return (data ?? []) as unknown as OrderRow[];
    },
  });
}

/**
 * Sticky "Active Order Status" bar. It stays visible on every customer screen
 * so going back to the menu ("Order more") never hides an ongoing order.
 */
export function ActiveOrderBar({ offsetBottom = false }: { offsetBottom?: boolean }) {
  const { data: orders } = useActiveOrders();
  const [open, setOpen] = useState(false);

  if (!orders || orders.length === 0) return null;
  const latest = orders[0]!;

  return (
    <div
      className={`fixed inset-x-0 z-50 px-3 ${offsetBottom ? "bottom-[5.5rem]" : "bottom-3"}`}
      role="status"
      aria-live="polite"
    >
      <div className="mx-auto max-w-5xl overflow-hidden rounded-2xl border border-primary/30 bg-card/95 shadow-[var(--shadow-lift)] backdrop-blur">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex w-full items-center gap-3 px-4 py-3 text-left"
        >
          {latest.status === "out_for_delivery" ? (
            <Truck className="size-5 shrink-0 text-primary" />
          ) : (
            <CookingPot className="size-5 shrink-0 text-primary" />
          )}
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold">
              {orders.length > 1 ? `${orders.length} active orders` : "Your order is on the way"}
            </span>
            <span className="block truncate text-xs text-muted-foreground">
              {latest.status === "out_for_delivery" ? "Out for delivery" : "Preparing in the kitchen"} ·{" "}
              {rupees(latest.total)} · OTP {latest.delivery_otp}
            </span>
          </span>
          <ChevronUp className={`size-4 shrink-0 transition-transform ${open ? "" : "rotate-180"}`} />
        </button>

        {open && (
          <div className="max-h-[50vh] space-y-3 overflow-y-auto border-t border-border p-4">
            {orders.map((o) => (
              <ActiveOrderCard key={o.id} order={o} />
            ))}
            <Button asChild variant="outline" size="sm" className="w-full">
              <Link to="/orders">See all my orders</Link>
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function ActiveOrderCard({ order }: { order: OrderRow }) {
  const qc = useQueryClient();
  const cart = useCart();
  const runCancel = useServerFn(cancelMyOrder);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);

  const act = async (mode: "correct" | "cancel") => {
    setBusy(true);
    try {
      const res = await runCancel({ data: { id: order.id, mode } });
      if (mode === "correct") {
        cart.clear();
        for (const l of res.lines) {
          cart.add({ id: l.id, kind: l.kind, name: l.name, price: Number(l.price), note: l.note ?? "" }, l.qty);
        }
        toast.success("Order cancelled free of charge — edit your cart and re-order.");
      } else {
        toast.success(`Order cancelled. A ${rupees(CANCELLATION_FEE)} cancellation fee applies.`);
      }
      qc.invalidateQueries({ queryKey: ["active-orders"] });
      qc.invalidateQueries({ queryKey: ["my-data"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update the order");
    } finally {
      setBusy(false);
      setConfirm(false);
    }
  };

  return (
    <div className="rounded-xl border border-border p-3">
      <div className="flex items-center justify-between gap-2">
        <Badge variant={order.status === "out_for_delivery" ? "default" : "secondary"}>
          {order.status === "out_for_delivery" ? "Out for delivery" : "Preparing"}
        </Badge>
        <span className="text-sm font-semibold">{rupees(order.total)}</span>
      </div>
      <ul className="mt-2 text-xs text-muted-foreground">
        {(order.items as CartLine[]).map((l) => (
          <li key={l.key}>
            {l.qty} × {l.name}
            {l.note ? ` — ${l.note}` : ""}
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs">
        Delivery OTP: <strong className="font-mono tracking-widest">{order.delivery_otp}</strong>
      </p>

      {order.status === "pending" && (
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Button size="sm" variant="outline" disabled={busy} onClick={() => act("correct")}>
            Change order · free
          </Button>
          <Button size="sm" variant="ghost" className="text-destructive" disabled={busy} onClick={() => setConfirm(true)}>
            <X className="size-4" /> Cancel · {rupees(CANCELLATION_FEE)}
          </Button>
        </div>
      )}

      <AlertDialog open={confirm} onOpenChange={setConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel this order?</AlertDialogTitle>
            <AlertDialogDescription>
              A {rupees(CANCELLATION_FEE)} security fee is charged for fully cancelling a confirmed order. If you only
              want to change what you ordered, close this and choose “Change order · free” instead.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep my order</AlertDialogCancel>
            <AlertDialogAction disabled={busy} onClick={() => act("cancel")}>
              Cancel and pay {rupees(CANCELLATION_FEE)}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
