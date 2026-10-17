"use client";

import { useEffect, useState } from "react";
import { getCalendarEvents, addCalendarEvent, deleteCalendarEvent } from "@/lib/actions";
import type { CalendarEvent } from "@/lib/actions";
import { CalendarDays, ChevronLeft, ChevronRight, Cake, Briefcase, Star, PartyPopper, Plus, Trash2, X, Palmtree } from "lucide-react";

const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const TYPE_CONFIG: Record<string, { bg: string; text: string; border: string; icon: typeof Cake; label: string }> = {
  holiday: { bg: "bg-red-50", text: "text-red-700", border: "border-red-200", icon: Star, label: "Holiday" },
  birthday: { bg: "bg-pink-50", text: "text-pink-700", border: "border-pink-200", icon: Cake, label: "Birthday" },
  anniversary: { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200", icon: Briefcase, label: "Work Anniversary" },
  event: { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200", icon: PartyPopper, label: "Event" },
  leave: { bg: "bg-purple-50", text: "text-purple-700", border: "border-purple-200", icon: Palmtree, label: "Approved Leave" },
};

export default function CalendarPage({ accentColor = "indigo", isAdmin = false, showLeaves = false }: { accentColor?: "blue" | "indigo" | "emerald"; isAdmin?: boolean; showLeaves?: boolean }) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [newDate, setNewDate] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [newType, setNewType] = useState<"holiday" | "event">("event");
  const [saving, setSaving] = useState(false);

  function reload() {
    setLoading(true);
    getCalendarEvents(year, month, showLeaves).then((e) => { setEvents(e); setLoading(false); });
  }

  useEffect(() => { reload(); }, [year, month, showLeaves]);

  function prevMonth() {
    if (month === 1) { setMonth(12); setYear(year - 1); } else setMonth(month - 1);
  }
  function nextMonth() {
    if (month === 12) { setMonth(1); setYear(year + 1); } else setMonth(month + 1);
  }
  function goToday() { setYear(now.getFullYear()); setMonth(now.getMonth() + 1); }

  async function handleAdd() {
    if (!newDate || !newTitle.trim()) return;
    setSaving(true);
    await addCalendarEvent(newDate, newTitle.trim(), newType);
    setNewDate(""); setNewTitle(""); setNewType("event"); setShowAdd(false); setSaving(false);
    const parts = newDate.split("-");
    const eYear = parseInt(parts[0]); const eMonth = parseInt(parts[1]);
    if (eYear === year && eMonth === month) reload();
    else { setYear(eYear); setMonth(eMonth); }
  }

  async function handleDelete(id: number) {
    if (!confirm("Delete this event?")) return;
    await deleteCalendarEvent(id);
    reload();
  }

  const firstDay = new Date(year, month - 1, 1).getDay();
  const daysInMonth = new Date(year, month, 0).getDate();
  const today = now.getFullYear() === year && now.getMonth() + 1 === month ? now.getDate() : -1;

  const eventsByDay: Record<number, CalendarEvent[]> = {};
  for (const e of events) {
    const day = parseInt(e.date.split("-")[2]);
    if (!eventsByDay[day]) eventsByDay[day] = [];
    eventsByDay[day].push(e);
  }

  const calendarCells: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) calendarCells.push(null);
  for (let d = 1; d <= daysInMonth; d++) calendarCells.push(d);

  const btnColor = accentColor === "indigo" ? "bg-indigo-600 hover:bg-indigo-700" : accentColor === "emerald" ? "bg-emerald-600 hover:bg-emerald-700" : "bg-blue-600 hover:bg-blue-700";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <CalendarDays size={24} />
          Calendar
        </h1>
        {isAdmin && (
          <button onClick={() => setShowAdd(true)} className={`flex items-center gap-2 px-4 py-2 text-sm font-medium text-white rounded-lg ${btnColor} transition-colors`}>
            <Plus size={16} /> Add Event
          </button>
        )}
      </div>

      {showAdd && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h2 className="text-lg font-bold text-slate-900">Add Event</h2>
              <button onClick={() => setShowAdd(false)} className="p-1 hover:bg-slate-100 rounded-lg"><X size={20} className="text-slate-500" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Event Title</label>
                <input type="text" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="e.g. Team Meeting, Office Closed" className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Date</label>
                <input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Type</label>
                <select value={newType} onChange={(e) => setNewType(e.target.value as "holiday" | "event")} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500">
                  <option value="event">Event</option>
                  <option value="holiday">Holiday / Office Closed</option>
                </select>
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setShowAdd(false)} className="flex-1 px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors">Cancel</button>
                <button onClick={handleAdd} disabled={saving || !newDate || !newTitle.trim()} className={`flex-1 px-4 py-2 text-sm font-medium text-white rounded-lg ${btnColor} disabled:opacity-50 transition-colors`}>
                  {saving ? "Saving..." : "Add Event"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="bg-card rounded-xl border border-border p-3 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <div className="flex min-w-0 items-center gap-1 sm:gap-2">
            <button onClick={prevMonth} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
              <ChevronLeft size={20} className="text-slate-600" />
            </button>
            <h2 className="text-sm sm:text-lg font-bold text-foreground min-w-0 sm:min-w-[180px] text-center">
              {MONTH_NAMES[month - 1]} {year}
            </h2>
            <button onClick={nextMonth} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
              <ChevronRight size={20} className="text-slate-600" />
            </button>
          </div>
          <button onClick={goToday} className={`px-4 py-1.5 text-sm font-medium text-white rounded-lg ${btnColor} transition-colors`}>
            Today
          </button>
        </div>

        <div className="grid grid-cols-[repeat(7,minmax(0,1fr))] gap-px bg-slate-200 rounded-lg overflow-hidden border border-slate-200">
          {DAY_NAMES.map((d) => (
            <div key={d} className="bg-slate-50 py-2 text-center text-xs font-semibold text-slate-500 uppercase">{d}</div>
          ))}
          {calendarCells.map((day, i) => {
            const dayEvents = day ? eventsByDay[day] || [] : [];
            const isToday = day === today;
            return (
              <div key={i} className={`min-w-0 bg-white min-h-[80px] sm:min-h-[100px] p-1.5 ${day ? "" : "bg-slate-50"}`}>
                {day && (
                  <>
                    <div className={`text-sm font-medium mb-1 w-7 h-7 flex items-center justify-center rounded-full ${isToday ? `${btnColor} text-white` : "text-slate-700"}`}>
                      {day}
                    </div>
                    <div className="space-y-0.5">
                      {dayEvents.slice(0, 3).map((e, j) => {
                        const cfg = TYPE_CONFIG[e.type] || TYPE_CONFIG.event;
                        return (
                          <div key={j} className={`text-[10px] sm:text-xs px-1.5 py-0.5 rounded ${cfg.bg} ${cfg.text} truncate font-medium`} title={e.title}>
                            {e.title}
                          </div>
                        );
                      })}
                      {dayEvents.length > 3 && <div className="text-[10px] text-slate-400 pl-1">+{dayEvents.length - 3} more</div>}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="bg-card rounded-xl border border-border p-3 sm:p-5">
        <h2 className="text-lg font-semibold text-foreground mb-4">
          Events in {MONTH_NAMES[month - 1]} {year}
        </h2>
        {loading ? (
          <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-400" /></div>
        ) : events.length === 0 ? (
          <p className="text-sm text-muted py-4 text-center">No events this month</p>
        ) : (
          <div className="space-y-3">
            {events.map((e, i) => {
              const cfg = TYPE_CONFIG[e.type] || TYPE_CONFIG.event;
              const Icon = cfg.icon;
              const dayNum = parseInt(e.date.split("-")[2]);
              const dateObj = new Date(year, month - 1, dayNum);
              const dayLabel = dateObj.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
              return (
                <div key={i} className={`flex items-center gap-4 p-3 rounded-lg border ${cfg.border} ${cfg.bg}`}>
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${cfg.text} bg-white/60`}>
                    <Icon size={20} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-semibold ${cfg.text}`}>{e.title}</p>
                    <p className="text-xs text-slate-500">{dayLabel}</p>
                  </div>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.text} border ${cfg.border} shrink-0`}>
                    {cfg.label}
                  </span>
                  {isAdmin && e.id && (
                    <button onClick={() => handleDelete(e.id!)} className="p-1.5 hover:bg-red-100 rounded-lg transition-colors" title="Delete event">
                      <Trash2 size={16} className="text-red-500" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
