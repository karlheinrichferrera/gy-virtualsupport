import { sql } from "@vercel/postgres";
import { getOutlookConnection, OutlookSendError, sendOutlookMessage } from "./outlook";
import type { EmailJob, ManualEmailInput } from "./email-types";

type Row = Record<string, unknown>;
const addressPattern = /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)+$/;
export function validEmailAddress(value: string) {
  return typeof value === "string" && value.length <= 254 && addressPattern.test(value);
}

export function emailPortalOrigin() {
  const url = new URL(process.env.PORTAL_APP_URL || "https://gy-virtualsupport-safq.vercel.app");
  if (url.protocol !== "https:" && !(process.env.NODE_ENV !== "production" && url.hostname === "localhost")) {
    throw new Error("PORTAL_APP_URL must use HTTPS.");
  }
  return url.origin;
}

export function emailJob(row: Row): EmailJob {
  return { id: Number(row.id), to: Array.isArray(row.to_emails) ? row.to_emails.map(value => typeof value === "string" ? value : "") : [], subject: String(row.subject),
    source: row.source as EmailJob["source"], status: row.status as EmailJob["status"],
    createdAt: new Date(row.created_at as string).toISOString(),
    lastError: row.last_error == null ? null : String(row.last_error), attempts: Number(row.attempts) };
}

async function connectionId() {
  const connection = await getOutlookConnection();
  if (!connection.connected) throw new Error("Connect Outlook before sending email.");
  const { rows } = await sql`SELECT connection_id FROM outlook_connection WHERE singleton = true AND encrypted_tokens IS NOT NULL`;
  if (!rows.length) throw new Error("Connect Outlook before sending email.");
  return String(rows[0].connection_id);
}

export async function queueManualEmail(input: ManualEmailInput, adminId: number) {
  if (!Array.isArray(input.to) || input.to.length < 1 || input.to.length > 20 ||
    input.to.some(to => typeof to !== "string" || !validEmailAddress(to.trim()))) {
    throw new Error("Enter 1 to 20 valid email addresses.");
  }
  const to = [...new Set(input.to.map(to => to.trim().toLowerCase()))];
  const subject = input.subject?.trim(), body = input.body?.trim();
  if (!subject || subject.length > 200 || /[\r\n]/.test(subject)) throw new Error("Enter a subject up to 200 characters.");
  if (!body || body.length > 50000) throw new Error("Enter a message up to 50,000 characters.");
  if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(input.requestId || "")) throw new Error("Refresh the page and try again.");
  const connection = await connectionId();
  const key = `manual:${adminId}:${input.requestId}`;
  const { rows } = await sql`INSERT INTO email_jobs(idempotency_key,connection_id,to_emails,subject,body,source)
    VALUES (${key},${connection},${JSON.stringify(to)}::jsonb,${subject},${body},'manual')
    ON CONFLICT (idempotency_key) DO UPDATE SET idempotency_key = EXCLUDED.idempotency_key
    RETURNING *`;
  const row = rows[0];
  if (row.subject !== subject || row.body !== body || JSON.stringify(row.to_emails) !== JSON.stringify(to)) {
    throw new Error("This request was already used for another message. Start a new email.");
  }
  return emailJob(row);
}

