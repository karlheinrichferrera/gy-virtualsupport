import { requireAdminSession } from "@/lib/admin-session";
import { beginOutlookConnection, outlookResultUrl } from "@/lib/outlook";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function redirect(url: string) {
  return new Response(null, { status: 303, headers: { Location: url, "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" } });
}

export async function GET() {
  let admin;
  try { admin = await requireAdminSession(); }
  catch { return redirect(outlookResultUrl("reauth")); }
  try {
    const authorizeUrl = await beginOutlookConnection(admin.id);
    return redirect(authorizeUrl);
  } catch { return redirect(outlookResultUrl("error")); }
}
