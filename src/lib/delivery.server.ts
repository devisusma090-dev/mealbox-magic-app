import { rewardReferrerIfFirstOrder } from "./orders.server";

export function normalizePhone(phone: string) {
  return String(phone ?? "").replace(/\D/g, "").slice(-10);
}

type Db = { from: (t: string) => any };

export async function assertStaffPhone(db: Db, phone: string) {
  const p = normalizePhone(phone);
  if (p.length !== 10) throw new Error("Enter a valid 10-digit phone number.");
  const { data: settings } = await db.from("settings").select("delivery_staff_phones").eq("id", 1).single();
  const allow = String(settings?.delivery_staff_phones ?? "")
    .split(/[,\s]+/)
    .map(normalizePhone)
    .filter((x: string) => x.length === 10);
  if (allow.length > 0 && !allow.includes(p)) {
    throw new Error("This number is not registered as delivery staff.");
  }
  return p;
}

export async function loadPaymentSettings(db: Db) {
  const { data } = await db.from("settings").select("upi_id,upi_qr_url").eq("id", 1).single();
  return { upi_id: (data?.upi_id ?? "") as string, upi_qr_url: (data?.upi_qr_url ?? null) as string | null };
}

export async function loadDeliveryQueue(db: Db) {
  const { data } = await db
    .from("orders")
    .select("id,mode,tower,flat,address,table_no,customer_name,phone,items,total,status,created_at,delivery_phone,lat,lng,payment_method,paid")
    .in("status", ["pending", "out_for_delivery"])
    .order("created_at", { ascending: false })
    .limit(60);
  return (data ?? []) as any[];
}

export async function completeByOtp(db: Db, otp: string, staffPhone: string, paymentMethod?: "cash" | "upi") {
  const { data: order } = await db
    .from("orders")
    .select("*")
    .eq("delivery_otp", otp)
    .in("status", ["pending", "out_for_delivery"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!order) throw new Error("No active order found with that OTP.");
  const { error } = await db
    .from("orders")
    .update({
      status: "completed",
      completed_at: new Date().toISOString(),
      delivery_phone: staffPhone,
      ...(paymentMethod ? { payment_method: paymentMethod, paid: true } : {}),
    })
    .eq("id", order.id);
  if (error) throw new Error(error.message);
  if (order.user_id) await rewardReferrerIfFirstOrder(db as never, order.user_id);
  return { id: order.id as string, total: Number(order.total), payment_method: paymentMethod ?? (order.payment_method as string) };
}