/** Claim each publication and snapshot its recipients atomically with its outbox rows. */
export async function queueAutomaticEmails() {
  if (!(await getOutlookConnection()).connected) return;
  const origin = emailPortalOrigin();
  const connection = await connectionId();
  await sql`
    WITH publications AS (
      UPDATE client_invoices i SET email_queued_at = NOW()
      FROM email_settings s
      WHERE s.singleton = true AND s.auto_invoices_since IS NOT NULL
        AND i.email_published_at >= s.auto_invoices_since AND i.email_published_at <= NOW()
        AND i.email_queued_at IS NULL AND LOWER(TRIM(i.status)) != 'draft'
      RETURNING i.*
    )
    INSERT INTO email_jobs(idempotency_key,connection_id,to_emails,subject,body,source,source_id)
    SELECT 'invoice:' || i.id,${connection}::uuid,jsonb_build_array(TRIM(c.email)),
      'Invoice ' || i.invoice_number || ' is available',
      'Hello ' || c.display_name || E',\n\nYour invoice is available in the Client Portal.' ||
      E'\nInvoice: ' || i.invoice_number || E'\nCoverage: ' || i.bill_coverage ||
      E'\nAmount: ' || i.amount || E'\nDue date: ' || i.invoice_due_date ||
      E'\n\nView your invoice: ' || ${origin + "/client/dashboard/invoices"} || E'\n\nGY Virtual Support',
      'invoice',i.id
    FROM publications i JOIN client_accounts c ON c.id = i.client_id
    ON CONFLICT (idempotency_key) DO NOTHING
  `;
  await sql`
    WITH publications AS (
      UPDATE notifications n SET email_queued_at = NOW()
      FROM email_settings s
      WHERE s.singleton = true AND s.auto_notifications_since IS NOT NULL
        AND n.published_at >= s.auto_notifications_since AND n.published_at <= NOW()
        AND n.email_queued_at IS NULL AND (n.expires_at IS NULL OR n.expires_at > NOW())
      RETURNING n.*
    ), recipients AS (
      SELECT n.*,v.id AS recipient_id,approved.email AS email FROM publications n JOIN va_profiles v
        ON n.audience = 'va' AND (n.va_id = '' OR n.va_id = v.id)
      LEFT JOIN email_va_contacts approved ON approved.va_id=v.id AND LOWER(TRIM(approved.email))=LOWER(TRIM(v.email))
      UNION ALL
      SELECT n.*,c.id::text AS recipient_id,c.email AS email FROM publications n JOIN client_accounts c
        ON n.audience = 'client' AND (n.client_id IS NULL OR n.client_id = c.id)
    )
    INSERT INTO email_jobs(idempotency_key,connection_id,to_emails,subject,body,source,source_id,expires_at)
    SELECT 'notification:' || id || ':' || audience || ':' || recipient_id,
      ${connection}::uuid,jsonb_build_array(TRIM(email)),title,
      message || E'\n\nOpen your portal: ' || ${origin} ||
      CASE WHEN redirect_to != '' THEN redirect_to WHEN audience = 'va' THEN '/dashboard' ELSE '/client/dashboard' END ||
      E'\n\nGY Virtual Support','notification',id,expires_at
    FROM recipients ON CONFLICT (idempotency_key) DO NOTHING
  `;
  await sql`UPDATE email_jobs SET status='skipped',last_error='Recipient needs a valid, admin-approved email address.'
    WHERE status='queued' AND source != 'manual'
      AND (jsonb_array_length(to_emails) != 1 OR LENGTH(to_emails->>0) > 254
        OR COALESCE(to_emails->>0,'') !~ '^[A-Za-z0-9.!#$%&''*+/=?^_\x60{|}~-]+@[A-Za-z0-9][A-Za-z0-9.-]*\.[A-Za-z0-9-]+$')`;
}

export async function processEmailQueue(limit = 5) {
  if (!(await getOutlookConnection()).connected) return { processed: 0 };
  await sql`UPDATE email_jobs SET status='uncertain',last_error='Sending was interrupted. Check Outlook Sent Items before retrying.'
    WHERE status='sending' AND claimed_at < NOW() - INTERVAL '5 minutes'`;
  await sql`UPDATE email_jobs j SET status='cancelled',last_error='The connection or source is no longer active.'
    WHERE j.status='queued' AND (
      NOT EXISTS (SELECT 1 FROM outlook_connection c WHERE c.singleton=true AND c.connection_id=j.connection_id AND c.encrypted_tokens IS NOT NULL)
      OR j.expires_at <= NOW()
      OR (j.source='invoice' AND NOT EXISTS (SELECT 1 FROM client_invoices i WHERE i.id=j.source_id AND LOWER(TRIM(i.status)) != 'draft'))
      OR (j.source='notification' AND NOT EXISTS (SELECT 1 FROM notifications n WHERE n.id=j.source_id))
      OR (j.source='invoice' AND NOT EXISTS (SELECT 1 FROM email_settings s WHERE s.singleton=true AND s.auto_invoices_since IS NOT NULL AND j.created_at>=s.auto_invoices_since))
      OR (j.source='notification' AND NOT EXISTS (SELECT 1 FROM email_settings s WHERE s.singleton=true AND s.auto_notifications_since IS NOT NULL AND j.created_at>=s.auto_notifications_since))
    )`;
  const started = Date.now();
  let processed = 0;
  while (processed < Math.min(Math.max(limit, 1), 20) && Date.now() - started < 20000) {
    const { rows } = await sql`UPDATE email_jobs SET status='sending',attempts=attempts+1,claimed_at=NOW(),last_error=NULL
      WHERE id=(SELECT j.id FROM email_jobs j WHERE j.status='queued' AND j.available_at<=NOW()
        AND (j.source='manual' OR EXISTS (SELECT 1 FROM email_settings s WHERE s.singleton=true AND
          ((j.source='invoice' AND s.auto_invoices_since IS NOT NULL AND j.created_at>=s.auto_invoices_since)
          OR (j.source='notification' AND s.auto_notifications_since IS NOT NULL AND j.created_at>=s.auto_notifications_since))))
        ORDER BY j.id FOR UPDATE SKIP LOCKED LIMIT 1)
      AND status='queued' RETURNING *`;
    if (!rows.length) break;
    const row = rows[0];
    const to = row.to_emails as string[];
    try {
      if (!to.length || to.some(address => !validEmailAddress(address))) {
        await sql`UPDATE email_jobs SET status='skipped',last_error='Recipient has no valid email address.' WHERE id=${row.id as number} AND status='sending'`;
      } else {
        // A refresh/reconnection may happen between claims; never send another account's backlog.
        if (await connectionId() !== row.connection_id) throw new OutlookSendError("rejected", "The connected Outlook account changed. Create a new email.");
        await sendOutlookMessage({ to, subject: String(row.subject), body: String(row.body), expectedConnectionId: String(row.connection_id) });
        await sql`UPDATE email_jobs SET status='accepted',last_error=NULL WHERE id=${row.id as number} AND status='sending'`;
      }
    } catch (error) {
      const known = error instanceof OutlookSendError;
      const kind = known ? error.kind : "uncertain";
      const message = known ? error.message : "Delivery could not be confirmed. Check Outlook Sent Items before retrying.";
      if (kind === "throttled" && Number(row.attempts) < 5) {
        const delay = Math.min(Math.max(error instanceof OutlookSendError ? error.retryAfterSeconds || 60 : 60, 10), 86400);
        await sql`UPDATE email_jobs SET status='queued',available_at=NOW()+${delay}*INTERVAL '1 second',last_error=${message}
          WHERE id=${row.id as number} AND status='sending'`;
      } else {
        await sql`UPDATE email_jobs SET status=${kind === "uncertain" ? "uncertain" : "failed"},last_error=${message}
          WHERE id=${row.id as number} AND status='sending'`;
      }
      if (kind === "reconnect") break;
    }
    processed++;
  }
  return { processed };
}

