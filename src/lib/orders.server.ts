import { randomOtp } from "./admin.server";

export type PlaceOrderInput = {
  mode: "table" | "direct" | "eden";
  tableNo?: string;
  tower?: string;
  flat?: string;
  phone?: string;
  name?: string;
  address?: string;
  couponCode?: string;
  paymentMethod?: "cod" | "upi";
  deliverySlot?: string;
  lat?: number | null;
  lng?: number | null;
  lines: { id: string; kind: "item" | "addon"; qty: number; note?: string }[];
};

export function validatePlaceOrderInput(input: PlaceOrderInput): PlaceOrderInput {
  if (!input || !Array.isArray(input.lines) || input.lines.length === 0) {
    throw new Error("Your cart is empty.");
  }
  if (!["table", "direct", "eden"].includes(input.mode)) throw new Error("Invalid delivery mode.");
  if (input.mode === "table" && !input.tableNo) throw new Error("Table number is required.");
  if (input.mode === "eden" && (!input.tower || !input.flat || !input.phone)) {
    throw new Error("Tower, flat and phone are required for Eden Court doorstep delivery.");
  }
  if (input.mode === "direct" && (!input.phone || !input.address)) {
    throw new Error("Phone and address are required for direct delivery.");
  }
  const paymentMethod: "cod" | "upi" = input.paymentMethod === "upi" ? "upi" : "cod";
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
  return {
    ...input,
    paymentMethod,
    deliverySlot: String(input.deliverySlot ?? "").trim().slice(0, 40),
    lat: num(input.lat),
    lng: num(input.lng),
    lines: input.lines
      .filter((l) => l && l.id && l.qty > 0)
      .map((l) => ({ id: l.id, kind: l.kind === "addon" ? "addon" : "item", qty: Math.min(50, Math.floor(l.qty)), note: (l.note ?? "").slice(0, 300) })),
  };
}

type Db = {
  from: (t: string) => any;
};

export async function buildAndInsertOrder(db: Db, userId: string, input: PlaceOrderInput) {
  const { data: settings } = await db.from("settings").select("*").eq("id", 1).single();
  if (!settings) throw new Error("Store settings unavailable.");
  if (!settings.restaurant_open) throw new Error(settings.offline_reason || "Restaurant is currently closed.");
  if (input.mode === "direct" && settings.direct_delivery_enabled === false) {
    throw new Error(settings.direct_offline_reason || "Direct delivery is paused right now.");
  }
  if (input.mode === "eden" && settings.eden_enabled === false) {
    throw new Error(settings.eden_offline_reason || "Eden Court delivery is paused right now.");
  }

  const itemIds = input.lines.filter((l) => l.kind === "item").map((l) => l.id);
  const addonIds = input.lines.filter((l) => l.kind === "addon").map((l) => l.id);

  const [{ data: items }, { data: addons }] = await Promise.all([
    itemIds.length ? db.from("menu_items").select("id,name,price,available").in("id", itemIds) : Promise.resolve({ data: [] }),
    addonIds.length ? db.from("addons").select("id,name,price,available").in("id", addonIds) : Promise.resolve({ data: [] }),
  ]);

  const priced = input.lines.map((line) => {
    const src = (line.kind === "item" ? items : addons)?.find((r: any) => r.id === line.id);
    if (!src) throw new Error("An item in your cart is no longer available.");
    if (!src.available) throw new Error(`${src.name} is currently unavailable.`);
    return {
      key: `${line.kind}:${line.id}`,
      id: line.id,
      kind: line.kind,
      name: src.name as string,
      price: Number(src.price),
      qty: line.qty,
      note: line.note ?? "",
    };
  });

  const subtotal = priced.reduce((sum, l) => sum + l.price * l.qty, 0);
  const deliveryFee = input.mode === "direct" ? Number(settings.delivery_fee) : 0;

  let discount = 0;
  let couponCode: string | null = null;
  if (input.couponCode) {
    const code = input.couponCode.trim().toUpperCase();
    const { data: coupon } = await db.from("coupons").select("*").eq("code", code).maybeSingle();
    if (!coupon || !coupon.active || coupon.used) throw new Error("Invalid or expired coupon code.");
    if (coupon.owner_user_id && coupon.owner_user_id !== userId) throw new Error("This coupon belongs to another account.");
    if (subtotal < Number(coupon.min_order)) throw new Error(`Coupon needs a minimum order of ₹${coupon.min_order}.`);
    discount = Number(coupon.discount_amount) + (subtotal * Number(coupon.discount_percent)) / 100;
    discount = Math.min(discount, subtotal);
    couponCode = code;
    if (coupon.owner_user_id) await db.from("coupons").update({ used: true, active: false }).eq("id", coupon.id);
  }

  const total = Math.max(0, subtotal + deliveryFee - discount);
  const otp = randomOtp();

  const { data: order, error } = await db
    .from("orders")
    .insert({
      user_id: userId,
      customer_name: input.name ?? null,
      phone: input.phone ?? null,
      mode: input.mode,
      table_no: input.mode === "table" ? input.tableNo : null,
      tower: input.mode === "eden" ? input.tower : null,
      flat: input.mode === "eden" ? input.flat : null,
      address: input.mode === "direct" ? input.address : null,
      items: priced,
      subtotal,
      delivery_fee: deliveryFee,
      discount,
      total,
      coupon_code: couponCode,
      delivery_otp: otp,
      lat: input.lat ?? null,
      lng: input.lng ?? null,
      delivery_slot: input.deliverySlot ? input.deliverySlot : null,
      payment_method: input.paymentMethod ?? "cod",
      paid: input.paymentMethod === "upi",
      status: "pending",
    })
    .select("*")
    .single();

  if (error) throw new Error(error.message);

  const chefAlerts = await buildChefAlerts(db, order, priced);
  const alertsSent = await dispatchChefAlerts(chefAlerts);
  return { ...order, chefAlerts, alertsSent };
}

