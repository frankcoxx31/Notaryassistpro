import { Appointment, Client, Expense, Mileage, BusinessProfile, SigningCompany, Customer } from '../types';
import { 
  MOCK_APPOINTMENTS, 
  MOCK_CLIENTS, 
  MOCK_EXPENSES, 
  MOCK_MILEAGE, 
  MOCK_PROFILE,
  MOCK_COMPANIES,
  MOCK_CUSTOMERS
} from '../mockData';

const KEYS = {
  APPOINTMENTS: 'notarypro_demo_signings',
  CUSTOMERS: 'notarypro_demo_customers',
  COMPANIES: 'notarypro_demo_companies',
  EXPENSES: 'notarypro_demo_expenses',
  MILEAGE: 'notarypro_demo_mileage',
  PROFILE: 'notarypro_demo_profile',
  SESSION: 'notarypro_demo_session'
};

export const demoStorage = {
  // Auth state
  isDemoMode: (): boolean => {
    return localStorage.getItem(KEYS.SESSION) === 'true';
  },
  setDemoMode: (active: boolean) => {
    localStorage.setItem(KEYS.SESSION, active ? 'true' : 'false');
  },

  // Reset all data
  resetAll: () => {
    localStorage.setItem(KEYS.APPOINTMENTS, JSON.stringify(MOCK_APPOINTMENTS));
    localStorage.setItem(KEYS.CUSTOMERS, JSON.stringify(MOCK_CUSTOMERS));
    localStorage.setItem(KEYS.EXPENSES, JSON.stringify(MOCK_EXPENSES));
    localStorage.setItem(KEYS.MILEAGE, JSON.stringify(MOCK_MILEAGE));
    localStorage.setItem(KEYS.PROFILE, JSON.stringify(MOCK_PROFILE));
    localStorage.setItem(KEYS.COMPANIES, JSON.stringify(MOCK_COMPANIES));
  },

  // Generic Get/Set
  get: <T>(key: string, defaultValue: T): T => {
    const stored = localStorage.getItem(key);
    if (!stored) {
      localStorage.setItem(key, JSON.stringify(defaultValue));
      return defaultValue;
    }
    try {
      return JSON.parse(stored);
    } catch (e) {
      console.error(`Error parsing demo data for ${key}`, e);
      return defaultValue;
    }
  },
  set: <T>(key: string, value: T) => {
    localStorage.setItem(key, JSON.stringify(value));
  },

  // Specific Getters
  getAppointments: () => demoStorage.get<Appointment[]>(KEYS.APPOINTMENTS, MOCK_APPOINTMENTS),
  getCustomers: () => demoStorage.get<Customer[]>(KEYS.CUSTOMERS, MOCK_CUSTOMERS),
  getExpenses: () => demoStorage.get<Expense[]>(KEYS.EXPENSES, MOCK_EXPENSES),
  getMileage: () => demoStorage.get<Mileage[]>(KEYS.MILEAGE, MOCK_MILEAGE),
  getProfile: () => demoStorage.get<BusinessProfile>(KEYS.PROFILE, MOCK_PROFILE),
  getCompanies: () => demoStorage.get<SigningCompany[]>(KEYS.COMPANIES, MOCK_COMPANIES),

  // Specific Setters
  saveAppointment: (app: Appointment) => {
    const apps = demoStorage.getAppointments();
    const index = apps.findIndex(a => a.id === app.id);
    if (index >= 0) apps[index] = app;
    else apps.push(app);
    demoStorage.set(KEYS.APPOINTMENTS, apps);
  },
  deleteAppointment: (id: string) => {
    const apps = demoStorage.getAppointments().filter(a => a.id !== id);
    demoStorage.set(KEYS.APPOINTMENTS, apps);
  },
  deleteAppointments: (ids: string[]) => {
    const apps = demoStorage.getAppointments().filter(a => !ids.includes(a.id));
    demoStorage.set(KEYS.APPOINTMENTS, apps);
  },

  saveCustomer: (customer: Customer) => {
    const customers = demoStorage.getCustomers();
    const index = customers.findIndex(c => c.id === customer.id);
    if (index >= 0) customers[index] = customer;
    else customers.push(customer);
    demoStorage.set(KEYS.CUSTOMERS, customers);
  },
  deleteCustomer: (id: string) => {
    const customers = demoStorage.getCustomers().filter(c => c.id !== id);
    demoStorage.set(KEYS.CUSTOMERS, customers);
  },

  saveExpense: (expense: Expense) => {
    const expenses = demoStorage.getExpenses();
    const index = expenses.findIndex(e => e.id === expense.id);
    if (index >= 0) expenses[index] = expense;
    else expenses.push(expense);
    demoStorage.set(KEYS.EXPENSES, expenses);
  },
  deleteExpense: (id: string) => {
    const expenses = demoStorage.getExpenses().filter(e => e.id !== id);
    demoStorage.set(KEYS.EXPENSES, expenses);
  },

  saveMileage: (m: Mileage) => {
    const mileage = demoStorage.getMileage();
    const index = mileage.findIndex(item => item.id === m.id);
    if (index >= 0) mileage[index] = m;
    else mileage.push(m);
    demoStorage.set(KEYS.MILEAGE, mileage);
  },
  deleteMileage: (id: string) => {
    const mileage = demoStorage.getMileage().filter(m => m.id !== id);
    demoStorage.set(KEYS.MILEAGE, mileage);
  },

  saveCompany: (company: SigningCompany) => {
    const companies = demoStorage.getCompanies();
    const index = companies.findIndex(c => c.id === company.id);
    if (index >= 0) companies[index] = company;
    else companies.push(company);
    demoStorage.set(KEYS.COMPANIES, companies);
  },
  deleteCompany: (id: string) => {
    const companies = demoStorage.getCompanies().filter(c => c.id !== id);
    demoStorage.set(KEYS.COMPANIES, companies);
  },

  saveProfile: (profile: BusinessProfile) => {
    demoStorage.set(KEYS.PROFILE, profile);
  }
};
