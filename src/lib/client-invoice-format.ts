export type InvoiceLayout = "legacy" | "itemized";
export type InvoiceLineItem = { title: string; description: string; amount: string };
export const DEFAULT_INVOICE_PAYMENT_LINK = "https://wise.com/pay/me/karlf283";
export const INVOICE_SUPPORT_EMAIL = "hello.graveyardcrewph@outlook.com";

export function validateItemizedInvoiceDetails(input: { invoiceNumber: string; billCoverage: string; invoiceDueDate: string; status: string }) {
  for (const [label, value, max] of [["invoice number", input.invoiceNumber, 100], ["billing period", input.billCoverage, 300], ["payment due date", input.invoiceDueDate, 100]] as const) {
    if (typeof value !== "string" || !value.trim() || value.length > max || /[\u0000-\u001f]/.test(value)) throw new Error(`Enter a valid ${label} up to ${max} characters.`);
  }
  if (typeof input.status !== "string" || !["pending", "paid", "overdue", "draft"].includes(input.status.trim().toLowerCase())) throw new Error("Select a valid invoice status.");
}

/** USD amounts are calculated in integer cents, never floating point dollars. */
export function invoiceAmountCents(value: string): number {
  if (typeof value !== "string") throw new Error("Enter a valid USD amount with up to two decimal places.");
  const text = value.trim().replace(/^\$\s*/, "");
  if (!/^(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d{1,2})?$/.test(text)) throw new Error("Enter a valid USD amount with up to two decimal places.");
  const [whole, fraction = ""] = text.replaceAll(",", "").split(".");
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  if (!Number.isSafeInteger(cents) || cents > 99999999999) throw new Error("The invoice amount is too large.");
  return cents;
}

export function invoiceMoney(cents: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
}

export function invoiceItems(input: unknown): { items: InvoiceLineItem[]; amount: string } {
  if (!Array.isArray(input) || !input.length || input.length > 50) throw new Error("Add between 1 and 50 invoice items.");
  let total = 0;
  const items = input.map((item: InvoiceLineItem) => {
    if (!item || typeof item.title !== "string" || !item.title.trim() || item.title.length > 200) throw new Error("Enter an item title up to 200 characters.");
    if (typeof item.description !== "string" || item.description.length > 3000 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(item.title + item.description)) throw new Error("Enter an item description up to 3,000 characters.");
    const cents = invoiceAmountCents(item.amount);
    total += cents;
    return { title: item.title.trim(), description: item.description.trim(), amount: (cents / 100).toFixed(2) };
  });
  if (total <= 0 || total > 99999999999) throw new Error("The invoice total must be greater than zero and below $1 billion.");
  return { items, amount: invoiceMoney(total) };
}

export function invoicePaymentLink(value: string): string {
  if (typeof value !== "string" || value.length > 2048 || /[\u0000-\u0020\u007f]/.test(value.trim())) throw new Error("Enter a valid HTTPS payment link, or leave it blank.");
  if (!value.trim()) return "";
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "https:" || url.username || url.password) throw new Error();
    return url.href;
  } catch { throw new Error("Enter a valid HTTPS payment link, or leave it blank."); }
}
