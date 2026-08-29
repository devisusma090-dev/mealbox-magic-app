import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { BellRing, ChefHat, MessageCircle, RefreshCw } from "lucide-react";
import { Header } from "@/components/site/Header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { chefBoard } from "@/lib/chef.functions";
import { rupees } from "@/lib/menu-types";
import { useOrderEvents } from "@/lib/live";
import { primeAudio, startAlarm, stopAlarm } from "@/lib/alarm";
import { pushNotify, requestNotificationPermission } from "@/lib/notify";

export const Route = createFileRoute("/chef")({
  head: () => ({
    meta: [
      { title: "Chef dashboard — Mealbox91" },
      { name: "description", content: "Live kitchen board for Mealbox91 chefs with category-filtered orders and alerts." },
      { property: "og:title", content: "Chef dashboard — Mealbox91" },
      { property: "og:description", content: "Live kitchen board with category-filtered orders and sound alerts." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ChefPage,
});

type ChefOrder = {
  id: string;
  mode: string;
  table_no: string | null;
  tower: string | null;
  flat: string | null;
  address: string | null;
  customer_name: string | null;
  phone: string | null;
  items: { key: string; name: string; qty: number; note?: string; category_id?: string }[];
  total: number;
  status: string;
  created_at: string;
};

function ChefPage() {
  const [phoneInput, setPhoneInput] = useState("");
  const [phone, setPhone] = useState("");
  const [categoryId, setCategoryId] = useState("all");
  const [alarming, setAlarming] = useState(false);
  const qc = useQueryClient();
  const runBoard = useServerFn(chefBoard);

  const { data, error, isFetching } = useQuery({
    queryKey: ["chef-board", phone],
    queryFn: () => runBoard({ data: { phone } }),
    enabled: phone.length > 0,
    refetchInterval: 20000,
  });

  useOrderEvents((event) => {
    void qc.invalidateQueries({ queryKey: ["chef-board"] });
    if (event.kind === "new") {
      startAlarm();
      setAlarming(true);
      pushNotify("New order", "A new order just came in.", event.order_id);
    }
  }, phone.length > 0);

  useEffect(() => () => stopAlarm(), []);

  if (!phone) {
    return (
      <div className="min-h-screen">
        <Header />
        <main className="mx-auto max-w-sm space-y-3 px-4 py-16">
          <h1 className="font-display text-2xl font-bold">Chef dashboard</h1>
          <div className="space-y-1.5">
            <Label htmlFor="chef-phone">Your phone number</Label>
            <Input
              id="chef-phone"
              inputMode="numeric"
              placeholder="10-digit number"
              value={phoneInput}
              onChange={(e) => setPhoneInput(e.target.value.replace(/\D/g, "").slice(0, 10))}
            />
          </div>
          <Button
            className="w-full"
            disabled={phoneInput.length !== 10}
            onClick={async () => {
              primeAudio();
              await requestNotificationPermission();
              setPhone(phoneInput);
            }}
          >
            <ChefHat className="size-4" /> Open kitchen board
          </Button>
        </main>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen">
        <Header />
        <main className="mx-auto max-w-sm space-y-3 px-4 py-16 text-center text-sm">
          <p className="text-destructive">{error instanceof Error ? error.message : "Could not open the board."}</p>
          <Button variant="outline" onClick={() => setPhone("")}>Use another number</Button>
        </main>
      </div>
    );
  }

  const categories = data?.categories ?? [];
  const orders = (data?.orders ?? []) as unknown as ChefOrder[];
  const visible =
    categoryId === "all"
      ? orders
      : orders
          .map((o) => ({ ...o, items: (o.items ?? []).filter((l) => l.category_id === categoryId) }))
          .filter((o) => o.items.length > 0);

  return (
    <div className="min-h-screen pb-12">
      <Header />
      <main className="mx-auto max-w-3xl space-y-4 px-4 py-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="font-display text-2xl font-bold">Kitchen board</h1>
          <div className="flex gap-2">
            {alarming && (
              <Button size="sm" variant="destructive" onClick={() => { stopAlarm(); setAlarming(false); }}>
                <BellRing className="size-4" /> Acknowledge
              </Button>
            )}
            <Button
              size="sm"
              variant="ghost"
              disabled={isFetching}
              onClick={() => qc.invalidateQueries({ queryKey: ["chef-board"] })}
            >
              <RefreshCw className={`size-4 ${isFetching ? "animate-spin" : ""}`} /> Refresh
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Badge
            variant={categoryId === "all" ? "default" : "outline"}
            className="cursor-pointer"
            onClick={() => setCategoryId("all")}
          >
            All
          </Badge>
          {categories.map((c) => (
            <Badge key={c.id} variant="outline">{c.name}</Badge>
          ))}
        </div>

        {visible.length === 0 && <p className="text-sm text-muted-foreground">No active orders for your categories.</p>}

        {visible.map((o) => (
          <article key={o.id} className="surface-card space-y-2 p-4 text-sm">
            <div className="flex items-center justify-between gap-2">
              <span className="font-semibold">{o.customer_name || "Guest"}</span>
              <Badge variant={o.status === "pending" ? "secondary" : "default"}>
                {o.status === "pending" ? "New" : "Out for delivery"}
              </Badge>
            </div>
            <p className="text-muted-foreground">
              {o.mode === "table"
                ? `Table ${o.table_no ?? "—"}`
                : o.mode === "eden"
                  ? `Eden Court · Tower ${o.tower ?? "—"}, Flat ${o.flat ?? "—"}`
                  : o.address || "Direct delivery"}
              {" · "}
              {new Date(o.created_at).toLocaleTimeString("en-IN")}
            </p>
            <ul className="font-medium">
              {(o.items ?? []).map((l) => (
                <li key={l.key}>
                  {l.qty}× {l.name}
                  {l.note ? ` — ${l.note}` : ""}
                </li>
              ))}
            </ul>
            <div className="flex items-center justify-between">
              <span className="font-semibold">{rupees(Number(o.total))}</span>
              <Button size="sm" variant="outline" asChild>
                <a
                  target="_blank"
                  rel="noreferrer"
                  href={`https://wa.me/91${phone}?text=${encodeURIComponent(
                    `Order ${o.id.slice(0, 8)}\n${(o.items ?? [])
                      .map((l) => `${l.qty}x ${l.name}${l.note ? ` (${l.note})` : ""}`)
                      .join("\n")}`,
                  )}`}
                  onClick={() => toast.success("Opening WhatsApp")}
                >
                  <MessageCircle className="size-4" /> WhatsApp
                </a>
              </Button>
            </div>
          </article>
        ))}
      </main>
    </div>
  );
}
