import { sql } from "@vercel/postgres";
import { getOutlookConnection, OutlookSendError, sendOutlookMessage } from "./outlook";
import type { EmailJob, ManualEmailInput } from "./email-types";
import { validEmailAddress, emailRecipients, parseEmailAddresses } from "./email-addresses";
import { EMAIL_FROM_NAME, EMAIL_FROM_ADDRESS, invoiceEmail, notificationEmail, manualEmail, type EmailTemplateData } from "./email-templates";
import { prepareEmailImage } from "./email-images";
export { validEmailAddress } from "./email-addresses";

type Row = Record<string, unknown>;

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
    cc: (row.cc_emails || []) as string[], bcc: (row.bcc_emails || []) as string[],
    fromName: String(row.from_name || EMAIL_FROM_NAME), fromEmail: String(row.from_email || ""),
    lastError: row.last_error == null ? null : String(row.last_error), attempts: Number(row.attempts), isResend: Boolean(row.is_resend) };
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
  const { to, cc, bcc } = emailRecipients(input.to, input.cc, input.bcc);
  const subject = input.subject?.trim(), body = input.body?.trim();
  if (!subject || subject.length > 200 || /[\r\n]/.test(subject)) throw new Error("Enter a subject up to 200 characters.");
  if (!body || body.length > 50000) throw new Error("Enter a message up to 50,000 characters.");
  if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(input.requestId || "")) throw new Error("Refresh the page and try again.");
  const connection = await connectionId();
  const account = await getOutlookConnection();
  const fromEmail = input.fromEmail?.trim().toLowerCase() || account.senderEmail?.toLowerCase() || "";
  const fromName = input.fromName?.trim() || EMAIL_FROM_NAME;
  if (fromEmail !== account.senderEmail?.toLowerCase()) throw new Error("From email must match your connected Outlook account.");
  if (fromName.length > 100 || /[\r\n]/.test(fromName)) throw new Error("Enter a From name up to 100 characters.");
  const rendered = manualEmail(body);
  const key = `manual:${adminId}:${input.requestId}`;
  const { rows } = await sql`INSERT INTO email_jobs(idempotency_key,connection_id,to_emails,cc_emails,bcc_emails,from_name,from_email,subject,body,body_html,source)
    VALUES (${key},${connection},${JSON.stringify(to)}::jsonb,${JSON.stringify(cc)}::jsonb,${JSON.stringify(bcc)}::jsonb,
      ${fromName},${fromEmail},${subject},${rendered.body},${rendered.html},'manual')
    ON CONFLICT (idempotency_key) DO UPDATE SET idempotency_key = EXCLUDED.idempotency_key
    RETURNING *`;
  const row = rows[0];
  if (row.subject !== subject || row.body !== rendered.body || row.from_name !== fromName || row.from_email !== fromEmail ||
    JSON.stringify(row.to_emails) !== JSON.stringify(to) || JSON.stringify(row.cc_emails) !== JSON.stringify(cc) || JSON.stringify(row.bcc_emails) !== JSON.stringify(bcc)) {
    throw new Error("This request was already used for another message. Start a new email.");
  }
  return emailJob(row);
}

