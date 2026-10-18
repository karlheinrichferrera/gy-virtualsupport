"use server";

import { sql } from "@vercel/postgres";
import { requireAdminSession } from "./admin-session";
import { getOutlookConfiguration, getOutlookConnection, disconnectOutlookConnection } from "./outlook";
import { cancelPendingEmails, emailJob, processEmailQueue, queueAutomaticEmails, queueManualEmail, retryQueuedEmail, setEmailAutomation } from "./email-service";
import { wakeEmailDelivery } from "./email-dispatch";
import type { EmailJob, EmailSettings, ManualEmailInput } from "./email-types";

let ready: Promise<void> | undefined;
async function prepare() {
  await requireAdminSession();
  if (!ready) ready = import("./db").then(module => module.ensureTables()).catch(error => { ready = undefined; throw error; });
  await ready;
}

export async function getEmailSettings(): Promise<EmailSettings> {
  await prepare();
  const config = getOutlookConfiguration();
  const connection = await getOutlookConnection();
  const { rows } = await sql`SELECT * FROM email_settings WHERE singleton=true`;
  return { ...config, ...connection, lastError: connection.lastError || null,
    autoInvoices: Boolean(rows[0]?.auto_invoices_since), autoNotifications: Boolean(rows[0]?.auto_notifications_since),
    cronConfigured: Boolean(process.env.CRON_SECRET) };
}

export async function getEmailHistory(): Promise<EmailJob[]> {
  await prepare();
  const { rows } = await sql`SELECT * FROM email_jobs ORDER BY id DESC LIMIT 50`;
  wakeEmailDelivery();
  return rows.map(emailJob);
}

export async function sendManualEmail(input: ManualEmailInput): Promise<{ id: number; status: EmailJob["status"] }> {
  const admin = await requireAdminSession();
  await prepare();
  const queued = await queueManualEmail(input, admin.id);
  wakeEmailDelivery();
  return { id: queued.id, status: queued.status };
}

export async function saveEmailAutomation(settings: { autoInvoices: boolean; autoNotifications: boolean }): Promise<void> {
  await prepare();
  if (typeof settings.autoInvoices !== "boolean" || typeof settings.autoNotifications !== "boolean") throw new Error("Invalid email settings.");
  await setEmailAutomation(settings.autoInvoices, settings.autoNotifications);
}

export async function disconnectOutlook(): Promise<void> {
  await prepare();
  // Remove credentials first, so concurrent workers cannot start a new Graph request.
  await disconnectOutlookConnection();
  await cancelPendingEmails();
}

export async function retryEmail(id: number): Promise<void> {
  await prepare();
  if (!Number.isSafeInteger(id) || id < 1) throw new Error("Invalid email.");
  await retryQueuedEmail(id);
  wakeEmailDelivery();
}

export async function refreshEmailDelivery(): Promise<void> {
  await prepare();
  await queueAutomaticEmails();
  await processEmailQueue(3);
}
