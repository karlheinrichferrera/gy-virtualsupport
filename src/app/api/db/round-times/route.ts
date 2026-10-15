import { roundExistingTimeproofEntries } from "@/lib/actions";

export async function GET() {
  const updated = await roundExistingTimeproofEntries();
  return Response.json({ ok: true, updated });
}
