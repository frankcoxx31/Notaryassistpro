import { Appointment, Client, Expense, Mileage, BusinessProfile, SigningCompany } from '../types';
import { 
  MOCK_APPOINTMENTS, 
  MOCK_CLIENTS, 
  MOCK_EXPENSES, 
  MOCK_MILEAGE, 
  MOCK_PROFILE,
  MOCK_COMPANIES
} from '../mockData';

const KEYS = {
  APPOINTMENTS: 'notarypro_demo_signings',
  CLIENTS: 'notarypro_demo_clients',
  EXPENSES: 'notarypro_demo_expenses',
  MILEAGE: 'notarypro_demo_mileage',
  PROFILE: 'notarypro_demo_profile',
  COMPANIES: 'notarypro_demo_companies',
  IS_DEMO: 'notarypro_is_demo'
};

export const demoStorage = {
  // Auth state
  isDemoMode: (): boolean => {
    return localStorage.getItem(KEYS.IS_DEMO) === 'true';
  },
  setDemoMode: (active: boolean) => {
    localStorage.setItem(KEYS.IS_DEMO, active ? 'true' : 'false');
  },

  // Reset all data
  resetAll: () => {
    localStorage.setItem(KEYS.APPOINTMENTS, JSON.stringify(MOCK_APPOINTMENTS));
    localStorage.setItem(KEYS.CLIENTS, JSON.stringify(MOCK_CLIENTS));
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
  getClients: () => demoStorage.get<Client[]>(KEYS.CLIENTS, MOCK_CLIENTS),
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

  saveClient: (client: Client) => {
    const clients = demoStorage.getClients();
    const index = clients.findIndex(c => c.id === client.id);
    if (index >= 0) clients[index] = client;
    else clients.push(client);
    demoStorage.set(KEYS.CLIENTS, clients);
  },
  deleteClient: (id: string) => {
    const clients = demoStorage.getClients().filter(c => c.id !== id);
    demoStorage.set(KEYS.CLIENTS, clients);
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
