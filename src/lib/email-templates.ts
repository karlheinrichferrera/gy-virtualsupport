import { clientInvoiceFileUrl } from "./invoice-links";

export const EMAIL_FROM_NAME = "GY Virtual Support Team";
export const EMAIL_FROM_ADDRESS = "hello.graveyardcrewph@outlook.com";
export const EMAIL_SIGNATURE = `Best regards,\n${EMAIL_FROM_NAME}\n${EMAIL_FROM_ADDRESS}`;
export const escapeEmailHtml = (value: string) => value.replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]!));
const paragraphs = (value: string) => escapeEmailHtml(value).replace(/\n/g, "<br>");
const signature = `<p style="margin-top:28px">Best regards,<br><strong>${EMAIL_FROM_NAME}</strong><br><a href="mailto:${EMAIL_FROM_ADDRESS}">${EMAIL_FROM_ADDRESS}</a></p>`;
function layout(content: string) {
  return `<!doctype html><html><body style="margin:0;background:#f3f4f6"><div style="max-width:640px;margin:24px auto;padding:32px;background:#fff;font-family:Arial,sans-serif;color:#1f2937;font-size:15px;line-height:1.65">${content}</div></body></html>`;
}

export type InvoiceEmailData = {
  kind: "invoice"; invoiceNumber: string; billCoverage: string; amount: string; dueDate: string;
  invoiceLink: string; clientEmail: string; clientName?: string; defaultPassword: boolean;
  isPaid?: boolean;
  includesPayPalFees?: boolean;
};
export type NotificationEmailData = {
  kind: "notification"; title: string; message: string; redirectTo: string; audience: "va" | "client";
};
export type EmailTemplateData = InvoiceEmailData | NotificationEmailData;

export function invoiceEmail(data: InvoiceEmailData, origin: string) {
  if (data.isPaid) {
    return notificationEmail({ kind: "notification", title: "Client Invoice - Paid", audience: "client", redirectTo: "/client/dashboard/invoices",
      message: `Hi ${data.clientName?.trim().split(/\s+/)[0] || "there"},\n\nYour invoice ${data.invoiceNumber} has been marked as paid. Thank you for your payment.\n\nBilling period: ${data.billCoverage}\nInvoice amount: ${data.amount}` }, origin);
  }
  const portal = `${origin}/client/dashboard`;
  const invoice = clientInvoiceFileUrl(data.invoiceLink) || `${portal}/invoices`;
  const greeting = `Hi ${data.clientName?.trim().split(/\s+/)[0] || "there"},`;
  const password = data.defaultPassword ? "gyclient2026" : "Use your current portal password";
  const amountDue = `${data.amount}${data.includesPayPalFees === true ? " (inclusive of PayPal transaction fees)" : ""}`;
  const subject = `INVOICE - ${data.billCoverage} : ${EMAIL_FROM_NAME}`;
  const body = `${greeting}\n\nWe hope you're doing well!\n\nYour latest invoice is now available in the GY Virtual Support Client Portal. Please review the billing details below.\n\nInvoice Summary\nInvoice Number: ${data.invoiceNumber}\nBilling Period: ${data.billCoverage}\nTotal Amount Due: ${amountDue}\nPayment Due Date: ${data.dueDate}\n\nTo review your invoice and complete your payment, please use the link below:\nView & Pay Your Invoice: ${invoice}\n\nAccess Your Client Portal\nFor complete transparency, you also have access to the GY Virtual Support Client Portal, where you will find your team's logged hours, weekly performance reports, and other relevant updates.\n\nClient Portal: ${portal}\nYour login details are as follows:\nEmail: ${data.clientEmail}\nPassword: ${password}\n\nFor security purposes, we recommend keeping your login credentials confidential.\n\nQuestions or Billing Concerns?\nIf you have questions regarding your invoice, your team's logged hours, or your weekly reports, feel free to reach out to our support team. We're happy to assist.\n\nThank you for your continued trust and partnership.\n\n${EMAIL_SIGNATURE}`;
  const rows = [["Invoice Number", data.invoiceNumber], ["Billing Period", data.billCoverage], ["Total Amount Due", amountDue], ["Payment Due Date", data.dueDate]];
  const html = layout(`<p>${escapeEmailHtml(greeting)}</p><p>We hope you're doing well!</p><p>Your latest invoice is now available in the GY Virtual Support Client Portal. Please review the billing details below.</p><h2 style="font-size:19px">Invoice Summary</h2><table style="width:100%;border-collapse:collapse">${rows.map(([label, value]) => `<tr><td style="padding:9px;border-bottom:1px solid #e5e7eb"><strong>${label}:</strong></td><td style="padding:9px;border-bottom:1px solid #e5e7eb">${escapeEmailHtml(value)}</td></tr>`).join("")}</table><p>To review your invoice and complete your payment, please use the link below:</p><p><a href="${escapeEmailHtml(invoice)}" style="display:inline-block;padding:12px 20px;border-radius:7px;background:#4f46e5;color:#fff;text-decoration:none;font-weight:bold">View &amp; Pay Your Invoice</a></p><h2 style="font-size:19px">Access Your Client Portal</h2><p>For complete transparency, you also have access to the GY Virtual Support Client Portal, where you will find your team's logged hours, weekly performance reports, and other relevant updates.</p><p><strong>Client Portal:</strong> <a href="${portal}">${portal}</a></p><p>Your login details are as follows:</p><p><strong>Email:</strong> ${escapeEmailHtml(data.clientEmail)}<br><strong>Password:</strong> ${escapeEmailHtml(password)}</p><p>For security purposes, we recommend keeping your login credentials confidential.</p><h2 style="font-size:19px">Questions or Billing Concerns?</h2><p>If you have questions regarding your invoice, your team's logged hours, or your weekly reports, feel free to reach out to our support team. We're happy to assist.</p><p>Thank you for your continued trust and partnership.</p>${signature}`);
  return { subject, body, html };
}

export function notificationEmail(data: NotificationEmailData, origin: string, imageSrc?: string) {
  const portal = data.audience === "client" ? "/client/dashboard" : "/dashboard";
  const path = data.redirectTo;
  let link = "";
  if (path && !/[\\\u0000-\u0020]/.test(path)) {
    try {
      const url = new URL(path, origin);
      if (url.origin === origin && (url.pathname === portal || url.pathname.startsWith(`${portal}/`))) link = url.href;
    } catch { /* Omit invalid links from legacy records. */ }
  }
  const body = `${data.message}${link ? `\n\nOpen your portal: ${link}` : ""}\n\n${EMAIL_SIGNATURE}`;
  const image = imageSrc ? `<p style="margin-top:24px"><img src="${escapeEmailHtml(imageSrc)}" alt="${escapeEmailHtml(data.title)}" style="display:block;max-width:100%;height:auto;border-radius:8px"></p>` : "";
  const html = layout(`<p>${paragraphs(data.message)}</p>${link ? `<p><a href="${escapeEmailHtml(link)}">Open your portal</a></p>` : ""}${signature}${image}`);
  return { subject: data.title, body, html };
}

export function manualEmail(body: string) {
  const message = body.trimEnd().endsWith(EMAIL_SIGNATURE) ? body.trimEnd().slice(0, -EMAIL_SIGNATURE.length).trimEnd() : body;
  return { body: `${message}\n\n${EMAIL_SIGNATURE}`, html: layout(`<p>${paragraphs(message)}</p>${signature}`) };
}
