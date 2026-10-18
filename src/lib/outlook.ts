import { createCipheriv, createDecipheriv, createHash, hkdfSync, randomBytes, randomUUID } from "node:crypto";
import { sql } from "@vercel/postgres";
import { ensureOutlookSchema } from "./outlook-schema";

const DEFAULT_APP_URL = "https://gy-virtualsupport-safq.vercel.app";
const SCOPES = "offline_access User.Read Mail.Send openid profile email";
const RECONNECT_MESSAGE = "Reconnect Outlook in Email settings before sending email.";
const TEMPORARY_MESSAGE = "Outlook is temporarily unavailable. Try again shortly.";
const CRYPTO_CONTEXT = "gy-virtualsupport/outlook/v1";
const HTTP_TIMEOUT_MS = 15_000;

type TokenPair = { accessToken: string; refreshToken: string };
type ConnectionRow = {
  connection_id: string;
  version: number;
  encrypted_tokens: string | null;
  access_expires_at: string | Date | null;
  sender_email: string | null;
  sender_name: string | null;
  last_error: string | null;
};
type TokenResult = TokenPair & { expiresAt: Date };
type SendErrorKind = "reconnect" | "throttled" | "rejected" | "uncertain";
export type OutlookCallbackStatus = "connected" | "error" | "cancelled" | "reauth";

/** Safe to show in the UI; never includes a token, provider response, or recipient content. */
export class OutlookSendError extends Error {
  readonly kind: SendErrorKind;
  readonly retryAfterSeconds?: number;

  constructor(kind: SendErrorKind, message: string, retryAfterSeconds?: number) {
    super(message);
    this.name = "OutlookSendError";
    this.kind = kind;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

function appOrigin(): string | null {
  try {
    const url = new URL(process.env.PORTAL_APP_URL || DEFAULT_APP_URL);
    if (url.username || url.password || url.search || url.hash || url.pathname !== "/") return null;
    if (url.protocol !== "https:" && !(url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname))) return null;
    return url.origin;
  } catch { return null; }
}

function tenant(): string | null {
  const value = process.env.OUTLOOK_TENANT_ID || "common";
  return /^(common|organizations|consumers|[a-zA-Z0-9][a-zA-Z0-9.-]{0,252})$/.test(value) ? value : null;
}

export function getOutlookConfiguration(): { configured: boolean; missingConfig: string[]; redirectUri: string } {
  const missingConfig: string[] = [];
  if (!process.env.OUTLOOK_CLIENT_ID?.trim()) missingConfig.push("OUTLOOK_CLIENT_ID");
  if (!process.env.OUTLOOK_CLIENT_SECRET?.trim()) missingConfig.push("OUTLOOK_CLIENT_SECRET");
  if (!tenant()) missingConfig.push("OUTLOOK_TENANT_ID");
  const origin = appOrigin();
  if (!origin) missingConfig.push("PORTAL_APP_URL");
  return {
    configured: missingConfig.length === 0,
    missingConfig,
    redirectUri: `${origin || DEFAULT_APP_URL}/api/outlook/callback`,
  };
}

/** Fixed destinations only; OAuth query parameters can never become a redirect target. */
export function outlookResultUrl(status: OutlookCallbackStatus): string {
  return `${appOrigin() || DEFAULT_APP_URL}/admin/dashboard/email?outlook=${status}`;
}

function configured() {
  const config = getOutlookConfiguration();
  if (!config.configured) throw new OutlookSendError("reconnect", "Outlook has not been configured for this portal.");
  return config;
}

function encryptionKey(): Buffer {
  const secret = process.env.OUTLOOK_CLIENT_SECRET;
  if (!secret) throw new OutlookSendError("reconnect", RECONNECT_MESSAGE);
  // Secret rotation deliberately requires reconnecting; no plaintext fallback is permitted.
  return Buffer.from(hkdfSync("sha256", secret, CRYPTO_CONTEXT, "encrypted-outlook-credentials", 32));
}

function encrypt(value: string, purpose: "tokens" | "pkce"): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  cipher.setAAD(Buffer.from(`${CRYPTO_CONTEXT}/${purpose}`));
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), ciphertext.toString("base64url")].join(".");
}

