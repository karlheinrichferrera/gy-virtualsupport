import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
});

export async function sendNotificationEmail(
  to: string,
  subject: string,
  html: string
): Promise<void> {
  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) return;
  try {
    await transporter.sendMail({
      from: `"GY Virtual Support" <${process.env.GMAIL_USER}>`,
      to,
      subject,
      html,
    });
  } catch (e) {
    console.error("Email send failed:", e);
  }
}

export function overtimeRequestEmail(vaName: string, date: string, timeIn: string, timeOut: string, reason: string): { subject: string; html: string } {
  return {
    subject: `Overtime Request from ${vaName}`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
        <div style="background:#4f46e5;color:white;padding:20px;border-radius:8px 8px 0 0;">
          <h2 style="margin:0;">Overtime Request</h2>
        </div>
        <div style="border:1px solid #e2e8f0;border-top:none;padding:20px;border-radius:0 0 8px 8px;">
          <p><strong>${vaName}</strong> has submitted an overtime request:</p>
          <table style="width:100%;border-collapse:collapse;margin:16px 0;">
            <tr><td style="padding:8px;border-bottom:1px solid #e2e8f0;color:#64748b;">Date</td><td style="padding:8px;border-bottom:1px solid #e2e8f0;">${date}</td></tr>
            <tr><td style="padding:8px;border-bottom:1px solid #e2e8f0;color:#64748b;">Time In</td><td style="padding:8px;border-bottom:1px solid #e2e8f0;">${timeIn}</td></tr>
            <tr><td style="padding:8px;border-bottom:1px solid #e2e8f0;color:#64748b;">Time Out</td><td style="padding:8px;border-bottom:1px solid #e2e8f0;">${timeOut}</td></tr>
            <tr><td style="padding:8px;border-bottom:1px solid #e2e8f0;color:#64748b;">Reason</td><td style="padding:8px;border-bottom:1px solid #e2e8f0;">${reason}</td></tr>
          </table>
          <p style="color:#64748b;font-size:14px;">Please log in to the <a href="https://gy-virtualsupport-safq.vercel.app/admin" style="color:#4f46e5;">Admin Portal</a> to approve or reject this request.</p>
        </div>
      </div>
    `,
  };
}

export function leaveRequestEmail(vaName: string, type: string, dateFrom: string, dateTo: string, reason: string): { subject: string; html: string } {
  return {
    subject: `${type} Request from ${vaName}`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
        <div style="background:#4f46e5;color:white;padding:20px;border-radius:8px 8px 0 0;">
          <h2 style="margin:0;">${type} Request</h2>
        </div>
        <div style="border:1px solid #e2e8f0;border-top:none;padding:20px;border-radius:0 0 8px 8px;">
          <p><strong>${vaName}</strong> has submitted a ${type.toLowerCase()} request:</p>
          <table style="width:100%;border-collapse:collapse;margin:16px 0;">
            <tr><td style="padding:8px;border-bottom:1px solid #e2e8f0;color:#64748b;">Type</td><td style="padding:8px;border-bottom:1px solid #e2e8f0;">${type}</td></tr>
            <tr><td style="padding:8px;border-bottom:1px solid #e2e8f0;color:#64748b;">Date From</td><td style="padding:8px;border-bottom:1px solid #e2e8f0;">${dateFrom}</td></tr>
            <tr><td style="padding:8px;border-bottom:1px solid #e2e8f0;color:#64748b;">Date To</td><td style="padding:8px;border-bottom:1px solid #e2e8f0;">${dateTo}</td></tr>
            <tr><td style="padding:8px;border-bottom:1px solid #e2e8f0;color:#64748b;">Reason</td><td style="padding:8px;border-bottom:1px solid #e2e8f0;">${reason}</td></tr>
          </table>
          <p style="color:#64748b;font-size:14px;">Please log in to the <a href="https://gy-virtualsupport-safq.vercel.app/admin" style="color:#4f46e5;">Admin Portal</a> to review this request.</p>
        </div>
      </div>
    `,
  };
}
