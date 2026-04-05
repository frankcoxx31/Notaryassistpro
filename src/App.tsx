import React, { useState, useEffect, useCallback } from 'react';
import { 
  BrowserRouter as Router, 
  Routes, 
  Route, 
  Link, 
  useLocation,
  useNavigate
} from 'react-router-dom';
import { 
  LayoutDashboard, 
  Calendar, 
  Users, 
  DollarSign, 
  Settings, 
  Plus, 
  Search, 
  Bell, 
  User, 
  Menu, 
  X, 
  ChevronRight, 
  ChevronLeft,
  Clock, 
  MapPin, 
  CheckCircle2, 
  AlertCircle, 
  TrendingUp, 
  TrendingDown, 
  FileText, 
  MoreVertical, 
  Trash2, 
  Edit2,
  BookOpen,
  Library,
  HelpCircle,
  LogOut,
  Gauge,
  Building2,
  PenLine,
  Car,
  Newspaper,
  Wrench,
  Printer,
  Download,
  ChevronDown,
  Upload,
  Settings2,
  PlusCircle,
  List,
  RefreshCw,
  Phone,
  Banknote,
  Pencil,
  Map as MapIcon,
  Mail,
  Save,
  ShieldCheck
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  format, 
  isAfter, 
  isBefore, 
  startOfDay, 
  addDays, 
  subDays, 
  startOfMonth, 
  endOfMonth, 
  startOfWeek, 
  endOfWeek, 
  addMonths, 
  subMonths, 
  addWeeks, 
  subWeeks, 
  eachDayOfInterval, 
  isSameDay, 
  isSameMonth,
  parse
} from 'date-fns';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Cell, 
  PieChart, 
  Pie 
} from 'recharts';
import { cn } from './lib/utils';
import { Appointment, Client, Expense, AppointmentStatus, Mileage, BusinessProfile } from './types';
import { auth, db, provider } from './firebase';
import LoginPage from './components/LoginPage';
import { 
  onAuthStateChanged, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut,
  User as FirebaseUser
} from 'firebase/auth';
import { 
  collection, 
  onSnapshot, 
  query, 
  where, 
  doc, 
  setDoc, 
  deleteDoc, 
  updateDoc,
  getDoc,
  writeBatch,
  getDocFromServer
} from 'firebase/firestore';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

