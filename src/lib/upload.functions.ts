import { createServerFn } from "@tanstack/react-start";
import { adminDb } from "./admin.server";

const TEN_YEARS = 60 * 60 * 24 * 3650;

export const adminUploadImage = createServerFn({ method: "POST" })
  .inputValidator((input: { passcode: string; dataUrl: string; folder?: string }) => ({
    passcode: String(input.passcode ?? ""),
    dataUrl: String(input.dataUrl ?? ""),
    folder: String(input.folder ?? "items").replace(/[^a-z0-9-]/gi, "") || "items",
  }))
  .handler(async ({ data }) => {
    const db = await adminDb(data.passcode);

    const match = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/.exec(data.dataUrl);
    if (!match) throw new Error("Unsupported image format.");
    const contentType = match[1]!;
    const base64 = match[2]!;

    const binary = atob(base64);
    if (binary.length > 5_000_000) throw new Error("Image is larger than 5 MB.");
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);

    const ext = contentType.split("/")[1]?.replace("jpeg", "jpg") ?? "jpg";
    const path = `${data.folder}/${crypto.randomUUID()}.${ext}`;

    const { error } = await db.storage.from("menu-images").upload(path, bytes, {
      contentType,
      upsert: false,
    });
    if (error) throw new Error(error.message);

    const { data: signed, error: signError } = await db.storage
      .from("menu-images")
      .createSignedUrl(path, TEN_YEARS);
    if (signError || !signed?.signedUrl) throw new Error(signError?.message ?? "Could not create image URL.");

    return { url: signed.signedUrl, path };
  });
