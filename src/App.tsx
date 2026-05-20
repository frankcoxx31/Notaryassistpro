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
  CalendarDays,
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
  Tag,
  Copy,
  Check
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
import { printInvoice } from './lib/invoiceUtils';

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
import NewJournalEntryModal from './components/NewJournalEntryModal';
import NewCustomerModal from './components/NewCustomerModal';
import SigningCompanyModal from './components/SigningCompanyModal';
import SigningCompaniesPage from './components/SigningCompaniesPage';
import { findExistingCustomer } from './services/customerService';
import Newsletter from './pages/Newsletter';
import EmailModal from './components/EmailModal';
import LawsLookup from './components/LawsLookup';
import MarketingView from './components/marketing/MarketingView';
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

// Top-level mode detection removed to use useSearchParams inside App component

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
    
    // Trim and normalize
    const dStr = dateStr.trim();
    const tStr = timeStr.trim();

    let year = 0, month = 0, day = 0;
    
    // Handle YYYY-MM-DD
    if (dStr.includes('-')) {
      const parts = dStr.split('-');
      if (parts.length === 3) {
        year = parseInt(parts[0], 10);
        month = parseInt(parts[1], 10) - 1;
        day = parseInt(parts[2], 10);
      }
    } 
    // Handle M/D/YYYY or MM/DD/YYYY
    else if (dStr.includes('/')) {
      const parts = dStr.split('/');
      if (parts.length === 3) {
        month = parseInt(parts[0], 10) - 1;
        day = parseInt(parts[1], 10);
        year = parseInt(parts[2], 10);
        if (year < 100) year += 2000;
      }
    }
    // Handle "April 6, 2026" or "April 06, 2026 1:30 PM"
    else {
      const dateMatch = dStr.match(/([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})/);
      if (dateMatch) {
        const monthNames = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
        month = monthNames.findIndex(m => dateMatch[1].toLowerCase().startsWith(m));
        day = parseInt(dateMatch[2], 10);
        year = parseInt(dateMatch[3], 10);
      } else {
        const d = new Date(dStr);
        if (!isNaN(d.getTime())) return d;
      }
    }

    let hours = 0, minutes = 0;
    if (tStr) {
      const timeMatch = tStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
      if (timeMatch) {
        hours = parseInt(timeMatch[1], 10);
        minutes = parseInt(timeMatch[2], 10);
        const ampm = timeMatch[3].toUpperCase();
        if (ampm === 'PM' && hours < 12) hours += 12;
        if (ampm === 'AM' && hours === 12) hours = 0;
      }
    } else {
      // Check if time is in dStr
      const timeMatch = dStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
      if (timeMatch) {
        hours = parseInt(timeMatch[1], 10);
        minutes = parseInt(timeMatch[2], 10);
        const ampm = timeMatch[3].toUpperCase();
        if (ampm === 'PM' && hours < 12) hours += 12;
        if (ampm === 'AM' && hours === 12) hours = 0;
      }
    }

    if (year === 0 || isNaN(year)) {
      const fallback = new Date(dateStr);
      return isNaN(fallback.getTime()) ? new Date() : fallback;
    }
    
    return new Date(year, month, day, hours, minutes);
  } catch (e) {
    console.error(`[Parse] Failed to parse date/time: "${dateStr}" / "${timeStr}":`, e);
    return new Date();
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
    if (value !== undefined && value !== null) {
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
        
        // Coerce types for Firestore safety
        const feeNum = typeof item.fee === 'string' 
          ? parseFloat(item.fee.replace(/[^0-9.]/g, '')) 
          : (typeof item.fee === 'number' ? item.fee : 0);
          
        const appointment: any = {
          ...item,
          id: Math.random().toString(36).substr(2, 9),
          userId: userId,
          date: item.date || format(now, 'yyyy-MM-dd'),
          time: item.time || '12:00 PM',
          signingType: item.signingType || 'Loan Signing',
          location: item.location || 'TBD',
          clientName: item.clientName || item.customerName || 'Unknown Client',
          status: item.status || 'Scheduled',
          fee: isNaN(feeNum) ? 0 : feeNum,
          agreedFee: isNaN(feeNum) ? 0 : feeNum,
          docs: item.docs || []
        };

        // Ensure status is valid for Firestore rules
        const validStatuses = ['Scheduled', 'Completed', 'Paid', 'Cancelled', 'No Show'];
        if (!validStatuses.includes(appointment.status)) {
          appointment.status = 'Scheduled';
        }

        // Clean up any nulls that might have come from item spread
        ['date', 'time', 'signingType', 'location', 'clientName', 'status'].forEach(field => {
          if (appointment[field] === null || appointment[field] === undefined) {
            if (field === 'clientName') appointment[field] = 'Unknown Client';
            else if (field === 'status') appointment[field] = 'Scheduled';
            else if (field === 'signingType') appointment[field] = 'Loan Signing';
            else if (field === 'location') appointment[field] = 'TBD';
            else if (field === 'date') appointment[field] = format(now, 'yyyy-MM-dd');
            else if (field === 'time') appointment[field] = '12:00 PM';
          }
        });

        // Generate sortableDateTime AFTER merging item and defaults
        appointment.sortableDateTime = parseSafeDateTime(appointment.date, appointment.time).toISOString();
        appointment.invoiceNumber = item.invoiceNumber || appointment.invoiceNumber || `INV-${dateStr}-${randomStr}`;

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
  console.error('[Firestore Error Details]:', JSON.stringify(errInfo, null, 2));
  
  // Don't throw for LIST operations to avoid crashing the listening cycle
  if (operationType !== OperationType.LIST) {
     throw new Error(JSON.stringify(errInfo));
  }
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
          {activeTab === 'Mileage' && (
            <div className="space-y-6">
              <div className="p-4 bg-blue-50 border border-blue-100 rounded-xl flex items-start gap-4">
                <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 shrink-0">
                  <Car className="w-5 h-5" />
                </div>
                <div className="space-y-1">
                  <h4 className="text-sm font-bold text-blue-900 uppercase tracking-widest">IRS Mileage Rate 2026</h4>
                  <p className="text-[11px] text-blue-700 leading-relaxed italic">The standard mileage rate for the use of a car (also vans, pickups or panel trucks) is <span className="font-black">$0.725</span> per mile driven for business use.</p>
                </div>
              </div>

              <div className="space-y-4 pt-2">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Current Mileage Rate</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-bold">$</span>
                    <input 
                      type="number" 
                      step="0.001"
                      defaultValue={0.725}
                      className="w-full pl-8 pr-4 py-3 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Default Business Base</label>
                    <input 
                      type="text" 
                      placeholder="e.g. Home Office"
                      className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Base State</label>
                    <input 
                      type="text" 
                      placeholder="NC"
                      className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-4 p-4 bg-slate-50 border border-slate-100 rounded-xl">
                  <div className="flex-1">
                    <p className="text-xs font-bold text-slate-800">Automatic Round Trip Calculation</p>
                    <p className="text-[10px] text-slate-500 italic">Always double miles driven for profit calculations.</p>
                  </div>
                  <button className="w-12 h-6 bg-indigo-600 rounded-full relative">
                    <div className="absolute top-1 right-1 w-4 h-4 bg-white rounded-full"></div>
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'Notary Fees' && (
            <div className="space-y-6">
              <div className="p-4 bg-amber-50 border border-amber-100 rounded-xl flex items-start gap-4">
                <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center text-amber-600 shrink-0">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div className="space-y-1">
                  <h4 className="text-sm font-bold text-amber-900 uppercase tracking-widest">Fee Guidance (North Carolina)</h4>
                  <p className="text-[11px] text-amber-700 leading-relaxed italic">The maximum fee a notary may charge for a notarial act is <span className="font-black">$10.00 per principal signature</span> for acknowledgments and jurats.</p>
                </div>
              </div>

              <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm bg-white">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Notarial Act</th>
                      <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest w-32">Standard Fee</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {[
                      { act: 'Acknowledgment', fee: 10.00 },
                      { act: 'Jurat / Oaths', fee: 10.00 },
                      { act: 'Verifications', fee: 10.00 },
                      { act: 'Administering Oath', fee: 10.00 },
                    ].map(item => (
                      <tr key={item.act}>
                        <td className="px-4 py-3 text-sm font-bold text-slate-700">{item.act}</td>
                        <td className="px-4 py-3">
                          <div className="relative">
                            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 text-[10px]">$</span>
                            <input 
                              type="number" 
                              defaultValue={item.fee} 
                              className="w-full pl-5 pr-2 py-1.5 border border-slate-200 rounded text-xs font-black outline-none focus:border-indigo-500"
                            />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="p-4 bg-slate-50 border border-slate-100 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold text-slate-800">Travel Fee Surcharge</p>
                    <p className="text-[10px] text-slate-500 italic">Separate from legislative notarial act limits.</p>
                  </div>
                  <div className="relative w-32">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[10px]">$</span>
                    <input 
                      type="number" 
                      defaultValue={25.00} 
                      className="w-full pl-7 pr-3 py-2 border border-slate-200 rounded text-xs font-black outline-none focus:border-indigo-500 bg-white"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'Expense Types' && (
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
  const [selectedCompany, setSelectedCompany] = useState('All Companies');
  const [selectedClient, setSelectedClient] = useState('All Clients');
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

  const activeReport = reports.find(r => {
    const segments = currentPath.split('/');
    const lastSegment = segments[segments.length - 1];
    return lastSegment === r.id;
  }) || reports[0];

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

    // Data normalization adapter to handle inconsistent field names and missing data
    const normalizeApp = (app: any) => {
      const fullClientName = app.clientName || 
                    (app.firstName && app.lastName ? `${app.firstName} ${app.lastName}` : null) || 
                    (app as any).signerName || 
                    (app as any).borrowerName || 
                    'Unknown Client';
      
      const displayClient = fullClientName === 'Unknown Client' ? fullClientName : (fullClientName.split(' ').pop() || fullClientName);
      
      const customer = app.companyName || 
                      app.customerName || 
                      app.customer || 
                      app.signingCompany || 
                      'Direct Client';
      
      return {
        ...app,
        displayClient,
        displayCompany: customer,
        normalizedFee: Number(app.agreedFee ?? app.fee ?? 0)
      };
    };

    const filteredAppointments = appointments
      .filter(app => {
        const dateMatch = filterByDate(app.date);
        const normalized = normalizeApp(app);
        const companyMatch = selectedCompany === 'All Companies' || 
                             normalized.displayCompany === selectedCompany;
        const clientMatch = selectedClient === 'All Clients' || 
                           normalized.displayClient === selectedClient;
        const statusMatch = selectedStatus === 'All Statuses' || 
                           (selectedStatus === 'Paid' && app.status === 'Paid') ||
                           (selectedStatus === 'Unpaid' && (app.status === 'Scheduled' || app.status === 'Completed'));
        return dateMatch && companyMatch && clientMatch && statusMatch;
      })
      .map(normalizeApp);

    const filteredExpenses = expenses.filter(exp => filterByDate(exp.date));
    const filteredMileage = mileage.filter(mil => filterByDate(mil.date));

    return { filteredAppointments, filteredExpenses, filteredMileage };
  };

  const { filteredAppointments, filteredExpenses, filteredMileage } = getFilteredData();

  const handleExportCSV = () => {
    let headers: string[] = [];
    let rows: any[][] = [];

    if (activeReport.id === 'income' || activeReport.id === 'unpaid' || activeReport.id === 'signing-type') {
      const data = activeReport.id === 'unpaid' ? filteredAppointments.filter(a => a.status !== 'Paid') : filteredAppointments;
      headers = ['Date', 'Client', 'Type', 'Signing Company', 'Fee', 'Status'];
      rows = data.map(app => [
        `"${format(parseSafeDateTime(app.date), 'MM/dd/yyyy')}"`,
        `"${app.displayClient}"`,
        `"${app.signingType}"`,
        `"${app.displayCompany}"`,
        app.normalizedFee.toFixed(2),
        `"${app.status}"`
      ]);
    } else if (activeReport.id === 'expenses') {
       headers = ['Date', 'Category', 'Description', 'Amount'];
       rows = filteredExpenses.map(exp => [
         `"${format(parseSafeDateTime(exp.date), 'MM/dd/yyyy')}"`,
         `"${exp.category}"`,
         `"${exp.description}"`,
         Number(exp.amount).toFixed(2)
       ]);
    } else if (activeReport.id === 'mileage') {
      headers = ['Date', 'Description', 'Miles', 'Deduction'];
      rows = filteredMileage.map(mil => [
        `"${format(parseSafeDateTime(mil.date), 'MM/dd/yyyy')}"`,
        `"${mil.description}"`,
        mil.miles,
        (mil.miles * DEFAULT_MILEAGE_RATE).toFixed(2)
      ]);
    }
    
    if (headers.length === 0) {
      alert("Export not available for this report type yet.");
      return;
    }

    const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `${activeReport.title.replace(/\s+/g, '_')}_${format(new Date(), 'yyyy-MM-dd')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Get unique companies and clients for filter dropdowns using normalized names
  const companies = Array.from(new Set(filteredAppointments.map(app => app.displayCompany).filter(Boolean)));
  const clients = Array.from(new Set(filteredAppointments.map(app => app.displayClient).filter(Boolean)));

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
                <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase">Signing Company</th>
                <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase text-right">Fee</th>
                <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredAppointments.map(app => (
                <tr key={app.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4 text-sm text-slate-600">{format(parseSafeDateTime(app.date), 'MM/dd/yyyy')}</td>
                  <td className="px-6 py-4 text-sm font-medium text-slate-900">{app.displayClient}</td>
                  <td className="px-6 py-4 text-sm text-slate-600">{app.signingType}</td>
                  <td className="px-6 py-4 text-sm text-slate-600">{app.displayCompany}</td>
                  <td className="px-6 py-4 text-sm font-bold text-slate-900 text-right">${app.normalizedFee.toFixed(2)}</td>
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
                    ${filteredAppointments.reduce((sum, app) => sum + app.normalizedFee, 0).toFixed(2)}
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
                <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase">Signing Company</th>
                <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase text-right">Amount</th>
                <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {unpaidApps.map(app => (
                <tr key={app.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4 text-sm text-slate-600">{format(parseSafeDateTime(app.date), 'MM/dd/yyyy')}</td>
                  <td className="px-6 py-4 text-sm font-medium text-slate-900">{app.displayClient}</td>
                  <td className="px-6 py-4 text-sm text-slate-600">{app.displayCompany}</td>
                  <td className="px-6 py-4 text-sm font-bold text-amber-600 text-right">${app.normalizedFee.toFixed(2)}</td>
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
                    ${unpaidApps.reduce((sum, app) => sum + app.normalizedFee, 0).toFixed(2)}
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
        acc[type].revenue += app.normalizedFee;
        return acc;
      }, {} as Record<string, { count: number, revenue: number }>);

      const sortedTypes = (Object.entries(typeStats) as [string, { count: number; revenue: number }][])
        .sort((a, b) => b[1].revenue - a[1].revenue);

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
      const totalIncome = filteredAppointments.reduce((sum, app) => sum + app.normalizedFee, 0);
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

    if (activeReport.id === 'tax') {
      const totalIncome = filteredAppointments.reduce((sum, app) => sum + app.normalizedFee, 0);
      const totalExpenses = filteredExpenses.reduce((sum, exp) => sum + Number(exp.amount), 0);
      const totalMileageDeduction = filteredMileage.reduce((sum, mil) => sum + Number(mil.miles), 0) * DEFAULT_MILEAGE_RATE;
      const totalDeductions = totalExpenses + totalMileageDeduction;
      const taxableIncome = Math.max(0, totalIncome - totalDeductions);

      return (
        <div className="p-8 max-w-4xl mx-auto">
          <div className="mb-8">
            <h3 className="text-xl font-bold text-slate-900 mb-2">Tax Basis Report</h3>
            <p className="text-sm text-slate-500 font-medium">Detailed breakdown of income and deductible items for tax preparation.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
            <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
              <h4 className="text-sm font-bold text-slate-500 uppercase mb-4 tracking-wider">Income Sources</h4>
              <div className="space-y-3">
                <div className="flex justify-between text-sm py-1">
                  <span className="text-slate-600">Signing Fees</span>
                  <span className="font-bold text-slate-900">${totalIncome.toFixed(2)}</span>
                </div>
                <div className="pt-2 border-t border-slate-100 flex justify-between font-bold text-slate-900">
                  <span>Gross Total</span>
                  <span>${totalIncome.toFixed(2)}</span>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
              <h4 className="text-sm font-bold text-slate-500 uppercase mb-4 tracking-wider">Deductions</h4>
              <div className="space-y-3">
                <div className="flex justify-between text-sm py-1">
                  <span className="text-slate-600">Business Expenses</span>
                  <span className="font-bold text-slate-900">${totalExpenses.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm py-1">
                  <span className="text-slate-600">Mileage Allowance</span>
                  <span className="font-bold text-slate-900">${totalMileageDeduction.toFixed(2)}</span>
                </div>
                <div className="pt-2 border-t border-slate-100 flex justify-between font-bold text-rose-600">
                  <span>Total Deductions</span>
                  <span>(${totalDeductions.toFixed(2)})</span>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-emerald-50 rounded-2xl p-8 border border-emerald-100 text-center">
            <p className="text-sm font-bold text-emerald-600 uppercase tracking-widest mb-1">Estimated Taxable Net Income</p>
            <p className="text-4xl font-black text-emerald-700">${taxableIncome.toFixed(2)}</p>
          </div>
        </div>
      );
    }

    if (activeReport.id === 'tax-summary') {
      const totalIncome = filteredAppointments.reduce((sum, app) => sum + app.normalizedFee, 0);
      const totalExpenses = filteredExpenses.reduce((sum, exp) => sum + Number(exp.amount), 0);
      const totalMileageDeduction = filteredMileage.reduce((sum, mil) => sum + Number(mil.miles), 0) * DEFAULT_MILEAGE_RATE;
      const totalDeductions = totalExpenses + totalMileageDeduction;
      const taxableIncome = Math.max(0, totalIncome - totalDeductions);
      const estimatedTax = taxableIncome * 0.153; // Estimated self-employment tax rate

      return (
        <div className="p-8 max-w-4xl mx-auto">
          <div className="mb-8 text-center">
            <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tight mb-2">Quarterly Tax Summary</h3>
            <p className="text-slate-500 font-medium">Estimated tax liability overview based on net business income.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12 text-center">
            <div className="bg-indigo-50 p-6 rounded-3xl border border-indigo-100">
              <Calculator className="w-6 h-6 text-indigo-400 mx-auto mb-3" />
              <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest mb-1">Gross</p>
              <p className="text-2xl font-black text-indigo-600">${totalIncome.toFixed(2)}</p>
            </div>
            <div className="bg-rose-50 p-6 rounded-3xl border border-rose-100">
              <TrendingDown className="w-6 h-6 text-rose-400 mx-auto mb-3" />
              <p className="text-[10px] font-bold text-rose-400 uppercase tracking-widest mb-1">Expenses</p>
              <p className="text-2xl font-black text-rose-600">${totalDeductions.toFixed(2)}</p>
            </div>
            <div className="bg-emerald-50 p-6 rounded-3xl border border-emerald-100">
              <TrendingUp className="w-6 h-6 text-emerald-400 mx-auto mb-3" />
              <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest mb-1">Net</p>
              <p className="text-2xl font-black text-emerald-600">${taxableIncome.toFixed(2)}</p>
            </div>
          </div>

          <div className="bg-slate-900 rounded-3xl p-10 text-white shadow-2xl overflow-hidden relative">
            <div className="absolute top-0 right-0 p-8 opacity-10">
              <ShieldCheck className="w-48 h-48" />
            </div>
            <div className="relative z-10">
              <h4 className="text-indigo-400 text-xs font-bold uppercase tracking-widest mb-2">Estimated Liability</h4>
              <div className="flex items-end gap-3 mb-8">
                <span className="text-5xl font-black">${estimatedTax.toFixed(2)}</span>
                <span className="text-indigo-400 text-sm font-bold mb-2">SE Tax (15.3%)</span>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 pt-8 border-t border-white/10 uppercase tracking-tighter">
                <div>
                  <p className="text-white/40 text-[10px] font-bold mb-1">Income After Deductions</p>
                  <p className="text-lg font-bold">${taxableIncome.toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-white/40 text-[10px] font-bold mb-1">Filing Status</p>
                  <p className="text-lg font-bold">Self-Employed</p>
                </div>
              </div>
            </div>
          </div>
          
          <div className="mt-8 bg-amber-50 rounded-2xl p-6 border border-amber-100 flex gap-4">
            <AlertCircle className="w-6 h-6 text-amber-500 shrink-0" />
            <div className="text-sm text-amber-800">
              <p className="font-bold mb-1">Important Tax Notice</p>
              <p className="leading-relaxed opacity-80">
                This summary uses a flat 15.3% rate for estimated self-employment taxes (Social Security and Medicare). 
                It does not account for income tax brackets, credits, or state-specific tax laws. 
                Always verify your figures with a certified tax professional or CPA.
              </p>
            </div>
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
      const total = filteredAppointments.reduce((sum, app) => sum + app.normalizedFee, 0);
      const paid = filteredAppointments.filter(app => app.status === 'Paid').reduce((sum, app) => sum + app.normalizedFee, 0);
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
          <button 
            onClick={handleExportCSV}
            className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors flex items-center gap-2 shadow-sm"
          >
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
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Signing Company</label>
          <select 
            value={selectedCompany}
            onChange={(e) => setSelectedCompany(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 w-48"
          >
            <option>All Companies</option>
            {companies.map(c => <option key={c}>{c}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Customer</label>
          <select 
            value={selectedClient}
            onChange={(e) => setSelectedClient(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 w-48"
          >
            <option>All Clients</option>
            {clients.map(c => <option key={c}>{c}</option>)}
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
              await onImport(newAppointments);
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
  onNewJournalEntry,
  onNewExpense, 
  onExpenseTypes, 
  onRecurringExpense, 
  onNewMileage,
  user,
  onSignIn,
  onSignOut,
  isPlatformDemo
}: { 
  isOpen: boolean; 
  toggle: () => void; 
  onNewSigning: () => void; 
  onNewJournalEntry: () => void;
  onNewExpense: () => void; 
  onExpenseTypes: () => void; 
  onRecurringExpense: () => void; 
  onNewMileage: () => void;
  user: FirebaseUser | null;
  onSignIn: () => void;
  onSignOut: () => void;
  isPlatformDemo: boolean;
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
    { name: 'NC Journal', 
      icon: PenLine, 
      path: '/journal',
      isOpen: isJournalOpen,
      setIsOpen: setIsJournalOpen,
      subItems: [
        { name: 'View Journal', icon: List, path: '/journal' },
        { name: 'New Entry', icon: PlusCircle, path: '#', onClick: onNewJournalEntry },
      ]
    },
    { name: 'Marketing', icon: Mail, path: '/marketing' },
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
    !user && !isPlatformDemo ? { name: 'Firestore Login', icon: ShieldCheck, path: '#', onClick: onSignIn } : null,
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
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const location = useLocation();
  const pageTitle = useMemo(() => {
    const path = location.pathname;
    if (path === '/') return 'Dashboard';
    if (path === '/journal') return 'Notary Journal';
    if (path === '/calendar') return 'Schedule';
    if (path === '/customers') return 'Clients';
    if (path === '/companies') return 'Partners';
    if (path === '/accounting') return 'Finances';
    if (path === '/tools') return 'Resources';
    if (path.startsWith('/reports')) return 'Analytics';
    if (path === '/settings') return 'Settings';
    return 'NotaryPro';
  }, [location.pathname]);

  return (
    <header className="flex flex-col sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-slate-200">
      {isDemoMode && (
        <div className="bg-gradient-to-r from-amber-500 to-orange-600 text-white px-4 py-1.5 text-[10px] font-black uppercase tracking-[0.2em] flex items-center justify-center gap-4 shadow-inner">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-3 h-3" />
            <span>Demo Mode — Private Local Session</span>
          </div>
          <button 
            onClick={onResetDemo}
            className="bg-white/20 hover:bg-white/30 px-2 py-0.5 rounded transition-colors flex items-center gap-1"
          >
            <RefreshCw className="w-2.5 h-2.5" /> Reset Demo
          </button>
        </div>
      )}
      <div className="h-16 flex items-center justify-between px-4 lg:px-8">
        <div className="flex items-center gap-6">
          <button 
            onClick={toggleSidebar}
            className="p-2 hover:bg-slate-100 rounded-xl transition-colors lg:hidden"
          >
            <Menu className="w-5 h-5 text-slate-600" />
          </button>
          
          <div className="hidden lg:flex flex-col">
            <h2 className="text-lg font-black text-slate-900 tracking-tight leading-none">{pageTitle}</h2>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Integrity Closings CLT</p>
          </div>

          <div className="relative hidden xl:block">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input 
              type="text" 
              placeholder="Search signings, clients, or addresses..." 
              className="pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500/10 focus:border-sky-500/30 w-[300px] transition-all"
            />
          </div>
        </div>

        <div className="flex items-center gap-6">
          <button 
            onClick={onNewSigning}
            className="flex items-center gap-2 bg-sky-600 hover:bg-sky-700 text-white px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-lg shadow-sky-600/20 border border-sky-500/50 group shrink-0"
          >
            <Plus className="w-4 h-4 transition-transform group-hover:rotate-90" />
            <span>{location.pathname.startsWith('/journal') ? 'New Journal Entry' : 'New Signing'}</span>
          </button>

          <div className="h-6 w-px bg-slate-200 mx-2 hidden sm:block"></div>
          
          <div className="relative">
            <button 
              onClick={() => setIsProfileOpen(!isProfileOpen)}
              className="flex items-center gap-3 p-1 pr-4 hover:bg-slate-50 rounded-full border border-transparent hover:border-slate-200 transition-all group whitespace-nowrap"
            >
              <div className="w-9 h-9 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center overflow-hidden shrink-0 shadow-sm">
                {user?.photoURL ? (
                  <img src={user.photoURL} alt="User" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                  <User className="w-4 h-4 text-slate-500" />
                )}
              </div>
              <div className="hidden sm:flex flex-col items-start leading-[1.1]">
                <span className="text-[11px] font-black text-slate-900 truncate max-w-[120px]">
                  {user?.displayName || 'Integrity Notary'}
                </span>
                <span className="text-[9px] font-bold text-sky-600 uppercase tracking-tighter">Pro Account</span>
              </div>
              <ChevronDown className={cn("w-3 h-3 text-slate-400 transition-transform", isProfileOpen && "rotate-180")} />
            </button>

            <AnimatePresence>
              {isProfileOpen && (
                <>
                  <div 
                    className="fixed inset-0 z-40" 
                    onClick={() => setIsProfileOpen(false)} 
                  />
                  <motion.div 
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    className="absolute right-0 mt-2 w-56 bg-white border border-slate-200 rounded-2xl shadow-2xl z-50 overflow-hidden"
                  >
                    <div className="p-4 border-b border-slate-100 bg-slate-50/50">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Signed in as</p>
                      <p className="text-xs font-bold text-slate-900 truncate">{user?.email || 'demo@notarypro.app'}</p>
                    </div>
                    <div className="p-2">
                      <Link 
                        to="/settings" 
                        onClick={() => setIsProfileOpen(false)}
                        className="flex items-center gap-3 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 rounded-xl transition-colors"
                      >
                        <Settings className="w-4 h-4 text-slate-400" />
                        Account Settings
                      </Link>
                      <button 
                        onClick={() => {
                          setIsProfileOpen(false);
                          onSignOut();
                        }}
                        className="w-full flex items-center gap-3 px-3 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 rounded-xl transition-colors text-left"
                      >
                        <LogOut className="w-4 h-4" />
                        Sign Out
                      </button>
                    </div>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
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
  const [timePeriod, setTimePeriod] = useState<'thisMonth' | 'lastMonth' | 'thisYear' | 'allTime'>('thisMonth');

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
    return todaySignings.reduce((sum, a) => sum + (Number(a.agreedFee) || Number(a.fee) || 0), 0);
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

  const stats = useMemo(() => {
    const now = new Date();
    
    const filteredApps = appointments.filter(a => {
      const appDate = parseSafeDateTime(a.date);
      if (a.status === 'Cancelled' || a.status === 'No Show') return false;
      
      switch (timePeriod) {
        case 'thisMonth':
          return isSameMonth(appDate, now) && isSameYear(appDate, now);
        case 'lastMonth':
          return isSameMonth(appDate, subMonths(now, 1)) && isSameYear(appDate, subMonths(now, 1));
        case 'thisYear':
          return isSameYear(appDate, now);
        case 'allTime':
          return true;
        default:
          return isSameMonth(appDate, now) && isSameYear(appDate, now);
      }
    });

    const gross = filteredApps.reduce((sum, a) => sum + (Number(a.agreedFee) || Number(a.fee) || 0), 0);
    const paid = filteredApps.reduce((sum, a) => sum + (Number(a.amountCollected) || (a.status === 'Paid' ? (Number(a.agreedFee) || Number(a.fee) || 0) : 0) || 0), 0);
    const unpaid = Math.max(0, gross - paid);
    const avgOrderValue = filteredApps.length > 0 ? gross / filteredApps.length : 0;
    
    const filteredExpenses = expenses.filter(e => {
      const expDate = parseSafeDateTime(e.date);
      switch (timePeriod) {
        case 'thisMonth':
          return isSameMonth(expDate, now) && isSameYear(expDate, now);
        case 'lastMonth':
          return isSameMonth(expDate, subMonths(now, 1)) && isSameYear(expDate, subMonths(now, 1));
        case 'thisYear':
          return isSameYear(expDate, now);
        case 'allTime':
          return true;
        default:
          return isSameMonth(expDate, now) && isSameYear(expDate, now);
      }
    }).reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
    const netEarnings = gross - filteredExpenses;
    
    return { paid, gross, unpaid, count: filteredApps.length, avgOrderValue, netEarnings };
  }, [appointments, expenses, timePeriod]);

  const monthlyGoal = 5000;
  const goalProgress = Math.min(100, (stats.paid / monthlyGoal) * 100);

  const lanes = useMemo(() => {
    const now = new Date();
    return [
      { id: 'today', title: 'Today’s Priorities', items: todaySignings, color: 'text-sky-600', bg: 'bg-sky-50', icon: CalendarDays },
      { id: 'scanbacks', title: 'In-Progress Signings', items: appointments
        .filter(a => a.scanbackStatus === 'Pending')
        .sort((a, b) => parseSafeDateTime(b.date, b.time).getTime() - parseSafeDateTime(a.date, a.time).getTime()), 
        color: 'text-amber-600', bg: 'bg-amber-50', icon: RefreshCw },
      { id: 'payment', title: 'Follow-Ups Due', items: appointments.filter(a => (a.status as string) !== 'Paid' && !a.invoicePaidDate && isBefore(parseSafeDateTime(a.date), now) && a.status !== 'Cancelled' && a.status !== 'No Show').slice(0, 5), color: 'text-rose-600', bg: 'bg-rose-50', icon: DollarSign },
      { id: 'completed', title: 'Payments Collected', items: appointments.filter(a => a.status === 'Paid').sort((a, b) => parseSafeDateTime(b.date, b.time).getTime() - parseSafeDateTime(a.date, a.time).getTime()).slice(0, 5), color: 'text-emerald-600', bg: 'bg-emerald-50', icon: CheckCircle2 },
    ];
  }, [appointments, todaySignings]);

  const topCompanies = useMemo(() => {
    const companyStats = appointments.reduce((acc, app) => {
      const name = app.signingCompany || app.companyName || 'Unknown';
      if (!acc[name]) {
        acc[name] = { name, count: 0, total: 0 };
      }
      acc[name].count += 1;
      acc[name].total += Number(app.agreedFee) || Number(app.fee) || 0;
      return acc;
    }, {} as Record<string, { name: string; count: number; total: number }>);

    return Object.values(companyStats)
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);
  }, [appointments]);

  const recentActivity = useMemo(() => {
    return [...appointments]
      .sort((a, b) => parseSafeDateTime(b.date, b.time).getTime() - parseSafeDateTime(a.date, a.time).getTime())
      .slice(0, 5);
  }, [appointments]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 -m-4 lg:-m-8 p-4 lg:p-8 space-y-8 font-sans">
      {/* 1. OPERATIONS OVERVIEW */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* LEFT COLUMN: TODAY'S FOCUS */}
        <div className="lg:col-span-8 space-y-8">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">Business Overview</h1>
              <p className="text-sm text-slate-500 font-medium">Manage signings, track revenue, and stay ahead of follow-ups from one professional workspace.</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex bg-white border border-slate-200 rounded-xl p-1 shadow-sm">
                {[
                  { id: 'thisMonth', label: 'This Month' },
                  { id: 'lastMonth', label: 'Last Month' },
                  { id: 'thisYear', label: 'This Year' },
                  { id: 'allTime', label: 'All Time' }
                ].map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setTimePeriod(p.id as any)}
                    className={cn(
                      "px-3 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all",
                      timePeriod === p.id 
                        ? "bg-slate-900 text-white shadow-md" 
                        : "text-slate-500 hover:text-slate-900 hover:bg-slate-50"
                    )}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
              <div className="bg-white border border-slate-200 px-3 py-1.5 rounded-xl flex items-center gap-2 shadow-sm" title="Appointments scheduled for today.">
                <span className="w-1.5 h-1.5 rounded-full bg-sky-500"></span>
                <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">{todaySignings.length} Signings Today</span>
              </div>
            </div>
          </div>

          {/* NEXT SIGNING HERO */}
          {nextSigning ? (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="relative bg-white rounded-[2rem] p-8 border border-slate-200 shadow-xl overflow-hidden group"
            >
              <div className="absolute top-0 right-0 w-64 h-64 bg-sky-500/5 rounded-full -mr-32 -mt-32 blur-3xl transition-all group-hover:bg-sky-500/10"></div>
              
              <div className="relative z-10 flex flex-col md:flex-row justify-between gap-8">
                <div className="space-y-6 flex-1">
                  <div className="flex items-center gap-3">
                    <span className="px-3 py-1 bg-sky-50 text-sky-600 text-[10px] font-black uppercase tracking-[0.2em] rounded-full border border-sky-100">
                      Upcoming Appointment
                    </span>
                    <span className="text-slate-400 text-xs font-bold">
                      {isSameDay(parseSafeDateTime(nextSigning.date), new Date()) ? 'Next Up' : format(parseSafeDateTime(nextSigning.date), 'MMM d')}
                    </span>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex items-baseline gap-3">
                      <h2 className="text-5xl font-black text-slate-900 tracking-tighter">{nextSigning.time}</h2>
                      <span className="text-sky-600 font-bold text-lg">${(Number(nextSigning.agreedFee) || Number(nextSigning.fee) || 0).toFixed(2)}</span>
                    </div>
                    <h3 className="text-2xl font-bold text-slate-800">{formatDisplayName(nextSigning.clientName)}</h3>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-slate-500">
                    <div className="flex items-center gap-2 min-w-0">
                      <MapPin className="w-4 h-4 text-sky-500 shrink-0" />
                      <span className="text-xs font-bold truncate">{nextSigning.city || nextSigning.location?.split(',')[1]?.trim() || 'Location TBD'}</span>
                    </div>
                    <div className="flex items-center gap-2 min-w-0">
                      <Briefcase className="w-4 h-4 text-sky-500 shrink-0" />
                      <span className="text-xs font-bold truncate">{nextSigning.signingType}</span>
                    </div>
                    <div className="flex items-center gap-2 min-w-0">
                      <Building2 className="w-4 h-4 text-sky-500 shrink-0" />
                      <span className="text-xs font-bold truncate">{nextSigning.signingCompany || nextSigning.companyName || "Direct Client"}</span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col justify-end gap-3 min-w-[200px]">
                  <button 
                    onClick={() => onViewSigning(nextSigning)}
                    className="w-full py-4 bg-slate-900 hover:bg-slate-800 text-white font-black rounded-2xl shadow-lg transition-all flex items-center justify-center gap-2 group"
                  >
                    <FileText className="w-5 h-5" />
                    Open Signing File
                  </button>
                  <div className="grid grid-cols-2 gap-3">
                    <button 
                      onClick={() => {
                        if (nextSigning.location && nextSigning.location !== 'TBD') {
                          window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(nextSigning.location)}`, '_blank');
                        } else {
                          alert('Address not available for this signing yet.');
                        }
                      }}
                      className="py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-all flex items-center justify-center gap-2"
                    >
                      <Navigation className="w-4 h-4 text-sky-600" />
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
                <Calendar className="w-8 h-8 text-slate-200" />
              </div>
              <div className="space-y-1">
                <h3 className="text-lg font-bold text-slate-900">Your upcoming appointments will appear here.</h3>
                <p className="text-sm text-slate-500">Add a signing to start tracking time, status, and payment in one place.</p>
              </div>
              <button 
                onClick={onNewSigning}
                className="px-6 py-2.5 bg-sky-600 text-white font-black rounded-xl hover:bg-sky-700 transition-all uppercase tracking-widest text-xs"
              >
                Schedule Signing
              </button>
            </div>
          )}

          {/* WORKFLOW PIPELINE */}
          <div className="space-y-6">
            <h2 className="text-xl font-black text-slate-900 tracking-tight">Today’s Priorities</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {lanes.map((lane) => (
                <div key={lane.id} className="space-y-4">
                  <div className="flex items-center gap-2 px-2">
                    <lane.icon className={cn("w-4 h-4", lane.color)} />
                    <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{lane.title}</h3>
                    <span className="ml-auto bg-slate-200 text-slate-600 text-[10px] font-black px-1.5 py-0.5 rounded-md" title={
                      lane.id === 'payment' ? 'Clients or companies needing attention.' : 
                      lane.id === 'completed' ? 'Revenue received this month.' : undefined
                    }>
                      {lane.items.length}
                    </span>
                  </div>
                  
                  <div className="space-y-3">
                    {lane.items.map((item) => (
                      <button 
                        key={item.id} 
                        onClick={() => onViewSigning(item)}
                        className="w-full text-left bg-white border border-slate-200 p-4 rounded-3xl hover:border-sky-300 transition-all group shadow-sm"
                      >
                        <div className="flex justify-between items-start mb-2">
                          <p className="text-xs font-black text-slate-900 truncate max-w-[120px]">{formatDisplayName(item.clientName)}</p>
                          <span className="text-[10px] font-black text-sky-600">${(Number(item.agreedFee) || Number(item.fee) || 0).toFixed(0)}</span>
                        </div>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter truncate mb-3">
                          {format(parseSafeDateTime(item.date), 'MMM d')} • {item.time}
                        </p>
                        <div className="flex items-center justify-between">
                          <span className={cn(
                            "text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest border",
                            getStatusBadgeClass(item.status)
                          )}>
                            {getStatusLabel(item.status)}
                          </span>
                          <ChevronRight className="w-3 h-3 text-slate-300 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                        </div>
                      </button>
                    ))}
                    {lane.items.length === 0 && (
                      <div className="border border-slate-200 border-dashed rounded-3xl p-6 text-center bg-slate-50/50">
                        <p className="text-[9px] font-bold text-slate-300 uppercase tracking-widest italic leading-tight">
                          {lane.id === 'payment' ? 'No follow-ups right now.' : 
                           lane.id === 'today' ? 'Nothing urgent right now.' : 'Station Clear'}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: REVENUE SNAPSHOT */}
        <div className="lg:col-span-4 space-y-8">
          <div className="space-y-1">
            <h2 className="text-2xl font-black text-slate-900 tracking-tight">Revenue Snapshot</h2>
            <p className="text-sm text-slate-500 font-bold">{format(new Date(), 'MMMM yyyy')}</p>
          </div>

          {/* MONEY STACK */}
          <div className="space-y-4">
            <div className="bg-slate-900 text-white rounded-[2rem] p-6 shadow-xl relative overflow-hidden group">
              <div className="absolute bottom-0 right-0 w-32 h-32 bg-white/5 rounded-full -mb-16 -mr-16 blur-2xl group-hover:bg-white/10 transition-all"></div>
              <div className="flex justify-between items-start mb-6">
                <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-sky-400" />
                </div>
                <Zap className="w-5 h-5 text-amber-400 animate-pulse" />
              </div>
              <p className="text-[10px] font-black text-white/50 uppercase tracking-[0.2em] mb-1">Booked Revenue</p>
              <h2 className="text-4xl font-black tracking-tighter">${stats.gross.toLocaleString()}</h2>
              <p className="text-[9px] font-bold text-white/30 uppercase tracking-[0.1em] mt-1">Total value of confirmed assignments.</p>
              
              <div className="mt-10 space-y-3">
                <div className="flex justify-between text-[10px] font-black text-white/40 uppercase tracking-widest bg-white/5 p-2 rounded-lg">
                  <span>Goal Progress</span>
                  <span>{Math.round(goalProgress)}% of ${monthlyGoal.toLocaleString()}</span>
                </div>
                <div className="h-2 w-full bg-white/10 rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${goalProgress}%` }}
                    className="h-full bg-gradient-to-r from-sky-400 to-indigo-500 rounded-full shadow-[0_0_15px_rgba(56,189,248,0.5)]"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white border border-slate-200 p-5 rounded-3xl shadow-sm space-y-2">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Payments Collected</span>
                  </div>
                  <p className="text-xl font-black text-slate-900">${stats.paid.toLocaleString()}</p>
                </div>
                <p className="text-[8px] font-bold text-slate-300 uppercase tracking-tight">Revenue received this month.</p>
              </div>
              <div className="bg-white border border-slate-200 p-5 rounded-3xl shadow-sm space-y-2">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-2 h-2 rounded-full bg-rose-500"></div>
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Outstanding Revenue</span>
                  </div>
                  <p className="text-xl font-black text-slate-900">${stats.unpaid.toLocaleString()}</p>
                </div>
                <p className="text-[8px] font-bold text-slate-300 uppercase tracking-tight">Work awaiting payment.</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white border border-slate-200 p-5 rounded-3xl shadow-sm space-y-2">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-2 h-2 rounded-full bg-sky-500"></div>
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Average Order Value</span>
                  </div>
                  <p className="text-xl font-black text-slate-900">${Math.round(stats.avgOrderValue).toLocaleString()}</p>
                </div>
                <p className="text-[8px] font-bold text-slate-300 uppercase tracking-tight">Average fee per signing.</p>
              </div>
              <div className="bg-white border border-slate-200 p-5 rounded-3xl shadow-sm space-y-2">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-2 h-2 rounded-full bg-indigo-500"></div>
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Net Earnings</span>
                  </div>
                  <p className="text-xl font-black text-slate-900">${stats.netEarnings.toLocaleString()}</p>
                </div>
                <p className="text-[8px] font-bold text-slate-300 uppercase tracking-tight">Revenue after deductions.</p>
              </div>
            </div>
          </div>

          {/* LATEST ACTIVITY */}
          <div className="bg-white border border-slate-200 rounded-[2rem] overflow-hidden flex flex-col shadow-sm">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-sm font-black text-slate-900 uppercase tracking-widest">Latest Activity</h2>
              <Activity className="w-4 h-4 text-slate-400" />
            </div>
            <div className="p-6 space-y-5">
              {recentActivity.map((app) => (
                <div key={app.id} className="flex items-center justify-between group cursor-pointer" onClick={() => onViewSigning(app)}>
                  <div className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-lg bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-sky-50 group-hover:text-sky-600 transition-colors">
                      <Clock className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-[11px] font-black text-slate-800 group-hover:text-sky-600 transition-colors uppercase tracking-tight">{formatDisplayName(app.clientName)}</p>
                      <p className="text-[9px] font-bold text-slate-400">{format(parseSafeDateTime(app.date), 'MMM d')} • {app.status}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-black text-slate-900">${Number(app.fee).toFixed(0)}</p>
                  </div>
                </div>
              ))}
              {recentActivity.length === 0 && (
                <div className="text-center py-8">
                  <p className="text-[10px] font-bold text-slate-300 uppercase tracking-widest italic leading-relaxed">Recent signings and status updates will appear here.</p>
                </div>
              )}
            </div>
          </div>

          {/* BEST REFERRAL SOURCES */}
          <div className="bg-white border border-slate-200 rounded-[2rem] overflow-hidden flex flex-col shadow-sm">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-sm font-black text-slate-900 uppercase tracking-widest">Best Referral Sources</h2>
              <Building2 className="w-4 h-4 text-slate-400" />
            </div>
            <div className="p-6 space-y-5">
              {topCompanies.map((company, idx) => (
                <div key={company.name} className="flex items-center justify-between group cursor-pointer" onClick={() => navigate('/companies')}>
                  <div className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-lg bg-slate-50 flex items-center justify-center text-[10px] font-black text-slate-400 group-hover:bg-sky-50 group-hover:text-sky-600 transition-colors">
                      {idx + 1}
                    </div>
                    <div>
                      <p className="text-[11px] font-black text-slate-800 group-hover:text-sky-600 transition-colors uppercase tracking-tight">{company.name}</p>
                      <p className="text-[9px] font-bold text-slate-400">{company.count} bookings</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-black text-slate-900">${company.total.toLocaleString()}</p>
                    <p className="text-[9px] font-bold text-emerald-600">AVG ${Math.round(company.total / company.count)}</p>
                  </div>
                </div>
              ))}
              {topCompanies.length === 0 && (
                <div className="text-center py-8">
                  <p className="text-[10px] font-bold text-slate-300 uppercase tracking-widest italic leading-relaxed">Track which companies send the most work. Add assignments to see your partner ranking.</p>
                </div>
              )}
            </div>
            <Link to="/companies" className="p-4 text-center text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] hover:text-sky-600 transition-colors bg-slate-50/50 border-t border-slate-100">
              Business Directory
            </Link>
          </div>

          {/* QUICK TOOL LINKS */}
          <div className="pt-4 mt-4 border-t border-slate-200">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4 text-center">Quick Productivity Links</h3>
            <div className="grid grid-cols-1 gap-3">
              <button 
                onClick={() => navigate('/journal')}
                className="w-full bg-white border border-slate-200 p-4 rounded-2xl flex items-center gap-4 hover:bg-slate-50 transition-all shadow-sm group"
              >
                <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-500 group-hover:scale-110 transition-transform">
                  <BookOpen className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">New Journal Entry</span>
                <ChevronRight className="w-4 h-4 ml-auto text-slate-300" />
              </button>
              <button 
                onClick={() => navigate('/reports/income')}
                className="w-full bg-white border border-slate-200 p-4 rounded-2xl flex items-center gap-4 hover:bg-slate-50 transition-all shadow-sm group"
              >
                <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-500 group-hover:scale-110 transition-transform">
                  <PieChart className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Performance Reports</span>
                <ChevronRight className="w-4 h-4 ml-auto text-slate-300" />
              </button>
            </div>
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
  onConnectGoogle,
  googleEvents = [],
  syncStatus = 'disconnected',
  onRefresh
}: { 
  appointments: Appointment[]; 
  onViewSigning: (app: Appointment) => void;
  isGoogleConnected?: boolean;
  isConnecting?: boolean;
  onConnectGoogle?: () => void;
  googleEvents?: any[];
  syncStatus?: 'connected' | 'disconnected' | 'error' | 'syncing';
  onRefresh?: (start: Date, end: Date) => void;
}) => {
  const [viewMode, setViewMode] = useState<'month' | 'week' | 'day'>('month');
  const [currentDate, setCurrentDate] = useState(new Date()); 
  const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  // Effect to trigger refresh when date/view changes
  useEffect(() => {
    if (onRefresh && isGoogleConnected) {
      let start, end;
      if (viewMode === 'month') {
        start = startOfWeek(startOfMonth(currentDate));
        end = endOfWeek(endOfMonth(currentDate));
      } else if (viewMode === 'week') {
        start = startOfWeek(currentDate);
        end = endOfWeek(currentDate);
      } else {
        start = startOfDay(currentDate);
        end = addDays(start, 1);
      }
      onRefresh(start, end);
    }
  }, [currentDate, viewMode, onRefresh, isGoogleConnected]);

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
    
    // 1. Get App Signings
    const appEvents = appointments
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
          id: app.id,
          googleId: app.googleCalendarEventId,
          time: tStr.split(' ')[0].toLowerCase() + (tStr.includes('PM') ? 'p' : 'a'),
          name: `${formatDisplayName(cName.split(' ').pop() || cName)} (${loc.split(',')[1]?.trim() || loc})`,
          appointment: app,
          source: 'app' as const
        };
      });

    // 2. Get Google Events (excluding those already in app)
    const syncedGoogleIds = new Set(appEvents.map(e => e.googleId).filter(Boolean));
    const gEvents = googleEvents
      .filter(ge => {
        if (syncedGoogleIds.has(ge.id)) return false;
        const start = ge.start.dateTime || ge.start.date;
        if (!start) return false;
        return format(new Date(start), 'yyyy-MM-dd') === dateStr;
      })
      .map(ge => {
        const start = new Date(ge.start.dateTime || ge.start.date);
        return {
          id: ge.id,
          time: format(start, 'h:mma').toLowerCase(),
          name: ge.summary || '(No Title)',
          appointment: {
             id: ge.id,
             clientName: ge.summary,
             date: format(start, 'yyyy-MM-dd'),
             time: format(start, 'h:mm a'),
             location: ge.location || '',
             signingType: 'External Event',
             status: 'Scheduled'
          } as any,
          source: 'google' as const
        };
      });

    return [...appEvents, ...gEvents].sort((a, b) => a.time.localeCompare(b.time));
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
                      onClick={(e) => {
                        e.stopPropagation();
                        onViewSigning(event.appointment);
                      }}
                      className={cn(
                        "text-white text-[10px] py-0.5 px-1.5 rounded-sm truncate cursor-pointer transition-all shadow-sm active:scale-95",
                        event.source === 'google' 
                          ? "bg-slate-400 hover:bg-slate-500 border border-slate-300" 
                          : "bg-sky-600 hover:bg-sky-700"
                      )}
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
                    onClick={() => onViewSigning(event.appointment)}
                    className={cn(
                      "bg-white p-2 rounded shadow-sm hover:shadow-md transition-all cursor-pointer group hover:-translate-y-0.5 active:scale-95 border-l-4",
                      event.source === 'google' ? "border-slate-400" : "border-sky-600"
                    )}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <p className={cn(
                        "text-[10px] font-black uppercase tracking-tighter",
                        event.source === 'google' ? "text-slate-500" : "text-sky-600"
                      )}>{event.time}</p>
                      <ChevronRight className="w-3 h-3 text-slate-200 group-hover:text-sky-400 transition-colors" />
                    </div>
                    <p className="text-[11px] font-bold text-slate-800 leading-tight group-hover:text-sky-900 transition-colors">{event.name}</p>
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
                  <div 
                    key={idx} 
                    onClick={() => onViewSigning(event.appointment)}
                    className="flex gap-4 items-start group cursor-pointer"
                  >
                    <div className="w-20 text-right pt-1 flex flex-col items-end">
                      <span className={cn(
                        "text-sm font-black transition-colors tracking-tighter",
                        event.source === 'google' ? "text-slate-300 group-hover:text-slate-500" : "text-slate-400 group-hover:text-sky-600"
                      )}>{event.time}</span>
                      <div className="w-6 h-0.5 bg-slate-100 rounded-full mt-1 group-hover:bg-sky-200 transition-colors"></div>
                    </div>
                    <div className={cn(
                      "flex-1 bg-white border rounded-2xl p-6 transition-all group-hover:-translate-y-1 active:scale-[0.99] relative overflow-hidden",
                      event.source === 'google' ? "border-slate-200 hover:border-slate-300 shadow-sm" : "border-slate-200 hover:border-sky-300 hover:shadow-xl hover:shadow-sky-500/5 shadow-sm"
                    )}>
                      <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition-opacity">
                         <div className="w-8 h-8 rounded-full bg-sky-50 flex items-center justify-center text-sky-600">
                           <ChevronRight className="w-4 h-4" />
                         </div>
                      </div>
                      <div className="space-y-1">
                        <p className={cn(
                          "text-[10px] font-black uppercase tracking-widest",
                          event.source === 'google' ? "text-slate-400" : "text-sky-600"
                        )}>{event.appointment.signingType || 'External Event'}</p>
                        <p className="text-lg font-black text-slate-900 tracking-tight">{event.name}</p>
                      </div>
                      <div className="flex flex-wrap items-center gap-6 mt-4 pt-4 border-t border-slate-50 text-[11px] text-slate-500 font-bold uppercase tracking-widest">
                        <span className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-lg"><Clock className="w-3.5 h-3.5 text-sky-500" /> 1 hour</span>
                        <span className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-lg"><MapPin className="w-3.5 h-3.5 text-sky-500" /> {event.appointment.city || 'Location Details'}</span>
                        {event.source !== 'google' && (
                          <span className="flex items-center gap-2 bg-emerald-50 text-emerald-700 px-3 py-1.5 rounded-lg"><DollarSign className="w-3.5 h-3.5" /> ${event.appointment.fee}</span>
                        )}
                        {event.source === 'google' && (
                          <span className="flex items-center gap-2 bg-slate-100 text-slate-600 px-3 py-1.5 rounded-lg italic">View in Google Calendar</span>
                        )}
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
            <div className="flex items-center gap-2">
              <button
                onClick={syncStatus === 'disconnected' ? onConnectGoogle : undefined}
                disabled={isConnecting || syncStatus === 'syncing'}
                className={cn(
                  "px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all border",
                  syncStatus === 'connected' && "bg-emerald-50 text-emerald-700 border-emerald-200 cursor-default",
                  syncStatus === 'syncing' && "bg-blue-50 text-blue-700 border-blue-200 cursor-default",
                  syncStatus === 'error' && "bg-rose-50 text-rose-700 border-rose-200 cursor-pointer",
                  syncStatus === 'disconnected' && "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                )}
              >
                {syncStatus === 'connected' ? (
                  <><CheckCircle2 className="w-3.5 h-3.5" /> Synced with Google</>
                ) : syncStatus === 'syncing' ? (
                  <><RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-500" /> Syncing...</>
                ) : syncStatus === 'error' ? (
                  <div onClick={onConnectGoogle} className="flex items-center gap-1.5"><AlertCircle className="w-3.5 h-3.5" /> Sync Error - Reconnect</div>
                ) : (
                  <><Calendar className="w-3.5 h-3.5 text-blue-500" /> Connect Google Calendar</>
                )}
              </button>
              
              {isGoogleConnected && syncStatus !== 'syncing' && (
                <button 
                  onClick={() => onRefresh?.(startOfMonth(currentDate), endOfMonth(currentDate))}
                  className="w-8 h-8 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-50 hover:text-sky-600 transition-all shadow-sm"
                  title="Manual Sync"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              )}
            </div>
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
  onBulkUpdateCompany,
  onBulkMarkPaid,
  userId, 
  viewMode = 'journal',
  setModalInitialTab,
  setModalAutoScan,
  businessProfile
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
  onBulkUpdateCompany: (ids: string[], company: SigningCompany) => Promise<void>;
  onBulkMarkPaid: (ids: string[], data: { paidDate: string; paymentMethod: string; notes: string }) => Promise<void>;
  userId: string; 
  viewMode?: 'signings' | 'journal';
  setModalInitialTab: (tab: string) => void;
  setModalAutoScan: (scan: boolean) => void;
  businessProfile: BusinessProfile | null;
}) => {
  const [isBatchDropdownOpen, setIsBatchDropdownOpen] = useState<string | boolean>(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [searchParams] = useSearchParams();
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;

  // Bulk Add Documents state
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDocsForBulk, setSelectedDocsForBulk] = useState<string[]>([]);
  const [isBulkDocsDropdownOpen, setIsBulkDocsDropdownOpen] = useState(false);
  const [isBulkTypeDropdownOpen, setIsBulkTypeDropdownOpen] = useState(false);
  const [isCustomBulkType, setIsCustomBulkType] = useState(false);
  const [customBulkType, setCustomBulkType] = useState('');
  const [bulkSuccessMessage, setBulkSuccessMessage] = useState<string | null>(null);
  const [isBulkMarkPaidModalOpen, setIsBulkMarkPaidModalOpen] = useState(false);
  const [isBulkAssignCompanyModalOpen, setIsBulkAssignCompanyModalOpen] = useState(false);
  const [bulkMarkPaidData, setBulkMarkPaidData] = useState({
    paidDate: new Date().toISOString().split('T')[0],
    paymentMethod: 'Check',
    notes: ''
  });

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
  const [dateFilter, setDateFilter] = useState(searchParams.get('date') || 'All');
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
    const fromAppointments = appointments.map(a => a.signingCompany || a.companyName || a.clientName).filter(Boolean) as string[];
    const fromDatabase = companies.map(c => c.companyName);
    
    // Professional defaults for the industry
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

    // Search Term Filter
    if (searchTerm) {
      const lowSearch = searchTerm.toLowerCase();
      filtered = filtered.filter(a => 
        (a.customerName || '').toLowerCase().includes(lowSearch) ||
        (a.clientName || '').toLowerCase().includes(lowSearch) ||
        (a.signingType || '').toLowerCase().includes(lowSearch) ||
        (a.docType || '').toLowerCase().includes(lowSearch) ||
        (a.actType || '').toLowerCase().includes(lowSearch) ||
        (a.notes || '').toLowerCase().includes(lowSearch) ||
        (a.city || '').toLowerCase().includes(lowSearch)
      );
    }

    return filtered;
  }, [appointments, dateFilter, companyFilter, statusFilter, workTypeFilter, paymentStatusFilter, invoiceSentFilter, profitFilter, searchTerm]);

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

  // Optimized performance stats for Journal Ledger
  const journalStats = useMemo(() => {
    if (viewMode !== 'journal') return null;
    const all = filteredAppointments;
    const actCounts: Record<string, number> = {};
    all.forEach(a => {
      const act = a.actType || 'Acknowledgment';
      actCounts[act] = (actCounts[act] || 0) + 1;
    });
    const mostCommonAct = Object.entries(actCounts).sort((a,b) => b[1] - a[1])[0]?.[0] || 'N/A';
    
    // Retention logic: first entry date
    const firstEntry = appointments.length > 0 ? [...appointments].sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime())[0] : null;
    const retentionYears = firstEntry ? Math.max(1, new Date().getFullYear() - new Date(firstEntry.date).getFullYear()) : 0;

    return {
      totalEntries: all.length,
      mostCommonAct,
      retentionYears,
      totalFees: all.reduce((sum, a) => sum + (Number(a.agreedFee ?? a.fee) || 0), 0)
    };
  }, [filteredAppointments, appointments, viewMode]);

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
    // Avoid window.open which triggers popup blockers
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (doc) {
      const title = viewMode === 'journal' ? `NC Notary Journal Ledger - ${format(new Date(), 'MMMM yyyy')}` : `Signings Report - ${format(new Date(), 'MMMM yyyy')}`;
      doc.open();
      doc.write(`
        <html>
          <head>
            <title>${title}</title>
            <style>
              body { font-family: 'Inter', sans-serif; padding: 40px; color: #1e293b; background: white; }
              header { border-bottom: 2px solid #e2e8f0; padding-bottom: 20px; margin-bottom: 30px; }
              h1 { font-size: 20px; font-weight: 800; margin: 0; color: #0f172a; text-transform: uppercase; letter-spacing: 0.05em; }
              p.meta { font-size: 11px; color: #64748b; margin-top: 5px; font-weight: 600; }
              table { width: 100%; border-collapse: collapse; margin-top: 20px; }
              th, td { border-bottom: 1px solid #f1f5f9; padding: 12px 8px; text-align: left; font-size: 10px; }
              th { background-color: #f8fafc; font-weight: 800; text-transform: uppercase; color: #475569; letter-spacing: 0.025em; border-top: 1px solid #e2e8f0; }
              td { color: #334155; }
              .bold { font-weight: 700; color: #0f172a; }
              .footer { margin-top: 50px; text-align: center; font-size: 9px; color: #94a3b8; font-weight: 500; border-top: 1px solid #f1f5f9; padding-top: 20px; }
              @media print { body { padding: 0px; } }
            </style>
          </head>
          <body>
            <header>
              <h1>${title}</h1>
              <p class="meta">Official Record of Notarial Acts | Integrity Closings CLT</p>
            </header>
            <table>
              <thead>
                <tr>
                  <th>Date / Time</th>
                  <th>Principal(s)</th>
                  <th>Notarial Act</th>
                  <th>Identification</th>
                  <th>Fee</th>
                </tr>
              </thead>
              <tbody>
                ${sortedAppointments.map(app => `
                  <tr>
                    <td><span class="bold">${app.date}</span><br/>${app.time}</td>
                    <td><span class="bold">${app.customerName || app.clientName}</span><br/>${app.city || ''}</td>
                    <td>${app.actType || 'Acknowledgment'}</td>
                    <td>${app.idType || 'Document Inspection'}</td>
                    <td class="bold">$${(app.fee || 0).toFixed(2)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
            <div class="footer">Generated via NotaryPro Integrity Engine on ${new Date().toLocaleString()}</div>
          </body>
        </html>
      `);
      doc.close();
      
      setTimeout(() => {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
        setTimeout(() => {
          document.body.removeChild(iframe);
        }, 1000);
      }, 500);
    }
  };

  const handlePrintJob = (app: Appointment) => {
    // Avoid window.open which triggers popup blockers
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (doc) {
      const formattedDate = format(new Date(app.date), 'EEEE, MMMM d, yyyy');
      const rescissionDate = format(subDays(new Date(app.date), 3), 'M/d/yyyy'); // Example logic
      
      doc.open();
      doc.write(`
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
              <p>NotaryPro Professional Hub ${format(new Date(), 'yyyy')}</p>
            </div>
            
            <div class="main-info">
              <h2>${formattedDate} : ${app.time}</h2>
              <div class="rescission">Rescission Date: ${rescissionDate}</div>
            </div>
            
            <div class="details-grid">
              <div class="details-left">
                <strong>DATE:</strong><br/>
                ${formattedDate}<br/><br/>
                
                <strong>TIME:</strong><br/>
                ${app.time}<br/><br/>
                
                <strong>LOCATION:</strong><br/>
                ${app.location || 'See Notes'}<br/><br/>
                
                <strong>FEE:</strong><br/>
                $${(app.fee || 0).toFixed(2)}<br/><br/>
                
                <strong>COMPANY:</strong><br/>
                ${app.signingCompany || app.companyName || 'Direct'}
              </div>
              <div class="details-right">
                <strong>SIGNING TYPE:</strong><br/>
                ${app.signingType || 'Not Specified'}<br/><br/>
                
                <strong>ORDER #:</strong><br/>
                ${app.orderNumber || 'N/A'}<br/><br/>
                
                <strong>DOCUMENTS SIGNED:</strong><br/>
                ${(app.docs || []).join(', ') || 'General Notary Work'}<br/><br/>
                
                <strong>ID VERIFIED:</strong><br/>
                ${app.idType || 'Document Inspection'}
              </div>
            </div>
            
            <div class="notes-section">
              <span class="notes-label">NOTES / REMARKS:</span>
              <p style="white-space: pre-wrap; font-size: 14px; line-height: 1.6;">${app.notes || 'No additional notes provided for this appointment.'}</p>
            </div>
            
            <hr class="bottom-line" />
            <div style="text-align: center; margin-top: 20px; font-size: 12px; color: #94a3b8;">
              Professional Notary Service Report • Powered by NotaryPro
            </div>
          </body>
        </html>
      `);
      doc.close();
      
      setTimeout(() => {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
        setTimeout(() => {
          document.body.removeChild(iframe);
        }, 1000);
      }, 500);
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

  const handleConfirmBulkMarkPaid = async () => {
    try {
      await onBulkMarkPaid(selectedIds, bulkMarkPaidData);
      setBulkSuccessMessage(`${selectedIds.length} signings marked as Paid`);
      setTimeout(() => setBulkSuccessMessage(null), 3000);
      setIsBulkMarkPaidModalOpen(false);
      setSelectedIds([]);
      setIsSelectMode(false);
    } catch (error) {
      console.error('Error in bulk mark paid:', error);
      alert('Failed to update some signings. Please try again.');
    }
  };

  const handleExport = () => {
    const headers = [
      "Entry #", "Date", "Time", "Principal Name", "Signing Type", "Document Type", 
      "Notarial Act", "Documents Signed", "Principal Address", "ID Type", 
      "ID Number", "ID Expiration", "Fee Charged", "Signing Company", "Notes"
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
      `"${app.customerName || app.clientName || ''}"`,
      `"${app.signingType || ''}"`,
      `"${app.docType || ''}"`,
      `"${app.actType || 'Acknowledgment'}"`,
      `"${(app.docs || []).join("; ").replace(/"/g, '""')}"`,
      `"${(app.location || '').replace(/"/g, '""')}"`,
      `"${app.idType || ''}"`,
      `"${app.idNumber || ''}"`,
      `"${app.idExpiration || ''}"`,
      `"${(app.fee || 0).toFixed(2)}"`,
      `"${app.signingCompany || ''}"`,
      `"${(app.notes || '').replace(/"/g, '""').replace(/\n/g, ' ')}"`
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
              await onImport(newAppointments);
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
    const now = new Date();
    const startOfToday = startOfDay(now);
    
    const todaysSignings = activeApps.filter(a => isSameDay(parseSafeDateTime(a.date, a.time), startOfToday)).length;
    const upcomingSignings = activeApps.filter(a => isAfter(parseSafeDateTime(a.date, a.time), startOfToday)).length;
    const awaitingInvoice = activeApps.filter(a => (a.status === 'Completed' || a.status === 'Paid') && !a.invoiceSent).length;
    
    // Financials for the selected filtered period
    const grossRevenue = filteredAppointments.filter(a => a.status !== 'Cancelled' && a.status !== 'No Show').reduce((sum, a) => sum + (Number(a.agreedFee) || Number(a.fee) || 0), 0);
    const amountCollected = filteredAppointments.filter(a => a.status !== 'Cancelled' && a.status !== 'No Show').reduce((sum, a) => sum + (Number(a.amountCollected) || (a.status === 'Paid' || a.paymentStatus === 'Paid' ? (Number(a.agreedFee) || Number(a.fee) || 0) : 0) || 0), 0);
    const outstandingBalance = filteredAppointments.filter(a => a.status !== 'Cancelled' && a.status !== 'No Show').reduce((sum, a) => sum + (Number(a.amountOutstanding) || ((a.status !== 'Paid' && !a.invoicePaidDate) ? (Number(a.agreedFee) || Number(a.fee) || 0) : 0) || 0), 0);

    return {
      todaysSignings,
      upcomingSignings,
      awaitingInvoice,
      grossRevenue,
      amountCollected,
      outstandingBalance,
      count: activeApps.length
    };
  }, [filteredAppointments]);

  const groupedByDay = useMemo(() => {
    const groups: Record<string, Appointment[]> = {};
    paginatedAppointments.forEach(app => {
      const day = format(parseSafeDateTime(app.date), 'EEEE, MMMM d, yyyy');
      if (!groups[day]) groups[day] = [];
      groups[day].push(app);
    });
    return Object.entries(groups);
  }, [paginatedAppointments]);

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
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Title & Actions Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-2">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
            {viewMode === 'journal' ? (
              <>
                <ShieldCheck className="w-7 h-7 text-indigo-600" />
                NC Notary Journal
              </>
            ) : (
              <>
                <FileText className="w-7 h-7 text-indigo-600" />
                Signings
              </>
            )}
          </h1>
          <p className="text-slate-500 mt-1 max-w-xl">
            {viewMode === 'journal' 
              ? 'Official chronological record of all notarial acts. Maintained for legal compliance and professional accountability.' 
              : 'Manage your signing appointments, track workflow status, and monitor client communications.'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button 
            onClick={() => handleImport()}
            className="flex-1 lg:flex-none flex items-center justify-center gap-2 px-5 py-2.5 bg-sky-50 border border-sky-200 text-sky-700 rounded-xl text-sm font-bold hover:bg-sky-100 transition-all shadow-sm"
          >
            <Upload className="w-4 h-4" /> Import CSV
          </button>
          <button 
            onClick={() => handleExport()}
            className="flex-1 lg:flex-none flex items-center justify-center gap-2 px-5 py-2.5 bg-white border border-slate-200 text-slate-600 rounded-xl text-sm font-bold hover:bg-slate-50 hover:border-slate-300 transition-all shadow-sm"
          >
            <Download className="w-4 h-4" /> Export CSV
          </button>
          <button 
            onClick={() => handlePrint()}
            className="flex-1 lg:flex-none flex items-center justify-center gap-2 px-5 py-2.5 bg-indigo-50 border border-indigo-100 text-indigo-700 rounded-xl text-sm font-bold hover:bg-indigo-100 transition-all shadow-sm"
          >
            <Printer className="w-4 h-4" /> {viewMode === 'journal' ? 'Print Ledger' : 'Print Report'}
          </button>
          <button 
            onClick={() => {
              setModalInitialTab('Signer(s)');
              setModalAutoScan(true);
              onNewSigning();
            }}
            className="flex-1 lg:flex-none flex items-center justify-center gap-2 px-6 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100"
          >
            <Plus className="w-4 h-4" /> {viewMode === 'journal' ? 'New Journal Entry' : 'Schedule Signing'}
          </button>
        </div>
      </div>

      {/* KPIs Section */}
      {viewMode === 'journal' && journalStats ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 animate-in fade-in slide-in-from-top-4 duration-1000 delay-150">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">Total Record Capacity</p>
            <div className="flex items-end justify-between">
              <h4 className="text-2xl font-bold text-slate-900">{journalStats.totalEntries}</h4>
              <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">Entries</span>
            </div>
          </div>
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">Primary Act Type</p>
            <div className="flex items-end justify-between">
              <h4 className="text-lg font-bold text-slate-800 truncate">{journalStats.mostCommonAct}</h4>
              <FileText className="w-4 h-4 text-slate-300" />
            </div>
          </div>
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">Retention Standing</p>
            <div className="flex items-end justify-between">
              <h4 className="text-2xl font-bold text-slate-900">{journalStats.retentionYears} Years</h4>
              <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">Active</span>
            </div>
          </div>
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">Total Legally Earned</p>
            <div className="flex items-end justify-between">
              <h4 className="text-2xl font-bold text-slate-900">${journalStats.totalFees.toLocaleString()}</h4>
              <Banknote className="w-4 h-4 text-slate-300" />
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Signings ({dateFilter})</p>
            <p className="text-xl font-black text-slate-900">{stats.count}</p>
          </div>
          
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Gross Revenue</p>
            <p className="text-xl font-black text-indigo-600">${stats.grossRevenue.toLocaleString()}</p>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Collected</p>
            <p className="text-xl font-black text-emerald-600">${stats.amountCollected.toLocaleString()}</p>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Remaining Due</p>
            <p className="text-xl font-black text-rose-600">${stats.outstandingBalance.toLocaleString()}</p>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm relative overflow-hidden">
            <div className="flex items-center justify-between mb-1">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Awaiting Invoice</p>
              {stats.awaitingInvoice > 0 && <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />}
            </div>
            <p className="text-xl font-black text-amber-600">{stats.awaitingInvoice}</p>
          </div>
        </div>
      )}

      {/* Main Filter & Action Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="relative flex-1 group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
            <input 
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={viewMode === 'journal' ? "Search ledger (principal, type, act, notes)..." : "Search signings..."}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-slate-900 placeholder:text-slate-400"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1">
              <Calendar className="w-4 h-4 text-slate-400" />
              <select 
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="bg-transparent text-sm font-bold text-slate-600 outline-none pr-4 py-1.5 cursor-pointer"
              >
                <option value="All">All Time</option>
                <option value="This year">This Year</option>
                <option value="Last year">Last Year</option>
                <option value="This month">This Month</option>
                <option value="Last month">Last Month</option>
                <option value="This week">This Week</option>
                <option value="Last week">Last Week</option>
              </select>
            </div>
            
            <select 
              value={companyFilter}
              onChange={(e) => setCompanyFilter(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-600 outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all cursor-pointer"
            >
              <option value="All Companies">All Companies</option>
              {uniqueCompanies.map(c => <option key={c} value={c}>{c}</option>)}
            </select>

            <select 
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-600 outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all cursor-pointer"
            >
              <option value="All">All Status</option>
              <option value="Paid">Paid</option>
              <option value="Unpaid">Unpaid</option>
            </select>

            <button 
              onClick={() => {
                setIsSelectMode(!isSelectMode);
                if (isSelectMode) setSelectedIds([]);
              }}
              className={cn(
                "px-4 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 transition-all border shadow-sm",
                isSelectMode 
                  ? "bg-indigo-50 border-indigo-200 text-indigo-700" 
                  : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300"
              )}
            >
              <CheckCircle2 className="w-4 h-4" /> {isSelectMode ? 'Exit Select' : 'Select'}
            </button>
            
            <button 
              onClick={handleImport}
              disabled={isImporting}
              className="hidden lg:flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 text-slate-600 rounded-xl text-sm font-bold hover:bg-slate-50 shadow-sm disabled:opacity-50"
            >
              {isImporting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              {isImporting ? '...' : 'Import'}
            </button>

            <button 
              onClick={handlePrint}
              className="hidden lg:flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 text-slate-600 rounded-xl text-sm font-bold hover:bg-slate-50 shadow-sm"
            >
              <Printer className="w-4 h-4 text-indigo-500" />
              Print
            </button>
          </div>
        </div>

        {companyStats && viewMode !== 'journal' && (
          <div className="flex items-center gap-6 px-4 py-3 bg-indigo-50/30 border border-indigo-100 rounded-xl text-xs font-bold animate-in fade-in slide-in-from-left-2 transition-all">
            <div className="flex items-center gap-2">
              <span className="text-slate-400 uppercase tracking-widest text-[10px]">Company Rev:</span>
              <span className="text-slate-900">${companyStats.total.toLocaleString()}</span>
            </div>
            <div className="flex items-center gap-2 pl-6 border-l border-indigo-100/50">
              <span className="text-slate-400 uppercase tracking-widest text-[10px]">Paid:</span>
              <span className="text-emerald-600">${companyStats.paid.toLocaleString()}</span>
            </div>
            <div className="flex items-center gap-2 pl-6 border-l border-indigo-100/50">
              <span className="text-slate-400 uppercase tracking-widest text-[10px]">Outstanding:</span>
              <span className="text-amber-600">${companyStats.unpaid.toLocaleString()}</span>
            </div>
          </div>
        )}
      </div>





      {/* Bulk Action Bar */}
      {(isSelectMode || selectedIds.length > 0) && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-indigo-900 text-white p-4 rounded-2xl shadow-xl flex flex-col md:flex-row items-center justify-between gap-4 border border-indigo-800"
        >
          <div className="flex items-center gap-4">
            <span className="text-sm font-bold bg-indigo-800 px-3 py-1 rounded-full border border-indigo-700 shadow-inner">
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
                Deselect
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button 
              onClick={() => handleBatchInvoiceStatus(true)}
              className="bg-indigo-700 hover:bg-indigo-600 text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all border border-indigo-600"
            >
              Mark Invoice Sent
            </button>
            <button 
              onClick={() => setIsBulkMarkPaidModalOpen(true)}
              className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all border border-emerald-500"
            >
              <DollarSign className="w-3.5 h-3.5" /> Mark Paid
            </button>
            <button 
              onClick={() => setIsBulkAssignCompanyModalOpen(true)}
              className="bg-sky-600 hover:bg-sky-500 text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all border border-sky-500"
            >
              <Building2 className="w-3.5 h-3.5" /> Assign Company
            </button>
            <div className="w-px h-6 bg-indigo-800 mx-2 hidden md:block"></div>
            <button 
              onClick={handleDelete}
              className="bg-rose-500/20 hover:bg-rose-500 text-rose-200 hover:text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all border border-rose-500/30"
            >
              <Trash2 className="w-3.5 h-3.5" /> Delete Permanently
            </button>
            <button 
              onClick={() => {
                setIsSelectMode(false);
                setSelectedIds([]);
              }}
              className="text-indigo-300 hover:text-white px-3 py-2 text-xs font-bold transition-all ml-2"
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
          className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-slate-900 text-white px-6 py-3 rounded-2xl shadow-2xl z-[100] flex items-center gap-3 font-bold border border-slate-800"
        >
          <CheckCircle2 className="w-5 h-5 text-emerald-500" />
          {bulkSuccessMessage}
        </motion.div>
      )}

      {/* Redesigned Table Section */}
      <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[1200px]">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100">
                {isSelectMode && (
                  <th className="pl-6 py-4 w-10">
                    <input 
                      type="checkbox"
                      checked={selectedIds.length === paginatedAppointments.length && paginatedAppointments.length > 0}
                      onChange={toggleSelectAll}
                      className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    />
                  </th>
                )}
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.15em]">Signers</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.15em]">Order Details</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.15em]">Client</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.15em]">Fee</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.15em]">Doc Status</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.15em]">Appointment Address</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.15em]">Order Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginatedAppointments.length > 0 ? (
                paginatedAppointments.map((app) => (
                  <tr 
                    key={app.id} 
                    onClick={() => onViewSigning(app)}
                    className={cn(
                      "group hover:bg-slate-50/30 transition-colors cursor-pointer",
                      selectedIds.includes(app.id) && "bg-indigo-50/20"
                    )}
                  >
                    {isSelectMode && (
                      <td className="pl-6 py-5" onClick={(e) => e.stopPropagation()}>
                        <input 
                          type="checkbox" 
                          checked={selectedIds.includes(app.id)}
                          onChange={() => toggleSelect(app.id)}
                          className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 shadow-sm"
                        />
                      </td>
                    )}
                    
                    {/* Column 1: Signers */}
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-sm font-bold text-slate-900 truncate max-w-[140px]">
                          {formatDisplayName(app.customerName || app.clientName)}
                        </span>
                        {app.signers && app.signers.length > 1 && (
                          <span className="px-1.5 py-0.5 rounded-full bg-slate-100 text-[10px] font-bold text-slate-500">+{app.signers.length - 1}</span>
                        )}
                      </div>
                      <div className="text-[11px] font-medium text-slate-500 mb-2">
                        {format(parseSafeDateTime(app.date), 'MMM d, yyyy')}, {app.time}
                      </div>
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-600 border border-emerald-100/50 text-[10px] font-black uppercase tracking-wider">
                        <Phone className="w-3 h-3" /> Confirmed
                      </div>
                    </td>

                    {/* Column 2: Order Details */}
                    <td className="px-6 py-5">
                      <div className="text-sm font-bold text-slate-900 mb-0.5">
                        {app.orderNumber || app.id.slice(0, 8).toUpperCase()}
                      </div>
                      <div className="text-[11px] font-medium text-slate-500">Signing: {app.signingType || 'Mobile'}</div>
                      <div className="text-[11px] font-medium text-slate-400">Product: {app.docType || 'Other'}</div>
                    </td>

                    {/* Column 3: Client */}
                    <td className="px-6 py-5">
                      <div className="text-sm font-bold text-slate-700">
                        {app.signingCompany || app.companyName || 'Private Direct'}
                      </div>
                    </td>

                    {/* Column 4: Fee */}
                    <td className="px-6 py-5">
                      <div className="text-base font-black text-slate-900">
                        ${(Number(app.agreedFee) || Number(app.fee) || 0).toFixed(2)}
                      </div>
                    </td>

                    {/* Column 5: Doc Status */}
                    <td className="px-6 py-5">
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2 text-[11px] font-bold text-slate-600">
                          <div className="w-2.5 h-2.5 rounded-full bg-blue-500 shadow-sm shadow-blue-200" /> Not Ready
                        </div>
                        <div className="flex items-center gap-2 text-[11px] font-bold text-slate-600">
                          <div className="w-2.5 h-2.5 rounded-full bg-amber-500 shadow-sm shadow-amber-200" /> Pending Download
                        </div>
                        <div className="flex items-center gap-2 text-[11px] font-bold text-slate-600">
                          <div className={cn(
                            "w-2.5 h-2.5 rounded-full shadow-sm",
                            app.scanbackStatus === 'Not Required' ? "bg-slate-300 shadow-slate-200" : "bg-amber-500 shadow-amber-200"
                          )} /> {app.scanbackStatus === 'Not Required' ? 'Scan Not Required' : 'Scan Needed'}
                        </div>
                      </div>
                    </td>

                    {/* Column 6: Appointment Address */}
                    <td className="px-6 py-5">
                      <div className="max-w-[200px]">
                        <div 
                          onClick={(e) => {
                            e.stopPropagation();
                            if (app.location && app.location !== 'TBD') {
                              window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${app.address}, ${app.city}, ${app.state} ${app.zip}`)}`, '_blank');
                            }
                          }}
                          className="cursor-pointer group/address"
                        >
                          <div className="text-sm font-bold text-sky-600 group-hover/address:text-indigo-600 transition-colors capitalize transition-all underline decoration-sky-200 underline-offset-4 group-hover/address:decoration-indigo-200">
                            {(app.address || '').toLowerCase()}
                          </div>
                          <div className="text-[11px] font-bold text-slate-400 group-hover/address:text-indigo-400 flex items-center gap-2 transition-all mt-0.5">
                            {app.city ? `${app.city.toLowerCase()} ${app.state ? app.state.toUpperCase() : ''} ${app.zip || ''}` : 'Location TBD'}
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                navigator.clipboard.writeText(`${app.address}, ${app.city}, ${app.state} ${app.zip}`);
                              }}
                              className="p-1 hover:bg-sky-50 rounded-md transition-all text-slate-400 hover:text-sky-600 ml-auto opacity-0 group-hover/address:opacity-100"
                            >
                              <Copy className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Column 7: Order Status */}
                    <td className="px-6 py-5">
                      <div className={cn(
                        "inline-flex px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-[0.1em] border",
                        app.status === 'Scheduled' ? "bg-amber-100 text-amber-700 border-amber-200" :
                        app.status === 'Completed' ? "bg-indigo-50 text-indigo-600 border-indigo-100" :
                        app.status === 'Paid' ? "bg-emerald-50 text-emerald-600 border-emerald-100" :
                        "bg-slate-100 text-slate-600 border-slate-200"
                      )}>
                        {app.status === 'Scheduled' ? 'Pending' : 
                         app.status === 'Completed' ? 'Closed' : 
                         app.status}
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={9} className="py-24 text-center">
                    <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Calendar className="w-8 h-8 text-slate-200" />
                    </div>
                    <h3 className="text-lg font-bold text-slate-900">No matching signings</h3>
                    <p className="text-slate-500 max-w-xs mx-auto text-sm mt-1">
                      Try adjusting your filters or search terms to find what you're looking for.
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modern Pagination Section */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between py-6 border-t border-slate-100">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
            Page {currentPage} of {totalPages}
          </p>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className="p-2 rounded-xl border border-slate-200 bg-white text-slate-600 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-50"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button 
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
              className="p-2 rounded-xl border border-slate-200 bg-white text-slate-600 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-50"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      <BulkMarkPaidModal 
        isOpen={isBulkMarkPaidModalOpen}
        onClose={() => setIsBulkMarkPaidModalOpen(false)}
        onConfirm={handleConfirmBulkMarkPaid}
        count={selectedIds.length}
        currentData={bulkMarkPaidData}
        onChange={setBulkMarkPaidData}
      />

      <BulkAssignCompanyModal
        isOpen={isBulkAssignCompanyModalOpen}
        onClose={() => setIsBulkAssignCompanyModalOpen(false)}
        onConfirm={async (company) => {
          setIsBulkAssignCompanyModalOpen(false);
          await onBulkUpdateCompany(selectedIds, company);
          setSelectedIds([]);
          setIsSelectMode(false);
        }}
        count={selectedIds.length}
        companies={companies}
      />
    </div>
  );
};

