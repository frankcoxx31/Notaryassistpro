import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
  AlertTriangle,
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
import { GoogleGenAI, Type } from "@google/genai";
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
import { 
  MOCK_PROFILE, 
  MOCK_APPOINTMENTS, 
  MOCK_CLIENTS, 
  MOCK_EXPENSES, 
  MOCK_MILEAGE 
} from './mockData';
import { auth, db, provider } from './firebase';
import LoginPage from './components/LoginPage';
import NewSigningModal from './components/NewSigningModal';
import NewClientModal from './components/NewClientModal';
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

// Robust date/time parsing for deterministic sorting and display
const parseSafeDateTime = (dateStr: string, timeStr: string = ''): Date => {
  try {
    if (!dateStr) return new Date();
    
    let year = 0, month = 0, day = 0;
    
    // Handle YYYY-MM-DD
    if (dateStr.includes('-')) {
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        year = parseInt(parts[0], 10);
        month = parseInt(parts[1], 10) - 1;
        day = parseInt(parts[2], 10);
      }
    } 
    // Handle M/D/YYYY or MM/DD/YYYY
    else if (dateStr.includes('/')) {
      const parts = dateStr.split('/');
      if (parts.length === 3) {
        month = parseInt(parts[0], 10) - 1;
        day = parseInt(parts[1], 10);
        year = parseInt(parts[2], 10);
        if (year < 100) year += 2000;
      }
    }
    // Handle "April 6, 2026" or "April 06, 2026 1:30 PM"
    else {
      const dateMatch = dateStr.match(/([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})/);
      if (dateMatch) {
        const monthNames = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
        month = monthNames.findIndex(m => dateMatch[1].toLowerCase().startsWith(m));
        day = parseInt(dateMatch[2], 10);
        year = parseInt(dateMatch[3], 10);
      } else {
        const d = new Date(dateStr);
        if (!isNaN(d.getTime())) return d;
      }
    }

    let hours = 0, minutes = 0;
    if (timeStr) {
      const timeMatch = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
      if (timeMatch) {
        hours = parseInt(timeMatch[1], 10);
        minutes = parseInt(timeMatch[2], 10);
        const ampm = timeMatch[3].toUpperCase();
        if (ampm === 'PM' && hours < 12) hours += 12;
        if (ampm === 'AM' && hours === 12) hours = 0;
      }
    } else {
      // Check if time is in dateStr
      const timeMatch = dateStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
      if (timeMatch) {
        hours = parseInt(timeMatch[1], 10);
        minutes = parseInt(timeMatch[2], 10);
        const ampm = timeMatch[3].toUpperCase();
        if (ampm === 'PM' && hours < 12) hours += 12;
        if (ampm === 'AM' && hours === 12) hours = 0;
      }
    }

    if (year === 0) return new Date(dateStr);
    return new Date(year, month, day, hours, minutes);
  } catch (e) {
    return new Date(dateStr);
  }
};

const parseLocation = (loc: string) => {
  const parts = loc.split(',').map(p => p.trim());
  let address = '', city = '', state = '', zip = '';
  
  if (parts.length >= 3) {
    address = parts[0];
    city = parts[1];
    const stateZip = parts[2].split(' ').map(p => p.trim()).filter(p => p);
    if (stateZip.length >= 2) {
      state = stateZip[0];
      zip = stateZip[1];
    } else {
      state = stateZip[0] || '';
    }
  } else if (parts.length === 2) {
    address = parts[0];
    city = parts[1];
  } else {
    address = loc;
  }
  return { address, city, state, zip };
};

const splitName = (name: string) => {
  const parts = name.split(' ').map(p => p.trim()).filter(p => p);
  if (parts.length >= 2) {
    return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
  }
  return { firstName: name, lastName: '' };
};

