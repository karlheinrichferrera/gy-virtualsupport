"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { Mail, Send, RefreshCw, Link2, Unplug, Copy, Check, AlertTriangle, Clock3 } from "lucide-react";
import {
  getEmailSettings,
  getEmailHistory,
  sendManualEmail,
  saveEmailAutomation,
  disconnectOutlook,
  retryEmail,
} from "@/lib/email-actions";
import type { EmailSettings, EmailJob, EmailJobStatus } from "@/lib/email-types";

const inputClass = "w-full min-w-0 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground disabled:opacity-60";
const primaryButton = "inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:opacity-50";
const statusLabels: Record<EmailJobStatus, string> = {
  queued: "Queued",
  sending: "Sending",
  accepted: "Accepted by Outlook",
  failed: "Failed",
  uncertain: "Needs review",
  skipped: "Skipped",
  cancelled: "Cancelled",
};
const statusColors: Record<EmailJobStatus, string> = {
  queued: "bg-slate-100 text-slate-700",
  sending: "bg-blue-100 text-blue-800",
  accepted: "bg-emerald-100 text-emerald-800",
  failed: "bg-red-100 text-red-800",
  uncertain: "bg-amber-100 text-amber-900",
  skipped: "bg-slate-100 text-slate-700",
  cancelled: "bg-slate-100 text-slate-700",
};
const sourceLabels: Record<EmailJob["source"], string> = {
  manual: "Manual email",
  invoice: "Client invoice",
  notification: "Portal notification",
};

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function dateLabel(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function submissionMessage(status: EmailJobStatus) {
  if (status === "accepted") return "Accepted by Outlook for sending. Delivery is not yet confirmed.";
  if (status === "queued") return "Your email is queued. Check its progress in Recent emails.";
  if (status === "sending") return "Your email is being sent. Check its progress in Recent emails.";
  if (status === "uncertain") return "The send result is unknown. Check Outlook Sent Items before retrying from Recent emails.";
  if (status === "failed") return "The email could not be sent. See the reason in Recent emails, then retry there.";
  return `Email ${statusLabels[status].toLowerCase()}. See Recent emails for details.`;
}

export default function AdminEmailPage() {
  const [settings, setSettings] = useState<EmailSettings | null>(null);
  const [history, setHistory] = useState<EmailJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [actionError, setActionError] = useState("");
  const [notice, setNotice] = useState("");
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [formError, setFormError] = useState("");
  const [sendNotice, setSendNotice] = useState("");
  const [sending, setSending] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [autoInvoices, setAutoInvoices] = useState(false);
  const [autoNotifications, setAutoNotifications] = useState(false);
  const [savingAutomation, setSavingAutomation] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [retrying, setRetrying] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);
  const requestId = useRef<string | null>(null);
  const oauthNoticeShown = useRef(false);

  const load = useCallback(async (preserveAutomation = false) => {
    try {
      const [account, recent] = await Promise.all([getEmailSettings(), getEmailHistory()]);
      setSettings(account);
      setHistory(recent);
      if (!preserveAutomation) {
        setAutoInvoices(account.autoInvoices);
        setAutoNotifications(account.autoNotifications);
      }
      if (!oauthNoticeShown.current) {
        oauthNoticeShown.current = true;
        const outlookResult = new URLSearchParams(window.location.search).get("outlook");
        if (outlookResult === "connected") setNotice("Outlook connected. Portal emails will use the account shown below.");
        if (outlookResult === "cancelled") setNotice("Outlook connection was cancelled. You can choose Connect Outlook to try again.");
        if (outlookResult === "reauth") setActionError("Sign in as an administrator again, then reconnect Outlook.");
        if (outlookResult === "error") setActionError("Outlook could not be connected. Review the account details below and try again.");
      }
      setLoadError("");
    } catch (error) {
      setLoadError(errorMessage(error, "Could not load email settings. Please try again."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const markDraftChanged = () => {
    requestId.current = null;
    setSubmitted(false);
    setFormError("");
    setSendNotice("");
  };

  const clearDraft = () => {
    setTo("");
    setSubject("");
    setBody("");
    markDraftChanged();
  };

  const handleSend = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (sending || submitted || !settings?.connected) return;
    setFormError("");
    setSendNotice("");
    const recipients = [...new Set(to.split(/[,\n]+/).map(address => address.trim().toLowerCase()).filter(Boolean))];
    if (!recipients.length || !subject.trim() || !body.trim()) {
      setFormError("Enter at least one recipient, a subject, and a message.");
      return;
    }
    if (recipients.length > 20) {
      setFormError("Send to up to 20 email addresses at a time.");
      return;
    }
    const invalidAddress = recipients.find(address => address.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address));
    if (invalidAddress) {
      setFormError(`Check this email address: ${invalidAddress}. Separate addresses with commas or new lines.`);
      return;
    }
    setSending(true);
    try {
      requestId.current ||= crypto.randomUUID();
      const result = await sendManualEmail({ to: recipients, subject: subject.trim(), body: body.trim(), requestId: requestId.current });
      setSendNotice(submissionMessage(result.status));
      setSubmitted(true);
      await load(true);
    } catch (error) {
      setFormError(errorMessage(error, "Could not submit this email. Please try again."));
    } finally {
      setSending(false);
    }
  };

  const handleSaveAutomation = async () => {
    if (!settings?.connected || savingAutomation) return;
    setSavingAutomation(true);
    setActionError("");
    setNotice("");
    try {
      await saveEmailAutomation({ autoInvoices, autoNotifications });
      setSettings(current => current ? { ...current, autoInvoices, autoNotifications } : current);
      setNotice("Automatic email settings saved. These apply to future events only.");
    } catch (error) {
      setActionError(errorMessage(error, "Could not save automatic email settings. Please try again."));
    } finally {
      setSavingAutomation(false);
    }
  };

  const handleDisconnect = async () => {
    if (!window.confirm("Disconnect Outlook for all administrators? Automatic emails will stop until an account is connected again.")) return;
    setDisconnecting(true);
    setActionError("");
    setNotice("");
    try {
      await disconnectOutlook();
      setNotice("Outlook disconnected.");
      await load();
    } catch (error) {
      setActionError(errorMessage(error, "Could not disconnect Outlook. Please try again."));
    } finally {
      setDisconnecting(false);
    }
  };

  const handleRetry = async (job: EmailJob) => {
    if (retrying !== null || !settings?.connected) return;
    if (job.status === "uncertain" && !window.confirm("Check Outlook Sent Items first. If this email is already there, cancel to avoid sending it twice. Have you checked and want to retry?")) return;
    setRetrying(job.id);
    setActionError("");
    setNotice("");
    try {
      await retryEmail(job.id);
      setNotice("Retry requested. Check Recent emails for the result.");
      await load(true);
    } catch (error) {
      setActionError(errorMessage(error, "Could not retry this email. Please try again."));
    } finally {
      setRetrying(null);
    }
  };

  const copyRedirect = async () => {
    if (!settings?.redirectUri) return;
    setActionError("");
    try {
      await navigator.clipboard.writeText(settings.redirectUri);
      setCopied(true);
    } catch {
      setActionError("Copy is unavailable in this browser. Select and copy the callback URL below.");
    }
  };

  const connected = Boolean(settings?.connected);
  const automationChanged = settings && (autoInvoices !== settings.autoInvoices || autoNotifications !== settings.autoNotifications);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-100"><Mail size={20} className="text-indigo-600" aria-hidden="true" /></div>
          <div className="min-w-0"><h1 className="text-2xl font-bold text-foreground">Email</h1><p className="text-sm text-muted">Send messages and automatic updates through Outlook</p></div>
        </div>
        <button type="button" onClick={() => { setLoading(true); void load(); }} disabled={loading || sending || savingAutomation || disconnecting || retrying !== null} className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm text-foreground hover:bg-card disabled:opacity-50"><RefreshCw size={15} aria-hidden="true" />{loading ? "Refreshing..." : "Refresh"}</button>
      </div>

      {loadError && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{loadError} Use Refresh to try again.</div>}
      {actionError && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{actionError}</p>}
      {notice && <p role="status" className="rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm text-indigo-800">{notice}</p>}
      {loading && !settings && <p role="status" className="py-8 text-center text-sm text-muted">Loading email settings...</p>}

      {settings && (
        <>
          <section aria-labelledby="outlook-heading" className="space-y-4 rounded-xl border border-border bg-card p-4 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0 space-y-1">
                <h2 id="outlook-heading" className="text-lg font-semibold text-foreground">Outlook account</h2>
                <p className="text-sm text-muted">One shared sending account for all portal administrators.</p>
                {connected ? <p className="break-words text-sm font-medium text-foreground">{settings.senderName ? `${settings.senderName} · ` : ""}{settings.senderEmail || "Connected Outlook account"}</p> : <p className="text-sm text-muted">Connect the account you want portal emails to come from.</p>}
              </div>
              <span className={`rounded-full px-3 py-1 text-xs font-semibold ${connected ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-900"}`}>{connected ? "Connected" : settings.configured ? "Not connected" : "Setup needed"}</span>
            </div>
            {settings.lastError && <p role="alert" className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">{settings.lastError}</p>}
            <div className="flex flex-wrap items-center gap-3">
              {settings.configured ? <a href="/api/outlook/connect" className={primaryButton}><Link2 size={15} aria-hidden="true" />{connected ? "Reconnect Outlook" : "Connect Outlook"}</a> : <button type="button" disabled className={primaryButton}><Link2 size={15} aria-hidden="true" />Connect Outlook</button>}
              {connected && <button type="button" onClick={() => void handleDisconnect()} disabled={disconnecting || sending || savingAutomation || retrying !== null} className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2.5 text-sm text-muted hover:text-red-600 disabled:opacity-50"><Unplug size={15} aria-hidden="true" />{disconnecting ? "Disconnecting..." : "Disconnect"}</button>}
            </div>
            <details open={!settings.configured} className="rounded-lg border border-border bg-background px-3 py-3">
              <summary className="cursor-pointer text-sm font-medium text-foreground">Outlook connection setup</summary>
              <div className="mt-3 space-y-3 text-sm text-muted">
                {settings.missingConfig.length > 0 && <p className="break-words text-amber-800">Missing settings: {settings.missingConfig.join(", ")}</p>}
                <ol className="list-decimal space-y-2 pl-5">
                  <li>In <a href="https://entra.microsoft.com/" target="_blank" rel="noreferrer" className="text-indigo-600 underline">Microsoft Entra</a>, create an app registration that supports accounts in any organization and personal Microsoft accounts.</li>
                  <li>Add a <strong className="font-medium text-foreground">Web</strong> redirect URI using the callback URL below. Add the delegated Microsoft Graph permissions <code>User.Read</code> and <code>Mail.Send</code>, and request <code>offline_access</code>.</li>
                  <li>Copy the <strong className="font-medium text-foreground">Application (client) ID</strong> from Overview. In <strong className="font-medium text-foreground">Certificates &amp; secrets</strong>, create a client secret and copy its <strong className="font-medium text-foreground">Value</strong> before leaving the page.</li>
                  <li>In the Vercel project&apos;s environment settings, save <code>OUTLOOK_CLIENT_ID</code> and <code>OUTLOOK_CLIENT_SECRET</code>. Use the client secret&apos;s value. <code>OUTLOOK_TENANT_ID</code> is optional for an organization-specific connection.</li>
                  <li>Redeploy after saving environment settings, then choose Connect Outlook above and sign in.</li>
                </ol>
                <div className="space-y-1">
                  <p className="font-medium text-foreground">Callback URL</p>
                  <div className="flex flex-wrap items-start gap-2">
                    <code className="min-w-0 flex-1 select-all break-all rounded border border-border bg-card px-3 py-2 text-xs text-foreground">{settings.redirectUri}</code>
                    <button type="button" onClick={() => void copyRedirect()} className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-border px-3 py-2 text-xs text-foreground hover:bg-card" aria-label="Copy callback URL">{copied ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}{copied ? "Copied" : "Copy"}</button>
                  </div>
                </div>
                {!settings.cronConfigured && <p>Save <code>CRON_SECRET</code> in Vercel to enable the scheduled email worker.</p>}
                <p>The current scheduled worker runs daily. Use a more frequent scheduler when scheduled messages need to go out closer to their chosen time. New immediate events are processed when they are created.</p>
              </div>
            </details>
          </section>

          <section aria-labelledby="compose-heading" className="space-y-4 rounded-xl border border-border bg-card p-4 sm:p-6">
            <div><h2 id="compose-heading" className="text-lg font-semibold text-foreground">Compose email</h2><p className="mt-1 text-sm text-muted">{connected ? "Send a plain text message from your connected Outlook account." : "Connect Outlook above to send emails."}</p></div>
            {formError && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{formError}</p>}
            {sendNotice && <p role="status" className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm text-indigo-800">{sendNotice}</p>}
            <form onSubmit={handleSend}>
              <fieldset disabled={!connected || sending || disconnecting} className="min-w-0 space-y-4 disabled:opacity-60">
                <legend className="sr-only">Email message</legend>
                <div><label htmlFor="email-to" className="mb-1 block text-sm font-medium text-foreground">To</label><textarea id="email-to" required rows={2} value={to} onChange={event => { setTo(event.target.value); markDraftChanged(); }} placeholder="client@example.com, assistant@example.com" spellCheck={false} autoComplete="off" className={`${inputClass} resize-y`} aria-describedby="email-to-help" /><p id="email-to-help" className="mt-1 text-xs text-muted">Add up to 20 addresses, separated with commas or new lines.</p></div>
                <div><label htmlFor="email-subject" className="mb-1 block text-sm font-medium text-foreground">Subject</label><input id="email-subject" required maxLength={200} value={subject} onChange={event => { setSubject(event.target.value); markDraftChanged(); }} className={inputClass} /></div>
                <div><label htmlFor="email-body" className="mb-1 block text-sm font-medium text-foreground">Message</label><textarea id="email-body" required maxLength={50000} rows={6} value={body} onChange={event => { setBody(event.target.value); markDraftChanged(); }} className={`${inputClass} resize-y`} /></div>
                <div className="flex flex-wrap items-center gap-3">
                  <button type="submit" disabled={sending || submitted || !to.trim() || !subject.trim() || !body.trim()} className={primaryButton}><Send size={15} aria-hidden="true" />{sending ? "Sending..." : submitted ? "Submitted" : "Send email"}</button>
                  <button type="button" onClick={clearDraft} disabled={sending} className="rounded-lg px-3 py-2 text-sm text-muted hover:text-foreground">New message</button>
                </div>
              </fieldset>
            </form>
          </section>

          <section aria-labelledby="automation-heading" className="space-y-4 rounded-xl border border-border bg-card p-4 sm:p-6">
            <div><h2 id="automation-heading" className="text-lg font-semibold text-foreground">Automatic emails</h2><p className="mt-1 text-sm text-muted">Apply to future events only. Existing invoices and old notifications will not be emailed.</p></div>
            <fieldset disabled={!connected || savingAutomation || disconnecting} className="min-w-0 space-y-4 disabled:opacity-60">
              <legend className="sr-only">Automatic email settings</legend>
              <label className="flex cursor-pointer items-start gap-3"><input type="checkbox" checked={autoInvoices} onChange={event => setAutoInvoices(event.target.checked)} className="mt-1 h-4 w-4 shrink-0 accent-indigo-600" /><span className="min-w-0"><span className="block text-sm font-medium text-foreground">Client invoices</span><span className="block text-xs text-muted">Email clients when a new invoice is published.</span></span></label>
              <label className="flex cursor-pointer items-start gap-3"><input type="checkbox" checked={autoNotifications} onChange={event => setAutoNotifications(event.target.checked)} className="mt-1 h-4 w-4 shrink-0 accent-indigo-600" /><span className="min-w-0"><span className="block text-sm font-medium text-foreground">Portal notifications</span><span className="block text-xs text-muted">Email recipients when new portal notifications are published. Turning this on approves current VA email addresses. Save new or changed VA contacts in VA Management to approve them.</span></span></label>
              <button type="button" onClick={() => void handleSaveAutomation()} disabled={savingAutomation || !automationChanged} className={primaryButton}>{savingAutomation ? "Saving..." : "Save automatic emails"}</button>
            </fieldset>
            {!connected && <p className="text-xs text-muted">Connect Outlook to turn on automatic emails.</p>}
            {!settings.cronConfigured && <p className="flex items-start gap-2 text-xs text-amber-800"><Clock3 size={15} className="shrink-0" aria-hidden="true" />Scheduled email processing needs configuration. Open Outlook connection setup above for details.</p>}
          </section>

          <section aria-labelledby="history-heading" className="overflow-hidden rounded-xl border border-border bg-card">
            <div className="space-y-1 border-b border-border px-4 py-4 sm:px-6"><h2 id="history-heading" className="font-semibold text-foreground">Recent emails</h2><p className="text-xs text-muted">Latest 50 messages. Accepted by Outlook means the send request was accepted; it does not confirm delivery.</p></div>
            {history.length === 0 ? <p className="p-8 text-center text-sm text-muted">No emails yet.</p> : <div className="divide-y divide-border">
              {history.map(job => <article key={job.id} className="space-y-3 px-4 py-4 sm:px-6">
                <div className="flex flex-wrap items-start justify-between gap-2"><div className="min-w-0 flex-1"><p className="break-words text-sm font-medium text-foreground">{job.subject}</p><p className="mt-1 text-xs text-muted">{sourceLabels[job.source]} · {dateLabel(job.createdAt)}</p></div><span className={`rounded-full px-2.5 py-1 text-xs font-medium ${statusColors[job.status]}`}>{statusLabels[job.status]}</span></div>
                <div className="flex min-w-0 items-start gap-2 text-xs text-muted"><span className="shrink-0">To:</span><ul className="min-w-0 space-y-1">{job.to.map(address => <li key={address} className="break-all">{address || "No email address"}</li>)}</ul></div>
                {job.lastError && <p className="break-words text-xs text-red-700">{job.lastError}</p>}
                {job.status === "uncertain" && <p className="flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900"><AlertTriangle size={15} className="shrink-0" aria-hidden="true" /><span>The send result is unknown. Check Outlook Sent Items before retrying so the recipient does not receive a duplicate.</span></p>}
                {(job.status === "failed" || job.status === "uncertain") && <button type="button" onClick={() => void handleRetry(job)} disabled={!connected || retrying !== null || disconnecting} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-medium text-foreground hover:bg-background disabled:opacity-50" aria-label={`${job.status === "uncertain" ? "Review and retry" : "Retry"} ${job.subject}`}><RefreshCw size={13} aria-hidden="true" />{retrying === job.id ? "Retrying..." : job.status === "uncertain" ? "Review and retry" : "Retry"}</button>}
              </article>)}
            </div>}
          </section>
        </>
      )}
    </div>
  );
}
