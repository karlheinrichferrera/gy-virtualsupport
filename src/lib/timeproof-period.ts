/** Calendar dates use local components, never UTC conversion of local midnight. */
export function dateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

/** Monday–Sunday weeks, retaining the existing October 5 biweekly anchor. */
export function periodStart(date: Date, days: 7 | 14): Date {
  const calendarDay = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  const anchor = Date.UTC(2026, 9, 5);
  const offset = Math.floor((calendarDay - anchor) / 86400000 / days) * days;
  const start = new Date(2026, 9, 5, 12);
  start.setDate(start.getDate() + offset);
  return start;
}
