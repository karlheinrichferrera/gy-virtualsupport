"use client";

import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { ExternalLink, FileText, X } from "lucide-react";
import type { ClientAccount, ClientInvoice } from "@/lib/actions";
import { clientInvoiceFileUrl } from "@/lib/invoice-links";

interface ClientInvoicePreviewProps {
  invoice: ClientInvoice;
  client?: Pick<ClientAccount, "displayName" | "companyName" | "address" | "email"> | null;
  onClose: () => void;
}

export default function ClientInvoicePreview({ invoice, client, onClose }: ClientInvoicePreviewProps) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const fileUrl = clientInvoiceFileUrl(invoice.invoiceLink || "");
  const billTo = client?.companyName || client?.displayName || `Client #${invoice.clientId}`;
  const statusClass = invoice.status === "Paid" ? "bg-emerald-100 text-emerald-700"
    : invoice.status === "Pending" ? "bg-amber-100 text-amber-700"
    : invoice.status === "Overdue" ? "bg-red-100 text-red-700"
    : "bg-slate-100 text-slate-600";

  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const bodyStyle = document.body.style;
    const previousOverflow = bodyStyle.getPropertyValue("overflow");
    const previousOverflowPriority = bodyStyle.getPropertyPriority("overflow");
    bodyStyle.setProperty("overflow", "hidden");
    closeRef.current?.focus({ preventScroll: true });

    const focusableElements = () => Array.from(
      dialogRef.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ) || [],
    ).filter(element => element.getClientRects().length > 0);

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      } else if (event.key === "Tab") {
        const elements = focusableElements();
        const first = elements[0];
        const last = elements[elements.length - 1];
        if (!first || !last) {
          event.preventDefault();
          dialogRef.current?.focus();
          return;
        }
        if (event.shiftKey && (document.activeElement === first || !dialogRef.current?.contains(document.activeElement))) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && (document.activeElement === last || !dialogRef.current?.contains(document.activeElement))) {
          event.preventDefault();
          first.focus();
        }
      }
    };

    const keepFocusInDialog = (event: FocusEvent) => {
      if (!dialogRef.current?.contains(event.target as Node)) closeRef.current?.focus({ preventScroll: true });
    };

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("focusin", keepFocusInDialog);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("focusin", keepFocusInDialog);
      if (bodyStyle.getPropertyValue("overflow") === "hidden") {
        if (previousOverflow) bodyStyle.setProperty("overflow", previousOverflow, previousOverflowPriority);
        else bodyStyle.removeProperty("overflow");
      }
      if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
    };
  }, [onClose]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center overflow-y-auto bg-black/50 p-3 sm:p-6"
      onClick={event => { if (event.target === event.currentTarget) onClose(); }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="flex max-h-[calc(100dvh-1.5rem)] w-full min-w-0 max-w-2xl flex-col overflow-hidden rounded-2xl border border-border bg-card text-foreground shadow-2xl outline-none sm:max-h-[calc(100dvh-3rem)]"
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-4 py-3 sm:px-6 sm:py-4">
          <h2 id={titleId} className="flex min-w-0 items-center gap-2 text-lg font-semibold sm:text-xl">
            <FileText size={22} aria-hidden="true" className="shrink-0 text-primary" />
            Client Invoice
          </h2>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close invoice"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-muted hover:bg-background hover:text-foreground focus-visible:outline-2 focus-visible:outline-primary"
          >
            <X size={22} aria-hidden="true" />
          </button>
        </div>

        <div className="min-h-0 overflow-y-auto overscroll-contain p-4 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border pb-5">
            <div className="min-w-0 [overflow-wrap:anywhere]">
              <p className="text-xs font-medium uppercase tracking-wide text-muted">From</p>
              <p className="mt-1 text-lg font-bold text-primary">GY Virtual Support</p>
            </div>
            <div className="min-w-0 [overflow-wrap:anywhere] sm:text-right">
              <p className="text-sm text-muted">Invoice number</p>
              <p className="mt-1 font-mono font-semibold">{invoice.invoiceNumber || "—"}</p>
              <span className={`mt-2 inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${statusClass}`}>
                {invoice.status || "—"}
              </span>
            </div>
          </div>

          <section aria-label="Bill to" className="border-b border-border py-5 [overflow-wrap:anywhere]">
            <h3 className="text-xs font-medium uppercase tracking-wide text-muted">Bill to</h3>
            <p className="mt-2 font-semibold">{billTo}</p>
            {client?.companyName && client?.displayName && <p className="mt-1 text-sm">{client.displayName}</p>}
            {client?.email && <p className="mt-1 text-sm">{client.email}</p>}
            {client?.address && <p className="mt-1 whitespace-pre-line text-sm">{client.address}</p>}
          </section>

          <dl className="grid grid-cols-1 gap-4 border-b border-border py-5 sm:grid-cols-2">
            <div className="min-w-0 [overflow-wrap:anywhere]">
              <dt className="text-sm text-muted">Bill coverage</dt>
              <dd className="mt-1 font-medium">{invoice.billCoverage || "—"}</dd>
            </div>
            <div className="min-w-0 [overflow-wrap:anywhere] sm:text-right">
              <dt className="text-sm text-muted">Due date</dt>
              <dd className="mt-1 font-medium">{invoice.invoiceDueDate || "—"}</dd>
            </div>
          </dl>

          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-background p-4">
            <p className="font-semibold">Total amount</p>
            <p className="min-w-0 text-2xl font-bold text-primary [overflow-wrap:anywhere]">{invoice.amount || "—"}</p>
          </div>

          {!fileUrl && (
            <p className="mt-4 text-sm text-muted">
              No invoice file is attached. The invoice details are shown above.
            </p>
          )}
        </div>

        <div className="flex shrink-0 flex-wrap justify-end gap-2 border-t border-border px-4 py-3 sm:px-6 sm:py-4">
          {fileUrl && (
            <a
              href={fileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              <ExternalLink size={16} aria-hidden="true" />
              Open invoice file
              <span className="sr-only"> (opens in a new tab)</span>
            </a>
          )}
          <button
            type="button"
            onClick={onClose}
            className="min-h-11 rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-background focus-visible:outline-2 focus-visible:outline-primary"
          >
            Close
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
