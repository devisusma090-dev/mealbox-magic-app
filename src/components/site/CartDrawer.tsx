import { Link } from "@tanstack/react-router";
import { Minus, Plus, ShoppingBag, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useCart } from "@/lib/cart";
import { useMenu } from "@/hooks/useStoreData";
import { rupees } from "@/lib/menu-types";

export function CartDrawer() {
  const { lines, count, subtotal, setQty, add } = useCart();
  const { data: menu } = useMenu();
  const addons = (menu?.addons ?? []).filter((a) => a.available);

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button size="sm" className="relative">
          <ShoppingBag className="size-4" />
          Cart
          {count > 0 && (
            <span className="ml-1 rounded-full bg-primary-foreground px-1.5 text-xs font-bold text-primary">
              {count}
            </span>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="flex w-full flex-col gap-0 sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Your cart</SheetTitle>
          <SheetDescription>Add a chilled drink before you check out.</SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-4 pb-4">
          {lines.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Your cart is empty.</p>
          ) : (
            <ul className="divide-y divide-border">
              {lines.map((l) => (
                <li key={l.key} className="flex items-start gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold">{l.name}</p>
                    {l.note && <p className="text-xs text-muted-foreground">Note: {l.note}</p>}
                    <p className="text-xs text-muted-foreground">{rupees(l.price)} each</p>
                  </div>
                  <div className="flex items-center gap-1 rounded-lg border border-border p-1">
                    <Button size="icon" variant="ghost" className="size-7" onClick={() => setQty(l.key, l.qty - 1)}>
                      {l.qty === 1 ? <Trash2 className="size-4" /> : <Minus className="size-4" />}
                    </Button>
                    <span className="w-5 text-center text-sm font-bold">{l.qty}</span>
                    <Button size="icon" variant="ghost" className="size-7" onClick={() => setQty(l.key, l.qty + 1)}>
                      <Plus className="size-4" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {addons.length > 0 && (
            <div className="mt-6">
              <h3 className="font-display text-sm font-bold uppercase tracking-wide text-muted-foreground">
                Cold drinks & add-ons
              </h3>
              <ul className="mt-2 space-y-2">
                {addons.map((a) => (
                  <li key={a.id} className="flex items-center gap-3 rounded-lg border border-border p-3">
                    <span className="min-w-0 flex-1 text-sm font-medium">{a.name}</span>
                    <span className="text-sm text-muted-foreground">{rupees(Number(a.price))}</span>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => add({ id: a.id, kind: "addon", name: a.name, price: Number(a.price), note: "" })}
                    >
                      Add
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="border-t border-border p-4">
          <div className="mb-3 flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Subtotal</span>
            <span className="font-semibold">{rupees(subtotal)}</span>
          </div>
          <Button asChild className="w-full" disabled={lines.length === 0}>
            <Link to="/checkout">Checkout</Link>
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
