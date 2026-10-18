import { after } from "next/server";
import { processEmailQueue, queueAutomaticEmails } from "./email-service";
import { getOutlookConfiguration } from "./outlook";

/** Durable rows survive a terminated invocation; a later portal request/cron resumes them. */
export function wakeEmailDelivery() {
  if (!getOutlookConfiguration().configured) return;
  after(async () => {
    try {
      await queueAutomaticEmails();
      await processEmailQueue(5);
    } catch {
      // Avoid leaking provider credentials or recipient data into platform logs.
      console.error("Email delivery is pending; inspect Admin > Email and retry the scheduler.");
    }
  });
}
