import { readFile } from "node:fs/promises";
import path from "node:path";
import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, PDFName, PDFString, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import type { ClientInvoice } from "./actions";
import { invoiceAmountCents, invoiceMoney, invoiceItems, invoicePaymentLink, INVOICE_SUPPORT_EMAIL } from "./client-invoice-format";

let fontBytes: Promise<Buffer[]> | undefined;
export async function clientInvoicePdf(invoice: ClientInvoice): Promise<Uint8Array> {
  const itemized = invoice.invoiceLayout === 'itemized';
  const { items, amount } = itemized ? invoiceItems(invoice.lineItems)
    : { items: [{ title: "Billed services", description: invoice.billCoverage, amount: invoice.amount }], amount: invoice.amount };
  const paid = invoice.status.trim().toLowerCase() === "paid";
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  fontBytes ??= Promise.all(["DejaVuSans.ttf", "DejaVuSans-Bold.ttf"].map(file => readFile(path.join(process.cwd(), "src/assets/invoice-fonts", file))));
  const [regular, bold] = await Promise.all((await fontBytes).map(bytes => pdf.embedFont(bytes, { subset: true })));
  pdf.setTitle(`Invoice ${invoice.invoiceNumber}`); pdf.setAuthor("GY Virtual Support Team");
  const ink = rgb(0.078, 0.176, 0.259), muted = rgb(0.39, 0.45, 0.52), white = rgb(1, 1, 1);
  const pale = rgb(0.965, 0.973, 0.98), rule = rgb(0.89, 0.91, 0.93);
  const left = 44, width = 507, split = 360, bottom = 48;
  let page!: PDFPage;
  let y = 0;
  const supported = new Set(regular.getCharacterSet());
  const printable = (text: string) => Array.from(text).map(c => c === '\n' || supported.has(c.codePointAt(0)!) ? c : "?").join("");
  const wrap = (text: string, font: PDFFont, size: number, max: number) => {
    const lines: string[] = [];
    for (const paragraph of printable(text).replace(/\r/g, "").split("\n")) {
      let line = "";
      for (const word of paragraph.split(/\s+/)) {
        const candidate = line ? `${line} ${word}` : word;
        if (font.widthOfTextAtSize(candidate, size) <= max) { line = candidate; continue; }
        if (line) { lines.push(line); line = ""; }
        for (const char of word) {
          if (font.widthOfTextAtSize(line + char, size) > max && line) { lines.push(line); line = ""; }
          line += char;
        }
      }
      lines.push(line);
    }
    return lines;
  };
  const text = (value: string, x: number, top: number, size = 10, font = regular, color = ink) => {
    page.drawText(printable(value), { x, y: top - size, size, font, color });
  };
  const right = (value: string, top: number, size = 10, font = regular, color = ink) => {
    text(value, left + width - font.widthOfTextAtSize(printable(value), size), top, size, font, color);
  };
  const fill = (x: number, top: number, w: number, h: number, color = pale) => page.drawRectangle({ x, y: top - h, width: w, height: h, color });
  const line = (top: number) => page.drawLine({ start: { x: left, y: top }, end: { x: left + width, y: top }, thickness: 0.6, color: rule });
  const link = (url: string, x: number, top: number, w: number, h: number) => {
    const annotation = pdf.context.obj({ Type: "Annot", Subtype: "Link", Rect: [x, top - h, x + w, top],
      Border: [0, 0, 0], A: { Type: "Action", S: PDFName.of("URI"), URI: PDFString.of(url) } });
    page.node.addAnnot(pdf.context.register(annotation));
  };
  const heading = () => {
    fill(left, y, width, 28); text("DESCRIPTION", left + 10, y - 8, 8, bold, muted); right("AMOUNT", y - 8, 8, bold, muted); y -= 40;
  };
  const newPage = (continued = false) => {
    page = pdf.addPage([595, 842]); fill(0, 842, 595, 5, ink); y = 796;
    if (continued) {
      text("GY VIRTUAL SUPPORT", left, y, 10, bold); right(`INVOICE ${invoice.invoiceNumber}`, y, 9, regular, muted); y -= 32; heading();
    }
  };
  newPage();
  fill(left, y, 40, 40, ink); text("GY", left + 9, y - 10, 17, bold, white);
  text("GY Virtual Support", left + 52, y - 3, 13, bold);
  text("Client services · Billing", left + 52, y - 23, 8, regular, muted);
  right("INVOICE", y + 2, 30); y -= 54;
  const referenceLines = wrap(invoice.invoiceNumber, regular, 9, width);
  for (const value of referenceLines) { right(value, y, 9, regular, muted); y -= 13; }
  y -= 14; line(y); y -= 22;
  text("BILL TO", left, y, 8, bold, muted);
  const billLines = wrap(invoice.billToName || "—", bold, 14, 240);
  let billY = y - 19;
  for (const value of billLines) { text(value, left, billY, 14, bold); billY -= 19; }
  for (const value of wrap(invoice.billToCompany || "—", regular, 10, 240)) { text(value, left, billY, 10, regular, muted); billY -= 15; }
  let detailsY = y;
  for (const [label, value] of [["Billing Period", invoice.billCoverage], ["Payment Due Date", invoice.invoiceDueDate], ["Status", invoice.status]]) {
    text(label, left + 270, detailsY, 8, regular, muted); detailsY -= 14;
    for (const valueLine of wrap(value, regular, 10, width - 270)) { text(valueLine, left + 270, detailsY); detailsY -= 15; }
    detailsY -= 9;
  }
  y = Math.min(billY, detailsY) - 18; heading();
  for (const item of items) {
    const lines = [...wrap(item.title, bold, 11, split - 18).map(value => ({ value, font: bold, size: 11, color: ink })),
      ...(item.description ? wrap(item.description, regular, 10, split - 18).map(value => ({ value, font: regular, size: 10, color: muted })) : [])];
    let offset = 0;
    while (offset < lines.length) {
      if (y - bottom < 50) newPage(true);
      const count = Math.min(lines.length - offset, Math.floor((y - bottom - 18) / 16));
      const height = Math.max(52, count * 16 + 18);
      lines.slice(offset, offset + count).forEach((value, i) => text(value.value, left, y - i * 16, value.size, value.font, value.color));
      if (offset === 0) {
        const value = itemized ? invoiceMoney(invoiceAmountCents(item.amount)) : item.amount;
        const size = Math.min(11, (width - split - 4) / bold.widthOfTextAtSize(printable(value), 1));
        right(value, y, size, bold);
      }
      offset += count; y -= height; line(y); y -= 14;
      if (offset < lines.length) newPage(true);
    }
  }
  if (y < bottom + 135) newPage(true);
  y -= 8;
  const totalLeft = left + 260, totalWidth = width - 260;
  const amountSize = Math.min(24, (totalWidth - 32) / bold.widthOfTextAtSize(printable(amount), 1));
  fill(totalLeft, y, totalWidth, 110);
  text("Subtotal", totalLeft + 16, y - 13, 9, regular, muted);
  text(amount, left + width - 16 - regular.widthOfTextAtSize(printable(amount), 9), y - 13, 9, regular, muted);
  text("GRAND TOTAL", totalLeft + 16, y - 38, 8, bold);
  text(amount, totalLeft + 16, y - 54, amountSize, bold);
  text(paid ? "USD · PAYMENT RECEIVED" : "USD · AMOUNT DUE", totalLeft + 16, y - 90, 8, regular, muted);
  y -= 136;
  let paymentLink = "";
  try { paymentLink = invoicePaymentLink(invoice.paymentLink || ""); } catch { /* Omit unsafe stored links. */ }
  const ensureSpace = (height: number) => {
    if (y < bottom + height) { newPage(); text(`INVOICE ${invoice.invoiceNumber}`, left, y, 11, bold); y -= 32; }
  };
  if (!paid && paymentLink) {
    ensureSpace(75); fill(left, y, 128, 34, ink); text("Pay invoice", left + 30, y - 10, 11, bold, white); link(paymentLink, left, y, 128, 34); y -= 45;
    for (const value of wrap(paymentLink, regular, 9, width)) {
      ensureSpace(18); text(value, left, y, 9, regular, muted); link(paymentLink, left, y, regular.widthOfTextAtSize(value, 9), 13); y -= 15;
    }
    y -= 14;
  }
  const footer = [
    ...(paid ? ["Thank you for your payment."] : []),
    `Questions about this invoice? ${INVOICE_SUPPORT_EMAIL}`,
    ...(!paid ? ["Please pay before the scheduled due date to avoid interruption of VA workloads."] : []),
    "", "Thank you for your business!",
  ];
  for (const paragraph of footer) {
    for (const value of wrap(paragraph, regular, 9, width)) { ensureSpace(18); text(value, left, y, 9, regular, muted); y -= 15; }
  }
  const pages = pdf.getPages();
  pages.forEach((p, index) => {
    p.drawText("GY Virtual Support Team", { x: left, y: 23, size: 8, font: regular, color: muted });
    p.drawText(`${index + 1} / ${pages.length}`, { x: 520, y: 23, size: 8, font: regular, color: muted });
  });
  return pdf.save();
}
