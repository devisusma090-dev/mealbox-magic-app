import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { adminLogin } from "@/lib/admin.functions";
import { ADMIN_PASSCODE_KEY } from "@/lib/admin-session";

export function Footer({ phone, zomatoUrl }: { phone?: string | undefined; zomatoUrl?: string | null | undefined }) {
  const [open, setOpen] = useState(false);
  const [passcode, setPasscode] = useState("");
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const login = useServerFn(adminLogin);

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
          onClick={() => setOpen(true)}
          className="mt-2 cursor-default text-xs text-muted-foreground"
          aria-label="Mealbox91 copyright"
        >
          Mealbox91 © 2026
        </button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Staff access</DialogTitle>
          </DialogHeader>
          <Input
            type="password"
            autoFocus
            placeholder="Passcode"
            value={passcode}
            onChange={(e) => setPasscode(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
          />
          <Button onClick={submit} disabled={busy || !passcode}>
            {busy ? "Checking…" : "Enter admin panel"}
          </Button>
        </DialogContent>
      </Dialog>
    </footer>
  );
}
