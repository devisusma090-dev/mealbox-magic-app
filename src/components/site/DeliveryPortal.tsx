import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Bike, IndianRupee, MapPin, QrCode, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { deliveryCompleteByOtp, deliveryMarkOut, deliveryQueue } from "@/lib/delivery.functions";
import { rupees } from "@/lib/menu-types";
import { useOrderEvents } from "@/lib/live";
import { ding, primeAudio } from "@/lib/alarm";
import { mapsUrl } from "@/lib/notify";
import { upiQrImage } from "@/lib/upi";

type QueueOrder = {
  id: string;
  mode: string;
  tower: string | null;
  flat: string | null;
  address: string | null;
  table_no: string | null;
  customer_name: string | null;
  phone: string | null;
  items: { key: string; name: string; qty: number; note?: string }[];
  total: number;
  status: string;
  created_at: string;
  lat?: number | null;
  lng?: number | null;
  payment_method?: string | null;
  paid?: boolean | null;
};

export function DeliveryPortal() {
  const [phoneInput, setPhoneInput] = useState("");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [collect, setCollect] = useState<{ order: QueueOrder; method: "cash" | "upi" } | null>(null);
  const [collectOtp, setCollectOtp] = useState("");
  const qc = useQueryClient();
  const runQueue = useServerFn(deliveryQueue);
  const runOut = useServerFn(deliveryMarkOut);
  const runComplete = useServerFn(deliveryCompleteByOtp);

  const { data, isFetching, error } = useQuery({
    queryKey: ["delivery-queue", phone],
    queryFn: () => runQueue({ data: { phone } }),
    enabled: phone.length > 0,
    refetchInterval: 15000,
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ["delivery-queue"] });

  useOrderEvents((event) => {
    refresh();
    if (event.kind === "new") ding();
  }, phone.length > 0);

  if (!phone) {
    return (
      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="staff-phone">Your phone number</Label>
          <Input
            id="staff-phone"
            inputMode="numeric"
            placeholder="10-digit number"
            value={phoneInput}
            onChange={(e) => setPhoneInput(e.target.value.replace(/\D/g, "").slice(0, 10))}
          />
        </div>
        <Button className="w-full" disabled={phoneInput.length !== 10} onClick={() => { primeAudio(); setPhone(phoneInput); }}>
          <Bike className="size-4" /> Open delivery queue
        </Button>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-3 text-sm">
        <p className="text-destructive">{error instanceof Error ? error.message : "Could not open the portal."}</p>
        <Button variant="outline" onClick={() => setPhone("")}>
          Use another number
        </Button>
      </div>
    );
  }

  const orders = (data?.orders ?? []) as unknown as QueueOrder[];

  return (
    <div className="space-y-4">
      <div className="flex items-end gap-2">
        <div className="flex-1 space-y-1.5">
          <Label htmlFor="delivery-otp">Customer OTP</Label>
          <Input
            id="delivery-otp"
            inputMode="numeric"
            maxLength={4}
            placeholder="4-digit"
            value={otp}
            onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 4))}
          />
        </div>
        <Button
          disabled={otp.length !== 4}
          onClick={async () => {
            try {
              const res = await runComplete({ data: { phone, otp } });
              toast.success(`Order completed — ${rupees(res.total)}`);
              setOtp("");
              refresh();
            } catch (e) {
              toast.error(e instanceof Error ? e.message : "Could not complete order");
            }
          }}
        >
          Complete
        </Button>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">Live queue · staff {phone}</p>
        <Button size="sm" variant="ghost" onClick={refresh} disabled={isFetching}>
          <RefreshCw className={`size-4 ${isFetching ? "animate-spin" : ""}`} /> Refresh
        </Button>
      </div>

      <div className="max-h-[45vh] space-y-3 overflow-y-auto pr-1">
        {orders.length === 0 && <p className="text-sm text-muted-foreground">No active orders right now.</p>}
        {orders.map((o) => (
          <div key={o.id} className="space-y-2 rounded-lg border border-border p-3 text-sm">
            <div className="flex items-center justify-between gap-2">
              <span className="font-semibold">{o.customer_name || "Guest"}</span>
              <div className="flex items-center gap-1">
                <Badge variant={o.paid ? "default" : "outline"}>
                  {o.paid ? "Paid online" : "Collect payment"}
                </Badge>
                <Badge variant={o.status === "pending" ? "secondary" : "default"}>
                  {o.status === "pending" ? "New" : "Out for delivery"}
                </Badge>
              </div>
            </div>
            <p className="text-muted-foreground">
              {o.mode === "table"
                ? `Table ${o.table_no ?? "—"}`
                : o.mode === "eden"
                  ? `Eden Court · Tower ${o.tower ?? "—"}, Flat ${o.flat ?? "—"}`
                  : o.address || "Direct delivery"}
            </p>
            <ul className="text-muted-foreground">
              {(o.items ?? []).map((l) => (
                <li key={l.key}>
                  {l.qty}× {l.name} {l.note ? `(${l.note})` : ""}
                </li>
              ))}
            </ul>
            <div className="flex items-center justify-between gap-2">
              <span className="font-semibold">{rupees(Number(o.total))}</span>
              <div className="flex gap-2">
                {mapsUrl(o.lat, o.lng) && (
                  <Button size="sm" variant="outline" asChild>
                    <a href={mapsUrl(o.lat, o.lng)!} target="_blank" rel="noreferrer">
                      <MapPin className="size-4" /> Navigate
                    </a>
                  </Button>
                )}
                {o.phone && (
                  <Button size="sm" variant="outline" asChild>
                    <a href={`tel:${o.phone}`}>Call</a>
                  </Button>
                )}
                <Button size="sm" variant="secondary" onClick={() => { setCollect({ order: o, method: o.paid ? "upi" : "cash" }); setCollectOtp(""); }}>
                  <IndianRupee className="size-4" /> Collect & deliver
                </Button>
                {o.status === "pending" && (
                  <Button
                    size="sm"
                    onClick={async () => {
                      try {
                        await runOut({ data: { phone, id: o.id } });
                        refresh();
                      } catch (e) {
                        toast.error(e instanceof Error ? e.message : "Failed");
                      }
                    }}
                  >
                    Pick up
                  </Button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      <Dialog open={!!collect} onOpenChange={(v) => !v && setCollect(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Collect {collect ? rupees(Number(collect.order.total)) : ""}</DialogTitle>
          </DialogHeader>
          {collect && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant={collect.method === "cash" ? "default" : "outline"}
                  onClick={() => setCollect({ ...collect, method: "cash" })}
                >
                  <IndianRupee className="size-4" /> Cash
                </Button>
                <Button
                  variant={collect.method === "upi" ? "default" : "outline"}
                  onClick={() => setCollect({ ...collect, method: "upi" })}
                >
                  <QrCode className="size-4" /> UPI QR
                </Button>
              </div>

              {collect.method === "upi" && (
                <div className="space-y-2 text-center">
                  {upiQrImage(data?.payment?.upi_id ?? "", Number(collect.order.total), `Mealbox91 order`) ? (
                    <img
                      src={upiQrImage(data?.payment?.upi_id ?? "", Number(collect.order.total), "Mealbox91 order")!}
                      alt={`UPI QR for ${rupees(Number(collect.order.total))}`}
                      className="mx-auto w-56 rounded-lg border border-border"
                    />
                  ) : data?.payment?.upi_qr_url ? (
                    <img
                      src={data.payment.upi_qr_url}
                      alt="Mealbox91 UPI QR"
                      className="mx-auto w-56 rounded-lg border border-border"
                    />
                  ) : (
                    <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
                      No UPI details set by admin yet.
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Customer scans this from your screen — money goes straight to the restaurant UPI account.
                  </p>
                </div>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="collect-otp">Customer 4-digit OTP</Label>
                <Input
                  id="collect-otp"
                  inputMode="numeric"
                  maxLength={4}
                  value={collectOtp}
                  onChange={(e) => setCollectOtp(e.target.value.replace(/\D/g, "").slice(0, 4))}
                />
              </div>
              <Button
                className="w-full"
                disabled={collectOtp.length !== 4}
                onClick={async () => {
                  try {
                    const res = await runComplete({ data: { phone, otp: collectOtp, paymentMethod: collect.method } });
                    toast.success(
                      `${collect.method === "cash" ? "Cash collected" : "UPI received"} — delivered ${rupees(res.total)}`,
                    );
                    setCollect(null);
                    setCollectOtp("");
                    refresh();
                  } catch (e) {
                    toast.error(e instanceof Error ? e.message : "Could not complete order");
                  }
                }}
              >
                {collect.method === "cash" ? "Cash collected — mark delivered" : "UPI received — mark delivered"}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