const parsePDFWithAI = async (file: File, userId: string): Promise<Appointment[]> => {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });
  
  // Convert file to base64
  const base64 = await new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(',')[1]);
    };
    reader.readAsDataURL(file);
  });

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: [
      {
        parts: [
          {
            inlineData: {
              data: base64,
              mimeType: "application/pdf"
            }
          },
          {
            text: `Read the PDF as plain text. 
            
            Find the exact label: "Scheduled Closing Date and Time:".
            Copy the EXACT text that appears immediately after that label on the same line.
            Do NOT interpret, normalize, convert, or reformat this value. 
            Do NOT infer the date or change the day.
            Return the value exactly as it appears in the PDF.
            
            Example: "April 02, 2026 1:00 PM"

            IMPORTANT FIELD DEFINITIONS:
            - date: Copy the EXACT text from "Scheduled Closing Date and Time:".
            - time: Copy the EXACT time portion from "Scheduled Closing Date and Time:" (e.g., "1:00 PM").
            - clientName: The name of the person signing the documents (often listed as "Borrower" or "Signer").
            - customer: The company or agency hiring the notary (e.g., "Rocket Close", "Snapdocs").
            - location: The full address of the signing (often listed as "Closing Location" or "Property Address").
            - address: Just the street address part of the location.
            - city: Just the city name.
            - state: The state (e.g., "NC").
            - zip: The 5-digit zip code.
            - fee: The numeric amount being paid to the notary (look for "Signing: $XX.XX").
            - orderNumber: The order or reference number (look for "Order #").
            - invoiceNumber: The invoice number.
            - loanNumber: The loan number (look for "Closing Loan #" or "Primary Loan #").
            - phone: The phone number of the signer (look for "Mobile" under Borrower).
            - email: The email address of the signer.
            - signingType: The type of signing (e.g., "Refinance", "Purchase"). Look for "Transaction Type" or the service description.
            - notes: Any special instructions or notes.

            Return them as a JSON array of objects. If a field is missing, use an empty string or a sensible default. Ensure the output is ONLY the JSON array.`
          }
        ]
      }
    ],
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            date: { type: Type.STRING },
            time: { type: Type.STRING },
            clientName: { type: Type.STRING },
            firstName: { type: Type.STRING },
            lastName: { type: Type.STRING },
            signingType: { type: Type.STRING },
            location: { type: Type.STRING },
            address: { type: Type.STRING },
            city: { type: Type.STRING },
            state: { type: Type.STRING },
            zip: { type: Type.STRING },
            fee: { type: Type.NUMBER },
            status: { type: Type.STRING },
            notes: { type: Type.STRING },
            phone: { type: Type.STRING },
            email: { type: Type.STRING },
            customer: { type: Type.STRING },
            orderNumber: { type: Type.STRING },
            invoiceNumber: { type: Type.STRING },
            loanNumber: { type: Type.STRING }
          },
          required: ["date", "time", "clientName", "signingType", "location", "fee", "status"]
        }
      }
    }
  });

  try {
    const data = JSON.parse(response.text || '[]');
    return data.map((item: any) => {
      const appointment = {
        ...item,
        id: Math.random().toString(36).substr(2, 9),
        userId: userId,
        status: item.status || 'Scheduled',
        sortableDateTime: parseSafeDateTime(item.date, item.time).toISOString()
      };

      // Ensure clientName is set if firstName/lastName are provided
      if (!appointment.clientName && (appointment.firstName || appointment.lastName)) {
        appointment.clientName = `${appointment.firstName || ''} ${appointment.lastName || ''}`.trim();
      }
      
      // Ensure firstName/lastName are set if clientName is provided
      if (appointment.clientName && (!appointment.firstName || !appointment.lastName)) {
        const parts = appointment.clientName.trim().split(/\s+/);
        if (!appointment.firstName) appointment.firstName = parts[0] || '';
        if (!appointment.lastName) appointment.lastName = parts.slice(1).join(' ') || '';
      }

      // Ensure location is set if address/city/state/zip are provided
      if (!appointment.location && appointment.address) {
        appointment.location = `${appointment.address}, ${appointment.city || ''}${appointment.state ? `, ${appointment.state}` : ''}${appointment.zip ? ` ${appointment.zip}` : ''}`.trim();
      }

      // Ensure address/city/state/zip are set if location is provided
      if (appointment.location && (!appointment.address || !appointment.city || !appointment.state || !appointment.zip)) {
        const parts = appointment.location.split(',').map((p: string) => p.trim());
        if (!appointment.address) appointment.address = parts[0] || '';
        
        if (parts.length > 1) {
          const cityPart = parts[1];
          const zipMatch = cityPart.match(/\d{5}(-\d{4})?$/);
          if (zipMatch) {
            if (!appointment.zip) appointment.zip = zipMatch[0];
            const withoutZip = cityPart.replace(zipMatch[0], '').trim();
            const stateMatch = withoutZip.match(/\s([A-Z]{2})$/);
            if (stateMatch) {
              if (!appointment.state) appointment.state = stateMatch[1];
              if (!appointment.city) appointment.city = withoutZip.replace(stateMatch[0], '').trim();
            } else {
              if (!appointment.city) appointment.city = withoutZip;
            }
          } else {
            if (!appointment.city) appointment.city = cityPart;
          }
        }
        
        if (parts.length > 2 && !appointment.state) {
          const stateZipPart = parts[2];
          const zipMatch = stateZipPart.match(/\d{5}(-\d{4})?$/);
          if (zipMatch) {
            if (!appointment.zip) appointment.zip = zipMatch[0];
            appointment.state = stateZipPart.replace(zipMatch[0], '').trim();
          } else {
            appointment.state = stateZipPart;
          }
        }
      }

      return appointment;
    });
  } catch (e) {
    console.error("Failed to parse AI response:", e);
    return [];
  }
};

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

// --- Components ---

