import { useCallback, useRef, useState } from "react";
import Cropper from "react-easy-crop";
import { toast } from "sonner";
import { ImagePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";
import { useServerFn } from "@tanstack/react-start";
import { adminUploadImage } from "@/lib/upload.functions";
import { getAdminPasscode } from "@/lib/admin-session";

type Area = { x: number; y: number; width: number; height: number };

async function cropToDataUrl(src: string, area: Area): Promise<string> {
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
  const size = Math.min(1000, Math.round(area.width));
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = Math.round((area.height / area.width) * size);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not process the image.");
  ctx.drawImage(image, area.x, area.y, area.width, area.height, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.85);
}

export function ImageCropUpload({ value, onChange }: { value: string; onChange: (url: string) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [src, setSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [area, setArea] = useState<Area | null>(null);
  const [busy, setBusy] = useState(false);
  const upload = useServerFn(adminUploadImage);

  const onCropComplete = useCallback((_: unknown, pixels: Area) => setArea(pixels), []);

  const pick = (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) return toast.error("Please choose an image file.");
    const reader = new FileReader();
    reader.onload = () => {
      setSrc(String(reader.result));
      setCrop({ x: 0, y: 0 });
      setZoom(1);
    };
    reader.readAsDataURL(file);
  };

  const save = async () => {
    if (!src || !area) return;
    setBusy(true);
    try {
      const dataUrl = await cropToDataUrl(src, area);
      const res = await upload({ data: { passcode: getAdminPasscode(), dataUrl, folder: "items" } });
      onChange(res.url);
      setSrc(null);
      toast.success("Image uploaded");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex items-center gap-3">
      {value ? (
        <img src={value} alt="Menu item" className="size-14 rounded-lg border border-border object-cover" />
      ) : (
        <div className="grid size-14 place-items-center rounded-lg border border-dashed border-border text-muted-foreground">
          <ImagePlus className="size-5" />
        </div>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => pick(e.target.files?.[0])}
      />
      <Button type="button" size="sm" variant="outline" onClick={() => inputRef.current?.click()}>
        {value ? "Change photo" : "Upload photo"}
      </Button>
      {value && (
        <Button type="button" size="sm" variant="ghost" onClick={() => onChange("")}>
          Remove
        </Button>
      )}

      <Dialog open={!!src} onOpenChange={(o) => !o && setSrc(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Crop photo</DialogTitle>
          </DialogHeader>
          <div className="relative h-64 w-full overflow-hidden rounded-lg bg-muted">
            {src && (
              <Cropper
                image={src}
                crop={crop}
                zoom={zoom}
                aspect={4 / 3}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={onCropComplete}
              />
            )}
          </div>
          <Slider value={[zoom]} min={1} max={3} step={0.05} onValueChange={(v) => setZoom(v[0] ?? 1)} />
          <Button onClick={save} disabled={busy}>
            {busy ? "Uploading…" : "Crop & upload"}
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
