// Run explicitly: node --use-env-proxy --test tests/notifications.integration.test.mjs
// Every query uses a disposable schema; application tables are never selected or changed.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import ts from 'typescript';
import { neon } from '@neondatabase/serverless';
const runtimeRequire = createRequire(import.meta.url);
const directory = path.dirname(fileURLToPath(import.meta.url));

test('notification storage, delivery, and per-person retention', { skip: !process.env.POSTGRES_URL }, async t => {
  const connection = neon(process.env.POSTGRES_URL, { fullResults: true });
  const schema = `notification_test_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  // SET LOCAL and the tested statement execute in the same transaction.
  const sql = async (strings, ...values) => {
    const query = strings.reduce((text, part, i) => text + (i ? `$${i}` : '') + part, '');
    const results = await connection.transaction([
      connection("SELECT set_config('search_path', $1, true)", [schema]),
      connection(query, values),
    ]);
    return results[1];
  };
  const modules = new Map();
  function loadTs(filename) {
    const full = path.resolve(directory, '../src/lib', filename);
    if (modules.has(full)) return modules.get(full).exports;
    const testModule = { exports: {} }; modules.set(full, testModule);
    const code = ts.transpileModule(fs.readFileSync(full, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
    }).outputText;
    const localRequire = name => name === '@vercel/postgres' ? { sql }
      : name.startsWith('./') ? loadTs(`${name.slice(2)}.ts`) : runtimeRequire(name);
    new Function('require', 'module', 'exports', code)(localRequire, testModule, testModule.exports);
    return testModule.exports;
  }
  await connection(`CREATE SCHEMA ${schema}`);
  try {
    await sql`CREATE TABLE notifications (
      id SERIAL PRIMARY KEY, va_id TEXT NOT NULL DEFAULT '', title TEXT NOT NULL,
      message TEXT NOT NULL DEFAULT '', type TEXT NOT NULL DEFAULT 'admin', is_read BOOLEAN NOT NULL DEFAULT false,
      created_at TEXT NOT NULL DEFAULT '', created_by TEXT NOT NULL DEFAULT 'admin')`;
    await sql`CREATE TABLE notification_reads (notification_id INTEGER REFERENCES notifications(id) ON DELETE CASCADE, va_id TEXT NOT NULL)`;
    await sql`CREATE TABLE va_profiles (id TEXT PRIMARY KEY)`;
    await sql`CREATE TABLE client_accounts (id INTEGER PRIMARY KEY, email TEXT NOT NULL)`;
    await sql`INSERT INTO va_profiles VALUES ('test-va-1'), ('test-va-2')`;
    await sql`INSERT INTO client_accounts VALUES (1, 'one@example.invalid'), (2, 'two@example.invalid')`;
    await sql`INSERT INTO notifications(va_id,title,is_read) VALUES ('test-va-1','Legacy read',true), ('','Legacy broadcast',false)`;
    await sql`INSERT INTO notification_reads VALUES (2, 'test-va-1')`;
    const { ensureNotificationSchema } = loadTs('notification-schema.ts');
    const service = loadTs('notifications.ts');
    await t.test('migration preserves existing VA reads and is repeatable', async () => {
      await ensureNotificationSchema(); await ensureNotificationSchema();
      const { rows } = await sql`SELECT * FROM notification_receipts`;
      assert.equal(rows.length, 2);
      assert.ok((await service.recipientNotifications('va', 'test-va-1')).every(n => n.isRead));
    });
    const create = (data = {}) => service.saveNotification({ audience: 'va', title: 'Test', message: 'Body', ...data });
    await t.test('client/VA audiences and individual recipients remain separate', async () => {
      await create({ audience: 'client', title: 'All clients' });
      await create({ audience: 'client', clientId: 1, title: 'Client one' });
      await create({ vaId: 'test-va-1', title: 'VA one' });
      assert.deepEqual((await service.recipientNotifications('client', '1')).map(n => n.title).sort(), ['All clients', 'Client one']);
      assert.deepEqual((await service.recipientNotifications('client', '2')).map(n => n.title), ['All clients']);
      assert.ok((await service.recipientNotifications('va', 'test-va-2')).every(n => !n.title.includes('Client') && n.title !== 'All clients' && n.title !== 'VA one'));
      assert.equal(await service.clientRecipientId('ONE@EXAMPLE.INVALID'), '1');
      await service.readRecipientNotifications('client', '2', (await service.recipientNotifications('client', '1')).find(n => n.title === 'Client one').id);
      const wrong = await sql`SELECT * FROM notification_receipts WHERE audience='client' AND recipient_id='2'`;
      assert.equal(wrong.rows.length, 0);
    });
    await t.test('mark all read is per user and never extends the original read time', async () => {
      await service.readRecipientNotifications('client', '1');
      const before = await sql`SELECT read_at FROM notification_receipts WHERE audience='client' AND recipient_id='1' ORDER BY notification_id`;
      await service.readRecipientNotifications('client', '1');
      const after = await sql`SELECT read_at FROM notification_receipts WHERE audience='client' AND recipient_id='1' ORDER BY notification_id`;
      assert.deepEqual(before.rows, after.rows);
      assert.ok((await service.recipientNotifications('client', '1')).every(n => n.isRead));
      assert.ok((await service.recipientNotifications('client', '2')).every(n => !n.isRead));
    });
    await t.test('after 24h a broadcast disappears only for its reader; personal delivery is deleted', async () => {
      await sql`UPDATE notification_receipts SET read_at=NOW()-INTERVAL '25 hours' WHERE audience='client' AND recipient_id='1'`;
      assert.equal((await service.recipientNotifications('client', '1')).length, 0);
      assert.equal((await service.recipientNotifications('client', '2')).length, 1);
      const personal = await sql`SELECT id FROM notifications WHERE title='Client one'`;
      assert.equal(personal.rows.length, 0);
      // Repeated reads must never resurrect cleared broadcasts.
      await service.readRecipientNotifications('client', '1');
      assert.equal((await service.recipientNotifications('client', '1')).length, 0);
    });
    await t.test('future notifications stay hidden; concurrent delivery creates one occurrence', async () => {
      await create({ title:'Future', startsAt:new Date(Date.now()+86400000).toISOString() });
      assert.ok(!(await service.recipientNotifications('va','test-va-1')).some(n=>n.title==='Future'));
      await sql`UPDATE notification_schedules SET starts_at=NOW()-INTERVAL '1 minute', next_run_at=NOW()-INTERVAL '1 minute' WHERE title='Future'`;
      await Promise.all([service.processNotificationMaintenance(), service.processNotificationMaintenance()]);
      assert.equal((await service.recipientNotifications('va','test-va-1')).filter(n=>n.title==='Future').length, 1);
      const schedules = await sql`SELECT next_run_at FROM notification_schedules WHERE title='Future'`;
      assert.equal(schedules.rows[0].next_run_at, null);
    });
    await t.test('recurrence advances and a fresh occurrence has independent read state', async () => {
      await create({ title:'Daily', recurrence:'daily', timeZone:'America/New_York', startsAt:new Date(Date.now()-3600000).toISOString() });
      let daily = (await service.recipientNotifications('va','test-va-1')).find(n=>n.title==='Daily');
      await service.readRecipientNotifications('va','test-va-1',daily.id);
      const firstId = daily.id;
      await sql`UPDATE notification_schedules SET starts_at=starts_at-INTERVAL '1 day',next_run_at=NOW()-INTERVAL '1 minute' WHERE title='Daily'`;
      await service.processNotificationMaintenance();
      // Changing original anchor backwards creates the same wall-clock run today,
      // so force the prior occurrence to yesterday to simulate a day passing.
      await sql`UPDATE notifications SET scheduled_for=scheduled_for-INTERVAL '1 day' WHERE id=${firstId}`;
      await sql`UPDATE notification_schedules SET next_run_at=NOW()-INTERVAL '1 minute' WHERE title='Daily'`;
      await service.processNotificationMaintenance();
      daily = (await service.recipientNotifications('va','test-va-1')).find(n=>n.title==='Daily' && n.id!==firstId);
      assert.ok(daily); assert.equal(daily.isRead,false);
      const {rows}=await sql`SELECT next_run_at>NOW() AS future FROM notification_schedules WHERE title='Daily'`;
      assert.equal(rows[0].future,true);
    });
    await t.test('expiry removes deliveries and prevents expired schedules from sending', async () => {
      await create({title:'Expires',expiresAt:new Date(Date.now()+3600000).toISOString()});
      await sql`UPDATE notifications SET expires_at=NOW()-INTERVAL '1 second' WHERE title='Expires'`;
      await sql`UPDATE notification_schedules SET expires_at=NOW()-INTERVAL '1 second',next_run_at=NOW()-INTERVAL '1 day' WHERE title='Daily'`;
      await service.processNotificationMaintenance();
      const {rows}=await sql`SELECT title FROM notifications WHERE title IN ('Expires','Daily')`;
      assert.equal(rows.length,0);
    });
    await t.test('images/links persist, invalid redirects and files are rejected', async () => {
      const imageUrl='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=';
      await create({title:'Greeting',imageUrl,redirectTo:'/dashboard/profile'});
      const greeting=(await service.recipientNotifications('va','test-va-1')).find(n=>n.title==='Greeting');
      assert.equal(greeting.imageUrl,`/api/notifications/image/${greeting.id}`); assert.equal(greeting.redirectTo,'/dashboard/profile');
      const image=await service.notificationImage(greeting.id);
      assert.equal(image.contentType,'image/png'); assert.equal(image.bytes.toString('base64'),imageUrl.split(',')[1]);
      assert.equal(await service.notificationImage(0),null);
      for(const redirectTo of ['https://example.com','//example.com','/dashboard/../admin','/dashboard/%2e%2e/admin','/client/dashboard','/dashboard\\evil']) {
        await assert.rejects(create({redirectTo}));
      }
      await assert.rejects(create({imageUrl:'data:image/svg+xml;base64,PHN2Zz4='}));
      await assert.rejects(create({imageUrl:'data:image/png;base64,YWJjZA=='}));
      await assert.rejects(create({expiresAt:new Date(Date.now()-3600000).toISOString()}));
      await assert.rejects(create({clientId:999,audience:'client'}));
    });
    await t.test('admin listing retains schedule controls and schedule deletion cascades', async () => {
      const all=await service.adminNotifications();const future=all.find(n=>n.title==='Future');
      assert.ok(future.scheduleId);assert.equal(future.status,'active');
      await service.removeNotificationSchedule(future.scheduleId);
      const {rows}=await sql`SELECT id FROM notifications WHERE title='Future'`;
      assert.equal(rows.length,0);
    });
  } finally {
    await connection(`DROP SCHEMA ${schema} CASCADE`);
  }
});
