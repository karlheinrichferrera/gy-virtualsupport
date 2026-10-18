import { sql } from "@vercel/postgres";

export async function ensureEmailImageSchema() {
  await sql`CREATE TABLE IF NOT EXISTS notification_email_images (
    token UUID PRIMARY KEY, image_reference TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;
}
