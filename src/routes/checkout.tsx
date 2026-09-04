import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Clock, LocateFixed, Minus, Plus, QrCode, ShieldCheck, Trash2, Wallet } from "lucide-react";
import { Header } from "@/components/site/Header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { useCart } from "@/lib/cart";
import { rupees } from "@/lib/menu-types";
import { useSettings } from "@/hooks/useStoreData";
import { useAuth } from "@/hooks/useAuth";
import { placeOrder, previewCoupon } from "@/lib/orders.functions";
import { upiQrImage } from "@/lib/upi";
import { lovable } from "@/integrations/lovable/index";

export const Route = createFileRoute("/checkout")({
  head: () => ({
    meta: [
      { title: "Checkout — Mealbox91" },
      { name: "description", content: "Review your Mealbox91 cart, pick a delivery mode, apply a coupon and pay by UPI." },
      { property: "og:title", content: "Checkout — Mealbox91" },
      { property: "og:description", content: "Review your cart and place your Mealbox91 order in seconds." },
    ],
  }),
  component: CheckoutPage,
});

type Mode = "table" | "direct" | "eden";

function CheckoutPage() {
  const { lines, subtotal, setQty, clear } = useCart();
  const { data: settings } = useSettings();
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const runPlaceOrder = useServerFn(placeOrder);
  const runPreviewCoupon = useServerFn(previewCoupon);

  const [mode, setMode] = useState<Mode>("table");
  const [tableNo, setTableNo] = useState("");
  const [tower, setTower] = useState("");
  const [flat, setFlat] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [couponInput, setCouponInput] = useState("");
  const [coupon, setCoupon] = useState<{ code: string; discount: number } | null>(null);
  const [payOpen, setPayOpen] = useState(false);
  const [payMethod, setPayMethod] = useState<"cod" | "upi">("cod");
  const [busy, setBusy] = useState(false);
  const [placed, setPlaced] = useState<{
    otp: string;
    total: number;
    id: string;
    paymentMethod: "cod" | "upi";
    slot: string;
  } | null>(null);
  const [timeMode, setTimeMode] = useState<"asap" | "scheduled">("asap");
  const [slotTime, setSlotTime] = useState("");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);


  const useMyLocation = () => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      toast.error("Location is not supported on this device.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocating(false);
        toast.success("Location captured");
      },
      () => {
        setLocating(false);
        toast.error("Could not get your location. Please allow location access.");
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  useEffect(() => {
    const saved = localStorage.getItem("mb91_table_no");
    if (saved) setTableNo(saved);
  }, []);

  const deliveryFee = mode === "direct" ? Number(settings?.delivery_fee ?? 30) : 0;
  const discount = coupon?.discount ?? 0;
  const total = useMemo(() => Math.max(0, subtotal + deliveryFee - discount), [subtotal, deliveryFee, discount]);

  const dynamicQr = useMemo(
    () => upiQrImage(settings?.upi_id ?? "", total, "Mealbox91 order"),
    [settings?.upi_id, total],
  );

  const applyCoupon = async () => {
    try {
      const res = await runPreviewCoupon({ data: { code: couponInput, subtotal } });
      setCoupon(res);
      toast.success(`Coupon ${res.code} applied — ${rupees(res.discount)} off`);
    } catch (e) {
      setCoupon(null);
      toast.error(e instanceof Error ? e.message : "Coupon could not be applied");
    }
  };

  const slotLabel = () => {
    if (timeMode !== "scheduled" || !slotTime) return "";
    const [h, m] = slotTime.split(":").map(Number);
    const hour = ((h ?? 0) % 12) || 12;
    const ampm = (h ?? 0) < 12 ? "AM" : "PM";
    return `${hour}:${String(m ?? 0).padStart(2, "0")} ${ampm}`;
  };

  const validateDetails = (): string | null => {
    if (timeMode === "scheduled" && !slotTime) return "Please pick a delivery time slot.";
    if (lines.length === 0) return "Your cart is empty.";
    if (mode === "table" && !tableNo.trim()) return "Table number is required.";
    if (mode === "eden" && (!tower.trim() || !flat.trim() || phone.trim().length < 10))
      return "Tower, flat and a 10-digit phone are required for Eden Court delivery.";
    if (mode === "direct" && (phone.trim().length < 10 || !address.trim()))
      return "Phone and address are required for direct delivery.";
    return null;
  };

  const submitOrder = async (paymentMethod: "cod" | "upi") => {
    const problem = validateDetails();
    if (problem) {
      toast.error(problem);
      setPayOpen(false);
      return;
    }
    setBusy(true);
    try {
      const order = await runPlaceOrder({
        data: {
          mode,
          tableNo,
          tower,
          flat,
          phone,
          address,
          paymentMethod,
          deliverySlot: slotLabel(),
          name: user?.user_metadata?.["full_name"] ?? user?.email ?? "",
          couponCode: coupon?.code ?? "",
          lat: coords?.lat ?? null,
          lng: coords?.lng ?? null,
          lines: lines.map((l) => ({ id: l.id, kind: l.kind, qty: l.qty, note: l.note })),
        },
      });
      clear();
      setPayOpen(false);
      const result = order as {
        chefAlerts?: { category: string; phone: string; text: string }[];
        alertsSent?: boolean;
      };
      setPlaced({
        otp: order.delivery_otp,
        total: Number(order.total),
        id: order.id,
        paymentMethod,
        slot: slotLabel(),
      });
      // Chef alerts are automatic — never shown as manual buttons to the customer.
      if (!result.alertsSent) {
        (result.chefAlerts ?? []).forEach((a, i) => {
          setTimeout(
            () => window.open(`https://wa.me/91${a.phone}?text=${encodeURIComponent(a.text)}`, "_blank", "noopener"),
            i * 400,
          );
        });
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not place order");
    } finally {
      setBusy(false);
    }
  };

  if (placed) {
    return (
      <div className="min-h-screen">
        <Header />
        <main className="mx-auto max-w-md px-4 py-12 text-center">
          <div className="surface-card p-8">
            <ShieldCheck className="mx-auto size-12 text-success" />
            <h1 className="mt-4 font-display text-2xl font-bold">Order placed!</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Share this OTP with our delivery partner only after you receive your food.
            </p>
            <p className="mt-6 font-display text-5xl font-extrabold tracking-[0.3em] text-primary">{placed.otp}</p>
            <p className="mt-4 text-sm">
              {placed.paymentMethod === "upi" ? "Payment confirmed on delivery" : "Pay on delivery"}: <strong>{rupees(placed.total)}</strong>
            </p>
            {placed.slot && (
              <p className="mt-2 text-sm text-muted-foreground">
                Scheduled for <strong>{placed.slot}</strong>
              </p>
            )}
            <p className="mt-4 text-xs text-muted-foreground">Our kitchen has been notified automatically.</p>

            <div className="mt-6 flex justify-center gap-2">
              <Button asChild variant="outline">
                <Link to="/">Order more</Link>
              </Button>
              <Button asChild>
                <Link to="/orders">My orders</Link>
              </Button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-10">
      <Header />
      <main className="mx-auto max-w-2xl space-y-6 px-4 py-6">
        <h1 className="font-display text-3xl font-bold">Checkout</h1>

        {lines.length === 0 ? (
          <div className="surface-card p-8 text-center">
            <p className="text-muted-foreground">Your cart is empty.</p>
            <Button className="mt-4" onClick={() => navigate({ to: "/" })}>
              Browse the menu
            </Button>
          </div>
        ) : (
          <>
            <section className="surface-card divide-y divide-border">
              {lines.map((l) => (
                <div key={l.key} className="flex items-start gap-3 p-4">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{l.name}</p>
                    {l.note && <p className="text-xs text-muted-foreground">Note: {l.note}</p>}
                    <p className="text-sm text-muted-foreground">{rupees(l.price)} each</p>
                  </div>
                  <div className="flex items-center gap-1 rounded-lg border border-border p-1">
                    <Button size="icon" variant="ghost" className="size-7" onClick={() => setQty(l.key, l.qty - 1)}>
                      {l.qty === 1 ? <Trash2 className="size-4" /> : <Minus className="size-4" />}
                    </Button>
                    <span className="w-6 text-center text-sm font-bold">{l.qty}</span>
                    <Button size="icon" variant="ghost" className="size-7" onClick={() => setQty(l.key, l.qty + 1)}>
                      <Plus className="size-4" />
                    </Button>
                  </div>
                  <p className="w-16 text-right font-semibold">{rupees(l.price * l.qty)}</p>
                </div>
              ))}
            </section>

            <section className="surface-card space-y-4 p-4">
              <h2 className="font-display text-lg font-bold">Delivery mode</h2>
              <RadioGroup value={mode} onValueChange={(v) => setMode(v as Mode)} className="space-y-2">
                <label className="flex items-start gap-3 rounded-lg border border-border p-3">
                  <RadioGroupItem value="table" className="mt-1" />
                  <span>
                    <span className="block font-semibold">Dine-in / Table QR</span>
                    <span className="block text-sm text-muted-foreground">Served to your table · Free</span>
                  </span>
                </label>
                <label
                  className={`flex items-start gap-3 rounded-lg border border-border p-3 ${
                    settings && !settings.direct_delivery_enabled ? "opacity-50" : ""
                  }`}
                >
                  <RadioGroupItem
                    value="direct"
                    className="mt-1"
                    disabled={!!settings && !settings.direct_delivery_enabled}
                  />
                  <span>
                    <span className="block font-semibold">Direct delivery</span>
                    <span className="block text-sm text-muted-foreground">
                      {settings && !settings.direct_delivery_enabled
                        ? settings.direct_offline_reason
                        : `Flat ${rupees(settings?.delivery_fee ?? 30)} delivery fee`}
                    </span>
                  </span>
                </label>
                <label
                  className={`flex items-start gap-3 rounded-lg border border-border p-3 ${
                    settings && !settings.eden_enabled ? "opacity-50" : ""
                  }`}
                >
                  <RadioGroupItem value="eden" className="mt-1" disabled={!!settings && !settings.eden_enabled} />
                  <span>
                    <span className="block font-semibold">Eden Court doorstep</span>
                    <span className="block text-sm text-muted-foreground">
                      {settings && !settings.eden_enabled
                        ? settings.eden_offline_reason
                        : "Free delivery inside Eden Court"}
                    </span>
                  </span>
                </label>

              </RadioGroup>

              {mode === "table" && (
                <div className="space-y-1.5">
                  <Label htmlFor="table">Table number</Label>
                  <Input id="table" value={tableNo} onChange={(e) => setTableNo(e.target.value)} placeholder="e.g. 7" />
                  <p className="text-xs text-muted-foreground">Auto-filled when you scan the table QR code.</p>
                </div>
              )}

              {mode === "eden" && (
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="tower">Tower</Label>
                    <Input id="tower" value={tower} onChange={(e) => setTower(e.target.value)} placeholder="B" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="flat">Flat</Label>
                    <Input id="flat" value={flat} onChange={(e) => setFlat(e.target.value)} placeholder="1204" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="phone-eden">Phone</Label>
                    <Input
                      id="phone-eden"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="10-digit number"
                    />
                  </div>
                </div>
              )}

              {mode !== "table" && (
                <div className="flex flex-wrap items-center gap-3 rounded-lg border border-dashed border-border p-3">
                  <Button type="button" variant="outline" size="sm" onClick={useMyLocation} disabled={locating}>
                    <LocateFixed className="size-4" /> {locating ? "Locating…" : "Use my GPS location"}
                  </Button>
                  <span className="text-xs text-muted-foreground">
                    {coords
                      ? `Pinned at ${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}`
                      : "Helps our delivery partner navigate straight to you."}
                  </span>
                </div>
              )}

              {mode === "direct" && (
                <div className="grid gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="addr">Delivery address</Label>
                    <Input id="addr" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="House, street, landmark" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="phone-direct">Phone</Label>
                    <Input
                      id="phone-direct"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="10-digit number"
                    />
                  </div>
                </div>
              )}
            </section>

            <section className="surface-card space-y-3 p-4">
              <h2 className="font-display text-lg font-bold">Delivery time</h2>
              <RadioGroup
                value={timeMode}
                onValueChange={(v) => setTimeMode(v as "asap" | "scheduled")}
                className="space-y-2"
              >
                <label className="flex items-start gap-3 rounded-lg border border-border p-3">
                  <RadioGroupItem value="asap" className="mt-1" />
                  <span>
                    <span className="block font-semibold">Standard · as soon as possible</span>
                    <span className="block text-sm text-muted-foreground">We start cooking right away.</span>
                  </span>
                </label>
                <label className="flex items-start gap-3 rounded-lg border border-border p-3">
                  <RadioGroupItem value="scheduled" className="mt-1" />
                  <span>
                    <span className="block font-semibold">Time-set delivery</span>
                    <span className="block text-sm text-muted-foreground">Pick a slot — food is cooked fresh for it.</span>
                  </span>
                </label>
              </RadioGroup>
              {timeMode === "scheduled" && (
                <div className="space-y-1.5">
                  <Label htmlFor="slot-time">
                    <Clock className="size-4" /> Delivery time
                  </Label>
                  <Input id="slot-time" type="time" value={slotTime} onChange={(e) => setSlotTime(e.target.value)} />
                  {slotLabel() && <p className="text-xs text-muted-foreground">Scheduled for {slotLabel()}</p>}
                </div>
              )}
            </section>

            <section className="surface-card space-y-3 p-4">
              <h2 className="font-display text-lg font-bold">Coupon</h2>
              <div className="flex gap-2">
                <Input
                  value={couponInput}
                  onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                  placeholder="Enter code"
                />
                <Button variant="outline" onClick={applyCoupon} disabled={!user || !couponInput}>
                  Apply
                </Button>
              </div>
              {coupon && <p className="text-sm text-success">{coupon.code} applied</p>}
            </section>

            <section className="surface-card space-y-3 p-4">
              <h2 className="font-display text-lg font-bold">Payment</h2>
              <RadioGroup value={payMethod} onValueChange={(v) => setPayMethod(v as "cod" | "upi")} className="space-y-2">
                <label className="flex items-start gap-3 rounded-lg border border-border p-3">
                  <RadioGroupItem value="cod" className="mt-1" />
                  <span>
                    <span className="block font-semibold">Cash on Delivery (COD)</span>
                    <span className="block text-sm text-muted-foreground">Pay cash or UPI to the delivery partner.</span>
                  </span>
                </label>
                <label className="flex items-start gap-3 rounded-lg border border-border p-3">
                  <RadioGroupItem value="upi" className="mt-1" />
                  <span>
                    <span className="block font-semibold">Pay now with UPI</span>
                    <span className="block text-sm text-muted-foreground">Scan our QR and confirm.</span>
                  </span>
                </label>
              </RadioGroup>
            </section>

            <section className="surface-card space-y-2 p-4">
              <Row label="Item total" value={rupees(subtotal)} />
              <Row label="Delivery fee" value={rupees(deliveryFee)} />
              {discount > 0 && <Row label="Coupon discount" value={`− ${rupees(discount)}`} />}
              <Separator />
              <Row label="To pay" value={rupees(total)} bold />
            </section>

            {loading ? null : user ? (
              <Button
                className="w-full"
                size="lg"
                disabled={busy}
                onClick={() => {
                  const problem = validateDetails();
                  if (problem) {
                    toast.error(problem);
                    return;
                  }
                  if (payMethod === "upi") setPayOpen(true);
                  else void submitOrder("cod");
                }}
              >
                {payMethod === "upi" ? (
                  <>
                    <QrCode className="size-4" /> Pay {rupees(total)} via UPI
                  </>
                ) : (
                  <>
                    <Wallet className="size-4" /> Place order · {rupees(total)} on delivery
                  </>
                )}
              </Button>
            ) : (
              <Button
                className="w-full"
                size="lg"
                onClick={() =>
                  lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin + "/checkout" })
                }
              >
                Sign in with Google to continue
              </Button>
            )}
          </>
        )}
      </main>

      <Dialog open={payOpen} onOpenChange={setPayOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Scan & pay {rupees(total)}</DialogTitle>
          </DialogHeader>
          {dynamicQr || settings?.upi_qr_url ? (
            <img
              src={dynamicQr ?? settings?.upi_qr_url ?? ""}
              alt="Mealbox91 UPI payment QR code"
              className="mx-auto w-56 rounded-lg border border-border"
            />
          ) : (
            <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              UPI QR not uploaded yet. Please choose Cash on Delivery.
            </div>
          )}
          {settings?.upi_id && <p className="text-center text-sm">UPI ID: {settings.upi_id}</p>}
          <p className="text-center text-xs text-muted-foreground">
            Pay with any UPI app, then confirm below. You'll get a 4-digit delivery OTP.
          </p>
          <Button onClick={() => void submitOrder("upi")} disabled={busy}>
            {busy ? "Placing order…" : "Place order — payment verified on delivery"}
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className={`flex justify-between text-sm ${bold ? "text-base font-bold" : ""}`}>
      <span className={bold ? "" : "text-muted-foreground"}>{label}</span>
      <span>{value}</span>
    </div>
  );
}
