import { sql } from "@vercel/postgres";
import { storedImage } from "./notification-image-storage";

export async function emailImage(token: string) {
  if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(token)) return null;
  const { rows } = await sql`SELECT image_reference FROM notification_email_images WHERE token=${token}::uuid`;
  if (!rows.length) return null;
  const reference = String(rows[0].image_reference);
  const stored = await storedImage(reference);
  if (stored) return stored;
  const match = /^data:(image\/(?:png|jpeg|gif|webp));base64,([A-Za-z0-9+/]+={0,2})$/.exec(reference);
  if (!match) return null;
  const bytes = Buffer.from(match[2], "base64");
  return { contentType: match[1], byteSize: bytes.length, chunks: (async function* () { yield new Uint8Array(bytes); })() };
}

export async function prepareEmailImage(token: string | null, origin: string) {
  if (!token) return { imageSrc: undefined, attachments: undefined };
  const image = await emailImage(token);
  if (!image) throw new Error("The notification image is unavailable. Restore it before retrying this email.");
  if (image.byteSize > 2 * 1024 * 1024) {
    return { imageSrc: `${origin}/api/email/images/${token}`, attachments: undefined };
  }
  const chunks: Uint8Array[] = [];
  for await (const chunk of image.chunks) chunks.push(chunk);
  const extension = image.contentType.split("/")[1];
  return {
    imageSrc: "cid:notification-image",
    attachments: [{ name: `greeting.${extension}`, contentType: image.contentType,
      contentBytes: Buffer.concat(chunks).toString("base64"), contentId: "notification-image", isInline: true as const }],
  };
}
