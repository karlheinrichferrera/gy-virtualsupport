"use client";

import { useState } from "react";
import { Download } from "lucide-react";

export default function ClientInvoiceDownloadButton({ id, invoiceNumber, compact = false }: { id: number; invoiceNumber: string; compact?: boolean }) {
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  async function download() {
    if (busy) return;
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/client-invoices/${id}/pdf`, { credentials: "same-origin", cache: "no-store" });
      if (response.status === 401) throw new Error("Please sign in again to download your invoice.");
      if (!response.ok || !response.headers.get("content-type")?.startsWith("application/pdf")) throw new Error("The invoice PDF could not be downloaded. Please try again.");
      const blob = await response.blob(), url = URL.createObjectURL(blob), link = document.createElement("a");
      link.href = url; link.download = `${invoiceNumber.replace(/[^a-zA-Z0-9._-]/g, "-").slice(0, 100) || id}.pdf`;
      document.body.append(link); link.click(); link.remove(); window.setTimeout(() => URL.revokeObjectURL(url), 5000);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "The invoice PDF could not be downloaded."); }
    finally { setBusy(false); }
  }
  return <span className="inline-flex min-w-0 flex-col items-start gap-1">
    <button type="button" disabled={busy} onClick={() => { void download(); }} aria-label={compact ? `Download invoice ${invoiceNumber}` : undefined}
      className={compact ? "inline-flex min-h-10 items-center gap-1.5 whitespace-nowrap rounded-lg px-2 text-primary hover:bg-background disabled:opacity-50" : "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-50"}>
      <Download size={16} aria-hidden="true" />{busy ? "Downloading…" : compact ? "PDF" : "Download PDF"}
    </button>
    {error && <span role="alert" className="max-w-60 whitespace-normal text-xs text-red-600">{error}</span>}
  </span>;
}
