import { sql } from "@vercel/postgres";
import { deriveNotificationRun, notificationTimeZoneValid } from "./notification-schedule";
import type { Notification, NotificationAudience, NotificationInput, NotificationRecurrence } from "./notification-types";

type Row = Record<string, unknown>;
const iso = (value: unknown) => value ? new Date(value as string).toISOString() : null;

function toNotification(row: Row): Notification {
  return {
    id: Number(row.id), vaId: String(row.va_id || ""),
    clientId: row.client_id == null ? null : Number(row.client_id),
    audience: row.audience as NotificationAudience,
    title: String(row.title), message: String(row.message), type: String(row.type),
    isRead: Boolean(row.effective_read), createdAt: String(row.created_at), createdBy: String(row.created_by),
    imageUrl: row.image_url ? `/api/notifications/image/${row.id}` : "", redirectTo: String(row.redirect_to || ""),
    expiresAt: iso(row.expires_at), scheduledFor: iso(row.scheduled_for),
    scheduleId: row.schedule_id == null ? null : Number(row.schedule_id),
    recurrence: (row.recurrence || "none") as NotificationRecurrence,
    status: row.status as Notification["status"],
  };
}

function validateInput(data: NotificationInput) {
  if (!["va", "client"].includes(data.audience)) throw new Error("Choose VAs or clients.");
  const title = data.title?.trim();
  const message = data.message?.trim();
  if (!title || title.length > 200 || !message || message.length > 5000) {
    throw new Error("Enter a title (up to 200 characters) and a message (up to 5,000 characters).");
  }
  const recurrence = data.recurrence || "none";
  if (!["none", "daily", "weekly", "monthly", "yearly"].includes(recurrence)) throw new Error("Invalid recurrence.");
  const timeZone = data.timeZone || "America/New_York";
  if (!notificationTimeZoneValid(timeZone)) throw new Error("Invalid notification time zone.");
  const startsAt = data.startsAt ? iso(data.startsAt) : new Date().toISOString();
  const expiresAt = iso(data.expiresAt);
  if (expiresAt && (expiresAt <= startsAt! || expiresAt <= new Date().toISOString())) {
    throw new Error("Expiration must be after the first delivery and the current time.");
  }
  const redirectTo = data.redirectTo?.trim() || "";
  const portal = data.audience === "va" ? "/dashboard" : "/client/dashboard";
  if (redirectTo) {
    let decoded: string;
    try { decoded = decodeURIComponent(redirectTo); } catch { throw new Error("Invalid portal link."); }
    if (redirectTo.length > 1000 || /[\\\u0000-\u0020]/.test(decoded) ||
      !(decoded === portal || decoded.startsWith(`${portal}/`) || decoded.startsWith(`${portal}?`) || decoded.startsWith(`${portal}#`))) {
      throw new Error(`Redirect must be a page inside ${portal}.`);
    }
    const resolved = new URL(redirectTo, "https://portal.invalid");
    if (resolved.origin !== "https://portal.invalid" || !(resolved.pathname === portal || resolved.pathname.startsWith(`${portal}/`))) {
      throw new Error(`Redirect must stay inside ${portal}.`);
    }
  }
  const imageUrl = data.imageUrl || "";
  if (imageUrl) {
    const match = /^data:image\/(png|jpeg|gif|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(imageUrl);
    if (!match || imageUrl.length > 690000) throw new Error("Upload a PNG, JPEG, GIF, or WebP image up to 500 KB.");
    const image = Buffer.from(match[2], "base64");
    const valid = match[1] === "png" ? image.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))
      : match[1] === "jpeg" ? image[0] === 255 && image[1] === 216 && image[2] === 255
      : match[1] === "gif" ? /^GIF8[79]a$/.test(image.subarray(0, 6).toString())
      : image.subarray(0, 4).toString() === "RIFF" && image.subarray(8, 12).toString() === "WEBP";
    if (!valid || image.length > 500 * 1024) throw new Error("Invalid image or file larger than 500 KB.");
  }
  const clientId = data.audience === "client" ? data.clientId ?? null : null;
  if (clientId != null && (!Number.isSafeInteger(clientId) || clientId < 1)) throw new Error("Invalid client recipient.");
  return { ...data, title, message, recurrence, timeZone, startsAt: startsAt!, expiresAt, imageUrl, redirectTo,
    vaId: data.audience === "va" ? data.vaId?.trim() || "" : "", clientId };
}

