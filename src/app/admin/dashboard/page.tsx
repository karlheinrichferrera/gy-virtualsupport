"use client";

import { useEffect, useState } from "react";
import * as actions from "@/lib/actions";
import type { VAProfile, SalaryAdjustment } from "@/lib/data";
import type { ClientSalaryAdjustment, TimeproofEntry, ClientAccount, ClientInvoice } from "@/lib/actions";
import { Users, FileText, CalendarDays, DollarSign, Clock, Download, Wifi } from "lucide-react";
import Link from "next/link";
import * as XLSX from "xlsx";

export default function AdminDashboardPage() {
  const [vaProfiles, setVaProfiles] = useState<VAProfile[]>([]);
  const [allInvoices, setAllInvoices] = useState<{ vaId: string; vaName: string; clientName: string; invoice: { invoiceNumber: string; clientId: number; dateCovered: string; amount: string; transactionFee: string; amountDisbursed: string; status: string } }[]>([]);
  const [allRequests, setAllRequests] = useState<{ vaId: string; vaName: string; request: { id: string; type: string; dateSubmitted: string; dateFrom: string; dateTo: string; reason: string; status: string; remarks: string } }[]>([]);
  const [allAdjustments, setAllAdjustments] = useState<Record<string, (SalaryAdjustment & { id: number })[]>>({});
  const [clientAdjustments, setClientAdjustments] = useState<ClientSalaryAdjustment[]>([]);
  const [allTimeproof, setAllTimeproof] = useState<(TimeproofEntry & { vaName: string; clientName: string })[]>([]);
  const [clients, setClients] = useState<ClientAccount[]>([]);
  const [clientInvoices, setClientInvoices] = useState<ClientInvoice[]>([]);
  const [onlineVAs, setOnlineVAs] = useState<{ id: string; firstName: string; lastName: string; position: string; lastActive: string }[]>([]);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    (async () => {
      const [profiles, invoices, requests, adj, cAdj, tp, cl, ci] = await Promise.all([
        actions.getProfiles(),
        actions.getAllInvoicesFlat(),
        actions.getAllRequestsFlat(),
        actions.getAllAdjustments(),
        actions.getClientSalaryAdjustments(),
        actions.getAllTimeproofEntries(),
        actions.getClientAccounts(),
        actions.getClientInvoices(),
      ]);
      setVaProfiles(profiles);
      setAllInvoices(invoices);
      setAllRequests(requests);
      setAllAdjustments(adj);
      setClientAdjustments(cAdj);
      setAllTimeproof(tp);
      setClients(cl);
      setClientInvoices(ci);
    })();
    (async () => {
      const online = await actions.getOnlineVAs();
      setOnlineVAs(online);
    })();
    const interval = setInterval(async () => {
      const online = await actions.getOnlineVAs();
      setOnlineVAs(online);
    }, 30_000);
    return () => clearInterval(interval);
  }, []);

  function downloadAllData() {
    setDownloading(true);
    try {
      const wb = XLSX.utils.book_new();

      const vaRows = vaProfiles.map((v) => ({
        "VA ID": v.id, "First Name": v.firstName, "Middle Name": v.middleName || "", "Last Name": v.lastName,
        "Suffix": v.suffix || "", "Phone": v.phone || "", "Alt Phone": v.altPhone || "", "Email": v.email || "",
        "Date of Birth": v.dateOfBirth || "", "Position": v.position || "", "Employment Status": v.employmentStatus || "",
        "Date Hired": v.dateHired || "", "Current Rate": v.currentRate || "", "Contractor ID": v.contractorId || "",
        "Payout Mode": v.payoutMode || "", "PayPal Link": v.paypalLink || "",
        "E-Wallet Name": v.ewalletName || "", "E-Wallet Number": v.ewalletNumber || "",
        "Bank Name": v.bankName || "", "Bank Account Number": v.bankAccountNumber || "",
        "Bank Account Name": v.bankAccountName || "",
        "Emergency Contact": v.emergencyContact || "", "Emergency Phone": v.emergencyPhone || "",
      }));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(vaRows), "VA Master File");

      const reqRows = allRequests.map((r) => ({
        "Request ID": r.request.id, "VA ID": r.vaId, "VA Name": r.vaName,
        "Type": r.request.type, "Date Submitted": r.request.dateSubmitted || "",
        "Date From": r.request.dateFrom || "", "Date To": r.request.dateTo || "",
        "Reason": r.request.reason || "", "Status": r.request.status || "", "Remarks": r.request.remarks || "",
      }));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(reqRows), "Leave & Shift Requests");

      const tpRows = allTimeproof.map((t) => ({
        "ID": t.id, "VA ID": t.vaId, "VA Name": t.vaName, "Client": t.clientName,
        "Type": t.entryType === "absence" ? "Absent" : t.entryType === "leave" ? "On Leave" : "Worked",
        "Date": t.punchDate, "Time In": t.timeIn || "", "Time Out": t.timeOut || "",
        "Notes": t.notes || "", "Created At": t.createdAt || "",
      }));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(tpRows), "Timeproof");

      const adjRows: Record<string, string>[] = [];
      const vaNameMap: Record<string, string> = {};
      for (const v of vaProfiles) vaNameMap[v.id] = `${v.firstName} ${v.lastName}`;
      for (const [vaId, adjs] of Object.entries(allAdjustments)) {
        for (const a of adjs) {
          adjRows.push({
            "ID": String(a.id), "VA ID": vaId, "VA Name": vaNameMap[vaId] || vaId,
            "Effectivity Date": a.effectivityDate || "", "Type": a.type || "",
            "Hourly Rate": a.hourlyRate || "", "Sales Commission": a.salesCommission || "",
            "Referral Bonus": a.referralBonus || "", "Notes": a.notes || "",
          });
        }
      }
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(adjRows), "VA Salary Adjustments");

      const clientNameMap: Record<number, string> = {};
      for (const c of clients) clientNameMap[c.id] = c.displayName;
      const csaRows = clientAdjustments.map((a) => ({
        "ID": a.id, "Client": clientNameMap[a.clientId] || String(a.clientId),
        "VA ID": a.vaId, "VA Name": vaNameMap[a.vaId] || a.vaId,
        "Effectivity Date": a.effectivityDate || "", "Type": a.type || "",
        "Hourly Rate": a.hourlyRate || "", "Sales Commission": a.salesCommission || "",
        "Referral Bonus": a.referralBonus || "", "Notes": a.notes || "",
      }));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(csaRows), "Client Salary Adj");

      const invRows = allInvoices.map((i) => ({
        "Invoice Number": i.invoice.invoiceNumber, "VA ID": i.vaId, "VA Name": i.vaName,
        "Client": i.clientName || "", "Date Covered": i.invoice.dateCovered || "",
        "Amount": i.invoice.amount || "", "Transaction Fee": i.invoice.transactionFee || "",
        "Amount Disbursed": i.invoice.amountDisbursed || "", "Status": i.invoice.status || "",
      }));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(invRows), "VA Invoices");

      const ciRows = clientInvoices.map((ci) => ({
        "ID": ci.id, "Client": clientNameMap[ci.clientId] || String(ci.clientId),
        "Invoice Number": ci.invoiceNumber || "", "Bill Coverage": ci.billCoverage || "",
        "Amount": ci.amount || "", "Invoice Due Date": ci.invoiceDueDate || "",
        "Status": ci.status || "", "Invoice Link": ci.invoiceLink || "",
      }));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(ciRows), "Client Invoices");

      const clRows = clients.map((c) => ({
        "Client ID": c.id, "Email": c.email, "Display Name": c.displayName,
        "Company Name": c.companyName || "", "Address": c.address || "",
        "Phone": c.phone || "", "Created At": c.createdAt || "",
      }));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(clRows), "Clients");

      XLSX.writeFile(wb, `GY_VirtualSupport_AllData_${new Date().toISOString().slice(0, 10)}.xlsx`);
    } finally {
      setDownloading(false);
    }
  }

  const pendingInvoices = allInvoices.filter((i) => i.invoice.status === "Pending");
  const pendingRequests = allRequests.filter((r) => r.request.status === "Pending");

  const totalPaid = allInvoices
    .filter((i) => i.invoice.status === "Paid")
    .reduce((sum, i) => sum + parseFloat(i.invoice.amountDisbursed.replace("$", "") || "0"), 0);

  const stats = [
    { label: "Active VAs", value: vaProfiles.length, icon: Users, color: "bg-blue-100 text-blue-700", href: "/admin/dashboard/vas" },
    { label: "Total Invoices", value: allInvoices.length, icon: FileText, color: "bg-emerald-100 text-emerald-700", href: "/admin/dashboard/invoices" },
    { label: "Pending Invoices", value: pendingInvoices.length, icon: Clock, color: "bg-amber-100 text-amber-700", href: "/admin/dashboard/invoices" },
    { label: "Pending Requests", value: pendingRequests.length, icon: CalendarDays, color: "bg-rose-100 text-rose-700", href: "/admin/dashboard/requests" },
    { label: "Total Disbursed", value: `$${totalPaid.toFixed(2)}`, icon: DollarSign, color: "bg-teal-100 text-teal-700", href: "/admin/dashboard/invoices" },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-foreground">Overview</h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Link
              key={stat.label}
              href={stat.href}
              className="bg-card rounded-xl border border-border p-5 hover:shadow-md transition-shadow"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted">{stat.label}</p>
                  <p className="text-2xl font-bold text-foreground mt-1">{stat.value}</p>
                </div>
                <div className={`w-12 h-12 rounded-xl ${stat.color} flex items-center justify-center`}>
                  <Icon size={22} />
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      <div className="bg-card rounded-xl border border-border p-5">
        <div className="flex items-center gap-2 mb-4">
          <Wifi size={20} className="text-emerald-500" />
          <h2 className="text-lg font-semibold text-foreground">Online Now</h2>
          <span className="ml-auto text-xs text-muted">Auto-refreshes every 30s</span>
        </div>
        {onlineVAs.length === 0 ? (
          <p className="text-sm text-muted">No VAs currently online</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {onlineVAs.map((va) => (
              <div key={va.id} className="flex items-center gap-3 p-3 bg-emerald-50 rounded-lg border border-emerald-200">
                <div className="relative">
                  <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-sm font-bold">
                    {va.firstName.charAt(0)}
                  </div>
                  <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-emerald-500 rounded-full border-2 border-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{va.firstName} {va.lastName}</p>
                  <p className="text-xs text-muted truncate">{va.position || "VA"} &middot; {va.id}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-card rounded-xl border border-border p-5 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Download All Data</h2>
          <p className="text-sm text-muted mt-1">Export all portal data as a single XLSX workbook with multiple sheets</p>
        </div>
        <button
          onClick={downloadAllData}
          disabled={downloading || vaProfiles.length === 0}
          className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
        >
          <Download size={18} />
          {downloading ? "Preparing..." : "Download XLSX"}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-card rounded-xl border border-border p-5">
          <h2 className="text-lg font-semibold text-foreground mb-4">Recent Pending Requests</h2>
          {pendingRequests.length === 0 ? (
            <p className="text-sm text-muted">No pending requests</p>
          ) : (
            <div className="space-y-3">
              {pendingRequests.slice(0, 5).map((r) => (
                <div key={r.request.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                  <div>
                    <p className="text-sm font-medium text-foreground">{r.vaName}</p>
                    <p className="text-xs text-muted">{r.request.type} - {r.request.reason.substring(0, 50)}</p>
                  </div>
                  <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">
                    Pending
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-card rounded-xl border border-border p-5">
          <h2 className="text-lg font-semibold text-foreground mb-4">VA Directory</h2>
          <div className="space-y-3">
            {vaProfiles.map((va) => (
              <div key={va.id} className="flex items-center gap-3 py-2 border-b border-border last:border-0">
                <div className="w-9 h-9 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-sm font-bold">
                  {va.firstName.charAt(0)}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground">
                    {va.firstName} {va.lastName}
                  </p>
                  <p className="text-xs text-muted">{va.position} - ID: {va.id}</p>
                </div>
                <span className="text-xs text-muted">{va.currentRate}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
