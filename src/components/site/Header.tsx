import { Link } from "@tanstack/react-router";
import { ShoppingBag, UtensilsCrossed } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCart } from "@/lib/cart";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { toast } from "sonner";

export function Header() {
  const { count } = useCart();
  const { user } = useAuth();

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
      <div className="mx-auto flex h-16 max-w-5xl items-center gap-3 px-4">
        <Link to="/" className="flex items-center gap-2">
          <span className="hero-gradient flex size-9 items-center justify-center rounded-xl text-primary-foreground">
            <UtensilsCrossed className="size-5" />
          </span>
          <span className="font-display text-lg font-bold tracking-tight">mealbox91</span>
        </Link>

        <nav className="ml-auto flex items-center gap-1">
          <Button asChild variant="ghost" size="sm">
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
          <Button asChild size="sm" className="relative">
            <Link to="/checkout">
              <ShoppingBag className="size-4" />
              Cart
              {count > 0 && (
                <span className="ml-1 rounded-full bg-primary-foreground px-1.5 text-xs font-bold text-primary">
                  {count}
                </span>
              )}
            </Link>
          </Button>
        </nav>
      </div>
    </header>
  );
}
