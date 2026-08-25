import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { AlertTriangle, ShoppingBag } from "lucide-react";
import heroImage from "@/assets/hero-mealbox.jpg";
import { Header } from "@/components/site/Header";
import { Footer } from "@/components/site/Footer";
import { CateringBanner } from "@/components/site/CateringBanner";
import { MenuItemRow } from "@/components/site/MenuItemRow";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useMenu, useSettings } from "@/hooks/useStoreData";
import { useCart } from "@/lib/cart";
import { rupees } from "@/lib/menu-types";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Mealbox91 — Order fresh meal boxes online" },
      {
        name: "description",
        content:
          "Browse the Mealbox91 menu: home-style meal boxes, snacks and chilled drinks with table, doorstep and Eden Court delivery.",
      },
      { property: "og:title", content: "Mealbox91 — Order fresh meal boxes online" },
      {
        property: "og:description",
        content: "Home-style meal boxes, snacks and chilled drinks delivered hot. Order in a few taps.",
      },
    ],
  }),
  component: MenuPage,
});

export const TABLE_KEY = "mb91_table_no";

function MenuPage() {
  const { data: settings, isLoading: loadingSettings } = useSettings();
  const { data: menu, isLoading: loadingMenu } = useMenu();
  const { count, subtotal } = useCart();
  const [tableNo, setTableNo] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const t = params.get("table");
    if (t) localStorage.setItem(TABLE_KEY, t);
    setTableNo(localStorage.getItem(TABLE_KEY));
  }, []);

  const closed = settings && !settings.restaurant_open;

  return (
    <div className="min-h-screen pb-24">
      <Header />

      <main className="mx-auto max-w-5xl space-y-8 px-4 py-6">
        <section className="relative overflow-hidden rounded-2xl shadow-[var(--shadow-lift)]">
          <img
            src={heroImage}
            alt="Mealbox91 steel meal box with dal, sabzi, rice and rotis"
            width={1600}
            height={912}
            className="h-56 w-full object-cover sm:h-72"
          />
          <div className="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-foreground/80 to-transparent p-5">
            <h1 className="font-display text-3xl font-extrabold text-background sm:text-4xl">
              Ghar jaisa khana, box mein.
            </h1>
            <p className="mt-1 max-w-md text-sm text-background/85">
              Freshly cooked meal boxes from mealbox91.in — hot at your table, door or Eden Court flat.
            </p>
            {tableNo && (
              <p className="mt-2 w-fit rounded-full bg-background/90 px-3 py-1 text-xs font-semibold text-foreground">
                Dining at Table {tableNo}
              </p>
            )}
          </div>
        </section>

        {closed && (
          <div className="flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/10 p-4">
            <AlertTriangle className="mt-0.5 size-5 text-destructive" />
            <div>
              <p className="font-semibold text-destructive">We're not taking orders right now</p>
              <p className="text-sm text-muted-foreground">{settings?.offline_reason}</p>
            </div>
          </div>
        )}

        {settings && (
          <CateringBanner
            title={settings.catering_text}
            phone={settings.contact_phone}
            whatsapp={settings.whatsapp_phone}
          />
        )}

        {(loadingMenu || loadingSettings) && (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-24 w-full rounded-xl" />
            ))}
          </div>
        )}

        {menu?.categories.map((cat) => {
          const items = menu.items.filter((i) => i.category_id === cat.id);
          if (items.length === 0) return null;
          return (
            <section key={cat.id} className="space-y-3">
              <h2 className="font-display text-2xl font-bold">{cat.name}</h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {items.map((item) => (
                  <MenuItemRow
                    key={item.id}
                    id={item.id}
                    kind="item"
                    name={item.name}
                    description={item.description}
                    price={Number(item.price)}
                    isVeg={item.is_veg}
                    available={item.available}
                    disabled={!!closed}
                  />
                ))}
              </div>
            </section>
          );
        })}

        {menu && menu.addons.length > 0 && (
          <section className="space-y-3">
            <h2 className="font-display text-2xl font-bold">Cold drinks & add-ons</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {menu.addons.map((addon) => (
                <MenuItemRow
                  key={addon.id}
                  id={addon.id}
                  kind="addon"
                  name={addon.name}
                  price={Number(addon.price)}
                  available={addon.available}
                  disabled={!!closed}
                />
              ))}
            </div>
          </section>
        )}
      </main>

      <Footer phone={settings?.contact_phone} zomatoUrl={settings?.zomato_url} />

      {count > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 p-3 backdrop-blur">
          <div className="mx-auto flex max-w-5xl items-center gap-3">
            <div className="flex-1">
              <p className="text-sm font-semibold">
                {count} item{count > 1 ? "s" : ""} · {rupees(subtotal)}
              </p>
              <p className="text-xs text-muted-foreground">Taxes & delivery calculated at checkout</p>
            </div>
            <Button asChild disabled={!!closed}>
              <Link to="/checkout">
                <ShoppingBag className="size-4" /> Checkout
              </Link>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