/** Claim each publication and snapshot its recipients atomically with its outbox rows. */
export async function queueAutomaticEmails() {
  if (!(await getOutlookConnection()).connected) return;
  const connection = await connectionId();
  await sql`
    WITH publications AS (
      UPDATE client_invoices i SET email_queued_at = NOW()
      FROM email_settings s
      WHERE s.singleton = true AND s.auto_invoices_since IS NOT NULL
        AND i.email_published_at >= s.auto_invoices_since AND i.email_published_at <= NOW()
        AND i.email_queued_at IS NULL AND LOWER(TRIM(i.status)) NOT IN ('draft','paid')
      RETURNING i.*
    )
    INSERT INTO email_jobs(idempotency_key,connection_id,to_emails,cc_emails,from_name,from_email,subject,body,template_data,source,source_id)
    SELECT 'invoice:' || i.id,${connection}::uuid,jsonb_build_array(TRIM(c.email)),
      to_jsonb(string_to_array(REPLACE(i.additional_recipients,' ',''),',')),${EMAIL_FROM_NAME},${EMAIL_FROM_ADDRESS},
      'INVOICE - ' || i.bill_coverage || ' : GY Virtual Support Team','Invoice ready for review.',
      jsonb_build_object('kind','invoice','invoiceNumber',i.invoice_number,'billCoverage',i.bill_coverage,'amount',i.amount,
        'dueDate',i.invoice_due_date,'invoiceLink',i.invoice_link,'clientEmail',c.email,'clientName',c.display_name,'defaultPassword',c.password='gyclient2026',
        'includesPayPalFees',c.invoice_paypal_fees),
      'invoice',i.id
    FROM publications i JOIN client_accounts c ON c.id = i.client_id
    ON CONFLICT DO NOTHING
  `;
  await sql`
    WITH publications AS (
      UPDATE notifications n SET email_queued_at = NOW()
      FROM email_settings s
      WHERE s.singleton = true AND s.auto_notifications_since IS NOT NULL
        AND n.published_at >= s.auto_notifications_since AND n.published_at <= NOW()
        AND n.email_queued_at IS NULL AND n.type != 'invoice' AND (n.expires_at IS NULL OR n.expires_at > NOW())
      RETURNING n.*
    ), recipients AS (
      SELECT n.*,v.id AS recipient_id,approved.email AS email FROM publications n JOIN va_profiles v
        ON n.audience = 'va' AND (n.va_id = '' OR n.va_id = v.id)
      LEFT JOIN email_va_contacts approved ON approved.va_id=v.id AND LOWER(TRIM(approved.email))=LOWER(TRIM(v.email))
      UNION ALL
      SELECT n.*,c.id::text || CASE WHEN routing.delegates IS NOT NULL THEN ':' || LOWER(TRIM(target.email)) ELSE '' END AS recipient_id,
        target.email AS email FROM publications n JOIN client_accounts c
        ON n.audience = 'client' AND (n.client_id IS NULL OR n.client_id = c.id)
      CROSS JOIN LATERAL (SELECT CASE WHEN n.type='request' AND n.client_id=c.id
        THEN NULLIF(TRIM(c.request_notification_recipients),'') ELSE NULL END AS delegates) routing
      CROSS JOIN LATERAL unnest(COALESCE(string_to_array(routing.delegates,','),ARRAY[c.email])) target(email)
    )
    , jobs AS (
    INSERT INTO email_jobs(idempotency_key,connection_id,to_emails,cc_emails,from_name,from_email,subject,body,template_data,image_token,source,source_id,expires_at,client_invoice_id)
    SELECT 'notification:' || id || ':' || audience || ':' || recipient_id,
      ${connection}::uuid,jsonb_build_array(TRIM(email)),
      COALESCE((SELECT to_jsonb(string_to_array(REPLACE(i.additional_recipients,' ',''),',')) FROM client_invoices i
        WHERE recipients.type='payment' AND recipients.audience='client' AND i.id=recipients.client_invoice_id AND i.client_id=recipients.client_id),'[]'::jsonb),
      ${EMAIL_FROM_NAME},${EMAIL_FROM_ADDRESS},title,message,
      jsonb_build_object('kind','notification','title',title,'message',message,'redirectTo',redirect_to,'audience',audience),
      CASE WHEN image_url != '' THEN gen_random_uuid() ELSE NULL END,'notification',id,expires_at,client_invoice_id
    FROM recipients ON CONFLICT (idempotency_key) DO NOTHING
    RETURNING image_token,source_id
    ) INSERT INTO notification_email_images(token,image_reference)
    SELECT j.image_token,n.image_url FROM jobs j JOIN notifications n ON n.id=j.source_id
    WHERE j.image_token IS NOT NULL ON CONFLICT DO NOTHING
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
      OR (j.source='invoice' AND NOT j.is_resend AND NOT EXISTS (SELECT 1 FROM client_invoices i WHERE i.id=j.source_id AND LOWER(TRIM(i.status)) NOT IN ('draft','paid')))
      OR (j.source='invoice' AND j.is_resend AND NOT EXISTS (SELECT 1 FROM client_invoices i WHERE i.id=j.source_id AND LOWER(TRIM(i.status))!='draft'))
      OR (j.source='notification' AND NOT EXISTS (SELECT 1 FROM notifications n WHERE n.id=j.source_id))
      OR (j.source='invoice' AND NOT j.is_resend AND NOT EXISTS (SELECT 1 FROM email_settings s WHERE s.singleton=true AND s.auto_invoices_since IS NOT NULL AND j.created_at>=s.auto_invoices_since))
      OR (j.source='notification' AND NOT EXISTS (SELECT 1 FROM email_settings s WHERE s.singleton=true AND s.auto_notifications_since IS NOT NULL AND j.created_at>=s.auto_notifications_since))
    )`;
  const started = Date.now();
  let processed = 0;
  while (processed < Math.min(Math.max(limit, 1), 20) && Date.now() - started < 20000) {
    const { rows } = await sql`UPDATE email_jobs SET status='sending',attempts=attempts+1,claimed_at=NOW(),last_error=NULL
      WHERE id=(SELECT j.id FROM email_jobs j WHERE j.status='queued' AND j.available_at<=NOW()
        AND (j.source='manual' OR (j.source='invoice' AND j.is_resend) OR EXISTS (SELECT 1 FROM email_settings s WHERE s.singleton=true AND
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
        let recipients;
        try { recipients = emailRecipients(to, ((row.cc_emails || []) as string[]).filter(Boolean), (row.bcc_emails || []) as string[]); }
        catch { throw new OutlookSendError("rejected", "Check the email's To, CC, and BCC addresses before retrying."); }
        const template = row.template_data as EmailTemplateData | null;
        let image: Awaited<ReturnType<typeof prepareEmailImage>> = { imageSrc: undefined, attachments: undefined };
        try { if (template?.kind === "notification") image = await prepareEmailImage(row.image_token as string | null, emailPortalOrigin()); }
        catch { throw new OutlookSendError("rejected", "The notification image is unavailable. Restore it before retrying this email."); }
        const rendered = template?.kind === "invoice" ? invoiceEmail(template, emailPortalOrigin())
          : template?.kind === "notification" ? notificationEmail(template, emailPortalOrigin(), image.imageSrc)
          : { subject: String(row.subject), body: String(row.body), html: row.body_html ? String(row.body_html) : undefined };
        await sql`UPDATE email_jobs SET subject=${rendered.subject},body=${rendered.body},body_html=${rendered.html || null} WHERE id=${row.id as number} AND status='sending'`;
        await sendOutlookMessage({ ...recipients, subject: rendered.subject, body: rendered.body, html: rendered.html,
          attachments: image.attachments, fromName: String(row.from_name || EMAIL_FROM_NAME),
          fromEmail: String(row.from_email || "") || undefined, expectedConnectionId: String(row.connection_id) });
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
    WHERE status='queued' AND ((source='invoice' AND NOT is_resend AND NOT ${autoInvoices}) OR (source='notification' AND NOT ${autoNotifications}))`;
}

/** A deliberate resend keeps the original email history and snapshots current invoice details. */
export async function queueInvoiceResend(invoiceId: number, requestId: string, adminId: number, reviewedUncertain = false) {
  if (!Number.isSafeInteger(invoiceId) || invoiceId < 1 || !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(requestId || "")) throw new Error("Refresh the invoice list and try again.");
  const key = `invoice-resend:${adminId}:${requestId}`;
  const sameRequest = (row: Row) => {
    if (row.source !== 'invoice' || Number(row.source_id) !== invoiceId || !row.is_resend) throw new Error("This resend request was already used for another invoice. Refresh the invoice list.");
    return emailJob(row);
  };
  const existing = await sql`SELECT * FROM email_jobs WHERE idempotency_key=${key}`;
  if (existing.rows.length) return sameRequest(existing.rows[0]);
  const connection = await connectionId();
  const { rows: invoices } = await sql`SELECT i.status,i.additional_recipients,c.email,
    (SELECT j.status FROM email_jobs j WHERE j.source='invoice' AND j.source_id=i.id ORDER BY (j.status IN ('queued','sending')) DESC,j.id DESC LIMIT 1) AS email_status
    FROM client_invoices i JOIN client_accounts c ON c.id=i.client_id WHERE i.id=${invoiceId}`;
  if (!invoices.length) throw new Error("Invoice or client not found. Refresh the invoice list.");
  const invoice = invoices[0];
  if (String(invoice.status).trim().toLowerCase() === 'draft') throw new Error("Publish this draft invoice before sending its email.");
  if (invoice.email_status === 'queued' || invoice.email_status === 'sending') {
    const repeated = await sql`SELECT * FROM email_jobs WHERE idempotency_key=${key}`;
    if (repeated.rows.length) return sameRequest(repeated.rows[0]);
    throw new Error("An email for this invoice is already queued or sending. Refresh email status.");
  }
  if (invoice.email_status === 'uncertain' && !reviewedUncertain) throw new Error("Check Outlook Sent Items before resending an email marked Needs review.");
  emailRecipients([String(invoice.email).trim()], parseEmailAddresses(String(invoice.additional_recipients || ""),10));
  const { rows } = await sql`WITH invoice AS MATERIALIZED (
    SELECT i.* FROM client_invoices i WHERE i.id=${invoiceId} AND LOWER(TRIM(i.status))!='draft' FOR UPDATE
  ), queued AS (
    INSERT INTO email_jobs(idempotency_key,connection_id,to_emails,cc_emails,from_name,from_email,subject,body,template_data,source,source_id,is_resend)
    SELECT ${key},${connection}::uuid,jsonb_build_array(TRIM(c.email)),
      to_jsonb(string_to_array(REPLACE(i.additional_recipients,' ',''),',')),${EMAIL_FROM_NAME},${EMAIL_FROM_ADDRESS},
      'INVOICE - ' || i.bill_coverage || ' : GY Virtual Support Team','Invoice ready for review.',
      jsonb_build_object('kind','invoice','invoiceNumber',i.invoice_number,'billCoverage',i.bill_coverage,'amount',i.amount,
        'dueDate',i.invoice_due_date,'invoiceLink',i.invoice_link,'clientEmail',c.email,'clientName',c.display_name,'defaultPassword',c.password='gyclient2026',
        'isPaid',LOWER(TRIM(i.status))='paid','includesPayPalFees',c.invoice_paypal_fees),
      'invoice',i.id,true FROM invoice i JOIN client_accounts c ON c.id=i.client_id
    ON CONFLICT DO NOTHING RETURNING *
  ), publication AS (
    UPDATE client_invoices i SET email_queued_at=COALESCE(i.email_queued_at,NOW()) FROM queued j WHERE i.id=j.source_id RETURNING i.id
  ) SELECT * FROM queued`;
  if (rows.length) return sameRequest(rows[0]);
  const retry = await sql`SELECT * FROM email_jobs WHERE idempotency_key=${key}`;
  if (retry.rows.length) return sameRequest(retry.rows[0]);
  throw new Error("An invoice email is already queued or the invoice changed. Refresh the invoice list.");
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
      AND (source!='invoice' OR NOT EXISTS (
        SELECT 1 FROM email_jobs active WHERE active.source='invoice' AND active.source_id=email_jobs.source_id AND active.status IN ('queued','sending')
      ))
      AND (expires_at IS NULL OR expires_at>NOW()) RETURNING id`;
  if (!rows.length) throw new Error("This email cannot be retried. Create a new email if needed.");
}
