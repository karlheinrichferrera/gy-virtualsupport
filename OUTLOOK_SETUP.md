# Connect Outlook to the Admin Portal

Admin > Email supports a shared Outlook sending account, manual messages, and optional automatic emails for newly published client invoices and VA/client notifications. The feature stays disconnected until Microsoft credentials are configured and an administrator signs in to Microsoft. No email is sent by deploying the feature alone.

## Microsoft app registration

1. Open [Microsoft Entra app registrations](https://entra.microsoft.com/#view/Microsoft_AAD_RegisteredApps/ApplicationsListBlade). Register an application. For personal Outlook accounts as well as Microsoft 365, select **Accounts in any organizational directory and personal Microsoft accounts**. A Microsoft 365 administrator may need to create the registration or approve consent if your organization restricts this.
2. Add a **Web** redirect URI: `https://gy-virtualsupport-safq.vercel.app/api/outlook/callback`. For another portal domain, set `PORTAL_APP_URL` to its HTTPS origin and register the exact callback shown in Admin > Email.
3. Under API permissions, add Microsoft Graph **delegated** `User.Read` and `Mail.Send`. The connection also requests `offline_access`, `openid`, `profile`, and `email`. It does not request application-wide mailbox access.
4. Copy the Application (client) ID. Under Certificates & secrets, create a client secret and copy its **Value**, which Microsoft shows only once. Keep its expiration date for renewal.

## Vercel settings

Open the `gy-virtualsupport-safq` project's **Settings > Environment Variables**. Add these to Production (and Preview only if you intend to connect preview deployments):

| Variable | Value |
| --- | --- |
| `OUTLOOK_CLIENT_ID` | Application (client) ID from Microsoft |
| `OUTLOOK_CLIENT_SECRET` | Client secret **Value**; save as a sensitive environment variable |
| `OUTLOOK_TENANT_ID` | Optional: organization tenant ID; defaults to `common` for personal/work/school accounts |
| `PORTAL_APP_URL` | Optional: canonical HTTPS portal origin; defaults to `https://gy-virtualsupport-safq.vercel.app` |
| `CRON_SECRET` | A generated, long random secret for authenticated scheduled processing |

Save secrets in Vercel's secure settings, never in chat or Git. Redeploy for environment variable changes to take effect. Codex environment settings apply to development tasks separately and do not update Vercel.

Sign in to the Admin Portal again, open **Email**, choose **Connect Outlook**, and approve Microsoft consent for the mailbox you want to send from. All administrators share this sender. Review it before enabling automatic emails. Use **Compose email** for manual messages. Check **Recent emails** for results.

## Automatic and scheduled emails

Enable client invoices and/or portal notifications in Admin > Email. Existing invoices and notifications are excluded. A new non-draft invoice, or a draft first published after enabling automation, creates one invoice email to the client and that invoice's optional **Additional recipients** (CC). Enter up to 10 addresses in Client Management > Client Invoices > Add Invoice, separated by commas or new lines. The field is also available when editing an invoice. Recipients are saved per invoice; there are no client-wide CC defaults or automatically added staff contacts. The former account-level recipient data is retained but unused. Each email snapshots recipients when queued; later changes do not update or resend an existing email.

Client Invoices shows each invoice's email status, with automatic refresh every 15 seconds and a manual **Refresh email status** button. **Not sent** means no email was queued; **Accepted by Outlook** means Microsoft accepted the send request, not confirmed inbox delivery. Failed, skipped, or uncertain messages show the recorded reason and link to Admin > Email history. The current Mail.Send integration does not request delivery/read receipts or have permission to read the mailbox for receipts or bounces.

Invoice publication creates a client portal notification independently of email settings. Drafts are excluded from client invoice lists and dashboard counts. Invoice portal pushes are excluded from generic notification emails to avoid sending two emails for the same invoice.

Invoice emails use the requested billing summary, payment link, portal access instructions, and generic signature. The invoice link falls back to the client's portal invoices page if no valid link is saved. Only the supplied default password is included when it is still the client's default; changed passwords are never copied into emails. Notifications and manually composed emails use the same generic signature. Manual compose includes From Name, From Email, To, CC, BCC, Subject, and Message. From Email must match the connected mailbox; Microsoft can use the mailbox profile's display name when displaying the sender.

Each ordinary portal notification creates a separate email for each recipient, preserving private recipient lists. A notification email has a portal link only when Redirect To is provided. Greeting images up to 2 MB are included inline; larger images up to the existing 10 MB limit use a persistent image URL to stay within Microsoft Graph's send limits. Some mail clients require readers to allow remote images. Stored email image references survive portal notification deletion, including the 24-hour read retention rule.

New leave/shift requests and overtime requests create acknowledgement notifications; admin approvals and new salary adjustments create notifications for the affected VA. Submitting a VA invoice creates a **VA Invoice - Acknowledgement** notification. An admin changing that VA invoice to Paid, through either Mark Paid or the invoice edit form, creates **VA Invoice - Paid**, including the billing period and amount disbursed. Both are private to the VA who owns the invoice and link to their invoices page. Submission retries and repeated Paid saves do not duplicate notices; drafts do not receive submission acknowledgements. Existing paid invoices are not announced retroactively. Their email copies follow the **Portal notifications** email switch, independently of the Client invoices switch.

Repeated saves of an already-approved request do not duplicate approval notices. VAs sign in again after this upgrade so requests and inbox reads can use a server-verified session; passwords are no longer returned to the browser. Clicking More opens full notification details in a popup with keyboard support.

Enabling notification email approves the current VA email contact list. New public registrations and changes made to a VA's email outside the Admin Portal need admin review before receiving automated email: save the VA's record in Admin > Virtual Assistants to approve its current email address. Until then, its email is marked Skipped in history; portal notifications still work normally. Client email destinations can only be created or changed by a signed-in admin.

Immediate changes wake a durable email queue. Portal inbox requests and the email history screen also resume pending work. The existing Vercel daily cron at 06:00 UTC processes emails when `CRON_SECRET` is configured; Vercel automatically includes the matching Bearer authorization header.

For unattended scheduled/recurring emails closer to their selected time, configure a scheduler to call `GET https://gy-virtualsupport-safq.vercel.app/api/cron/email` every minute (or at your desired interval), with `Authorization: Bearer <CRON_SECRET>`. This endpoint fails closed when the secret is absent or incorrect. The repository retains the existing daily Vercel schedule so deployment remains compatible with Vercel plans that restrict cron frequency. A frequent schedule is an additional setup step; without it, scheduled notifications may wait for the daily run or a portal request. Large batches drain over repeated worker invocations.

**Accepted by Outlook** means Microsoft accepted the send request; it does not confirm final delivery. Requests rejected because of throttling retry later. A timeout or an interrupted send is marked **Needs review** and is never automatically resent: check Outlook Sent Items before choosing **Review and retry**, since Microsoft might already have accepted it. Explicit retries can produce duplicates if a previous uncertain request succeeded.

Disconnecting removes stored credentials, disables automation, and cancels queued mail. An email already submitted to Microsoft cannot be recalled. Reconnecting a different account does not send the previous connection's backlog. Rotating `OUTLOOK_CLIENT_SECRET` invalidates the encrypted stored tokens; reconnect afterward. Client secrets and Microsoft policies can also require reconnecting later.

## Validation

The repository tests mock all Microsoft HTTP calls; they never send real email. Database integration tests create and remove isolated schemas rather than touching application data:

```sh
node --test tests/admin-session.test.mjs tests/va-session.test.mjs tests/outlook.test.mjs tests/email-templates.test.mjs
node --use-env-proxy --test tests/email.integration.test.mjs tests/workflow-notifications.integration.test.mjs
npm run build
```

A real Microsoft consent and a deliberate test message are still needed after configuring the deployment to verify your mailbox's permissions and delivery.
