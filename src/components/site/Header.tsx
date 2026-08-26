import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { QrCode, UtensilsCrossed } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CartDrawer } from "@/components/site/CartDrawer";
import { useAuth } from "@/hooks/useAuth";
import { useSettings } from "@/hooks/useStoreData";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { toast } from "sonner";

export function Header() {
  const { user } = useAuth();
  const { data: settings } = useSettings();
  const [payOpen, setPayOpen] = useState(false);

  const signIn = async () => {
    const result = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
    if (result.error) toast.error("Could not sign in. Please try again.");
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    toast.success("Signed out");
  };

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-5xl items-center gap-2 px-4">
        <Link to="/" className="flex items-center gap-2">
          <span className="hero-gradient flex size-9 items-center justify-center rounded-xl text-primary-foreground">
            <UtensilsCrossed className="size-5" />
          </span>
          <span className="font-display text-lg font-bold tracking-tight">mealbox91</span>
        </Link>

        <nav className="ml-auto flex items-center gap-1">
          <Button variant="ghost" size="sm" onClick={() => setPayOpen(true)}>
            <QrCode className="size-4" />
            <span className="hidden sm:inline">Pay with UPI</span>
          </Button>
          <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
            <Link to="/orders">My orders</Link>
          </Button>
          {user ? (
            <Button variant="ghost" size="sm" onClick={signOut}>
              Sign out
            </Button>
          ) : (
            <Button variant="ghost" size="sm" onClick={signIn}>
              Sign in
            </Button>
          )}
          <CartDrawer />
        </nav>
      </div>

      <Dialog open={payOpen} onOpenChange={setPayOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Pay with UPI</DialogTitle>
          </DialogHeader>
          {settings?.upi_qr_url ? (
            <img
              src={settings.upi_qr_url}
              alt="Mealbox91 UPI payment QR code"
              className="mx-auto w-full max-w-64 rounded-xl border border-border"
            />
          ) : (
            <p className="text-sm text-muted-foreground">The UPI QR code will appear here once the store uploads it.</p>
          )}
          {settings?.upi_id && (
            <p className="text-center text-sm">
              UPI ID: <span className="font-mono font-semibold">{settings.upi_id}</span>
            </p>
          )}
          <p className="text-center text-xs text-muted-foreground">
            Pay the exact order amount, then confirm at checkout.
          </p>
        </DialogContent>
      </Dialog>
    </header>
  );
}
