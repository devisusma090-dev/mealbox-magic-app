import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { BellRing, MapPin, Trash2 } from "lucide-react";
import { Header } from "@/components/site/Header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  adminCompleteByOtp,
  adminDelete,
  adminLoadAll,
  adminSetOrderStatus,
  adminUpsert,
} from "@/lib/admin.functions";
import { getAdminPasscode, clearAdminPasscode } from "@/lib/admin-session";
import { ImageCropUpload } from "@/components/site/ImageCropUpload";
import { useOrderEvents } from "@/lib/live";
import { ding, primeAudio, startAlarm, stopAlarm } from "@/lib/alarm";
import { mapsUrl, pushNotify, requestNotificationPermission } from "@/lib/notify";
import { rupees, type Addon, type Category, type Coupon, type MenuItem, type OrderRow, type Settings } from "@/lib/menu-types";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Staff panel — Mealbox91" },
      { name: "description", content: "Manage the Mealbox91 menu, coupons, settings and daily orders." },
      { property: "og:title", content: "Staff panel — Mealbox91" },
      { property: "og:description", content: "Manage menu, coupons, settings and daily orders." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminPage,
});

function AdminPage() {
  const [passcode, setPasscode] = useState("");
  useEffect(() => setPasscode(getAdminPasscode()), []);

  if (!passcode) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="mx-auto max-w-md px-4 py-24 text-center">
          <h1 className="text-xl font-semibold">Staff access required</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Open the passcode prompt from the copyright line in the footer.
          </p>
        </main>
      </div>
    );
  }
  return <AdminBoard passcode={passcode} />;
}