function decrypt(value: string, purpose: "tokens" | "pkce"): string {
  try {
    const [version, iv, tag, ciphertext, extra] = value.split(".");
    if (version !== "v1" || !iv || !tag || !ciphertext || extra) throw new Error("Invalid encryption format");
    const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(iv, "base64url"));
    decipher.setAAD(Buffer.from(`${CRYPTO_CONTEXT}/${purpose}`));
    decipher.setAuthTag(Buffer.from(tag, "base64url"));
    return Buffer.concat([decipher.update(Buffer.from(ciphertext, "base64url")), decipher.final()]).toString("utf8");
  } catch { throw new OutlookSendError("reconnect", RECONNECT_MESSAGE); }
}

function tokensFrom(row: ConnectionRow): TokenPair {
  if (!row.encrypted_tokens || row.last_error) throw new OutlookSendError("reconnect", RECONNECT_MESSAGE);
  try {
    const tokens = JSON.parse(decrypt(row.encrypted_tokens, "tokens")) as TokenPair;
    if (typeof tokens.accessToken !== "string" || !tokens.accessToken || typeof tokens.refreshToken !== "string" || !tokens.refreshToken) throw new Error("Invalid token data");
    return tokens;
  } catch { throw new OutlookSendError("reconnect", RECONNECT_MESSAGE); }
}

async function readConnection(): Promise<ConnectionRow | null> {
  const { rows } = await sql`SELECT connection_id, version, encrypted_tokens, access_expires_at, sender_email, sender_name, last_error FROM outlook_connection WHERE singleton = true`;
  return (rows[0] as ConnectionRow | undefined) || null;
}

export async function getOutlookConnection(): Promise<{ connected: boolean; senderEmail: string | null; senderName: string | null; lastError?: string | null }> {
  await ensureOutlookSchema();
  const row = await readConnection();
  if (!row?.encrypted_tokens) return { connected: false, senderEmail: null, senderName: null, lastError: null };
  let lastError = row.last_error;
  try { configured(); tokensFrom(row); } catch { lastError = RECONNECT_MESSAGE; }
  return { connected: !lastError, senderEmail: row.sender_email, senderName: row.sender_name, lastError };
}

export async function disconnectOutlookConnection(): Promise<void> {
  await ensureOutlookSchema();
  const connectionId = randomUUID();
  await sql`
    INSERT INTO outlook_connection(singleton, connection_id) VALUES (true, ${connectionId})
    ON CONFLICT (singleton) DO UPDATE SET connection_id = ${connectionId}, version = outlook_connection.version + 1,
      encrypted_tokens = NULL, access_expires_at = NULL, sender_email = NULL, sender_name = NULL, last_error = NULL,
      refresh_lock = NULL, refresh_lock_expires_at = NULL, updated_at = NOW()
  `;
  await sql`DELETE FROM outlook_oauth_states`;
}

export async function beginOutlookConnection(adminId: number | string): Promise<string> {
  const config = configured();
  await ensureOutlookSchema();
  await sql`INSERT INTO outlook_connection(singleton, connection_id) VALUES (true, ${randomUUID()}) ON CONFLICT (singleton) DO NOTHING`;
  const row = await readConnection();
  if (!row) throw new Error("Outlook connection storage is unavailable.");
  const state = randomBytes(32).toString("base64url");
  const stateHash = createHash("sha256").update(state).digest("hex");
  const verifier = randomBytes(32).toString("base64url");
  const verifierEncrypted = encrypt(verifier, "pkce");
  await sql`DELETE FROM outlook_oauth_states WHERE expires_at <= NOW() OR admin_id = ${String(adminId)}`;
  await sql`
    INSERT INTO outlook_oauth_states(state_hash, admin_id, code_verifier_encrypted, expected_connection_id, expires_at)
    VALUES (${stateHash}, ${String(adminId)}, ${verifierEncrypted}, ${row.connection_id}, NOW() + INTERVAL '5 minutes')
  `;
  const url = new URL(`https://login.microsoftonline.com/${tenant()}/oauth2/v2.0/authorize`);
  url.search = new URLSearchParams({
    client_id: process.env.OUTLOOK_CLIENT_ID!, response_type: "code", response_mode: "query", redirect_uri: config.redirectUri,
    scope: SCOPES, state, code_challenge: createHash("sha256").update(verifier).digest("base64url"),
    code_challenge_method: "S256", prompt: "select_account",
  }).toString();
  return url.toString();
}

