"use client";

import { useEffect, useState } from "react";
import { getLeaveRequests, type LeaveRequest } from "@/lib/data";
import StatusBadge from "@/components/StatusBadge";
import { Plus, Send, CalendarDays, X, Clock } from "lucide-react";

export default function RequestsPage() {
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState({
    type: "Leave" as "Leave" | "Shift Adjustment",
    dateFrom: "",
    dateTo: "",
    reason: "",
  });

  useEffect(() => {
    const id = localStorage.getItem("vaId") || "";
    setRequests(getLeaveRequests(id));
  }, []);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const newReq: LeaveRequest = {
      id: `LR-${String(requests.length + 1).padStart(3, "0")}`,
      type: form.type,
      dateSubmitted: new Date().toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      }),
      dateFrom: form.dateFrom,
      dateTo: form.dateTo,
      reason: form.reason,
      status: "Pending",
      remarks: "",
    };
    setRequests((prev) => [...prev, newReq]);
    setSubmitted(true);
  }

  const inputClass =
    "w-full px-4 py-2.5 rounded-lg border border-slate-300 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">
          Leave & Shift Requests
        </h1>
        <button
          onClick={() => {
            setShowCreate(true);
            setSubmitted(false);
            setForm({ type: "Leave", dateFrom: "", dateTo: "", reason: "" });
          }}
          className="bg-primary hover:bg-primary-dark text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors"
        >
          <Plus size={16} />
          New Request
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-card rounded-xl border border-border p-4">
          <div className="flex items-center gap-2 text-sm text-muted mb-1">
            <CalendarDays size={16} />
            Total Requests
          </div>
          <p className="text-2xl font-bold text-foreground">
            {requests.length}
          </p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4">
          <div className="flex items-center gap-2 text-sm text-amber-600 mb-1">
            <Clock size={16} />
            Pending
          </div>
          <p className="text-2xl font-bold text-amber-600">
            {requests.filter((r) => r.status === "Pending").length}
          </p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4">
          <div className="flex items-center gap-2 text-sm text-emerald-600 mb-1">
            <CalendarDays size={16} />
            Approved
          </div>
          <p className="text-2xl font-bold text-emerald-600">
            {requests.filter((r) => r.status === "Approved").length}
          </p>
        </div>
      </div>

      {requests.length === 0 ? (
        <div className="bg-card rounded-xl border border-border p-12 text-center">
          <CalendarDays size={48} className="text-muted mx-auto mb-4" />
          <p className="text-lg font-medium text-foreground">
            No requests yet
          </p>
          <p className="text-sm text-muted mt-1">
            Click &quot;New Request&quot; to submit a leave or shift adjustment
            request.
          </p>
        </div>
      ) : (
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-border">
                  <th className="text-left px-6 py-3 font-semibold text-slate-600">
                    ID
                  </th>
                  <th className="text-left px-6 py-3 font-semibold text-slate-600">
                    Type
                  </th>
                  <th className="text-left px-6 py-3 font-semibold text-slate-600">
                    Date Submitted
                  </th>
                  <th className="text-left px-6 py-3 font-semibold text-slate-600">
                    Period
                  </th>
                  <th className="text-left px-6 py-3 font-semibold text-slate-600">
                    Reason
                  </th>
                  <th className="text-center px-6 py-3 font-semibold text-slate-600">
                    Status
                  </th>
                  <th className="text-left px-6 py-3 font-semibold text-slate-600">
                    Remarks
                  </th>
                </tr>
              </thead>
              <tbody>
                {requests.map((req) => (
                  <tr
                    key={req.id}
                    className="border-b border-border hover:bg-slate-50/50 transition-colors"
                  >
                    <td className="px-6 py-4 font-medium text-foreground">
                      {req.id}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                          req.type === "Leave"
                            ? "bg-purple-100 text-purple-700"
                            : "bg-blue-100 text-blue-700"
                        }`}
                      >
                        {req.type}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-foreground">
                      {req.dateSubmitted}
                    </td>
                    <td className="px-6 py-4 text-foreground whitespace-nowrap">
                      {req.dateFrom}
                      {req.dateFrom !== req.dateTo && ` to ${req.dateTo}`}
                    </td>
                    <td className="px-6 py-4 text-foreground max-w-xs truncate">
                      {req.reason}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <StatusBadge status={req.status} />
                    </td>
                    <td className="px-6 py-4 text-muted">
                      {req.remarks || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showCreate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <CalendarDays size={20} className="text-blue-600" />
                {submitted ? "Request Submitted" : "New Request"}
              </h2>
              <button
                onClick={() => setShowCreate(false)}
                className="p-1 hover:bg-slate-100 rounded-lg"
              >
                <X size={20} className="text-slate-500" />
              </button>
            </div>

            {submitted ? (
              <div className="p-6 text-center space-y-4">
                <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto">
                  <Send className="text-emerald-600" size={28} />
                </div>
                <h3 className="text-lg font-semibold text-slate-900">
                  Request Submitted!
                </h3>
                <p className="text-sm text-slate-600">
                  Your {form.type.toLowerCase()} request has been submitted and
                  is pending review.
                </p>
                <button
                  onClick={() => setShowCreate(false)}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-6 rounded-lg transition-colors"
                >
                  Close
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Request Type
                  </label>
                  <select
                    value={form.type}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        type: e.target.value as "Leave" | "Shift Adjustment",
                      }))
                    }
                    className={inputClass}
                  >
                    <option value="Leave">Leave Request</option>
                    <option value="Shift Adjustment">
                      Shift Adjustment Request
                    </option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Date From
                    </label>
                    <input
                      type="date"
                      value={form.dateFrom}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, dateFrom: e.target.value }))
                      }
                      required
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Date To
                    </label>
                    <input
                      type="date"
                      value={form.dateTo}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, dateTo: e.target.value }))
                      }
                      required
                      className={inputClass}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Reason / Details
                  </label>
                  <textarea
                    value={form.reason}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, reason: e.target.value }))
                    }
                    required
                    rows={3}
                    className={inputClass}
                    placeholder={
                      form.type === "Leave"
                        ? "Reason for leave request..."
                        : "Describe the shift adjustment needed (e.g. requesting to start at 10 AM instead of 8 AM)"
                    }
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowCreate(false)}
                    className="flex-1 border border-slate-300 text-slate-700 font-medium py-2.5 rounded-lg hover:bg-slate-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2"
                  >
                    <Send size={16} />
                    Submit Request
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
