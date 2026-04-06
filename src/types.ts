export type AppointmentStatus = 'Scheduled' | 'Completed' | 'Paid' | 'Cancelled' | 'No Show';

export interface Appointment {
  id: string;
  userId: string;
  date: string;
  time: string;
  clientName: string;
  firstName?: string;
  lastName?: string;
  signingType: string;
  location: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  fee: number;
  status: AppointmentStatus;
  notes?: string;
  phone?: string;
  email?: string;
  customer?: string;
  orderNumber?: string;
  invoiceNumber?: string;
  loanNumber?: string;
  durationHours?: string;
  durationMinutes?: string;
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
  commissionNumber: string;
  commissionExpiration: string;
}

export interface DashboardStats {
  totalEarnings: number;
  totalExpenses: number;
  upcomingSignings: number;
  completedSignings: number;
}