function handleFirestoreError(error: any, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid || '',
      email: auth.currentUser?.email || '',
      emailVerified: auth.currentUser?.emailVerified || false,
      isAnonymous: auth.currentUser?.isAnonymous || false,
      tenantId: auth.currentUser?.tenantId || '',
      providerInfo: auth.currentUser?.providerData.map((provider: any) => ({
        providerId: provider.providerId,
        displayName: provider.displayName || '',
        email: provider.email || '',
        photoUrl: provider.photoURL || ''
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// --- Mock Data ---
const MOCK_PROFILE: BusinessProfile = {
  name: 'Frank Cox',
  companyName: 'Cox Notary Services',
  email: 'frankcoxx31@gmail.com',
  phone: '(555) 987-6543',
  address: '789 Notary Way, Signing City, CA 90210',
  commissionNumber: '123456789',
  commissionExpiration: '2028-12-31'
};

const MOCK_MILEAGE: Mileage[] = [
  {
    id: '1',
    date: format(subDays(new Date(), 1), 'yyyy-MM-dd'),
    description: 'Post Office Drop-off',
    miles: 12.4,
    rate: 0.67,
    total: 8.31
  },
  {
    id: '2',
    date: format(subDays(new Date(), 3), 'yyyy-MM-dd'),
    description: 'Office Supplies Run',
    miles: 8.2,
    rate: 0.67,
    total: 5.49
  }
];

const MOCK_APPOINTMENTS: Appointment[] = [
  {
    id: '1',
    date: format(new Date(), 'yyyy-MM-dd'),
    time: '10:00 AM',
    clientName: 'John Smith',
    signingType: 'Refinance',
    location: '123 Maple St, Springfield',
    fee: 150,
    status: 'Scheduled',
    notes: 'Borrower needs to sign with blue ink.'
  },
  {
    id: '2',
    date: format(new Date(), 'yyyy-MM-dd'),
    time: '02:30 PM',
    clientName: 'Sarah Johnson',
    signingType: 'Purchase',
    location: '456 Oak Ave, Shelbyville',
    fee: 125,
    status: 'Scheduled'
  },
  {
    id: '3',
    date: format(subDays(new Date(), 1), 'yyyy-MM-dd'),
    time: '11:00 AM',
    clientName: 'Michael Brown',
    signingType: 'HELOC',
    location: '789 Pine Rd, Capital City',
    fee: 100,
    status: 'Completed'
  },
  {
    id: '4',
    date: format(addDays(new Date(), 2), 'yyyy-MM-dd'),
    time: '09:00 AM',
    clientName: 'Emily Davis',
    signingType: 'Seller Package',
    location: '321 Elm Blvd, Springfield',
    fee: 90,
    status: 'Scheduled'
  },
  {
    id: '5',
    date: '2026-04-02',
    time: '01:00 PM',
    clientName: 'Melissa Caballero',
    firstName: 'Melissa',
    lastName: 'Caballero',
    signingType: 'Attorney Hybrid Refinance',
    location: '1800 Nikkie Pl Indian Trail, NC 28079',
    address: '1800 Nikkie Pl',
    city: 'Indian Trail',
    state: 'North Carolina',
    zip: '28079',
    fee: 65,
    status: 'Scheduled',
    orderNumber: '75785626',
    loanNumber: '3582834992',
    durationHours: '1 hour',
    durationMinutes: '0 mins',
    notes: 'Cell: (980) 406-1463'
  }
];

const MOCK_CLIENTS: Client[] = [
  {
    id: '1',
    name: 'John Smith',
    company: 'ABC Title',
    email: 'john@abctitle.com',
    phone: '(555) 123-4567',
    address: '123 Maple St, Springfield'
  },
  {
    id: '2',
    name: 'Sarah Johnson',
    company: 'XYZ Signing',
    email: 'sarah@xyzsigning.com',
    phone: '(555) 987-6543',
    address: '456 Oak Ave, Shelbyville'
  },
  {
    id: '3',
    name: 'Melissa Caballero',
    company: 'Rocket Mortgage, LLC',
    email: '',
    phone: '(980) 406-1463',
    address: '1800 Nikkie Pl Indian Trail, NC 28079'
  }
];

const MOCK_EXPENSES: Expense[] = [
  {
    id: '1',
    date: format(subDays(new Date(), 2), 'yyyy-MM-dd'),
    category: 'Mileage',
    amount: 45.50,
    description: 'Trip to Capital City'
  },
  {
    id: '2',
    date: format(subDays(new Date(), 5), 'yyyy-MM-dd'),
    category: 'Supplies',
    amount: 25.00,
    description: 'Printer Ink'
  }
];

// --- Components ---

const NewSigningModal = ({ isOpen, onClose, appointment, onSave }: { isOpen: boolean; onClose: () => void; appointment?: Appointment | null; onSave: (app: Appointment) => void }) => {
  const [activeTab, setActiveTab] = useState('Signer(s)');
  const [formData, setFormData] = useState<Partial<Appointment>>({});

  useEffect(() => {
    if (appointment) {
      setFormData(appointment);
    } else {
      setFormData({
        id: Math.random().toString(36).substr(2, 9),
        date: format(new Date(), 'yyyy-MM-dd'),
        time: '10:00 AM',
        signingType: 'General Loan Signing Work',
        fee: 150,
        status: 'Scheduled',
        clientName: '',
        location: ''
      });
    }
  }, [appointment, isOpen]);

  if (!isOpen) return null;

  const handleSave = () => {
    if (formData.id && formData.date && formData.time && formData.clientName && formData.signingType && formData.location && formData.fee !== undefined && formData.status) {
      onSave(formData as Appointment);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-300">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-white rounded-lg shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-sky-50 rounded-lg flex items-center justify-center border border-sky-100">
              <Edit2 className="w-6 h-6 text-sky-600" />
            </div>
            <h2 className="text-2xl font-bold text-slate-800">{appointment ? 'View Signing' : 'New Signing'}:</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
          {/* Type of Work Section */}
          <div className="bg-slate-50/50 border border-slate-200 rounded-md p-4">
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-bold text-slate-700">Type of work:</label>
              <button className="text-sky-600 text-xs flex items-center gap-1 hover:underline">
                Help <HelpCircle className="w-3 h-3" />
              </button>
            </div>
            <select 
              value={formData.signingType || "General Loan Signing Work"}
              onChange={(e) => setFormData({ ...formData, signingType: e.target.value })}
              className="w-full bg-white border border-slate-300 rounded px-3 py-2 text-sm focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none transition-all"
            >
              <option>General Loan Signing Work</option>
              <option>Refinance</option>
              <option>Purchase</option>
              <option>Seller</option>
            </select>
          </div>

          {/* Main Form Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-4">
            {/* Left Column */}
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <label className="text-sm font-bold text-slate-700 w-20 text-right">Duration:</label>
                <div className="flex-1 flex gap-2">
                  <select 
                    value={formData.durationHours || "1 hour"}
                    onChange={(e) => setFormData({ ...formData, durationHours: e.target.value })}
                    className="flex-1 border border-slate-300 rounded px-2 py-2 text-sm outline-none focus:ring-1 focus:ring-sky-500"
                  >
                    <option>1 hour</option>
                    <option>2 hours</option>
                  </select>
                  <select 
                    value={formData.durationMinutes || "0 mins"}
                    onChange={(e) => setFormData({ ...formData, durationMinutes: e.target.value })}
                    className="flex-1 border border-slate-300 rounded px-2 py-2 text-sm outline-none focus:ring-1 focus:ring-sky-500"
                  >
                    <option>0 mins</option>
                    <option>30 mins</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <label className="text-sm font-bold text-slate-700 w-20 text-right">Amount:</label>
                <div className="flex-1 flex border border-slate-300 rounded overflow-hidden">
                  <div className="bg-slate-50 px-3 py-2 border-r border-slate-300 text-sm text-slate-500 font-medium">
                    $
                  </div>
                  <input 
                    type="number" 
                    value={formData.fee || 0} 
                    onChange={(e) => setFormData({ ...formData, fee: parseFloat(e.target.value) })}
                    className="flex-1 px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-sky-500" 
                  />
                </div>
              </div>
            </div>

            {/* Right Column */}
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <label className="text-sm font-bold text-slate-700 w-20 text-right">Order #:</label>
                <input 
                  type="text" 
                  value={formData.orderNumber || ""}
                  onChange={(e) => setFormData({ ...formData, orderNumber: e.target.value })}
                  className="flex-1 border border-slate-300 rounded px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-sky-500" 
                />
              </div>

              <div className="flex items-center gap-4">
                <label className="text-sm font-bold text-slate-700 w-20 text-right">Loan #:</label>
                <input 
                  type="text" 
                  value={formData.loanNumber || ""}
                  onChange={(e) => setFormData({ ...formData, loanNumber: e.target.value })}
                  className="flex-1 border border-slate-300 rounded px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-sky-500" 
                />
              </div>
            </div>
          </div>

          {/* Tabs Section */}
          <div className="border border-slate-200 rounded-md overflow-hidden">
            <div className="flex border-b border-slate-200 bg-slate-50">
              {[
                { name: 'Signer(s)', icon: User },
                { name: 'Contacts', icon: Phone },
                { name: 'Invoice', icon: Banknote },
                { name: 'Tracking', icon: List },
                { name: 'Notes', icon: Pencil },
              ].map((tab) => (
                <button
                  key={tab.name}
                  onClick={() => setActiveTab(tab.name)}
                  className={cn(
                    "flex items-center gap-2 px-6 py-3 text-sm font-bold transition-all border-r border-slate-200",
                    activeTab === tab.name 
                      ? "bg-white text-slate-800 border-t-2 border-t-indigo-500 -mt-px" 
                      : "text-slate-500 hover:text-slate-700 hover:bg-slate-100/50"
                  )}
                >
                  <tab.icon className={cn("w-4 h-4", activeTab === tab.name ? "text-indigo-500" : "text-slate-400")} />
                  {tab.name}
                </button>
              ))}
            </div>

            <div className="p-6 space-y-4">
              {activeTab === 'Signer(s)' && (
                <div className="space-y-4">
                  <div className="flex items-center gap-4">
                    <label className="text-sm font-bold text-slate-700 w-24 text-right">Last Name:</label>
                    <input 
                      type="text" 
                      value={formData.lastName || ""}
                      onChange={(e) => setFormData({ ...formData, lastName: e.target.value, clientName: `${formData.firstName || ''} ${e.target.value}`.trim() })}
                      className="flex-1 border border-slate-300 rounded px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-sky-500" 
                    />
                  </div>
                  <div className="flex items-center gap-4">
                    <label className="text-sm font-bold text-slate-700 w-24 text-right">First Name:</label>
                    <input 
                      type="text" 
                      value={formData.firstName || ""}
                      onChange={(e) => setFormData({ ...formData, firstName: e.target.value, clientName: `${e.target.value} ${formData.lastName || ''}`.trim() })}
                      className="flex-1 border border-slate-300 rounded px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-sky-500" 
                    />
                  </div>
                  <div className="flex items-center gap-4">
                    <label className="text-sm font-bold text-slate-700 w-24 text-right">Address:</label>
                    <input 
                      type="text" 
                      value={formData.address || ""}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value, location: `${e.target.value}, ${formData.city || ''}`.trim() })}
                      className="flex-1 border border-slate-300 rounded px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-sky-500" 
                    />
                  </div>
                  <div className="flex items-center gap-4">
                    <label className="text-sm font-bold text-slate-700 w-24 text-right">City:</label>
                    <input 
                      type="text" 
                      value={formData.city || ""}
                      onChange={(e) => setFormData({ ...formData, city: e.target.value, location: `${formData.address || ''}, ${e.target.value}`.trim() })}
                      className="flex-1 border border-slate-300 rounded px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-sky-500" 
                    />
                  </div>
                  <div className="flex items-center gap-4">
                    <label className="text-sm font-bold text-slate-700 w-24 text-right">State:</label>
                    <select 
                      value={formData.state || "North Carolina"}
                      onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                      className="flex-1 border border-slate-300 rounded px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-sky-500"
                    >
                      <option>North Carolina</option>
                      <option>California</option>
                      <option>Texas</option>
                    </select>
                  </div>
                  <div className="flex items-center gap-4">
                    <label className="text-sm font-bold text-slate-700 w-24 text-right">Zip:</label>
                    <input 
                      type="text" 
                      value={formData.zip || ""}
                      onChange={(e) => setFormData({ ...formData, zip: e.target.value })}
                      className="flex-1 border border-slate-300 rounded px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-sky-500" 
                    />
                  </div>
                </div>
              )}
              {activeTab !== 'Signer(s)' && (
                <div className="py-12 text-center text-slate-400 italic">
                  Content for {activeTab} tab will be implemented soon.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between">
          <div className="flex gap-2">
            <button className="bg-sky-400 hover:bg-sky-500 text-white px-4 py-2 rounded text-sm font-medium shadow-sm transition-colors">
              Invoice
            </button>
            <button className="bg-sky-400 hover:bg-sky-500 text-white px-4 py-2 rounded text-sm font-medium shadow-sm transition-colors flex items-center gap-2">
              Map
            </button>
            <button className="bg-sky-400 hover:bg-sky-500 text-white px-4 py-2 rounded text-sm font-medium shadow-sm transition-colors">
              Expenses
            </button>
            <button className="bg-sky-600 hover:bg-sky-700 text-white px-4 py-2 rounded text-sm font-medium shadow-sm transition-colors flex items-center gap-2">
              Send Email
            </button>
          </div>
          <div className="flex gap-2">
            <button 
              onClick={handleSave}
              className="bg-sky-400 hover:bg-sky-500 text-white px-8 py-2 rounded text-sm font-medium shadow-sm transition-colors flex items-center gap-2"
            >
              Save
            </button>
            <button onClick={onClose} className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 px-6 py-2 rounded text-sm font-medium shadow-sm transition-colors">
              Close
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

const NewExpenseModal = ({ isOpen, onClose, onSave }: { isOpen: boolean; onClose: () => void; onSave: (e: Expense) => void }) => {
  const [formData, setFormData] = useState<Partial<Expense>>({
    id: Math.random().toString(36).substr(2, 9),
    date: format(new Date(), 'yyyy-MM-dd'),
    category: '',
    amount: 0,
    description: ''
  });

  if (!isOpen) return null;

  const handleSave = () => {
    if (formData.id && formData.date && formData.category && formData.amount !== undefined && formData.description) {
      onSave(formData as Expense);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-300">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="bg-white rounded-lg shadow-2xl w-full max-w-2xl overflow-hidden border border-slate-200 flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-white shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-sky-600 rounded-lg flex items-center justify-center shadow-lg shadow-sky-200">
              <DollarSign className="w-6 h-6 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-slate-800">Expense:</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
          {/* Date */}
          <div className="flex items-center gap-4">
            <label className="w-24 text-sm font-bold text-slate-700 text-right">Date:</label>
            <div className="flex-1 relative">
              <input 
                type="date" 
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all"
              />
            </div>
          </div>

          {/* Payee */}
          <div className="flex items-center gap-4">
            <label className="w-24 text-sm font-bold text-slate-700 text-right">Payee:</label>
            <input 
              type="text" 
              placeholder="Required"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="flex-1 border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all"
            />
          </div>

          {/* Category */}
          <div className="flex items-center gap-4">
            <label className="w-24 text-sm font-bold text-slate-700 text-right">Category:</label>
            <select 
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              className="flex-1 border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all bg-white"
            >
              <option value=""></option>
              <option value="supplies">Supplies</option>
              <option value="travel">Travel</option>
              <option value="marketing">Marketing</option>
            </select>
          </div>

          {/* Amount */}
          <div className="flex items-center gap-4">
            <label className="w-24 text-sm font-bold text-slate-700 text-right">Amount:</label>
            <div className="flex-1 relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
              <input 
                type="number" 
                placeholder="0.00"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) })}
                className="w-full border border-slate-300 rounded pl-7 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all"
              />
            </div>
          </div>

          {/* Receipt */}
          <div className="flex items-start gap-4">
            <label className="w-24 text-sm font-bold text-slate-700 text-right mt-2">Receipt:</label>
            <div className="flex-1 border border-slate-200 rounded-lg p-4 bg-slate-50/50">
              <div className="w-full aspect-video border-2 border-dashed border-slate-200 rounded-lg flex flex-col items-center justify-center text-slate-300 mb-4 bg-white">
                <span className="text-4xl font-light italic">no receipt</span>
              </div>
              <button className="bg-white border border-slate-300 text-slate-700 px-4 py-2 rounded text-sm font-medium shadow-sm hover:bg-slate-50 transition-colors flex items-center gap-2">
                <PlusCircle className="w-4 h-4 text-sky-600" /> Select File
              </button>
            </div>
          </div>

          {/* Info Box */}
          <div className="ml-28 bg-sky-50 border border-sky-100 rounded p-4 text-[13px] text-sky-800 leading-relaxed">
            <p>This is a general business expense. If you would like to assign it to a different or more specific type of work, please select from the dropdown below</p>
            <button className="text-sky-600 hover:underline flex items-center gap-1 mt-1">
              Click here for more information <HelpCircle className="w-3 h-3" />
            </button>
          </div>

          {/* Type of work */}
          <div className="ml-28">
            <select className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all bg-white">
              <option>Select Type of work</option>
            </select>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-end gap-3 bg-slate-50/30 shrink-0">
          <button 
            onClick={onClose}
            className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 px-6 py-2 rounded text-sm font-medium shadow-sm transition-colors"
          >
            Cancel
          </button>
          <button 
            onClick={handleSave}
            className="bg-sky-500 hover:bg-sky-600 text-white px-8 py-2 rounded text-sm font-medium shadow-sm transition-colors"
          >
            Save
          </button>
        </div>
      </motion.div>
    </div>
  );
};

const ExpenseTypesModal = ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => {
  const [activeTab, setActiveTab] = useState('Expense Types');
  const [expenseTypes, setExpenseTypes] = useState([
    'Advertising and Promotions',
    'Automobile Expense',
    'Insurance',
    'Legal and Professional Fees',
    'License, Permits and Comission',
    'Meals and Entertainment',
    'Postage and Delivery',
    'Printing and Reproduction',
    'Repairs and Maintenance',
    'Supplies and Materials',
    'Telephone',
    'Training',
    'Travel'
  ]);

  if (!isOpen) return null;

  const removeType = (index: number) => {
    setExpenseTypes(expenseTypes.filter((_, i) => i !== index));
  };

  const addType = () => {
    setExpenseTypes([...expenseTypes, '']);
  };

  const updateType = (index: number, value: string) => {
    const newTypes = [...expenseTypes];
    newTypes[index] = value;
    setExpenseTypes(newTypes);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-300">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="bg-white rounded shadow-2xl w-full max-w-2xl overflow-hidden border border-slate-200 flex flex-col max-h-[90vh]"
      >
        {/* Tabs */}
        <div className="flex border-b border-slate-200 bg-slate-50">
          {[
            { name: 'Mileage', icon: Settings },
            { name: 'Notary Fees', icon: User },
            { name: 'Expense Types', icon: DollarSign },
          ].map((tab) => (
            <button
              key={tab.name}
              onClick={() => setActiveTab(tab.name)}
              className={cn(
                "flex items-center gap-2 px-6 py-3 text-sm font-bold transition-all border-r border-slate-200",
                activeTab === tab.name 
                  ? "bg-white text-slate-800 border-t-2 border-t-sky-500 -mt-px" 
                  : "text-slate-500 hover:text-slate-700 hover:bg-slate-100/50"
              )}
            >
              <tab.icon className={cn("w-4 h-4", activeTab === tab.name ? "text-sky-500" : "text-slate-400")} />
              {tab.name}
            </button>
          ))}
          <div className="flex-1 border-r border-slate-200"></div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
          {activeTab === 'Expense Types' ? (
            <div className="border border-slate-200 rounded overflow-hidden">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="text-left px-4 py-2 text-sm font-bold text-slate-700">Expense Type</th>
                    <th className="w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {expenseTypes.map((type, idx) => (
                    <tr key={idx} className="group">
                      <td className="p-2">
                        <input 
                          type="text" 
                          value={type}
                          onChange={(e) => updateType(idx, e.target.value)}
                          className="w-full border border-slate-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-sky-500 transition-all"
                        />
                      </td>
                      <td className="p-2 text-center">
                        <button 
                          onClick={() => removeType(idx)}
                          className="text-slate-300 hover:text-rose-500 transition-colors"
                        >
                          <X className="w-5 h-5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="py-12 text-center text-slate-400 italic">
              Content for {activeTab} will be implemented soon.
            </div>
          )}

          {activeTab === 'Expense Types' && (
            <div className="flex justify-end">
              <button 
                onClick={addType}
                className="bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-1.5 rounded text-sm font-bold flex items-center gap-2 shadow-sm transition-colors"
              >
                <Plus className="w-4 h-4" /> Add
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-end gap-3 bg-white shrink-0">
          <button 
            onClick={onClose}
            className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 px-6 py-2 rounded text-sm font-medium shadow-sm transition-colors"
          >
            Cancel
          </button>
          <button className="bg-sky-600 hover:bg-sky-700 text-white px-8 py-2 rounded text-sm font-medium shadow-sm transition-colors">
            Save
          </button>
        </div>
      </motion.div>
    </div>
  );
};

const RecurringExpenseModal = ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-300">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="bg-white rounded-lg shadow-2xl w-full max-w-2xl overflow-hidden border border-slate-200 flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-white shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-600 rounded-lg flex items-center justify-center shadow-lg shadow-indigo-200">
              <RefreshCw className="w-6 h-6 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-slate-800">Recurring Expense:</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
          {/* Payee */}
          <div className="flex items-center gap-4">
            <label className="w-24 text-sm font-bold text-slate-700 text-right">Payee:</label>
            <input 
              type="text" 
              placeholder="Required"
              className="flex-1 border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
            />
          </div>

          {/* Category */}
          <div className="flex items-center gap-4">
            <label className="w-24 text-sm font-bold text-slate-700 text-right">Category:</label>
            <select className="flex-1 border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all bg-white">
              <option value=""></option>
              <option value="software">Software Subscription</option>
              <option value="rent">Office Rent</option>
              <option value="insurance">Insurance</option>
              <option value="marketing">Marketing</option>
            </select>
          </div>

          {/* Amount */}
          <div className="flex items-center gap-4">
            <label className="w-24 text-sm font-bold text-slate-700 text-right">Amount:</label>
            <div className="flex-1 relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
              <input 
                type="text" 
                placeholder="0.00"
                className="w-full border border-slate-300 rounded pl-7 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
              />
            </div>
          </div>

          {/* Frequency */}
          <div className="flex items-center gap-4">
            <label className="w-24 text-sm font-bold text-slate-700 text-right">Frequency:</label>
            <select className="flex-1 border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all bg-white">
              <option value="weekly">Weekly</option>
              <option value="bi-weekly">Bi-weekly</option>
              <option value="monthly" selected>Monthly</option>
              <option value="quarterly">Quarterly</option>
              <option value="yearly">Yearly</option>
            </select>
          </div>

          {/* Start Date */}
          <div className="flex items-center gap-4">
            <label className="w-24 text-sm font-bold text-slate-700 text-right">Start Date:</label>
            <div className="flex-1 relative">
              <input 
                type="text" 
                defaultValue="04/04/2026"
                className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
              />
              <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            </div>
          </div>

          {/* End Date */}
          <div className="flex items-center gap-4">
            <label className="w-24 text-sm font-bold text-slate-700 text-right">End Date:</label>
            <div className="flex-1 relative">
              <input 
                type="text" 
                placeholder="Optional (Never ends)"
                className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
              />
              <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            </div>
          </div>

          {/* Details */}
          <div className="flex items-start gap-4">
            <label className="w-24 text-sm font-bold text-slate-700 text-right mt-2">Description:</label>
            <textarea 
              placeholder="Add any additional details..."
              className="flex-1 border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all min-h-[80px] resize-none"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-end gap-3 bg-slate-50/30 shrink-0">
          <button 
            onClick={onClose}
            className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 px-6 py-2 rounded text-sm font-medium shadow-sm transition-colors"
          >
            Cancel
          </button>
          <button className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-2 rounded text-sm font-medium shadow-sm transition-colors">
            Create Recurring
          </button>
        </div>
      </motion.div>
    </div>
  );
};

const NewMileageModal = ({ isOpen, onClose, onSave }: { isOpen: boolean; onClose: () => void; onSave: (m: Mileage) => void }) => {
  const [formData, setFormData] = useState<Partial<Mileage>>({
    id: Math.random().toString(36).substr(2, 9),
    date: format(new Date(), 'yyyy-MM-dd'),
    description: '',
    miles: 0,
    rate: 0.67,
    total: 0
  });

  useEffect(() => {
    setFormData(prev => ({ ...prev, total: (prev.miles || 0) * (prev.rate || 0.67) }));
  }, [formData.miles, formData.rate]);

  if (!isOpen) return null;

  const handleSave = () => {
    if (formData.id && formData.date && formData.description && formData.miles !== undefined && formData.rate !== undefined && formData.total !== undefined) {
      onSave(formData as Mileage);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-300">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="bg-white rounded-lg shadow-2xl w-full max-w-2xl overflow-hidden border border-slate-200 flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-white shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-600 rounded-lg flex items-center justify-center shadow-lg shadow-emerald-200">
              <Car className="w-6 h-6 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-slate-800">Extra Mileage:</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
          {/* Date */}
          <div className="flex items-center gap-4">
            <label className="w-24 text-sm font-bold text-slate-700 text-right">Date:</label>
            <div className="flex-1 relative">
              <input 
                type="date" 
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
              />
            </div>
          </div>

          {/* Description */}
          <div className="flex items-center gap-4">
            <label className="w-24 text-sm font-bold text-slate-700 text-right">Description:</label>
            <input 
              type="text" 
              placeholder="e.g. Post Office, Bank, Supplies"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="flex-1 border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
            />
          </div>

          {/* Miles */}
          <div className="flex items-center gap-4">
            <label className="w-24 text-sm font-bold text-slate-700 text-right">Miles:</label>
            <input 
              type="number" 
              placeholder="0.0"
              value={formData.miles}
              onChange={(e) => setFormData({ ...formData, miles: parseFloat(e.target.value) })}
              className="flex-1 border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
            />
          </div>

          {/* Rate */}
          <div className="flex items-center gap-4">
            <label className="w-24 text-sm font-bold text-slate-700 text-right">Rate:</label>
            <div className="flex-1 relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
              <input 
                type="number" 
                value={formData.rate}
                onChange={(e) => setFormData({ ...formData, rate: parseFloat(e.target.value) })}
                className="w-full border border-slate-300 rounded pl-7 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-end gap-3 bg-slate-50/30 shrink-0">
          <button 
            onClick={onClose}
            className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 px-6 py-2 rounded text-sm font-medium shadow-sm transition-colors"
          >
            Cancel
          </button>
          <button 
            onClick={handleSave}
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-2 rounded text-sm font-medium shadow-sm transition-colors"
          >
            Save Mileage
          </button>
        </div>
      </motion.div>
    </div>
  );
};

const MileageView = ({ mileage, onNewMileage, onDeleteMileage }: { mileage: Mileage[]; onNewMileage: () => void; onDeleteMileage: (id: string) => void }) => {
  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Extra Mileage</h1>
          <p className="text-slate-500">Track business-related travel outside of signing appointments.</p>
        </div>
        <button 
          onClick={onNewMileage}
          className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-sm flex items-center justify-center gap-2"
        >
          <Plus className="w-4 h-4" /> Add Mileage
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-200 text-[13px] font-bold text-slate-700 uppercase tracking-wider">
                <th className="px-6 py-4">Date</th>
                <th className="px-6 py-4">Description</th>
                <th className="px-6 py-4">Miles</th>
                <th className="px-6 py-4">Rate</th>
                <th className="px-6 py-4">Total</th>
                <th className="px-6 py-4 w-20"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-[14px]">
              {mileage.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50/50 transition-colors group">
                  <td className="px-6 py-4 text-slate-600">{format(new Date(item.date), 'MM/dd/yyyy')}</td>
                  <td className="px-6 py-4 font-medium text-slate-900">{item.description}</td>
                  <td className="px-6 py-4 text-slate-600">{item.miles.toFixed(1)}</td>
                  <td className="px-6 py-4 text-slate-600">${item.rate.toFixed(2)}</td>
                  <td className="px-6 py-4 font-bold text-emerald-600">${item.total.toFixed(2)}</td>
                  <td className="px-6 py-4 text-right">
                    <button 
                      onClick={() => onDeleteMileage(item.id)}
                      className="p-2 hover:bg-rose-50 rounded-lg text-slate-300 hover:text-rose-600 opacity-0 group-hover:opacity-100 transition-all"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
              {mileage.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-400 italic">
                    No extra mileage recorded.
                  </td>
                </tr>
              )}
            </tbody>
            {mileage.length > 0 && (
              <tfoot>
                <tr className="bg-slate-50/30 font-bold border-t border-slate-200">
                  <td colSpan={2} className="px-6 py-4 text-right text-slate-700">Totals:</td>
                  <td className="px-6 py-4 text-slate-900">{mileage.reduce((sum, m) => sum + m.miles, 0).toFixed(1)}</td>
                  <td></td>
                  <td className="px-6 py-4 text-emerald-600">${mileage.reduce((sum, m) => sum + m.total, 0).toFixed(2)}</td>
                  <td></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
};

const Reports = () => {
  const location = useLocation();
  const currentPath = location.pathname;

  const reports = [
    { id: 'income', title: 'Income Report', description: 'Detailed breakdown of all earnings and revenue sources.' },
    { id: 'unpaid', title: 'Unpaid Report', description: 'List of all outstanding invoices and pending payments.' },
    { id: 'signing-type', title: 'Signing Type Report', description: 'Analysis of business volume by type of signing service.' },
    { id: 'profit-loss', title: 'Profit & Loss', description: 'Summary of revenue, costs, and expenses incurred during a specific period.' },
    { id: 'expenses', title: 'Expense Report', description: 'Categorized list of all business-related expenditures.' },
    { id: 'mileage', title: 'Mileage Report', description: 'Comprehensive log of all business travel and associated costs.' },
    { id: 'tax', title: 'Tax Report', description: 'Summary of taxable income and deductible expenses for tax filing.' },
    { id: 'tax-summary', title: 'Tax Summary', description: 'High-level overview of tax liabilities and estimated payments.' },
  ];

  const activeReport = reports.find(r => currentPath.includes(r.id)) || reports[0];

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{activeReport.title}</h1>
          <p className="text-slate-500">{activeReport.description}</p>
        </div>
        <div className="flex items-center gap-2">
          <button className="bg-white border border-slate-300 text-slate-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors flex items-center gap-2 shadow-sm">
            <Printer className="w-4 h-4" /> Print
          </button>
          <button className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors flex items-center gap-2 shadow-sm">
            <Download className="w-4 h-4" /> Export CSV
          </button>
        </div>
      </div>

      {/* Report Filters */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-wrap items-center gap-4">
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Date Range</label>
          <select className="bg-slate-50 border border-slate-200 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 w-48">
            <option>This Year</option>
            <option>Last Year</option>
            <option>This Quarter</option>
            <option>Last Quarter</option>
            <option>This Month</option>
            <option>Last Month</option>
            <option>Custom Range</option>
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Customer</label>
          <select className="bg-slate-50 border border-slate-200 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 w-48">
            <option>All Customers</option>
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Status</label>
          <select className="bg-slate-50 border border-slate-200 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 w-48">
            <option>All Statuses</option>
            <option>Paid</option>
            <option>Unpaid</option>
          </select>
        </div>
        <div className="flex-1"></div>
        <button className="mt-4 sm:mt-0 bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-lg text-sm font-medium transition-colors">
          Run Report
        </button>
      </div>

      {/* Report Content Placeholder */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden min-h-[400px] flex flex-col items-center justify-center p-12 text-center">
        <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-6">
          <Newspaper className="w-10 h-10 text-slate-300" />
        </div>
        <h3 className="text-lg font-bold text-slate-900 mb-2">No Data for Selected Period</h3>
        <p className="text-slate-500 max-w-md mx-auto">
          There are no records matching your current filter criteria for the {activeReport.title.toLowerCase()}. Try adjusting your date range or filters.
        </p>
      </div>
    </div>
  );
};

const BusinessProfileModal = ({ isOpen, onClose, profile, onSave }: { isOpen: boolean; onClose: () => void; profile: BusinessProfile; onSave: (p: BusinessProfile) => void }) => {
  const [formData, setFormData] = useState<BusinessProfile>(profile);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-300">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="bg-white rounded-lg shadow-2xl w-full max-w-2xl overflow-hidden border border-slate-200 flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-white shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-500 rounded-lg flex items-center justify-center shadow-lg shadow-amber-200">
              <User className="w-6 h-6 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-slate-800">Business Profile</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700">Full Name</label>
              <input 
                type="text" 
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full border border-slate-200 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700">Company Name</label>
              <input 
                type="text" 
                value={formData.companyName}
                onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                className="w-full border border-slate-200 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700">Email Address</label>
              <input 
                type="email" 
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full border border-slate-200 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700">Phone Number</label>
              <input 
                type="tel" 
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full border border-slate-200 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all"
              />
            </div>
            <div className="md:col-span-2 space-y-2">
              <label className="text-sm font-bold text-slate-700">Business Address</label>
              <input 
                type="text" 
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                className="w-full border border-slate-200 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700">Commission #</label>
              <input 
                type="text" 
                value={formData.commissionNumber}
                onChange={(e) => setFormData({ ...formData, commissionNumber: e.target.value })}
                className="w-full border border-slate-200 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700">Commission Expiration</label>
              <input 
                type="date" 
                value={formData.commissionExpiration}
                onChange={(e) => setFormData({ ...formData, commissionExpiration: e.target.value })}
                className="w-full border border-slate-200 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all"
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-end gap-3 bg-slate-50/30 shrink-0">
          <button 
            onClick={onClose}
            className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 px-6 py-2 rounded-xl text-sm font-medium shadow-sm transition-colors"
          >
            Cancel
          </button>
          <button 
            onClick={() => onSave(formData)}
            className="bg-amber-500 hover:bg-amber-600 text-white px-8 py-2 rounded-xl text-sm font-medium shadow-sm transition-colors flex items-center gap-2"
          >
            <Save className="w-4 h-4" /> Save Profile
          </button>
        </div>
      </motion.div>
    </div>
  );
};

const SettingsView = ({ onEditProfile, user, onSignIn }: { onEditProfile: () => void, user: FirebaseUser | null, onSignIn: () => void }) => {
  const handleFileImport = (type: 'pdf' | 'csv') => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = type === 'pdf' ? '.pdf' : '.csv';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        // In a real app, we would parse the file here
        // For now, we'll show a success message
        alert(`Successfully imported ${file.name}. In a production environment, this data would now be parsed and added to your signings.`);
      }
    };
    input.click();
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Settings</h1>
        <p className="text-slate-500">Manage your business profile and data imports.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Import Signings */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-indigo-50 rounded-lg flex items-center justify-center">
              <Upload className="w-5 h-5 text-indigo-600" />
            </div>
            <h3 className="font-bold text-slate-900 text-lg">Import Signings</h3>
          </div>
          <p className="text-sm text-slate-500">Bulk upload your signing appointments from existing files.</p>
          
          <div className="space-y-3 pt-2">
            <div 
              onClick={() => handleFileImport('pdf')}
              className="flex items-center justify-between p-3 border border-slate-100 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer group"
            >
              <div className="flex items-center gap-3">
                <FileText className="w-5 h-5 text-red-500" />
                <span className="text-sm font-medium text-slate-700">Import from PDF</span>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-slate-500 transition-colors" />
            </div>
            
            <div 
              onClick={() => handleFileImport('csv')}
              className="flex items-center justify-between p-3 border border-slate-100 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer group"
            >
              <div className="flex items-center gap-3">
                <Newspaper className="w-5 h-5 text-emerald-500" />
                <span className="text-sm font-medium text-slate-700">Import from CSV</span>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-slate-500 transition-colors" />
            </div>
          </div>
        </div>

        {/* Profile Settings */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-slate-50 rounded-lg flex items-center justify-center">
              <User className="w-5 h-5 text-slate-600" />
            </div>
            <h3 className="font-bold text-slate-900 text-lg">Business Profile</h3>
          </div>
          <p className="text-sm text-slate-500">Update your contact information and notary credentials.</p>
          <button 
            onClick={onEditProfile}
            className="w-full py-2.5 border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-all"
          >
            Edit Profile
          </button>
        </div>

        {/* Firestore Settings */}
        {!user && (
          <div className="bg-white p-6 rounded-2xl border border-indigo-100 shadow-sm space-y-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-indigo-50 rounded-lg flex items-center justify-center">
                <ShieldCheck className="w-5 h-5 text-indigo-600" />
              </div>
              <h3 className="font-bold text-slate-900 text-lg">Firestore Connection</h3>
            </div>
            <p className="text-sm text-slate-500">Connect to Firestore to sync your data across devices and enable real-time updates.</p>
            <button 
              onClick={onSignIn}
              className="w-full py-2.5 bg-indigo-600 rounded-xl text-sm font-semibold text-white hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-600/20 flex items-center justify-center gap-2"
            >
              <User className="w-4 h-4" />
              Sign In to Firestore
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

const ToolsView = () => {
  const [signingDate, setSigningDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  
  // Federal Holidays 2026 (Simplified)
  const FEDERAL_HOLIDAYS_2026 = [
    '2026-01-01', // New Year's Day
    '2026-01-19', // MLK Day
    '2026-02-16', // Presidents Day
    '2026-05-25', // Memorial Day
    '2026-06-19', // Juneteenth
    '2026-07-04', // Independence Day
    '2026-09-07', // Labor Day
    '2026-10-12', // Columbus Day
    '2026-11-11', // Veterans Day
    '2026-11-26', // Thanksgiving
    '2026-12-25', // Christmas
  ];

  // Recession calculation (3 business days, excluding Sundays and federal holidays)
  const calculateRecessionDate = (dateStr: string) => {
    const date = new Date(dateStr);
    let businessDaysAdded = 0;
    let resultDate = new Date(date);
    
    while (businessDaysAdded < 3) {
      resultDate.setDate(resultDate.getDate() + 1);
      const formattedDate = format(resultDate, 'yyyy-MM-dd');
      
      // Skip Sundays (0) and Federal Holidays
      if (resultDate.getDay() !== 0 && !FEDERAL_HOLIDAYS_2026.includes(formattedDate)) {
        businessDaysAdded++;
      }
    }
    return format(resultDate, 'EEEE, MMMM do, yyyy');
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Tools</h1>
        <p className="text-slate-500">Helpful utilities for your daily notary work.</p>
      </div>

      <div className="max-w-2xl">
        <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm space-y-6">
          <div className="flex items-center gap-4 mb-2">
            <div className="w-12 h-12 bg-amber-50 rounded-xl flex items-center justify-center">
              <Calendar className="w-6 h-6 text-amber-600" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-xl">Recession Calendar</h3>
              <p className="text-sm text-slate-500">Calculate the "Right to Cancel" date for loan signings.</p>
            </div>
          </div>

          <div className="space-y-4 pt-4 border-t border-slate-100">
            <div className="flex flex-col gap-2">
              <label className="text-sm font-bold text-slate-700">Signing Date</label>
              <input 
                type="date" 
                value={signingDate}
                onChange={(e) => setSigningDate(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all"
              />
            </div>

            <div className="bg-amber-50 p-6 rounded-2xl border border-amber-100 mt-6">
              <p className="text-xs font-bold text-amber-700 uppercase tracking-widest mb-2">Recession Ends At Midnight On:</p>
              <p className="text-2xl font-bold text-amber-900">{calculateRecessionDate(signingDate)}</p>
              <p className="text-xs text-amber-600 mt-4 italic">
                * Calculation assumes standard 3-day rescission period. Always verify against specific lender instructions and federal holiday schedules.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const Sidebar = ({ 
  isOpen, 
  toggle, 
  onNewSigning, 
  onNewExpense, 
  onExpenseTypes, 
  onRecurringExpense, 
  onNewMileage,
  user,
  onSignIn,
  onSignOut
}: { 
  isOpen: boolean; 
  toggle: () => void; 
  onNewSigning: () => void; 
  onNewExpense: () => void; 
  onExpenseTypes: () => void; 
  onRecurringExpense: () => void; 
  onNewMileage: () => void;
  user: FirebaseUser | null;
  onSignIn: () => void;
  onSignOut: () => void;
}) => {
  const location = useLocation();
  const [isSigningsOpen, setIsSigningsOpen] = useState(true);
  const [isExpensesOpen, setIsExpensesOpen] = useState(false);
  const [isMileageOpen, setIsMileageOpen] = useState(false);
  const [isReportsOpen, setIsReportsOpen] = useState(false);
  
  const navItems = [
    { name: 'Dashboard', icon: Gauge, path: '/' },
    { 
      name: 'Signings', 
      icon: PenLine, 
      path: '/appointments',
      isOpen: isSigningsOpen,
      setIsOpen: setIsSigningsOpen,
      subItems: [
        { name: 'View Signings', icon: List, path: '/appointments' },
        { name: 'New Signing', icon: PlusCircle, path: '#', onClick: onNewSigning },
      ]
    },
    { name: 'Calendar', icon: Calendar, path: '/calendar' },
    { name: 'Customers', icon: Users, path: '/clients' },
    { 
      name: 'Expenses', 
      icon: DollarSign, 
      path: '/accounting',
      isOpen: isExpensesOpen,
      setIsOpen: setIsExpensesOpen,
      subItems: [
        { name: 'View Expenses', path: '/accounting' },
        { name: 'New Expense', path: '#', onClick: onNewExpense },
        { name: 'Expense Types', path: '#', onClick: onExpenseTypes },
        { name: 'Recurring', path: '#', onClick: onRecurringExpense },
      ]
    },
    { 
      name: 'Extra Mileage', 
      icon: Car, 
      path: '/mileage',
      isOpen: isMileageOpen,
      setIsOpen: setIsMileageOpen,
      subItems: [
        { name: 'View Extra Mileage', path: '/mileage' },
        { name: 'New Extra Mileage', path: '#', onClick: onNewMileage },
      ]
    },
    { 
      name: 'Reports', 
      icon: Newspaper, 
      path: '/reports',
      isOpen: isReportsOpen,
      setIsOpen: setIsReportsOpen,
      subItems: [
        { name: 'Income Report', path: '/reports/income' },
        { name: 'Unpaid Report', path: '/reports/unpaid' },
        { name: 'Signing Type', path: '/reports/signing-type' },
        { name: 'Profit & Loss', path: '/reports/profit-loss' },
        { name: 'Expense Report', path: '/reports/expenses' },
        { name: 'Mileage Report', path: '/reports/mileage' },
        { name: 'Tax Report', path: '/reports/tax' },
        { name: 'Tax Summary', path: '/reports/tax-summary' },
      ]
    },
    { name: 'Settings', icon: Settings, path: '/settings' },
    { name: 'Tools', icon: Wrench, path: '/tools' },
    !user ? { name: 'Firestore Login', icon: ShieldCheck, path: '#', onClick: onSignIn } : null,
  ].filter(Boolean) as any[];

  return (
    <>
      {/* Mobile Overlay */}
      <AnimatePresence>
        {isOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={toggle}
            className="fixed inset-0 bg-black/60 z-40 lg:hidden backdrop-blur-sm"
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <motion.aside
        initial={false}
        animate={{ x: isOpen ? 0 : -280 }}
        className={cn(
          "fixed top-0 left-0 bottom-0 w-[280px] bg-[#0f172a] text-amber-400/70 z-50 transition-all duration-300 ease-in-out lg:translate-x-0 border-r border-white/5",
          !isOpen && "lg:w-[80px]"
        )}
      >
        <div className="flex flex-col h-full">
          {/* Logo / Header Area */}
          <div className="h-16 flex items-center px-6 border-b border-white/5">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-indigo-500 rounded-lg flex items-center justify-center shadow-lg shadow-indigo-500/20">
                <FileText className="w-5 h-5 text-amber-400" />
              </div>
              {isOpen && (
                <span className="font-bold text-xl text-amber-400 tracking-tight">NotaryPro App</span>
              )}
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 py-4 px-2 space-y-0.5 overflow-y-auto custom-scrollbar">
            {navItems.map((item) => {
              const isActive = location.pathname === item.path || item.subItems?.some((s: any) => location.pathname === s.path);
              const hasSubItems = !!item.subItems;

              return (
                <div key={item.name}>
                  <Link
                    to={item.path}
                    onClick={(e) => {
                      if (item.onClick) {
                        e.preventDefault();
                        item.onClick();
                      } else if (hasSubItems) {
                        e.preventDefault();
                        if (item.setIsOpen) {
                          item.setIsOpen(!item.isOpen);
                        }
                      }
                    }}
                    className={cn(
                      "flex items-center gap-4 px-4 py-3 transition-all duration-200 group relative",
                      isActive && !hasSubItems
                        ? "bg-white/5 text-amber-400" 
                        : "hover:bg-white/5 hover:text-amber-400 text-amber-400/70"
                    )}
                  >
                    <item.icon className={cn(
                      "w-6 h-6 transition-colors",
                      isActive ? "text-amber-400" : "text-amber-400/60 group-hover:text-amber-400"
                    )} />
                    {isOpen && (
                      <div className="flex-1 flex items-center justify-between">
                        <span className="text-[15px] font-medium tracking-wide">{item.name}</span>
                        {hasSubItems && (
                          <ChevronDown className={cn("w-4 h-4 transition-transform", item.isOpen && "rotate-180")} />
                        )}
                      </div>
                    )}
                    {isActive && isOpen && !hasSubItems && (
                      <div className="absolute right-0 w-1 h-full bg-indigo-500" />
                    )}
                  </Link>

                  {/* Sub Items */}
                  {hasSubItems && item.isOpen && isOpen && (
                    <div className="mt-1 space-y-0.5 relative">
                      {/* Vertical line for sub-items */}
                      <div className="absolute left-[27px] top-0 bottom-4 w-px bg-white/10" />
                      
                      {item.subItems.map((sub: any) => {
                        const isSubActive = location.pathname === sub.path;
                        const isAction = !!sub.onClick;

                        return (
                          <div key={sub.name} className="relative">
                            {/* Horizontal line for sub-item */}
                            <div className="absolute left-[27px] top-1/2 w-4 h-px bg-white/10" />
                            
                            {isAction ? (
                              <button
                                onClick={sub.onClick}
                                className={cn(
                                  "w-full flex items-center gap-4 pl-14 pr-4 py-2.5 transition-all duration-200 group relative",
                                  "text-amber-400/70 hover:text-amber-400 hover:bg-white/5"
                                )}
                              >
                                <span className="text-[14px] font-medium">{sub.name}</span>
                              </button>
                            ) : (
                              <Link
                                to={sub.path}
                                className={cn(
                                  "flex items-center gap-4 pl-14 pr-4 py-2.5 transition-all duration-200 group relative",
                                  isSubActive ? "text-amber-400 bg-white/5" : "text-amber-400/70 hover:text-amber-400 hover:bg-white/5"
                                )}
                              >
                                <span className="text-[14px] font-medium">{sub.name}</span>
                                {isSubActive && (
                                  <div className="absolute right-0 w-1 h-full bg-indigo-500" />
                                )}
                              </Link>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </nav>

          {/* User Profile */}
          <div className="p-4 border-t border-white/5 bg-black/10">
            {user ? (
              <div className={cn(
                "flex items-center gap-3 p-2 rounded-xl hover:bg-white/5 transition-colors cursor-pointer group",
                !isOpen && "justify-center"
              )}>
                <div className="w-10 h-10 rounded-full bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center overflow-hidden">
                  {user.photoURL ? (
                    <img src={user.photoURL} alt={user.displayName || 'User'} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    <User className="w-6 h-6 text-indigo-400" />
                  )}
                </div>
                {isOpen && (
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-amber-400 truncate">{user.displayName || 'Frank Cox'}</p>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        onSignOut();
                      }}
                      className="text-[10px] text-amber-400/50 hover:text-rose-400 transition-colors flex items-center gap-1"
                    >
                      <LogOut className="w-3 h-3" /> Sign Out
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className={cn(
                "flex flex-col gap-2 p-2 rounded-xl bg-white/5 transition-colors group",
                !isOpen && "items-center"
              )}>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center overflow-hidden">
                    <User className="w-6 h-6 text-amber-400" />
                  </div>
                  {isOpen && (
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-amber-400 truncate">Demo User</p>
                      <button 
                        onClick={onSignOut}
                        className="text-[10px] text-amber-400/50 hover:text-rose-400 transition-colors flex items-center gap-1"
                      >
                        <LogOut className="w-3 h-3" /> Sign Out
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </motion.aside>
    </>
  );
};

const Header = ({ toggleSidebar }: { toggleSidebar: () => void }) => {
  return (
    <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 lg:px-8 sticky top-0 z-30">
      <div className="flex items-center gap-4">
        <button 
          onClick={toggleSidebar}
          className="p-2 hover:bg-slate-100 rounded-lg transition-colors lg:hidden"
        >
          <Menu className="w-5 h-5 text-slate-600" />
        </button>
        <div className="relative hidden md:block">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input 
            type="text" 
            placeholder="Search appointments, clients..." 
            className="pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 w-[300px] transition-all"
          />
        </div>
      </div>
      <div className="flex items-center gap-2 md:gap-4">
        <button className="p-2 hover:bg-slate-100 rounded-lg transition-colors relative">
          <Bell className="w-5 h-5 text-slate-600" />
          <span className="absolute top-2 right-2 w-2 h-2 bg-rose-500 rounded-full border-2 border-white"></span>
        </button>
        <button className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-sm font-medium transition-all shadow-sm shadow-indigo-200">
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">New Signing</span>
        </button>
      </div>
    </header>
  );
};

const Dashboard = ({ appointments, expenses }: { appointments: Appointment[]; expenses: Expense[] }) => {
  const nextSigning = appointments
    .filter(a => a.status === 'Scheduled' && (a.date === format(new Date(), 'yyyy-MM-dd')))
    .sort((a, b) => a.time.localeCompare(b.time))[0];

  const monthlyData = [
    { name: 'January', signings: 0 },
    { name: 'February', signings: 8 },
    { name: 'March', signings: 34 },
    { name: 'April', signings: 9 },
    { name: 'May', signings: 0 },
    { name: 'June', signings: 0 },
    { name: 'July', signings: 0 },
    { name: 'August', signings: 0 },
    { name: 'September', signings: 0 },
    { name: 'October', signings: 0 },
    { name: 'November', signings: 0 },
    { name: 'December', signings: 0 },
  ];

  const stats = [
    { label: 'SIGNINGS', value: '51', color: 'text-sky-600', help: true },
    { label: 'INCOME', value: '$1,795.00', color: 'text-sky-600', help: true },
    { label: 'UNPAID', value: '$2,835.00', color: 'text-rose-700', help: false },
    { label: 'TOTAL', value: '$4,630.00', color: 'text-slate-900', help: false },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-700">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center pb-6 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Frank Coxx</h1>
          <p className="text-slate-500 font-medium">{format(new Date(), 'EEEE, MMMM do yyyy')}</p>
        </div>
        <div className="text-right mt-4 md:mt-0">
          <p className="text-sm font-bold text-slate-900">Next Signing</p>
          <p className="text-sm text-slate-500">Today 3:00 PM</p>
          <p className="text-sm text-slate-500">Monroe</p>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-slate-50/50 border border-slate-200 rounded-lg p-3 flex gap-3">
        <div className="relative">
          <select className="appearance-none bg-white border border-slate-300 rounded px-3 py-1.5 pr-8 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500">
            <option>2026</option>
          </select>
          <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none">
            <ChevronRight className="w-3 h-3 text-slate-400 rotate-90" />
          </div>
        </div>
        <div className="relative">
          <select className="appearance-none bg-white border border-slate-300 rounded px-10 py-1.5 pr-8 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500">
            <option>Monthly number of signings</option>
          </select>
          <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none">
            <ChevronRight className="w-3 h-3 text-slate-400 rotate-90" />
          </div>
        </div>
      </div>

      {/* Main Chart Section */}
      <div className="bg-white border border-slate-200 rounded-lg p-8 shadow-sm">
        {/* Stats Summary */}
        <div className="flex justify-end gap-8 mb-12">
          {stats.map((s) => (
            <div key={s.label} className="text-right">
              <div className="flex items-center justify-end gap-1 mb-1">
                <span className="text-[10px] font-bold text-slate-500 tracking-wider">{s.label}</span>
                {s.help && <HelpCircle className="w-3 h-3 text-sky-600" />}
              </div>
              <p className={cn("text-xl font-medium", s.color)}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* Chart */}
        <div className="h-[400px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={monthlyData} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis 
                dataKey="name" 
                axisLine={{ stroke: '#e2e8f0' }} 
                tickLine={{ stroke: '#e2e8f0' }} 
                tick={{ fill: '#64748b', fontSize: 12 }} 
                angle={-45}
                textAnchor="end"
                interval={0}
              />
              <YAxis hide />
              <Tooltip 
                cursor={{ fill: '#f8fafc' }}
                contentStyle={{ 
                  backgroundColor: '#fff', 
                  borderRadius: '8px', 
                  border: '1px solid #e2e8f0'
                }}
              />
              <Bar 
                dataKey="signings" 
                fill="#7ebcf0" 
                barSize={40}
                label={{ position: 'top', fill: '#000', fontSize: 14, fontWeight: 'bold' }}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Legend */}
        <div className="flex justify-center mt-4">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-[#7ebcf0]"></div>
            <span className="text-sm text-slate-700 font-medium">Signings</span>
          </div>
        </div>
      </div>
    </div>
  );
};

const CalendarView = ({ appointments }: { appointments: Appointment[] }) => {
  const [viewMode, setViewMode] = useState<'month' | 'week' | 'day'>('month');
  const [currentDate, setCurrentDate] = useState(new Date(2026, 3, 4)); // April 4, 2026 as starting point
  const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const handlePrev = () => {
    if (viewMode === 'month') setCurrentDate(subMonths(currentDate, 1));
    else if (viewMode === 'week') setCurrentDate(subWeeks(currentDate, 1));
    else setCurrentDate(subDays(currentDate, 1));
  };

  const handleNext = () => {
    if (viewMode === 'month') setCurrentDate(addMonths(currentDate, 1));
    else if (viewMode === 'week') setCurrentDate(addWeeks(currentDate, 1));
    else setCurrentDate(addDays(currentDate, 1));
  };

  const getEventsForDate = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return appointments
      .filter(app => app.date === dateStr)
      .map(app => ({
        time: app.time.split(' ')[0].toLowerCase() + (app.time.includes('PM') ? 'p' : 'a'),
        name: `${app.clientName.split(' ')[1] || app.clientName} (${app.location.split(',')[1]?.trim() || app.location})`
      }));
  };

  const renderMonthView = () => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart);
    const endDate = endOfWeek(monthEnd);

    const calendarDays = eachDayOfInterval({ start: startDate, end: endDate });

    return (
      <div className="bg-white border border-slate-200 rounded shadow-sm overflow-hidden">
        <div className="grid grid-cols-7 border-b border-slate-200">
          {daysOfWeek.map(day => (
            <div key={day} className="py-2 text-center text-sm font-bold text-slate-700 border-r border-slate-200 last:border-r-0">
              {day}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {calendarDays.map((date, idx) => {
            const events = getEventsForDate(date);
            const isCurrentMonth = isSameMonth(date, monthStart);
            const isToday = isSameDay(date, new Date());
            
            return (
              <div 
                key={idx} 
                className={cn(
                  "min-h-[120px] border-r border-b border-slate-200 p-1 relative last:border-r-0",
                  !isCurrentMonth && "bg-[repeating-linear-gradient(45deg,#f8fafc,#f8fafc_10px,#ffffff_10px,#ffffff_20px)]",
                  isToday && "bg-amber-50"
                )}
              >
                <span className={cn(
                  "absolute top-1 right-2 text-xs font-medium",
                  !isCurrentMonth ? "text-slate-300" : "text-slate-500"
                )}>
                  {format(date, 'd')}
                </span>
                <div className="mt-6 space-y-1">
                  {events.map((event, eIdx) => (
                    <div 
                      key={eIdx} 
                      className="bg-sky-600 text-white text-[10px] py-0.5 px-1.5 rounded-sm truncate cursor-pointer hover:bg-sky-700 transition-colors"
                    >
                      <span className="font-bold mr-1">{event.time}</span>
                      {event.name}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderWeekView = () => {
    const startDate = startOfWeek(currentDate);
    const endDate = endOfWeek(startDate);
    const calendarDays = eachDayOfInterval({ start: startDate, end: endDate });

    return (
      <div className="bg-white border border-slate-200 rounded shadow-sm overflow-hidden">
        <div className="grid grid-cols-7 border-b border-slate-200">
          {calendarDays.map(date => (
            <div key={date.toString()} className="py-4 text-center border-r border-slate-200 last:border-r-0">
              <p className="text-xs font-bold text-slate-500 uppercase">{format(date, 'EEE')}</p>
              <p className={cn(
                "text-lg font-bold mt-1 w-8 h-8 flex items-center justify-center mx-auto rounded-full",
                isSameDay(date, new Date()) ? "bg-sky-600 text-white" : "text-slate-800"
              )}>
                {format(date, 'd')}
              </p>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 min-h-[400px]">
          {calendarDays.map((date, idx) => {
            const events = getEventsForDate(date);
            return (
              <div key={idx} className="border-r border-slate-200 last:border-r-0 p-2 space-y-2 bg-slate-50/30">
                {events.map((event, eIdx) => (
                  <div 
                    key={eIdx} 
                    className="bg-white border-l-4 border-sky-600 p-2 rounded shadow-sm hover:shadow-md transition-shadow cursor-pointer"
                  >
                    <p className="text-[10px] font-bold text-sky-600">{event.time}</p>
                    <p className="text-xs font-medium text-slate-800 leading-tight mt-1">{event.name}</p>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderDayView = () => {
    const events = getEventsForDate(currentDate);
    return (
      <div className="bg-white border border-slate-200 rounded shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center gap-4">
            <div className="bg-sky-600 text-white w-16 h-16 rounded-2xl flex flex-col items-center justify-center shadow-lg shadow-sky-200">
              <span className="text-xs font-bold uppercase">{format(currentDate, 'MMM')}</span>
              <span className="text-2xl font-bold">{format(currentDate, 'd')}</span>
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-800">{format(currentDate, 'EEEE')}</h2>
              <p className="text-slate-500">{format(currentDate, 'MMMM do, yyyy')}</p>
            </div>
          </div>
        </div>
        <div className="p-6 min-h-[300px]">
          {events.length > 0 ? (
            <div className="space-y-4">
              {events.map((event, idx) => (
                <div key={idx} className="flex gap-4 items-start group">
                  <div className="w-20 text-right pt-1">
                    <span className="text-sm font-bold text-slate-400 group-hover:text-sky-600 transition-colors">{event.time}</span>
                  </div>
                  <div className="flex-1 bg-slate-50 border border-slate-200 rounded-xl p-4 hover:border-sky-300 hover:bg-sky-50/30 transition-all cursor-pointer">
                    <p className="font-bold text-slate-800">{event.name}</p>
                    <div className="flex items-center gap-4 mt-2 text-sm text-slate-500">
                      <span className="flex items-center gap-1"><Clock className="w-4 h-4" /> 1 hour</span>
                      <span className="flex items-center gap-1"><MapPin className="w-4 h-4" /> Location Details</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-slate-400">
              <Calendar className="w-12 h-12 mb-4 opacity-20" />
              <p>No signings scheduled for this day.</p>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-700">
      {/* Calendar Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-slate-800">
          {viewMode === 'day' ? format(currentDate, 'MMMM d, yyyy') : format(currentDate, 'MMMM yyyy')}
        </h1>
        
        <div className="flex items-center gap-px bg-slate-200 border border-slate-200 rounded overflow-hidden">
          <button 
            onClick={() => setViewMode('month')}
            className={cn(
              "px-4 py-1.5 text-sm font-medium border-r border-slate-300 transition-colors",
              viewMode === 'month' ? "bg-sky-600 text-white" : "bg-white text-slate-600 hover:bg-slate-50"
            )}
          >
            Month
          </button>
          <button 
            onClick={() => setViewMode('week')}
            className={cn(
              "px-4 py-1.5 text-sm font-medium border-r border-slate-300 transition-colors",
              viewMode === 'week' ? "bg-sky-600 text-white" : "bg-white text-slate-600 hover:bg-slate-50"
            )}
          >
            Week
          </button>
          <button 
            onClick={() => setViewMode('day')}
            className={cn(
              "px-4 py-1.5 text-sm font-medium transition-colors",
              viewMode === 'day' ? "bg-sky-600 text-white" : "bg-white text-slate-600 hover:bg-slate-50"
            )}
          >
            Day
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button 
            onClick={handlePrev}
            className="bg-sky-500 hover:bg-sky-600 text-white px-4 py-1.5 rounded text-sm font-medium flex items-center gap-1 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" /> Prev
          </button>
          <button 
            onClick={() => setCurrentDate(new Date())}
            className="bg-white border border-slate-300 text-slate-600 hover:bg-slate-50 px-4 py-1.5 rounded text-sm font-medium transition-colors"
          >
            Today
          </button>
          <button 
            onClick={handleNext}
            className="bg-sky-500 hover:bg-sky-600 text-white px-4 py-1.5 rounded text-sm font-medium flex items-center gap-1 transition-colors"
          >
            Next <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Calendar View */}
      {viewMode === 'month' && renderMonthView()}
      {viewMode === 'week' && renderWeekView()}
      {viewMode === 'day' && renderDayView()}
    </div>
  );
};

const Appointments = ({ appointments, onNewSigning, onViewSigning, onDelete }: { appointments: Appointment[]; onNewSigning: () => void; onViewSigning: (app: Appointment) => void; onDelete: (ids: string[]) => void }) => {
  const [isBatchDropdownOpen, setIsBatchDropdownOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const toggleSelectAll = () => {
    if (selectedIds.length === appointments.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(appointments.map(a => a.id));
    }
  };

  const toggleSelect = (id: string) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter(i => i !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>Signings Report - ${format(new Date(), 'MMMM yyyy')}</title>
            <style>
              body { font-family: sans-serif; padding: 20px; color: #334155; }
              h1 { color: #0f172a; font-size: 24px; margin-bottom: 20px; text-align: center; }
              table { width: 100%; border-collapse: collapse; margin-top: 20px; }
              th, td { border: 1px solid #e2e8f0; padding: 10px; text-align: left; font-size: 12px; }
              th { background-color: #f8fafc; font-weight: bold; }
              .footer { margin-top: 30px; text-align: center; font-size: 10px; color: #94a3b8; }
            </style>
          </head>
          <body>
            <h1>Signings Report - ${format(new Date(), 'MMMM yyyy')}</h1>
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Time</th>
                  <th>Client</th>
                  <th>Type</th>
                  <th>Location</th>
                  <th>Fee</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                ${appointments.map(app => `
                  <tr>
                    <td>${app.date}</td>
                    <td>${app.time}</td>
                    <td>${app.clientName}</td>
                    <td>${app.signingType}</td>
                    <td>${app.location}</td>
                    <td>$${app.fee.toFixed(2)}</td>
                    <td>${app.status}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
            <div class="footer">Generated on ${new Date().toLocaleString()}</div>
          </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.print();
    }
  };

  const handlePrintJob = (app: Appointment) => {
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      const formattedDate = format(new Date(app.date), 'EEEE, MMMM d, yyyy');
      const rescissionDate = format(subDays(new Date(app.date), 3), 'M/d/yyyy'); // Example logic
      
      printWindow.document.write(`
        <html>
          <head>
            <title>Signing Report - ${app.clientName}</title>
            <style>
              body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; padding: 40px; color: #334155; max-width: 800px; margin: 0 auto; }
              .header-box { background-color: #004a8d; color: white; padding: 25px 30px; margin-bottom: 40px; border-radius: 2px; }
              .header-box h1 { margin: 0; font-size: 24px; font-weight: 500; }
              .header-box p { margin: 8px 0 0 0; font-size: 15px; opacity: 0.9; }
              
              .main-info { text-align: center; margin-bottom: 40px; }
              .main-info h2 { font-size: 24px; font-weight: 700; color: #000; margin-bottom: 5px; }
              .rescission { color: #cbd5e1; font-size: 14px; margin-bottom: 30px; }
              
              .details-grid { display: grid; grid-template-columns: 1.2fr 1fr; gap: 40px; margin-bottom: 40px; padding: 0 20px; }
              .details-left { line-height: 1.6; font-size: 16px; color: #000; }
              .details-right { line-height: 1.6; font-size: 16px; color: #000; }
              
              .notes-section { padding: 0 20px; margin-top: 20px; }
              .notes-label { font-size: 13px; font-weight: bold; color: #000; margin-bottom: 15px; display: block; }
              
              .bottom-line { border: none; border-top: 4px solid #004a8d; margin-top: 60px; }
              
              @media print {
                body { padding: 20px; }
                .header-box { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
              }
            </style>
          </head>
          <body>
            <div class="header-box">
              <h1>Signing Report</h1>
              <p>Frank Coxx Sunday, April 5, 2026</p>
            </div>
            
            <div class="main-info">
              <h2>${formattedDate} : ${app.time}</h2>
              <div class="rescission">Rescission Date: ${rescissionDate}</div>
            </div>

            <div class="details-grid">
              <div class="details-left">
                <div>${app.clientName}</div>
                <div>138 August Ln</div>
                <div>Stallings 28104</div>
                <div>Cell: 6077610961</div>
              </div>
              <div class="details-right">
                <div>Rocket Close</div>
                <div style="margin-top: 20px;">Order No. 75787${410 + parseInt(app.id)}</div>
              </div>
            </div>

            <div class="notes-section">
              <span class="notes-label">NOTES:</span>
            </div>

            <hr class="bottom-line" />
          </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.print();
    }
  };

  const handleApplyPayments = () => {
    console.log("Apply Payments action triggered for selected signings.");
  };

  const handleBatchInvoice = () => {
    console.log("Batch Invoice action triggered for selected signings.");
  };

  const handleExport = () => {
    const headers = ["Date", "Time", "Client", "Type", "Location", "Fee", "Status"];
    const csvData = appointments.map(app => [
      app.date,
      app.time,
      app.clientName,
      app.signingType,
      app.location,
      app.fee,
      app.status
    ]);
    
    const csvContent = [headers, ...csvData].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", "signings_export.csv");
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.csv,.pdf';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        console.log(`Importing ${file.name}...`);
      }
    };
    input.click();
  };

  const handleDelete = () => {
    if (selectedIds.length === 0) {
      return;
    }
    // Perform deletion directly to avoid iframe confirm() issues
    onDelete(selectedIds);
    setSelectedIds([]);
  };

  const stats = [
    { label: 'SIGNINGS', value: '51', color: 'text-sky-600', help: true },
    { label: 'INCOME', value: '$1,795.00', color: 'text-sky-600', help: true },
    { label: 'UNPAID', value: '$2,835.00', color: 'text-rose-700', help: false },
    { label: 'TOTAL', value: '$4,630.00', color: 'text-slate-900', help: false },
  ];

  return (
    <div className="space-y-4 animate-in fade-in duration-700">
      {/* Top Action Bar */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div className="flex flex-wrap items-center gap-px bg-slate-200 border border-slate-200 rounded-md">
          <button 
            onClick={onNewSigning}
            className="bg-white hover:bg-slate-50 px-4 py-2 text-sm font-medium text-slate-700 flex items-center gap-2 border-r border-slate-200"
          >
            <PlusCircle className="w-4 h-4 text-sky-600" /> Add Signing
          </button>
          <button 
            onClick={handlePrint}
            className="bg-white hover:bg-slate-50 px-4 py-2 text-sm font-medium text-slate-700 flex items-center gap-2 border-r border-slate-200"
          >
            <Printer className="w-4 h-4 text-sky-600" /> Print
          </button>
          <button 
            onClick={handleExport}
            className="bg-white hover:bg-slate-50 px-4 py-2 text-sm font-medium text-slate-700 flex items-center gap-2 border-r border-slate-200"
          >
            <Download className="w-4 h-4 text-sky-600" /> Export
          </button>
          <div className="relative">
            <button 
              onClick={() => setIsBatchDropdownOpen(!isBatchDropdownOpen)}
              className="bg-white hover:bg-slate-50 px-4 py-2 text-sm font-medium text-slate-700 flex items-center gap-2 border-r border-slate-200"
            >
              Batch Actions <ChevronDown className="w-3 h-3" />
            </button>
            {isBatchDropdownOpen && (
              <>
                <div 
                  className="fixed inset-0 z-40" 
                  onClick={() => setIsBatchDropdownOpen(false)}
                />
                <div className="absolute top-full left-0 mt-1 w-48 bg-white border border-slate-200 rounded-md shadow-lg z-50 animate-in fade-in zoom-in-95 duration-100">
                  <button 
                    onClick={() => {
                      handleApplyPayments();
                      setIsBatchDropdownOpen(false);
                    }}
                    className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2 border-b border-slate-100"
                  >
                    Apply Payments
                  </button>
                  <button 
                    onClick={() => {
                      handleBatchInvoice();
                      setIsBatchDropdownOpen(false);
                    }}
                    className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2 border-b border-slate-100"
                  >
                    Batch Invoice
                  </button>
                  <button 
                    onClick={() => {
                      handleDelete();
                      setIsBatchDropdownOpen(false);
                    }}
                    className="w-full text-left px-4 py-2 text-sm text-rose-600 hover:bg-rose-50 flex items-center gap-2"
                  >
                    <Trash2 className="w-4 h-4" /> Delete Selected
                  </button>
                </div>
              </>
            )}
          </div>
          <button 
            onClick={handleImport}
            className="bg-white hover:bg-slate-50 px-4 py-2 text-sm font-medium text-slate-700 flex items-center gap-2"
          >
            <Upload className="w-4 h-4 text-sky-600" /> Import <span className="bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded-full text-[10px]">0</span>
          </button>
        </div>

        <div className="flex gap-6">
          {stats.map((s) => (
            <div key={s.label} className="text-right">
              <div className="flex items-center justify-end gap-1">
                <span className="text-[10px] font-bold text-slate-400 tracking-wider">{s.label}</span>
              </div>
              <p className={cn("text-lg font-medium", s.color)}>{s.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-slate-50 border border-slate-200 rounded-md p-2 flex items-center justify-between">
        <div className="flex flex-wrap gap-2">
          <select className="bg-white border border-slate-300 rounded px-3 py-1 text-xs focus:outline-none w-32">
            <option>This year</option>
          </select>
          <select className="bg-white border border-slate-300 rounded px-3 py-1 text-xs focus:outline-none w-44">
            <option>All Customers</option>
          </select>
          <select className="bg-white border border-slate-300 rounded px-3 py-1 text-xs focus:outline-none w-32">
            <option>All</option>
          </select>
          <select className="bg-white border border-slate-300 rounded px-3 py-1 text-xs focus:outline-none w-44">
            <option>All Types of work</option>
          </select>
        </div>
        <button className="p-1.5 bg-white border border-slate-300 rounded hover:bg-slate-50">
          <Settings2 className="w-4 h-4 text-slate-600" />
        </button>
      </div>

      {/* Table */}
      <div className="bg-white border border-slate-200 rounded-md overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase tracking-tight">
                <th className="px-3 py-3 w-10">
                  <input 
                    type="checkbox" 
                    className="rounded" 
                    checked={selectedIds.length === appointments.length && appointments.length > 0}
                    onChange={toggleSelectAll}
                  />
                </th>
                <th className="px-3 py-3 w-10"></th>
                <th className="px-3 py-3">Date / Time <ChevronDown className="inline w-3 h-3" /></th>
                <th className="px-3 py-3">Name <ChevronDown className="inline w-3 h-3" /></th>
                <th className="px-3 py-3">Type of work <ChevronDown className="inline w-3 h-3" /></th>
                <th className="px-3 py-3">Location <ChevronDown className="inline w-3 h-3" /></th>
                <th className="px-3 py-3">Customer <ChevronDown className="inline w-3 h-3" /></th>
                <th className="px-3 py-3">Amount</th>
                <th className="px-3 py-3">Invoice Sent <ChevronDown className="inline w-3 h-3" /></th>
                <th className="px-3 py-3">Invoice Paid</th>
                <th className="px-3 py-3">Invoice Number <ChevronDown className="inline w-3 h-3" /></th>
                <th className="px-3 py-3">Mileage</th>
                <th className="px-3 py-3">Order No.</th>
                <th className="px-3 py-3">Docs / Notarial Acts</th>
                <th className="px-3 py-3"></th>
              </tr>
            </thead>
            <tbody className="text-[13px] divide-y divide-slate-100">
              {appointments.map((app, idx) => (
                <tr key={app.id} className={cn("hover:bg-sky-50/30 transition-colors group", selectedIds.includes(app.id) && "bg-sky-50")}>
                  <td className="px-3 py-3">
                    <input 
                      type="checkbox" 
                      className="rounded" 
                      checked={selectedIds.includes(app.id)}
                      onChange={() => toggleSelect(app.id)}
                    />
                  </td>
                  <td className="px-3 py-3">
                    {app.status === 'Completed' && <CheckCircle2 className="w-4 h-4 text-emerald-600" />}
                  </td>
                  <td className="px-3 py-3 text-slate-600">
                    {format(new Date(app.date), 'M/d/yyyy')}<br />
                    {app.time}
                  </td>
                  <td className="px-3 py-3">
                    <button 
                      onClick={() => onViewSigning(app)}
                      className="text-sky-600 hover:underline font-medium"
                    >
                      {app.clientName.split(' ')[1] || app.clientName}
                    </button>
                  </td>
                  <td className="px-3 py-3 text-slate-600">{app.signingType}</td>
                  <td className="px-3 py-3">
                    <button 
                      onClick={() => window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(app.location)}`, '_blank')}
                      className="text-sky-600 hover:underline"
                    >
                      {app.location.split(',')[1]?.trim() || app.location}
                    </button>
                  </td>
                  <td className="px-3 py-3 text-slate-600">Rocket Close</td>
                  <td className="px-3 py-3 font-medium text-rose-700">${app.fee.toFixed(2)}</td>
                  <td className="px-3 py-3">
                    <input 
                      type="date" 
                      defaultValue={format(subDays(new Date(app.date), 10), 'yyyy-MM-dd')}
                      className="text-xs border border-slate-200 rounded px-1 py-0.5 outline-none focus:ring-1 focus:ring-sky-500"
                    />
                  </td>
                  <td className="px-3 py-3">
                    <input 
                      type="date"
                      className="text-xs border border-slate-200 rounded px-1 py-0.5 outline-none focus:ring-1 focus:ring-sky-500"
                    />
                  </td>
                  <td className="px-3 py-3">
                    <button className="text-sky-600 hover:underline">{45 + idx}</button>
                  </td>
                  <td className="px-3 py-3 text-slate-600">{10 + idx * 8}</td>
                  <td className="px-3 py-3 text-slate-600">75787{410 + idx}</td>
                  <td className="px-3 py-3 text-slate-600">0 / 0</td>
                  <td className="px-3 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button 
                        onClick={() => handlePrintJob(app)}
                        className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-sky-600"
                        title="Print Job"
                      >
                        <Printer className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => {
                          onDelete([app.id]);
                        }}
                        className="p-1 hover:bg-rose-50 rounded text-slate-300 hover:text-rose-600 transition-colors"
                        title="Delete Signing"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                      <button className="p-1 hover:bg-slate-100 rounded text-slate-300 group-hover:text-slate-400">
                        <MoreVertical className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

const NewClientModal = ({ isOpen, onClose, client, onSave }: { isOpen: boolean; onClose: () => void; client?: Client | null; onSave: (c: Client) => void }) => {
  const [formData, setFormData] = useState<Partial<Client>>({});

  useEffect(() => {
    if (client) {
      setFormData(client);
    } else {
      setFormData({
        id: Math.random().toString(36).substr(2, 9),
        name: '',
        company: '',
        email: '',
        phone: '',
        address: ''
      });
    }
  }, [client, isOpen]);

  if (!isOpen) return null;

  const handleSave = () => {
    if (formData.id && formData.name && formData.company && formData.email && formData.phone && formData.address) {
      onSave(formData as Client);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-300">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="bg-white rounded-lg shadow-2xl w-full max-w-2xl overflow-hidden border border-slate-200 flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-white shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-600 rounded-lg flex items-center justify-center shadow-lg shadow-indigo-200">
              <Users className="w-6 h-6 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-slate-800">{client ? 'Edit Client' : 'New Client'}</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
          <div className="flex items-center gap-4">
            <label className="w-24 text-sm font-bold text-slate-700 text-right">Name:</label>
            <input 
              type="text" 
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="flex-1 border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
            />
          </div>
          <div className="flex items-center gap-4">
            <label className="w-24 text-sm font-bold text-slate-700 text-right">Company:</label>
            <input 
              type="text" 
              value={formData.company}
              onChange={(e) => setFormData({ ...formData, company: e.target.value })}
              className="flex-1 border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
            />
          </div>
          <div className="flex items-center gap-4">
            <label className="w-24 text-sm font-bold text-slate-700 text-right">Email:</label>
            <input 
              type="email" 
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="flex-1 border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
            />
          </div>
          <div className="flex items-center gap-4">
            <label className="w-24 text-sm font-bold text-slate-700 text-right">Phone:</label>
            <input 
              type="tel" 
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              className="flex-1 border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
            />
          </div>
          <div className="flex items-center gap-4">
            <label className="w-24 text-sm font-bold text-slate-700 text-right">Address:</label>
            <textarea 
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              className="flex-1 border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all min-h-[80px] resize-none"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-end gap-3 bg-slate-50/30 shrink-0">
          <button 
            onClick={onClose}
            className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 px-6 py-2 rounded text-sm font-medium shadow-sm transition-colors"
          >
            Cancel
          </button>
          <button 
            onClick={handleSave}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-2 rounded text-sm font-medium shadow-sm transition-colors"
          >
            Save Client
          </button>
        </div>
      </motion.div>
    </div>
  );
};

const Clients = ({ clients, onNewClient, onEditClient, onDeleteClient }: { clients: Client[]; onNewClient: () => void; onEditClient: (c: Client) => void; onDeleteClient: (id: string) => void }) => {
  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Clients</h1>
          <p className="text-slate-500">Manage your contacts and title company relationships.</p>
        </div>
        <button 
          onClick={onNewClient}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-sm flex items-center justify-center gap-2"
        >
          <Plus className="w-4 h-4" /> New Client
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {clients.map((client) => (
          <div key={client.id} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all group relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1 h-full bg-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity"></div>
            <div className="flex items-start justify-between mb-4">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400 font-bold text-xl">
                {client.name.charAt(0)}
              </div>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => onEditClient(client)}
                  className="p-2 hover:bg-slate-50 rounded-lg text-slate-400 hover:text-indigo-600 transition-colors"
                >
                  <PenLine className="w-4 h-4" />
                </button>
                <button 
                  onClick={() => onDeleteClient(client.id)}
                  className="p-2 hover:bg-rose-50 rounded-lg text-slate-400 hover:text-rose-600 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
            <h3 className="font-bold text-lg text-slate-900 mb-1">{client.name}</h3>
            <p className="text-sm text-indigo-600 font-medium mb-4">{client.company}</p>
            
            <div className="space-y-3">
              <div className="flex items-center gap-3 text-sm text-slate-600">
                <Bell className="w-4 h-4 text-slate-400" />
                <span>{client.email}</span>
              </div>
              <div className="flex items-center gap-3 text-sm text-slate-600">
                <User className="w-4 h-4 text-slate-400" />
                <span>{client.phone}</span>
              </div>
              <div className="flex items-center gap-3 text-sm text-slate-600">
                <MapPin className="w-4 h-4 text-slate-400" />
                <span className="truncate">{client.address}</span>
              </div>
            </div>

            <div className="mt-6 pt-6 border-t border-slate-100 flex items-center justify-between">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Last Signing: Oct 12</span>
              <button className="text-xs font-bold text-indigo-600 hover:underline">View History</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const Accounting = ({ appointments, expenses, onNewExpense, onDeleteExpense }: { appointments: Appointment[]; expenses: Expense[]; onNewExpense: () => void; onDeleteExpense: (id: string) => void }) => {
  const totalIncome = appointments.filter(a => a.status === 'Completed').reduce((sum, a) => sum + a.fee, 0);
  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
  const netProfit = totalIncome - totalExpenses;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Accounting</h1>
          <p className="text-slate-500">Track your income, expenses, and tax deductions.</p>
        </div>
        <div className="flex items-center gap-2">
          <button className="bg-white border border-slate-200 text-slate-700 px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-slate-50 transition-all flex items-center gap-2">
            <FileText className="w-4 h-4" /> Export Report
          </button>
          <button 
            onClick={onNewExpense}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-sm flex items-center gap-2"
          >
            <Plus className="w-4 h-4" /> Add Expense
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <p className="text-sm font-medium text-slate-500 mb-1">Total Income</p>
          <p className="text-3xl font-bold text-slate-900">${totalIncome.toLocaleString()}</p>
          <div className="mt-4 flex items-center gap-2 text-emerald-600 text-xs font-bold">
            <TrendingUp className="w-3 h-3" /> +12% from last month
          </div>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <p className="text-sm font-medium text-slate-500 mb-1">Total Expenses</p>
          <p className="text-3xl font-bold text-slate-900">${totalExpenses.toLocaleString()}</p>
          <div className="mt-4 flex items-center gap-2 text-rose-600 text-xs font-bold">
            <TrendingDown className="w-3 h-3" /> +5% from last month
          </div>
        </div>
        <div className="bg-indigo-600 p-6 rounded-2xl shadow-lg shadow-indigo-200 text-white">
          <p className="text-sm font-medium text-indigo-100 mb-1">Net Profit</p>
          <p className="text-3xl font-bold">${netProfit.toLocaleString()}</p>
          <div className="mt-4 flex items-center gap-2 text-indigo-100 text-xs font-bold">
            <CheckCircle2 className="w-3 h-3" /> Healthy business margin
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Recent Expenses */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-100 flex items-center justify-between">
            <h3 className="font-bold text-slate-900">Recent Expenses</h3>
            <button className="text-xs font-bold text-indigo-600 hover:underline">View All</button>
          </div>
          <div className="divide-y divide-slate-100">
            {expenses.map((expense) => (
              <div key={expense.id} className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors group">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-rose-50 flex items-center justify-center">
                    <TrendingDown className="w-5 h-5 text-rose-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900">{expense.category}</p>
                    <p className="text-xs text-slate-500">{expense.description}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="font-bold text-slate-900">-${expense.amount}</p>
                    <p className="text-xs text-slate-400">{format(new Date(expense.date), 'MMM d')}</p>
                  </div>
                  <button 
                    onClick={() => onDeleteExpense(expense.id)}
                    className="p-2 hover:bg-rose-50 rounded-lg text-slate-300 hover:text-rose-600 opacity-0 group-hover:opacity-100 transition-all"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Expense Breakdown */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <h3 className="font-bold text-slate-900 mb-6">Expense Breakdown</h3>
          <div className="h-[300px] w-full flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={[
                    { name: 'Mileage', value: 45.5 },
                    { name: 'Supplies', value: 25 },
                    { name: 'Software', value: 15 },
                    { name: 'Marketing', value: 10 },
                  ]}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  <Cell fill="#4f46e5" />
                  <Cell fill="#10b981" />
                  <Cell fill="#f59e0b" />
                  <Cell fill="#ef4444" />
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="grid grid-cols-2 gap-4 mt-4">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-indigo-600"></div>
              <span className="text-xs text-slate-600 font-medium">Mileage (45%)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
              <span className="text-xs text-slate-600 font-medium">Supplies (25%)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-amber-500"></div>
              <span className="text-xs text-slate-600 font-medium">Software (15%)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-rose-500"></div>
              <span className="text-xs text-slate-600 font-medium">Marketing (10%)</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// --- Main App ---

export default function App() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isNewSigningModalOpen, setIsNewSigningModalOpen] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [isNewExpenseModalOpen, setIsNewExpenseModalOpen] = useState(false);
  const [isExpenseTypesModalOpen, setIsExpenseTypesModalOpen] = useState(false);
  const [isRecurringExpenseModalOpen, setIsRecurringExpenseModalOpen] = useState(false);
  const [isNewMileageModalOpen, setIsNewMileageModalOpen] = useState(false);
  const [isNewClientModalOpen, setIsNewClientModalOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [isDemoUser, setIsDemoUser] = useState(false);
  const [isAuthReady, setIsAuthReady] = useState(false);

  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [mileage, setMileage] = useState<Mileage[]>([]);
  const [businessProfile, setBusinessProfile] = useState<BusinessProfile>(MOCK_PROFILE);

  // Auth listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user: FirebaseUser | null) => {
      console.log('Auth state changed:', user?.email);
      setUser(user);
      setIsAuthReady(true);
    });

    return () => unsubscribe();
  }, []);

  // Firestore listeners
  useEffect(() => {
    if (!isAuthReady || !user) {
      setAppointments(MOCK_APPOINTMENTS);
      setClients(MOCK_CLIENTS);
      setExpenses(MOCK_EXPENSES);
      setMileage(MOCK_MILEAGE);
      setBusinessProfile(MOCK_PROFILE);
      return;
    }

    console.log('Starting Firestore listeners for:', user.uid);
    const qAppointments = query(collection(db, 'appointments'), where('userId', '==', user.uid));
    const unsubAppointments = onSnapshot(qAppointments, (snapshot: any) => {
      setAppointments(snapshot.docs.map((doc: any) => doc.data() as Appointment));
    }, (error: any) => handleFirestoreError(error, OperationType.LIST, 'appointments'));

    const qClients = query(collection(db, 'clients'), where('userId', '==', user.uid));
    const unsubClients = onSnapshot(qClients, (snapshot: any) => {
      setClients(snapshot.docs.map((doc: any) => doc.data() as Client));
    }, (error: any) => handleFirestoreError(error, OperationType.LIST, 'clients'));

    const qExpenses = query(collection(db, 'expenses'), where('userId', '==', user.uid));
    const unsubExpenses = onSnapshot(qExpenses, (snapshot: any) => {
      setExpenses(snapshot.docs.map((doc: any) => doc.data() as Expense));
    }, (error: any) => handleFirestoreError(error, OperationType.LIST, 'expenses'));

    const qMileage = query(collection(db, 'mileage'), where('userId', '==', user.uid));
    const unsubMileage = onSnapshot(qMileage, (snapshot: any) => {
      setMileage(snapshot.docs.map((doc: any) => doc.data() as Mileage));
    }, (error: any) => handleFirestoreError(error, OperationType.LIST, 'mileage'));

    const unsubProfile = onSnapshot(doc(db, 'profiles', user.uid), (doc: any) => {
      if (doc.exists()) {
        setBusinessProfile(doc.data() as BusinessProfile);
      }
    }, (error: any) => handleFirestoreError(error, OperationType.GET, `profiles/${user.uid}`));

    return () => {
      unsubAppointments();
      unsubClients();
      unsubExpenses();
      unsubMileage();
      unsubProfile();
    };
  }, [isAuthReady, user]);

  const handleSignIn = useCallback(async () => {
    try {
      console.log('Initiating sign in...');
      await signInWithPopup(auth, provider);
      console.log('Sign in successful');
    } catch (error: any) {
      console.error('Sign in error:', error);
      const errorCode = error.code || 'unknown';
      alert(`Sign in failed (${errorCode}). Please check if popups are blocked or if your domain is authorized in Firebase.`);
    }
  }, [provider]);

  const handleSignOut = useCallback(async () => {
    try {
      await signOut(auth);
      setIsDemoUser(false);
    } catch (error) {
      console.error('Sign out error:', error);
    }
  }, []);

  const handleSaveAppointment = async (app: Appointment) => {
    if (!user) {
      setAppointments(prev => {
        const exists = prev.find(a => a.id === app.id);
        if (exists) return prev.map(a => a.id === app.id ? app : a);
        return [...prev, app];
      });
      return;
    }

    try {
      const appData = { ...app, userId: user.uid };
      await setDoc(doc(db, 'appointments', app.id), appData);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `appointments/${app.id}`);
    }
  };

  const handleSaveExpense = async (expense: Expense) => {
    if (!user) {
      setExpenses(prev => [...prev, expense]);
      return;
    }

    try {
      const expenseData = { ...expense, userId: user.uid };
      await setDoc(doc(db, 'expenses', expense.id), expenseData);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `expenses/${expense.id}`);
    }
  };

  const handleSaveMileage = async (m: Mileage) => {
    if (!user) {
      setMileage(prev => [...prev, m]);
      return;
    }

    try {
      const mileageData = { ...m, userId: user.uid };
      await setDoc(doc(db, 'mileage', m.id), mileageData);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `mileage/${m.id}`);
    }
  };

  const handleSaveProfile = async (profile: BusinessProfile) => {
    if (!user) {
      setBusinessProfile(profile);
      return;
    }

    try {
      const profileData = { ...profile, userId: user.uid };
      await setDoc(doc(db, 'profiles', user.uid), profileData);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `profiles/${user.uid}`);
    }
  };

  const handleDeleteExpense = async (id: string) => {
    if (!user) {
      setExpenses(prev => prev.filter(e => e.id !== id));
      return;
    }

    try {
      await deleteDoc(doc(db, 'expenses', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `expenses/${id}`);
    }
  };

  const handleDeleteMileage = async (id: string) => {
    if (!user) {
      setMileage(prev => prev.filter(m => m.id !== id));
      return;
    }

    try {
      await deleteDoc(doc(db, 'mileage', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `mileage/${id}`);
    }
  };

  const handleSaveClient = async (client: Client) => {
    if (!user) {
      setClients(prev => {
        const exists = prev.find(c => c.id === client.id);
        if (exists) return prev.map(c => c.id === client.id ? client : c);
        return [...prev, client];
      });
      return;
    }

    try {
      const clientData = { ...client, userId: user.uid };
      await setDoc(doc(db, 'clients', client.id), clientData);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `clients/${client.id}`);
    }
  };

  const handleDeleteClient = async (id: string) => {
    if (!user) {
      setClients(prev => prev.filter(c => c.id !== id));
      return;
    }

    try {
      await deleteDoc(doc(db, 'clients', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `clients/${id}`);
    }
  };

  const handleDeleteAppointments = async (ids: string[]) => {
    if (!user) {
      setAppointments(prev => prev.filter(app => !ids.includes(app.id)));
      return;
    }

    try {
      const batch = writeBatch(db);
      ids.forEach(id => {
        batch.delete(doc(db, 'appointments', id));
      });
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'appointments');
    }
  };

  // Responsive sidebar
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 1024) {
        setIsSidebarOpen(false);
      } else {
        setIsSidebarOpen(true);
      }
    };
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  if (!isAuthReady) {
    return (
      <div className="min-h-screen bg-[#0f172a] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-indigo-400 font-medium animate-pulse">Initializing NotaryPro...</p>
        </div>
      </div>
    );
  }

  return (
    <Router>
      {!user && !isDemoUser ? (
        <LoginPage onSignIn={handleSignIn} onDemoSignIn={() => setIsDemoUser(true)} />
      ) : (
        <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
          <Sidebar 
            isOpen={isSidebarOpen} 
            toggle={() => setIsSidebarOpen(!isSidebarOpen)} 
            onNewSigning={() => setIsNewSigningModalOpen(true)}
            onNewExpense={() => setIsNewExpenseModalOpen(true)}
            onExpenseTypes={() => setIsExpenseTypesModalOpen(true)}
            onRecurringExpense={() => setIsRecurringExpenseModalOpen(true)}
            onNewMileage={() => setIsNewMileageModalOpen(true)}
            user={user}
            onSignIn={handleSignIn}
            onSignOut={handleSignOut}
          />
          
          <div className={cn(
            "transition-all duration-300 ease-in-out min-h-screen flex flex-col",
            isSidebarOpen ? "lg:pl-[280px]" : "lg:pl-[80px]"
          )}>
            <Header toggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)} />
            
            <main className="flex-1 p-4 lg:p-8 max-w-7xl mx-auto w-full">
              <Routes>
                <Route path="/" element={<Dashboard appointments={appointments} expenses={expenses} />} />
                <Route 
                  path="/appointments" 
                  element={
                    <Appointments 
                      appointments={appointments} 
                      onNewSigning={() => {
                        setSelectedAppointment(null);
                        setIsNewSigningModalOpen(true);
                      }} 
                      onViewSigning={(app) => {
                        setSelectedAppointment(app);
                        setIsNewSigningModalOpen(true);
                      }}
                      onDelete={handleDeleteAppointments}
                    />
                  } 
                />
                <Route path="/calendar" element={<CalendarView appointments={appointments} />} />
                <Route 
                  path="/clients" 
                  element={
                    <Clients 
                      clients={clients} 
                      onNewClient={() => {
                        setSelectedClient(null);
                        setIsNewClientModalOpen(true);
                      }}
                      onEditClient={(c) => {
                        setSelectedClient(c);
                        setIsNewClientModalOpen(true);
                      }}
                      onDeleteClient={handleDeleteClient}
                    />
                  } 
                />
                <Route 
                  path="/mileage" 
                  element={
                    <MileageView 
                      mileage={mileage} 
                      onNewMileage={() => setIsNewMileageModalOpen(true)} 
                      onDeleteMileage={handleDeleteMileage}
                    />
                  } 
                />
                <Route path="/reports/*" element={<Reports />} />
                <Route 
                  path="/accounting" 
                  element={
                    <Accounting 
                      appointments={appointments} 
                      expenses={expenses} 
                      onNewExpense={() => setIsNewExpenseModalOpen(true)}
                      onDeleteExpense={handleDeleteExpense}
                    />
                  } 
                />
                <Route path="/tools" element={<ToolsView />} />
                <Route path="/settings" element={<SettingsView onEditProfile={() => setIsProfileModalOpen(true)} user={user} onSignIn={handleSignIn} />} />
              </Routes>
            </main>

            <footer className="py-6 px-8 border-t border-slate-200 text-center text-slate-400 text-sm">
              &copy; {new Date().getFullYear()} NotaryPro App. All rights reserved.
            </footer>
          </div>

          <AnimatePresence>
            {isNewSigningModalOpen && (
              <NewSigningModal 
                isOpen={isNewSigningModalOpen} 
                onClose={() => {
                  setIsNewSigningModalOpen(false);
                  setSelectedAppointment(null);
                }} 
                appointment={selectedAppointment}
                onSave={(app) => {
                  handleSaveAppointment(app);
                  setIsNewSigningModalOpen(false);
                  setSelectedAppointment(null);
                }}
              />
            )}

            {isNewExpenseModalOpen && (
              <NewExpenseModal 
                isOpen={isNewExpenseModalOpen} 
                onClose={() => setIsNewExpenseModalOpen(false)} 
                onSave={(expense) => {
                  handleSaveExpense(expense);
                  setIsNewExpenseModalOpen(false);
                }}
              />
            )}

            {isExpenseTypesModalOpen && (
              <ExpenseTypesModal 
                isOpen={isExpenseTypesModalOpen} 
                onClose={() => setIsExpenseTypesModalOpen(false)} 
              />
            )}

            {isRecurringExpenseModalOpen && (
              <RecurringExpenseModal 
                isOpen={isRecurringExpenseModalOpen} 
                onClose={() => setIsRecurringExpenseModalOpen(false)} 
              />
            )}

            {isNewMileageModalOpen && (
              <NewMileageModal 
                isOpen={isNewMileageModalOpen} 
                onClose={() => setIsNewMileageModalOpen(false)} 
                onSave={(m) => {
                  handleSaveMileage(m);
                  setIsNewMileageModalOpen(false);
                }}
              />
            )}

            {isNewClientModalOpen && (
              <NewClientModal 
                isOpen={isNewClientModalOpen} 
                onClose={() => {
                  setIsNewClientModalOpen(false);
                  setSelectedClient(null);
                }} 
                client={selectedClient}
                onSave={(c) => {
                  handleSaveClient(c);
                  setIsNewClientModalOpen(false);
                  setSelectedClient(null);
                }}
              />
            )}

            {isProfileModalOpen && (
              <BusinessProfileModal 
                isOpen={isProfileModalOpen} 
                onClose={() => setIsProfileModalOpen(false)} 
                profile={businessProfile}
                onSave={(updatedProfile) => {
                  handleSaveProfile(updatedProfile);
                  setIsProfileModalOpen(false);
                }}
              />
            )}
          </AnimatePresence>
        </div>
      )}
    </Router>
  );
}
