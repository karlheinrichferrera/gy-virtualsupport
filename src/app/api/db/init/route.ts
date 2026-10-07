import { initDatabase } from "@/lib/actions";

export async function GET() {
  const result = await initDatabase();
  return Response.json(result);
}
