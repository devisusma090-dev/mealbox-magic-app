import { normalizePhone } from "./delivery.server";

type Db = { from: (t: string) => any };

export async function chefCategories(db: Db, phone: string) {
  const p = normalizePhone(phone);
  if (p.length !== 10) throw new Error("Enter a valid 10-digit phone number.");
  const { data } = await db.from("categories").select("id,name,chef_phone,sort_order").order("sort_order");
  const mine = (data ?? []).filter((c: any) => normalizePhone(c.chef_phone ?? "") === p);
  if (mine.length === 0) throw new Error("This number is not assigned to any menu category.");
  return { phone: p, categories: mine as { id: string; name: string }[] };
}

export async function chefOrders(db: Db, categoryIds: string[]) {
  const [{ data: items }, { data: orders }] = await Promise.all([
    db.from("menu_items").select("id,category_id").in("category_id", categoryIds),
    db
      .from("orders")
      .select("id,mode,table_no,tower,flat,address,customer_name,phone,items,total,status,created_at,lat,lng")
      .in("status", ["pending", "out_for_delivery"])
      .order("created_at", { ascending: false })
      .limit(60),
  ]);

  const categoryOf = new Map<string, string>();
  for (const it of items ?? []) categoryOf.set(it.id, it.category_id);

  return (orders ?? [])
    .map((o: any) => {
      const lines = (o.items ?? []).filter((l: any) => categoryOf.has(l.id));
      return { ...o, items: lines };
    })
    .filter((o: any) => o.items.length > 0);
}