export async function cancelPendingEmails() {
  await sql`UPDATE email_jobs SET status='cancelled',last_error='Outlook was disconnected.' WHERE status='queued'`;
  await sql`UPDATE email_settings SET auto_invoices_since=NULL,auto_notifications_since=NULL WHERE singleton=true`;
}

export async function setEmailAutomation(autoInvoices: boolean, autoNotifications: boolean) {
  await connectionId();
  // Enabling notification email approves the current VA contact list. Public
  // registrations and self-edited email addresses require an admin to save the
  // VA record before they can receive future automated messages.
  if (autoNotifications) {
    await sql`INSERT INTO email_va_contacts(va_id,email)
      SELECT v.id,TRIM(COALESCE(v.email,'')) FROM va_profiles v
      WHERE EXISTS (SELECT 1 FROM email_settings s WHERE s.singleton=true AND s.auto_notifications_since IS NULL)
      ON CONFLICT (va_id) DO UPDATE SET email=EXCLUDED.email,approved_at=NOW()`;
  }
  await sql`UPDATE email_settings SET
    auto_invoices_since=CASE WHEN ${autoInvoices} THEN COALESCE(auto_invoices_since,NOW()) ELSE NULL END,
    auto_notifications_since=CASE WHEN ${autoNotifications} THEN COALESCE(auto_notifications_since,NOW()) ELSE NULL END
    WHERE singleton=true`;
  await sql`UPDATE email_jobs SET status='cancelled',last_error='Automatic emailing was switched off.'
    WHERE status='queued' AND ((source='invoice' AND NOT ${autoInvoices}) OR (source='notification' AND NOT ${autoNotifications}))`;
}

/** Called only after an authenticated admin saves a VA record. */
export async function approveVAEmail(vaId: string, email: string) {
  await sql`INSERT INTO email_va_contacts(va_id,email) VALUES (${vaId},${email.trim()})
    ON CONFLICT (va_id) DO UPDATE SET email=EXCLUDED.email,approved_at=NOW()`;
}

export async function retryQueuedEmail(id: number) {
  const connection = await connectionId();
  const { rows } = await sql`UPDATE email_jobs SET status='queued',available_at=NOW(),last_error=NULL
    WHERE id=${id} AND status IN ('failed','uncertain') AND connection_id=${connection}::uuid
      AND (expires_at IS NULL OR expires_at>NOW()) RETURNING id`;
  if (!rows.length) throw new Error("This email cannot be retried. Create a new email if needed.");
}
