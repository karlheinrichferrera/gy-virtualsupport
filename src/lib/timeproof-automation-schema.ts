import { sql } from "@vercel/postgres";

/** Older deployments may still attempt the retired schedule-fill insert. */
export async function ensureTimeproofAutomationSchema() {
  await sql`CREATE OR REPLACE FUNCTION block_karl_schedule_autofill() RETURNS trigger
    LANGUAGE plpgsql AS $$
    BEGIN
      IF NEW.va_id = '500101' AND NEW.notes = 'Auto-filled from schedule' THEN
        RETURN NULL;
      END IF;
      RETURN NEW;
    END;
    $$`;
  await sql`DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='block_karl_schedule_autofill'
      AND tgrelid='timeproof_entries'::regclass AND NOT tgisinternal) THEN
      CREATE TRIGGER block_karl_schedule_autofill BEFORE INSERT ON timeproof_entries
        FOR EACH ROW EXECUTE FUNCTION block_karl_schedule_autofill();
    END IF;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END $$`;
}
