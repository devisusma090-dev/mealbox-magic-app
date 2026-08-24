import { Phone, MessageCircle, PartyPopper } from "lucide-react";
import { Button } from "@/components/ui/button";

export function CateringBanner({
  title,
  phone,
  whatsapp,
}: {
  title: string;
  phone: string;
  whatsapp: string;
}) {
  return (
    <section className="hero-gradient overflow-hidden rounded-2xl px-5 py-6 text-primary-foreground shadow-[var(--shadow-lift)]">
      <div className="flex items-start gap-3">
        <PartyPopper className="mt-0.5 size-6 shrink-0" />
        <div className="flex-1">
          <h2 className="text-xl font-bold">{title}</h2>
          <p className="mt-1 text-sm opacity-90">
            Parties, office lunches, poojas and get-togethers — bulk thalis and live counters on order.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button asChild variant="secondary" size="sm">
              <a href={`tel:${phone}`}>
                <Phone className="size-4" /> Call now
              </a>
            </Button>
            <Button asChild variant="secondary" size="sm">
              <a
                href={`https://wa.me/91${String(whatsapp).replace(/\D/g, "").slice(-10)}?text=${encodeURIComponent(
                  "Hi Mealbox91, I'd like a catering quote.",
                )}`}
                target="_blank"
                rel="noreferrer"
              >
                <MessageCircle className="size-4" /> WhatsApp
              </a>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
