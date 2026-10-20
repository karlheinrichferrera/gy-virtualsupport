"use client";

import { Plus, Trash2 } from "lucide-react";
import { invoiceItems, type InvoiceLineItem } from "@/lib/client-invoice-format";

export default function InvoiceItemsEditor({ items, onChange, id }: { items: InvoiceLineItem[]; onChange: (items: InvoiceLineItem[]) => void; id: string }) {
  const fieldClass = "w-full min-w-0 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500";
  const update = (index: number, key: keyof InvoiceLineItem, value: string) => onChange(items.map((item, i) => i === index ? { ...item, [key]: value } : item));
  let total = "Complete each item to calculate the total";
  try { total = invoiceItems(items).amount; } catch { /* Incomplete drafts remain editable. */ }
  return <fieldset className="min-w-0 space-y-3">
    <legend className="mb-2 text-sm font-semibold text-slate-800">Invoice items (USD)</legend>
    {items.map((item, index) => <div key={index} className="min-w-0 space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
      <div className="flex items-center justify-between gap-2"><span className="text-xs font-semibold text-slate-600">Item {index + 1}</span>
        <button type="button" disabled={items.length === 1} aria-label={`Remove item ${index + 1}`} onClick={() => onChange(items.filter((_, i) => i !== index))} className="rounded p-2 text-red-600 hover:bg-red-50 disabled:opacity-30"><Trash2 size={16} /></button></div>
      <div><label htmlFor={`${id}-${index}-title`} className="mb-1 block text-xs font-medium text-slate-600">Item Title *</label>
        <input id={`${id}-${index}-title`} required maxLength={200} value={item.title} onChange={event => update(index, "title", event.target.value)} className={fieldClass} placeholder="Monthly GHL Support (August 3/3)" /></div>
      <div><label htmlFor={`${id}-${index}-description`} className="mb-1 block text-xs font-medium text-slate-600">Item Description</label>
        <textarea id={`${id}-${index}-description`} rows={4} maxLength={3000} value={item.description} onChange={event => update(index, "description", event.target.value)} className={fieldClass} placeholder={"GHL Strategy Support and Account Assistance Service\nRate: $300 USD per month\nBilling Period: August 2026"} /></div>
      <div><label htmlFor={`${id}-${index}-amount`} className="mb-1 block text-xs font-medium text-slate-600">Item Amount (USD) *</label>
        <input id={`${id}-${index}-amount`} type="number" inputMode="decimal" required min="0" max="999999999.99" step="0.01" value={item.amount} onChange={event => update(index, "amount", event.target.value)} className={fieldClass} placeholder="300.00" /></div>
    </div>)}
    <button type="button" disabled={items.length >= 50} onClick={() => onChange([...items, { title: "", description: "", amount: "" }])} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-indigo-200 px-3 py-2 text-sm font-medium text-indigo-700 hover:bg-indigo-50 disabled:opacity-50"><Plus size={16} />Add item</button>
    <div className="flex flex-wrap justify-between gap-2 rounded-lg bg-blue-50 p-3 text-sm font-semibold text-slate-900"><span>Grand total</span><output aria-live="polite">{total}</output></div>
  </fieldset>;
}
