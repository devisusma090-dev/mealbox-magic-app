import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { buildAndInsertOrder, validatePlaceOrderInput, type PlaceOrderInput } from "./orders.server";

export const placeOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: PlaceOrderInput) => validatePlaceOrderInput(input))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const order = await buildAndInsertOrder(supabaseAdmin as never, context.userId, data);
    return order;
  });

export const previewCoupon = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { code: string; subtotal: number }) => ({
    code: String(input.code ?? "").trim().toUpperCase(),
    subtotal: Number(input.subtotal ?? 0),
  }))
  .handler(async ({ data, context }) => {
    const { data: coupon } = await context.supabase.from("coupons").select("*").eq("code", data.code).maybeSingle();
    if (!coupon || !coupon.active || coupon.used) throw new Error("Invalid or expired coupon code.");
    if (coupon.owner_user_id && coupon.owner_user_id !== context.userId) throw new Error("This coupon belongs to another account.");
    if (data.subtotal < Number(coupon.min_order)) throw new Error(`Coupon needs a minimum order of ₹${coupon.min_order}.`);
    const discount = Math.min(
      Number(coupon.discount_amount) + (data.subtotal * Number(coupon.discount_percent)) / 100,
      data.subtotal,
    );
    return { code: coupon.code, discount };
  });

export const applyReferralCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { code: string }) => ({ code: String(input.code ?? "").trim().toUpperCase() }))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: me } = await supabaseAdmin.from("profiles").select("*").eq("id", context.userId).maybeSingle();
    if (!me) throw new Error("Profile not found.");
    if (me.referred_by) throw new Error("A referral code is already applied to your account.");
    if (me.referral_code === data.code) throw new Error("You cannot use your own referral code.");

    // Referral rewards are for genuinely NEW customers only.
    const { count } = await supabaseAdmin
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("user_id", context.userId);
    if ((count ?? 0) > 0) {
      throw new Error("Referral codes can only be applied before your first order.");
    }

    const { data: referrer } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("referral_code", data.code)
      .maybeSingle();
    if (!referrer) throw new Error("Referral code not found.");

    const { error } = await supabaseAdmin.from("profiles").update({ referred_by: referrer.id }).eq("id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
