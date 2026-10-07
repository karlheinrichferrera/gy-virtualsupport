export interface VAProfile {
  id: string;
  firstName: string;
  middleName: string;
  lastName: string;
  suffix: string;
  phone: string;
  altPhone: string;
  email: string;
  permanentAddress: {
    street: string;
    subdivision: string;
    barangay: string;
    city: string;
    province: string;
    postalCode: string;
  };
  temporaryAddress: string;
  position: string;
  dateHired: string;
  currentRate: string;
  emergencyContact: string;
  emergencyPhone: string;
  password: string;
  contractorId: string;
  bankName: string;
  bankAccountNumber: string;
  bankAccountName: string;
}

export interface SalaryAdjustment {
  effectivityDate: string;
  type: string;
  hourlyRate: string;
  salesCommission: string;
  referralBonus: string;
  notes: string;
}

export interface Invoice {
  invoiceNumber: string;
  dateCovered: string;
  amount: string;
  transactionFee: string;
  amountDisbursed: string;
  invoiceCopy: string;
  status: "Paid" | "Pending" | "Draft" | "";
}

export interface LeaveRequest {
  id: string;
  type: "Leave" | "Shift Adjustment";
  dateSubmitted: string;
  dateFrom: string;
  dateTo: string;
  reason: string;
  status: "Pending" | "Approved" | "Denied";
  remarks: string;
}

export const vaProfiles: VAProfile[] = [
  {
    id: "500102",
    firstName: "Domingo",
    middleName: "Munar",
    lastName: "Soltes",
    suffix: "Jr.",
    phone: "(+63) 950 556 8148",
    altPhone: "N/A",
    email: "dom.soltes@goldenyears.com",
    permanentAddress: {
      street: "Phase 2, Blk 1 Lot 6",
      subdivision: "Eco Verde Homes",
      barangay: "Santo Nino",
      city: "San Pascual",
      province: "Batangas",
      postalCode: "4204",
    },
    temporaryAddress: "Same as permanent address",
    position: "Telemarketer",
    dateHired: "April 20, 2020",
    currentRate: "$5.00 / Hour",
    emergencyContact: "Maria Soltes",
    emergencyPhone: "(+63) 917 123 4567",
    password: "gyva2026",
    contractorId: "CTR-2020-0102",
    bankName: "BDO Unibank",
    bankAccountNumber: "001234567890",
    bankAccountName: "Domingo M. Soltes Jr.",
  },
  {
    id: "500103",
    firstName: "Maria",
    middleName: "Cruz",
    lastName: "Santos",
    suffix: "",
    phone: "(+63) 912 345 6789",
    altPhone: "N/A",
    email: "maria.santos@goldenyears.com",
    permanentAddress: {
      street: "123 Rizal Street",
      subdivision: "Green Meadows",
      barangay: "San Antonio",
      city: "Makati",
      province: "Metro Manila",
      postalCode: "1200",
    },
    temporaryAddress: "Same as permanent address",
    position: "Sales Support",
    dateHired: "June 15, 2021",
    currentRate: "$4.50 / Hour",
    emergencyContact: "Juan Santos",
    emergencyPhone: "(+63) 918 765 4321",
    password: "gyva2026",
    contractorId: "CTR-2021-0103",
    bankName: "BPI",
    bankAccountNumber: "9876543210",
    bankAccountName: "Maria C. Santos",
  },
];

export const salaryAdjustments: Record<string, SalaryAdjustment[]> = {
  "500102": [
    {
      effectivityDate: "April 20, 2020",
      type: "HIRED AS PART TIME CALLER",
      hourlyRate: "$2.90 per hour",
      salesCommission: "$4.00 / lead",
      referralBonus: "$25.00",
      notes: "Initial hire as part-time caller",
    },
    {
      effectivityDate: "May 4, 2020",
      type: "PROMOTED AS FULL TIME CALLER",
      hourlyRate: "$3.00 / Hour",
      salesCommission: "$5.00 / lead",
      referralBonus: "No Adjustment",
      notes: "Promoted to full-time position",
    },
    {
      effectivityDate: "April 12, 2021",
      type: "SALARY ADJUSTMENT",
      hourlyRate: "$3.75 / Hour",
      salesCommission: "No Adjustment",
      referralBonus: "No Adjustment",
      notes: "Annual salary review adjustment",
    },
    {
      effectivityDate: "July 12, 2021",
      type: "SALARY ADJUSTMENT",
      hourlyRate: "$4.00 / Hour",
      salesCommission: "No Adjustment",
      referralBonus: "No Adjustment",
      notes: "Performance-based adjustment",
    },
    {
      effectivityDate: "July 12, 2023",
      type: "SALARY ADJUSTMENT",
      hourlyRate: "$5.00 / Hour",
      salesCommission: "No Adjustment",
      referralBonus: "No Adjustment",
      notes: "Annual salary review adjustment",
    },
  ],
  "500103": [
    {
      effectivityDate: "June 15, 2021",
      type: "HIRED AS FULL TIME SUPPORT",
      hourlyRate: "$3.50 / Hour",
      salesCommission: "N/A",
      referralBonus: "N/A",
      notes: "Initial hire",
    },
    {
      effectivityDate: "January 10, 2023",
      type: "SALARY ADJUSTMENT",
      hourlyRate: "$4.50 / Hour",
      salesCommission: "N/A",
      referralBonus: "N/A",
      notes: "Performance review adjustment",
    },
  ],
};

