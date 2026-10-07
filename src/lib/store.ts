import {
  vaProfiles as seedProfiles,
  salaryAdjustments as seedAdjustments,
  invoices as seedInvoices,
  leaveRequests as seedRequests,
  pendingRegistrations as seedRegistrations,
  type VAProfile,
  type SalaryAdjustment,
  type Invoice,
  type LeaveRequest,
  type PendingRegistration,
} from "./data";

const KEYS = {
  profiles: "gy_va_profiles",
  adjustments: "gy_salary_adjustments",
  invoices: "gy_invoices",
  requests: "gy_leave_requests",
  registrations: "gy_registrations",
};

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw) return JSON.parse(raw);
  } catch {}
  return fallback;
}

function save<T>(key: string, data: T) {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch {}
}

export function getProfiles(): VAProfile[] {
  return load(KEYS.profiles, seedProfiles);
}

export function saveProfiles(profiles: VAProfile[]) {
  save(KEYS.profiles, profiles);
}

export function getProfile(id: string): VAProfile | undefined {
  return getProfiles().find((v) => v.id === id);
}

export function addProfile(profile: VAProfile) {
  const profiles = getProfiles();
  profiles.push(profile);
  saveProfiles(profiles);
}

export function deleteProfile(id: string) {
  saveProfiles(getProfiles().filter((v) => v.id !== id));
}

export function getAllAdjustments(): Record<string, SalaryAdjustment[]> {
  return load(KEYS.adjustments, seedAdjustments);
}

export function getAdjustmentsFor(id: string): SalaryAdjustment[] {
  return getAllAdjustments()[id] || [];
}

export function saveAllAdjustments(data: Record<string, SalaryAdjustment[]>) {
  save(KEYS.adjustments, data);
}

export function addAdjustment(vaId: string, adj: SalaryAdjustment) {
  const all = getAllAdjustments();
  if (!all[vaId]) all[vaId] = [];
  all[vaId].push(adj);
  saveAllAdjustments(all);
}

export function getAllInvoicesMap(): Record<string, Invoice[]> {
  return load(KEYS.invoices, seedInvoices);
}

export function getInvoicesFor(id: string): Invoice[] {
  return getAllInvoicesMap()[id] || [];
}

export function saveAllInvoices(data: Record<string, Invoice[]>) {
  save(KEYS.invoices, data);
}

export function getAllInvoicesFlat(): { vaId: string; vaName: string; invoice: Invoice }[] {
  const allInv = getAllInvoicesMap();
  const result: { vaId: string; vaName: string; invoice: Invoice }[] = [];
  for (const [vaId, invList] of Object.entries(allInv)) {
    const profile = getProfile(vaId);
    const vaName = profile ? `${profile.firstName} ${profile.lastName}` : vaId;
    for (const inv of invList) {
      if (inv.invoiceNumber && inv.amount) {
        result.push({ vaId, vaName, invoice: inv });
      }
    }
  }
  return result;
}

export function updateInvoiceStatus(invoiceNumber: string, status: Invoice["status"]) {
  const all = getAllInvoicesMap();
  for (const vaId of Object.keys(all)) {
    all[vaId] = all[vaId].map((inv) =>
      inv.invoiceNumber === invoiceNumber ? { ...inv, status } : inv
    );
  }
  saveAllInvoices(all);
}

export function deleteInvoice(invoiceNumber: string) {
  const all = getAllInvoicesMap();
  for (const vaId of Object.keys(all)) {
    all[vaId] = all[vaId].filter((inv) => inv.invoiceNumber !== invoiceNumber);
  }
  saveAllInvoices(all);
}

export function addInvoice(vaId: string, invoice: Invoice) {
  const all = getAllInvoicesMap();
  if (!all[vaId]) all[vaId] = [];
  all[vaId].push(invoice);
  saveAllInvoices(all);
}

export function getAllRequestsMap(): Record<string, LeaveRequest[]> {
  return load(KEYS.requests, seedRequests);
}

export function getRequestsFor(id: string): LeaveRequest[] {
  return getAllRequestsMap()[id] || [];
}

export function saveAllRequests(data: Record<string, LeaveRequest[]>) {
  save(KEYS.requests, data);
}

export function getAllRequestsFlat(): { vaId: string; vaName: string; request: LeaveRequest }[] {
  const allReq = getAllRequestsMap();
  const result: { vaId: string; vaName: string; request: LeaveRequest }[] = [];
  for (const [vaId, reqList] of Object.entries(allReq)) {
    const profile = getProfile(vaId);
    const vaName = profile ? `${profile.firstName} ${profile.lastName}` : vaId;
    for (const req of reqList) {
      result.push({ vaId, vaName, request: req });
    }
  }
  return result;
}

export function updateRequestStatus(id: string, status: LeaveRequest["status"], remarks?: string) {
  const all = getAllRequestsMap();
  for (const vaId of Object.keys(all)) {
    all[vaId] = all[vaId].map((req) =>
      req.id === id ? { ...req, status, remarks: remarks ?? req.remarks } : req
    );
  }
  saveAllRequests(all);
}

export function updateRequestRemarks(id: string, remarks: string) {
  const all = getAllRequestsMap();
  for (const vaId of Object.keys(all)) {
    all[vaId] = all[vaId].map((req) =>
      req.id === id ? { ...req, remarks } : req
    );
  }
  saveAllRequests(all);
}

export function deleteRequest(id: string) {
  const all = getAllRequestsMap();
  for (const vaId of Object.keys(all)) {
    all[vaId] = all[vaId].filter((req) => req.id !== id);
  }
  saveAllRequests(all);
}

export function addRequest(vaId: string, request: LeaveRequest) {
  const all = getAllRequestsMap();
  if (!all[vaId]) all[vaId] = [];
  all[vaId].push(request);
  saveAllRequests(all);
}

export function getRegistrations(): PendingRegistration[] {
  return load(KEYS.registrations, seedRegistrations);
}

export function saveRegistrations(regs: PendingRegistration[]) {
  save(KEYS.registrations, regs);
}

export function updateRegistrationStatus(id: string, status: PendingRegistration["status"]) {
  const regs = getRegistrations().map((r) =>
    r.id === id ? { ...r, status } : r
  );
  saveRegistrations(regs);
}

export function generateNextInvoiceNumber(vaId: string): string {
  const existing = getInvoicesFor(vaId);
  const lastNum = existing.length;
  return `${vaId}-${String(lastNum + 1).padStart(3, "0")}`;
}
