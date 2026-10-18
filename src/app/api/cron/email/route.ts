import { ensureTables } from "@/lib/db";
import { cronAuthorized } from "@/lib/cron-auth";
import { processNotificationMaintenance } from "@/lib/notifications";
import { processEmailQueue, queueAutomaticEmails } from "@/lib/email-service";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  if (!cronAuthorized(request)) return Response.json({ error: "Unauthorized" }, { status: 401 });
  await ensureTables();
  await processNotificationMaintenance();
  await queueAutomaticEmails();
  const result = await processEmailQueue(20);
  return Response.json({ ok: true, ...result });
}
