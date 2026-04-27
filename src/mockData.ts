import { format, subDays, addDays, startOfMonth, startOfToday } from 'date-fns';
import { Appointment, Client, Expense, Mileage, BusinessProfile, SigningCompany, Customer } from './types';

const todayDate = format(new Date(), 'yyyy-MM-dd');

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
    createdAt: subDays(new Date(), 60).toISOString(),
    updatedAt: subDays(new Date(), 60).toISOString()
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
    createdAt: subDays(new Date(), 45).toISOString(),
    updatedAt: subDays(new Date(), 45).toISOString()
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
    createdAt: subDays(new Date(), 30).toISOString(),
    updatedAt: subDays(new Date(), 30).toISOString()
  },
  {
    id: 'c4',
    userId: 'mock-user',
    firstName: 'Sarah',
    lastName: 'Mitchell',
    fullName: 'Sarah Mitchell',
    email: 'sarah.m@example.com',
    phone: '(555) 888-9900',
    address: '221 Baker St',
    city: 'Charlotte',
    state: 'NC',
    zip: '28210',
    customerType: 'Borrower',
    createdAt: subDays(new Date(), 10).toISOString(),
    updatedAt: subDays(new Date(), 10).toISOString()
  }
];

export const MOCK_COMPANIES: SigningCompany[] = [
  {
    id: 'sc1',
    userId: 'mock-user',
    companyName: 'Signature Close LLC',
    companyType: 'Signing Company',
    contactName: 'Jane Smith',
    email: 'jane@signatureclose.com',
    phone: '(555) 123-4567',
    status: 'Active',
    paymentTerms: 'Net 30',
    rating: 5,
    favorite: true,
    tags: ['High Volume', 'Elite Preferred'],
    createdAt: subDays(new Date(), 180).toISOString(),
    updatedAt: subDays(new Date(), 180).toISOString()
  },
  {
    id: 'sc2',
    userId: 'mock-user',
    companyName: 'Premier Notary Network',
    companyType: 'Signing Company',
    contactName: 'Bob Wilson',
    email: 'scheduling@premiernotary.com',
    phone: '(555) 987-6543',
    status: 'Active',
    paymentTerms: 'Net 15',
    rating: 4,
    favorite: false,
    tags: ['Quick Pay'],
    createdAt: subDays(new Date(), 120).toISOString(),
    updatedAt: subDays(new Date(), 120).toISOString()
  },
  {
    id: 'sc3',
    userId: 'mock-user',
    companyName: 'Coastal Title & Escrow',
    companyType: 'Title Company',
    contactName: 'Sarah Miller',
    email: 'closings@coastaltitle.com',
    phone: '(555) 444-3333',
    status: 'Active',
    paymentTerms: 'Due on Receipt',
    rating: 5,
    favorite: true,
    createdAt: subDays(new Date(), 90).toISOString(),
    updatedAt: subDays(new Date(), 90).toISOString()
  },
  {
    id: 'sc4',
    userId: 'mock-user',
    companyName: 'Direct Signings Inc',
    companyType: 'Signing Company',
    contactName: 'Mike Ross',
    email: 'mike@directsignings.com',
    phone: '(555) 222-1111',
    status: 'Active',
    paymentTerms: 'Net 45',
    rating: 3,
    favorite: false,
    createdAt: subDays(new Date(), 60).toISOString(),
    updatedAt: subDays(new Date(), 60).toISOString()
  }
];

