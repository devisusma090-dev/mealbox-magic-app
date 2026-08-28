import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Bike, MapPin, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { deliveryCompleteByOtp, deliveryMarkOut, deliveryQueue } from "@/lib/delivery.functions";
import { rupees } from "@/lib/menu-types";
import { useOrderEvents } from "@/lib/live";
import { ding, primeAudio } from "@/lib/alarm";
import { mapsUrl } from "@/lib/notify";

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
};

export function DeliveryPortal() {
  const [phoneInput, setPhoneInput] = useState("");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
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
        <Button className="w-full" disabled={phoneInput.length !== 10} onClick={() => setPhone(phoneInput)}>
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
    </div>
  );
}