function retryAfter(response: Response): number {
  const raw = response.headers.get("Retry-After");
  if (!raw) return 60;
  const seconds = /^\d+$/.test(raw) ? Number(raw) : Math.ceil((Date.parse(raw) - Date.now()) / 1000);
  return Number.isFinite(seconds) ? Math.max(1, Math.min(seconds, 86_400)) : 60;
}

async function microsoftFetch(url: string, init: RequestInit): Promise<Response> {
  return fetch(url, { ...init, signal: AbortSignal.timeout(HTTP_TIMEOUT_MS), redirect: "error", cache: "no-store" });
}

async function requestTokens(parameters: Record<string, string>, previousRefreshToken?: string): Promise<TokenResult> {
  const config = configured();
  let response: Response;
  try {
    response = await microsoftFetch(`https://login.microsoftonline.com/${tenant()}/oauth2/v2.0/token`, {
      method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ ...parameters, client_id: process.env.OUTLOOK_CLIENT_ID!, client_secret: process.env.OUTLOOK_CLIENT_SECRET!, redirect_uri: config.redirectUri, scope: SCOPES }),
    });
  } catch { throw new OutlookSendError("throttled", TEMPORARY_MESSAGE, 60); }
  if (response.status === 429) throw new OutlookSendError("throttled", TEMPORARY_MESSAGE, retryAfter(response));
  if (response.status >= 500) throw new OutlookSendError("throttled", TEMPORARY_MESSAGE, 60);
  if (!response.ok) throw new OutlookSendError("reconnect", RECONNECT_MESSAGE);
  let payload: Record<string, unknown>;
  try { payload = await response.json(); } catch { throw new OutlookSendError("reconnect", RECONNECT_MESSAGE); }
  const expiresIn = Number(payload.expires_in);
  const refreshToken = typeof payload.refresh_token === "string" ? payload.refresh_token : previousRefreshToken;
  if (typeof payload.access_token !== "string" || !payload.access_token || !refreshToken || !Number.isFinite(expiresIn) || expiresIn <= 0 || String(payload.token_type).toLowerCase() !== "bearer") {
    throw new OutlookSendError("reconnect", RECONNECT_MESSAGE);
  }
  const scopes = typeof payload.scope === "string" ? payload.scope.toLowerCase().split(" ").map(s => s.replace("https://graph.microsoft.com/", "")) : [];
  if (scopes.length && (!scopes.includes("mail.send") || !scopes.includes("user.read"))) throw new OutlookSendError("reconnect", RECONNECT_MESSAGE);
  return { accessToken: payload.access_token, refreshToken, expiresAt: new Date(Date.now() + Math.min(expiresIn, 86_400) * 1000) };
}

