import { randomUUID } from "node:crypto";
import { sql } from "@vercel/postgres";
import { NOTIFICATION_IMAGE_CHUNK_BYTES, NOTIFICATION_IMAGE_CHUNK_BASE64_LENGTH, NOTIFICATION_IMAGE_MAX_BYTES } from "./notification-image";

const MIME_TYPES = ["image/png", "image/jpeg", "image/gif", "image/webp"];
const PREFIX = "notification-image:";
const validId = (id: string) => typeof id === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);

function matchesSignature(bytes: Buffer, mime: string) {
  if (mime === "image/png") return bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  if (mime === "image/jpeg") return bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  if (mime === "image/gif") return /^GIF8[79]a$/.test(bytes.subarray(0, 6).toString());
  return mime === "image/webp" && bytes.subarray(0, 4).toString() === "RIFF" && bytes.subarray(8, 12).toString() === "WEBP";
}

export async function beginImageUpload({ contentType, size }: { contentType: string; size: number }) {
  if (!MIME_TYPES.includes(contentType) || !Number.isSafeInteger(size) || size < 1 || size > NOTIFICATION_IMAGE_MAX_BYTES) {
    throw new Error("Choose a PNG, JPEG, GIF, or WebP image up to 10 MB.");
  }
  const id = randomUUID();
  await sql`INSERT INTO notification_image_assets(id, content_type, byte_size)
    VALUES (${id}, ${contentType}, ${size})`;
  return { id };
}

export async function appendImageChunk(id: string, index: number, data: string) {
  if (!validId(id) || !Number.isSafeInteger(index) || index < 0 ||
    index >= Math.ceil(NOTIFICATION_IMAGE_MAX_BYTES / NOTIFICATION_IMAGE_CHUNK_BYTES) ||
    typeof data !== "string" || data.length > NOTIFICATION_IMAGE_CHUNK_BASE64_LENGTH ||
    !/^[A-Za-z0-9+/]+={0,2}$/.test(data)) throw new Error("Invalid image upload chunk.");
  const { rows } = await sql`SELECT content_type, byte_size FROM notification_image_assets
    WHERE id = ${id} AND created_at > NOW() - INTERVAL '24 hours'`;
  if (!rows.length) throw new Error("This image upload expired. Please choose the image again.");
  const bytes = Buffer.from(data, "base64");
  const totalSize = Number(rows[0].byte_size);
  const expectedSize = Math.min(NOTIFICATION_IMAGE_CHUNK_BYTES, totalSize - index * NOTIFICATION_IMAGE_CHUNK_BYTES);
  if (expectedSize < 1 || bytes.length !== expectedSize || bytes.toString("base64") !== data) {
    throw new Error("The image upload is incomplete or invalid. Please try again.");
  }
  if (index === 0 && !matchesSignature(bytes, String(rows[0].content_type))) throw new Error("The image content does not match its file type.");
  // Retrying a request may repeat a part; an existing part is immutable.
  const inserted = await sql`
    INSERT INTO notification_image_chunks(asset_id, part_index, data, byte_size)
    SELECT id, ${index}, ${data}, ${bytes.length} FROM notification_image_assets
    WHERE id = ${id} AND completed = false AND created_at > NOW() - INTERVAL '24 hours'
    ON CONFLICT (asset_id, part_index) DO NOTHING RETURNING part_index
  `;
  if (!inserted.rows.length) {
    const existing = await sql`SELECT part_index FROM notification_image_chunks
      WHERE asset_id = ${id} AND part_index = ${index} AND data = ${data}`;
    if (!existing.rows.length) throw new Error("An uploaded image part cannot be replaced. Please choose the image again.");
  }
}

export async function prepareImageReference(id: string) {
  if (!validId(id)) throw new Error("Invalid image upload.");
  const { rows } = await sql`
    SELECT a.byte_size, COUNT(c.part_index)::integer AS parts, COALESCE(SUM(c.byte_size), 0)::integer AS uploaded
    FROM notification_image_assets a LEFT JOIN notification_image_chunks c ON c.asset_id = a.id
    WHERE a.id = ${id} AND a.created_at > NOW() - INTERVAL '24 hours'
    GROUP BY a.id, a.byte_size
  `;
  if (!rows.length || Number(rows[0].uploaded) !== Number(rows[0].byte_size) ||
    Number(rows[0].parts) !== Math.ceil(Number(rows[0].byte_size) / NOTIFICATION_IMAGE_CHUNK_BYTES)) {
    throw new Error("The image has not finished uploading. Please try again.");
  }
  const sealed = await sql`UPDATE notification_image_assets SET completed = true, created_at = NOW()
    WHERE id = ${id} AND created_at > NOW() - INTERVAL '24 hours' RETURNING id`;
  if (!sealed.rows.length) throw new Error("This image upload expired. Please choose the image again.");
  return `${PREFIX}${id}`;
}

export async function removeAbandonedImages() {
  await sql`DELETE FROM notification_image_assets a WHERE a.created_at <= NOW() - INTERVAL '24 hours'
    AND NOT EXISTS (SELECT 1 FROM notifications n WHERE n.image_url = ${PREFIX} || a.id::text)
    AND NOT EXISTS (SELECT 1 FROM notification_schedules s WHERE s.image_url = ${PREFIX} || a.id::text)`;
}

export async function storedImage(reference: string) {
  if (!reference.startsWith(PREFIX)) return null;
  const id = reference.slice(PREFIX.length);
  if (!validId(id)) return null;
  const { rows } = await sql`SELECT content_type, byte_size FROM notification_image_assets WHERE id = ${id} AND completed = true`;
  if (!rows.length) return null;
  const count = Math.ceil(Number(rows[0].byte_size) / NOTIFICATION_IMAGE_CHUNK_BYTES);
  async function* chunks() {
    // Bounded batches also keep database HTTP responses comfortably below limits.
    for (let offset = 0; offset < count; offset += 4) {
      const result = await sql`SELECT part_index, data FROM notification_image_chunks
        WHERE asset_id = ${id} AND part_index >= ${offset} AND part_index < ${offset + 4} ORDER BY part_index`;
      const expected = Math.min(4, count - offset);
      if (result.rows.length !== expected) throw new Error("Image data is incomplete.");
      for (let index = 0; index < expected; index++) {
        if (Number(result.rows[index].part_index) !== offset + index) throw new Error("Image data is incomplete.");
        yield new Uint8Array(Buffer.from(String(result.rows[index].data), "base64"));
      }
    }
  }
  return { contentType: String(rows[0].content_type), chunks: chunks() };
}