/** Idempotent delivery on inbox polls, admin loads, and the existing daily cron. */
export async function processNotificationMaintenance() {
  await sql`DELETE FROM notification_schedules WHERE expires_at <= NOW()`;
  await sql`DELETE FROM notifications WHERE expires_at <= NOW()`;
  // Personal deliveries can be deleted physically. Broadcast receipts stay as
  // tombstones so clearing one inbox never resurfaces a shared announcement.
  await sql`
    DELETE FROM notifications n USING notification_receipts r
    WHERE r.notification_id = n.id AND r.audience = n.audience
      AND r.read_at <= NOW() - INTERVAL '24 hours'
      AND ((n.audience = 'va' AND n.va_id != '' AND r.recipient_id = n.va_id)
        OR (n.audience = 'client' AND n.client_id IS NOT NULL AND r.recipient_id = n.client_id::text))
  `;
  const { rows } = await sql`
    SELECT * FROM notification_schedules
    WHERE next_run_at <= NOW() AND (expires_at IS NULL OR expires_at > NOW())
    ORDER BY next_run_at, id
  `;
  const now = new Date().toISOString();
  for (const row of rows) {
    const recurrence = row.recurrence as NotificationRecurrence;
    const run = recurrence === "none" ? { scheduledFor: iso(row.starts_at)!, nextRunAt: null }
      : deriveNotificationRun(iso(row.starts_at)!, recurrence, String(row.time_zone), now);
    if (!run) continue;
    // Unique schedule/run key prevents duplicate delivery when several people poll.
    await sql`
      INSERT INTO notifications(va_id, audience, client_id, title, message, type, created_by, created_at,
        image_url, redirect_to, expires_at, published_at, schedule_id, scheduled_for)
      SELECT va_id, audience, client_id, title, message, type, created_by, ${run.scheduledFor},
        image_url, redirect_to, expires_at, ${run.scheduledFor}, id, ${run.scheduledFor}
      FROM notification_schedules WHERE id = ${row.id as number} AND next_run_at <= ${now}
        AND (expires_at IS NULL OR expires_at > ${now})
      ON CONFLICT (schedule_id, scheduled_for) DO NOTHING
    `;
    await sql`UPDATE notification_schedules SET next_run_at = ${run.nextRunAt}
      WHERE id = ${row.id as number} AND next_run_at <= ${now}`;
  }
}

export async function recipientNotifications(audience: NotificationAudience, recipientId: string): Promise<Notification[]> {
  if (!recipientId) return [];
  await processNotificationMaintenance();
  const { rows } = await sql`
    SELECT n.*, r.read_at IS NOT NULL AS effective_read, s.recurrence
    FROM notifications n
    LEFT JOIN notification_receipts r ON r.notification_id = n.id AND r.audience = ${audience} AND r.recipient_id = ${recipientId}
    LEFT JOIN notification_schedules s ON s.id = n.schedule_id
    WHERE n.audience = ${audience}
      AND ((n.audience = 'va' AND (n.va_id = '' OR n.va_id = ${recipientId}))
        OR (n.audience = 'client' AND (n.client_id IS NULL OR n.client_id::text = ${recipientId})))
      AND n.published_at <= NOW() AND (n.expires_at IS NULL OR n.expires_at > NOW())
      AND (r.read_at IS NULL OR r.read_at > NOW() - INTERVAL '24 hours')
    ORDER BY n.published_at DESC, n.id DESC
  `;
  return rows.map(toNotification);
}

