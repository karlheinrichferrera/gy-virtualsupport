const TZ = "America/New_York";

export function estDate(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: TZ });
}

export function estTime(): string {
  return new Date().toLocaleTimeString("en-GB", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hour12: false });
}

export function estDateLong(): string {
  return new Date().toLocaleDateString("en-US", { timeZone: TZ, year: "numeric", month: "long", day: "numeric" });
}

export function localTZ(): string {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (tz === TZ) return "";
    const abbr = new Date().toLocaleTimeString("en-US", { timeZone: tz, timeZoneName: "short" }).split(" ").pop() || "";
    return abbr;
  } catch {
    return "";
  }
}

export function estToLocal(estTimeStr: string, dateStr: string): string {
  if (!estTimeStr || !dateStr) return "";
  try {
    const localTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (localTz === TZ) return "";
    const dt = new Date(`${dateStr}T${estTimeStr}:00`);
    const estOffset = getOffsetMinutes(dt, TZ);
    const utc = new Date(dt.getTime() + estOffset * 60000);
    return utc.toLocaleTimeString("en-GB", { timeZone: localTz, hour: "2-digit", minute: "2-digit", hour12: false });
  } catch {
    return "";
  }
}

function getOffsetMinutes(date: Date, tz: string): number {
  const str = date.toLocaleString("en-US", { timeZone: tz });
  const tzDate = new Date(str);
  const utcStr = date.toLocaleString("en-US", { timeZone: "UTC" });
  const utcDate = new Date(utcStr);
  return (utcDate.getTime() - tzDate.getTime()) / 60000;
}
