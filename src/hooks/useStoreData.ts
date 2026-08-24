import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Addon, Category, MenuItem, Settings } from "@/lib/menu-types";

export function useSettings() {
  return useQuery({
    queryKey: ["settings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("settings").select("*").eq("id", 1).single();
      if (error) throw error;
      return data as unknown as Settings;
    },
  });
}

export function useMenu() {
  return useQuery({
    queryKey: ["menu"],
    queryFn: async () => {
      const [cats, items, addons] = await Promise.all([
        supabase.from("categories").select("*").order("sort_order"),
        supabase.from("menu_items").select("*").order("sort_order"),
        supabase.from("addons").select("*").order("sort_order"),
      ]);
      if (cats.error) throw cats.error;
      if (items.error) throw items.error;
      if (addons.error) throw addons.error;
      return {
        categories: (cats.data ?? []) as unknown as Category[],
        items: (items.data ?? []) as unknown as MenuItem[],
        addons: (addons.data ?? []) as unknown as Addon[],
      };
    },
  });
}
