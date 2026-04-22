import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { 
  BrowserRouter as Router, 
  Routes, 
  Route, 
  Link, 
  Navigate,
  useLocation,
  useNavigate,
  useSearchParams
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
  ChevronUp,
  Upload,
  Settings2,
  PlusCircle,
  List,
  Briefcase,
  Camera,
  Loader2,
  RefreshCw,
  Phone,
  Banknote,
  Pencil,
  Calculator,
  Map as MapIcon,
  Mail,
  Save,
  ShieldCheck,
  Scan,
  Navigation,
  CreditCard,
  Activity,
  ArrowUpRight,
  ArrowDownRight,
  Zap,
  Tag
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
  isSameYear,
  isSameWeek,
  subYears,
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
import { Appointment, Customer, CustomerType, Expense, AppointmentStatus, PaymentStatus, Mileage, BusinessProfile, SigningCompany } from './types';

const DEFAULT_MILEAGE_RATE = 0.725;
import { 
  MOCK_PROFILE, 
  MOCK_APPOINTMENTS, 
  MOCK_CUSTOMERS, 
  MOCK_EXPENSES, 
  MOCK_MILEAGE 
} from './mockData';
import { auth, db, provider, storage } from './firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { demoStorage } from './lib/demoStorage';
import LoginPage from './components/LoginPage';
import DemoLoginPage from './components/DemoLoginPage';
import LandingPage from './components/LandingPage';
import NewSigningModal from './components/NewSigningModal';
import NewCustomerModal from './components/NewCustomerModal';
import SigningCompanyModal from './components/SigningCompanyModal';
import SigningCompaniesPage from './components/SigningCompaniesPage';
import LawsLookup from './components/LawsLookup';
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
  getDocFromServer,
  arrayUnion
} from 'firebase/firestore';

// Top-level mode detection
const IS_DEMO_VERSION = window.location.hostname.includes('ais-pre') || window.location.search.includes('demo=true');

// Robust date/time parsing for deterministic sorting and display
const getStatusLabel = (status: string) => {
  switch (status) {
    case 'Paid': return 'Paid';
    case 'Completed': return 'Sent';
    case 'Scheduled': return 'Unpaid';
    default: return 'Not Sent';
  }
};

const getStatusBadgeClass = (status: string) => {
  switch (status) {
    case 'Paid': return 'bg-emerald-50 text-emerald-700 border-emerald-100';
    case 'Completed': return 'bg-blue-50 text-blue-700 border-blue-100';
    case 'Scheduled': return 'bg-amber-50 text-amber-700 border-amber-100';
    default: return 'bg-slate-50 text-slate-600 border-slate-100';
  }
};

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

const sanitizeData = (data: any): any => {
  if (data === null || typeof data !== 'object') {
    return data;
  }

  if (Array.isArray(data)) {
    return data.map(sanitizeData);
  }

  // Only sanitize plain objects to avoid corrupting special objects like Firestore FieldValue
  if (Object.prototype.toString.call(data) !== '[object Object]') {
    return data;
  }

  const sanitized: any = {};
  Object.keys(data).forEach((key) => {
    const value = data[key];
    if (value !== undefined) {
      sanitized[key] = sanitizeData(value);
    }
  });
  return sanitized;
};

const parseLocation = (loc: string) => {
  if (!loc) return { address: '', city: '', state: '', zip: '' };
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

import { HYBRID_LOAN_PACKAGE, REFINANCE_PACKAGE, normalizeDocName, mergeUniqueDocuments, validateDocuments } from './lib/packageConfigs';

const formatDisplayName = (name: string) => {
  if (!name) return '';
  // Convert to Title Case if all caps, splitting by spaces and hyphens
  return name.split(/(\s+|-)/).map(part => {
    if (part.length === 0 || /^(\s+|-)$/.test(part)) return part;
    // Fix ALL CAPS like SMITH or JONES-SMITH
    if (part === part.toUpperCase() && part.length > 1) {
      return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
    }
    return part;
  }).join('');
};

const parseTextWithAI = async (text: string): Promise<Partial<Appointment>> => {
  const apiKey = (import.meta.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY);
  if (!apiKey) {
    throw new Error("Gemini API key is missing. For development, define VITE_GEMINI_API_KEY in your .env file. For production, ensure the environment variable is set.");
  }
  const ai = new GoogleGenAI({ apiKey });

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: [
      {
        role: "user",
        parts: [
          {
            text: `Extract appointment details from the following raw text (email, SMS, or notes).
            Return ONLY a valid JSON object matching this schema. Do not return markdown blocks or any other text.
            If City/State/Zip are missing from the address, format the address for the Charlotte/Mint Hill, NC area.
            
            Fields to extract/infer:
            - date: Date of the signing (e.g., "YYYY-MM-DD" format if possible)
            - time: Time (e.g., "2:00 PM")
            - clientName: The full name of the signer
            - address: The street address
            - city: The city (default: Charlotte)
            - state: The state (default: NC)
            - zip: 5-digit zip code (if available)
            - location: The full combined address string (street, city, state, zip)
            - fee: Numeric fee if mentioned (default: 0)
            - signingType: Type of signing (e.g., "Loan Signing", "Refinance", "General Notary Work")
            - notes: Any special instructions or hints found in the text.
            
            Text to process:
            """
            ${text}
            """`
          }
        ]
      }
    ],
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          date: { type: Type.STRING },
          time: { type: Type.STRING },
          clientName: { type: Type.STRING },
          address: { type: Type.STRING },
          city: { type: Type.STRING },
          state: { type: Type.STRING },
          zip: { type: Type.STRING },
          location: { type: Type.STRING },
          fee: { type: Type.NUMBER },
          signingType: { type: Type.STRING },
          notes: { type: Type.STRING }
        }
      }
    }
  });

  const parsed = JSON.parse(response.text || '{}');
  return {
    ...parsed,
    status: 'Scheduled'
  };
};

