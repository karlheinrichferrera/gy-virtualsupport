import { requireAdminSession } from "@/lib/admin-session";
import { completeOutlookConnection, outlookResultUrl, type OutlookCallbackStatus } from "@/lib/outlook";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  let admin;
  try { admin = await requireAdminSession(); }
  catch {
    return new Response(null, { status: 303, headers: { Location: outlookResultUrl("reauth"), "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" } });
  }
  let status: OutlookCallbackStatus = "error";
  try { status = await completeOutlookConnection(admin.id, new URL(request.url).searchParams); }
  catch { /* Only fixed result flags leave this callback; provider bodies and credentials stay private. */ }
  return new Response(null, {
    status: 303,
    headers: { Location: outlookResultUrl(status), "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" },
  });
}
