import { createServerFn } from "@tanstack/react-start";
import { chefCategories, chefOrders } from "./chef.server";

export const chefBoard = createServerFn({ method: "POST" })
  .inputValidator((input: { phone: string }) => ({ phone: String(input.phone ?? "") }))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as never as { from: (t: string) => any };
    const { phone, categories } = await chefCategories(db, data.phone);
    const orders = await chefOrders(db, categories.map((c) => c.id));
    return { phone, categories, orders };
  });
