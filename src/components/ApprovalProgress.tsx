import type { ApprovalDetails } from "@/lib/request-approvals";

export default function ApprovalProgress({ approval }: { approval: ApprovalDetails }) {
  if (!approval.requiresDualApproval) return <span className="block text-xs text-muted">Historical decision</span>;
  return <div className="mt-2 flex flex-wrap gap-1.5 text-xs" aria-label="Approval progress">
    {([['Admin', approval.adminApproval], ['Client', approval.clientApproval]] as const).map(([label, status]) =>
      <span key={label} className={`rounded px-2 py-1 ${status === 'Approved' ? 'bg-emerald-100 text-emerald-800' : status === 'Denied' ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'}`}>
        {label}: {status || 'Pending'}
      </span>)}
  </div>;
}
