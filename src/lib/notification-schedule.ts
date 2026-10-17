export type NotificationRecurrence = "daily" | "weekly" | "monthly" | "yearly";

export interface NotificationRun {
  scheduledFor: string;
  nextRunAt: string;
}

interface LocalDateTime {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  millisecond: number;
}

const DAY = 86_400_000;
const formatters = new Map<string, Intl.DateTimeFormat>();

export function notificationTimeZoneValid(timeZone: string): boolean {
  if (typeof timeZone !== "string" || !timeZone || /^[+-]/.test(timeZone)) return false;
  try {
    formatter(timeZone);
    return true;
  } catch {
    return false;
  }
}

function formatter(timeZone: string): Intl.DateTimeFormat {
  let result = formatters.get(timeZone);
  if (!result) {
    result = new Intl.DateTimeFormat("en-US", {
      timeZone,
      calendar: "gregory",
      numberingSystem: "latn",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    });
    formatters.set(timeZone, result);
  }
  return result;
}

function localParts(timestamp: number, timeZone: string): LocalDateTime {
  const parts = Object.fromEntries(formatter(timeZone).formatToParts(timestamp).map(part => [part.type, part.value]));
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    second: Number(parts.second),
    millisecond: ((timestamp % 1000) + 1000) % 1000,
  };
}

// A UTC representation of civil date components, used only for calendar math.
function civilTimestamp(parts: LocalDateTime): number {
  const date = new Date(0);
  date.setUTCFullYear(parts.year, parts.month - 1, parts.day);
  date.setUTCHours(parts.hour, parts.minute, parts.second, parts.millisecond);
  return date.getTime();
}

function daysInMonth(year: number, month: number): number {
  const date = new Date(0);
  date.setUTCFullYear(year, month, 0);
  return date.getUTCDate();
}

function instantFromLocal(parts: LocalDateTime, timeZone: string): number {
  const target = civilTimestamp(parts);
  const offsets = new Set<number>();
  // Include both sides of an offset transition, including date-line changes.
  for (const days of [-2, -1, 0, 1, 2]) {
    const probe = target + days * DAY;
    offsets.add(civilTimestamp(localParts(probe, timeZone)) - probe);
  }

  const candidates = [...offsets].map(offset => {
    const instant = target - offset;
    return { instant, delta: civilTimestamp(localParts(instant, timeZone)) - target };
  });
  const exact = candidates.filter(candidate => candidate.delta === 0);
  // Repeated fall-back times use the earlier instant. Missing spring-forward
  // times move forward by the gap, matching Temporal's compatible behavior.
  if (exact.length) return Math.min(...exact.map(candidate => candidate.instant));
  const afterGap = candidates.filter(candidate => candidate.delta > 0).sort((a, b) => a.delta - b.delta);
  if (afterGap.length) return afterGap[0].instant;
  throw new RangeError("Cannot resolve the notification's local date and time");
}

function checkedTimestamp(iso: string): number {
  const timestamp = Date.parse(iso);
  if (!Number.isFinite(timestamp)) throw new RangeError("Invalid notification date");
  return timestamp;
}

function validate(recurrence: NotificationRecurrence, timeZone: string): void {
  if (!["daily", "weekly", "monthly", "yearly"].includes(recurrence)) {
    throw new RangeError("Invalid notification recurrence");
  }
  if (!notificationTimeZoneValid(timeZone)) throw new RangeError("Invalid notification time zone");
}

function occurrence(anchor: number, localAnchor: LocalDateTime, recurrence: NotificationRecurrence, timeZone: string, index: number): number {
  // Preserve the exact first instant even if it is the later fall-back time.
  if (index === 0) return anchor;
  const target = { ...localAnchor };
  if (recurrence === "daily" || recurrence === "weekly") {
    const date = new Date(civilTimestamp(localAnchor) + index * (recurrence === "weekly" ? 7 : 1) * DAY);
    target.year = date.getUTCFullYear();
    target.month = date.getUTCMonth() + 1;
    target.day = date.getUTCDate();
  } else {
    const monthIndex = localAnchor.year * 12 + localAnchor.month - 1 + index * (recurrence === "yearly" ? 12 : 1);
    target.year = Math.floor(monthIndex / 12);
    target.month = monthIndex % 12 + 1;
    target.day = Math.min(localAnchor.day, daysInMonth(target.year, target.month));
  }
  return instantFromLocal(target, timeZone);
}

/** The first recurrence after the supplied anchor, preserving its local time. */
export function nextNotificationOccurrence(startsAtISO: string, recurrence: NotificationRecurrence, timeZone: string): string {
  validate(recurrence, timeZone);
  const anchor = checkedTimestamp(startsAtISO);
  return new Date(occurrence(anchor, localParts(anchor, timeZone), recurrence, timeZone, 1)).toISOString();
}

/**
 * Return only the latest due occurrence, skipping missed deliveries. Always use
 * the original startsAt anchor so January 31 and leap-day schedules do not drift
 * after a shorter month/year. No occurrence is due before the initial start.
 */
export function deriveNotificationRun(startsAtISO: string, recurrence: NotificationRecurrence, timeZone: string, nowISO: string): NotificationRun | null {
  validate(recurrence, timeZone);
  const anchor = checkedTimestamp(startsAtISO);
  const now = checkedTimestamp(nowISO);
  if (anchor > now) return null;

  const localAnchor = localParts(anchor, timeZone);
  const localNow = localParts(now, timeZone);
  let index: number;
  if (recurrence === "monthly") {
    index = (localNow.year - localAnchor.year) * 12 + localNow.month - localAnchor.month;
  } else if (recurrence === "yearly") {
    index = localNow.year - localAnchor.year;
  } else {
    const dateOnly = (parts: LocalDateTime) => civilTimestamp({ ...parts, hour: 0, minute: 0, second: 0, millisecond: 0 });
    index = Math.floor((dateOnly(localNow) - dateOnly(localAnchor)) / (DAY * (recurrence === "weekly" ? 7 : 1)));
  }
  index = Math.max(index, 0);
  let scheduledFor = occurrence(anchor, localAnchor, recurrence, timeZone, index);
  while (index > 0 && scheduledFor > now) {
    scheduledFor = occurrence(anchor, localAnchor, recurrence, timeZone, --index);
  }
  let nextRunAt = occurrence(anchor, localAnchor, recurrence, timeZone, index + 1);
  while (nextRunAt <= now) {
    scheduledFor = nextRunAt;
    nextRunAt = occurrence(anchor, localAnchor, recurrence, timeZone, ++index + 1);
  }
  return { scheduledFor: new Date(scheduledFor).toISOString(), nextRunAt: new Date(nextRunAt).toISOString() };
}
