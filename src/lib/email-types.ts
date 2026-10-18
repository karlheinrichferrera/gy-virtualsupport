export type EmailJobStatus = "queued" | "sending" | "accepted" | "failed" | "uncertain" | "skipped" | "cancelled";
export type EmailSource = "manual" | "invoice" | "notification";

export interface EmailSettings {
  configured: boolean;
  missingConfig: string[];
  redirectUri: string;
  connected: boolean;
  senderEmail: string | null;
  senderName: string | null;
  autoInvoices: boolean;
  autoNotifications: boolean;
  cronConfigured: boolean;
  lastError: string | null;
}

export interface EmailJob {
  id: number;
  to: string[];
  cc: string[];
  bcc: string[];
  fromName: string;
  fromEmail: string;
  subject: string;
  source: EmailSource;
  status: EmailJobStatus;
  createdAt: string;
  lastError: string | null;
  attempts: number;
}

export interface ManualEmailInput {
  to: string[];
  cc?: string[];
  bcc?: string[];
  fromName?: string;
  fromEmail?: string;
  subject: string;
  body: string;
  requestId: string;
}