export async function completeOutlookConnection(adminId: number | string, parameters: URLSearchParams): Promise<OutlookCallbackStatus> {
  configured();
  await ensureOutlookSchema();
  const state = parameters.get("state");
  if (!state || !/^[A-Za-z0-9_-]{43}$/.test(state)) return "error";
  const stateHash = createHash("sha256").update(state).digest("hex");
  const { rows } = await sql`
    DELETE FROM outlook_oauth_states WHERE state_hash = ${stateHash} AND admin_id = ${String(adminId)} AND expires_at > NOW()
    RETURNING code_verifier_encrypted, expected_connection_id
  `;
  // Atomically consume the session-bound state, including provider denial, before using any response.
  const pending = rows[0];
  if (!pending) return "error";
  if (parameters.get("error")) return parameters.get("error") === "access_denied" ? "cancelled" : "error";
  const code = parameters.get("code");
  if (!code || code.length > 10_000) return "error";
  const tokens = await requestTokens({ grant_type: "authorization_code", code, code_verifier: decrypt(pending.code_verifier_encrypted as string, "pkce") });
  let response: Response;
  try {
    response = await microsoftFetch("https://graph.microsoft.com/v1.0/me?$select=id,displayName,mail,userPrincipalName", { headers: { Authorization: `Bearer ${tokens.accessToken}` } });
  } catch { return "error"; }
  if (!response.ok) return "error";
  let identity: Record<string, unknown>;
  try { identity = await response.json(); } catch { return "error"; }
  const email = typeof identity.mail === "string" && identity.mail ? identity.mail : identity.userPrincipalName;
  if (typeof identity.id !== "string" || !validEmail(email)) return "error";
  const name = typeof identity.displayName === "string" ? identity.displayName.slice(0, 200) : email;
  const encryptedTokens = encrypt(JSON.stringify({ accessToken: tokens.accessToken, refreshToken: tokens.refreshToken }), "tokens");
  const { rows: saved } = await sql`
    UPDATE outlook_connection SET connection_id = ${randomUUID()}, version = version + 1, encrypted_tokens = ${encryptedTokens},
      access_expires_at = ${tokens.expiresAt.toISOString()}, sender_email = ${email}, sender_name = ${name}, last_error = NULL,
      refresh_lock = NULL, refresh_lock_expires_at = NULL, updated_at = NOW()
    WHERE singleton = true AND connection_id = ${pending.expected_connection_id as string}
    RETURNING connection_id
  `;
  return saved.length ? "connected" : "reauth";
}

async function recordReconnect(row: ConnectionRow) {
  await sql`
    UPDATE outlook_connection SET last_error = ${RECONNECT_MESSAGE}, refresh_lock = NULL, refresh_lock_expires_at = NULL, updated_at = NOW()
    WHERE singleton = true AND connection_id = ${row.connection_id} AND version = ${row.version}
  `;
}

async function accessToken(forceRefresh = false, expectedConnectionId?: string): Promise<{ token: string; connectionId: string }> {
  configured();
  const deadline = Date.now() + 5_000;
  for (;;) {
    const row = await readConnection();
    if (!row) throw new OutlookSendError("reconnect", RECONNECT_MESSAGE);
    if (expectedConnectionId && row.connection_id !== expectedConnectionId) throw new OutlookSendError("reconnect", "Outlook connection changed. Check the connected mailbox before sending.");
    let tokens: TokenPair;
    try { tokens = tokensFrom(row); } catch {
      await recordReconnect(row);
      throw new OutlookSendError("reconnect", RECONNECT_MESSAGE);
    }
    if (!forceRefresh && row.access_expires_at && new Date(row.access_expires_at).getTime() > Date.now() + 60_000) return { token: tokens.accessToken, connectionId: row.connection_id };
    const lockId = randomUUID();
    const { rows: lease } = await sql`
      UPDATE outlook_connection SET refresh_lock = ${lockId}, refresh_lock_expires_at = NOW() + INTERVAL '45 seconds'
      WHERE singleton = true AND connection_id = ${row.connection_id} AND version = ${row.version}
        AND (refresh_lock IS NULL OR refresh_lock_expires_at <= NOW())
      RETURNING connection_id
    `;
    if (!lease.length) {
      if (Date.now() >= deadline) throw new OutlookSendError("throttled", TEMPORARY_MESSAGE, 10);
      await new Promise(resolve => setTimeout(resolve, 100));
      forceRefresh = false;
      continue;
    }
    try {
      const refreshed = await requestTokens({ grant_type: "refresh_token", refresh_token: tokens.refreshToken }, tokens.refreshToken);
      const encryptedTokens = encrypt(JSON.stringify({ accessToken: refreshed.accessToken, refreshToken: refreshed.refreshToken }), "tokens");
      const { rows: updated } = await sql`
        UPDATE outlook_connection SET encrypted_tokens = ${encryptedTokens}, access_expires_at = ${refreshed.expiresAt.toISOString()},
          version = version + 1, refresh_lock = NULL, refresh_lock_expires_at = NULL, last_error = NULL, updated_at = NOW()
        WHERE singleton = true AND connection_id = ${row.connection_id} AND version = ${row.version} AND refresh_lock = ${lockId}
        RETURNING connection_id
      `;
      if (!updated.length) throw new OutlookSendError("reconnect", "Outlook connection changed. Check the connected mailbox before sending.");
      return { token: refreshed.accessToken, connectionId: row.connection_id };
    } catch (error) {
      if (error instanceof OutlookSendError && error.kind === "reconnect") await recordReconnect(row);
      throw error;
    } finally {
      await sql`UPDATE outlook_connection SET refresh_lock = NULL, refresh_lock_expires_at = NULL WHERE singleton = true AND connection_id = ${row.connection_id} AND refresh_lock = ${lockId}`;
    }
  }
}