export const invoices: Record<string, Invoice[]> = {
  "500102": [
    {
      invoiceNumber: "500102-001",
      dateCovered: "July 13, 2026 - July 24, 2026",
      amount: "$470",
      transactionFee: "$4.70",
      amountDisbursed: "$465.30",
      invoiceCopy: "",
      status: "Paid",
    },
    {
      invoiceNumber: "500102-002",
      dateCovered: "July 27, 2026 - August 07, 2026",
      amount: "$400",
      transactionFee: "$4.00",
      amountDisbursed: "$396.00",
      invoiceCopy: "",
      status: "Paid",
    },
    {
      invoiceNumber: "500102-003",
      dateCovered: "August 10 - 21, 2026",
      amount: "$400",
      transactionFee: "$4.00",
      amountDisbursed: "$396.00",
      invoiceCopy: "",
      status: "Paid",
    },
    {
      invoiceNumber: "500102-004",
      dateCovered: "July 26, 2026 - August 26, 2026",
      amount: "$120",
      transactionFee: "",
      amountDisbursed: "$120.00",
      invoiceCopy: "",
      status: "Paid",
    },
    {
      invoiceNumber: "500102-005",
      dateCovered: "August 24, 2026 - September 06, 2026",
      amount: "$400",
      transactionFee: "$4.00",
      amountDisbursed: "$396.00",
      invoiceCopy: "",
      status: "Paid",
    },
    {
      invoiceNumber: "500102-006",
      dateCovered: "September 07, 2026 - September 20, 2026",
      amount: "$360",
      transactionFee: "$3.60",
      amountDisbursed: "$356.40",
      invoiceCopy: "",
      status: "Paid",
    },
    {
      invoiceNumber: "500102-007",
      dateCovered: "September 21, 2026 - October 04, 2026",
      amount: "$400",
      transactionFee: "$4.00",
      amountDisbursed: "$396.00",
      invoiceCopy: "",
      status: "Paid",
    },
    {
      invoiceNumber: "500102-008",
      dateCovered: "August 26, 2026 - September 26, 2026",
      amount: "$70",
      transactionFee: "$0.70",
      amountDisbursed: "$69.30",
      invoiceCopy: "",
      status: "Paid",
    },
  ],
  "500103": [
    {
      invoiceNumber: "500103-001",
      dateCovered: "August 01, 2026 - August 14, 2026",
      amount: "$360",
      transactionFee: "$3.60",
      amountDisbursed: "$356.40",
      invoiceCopy: "",
      status: "Paid",
    },
    {
      invoiceNumber: "500103-002",
      dateCovered: "August 15, 2026 - August 28, 2026",
      amount: "$360",
      transactionFee: "$3.60",
      amountDisbursed: "$356.40",
      invoiceCopy: "",
      status: "Pending",
    },
  ],
};

export const leaveRequests: Record<string, LeaveRequest[]> = {
  "500102": [
    {
      id: "LR-001",
      type: "Leave",
      dateSubmitted: "September 15, 2026",
      dateFrom: "September 25, 2026",
      dateTo: "September 26, 2026",
      reason: "Family event",
      status: "Approved",
      remarks: "Approved by manager",
    },
    {
      id: "LR-002",
      type: "Shift Adjustment",
      dateSubmitted: "October 01, 2026",
      dateFrom: "October 05, 2026",
      dateTo: "October 05, 2026",
      reason: "Medical appointment - requesting to start at 10 AM instead of 8 AM",
      status: "Pending",
      remarks: "",
    },
  ],
  "500103": [],
};

export function getVAProfile(id: string): VAProfile | undefined {
  return vaProfiles.find((va) => va.id === id);
}

export function getAdjustments(id: string): SalaryAdjustment[] {
  return salaryAdjustments[id] || [];
}

export function getInvoices(id: string): Invoice[] {
  return invoices[id] || [];
}

export function getLeaveRequests(id: string): LeaveRequest[] {
  return leaveRequests[id] || [];
}

export function generateNextInvoiceNumber(id: string): string {
  const existing = invoices[id] || [];
  const lastNum = existing.length;
  return `${id}-${String(lastNum + 1).padStart(3, "0")}`;
}

export interface PendingRegistration {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  position: string;
  dateApplied: string;
  status: "Pending" | "Approved" | "Denied";
}

export const pendingRegistrations: PendingRegistration[] = [
  {
    id: "REG-001",
    firstName: "Anna",
    lastName: "Reyes",
    email: "anna.reyes@gmail.com",
    phone: "(+63) 923 456 7890",
    position: "Telemarketer",
    dateApplied: "October 01, 2026",
    status: "Pending",
  },
  {
    id: "REG-002",
    firstName: "Carlos",
    lastName: "Mendoza",
    email: "carlos.m@gmail.com",
    phone: "(+63) 935 678 1234",
    position: "Admin Support",
    dateApplied: "October 03, 2026",
    status: "Pending",
  },
];

export function getAllInvoices(): { vaId: string; vaName: string; invoice: Invoice }[] {
  const result: { vaId: string; vaName: string; invoice: Invoice }[] = [];
  for (const [vaId, invList] of Object.entries(invoices)) {
    const profile = getVAProfile(vaId);
    const vaName = profile ? `${profile.firstName} ${profile.lastName}` : vaId;
    for (const inv of invList) {
      if (inv.invoiceNumber && inv.amount) {
        result.push({ vaId, vaName, invoice: inv });
      }
    }
  }
  return result;
}

export function getAllLeaveRequests(): { vaId: string; vaName: string; request: LeaveRequest }[] {
  const result: { vaId: string; vaName: string; request: LeaveRequest }[] = [];
  for (const [vaId, reqList] of Object.entries(leaveRequests)) {
    const profile = getVAProfile(vaId);
    const vaName = profile ? `${profile.firstName} ${profile.lastName}` : vaId;
    for (const req of reqList) {
      result.push({ vaId, vaName, request: req });
    }
  }
  return result;
}