export type ChefAlert = { category: string; phone: string; text: string };

async function buildChefAlerts(db: Db, order: any, priced: { id: string; kind: string; name: string; qty: number; note: string }[]) {
  const itemIds = priced.filter((l) => l.kind === "item").map((l) => l.id);
  if (itemIds.length === 0) return [] as ChefAlert[];

  const [{ data: menuRows }, { data: categories }] = await Promise.all([
    db.from("menu_items").select("id,category_id").in("id", itemIds),
    db.from("categories").select("id,name,chef_phone"),
  ]);

  const categoryOf = new Map<string, string>();
  for (const r of menuRows ?? []) categoryOf.set(r.id, r.category_id);

  const where =
    order.mode === "table"
      ? `Table ${order.table_no ?? "-"}`
      : order.mode === "eden"
        ? `Eden Court - Tower ${order.tower ?? "-"}, Flat ${order.flat ?? "-"}`
        : order.address || "Direct delivery";

  const alerts: ChefAlert[] = [];
  for (const c of categories ?? []) {
    const phone = String(c.chef_phone ?? "").replace(/\D/g, "").slice(-10);
    if (phone.length !== 10) continue;
    const lines = priced.filter((l) => l.kind === "item" && categoryOf.get(l.id) === c.id);
    if (lines.length === 0) continue;
    alerts.push({
      category: c.name as string,
      phone,
      text:
        `New Mealbox91 order (${c.name})\n${where}\n` +
        lines.map((l) => `${l.qty}x ${l.name}${l.note ? ` (${l.note})` : ""}`).join("\n") +
        `\nDelivery time: ${order.delivery_slot ? order.delivery_slot : "As soon as possible"}` +
        `\nPayment: ${order.payment_method === "upi" ? "Paid via UPI" : "Cash on delivery"}`,
    });
  }
  return alerts;
}

export async function rewardReferrerIfFirstOrder(db: Db, userId: string) {
  const { data: profile } = await db.from("profiles").select("*").eq("id", userId).maybeSingle();
  if (!profile || !profile.referred_by || profile.referral_rewarded) return;

  const { data: settings } = await db.from("settings").select("referral_amount").eq("id", 1).single();
  const amount = Number(settings?.referral_amount ?? 50);
  const code = `REF${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

  await db.from("coupons").insert({
    code,
    discount_amount: amount,
    owner_user_id: profile.referred_by,
    note: "Referral reward",
  });
  await db.from("profiles").update({ referral_rewarded: true }).eq("id", userId);
}

/**
 * Automatic WhatsApp dispatch to category chefs.
 * Uses the WhatsApp Cloud API when credentials are configured; returns false
 * when no provider is set up so the client can fall back to auto-opening links.
 */
export async function dispatchChefAlerts(alerts: ChefAlert[]) {
  const token = process.env['WHATSAPP_TOKEN'];
  const phoneId = process.env['WHATSAPP_PHONE_NUMBER_ID'];
  if (!token || !phoneId || alerts.length === 0) return false;
  try {
    await Promise.all(
      alerts.map((a) =>
        fetch(`https://graph.facebook.com/v20.0/${phoneId}/messages`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            messaging_product: "whatsapp",
            to: `91${a.phone}`,
            type: "text",
            text: { body: a.text },
          }),
        }),
      ),
    );
    return true;
  } catch {
    return false;
  }
}
