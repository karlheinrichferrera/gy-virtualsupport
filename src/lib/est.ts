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
