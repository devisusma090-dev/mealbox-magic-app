import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Bike, ShieldCheck } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { adminLogin } from "@/lib/admin.functions";
import { ADMIN_PASSCODE_KEY } from "@/lib/admin-session";
import { DeliveryPortal } from "@/components/site/DeliveryPortal";

type View = "choose" | "admin" | "delivery";

export function Footer({ phone, zomatoUrl }: { phone?: string | undefined; zomatoUrl?: string | null | undefined }) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<View>("choose");
  const [passcode, setPasscode] = useState("");
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const login = useServerFn(adminLogin);

  const openModal = () => {
    setView("choose");
    setPasscode("");
    setOpen(true);
  };

  const submit = async () => {
    setBusy(true);
    try {
      await login({ data: { passcode } });
      sessionStorage.setItem(ADMIN_PASSCODE_KEY, passcode);
      setOpen(false);
      setPasscode("");
      navigate({ to: "/admin" });
    } catch {
      toast.error("Incorrect passcode");
    } finally {
      setBusy(false);
    }
  };

  return (
    <footer className="mt-16 border-t border-border bg-muted/50">
      <div className="mx-auto flex max-w-5xl flex-col items-center gap-3 px-4 py-10 text-center">
        <p className="text-sm text-muted-foreground">
          Fresh home-style meal boxes, delivered hot across Eden Court & nearby.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3 text-sm">
          {phone && (
            <a className="text-primary underline-offset-4 hover:underline" href={`tel:${phone}`}>
              Call {phone}
            </a>
          )}
          {zomatoUrl && (
            <a
              className="text-primary underline-offset-4 hover:underline"
              href={zomatoUrl}
              target="_blank"
              rel="noreferrer"
            >
              Order on Zomato
            </a>
          )}
        </div>
        <button
          type="button"
          onClick={openModal}
          className="mt-2 cursor-default text-xs text-muted-foreground"
          aria-label="Mealbox91 copyright"
        >
          Mealbox91 © 2026
        </button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {view === "choose" ? "Staff access" : view === "admin" ? "Admin panel" : "Delivery portal"}
            </DialogTitle>
          </DialogHeader>

          {view === "choose" && (
            <div className="grid gap-3">
              <Button variant="outline" className="h-auto justify-start py-4" onClick={() => setView("admin")}>
                <ShieldCheck className="size-5" />
                <span className="text-left">
                  <span className="block font-semibold">Admin Panel</span>
                  <span className="block text-xs text-muted-foreground">Menu, settings, sales</span>
                </span>
              </Button>
              <Button variant="outline" className="h-auto justify-start py-4" onClick={() => setView("delivery")}>
                <Bike className="size-5" />
                <span className="text-left">
                  <span className="block font-semibold">Delivery Portal</span>
                  <span className="block text-xs text-muted-foreground">Live queue & OTP completion</span>
                </span>
              </Button>
            </div>
          )}

          {view === "admin" && (
            <div className="space-y-3">
              <Input
                type="password"
                autoFocus
                placeholder="Passcode"
                value={passcode}
                onChange={(e) => setPasscode(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && submit()}
              />
              <Button className="w-full" onClick={submit} disabled={busy || !passcode}>
                {busy ? "Checking…" : "Enter admin panel"}
              </Button>
              <Button variant="ghost" className="w-full" onClick={() => setView("choose")}>
                Back
              </Button>
            </div>
          )}

          {view === "delivery" && (
            <div className="space-y-3">
              <DeliveryPortal />
              <Button variant="ghost" className="w-full" onClick={() => setView("choose")}>
                Back
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </footer>
  );
}