const Customers = ({ customers, onNewCustomer, onEditCustomer, onDeleteCustomer }: { customers: Customer[]; onNewCustomer: () => void; onEditCustomer: (c: Customer) => void; onDeleteCustomer: (id: string) => void }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<CustomerType | 'All'>('All');
  const [emailModalCustomer, setEmailModalCustomer] = useState<Customer | null>(null);

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
          <option value="Loan Officer">Loan Officer</option>
          <option value="Closing Attorney">Closing Attorney</option>
          <option value="Title Processor">Title Processor</option>
          <option value="Realtor">Realtor</option>
          <option value="Estate Attorney">Estate Attorney</option>
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
                  onClick={() => setEmailModalCustomer(customer)}
                  className="flex items-center gap-2 bg-blue-600 text-white px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-blue-700 transition-colors shadow-sm"
                >
                  <Mail className="w-3.5 h-3.5" />
                  Send Email
                </button>
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

      {emailModalCustomer && (
        <EmailModal
          customer={emailModalCustomer}
          onClose={() => setEmailModalCustomer(null)}
        />
      )}
    </div>
  );
};

const Accounting = ({ appointments, expenses, onNewExpense, onDeleteExpense }: { appointments: Appointment[]; expenses: Expense[]; onNewExpense: () => void; onDeleteExpense: (id: string) => void }) => {
  const totalIncome = appointments
    .filter(a => a.status === 'Completed' || a.status === 'Paid')
    .reduce((sum, a) => sum + Number(a.agreedFee ?? a.fee ?? 0), 0);
  const totalExpenses = expenses.reduce((sum, e) => sum + Number(e.amount), 0);
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
  const [searchParams] = useSearchParams();
  const isPlatformDemo = window.location.hostname.includes('ais-pre');
  const showDemoOptions = searchParams.get('demo') === 'true';

  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isNewSigningModalOpen, setIsNewSigningModalOpen] = useState(false);
  const [isNewJournalModalOpen, setIsNewJournalModalOpen] = useState(false);
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
  const [googleEvents, setGoogleEvents] = useState<any[]>([]);
  const [googleSyncStatus, setGoogleSyncStatus] = useState<'connected' | 'disconnected' | 'error' | 'syncing'>('disconnected');
  const lastGoogleFetchRef = useRef<string | null>(null);
  const lastGoogleFetchTimeRef = useRef<number>(0);
  const lastAnyCalendarRequestTimeRef = useRef<number>(0);
  const lastTokensRef = useRef<any>(null);
  const isFetchingGoogleRef = useRef(false);

  const handleConnectGoogle = async () => {
    if (!user) {
      alert("Please sign in first");
      return;
    }
    
    setIsConnecting(true);
    try {
      const response = await fetch(`/api/auth/google?uid=${user.uid}`);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to get authentication URL");
      }
      
      const { url } = await response.json();
      
      const width = 600;
      const height = 700;
      const left = window.screen.width / 2 - width / 2;
      const top = window.screen.height / 2 - height / 2;
      
      const authWindow = window.open(
        url,
        "GoogleCalendarAuth",
        `width=${width},height=${height},left=${left},top=${top}`
      );
      
      // Fallback if window.open fails (popups blocked)
      if (!authWindow) {
        setIsConnecting(false);
        alert("Popup blocked. Please allow popups and try again.");
      }
    } catch (error) {
      console.error("Connection error:", error);
      alert(error instanceof Error ? error.message : "Failed to connect to Google Calendar");
      setIsConnecting(false);
    }
  };

  const reliableFetch = async (url: string, options: RequestInit = {}, retries = 2, backoff = 1000): Promise<Response> => {
    try {
      const response = await fetch(url, options);
      
      // If it's a quota error, we don't retry immediately, we bubble it up to trigger backoff
      if (response.status === 429) {
        return response;
      }
      
      // Retry for server errors (5xx) or specific transient errors
      if (!response.ok && response.status >= 500 && retries > 0) {
        console.warn(`[Network] Fetch failed with ${response.status}. Retrying in ${backoff}ms... (${retries} attempts left)`);
        await new Promise(resolve => setTimeout(resolve, backoff));
        return reliableFetch(url, options, retries - 1, backoff * 2);
      }
      
      return response;
    } catch (error) {
      if (retries > 0) {
        console.warn(`[Network] Fetch error: ${error instanceof Error ? error.message : 'Unknown'}. Retrying...`);
        await new Promise(resolve => setTimeout(resolve, backoff));
        return reliableFetch(url, options, retries - 1, backoff * 2);
      }
      throw error;
    }
  };

  const fetchGoogleCalendarEvents = async (timeMin?: string, timeMax?: string, explicitTokens?: any, force?: boolean) => {
    if (!user || isDemoUser || !businessProfile.googleCalendarConnected) return;
    
    // Check global backoff (now 5 minutes for quota issues)
    const QUOTA_BACKOFF_MS = 300000;
    if (lastGoogleFetchRef.current === 'QUOTA_BACKOFF') {
      const remaining = QUOTA_BACKOFF_MS - (Date.now() - lastGoogleFetchTimeRef.current);
      if (remaining > 0) {
        console.log(`[Calendar Sync] Skipping fetch due to active quota backoff (${Math.ceil(remaining/1000)}s left)`);
        return;
      } else {
        lastGoogleFetchRef.current = null;
      }
    }

    // Gap check: Ensure at least 3 seconds between any calendar API requests
    const GAP_MS = 3000;
    const timeSinceLastRequest = Date.now() - lastAnyCalendarRequestTimeRef.current;
    if (timeSinceLastRequest < GAP_MS) {
      console.log(`[Calendar Sync] Throttling request to maintain gap (${GAP_MS - timeSinceLastRequest}ms wait)`);
      if (!force) return; // Only wait and continue if forced, otherwise skip
      await new Promise(resolve => setTimeout(resolve, GAP_MS - timeSinceLastRequest));
    }

    const tMin = timeMin || startOfMonth(new Date()).toISOString();
    const tMax = timeMax || endOfMonth(new Date()).toISOString();
    
    // Use the latest known tokens to avoid redundant refreshes
    const tokens = explicitTokens || lastTokensRef.current || businessProfile.googleCalendarTokens;
    lastTokensRef.current = tokens;
    
    // Create a unique key for this request to detect redundant calls (Time range based)
    const fetchKey = `${tMin}|${tMax}`;
    const now = Date.now();
    
    // Throttle: don't fetch if same range was fetched in the last 30 seconds, unless forced
    // Even if forced, don't allow more than once every 5 seconds to prevent hammer
    const MIN_FETCH_INTERVAL = force ? 5000 : 30000;
    if (isFetchingGoogleRef.current || (lastGoogleFetchRef.current === fetchKey && now - lastGoogleFetchTimeRef.current < MIN_FETCH_INTERVAL)) {
      console.log('[Calendar Sync] Skipping redundant or excessive fetch request');
      return;
    }

    isFetchingGoogleRef.current = true;
    lastAnyCalendarRequestTimeRef.current = Date.now();
    setGoogleSyncStatus('syncing');
    
    try {
      const queryParams = new URLSearchParams({
        uid: user.uid,
        timeMin: tMin,
        timeMax: tMax
      });
      
      if (tokens) {
        queryParams.append('tokens', typeof tokens === 'string' ? tokens : JSON.stringify(tokens));
      }

      const response = await reliableFetch(`/api/calendar/events?${queryParams.toString()}`);
      
      const text = await response.text();
      let result: any;
      try {
        result = JSON.parse(text);
      } catch (e) {
        if (!response.ok) {
          throw new Error(`Server returned error ${response.status}: ${text.substring(0, 100)}`);
        }
        throw new Error(`Invalid JSON response from server: ${text.substring(0, 100)}`);
      }
      
      if (!response.ok) {
        const isQuotaError = response.status === 429 || 
                            (response.status === 403 && (
                              (result.error && typeof result.error === 'string' && result.error.toLowerCase().includes('quota')) || 
                              (result.details && typeof result.details === 'string' && result.details.toLowerCase().includes('quota')) ||
                              (JSON.stringify(result).toLowerCase().includes('quota'))
                            ));
        
        if (isQuotaError) {
          setGoogleSyncStatus('error');
          console.error('Google Calendar Quota Exceeded. Entering 5m backoff.');
          lastGoogleFetchRef.current = 'QUOTA_BACKOFF';
          lastGoogleFetchTimeRef.current = Date.now();
          return;
        }
        if (response.status === 401) {
          setGoogleSyncStatus('disconnected');
          if (user?.uid) {
            updateDoc(doc(db, 'profiles', user.uid), {
              googleCalendarConnected: false,
              googleSyncEnabled: false,
              updatedAt: new Date().toISOString()
            }).catch(e => console.error('Error clearing connection state:', e));
          }
          return;
        }
        throw new Error(result.error || result.details || 'Failed to fetch Google Calendar events');
      }

      setGoogleEvents(result.events || []);
      setGoogleSyncStatus('connected');
      lastGoogleFetchRef.current = fetchKey;
      lastGoogleFetchTimeRef.current = Date.now();
      
      // Update tokens if they were refreshed
      if (result.tokens) {
        lastTokensRef.current = result.tokens;
        if (JSON.stringify(result.tokens) !== JSON.stringify(businessProfile.googleCalendarTokens)) {
          console.log('[Calendar Sync] Saving refreshed tokens from fetch...');
          await updateDoc(doc(db, 'profiles', user.uid), {
            googleCalendarTokens: result.tokens,
            updatedAt: new Date().toISOString()
          });
        }
      }
    } catch (error: any) {
      console.error('Error fetching Google Calendar events:', error);
      setGoogleSyncStatus('error');
    } finally {
      isFetchingGoogleRef.current = false;
    }
  };

  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [companies, setCompanies] = useState<SigningCompany[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [mileage, setMileage] = useState<Mileage[]>([]);
  const [businessProfile, setBusinessProfile] = useState<BusinessProfile>(MOCK_PROFILE);

  // Auth listener
  useEffect(() => {
    if (isPlatformDemo) {
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
           // After connecting, fetch events immediately
           fetchGoogleCalendarEvents(undefined, undefined, event.data.tokens);
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
      console.log(`[Snap] Appointments update received: ${snapshot.size} docs. IDs: ${snapshot.docs.map((d: any) => d.id).join(', ')}`);
      const apps = snapshot.docs.map((doc: any) => {
         const data = doc.data();
         return { ...data, id: doc.id } as Appointment;
      });
      setAppointments(apps);
    }, (error: any) => {
      console.error('[Snap Error] appointments:', error.code, error.message);
      handleFirestoreError(error, OperationType.LIST, 'appointments');
    });

    const qCustomers = query(collection(db, 'customers'), where('userId', '==', user.uid));
    const unsubCustomers = onSnapshot(qCustomers, (snapshot: any) => {
      console.log(`[Snap] Customers update received: ${snapshot.size} docs`);
      setCustomers(snapshot.docs.map((doc: any) => ({ ...doc.data(), id: doc.id } as Customer)));
    }, (error: any) => {
      console.error('[Snap Error] customers:', error.code, error.message);
      handleFirestoreError(error, OperationType.LIST, 'customers');
    });

    const qCompanies = query(collection(db, 'signingCompanies'), where('userId', '==', user.uid));
    const unsubCompanies = onSnapshot(qCompanies, (snapshot: any) => {
      console.log(`[Snap] Companies update received: ${snapshot.size} docs`);
      setCompanies(snapshot.docs.map((doc: any) => ({ ...doc.data(), id: doc.id } as SigningCompany)));
    }, (error: any) => {
      console.error('[Snap Error] signingCompanies:', error.code, error.message);
      handleFirestoreError(error, OperationType.LIST, 'signingCompanies');
    });

    const qExpenses = query(collection(db, 'expenses'), where('userId', '==', user.uid));
    const unsubExpenses = onSnapshot(qExpenses, (snapshot: any) => {
      console.log(`[Snap] Expenses update received: ${snapshot.size} docs`);
      setExpenses(snapshot.docs.map((doc: any) => ({ ...doc.data(), id: doc.id } as Expense)));
    }, (error: any) => {
      console.error('[Snap Error] expenses:', error.code, error.message);
      handleFirestoreError(error, OperationType.LIST, 'expenses');
    });

    const qMileage = query(collection(db, 'mileage'), where('userId', '==', user.uid));
    const unsubMileage = onSnapshot(qMileage, (snapshot: any) => {
      console.log(`[Snap] Mileage update received: ${snapshot.size} docs`);
      setMileage(snapshot.docs.map((doc: any) => ({ ...doc.data(), id: doc.id } as Mileage)));
    }, (error: any) => {
      console.error('[Snap Error] mileage:', error.code, error.message);
      handleFirestoreError(error, OperationType.LIST, 'mileage');
    });

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

  // Initial fetch of Google Calendar events
  useEffect(() => {
    // Only fetch if we have a real user, a connected profile, and we've verified it's the real profile doc
    if (user && !isDemoUser && businessProfile.googleCalendarConnected && businessProfile.userId === user.uid) {
      // Don't depend on tokens here to avoid infinite loops from token refresh
      fetchGoogleCalendarEvents();
    }
  }, [user, isDemoUser, businessProfile.googleCalendarConnected, businessProfile.userId]);

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

  const handleBulkUpdateCompany = async (ids: string[], company: SigningCompany) => {
    if (isDemoUser || !user) {
      const updated = appointments.map(app => {
        if (ids.includes(app.id)) {
          return { 
            ...app, 
            companyId: company.id, 
            companyName: company.companyName, 
            signingCompany: company.companyName 
          };
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
          companyId: company.id,
          companyName: company.companyName,
          signingCompany: company.companyName
        }))
      );
      await Promise.all(promises);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `appointments/bulk-company`);
    }
  };

  const handleBulkMarkPaid = async (ids: string[], data: { paidDate: string; paymentMethod: string; notes: string }) => {
    if (ids.length === 0) return;
    
    if (isDemoUser || !user) {
      const updated = appointments.map(app => {
        if (ids.includes(app.id)) {
          const agreed = app.agreedFee || app.fee || 0;
          return { 
            ...app, 
            status: 'Paid' as any,
            paymentStatus: 'Paid' as any,
            amountCollected: agreed,
            amountOutstanding: 0,
            paymentReceivedDate: data.paidDate,
            paymentMethod: data.paymentMethod,
            notesBilling: app.notesBilling ? `${app.notesBilling}\n${data.notes}` : data.notes
          };
        }
        return app;
      });
      setAppointments(updated);
      return;
    }

    try {
      const promises = ids.map(id => {
        const app = appointments.find(a => a.id === id);
        if (!app) return Promise.resolve();
        
        const agreed = app.agreedFee || app.fee || 0;
        const updates: any = {
          status: 'Paid',
          paymentStatus: 'Paid',
          amountCollected: agreed,
          amountOutstanding: 0,
          paymentReceivedDate: data.paidDate,
          paymentMethod: data.paymentMethod,
          updatedAt: new Date().toISOString()
        };
        
        if (data.notes) {
          updates.notesBilling = app.notesBilling ? `${app.notesBilling}\n${data.notes}` : data.notes;
        }

        return updateDoc(doc(db, 'appointments', id), sanitizeData(updates));
      });
      await Promise.all(promises);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `appointments/bulk-mark-paid`);
      throw error;
    }
  };

  const syncToGoogleCalendar = async (appointmentId: string, action: 'create' | 'update' | 'delete', eventId?: string, appData?: any) => {
    if (!user || isDemoUser) return;
    
    // Check global backoff (5 minutes)
    const QUOTA_BACKOFF_MS = 300000;
    if (lastGoogleFetchRef.current === 'QUOTA_BACKOFF') {
      const remaining = QUOTA_BACKOFF_MS - (Date.now() - lastGoogleFetchTimeRef.current);
      if (remaining > 0) {
        console.log(`[Calendar Sync] Skipping sync due to active quota backoff (${Math.ceil(remaining/1000)}s left)`);
        return;
      } else {
        lastGoogleFetchRef.current = null;
      }
    }

    // Gap check: Ensure at least 3 seconds between any calendar API requests
    const GAP_MS = 3000;
    const timeSinceLastRequest = Date.now() - lastAnyCalendarRequestTimeRef.current;
    if (timeSinceLastRequest < GAP_MS) {
      console.log(`[Calendar Sync] Throttling sync request to maintain gap (${GAP_MS - timeSinceLastRequest}ms wait)`);
      await new Promise(resolve => setTimeout(resolve, GAP_MS - timeSinceLastRequest));
    }

    lastAnyCalendarRequestTimeRef.current = Date.now();
    console.log(`[Calendar Sync] Requesting ${action} for ID: ${appointmentId}`);
    try {
      const tokens = lastTokensRef.current || businessProfile.googleCalendarTokens;
      const response = await reliableFetch('/api/calendar/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          appointmentId,
          uid: user.uid,
          action,
          eventId,
          appointmentData: appData,
          googleCalendarId: businessProfile.googleCalendarId,
          googleCalendarTokens: tokens
        })
      });
      
      const text = await response.text();
      let result: any;
      try {
        result = JSON.parse(text);
      } catch (e) {
        if (!response.ok) {
          throw new Error(`Calendar sync server error ${response.status}: ${text.substring(0, 100)}`);
        }
        throw new Error(`Invalid JSON response from sync API: ${text.substring(0, 100)}`);
      }

      if (!response.ok) {
        const isQuotaError = response.status === 429 || 
                            (response.status === 403 && (
                               JSON.stringify(result).toLowerCase().includes('quota')
                            ));
        
        if (isQuotaError) {
          setGoogleSyncStatus('error');
          console.error('Google Calendar Quota Exceeded during sync. Entering 5m backoff.');
          lastGoogleFetchRef.current = 'QUOTA_BACKOFF';
          lastGoogleFetchTimeRef.current = Date.now();
          return;
        }

        console.error('[Calendar Sync] Failed:', result.details || result.error || 'Unknown error');
      } else {
        console.log('[Calendar Sync] Success:', result.status);
        if (result.newTokensData) {
            lastTokensRef.current = result.newTokensData;
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
      // Deduplication strategy: if this seems to be a new customer (ID matches the random pattern)
      // but email or phone matches an existing record, we should merge or use the existing one.
      // However, if we're editing an existing customer (from the list), we should skip this check.
      
      const isNewCustomer = !customers.some(c => c.id === customer.id);
      
      if (isNewCustomer) {
        const existing = await findExistingCustomer(user.uid, customer.email, customer.phone);
        if (existing) {
          console.log(`[Customer Service] Deduplication matched existing customer: ${existing.id}`);
          // Update existing with new data while retaining ID and createdAt
          const updatedCustomer = {
            ...existing,
            ...customer,
            id: existing.id,
            createdAt: existing.createdAt,
            updatedAt: new Date().toISOString()
          };
          const customerData = sanitizeData({ ...updatedCustomer, userId: user.uid });
          await setDoc(doc(db, 'customers', existing.id), customerData);
          return;
        }
      }

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
      console.log('[Import] Demo user detected, saving to demo storage');
      const current = demoStorage.getAppointments();
      const updated = [...current, ...newApps];
      demoStorage.saveAppointments(updated);
      setAppointments(updated);
      return;
    }

    try {
      console.log(`[Import] Attempting to import ${newApps.length} signings to Firestore for user: ${user.uid}`);
      const batch = writeBatch(db);
      newApps.forEach(app => {
        // Ensure every app has a userId and is sanitized
        const appData = sanitizeData({ 
          ...app, 
          userId: user.uid,
          sortableDateTime: app.sortableDateTime || parseSafeDateTime(app.date, app.time).toISOString()
        });
        
        const docRef = doc(db, 'appointments', app.id);
        console.log(`[Import] Adding to batch: ${app.id} (${app.clientName || app.customerName})`);
        batch.set(docRef, appData);
      });
      
      await batch.commit();
      console.log('[Import] Batch commit successful');
    } catch (error) {
      console.error('[Import Error]:', error);
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

  const isAuthenticated = (isPlatformDemo || isDemoUser) ? true : !!user;

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
        onNewJournalEntry={() => setIsNewJournalModalOpen(true)}
        onNewExpense={() => setIsNewExpenseModalOpen(true)}
        onExpenseTypes={() => setIsExpenseTypesModalOpen(true)}
        onRecurringExpense={() => setIsRecurringExpenseModalOpen(true)}
        onNewMileage={() => setIsNewMileageModalOpen(true)}
        user={user}
        onSignIn={handleSignIn}
        onSignOut={handleSignOut}
        isPlatformDemo={isPlatformDemo}
      />
      
      <div className={cn(
        "transition-all duration-300 ease-in-out min-h-screen flex flex-col",
        isSidebarOpen ? "lg:pl-[280px]" : "lg:pl-[80px]"
      )}>
        <Header 
          toggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)} 
          onNewSigning={() => {
            setSelectedAppointment(null);
            setModalInitialTab('Signer(s)');
            if (location.pathname.startsWith('/journal')) {
              setIsNewJournalModalOpen(true);
            } else {
              setIsNewSigningModalOpen(true);
            }
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
                    setModalInitialTab('Signer(s)');
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
                  onBulkUpdateCompany={handleBulkUpdateCompany}
                  onBulkMarkPaid={handleBulkMarkPaid}
                  userId={user?.uid || 'mock-user'}
                  setModalInitialTab={setModalInitialTab}
                  setModalAutoScan={setModalAutoScan}
                  businessProfile={businessProfile}
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
                    setModalInitialTab('Signer(s)');
                    setModalAutoScan(false);
                    setIsNewJournalModalOpen(true);
                  }} 
                  onNewSigningWithScan={() => {
                    setSelectedAppointment(null);
                    setModalInitialTab('Signer(s)');
                    setModalAutoScan(true);
                    setIsNewJournalModalOpen(true);
                  }}
                  onViewSigning={(app, tab = 'Signer(s)') => {
                    setSelectedAppointment(app);
                    setModalInitialTab(tab);
                    setModalAutoScan(false);
                    setIsNewJournalModalOpen(true);
                  }}
                  onDelete={handleDeleteAppointments}
                  onImport={handleImport}
                  onUpdate={handleSaveAppointment}
                  onBulkUpdateDocs={handleBulkUpdateDocs}
                  onBulkUpdateInvoiceStatus={handleBulkUpdateInvoiceStatus}
                  onBulkUpdateSigningType={handleBulkUpdateSigningType}
                  onBulkUpdateCompany={handleBulkUpdateCompany}
                  onBulkMarkPaid={handleBulkMarkPaid}
                  userId={user?.uid || 'mock-user'}
                  setModalInitialTab={setModalInitialTab}
                  setModalAutoScan={setModalAutoScan}
                  businessProfile={businessProfile}
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
                googleEvents={googleEvents}
                syncStatus={googleSyncStatus}
                onRefresh={(start, end) => fetchGoogleCalendarEvents(start.toISOString(), end.toISOString(), undefined, true)}
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
            <Route path="/marketing" element={<MarketingView />} />
            <Route path="/newsletter" element={<Newsletter />} />
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
                throw error;
              }
            }}
            userId={user?.uid || 'mock-user'}
            customers={customers}
            appointments={appointments}
            companies={companies}
            onSaveCompany={handleSaveCompany}
            businessProfile={businessProfile}
          />
        )}

        {isNewJournalModalOpen && (
          <NewJournalEntryModal 
            isOpen={isNewJournalModalOpen} 
            onClose={() => {
              setIsNewJournalModalOpen(false);
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
                setIsNewJournalModalOpen(false);
                setSelectedAppointment(null);
                setModalInitialTab('Signer(s)');
              } catch (error) {
                console.error('Caught error in NewJournalEntryModal onSave:', error);
                throw error;
              }
            }}
            userId={user?.uid || 'mock-user'}
            customers={customers}
            appointments={appointments}
            companies={companies}
            onSaveCompany={handleSaveCompany}
            businessProfile={businessProfile}
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
    <Routes>
      <Route path="/features" element={<LandingPage />} />
      
      <Route path="/login" element={
        isAuthenticated ? (
          <Navigate to="/" replace />
        ) : (
          (isPlatformDemo || showDemoOptions) ? (
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
  );
}

const BulkMarkPaidModal = ({ isOpen, onClose, onConfirm, count, currentData, onChange }: { 
  isOpen: boolean; 
  onClose: () => void; 
  onConfirm: () => void; 
  count: number;
  currentData: { paidDate: string; paymentMethod: string; notes: string };
  onChange: (data: any) => void;
}) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[110] flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden"
      >
        <div className="bg-emerald-600 p-6 text-white text-center">
          <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <DollarSign className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-xl font-black uppercase tracking-tight">Bulk Mark Paid</h2>
          <p className="text-emerald-100 text-sm mt-1">{count} signings selected for payment</p>
        </div>
        
        <div className="p-8 space-y-6">
          <div className="space-y-4">
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">Payment Date</label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input 
                  type="date" 
                  value={currentData.paidDate}
                  onChange={(e) => onChange({ ...currentData, paidDate: e.target.value })}
                  className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-bold"
                />
              </div>
            </div>
            
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">Payment Method</label>
              <select 
                value={currentData.paymentMethod}
                onChange={(e) => onChange({ ...currentData, paymentMethod: e.target.value })}
                className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all bg-white font-bold"
              >
                <option>Check</option>
                <option>Direct Deposit / ACH</option>
                <option>Zelle</option>
                <option>Venmo</option>
                <option>Cash</option>
                <option>Credit Card</option>
                <option>Snapdocs Pay</option>
              </select>
            </div>
            
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">Payment Notes (optional)</label>
              <textarea 
                value={currentData.notes}
                onChange={(e) => onChange({ ...currentData, notes: e.target.value })}
                placeholder="Bulk payment reference..."
                className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all h-24 resize-none"
              />
            </div>
          </div>
          
          <div className="flex gap-4 pt-4">
            <button 
              onClick={onClose}
              className="flex-1 py-3 px-4 border border-slate-200 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-50 transition-all"
            >
              Cancel
            </button>
            <button 
              onClick={onConfirm}
              className="flex-1 py-3 px-4 bg-emerald-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-emerald-200 hover:bg-emerald-700 active:scale-95 transition-all"
            >
              Confirm Payment
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

const BulkAssignCompanyModal = ({ 
  isOpen, 
  onClose, 
  onConfirm, 
  count, 
  companies 
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  onConfirm: (company: SigningCompany) => void; 
  count: number;
  companies: SigningCompany[];
}) => {
  const [selectedCompanyId, setSelectedCompanyId] = useState('');
  
  if (!isOpen) return null;

  const handleConfirm = () => {
    const company = companies.find(c => c.id === selectedCompanyId);
    if (company) {
      onConfirm(company);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[110] flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden"
      >
        <div className="bg-sky-600 p-6 text-white text-center">
          <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <Building2 className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-xl font-black uppercase tracking-tight">Assign Company</h2>
          <p className="text-sky-100 text-sm mt-1">Assigning company to {count} signings</p>
        </div>
        
        <div className="p-8 space-y-6">
          <div className="space-y-4">
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">Select Signing Company</label>
              <select 
                value={selectedCompanyId}
                onChange={(e) => setSelectedCompanyId(e.target.value)}
                className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all bg-white font-bold"
              >
                <option value="">Choose a company...</option>
                {[...(companies || [])].sort((a, b) => a.companyName.localeCompare(b.companyName)).map(c => (
                  <option key={c.id} value={c.id}>{c.companyName}</option>
                ))}
              </select>
            </div>
            <p className="text-xs text-slate-500 bg-slate-50 p-3 rounded-lg border border-slate-100">
              <AlertCircle className="w-3 h-3 inline mr-1 -mt-0.5 text-amber-500" />
              This will overwrite any existing company assignments for the selected signings.
            </p>
          </div>
          
          <div className="flex gap-4 pt-4">
            <button 
              onClick={onClose}
              className="flex-1 py-3 px-4 border border-slate-200 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-50 transition-all"
            >
              Cancel
            </button>
            <button 
              onClick={handleConfirm}
              disabled={!selectedCompanyId}
              className="flex-1 py-3 px-4 bg-sky-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-sky-200 hover:bg-sky-700 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Confirm Assignment
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
