"use client";

import { useState, useEffect } from "react";
import * as actions from "@/lib/actions";
import type { LeaveRequest } from "@/lib/data";
import StatusBadge from "@/components/StatusBadge";
import { CalendarDays, Check, X, MessageSquare, Eye } from "lucide-react";

export default function ClientRequestsPage() {
  const [allRequests, setAllRequests] = useState<{ vaId: string; vaName: string; request: LeaveRequest }[]>([]);
  const [filterStatus, setFilterStatus] = useState<string>("All");
  const [remarkModal, setRemarkModal] = useState<string | null>(null);
  const [remarkText, setRemarkText] = useState("");
  const [viewing, setViewing] = useState<{ vaId: string; vaName: string; request: LeaveRequest } | null>(null);

  useEffect(() => {
    (async () => {
      setAllRequests(await actions.getAllRequestsFlat());
    })();
  }, []);

  async function handleUpdateStatus(id: string, status: "Pending" | "Approved" | "Denied", remarks?: string) {
    await actions.updateRequestStatus(id, status, remarks);
    setAllRequests(await actions.getAllRequestsFlat());
  }

  async function handleAddRemark(id: string) {
    await actions.updateRequestRemarks(id, remarkText);
    setAllRequests(await actions.getAllRequestsFlat());
    setRemarkModal(null);
    setRemarkText("");
  }

  const filtered = filterStatus === "All"
    ? allRequests
    : allRequests.filter((r) => r.request.status === filterStatus);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <CalendarDays size={24} />
          Leave & Shift Adjustment Requests
        </h1>
      </div>

      <div className="flex gap-2">
        {["All", "Pending", "Approved", "Denied"].map((s) => (
          <button
            key={s}
            onClick={() => setFilterStatus(s)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              filterStatus === s ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            {s}
            {s !== "All" && (
              <span className="ml-1.5 text-xs">
                ({allRequests.filter((r) => r.request.status === s).length})
              </span>
            )}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="bg-card rounded-xl border border-border p-8 text-center">
          <CalendarDays size={48} className="mx-auto text-slate-300 mb-4" />
          <p className="text-slate-500">No requests found.</p>
        </div>
      ) : (
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-border">
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">ID</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">VA</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Type</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Date</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Status</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((item) => (
                  <tr key={item.request.id} className="border-b border-border hover:bg-slate-50/50">
                    <td className="px-4 py-3 font-mono text-foreground">{item.request.id}</td>
                    <td className="px-4 py-3 text-foreground">{item.vaName}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                        item.request.type === "Leave" ? "bg-blue-100 text-blue-700" : "bg-purple-100 text-purple-700"
                      }`}>
                        {item.request.type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-foreground text-xs">
                      {item.request.dateFrom}{item.request.dateFrom !== item.request.dateTo ? ` - ${item.request.dateTo}` : ""}
                    </td>
                    <td className="px-4 py-3"><StatusBadge status={item.request.status} /></td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button onClick={() => setViewing(item)} className="p-1.5 hover:bg-slate-100 rounded-lg" title="View"><Eye size={14} className="text-slate-500" /></button>
                        {item.request.status === "Pending" && (
                          <>
                            <button onClick={() => handleUpdateStatus(item.request.id, "Approved")} className="p-1.5 hover:bg-emerald-50 rounded-lg" title="Approve">
                              <Check size={14} className="text-emerald-600" />
                            </button>
                            <button onClick={() => handleUpdateStatus(item.request.id, "Denied")} className="p-1.5 hover:bg-red-50 rounded-lg" title="Deny">
                              <X size={14} className="text-red-600" />
                            </button>
                          </>
                        )}
                        <button onClick={() => { setRemarkModal(item.request.id); setRemarkText(item.request.remarks); }} className="p-1.5 hover:bg-blue-50 rounded-lg" title="Add Remark">
                          <MessageSquare size={14} className="text-blue-600" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {viewing && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h2 className="text-lg font-bold text-slate-900">Request Details</h2>
              <button onClick={() => setViewing(null)} className="p-1 hover:bg-slate-100 rounded-lg"><X size={20} className="text-slate-500" /></button>
            </div>
            <div className="p-6 space-y-3 text-sm">
              <div><span className="text-slate-500">VA:</span> <span className="font-medium text-slate-900">{viewing.vaName} ({viewing.vaId})</span></div>
              <div><span className="text-slate-500">Type:</span> <span className="font-medium text-slate-900">{viewing.request.type}</span></div>
              <div><span className="text-slate-500">Submitted:</span> <span className="font-medium text-slate-900">{viewing.request.dateSubmitted}</span></div>
              <div><span className="text-slate-500">From:</span> <span className="font-medium text-slate-900">{viewing.request.dateFrom}</span></div>
              <div><span className="text-slate-500">To:</span> <span className="font-medium text-slate-900">{viewing.request.dateTo}</span></div>
              <div><span className="text-slate-500">Reason:</span> <span className="font-medium text-slate-900">{viewing.request.reason}</span></div>
              <div><span className="text-slate-500">Status:</span> <StatusBadge status={viewing.request.status} /></div>
              <div><span className="text-slate-500">Remarks:</span> <span className="font-medium text-slate-900">{viewing.request.remarks || "None"}</span></div>
            </div>
          </div>
        </div>
      )}

      {remarkModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h2 className="text-lg font-bold text-slate-900">Add Remark</h2>
              <button onClick={() => setRemarkModal(null)} className="p-1 hover:bg-slate-100 rounded-lg"><X size={20} className="text-slate-500" /></button>
            </div>
            <div className="p-6 space-y-4">
              <textarea
                value={remarkText}
                onChange={(e) => setRemarkText(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
                rows={3}
                placeholder="Enter remarks..."
              />
              <div className="flex gap-3">
                <button onClick={() => setRemarkModal(null)} className="flex-1 border border-slate-300 text-slate-700 font-medium py-2 rounded-lg hover:bg-slate-50">Cancel</button>
                <button onClick={() => handleAddRemark(remarkModal)} className="flex-1 bg-emerald-600 text-white font-medium py-2 rounded-lg hover:bg-emerald-700">Save</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
