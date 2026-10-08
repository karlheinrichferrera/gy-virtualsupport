"use client";

import { useState, useEffect } from "react";
import * as actions from "@/lib/actions";
import type { LeaveRequest } from "@/lib/data";
import StatusBadge from "@/components/StatusBadge";
import { CalendarDays, Check, X, MessageSquare, Trash2, AlertTriangle, Eye, Pencil } from "lucide-react";

export default function AdminRequestsPage() {
  const [allRequests, setAllRequests] = useState<{ vaId: string; vaName: string; request: LeaveRequest }[]>([]);
  const [filterStatus, setFilterStatus] = useState<string>("All");
  const [remarkModal, setRemarkModal] = useState<string | null>(null);
  const [remarkText, setRemarkText] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const [viewing, setViewing] = useState<{ vaId: string; vaName: string; request: LeaveRequest } | null>(null);
  const [editing, setEditing] = useState<{ vaId: string; vaName: string; request: LeaveRequest } | null>(null);
  const [editForm, setEditForm] = useState({
    type: "Leave" as "Leave" | "Shift Adjustment",
    dateFrom: "",
    dateTo: "",
    reason: "",
    status: "Pending" as "Pending" | "Approved" | "Denied",
    remarks: "",
  });
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState("");

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

  async function handleDelete(id: string) {
    await actions.deleteRequest(id);
    setAllRequests(await actions.getAllRequestsFlat());
    setDeleteTarget(null);
  }

  async function handleEditSave(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    setSaving(true);
    setEditError("");
    try {
      await actions.updateRequestDetails(editing.request.id, {
        type: editForm.type,
        dateFrom: editForm.dateFrom,
        dateTo: editForm.dateTo,
        reason: editForm.reason,
      });
      await actions.updateRequestStatus(editing.request.id, editForm.status, editForm.remarks);
      setAllRequests(await actions.getAllRequestsFlat());
      setEditing(null);
    } catch (err) {
      setEditError(err instanceof Error ? err.message : "Failed to save changes.");
    } finally {
      setSaving(false);
    }
  }

  const filtered = filterStatus === "All"
    ? allRequests
    : allRequests.filter((r) => r.request.status === filterStatus);

  const inputClass =
    "w-full px-4 py-2.5 rounded-lg border border-slate-300 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm";

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
                      <div className="flex items-center justify-center gap-1 flex-wrap">
                        <button
                          onClick={() => setViewing(item)}
                          className="inline-flex items-center gap-1 px-2 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
                          title="View details"
                        >
                          <Eye size={14} />
                        </button>
                        <button
                          onClick={() => {
                            setEditing(item);
                            setEditForm({
                              type: item.request.type,
                              dateFrom: item.request.dateFrom,
                              dateTo: item.request.dateTo,
                              reason: item.request.reason,
                              status: item.request.status,
                              remarks: item.request.remarks,
                            });
                            setEditError("");
                          }}
                          className="inline-flex items-center gap-1 px-2 py-1.5 text-xs font-medium text-amber-700 bg-amber-50 rounded-lg hover:bg-amber-100 transition-colors"
                          title="Edit request"
                        >
                          <Pencil size={14} />
                        </button>
                        {item.request.status === "Pending" ? (
                          <>
                            <button
                              onClick={() => handleUpdateStatus(item.request.id, "Approved", "Approved by admin")}
                              className="inline-flex items-center gap-1 px-2 py-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 rounded-lg hover:bg-emerald-100 transition-colors"
                              title="Approve"
                            >
                              <Check size={14} />
                            </button>
                            <button
                              onClick={() => handleUpdateStatus(item.request.id, "Denied", "Denied by admin")}
                              className="inline-flex items-center gap-1 px-2 py-1.5 text-xs font-medium text-red-700 bg-red-50 rounded-lg hover:bg-red-100 transition-colors"
                              title="Deny"
                            >
                              <X size={14} />
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => handleUpdateStatus(item.request.id, "Pending", "")}
                            className="inline-flex items-center gap-1 px-2 py-1.5 text-xs font-medium text-amber-700 bg-amber-50 rounded-lg hover:bg-amber-100 transition-colors"
                            title="Revert to Pending"
                          >
                            Revert
                          </button>
                        )}
                        <button
                          onClick={() => setDeleteTarget(item.request.id)}
                          className="inline-flex items-center gap-1 px-2 py-1.5 text-xs font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition-colors"
                          title="Delete"
                        >
                          <Trash2 size={14} />
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

      {/* View Modal */}
      {viewing && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Eye size={20} className="text-blue-600" />
                Request Details
              </h2>
              <button onClick={() => setViewing(null)} className="p-1 hover:bg-slate-100 rounded-lg">
                <X size={20} className="text-slate-500" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-medium text-slate-500 mb-1">Request ID</p>
                  <p className="text-sm font-semibold text-slate-900">{viewing.request.id}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-500 mb-1">Type</p>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                    viewing.request.type === "Leave" ? "bg-purple-100 text-purple-700" : "bg-blue-100 text-blue-700"
                  }`}>
                    {viewing.request.type}
                  </span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-medium text-slate-500 mb-1">VA Name</p>
                  <p className="text-sm text-slate-900">{viewing.vaName}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-500 mb-1">VA ID</p>
                  <p className="text-sm text-slate-900">{viewing.vaId}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-medium text-slate-500 mb-1">Date Submitted</p>
                  <p className="text-sm text-slate-900">{viewing.request.dateSubmitted}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-500 mb-1">Status</p>
                  <StatusBadge status={viewing.request.status} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-medium text-slate-500 mb-1">Date From</p>
                  <p className="text-sm text-slate-900">{viewing.request.dateFrom}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-500 mb-1">Date To</p>
                  <p className="text-sm text-slate-900">{viewing.request.dateTo}</p>
                </div>
              </div>
              <div>
                <p className="text-xs font-medium text-slate-500 mb-1">Reason / Details</p>
                <p className="text-sm text-slate-900 bg-slate-50 rounded-lg p-3">{viewing.request.reason}</p>
              </div>
              {viewing.request.remarks && (
                <div>
                  <p className="text-xs font-medium text-slate-500 mb-1">Admin Remarks</p>
                  <p className="text-sm text-slate-900 bg-amber-50 border border-amber-200 rounded-lg p-3">{viewing.request.remarks}</p>
                </div>
              )}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => {
                    setViewing(null);
                    setEditing(viewing);
                    setEditForm({
                      type: viewing.request.type,
                      dateFrom: viewing.request.dateFrom,
                      dateTo: viewing.request.dateTo,
                      reason: viewing.request.reason,
                      status: viewing.request.status,
                      remarks: viewing.request.remarks,
                    });
                    setEditError("");
                  }}
                  className="flex-1 bg-amber-500 hover:bg-amber-600 text-white font-medium py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2 text-sm"
                >
                  <Pencil size={16} />
                  Edit
                </button>
                <button
                  onClick={() => setViewing(null)}
                  className="flex-1 border border-slate-300 text-slate-700 font-medium py-2.5 rounded-lg hover:bg-slate-50 transition-colors text-sm"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editing && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 sticky top-0 bg-white">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Pencil size={20} className="text-amber-600" />
                Edit — {editing.request.id}
              </h2>
              <button onClick={() => setEditing(null)} className="p-1 hover:bg-slate-100 rounded-lg">
                <X size={20} className="text-slate-500" />
              </button>
            </div>
            <form onSubmit={handleEditSave} className="p-6 space-y-4">
              <div className="bg-slate-50 rounded-lg p-3">
                <p className="text-xs text-slate-500">VA: <span className="font-medium text-slate-700">{editing.vaName}</span> (ID: {editing.vaId})</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Request Type</label>
                <select
                  value={editForm.type}
                  onChange={(e) => setEditForm((f) => ({ ...f, type: e.target.value as "Leave" | "Shift Adjustment" }))}
                  className={inputClass}
                >
                  <option value="Leave">Leave Request</option>
                  <option value="Shift Adjustment">Shift Adjustment Request</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Date From</label>
                  <input
                    type="date"
                    value={editForm.dateFrom}
                    onChange={(e) => setEditForm((f) => ({ ...f, dateFrom: e.target.value }))}
                    required
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Date To</label>
                  <input
                    type="date"
                    value={editForm.dateTo}
                    onChange={(e) => setEditForm((f) => ({ ...f, dateTo: e.target.value }))}
                    required
                    className={inputClass}
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Reason / Details</label>
                <textarea
                  value={editForm.reason}
                  onChange={(e) => setEditForm((f) => ({ ...f, reason: e.target.value }))}
                  required
                  rows={3}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
                <select
                  value={editForm.status}
                  onChange={(e) => setEditForm((f) => ({ ...f, status: e.target.value as "Pending" | "Approved" | "Denied" }))}
                  className={inputClass}
                >
                  <option value="Pending">Pending</option>
                  <option value="Approved">Approved</option>
                  <option value="Denied">Denied</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Remarks</label>
                <textarea
                  value={editForm.remarks}
                  onChange={(e) => setEditForm((f) => ({ ...f, remarks: e.target.value }))}
                  rows={2}
                  className={inputClass}
                  placeholder="Add admin remarks..."
                />
              </div>
              {editError && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-3">{editError}</div>
              )}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setEditing(null)}
                  className="flex-1 border border-slate-300 text-slate-700 font-medium py-2.5 rounded-lg hover:bg-slate-50 transition-colors text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-medium py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2 text-sm"
                >
                  {saving ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Remarks Modal */}
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
                className={inputClass}
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

      {/* Delete Confirmation */}
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
