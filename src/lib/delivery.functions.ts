import { createServerFn } from "@tanstack/react-start";
import { assertStaffPhone, completeByOtp, loadCashSummary, loadDeliveryQueue, loadPaymentSettings } from "./delivery.server";

export const deliveryQueue = createServerFn({ method: "POST" })
  .inputValidator((input: { phone: string }) => ({ phone: String(input.phone ?? "") }))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as never as { from: (t: string) => any };
    const phone = await assertStaffPhone(db, data.phone);
    const [orders, payment, summary] = await Promise.all([
      loadDeliveryQueue(db),
      loadPaymentSettings(db),
      loadCashSummary(db, phone),
    ]);
    return { phone, orders, payment, summary };
  });

export const deliveryMarkOut = createServerFn({ method: "POST" })
  .inputValidator((input: { phone: string; id: string }) => ({
    phone: String(input.phone ?? ""),
    id: String(input.id ?? ""),
  }))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as never as { from: (t: string) => any };
    const phone = await assertStaffPhone(db, data.phone);
    const { error } = await db
      .from("orders")
      .update({ status: "out_for_delivery", delivery_phone: phone })
      .eq("id", data.id)
      .eq("status", "pending");
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deliveryCompleteByOtp = createServerFn({ method: "POST" })
  .inputValidator((input: { phone: string; otp: string; paymentMethod?: "cash" | "upi" }) => ({
    phone: String(input.phone ?? ""),
    otp: String(input.otp ?? "").replace(/\D/g, "").slice(0, 4),
    paymentMethod: input.paymentMethod === "upi" ? ("upi" as const) : ("cash" as const),
  }))
  .handler(async ({ data }) => {
    if (data.otp.length !== 4) throw new Error("Enter the customer's 4-digit OTP.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as never as { from: (t: string) => any };
    const phone = await assertStaffPhone(db, data.phone);
    return completeByOtp(db, data.otp, phone, data.paymentMethod);
  });
