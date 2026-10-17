import { autoFillScheduleTimeproof, generateBiweeklyReminders, processScheduledNotifications } from "@/lib/actions";

export const dynamic = "force-dynamic";

const OWNER_VA_ID = "500101";

export async function GET() {
  await processScheduledNotifications();
  const result = await autoFillScheduleTimeproof(OWNER_VA_ID);
  await generateBiweeklyReminders();
  return Response.json({ ok: true, ...result });
}