function validEmail(value: unknown): value is string {
  return typeof value === "string" && value.length <= 254 && /^[^\s<>@,;\r\n]+@[^\s<>@,;\r\n]+\.[^\s<>@,;\r\n]+$/.test(value);
}

/** Graph 202 means accepted, not delivered. Uncertain results must never be blindly retried. */
export async function sendOutlookMessage({ to, subject, body, expectedConnectionId }: { to: string[]; subject: string; body: string; expectedConnectionId?: string }): Promise<void> {
  if (!Array.isArray(to) || to.length < 1 || to.length > 50 || !to.every(validEmail) || typeof subject !== "string" || !subject.trim() || subject.length > 255 || /[\r\n]/.test(subject) || typeof body !== "string" || !body.trim() || body.length > 100_000) {
    throw new OutlookSendError("rejected", "Enter valid email recipients, a subject, and a message.");
  }
  await ensureOutlookSchema();
  let initialConnectionId: string | undefined = expectedConnectionId;
  for (let attempt = 0; attempt < 2; attempt++) {
    const credentials = await accessToken(attempt > 0, initialConnectionId);
    if (initialConnectionId && credentials.connectionId !== initialConnectionId) throw new OutlookSendError("reconnect", "Outlook connection changed. Check the connected mailbox before sending.");
    initialConnectionId = credentials.connectionId;
    const current = await readConnection();
    if (current?.connection_id !== credentials.connectionId || !current.encrypted_tokens || current.last_error) throw new OutlookSendError("reconnect", RECONNECT_MESSAGE);
    let response: Response;
    try {
      response = await microsoftFetch("https://graph.microsoft.com/v1.0/me/sendMail", {
        method: "POST", headers: { Authorization: `Bearer ${credentials.token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ message: { subject: subject.trim(), body: { contentType: "Text", content: body }, toRecipients: [...new Set(to)].map(address => ({ emailAddress: { address } })) }, saveToSentItems: true }),
      });
    } catch { throw new OutlookSendError("uncertain", "Outlook did not confirm acceptance. Check Sent Items before sending this message again."); }
    if (response.status === 202) return;
    if (response.status === 401 && attempt === 0) continue;
    if (response.status === 401 || response.status === 403) {
      if (current) await recordReconnect(current);
      throw new OutlookSendError("reconnect", RECONNECT_MESSAGE);
    }
    if (response.status === 429) throw new OutlookSendError("throttled", "Outlook is limiting sending. The message can be retried later.", retryAfter(response));
    if (response.status >= 500 || response.status === 408 || response.status < 400) throw new OutlookSendError("uncertain", "Outlook did not confirm acceptance. Check Sent Items before sending this message again.");
    throw new OutlookSendError("rejected", "Outlook could not accept this message. Check the recipients and your mailbox permissions.");
  }
}
