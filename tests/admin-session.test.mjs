import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import ts from "typescript";

const runtimeRequire = createRequire(import.meta.url);

function sessionHarness({ production = true } = {}) {
  const sessions = new Map();
  const admins = new Map([
    [1, { id: 1, username: "one", display_name: "First Admin" }],
    [2, { id: 2, username: "two", display_name: "Second Admin" }],
  ]);
  const jar = new Map();
  const writes = [];
  const queries = [];
  let failQueries = false;
  const sql = async (strings, ...values) => {
    const query = strings.join("?").replace(/\s+/g, " ").trim();
    queries.push({ query, values });
    if (failQueries) throw new Error("Database unavailable");
    if (query.startsWith("INSERT INTO admin_sessions")) {
      const [hash, adminId, expires] = values;
      if (!admins.has(adminId)) throw new Error("Foreign key violation");
      sessions.set(hash, { adminId, expires });
    } else if (query.startsWith("SELECT")) {
      assert.match(query, /JOIN admin_accounts a ON a.id = s.admin_id/);
      assert.match(query, /s.expires_at > NOW\(\)/);
      const session = sessions.get(values[0]);
      const admin = session && admins.get(session.adminId);
      return { rows: session && admin && Date.parse(session.expires) > Date.now() ? [admin] : [] };
    } else if (query.includes("WHERE token_hash =")) {
      sessions.delete(values[0]);
    } else if (query.includes("WHERE admin_id =")) {
      for (const [hash, session] of sessions) if (session.adminId === values[0]) sessions.delete(hash);
    } else if (query.includes("WHERE expires_at <= NOW()")) {
      for (const [hash, session] of sessions) if (Date.parse(session.expires) <= Date.now()) sessions.delete(hash);
    } else {
      throw new Error(`Unexpected session query: ${query}`);
    }
    return { rows: [] };
  };
  const cookieStore = {
    get(name) { return jar.has(name) ? { value: jar.get(name) } : undefined; },
    set(name, value, options) {
      writes.push({ name, value, options });
      if (options.maxAge === 0) jar.delete(name);
      else jar.set(name, value);
    },
  };
  const code = ts.transpileModule(fs.readFileSync(new URL("../src/lib/admin-session.ts", import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const sessionModule = { exports: {} };
  const localRequire = name => name === "@vercel/postgres" ? { sql }
    : name === "next/headers" ? { cookies: async () => cookieStore }
      : name === "./admin-session-schema" ? { ensureAdminSessionSchema: async () => {} }
        : runtimeRequire(name);
  new Function("require", "module", "exports", "process", code)(localRequire, sessionModule, sessionModule.exports, {
    env: { NODE_ENV: production ? "production" : "development" },
  });
  return {
    ...sessionModule.exports, sessions, admins, jar, writes, queries,
    failQueries() { failQueries = true; },
  };
}

const hash = token => createHash("sha256").update(token).digest("hex");

test("admin sessions use random HttpOnly cookies while only hashes reach storage", async () => {
  const app = sessionHarness();
  await app.createAdminSession(1);
  const cookie = app.writes.at(-1);
  assert.match(cookie.value, /^[a-f0-9]{64}$/);
  assert.deepEqual({ ...cookie.options, expires: undefined }, {
    httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 28800, expires: undefined,
  });
  assert.ok(Math.abs(cookie.options.expires.getTime() - Date.now() - 28800000) < 2000);
  assert.ok(app.sessions.has(hash(cookie.value)));
  assert.ok(!app.queries.some(query => query.values.includes(cookie.value)));
  assert.deepEqual(await app.requireAdminSession(), { id: 1, username: "one", displayName: "First Admin" });

  const previous = cookie.value;
  await app.createAdminSession(1);
  assert.notEqual(app.writes.at(-1).value, previous);
  assert.ok(!app.sessions.has(hash(previous)), "a new login revokes this browser's old session");
});

test("missing, malformed, tampered, expired, and revoked cookies cannot authorize", async () => {
  const app = sessionHarness();
  assert.equal(await app.getAdminSession(), null);
  await assert.rejects(() => app.requireAdminSession(), /sign in again/);
  app.jar.set("gy_admin_session", "malformed");
  assert.equal(await app.getAdminSession(), null);
  assert.equal(app.queries.length, 0);
  app.jar.set("gy_admin_session", "a".repeat(64));
  assert.equal(await app.getAdminSession(), null);
  await app.createAdminSession(1);
  const token = app.jar.get("gy_admin_session");
  app.sessions.get(hash(token)).expires = new Date(Date.now() - 1000).toISOString();
  assert.equal(await app.getAdminSession(), null);
  await app.createAdminSession(1);
  await app.invalidateAdminSessions(1);
  assert.equal(await app.getAdminSession(), null);
});

test("revoking one admin preserves another admin and account deletion fails closed", async () => {
  const app = sessionHarness();
  await app.createAdminSession(1);
  const firstToken = app.jar.get("gy_admin_session");
  app.jar.clear(); // A different browser signs in independently.
  await app.createAdminSession(2);
  await app.invalidateAdminSessions(1);
  assert.equal((await app.requireAdminSession()).id, 2);
  assert.ok(!app.sessions.has(hash(firstToken)));
  app.admins.delete(2);
  assert.equal(await app.getAdminSession(), null);
});

test("logout revokes the server session and expires the browser cookie", async () => {
  const app = sessionHarness({ production: false });
  await app.createAdminSession(1);
  const token = app.jar.get("gy_admin_session");
  assert.equal(app.writes.at(-1).options.secure, false);
  await app.clearAdminSession();
  assert.equal(app.writes.at(-1).options.maxAge, 0);
  assert.equal(app.jar.size, 0);
  assert.ok(!app.sessions.has(hash(token)));
  app.jar.set("gy_admin_session", token);
  assert.equal(await app.getAdminSession(), null);
});

test("database errors never authorize and logout still expires the local cookie", async () => {
  const app = sessionHarness();
  await app.createAdminSession(1);
  app.failQueries();
  await assert.rejects(() => app.getAdminSession(), /Database unavailable/);
  await assert.rejects(() => app.clearAdminSession(), /Database unavailable/);
  assert.equal(app.jar.size, 0);
  assert.equal(app.writes.at(-1).options.maxAge, 0);
});
