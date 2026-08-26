import { createServerFn } from "@tanstack/react-start";
import { adminDb } from "./admin.server";
import { rewardReferrerIfFirstOrder } from "./orders.server";

export const adminLogin = createServerFn({ method: "POST" })
  .inputValidator((input: { passcode: string }) => ({ passcode: String(input.passcode ?? "") }))
  .handler(async ({ data }) => {
    await adminDb(data.passcode);
    return { ok: true };
  });

export const adminLoadAll = createServerFn({ method: "POST" })
  .inputValidator((input: { passcode: string }) => ({ passcode: String(input.passcode ?? "") }))
  .handler(async ({ data }) => {
    const db = await adminDb(data.passcode);
    try { await db.rpc("purge_old_orders"); } catch { /* ignore */ }
    const [categories, items, addons, coupons, settings, orders] = await Promise.all([
      db.from("categories").select("*").order("sort_order"),
      db.from("menu_items").select("*").order("sort_order"),
      db.from("addons").select("*").order("sort_order"),
      db.from("coupons").select("*").order("created_at", { ascending: false }),
      db.from("settings").select("*").eq("id", 1).single(),
      db.from("orders").select("*").order("created_at", { ascending: false }).limit(500),
    ]);
    return {
      categories: categories.data ?? [],
      items: items.data ?? [],
      addons: addons.data ?? [],
      coupons: coupons.data ?? [],
      settings: settings.data,
      orders: orders.data ?? [],
    };
  });

export const adminUpsert = createServerFn({ method: "POST" })
  .inputValidator((input: { passcode: string; table: string; row: Record<string, unknown> }) => ({
    passcode: String(input.passcode ?? ""),
    table: String(input.table ?? ""),
    row: input.row ?? {},
  }))
  .handler(async ({ data }) => {
    const allowed = ["categories", "menu_items", "addons", "coupons", "settings"];
    if (!allowed.includes(data.table)) throw new Error("Unknown table");
    const db = await adminDb(data.passcode);
    const { error } = await db.from(data.table as "categories").upsert(data.row as never);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminDelete = createServerFn({ method: "POST" })
  .inputValidator((input: { passcode: string; table: string; id: string }) => ({
    passcode: String(input.passcode ?? ""),
    table: String(input.table ?? ""),
    id: String(input.id ?? ""),
  }))
  .handler(async ({ data }) => {
    const allowed = ["categories", "menu_items", "addons", "coupons"];
    if (!allowed.includes(data.table)) throw new Error("Unknown table");
    const db = await adminDb(data.passcode);
    const { error } = await db.from(data.table as "categories").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminCompleteByOtp = createServerFn({ method: "POST" })
  .inputValidator((input: { passcode: string; otp: string }) => ({
    passcode: String(input.passcode ?? ""),
    otp: String(input.otp ?? "").trim(),
  }))
  .handler(async ({ data }) => {
    const db = await adminDb(data.passcode);
    const { data: order } = await db
      .from("orders")
      .select("*")
      .eq("delivery_otp", data.otp)
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!order) throw new Error("No pending order found with that OTP.");
    const { error } = await db.from("orders").update({ status: "completed" }).eq("id", order.id);
    if (error) throw new Error(error.message);
    if (order.user_id) await rewardReferrerIfFirstOrder(db as never, order.user_id);
    return { ok: true, orderId: order.id, total: order.total };
  });

export const adminSetOrderStatus = createServerFn({ method: "POST" })
  .inputValidator((input: { passcode: string; id: string; status: string }) => ({
    passcode: String(input.passcode ?? ""),
    id: String(input.id ?? ""),
    status: String(input.status ?? ""),
  }))
  .handler(async ({ data }) => {
    if (!["pending", "out_for_delivery", "completed", "cancelled"].includes(data.status)) throw new Error("Invalid status");
    const db = await adminDb(data.passcode);
    const { error } = await db.from("orders").update({ status: data.status }).eq("id", data.id);
    if (error) throw new Error(error.message);
    if (data.status === "completed") {
      const { data: order } = await db.from("orders").select("user_id").eq("id", data.id).maybeSingle();
      if (order?.user_id) await rewardReferrerIfFirstOrder(db as never, order.user_id);
    }
    return { ok: true };
  });
