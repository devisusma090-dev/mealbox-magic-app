import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Fee charged when a customer fully cancels a confirmed order. */
export const CANCELLATION_FEE = 20;

/**
 * Customer-side cancellation.
 * - mode "correct": the customer ordered by mistake and wants to re-order.
 *   The order is cancelled free of charge and its lines are returned so the
 *   app can refill the cart.
 * - mode "cancel": a full cancellation of a confirmed order, which carries a
 *   flat security fee to discourage fake orders.
 * Orders already out for delivery or completed can no longer be changed here.
 */
export const cancelMyOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; mode: "correct" | "cancel" }) => ({
    id: String(input.id ?? ""),
    mode: input.mode === "correct" ? ("correct" as const) : ("cancel" as const),
  }))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: order } = await supabaseAdmin
      .from("orders")
      .select("*")
      .eq("id", data.id)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!order) throw new Error("Order not found.");
    if (order.status === "cancelled") throw new Error("This order is already cancelled.");
    if (order.status !== "pending") {
      throw new Error("This order is already on its way — please call us instead.");
    }

    const fee = data.mode === "correct" ? 0 : CANCELLATION_FEE;

    const { error } = await supabaseAdmin
      .from("orders")
      .update({
        status: "cancelled",
        cancel_fee: fee,
        cancelled_by: "customer",
        cancel_reason: data.mode === "correct" ? "correction" : "customer_cancelled",
      })
      .eq("id", order.id);
    if (error) throw new Error(error.message);

    return {
      ok: true,
      fee,
      mode: data.mode,
      lines: (order.items ?? []) as unknown as {
        id: string;
        kind: "item" | "addon";
        name: string;
        price: number;
        qty: number;
        note?: string;
      }[],
    };
  });
