import { useState } from "react";
import { Minus, Plus, StickyNote } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useCart } from "@/lib/cart";
import { rupees } from "@/lib/menu-types";

type Props = {
  id: string;
  kind: "item" | "addon";
  name: string;
  description?: string | null;
  price: number;
  isVeg?: boolean;
  available?: boolean;
  disabled?: boolean;
};

export function MenuItemRow({ id, kind, name, description, price, isVeg, available = true, disabled }: Props) {
  const { lines, add, setQty, setNote } = useCart();
  const line = lines.find((l) => l.key === `${kind}:${id}`);
  const [showNote, setShowNote] = useState(false);

  return (
    <article className="surface-card flex flex-col gap-3 p-4">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            {typeof isVeg === "boolean" && (
              <span
                className={`inline-flex size-3.5 items-center justify-center rounded-[3px] border ${
                  isVeg ? "border-success" : "border-destructive"
                }`}
              >
                <span className={`size-1.5 rounded-full ${isVeg ? "bg-success" : "bg-destructive"}`} />
              </span>
            )}
            <h3 className="truncate font-display text-base font-bold">{name}</h3>
            {!available && <Badge variant="secondary">Sold out</Badge>}
          </div>
          {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
          <p className="mt-2 font-semibold">{rupees(price)}</p>
        </div>

        <div className="shrink-0">
          {!line ? (
            <Button
              size="sm"
              disabled={disabled || !available}
              onClick={() => add({ id, kind, name, price, note: "" })}
            >
              Add
            </Button>
          ) : (
            <div className="flex items-center gap-1 rounded-lg border border-border p-1">
              <Button size="icon" variant="ghost" className="size-7" onClick={() => setQty(line.key, line.qty - 1)}>
                <Minus className="size-4" />
              </Button>
              <span className="w-6 text-center text-sm font-bold">{line.qty}</span>
              <Button size="icon" variant="ghost" className="size-7" onClick={() => setQty(line.key, line.qty + 1)}>
                <Plus className="size-4" />
              </Button>
            </div>
          )}
        </div>
      </div>

      {line && kind === "item" && (
        <div>
          {!showNote && !line.note ? (
            <button
              type="button"
              className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
              onClick={() => setShowNote(true)}
            >
              <StickyNote className="size-3.5" /> Add cooking instruction
            </button>
          ) : (
            <Textarea
              rows={2}
              placeholder="e.g. less spicy, no onion"
              value={line.note}
              onChange={(e) => setNote(line.key, e.target.value)}
            />
          )}
        </div>
      )}
    </article>
  );
}