const parsePDFWithAI = async (file: File, userId: string): Promise<Appointment[]> => {
  const apiKey = (import.meta.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY);
  if (!apiKey) {
    throw new Error("Gemini API key is missing. For development, define VITE_GEMINI_API_KEY in your .env file. For production, ensure the environment variable is set.");
  }
  const ai = new GoogleGenAI({ apiKey });
  
  // Convert file to base64
  const base64 = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      if (result) {
        resolve(result.split(',')[1]);
      } else {
        reject(new Error("Failed to read PDF file."));
      }
    };
    reader.onerror = () => reject(new Error("Error reading file."));
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
            text: `You are a specialized notary signing document extractor. Analyze the provided PDF and extract all signing appointments.
            
            SIGNING DETAILS TO LOOK FOR:
            - Date and Time: Look for labels like "Scheduled Closing Date and Time", "Signing Date", "Appointment Date".
            - Client Names: Signers, Borrowers, or Co-Borrowers.
            - Customer: The company hiring you (e.g., Rocket Close, Snapdocs, Title companies).
            - Location: Address, city, state, and zip code where the signing occurs.
            - Fee: Your payment amount (e.g., "Signing: $150").
            - Loan Details: Order number, loan number, invoice number.
            - Contact Info: Signer's phone and email.
            - Documents: A list of documents included in the package.
            
            PACKAGE RECOGNITION:
            If the package mentions "Hybrid" or is clearly a mix of digital and in-person documents, set signingType to "Hybrid Loan Package". Otherwise, determine if it is a "Refinance", "Purchase", "Seller", or "General Notary Work".

            DOCUMENT SELECTION RULES:
            Focus on major documents like Note, Deed of Trust, Closing Disclosure, Signature Affidavits.
            
            Return them as a JSON array of objects. Use the following schema. If a value cannot be found, provide a sensible default or empty string. DO NOT fail just because one field is missing.`
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
            loanNumber: { type: Type.STRING },
            docs: { 
              type: Type.ARRAY, 
              items: { type: Type.STRING } 
            }
          }
        }
      }
    }
  });

    try {
      const responseText = response.text || '[]';
      console.log("[PDF Import] Raw AI response received:", responseText.length, "chars");
      const data = JSON.parse(responseText);
      return data.map((item: any) => {
        const now = new Date();
        const dateStr = format(now, 'yyyyMMdd');
        const randomStr = Math.random().toString(36).substr(2, 4).toUpperCase();
        const appointment = {
          ...item,
          id: Math.random().toString(36).substr(2, 9),
          userId: userId,
          status: item.status || 'Scheduled',
          sortableDateTime: parseSafeDateTime(item.date, item.time).toISOString(),
          invoiceNumber: item.invoiceNumber || `INV-${dateStr}-${randomStr}`,
          docs: item.docs || []
        };

        // Normalize docs if package type is recognized
        if (appointment.docs) {
          appointment.docs = mergeUniqueDocuments([], appointment.docs, appointment.signingType);
        }

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
    rate: DEFAULT_MILEAGE_RATE,
    total: 0
  });

  useEffect(() => {
    setFormData(prev => ({ ...prev, total: (prev.miles || 0) * (prev.rate || DEFAULT_MILEAGE_RATE) }));
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

const Reports = ({ 
  appointments, 
  expenses, 
  mileage,
  businessProfile
}: { 
  appointments: Appointment[]; 
  expenses: Expense[]; 
  mileage: Mileage[];
  businessProfile: BusinessProfile;
}) => {
  const location = useLocation();
  const currentPath = location.pathname;
  const [dateRange, setDateRange] = useState('This Year');
  const [selectedCustomer, setSelectedCustomer] = useState('All Customers');
  const [selectedStatus, setSelectedStatus] = useState('All Statuses');

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

  // Filter logic
  const getFilteredData = () => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();

    const filterByDate = (dateStr: string) => {
      const date = parseSafeDateTime(dateStr);
      if (dateRange === 'This Year') return date.getFullYear() === currentYear;
      if (dateRange === 'Last Year') return date.getFullYear() === currentYear - 1;
      if (dateRange === 'This Month') return date.getFullYear() === currentYear && date.getMonth() === currentMonth;
      if (dateRange === 'Last Month') {
        const lastMonth = currentMonth === 0 ? 11 : currentMonth - 1;
        const year = currentMonth === 0 ? currentYear - 1 : currentYear;
        return date.getFullYear() === year && date.getMonth() === lastMonth;
      }
      return true;
    };

    const filteredAppointments = appointments.filter(app => {
      const dateMatch = filterByDate(app.date);
      const customerMatch = selectedCustomer === 'All Customers' || app.customer === selectedCustomer;
      const statusMatch = selectedStatus === 'All Statuses' || 
                         (selectedStatus === 'Paid' && app.status === 'Paid') ||
                         (selectedStatus === 'Unpaid' && (app.status === 'Scheduled' || app.status === 'Completed'));
      return dateMatch && customerMatch && statusMatch;
    });

    const filteredExpenses = expenses.filter(exp => filterByDate(exp.date));
    const filteredMileage = mileage.filter(mil => filterByDate(mil.date));

    return { filteredAppointments, filteredExpenses, filteredMileage };
  };

  const { filteredAppointments, filteredExpenses, filteredMileage } = getFilteredData();

  const customers = Array.from(new Set(appointments.map(app => app.customer).filter(Boolean)));

  const renderReportContent = () => {
    if (activeReport.id === 'income') {
      return (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase">Date</th>
                <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase">Client</th>
                <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase">Type</th>
                <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase">Customer</th>
                <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase text-right">Fee</th>
                <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredAppointments.map(app => (
                <tr key={app.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4 text-sm text-slate-600">{format(parseSafeDateTime(app.date), 'MM/dd/yyyy')}</td>
                  <td className="px-6 py-4 text-sm font-medium text-slate-900">{app.clientName}</td>
                  <td className="px-6 py-4 text-sm text-slate-600">{app.signingType}</td>
                  <td className="px-6 py-4 text-sm text-slate-600">{app.customer}</td>
                  <td className="px-6 py-4 text-sm font-bold text-slate-900 text-right">${Number(app.fee).toFixed(2)}</td>
                  <td className="px-6 py-4">
                    <span className={cn("text-[10px] font-bold px-2 py-1 rounded uppercase tracking-wider", getStatusBadgeClass(app.status))}>
                      {getStatusLabel(app.status)}
                    </span>
                  </td>
                </tr>
              ))}
              {filteredAppointments.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-500">No income records found for the selected period.</td>
                </tr>
              )}
            </tbody>
            {filteredAppointments.length > 0 && (
              <tfoot>
                <tr className="bg-slate-50 font-bold">
                  <td colSpan={4} className="px-6 py-4 text-sm text-slate-900 text-right">Total Income:</td>
                  <td className="px-6 py-4 text-sm text-slate-900 text-right">
                    ${filteredAppointments.reduce((sum, app) => sum + Number(app.fee), 0).toFixed(2)}
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      );
    }

    if (activeReport.id === 'unpaid') {
      const unpaidApps = filteredAppointments.filter(app => app.status === 'Scheduled' || app.status === 'Completed');
      return (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase">Date</th>
                <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase">Client</th>
                <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase">Customer</th>
                <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase text-right">Amount</th>
                <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {unpaidApps.map(app => (
                <tr key={app.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4 text-sm text-slate-600">{format(parseSafeDateTime(app.date), 'MM/dd/yyyy')}</td>
                  <td className="px-6 py-4 text-sm font-medium text-slate-900">{app.clientName}</td>
                  <td className="px-6 py-4 text-sm text-slate-600">{app.customer}</td>
                  <td className="px-6 py-4 text-sm font-bold text-amber-600 text-right">${Number(app.fee).toFixed(2)}</td>
                  <td className="px-6 py-4">
                    <span className={cn("text-[10px] font-bold px-2 py-1 rounded uppercase tracking-wider", getStatusBadgeClass(app.status))}>
                      {getStatusLabel(app.status)}
                    </span>
                  </td>
                </tr>
              ))}
              {unpaidApps.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-500">No unpaid invoices found for the selected period.</td>
                </tr>
              )}
            </tbody>
            {unpaidApps.length > 0 && (
              <tfoot>
                <tr className="bg-slate-50 font-bold">
                  <td colSpan={3} className="px-6 py-4 text-sm text-slate-900 text-right">Total Outstanding:</td>
                  <td className="px-6 py-4 text-sm text-amber-600 text-right">
                    ${unpaidApps.reduce((sum, app) => sum + Number(app.fee), 0).toFixed(2)}
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      );
    }

    if (activeReport.id === 'signing-type') {
      const typeStats = filteredAppointments.reduce((acc, app) => {
        const type = app.signingType || 'Other';
        if (!acc[type]) acc[type] = { count: 0, revenue: 0 };
        acc[type].count += 1;
        acc[type].revenue += Number(app.fee);
        return acc;
      }, {} as Record<string, { count: number, revenue: number }>);

      const sortedTypes = Object.entries(typeStats).sort((a, b) => b[1].revenue - a[1].revenue);

      return (
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase">Signing Type</th>
                    <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase text-center">Count</th>
                    <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase text-right">Revenue</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {sortedTypes.map(([type, stats]) => (
                    <tr key={type} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 text-sm font-medium text-slate-900">{type}</td>
                      <td className="px-6 py-4 text-sm text-slate-600 text-center">{stats.count}</td>
                      <td className="px-6 py-4 text-sm font-bold text-slate-900 text-right">${stats.revenue.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex flex-col justify-center items-center bg-slate-50 rounded-xl p-8">
              <h4 className="text-sm font-bold text-slate-500 uppercase mb-6">Revenue Mix</h4>
              <div className="w-full max-w-[300px] h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={sortedTypes.map(([name, stats]) => ({ name, value: stats.revenue }))}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {sortedTypes.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={['#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#f59e0b', '#10b981'][index % 6]} />
                      ))}
                    </Pie>
                    <Tooltip 
                      formatter={(value: number) => `$${value.toFixed(2)}`}
                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      );
    }

    if (activeReport.id === 'profit-loss') {
      const totalIncome = filteredAppointments.reduce((sum, app) => sum + Number(app.fee), 0);
      const totalExpenses = filteredExpenses.reduce((sum, exp) => sum + Number(exp.amount), 0);
      const netProfit = totalIncome - totalExpenses;

      return (
        <div className="p-8 max-w-2xl mx-auto">
          <div className="space-y-8">
            <div className="border-b border-slate-200 pb-4">
              <h3 className="text-lg font-bold text-slate-900">Profit & Loss Statement</h3>
              <p className="text-sm text-slate-500">{dateRange}</p>
            </div>

            <div className="space-y-4">
              <div className="flex justify-between items-center py-2">
                <span className="text-sm font-bold text-slate-700 uppercase tracking-wider">Total Income</span>
                <span className="text-lg font-bold text-green-600">${totalIncome.toFixed(2)}</span>
              </div>
              <div className="pl-4 space-y-2">
                <div className="flex justify-between text-sm text-slate-600">
                  <span>Signing Fees</span>
                  <span>${totalIncome.toFixed(2)}</span>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex justify-between items-center py-2 border-t border-slate-100">
                <span className="text-sm font-bold text-slate-700 uppercase tracking-wider">Total Expenses</span>
                <span className="text-lg font-bold text-rose-600">(${totalExpenses.toFixed(2)})</span>
              </div>
              <div className="pl-4 space-y-2">
                {Object.entries(filteredExpenses.reduce((acc, exp) => {
                  acc[exp.category] = (acc[exp.category] || 0) + Number(exp.amount);
                  return acc;
                }, {} as Record<string, number>)).map(([cat, amt]) => (
                  <div key={cat} className="flex justify-between text-sm text-slate-600">
                    <span>{cat}</span>
                    <span>${amt.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-6 border-t-2 border-slate-900">
              <div className="flex justify-between items-center">
                <span className="text-lg font-black text-slate-900 uppercase tracking-tight">Net Profit</span>
                <span className={cn("text-2xl font-black", netProfit >= 0 ? "text-indigo-600" : "text-rose-600")}>
                  ${netProfit.toFixed(2)}
                </span>
              </div>
            </div>
          </div>
        </div>
      );
    }

    if (activeReport.id === 'expenses') {
      return (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase">Date</th>
                <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase">Category</th>
                <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase">Description</th>
                <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredExpenses.map(exp => (
                <tr key={exp.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4 text-sm text-slate-600">{format(parseSafeDateTime(exp.date), 'MM/dd/yyyy')}</td>
                  <td className="px-6 py-4 text-sm font-medium text-slate-900">{exp.category}</td>
                  <td className="px-6 py-4 text-sm text-slate-600">{exp.description}</td>
                  <td className="px-6 py-4 text-sm font-bold text-slate-900 text-right">${Number(exp.amount).toFixed(2)}</td>
                </tr>
              ))}
              {filteredExpenses.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-slate-500">No expense records found for the selected period.</td>
                </tr>
              )}
            </tbody>
            {filteredExpenses.length > 0 && (
              <tfoot>
                <tr className="bg-slate-50 font-bold">
                  <td colSpan={3} className="px-6 py-4 text-sm text-slate-900 text-right">Total Expenses:</td>
                  <td className="px-6 py-4 text-sm text-slate-900 text-right">
                    ${filteredExpenses.reduce((sum, exp) => sum + Number(exp.amount), 0).toFixed(2)}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      );
    }

    if (activeReport.id === 'mileage') {
      return (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase">Date</th>
                <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase">Description</th>
                <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase text-center">Miles</th>
                <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase text-right">Deduction</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredMileage.map(mil => (
                <tr key={mil.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4 text-sm text-slate-600">{format(parseSafeDateTime(mil.date), 'MM/dd/yyyy')}</td>
                  <td className="px-6 py-4 text-sm font-medium text-slate-900">{mil.description}</td>
                  <td className="px-6 py-4 text-sm text-slate-600 text-center">{mil.miles}</td>
                  <td className="px-6 py-4 text-sm font-bold text-slate-900 text-right">${(mil.miles * DEFAULT_MILEAGE_RATE).toFixed(2)}</td>
                </tr>
              ))}
              {filteredMileage.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-slate-500">No mileage records found for the selected period.</td>
                </tr>
              )}
            </tbody>
            {filteredMileage.length > 0 && (
              <tfoot>
                <tr className="bg-slate-50 font-bold">
                  <td colSpan={2} className="px-6 py-4 text-sm text-slate-900 text-right">Totals:</td>
                  <td className="px-6 py-4 text-sm text-slate-900 text-center">
                    {filteredMileage.reduce((sum, mil) => sum + Number(mil.miles), 0)} miles
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-900 text-right">
                    ${(filteredMileage.reduce((sum, mil) => sum + Number(mil.miles), 0) * DEFAULT_MILEAGE_RATE).toFixed(2)}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      );
    }

    if (activeReport.id === 'tax' || activeReport.id === 'tax-summary') {
      const totalIncome = filteredAppointments.reduce((sum, app) => sum + Number(app.fee), 0);
      const totalExpenses = filteredExpenses.reduce((sum, exp) => sum + Number(exp.amount), 0);
      const totalMileageDeduction = filteredMileage.reduce((sum, mil) => sum + Number(mil.miles), 0) * DEFAULT_MILEAGE_RATE;
      const totalDeductions = totalExpenses + totalMileageDeduction;
      const taxableIncome = Math.max(0, totalIncome - totalDeductions);
      const estimatedTax = taxableIncome * 0.153; // Self-employment tax rate approx

      return (
        <div className="p-8 max-w-4xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
            <div className="bg-indigo-50 p-6 rounded-2xl border border-indigo-100">
              <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest mb-1">Gross Income</p>
              <p className="text-2xl font-black text-indigo-600">${totalIncome.toFixed(2)}</p>
            </div>
            <div className="bg-rose-50 p-6 rounded-2xl border border-rose-100">
              <p className="text-[10px] font-bold text-rose-400 uppercase tracking-widest mb-1">Total Deductions</p>
              <p className="text-2xl font-black text-rose-600">${totalDeductions.toFixed(2)}</p>
            </div>
            <div className="bg-emerald-50 p-6 rounded-2xl border border-emerald-100">
              <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest mb-1">Taxable Income</p>
              <p className="text-2xl font-black text-emerald-600">${taxableIncome.toFixed(2)}</p>
            </div>
          </div>

          <div className="bg-slate-50 rounded-2xl p-8 border border-slate-200">
            <h3 className="text-lg font-bold text-slate-900 mb-6">Tax Summary Details</h3>
            <div className="space-y-4">
              <div className="flex justify-between py-2 border-b border-slate-200">
                <span className="text-slate-600">Business Expenses</span>
                <span className="font-bold text-slate-900">${totalExpenses.toFixed(2)}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-200">
                <span className="text-slate-600">Mileage Deduction (Standard Rate)</span>
                <span className="font-bold text-slate-900">${totalMileageDeduction.toFixed(2)}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-200">
                <span className="text-slate-600">Net Business Income</span>
                <span className="font-bold text-slate-900">${taxableIncome.toFixed(2)}</span>
              </div>
              <div className="flex justify-between py-4 mt-4 bg-white px-4 rounded-xl border border-slate-200">
                <span className="font-bold text-slate-900">Estimated Self-Employment Tax (15.3%)</span>
                <span className="font-black text-indigo-600">${estimatedTax.toFixed(2)}</span>
              </div>
            </div>
            <p className="text-[10px] text-slate-400 mt-6 italic">
              * This is an estimate for informational purposes only. Please consult with a tax professional for actual filing.
            </p>
          </div>
        </div>
      );
    }

    return (
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden min-h-[400px] flex flex-col items-center justify-center p-12 text-center">
        <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-6">
          <Newspaper className="w-10 h-10 text-slate-300" />
        </div>
        <h3 className="text-lg font-bold text-slate-900 mb-2">No Data for Selected Period</h3>
        <p className="text-slate-500 max-w-md mx-auto">
          There are no records matching your current filter criteria for the {activeReport.title.toLowerCase()}. Try adjusting your date range or filters.
        </p>
      </div>
    );
  };

  const renderReportSummary = () => {
    if (activeReport.id === 'income') {
      const total = filteredAppointments.reduce((sum, app) => sum + Number(app.fee), 0);
      const paid = filteredAppointments.filter(app => app.status === 'Paid').reduce((sum, app) => sum + Number(app.fee), 0);
      const pending = total - paid;
      return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Total Revenue</p>
            <p className="text-xl font-black text-slate-900">${total.toFixed(2)}</p>
          </div>
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Collected</p>
            <p className="text-xl font-black text-emerald-600">${paid.toFixed(2)}</p>
          </div>
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Outstanding</p>
            <p className="text-xl font-black text-amber-600">${pending.toFixed(2)}</p>
          </div>
        </div>
      );
    }
    if (activeReport.id === 'expenses') {
      const total = filteredExpenses.reduce((sum, exp) => sum + Number(exp.amount), 0);
      const count = filteredExpenses.length;
      return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Total Expenses</p>
            <p className="text-xl font-black text-rose-600">${total.toFixed(2)}</p>
          </div>
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Expense Count</p>
            <p className="text-xl font-black text-slate-900">{count} records</p>
          </div>
        </div>
      );
    }
    return null;
  };

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
          <select 
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 w-48"
          >
            <option>This Year</option>
            <option>Last Year</option>
            <option>This Quarter</option>
            <option>Last Quarter</option>
            <option>This Month</option>
            <option>Last Month</option>
            <option>All Time</option>
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Customer</label>
          <select 
            value={selectedCustomer}
            onChange={(e) => setSelectedCustomer(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 w-48"
          >
            <option>All Customers</option>
            {customers.map(c => <option key={c}>{c}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Status</label>
          <select 
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 w-48"
          >
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

      {/* Report Summary */}
      {renderReportSummary()}

      {/* Report Content */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden min-h-[400px]">
        {renderReportContent()}
      </div>
    </div>
  );
};

const BusinessProfileModal = ({ 
  isOpen, 
  onClose, 
  profile, 
  onSave,
  userId,
  onConnectGoogle,
  isConnecting
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  profile: BusinessProfile; 
  onSave: (p: BusinessProfile) => void;
  userId: string;
  onConnectGoogle: () => void;
  isConnecting: boolean;
}) => {
  const [formData, setFormData] = useState<BusinessProfile>(profile);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUploadLicense = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !userId) return;

    setIsUploading(true);
    try {
      const timestamp = Date.now();
      const sanitizedName = file.name.replace(/[^a-z0-9.]/gi, '_').toLowerCase();
      const storagePath = `notary-credentials/${userId}/${timestamp}-${sanitizedName}`;
      const storageRef = ref(storage, storagePath);

      await uploadBytes(storageRef, file);
      const downloadURL = await getDownloadURL(storageRef);
      setFormData(prev => ({ ...prev, licenseImageUrl: downloadURL }));
    } catch (error) {
      console.error("License upload error:", error);
      alert("Failed to upload license. Please try again.");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

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
            <div className="md:col-span-2 space-y-2">
              <label className="text-sm font-bold text-slate-700">Google Calendar ID (Optional)</label>
              <input 
                type="text" 
                placeholder="primary or your-email@gmail.com"
                value={formData.googleCalendarId || ''}
                onChange={(e) => setFormData({ ...formData, googleCalendarId: e.target.value })}
                className="w-full border border-slate-200 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all"
              />
              <p className="text-[10px] text-slate-500">If using a Service Account, share your calendar with the service account email first.</p>
            </div>

            {/* Google Calendar Connection Section */}
            <div className="md:col-span-2 pt-4 border-t border-slate-100">
              <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-4">Google Calendar Sync</h3>
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "w-10 h-10 rounded-lg flex items-center justify-center",
                    formData.googleCalendarConnected ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-400"
                  )}>
                    <Calendar className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">
                      {formData.googleCalendarConnected ? "Calendar Connected" : "Connect Google Calendar"}
                    </h4>
                    <p className="text-xs text-slate-500">
                      Sync your notary appointments automatically.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={onConnectGoogle}
                  disabled={isConnecting}
                  className={cn(
                    "px-4 py-2 rounded-xl text-sm font-bold transition-all flex items-center gap-2 shrink-0",
                    formData.googleCalendarConnected 
                      ? "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50" 
                      : "bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg shadow-indigo-600/20"
                  )}
                >
                  {isConnecting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : formData.googleCalendarConnected ? (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      Reconnect Calendar
                    </>
                  ) : (
                    "Connect Calendar"
                  )}
                </button>
              </div>
            </div>

            {/* License Upload Section */}
            <div className="md:col-span-2 pt-4 border-t border-slate-100">
              <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-4">Notary License & Credentials</h3>
              
              <div className="flex flex-col md:flex-row gap-6">
                <div className="flex-1 space-y-4">
                  <p className="text-xs text-slate-500">Upload a scan or photo of your Notary Commission, Driver's License, or E&O Insurance for quick access when requested by title companies.</p>
                  
                  <input 
                    type="file" 
                    accept="image/*,application/pdf"
                    onChange={handleUploadLicense}
                    className="hidden"
                    ref={fileInputRef}
                  />
                  
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-50 border border-indigo-100 text-indigo-700 rounded-xl text-sm font-bold hover:bg-indigo-100 transition-colors disabled:opacity-50"
                  >
                    {isUploading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Upload className="w-4 h-4" />
                    )}
                    Upload Credential / License
                  </button>
                </div>

                {formData.licenseImageUrl && (
                  <div className="w-full md:w-48 aspect-video md:aspect-[4/3] rounded-xl border border-slate-200 bg-slate-50 overflow-hidden relative group">
                    {formData.licenseImageUrl.toLowerCase().endsWith('.pdf') ? (
                      <div className="w-full h-full flex flex-col items-center justify-center gap-2">
                        <FileText className="w-8 h-8 text-indigo-400" />
                        <span className="text-[10px] font-bold text-slate-500">PDF Document</span>
                      </div>
                    ) : (
                      <img 
                        src={formData.licenseImageUrl} 
                        alt="Notary License" 
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    )}
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center p-2 text-center">
                      <a 
                        href={formData.licenseImageUrl} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-white text-[10px] font-bold hover:underline"
                      >
                        View Full Document
                      </a>
                    </div>
                  </div>
                )}
              </div>
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

const SettingsView = ({ 
  onEditProfile, 
  user, 
  onSignIn, 
  onImport, 
  userId,
  isDemoMode,
  onResetDemo,
  businessProfile
}: { 
  onEditProfile: () => void, 
  user: FirebaseUser | null, 
  onSignIn: () => void, 
  onImport: (appointments: Appointment[]) => void, 
  userId: string,
  isDemoMode: boolean,
  onResetDemo: () => void,
  businessProfile: BusinessProfile | null
}) => {
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
            console.error("PDF Import Error (Settings):", error);
            const errorMessage = error instanceof Error ? error.message : String(error);
            alert(`Failed to parse PDF: ${errorMessage}\n\nPlease ensure it is a valid document and the API key is configured correctly.`);
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

              const now = new Date();
              const dateStr = format(now, 'yyyyMMdd');
              const randomStr = Math.random().toString(36).substr(2, 4).toUpperCase();

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
                notes: (notesIdx !== -1 ? parts[notesIdx] : '') || '',
                orderNumber: orderNumIdx !== -1 ? parts[orderNumIdx] : '',
                invoiceNumber: (invoiceNumIdx !== -1 ? parts[invoiceNumIdx] : '') || `INV-${dateStr}-${randomStr}`,
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

        {/* Demo Mode Settings */}
        {isDemoMode && (
          <div className="bg-white p-6 rounded-2xl border border-amber-100 shadow-sm space-y-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-amber-50 rounded-lg flex items-center justify-center">
                <RefreshCw className="w-5 h-5 text-amber-600" />
              </div>
              <h3 className="font-bold text-slate-900 text-lg">Demo Mode</h3>
            </div>
            <p className="text-sm text-slate-500">You are currently in Demo Mode. All data is stored locally in your browser and will not be synced to Firestore.</p>
            <button 
              onClick={onResetDemo}
              className="w-full py-2.5 bg-amber-500 rounded-xl text-sm font-semibold text-white hover:bg-amber-600 transition-all shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Reset Demo Data
            </button>
          </div>
        )}

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

const FeeCalculator = () => {
  const [baseFee, setBaseFee] = useState<number>(0);
  const [oneWayMiles, setOneWayMiles] = useState<number>(0);
  const [scanbacks, setScanbacks] = useState<boolean>(false);
  const [afterHours, setAfterHours] = useState<boolean>(false);
  const [companyName, setCompanyName] = useState<string>('');

  const roundTripMiles = oneWayMiles * 2;
  const travelValue = roundTripMiles * DEFAULT_MILEAGE_RATE;
  const scanbackFee = scanbacks ? 25 : 0;
  const afterHoursPremium = afterHours ? 25 : 0;
  const trueTargetFee = 90 + travelValue + scanbackFee + afterHoursPremium;
  const effectiveRatePerMile = roundTripMiles > 0 ? baseFee / roundTripMiles : null;

  const getDecision = () => {
    const isLongDistanceLowPay = roundTripMiles > 50 && (effectiveRatePerMile !== null && effectiveRatePerMile < 1.00);
    
    if (baseFee >= trueTargetFee || (effectiveRatePerMile !== null && effectiveRatePerMile >= 1.75)) {
      return {
        zone: 'GREEN',
        message: "This job meets your standards. Accept it.",
        color: 'bg-emerald-500',
        textColor: 'text-white',
        bgColor: 'bg-emerald-50',
        borderColor: 'border-emerald-200',
        accentColor: 'text-emerald-700'
      };
    }
    if (baseFee >= 100 && baseFee < trueTargetFee) {
      return {
        zone: 'YELLOW',
        message: "Below your target but may be worth it. Consider your schedule and whether you want to build this client.",
        color: 'bg-amber-500',
        textColor: 'text-white',
        bgColor: 'bg-amber-50',
        borderColor: 'border-amber-200',
        accentColor: 'text-amber-700'
      };
    }
    
    return {
      zone: 'RED',
      message: "This job is below your minimum. Decline or counter.",
      color: 'bg-rose-500',
      textColor: 'text-white',
      bgColor: 'bg-rose-50',
      borderColor: 'border-rose-200',
      accentColor: 'text-rose-700'
    };
  };

  const decision = getDecision();
  const counterOffer = Math.ceil(trueTargetFee / 5) * 5;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Fee Calculator</h1>
        <p className="text-slate-500">Evaluate signing offers against your personal standards.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* SECTION 1: JOB EVALUATOR */}
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-indigo-50 rounded-lg flex items-center justify-center">
                <Calculator className="w-5 h-5 text-indigo-600" />
              </div>
              <h3 className="font-bold text-slate-900 text-lg">Job Evaluator</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700">Base Fee Offered ($)</label>
                <input 
                  type="number" 
                  value={baseFee || ''}
                  onChange={(e) => setBaseFee(Number(e.target.value))}
                  placeholder="0"
                  className="w-full border border-slate-200 rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700">One-Way Miles</label>
                <input 
                  type="number" 
                  value={oneWayMiles || ''}
                  onChange={(e) => setOneWayMiles(Number(e.target.value))}
                  placeholder="0"
                  className="w-full border border-slate-200 rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-6">
              <label className="flex items-center gap-3 cursor-pointer group">
                <div className="relative inline-flex items-center cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={scanbacks}
                    onChange={(e) => setScanbacks(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                </div>
                <span className="text-sm font-bold text-slate-700">Scanbacks Required</span>
              </label>

              <label className="flex items-center gap-3 cursor-pointer group">
                <div className="relative inline-flex items-center cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={afterHours}
                    onChange={(e) => setAfterHours(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                </div>
                <span className="text-sm font-bold text-slate-700">After Hours (6PM+)</span>
              </label>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700">Signing Company (Optional)</label>
              <input 
                type="text" 
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="Name of company"
                className="w-full border border-slate-200 rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
              />
            </div>

            {/* Calculations Summary Card */}
            <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Round Trip</p>
                  <p className="text-lg font-bold text-slate-700">{roundTripMiles} miles</p>
                </div>
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Travel Value</p>
                  <p className="text-lg font-bold text-slate-700">${travelValue.toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Scanback Fee</p>
                  <p className="text-lg font-bold text-slate-700">${scanbackFee}</p>
                </div>
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">After Hours</p>
                  <p className="text-lg font-bold text-slate-700">${afterHoursPremium}</p>
                </div>
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Effective Rate</p>
                  <p className="text-lg font-bold text-slate-700">{effectiveRatePerMile !== null ? `$${effectiveRatePerMile.toFixed(2)}/mi` : 'N/A'}</p>
                </div>
                <div className="bg-indigo-100/50 p-2 rounded-lg border border-indigo-100">
                  <p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest">TRUE Target</p>
                  <p className="text-lg font-bold text-indigo-700">${trueTargetFee.toFixed(2)}</p>
                </div>
              </div>
            </div>

            {/* Decision Zone Banner */}
            <div className={cn("p-6 rounded-2xl border transition-all duration-500", decision.bgColor, decision.borderColor)}>
              <div className="flex items-start gap-4">
                <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center shrink-0", decision.color)}>
                  {decision.zone === 'GREEN' && <CheckCircle2 className="w-6 h-6 text-white" />}
                  {decision.zone === 'YELLOW' && <AlertTriangle className="w-6 h-6 text-white" />}
                  {decision.zone === 'RED' && <X className="w-6 h-6 text-white" />}
                </div>
                <div className="space-y-1">
                  <div className={cn("text-xs font-black uppercase tracking-widest", decision.accentColor)}>
                    {decision.zone === 'GREEN' ? 'Auto Accept' : decision.zone === 'YELLOW' ? 'Review It' : 'Decline or Counter'}
                  </div>
                  <p className="font-bold text-slate-900 leading-tight">{decision.message}</p>
                  {(decision.zone === 'YELLOW' || decision.zone === 'RED') && (
                    <div className="mt-4 pt-4 border-t border-slate-200/50">
                      <p className="text-sm font-bold text-slate-700">
                        Suggested counter: <span className="text-indigo-600 text-lg ml-1">${counterOffer}</span>
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* SECTION 2: MY FEE MATRIX */}
        <div className="space-y-6">
          <div className="bg-[#27285C] text-white p-8 rounded-2xl shadow-xl space-y-8 border border-white/5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/10 rounded-lg flex items-center justify-center">
                <Library className="w-5 h-5 text-indigo-300" />
              </div>
              <h3 className="font-bold text-xl">My Fee Matrix</h3>
            </div>

            <div className="space-y-6">
              <div>
                <h4 className="text-[10px] font-black text-indigo-300 uppercase tracking-widest mb-4">Minimum Standards (Non-Negotiable)</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-white/5 p-4 rounded-xl border border-white/5">
                    <p className="text-xs text-white/50 mb-1">Base Fee</p>
                    <p className="font-bold text-lg">$90</p>
                  </div>
                  <div className="bg-white/5 p-4 rounded-xl border border-white/5">
                    <p className="text-xs text-white/50 mb-1">Travel Rate</p>
                    <p className="font-bold text-lg">${DEFAULT_MILEAGE_RATE}/mi</p>
                  </div>
                  <div className="bg-white/5 p-4 rounded-xl border border-white/5">
                    <p className="text-xs text-white/50 mb-1">Scanbacks</p>
                    <p className="font-bold text-lg">+$25</p>
                  </div>
                  <div className="bg-white/5 p-4 rounded-xl border border-white/5">
                    <p className="text-xs text-white/50 mb-1">After Hours</p>
                    <p className="font-bold text-lg">+$25</p>
                  </div>
                </div>
                <p className="mt-4 text-xs text-indigo-200 italic font-medium">Rule: If it doesn't hit these → Decline or Counter</p>
              </div>

              <div className="bg-indigo-500/20 p-6 rounded-2xl border border-indigo-500/30">
                <h4 className="text-[10px] font-black text-indigo-300 uppercase tracking-widest mb-2">Quick Formula</h4>
                <p className="text-sm font-medium leading-relaxed">
                  Minimum Fee = <span className="text-white font-bold">$90 base</span> + (${DEFAULT_MILEAGE_RATE} × round trip miles) + scanbacks + after hours premium
                </p>
              </div>

              <div className="space-y-4">
                <h4 className="text-[10px] font-black text-indigo-300 uppercase tracking-widest mb-2">Decision Zones</h4>
                
                <div className="flex items-start gap-4 group">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 mt-2 shrink-0 shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
                  <div>
                    <p className="text-sm font-bold text-white">GREEN — Auto Accept</p>
                    <p className="text-xs text-white/60">$140+ local OR $1.75+/mile effective rate</p>
                    <p className="text-xs text-white/60 italic">Easy borrower, reputable company</p>
                  </div>
                </div>

                <div className="flex items-start gap-4 group">
                  <div className="w-2 h-2 rounded-full bg-amber-500 mt-2 shrink-0 shadow-[0_0_10px_rgba(245,158,11,0.5)]" />
                  <div>
                    <p className="text-sm font-bold text-white">YELLOW — Case by Case ($100–$140)</p>
                    <p className="text-xs text-white/60">Ask: Is my schedule open? Do I want to build this client?</p>
                  </div>
                </div>

                <div className="flex items-start gap-4 group">
                  <div className="w-2 h-2 rounded-full bg-rose-500 mt-2 shrink-0 shadow-[0_0_10px_rgba(244,63,94,0.5)]" />
                  <div>
                    <p className="text-sm font-bold text-white">RED — Decline or Counter</p>
                    <p className="text-xs text-white/60">Under $90 base, long distance + low pay, or rush with no premium</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const ToolsView = ({ userId, userState }: { userId: string, userState?: string }) => {
  const [activeTab, setActiveTab] = useState<'recession' | 'calculator' | 'laws'>('recession');
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
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Tools</h1>
          <p className="text-slate-500">Helpful utilities for your daily notary work.</p>
        </div>
        
        <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 w-fit">
          <button 
            onClick={() => setActiveTab('recession')}
            className={cn(
              "px-4 py-2 rounded-lg text-sm font-bold transition-all",
              activeTab === 'recession' 
                ? "bg-white text-indigo-600 shadow-sm" 
                : "text-slate-500 hover:text-slate-700"
            )}
          >
            Recession Calendar
          </button>
          <button 
            onClick={() => setActiveTab('calculator')}
            className={cn(
              "px-4 py-2 rounded-lg text-sm font-bold transition-all",
              activeTab === 'calculator' 
                ? "bg-white text-indigo-600 shadow-sm" 
                : "text-slate-500 hover:text-slate-700"
            )}
          >
            Fee Calculator
          </button>
          <button 
            onClick={() => setActiveTab('laws')}
            className={cn(
              "px-4 py-2 rounded-lg text-sm font-bold transition-all",
              activeTab === 'laws' 
                ? "bg-white text-indigo-600 shadow-sm" 
                : "text-slate-500 hover:text-slate-700"
            )}
          >
            Laws Lookup
          </button>
        </div>
      </div>

      <div className="max-w-full">
        {activeTab === 'recession' ? (
          <div className="max-w-2xl bg-white p-8 rounded-2xl border border-slate-200 shadow-sm space-y-6">
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
                <p className="text-xs font-black text-amber-700 uppercase tracking-widest mb-2">Recession Ends At Midnight On:</p>
                <p className="text-2xl font-bold text-amber-900">{calculateRecessionDate(signingDate)}</p>
                <p className="text-xs text-amber-600 mt-4 italic">
                  * Calculation assumes standard 3-day rescission period. Always verify against specific lender instructions and federal holiday schedules.
                </p>
              </div>
            </div>
          </div>
        ) : activeTab === 'calculator' ? (
          <FeeCalculator />
        ) : (
          <LawsLookup userId={userId} userState={userState} />
        )}
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
  const [isJournalOpen, setIsJournalOpen] = useState(false);
  const [isExpensesOpen, setIsExpensesOpen] = useState(false);
  const [isMileageOpen, setIsMileageOpen] = useState(false);
  const [isReportsOpen, setIsReportsOpen] = useState(false);
  const [isToolsOpen, setIsToolsOpen] = useState(false);
  
  const navItems = [
    { name: 'Dashboard', icon: Gauge, path: '/' },
    { 
      name: 'Signings', 
      icon: Briefcase, 
      path: '/appointments',
      isOpen: isSigningsOpen,
      setIsOpen: setIsSigningsOpen,
      subItems: [
        { name: 'View Signings', icon: List, path: '/appointments' },
        { name: 'New Signing', icon: PlusCircle, path: '#', onClick: onNewSigning },
      ]
    },
    { 
      name: 'NC Journal', 
      icon: PenLine, 
      path: '/journal',
      isOpen: isJournalOpen,
      setIsOpen: setIsJournalOpen,
      subItems: [
        { name: 'View Journal', icon: List, path: '/journal' },
        { name: 'New Entry', icon: PlusCircle, path: '#', onClick: onNewSigning },
      ]
    },
    { name: 'Calendar', icon: Calendar, path: '/calendar' },
    { name: 'Customers', icon: Users, path: '/customers' },
    { name: 'Signing Companies', icon: Building2, path: '/companies' },
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
    { 
      name: 'Tools', 
      icon: Wrench, 
      path: '/tools',
      isOpen: isToolsOpen,
      setIsOpen: setIsToolsOpen,
      subItems: [
        { name: 'Recession Calendar', icon: Calendar, path: '/tools' },
        { name: 'Fee Calculator', icon: Calculator, path: '/fee-calculator' },
        { name: 'Laws Lookup', icon: BookOpen, path: '/laws-lookup' },
      ]
    },
    !user && !IS_DEMO_VERSION ? { name: 'Firestore Login', icon: ShieldCheck, path: '#', onClick: onSignIn } : null,
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
              <div 
                onClick={() => !isOpen && onSignOut()}
                className={cn(
                  "flex items-center gap-3 p-2 rounded-xl hover:bg-white/5 transition-colors cursor-pointer group",
                  !isOpen && "justify-center"
                )}
                title={!isOpen ? "Sign Out" : ""}
              >
                <div className="w-10 h-10 rounded-full bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center overflow-hidden shrink-0">
                  {user.photoURL ? (
                    <img src={user.photoURL} alt={user.displayName || 'User'} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    <User className="w-6 h-6 text-indigo-400" />
                  )}
                </div>
                {isOpen ? (
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
                ) : (
                  <div className="absolute left-full ml-4 px-3 py-2 bg-[#27285C] border border-white/10 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50 shadow-xl">
                    <p className="text-sm font-bold text-white">Sign Out</p>
                  </div>
                )}
              </div>
            ) : (
              <div 
                onClick={() => !isOpen && onSignOut()}
                className={cn(
                  "flex items-center gap-3 p-2 rounded-xl bg-white/5 hover:bg-white/10 transition-colors cursor-pointer group",
                  !isOpen && "justify-center"
                )}
                title={!isOpen ? "Sign Out" : ""}
              >
                <div className="w-10 h-10 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center overflow-hidden shrink-0">
                  <User className="w-6 h-6 text-white" />
                </div>
                {isOpen ? (
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white truncate">Demo User</p>
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
                ) : (
                  <div className="absolute left-full ml-4 px-3 py-2 bg-[#27285C] border border-white/10 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50 shadow-xl">
                    <p className="text-sm font-bold text-white">Sign Out</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </motion.aside>
    </>
  );
};

const Header = ({ toggleSidebar, onNewSigning, onSignOut, user, isDemoMode, onResetDemo }: { 
  toggleSidebar: () => void; 
  onNewSigning: () => void; 
  onSignOut: () => void; 
  user: FirebaseUser | null;
  isDemoMode: boolean;
  onResetDemo: () => void;
}) => {
  return (
    <header className="flex flex-col sticky top-0 z-30">
      {isDemoMode && (
        <div className="bg-amber-500 text-white px-4 py-1.5 text-[10px] font-black uppercase tracking-[0.2em] flex items-center justify-center gap-4 shadow-inner">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-3 h-3" />
            <span>Demo Mode — changes saved only in this browser</span>
          </div>
          <button 
            onClick={onResetDemo}
            className="bg-white/20 hover:bg-white/30 px-2 py-0.5 rounded transition-colors flex items-center gap-1"
          >
            <RefreshCw className="w-2.5 h-2.5" /> Reset Data
          </button>
        </div>
      )}
      <div className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 lg:px-8">
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
              placeholder="Search clients, addresses, signings..." 
              className="pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500/50 w-[350px] transition-all"
            />
          </div>
        </div>
        <div className="flex items-center gap-2 md:gap-4">
          <button className="p-2 hover:bg-slate-100 rounded-lg transition-colors relative">
            <Bell className="w-5 h-5 text-slate-600" />
            <span className="absolute top-2 right-2 w-2 h-2 bg-rose-500 rounded-full border-2 border-white"></span>
          </button>
          <button 
            onClick={onNewSigning}
            className="flex items-center gap-2 bg-sky-600 hover:bg-sky-700 text-white px-4 py-2 rounded-xl text-sm font-bold transition-all shadow-lg shadow-sky-600/20 border border-sky-500/50"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">New Signing</span>
          </button>
          
          {/* Quick Sign Out for Header */}
          <button 
            onClick={onSignOut}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
            title="Sign Out"
          >
            <LogOut className="w-5 h-5 text-slate-600" />
          </button>
        </div>
      </div>
    </header>
  );
};

const Dashboard = ({ 
  appointments, 
  expenses, 
  companies,
  onNewSigning, 
  onViewSigning
}: { 
  appointments: Appointment[]; 
  expenses: Expense[];
  companies: SigningCompany[];
  onNewSigning: () => void;
  onViewSigning: (app: Appointment, tab?: string) => void;
}) => {
  const navigate = useNavigate();
  const [selectedYear, setSelectedYear] = useState('2026');

  const todaySignings = useMemo(() => {
    const now = new Date();
    return appointments
      .filter(a => {
        const appDate = parseSafeDateTime(a.date);
        return isSameDay(appDate, now) && a.status !== 'Cancelled' && a.status !== 'No Show';
      })
      .sort((a, b) => {
        const timeA = parseSafeDateTime(a.date, a.time).getTime();
        const timeB = parseSafeDateTime(b.date, b.time).getTime();
        return timeA - timeB;
      });
  }, [appointments]);

  const nextSigning = useMemo(() => {
    const now = new Date();
    if (todaySignings.length > 0) {
      const upcomingToday = todaySignings.filter(a => isAfter(parseSafeDateTime(a.date, a.time), now));
      if (upcomingToday.length > 0) return upcomingToday[0];
    }
    
    return appointments
      .filter(a => isAfter(parseSafeDateTime(a.date, a.time), now) && a.status !== 'Cancelled' && a.status !== 'No Show')
      .sort((a, b) => {
        const timeA = parseSafeDateTime(a.date, a.time).getTime();
        const timeB = parseSafeDateTime(b.date, b.time).getTime();
        return timeA - timeB;
      })[0];
  }, [appointments, todaySignings]);

  const totalDueToday = useMemo(() => {
    return todaySignings.reduce((sum, a) => sum + (Number(a.fee) || 0), 0);
  }, [todaySignings]);

  const followUpsNeeded = useMemo(() => {
    return appointments.filter(a => 
      (a.status as string) !== 'Paid' && 
      !a.invoicePaidDate && 
      isBefore(parseSafeDateTime(a.date), new Date()) &&
      a.status !== 'Cancelled' && 
      a.status !== 'No Show'
    ).length;
  }, [appointments]);

  const totalPaid = useMemo(() => {
    return appointments
      .filter(a => a.status !== 'Cancelled' && a.status !== 'No Show')
      .reduce((sum, a) => sum + (Number(a.amountCollected) || (a.status === 'Paid' ? Number(a.fee) : 0) || 0), 0);
  }, [appointments]);

  const totalGross = useMemo(() => {
    return appointments
      .filter(a => a.status !== 'Cancelled' && a.status !== 'No Show')
      .reduce((sum, a) => sum + (Number(a.agreedFee) || Number(a.fee) || 0), 0);
  }, [appointments]);

  const totalUnpaid = useMemo(() => {
    return appointments
      .filter(a => a.status !== 'Cancelled' && a.status !== 'No Show')
      .reduce((sum, a) => sum + (Number(a.amountOutstanding) || ((a.status !== 'Paid' && !a.invoicePaidDate) ? Number(a.fee) : 0) || 0), 0);
  }, [appointments]);

  const totalExpenses = useMemo(() => {
    return appointments
      .filter(a => a.status !== 'Cancelled' && a.status !== 'No Show')
      .reduce((sum, a) => sum + (Number(a.totalJobCost) || 0), 0);
  }, [appointments]);

  const totalProfit = useMemo(() => {
    return appointments
      .filter(a => a.status !== 'Cancelled' && a.status !== 'No Show')
      .reduce((sum, a) => sum + (Number(a.estimatedProfit) || 0), 0);
  }, [appointments]);

  const thisWeekIncome = useMemo(() => {
    const now = new Date();
    return appointments
      .filter(a => isSameWeek(parseSafeDateTime(a.date), now) && (a.status === 'Completed' || a.status === 'Paid'))
      .reduce((sum, a) => sum + (Number(a.fee) || 0), 0);
  }, [appointments]);

  const monthlyGoal = 5000;
  const goalProgress = Math.min(100, (totalPaid / monthlyGoal) * 100);

  const lanes = useMemo(() => {
    const now = new Date();
    return [
      { id: 'today', title: 'Today', items: todaySignings, color: 'text-teal-400', bg: 'bg-teal-400/10', icon: Zap },
      { id: 'scanbacks', title: 'Needs Scanbacks', items: appointments
        .filter(a => a.scanbackStatus === 'Pending')
        .sort((a, b) => parseSafeDateTime(b.date, b.time).getTime() - parseSafeDateTime(a.date, a.time).getTime()), 
        color: 'text-amber-400', bg: 'bg-amber-400/10', icon: RefreshCw },
      { id: 'payment', title: 'Follow Up for Payment', items: appointments.filter(a => (a.status as string) !== 'Paid' && !a.invoicePaidDate && isBefore(parseSafeDateTime(a.date), now) && a.status !== 'Cancelled' && a.status !== 'No Show').slice(0, 5), color: 'text-rose-400', bg: 'bg-rose-400/10', icon: DollarSign },
      { id: 'completed', title: 'Completed', items: appointments.filter(a => a.status === 'Paid').slice(0, 5), color: 'text-emerald-400', bg: 'bg-emerald-400/10', icon: CheckCircle2 },
    ];
  }, [appointments, todaySignings]);

  const recentSignings = useMemo(() => {
    return [...appointments]
      .sort((a, b) => parseSafeDateTime(b.date, b.time).getTime() - parseSafeDateTime(a.date, a.time).getTime())
      .slice(0, 8);
  }, [appointments]);

  const topCompanies = useMemo(() => {
    const companyStats = appointments.reduce((acc, app) => {
      const name = app.signingCompany || 'Unknown';
      if (!acc[name]) {
        acc[name] = { name, count: 0, total: 0 };
      }
      acc[name].count += 1;
      acc[name].total += Number(app.fee) || 0;
      return acc;
    }, {} as Record<string, { name: string; count: number; total: number }>);

    return Object.values(companyStats)
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);
  }, [appointments]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 -m-4 lg:-m-8 p-4 lg:p-8 space-y-8 font-sans">
      {/* 1. TOP HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="space-y-1">
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Today's Work</h1>
          <p className="text-slate-500 font-medium">{format(new Date(), 'EEEE, MMMM do, yyyy')}</p>
        </div>
        
        <div className="flex flex-wrap gap-3">
          <div className="bg-white border border-slate-200 px-4 py-2 rounded-2xl flex items-center gap-3 shadow-sm">
            <div className="w-2 h-2 rounded-full bg-teal-500 animate-pulse"></div>
            <span className="text-xs font-bold text-slate-600 uppercase tracking-widest">{todaySignings.length} Signings Today</span>
          </div>
          <div className="bg-white border border-slate-200 px-4 py-2 rounded-2xl flex items-center gap-3 shadow-sm">
            <DollarSign className="w-3 h-3 text-emerald-600" />
            <span className="text-xs font-bold text-slate-600 uppercase tracking-widest">${totalDueToday.toLocaleString()} Due</span>
          </div>
          <div className="bg-white border border-slate-200 px-4 py-2 rounded-2xl flex items-center gap-3 shadow-sm">
            <AlertTriangle className="w-3 h-3 text-amber-600" />
            <span className="text-xs font-bold text-slate-600 uppercase tracking-widest">{followUpsNeeded} Follow-ups</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* LEFT COLUMN: MAIN OPS */}
        <div className="lg:col-span-8 space-y-8">
          
          {/* 2. HERO CARD: NEXT SIGNING */}
          {nextSigning ? (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="relative bg-white rounded-[2rem] p-8 border border-slate-200 shadow-xl overflow-hidden group"
            >
              <div className="absolute top-0 right-0 w-64 h-64 bg-teal-500/5 rounded-full -mr-32 -mt-32 blur-3xl transition-all group-hover:bg-teal-500/10"></div>
              
              <div className="relative z-10 flex flex-col md:flex-row justify-between gap-8">
                <div className="space-y-6">
                  <div className="flex items-center gap-3">
                    <span className="px-3 py-1 bg-teal-50 text-teal-600 text-[10px] font-black uppercase tracking-[0.2em] rounded-full border border-teal-100">
                      Next Signing
                    </span>
                    <span className="text-slate-400 text-xs font-bold">
                      {isSameDay(parseSafeDateTime(nextSigning.date), new Date()) ? 'Starting soon' : format(parseSafeDateTime(nextSigning.date), 'MMM d')}
                    </span>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex items-baseline gap-3">
                      <h2 className="text-5xl font-black text-slate-900 tracking-tighter">{nextSigning.time}</h2>
                      <span className="text-teal-600 font-bold text-lg">${Number(nextSigning.fee).toFixed(2)}</span>
                    </div>
                    <h3 className="text-2xl font-bold text-slate-800">{formatDisplayName(nextSigning.clientName)}</h3>
                  </div>

                  <div className="flex flex-wrap gap-6 text-slate-500">
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-teal-500" />
                      <span className="text-sm font-medium">{nextSigning.city || nextSigning.location?.split(',')[1]?.trim() || 'TBD'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Briefcase className="w-4 h-4 text-teal-500" />
                      <span className="text-sm font-medium">{nextSigning.signingType}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-teal-500" />
                      <span className="text-sm font-medium">{nextSigning.customer || "Rocket Close"}</span>
                    </div>
                  </div>
                </div>

                  <div className="flex flex-col justify-end gap-3 min-w-[200px]">
                    <button 
                      onClick={() => onViewSigning(nextSigning)}
                      className="w-full py-4 bg-teal-600 hover:bg-teal-700 text-white font-black rounded-2xl shadow-lg shadow-teal-100 transition-all flex items-center justify-center gap-2 group"
                    >
                      <FileText className="w-5 h-5" />
                      Open File
                    </button>
                    <div className="grid grid-cols-2 gap-3">
                      <button 
                        onClick={() => {
                          if (nextSigning.location && nextSigning.location !== 'TBD') {
                            window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(nextSigning.location)}`, '_blank');
                          } else {
                            alert('Navigation not set up yet: No address provided for this signing.');
                          }
                        }}
                        className="py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-all flex items-center justify-center gap-2"
                      >
                        <Navigation className="w-4 h-4 text-teal-600" />
                        Nav
                      </button>
                      <button 
                        onClick={() => onViewSigning(nextSigning, 'Status')}
                        className="py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-all flex items-center justify-center gap-2"
                      >
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        Done
                      </button>
                    </div>
                  </div>
              </div>
            </motion.div>
          ) : (
            <div className="bg-white rounded-[2rem] p-12 border border-slate-200 border-dashed text-center space-y-4">
              <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto">
                <Calendar className="w-8 h-8 text-slate-300" />
              </div>
              <div className="space-y-1">
                <h3 className="text-xl font-bold text-slate-900">No upcoming signings</h3>
                <p className="text-slate-500">Your schedule is clear for now. Time to market!</p>
              </div>
              <button 
                onClick={() => navigate('/signings')}
                className="px-6 py-2 bg-teal-600 text-white font-bold rounded-xl hover:bg-teal-700 transition-all"
              >
                Schedule New
              </button>
            </div>
          )}

          {/* 3. QUICK ACTIONS DOCK */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {[
              { label: 'New Signing', icon: Plus, onClick: onNewSigning, color: 'bg-teal-500' },
              { label: 'Add Journal', icon: BookOpen, onClick: () => navigate('/journal'), color: 'bg-indigo-500' },
              { label: 'Upload ID', icon: Upload, onClick: () => navigate('/journal'), color: 'bg-slate-400' },
              { label: 'Job Evaluator', icon: Calculator, onClick: () => navigate('/fee-calculator'), color: 'bg-emerald-500' },
              { label: 'Laws Lookup', icon: Library, onClick: () => navigate('/laws-lookup'), color: 'bg-amber-500' },
            ].map((action) => (
              <button 
                key={action.label}
                onClick={action.onClick}
                className="bg-white border border-slate-200 p-6 rounded-3xl flex flex-col items-center justify-center gap-4 hover:bg-slate-50 hover:border-slate-300 transition-all group shadow-sm"
              >
                <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg transition-transform group-hover:scale-110", action.color)}>
                  <action.icon className="w-6 h-6 text-white" />
                </div>
                <span className="text-xs font-black text-slate-600 uppercase tracking-widest text-center leading-tight">{action.label}</span>
              </button>
            ))}
          </div>

          {/* 4. MONEY STRIP */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: 'Collected', value: totalPaid, icon: CreditCard, color: 'text-emerald-600', onClick: () => navigate('/appointments?paymentStatus=Paid') },
              { label: 'Outstanding', value: totalUnpaid, icon: AlertTriangle, color: 'text-rose-600', onClick: () => navigate('/appointments?paymentStatus=Follow Up') },
              { label: 'Total Agreed', value: totalGross, icon: TrendingUp, color: 'text-teal-600', onClick: () => navigate('/appointments') },
              { label: 'Month Goal', value: monthlyGoal, icon: Zap, color: 'text-indigo-600', isGoal: true, onClick: () => navigate('/reports/income') },
            ].map((stat) => (
              <button 
                key={stat.label} 
                onClick={stat.onClick}
                className="bg-white border border-slate-200 p-5 rounded-3xl space-y-3 shadow-sm text-left w-full hover:bg-slate-50 transition-all"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{stat.label}</span>
                  <stat.icon className={cn("w-4 h-4", stat.color)} />
                </div>
                <div className="space-y-1">
                  <p className="text-2xl font-black text-slate-900">${stat.value.toLocaleString()}</p>
                  {stat.isGoal && (
                    <div className="space-y-2">
                      <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                        <motion.div 
                          initial={{ width: 0 }}
                          animate={{ width: `${goalProgress}%` }}
                          className="h-full bg-indigo-500 rounded-full"
                        />
                      </div>
                      <p className="text-[9px] font-bold text-slate-400">{Math.round(goalProgress)}% of target</p>
                    </div>
                  )}
                </div>
              </button>
            ))}
          </div>

          {/* 5. TASK LANES / WORKFLOW SECTION */}
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-black text-slate-900 tracking-tight">Workflow Status</h2>
              <Link to="/signings" className="text-xs font-bold text-teal-600 hover:underline uppercase tracking-widest">View Pipeline</Link>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
              {lanes.map((lane) => (
                <div key={lane.id} className="space-y-4">
                  <div className="flex items-center gap-2 px-2">
                    <lane.icon className={cn("w-4 h-4", lane.color.replace('400', '600'))} />
                    <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest">{lane.title}</h3>
                    <span className="ml-auto bg-slate-200 text-slate-600 text-[10px] font-black px-2 py-0.5 rounded-full">
                      {lane.items.length}
                    </span>
                  </div>
                  
                  <div className="space-y-3">
                    {lane.items.map((item) => (
                      <button 
                        key={item.id} 
                        onClick={() => onViewSigning(item)}
                        className="w-full text-left bg-white border border-slate-200 p-4 rounded-2xl hover:border-slate-300 transition-all group shadow-sm"
                      >
                        <div className="flex justify-between items-start mb-2">
                          <p className="text-sm font-bold text-slate-900 truncate max-w-[100px]">{formatDisplayName(item.clientName?.split(' ').pop() || '')}</p>
                          <span className="text-[10px] font-black text-teal-600">${Number(item.fee).toFixed(0)}</span>
                        </div>
                        <p className="text-[10px] text-slate-500 font-medium truncate mb-3">
                          {format(parseSafeDateTime(item.date), 'MMM d')} • {item.time}
                        </p>
                        <div className="flex items-center justify-between">
                          <span className={cn(
                            "text-[8px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider border",
                            getStatusBadgeClass(item.status)
                          )}>
                            {getStatusLabel(item.status)}
                          </span>
                          <div className="p-1.5 bg-slate-50 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity">
                            <ChevronRight className="w-3 h-3 text-slate-400" />
                          </div>
                        </div>
                      </button>
                    ))}
                    {lane.items.length === 0 && (
                      <div className="border border-slate-200 border-dashed rounded-2xl p-8 text-center bg-white/50">
                        <p className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">Clear</p>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: RECENT ACTIVITY & INSIGHTS */}
        <div className="lg:col-span-4 space-y-8">
          
          {/* 6. RECENT RECORDS PANEL */}
          <div className="bg-white border border-slate-200 rounded-[2rem] overflow-hidden flex flex-col shadow-xl">
            <div className="p-6 border-b border-slate-200 flex items-center justify-between">
              <h2 className="text-lg font-black text-slate-900">Recent Activity</h2>
              <Activity className="w-4 h-4 text-teal-600" />
            </div>
            <div className="divide-y divide-slate-100">
              {recentSignings.map((app) => (
                <button 
                  key={app.id} 
                  onClick={() => onViewSigning(app)}
                  className="w-full text-left p-5 hover:bg-slate-50 transition-colors flex items-center justify-between group"
                >
                  <div className="flex items-center gap-4 min-w-0">
                    <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0", 
                      app.status === 'Paid' ? 'bg-emerald-50' : 'bg-teal-50'
                    )}>
                      {app.status === 'Paid' ? <DollarSign className="w-5 h-5 text-emerald-600" /> : <Calendar className="w-5 h-5 text-teal-600" />}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-slate-900 truncate">{formatDisplayName(app.clientName)}</p>
                      <p className="text-[10px] font-medium text-slate-500 truncate">
                        {format(parseSafeDateTime(app.date), 'MMM d')} • {app.signingType}
                      </p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-black text-slate-900">${Number(app.fee).toFixed(2)}</p>
                    <div className="flex items-center gap-1 justify-end mt-1">
                      {app.status === 'Paid' ? (
                        <ArrowUpRight className="w-3 h-3 text-emerald-600" />
                      ) : (
                        <Clock className="w-3 h-3 text-amber-400" />
                      )}
                      <span className={cn("text-[8px] font-black uppercase tracking-widest", 
                        app.status === 'Paid' ? 'text-emerald-600' : 'text-amber-600'
                      )}>
                        {app.status}
                      </span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
            
            <Link to="/signings" className="p-4 text-center text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] hover:text-teal-600 transition-colors bg-slate-50/50">
              View Full History
            </Link>
          </div>

          {/* 7. OPTIONAL SMALL INSIGHTS: MONTH PROGRESS */}
          <div className="bg-gradient-to-br from-indigo-50 to-teal-50 border border-indigo-100 rounded-[2rem] p-8 space-y-6 relative overflow-hidden shadow-sm">
            <div className="absolute top-0 right-0 p-4">
              <Zap className="w-8 h-8 text-indigo-200" />
            </div>
            
            <div className="space-y-2">
              <h3 className="text-xl font-black text-slate-900 tracking-tight">Performance Insight</h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                You've collected <span className="text-emerald-600 font-bold">${totalPaid.toLocaleString()}</span> this month. 
                You are <span className="text-indigo-600 font-bold">{Math.round(goalProgress)}%</span> of the way to your goal.
              </p>
            </div>

            <div className="relative pt-4">
              <div className="flex justify-between text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                <span>Progress</span>
                <span>${monthlyGoal.toLocaleString()} Goal</span>
              </div>
              <div className="h-4 w-full bg-white rounded-full overflow-hidden p-1 shadow-inner">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${goalProgress}%` }}
                  className="h-full bg-gradient-to-r from-indigo-500 to-teal-500 rounded-full shadow-[0_0_15px_rgba(99,102,241,0.2)]"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 pt-4">
              <div className="bg-white p-4 rounded-2xl border border-indigo-100 shadow-sm">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Avg Fee</p>
                <p className="text-lg font-black text-slate-900">${appointments.length > 0 ? (totalGross / appointments.length).toFixed(0) : 0}</p>
              </div>
              <div className="bg-white p-4 rounded-2xl border border-indigo-100 shadow-sm">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Net Profit</p>
                <p className="text-lg font-black text-emerald-600">${(totalGross - expenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0)).toLocaleString()}</p>
              </div>
            </div>
          </div>

          {/* 8. TOP COMPANIES WIDGET */}
          <div className="bg-white border border-slate-200 rounded-[2rem] overflow-hidden flex flex-col shadow-xl">
            <div className="p-6 border-b border-slate-200 flex items-center justify-between">
              <h2 className="text-lg font-black text-slate-900">Top Companies</h2>
              <Building2 className="w-4 h-4 text-indigo-600" />
            </div>
            <div className="p-6 space-y-4">
              {topCompanies.map((company, idx) => (
                <div key={company.name} className="flex items-center justify-between group cursor-pointer" onClick={() => navigate('/companies')}>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center text-xs font-bold text-slate-400 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors">
                      {idx + 1}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-800 group-hover:text-indigo-600 transition-colors">{company.name}</p>
                      <p className="text-[10px] font-medium text-slate-400">{company.count} signings</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-black text-slate-900">${company.total.toLocaleString()}</p>
                    <p className="text-[10px] font-bold text-emerald-600">Avg: ${(company.total / company.count).toFixed(0)}</p>
                  </div>
                </div>
              ))}
              {topCompanies.length === 0 && (
                <p className="text-center text-sm text-slate-400 py-4 italic">No company data yet</p>
              )}
            </div>
            <Link to="/companies" className="p-4 text-center text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] hover:text-indigo-600 transition-colors bg-slate-50/50">
              Manage Database
            </Link>
          </div>

        </div>
      </div>
    </div>
  );
};

const CalendarView = ({ 
  appointments, 
  onViewSigning,
  isGoogleConnected,
  isConnecting,
  onConnectGoogle
}: { 
  appointments: Appointment[]; 
  onViewSigning: (app: Appointment) => void;
  isGoogleConnected?: boolean;
  isConnecting?: boolean;
  onConnectGoogle?: () => void;
}) => {
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
        if (!app?.date) return false;
        const appDate = parseSafeDateTime(app.date);
        return format(appDate, 'yyyy-MM-dd') === dateStr;
      })
      .map(app => {
        const cName = app?.clientName || app?.customerName || 'Unknown Client';
        const loc = app?.location || app?.address || 'Unknown Location';
        const tStr = app?.time || '12:00 AM';
        return {
          time: tStr.split(' ')[0].toLowerCase() + (tStr.includes('PM') ? 'p' : 'a'),
          name: `${formatDisplayName(cName.split(' ').pop() || cName)} (${loc.split(',')[1]?.trim() || loc})`,
          appointment: app
        };
      });
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
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <h1 className="text-2xl font-bold text-slate-800">
            {viewMode === 'day' ? format(currentDate, 'MMMM d, yyyy') : format(currentDate, 'MMMM yyyy')}
          </h1>
          {onConnectGoogle && (
            <button
              onClick={isGoogleConnected ? undefined : onConnectGoogle}
              disabled={isConnecting || isGoogleConnected}
              className={cn(
                "px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all",
                isGoogleConnected 
                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200 cursor-default"
                  : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
              )}
            >
              {isGoogleConnected ? (
                <><CheckCircle2 className="w-3.5 h-3.5" /> Synced with Google</>
              ) : isConnecting ? (
                <><RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-500" /> Connecting...</>
              ) : (
                <><Calendar className="w-3.5 h-3.5 text-blue-500" /> Connect Google Calendar</>
              )}
            </button>
          )}
        </div>
        
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
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
      </div>

      {/* Calendar View */}
      {viewMode === 'month' && renderMonthView()}
      {viewMode === 'week' && renderWeekView()}
      {viewMode === 'day' && renderDayView()}
    </div>
  );
};

const Appointments = ({ 
  appointments, 
  customers, 
  companies,
  onNewSigning, 
  onNewSigningWithScan,
  onViewSigning, 
  onDelete, 
  onImport, 
  onUpdate, 
  onBulkUpdateDocs,
  onBulkUpdateInvoiceStatus,
  onBulkUpdateSigningType,
  userId, 
  viewMode = 'journal' 
}: { 
  appointments: Appointment[]; 
  customers: Customer[]; 
  companies: SigningCompany[];
  onNewSigning: () => void; 
  onNewSigningWithScan?: () => void;
  onViewSigning: (app: Appointment, tab?: string) => void; 
  onDelete: (ids: string[]) => void; 
  onImport: (apps: Appointment[]) => void; 
  onUpdate: (app: Appointment) => void; 
  onBulkUpdateDocs: (ids: string[], docs: string[]) => Promise<void>;
  onBulkUpdateInvoiceStatus: (ids: string[], sent: boolean) => Promise<void>;
  onBulkUpdateSigningType: (ids: string[], type: string) => Promise<void>;
  userId: string; 
  viewMode?: 'signings' | 'journal' 
}) => {
  const [isBatchDropdownOpen, setIsBatchDropdownOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [searchParams] = useSearchParams();
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;

  // Bulk Add Documents state
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedDocsForBulk, setSelectedDocsForBulk] = useState<string[]>([]);
  const [isBulkDocsDropdownOpen, setIsBulkDocsDropdownOpen] = useState(false);
  const [isBulkTypeDropdownOpen, setIsBulkTypeDropdownOpen] = useState(false);
  const [isCustomBulkType, setIsCustomBulkType] = useState(false);
  const [customBulkType, setCustomBulkType] = useState('');
  const [bulkSuccessMessage, setBulkSuccessMessage] = useState<string | null>(null);

  const defaultSigningTypes = [
    'Loan Signing',
    'Refinance',
    'Purchase',
    'Seller Package',
    'Buyer Package',
    'HELOC',
    'Reverse Mortgage',
    'Hybrid Loan Package',
    'General Notary Work'
  ];

  const loanSigningDocs = [
    'Closing / Disbursement Instructions',
    'Title Company Client Acknowledgement (Owner Affidavit)',
    'Loan Proceeds Delivery Instructions',
    'Correction Agreement',
    'Identity Verification & Acknowledgment Certification',
    'Deed of Trust',
    'Note',
    'Occupancy Statement',
    'Signature/Name Affidavit – Borrower',
    'Signature/Name Affidavit – Non-Borrowing Party',
    'Errors and Omissions / Compliance Agreement',
    'Closing Disclosure (CD)',
    'Right to Cancel (3-Day Rescission Notice)',
    'Truth-in-Lending Disclosure (TIL)',
    'Affidavit of Understanding and Indemnity (NCLTA / E-Courts)',
    'Preliminary Limited Title Opinion'
  ];

  const notarialActs = [
    'Acknowledgment',
    'Jurat / Oath',
    'Affirmation',
    'Signature Witnessing',
    'Copy Certification'
  ];

  // Filter state
  const [dateFilter, setDateFilter] = useState(searchParams.get('date') || 'This year');
  const [companyFilter, setCompanyFilter] = useState(searchParams.get('company') || searchParams.get('customer') || 'All Companies');
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || 'All');
  const [workTypeFilter, setWorkTypeFilter] = useState(searchParams.get('type') || 'All Types of work');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState('All');
  const [invoiceSentFilter, setInvoiceSentFilter] = useState('All');
  const [profitFilter, setProfitFilter] = useState('All');
  const [sortField, setSortField] = useState<'date' | 'agreedFee' | 'amountCollected' | 'amountOutstanding' | 'paymentDueDate' | 'estimatedProfit' | 'profitMarginPercent' | 'company'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  useEffect(() => {
    const date = searchParams.get('date');
    const status = searchParams.get('status');
    const company = searchParams.get('company') || searchParams.get('customer');
    const type = searchParams.get('type');
    
    if (date) setDateFilter(date);
    if (status) setStatusFilter(status);
    if (company) setCompanyFilter(company);
    if (type) setWorkTypeFilter(type);
    
    const paymentStatus = searchParams.get('paymentStatus');
    if (paymentStatus) setPaymentStatusFilter(paymentStatus);
  }, [searchParams]);

  const workTypes = useMemo(() => {
    const unique = new Set(appointments.map(a => a.signingType));
    return Array.from(unique).sort();
  }, [appointments]);

  const uniqueCompanies = useMemo(() => {
    const fromAppointments = appointments.map(a => a.signingCompany || a.companyName || a.customer).filter(Boolean) as string[];
    const fromDatabase = companies.map(c => c.companyName);
    const defaults = ['Rocket Close', 'Snapdocs', 'Amrock', 'ServiceLink', 'Xome', 'Signature Closings', 'Bancserv'];
    
    const combined = [...defaults, ...fromAppointments, ...fromDatabase];
    const unique = new Set(combined.map(c => c.trim()));
    return Array.from(unique).sort();
  }, [appointments, companies]);

  const filteredAppointments = useMemo(() => {
    let filtered = appointments;

    // Date Filter
    const now = new Date();
    if (dateFilter === 'This year') {
      filtered = filtered.filter(a => isSameYear(parseSafeDateTime(a.date, a.time), now));
    } else if (dateFilter === 'Last year') {
      filtered = filtered.filter(a => isSameYear(parseSafeDateTime(a.date, a.time), subYears(now, 1)));
    } else if (dateFilter === 'This month') {
      filtered = filtered.filter(a => isSameMonth(parseSafeDateTime(a.date, a.time), now));
    } else if (dateFilter === 'Last month') {
      filtered = filtered.filter(a => isSameMonth(parseSafeDateTime(a.date, a.time), subMonths(now, 1)));
    } else if (dateFilter === 'This week') {
      filtered = filtered.filter(a => isSameWeek(parseSafeDateTime(a.date, a.time), now));
    } else if (dateFilter === 'Last week') {
      filtered = filtered.filter(a => isSameWeek(parseSafeDateTime(a.date, a.time), subWeeks(now, 1)));
    }

    // Company Filter
    if (companyFilter !== 'All Companies') {
      filtered = filtered.filter(a => (a.signingCompany || a.companyName || a.customer || "Rocket Close") === companyFilter);
    }

    // Status Filter
    if (statusFilter === 'Paid') {
      filtered = filtered.filter(a => (a.status === 'Paid' || !!a.invoicePaidDate));
    } else if (statusFilter === 'Unpaid') {
      filtered = filtered.filter(a => (a.status !== 'Paid' && !a.invoicePaidDate && a.status !== 'Cancelled' && a.status !== 'No Show'));
    }

    // Work Type Filter
    if (workTypeFilter !== 'All Types of work') {
      filtered = filtered.filter(a => a.signingType === workTypeFilter);
    }

    // Payment Status Filter
    if (paymentStatusFilter !== 'All') {
      filtered = filtered.filter(a => a.paymentStatus === paymentStatusFilter);
    }

    // Invoice Sent Filter
    if (invoiceSentFilter === 'Sent') {
      filtered = filtered.filter(a => a.invoiceSent === true);
    } else if (invoiceSentFilter === 'Not Sent') {
      filtered = filtered.filter(a => a.invoiceSent === false);
    }

    // Profit Filter
    if (profitFilter === 'High Profit') {
      filtered = filtered.filter(a => (a.profitMarginPercent || 0) >= 70);
    } else if (profitFilter === 'Low Profit') {
      filtered = filtered.filter(a => (a.profitMarginPercent || 0) < 40 && (a.profitMarginPercent || 0) >= 0);
    } else if (profitFilter === 'Unprofitable') {
      filtered = filtered.filter(a => (a.estimatedProfit || 0) < 0);
    }

    return filtered;
  }, [appointments, dateFilter, companyFilter, statusFilter, workTypeFilter, paymentStatusFilter, invoiceSentFilter, profitFilter]);

  // Sort appointments by combined date and time in descending order (newest at the top)
  const sortedAppointments = useMemo(() => {
    return filteredAppointments
      .map(app => {
        if (app.sortableDateTime) return app;
        return {
          ...app,
          sortableDateTime: parseSafeDateTime(app.date, app.time).toISOString()
        };
      })
      .sort((a, b) => {
        let valA: any;
        let valB: any;

        switch (sortField) {
          case 'date':
            valA = a.sortableDateTime || '';
            valB = b.sortableDateTime || '';
            break;
          case 'agreedFee':
            valA = Number(a.agreedFee) || Number(a.fee) || 0;
            valB = Number(b.agreedFee) || Number(b.fee) || 0;
            break;
          case 'amountCollected':
            valA = Number(a.amountCollected) || (a.status === 'Paid' ? Number(a.fee) : 0) || 0;
            valB = Number(b.amountCollected) || (b.status === 'Paid' ? Number(b.fee) : 0) || 0;
            break;
          case 'amountOutstanding':
            valA = Number(a.amountOutstanding) || ((a.status !== 'Paid' && !a.invoicePaidDate) ? Number(a.fee) : 0) || 0;
            valB = Number(b.amountOutstanding) || ((b.status !== 'Paid' && !b.invoicePaidDate) ? Number(b.fee) : 0) || 0;
            break;
          case 'paymentDueDate':
            valA = a.paymentDueDate || '9999-99-99';
            valB = b.paymentDueDate || '9999-99-99';
            break;
          case 'estimatedProfit':
            valA = Number(a.estimatedProfit) || 0;
            valB = Number(b.estimatedProfit) || 0;
            break;
          case 'profitMarginPercent':
            valA = Number(a.profitMarginPercent) || 0;
            valB = Number(b.profitMarginPercent) || 0;
            break;
          case 'company':
            valA = (a.signingCompany || a.companyName || '').toLowerCase();
            valB = (b.signingCompany || b.companyName || '').toLowerCase();
            break;
          default:
            valA = a.sortableDateTime || '';
            valB = b.sortableDateTime || '';
        }

        if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
        if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
        return 0;
      });
  }, [filteredAppointments, sortField, sortOrder]);

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
                <div>${formatDisplayName(app.clientName)}</div>
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

  const handleBatchStatusUpdate = (newStatus: AppointmentStatus) => {
    const updatedAppointments = appointments.map(app => {
      if (selectedIds.includes(app.id)) {
        return { ...app, status: newStatus };
      }
      return app;
    });
    
    // Call onUpdate for each selected appointment or a bulk update if available
    // Since we only have onUpdate for single appointment, we'll call it in a loop
    selectedIds.forEach(id => {
      const app = appointments.find(a => a.id === id);
      if (app) {
        onUpdate({ ...app, status: newStatus });
      }
    });
    
    setSelectedIds([]);
    setIsBatchDropdownOpen(false);
  };

  const handleBatchCompanyUpdate = (newCompany: string) => {
    selectedIds.forEach(id => {
      const app = appointments.find(a => a.id === id);
      if (app) {
        onUpdate({ ...app, signingCompany: newCompany });
      }
    });
    
    setSelectedIds([]);
    setIsBatchDropdownOpen(false);
  };

  const handleApplyPayments = () => {
    handleBatchStatusUpdate('Paid');
  };

  const handleBatchInvoice = () => {
    handleBatchStatusUpdate('Completed');
  };

  const handleBatchInvoiceStatus = async (sent: boolean) => {
    if (selectedIds.length === 0) return;
    
    try {
      await onBulkUpdateInvoiceStatus(selectedIds, sent);
      setBulkSuccessMessage(`${selectedIds.length} signings marked Invoice ${sent ? 'Sent' : 'Not Sent'}`);
      setTimeout(() => setBulkSuccessMessage(null), 3000);
      setSelectedIds([]);
      setIsSelectMode(false);
    } catch (error) {
      console.error('Error updating invoice status:', error);
    }
  };

  const handleExport = () => {
    const headers = [
      "Entry #", "Date", "Time", "Type of Act", "Documents Signed", "Principal Name", 
      "Principal Address", "ID Type", "ID Number", "Date of Birth", 
      "ID Issue Date", "ID Expiration", "Fee Charged", "Signing Company", "Notes"
    ];
    
    // Sort by date/time ascending for entry numbers
    const sortedForExport = [...appointments].sort((a, b) => {
      const dateA = a.sortableDateTime || parseSafeDateTime(a.date, a.time).toISOString();
      const dateB = b.sortableDateTime || parseSafeDateTime(b.date, b.time).toISOString();
      return dateA.localeCompare(dateB);
    });

    const csvData = sortedForExport.map((app, index) => [
      index + 1,
      app.date,
      app.time,
      app.signingType,
      (app.docs || []).join("; "),
      app.clientName,
      app.location,
      app.idType || '',
      app.idNumber || '',
      app.dob || '',
      app.idIssueDate || '',
      app.idExpiration || '',
      app.fee,
      app.signingCompany || '',
      (app.notes || '').replace(/,/g, ';') // Escape commas in notes
    ]);
    
    const csvContent = [headers, ...csvData].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", "NC_Notary_Journal_Export.csv");
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
            console.error("PDF Import Error (Dashboard):", error);
            const errorMessage = error instanceof Error ? error.message : String(error);
            alert(`Failed to parse PDF: ${errorMessage}\n\nPlease ensure it is a valid document and the API key is configured correctly.`);
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

              const now = new Date();
              const dateStr = format(now, 'yyyyMMdd');
              const randomStr = Math.random().toString(36).substr(2, 4).toUpperCase();

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
                notes: (notesIdx !== -1 ? parts[notesIdx] : '') || '',
                orderNumber: orderNumIdx !== -1 ? parts[orderNumIdx] : '',
                invoiceNumber: (invoiceNumIdx !== -1 ? parts[invoiceNumIdx] : '') || `INV-${dateStr}-${randomStr}`,
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
    const activeApps = filteredAppointments.filter(a => a.status !== 'Cancelled' && a.status !== 'No Show');
    const totalSignings = activeApps.length;
    const paidIncome = activeApps
      .reduce((sum, a) => sum + (Number(a.amountCollected) || (a.status === 'Paid' ? Number(a.fee) : 0) || 0), 0);
    const unpaidIncome = activeApps
      .reduce((sum, a) => sum + (Number(a.amountOutstanding) || ((a.status !== 'Paid' && !a.invoicePaidDate) ? Number(a.fee) : 0) || 0), 0);
    const totalFees = activeApps.reduce((sum, a) => sum + (Number(a.agreedFee) || Number(a.fee) || 0), 0);
    const totalExpenses = activeApps.reduce((sum, a) => sum + (Number(a.totalJobCost) || 0), 0);
    const totalProfit = activeApps.reduce((sum, a) => sum + (Number(a.estimatedProfit) || 0), 0);
    const avgProfit = totalSignings > 0 ? totalProfit / totalSignings : 0;
    
    const now = new Date();
    const monthlyProfit = activeApps
      .filter(a => isSameMonth(parseSafeDateTime(a.date, a.time), now))
      .reduce((sum, a) => sum + (Number(a.estimatedProfit) || 0), 0);
      
    const highestProfit = activeApps.length > 0 
      ? Math.max(...activeApps.map(a => Number(a.estimatedProfit) || 0)) 
      : 0;

    const lowProfitCount = activeApps.filter(a => (a.profitMarginPercent || 0) < 40).length;
    
    const percentCollected = totalFees > 0 ? Math.round((paidIncome / totalFees) * 100) : 0;

    return {
      totalSignings,
      paidIncome,
      unpaidIncome,
      totalFees,
      totalExpenses,
      totalProfit,
      avgProfit,
      monthlyProfit,
      highestProfit,
      lowProfitCount,
      percentCollected
    };
  }, [filteredAppointments]);

  const companyStats = useMemo(() => {
    if (companyFilter === 'All Companies') return null;
    
    const companyApps = appointments.filter(a => {
      const company = a.signingCompany || a.companyName || a.customer || "Rocket Close";
      return company === companyFilter && a.status !== 'Cancelled' && a.status !== 'No Show';
    });
    const paid = companyApps
      .filter(a => (a.status as string) === 'Paid' || a.invoicePaidDate)
      .reduce((sum, a) => sum + (Number(a.fee) || 0), 0);
    const unpaid = companyApps
      .filter(a => (a.status as string) !== 'Paid' && !a.invoicePaidDate)
      .reduce((sum, a) => sum + (Number(a.fee) || 0), 0);
    
    const total = paid + unpaid;
      
    return { paid, unpaid, total };
  }, [appointments, companyFilter]);

  const getStatusBadge = (status: string, app?: Appointment) => {
    // If we have a specific payment status, use that
    if (app?.paymentStatus) {
      switch (app.paymentStatus) {
        case 'Paid':
          return <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 border border-emerald-200">Paid</span>;
        case 'Partial':
          return <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-sky-100 text-sky-700 border border-sky-200">Partial</span>;
        case 'Follow Up':
          return <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700 border border-amber-200">Follow Up</span>;
        case 'Sent':
          return <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-700 border border-indigo-200">Sent</span>;
        case 'Not Sent':
          return <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-slate-100 text-slate-500 border border-slate-200">Not Sent</span>;
      }
    }

    // Fallback to legacy status logic
    switch (status) {
      case 'Paid':
        return <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 border border-emerald-200">Paid</span>;
      case 'Completed':
        return <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-blue-100 text-blue-700 border border-blue-200">Invoice Sent</span>;
      case 'Scheduled':
        return <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700 border border-amber-200">Unpaid</span>;
      case 'Cancelled':
      case 'No Show':
        return <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-slate-100 text-slate-500 border border-slate-200">Not Sent</span>;
      default:
        return <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-slate-100 text-slate-500 border border-slate-200">{status}</span>;
    }
  };

  const getScanbackBadge = (status?: string) => {
    switch (status) {
      case 'Pending':
        return <span className="px-2 py-0.5 rounded text-[9px] font-black bg-amber-50 text-amber-600 border border-amber-200 uppercase tracking-widest">Pending</span>;
      case 'Sent':
        return <span className="px-2 py-0.5 rounded text-[9px] font-black bg-indigo-50 text-indigo-600 border border-indigo-200 uppercase tracking-widest">Sent</span>;
      case 'Confirmed':
        return <span className="px-2 py-0.5 rounded text-[9px] font-black bg-emerald-50 text-emerald-600 border border-emerald-200 uppercase tracking-widest">Confirmed</span>;
      case 'Not Required':
      default:
        return <span className="px-2 py-0.5 rounded text-[9px] font-black bg-slate-50 text-slate-400 border border-slate-200 uppercase tracking-widest">N/A</span>;
    }
  };

  const handleSort = (field: typeof sortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-700">
      {/* KPI Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Total Signings</p>
          <p className="text-2xl font-black text-slate-900">{stats.totalSignings}</p>
        </div>
        
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Collected</p>
          <p className="text-2xl font-black text-emerald-600">${stats.paidIncome.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</p>
          <p className="text-[10px] font-medium text-slate-500 mt-1">{stats.percentCollected}% collected</p>
        </div>

        <div className="bg-white p-5 rounded-xl border-2 border-amber-100 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between mb-1">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Outstanding</p>
            <span className="bg-amber-100 text-amber-700 text-[9px] font-black px-1.5 py-0.5 rounded-full uppercase">Follow Up</span>
          </div>
          <p className="text-2xl font-black text-amber-600">${stats.unpaidIncome.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</p>
          <p className="text-[10px] font-medium text-slate-500 mt-1">Unpaid invoices</p>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Net Profit</p>
          <p className="text-2xl font-black text-indigo-600">${stats.totalProfit.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</p>
          <p className="text-[10px] font-medium text-slate-500 mt-1">${stats.monthlyProfit.toLocaleString()} this month</p>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Avg Profit</p>
          <p className="text-2xl font-black text-slate-900">${stats.avgProfit.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</p>
          <p className="text-[10px] font-medium text-slate-500 mt-1">Per signing</p>
        </div>

        {viewMode === 'journal' && (
          <div className="bg-indigo-50 p-5 rounded-xl border border-indigo-100 shadow-sm">
            <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest mb-1">Retention Notice</p>
            <p className="text-xs font-bold text-indigo-900 leading-tight">Journals must be kept for 10 years from the date of the last entry.</p>
            <p className="text-[9px] text-indigo-400 mt-1">NC Requirement 18 NCAC 07I .0302</p>
          </div>
        )}
      </div>

      {/* Profit Insights */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest mb-1">Highest Profit</p>
            <p className="text-xl font-black text-emerald-700">${stats.highestProfit.toLocaleString()}</p>
          </div>
          <TrendingUp className="w-8 h-8 text-emerald-200" />
        </div>
        <div className="bg-amber-50 p-4 rounded-xl border border-amber-100 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold text-amber-600 uppercase tracking-widest mb-1">Low Margin Jobs</p>
            <p className="text-xl font-black text-amber-700">{stats.lowProfitCount}</p>
          </div>
          <Car className="w-8 h-8 text-amber-200" />
        </div>
        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Total Expenses</p>
            <p className="text-xl font-black text-slate-700">${stats.totalExpenses.toLocaleString()}</p>
          </div>
          <RefreshCw className="w-8 h-8 text-slate-200" />
        </div>
      </div>

        <div>
          <h1 className="text-2xl font-bold text-slate-900">{viewMode === 'journal' ? 'NC Notary Journal' : 'Signings'}</h1>
          <p className="text-slate-500">{viewMode === 'journal' ? 'Official record of all notarial acts performed.' : 'Manage and track your signing appointments.'}</p>
        </div>
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex flex-wrap items-center gap-2 lg:gap-3">
            <button 
              onClick={onNewSigning}
              className="bg-[#27285C] hover:bg-[#1e1f4a] text-white px-4 py-2 rounded text-sm font-bold flex items-center gap-2 transition-all shadow-sm border border-white/10"
            >
              <PlusCircle className="w-4 h-4" /> {viewMode === 'journal' ? 'Add Entry' : 'Add Signing'}
            </button>
            {viewMode === 'journal' && onNewSigningWithScan && (
              <button 
                onClick={onNewSigningWithScan}
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded text-sm font-bold flex items-center gap-2 transition-all shadow-sm border border-white/10"
              >
                <Camera className="w-4 h-4" /> Scan ID
              </button>
            )}
          <button 
            onClick={handlePrint}
            className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 px-4 py-2 rounded text-sm font-bold flex items-center gap-2 transition-all shadow-sm"
          >
            <Printer className="w-4 h-4" /> Print
          </button>
          
          <button 
            onClick={() => {
              setIsSelectMode(!isSelectMode);
              if (isSelectMode) setSelectedIds([]);
            }}
            className={cn(
              "px-4 py-2 rounded text-sm font-bold flex items-center gap-2 transition-all shadow-sm border",
              isSelectMode 
                ? "bg-indigo-50 border-indigo-300 text-indigo-700" 
                : "bg-white border-slate-300 text-slate-700 hover:bg-slate-50"
            )}
          >
            <CheckCircle2 className="w-4 h-4" /> {isSelectMode ? 'Exit Selection' : 'Select Entries'}
          </button>
          
          <div className="relative">
            <button 
              onClick={() => setIsBatchDropdownOpen(!isBatchDropdownOpen)}
              className={cn(
                "px-4 py-2 rounded text-sm font-bold flex items-center gap-2 transition-all shadow-sm border",
                selectedIds.length > 0 
                  ? "bg-white border-slate-300 text-slate-700 hover:bg-slate-50" 
                  : "bg-slate-50 border-slate-200 text-slate-400 cursor-not-allowed"
              )}
              disabled={selectedIds.length === 0}
            >
              Batch Actions {selectedIds.length > 0 && `(${selectedIds.length})`} <ChevronDown className="w-4 h-4" />
            </button>
            {isBatchDropdownOpen && selectedIds.length > 0 && (
              <>
                <div 
                  className="fixed inset-0 z-40" 
                  onClick={() => setIsBatchDropdownOpen(false)}
                />
                <div className="absolute top-full left-0 mt-2 w-48 bg-white border border-slate-200 rounded-lg shadow-xl z-50 py-1 animate-in fade-in slide-in-from-top-2 duration-200">
                  <button 
                    onClick={() => {
                      handleApplyPayments();
                      setIsBatchDropdownOpen(false);
                    }}
                    className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 font-medium flex items-center gap-2 border-b border-slate-100"
                  >
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" /> Mark as Paid
                  </button>
                  <button 
                    onClick={() => {
                      handleBatchInvoiceStatus(true);
                      setIsBatchDropdownOpen(false);
                    }}
                    className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 font-medium flex items-center gap-2 border-b border-slate-100"
                  >
                    <Printer className="w-4 h-4 text-blue-500" /> Mark Invoice Sent
                  </button>
                  <button 
                    onClick={() => {
                      handleBatchInvoiceStatus(false);
                      setIsBatchDropdownOpen(false);
                    }}
                    className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 font-medium flex items-center gap-2 border-b border-slate-100"
                  >
                    <X className="w-4 h-4 text-slate-400" /> Mark Invoice Not Sent
                  </button>
                  <button 
                    onClick={() => handleBatchStatusUpdate('Completed')}
                    className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 font-medium flex items-center gap-2 border-b border-slate-100"
                  >
                    <CheckCircle2 className="w-4 h-4 text-blue-500" /> Mark Completed
                  </button>
                  <button 
                    onClick={() => handleBatchStatusUpdate('Cancelled')}
                    className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 font-medium flex items-center gap-2 border-b border-slate-100"
                  >
                    <X className="w-4 h-4 text-rose-500" /> Mark Canceled
                  </button>
                  
                  <div className="px-4 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-50 border-b border-slate-100">
                    Change Company
                  </div>
                  <div className="max-h-48 overflow-y-auto border-b border-slate-100">
                    {uniqueCompanies.map(company => (
                      <button 
                        key={company}
                        onClick={() => handleBatchCompanyUpdate(company)}
                        className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 font-medium flex items-center gap-2 border-b border-slate-100 last:border-0"
                      >
                        {company}
                      </button>
                    ))}
                  </div>

                  <button 
                    onClick={() => {
                      handleDelete();
                      setIsBatchDropdownOpen(false);
                    }}
                    className="w-full text-left px-4 py-2 text-sm text-rose-600 hover:bg-rose-50 font-medium flex items-center gap-2"
                  >
                    <Trash2 className="w-4 h-4" /> Delete Selected
                  </button>
                </div>
              </>
            )}
          </div>

          <button 
            onClick={handleExport}
            className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 px-4 py-2 rounded text-sm font-bold flex items-center gap-2 transition-all shadow-sm"
          >
            <Download className="w-4 h-4" /> Export
          </button>
          <button 
            onClick={handleImport}
            disabled={isImporting}
            className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 px-4 py-2 rounded text-sm font-bold flex items-center gap-2 transition-all shadow-sm disabled:opacity-50"
          >
            {isImporting ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Upload className="w-4 h-4" />
            )}
            {isImporting ? 'Importing...' : 'Import'}
          </button>
          
          <button 
            className="bg-white hover:bg-slate-50 text-slate-400 hover:text-slate-600 border border-slate-300 p-2 rounded text-sm font-bold flex items-center justify-center transition-all shadow-sm"
            title="More Actions"
          >
            <Settings2 className="w-4 h-4" />
          </button>
        </div>
      </div>


      <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <select 
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-500/20 w-32 shadow-sm"
          >
            <option value="This year">This year</option>
            <option value="Last year">Last year</option>
            <option value="This month">This month</option>
            <option value="Last month">Last month</option>
            <option value="This week">This week</option>
            <option value="Last week">Last week</option>
          </select>
          <select 
            value={companyFilter}
            onChange={(e) => setCompanyFilter(e.target.value)}
            className="bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-500/20 w-44 shadow-sm"
          >
            <option value="All Companies">All Companies</option>
            {uniqueCompanies.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          
          {companyStats && (
            <div className="flex items-center gap-4 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-[10px] font-bold animate-in fade-in slide-in-from-left-2 duration-300 shadow-sm">
              <div className="flex items-center gap-1.5">
                <span className="text-slate-400 uppercase tracking-widest">Paid:</span>
                <span className="text-emerald-600">${companyStats.paid.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
              <div className="flex items-center gap-1.5 border-l border-slate-200 pl-4">
                <span className="text-slate-400 uppercase tracking-widest">Unpaid:</span>
                <span className="text-amber-600">${companyStats.unpaid.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
              <div className="flex items-center gap-1.5 border-l border-slate-200 pl-4">
                <span className="text-slate-400 uppercase tracking-widest">Total:</span>
                <span className="text-slate-900">${companyStats.total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
            </div>
          )}

          <select 
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-500/20 w-32 shadow-sm"
          >
            <option value="All">All Status</option>
            <option value="Paid">Paid</option>
            <option value="Unpaid">Unpaid</option>
          </select>
          <select 
            value={workTypeFilter}
            onChange={(e) => setWorkTypeFilter(e.target.value)}
            className="bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-500/20 w-44 shadow-sm"
          >
            <option value="All Types of work">All Types</option>
            {workTypes.map(w => <option key={w} value={w}>{w}</option>)}
          </select>

          <select 
            value={paymentStatusFilter}
            onChange={(e) => setPaymentStatusFilter(e.target.value)}
            className="bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-500/20 w-32 shadow-sm"
          >
            <option value="All">All Payments</option>
            <option>Not Sent</option>
            <option>Sent</option>
            <option>Partial</option>
            <option>Paid</option>
            <option>Follow Up</option>
          </select>

          <select 
            value={invoiceSentFilter}
            onChange={(e) => setInvoiceSentFilter(e.target.value)}
            className="bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-500/20 w-32 shadow-sm"
          >
            <option value="All">Invoice Status</option>
            <option value="Sent">Sent</option>
            <option value="Not Sent">Not Sent</option>
          </select>

          <select 
            value={profitFilter}
            onChange={(e) => setProfitFilter(e.target.value)}
            className="bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-500/20 w-32 shadow-sm"
          >
            <option value="All">All Profit</option>
            <option value="High Profit">High Profit</option>
            <option value="Low Profit">Low Profit</option>
            <option value="Unprofitable">Unprofitable</option>
          </select>
        </div>
      </div>

      {/* Bulk Action Bar */}
      {(isSelectMode || selectedIds.length > 0) && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-indigo-900 text-white p-4 rounded-xl shadow-lg flex flex-col md:flex-row items-center justify-between gap-4"
        >
          <div className="flex items-center gap-4">
            <span className="text-sm font-bold bg-indigo-800 px-3 py-1 rounded-full border border-indigo-700">
              {selectedIds.length} entries selected
            </span>
            <div className="flex items-center gap-2">
              <button 
                onClick={toggleSelectAll}
                className="text-xs font-bold hover:text-indigo-200 transition-colors"
              >
                Select All
              </button>
              <span className="text-indigo-700">|</span>
              <button 
                onClick={() => setSelectedIds([])}
                className="text-xs font-bold hover:text-indigo-200 transition-colors"
              >
                Deselect All
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button 
              onClick={() => handleBatchInvoiceStatus(true)}
              className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition-all shadow-sm"
            >
              <Printer className="w-3.5 h-3.5" /> Mark Invoice Sent
            </button>
            <button 
              onClick={() => handleBatchInvoiceStatus(false)}
              className="bg-indigo-800 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition-all border border-indigo-700"
            >
              <X className="w-3.5 h-3.5" /> Mark Not Sent
            </button>
            <div className="w-px h-6 bg-indigo-800 mx-2 hidden md:block"></div>
            <div className="relative">
              <button 
                onClick={() => setIsBulkDocsDropdownOpen(!isBulkDocsDropdownOpen)}
                className="bg-indigo-800 border border-indigo-700 rounded-lg px-4 py-2 text-xs font-bold flex items-center gap-2 hover:bg-indigo-700 transition-all"
              >
                <FileText className="w-3.5 h-3.5" />
                {selectedDocsForBulk.length === 0 
                  ? "Add Documents" 
                  : `${selectedDocsForBulk.length} docs`}
                <ChevronDown className={cn("w-3.5 h-3.5 transition-transform", isBulkDocsDropdownOpen && "rotate-180")} />
              </button>

              {isBulkDocsDropdownOpen && (
                <>
                  <div className="fixed inset-0 z-[60]" onClick={() => setIsBulkDocsDropdownOpen(false)} />
                  <div className="absolute bottom-full md:bottom-auto md:top-full right-0 mt-2 w-64 bg-white text-slate-800 rounded-xl shadow-2xl z-[70] py-2 border border-slate-200 max-h-96 overflow-y-auto custom-scrollbar">
                    <div className="px-4 py-2 bg-indigo-50 border-b border-indigo-100 flex flex-col gap-2 mb-1">
                      <button 
                        onClick={() => {
                          const allHybrid = HYBRID_LOAN_PACKAGE.canonicalDocs;
                          const current = new Set(selectedDocsForBulk);
                          allHybrid.forEach(d => current.add(d));
                          setSelectedDocsForBulk(Array.from(current));
                        }}
                        className="w-full bg-indigo-600 text-white rounded py-1.5 text-[10px] font-bold hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2"
                      >
                        <PlusCircle className="w-3 h-3" /> Select Hybrid Loan Package
                      </button>
                      <button 
                        onClick={() => {
                          const allRefi = REFINANCE_PACKAGE.canonicalDocs;
                          const current = new Set(selectedDocsForBulk);
                          allRefi.forEach(d => current.add(d));
                          setSelectedDocsForBulk(Array.from(current));
                        }}
                        className="w-full bg-slate-800 text-white rounded py-1.5 text-[10px] font-bold hover:bg-slate-700 transition-colors flex items-center justify-center gap-2"
                      >
                        <PlusCircle className="w-3 h-3" /> Select Refinance Package
                      </button>
                    </div>
                    <div className="px-4 py-2 text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-50 border-b border-slate-100 mb-1">
                      Loan Signing Documents
                    </div>
                    {loanSigningDocs.map(doc => (
                      <label key={doc} className="flex items-center gap-3 px-4 py-2 hover:bg-slate-50 cursor-pointer transition-colors">
                        <input 
                          type="checkbox" 
                          checked={selectedDocsForBulk.includes(doc)}
                          onChange={(e) => {
                            if (e.target.checked) setSelectedDocsForBulk([...selectedDocsForBulk, doc]);
                            else setSelectedDocsForBulk(selectedDocsForBulk.filter(d => d !== doc));
                          }}
                          className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                        />
                        <span className="text-[11px] font-medium">{doc}</span>
                      </label>
                    ))}
                    <div className="px-4 py-2 text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-50 border-b border-slate-100 my-1">
                      Notarial Acts
                    </div>
                    {notarialActs.map(doc => (
                      <label key={doc} className="flex items-center gap-3 px-4 py-2 hover:bg-slate-50 cursor-pointer transition-colors">
                        <input 
                          type="checkbox" 
                          checked={selectedDocsForBulk.includes(doc)}
                          onChange={(e) => {
                            if (e.target.checked) setSelectedDocsForBulk([...selectedDocsForBulk, doc]);
                            else setSelectedDocsForBulk(selectedDocsForBulk.filter(d => d !== doc));
                          }}
                          className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                        />
                        <span className="text-[11px] font-medium">{doc}</span>
                      </label>
                    ))}
                  </div>
                </>
              )}
            </div>

            <div className="relative">
              <button 
                onClick={() => setIsBulkTypeDropdownOpen(!isBulkTypeDropdownOpen)}
                className="bg-indigo-800 border border-indigo-700 rounded-lg px-4 py-2 text-xs font-bold flex items-center gap-2 hover:bg-indigo-700 transition-all"
              >
                <Tag className="w-3.5 h-3.5" />
                Change Type
                <ChevronDown className={cn("w-3.5 h-3.5 transition-transform", isBulkTypeDropdownOpen && "rotate-180")} />
              </button>

              {isBulkTypeDropdownOpen && (
                <>
                  <div className="fixed inset-0 z-[60]" onClick={() => setIsBulkTypeDropdownOpen(false)} />
                  <div className="absolute bottom-full md:bottom-auto md:top-full right-0 mt-2 w-64 bg-white text-slate-800 rounded-xl shadow-2xl z-[70] py-2 border border-slate-200 max-h-96 overflow-y-auto custom-scrollbar">
                    <div className="px-4 py-2 text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-50 border-b border-slate-100 mb-1">
                      Standard Types
                    </div>
                    {defaultSigningTypes.map(type => (
                      <button
                        key={type}
                        onClick={async () => {
                          await onBulkUpdateSigningType(selectedIds, type);
                          setBulkSuccessMessage(`${selectedIds.length} signings updated to ${type}`);
                          setTimeout(() => setBulkSuccessMessage(null), 3000);
                          setSelectedIds([]);
                          setIsBulkTypeDropdownOpen(false);
                        }}
                        className="w-full text-left px-4 py-2 hover:bg-slate-50 text-[11px] font-medium transition-colors"
                      >
                        {type}
                      </button>
                    ))}
                    
                    <div className="px-4 py-2 text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-50 border-b border-slate-100 my-1">
                      Custom Type
                    </div>
                    <div className="px-4 py-2">
                      <div className="flex flex-col gap-2">
                        <input 
                          type="text"
                          value={customBulkType}
                          onChange={(e) => setCustomBulkType(e.target.value)}
                          placeholder="Enter custom type..."
                          className="w-full border border-slate-200 rounded px-2 py-1.5 text-[11px] outline-none focus:ring-1 focus:ring-indigo-500"
                          onClick={(e) => e.stopPropagation()}
                        />
                        <button
                          disabled={!customBulkType.trim()}
                          onClick={async () => {
                            await onBulkUpdateSigningType(selectedIds, customBulkType.trim());
                            setBulkSuccessMessage(`${selectedIds.length} signings updated to ${customBulkType.trim()}`);
                            setTimeout(() => setBulkSuccessMessage(null), 3000);
                            setSelectedIds([]);
                            setIsBulkTypeDropdownOpen(false);
                            setCustomBulkType('');
                          }}
                          className="w-full bg-indigo-600 text-white rounded py-1.5 text-[10px] font-bold hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                        >
                          Apply Custom Type
                        </button>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>

            {selectedDocsForBulk.length > 0 && (
              <button 
                onClick={async () => {
                  if (selectedIds.length > 0 && selectedDocsForBulk.length > 0) {
                    await onBulkUpdateDocs(selectedIds, selectedDocsForBulk);
                    const isHybrid = selectedDocsForBulk.length === HYBRID_LOAN_PACKAGE.canonicalDocs.length && 
                      selectedDocsForBulk.every(d => HYBRID_LOAN_PACKAGE.canonicalDocs.includes(d));
                    const isRefi = selectedDocsForBulk.length === REFINANCE_PACKAGE.canonicalDocs.length && 
                      selectedDocsForBulk.every(d => REFINANCE_PACKAGE.canonicalDocs.includes(d));
                    
                    setBulkSuccessMessage(isHybrid 
                      ? `Hybrid Loan Package applied to ${selectedIds.length} selected entries` 
                      : isRefi 
                        ? `Refinance Package applied to ${selectedIds.length} selected entries`
                        : `Documents added to ${selectedIds.length} entries`
                    );
                    setTimeout(() => setBulkSuccessMessage(null), 3000);
                    setIsSelectMode(false);
                    setSelectedIds([]);
                    setSelectedDocsForBulk([]);
                  }
                }}
                className="bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-lg text-xs font-bold transition-all shadow-sm"
              >
                Apply Docs
              </button>
            )}
            <button 
              onClick={() => {
                setIsSelectMode(false);
                setSelectedIds([]);
                setSelectedDocsForBulk([]);
              }}
              className="text-indigo-300 hover:text-white px-2 py-2 text-xs font-bold transition-all"
            >
              Cancel
            </button>
          </div>
        </motion.div>
      )}

      {bulkSuccessMessage && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-emerald-600 text-white px-6 py-3 rounded-full shadow-2xl z-[100] flex items-center gap-3 font-bold"
        >
          <CheckCircle2 className="w-5 h-5" />
          {bulkSuccessMessage}
        </motion.div>
      )}

      {/* Table Section */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                <th className="px-4 py-3 w-10">
                  <input 
                    type="checkbox" 
                    checked={selectedIds.length === paginatedAppointments.length && paginatedAppointments.length > 0}
                    onChange={toggleSelectAll}
                    className="rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                  />
                </th>
                <th className="px-3 py-3 cursor-pointer hover:bg-slate-100" onClick={() => handleSort('date')}>
                  Date & Time {sortField === 'date' && (sortOrder === 'asc' ? <ChevronUp className="inline w-3 h-3" /> : <ChevronDown className="inline w-3 h-3" />)}
                </th>
                <th className="px-3 py-3">Last Name <ChevronDown className="inline w-3 h-3" /></th>
                <th className="px-3 py-3">{viewMode === 'journal' ? 'Documents Signed' : 'Type'} <ChevronDown className="inline w-3 h-3" /></th>
                {viewMode === 'journal' && <th className="px-3 py-3">ID Type <ChevronDown className="inline w-3 h-3" /></th>}
                <th className="px-3 py-3">City <ChevronDown className="inline w-3 h-3" /></th>
                <th className="px-3 py-3 cursor-pointer hover:bg-slate-100" onClick={() => handleSort('agreedFee')}>
                  Agreed {sortField === 'agreedFee' && (sortOrder === 'asc' ? <ChevronUp className="inline w-3 h-3" /> : <ChevronDown className="inline w-3 h-3" />)}
                </th>
                <th className="px-3 py-3 cursor-pointer hover:bg-slate-100" onClick={() => handleSort('amountCollected')}>
                  Collected {sortField === 'amountCollected' && (sortOrder === 'asc' ? <ChevronUp className="inline w-3 h-3" /> : <ChevronDown className="inline w-3 h-3" />)}
                </th>
                <th className="px-3 py-3 cursor-pointer hover:bg-slate-100" onClick={() => handleSort('amountOutstanding')}>
                  Owed {sortField === 'amountOutstanding' && (sortOrder === 'asc' ? <ChevronUp className="inline w-3 h-3" /> : <ChevronDown className="inline w-3 h-3" />)}
                </th>
                <th className="px-3 py-3 cursor-pointer hover:bg-slate-100" onClick={() => handleSort('estimatedProfit')}>
                  Profit {sortField === 'estimatedProfit' && (sortOrder === 'asc' ? <ChevronUp className="inline w-3 h-3" /> : <ChevronDown className="inline w-3 h-3" />)}
                </th>
                <th className="px-3 py-3">Margin {sortField === 'profitMarginPercent' && (sortOrder === 'asc' ? <ChevronUp className="inline w-3 h-3" /> : <ChevronDown className="inline w-3 h-3" />)}</th>
                <th className="px-3 py-3">Status</th>
                <th className="px-3 py-3 cursor-pointer hover:bg-slate-100" onClick={() => handleSort('company')}>
                  Company {sortField === 'company' && (sortOrder === 'asc' ? <ChevronUp className="inline w-3 h-3" /> : <ChevronDown className="inline w-3 h-3" />)}
                </th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginatedAppointments.length > 0 ? (
                paginatedAppointments.map((app) => (
                  <tr 
                    key={app.id} 
                    onClick={(e) => {
                      if ((e.target as HTMLElement).closest('button') || (e.target as HTMLElement).closest('input[type="checkbox"]')) return;
                      toggleSelect(app.id);
                    }}
                    className={cn(
                      "transition-colors group cursor-pointer",
                      selectedIds.includes(app.id) ? "bg-amber-50" : "hover:bg-slate-50/50"
                    )}
                  >
                    <td className="px-4 py-3">
                      <input 
                        type="checkbox" 
                        checked={selectedIds.includes(app.id)}
                        onChange={() => toggleSelect(app.id)}
                        className="rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                      />
                    </td>
                    <td className="px-3 py-3">
                      <div className="text-sm font-bold text-slate-900">{format(parseSafeDateTime(app.date), 'MM/dd/yyyy')}</div>
                      <div className="text-[10px] font-medium text-slate-500">{app.time}</div>
                    </td>
                    <td className="px-3 py-3">
                      <button 
                        onClick={() => onViewSigning(app)}
                        className="text-sm font-bold text-sky-600 hover:text-sky-700 hover:underline text-left"
                      >
                        {formatDisplayName((app.lastName || app.clientName || '').split(' ').filter(p => !p.endsWith('.')).pop() || (app.lastName || app.clientName || '').split(' ').pop() || '')}
                      </button>
                    </td>
                    <td className="px-3 py-3">
                      {viewMode === 'journal' ? (
                        <div className="flex flex-wrap gap-1 max-w-[200px]">
                          {(app.docs || []).slice(0, 3).map(doc => (
                            <span key={doc} className="px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded text-[9px] font-bold border border-slate-200 truncate max-w-[80px]">
                              {doc}
                            </span>
                          ))}
                          {(app.docs || []).length > 3 && (
                            <span className="px-1.5 py-0.5 bg-sky-50 text-sky-600 rounded text-[9px] font-bold border border-sky-100">
                              +{(app.docs || []).length - 3} more
                            </span>
                          )}
                          {(app.docs || []).length === 0 && (
                            <div className="text-xs font-medium text-slate-400 italic">No docs</div>
                          )}
                        </div>
                      ) : (
                        <div className="text-xs font-medium text-slate-600">{app.signingType}</div>
                      )}
                    </td>
                    {viewMode === 'journal' && (
                      <td className="px-3 py-3">
                        <div className="text-xs font-bold text-slate-900">{app.idType || 'Not Logged'}</div>
                        {app.idNumber && <div className="text-[10px] text-slate-500">#{app.idNumber}</div>}
                        <div className="text-[9px] text-slate-400 mt-0.5">
                          {app.dob && <span>DOB: {app.dob} </span>}
                          {app.idIssueDate && <span>ISS: {app.idIssueDate}</span>}
                        </div>
                        {app.idExpiration && <div className="text-[9px] text-slate-400">EXP: {app.idExpiration}</div>}
                      </td>
                    )}
                    <td className="px-3 py-3">
                      <div className="text-xs font-medium text-slate-600">{app.city || app.location?.split(',')[1]?.trim() || 'TBD'}</div>
                    </td>
                    <td className="px-3 py-3">
                      <div className="text-sm font-bold text-[#111827]">${(Number(app.agreedFee) || Number(app.fee) || 0).toFixed(2)}</div>
                    </td>
                    <td className="px-3 py-3">
                      <div className="text-sm font-bold text-emerald-600">${(Number(app.amountCollected) || (app.status === 'Paid' ? Number(app.fee) : 0) || 0).toFixed(2)}</div>
                    </td>
                    <td className="px-3 py-3">
                      <div className="text-sm font-bold text-rose-600">${(Number(app.amountOutstanding) || ((app.status !== 'Paid' && !app.invoicePaidDate) ? Number(app.fee) : 0) || 0).toFixed(2)}</div>
                    </td>
                    <td className="px-3 py-3">
                      <div className="text-sm font-bold text-indigo-600">${(Number(app.estimatedProfit) || 0).toFixed(2)}</div>
                    </td>
                    <td className="px-3 py-3">
                      <div className={cn(
                        "text-[10px] font-black px-2 py-0.5 rounded-full border inline-block",
                        (app.profitMarginPercent || 0) >= 70 ? "bg-emerald-50 border-emerald-200 text-emerald-700" :
                        (app.profitMarginPercent || 0) >= 40 ? "bg-amber-50 border-amber-200 text-amber-700" :
                        "bg-rose-50 border-rose-200 text-rose-700"
                      )}>
                        {Math.round(app.profitMarginPercent || 0)}%
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      {getStatusBadge(app.status, app)}
                    </td>
                    <td className="px-3 py-3">
                      {app.signingCompany && <div className="text-xs font-bold text-sky-600 mb-1">{app.signingCompany}</div>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={() => onViewSigning(app, 'Invoice')}
                          className="p-1.5 text-slate-400 hover:text-sky-600 hover:bg-sky-50 rounded transition-all"
                          title="Print Invoice"
                        >
                          <Printer className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => onDelete([app.id])}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-all"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={10} className="px-4 py-12 text-center">
                    <div className="flex flex-col items-center gap-2 text-slate-400">
                      <Calendar className="w-8 h-8 opacity-20" />
                      <p className="text-sm font-medium">No signings found for this period</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Section */}
        {totalPages > 1 && (
          <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
            <p className="text-xs font-medium text-slate-500">
              Showing <span className="text-slate-900">{(currentPage - 1) * itemsPerPage + 1}</span> to <span className="text-slate-900">{Math.min(currentPage * itemsPerPage, filteredAppointments.length)}</span> of <span className="text-slate-900">{filteredAppointments.length}</span> signings
            </p>
            <div className="flex items-center gap-2">
              <button 
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="p-1.5 rounded border border-slate-300 bg-white text-slate-600 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50 transition-colors"
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
                        "w-8 h-8 rounded text-xs font-bold transition-all",
                        currentPage === pageNum 
                          ? "bg-sky-600 text-white shadow-sm" 
                          : "bg-white border border-slate-300 text-slate-600 hover:bg-slate-50"
                      )}
                    >
                      {pageNum}
                    </button>
                  );
                })}
              </div>

              <button 
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
                className="p-1.5 rounded border border-slate-300 bg-white text-slate-600 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50 transition-colors"
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

const Customers = ({ customers, onNewCustomer, onEditCustomer, onDeleteCustomer }: { customers: Customer[]; onNewCustomer: () => void; onEditCustomer: (c: Customer) => void; onDeleteCustomer: (id: string) => void }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<CustomerType | 'All'>('All');

  const filteredCustomers = customers.filter(c => {
    const matchesSearch = c.fullName.toLowerCase().includes(searchQuery.toLowerCase()) || 
                         c.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         c.phone.includes(searchQuery);
    const matchesFilter = filterType === 'All' || c.customerType === filterType;
    return matchesSearch && matchesFilter;
  });

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Customers</h1>
          <p className="text-slate-500">Manage your individual clients and signers.</p>
        </div>
        <button 
          onClick={onNewCustomer}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-sm flex items-center justify-center gap-2"
        >
          <Plus className="w-4 h-4" /> New Customer
        </button>
      </div>

      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input 
            type="text" 
            placeholder="Search customers..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
          />
        </div>
        <select 
          value={filterType}
          onChange={(e) => setFilterType(e.target.value as any)}
          className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
        >
          <option value="All">All Types</option>
          <option value="Borrower">Borrower</option>
          <option value="Seller">Seller</option>
          <option value="Buyer">Buyer</option>
          <option value="Signer">Signer</option>
          <option value="General Client">General Client</option>
        </select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredCustomers.map((customer) => (
          <div key={customer.id} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all group relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1 h-full bg-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity"></div>
            <div className="flex items-start justify-between mb-4">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400 font-bold text-xl">
                {customer.firstName.charAt(0)}{customer.lastName.charAt(0)}
              </div>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => onEditCustomer(customer)}
                  className="p-2 hover:bg-slate-50 rounded-lg text-slate-400 hover:text-indigo-600 transition-colors"
                >
                  <PenLine className="w-4 h-4" />
                </button>
                <button 
                  onClick={() => onDeleteCustomer(customer.id)}
                  className="p-2 hover:bg-rose-50 rounded-lg text-slate-400 hover:text-rose-600 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
            <h3 className="font-bold text-lg text-slate-900 mb-1">{formatDisplayName(customer.fullName)}</h3>
            <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded-full">
              {customer.customerType || 'General'}
            </span>
            
            <div className="space-y-3 mt-4">
              <div className="flex items-center gap-3 text-sm text-slate-600">
                <Mail className="w-4 h-4 text-slate-400" />
                <span>{customer.email}</span>
              </div>
              <div className="flex items-center gap-3 text-sm text-slate-600">
                <Phone className="w-4 h-4 text-slate-400" />
                <span>{customer.phone}</span>
              </div>
              <div className="flex items-center gap-3 text-sm text-slate-600">
                <MapPin className="w-4 h-4 text-slate-400" />
                <span className="truncate">{customer.address}, {customer.city}</span>
              </div>
            </div>

            <div className="mt-6 pt-6 border-t border-slate-100 flex items-center justify-between">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Added {format(new Date(customer.createdAt), 'MMM d, yyyy')}</span>
              <button className="text-xs font-bold text-indigo-600 hover:underline">View History</button>
            </div>
          </div>
        ))}
      </div>

      {filteredCustomers.length === 0 && (
        <div className="text-center py-12 bg-white rounded-2xl border border-dashed border-slate-300">
          <Users className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-lg font-bold text-slate-900">No customers found</h3>
          <p className="text-sm text-slate-500">Try adjusting your search or add a new customer.</p>
        </div>
      )}
    </div>
  );
};

const Accounting = ({ appointments, expenses, onNewExpense, onDeleteExpense }: { appointments: Appointment[]; expenses: Expense[]; onNewExpense: () => void; onDeleteExpense: (id: string) => void }) => {
  const totalIncome = appointments
    .filter(a => a.status === 'Completed' || a.status === 'Paid')
    .reduce((sum, a) => sum + a.fee, 0);
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
  const [modalAutoScan, setModalAutoScan] = useState(false);
  const [isNewExpenseModalOpen, setIsNewExpenseModalOpen] = useState(false);
  const [isExpenseTypesModalOpen, setIsExpenseTypesModalOpen] = useState(false);
  const [isRecurringExpenseModalOpen, setIsRecurringExpenseModalOpen] = useState(false);
  const [isNewMileageModalOpen, setIsNewMileageModalOpen] = useState(false);
  const [isNewClientModalOpen, setIsNewClientModalOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [isNewCompanyModalOpen, setIsNewCompanyModalOpen] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState<SigningCompany | null>(null);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [isDemoUser, setIsDemoUser] = useState(demoStorage.isDemoMode());
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);

  const handleConnectGoogle = () => {
    if (!user) {
      alert("Please sign in first");
      return;
    }
    const width = 600;
    const height = 700;
    const left = window.screen.width / 2 - width / 2;
    const top = window.screen.height / 2 - height / 2;
    
    setIsConnecting(true);
    window.open(
      `/api/auth/google?uid=${user.uid}`,
      "GoogleCalendarAuth",
      `width=${width},height=${height},left=${left},top=${top}`
    );
  };

  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [companies, setCompanies] = useState<SigningCompany[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [mileage, setMileage] = useState<Mileage[]>([]);
  const [businessProfile, setBusinessProfile] = useState<BusinessProfile>(MOCK_PROFILE);

  // Auth listener
  useEffect(() => {
    if (IS_DEMO_VERSION) {
      setIsAuthReady(true);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, (user: FirebaseUser | null) => {
      console.log('Auth state changed:', user?.email);
      setUser(user);
      setIsAuthReady(true);
    });

    return () => unsubscribe();
  }, []);

  // Google Calendar OAuth Message Listener
  useEffect(() => {
    const handleMessage = async (event: MessageEvent) => {
      if (event.data?.type === 'GOOGLE_AUTH_SUCCESS') {
        console.log("Google Calendar authorization successful!");
        setIsConnecting(false);
        const tokens = event.data.tokens;
        if (tokens && user) {
           await updateDoc(doc(db, 'profiles', user.uid), {
              googleCalendarTokens: tokens,
              googleCalendarConnected: true,
              updatedAt: new Date().toISOString()
           }).catch(console.error);
        }
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [user]);

  // Firestore listeners
  useEffect(() => {
    if (!isAuthReady) return;

    if (isDemoUser || !user) {
      setAppointments(demoStorage.getAppointments());
      setCustomers(demoStorage.getCustomers());
      setExpenses(demoStorage.getExpenses());
      setMileage(demoStorage.getMileage());
      setCompanies(demoStorage.getCompanies());
      setBusinessProfile(demoStorage.getProfile());
      return;
    }

    console.log('Starting Firestore listeners for:', user.uid);
    const qAppointments = query(collection(db, 'appointments'), where('userId', '==', user.uid));
    const unsubAppointments = onSnapshot(qAppointments, (snapshot: any) => {
      setAppointments(snapshot.docs.map((doc: any) => ({ ...doc.data(), id: doc.id } as Appointment)));
    }, (error: any) => handleFirestoreError(error, OperationType.LIST, 'appointments'));

    const qCustomers = query(collection(db, 'customers'), where('userId', '==', user.uid));
    const unsubCustomers = onSnapshot(qCustomers, (snapshot: any) => {
      setCustomers(snapshot.docs.map((doc: any) => ({ ...doc.data(), id: doc.id } as Customer)));
    }, (error: any) => handleFirestoreError(error, OperationType.LIST, 'customers'));

    const qCompanies = query(collection(db, 'signingCompanies'), where('userId', '==', user.uid));
    const unsubCompanies = onSnapshot(qCompanies, (snapshot: any) => {
      setCompanies(snapshot.docs.map((doc: any) => ({ ...doc.data(), id: doc.id } as SigningCompany)));
    }, (error: any) => handleFirestoreError(error, OperationType.LIST, 'signingCompanies'));

    const qExpenses = query(collection(db, 'expenses'), where('userId', '==', user.uid));
    const unsubExpenses = onSnapshot(qExpenses, (snapshot: any) => {
      setExpenses(snapshot.docs.map((doc: any) => ({ ...doc.data(), id: doc.id } as Expense)));
    }, (error: any) => handleFirestoreError(error, OperationType.LIST, 'expenses'));

    const qMileage = query(collection(db, 'mileage'), where('userId', '==', user.uid));
    const unsubMileage = onSnapshot(qMileage, (snapshot: any) => {
      setMileage(snapshot.docs.map((doc: any) => ({ ...doc.data(), id: doc.id } as Mileage)));
    }, (error: any) => handleFirestoreError(error, OperationType.LIST, 'mileage'));

    const unsubProfile = onSnapshot(doc(db, 'profiles', user.uid), (doc: any) => {
      if (doc.exists()) {
        setBusinessProfile(doc.data() as BusinessProfile);
      }
    }, (error: any) => handleFirestoreError(error, OperationType.GET, `profiles/${user.uid}`));

    return () => {
      unsubAppointments();
      unsubCustomers();
      unsubCompanies();
      unsubExpenses();
      unsubMileage();
      unsubProfile();
    };
  }, [isAuthReady, user, isDemoUser]);

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
      if (isDemoUser) {
        setIsDemoUser(false);
        demoStorage.setDemoMode(false);
      } else {
        await signOut(auth);
      }
    } catch (error) {
      console.error('Sign out error:', error);
    }
  }, [isDemoUser]);

  const handleDemoSignIn = useCallback(() => {
    setIsDemoUser(true);
    demoStorage.setDemoMode(true);
  }, []);

  const handleResetDemo = useCallback(() => {
    if (window.confirm('Are you sure you want to reset all demo data? This will restore sample data and clear your changes.')) {
      demoStorage.resetAll();
      setAppointments(demoStorage.getAppointments());
      setCustomers(demoStorage.getCustomers());
      setExpenses(demoStorage.getExpenses());
      setMileage(demoStorage.getMileage());
      setCompanies(demoStorage.getCompanies());
      setBusinessProfile(demoStorage.getProfile());
    }
  }, []);

  const handleBulkUpdateDocs = async (ids: string[], docsToAdd: string[]) => {
    if (ids.length === 0 || docsToAdd.length === 0) return;
    
    // In a real app, we might need to know the package type for each appointment
    // For now, we'll assume the current operation context or use generic normalization
    
    if (isDemoUser || !user) {
      // In demo mode, we'll just merge them
      const apps = appointments.filter(a => ids.includes(a.id));
      const updated = appointments.map(a => {
        if (ids.includes(a.id)) {
          return {
            ...a,
            docs: mergeUniqueDocuments(a.docs || [], docsToAdd, a.signingType)
          };
        }
        return a;
      });
      setAppointments(updated);
      return;
    }

    try {
      const promises = ids.map(async (id) => {
        const appointment = appointments.find(a => a.id === id);
        if (!appointment) return;

        const newDocs = mergeUniqueDocuments(appointment.docs || [], docsToAdd, appointment.signingType);
        
        return updateDoc(doc(db, 'appointments', id), {
          docs: validateDocuments(newDocs)
        });
      });
      await Promise.all(promises);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `appointments/bulk-docs`);
    }
  };

  const handleBulkUpdateInvoiceStatus = async (ids: string[], sent: boolean) => {
    if (isDemoUser || !user) {
      const updated = demoStorage.bulkUpdateInvoiceStatus(ids, sent) as Appointment[];
      setAppointments(updated);
      return;
    }
    if (ids.length === 0) return;
    
    const today = new Date().toISOString().split('T')[0];
    
    try {
      const promises = ids.map(id => {
        const app = appointments.find(a => a.id === id);
        const updates: any = { 
          invoiceSent: sent,
          paymentStatus: (sent ? 'Sent' : (app?.paymentStatus === 'Sent' ? 'Not Sent' : app?.paymentStatus)) as PaymentStatus
        };
        if (sent && app && !app.invoiceSentDate) {
          updates.invoiceSentDate = today;
        }
        return updateDoc(doc(db, 'appointments', id), sanitizeData(updates));
      });
      await Promise.all(promises);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `appointments/bulk-invoice`);
    }
  };

  const handleBulkUpdateSigningType = async (ids: string[], type: string) => {
    if (isDemoUser || !user) {
      const updated = appointments.map(app => {
        if (ids.includes(app.id)) {
          return { ...app, signingType: type };
        }
        return app;
      });
      setAppointments(updated);
      return;
    }
    if (ids.length === 0) return;
    try {
      const promises = ids.map(id => 
        updateDoc(doc(db, 'appointments', id), sanitizeData({
          signingType: type
        }))
      );
      await Promise.all(promises);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `appointments/bulk-type`);
    }
  };

  const syncToGoogleCalendar = async (appointmentId: string, action: 'create' | 'update' | 'delete', eventId?: string, appData?: any) => {
    if (!user || isDemoUser) return;
    
    console.log(`[Calendar Sync] Requesting ${action} for ID: ${appointmentId}`);
    try {
      const response = await fetch('/api/calendar/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          appointmentId,
          uid: user.uid,
          action,
          eventId,
          appointmentData: appData,
          googleCalendarId: businessProfile.googleCalendarId,
          googleCalendarTokens: businessProfile.googleCalendarTokens
        })
      });
      
      const result = await response.json();
      if (!response.ok) {
        console.error('[Calendar Sync] Failed:', result.details || result.error || 'Unknown error');
        if (result.code === 403 || result.code === 404) {
          console.warn('[Calendar Sync] Hint: Check if the calendar is shared with the Service Account email and if the Calendar ID is correct.');
        }
      } else {
        console.log('[Calendar Sync] Success:', result.status);
        if (result.newTokensData) {
            updateDoc(doc(db, 'profiles', user.uid), {
              googleCalendarTokens: result.newTokensData,
              updatedAt: new Date().toISOString()
            }).catch(console.error);
        }
        if (result.eventId && action !== 'delete') {
            updateDoc(doc(db, 'appointments', appointmentId), {
              googleCalendarEventId: result.eventId
            }).catch(console.error);
        }
      }
    } catch (error) {
      console.error('[Calendar Sync] Network Error:', error);
    }
  };

  const handleSaveAppointment = async (app: Appointment) => {
    if (isDemoUser || !user) {
      demoStorage.saveAppointment(app);
      setAppointments(demoStorage.getAppointments());
      return;
    }

    try {
      console.log('Attempting to save appointment to Firestore:', { id: app.id, path: `appointments/${app.id}` });
      const isNew = !appointments.some(a => a.id === app.id);
      const appData = sanitizeData({ 
        ...app, 
        userId: user.uid,
        sortableDateTime: app.sortableDateTime || parseSafeDateTime(app.date, app.time).toISOString()
      });
      
      console.log('Sanitized Appointment Data Payload:', JSON.stringify(appData, null, 2));
      
      const docRef = doc(db, 'appointments', app.id);
      await setDoc(docRef, appData);
      console.log('Successfully saved appointment to Firestore. Response: OK');

      // Attempt sync - standard OAuth or Service Account
      // We call it even if not explicitly enabled in profile, as the backend will check
      // for Service Account fallback automatically.
      syncToGoogleCalendar(app.id, isNew ? 'create' : 'update', appData.googleCalendarEventId, appData);
    } catch (error) {
      console.error('Failed to save appointment:', error);
      handleFirestoreError(error, OperationType.WRITE, `appointments/${app.id}`);
    }
  };

  const handleSaveExpense = async (expense: Expense) => {
    if (isDemoUser || !user) {
      demoStorage.saveExpense(expense);
      setExpenses(demoStorage.getExpenses());
      return;
    }

    try {
      console.log('Attempting to save expense to Firestore:', { id: expense.id, path: `expenses/${expense.id}` });
      const expenseData = sanitizeData({ ...expense, userId: user.uid });
      console.log('Sanitized Expense Data Payload:', JSON.stringify(expenseData, null, 2));
      
      const docRef = doc(db, 'expenses', expense.id);
      await setDoc(docRef, expenseData);
      console.log('Successfully saved expense. Response: OK');
    } catch (error) {
      console.error('Failed to save expense:', error);
      handleFirestoreError(error, OperationType.WRITE, `expenses/${expense.id}`);
    }
  };

  const handleSaveMileage = async (m: Mileage) => {
    if (isDemoUser || !user) {
      demoStorage.saveMileage(m);
      setMileage(demoStorage.getMileage());
      return;
    }

    try {
      const mileageData = sanitizeData({ ...m, userId: user.uid });
      await setDoc(doc(db, 'mileage', m.id), mileageData);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `mileage/${m.id}`);
    }
  };

  const handleSaveProfile = async (profile: BusinessProfile) => {
    if (isDemoUser || !user) {
      demoStorage.saveProfile(profile);
      setBusinessProfile(demoStorage.getProfile());
      return;
    }

    try {
      const profileData = sanitizeData({ ...profile, userId: user.uid });
      await setDoc(doc(db, 'profiles', user.uid), profileData);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `profiles/${user.uid}`);
    }
  };

  const handleDeleteExpense = async (id: string) => {
    if (isDemoUser || !user) {
      demoStorage.deleteExpense(id);
      setExpenses(demoStorage.getExpenses());
      return;
    }

    try {
      await deleteDoc(doc(db, 'expenses', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `expenses/${id}`);
    }
  };

  const handleDeleteMileage = async (id: string) => {
    if (isDemoUser || !user) {
      demoStorage.deleteMileage(id);
      setMileage(demoStorage.getMileage());
      return;
    }

    try {
      await deleteDoc(doc(db, 'mileage', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `mileage/${id}`);
    }
  };

  const handleSaveCustomer = async (customer: Customer) => {
    if (isDemoUser || !user) {
      demoStorage.saveCustomer(customer);
      setCustomers(demoStorage.getCustomers());
      return;
    }

    try {
      const customerData = sanitizeData({ ...customer, userId: user.uid });
      await setDoc(doc(db, 'customers', customer.id), customerData);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `customers/${customer.id}`);
    }
  };

  const handleDeleteCustomer = async (id: string) => {
    if (isDemoUser || !user) {
      demoStorage.deleteCustomer(id);
      setCustomers(demoStorage.getCustomers());
      return;
    }

    try {
      await deleteDoc(doc(db, 'customers', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `customers/${id}`);
    }
  };

  const handleSaveCompany = async (company: SigningCompany) => {
    if (isDemoUser || !user) {
      demoStorage.saveCompany(company);
      setCompanies(demoStorage.getCompanies());
      return;
    }

    try {
      const companyData = sanitizeData({ ...company, userId: user.uid });
      await setDoc(doc(db, 'signingCompanies', company.id), companyData);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `signingCompanies/${company.id}`);
    }
  };

  const handleDeleteCompany = async (id: string) => {
    if (isDemoUser || !user) {
      demoStorage.deleteCompany(id);
      setCompanies(demoStorage.getCompanies());
      return;
    }

    try {
      await deleteDoc(doc(db, 'signingCompanies', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `signingCompanies/${id}`);
    }
  };

  const handleDeleteAppointments = async (ids: string[]) => {
    if (isDemoUser || !user) {
      demoStorage.deleteAppointments(ids);
      setAppointments(demoStorage.getAppointments());
      return;
    }

    try {
      const batch = writeBatch(db);
      for (const id of ids) {
        const app = appointments.find(a => a.id === id);
        if (app?.googleCalendarEventId) {
          syncToGoogleCalendar(id, 'delete', app.googleCalendarEventId, app);
        }
        batch.delete(doc(db, 'appointments', id));
      }
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'appointments');
    }
  };

  const handleImport = async (newApps: Appointment[]) => {
    if (isDemoUser || !user) {
      const current = demoStorage.getAppointments();
      const updated = [...current, ...newApps];
      demoStorage.saveAppointments(updated);
      setAppointments(updated);
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

  const isAuthenticated = IS_DEMO_VERSION ? isDemoUser : (!!user || isDemoUser);

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

  const mainAppLayout = (
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
          onSignOut={handleSignOut}
          user={user}
          isDemoMode={isDemoUser}
          onResetDemo={handleResetDemo}
        />
        
        <main className="flex-1 p-4 lg:p-8 max-w-7xl mx-auto w-full">
          <Routes>
            <Route path="/" element={
              <Dashboard 
                appointments={appointments} 
                expenses={expenses} 
                companies={companies}
                onNewSigning={() => {
                  setSelectedAppointment(null);
                  setIsNewSigningModalOpen(true);
                }}
                onViewSigning={(app, tab = 'Signer(s)') => {
                  setSelectedAppointment(app);
                  setModalInitialTab(tab);
                  setIsNewSigningModalOpen(true);
                }}
              />
            } />
            <Route 
              path="/appointments" 
              element={
                <Appointments 
                  appointments={appointments} 
                  customers={customers}
                  companies={companies}
                  viewMode="signings"
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
                  onBulkUpdateDocs={handleBulkUpdateDocs}
                  onBulkUpdateInvoiceStatus={handleBulkUpdateInvoiceStatus}
                  onBulkUpdateSigningType={handleBulkUpdateSigningType}
                  userId={user?.uid || 'mock-user'}
                />
              } 
            />
            <Route 
              path="/journal" 
              element={
                <Appointments 
                  appointments={appointments} 
                  customers={customers}
                  companies={companies}
                  viewMode="journal"
                  onNewSigning={() => {
                    setSelectedAppointment(null);
                    setModalAutoScan(false);
                    setIsNewSigningModalOpen(true);
                  }} 
                  onNewSigningWithScan={() => {
                    setSelectedAppointment(null);
                    setModalAutoScan(true);
                    setIsNewSigningModalOpen(true);
                  }}
                  onViewSigning={(app, tab = 'Signer(s)') => {
                    setSelectedAppointment(app);
                    setModalInitialTab(tab);
                    setModalAutoScan(false);
                    setIsNewSigningModalOpen(true);
                  }}
                  onDelete={handleDeleteAppointments}
                  onImport={handleImport}
                  onUpdate={handleSaveAppointment}
                  onBulkUpdateDocs={handleBulkUpdateDocs}
                  onBulkUpdateInvoiceStatus={handleBulkUpdateInvoiceStatus}
                  onBulkUpdateSigningType={handleBulkUpdateSigningType}
                  userId={user?.uid || 'mock-user'}
                />
              } 
            />
            <Route path="/calendar" element={
              <CalendarView 
                appointments={appointments} 
                onViewSigning={(app) => {
                  setSelectedAppointment(app);
                  setIsNewSigningModalOpen(true);
                }} 
                isGoogleConnected={businessProfile?.googleCalendarConnected}
                isConnecting={isConnecting}
                onConnectGoogle={handleConnectGoogle}
              />
            } />
            <Route 
              path="/customers" 
              element={
                <Customers 
                  customers={customers} 
                  onNewCustomer={() => {
                    setSelectedCustomer(null);
                    setIsNewClientModalOpen(true);
                  }}
                  onEditCustomer={(c) => {
                    setSelectedCustomer(c);
                    setIsNewClientModalOpen(true);
                  }}
                  onDeleteCustomer={handleDeleteCustomer}
                />
              } 
            />
            <Route 
              path="/companies" 
              element={
                <SigningCompaniesPage 
                  companies={companies} 
                  appointments={appointments}
                  onSave={handleSaveCompany}
                  onDelete={handleDeleteCompany}
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
            <Route path="/reports/*" element={
              <Reports 
                appointments={appointments} 
                expenses={expenses} 
                mileage={mileage}
                businessProfile={businessProfile}
              />
            } />
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
            <Route path="/tools" element={<ToolsView userId={user?.uid || 'mock-user'} userState={businessProfile?.state} />} />
            <Route path="/fee-calculator" element={<FeeCalculator />} />
            <Route path="/laws-lookup" element={<LawsLookup userId={user?.uid || 'mock-user'} userState={businessProfile?.state} />} />
            <Route path="/settings" element={
              <SettingsView 
                onEditProfile={() => setIsProfileModalOpen(true)} 
                user={user} 
                onSignIn={handleSignIn} 
                onImport={handleImport} 
                userId={user?.uid || 'mock-user'} 
                isDemoMode={isDemoUser}
                onResetDemo={handleResetDemo}
                businessProfile={businessProfile}
              />
            } />
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
              setModalAutoScan(false);
            }} 
            appointment={selectedAppointment}
            initialTab={modalInitialTab}
            autoScan={modalAutoScan}
            onSave={async (app) => {
              try {
                await handleSaveAppointment(app);
                setIsNewSigningModalOpen(false);
                setSelectedAppointment(null);
                setModalInitialTab('Signer(s)');
              } catch (error) {
                console.error('Caught error in NewSigningModal onSave:', error);
                // The error is re-thrown by handleSaveAppointment -> handleFirestoreError
                // We re-throw it so the modal can catch it internally if we change the Prop type
                throw error;
              }
            }}
            userId={user?.uid || 'mock-user'}
            customers={customers}
            appointments={appointments}
            companies={companies}
            onSaveCompany={handleSaveCompany}
          />
        )}

        {isNewExpenseModalOpen && (
          <NewExpenseModal 
            isOpen={isNewExpenseModalOpen} 
            onClose={() => setIsNewExpenseModalOpen(false)} 
            onSave={async (expense) => {
              try {
                await handleSaveExpense(expense);
                setIsNewExpenseModalOpen(false);
              } catch (error) {
                console.error('Caught error in NewExpenseModal onSave:', error);
                throw error;
              }
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
          <NewCustomerModal 
            isOpen={isNewClientModalOpen} 
            onClose={() => {
              setIsNewClientModalOpen(false);
              setSelectedCustomer(null);
            }} 
            customer={selectedCustomer}
            onSave={(c) => {
              handleSaveCustomer(c);
              setIsNewClientModalOpen(false);
              setSelectedCustomer(null);
            }}
            userId={user?.uid || 'mock-user'}
          />
        )}

        {isProfileModalOpen && (
          <BusinessProfileModal 
            isOpen={isProfileModalOpen} 
            onClose={() => setIsProfileModalOpen(false)} 
            profile={businessProfile}
            userId={user?.uid || 'mock-user'}
            onSave={(updatedProfile) => {
              handleSaveProfile(updatedProfile);
              setIsProfileModalOpen(false);
            }}
            onConnectGoogle={handleConnectGoogle}
            isConnecting={isConnecting}
          />
        )}
      </AnimatePresence>
    </div>
  );

  return (
    <Router>
      <Routes>
        <Route path="/features" element={<LandingPage />} />
        
        <Route path="/login" element={
          isAuthenticated ? (
            <Navigate to="/" replace />
          ) : (
            IS_DEMO_VERSION ? (
              <DemoLoginPage 
                onEnterDemo={handleDemoSignIn} 
                onResetDemo={() => {
                  if (window.confirm('Reset all demo data?')) {
                    demoStorage.resetAll();
                    window.location.reload();
                  }
                }} 
              />
            ) : (
              <LoginPage onSignIn={handleSignIn} onEnterDemo={handleDemoSignIn} />
            )
          )
        } />

        <Route path="/*" element={
          isAuthenticated ? mainAppLayout : <LandingPage />
        } />
      </Routes>
    </Router>
  );
}
