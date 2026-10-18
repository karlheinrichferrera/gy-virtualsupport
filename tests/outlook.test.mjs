// All Microsoft HTTP and SQL are mocked. This suite never contacts or sends email from a mailbox.
// Run: node --test tests/outlook.test.mjs
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createHash, randomUUID } from 'node:crypto';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';

const runtimeRequire = createRequire(import.meta.url);
const sourcePath = new URL('../src/lib/outlook.ts', import.meta.url);
const source = ts.transpileModule(fs.readFileSync(sourcePath, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;

function harness() {
  const db = { row: null, states: new Map(), calls: [], beforeTokenSave: null };
  const result = row => ({ rows: row ? [structuredClone(row)] : [] });
  const sql = async (strings, ...v) => {
    const q = strings.join('?').replace(/\s+/g, ' ').trim();
    db.calls.push(q);
    if (q.startsWith('SELECT connection_id')) return result(db.row);
    if (q.startsWith('INSERT INTO outlook_connection')) {
      if (!db.row) db.row = { connection_id: v[0], version: 0, encrypted_tokens: null, access_expires_at: null, sender_email: null, sender_name: null, last_error: null, refresh_lock: null };
      else if (q.includes('DO UPDATE')) Object.assign(db.row, { connection_id: v[1], version: db.row.version + 1, encrypted_tokens: null, access_expires_at: null, sender_email: null, sender_name: null, last_error: null, refresh_lock: null });
      return result();
    }
    if (q.startsWith('DELETE FROM outlook_oauth_states WHERE expires_at')) {
      for (const [key, state] of db.states) if (state.expires_at <= Date.now() || state.admin_id === v[0]) db.states.delete(key);
      return result();
    }
    if (q.startsWith('INSERT INTO outlook_oauth_states')) {
      db.states.set(v[0], { admin_id: v[1], code_verifier_encrypted: v[2], expected_connection_id: v[3], expires_at: Date.now() + 300_000 }); return result();
    }
    if (q.startsWith('DELETE FROM outlook_oauth_states WHERE state_hash')) {
      const state = db.states.get(v[0]);
      if (!state || state.admin_id !== v[1] || state.expires_at <= Date.now()) return result();
      db.states.delete(v[0]); return result(state);
    }
    if (q === 'DELETE FROM outlook_oauth_states') { db.states.clear(); return result(); }
    if (q.startsWith('UPDATE outlook_connection SET connection_id')) {
      if (db.row?.connection_id !== v[5]) return result();
      Object.assign(db.row, { connection_id: v[0], version: db.row.version + 1, encrypted_tokens: v[1], access_expires_at: v[2], sender_email: v[3], sender_name: v[4], last_error: null, refresh_lock: null });
      return result({ connection_id: db.row.connection_id });
    }
    if (q.startsWith('UPDATE outlook_connection SET refresh_lock = ?')) {
      if (!db.row || db.row.connection_id !== v[1] || db.row.version !== v[2] || db.row.refresh_lock) return result();
      db.row.refresh_lock = v[0]; return result({ connection_id: db.row.connection_id });
    }
    if (q.startsWith('UPDATE outlook_connection SET encrypted_tokens')) {
      db.beforeTokenSave?.();
      if (!db.row || db.row.connection_id !== v[2] || db.row.version !== v[3] || db.row.refresh_lock !== v[4]) return result();
      Object.assign(db.row, { encrypted_tokens: v[0], access_expires_at: v[1], version: db.row.version + 1, refresh_lock: null, last_error: null });
      return result({ connection_id: db.row.connection_id });
    }
    if (q.startsWith('UPDATE outlook_connection SET last_error')) {
      if (db.row?.connection_id === v[1] && db.row.version === v[2]) Object.assign(db.row, { last_error: v[0], refresh_lock: null });
      return result();
    }
    if (q.startsWith('UPDATE outlook_connection SET refresh_lock = NULL')) {
      if (db.row?.connection_id === v[0] && db.row.refresh_lock === v[1]) db.row.refresh_lock = null;
      return result();
    }
    throw new Error(`Unexpected SQL in mocked test: ${q}`);
  };
  const testModule = { exports: {} };
  const localRequire = name => name === '@vercel/postgres' ? { sql }
    : name === './outlook-schema' ? { ensureOutlookSchema: async () => {} } : runtimeRequire(name);
  new Function('require', 'module', 'exports', source)(localRequire, testModule, testModule.exports);
  return { service: testModule.exports, db };
}

const tokenResponse = (extra = {}) => Response.json({ access_token: 'secret-access-token', refresh_token: 'secret-refresh-token', token_type: 'Bearer', expires_in: 3600, scope: 'User.Read Mail.Send', ...extra });
const identityResponse = () => Response.json({ id: 'microsoft-user-id', displayName: 'Test Mailbox', mail: 'outlook@example.com', userPrincipalName: 'ignored@example.com' });

test('Outlook OAuth, encryption, and Graph sending use mocked providers only', async t => {
  const savedEnv = Object.fromEntries(['OUTLOOK_CLIENT_ID', 'OUTLOOK_CLIENT_SECRET', 'OUTLOOK_TENANT_ID', 'PORTAL_APP_URL'].map(name => [name, process.env[name]]));
  const originalFetch = global.fetch;
  process.env.OUTLOOK_CLIENT_ID = 'test-application-id'; process.env.OUTLOOK_CLIENT_SECRET = 'test-client-secret-with-entropy';
  delete process.env.OUTLOOK_TENANT_ID; delete process.env.PORTAL_APP_URL;
  const calls = [];
  let responder = () => { throw new Error('Unmocked HTTP request'); };
  global.fetch = async (url, init) => {
    assert.ok(url.startsWith('https://login.microsoftonline.com/') || url.startsWith('https://graph.microsoft.com/'));
    calls.push({ url, init }); return responder(url, init);
  };
  const connect = async service => {
    const authorize = new URL(await service.beginOutlookConnection(7));
    responder = url => url.includes('/token') ? tokenResponse() : identityResponse();
    const status = await service.completeOutlookConnection(7, new URLSearchParams({ state: authorize.searchParams.get('state'), code: 'mock-authorization-code' }));
    assert.equal(status, 'connected'); return authorize;
  };
  try {
    await t.test('configuration has a fixed redirect and rejects untrusted URL/tenant settings', () => {
      const { service } = harness();
      assert.deepEqual(service.getOutlookConfiguration(), { configured: true, missingConfig: [], redirectUri: 'https://gy-virtualsupport-safq.vercel.app/api/outlook/callback' });
      process.env.PORTAL_APP_URL = 'https://portal.example/redirect-path';
      assert.equal(service.getOutlookConfiguration().configured, false);
      assert.ok(service.getOutlookConfiguration().missingConfig.includes('PORTAL_APP_URL'));
      delete process.env.PORTAL_APP_URL;
      process.env.OUTLOOK_TENANT_ID = '../../evil'; assert.equal(service.getOutlookConfiguration().configured, false); delete process.env.OUTLOOK_TENANT_ID;
      delete process.env.OUTLOOK_CLIENT_SECRET; assert.deepEqual(service.getOutlookConfiguration().missingConfig, ['OUTLOOK_CLIENT_SECRET']); process.env.OUTLOOK_CLIENT_SECRET = 'test-client-secret-with-entropy';
    });
    await t.test('PKCE state is hashed, bound to the admin, expires, and is consumed once', async () => {
      const { service, db } = harness();
      const url = new URL(await service.beginOutlookConnection(7));
      assert.equal(url.origin, 'https://login.microsoftonline.com'); assert.ok(url.pathname.startsWith('/common/'));
      assert.equal(url.searchParams.get('code_challenge_method'), 'S256');
      assert.ok(url.searchParams.get('scope').includes('offline_access')); assert.ok(url.searchParams.get('scope').includes('Mail.Send'));
      const state = url.searchParams.get('state'); const stateHash = createHash('sha256').update(state).digest('hex');
      assert.equal(db.states.size, 1); assert.ok(db.states.has(stateHash)); assert.ok(!db.states.has(state));
      const pending = db.states.get(stateHash); assert.ok(pending.code_verifier_encrypted.startsWith('v1.'));
      const params = new URLSearchParams({ state, code: 'mock-code' });
      assert.equal(await service.completeOutlookConnection(8, params), 'error'); assert.equal(db.states.size, 1);
      calls.length = 0;
      responder = (url, init) => {
        if (!url.includes('/token')) return identityResponse();
        const verifier = init.body.get('code_verifier'); assert.equal(createHash('sha256').update(verifier).digest('base64url'), new URL(authorizeUrl).searchParams.get('code_challenge'));
        return tokenResponse();
      };
      const authorizeUrl = url.toString();
      assert.equal(await service.completeOutlookConnection(7, params), 'connected');
      assert.equal(await service.completeOutlookConnection(7, params), 'error'); assert.equal(calls.length, 2);
      assert.ok(!db.row.encrypted_tokens.includes('secret-access-token')); assert.ok(!db.row.encrypted_tokens.includes('secret-refresh-token'));
      assert.equal(db.row.sender_email, 'outlook@example.com');
      const metadata = await service.getOutlookConnection(); assert.deepEqual(metadata, { connected: true, senderEmail: 'outlook@example.com', senderName: 'Test Mailbox', lastError: null });
      assert.ok(!JSON.stringify(metadata).includes('token'));
      const next = new URL(await service.beginOutlookConnection(7)); const nextState = createHash('sha256').update(next.searchParams.get('state')).digest('hex'); db.states.get(nextState).expires_at = Date.now() - 1;
      assert.equal(await service.completeOutlookConnection(7, new URLSearchParams({ state: next.searchParams.get('state'), code: 'code' })), 'error');
    });
    await t.test('provider cancellation consumes state without replacing a mailbox', async () => {
      const { service, db } = harness(); const url = new URL(await service.beginOutlookConnection(7));
      calls.length = 0;
      assert.equal(await service.completeOutlookConnection(7, new URLSearchParams({ state: url.searchParams.get('state'), error: 'access_denied', error_description: 'private provider information' })), 'cancelled');
      assert.equal(db.states.size, 0); assert.equal(calls.length, 0); assert.equal((await service.getOutlookConnection()).connected, false);
    });
    await t.test('a disconnected/replaced mailbox cannot be restored by an old callback', async () => {
      const { service, db } = harness(); const url = new URL(await service.beginOutlookConnection(7));
      responder = async endpoint => {
        if (endpoint.includes('/token')) { await service.disconnectOutlookConnection(); return tokenResponse(); }
        return identityResponse();
      };
      assert.equal(await service.completeOutlookConnection(7, new URLSearchParams({ state: url.searchParams.get('state'), code: 'code' })), 'reauth');
      assert.equal(db.row.encrypted_tokens, null);
    });
    await t.test('Graph receives a text message and saves accepted messages in Sent Items', async () => {
      const { service } = harness(); await connect(service); calls.length = 0;
      responder = (url, init) => { assert.equal(url, 'https://graph.microsoft.com/v1.0/me/sendMail'); const payload = JSON.parse(init.body); assert.deepEqual(payload, { message: { subject: 'Test subject', body: { contentType: 'Text', content: '<b>Text remains text</b>' }, toRecipients: [{ emailAddress: { address: 'recipient@example.invalid' } }], ccRecipients: [], bccRecipients: [] }, saveToSentItems: true }); return new Response(null, { status: 202 }); };
      await service.sendOutlookMessage({ to: ['recipient@example.invalid', 'recipient@example.invalid'], subject: ' Test subject ', body: '<b>Text remains text</b>' }); assert.equal(calls.length, 1);
    });
    await t.test('HTML mail preserves From, CC, private BCC, and inline greeting attachments', async () => {
      const { service } = harness(); await connect(service); calls.length = 0;
      responder = (_url, init) => {
        const { message } = JSON.parse(init.body);
        assert.equal(message.from.emailAddress.address, 'outlook@example.com');
        assert.equal(message.from.emailAddress.name, 'GY Virtual Support Team');
        assert.equal(message.body.contentType, 'HTML');
        assert.deepEqual(message.ccRecipients, [{ emailAddress: { address: 'staff@example.invalid' } }]);
        assert.deepEqual(message.bccRecipients, [{ emailAddress: { address: 'private@example.invalid' } }]);
        assert.ok(!message.body.content.includes('private@example.invalid'));
        assert.equal(message.attachments[0]['@odata.type'], '#microsoft.graph.fileAttachment');
        assert.equal(message.attachments[0].isInline, true);
        return new Response(null, { status: 202 });
      };
      await service.sendOutlookMessage({ to: ['recipient@example.invalid'], cc: ['staff@example.invalid'], bcc: ['private@example.invalid'], fromName: 'GY Virtual Support Team',fromEmail:'outlook@example.com',subject:'Greeting',body:'Happy birthday',html:'<p>Happy birthday</p><img src="cid:greeting">',attachments:[{name:'greeting.png',contentType:'image/png',contentBytes:'aGVsbG8=',contentId:'greeting',isInline:true}] });
      assert.equal(calls.length, 1);
      calls.length = 0;
      await assert.rejects(service.sendOutlookMessage({ to: ['recipient@example.invalid'],subject:'Spoofed',body:'Message',fromEmail:'other@example.com' }), error => error.kind === 'rejected');
      assert.equal(calls.length, 0);
    });
    await t.test('401 refreshes once, stores rotated encrypted credentials, and retries only the rejected request', async () => {
      const { service, db } = harness(); await connect(service); calls.length = 0; const previous = db.row.encrypted_tokens; let sends = 0;
      responder = (url, init) => {
        if (url.includes('/token')) { assert.equal(init.body.get('grant_type'), 'refresh_token'); assert.equal(init.body.get('refresh_token'), 'secret-refresh-token'); return tokenResponse({ access_token: 'rotated-access', refresh_token: 'rotated-refresh' }); }
        sends++; if (sends === 1) return new Response(null, { status: 401 }); assert.equal(init.headers.Authorization, 'Bearer rotated-access'); return new Response(null, { status: 202 });
      };
      await service.sendOutlookMessage({ to: ['recipient@example.invalid'], subject: 'Test', body: 'Body' });
      assert.equal(sends, 2); assert.equal(calls.length, 3); assert.notEqual(previous, db.row.encrypted_tokens); assert.ok(!db.row.encrypted_tokens.includes('rotated-refresh')); assert.equal(db.row.refresh_lock, null);
    });
    await t.test('expired tokens refresh before sending and CAS prevents stale refresh after disconnect', async () => {
      const { service, db } = harness(); await connect(service); db.row.access_expires_at = new Date(0); calls.length = 0;
      db.beforeTokenSave = () => { db.row.connection_id = randomUUID(); db.row.version++; db.row.encrypted_tokens = null; };
      responder = () => tokenResponse();
      await assert.rejects(service.sendOutlookMessage({ to: ['recipient@example.invalid'], subject: 'Test', body: 'Body' }), error => error.kind === 'reconnect');
      assert.equal(db.row.encrypted_tokens, null); assert.equal(calls.length, 1); assert.ok(calls[0].url.includes('/token'));
    });
    await t.test('429 is retryable with Retry-After, while timeouts and server errors remain uncertain without retries', async () => {
      const { service } = harness(); await connect(service);
      for (const status of [429, 503, 200]) {
        calls.length = 0; responder = () => new Response(null, { status, headers: { 'Retry-After': '121' } });
        await assert.rejects(service.sendOutlookMessage({ to: ['recipient@example.invalid'], subject: 'Test', body: 'Body' }), error => {
          assert.equal(error.kind, status === 429 ? 'throttled' : 'uncertain'); if (status === 429) assert.equal(error.retryAfterSeconds, 121); return true;
        }); assert.equal(calls.length, 1);
      }
      calls.length = 0; responder = () => { throw new Error('private provider response/token'); };
      await assert.rejects(service.sendOutlookMessage({ to: ['recipient@example.invalid'], subject: 'Test', body: 'Body' }), error => error.kind === 'uncertain' && !error.message.includes('private provider'));
      assert.equal(calls.length, 1);
    });
    await t.test('secret rotation invalidates old ciphertext and invalid messages never reach Microsoft', async () => {
      const { service } = harness(); await connect(service); calls.length = 0;
      process.env.OUTLOOK_CLIENT_SECRET = 'rotated-client-secret'; assert.equal((await service.getOutlookConnection()).connected, false);
      await assert.rejects(service.sendOutlookMessage({ to: ['recipient@example.invalid'], subject: 'Test', body: 'Body' }), error => error.kind === 'reconnect'); assert.equal(calls.length, 0);
      process.env.OUTLOOK_CLIENT_SECRET = 'test-client-secret-with-entropy';
      for (const invalid of [{ to: ['bad'], subject: 'Test', body: 'Body' }, { to: ['recipient@example.invalid'], subject: 'Bad\r\nHeader', body: 'Body' }, { to: [], subject: 'Test', body: 'Body' }]) await assert.rejects(service.sendOutlookMessage(invalid), error => error.kind === 'rejected');
      assert.equal(calls.length, 0);
    });
    await t.test('an outbox job bound to a different mailbox never obtains a token or sends', async () => {
      const { service, db } = harness(); await connect(service); calls.length = 0;
      db.row.access_expires_at = new Date(0);
      await assert.rejects(service.sendOutlookMessage({ to: ['recipient@example.invalid'], subject: 'Test', body: 'Body', expectedConnectionId: randomUUID() }), error => error.kind === 'reconnect');
      assert.equal(calls.length, 0);
    });
    await t.test('missing delegated permissions never save a connection; denied sends require reconnect', async () => {
      const { service, db } = harness();
      const url = new URL(await service.beginOutlookConnection(7));
      responder = () => tokenResponse({ scope: 'User.Read' });
      await assert.rejects(service.completeOutlookConnection(7, new URLSearchParams({ state: url.searchParams.get('state'), code: 'code' })), error => error.kind === 'reconnect');
      assert.equal(db.row.encrypted_tokens, null);
      await connect(service); calls.length = 0;
      responder = () => new Response('Do not display this private provider body', { status: 403 });
      await assert.rejects(service.sendOutlookMessage({ to: ['recipient@example.invalid'], subject: 'Test', body: 'Body' }), error => error.kind === 'reconnect' && !error.message.includes('private'));
      assert.equal(calls.length, 1); assert.equal((await service.getOutlookConnection()).connected, false);
    });
  } finally {
    global.fetch = originalFetch;
    for (const [name, value] of Object.entries(savedEnv)) { if (value === undefined) delete process.env[name]; else process.env[name] = value; }
  }
});
