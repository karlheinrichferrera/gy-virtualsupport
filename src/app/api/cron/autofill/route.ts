import { generateBiweeklyReminders, processScheduledNotifications } from "@/lib/actions";
import { cronAuthorized } from "@/lib/cron-auth";
import { processEmailQueue, queueAutomaticEmails } from "@/lib/email-service";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  if (process.env.CRON_SECRET && !cronAuthorized(request)) return Response.json({ error: "Unauthorized" }, { status: 401 });
  await processScheduledNotifications();
  await generateBiweeklyReminders();
  if (cronAuthorized(request)) {
    await queueAutomaticEmails();
    await processEmailQueue(10);
  }
  return Response.json({ ok: true, filled: false, count: 0 });
}
