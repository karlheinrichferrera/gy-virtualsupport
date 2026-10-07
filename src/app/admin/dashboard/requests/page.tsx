"use client";

import { useState, useEffect } from "react";
import * as store from "@/lib/store";
import type { LeaveRequest } from "@/lib/data";
import StatusBadge from "@/components/StatusBadge";
import { CalendarDays, Check, X, MessageSquare, Trash2, AlertTriangle } from "lucide-react";

export default function AdminRequestsPage() {
  const [allRequests, setAllRequests] = useState<{ vaId: string; vaName: string; request: LeaveRequest }[]>([]);
  const [filterStatus, setFilterStatus] = useState<string>("All");
  const [remarkModal, setRemarkModal] = useState<string | null>(null);
  const [remarkText, setRemarkText] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  useEffect(() => {
    setAllRequests(store.getAllRequestsFlat());
  }, []);

  function handleUpdateStatus(id: string, status: "Pending" | "Approved" | "Denied", remarks?: string) {
    store.updateRequestStatus(id, status, remarks);
    setAllRequests(store.getAllRequestsFlat());
  }

  function handleAddRemark(id: string) {
    store.updateRequestRemarks(id, remarkText);
    setAllRequests(store.getAllRequestsFlat());
    setRemarkModal(null);
    setRemarkText("");
  }

  function handleDelete(id: string) {
    store.deleteRequest(id);
    setAllRequests(store.getAllRequestsFlat());
    setDeleteTarget(null);
  }

  const filtered = filterStatus === "All"
    ? allRequests
    : allRequests.filter((r) => r.request.status === filterStatus);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Leave & Request Management</h1>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-card rounded-xl border border-border p-4">
          <p className="text-sm text-muted">Total Requests</p>
          <p className="text-2xl font-bold text-foreground">{allRequests.length}</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4">
          <p className="text-sm text-amber-600">Pending</p>
          <p className="text-2xl font-bold text-amber-600">
            {allRequests.filter((r) => r.request.status === "Pending").length}
          </p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4">
          <p className="text-sm text-emerald-600">Approved</p>
          <p className="text-2xl font-bold text-emerald-600">
            {allRequests.filter((r) => r.request.status === "Approved").length}
          </p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4">
          <p className="text-sm text-red-600">Denied</p>
          <p className="text-2xl font-bold text-red-600">
            {allRequests.filter((r) => r.request.status === "Denied").length}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {["All", "Pending", "Approved", "Denied"].map((status) => (
          <button
            key={status}
            onClick={() => setFilterStatus(status)}
            className={`px-3 py-1.5 text-sm rounded-lg font-medium transition-colors ${
              filterStatus === status
                ? "bg-indigo-600 text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            {status}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="bg-card rounded-xl border border-border p-12 text-center">
          <CalendarDays size={48} className="text-muted mx-auto mb-4" />
          <p className="text-lg font-medium text-foreground">No requests found</p>
        </div>
      ) : (
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-border">
                  <th className="text-left px-6 py-3 font-semibold text-slate-600">ID</th>
                  <th className="text-left px-6 py-3 font-semibold text-slate-600">VA</th>
                  <th className="text-left px-6 py-3 font-semibold text-slate-600">Type</th>
                  <th className="text-left px-6 py-3 font-semibold text-slate-600">Submitted</th>
                  <th className="text-left px-6 py-3 font-semibold text-slate-600">Period</th>
                  <th className="text-left px-6 py-3 font-semibold text-slate-600">Reason</th>
                  <th className="text-center px-6 py-3 font-semibold text-slate-600">Status</th>
                  <th className="text-left px-6 py-3 font-semibold text-slate-600">Remarks</th>
                  <th className="text-center px-6 py-3 font-semibold text-slate-600">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((item) => (
                  <tr key={item.request.id} className="border-b border-border hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4 font-medium text-foreground">{item.request.id}</td>
                    <td className="px-6 py-4">
                      <p className="font-medium text-foreground">{item.vaName}</p>
                      <p className="text-xs text-muted">ID: {item.vaId}</p>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                        item.request.type === "Leave" ? "bg-purple-100 text-purple-700" : "bg-blue-100 text-blue-700"
                      }`}>
                        {item.request.type}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-foreground">{item.request.dateSubmitted}</td>
                    <td className="px-6 py-4 text-foreground whitespace-nowrap">
                      {item.request.dateFrom}
                      {item.request.dateFrom !== item.request.dateTo && ` to ${item.request.dateTo}`}
                    </td>
                    <td className="px-6 py-4 text-foreground max-w-xs truncate">{item.request.reason}</td>
                    <td className="px-6 py-4 text-center">
                      <StatusBadge status={item.request.status} />
                    </td>
                    <td className="px-6 py-4 text-muted">
                      <div className="flex items-center gap-1">
                        <span className="truncate max-w-[120px]">{item.request.remarks || "—"}</span>
                        <button
                          onClick={() => { setRemarkModal(item.request.id); setRemarkText(item.request.remarks); }}
                          className="p-1 hover:bg-slate-100 rounded"
                          title="Edit remarks"
                        >
                          <MessageSquare size={14} className="text-slate-400" />
                        </button>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      {item.request.status === "Pending" ? (
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => handleUpdateStatus(item.request.id, "Approved", "Approved by admin")}
                            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 rounded-lg hover:bg-emerald-100 transition-colors"
                          >
                            <Check size={14} />
                            Approve
                          </button>
                          <button
                            onClick={() => handleUpdateStatus(item.request.id, "Denied", "Denied by admin")}
                            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-red-700 bg-red-50 rounded-lg hover:bg-red-100 transition-colors"
                          >
                            <X size={14} />
                            Deny
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => handleUpdateStatus(item.request.id, "Pending", "")}
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-amber-700 bg-amber-50 rounded-lg hover:bg-amber-100 transition-colors"
                        >
                          Revert
                        </button>
                      )}
                      <button
                        onClick={() => setDeleteTarget(item.request.id)}
                        className="inline-flex items-center gap-1 px-2 py-1.5 text-xs font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition-colors ml-1"
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {remarkModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h2 className="text-lg font-bold text-slate-900">Edit Remarks</h2>
              <button onClick={() => setRemarkModal(null)} className="p-1 hover:bg-slate-100 rounded-lg">
                <X size={20} className="text-slate-500" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <textarea
                value={remarkText}
                onChange={(e) => setRemarkText(e.target.value)}
                rows={3}
                className="w-full px-4 py-2.5 rounded-lg border border-slate-300 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
                placeholder="Add remarks..."
              />
              <div className="flex gap-3">
                <button
                  onClick={() => setRemarkModal(null)}
                  className="flex-1 border border-slate-300 text-slate-700 font-medium py-2 rounded-lg hover:bg-slate-50 transition-colors text-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleAddRemark(remarkModal)}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2 rounded-lg transition-colors text-sm"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
            <div className="p-6 text-center space-y-4">
              <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mx-auto">
                <AlertTriangle className="text-red-600" size={28} />
              </div>
              <h3 className="text-lg font-bold text-slate-900">Delete Request</h3>
              <p className="text-sm text-slate-600">
                Are you sure you want to delete request <strong>{deleteTarget}</strong>? This action cannot be undone.
              </p>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setDeleteTarget(null)} className="flex-1 border border-slate-300 text-slate-700 font-medium py-2.5 rounded-lg hover:bg-slate-50 transition-colors text-sm">
                  Cancel
                </button>
                <button
                  onClick={() => handleDelete(deleteTarget)}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white font-medium py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2 text-sm"
                >
                  <Trash2 size={16} />
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
