import { readFile } from "node:fs/promises";
import path from "node:path";
import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, PDFName, PDFString, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import type { ClientInvoice } from "./actions";
import { invoiceAmountCents, invoiceMoney, invoiceItems, invoicePaymentLink, INVOICE_SUPPORT_EMAIL } from "./client-invoice-format";

let fontBytes: Promise<Buffer[]> | undefined;
export async function clientInvoicePdf(invoice: ClientInvoice): Promise<Uint8Array> {
  const { items, amount } = invoiceItems(invoice.lineItems);
  const paid = invoice.status.trim().toLowerCase() === "paid";
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  fontBytes ??= Promise.all(["DejaVuSans.ttf", "DejaVuSans-Bold.ttf"].map(file => readFile(path.join(process.cwd(), "src/assets/invoice-fonts", file))));
  const [regular, bold] = await Promise.all((await fontBytes).map(bytes => pdf.embedFont(bytes, { subset: true })));
  pdf.setTitle(`Invoice ${invoice.invoiceNumber}`); pdf.setAuthor("GY Virtual Support Team");
  const black = rgb(0, 0, 0), white = rgb(1, 1, 1), blue = rgb(0.294, 0.525, 0.91), navy = rgb(0.125, 0.278, 0.502);
  const left = 32, width = 531, split = 319, bottom = 36;
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
  const text = (value: string, x: number, top: number, size = 10, font = regular, color = black) => {
    page.drawText(printable(value), { x, y: top - size, size, font, color });
  };
  const rect = (x: number, top: number, w: number, h: number, color = white) => page.drawRectangle({ x, y: top - h, width: w, height: h, color, borderColor: black, borderWidth: 0.6 });
  const row = (label: string, value: string, color = white, strong = false, alignLeft = false) => {
    const font = strong ? bold : regular;
    const labelLines = wrap(label, font, 10, split - 16), valueLines = wrap(value, font, 10, width - split - 16);
    const height = Math.max(labelLines.length, valueLines.length) * 14 + 12;
    rect(left, y, split, height, color); rect(left + split, y, width - split, height, color);
    labelLines.forEach((line, i) => text(line, alignLeft ? left + 8 : left + split - 8 - font.widthOfTextAtSize(line, 10), y - 6 - 14 * i, 10, font, color === navy ? white : black));
    valueLines.forEach((line, i) => text(line, left + split + (width - split - font.widthOfTextAtSize(line, 10)) / 2, y - 6 - 14 * i, 10, font, color === navy ? white : black));
    y -= height;
  };
  const heading = () => {
    rect(left, y, split, 28, black); rect(left + split, y, width - split, 28, black);
    text("Description", left + 8, y - 7, 11, bold, white); text("TOTAL", left + split + 75, y - 7, 11, bold, white); y -= 28;
  };
  const newPage = (continued = false) => {
    page = pdf.addPage([595, 842]); y = 810;
    if (continued) { text(`INVOICE ${invoice.invoiceNumber} (continued)`, left, y, 12, bold); y -= 28; heading(); }
  };
  newPage();
  rect(left, y, split, 55, black); rect(left + split, y, width - split, 55);
  text("INVOICE", left + 8, y - 8, 29, bold, white);
  // Long totals shrink to fit the amount column.
  const amountSize = Math.min(27, (width - split - 16) / bold.widthOfTextAtSize(amount, 1));
  text(amount, left + split + (width - split - bold.widthOfTextAtSize(amount, amountSize)) / 2, y - 10, amountSize, bold); y -= 55;
  for (const [label, value] of [["INVOICE NUMBER", invoice.invoiceNumber], ["BILL TO", invoice.billToName || "—"], ["COMPANY", invoice.billToCompany || "—"]]) {
    const lines = wrap(value, bold, 10, width - split - 16), height = lines.length * 14 + 8;
    rect(left, y, split, height, black); rect(left + split, y, width - split, height);
    text(label, left + 8, y - 4, 10, bold, white); lines.forEach((line, i) => text(line, left + split + 8, y - 4 - i * 14, 10, bold)); y -= height;
  }
  y -= 14;
  for (const value of [`Billing Period: ${invoice.billCoverage}`, `Payment Due Date: ${invoice.invoiceDueDate}`, `Status: ${invoice.status}`]) {
    for (const line of wrap(value, regular, 10, width - 16)) { text(line, left + 8, y); y -= 14; }
  }
  y -= 10; heading();
  for (const item of items) {
    const lines = [...wrap(item.title, bold, 11, split - 16).map(value => ({ value, font: bold, size: 11 })),
      ...(item.description ? wrap(item.description, regular, 10, split - 16).map(value => ({ value, font: regular, size: 10 })) : [])];
    let offset = 0;
    while (offset < lines.length) {
      if (y - bottom < 50) newPage(true);
      const count = Math.min(lines.length - offset, Math.floor((y - bottom - 16) / 15));
      const height = Math.max(58, count * 15 + 16);
      rect(left, y, split, height); rect(left + split, y, width - split, height);
      lines.slice(offset, offset + count).forEach((line, i) => text(line.value, left + 8, y - 8 - i * 15, line.size, line.font));
      if (offset === 0) {
        const value = invoiceMoney(invoiceAmountCents(item.amount));
        text(value, left + split + (width - split - regular.widthOfTextAtSize(value, 11)) / 2, y - height / 2 + 6, 11);
      }
      offset += count; y -= height;
      if (offset < lines.length) newPage(true);
    }
  }
  if (y < bottom + 100) newPage(true);
  row("**Nothing follows**", "", white, false, true); row("TOTAL", amount, blue); row("GRAND TOTAL", amount, navy, true);
  y -= 24;
  let paymentLink = "";
  try { paymentLink = invoicePaymentLink(invoice.paymentLink || ""); } catch { /* Omit unsafe stored links. */ }
  const footer = [
    ...(paid ? ["Thank you for your payment.", ""] : paymentLink ? ["To pay your invoice, kindly click the link below:", paymentLink, ""] : []),
    `If you have any questions or concerns about this invoice, please email ${INVOICE_SUPPORT_EMAIL}.`,
    ...(!paid ? ["Please pay before the scheduled due date to avoid interruption of VA workloads."] : []), "", "Thank you for your business!",
  ];
  for (const paragraph of footer) {
    for (const line of wrap(paragraph, regular, 10, width - 16)) {
      if (y < bottom + 15) { newPage(); text(`INVOICE ${invoice.invoiceNumber}`, left, y, 12, bold); y -= 32; }
      const linked = paragraph === paymentLink;
      text(line, left + 8, y, 10, regular, linked ? rgb(0, 0.25, 0.9) : black);
      if (linked && line) {
        const annotation = pdf.context.obj({ Type: "Annot", Subtype: "Link", Rect: [left + 8, y - 13, left + 8 + regular.widthOfTextAtSize(line, 10), y + 1],
          Border: [0, 0, 0], A: { Type: "Action", S: PDFName.of("URI"), URI: PDFString.of(paymentLink) } });
        page.node.addAnnot(pdf.context.register(annotation));
      }
      y -= 15;
    }
  }
  const pages = pdf.getPages();
  pages.forEach((p, index) => p.drawText(`${index + 1} / ${pages.length}`, { x: 535, y: 18, size: 8, font: regular, color: black }));
  return pdf.save();
}
