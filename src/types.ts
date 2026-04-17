export type AppointmentStatus = 'Scheduled' | 'Completed' | 'Paid' | 'Cancelled' | 'No Show';
export type PaymentStatus = 'Not Sent' | 'Sent' | 'Partial' | 'Paid' | 'Follow Up';
export type ScanbackStatus = 'Not Required' | 'Pending' | 'Sent' | 'Confirmed';

export interface Signer {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  idType?: string;
  idNumber?: string;
  idIssueDate?: string;
  idExpiration?: string;
  dob?: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  idImageUrl?: string;
}

export interface Appointment {
  id: string;
  userId: string;
  date: string;
  time: string;
  clientName: string;
  firstName?: string;
  lastName?: string;
  signers?: Signer[];
  signingType: string;
  location: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  fee: number; // Legacy field, will map to agreedFee
  status: AppointmentStatus;
  notes?: string;
  phone?: string;
  homePhone?: string;
  workPhone?: string;
  email?: string;
  customer?: string;
  orderNumber?: string;
  invoiceNumber?: string;
  loanNumber?: string;
  durationHours?: string;
  durationMinutes?: string;
  invoiceSentDate?: string;
  invoicePaidDate?: string;
  sortableDateTime?: string;
  idType?: string;
  idNumber?: string;
  idIssueDate?: string;
  dob?: string;
  idExpiration?: string;
  signingCompany?: string;
  companyId?: string;
  companyName?: string;
  customerId?: string;
  customerName?: string;
  docs?: string[];
  
  // Fee Tracking Fields
  offeredFee?: number;
  agreedFee?: number;
  amountCollected?: number;
  amountOutstanding?: number;
  paymentStatus?: PaymentStatus;
  paymentMethod?: string;
  paymentDueDate?: string;
  paymentReceivedDate?: string;
  invoiceSent?: boolean;
  notesBilling?: string;

  // Mileage & Profit Tracking Fields
  milesDriven?: number;
  mileageRate?: number;
  travelCost?: number;
  parkingTollsCost?: number;
  printingCost?: number;
  otherSigningCost?: number;
  totalJobCost?: number;
  estimatedProfit?: number;
  profitMarginPercent?: number;
  roundTripMiles?: boolean;
  scanbackStatus?: ScanbackStatus;
}

export interface SigningCompany {
  id: string;
  userId: string;
  companyName: string;
  contactName?: string;
  phone?: string;
  email?: string;
  website?: string;
  address?: string;
  notes?: string;
  status: 'Active' | 'Watch' | 'Do Not Work With' | 'Inactive';
  companyType: 'Signing Company' | 'Title Company' | 'Attorney' | 'Law Firm' | 'Escrow Company' | 'Other';
  preferredPaymentMethod?: string;
  paymentTerms?: string;
  averageFee?: number;
  totalSignings?: number;
  totalCollected?: number;
  totalOutstanding?: number;
  averageDaysToPay?: number;
  lastSigningDate?: string;
  tags?: string[];
  createdAt: string;
  updatedAt: string;
  rating?: number;
  paymentReliabilityScore?: number;
  serviceArea?: string;
  portalLoginUrl?: string;
  billingInstructions?: string;
  favorite?: boolean;
}

export type CustomerType = 'Buyer' | 'Seller' | 'Borrower' | 'Signer' | 'General Client';

export interface Customer {
  id: string;
  userId: string;
  firstName: string;
  lastName: string;
  fullName: string;
  email: string;
  phone: string;
  address: string;
  city?: string;
  state?: string;
  zip?: string;
  notes?: string;
  tags?: string[];
  customerType?: CustomerType;
  preferredContactMethod?: 'Email' | 'Phone' | 'Text';
  spouseName?: string;
  propertyAddress?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Client {
  id: string;
  userId: string;
  name: string;
  company?: string;
  email: string;
  phone: string;
  address: string;
}

export interface Expense {
  id: string;
  userId: string;
  date: string;
  category: string;
  amount: number;
  description: string;
}

export interface Mileage {
  id: string;
  userId: string;
  date: string;
  description: string;
  miles: number;
  rate: number;
  total: number;
}

export interface BusinessProfile {
  name: string;
  companyName: string;
  email: string;
  phone: string;
  address: string;
  state?: string;
  commissionNumber: string;
  commissionExpiration: string;
}

export interface DashboardStats {
  totalEarnings: number;
  totalExpenses: number;
  upcomingSignings: number;
  completedSignings: number;
}

export interface LawItem {
  id: string;
  state: string;
  topic: string;
  title: string;
  summary: string;
  officialSourceName: string;
  officialSourceUrl: string;
  secondarySourceName?: string;
  secondarySourceUrl?: string;
  lastVerifiedAt: string;
  effectiveDate?: string;
  keywords: string[];
  searchKeywords?: string[];
  isOfficial: boolean;
  disclaimerVersion: string;
}

export interface SavedLookup {
  id: string;
  userId: string;
  lawId: string;
  savedAt: string;
  lawTitle: string;
  state: string;
  topic: string;
}

export interface RecentSearch {
  id: string;
  userId: string;
  query: string;
  state: string;
  topic: string;
  searchedAt: string;
}
