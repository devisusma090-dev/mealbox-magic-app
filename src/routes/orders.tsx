import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { CheckCircle2, Copy, Gift } from "lucide-react";
import { Header } from "@/components/site/Header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { rupees, type CartLine, type Coupon, type OrderRow } from "@/lib/menu-types";
import { applyReferralCode } from "@/lib/orders.functions";
import { lovable } from "@/integrations/lovable/index";

export const Route = createFileRoute("/orders")({
  head: () => ({
    meta: [
      { title: "My orders & referrals — Mealbox91" },
      { name: "description", content: "Track your recent Mealbox91 orders, delivery OTPs and referral rewards." },
      { property: "og:title", content: "My orders & referrals — Mealbox91" },
      { property: "og:description", content: "Track recent orders, delivery OTPs and referral rewards." },
    ],
  }),
  component: OrdersPage,
});

function OrdersPage() {
  const { user, loading } = useAuth();
  const qc = useQueryClient();
  const runApplyReferral = useServerFn(applyReferralCode);
  const [refCode, setRefCode] = useState("");

  const { data } = useQuery({
    queryKey: ["my-data", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const [orders, profile, coupons] = await Promise.all([
        supabase.from("orders").select("*").order("created_at", { ascending: false }),
        supabase.from("profiles").select("*").eq("id", user!.id).maybeSingle(),
        supabase.from("coupons").select("*").eq("owner_user_id", user!.id),
      ]);
      return {
        orders: (orders.data ?? []) as unknown as OrderRow[],
        profile: profile.data as { referral_code: string; referred_by: string | null } | null,
        coupons: (coupons.data ?? []) as unknown as Coupon[],
      };
    },
  });

  if (!loading && !user) {
    return (
      <div className="min-h-screen">
        <Header />
        <main className="mx-auto max-w-md px-4 py-16 text-center">
          <h1 className="font-display text-2xl font-bold">Sign in to see your orders</h1>
          <Button
            className="mt-6"
            onClick={() => lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin + "/orders" })}
          >
            Continue with Google
          </Button>
        </main>
      </div>
    );
  }

  const referralLink = data?.profile ? `https://mealbox91.in/?ref=${data.profile.referral_code}` : "";

  return (
    <div className="min-h-screen pb-12">
      <Header />
      <main className="mx-auto max-w-2xl space-y-6 px-4 py-6">
        <h1 className="font-display text-3xl font-bold">My orders</h1>

        <section className="surface-card space-y-3 p-4">
          <div className="flex items-center gap-2">
            <Gift className="size-5 text-primary" />
            <h2 className="font-display text-lg font-bold">Refer & earn</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            Share your code. When your friend completes their first order, you get a discount coupon automatically.
          </p>
          {data?.profile && (
            <div className="flex items-center gap-2">
              <Input readOnly value={data.profile.referral_code} className="font-mono font-bold" />
              <Button
                variant="outline"
                size="icon"
                onClick={() => {
                  navigator.clipboard.writeText(referralLink);
                  toast.success("Referral link copied");
                }}
              >
                <Copy className="size-4" />
              </Button>
            </div>
          )}

          {data?.profile && !data.profile.referred_by && (
            <div className="flex gap-2">
              <Input
                placeholder="Got a friend's code?"
                value={refCode}
                onChange={(e) => setRefCode(e.target.value.toUpperCase())}
              />
              <Button
                variant="outline"
                onClick={async () => {
                  try {
                    await runApplyReferral({ data: { code: refCode } });
                    toast.success("Referral code applied");
                    qc.invalidateQueries({ queryKey: ["my-data"] });
                  } catch (e) {
                    toast.error(e instanceof Error ? e.message : "Could not apply code");
                  }
                }}
              >
                Apply
              </Button>
            </div>
          )}

          {data?.coupons && data.coupons.length > 0 && (
            <div className="space-y-1">
              <p className="text-sm font-semibold">Your reward coupons</p>
              {data.coupons.map((c) => (
                <div key={c.id} className="flex items-center justify-between rounded-lg border border-border p-2 text-sm">
                  <span className="font-mono font-bold">{c.code}</span>
                  <span>{rupees(c.discount_amount)} off</span>
                  <Badge variant={c.used ? "secondary" : "default"}>{c.used ? "Used" : "Available"}</Badge>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="space-y-3">
          {data?.orders.length === 0 && (
            <p className="text-sm text-muted-foreground">No orders in the last 48 hours.</p>
          )}
          {data?.orders.map((o) => (
            <article
              key={o.id}
              className={`surface-card space-y-2 p-4 ${
                o.status === "completed" ? "border-emerald-500/60 bg-emerald-500/10" : ""
              }`}
            >
              {o.status === "completed" && (
                <div className="flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-emerald-50">
                  <CheckCircle2 className="size-4" /> Order Delivered Successfully
                </div>
              )}
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">{new Date(o.created_at).toLocaleString("en-IN")}</p>
                <Badge variant={o.status === "cancelled" ? "destructive" : o.status === "completed" ? "default" : "secondary"}>
                  {o.status}
                </Badge>
              </div>
              <ul className="text-sm">
                {(o.items as CartLine[]).map((l) => (
                  <li key={l.key}>
                    {l.qty} × {l.name}
                    {l.note ? ` — ${l.note}` : ""}
                  </li>
                ))}
              </ul>
              <div className="flex items-center justify-between border-t border-border pt-2">
                <span className="text-sm">
                  {o.status === "completed" ? (
                    <span className="text-muted-foreground">OTP verified</span>
                  ) : (
                    <>
                      Delivery OTP: <strong className="font-mono tracking-widest">{o.delivery_otp}</strong>
                    </>
                  )}
                </span>
                <strong>{rupees(o.total)}</strong>
              </div>
            </article>
          ))}
        </section>
      </main>
    </div>
  );
}