function AdminBoard({ passcode }: { passcode: string }) {
  const qc = useQueryClient();
  const loadAll = useServerFn(adminLoadAll);
  const upsert = useServerFn(adminUpsert);
  const remove = useServerFn(adminDelete);
  const completeByOtp = useServerFn(adminCompleteByOtp);
  const setStatus = useServerFn(adminSetOrderStatus);

  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-all"],
    queryFn: () => loadAll({ data: { passcode } }),
    refetchInterval: 20000,
    refetchOnWindowFocus: true,
  });


  const [alarming, setAlarming] = useState(false);

  const refresh = () => qc.invalidateQueries({ queryKey: ["admin-all"] });

  useEffect(() => {
    primeAudio();
    void requestNotificationPermission();
    return () => stopAlarm();
  }, []);

  useOrderEvents((event) => {
    refresh();
    if (event.kind === "new") {
      startAlarm();
      setAlarming(true);
      pushNotify("New order", "A new order just came in.", event.order_id);
    } else if (event.status === "completed") {
      ding();
      pushNotify("Order delivered", "An order was completed with OTP.", event.order_id);
    }
  });

  const save = async (table: string, row: Record<string, unknown>) => {
    try {
      await upsert({ data: { passcode, table, row } });
      toast.success("Saved");
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    }
  };
  const del = async (table: string, id: string) => {
    try {
      await remove({ data: { passcode, table, id } });
      toast.success("Deleted");
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    }
  };

  if (error) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="mx-auto max-w-md px-4 py-24 text-center">
          <p className="text-sm text-destructive">Session expired or invalid passcode.</p>
          <Button className="mt-4" onClick={() => { clearAdminPasscode(); window.location.href = "/"; }}>
            Back to menu
          </Button>
        </main>
      </div>
    );
  }

  const categories = (data?.categories ?? []) as Category[];
  const items = (data?.items ?? []) as MenuItem[];
  const addons = (data?.addons ?? []) as Addon[];
  const coupons = (data?.coupons ?? []) as Coupon[];
  const orders = (data?.orders ?? []) as unknown as OrderRow[];
  const settings = data?.settings as Settings | undefined;

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="mx-auto max-w-5xl px-4 py-8">
        <div className="mb-6 flex items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold">Staff panel</h1>
          <div className="flex gap-2">
            {alarming && (
              <Button size="sm" variant="destructive" onClick={() => { stopAlarm(); setAlarming(false); }}>
                <BellRing className="size-4" /> Acknowledge new order
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={() => { clearAdminPasscode(); window.location.href = "/"; }}>
              Sign out
            </Button>
          </div>
        </div>

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : (
          <Tabs defaultValue="orders">
            <TabsList className="flex w-full flex-wrap">
              <TabsTrigger value="orders">Orders</TabsTrigger>
              <TabsTrigger value="menu">Menu</TabsTrigger>
              <TabsTrigger value="addons">Add-ons</TabsTrigger>
              <TabsTrigger value="coupons">Coupons</TabsTrigger>
              <TabsTrigger value="settings">Settings</TabsTrigger>
            </TabsList>

            <TabsContent value="orders" className="mt-6 space-y-6">
              <Analytics orders={orders} />
              <OtpBox
                onSubmit={async (otp) => {
                  try {
                    const res = await completeByOtp({ data: { passcode, otp } });
                    toast.success(`Order completed — ${rupees(res.total)}`);
                    refresh();
                  } catch (e) {
                    toast.error(e instanceof Error ? e.message : "Failed");
                  }
                }}
              />
              <div className="space-y-3">
                {orders.map((o) => (
                  <Card key={o.id}>
                    <CardContent className="space-y-2 p-4 text-sm">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="font-medium">
                          {o.customer_name || "Guest"} · {o.phone || "—"}
                        </div>
                        <Badge variant={o.status === "completed" ? "default" : o.status === "cancelled" ? "destructive" : "secondary"}>
                          {statusLabel(o.status)}
                        </Badge>

                      </div>
                      <div className="text-muted-foreground">
                        {o.mode === "table"
                          ? `Table ${o.table_no ?? "—"}`
                          : o.mode === "eden"
                            ? `Eden Court · Tower ${o.tower ?? "—"}, Flat ${o.flat ?? "—"}`
                            : o.address || "Direct delivery"}
                      </div>
                      <ul className="text-muted-foreground">
                        {(o.items ?? []).map((l) => (
                          <li key={l.key}>
                            {l.qty}× {l.name} {l.note ? `(${l.note})` : ""}
                          </li>
                        ))}
                      </ul>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-semibold">{rupees(o.total)}</span>
                        <span className="text-xs text-muted-foreground">
                          OTP {o.delivery_otp} · {new Date(o.created_at).toLocaleString()}
                        </span>
                      </div>
                      {mapsUrl(o.lat, o.lng) && (
                        <Button size="sm" variant="outline" asChild>
                          <a href={mapsUrl(o.lat, o.lng)!} target="_blank" rel="noreferrer">
                            <MapPin className="size-4" /> Navigate on Google Maps
                          </a>
                        </Button>
                      )}
                      <ChefAlerts order={o} items={items} categories={categories} />
                      {o.status === "pending" && (

                        <div className="flex gap-2">
                          <Button size="sm" onClick={async () => { await setStatus({ data: { passcode, id: o.id, status: "completed" } }); refresh(); }}>
                            Complete
                          </Button>
                          <Button size="sm" variant="outline" onClick={async () => { await setStatus({ data: { passcode, id: o.id, status: "cancelled" } }); refresh(); }}>
                            Cancel
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
                {orders.length === 0 && <p className="text-sm text-muted-foreground">No orders in the last 48 hours.</p>}
              </div>
            </TabsContent>

            <TabsContent value="menu" className="mt-6 space-y-8">
              <Card>
                <CardHeader><CardTitle className="text-base">Categories</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  {categories.map((c) => (
                    <RowEditor
                      key={c.id}
                      fields={[
                        { name: "name", value: c.name },
                        { name: "chef_phone", value: c.chef_phone ?? "", width: "w-40" },
                        { name: "sort_order", value: String(c.sort_order), type: "number", width: "w-24" },
                      ]}
                      onSave={(v) =>
                        save("categories", {
                          id: c.id,
                          name: v['name'],
                          chef_phone: v['chef_phone'] || null,
                          sort_order: Number(v['sort_order']),
                        })
                      }
                      onDelete={() => del("categories", c.id)}
                    />
                  ))}
                  <RowEditor
                    key="new-cat"
                    addMode
                    fields={[
                      { name: "name", value: "" },
                      { name: "chef_phone", value: "", width: "w-40" },
                      { name: "sort_order", value: "0", type: "number", width: "w-24" },
                    ]}
                    onSave={(v) =>
                      save("categories", {
                        name: v['name'],
                        chef_phone: v['chef_phone'] || null,
                        sort_order: Number(v['sort_order']),
                      })
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    Chef phone: WhatsApp alerts for this category's items are sent to this number.
                  </p>

                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle className="text-base">Menu items</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  {items.map((it) => (
                    <ItemEditor
                      key={it.id}
                      item={it}
                      categories={categories}
                      onSave={(row) => save("menu_items", { id: it.id, ...row })}
                      onDelete={() => del("menu_items", it.id)}
                    />
                  ))}
                  <ItemEditor
                    key="new-item"
                    categories={categories}
                    onSave={(row) => save("menu_items", row)}
                  />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="addons" className="mt-6">
              <Card>
                <CardHeader><CardTitle className="text-base">Cold drinks & add-ons</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  {addons.map((a) => (
                    <RowEditor
                      key={a.id}
                      fields={[
                        { name: "name", value: a.name },
                        { name: "price", value: String(a.price), type: "number", width: "w-24" },
                        { name: "sort_order", value: String(a.sort_order), type: "number", width: "w-20" },
                      ]}
                      toggle={{ label: "Available", value: a.available }}
                      onSave={(v, t) => save("addons", { id: a.id, name: v['name'], price: Number(v['price']), sort_order: Number(v['sort_order']), available: t })}
                      onDelete={() => del("addons", a.id)}
                    />
                  ))}
                  <RowEditor
                    key="new-addon"
                    addMode
                    fields={[
                      { name: "name", value: "" },
                      { name: "price", value: "0", type: "number", width: "w-24" },
                      { name: "sort_order", value: "0", type: "number", width: "w-20" },
                    ]}
                    toggle={{ label: "Available", value: true }}
                    onSave={(v, t) => save("addons", { name: v['name'], price: Number(v['price']), sort_order: Number(v['sort_order']), available: t })}
                  />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="coupons" className="mt-6">
              <Card>
                <CardHeader><CardTitle className="text-base">Promo codes</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  {coupons.map((c) => (
                    <div key={c.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-border p-3 text-sm">
                      <span className="font-mono font-semibold">{c.code}</span>
                      <span className="text-muted-foreground">
                        {c.discount_percent > 0 ? `${c.discount_percent}%` : rupees(c.discount_amount)} off
                        {c.min_order > 0 ? ` · min ${rupees(c.min_order)}` : ""}
                      </span>
                      {c.owner_user_id && <Badge variant="secondary">referral</Badge>}
                      {c.used && <Badge variant="outline">used</Badge>}
                      <div className="ml-auto flex items-center gap-2">
                        <Switch
                          checked={c.active}
                          onCheckedChange={(v) => save("coupons", { id: c.id, code: c.code, active: v })}
                        />
                        <Button size="icon" variant="ghost" onClick={() => del("coupons", c.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                  <NewCoupon onSave={(row) => save("coupons", row)} />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="settings" className="mt-6 space-y-6">
              {settings && <SettingsForm settings={settings} onSave={(row) => save("settings", { id: 1, ...row })} />}
              <TableQrCard />
            </TabsContent>

          </Tabs>
        )}
      </main>
    </div>
  );
}

const MODES = [
  { key: "table", label: "Table" },
  { key: "direct", label: "Direct" },
  { key: "eden", label: "Eden Court" },
] as const;

function statusLabel(status: string) {
  if (status === "pending") return "New";
  if (status === "out_for_delivery") return "Out for delivery";
  if (status === "completed") return "Completed";
  return "Cancelled";
}

function Analytics({ orders }: { orders: OrderRow[] }) {
  const today = new Date().toDateString();
  const todays = orders.filter((o) => new Date(o.created_at).toDateString() === today);
  const completed = todays.filter((o) => o.status === "completed");
  const cancelled = todays.filter((o) => o.status === "cancelled");
  const sales = completed.reduce((s, o) => s + Number(o.total || 0), 0);
  const stats = [
    { label: "Today's sales", value: rupees(sales) },
    { label: "Completed today", value: String(completed.length) },
    { label: "Cancelled today", value: String(cancelled.length) },
    { label: "Orders (48h)", value: String(orders.length) },
  ];
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">{s.label}</p>
              <p className="mt-1 text-xl font-semibold">{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Breakdown by mode (today)</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full min-w-md text-left text-sm">
            <thead className="text-xs uppercase text-muted-foreground">
              <tr className="border-b border-border">
                <th className="px-4 py-2">Mode</th>
                <th className="px-4 py-2">New</th>
                <th className="px-4 py-2">Out for delivery</th>
                <th className="px-4 py-2">Completed</th>
                <th className="px-4 py-2">Sales</th>
              </tr>
            </thead>
            <tbody>
              {MODES.map((m) => {
                const rows = todays.filter((o) => o.mode === m.key);
                const count = (s: string) => rows.filter((o) => o.status === s).length;
                const modeSales = rows
                  .filter((o) => o.status === "completed")
                  .reduce((s, o) => s + Number(o.total || 0), 0);
                return (
                  <tr key={m.key} className="border-b border-border last:border-0">
                    <td className="px-4 py-2 font-medium">{m.label}</td>
                    <td className="px-4 py-2"><Badge variant="secondary">{count("pending")}</Badge></td>
                    <td className="px-4 py-2"><Badge variant="outline">{count("out_for_delivery")}</Badge></td>
                    <td className="px-4 py-2"><Badge>{count("completed")}</Badge></td>
                    <td className="px-4 py-2 font-semibold">{rupees(modeSales)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

function ChefAlerts({
  order,
  items,
  categories,
}: {
  order: OrderRow;
  items: MenuItem[];
  categories: Category[];
}) {
  const groups = categories
    .filter((c) => !!c.chef_phone)
    .map((c) => {
      const lines = (order.items ?? []).filter((l) => {
        const item = items.find((i) => i.id === l.id);
        return item?.category_id === c.id;
      });
      return { category: c, lines };
    })
    .filter((g) => g.lines.length > 0);

  if (groups.length === 0) return null;

  const where =
    order.mode === "table"
      ? `Table ${order.table_no ?? "—"}`
      : order.mode === "eden"
        ? `Eden Court · Tower ${order.tower ?? "—"}, Flat ${order.flat ?? "—"}`
        : order.address || "Direct delivery";

  return (
    <div className="flex flex-wrap gap-2">
      {groups.map((g) => {
        const text = encodeURIComponent(
          `New Mealbox91 order (${g.category.name})\n${where}\n` +
            g.lines.map((l) => `${l.qty}x ${l.name}${l.note ? ` (${l.note})` : ""}`).join("\n"),
        );
        const phone = String(g.category.chef_phone).replace(/\D/g, "").slice(-10);
        return (
          <Button key={g.category.id} size="sm" variant="outline" asChild>
            <a href={`https://wa.me/91${phone}?text=${text}`} target="_blank" rel="noreferrer">
              WhatsApp {g.category.name} chef
            </a>
          </Button>
        );
      })}
    </div>
  );
}

function TableQrCard() {
  const [table, setTable] = useState("1");
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  const url = `${origin}/?table=${encodeURIComponent(table)}`;
  const qr = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(url)}`;
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Table QR generator</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-end gap-2">
          <div className="space-y-1">
            <Label className="text-xs">Table number</Label>
            <Input value={table} onChange={(e) => setTable(e.target.value)} className="w-32" />
          </div>
          <Button asChild variant="outline">
            <a href={qr} target="_blank" rel="noreferrer">Open printable QR</a>
          </Button>
        </div>
        <img src={qr} alt={`QR code for table ${table}`} className="rounded-lg border border-border" width={240} height={240} />
        <p className="break-all text-xs text-muted-foreground">{url}</p>
      </CardContent>
    </Card>
  );
}


function OtpBox({ onSubmit }: { onSubmit: (otp: string) => Promise<void> }) {
  const [otp, setOtp] = useState("");
  return (
    <div className="flex gap-2">
      <Input
        inputMode="numeric"
        maxLength={4}
        placeholder="Delivery OTP"
        value={otp}
        onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
        className="max-w-40"
      />
      <Button
        disabled={otp.length !== 4}
        onClick={async () => {
          await onSubmit(otp);
          setOtp("");
        }}
      >
        Mark delivered
      </Button>
    </div>
  );
}

type Field = { name: string; value: string; type?: string; width?: string };

function RowEditor({
  fields,
  toggle,
  onSave,
  onDelete,
  addMode,
}: {
  fields: Field[];
  toggle?: { label: string; value: boolean };
  onSave: (values: Record<string, string>, toggleValue: boolean) => void;
  onDelete?: () => void;
  addMode?: boolean;
}) {
  const [values, setValues] = useState<Record<string, string>>(
    Object.fromEntries(fields.map((f) => [f.name, f.value])),
  );
  const [tv, setTv] = useState(toggle?.value ?? true);
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border p-3">
      {fields.map((f) => (
        <Input
          key={f.name}
          type={f.type ?? "text"}
          placeholder={f.name}
          className={f.width ?? "max-w-56"}
          value={values[f.name] ?? ""}
          onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.value }))}
        />
      ))}
      {toggle && (
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <Switch checked={tv} onCheckedChange={setTv} /> {toggle.label}
        </label>
      )}
      <div className="ml-auto flex gap-2">
        <Button size="sm" onClick={() => onSave(values, tv)}>{addMode ? "Add" : "Save"}</Button>
        {onDelete && (
          <Button size="icon" variant="ghost" onClick={onDelete}>
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}

function ItemEditor({
  item,
  categories,
  onSave,
  onDelete,
}: {
  item?: MenuItem;
  categories: Category[];
  onSave: (row: Record<string, unknown>) => void;
  onDelete?: () => void;
}) {
  const [name, setName] = useState(item?.name ?? "");
  const [desc, setDesc] = useState(item?.description ?? "");
  const [price, setPrice] = useState(String(item?.price ?? 0));
  const [image, setImage] = useState(item?.image_url ?? "");
  const [categoryId, setCategoryId] = useState(item?.category_id ?? categories[0]?.id ?? "");
  const [sort, setSort] = useState(String(item?.sort_order ?? 0));
  const [veg, setVeg] = useState(item?.is_veg ?? true);
  const [available, setAvailable] = useState(item?.available ?? true);

  return (
    <div className="space-y-3 rounded-lg border border-border p-3">
      <div className="flex flex-wrap gap-2">
        <Input className="max-w-56" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
        <Input className="w-24" type="number" placeholder="Price" value={price} onChange={(e) => setPrice(e.target.value)} />
        <Input className="w-20" type="number" placeholder="Sort" value={sort} onChange={(e) => setSort(e.target.value)} />
        <select
          className="h-9 rounded-md border border-input bg-background px-2 text-sm"
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
        >
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>
      <Textarea rows={2} placeholder="Description" value={desc ?? ""} onChange={(e) => setDesc(e.target.value)} />
      <ImageCropUpload value={image ?? ""} onChange={setImage} />
      <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
        <label className="flex items-center gap-2"><Switch checked={veg} onCheckedChange={setVeg} /> Veg</label>
        <label className="flex items-center gap-2"><Switch checked={available} onCheckedChange={setAvailable} /> Available</label>
        <div className="ml-auto flex gap-2">
          <Button
            size="sm"
            onClick={() =>
              onSave({
                name,
                description: desc || null,
                price: Number(price),
                image_url: image || null,
                category_id: categoryId || null,
                sort_order: Number(sort),
                is_veg: veg,
                available,
              })
            }
          >
            {item ? "Save" : "Add item"}
          </Button>
          {onDelete && (
            <Button size="icon" variant="ghost" onClick={onDelete}>
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function NewCoupon({ onSave }: { onSave: (row: Record<string, unknown>) => void }) {
  const [code, setCode] = useState("");
  const [amount, setAmount] = useState("0");
  const [percent, setPercent] = useState("0");
  const [min, setMin] = useState("0");
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-dashed border-border p-3">
      <Input className="max-w-40" placeholder="CODE" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} />
      <Input className="w-24" type="number" placeholder="₹ off" value={amount} onChange={(e) => setAmount(e.target.value)} />
      <Input className="w-24" type="number" placeholder="% off" value={percent} onChange={(e) => setPercent(e.target.value)} />
      <Input className="w-28" type="number" placeholder="Min order" value={min} onChange={(e) => setMin(e.target.value)} />
      <Button
        size="sm"
        className="ml-auto"
        disabled={!code}
        onClick={() =>
          onSave({
            code,
            discount_amount: Number(amount),
            discount_percent: Number(percent),
            min_order: Number(min),
            active: true,
          })
        }
      >
        Add coupon
      </Button>
    </div>
  );
}

function SettingsForm({ settings, onSave }: { settings: Settings; onSave: (row: Record<string, unknown>) => void }) {
  const [s, setS] = useState(settings);
  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => setS((p) => ({ ...p, [k]: v }));
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Store settings</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <label className="flex items-center gap-3">
          <Switch checked={s.restaurant_open} onCheckedChange={(v) => set("restaurant_open", v)} />
          <span className="text-sm">Restaurant open</span>
        </label>
        <div className="space-y-1">
          <Label className="text-xs">Offline reason</Label>
          <Textarea rows={2} value={s.offline_reason} onChange={(e) => set("offline_reason", e.target.value)} />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label className="text-xs">Delivery fee (₹)</Label>
            <Input type="number" value={s.delivery_fee} onChange={(e) => set("delivery_fee", Number(e.target.value))} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Referral reward (₹)</Label>
            <Input type="number" value={s.referral_amount} onChange={(e) => set("referral_amount", Number(e.target.value))} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Contact phone</Label>
            <Input value={s.contact_phone} onChange={(e) => set("contact_phone", e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">WhatsApp phone</Label>
            <Input value={s.whatsapp_phone} onChange={(e) => set("whatsapp_phone", e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">UPI QR image URL</Label>
            <Input value={s.upi_qr_url ?? ""} onChange={(e) => set("upi_qr_url", e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">UPI ID</Label>
            <Input value={s.upi_id ?? ""} onChange={(e) => set("upi_id", e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Zomato link</Label>
            <Input value={s.zomato_url ?? ""} onChange={(e) => set("zomato_url", e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Catering banner text</Label>
            <Input value={s.catering_text} onChange={(e) => set("catering_text", e.target.value)} />
          </div>
        </div>

        <div className="space-y-3 rounded-lg border border-border p-3">
          <label className="flex items-center gap-3">
            <Switch
              checked={s.direct_delivery_enabled}
              onCheckedChange={(v) => set("direct_delivery_enabled", v)}
            />
            <span className="text-sm">Direct delivery ON</span>
          </label>
          <Textarea
            rows={2}
            value={s.direct_offline_reason}
            onChange={(e) => set("direct_offline_reason", e.target.value)}
          />
          <label className="flex items-center gap-3">
            <Switch checked={s.eden_enabled} onCheckedChange={(v) => set("eden_enabled", v)} />
            <span className="text-sm">Eden Court delivery ON</span>
          </label>
          <Textarea
            rows={2}
            value={s.eden_offline_reason}
            onChange={(e) => set("eden_offline_reason", e.target.value)}
          />
        </div>

        <div className="space-y-1">
          <Label className="text-xs">Delivery staff phone numbers (comma separated)</Label>
          <Textarea
            rows={2}
            value={s.delivery_staff_phones}
            onChange={(e) => set("delivery_staff_phones", e.target.value)}
            placeholder="9310914628, 9999999999"
          />
        </div>

        <div className="space-y-1">
          <Label className="text-xs">Upload UPI QR image</Label>
          <Input
            type="file"
            accept="image/*"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              if (file.size > 400_000) {
                toast.error("Please upload an image under 400 KB");
                return;
              }
              const reader = new FileReader();
              reader.onload = () => set("upi_qr_url", String(reader.result));
              reader.readAsDataURL(file);
            }}
          />
          {s.upi_qr_url && (
            <img src={s.upi_qr_url} alt="UPI QR preview" className="mt-2 w-40 rounded-lg border border-border" />
          )}
        </div>

        <Button onClick={() => onSave({ ...s })}>Save settings</Button>

      </CardContent>
    </Card>
  );
}
