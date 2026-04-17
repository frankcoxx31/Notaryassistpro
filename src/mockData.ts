import { format, subDays, addDays } from 'date-fns';
import { Appointment, Client, Expense, Mileage, BusinessProfile, SigningCompany, Customer } from './types';

export const MOCK_CUSTOMERS: Customer[] = [
  {
    id: 'c1',
    userId: 'mock-user',
    firstName: 'Larry',
    lastName: 'Jones',
    fullName: 'Larry Jones',
    email: 'larry.jones@email.com',
    phone: '(555) 111-2222',
    address: '123 Maple St',
    city: 'Charlotte',
    state: 'NC',
    zip: '28202',
    notes: 'Preferred morning appointments',
    tags: ['Repeat Client'],
    customerType: 'Borrower',
    createdAt: subDays(new Date(), 30).toISOString(),
    updatedAt: subDays(new Date(), 30).toISOString()
  },
  {
    id: 'c2',
    userId: 'mock-user',
    firstName: 'Monica',
    lastName: 'Davis',
    fullName: 'Monica Davis',
    email: 'monica.d@email.com',
    phone: '(555) 333-4444',
    address: '456 Oak Ave',
    city: 'Raleigh',
    state: 'NC',
    zip: '27601',
    customerType: 'Seller',
    createdAt: subDays(new Date(), 15).toISOString(),
    updatedAt: subDays(new Date(), 15).toISOString()
  },
  {
    id: 'c3',
    userId: 'mock-user',
    firstName: 'Robert',
    lastName: 'Allen',
    fullName: 'Robert Allen',
    email: 'rallen@email.com',
    phone: '(555) 555-6666',
    address: '789 Pine Rd',
    city: 'Durham',
    state: 'NC',
    zip: '27701',
    customerType: 'Buyer',
    createdAt: subDays(new Date(), 5).toISOString(),
    updatedAt: subDays(new Date(), 5).toISOString()
  }
];

export const MOCK_COMPANIES: SigningCompany[] = [
  {
    id: 'sc1',
    userId: 'mock-user',
    companyName: 'Carolina Signing Solutions',
    companyType: 'Signing Company',
    contactName: 'Jane Smith',
    email: 'jane@carolinasignings.com',
    phone: '(555) 123-4567',
    status: 'Active',
    paymentTerms: 'Net 30',
    rating: 5,
    favorite: true,
    tags: ['High Volume', 'Reliable'],
    createdAt: subDays(new Date(), 60).toISOString(),
    updatedAt: subDays(new Date(), 60).toISOString()
  },
  {
    id: 'sc2',
    userId: 'mock-user',
    companyName: 'Piedmont Title Group',
    companyType: 'Title Company',
    contactName: 'Bob Wilson',
    email: 'bob@piedmonttitle.com',
    phone: '(555) 987-6543',
    status: 'Active',
    paymentTerms: 'Net 15',
    rating: 4,
    favorite: false,
    tags: ['Local'],
    createdAt: subDays(new Date(), 45).toISOString(),
    updatedAt: subDays(new Date(), 45).toISOString()
  },
  {
    id: 'sc3',
    userId: 'mock-user',
    companyName: 'Queen City Law Firm',
    companyType: 'Law Firm',
    contactName: 'Sarah Miller',
    email: 'sarah@queencitylaw.com',
    phone: '(555) 444-3333',
    status: 'Active',
    paymentTerms: 'Due on Receipt',
    rating: 5,
    favorite: true,
    createdAt: subDays(new Date(), 20).toISOString(),
    updatedAt: subDays(new Date(), 20).toISOString()
  }
];

export const MOCK_APPOINTMENTS: Appointment[] = [
  {
    id: '1',
    userId: 'mock-user',
    date: format(new Date(), 'yyyy-MM-dd'),
    time: '10:00 AM',
    clientName: 'Larry Jones',
    customerId: 'c1',
    customerName: 'Larry Jones',
    companyId: 'sc1',
    companyName: 'Carolina Signing Solutions',
    location: '123 Maple St, Charlotte, NC 28202',
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
    clientName: 'Monica Davis',
    customerId: 'c2',
    customerName: 'Monica Davis',
    companyId: 'sc2',
    companyName: 'Piedmont Title Group',
    location: '456 Oak Ave, Raleigh, NC 27601',
    signingType: 'Purchase',
    fee: 175,
    status: 'Paid',
    orderNumber: 'ORD-12346',
    invoiceNumber: 'INV-1002'
  }
];

export const MOCK_CLIENTS: Client[] = [];

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
    rate: 0.725,
    total: 11.17
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
