import { format, subDays, addDays } from 'date-fns';
import { Appointment, Client, Expense, Mileage, BusinessProfile } from './types';

export const MOCK_APPOINTMENTS: Appointment[] = [
  {
    id: '1',
    userId: 'mock-user',
    date: format(new Date(), 'yyyy-MM-dd'),
    time: '10:00 AM',
    clientName: 'Quicken Loans',
    location: '123 Main St, Charlotte, NC 28202',
    signingType: 'Refinance',
    fee: 150,
    status: 'Scheduled',
    orderNumber: 'ORD-12345',
    invoiceNumber: 'INV-1001'
  },
  {
    id: '2',
    userId: 'mock-user',
    date: format(addDays(new Date(), 1), 'yyyy-MM-dd'),
    time: '02:30 PM',
    clientName: 'First American Title',
    location: '456 Oak Ave, Raleigh, NC 27601',
    signingType: 'Purchase',
    fee: 175,
    status: 'Paid',
    orderNumber: 'ORD-12346',
    invoiceNumber: 'INV-1002'
  }
];

export const MOCK_CLIENTS: Client[] = [
  {
    id: '1',
    userId: 'mock-user',
    name: 'Quicken Loans',
    company: 'Rocket Mortgage, LLC',
    email: 'notary@rocketmortgage.com',
    phone: '(800) 226-6308',
    address: '1050 Woodward Ave, Detroit, MI 48226'
  },
  {
    id: '2',
    userId: 'mock-user',
    name: 'First American Title',
    company: 'First American Financial Corp',
    email: 'signing@firstam.com',
    phone: '(800) 854-3643',
    address: '1 First American Way, Santa Ana, CA 92707'
  }
];

export const MOCK_EXPENSES: Expense[] = [
  {
    id: '1',
    userId: 'mock-user',
    date: format(subDays(new Date(), 2), 'yyyy-MM-dd'),
    category: 'Mileage',
    amount: 45.50,
    description: 'Trip to Capital City'
  },
  {
    id: '2',
    userId: 'mock-user',
    date: format(subDays(new Date(), 5), 'yyyy-MM-dd'),
    category: 'Supplies',
    amount: 25.00,
    description: 'Printer Ink'
  }
];

export const MOCK_MILEAGE: Mileage[] = [
  {
    id: '1',
    userId: 'mock-user',
    date: format(subDays(new Date(), 1), 'yyyy-MM-dd'),
    description: 'Post Office Drop-off',
    miles: 15.4,
    rate: 0.67,
    total: 10.32
  }
];

export const MOCK_PROFILE: BusinessProfile = {
  name: 'John Doe Notary',
  companyName: 'Notary Pro Services',
  email: 'john@notarypro.com',
  phone: '(555) 000-0000',
  address: '789 Business Rd, Charlotte, NC 28277',
  commissionNumber: '123456789',
  commissionExpiration: '2028-12-31'
};
