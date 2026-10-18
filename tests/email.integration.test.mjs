// Run explicitly: node --use-env-proxy --test tests/email.integration.test.mjs
// Every database statement is scoped to a disposable schema. Graph is always mocked.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { neon } from '@neondatabase/serverless';

const runtimeRequire = createRequire(import.meta.url);
const directory = path.dirname(fileURLToPath(import.meta.url));

test('email publication snapshots and durable delivery queue', { skip: !process.env.POSTGRES_URL }, async t => {
  const connection = neon(process.env.POSTGRES_URL, { fullResults: true });
  const schema = `email_test_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  let afterStatement = async () => {};
  const sql = async (strings, ...values) => {
    const query = strings.reduce((text, part, index) => text + (index ? `$${index}` : '') + part, '');
    const results = await connection.transaction([
      connection("SELECT set_config('search_path', $1, true)", [schema]),
      connection(query, values),
    ]);
    await afterStatement(query);
    return results[1];
  };
  const sent = [];
  let sendHook = async () => {};
  class OutlookSendError extends Error {
    constructor(kind, message, retryAfterSeconds) {
      super(message); this.kind = kind; this.retryAfterSeconds = retryAfterSeconds;
    }
  }
  const outlook = {
    OutlookSendError,
    async getOutlookConnection() {
      const { rows } = await sql`SELECT encrypted_tokens, sender_email FROM outlook_connection WHERE singleton=true`;
      return { connected: Boolean(rows[0]?.encrypted_tokens), senderEmail: rows[0]?.sender_email ?? null, senderName: 'Test sender' };
    },
    async sendOutlookMessage(message) {
      sent.push(structuredClone(message));
      await sendHook(message);
    },
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
      : name === './outlook' ? outlook
      : name.startsWith('./') ? loadTs(`${name.slice(2)}.ts`) : runtimeRequire(name);
    new Function('require', 'module', 'exports', code)(localRequire, testModule, testModule.exports);
    return testModule.exports;
  }
  await connection(`CREATE SCHEMA ${schema}`);
  try {
    await sql`CREATE TABLE client_accounts (id INTEGER PRIMARY KEY, email TEXT, display_name TEXT NOT NULL,password TEXT NOT NULL DEFAULT 'gyclient2026')`;
    await sql`CREATE TABLE va_profiles (id TEXT PRIMARY KEY, email TEXT)`;
    await sql`CREATE TABLE invoices(id SERIAL PRIMARY KEY,va_id TEXT REFERENCES va_profiles(id),client_id INTEGER,invoice_number TEXT,date_covered TEXT,amount TEXT,transaction_fee TEXT,amount_disbursed TEXT,invoice_copy TEXT,status TEXT,submission_key UUID UNIQUE)`;
    await sql`CREATE TABLE client_invoices (
      id SERIAL PRIMARY KEY, client_id INTEGER NOT NULL, invoice_number TEXT NOT NULL,
      bill_coverage TEXT NOT NULL DEFAULT 'October', amount TEXT NOT NULL DEFAULT '100.00',
      invoice_due_date TEXT NOT NULL DEFAULT '2026-10-31', status TEXT NOT NULL DEFAULT 'Unpaid',invoice_link TEXT NOT NULL DEFAULT '')`;
    await sql`CREATE TABLE notifications (
      id SERIAL PRIMARY KEY, audience TEXT NOT NULL DEFAULT 'va', va_id TEXT NOT NULL DEFAULT '',
      client_id INTEGER, title TEXT NOT NULL, message TEXT NOT NULL DEFAULT 'Portal update',is_read BOOLEAN NOT NULL DEFAULT false,created_at TEXT NOT NULL DEFAULT '',created_by TEXT NOT NULL DEFAULT '',
      redirect_to TEXT NOT NULL DEFAULT '', type TEXT NOT NULL DEFAULT 'general',image_url TEXT NOT NULL DEFAULT '', published_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), expires_at TIMESTAMPTZ)`;
    await sql`CREATE TABLE notification_reads(notification_id INTEGER REFERENCES notifications(id) ON DELETE CASCADE,va_id TEXT NOT NULL)`;
    await sql`CREATE TABLE outlook_connection (
      singleton BOOLEAN PRIMARY KEY DEFAULT true, connection_id UUID NOT NULL,
      encrypted_tokens TEXT, sender_email TEXT)`;
    await sql`INSERT INTO client_accounts VALUES (1,'one@example.invalid','Client One'),(2,'two@example.invalid','Client Two')`;
    await sql`INSERT INTO va_profiles VALUES ('va-1','va-one@example.invalid'),('va-2','va-two@example.invalid')`;
    await sql`INSERT INTO outlook_connection VALUES (true,${randomUUID()}::uuid,'mock-tokens','hello.graveyardcrewph@outlook.com')`;
    const { ensureEmailSchema } = loadTs('email-schema.ts');
    await loadTs('notification-schema.ts').ensureNotificationSchema();
    await ensureEmailSchema();
    const service = loadTs('email-service.ts');
    const reset = async () => {
      sent.length = 0; sendHook = async () => {}; afterStatement = async () => {};
      await sql`TRUNCATE email_jobs,client_invoices,invoices,notifications,email_va_contacts,notification_email_images,notification_image_assets RESTART IDENTITY CASCADE`;
      await sql`DELETE FROM va_profiles WHERE id NOT IN ('va-1','va-2')`;
      await sql`UPDATE va_profiles SET email=CASE WHEN id='va-1' THEN 'va-one@example.invalid' ELSE 'va-two@example.invalid' END`;
      await sql`DELETE FROM client_accounts WHERE id NOT IN (1,2)`;
      await sql`UPDATE email_settings SET auto_invoices_since=NULL,auto_notifications_since=NULL`;
      await sql`UPDATE outlook_connection SET connection_id=${randomUUID()}::uuid,encrypted_tokens='mock-tokens'`;
    };
    const manual = (data = {}) => ({ to: ['person@example.invalid'], subject: 'Test email', body: 'Message body', requestId: randomUUID(), ...data });
    const jobs = async () => (await sql`SELECT * FROM email_jobs ORDER BY id`).rows;

    await t.test('migration is repeatable and never publishes legacy invoices', async () => {
      await sql`INSERT INTO client_invoices(client_id,invoice_number) VALUES (1,'LEGACY')`;
      await ensureEmailSchema();
      const { rows } = await sql`SELECT email_published_at,email_queued_at FROM client_invoices`;
      assert.deepEqual(rows, [{ email_published_at: null, email_queued_at: null }]);
    });

    await t.test('automation sends only future publications, hides Drafts, and keeps its original enablement cutoff', async () => {
      await reset();
      await sql`INSERT INTO client_invoices(client_id,invoice_number,email_published_at) VALUES (1,'OLD',NOW()-INTERVAL '1 day')`;
      await sql`INSERT INTO notifications(title,published_at) VALUES ('Old notice',NOW()-INTERVAL '1 day')`;
      await service.setEmailAutomation(true, true);
      const before = (await sql`SELECT * FROM email_settings`).rows[0];
      await service.setEmailAutomation(true, true);
      assert.deepEqual((await sql`SELECT * FROM email_settings`).rows[0], before);
      await sql`INSERT INTO client_invoices(client_id,invoice_number,status,email_published_at) VALUES
        (1,'PUBLISHED','Unpaid',NOW()),(1,'DRAFT',' Draft ',NOW()),(2,'FUTURE','Unpaid',NOW()+INTERVAL '1 day')`;
      await sql`INSERT INTO notifications(title,audience,client_id,published_at,expires_at) VALUES
        ('New notice','client',1,NOW(),NULL),('Future notice','client',1,NOW()+INTERVAL '1 day',NULL),
        ('Expired notice','client',1,NOW(),NOW()-INTERVAL '1 second')`;
      await service.queueAutomaticEmails();
      const queued = await jobs();
      assert.deepEqual(queued.map(row => row.subject).sort(), ['INVOICE - October : GY Virtual Support Team','New notice']);
      assert.ok(queued.every(row => row.status === 'queued'));
      assert.equal(queued[0].template_data.invoiceNumber, 'PUBLISHED');
      assert.equal(sent.length, 0, 'Scanning only writes the durable outbox');
      await sql`UPDATE client_invoices SET status='Unpaid',email_published_at=NOW() WHERE invoice_number='DRAFT'`;
      await service.queueAutomaticEmails();
      assert.equal((await jobs()).filter(row => row.template_data?.invoiceNumber === 'DRAFT').length, 1);
    });

    await t.test('broadcasts snapshot one private recipient per email and concurrent scanners never duplicate', async () => {
      await reset();
      await service.setEmailAutomation(true, true);
      await sql`INSERT INTO notifications(title,audience,va_id,client_id) VALUES
        ('VA broadcast','va','',NULL),('Client broadcast','client','',NULL),
        ('Personal client','client','',1),('Personal VA','va','va-1',NULL)`;
      await sql`INSERT INTO client_invoices(client_id,invoice_number,email_published_at) VALUES (1,'CONCURRENT',NOW())`;
      await Promise.all(Array.from({ length: 4 }, () => service.queueAutomaticEmails()));
      const queued = await jobs();
      assert.equal(queued.length, 7);
      assert.equal(new Set(queued.map(row => row.idempotency_key)).size, 7);
      assert.ok(queued.every(row => row.to_emails.length === 1));
      assert.deepEqual(queued.filter(row => row.subject === 'VA broadcast').map(row => row.to_emails[0]).sort(), ['va-one@example.invalid','va-two@example.invalid']);
      assert.deepEqual(queued.filter(row => row.subject === 'Client broadcast').map(row => row.to_emails[0]).sort(), ['one@example.invalid','two@example.invalid']);
      await sql`INSERT INTO client_accounts VALUES (3,'late@example.invalid','Late client')`;
      await service.queueAutomaticEmails();
      assert.equal((await jobs()).length, 7, 'Recipients added after publication do not receive the earlier broadcast');
    });

    await t.test('missing or invalid recipient addresses are visibly skipped', async () => {
      await reset();
      await sql`INSERT INTO va_profiles VALUES ('va-missing',NULL),('va-invalid','not-an-address')`;
      await service.setEmailAutomation(false, true);
      await sql`INSERT INTO notifications(title,va_id) VALUES ('Missing address','va-missing'),('Invalid address','va-invalid')`;
      await service.queueAutomaticEmails();
      assert.deepEqual((await jobs()).map(row => row.status), ['skipped','skipped']);
      await service.processEmailQueue();
      assert.equal(sent.length, 0);
    });

    await t.test('new or self-edited VA addresses require admin approval and approval never resends old broadcasts', async () => {
      await reset();
      await service.setEmailAutomation(false, true);
      await sql`INSERT INTO va_profiles VALUES ('va-new','new-va@example.invalid')`;
      await sql`UPDATE va_profiles SET email='changed-va@example.invalid' WHERE id='va-1'`;
      // Saving already-enabled settings must not approve newly supplied contact data.
      await service.setEmailAutomation(false, true);
      await sql`INSERT INTO notifications(title) VALUES ('Before approval')`;
      await service.queueAutomaticEmails();
      const initial = await jobs();
      assert.equal(initial.length, 3);
      assert.deepEqual(initial.filter(row => row.status === 'queued').map(row => row.to_emails), [['va-two@example.invalid']]);
      assert.equal(initial.filter(row => row.status === 'skipped').length, 2);
      await service.processEmailQueue(20);
      assert.equal(sent.length, 1);
      assert.deepEqual(sent[0].to, ['va-two@example.invalid']);
      await service.approveVAEmail('va-new','new-va@example.invalid');
      await service.approveVAEmail('va-1','changed-va@example.invalid');
      await service.queueAutomaticEmails();
      assert.equal((await jobs()).length, 3, 'Approval cannot add recipients or retries to the earlier broadcast');
      await sql`INSERT INTO notifications(title) VALUES ('After approval')`;
      await service.queueAutomaticEmails();
      assert.deepEqual((await jobs()).filter(row => row.subject === 'After approval').map(row => row.to_emails[0]).sort(),
        ['changed-va@example.invalid','new-va@example.invalid','va-two@example.invalid']);
      await service.processEmailQueue(20);
      assert.equal(sent.length, 4);
      assert.equal(sent.filter(message => message.subject === 'Before approval').length, 1);
      assert.ok((await jobs()).filter(row => row.subject === 'After approval').every(row => row.status === 'accepted'));
    });

    await t.test('switching automation off also blocks jobs inserted after the worker cancellation pass', async () => {
      await reset();
      await service.setEmailAutomation(true, true);
      const invoice = (await sql`INSERT INTO client_invoices(client_id,invoice_number,email_published_at)
        VALUES (1,'TOGGLE-RACE',NOW()) RETURNING id`).rows[0].id;
      const notification = (await sql`INSERT INTO notifications(title,va_id) VALUES ('Toggle race','va-1') RETURNING id`).rows[0].id;
      await service.queueAutomaticEmails();
      await service.setEmailAutomation(false, false);
      const manualJob = await service.queueManualEmail(manual({ subject: 'Manual mail remains available' }), 1);
      let interleaved = false;
      afterStatement = async query => {
        if (!query.includes("UPDATE email_jobs j SET status='cancelled'")) return;
        // Simulate an in-flight scanner committing after cleanup and before the
        // worker claims a job. This deterministically exercises the claim guard.
        afterStatement = async () => {};
        interleaved = true;
        await sql`INSERT INTO email_jobs(idempotency_key,connection_id,to_emails,subject,body,source,source_id)
          SELECT 'race:invoice',connection_id,'["one@example.invalid"]'::jsonb,'Stale invoice','Body','invoice',${invoice}
          FROM outlook_connection WHERE singleton=true`;
        await sql`INSERT INTO email_jobs(idempotency_key,connection_id,to_emails,subject,body,source,source_id)
          SELECT 'race:notification',connection_id,'["va-one@example.invalid"]'::jsonb,'Stale notification','Body','notification',${notification}
          FROM outlook_connection WHERE singleton=true`;
      };
      await service.processEmailQueue(20);
      assert.equal(interleaved, true);
      const stale = (await jobs()).filter(row => row.idempotency_key.startsWith('race:'));
      assert.equal(stale.length, 2);
      assert.ok(stale.every(row => row.status === 'queued' && row.attempts === 0), 'Disabled automated jobs cannot be claimed after cleanup');
      assert.equal((await jobs()).find(row => row.id === manualJob.id).status, 'accepted');
      assert.deepEqual(sent.map(message => message.subject), ['Manual mail remains available']);
      await service.processEmailQueue(20);
      assert.ok((await jobs()).filter(row => row.idempotency_key.startsWith('race:')).every(row => row.status === 'cancelled'));
    });

    await t.test('manual UUID retries are idempotent, normalized, bound to an admin, and reject payload reuse', async () => {
      await reset();
      const input = manual({ to: [' PERSON@EXAMPLE.INVALID ','person@example.invalid'] });
      const results = await Promise.all(Array.from({ length: 3 }, () => service.queueManualEmail(input, 1)));
      assert.equal(new Set(results.map(row => row.id)).size, 1);
      assert.deepEqual(results[0].to, ['person@example.invalid']);
      await assert.rejects(service.queueManualEmail({ ...input, body: 'Different message' }, 1), /already used/);
      await service.queueManualEmail(input, 2);
      assert.equal((await jobs()).length, 2, 'A different authenticated admin has its own idempotency namespace');
      for (const invalid of [
        { to: [] }, { to: ['bad address'] }, { to: Array(21).fill('person@example.invalid') },
        { subject: '' }, { subject: 'Header\r\nInjection' }, { subject: 'x'.repeat(201) },
        { body: '' }, { body: 'x'.repeat(50001) }, { requestId: 'not-a-uuid' },
        { requestId: '-'.repeat(36) },
      ]) await assert.rejects(service.queueManualEmail(manual(invalid), 1));
    });

    await t.test('concurrent workers claim every job once and accepted mail is never sent again', async () => {
      await reset();
      await Promise.all(Array.from({ length: 8 }, (_, index) => service.queueManualEmail(manual({ subject: `Claim ${index}` }), 1)));
      await Promise.all(Array.from({ length: 3 }, () => service.processEmailQueue(20)));
      assert.equal(sent.length, 8);
      assert.equal(new Set(sent.map(message => message.subject)).size, 8);
      assert.ok((await jobs()).every(row => row.status === 'accepted' && row.attempts === 1));
      await service.processEmailQueue(20);
      assert.equal(sent.length, 8);
    });

    await t.test('explicit throttling obeys Retry-After and only retries while the job is eligible', async () => {
      await reset();
      const queued = await service.queueManualEmail(manual(), 1);
      sendHook = async () => { throw new OutlookSendError('throttled','Outlook requested a delay.',120); };
      await service.processEmailQueue();
      let row = (await jobs())[0];
      assert.equal(row.status, 'queued'); assert.equal(row.attempts, 1);
      const { rows } = await sql`SELECT available_at>NOW()+INTERVAL '100 seconds' AS delayed FROM email_jobs WHERE id=${queued.id}`;
      assert.equal(rows[0].delayed, true);
      await service.processEmailQueue();
      assert.equal(sent.length, 1, 'A queued retry cannot run before Retry-After');
      await sql`UPDATE email_jobs SET available_at=NOW()-INTERVAL '1 second' WHERE id=${queued.id}`;
      sendHook = async () => {};
      await service.processEmailQueue();
      row = (await jobs())[0];
      assert.equal(row.status, 'accepted'); assert.equal(row.attempts, 2); assert.equal(sent.length, 2);
    });

    await t.test('ambiguous delivery and interrupted sends require an explicit retry after checking Sent Items', async () => {
      await reset();
      const queued = await service.queueManualEmail(manual(), 1);
      sendHook = async () => { throw new Error('Simulated lost response'); };
      await service.processEmailQueue();
      assert.equal((await jobs())[0].status, 'uncertain');
      await service.processEmailQueue();
      assert.equal(sent.length, 1, 'An unknown delivery result is never retried automatically');
      await service.retryQueuedEmail(queued.id);
      sendHook = async () => {};
      await service.processEmailQueue();
      assert.equal((await jobs())[0].status, 'accepted');
      const interrupted = await service.queueManualEmail(manual({ subject: 'Interrupted' }), 1);
      await sql`UPDATE email_jobs SET status='sending',claimed_at=NOW()-INTERVAL '6 minutes',attempts=1 WHERE id=${interrupted.id}`;
      await service.processEmailQueue();
      assert.equal((await jobs()).find(row => row.id === interrupted.id).status, 'uncertain');
      assert.equal(sent.length, 2);
    });

    await t.test('account changes, deleted sources, Drafts, and expiration cancel queued mail before sending', async () => {
      await reset();
      await service.setEmailAutomation(true, true);
      await sql`INSERT INTO client_invoices(client_id,invoice_number,email_published_at) VALUES (1,'DELETED',NOW()),(1,'DRAFT-AGAIN',NOW())`;
      await sql`INSERT INTO notifications(title,va_id,expires_at) VALUES
        ('Deleted notice','va-1',NULL),('Expired notice','va-1',NOW()+INTERVAL '1 hour')`;
      await service.queueAutomaticEmails();
      await sql`DELETE FROM client_invoices WHERE invoice_number='DELETED'`;
      await sql`UPDATE client_invoices SET status='Draft' WHERE invoice_number='DRAFT-AGAIN'`;
      await sql`DELETE FROM notifications WHERE title='Deleted notice'`;
      await sql`UPDATE email_jobs SET expires_at=NOW()-INTERVAL '1 second' WHERE subject='Expired notice'`;
      await service.processEmailQueue();
      assert.equal(sent.length, 0);
      assert.ok((await jobs()).every(row => row.status === 'cancelled'));
      const oldAccount = await service.queueManualEmail(manual({ subject: 'Old account' }), 1);
      await sql`UPDATE outlook_connection SET connection_id=${randomUUID()}::uuid`;
      await service.processEmailQueue();
      assert.equal((await jobs()).find(row => row.id === oldAccount.id).status, 'cancelled');
      await assert.rejects(service.retryQueuedEmail(oldAccount.id));
      assert.equal(sent.length, 0);
    });

    await t.test('VA invoice acknowledgement and Paid notices each send one private email through notification automation',async()=>{
      await reset();await service.setEmailAutomation(false,true);
      const invoices=loadTs('va-invoices.ts');
      const invoice={invoiceNumber:'VA-1001',clientId:1,dateCovered:'October 1–15, 2026',amount:'$100.00',transactionFee:'$1.00',amountDisbursed:'$99.00',invoiceCopy:'',status:'Pending'};
      await invoices.submitVAInvoice('va-1',invoice,randomUUID());
      await invoices.saveVAInvoice(invoice.invoiceNumber,{status:'Paid'},{id:1,username:'admin',displayName:'Admin'});
      await Promise.all([service.queueAutomaticEmails(),service.queueAutomaticEmails()]);await service.processEmailQueue();
      assert.equal(sent.length,2);assert.deepEqual(sent.map(message=>message.subject).sort(),['VA Invoice - Acknowledgement','VA Invoice - Paid']);
      assert.ok(sent.every(message=>JSON.stringify(message.to)==='["va-one@example.invalid"]'&&message.cc.length===0&&message.bcc.length===0));
      assert.ok(sent.every(message=>message.body.includes('VA-1001')&&message.body.includes('October 1–15, 2026')&&message.body.includes('https://gy-virtualsupport-safq.vercel.app/dashboard/invoices')&&message.html.includes('Best regards,')));
      assert.ok(sent.find(message=>message.subject==='VA Invoice - Paid').body.includes('Amount disbursed: $99.00'));
      await service.queueAutomaticEmails();await service.processEmailQueue();assert.equal(sent.length,2);
      await service.setEmailAutomation(false,false);
      await invoices.submitVAInvoice('va-2',{...invoice,invoiceNumber:'VA-EMAIL-OFF'},randomUUID());await service.queueAutomaticEmails();await service.processEmailQueue();
      assert.equal(sent.length,2);assert.equal((await sql`SELECT id FROM notifications WHERE va_id='va-2'`).rows.length,1);
    });
    await t.test('invoice CC recipients, custom payment links, and the HTML template survive durable queue processing', async () => {
      await reset();
      await sql`UPDATE client_accounts SET invoice_cc='staff@example.invalid, manager@example.invalid' WHERE id=1`;
      await service.setEmailAutomation(true, false);
      await sql`INSERT INTO client_invoices(client_id,invoice_number,email_published_at,invoice_link) VALUES (1,'HTML-1',NOW(),'https://payments.example/invoice/1')`;
      await sql`INSERT INTO client_invoices(client_id,invoice_number,email_published_at) VALUES (2,'OTHER-CLIENT',NOW())`;
      await service.queueAutomaticEmails(); await service.processEmailQueue();
      assert.equal(sent.length,2);
      const configured=sent.find(message=>message.to[0]==='one@example.invalid'),other=sent.find(message=>message.to[0]==='two@example.invalid');
      assert.deepEqual(configured.cc,['staff@example.invalid','manager@example.invalid']);assert.deepEqual(other.cc,[]);
      assert.equal(configured.fromEmail,'hello.graveyardcrewph@outlook.com');
      assert.equal(configured.fromName,'GY Virtual Support Team');
      assert.ok(configured.html.includes('https://payments.example/invoice/1'));
      assert.ok(configured.html.includes('Invoice Summary'));
      assert.ok(configured.body.includes('inclusive of PayPal transaction fees'));
      await sql`UPDATE client_accounts SET invoice_cc='' WHERE id=1`;
    });
    await t.test('manual CC/BCC are private in the payload and changed recipient fields cannot reuse a request ID', async () => {
      await reset();const input=manual({cc:['staff@example.invalid'],bcc:['private@example.invalid'],fromName:'Custom Team'});
      const job=await service.queueManualEmail(input,1);
      await assert.rejects(service.queueManualEmail({...input,bcc:['different@example.invalid']},1),/already used/);
      await assert.rejects(service.queueManualEmail(manual({fromEmail:'other@example.invalid'}),1),/connected Outlook/);
      await service.processEmailQueue();assert.equal(sent.length,1);
      assert.deepEqual(sent[0].cc,['staff@example.invalid']);assert.deepEqual(sent[0].bcc,['private@example.invalid']);
      assert.ok(!sent[0].html.includes('private@example.invalid'));
      assert.deepEqual((await jobs()).find(row=>row.id===job.id).bcc_emails,['private@example.invalid']);
    });
    await t.test('greeting images are included inline and stay available after their portal notice is deleted', async () => {
      await reset();await service.setEmailAutomation(false,true);
      const storage=loadTs('notification-image-storage.ts'),images=loadTs('email-images.ts');
      const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=','base64');
      const asset=await storage.beginImageUpload({contentType:'image/png',size:png.length});
      await storage.appendImageChunk(asset.id,0,png.toString('base64'));
      const reference=await storage.prepareImageReference(asset.id);
      await sql`INSERT INTO notifications(title,audience,client_id,image_url) VALUES ('Birthday image','client',1,${reference})`;
      await service.queueAutomaticEmails();await service.processEmailQueue();
      assert.equal(sent.length,1);assert.ok(sent[0].html.includes('cid:notification-image'));
      assert.equal(sent[0].attachments[0].contentBytes,png.toString('base64'));
      assert.ok(!sent[0].body.includes('Open your portal:'));
      const token=(await jobs())[0].image_token;
      await sql`DELETE FROM notifications`;
      await sql`UPDATE notification_image_assets SET created_at=NOW()-INTERVAL '25 hours'`;
      await storage.removeAbandonedImages();
      const stored=await images.emailImage(token),parts=[];for await(const bytes of stored.chunks)parts.push(bytes);
      assert.deepEqual(Buffer.concat(parts),png);
    });
    await t.test('10 MB greetings use a durable image URL and do not exceed Graph attachment limits', async () => {
      await reset();await service.setEmailAutomation(false,true);
      const storage=loadTs('notification-image-storage.ts'),images=loadTs('email-images.ts');
      const source=Buffer.alloc(10*1024*1024,42);Buffer.from([137,80,78,71,13,10,26,10]).copy(source);
      const asset=await storage.beginImageUpload({contentType:'image/png',size:source.length});
      const chunkSize=393216;
      for(let offset=0,index=0;offset<source.length;offset+=chunkSize,index++)await storage.appendImageChunk(asset.id,index,source.subarray(offset,offset+chunkSize).toString('base64'));
      const reference=await storage.prepareImageReference(asset.id);
      await sql`INSERT INTO notifications(title,audience,client_id,image_url) VALUES ('Large greeting','client',1,${reference})`;
      await service.queueAutomaticEmails();await service.processEmailQueue();assert.equal(sent.length,1);
      const token=(await jobs())[0].image_token;
      assert.ok(sent[0].html.includes(`/api/email/images/${token}`));assert.equal(sent[0].attachments,undefined);
      const stored=await images.emailImage(token),parts=[];for await(const bytes of stored.chunks)parts.push(bytes);
      assert.deepEqual(Buffer.concat(parts),source);
    });
    await t.test('invoice portal pushes do not generate a second generic notification email',async()=>{
      await reset();await service.setEmailAutomation(false,true);
      await sql`INSERT INTO notifications(title,audience,client_id,type) VALUES ('New invoice available','client',1,'invoice')`;
      await service.queueAutomaticEmails();assert.equal((await jobs()).length,0);
    });
    await t.test('disconnect disables automations and cancels queued mail while retaining accepted history', async () => {
      await reset();
      await service.setEmailAutomation(true, true);
      const accepted = await service.queueManualEmail(manual({ subject: 'Accepted history' }), 1);
      await service.processEmailQueue();
      await service.queueManualEmail(manual({ subject: 'Cancel on disconnect' }), 1);
      await service.cancelPendingEmails();
      await sql`UPDATE outlook_connection SET encrypted_tokens=NULL`;
      const all = await jobs();
      assert.equal(all.find(row => row.id === accepted.id).status, 'accepted');
      assert.equal(all.find(row => row.subject === 'Cancel on disconnect').status, 'cancelled');
      const { rows } = await sql`SELECT auto_invoices_since,auto_notifications_since FROM email_settings`;
      assert.deepEqual(rows[0], { auto_invoices_since: null, auto_notifications_since: null });
      await assert.rejects(service.queueManualEmail(manual(), 1), /Connect Outlook/);
      await service.queueAutomaticEmails();
      assert.deepEqual(await service.processEmailQueue(), { processed: 0 });
      assert.equal(sent.length, 1);
    });
  } finally {
    await connection(`DROP SCHEMA ${schema} CASCADE`);
  }
});
