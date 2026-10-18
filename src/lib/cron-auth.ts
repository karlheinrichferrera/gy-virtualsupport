import { timingSafeEqual } from "node:crypto";

export function cronAuthorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const provided = Buffer.from(request.headers.get("authorization") || "");
  return expected.length === provided.length && timingSafeEqual(expected, provided);
}