export const MOCK_APPOINTMENTS: Appointment[] = [
  // TODAY'S SIGNINGS
  {
    id: 'today-1',
    userId: 'mock-user',
    date: todayDate,
    time: '10:00 AM',
    clientName: 'Larry Jones',
    customerId: 'c1',
    customerName: 'Larry Jones',
    companyId: 'sc1',
    companyName: 'Signature Close LLC',
    location: '123 Maple St, Charlotte, NC 28202',
    signingType: 'Refinance',
    fee: 150,
    status: 'Scheduled',
    orderNumber: 'ORD-5501',
    invoiceNumber: 'INV-2024-5501',
    scanbackStatus: 'Pending'
  },
  {
    id: 'today-2',
    userId: 'mock-user',
    date: todayDate,
    time: '02:00 PM',
    clientName: 'Sarah Mitchell',
    customerId: 'c4',
    customerName: 'Sarah Mitchell',
    companyId: 'sc3',
    companyName: 'Coastal Title & Escrow',
    location: '221 Baker St, Charlotte, NC 28210',
    signingType: 'Purchase',
    fee: 225,
    status: 'Scheduled',
    orderNumber: 'ORD-5502',
    invoiceNumber: 'INV-2024-5502'
  },
  {
    id: 'today-3',
    userId: 'mock-user',
    date: todayDate,
    time: '04:30 PM',
    clientName: 'Hospital Patient A',
    location: 'Atrium Health Main, Charlotte, NC',
    signingType: 'General Notary Work',
    fee: 75,
    status: 'Scheduled',
    notes: 'Power of Attorney for elderly patient.'
  },
  // UPCOMING
  {
    id: 'next-1',
    userId: 'mock-user',
    date: format(addDays(new Date(), 1), 'yyyy-MM-dd'),
    time: '09:00 AM',
    clientName: 'Monica Davis',
    customerId: 'c2',
    customerName: 'Monica Davis',
    companyId: 'sc2',
    companyName: 'Premier Notary Network',
    location: '456 Oak Ave, Raleigh, NC 27601',
    signingType: 'Seller Package',
    fee: 125,
    status: 'Scheduled',
    orderNumber: 'ORD-5503'
  },
  // RECENT PAST (Completed/Pending Payment)
  {
    id: 'past-1',
    userId: 'mock-user',
    date: format(subDays(new Date(), 1), 'yyyy-MM-dd'),
    time: '11:00 AM',
    clientName: 'Robert Allen',
    customerId: 'c3',
    customerName: 'Robert Allen',
    companyId: 'sc1',
    companyName: 'Signature Close LLC',
    location: '789 Pine Rd, Durham, NC 27701',
    signingType: 'HELOC',
    fee: 110,
    status: 'Completed',
    orderNumber: 'ORD-5499',
    invoiceNumber: 'INV-2024-5499'
  },
  {
    id: 'past-2',
    userId: 'mock-user',
    date: format(subDays(new Date(), 3), 'yyyy-MM-dd'),
    time: '03:00 PM',
    clientName: 'John Smith',
    companyId: 'sc4',
    companyName: 'Direct Signings Inc',
    location: '555 Birch St, Gastonia, NC 28052',
    signingType: 'Buyer Package',
    fee: 175,
    status: 'Completed',
    orderNumber: 'ORD-5495',
    invoiceNumber: 'INV-2024-5495'
  },
  {
    id: 'past-3',
    userId: 'mock-user',
    date: format(subDays(new Date(), 5), 'yyyy-MM-dd'),
    time: '01:00 PM',
    clientName: 'Emily White',
    companyId: 'sc3',
    companyName: 'Coastal Title & Escrow',
    location: '101 Cedar Way, Huntersville, NC 28078',
    signingType: 'Purchase',
    fee: 200,
    status: 'Paid',
    orderNumber: 'ORD-5490',
    invoiceNumber: 'INV-2024-5490',
    amountCollected: 200,
    invoicePaidDate: format(subDays(new Date(), 1), 'yyyy-MM-dd')
  },
  {
    id: 'past-4',
    userId: 'mock-user',
    date: format(subDays(new Date(), 7), 'yyyy-MM-dd'),
    time: '10:30 AM',
    clientName: 'David Graham',
    companyId: 'sc1',
    companyName: 'Signature Close LLC',
    location: '909 Walnut Ln, Matthews, NC 28105',
    signingType: 'Refinance',
    fee: 150,
    status: 'Paid',
    orderNumber: 'ORD-5485',
    invoiceNumber: 'INV-2024-5485',
    amountCollected: 150,
    invoicePaidDate: format(subDays(new Date(), 3), 'yyyy-MM-dd')
  }
];

export const MOCK_CLIENTS: Client[] = [];

export const MOCK_EXPENSES: Expense[] = [
  {
    id: 'e1',
    userId: 'mock-user',
    date: format(subDays(new Date(), 2), 'yyyy-MM-dd'),
    category: 'Mileage',
    amount: 45.50,
    description: 'Gas for Gaston County trip'
  },
  {
    id: 'e2',
    userId: 'mock-user',
    date: format(subDays(new Date(), 5), 'yyyy-MM-dd'),
    category: 'Supplies',
    amount: 85.00,
    description: 'High capacity toner for dual tray printer'
  },
  {
    id: 'e3',
    userId: 'mock-user',
    date: format(subDays(new Date(), 10), 'yyyy-MM-dd'),
    category: 'Software',
    amount: 25.00,
    description: 'NotaryPro App Subscription'
  }
];

export const MOCK_MILEAGE: Mileage[] = [
  {
    id: 'm1',
    userId: 'mock-user',
    date: format(subDays(new Date(), 1), 'yyyy-MM-dd'),
    description: 'Durham Signing Trip',
    miles: 45.2,
    rate: 0.67,
    total: 30.28
  },
  {
    id: 'm2',
    userId: 'mock-user',
    date: format(subDays(new Date(), 3), 'yyyy-MM-dd'),
    description: 'Gastonia Signing Trip',
    miles: 28.5,
    rate: 0.67,
    total: 19.10
  }
];

export const MOCK_PROFILE: BusinessProfile = {
  name: 'Integrity Closings Notary',
  companyName: 'Integrity Closings CLT',
  email: 'notary.clt@integrityclosings.com',
  phone: '(704) 555-0199',
  address: 'mint hill, nc',
  commissionNumber: '2024123456',
  commissionExpiration: '2028-04-30',
  userId: 'mock-user',
  googleCalendarConnected: false
};
