import assert from "node:assert/strict";
import test from "node:test";
import {
  deriveNotificationRun,
  nextNotificationOccurrence,
  notificationTimeZoneValid,
} from "../src/lib/notification-schedule.ts";

const NY = "America/New_York";

test("daily and weekly notifications preserve New York wall time through spring DST", () => {
  assert.equal(nextNotificationOccurrence("2026-03-07T14:00:00Z", "daily", NY), "2026-03-08T13:00:00.000Z");
  assert.equal(nextNotificationOccurrence("2026-03-01T14:00:00Z", "weekly", NY), "2026-03-08T13:00:00.000Z");
});

test("daily notifications preserve wall time through fall DST", () => {
  assert.equal(nextNotificationOccurrence("2026-10-31T13:00:00Z", "daily", NY), "2026-11-01T14:00:00.000Z");
});

test("missing spring times move forward and the next day recovers the original time", () => {
  const anchor = "2026-03-07T07:30:00Z"; // 02:30 EST
  assert.equal(nextNotificationOccurrence(anchor, "daily", NY), "2026-03-08T07:30:00.000Z");
  assert.deepEqual(deriveNotificationRun(anchor, "daily", NY, "2026-03-08T08:00:00Z"), {
    scheduledFor: "2026-03-08T07:30:00.000Z",
    nextRunAt: "2026-03-09T06:30:00.000Z",
  });
});

test("ambiguous fall times use the earlier occurrence without repeating delivery", () => {
  const anchor = "2026-10-31T05:30:00Z";
  assert.equal(nextNotificationOccurrence(anchor, "daily", NY), "2026-11-01T05:30:00.000Z");
  assert.deepEqual(deriveNotificationRun(anchor, "daily", NY, "2026-11-01T06:45:00Z"), {
    scheduledFor: "2026-11-01T05:30:00.000Z",
    nextRunAt: "2026-11-02T06:30:00.000Z",
  });
});

test("the original fall-back anchor's exact instant is retained", () => {
  const anchor = "2026-11-01T06:30:00Z";
  assert.equal(deriveNotificationRun(anchor, "daily", NY, "2026-11-01T06:00:00Z"), null);
  assert.equal(deriveNotificationRun(anchor, "daily", NY, anchor).scheduledFor, "2026-11-01T06:30:00.000Z");
});

test("monthly schedules clamp short months without drifting from the original day", () => {
  const anchor = "2026-01-31T15:00:00Z"; // 10:00 EST
  assert.deepEqual(deriveNotificationRun(anchor, "monthly", NY, "2026-02-28T16:00:00Z"), {
    scheduledFor: "2026-02-28T15:00:00.000Z",
    nextRunAt: "2026-03-31T14:00:00.000Z",
  });
  assert.equal(deriveNotificationRun(anchor, "monthly", NY, "2026-03-31T15:00:00Z").nextRunAt, "2026-04-30T14:00:00.000Z");
});

test("yearly leap-day schedules use February 28 then return to February 29", () => {
  const anchor = "2024-02-29T15:00:00Z";
  assert.equal(nextNotificationOccurrence(anchor, "yearly", NY), "2025-02-28T15:00:00.000Z");
  assert.deepEqual(deriveNotificationRun(anchor, "yearly", NY, "2027-03-01T00:00:00Z"), {
    scheduledFor: "2027-02-28T15:00:00.000Z",
    nextRunAt: "2028-02-29T15:00:00.000Z",
  });
});

test("future starts return null and the exact start is due", () => {
  const anchor = "2026-10-17T09:00:00Z";
  assert.equal(deriveNotificationRun(anchor, "daily", "UTC", "2026-10-17T08:59:59Z"), null);
  assert.deepEqual(deriveNotificationRun(anchor, "daily", "UTC", anchor), {
    scheduledFor: "2026-10-17T09:00:00.000Z",
    nextRunAt: "2026-10-18T09:00:00.000Z",
  });
});

test("a calendar estimate before today's time selects yesterday's occurrence", () => {
  assert.deepEqual(deriveNotificationRun("2026-01-01T14:00:00Z", "daily", NY, "2026-03-09T12:00:00Z"), {
    scheduledFor: "2026-03-08T13:00:00.000Z",
    nextRunAt: "2026-03-09T13:00:00.000Z",
  });
});

test("long missed schedules skip directly to the latest due date", () => {
  assert.deepEqual(deriveNotificationRun("1970-01-01T09:00:00Z", "daily", "UTC", "9999-10-17T10:00:00Z"), {
    scheduledFor: "9999-10-17T09:00:00.000Z",
    nextRunAt: "9999-10-18T09:00:00.000Z",
  });
});

test("non-hour offsets and milliseconds are preserved", () => {
  assert.equal(nextNotificationOccurrence("2026-10-17T03:15:00.123Z", "daily", "Asia/Kathmandu"), "2026-10-18T03:15:00.123Z");
  assert.equal(nextNotificationOccurrence("2026-04-04T14:15:00Z", "daily", "Australia/Lord_Howe"), "2026-04-05T14:45:00.000Z");
});

test("invalid date, recurrence, and timezone inputs fail clearly", () => {
  assert.equal(notificationTimeZoneValid(NY), true);
  assert.equal(notificationTimeZoneValid("UTC"), true);
  assert.equal(notificationTimeZoneValid(""), false);
  assert.equal(notificationTimeZoneValid("Not/A_Timezone"), false);
  assert.equal(notificationTimeZoneValid("+03:00"), false);
  assert.throws(() => nextNotificationOccurrence("bad date", "daily", NY), /Invalid notification date/);
  assert.throws(() => nextNotificationOccurrence("2026-10-17T00:00:00Z", "hourly", NY), /Invalid notification recurrence/);
  assert.throws(() => nextNotificationOccurrence("2026-10-17T00:00:00Z", "daily", "invalid"), /Invalid notification time zone/);
});