const NewExpenseModal = ({ isOpen, onClose, onSave, userId }: { isOpen: boolean; onClose: () => void; onSave: (e: Expense) => void; userId: string }) => {
  const [formData, setFormData] = useState<Partial<Expense>>({
    id: Math.random().toString(36).substr(2, 9),
    userId: userId,
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

const NewMileageModal = ({ isOpen, onClose, onSave, userId }: { isOpen: boolean; onClose: () => void; onSave: (m: Mileage) => void; userId: string }) => {
  const [formData, setFormData] = useState<Partial<Mileage>>({
    id: Math.random().toString(36).substr(2, 9),
    userId: userId,
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

const SettingsView = ({ onEditProfile, user, onSignIn, onImport, userId }: { onEditProfile: () => void, user: FirebaseUser | null, onSignIn: () => void, onImport: (appointments: Appointment[]) => void, userId: string }) => {
  const [isImporting, setIsImporting] = useState(false);

  const handleFileImport = (type: 'pdf' | 'csv') => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = type === 'pdf' ? '.pdf' : '.csv';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        if (type === 'pdf') {
          setIsImporting(true);
          try {
            const newAppointments = await parsePDFWithAI(file, userId);
            if (newAppointments.length > 0) {
              onImport(newAppointments);
              alert(`Successfully imported ${newAppointments.length} signings from ${file.name}.`);
            } else {
              alert('Could not find any valid signing records in the PDF file.');
            }
          } catch (error) {
            console.error("PDF Import Error:", error);
            alert('Failed to parse PDF. Please ensure it is a valid document or try CSV.');
          } finally {
            setIsImporting(false);
          }
          return;
        }

        const reader = new FileReader();
        reader.onload = (event) => {
          const text = event.target?.result as string;
          if (!text) return;

          const lines = text.split('\n');
          const newAppointments: Appointment[] = [];
          
          const headerLine = lines[0].toLowerCase();
          const headers = headerLine.split(',').map(h => h.trim().replace(/^"|"$/g, ''));
          
          const dateIdx = headers.findIndex(h => h.includes('date'));
          const timeIdx = headers.findIndex(h => h.includes('time'));
          const clientIdx = headers.findIndex(h => h.includes('client') || h.includes('name'));
          const typeIdx = headers.findIndex(h => h.includes('type'));
          const locationIdx = headers.findIndex(h => h.includes('location') || h.includes('address'));
          const feeIdx = headers.findIndex(h => h.includes('fee') || h.includes('amount'));
          const statusIdx = headers.findIndex(h => h.includes('status'));
          const notesIdx = headers.findIndex(h => h.includes('note'));
          
          // New headers
          const addressIdx = headers.findIndex(h => h.includes('address'));
          const cityIdx = headers.findIndex(h => h.includes('city'));
          const stateIdx = headers.findIndex(h => h.includes('state'));
          const zipIdx = headers.findIndex(h => h.includes('zip'));
          const orderNumIdx = headers.findIndex(h => h.includes('ordernum') || h.includes('order#'));
          const invoiceNumIdx = headers.findIndex(h => h.includes('invoicenum') || h.includes('invoice#'));
          const firstNameIdx = headers.findIndex(h => h.includes('signerfirstname') || h.includes('first name'));
          const lastNameIdx = headers.findIndex(h => h.includes('signerlastname') || h.includes('last name'));
          const homePhoneIdx = headers.findIndex(h => h.includes('signerhomephone') || h.includes('home phone'));
          const cellPhoneIdx = headers.findIndex(h => h.includes('signercellphone') || h.includes('cell phone'));
          const workPhoneIdx = headers.findIndex(h => h.includes('signerworkphone') || h.includes('work phone'));
          const emailIdx = headers.findIndex(h => h.includes('signeremail') || h.includes('email'));

          const startIdx = dateIdx !== -1 || clientIdx !== -1 || firstNameIdx !== -1 ? 1 : 0;
          
          for (let i = startIdx; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;
            
            const parts = line.split(',').map(p => p.trim().replace(/^"|"$/g, ''));
            if (parts.length >= 3) {
              const date = (dateIdx !== -1 ? parts[dateIdx] : '') || format(new Date(), 'yyyy-MM-dd');
              const time = (timeIdx !== -1 ? parts[timeIdx] : '') || '12:00 PM';
              
              // Handle Client split
              let firstName = firstNameIdx !== -1 ? parts[firstNameIdx] : '';
              let lastName = lastNameIdx !== -1 ? parts[lastNameIdx] : '';
              let clientName = clientIdx !== -1 ? parts[clientIdx] : '';

              if (!firstName && !lastName && clientName) {
                const split = splitName(clientName);
                firstName = split.firstName;
                lastName = split.lastName;
              } else if (firstName || lastName) {
                clientName = `${firstName} ${lastName}`.trim();
              }

              // Handle Location parse
              let address = addressIdx !== -1 ? parts[addressIdx] : '';
              let city = cityIdx !== -1 ? parts[cityIdx] : '';
              let state = stateIdx !== -1 ? parts[stateIdx] : '';
              let zip = zipIdx !== -1 ? parts[zipIdx] : '';
              let location = locationIdx !== -1 ? parts[locationIdx] : '';

              if (!address && !city && !state && !zip && location) {
                const parsed = parseLocation(location);
                address = parsed.address;
                city = parsed.city;
                state = parsed.state;
                zip = parsed.zip;
              } else if (address || city || state || zip) {
                location = `${address}, ${city}, ${state} ${zip}`.trim().replace(/, ,/g, ',');
              }

              newAppointments.push({
                id: Math.random().toString(36).substr(2, 9),
                userId: userId,
                date: date,
                time: time,
                clientName: clientName || 'Unknown Client',
                firstName: firstName,
                lastName: lastName,
                signingType: (typeIdx !== -1 ? parts[typeIdx] : '') || 'General Notary Work',
                location: location || 'TBD',
                address: address,
                city: city,
                state: state,
                zip: zip,
                fee: feeIdx !== -1 ? parseFloat(parts[feeIdx]) || 0 : 0,
                status: (statusIdx !== -1 ? parts[statusIdx] as AppointmentStatus : 'Scheduled') || 'Scheduled',
                notes: (notesIdx !== -1 ? parts[notesIdx] : '') || `Imported from ${file.name}`,
                orderNumber: orderNumIdx !== -1 ? parts[orderNumIdx] : '',
                invoiceNumber: invoiceNumIdx !== -1 ? parts[invoiceNumIdx] : '',
                homePhone: homePhoneIdx !== -1 ? parts[homePhoneIdx] : '',
                phone: cellPhoneIdx !== -1 ? parts[cellPhoneIdx] : '',
                workPhone: workPhoneIdx !== -1 ? parts[workPhoneIdx] : '',
                email: emailIdx !== -1 ? parts[emailIdx] : '',
                sortableDateTime: parseSafeDateTime(date, time).toISOString()
              });
            }
          }
          
          if (newAppointments.length > 0) {
            onImport(newAppointments);
            alert(`Successfully imported ${newAppointments.length} signings from ${file.name}.`);
          } else {
            alert('Could not find any valid signing records in the CSV file. Please ensure it has the correct columns.');
          }
        };
        reader.readAsText(file);
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
              onClick={() => !isImporting && handleFileImport('pdf')}
              className={cn(
                "flex items-center justify-between p-3 border border-slate-100 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer group",
                isImporting && "opacity-50 cursor-not-allowed"
              )}
            >
              <div className="flex items-center gap-3">
                {isImporting ? (
                  <RefreshCw className="w-5 h-5 text-indigo-500 animate-spin" />
                ) : (
                  <FileText className="w-5 h-5 text-red-500" />
                )}
                <span className="text-sm font-medium text-slate-700">
                  {isImporting ? 'Parsing PDF...' : 'Import from PDF'}
                </span>
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
          "fixed top-0 left-0 bottom-0 w-[280px] bg-[#27285C] text-white/70 z-50 transition-all duration-300 ease-in-out lg:translate-x-0 border-r border-white/5",
          !isOpen && "lg:w-[80px]"
        )}
      >
        <div className="flex flex-col h-full">
          {/* Logo / Header Area */}
          <div className="h-16 flex items-center px-6 border-b border-white/5">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-indigo-500 rounded-lg flex items-center justify-center shadow-lg shadow-indigo-500/20">
                <FileText className="w-5 h-5 text-white" />
              </div>
              {isOpen && (
                <span className="font-bold text-xl text-white tracking-tight">NotaryPro App</span>
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
                        ? "bg-white/5 text-white" 
                        : "hover:bg-white/5 hover:text-white text-white/70"
                    )}
                  >
                    <item.icon className={cn(
                      "w-6 h-6 transition-colors",
                      isActive ? "text-white" : "text-white/60 group-hover:text-white"
                    )} />
                    {isOpen && (
                      <div className="flex-1 flex items-center justify-between">
                        <span className={cn(
                          "text-[15px] tracking-wide",
                          (item.name === 'Settings' || item.name === 'Tools') ? "font-bold" : "font-medium"
                        )}>
                          {item.name}
                        </span>
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
                                  "text-white/70 hover:text-white hover:bg-white/5"
                                )}
                              >
                                <span className="text-[14px] font-medium">{sub.name}</span>
                              </button>
                            ) : (
                              <Link
                                to={sub.path}
                                className={cn(
                                  "flex items-center gap-4 pl-14 pr-4 py-2.5 transition-all duration-200 group relative",
                                  isSubActive ? "text-white bg-white/5" : "text-white/70 hover:text-white hover:bg-white/5"
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
                    <p className="text-sm font-semibold text-white truncate">{user.displayName || 'Frank Cox'}</p>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        onSignOut();
                      }}
                      className="text-[10px] text-white/50 hover:text-rose-400 transition-colors flex items-center gap-1"
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
                    <User className="w-6 h-6 text-white" />
                  </div>
                  {isOpen && (
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white truncate">Demo User</p>
                      <button 
                        onClick={onSignOut}
                        className="text-[10px] text-white/50 hover:text-rose-400 transition-colors flex items-center gap-1"
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

const Header = ({ toggleSidebar, onNewSigning }: { toggleSidebar: () => void; onNewSigning: () => void }) => {
  return (
    <header className="h-16 bg-[#27285C] border-b border-white/10 flex items-center justify-between px-4 lg:px-8 sticky top-0 z-30">
      <div className="flex items-center gap-4">
        <button 
          onClick={toggleSidebar}
          className="p-2 hover:bg-white/10 rounded-lg transition-colors lg:hidden"
        >
          <Menu className="w-5 h-5 text-white/70" />
        </button>
        <div className="relative hidden md:block">
          <Search className="w-4 h-4 text-white/50 absolute left-3 top-1/2 -translate-y-1/2" />
          <input 
            type="text" 
            placeholder="Search clients, addresses, signings..." 
            className="pl-10 pr-4 py-2 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-white/20 focus:border-white/50 w-[350px] transition-all"
          />
        </div>
      </div>
      <div className="flex items-center gap-2 md:gap-4">
        <button className="p-2 hover:bg-white/10 rounded-lg transition-colors relative">
          <Bell className="w-5 h-5 text-white/70" />
          <span className="absolute top-2 right-2 w-2 h-2 bg-rose-500 rounded-full border-2 border-[#27285C]"></span>
        </button>
        <button 
          onClick={onNewSigning}
          className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-[#27285C] px-4 py-2 rounded-xl text-sm font-bold transition-all shadow-lg shadow-black/20"
        >
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">New Signing</span>
        </button>
      </div>
    </header>
  );
};

const Dashboard = ({ appointments, expenses }: { appointments: Appointment[]; expenses: Expense[] }) => {
  const [chartType, setChartType] = useState<'signings' | 'income'>('signings');
  const [selectedYear, setSelectedYear] = useState('2026');

  const monthlyData = useMemo(() => {
    const months = [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
    ];

    return months.map((month, index) => {
      const monthAppointments = appointments.filter(a => {
        const date = parseSafeDateTime(a.date);
        return date.getMonth() === index && date.getFullYear().toString() === selectedYear;
      });

      const signingsCount = monthAppointments.length;
      const totalIncome = monthAppointments.reduce((sum, a) => sum + (Number(a.fee) || 0), 0);

      return {
        name: month,
        signings: signingsCount,
        income: totalIncome
      };
    });
  }, [appointments, selectedYear]);

  const totalSignings = appointments.length;
  const totalGross = appointments.reduce((sum, a) => sum + (Number(a.fee) || 0), 0);
  const totalPaid = appointments
    .filter(a => (a.status as string) === 'Paid' || a.invoicePaidDate)
    .reduce((sum, a) => sum + (Number(a.fee) || 0), 0);
  const totalUnpaid = appointments
    .filter(a => (a.status as string) !== 'Paid' && !a.invoicePaidDate)
    .reduce((sum, a) => sum + (Number(a.fee) || 0), 0);
  const totalExpenses = expenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  const netTotal = totalGross - totalExpenses;

  const metrics = [
    { label: 'Total Signings', value: totalSignings.toString(), icon: Calendar, color: 'text-slate-600', iconColor: 'text-slate-400', bg: 'bg-white' },
    { label: 'Paid Income', value: `$${totalPaid.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, icon: DollarSign, color: 'text-emerald-600', iconColor: 'text-emerald-500', bg: 'bg-white' },
    { label: 'Unpaid Amount', value: `$${totalUnpaid.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, icon: AlertTriangle, color: 'text-rose-600', iconColor: 'text-rose-500', bg: 'bg-white' },
    { label: 'Projected Total', value: `$${totalGross.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, icon: TrendingUp, color: 'text-slate-900', iconColor: 'text-slate-400', bg: 'bg-white', isBold: true },
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-700 bg-[#F9FAFB] -m-4 lg:-m-8 p-4 lg:p-8 min-h-screen">
      {/* User Hero Section */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
        <div>
          <h1 className="text-3xl font-bold text-[#1E293B] tracking-tight">Frank Coxx</h1>
          <p className="text-slate-500 font-medium mt-1">{format(new Date(), 'EEEE, MMMM do, yyyy')}</p>
        </div>
        
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4 min-w-[300px]">
          <div className="w-12 h-12 bg-indigo-50 rounded-xl flex items-center justify-center">
            <Clock className="w-6 h-6 text-indigo-600" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider">Next Signing</p>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-lg font-bold text-slate-900">3:00 PM</span>
              <span className="text-sm text-slate-500">• Monroe</span>
            </div>
            <p className="text-xs text-slate-400 font-medium">Today</p>
          </div>
        </div>
      </div>

      {/* Metrics Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {metrics.map((m) => (
          <div key={m.label} className={cn("p-6 rounded-2xl shadow-sm border border-slate-100 transition-all hover:shadow-md", m.bg)}>
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">{m.label}</span>
              <div className={cn("p-2 rounded-lg bg-slate-50", m.iconColor.replace('text-', 'bg-').replace('500', '50').replace('400', '50'))}>
                <m.icon className={cn("w-5 h-5", m.iconColor)} />
              </div>
            </div>
            <p className={cn("text-2xl tracking-tight", m.isBold ? "font-black" : "font-bold", m.color)}>
              {m.value}
            </p>
          </div>
        ))}
      </div>

      {/* Main Chart Area */}
      <div className="bg-white border border-slate-100 rounded-3xl p-8 shadow-sm">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-10">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Activity Overview</h2>
            <p className="text-sm text-slate-500 mt-1">Track your monthly performance and growth</p>
          </div>
          
          <div className="flex items-center gap-3 bg-slate-50 p-1.5 rounded-xl border border-slate-100">
            <div className="relative">
              <select 
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
                className="appearance-none bg-white border border-slate-200 rounded-lg px-4 py-2 pr-10 text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all cursor-pointer shadow-sm"
              >
                <option>2026</option>
                <option>2025</option>
                <option>2024</option>
              </select>
              <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
            
            <div className="flex bg-white rounded-lg p-1 shadow-sm border border-slate-200">
              <button 
                onClick={() => setChartType('signings')}
                className={cn(
                  "px-4 py-1.5 rounded-md text-xs font-bold transition-all",
                  chartType === 'signings' ? "bg-[#1E293B] text-white shadow-sm" : "text-slate-500 hover:text-slate-700"
                )}
              >
                Signings
              </button>
              <button 
                onClick={() => setChartType('income')}
                className={cn(
                  "px-4 py-1.5 rounded-md text-xs font-bold transition-all",
                  chartType === 'income' ? "bg-[#1E293B] text-white shadow-sm" : "text-slate-500 hover:text-slate-700"
                )}
              >
                Income
              </button>
            </div>
          </div>
        </div>

        <div className="h-[450px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={monthlyData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis 
                dataKey="name" 
                axisLine={false} 
                tickLine={false} 
                tick={{ fill: '#94a3b8', fontSize: 12, fontWeight: 600 }} 
                dy={10}
              />
              <YAxis 
                axisLine={false} 
                tickLine={false} 
                tick={{ fill: '#94a3b8', fontSize: 12, fontWeight: 600 }}
                tickFormatter={(value) => chartType === 'income' ? `$${value}` : value}
              />
              <Tooltip 
                cursor={{ fill: '#f8fafc', radius: 12 }}
                content={({ active, payload, label }) => {
                  if (active && payload && payload.length) {
                    const value = payload[0].value;
                    return (
                      <div className="bg-white border border-slate-100 p-4 rounded-2xl shadow-xl animate-in zoom-in-95 duration-200">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">{label}</p>
                        <p className="text-lg font-black text-slate-900">
                          {chartType === 'income' ? `$${Number(value).toLocaleString()}` : `${value} Signings`}
                        </p>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Bar 
                dataKey={chartType} 
                fill={chartType === 'signings' ? "#3b82f6" : "#10b981"} 
                radius={[12, 12, 0, 0]}
                barSize={48}
              >
                {monthlyData.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={entry.name === 'Jul' && entry[chartType] === 0 ? '#f1f5f9' : (chartType === 'signings' ? "#3b82f6" : "#10b981")}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        
        <div className="mt-4 flex items-center justify-center gap-2 text-xs font-medium text-slate-400">
          <div className="w-2 h-2 rounded-full bg-slate-200"></div>
          <span>Example: July had 0 signings during this period</span>
        </div>
      </div>
    </div>
  );
};

const CalendarView = ({ appointments, onViewSigning }: { appointments: Appointment[]; onViewSigning: (app: Appointment) => void }) => {
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
      .filter(app => {
        const appDate = parseSafeDateTime(app.date);
        return format(appDate, 'yyyy-MM-dd') === dateStr;
      })
      .map(app => ({
        time: app.time.split(' ')[0].toLowerCase() + (app.time.includes('PM') ? 'p' : 'a'),
        name: `${app.clientName.split(' ').pop() || app.clientName} (${app.location.split(',')[1]?.trim() || app.location})`,
        appointment: app
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
                      onClick={() => onViewSigning(event.appointment)}
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

const Appointments = ({ appointments, onNewSigning, onViewSigning, onDelete, onImport, onUpdate, userId }: { appointments: Appointment[]; onNewSigning: () => void; onViewSigning: (app: Appointment, tab?: string) => void; onDelete: (ids: string[]) => void; onImport: (apps: Appointment[]) => void; onUpdate: (app: Appointment) => void; userId: string }) => {
  const [isBatchDropdownOpen, setIsBatchDropdownOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;

  // Sort appointments by combined date and time in descending order (newest at the top)
  const sortedAppointments = useMemo(() => {
    return [...appointments]
      .map(app => ({
        ...app,
        sortableDateTime: parseSafeDateTime(app.date, app.time).toISOString()
      }))
      .sort((a, b) => {
        // Deterministic string comparison for ISO dates
        if (a.sortableDateTime < b.sortableDateTime) return 1;
        if (a.sortableDateTime > b.sortableDateTime) return -1;
        return 0;
      });
  }, [appointments]);

  const totalPages = Math.ceil(sortedAppointments.length / itemsPerPage);
  const paginatedAppointments = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return sortedAppointments.slice(start, start + itemsPerPage);
  }, [sortedAppointments, currentPage]);

  // Reset to page 1 if sortedAppointments changes
  useEffect(() => {
    setCurrentPage(1);
  }, [sortedAppointments.length]);

  const toggleSelectAll = () => {
    if (selectedIds.length === paginatedAppointments.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(paginatedAppointments.map(a => a.id));
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
                ${sortedAppointments.map(app => `
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
    const headers = [
      "Date", "Time", "Address", "City", "State", "Zip", 
      "OrderNum", "InvoiceNum", "Amount", 
      "SignerFirstName", "SignerLastName", 
      "SignerHomePhone", "SignerCellPhone", "SignerWorkPhone", "SignerEmail"
    ];
    const csvData = appointments.map(app => [
      app.date,
      app.time,
      app.address || '',
      app.city || '',
      app.state || '',
      app.zip || '',
      app.orderNumber || '',
      app.invoiceNumber || '',
      app.fee,
      app.firstName || '',
      app.lastName || '',
      app.homePhone || '',
      app.phone || '',
      app.workPhone || '',
      app.email || ''
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
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
          setIsImporting(true);
          try {
            const newAppointments = await parsePDFWithAI(file, userId);
            if (newAppointments.length > 0) {
              onImport(newAppointments);
              alert(`Successfully imported ${newAppointments.length} signings from ${file.name}.`);
            } else {
              alert('Could not find any valid signing records in the PDF file.');
            }
          } catch (error) {
            console.error("PDF Import Error:", error);
            alert('Failed to parse PDF. Please ensure it is a valid document or try CSV.');
          } finally {
            setIsImporting(false);
          }
          return;
        }

        const reader = new FileReader();
        reader.onload = (event) => {
          const text = event.target?.result as string;
          if (!text) return;

          const lines = text.split('\n');
          const newAppointments: Appointment[] = [];
          
          const headerLine = lines[0].toLowerCase();
          const headers = headerLine.split(',').map(h => h.trim().replace(/^"|"$/g, ''));
          
          const dateIdx = headers.findIndex(h => h.includes('date'));
          const timeIdx = headers.findIndex(h => h.includes('time'));
          const clientIdx = headers.findIndex(h => h.includes('client') || h.includes('name'));
          const typeIdx = headers.findIndex(h => h.includes('type'));
          const locationIdx = headers.findIndex(h => h.includes('location') || h.includes('address'));
          const feeIdx = headers.findIndex(h => h.includes('fee') || h.includes('amount'));
          const statusIdx = headers.findIndex(h => h.includes('status'));
          const notesIdx = headers.findIndex(h => h.includes('note'));
          
          // New headers
          const addressIdx = headers.findIndex(h => h.includes('address'));
          const cityIdx = headers.findIndex(h => h.includes('city'));
          const stateIdx = headers.findIndex(h => h.includes('state'));
          const zipIdx = headers.findIndex(h => h.includes('zip'));
          const orderNumIdx = headers.findIndex(h => h.includes('ordernum') || h.includes('order#'));
          const invoiceNumIdx = headers.findIndex(h => h.includes('invoicenum') || h.includes('invoice#'));
          const firstNameIdx = headers.findIndex(h => h.includes('signerfirstname') || h.includes('first name'));
          const lastNameIdx = headers.findIndex(h => h.includes('signerlastname') || h.includes('last name'));
          const homePhoneIdx = headers.findIndex(h => h.includes('signerhomephone') || h.includes('home phone'));
          const cellPhoneIdx = headers.findIndex(h => h.includes('signercellphone') || h.includes('cell phone'));
          const workPhoneIdx = headers.findIndex(h => h.includes('signerworkphone') || h.includes('work phone'));
          const emailIdx = headers.findIndex(h => h.includes('signeremail') || h.includes('email'));

          const startIdx = dateIdx !== -1 || clientIdx !== -1 || firstNameIdx !== -1 ? 1 : 0;
          
          for (let i = startIdx; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;
            
            const parts = line.split(',').map(p => p.trim().replace(/^"|"$/g, ''));
            if (parts.length >= 3) {
              const date = (dateIdx !== -1 ? parts[dateIdx] : '') || format(new Date(), 'yyyy-MM-dd');
              const time = (timeIdx !== -1 ? parts[timeIdx] : '') || '12:00 PM';
              
              // Handle Client split
              let firstName = firstNameIdx !== -1 ? parts[firstNameIdx] : '';
              let lastName = lastNameIdx !== -1 ? parts[lastNameIdx] : '';
              let clientName = clientIdx !== -1 ? parts[clientIdx] : '';

              if (!firstName && !lastName && clientName) {
                const split = splitName(clientName);
                firstName = split.firstName;
                lastName = split.lastName;
              } else if (firstName || lastName) {
                clientName = `${firstName} ${lastName}`.trim();
              }

              // Handle Location parse
              let address = addressIdx !== -1 ? parts[addressIdx] : '';
              let city = cityIdx !== -1 ? parts[cityIdx] : '';
              let state = stateIdx !== -1 ? parts[stateIdx] : '';
              let zip = zipIdx !== -1 ? parts[zipIdx] : '';
              let location = locationIdx !== -1 ? parts[locationIdx] : '';

              if (!address && !city && !state && !zip && location) {
                const parsed = parseLocation(location);
                address = parsed.address;
                city = parsed.city;
                state = parsed.state;
                zip = parsed.zip;
              } else if (address || city || state || zip) {
                location = `${address}, ${city}, ${state} ${zip}`.trim().replace(/, ,/g, ',');
              }

              newAppointments.push({
                id: Math.random().toString(36).substr(2, 9),
                userId: userId,
                date: date,
                time: time,
                clientName: clientName || 'Unknown Client',
                firstName: firstName,
                lastName: lastName,
                signingType: (typeIdx !== -1 ? parts[typeIdx] : '') || 'General Notary Work',
                location: location || 'TBD',
                address: address,
                city: city,
                state: state,
                zip: zip,
                fee: feeIdx !== -1 ? parseFloat(parts[feeIdx]) || 0 : 0,
                status: (statusIdx !== -1 ? parts[statusIdx] as AppointmentStatus : 'Scheduled') || 'Scheduled',
                notes: (notesIdx !== -1 ? parts[notesIdx] : '') || `Imported from ${file.name}`,
                orderNumber: orderNumIdx !== -1 ? parts[orderNumIdx] : '',
                invoiceNumber: invoiceNumIdx !== -1 ? parts[invoiceNumIdx] : '',
                homePhone: homePhoneIdx !== -1 ? parts[homePhoneIdx] : '',
                phone: cellPhoneIdx !== -1 ? parts[cellPhoneIdx] : '',
                workPhone: workPhoneIdx !== -1 ? parts[workPhoneIdx] : '',
                email: emailIdx !== -1 ? parts[emailIdx] : '',
                sortableDateTime: parseSafeDateTime(date, time).toISOString()
              });
            }
          }
          
          if (newAppointments.length > 0) {
            onImport(newAppointments);
            alert(`Successfully imported ${newAppointments.length} signings from ${file.name}.`);
          } else {
            alert('Could not find any valid signing records in the CSV file. Please ensure it has the correct columns.');
          }
        };
        reader.readAsText(file);
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

  const stats = useMemo(() => {
    const totalSignings = appointments.length;
    const paidIncome = appointments
      .filter(a => (a.status as string) === 'Paid' || a.invoicePaidDate)
      .reduce((sum, a) => sum + (Number(a.fee) || 0), 0);
    const unpaidIncome = appointments
      .filter(a => (a.status as string) !== 'Paid' && !a.invoicePaidDate)
      .reduce((sum, a) => sum + (Number(a.fee) || 0), 0);
    const totalFees = appointments.reduce((sum, a) => sum + (Number(a.fee) || 0), 0);

    return [
      { label: 'SIGNINGS', value: totalSignings.toString(), color: 'text-sky-600', help: true },
      { label: 'INCOME', value: `$${paidIncome.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, color: 'text-sky-600', help: true },
      { label: 'UNPAID', value: `$${unpaidIncome.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, color: 'text-rose-700', help: false },
      { label: 'TOTAL', value: `$${totalFees.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, color: 'text-slate-900', help: false },
    ];
  }, [appointments]);

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
            disabled={isImporting}
            className={cn(
              "bg-white hover:bg-slate-50 px-4 py-2 text-sm font-medium text-slate-700 flex items-center gap-2",
              isImporting && "opacity-50 cursor-not-allowed"
            )}
          >
            {isImporting ? (
              <RefreshCw className="w-4 h-4 text-sky-600 animate-spin" />
            ) : (
              <Upload className="w-4 h-4 text-sky-600" />
            )}
            {isImporting ? 'Importing...' : 'Import'} <span className="bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded-full text-[10px]">0</span>
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
                    checked={selectedIds.length === paginatedAppointments.length && paginatedAppointments.length > 0}
                    onChange={toggleSelectAll}
                  />
                </th>
                <th className="px-3 py-3 w-10"></th>
                <th className="px-3 py-3">Date / Time <ChevronDown className="inline w-3 h-3" /></th>
                <th className="px-3 py-3">Last Name <ChevronDown className="inline w-3 h-3" /></th>
                <th className="px-3 py-3">Type of work <ChevronDown className="inline w-3 h-3" /></th>
                <th className="px-3 py-3">City <ChevronDown className="inline w-3 h-3" /></th>
                <th className="px-3 py-3">Customer <ChevronDown className="inline w-3 h-3" /></th>
                <th className="px-3 py-3">Amount</th>
                <th className="px-3 py-3">Invoice Sent <ChevronDown className="inline w-3 h-3" /></th>
                <th className="px-3 py-3">Invoice Paid</th>
                <th className="px-3 py-3">Invoice Number <ChevronDown className="inline w-3 h-3" /></th>
                <th className="px-3 py-3">Mileage</th>
                <th className="px-3 py-3">Order No.</th>
                <th className="px-3 py-3"></th>
              </tr>
            </thead>
            <tbody className="text-[13px] divide-y divide-slate-100">
              {paginatedAppointments.map((app, idx) => (
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
                    {format(parseSafeDateTime(app.date), 'M/d/yyyy')}<br />
                    {app.time}
                  </td>
                  <td className="px-3 py-3">
                    <button 
                      onClick={() => onViewSigning(app)}
                      className="text-sky-600 hover:underline font-medium"
                    >
                      {app.clientName.split(' ').pop()}
                    </button>
                  </td>
                  <td className="px-3 py-3 text-slate-600">{app.signingType}</td>
                  <td className="px-3 py-3">
                    <button 
                      onClick={() => window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(app.location)}`, '_blank')}
                      className="text-sky-600 hover:underline"
                    >
                      {app.city || app.location.split(',')[1]?.trim() || app.location}
                    </button>
                  </td>
                  <td className="px-3 py-3">
                    <button 
                      onClick={() => onViewSigning(app, 'Contacts')}
                      className="text-slate-600 hover:text-sky-600 hover:underline"
                    >
                      {app.customer || "Rocket Close"}
                    </button>
                  </td>
                  <td className="px-3 py-3 font-medium text-rose-700">${app.fee.toFixed(2)}</td>
                  <td className="px-3 py-3">
                    <input 
                      type="date" 
                      value={app.invoiceSentDate || ""}
                      onChange={(e) => onUpdate({ ...app, invoiceSentDate: e.target.value })}
                      className="text-xs border border-slate-200 rounded px-1 py-0.5 outline-none focus:ring-1 focus:ring-sky-500"
                    />
                  </td>
                  <td className="px-3 py-3">
                    <input 
                      type="date"
                      value={app.invoicePaidDate || ""}
                      onChange={(e) => {
                        const newDate = e.target.value;
                        onUpdate({ 
                          ...app, 
                          invoicePaidDate: newDate,
                          status: newDate ? 'Paid' : (app.status === 'Paid' ? 'Completed' : app.status)
                        });
                      }}
                      className="text-xs border border-slate-200 rounded px-1 py-0.5 outline-none focus:ring-1 focus:ring-sky-500"
                    />
                  </td>
                  <td className="px-3 py-3">
                    <button 
                      onClick={() => onViewSigning(app, 'Invoice')}
                      className="text-sky-600 hover:underline"
                    >
                      {app.invoiceNumber || "N/A"}
                    </button>
                  </td>
                  <td className="px-3 py-3 text-slate-600">{10 + idx * 8}</td>
                  <td className="px-3 py-3 text-slate-600">{app.orderNumber || "N/A"}</td>
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

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
            <div className="text-xs text-slate-500">
              Showing <span className="font-medium">{(currentPage - 1) * itemsPerPage + 1}</span> to <span className="font-medium">{Math.min(currentPage * itemsPerPage, sortedAppointments.length)}</span> of <span className="font-medium">{sortedAppointments.length}</span> signings
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="p-1.5 rounded border border-slate-300 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              
              <div className="flex items-center gap-1">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum;
                  if (totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (currentPage <= 3) {
                    pageNum = i + 1;
                  } else if (currentPage >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = currentPage - 2 + i;
                  }
                  
                  return (
                    <button
                      key={pageNum}
                      onClick={() => setCurrentPage(pageNum)}
                      className={cn(
                        "w-8 h-8 rounded text-xs font-medium transition-colors",
                        currentPage === pageNum 
                          ? "bg-sky-600 text-white" 
                          : "bg-white border border-slate-300 text-slate-600 hover:bg-slate-50"
                      )}
                    >
                      {pageNum}
                    </button>
                  );
                })}
              </div>

              <button
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="p-1.5 rounded border border-slate-300 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
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
  const [modalInitialTab, setModalInitialTab] = useState('Signer(s)');
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
        const appWithSort = {
          ...app,
          sortableDateTime: app.sortableDateTime || parseSafeDateTime(app.date, app.time).toISOString()
        };
        if (exists) return prev.map(a => a.id === app.id ? appWithSort : a);
        return [...prev, appWithSort];
      });
      return;
    }

    try {
      const appData = { 
        ...app, 
        userId: user.uid,
        sortableDateTime: app.sortableDateTime || parseSafeDateTime(app.date, app.time).toISOString()
      };
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

  const handleImport = async (newApps: Appointment[]) => {
    if (!user) {
      setAppointments(prev => [...prev, ...newApps]);
      return;
    }

    try {
      const batch = writeBatch(db);
      newApps.forEach(app => {
        const appData = { ...app, userId: user.uid };
        batch.set(doc(db, 'appointments', app.id), appData);
      });
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'appointments-import');
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
      <div className="min-h-screen bg-[#1e3a8a] flex items-center justify-center">
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
            <Header 
              toggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)} 
              onNewSigning={() => {
                setSelectedAppointment(null);
                setIsNewSigningModalOpen(true);
              }}
            />
            
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
                      onViewSigning={(app, tab = 'Signer(s)') => {
                        setSelectedAppointment(app);
                        setModalInitialTab(tab);
                        setIsNewSigningModalOpen(true);
                      }}
                      onDelete={handleDeleteAppointments}
                      onImport={handleImport}
                      onUpdate={handleSaveAppointment}
                      userId={user?.uid || 'mock-user'}
                    />
                  } 
                />
                <Route path="/calendar" element={<CalendarView appointments={appointments} onViewSigning={(app) => {
                  setSelectedAppointment(app);
                  setIsNewSigningModalOpen(true);
                }} />} />
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
                <Route path="/settings" element={<SettingsView onEditProfile={() => setIsProfileModalOpen(true)} user={user} onSignIn={handleSignIn} onImport={handleImport} userId={user?.uid || 'mock-user'} />} />
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
                  setModalInitialTab('Signer(s)');
                }} 
                appointment={selectedAppointment}
                initialTab={modalInitialTab}
                onSave={(app) => {
                  handleSaveAppointment(app);
                  setIsNewSigningModalOpen(false);
                  setSelectedAppointment(null);
                  setModalInitialTab('Signer(s)');
                }}
                userId={user?.uid || 'mock-user'}
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
                userId={user?.uid || 'mock-user'}
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
                userId={user?.uid || 'mock-user'}
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
                userId={user?.uid || 'mock-user'}
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
