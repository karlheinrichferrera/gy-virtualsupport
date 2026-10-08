import { sql } from "@vercel/postgres";

export async function GET() {
  const checks: Record<string, string> = {};

  checks.POSTGRES_URL = process.env.POSTGRES_URL ? "SET (length: " + process.env.POSTGRES_URL.length + ")" : "NOT SET";

  try {
    const { rows } = await sql`SELECT 1 as ok`;
    checks.connection = rows[0]?.ok === 1 ? "OK" : "UNEXPECTED";
  } catch (e) {
    checks.connection = `FAILED: ${e instanceof Error ? e.message : String(e)}`;
  }

  try {
    const { rows } = await sql`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name
    `;
    checks.tables = rows.map((r) => r.table_name as string).join(", ") || "NONE";
  } catch (e) {
    checks.tables = `FAILED: ${e instanceof Error ? e.message : String(e)}`;
  }

  try {
    const { rows } = await sql`SELECT COUNT(*) as cnt FROM va_profiles`;
    checks.profiles_count = rows[0].cnt as string;
  } catch (e) {
    checks.profiles_count = `FAILED: ${e instanceof Error ? e.message : String(e)}`;
  }

  return Response.json(checks);
}