export async function readRecipientNotifications(audience: NotificationAudience, recipientId: string, notificationId?: number) {
  if (!recipientId) return;
  await processNotificationMaintenance();
  await sql`
    INSERT INTO notification_receipts(notification_id, audience, recipient_id)
    SELECT id, ${audience}, ${recipientId} FROM notifications n
    WHERE n.audience = ${audience} AND (${notificationId ?? null}::integer IS NULL OR n.id = ${notificationId ?? null})
      AND ((n.audience = 'va' AND (n.va_id = '' OR n.va_id = ${recipientId}))
        OR (n.audience = 'client' AND (n.client_id IS NULL OR n.client_id::text = ${recipientId})))
      AND n.published_at <= NOW() AND (n.expires_at IS NULL OR n.expires_at > NOW())
    ON CONFLICT DO NOTHING
  `;
}

export async function saveNotification(input: NotificationInput) {
  const data = validateInput(input);
  if (data.vaId) {
    const result = await sql`SELECT id FROM va_profiles WHERE id = ${data.vaId}`;
    if (!result.rows.length) throw new Error("VA recipient no longer exists.");
  }
  if (data.clientId != null) {
    const result = await sql`SELECT id FROM client_accounts WHERE id = ${data.clientId}`;
    if (!result.rows.length) throw new Error("Client recipient no longer exists.");
  }
  const createdBy = (data.createdBy || "admin").slice(0, 200);
  if (input.startsAt || data.recurrence !== "none") {
    await sql`
      INSERT INTO notification_schedules(audience, va_id, client_id, title, message, type, created_by,
        image_url, redirect_to, starts_at, next_run_at, recurrence, time_zone, expires_at)
      VALUES (${data.audience}, ${data.vaId}, ${data.clientId}, ${data.title}, ${data.message}, 'admin', ${createdBy},
        ${data.imageUrl}, ${data.redirectTo}, ${data.startsAt}, ${data.startsAt}, ${data.recurrence}, ${data.timeZone}, ${data.expiresAt})
    `;
  } else {
    await sql`
      INSERT INTO notifications(audience, va_id, client_id, title, message, type, created_by, created_at,
        image_url, redirect_to, expires_at)
      VALUES (${data.audience}, ${data.vaId}, ${data.clientId}, ${data.title}, ${data.message}, 'admin', ${createdBy},
        ${new Date().toISOString()}, ${data.imageUrl}, ${data.redirectTo}, ${data.expiresAt})
    `;
  }
  await processNotificationMaintenance();
}

export async function adminNotifications(): Promise<Notification[]> {
  await processNotificationMaintenance();
  const [deliveries, schedules] = await Promise.all([
    sql`SELECT * FROM notifications WHERE schedule_id IS NULL ORDER BY id DESC`,
    sql`SELECT *, -id AS display_id FROM notification_schedules ORDER BY id DESC`,
  ]);
  return [
    ...deliveries.rows.map(toNotification),
    ...schedules.rows.map(row => toNotification({ ...row, id: row.display_id, schedule_id: row.id,
      created_at: iso(row.created_at), scheduled_for: row.next_run_at || row.starts_at,
      status: row.next_run_at ? "scheduled" : "active" })),
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export async function removeNotification(id: number) {
  await sql`DELETE FROM notifications WHERE id = ${id}`;
}

export async function removeNotificationSchedule(id: number) {
  await sql`DELETE FROM notification_schedules WHERE id = ${id}`;
}

export async function clientRecipientId(email: string) {
  const { rows } = await sql`SELECT id FROM client_accounts WHERE LOWER(email) = LOWER(${email.trim()})`;
  return rows.length ? String(rows[0].id) : "";
}

/** Serve one attachment at a time, keeping inbox responses below serverless limits. */
export async function notificationImage(id: number) {
  if (!Number.isSafeInteger(id) || id === 0 || Math.abs(id) > 2147483647) return null;
  const result = id < 0
    ? await sql`SELECT image_url FROM notification_schedules WHERE id = ${-id} AND (expires_at IS NULL OR expires_at > NOW())`
    : await sql`SELECT image_url FROM notifications WHERE id = ${id} AND published_at <= NOW() AND (expires_at IS NULL OR expires_at > NOW())`;
  const image = result.rows[0]?.image_url as string | undefined;
  const match = image && /^data:(image\/(?:png|jpeg|gif|webp));base64,([A-Za-z0-9+/]+={0,2})$/.exec(image);
  return match ? { contentType: match[1], bytes: Buffer.from(match[2], "base64") } : null;
}
