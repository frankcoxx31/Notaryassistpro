export type AppointmentStatus = 'Scheduled' | 'Completed' | 'Cancelled' | 'No Show';

export interface Appointment {
  id: string;
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
  orderNumber?: string;
  loanNumber?: string;
  durationHours?: string;
  durationMinutes?: string;
}

export interface Client {
  id: string;
  name: string;
  company?: string;
  email: string;
  phone: string;
  address: string;
}

export interface Expense {
  id: string;
  date: string;
  category: string;
  amount: number;
  description: string;
}

export interface Mileage {
  id: string;
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
