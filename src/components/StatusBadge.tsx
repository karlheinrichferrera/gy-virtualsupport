interface StatusBadgeProps {
  status: string;
}

export default function StatusBadge({ status }: StatusBadgeProps) {
  const styles: Record<string, string> = {
    Paid: "bg-emerald-100 text-emerald-700",
    Approved: "bg-emerald-100 text-emerald-700",
    Pending: "bg-amber-100 text-amber-700",
    Denied: "bg-red-100 text-red-700",
    Draft: "bg-slate-100 text-slate-600",
  };

  const cls = styles[status] || "bg-slate-100 text-slate-500";

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${cls}`}>
      {status || "—"}
    </span>
  );
}
