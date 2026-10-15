import { roundExistingTimeproofEntries } from "@/lib/actions";

export const dynamic = "force-dynamic";

export async function GET() {
  const updated = await roundExistingTimeproofEntries();
  return Response.json({ ok: true, updated });
}
