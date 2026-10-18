import { sql } from "@vercel/postgres";
import { ensureEmailImageSchema } from "./email-image-schema";

/** Additive migration: preserve existing announcements and per-VA read state. */
export async function ensureNotificationSchema() {
  await ensureEmailImageSchema();
  await sql`
    CREATE TABLE IF NOT EXISTS notification_image_assets (
      id UUID PRIMARY KEY,
      content_type TEXT NOT NULL,
      byte_size INTEGER NOT NULL CHECK (byte_size > 0 AND byte_size <= 10485760),
      completed BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS notification_image_chunks (
      asset_id UUID NOT NULL REFERENCES notification_image_assets(id) ON DELETE CASCADE,
      part_index INTEGER NOT NULL CHECK (part_index >= 0 AND part_index < 27),
      data TEXT NOT NULL,
      byte_size INTEGER NOT NULL CHECK (byte_size > 0 AND byte_size <= 393216),
      PRIMARY KEY(asset_id, part_index)
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS notification_schedules (
      id SERIAL PRIMARY KEY,
      audience TEXT NOT NULL DEFAULT 'va',
      va_id TEXT NOT NULL DEFAULT '',
      client_id INTEGER,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'admin',
      created_by TEXT NOT NULL DEFAULT 'admin',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      image_url TEXT NOT NULL DEFAULT '',
      redirect_to TEXT NOT NULL DEFAULT '',
      starts_at TIMESTAMPTZ NOT NULL,
      next_run_at TIMESTAMPTZ,
      recurrence TEXT NOT NULL DEFAULT 'none',
      time_zone TEXT NOT NULL DEFAULT 'America/New_York',
      expires_at TIMESTAMPTZ
    )
  `;
  await sql`
    ALTER TABLE notifications
      ADD COLUMN IF NOT EXISTS audience TEXT NOT NULL DEFAULT 'va',
      ADD COLUMN IF NOT EXISTS client_id INTEGER,
      ADD COLUMN IF NOT EXISTS image_url TEXT NOT NULL DEFAULT '',
      ADD COLUMN IF NOT EXISTS redirect_to TEXT NOT NULL DEFAULT '',
      ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS schedule_id INTEGER REFERENCES notification_schedules(id) ON DELETE CASCADE,
      ADD COLUMN IF NOT EXISTS scheduled_for TIMESTAMPTZ
  `;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS notifications_schedule_run ON notifications(schedule_id, scheduled_for)`;
  await sql`CREATE INDEX IF NOT EXISTS notifications_expiration ON notifications(expires_at) WHERE expires_at IS NOT NULL`;
  await sql`CREATE INDEX IF NOT EXISTS notification_schedules_due ON notification_schedules(next_run_at)`;
  await sql`
    CREATE TABLE IF NOT EXISTS notification_receipts (
      notification_id INTEGER NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
      audience TEXT NOT NULL,
      recipient_id TEXT NOT NULL,
      read_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY(notification_id, audience, recipient_id)
    )
  `;
  await sql`ALTER TABLE notification_reads ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`;
  await sql`
    INSERT INTO notification_receipts(notification_id, audience, recipient_id, read_at)
    SELECT notification_id, 'va', va_id, read_at FROM notification_reads
    ON CONFLICT DO NOTHING
  `;
  await sql`
    INSERT INTO notification_receipts(notification_id, audience, recipient_id)
    SELECT id, 'va', va_id FROM notifications
    WHERE audience = 'va' AND va_id != '' AND is_read = true
    ON CONFLICT DO NOTHING
  `;
}
