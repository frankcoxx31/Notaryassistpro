import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, Edit2, MapPin, User, Calendar, Clock, 
  HelpCircle, CheckCircle2, Phone, Banknote, 
  List, Pencil, Plus, Trash2, Camera, Loader2, AlertCircle,
  Car, TrendingUp, PlusCircle
} from 'lucide-react';
import { format, parse } from 'date-fns';
import { Appointment, AppointmentStatus, Customer, SigningCompany, Signer } from '../types';
import { cn } from '../lib/utils';
import { GoogleGenAI, Type } from "@google/genai";
import SigningCompanyModal from './SigningCompanyModal';

import { HYBRID_LOAN_PACKAGE, PACKAGE_CONFIGS, mergeUniqueDocuments, validateDocuments, normalizeDocName } from '../lib/packageConfigs';

interface NewSigningModalProps {
  isOpen: boolean;
  onClose: () => void;
  appointment?: Appointment | null;
  onSave: (app: Appointment) => void;
  initialTab?: string;
  userId: string;
  customers: Customer[];
  appointments: Appointment[];
  companies: SigningCompany[];
  onSaveCompany: (company: SigningCompany) => void;
}

const DEFAULT_MILEAGE_RATE = 0.725;

const NewSigningModal = ({ 
  isOpen, 
  onClose, 
  appointment, 
  onSave, 
  initialTab = 'Signer(s)',
  userId,
  customers,
  appointments,
  companies,
  onSaveCompany
}: NewSigningModalProps) => {
  const [activeTab, setActiveTab] = useState(initialTab);
  const [formData, setFormData] = useState<Partial<Appointment>>({});
  const [customDoc, setCustomDoc] = useState('');
  const [showDocError, setShowDocError] = useState(false);
  const [isNewCompanyModalOpen, setIsNewCompanyModalOpen] = useState(false);
  const [editingSignerId, setEditingSignerId] = useState<string | null>(null);
  const [isCustomType, setIsCustomType] = useState(false);
  const [customType, setCustomType] = useState('');
  
  // Scanner state
  const [isScanning, setIsScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [scanSuccess, setScanSuccess] = useState(false);
  const [hybridDocsLoaded, setHybridDocsLoaded] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const formatDateForInput = (dateStr: string) => {
    if (!dateStr) return "";
    // Try to parse MM/DD/YYYY
    try {
      const parsedDate = parse(dateStr, 'MM/dd/yyyy', new Date());
      if (!isNaN(parsedDate.getTime())) {
        return format(parsedDate, 'yyyy-MM-dd');
      }
    } catch (e) {
      console.error("Error parsing date:", dateStr, e);
    }
    return dateStr;
  };

  const updateSignerSummary = (signers: Signer[]) => {
    if (!signers || signers.length === 0) return "";
    return signers.map(s => `${s.firstName} ${s.lastName}`.trim()).filter(Boolean).join(", ");
  };

  const handleScanLicense = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setScanError("Please select a valid image file of your driver's license.");
      return;
    }

    setIsScanning(true);
    setScanError(null);
    setScanSuccess(false);

    try {
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve) => {
        reader.onload = () => {
          const base64 = (reader.result as string).split(',')[1];
          resolve(base64);
        };
      });
      reader.readAsDataURL(file);
      const base64Data = await base64Promise;

      const apiKey = import.meta.env.GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error("Gemini API key is missing. Please set GEMINI_API_KEY in your environment variables/secrets via the Secrets panel.");
      }

      const ai = new GoogleGenAI({ apiKey });
      
      const prompt = `Extract the following information from this driver's license image and return it as a JSON object with these exact keys:
{
  "fullName": (full legal name as printed),
  "address": (full address including city, state, zip),
  "idNumber": (license number),
  "dateOfBirth": (format MM/DD/YYYY),
  "issueDate": (format MM/DD/YYYY),
  "expirationDate": (format MM/DD/YYYY),
  "state": (issuing state, 2-letter abbreviation)
}
Return only the JSON object, no additional text.`;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [
          {
            parts: [
              { inlineData: { mimeType: file.type, data: base64Data } },
              { text: prompt }
            ]
          }
        ],
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              fullName: { type: Type.STRING },
              address: { type: Type.STRING },
              idNumber: { type: Type.STRING },
              dateOfBirth: { type: Type.STRING },
              issueDate: { type: Type.STRING },
              expirationDate: { type: Type.STRING },
              state: { type: Type.STRING }
            },
            required: ["fullName", "address", "idNumber", "dateOfBirth", "issueDate", "expirationDate", "state"]
          }
        }
      });

      const result = JSON.parse(response.text || "{}");
      
      if (result.fullName) {
        // Parse address to extract city, state, zip if possible
        const addrParts = result.address.split(',').map((p: string) => p.trim());
        let city = "";
        let state = result.state || "";
        let zip = "";
        
        if (addrParts.length > 1) {
          city = addrParts[1];
          const zipMatch = city.match(/\d{5}(-\d{4})?$/);
          if (zipMatch) {
            zip = zipMatch[0];
            city = city.replace(zipMatch[0], '').trim();
          }
        }

        const firstName = result.fullName.split(' ')[0] || "";
        const lastName = result.fullName.split(' ').slice(1).join(' ') || "";

        setFormData(prev => {
          const updatedSigners = [...(prev.signers || [])];
          const signerIndex = updatedSigners.findIndex(s => s.id === editingSignerId);
          
          const signerData = {
            firstName,
            lastName,
            address: addrParts[0] || "",
            city: city,
            state: state,
            zip: zip,
            idNumber: result.idNumber,
            dob: formatDateForInput(result.dateOfBirth),
            idIssueDate: formatDateForInput(result.issueDate),
            idExpiration: formatDateForInput(result.expirationDate)
          };

          if (signerIndex !== -1) {
            updatedSigners[signerIndex] = { ...updatedSigners[signerIndex], ...signerData };
          }

          const isFirstSigner = signerIndex === 0 || (signerIndex === -1 && updatedSigners.length === 0);

          return {
            ...prev,
            signers: updatedSigners,
            customerName: updateSignerSummary(updatedSigners),
            // Update top-level fields if this is the primary signer
            ...(isFirstSigner ? {
              clientName: result.fullName,
              firstName,
              lastName,
              address: addrParts[0] || "",
              city: city,
              state: state,
              zip: zip,
              location: result.address,
              idNumber: result.idNumber,
              dob: formatDateForInput(result.dateOfBirth),
              idIssueDate: formatDateForInput(result.issueDate),
              idExpiration: formatDateForInput(result.expirationDate)
            } : {})
          };
        });
        setScanSuccess(true);
      } else {
        throw new Error("Could not extract data");
      }
    } catch (error: any) {
      console.error("Scan error:", error);
      const errorMessage = error.message?.includes("key") 
        ? "AI configuration error. Please contact support." 
        : "Could not read license image. Please ensure the photo is clear or enter information manually.";
      setScanError(errorMessage);
    } finally {
      setIsScanning(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  useEffect(() => {
    if (formData.signingType && PACKAGE_CONFIGS[formData.signingType] && !appointment) {
      const config = PACKAGE_CONFIGS[formData.signingType];
      const currentDocs = formData.docs || [];
      const newDocs = mergeUniqueDocuments(currentDocs, config.canonicalDocs, formData.signingType);
      
      if (newDocs.length > currentDocs.length) {
        setFormData(prev => ({
          ...prev,
          docs: newDocs
        }));
        setHybridDocsLoaded(true);
        setTimeout(() => setHybridDocsLoaded(false), 3000);
      }
    }
  }, [formData.signingType, appointment]);

  const docGroups = React.useMemo(() => {
    if (formData.signingType && PACKAGE_CONFIGS[formData.signingType]) {
      const config = PACKAGE_CONFIGS[formData.signingType];
      return [
        {
          title: `${config.type} (Canonical)`,
          items: config.canonicalDocs
        }
      ];
    }
    
    return [
      {
        title: 'Loan Signing Documents',
        items: [
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
        ]
      },
      {
        title: 'Notarial Acts',
        items: [
          'Acknowledgment', 'Jurat', 'Oath / Affirmation', 'Signature Witnessing', 'Copy Certification'
        ]
      },
      {
        title: 'Other',
        items: [
          'Power of Attorney', 'Affidavit of Identity', 'Living Trust'
        ]
      }
    ];
  }, [formData.signingType]);

  const uniqueCustomers = React.useMemo(() => {
    const fromAppointments = appointments.map(a => a.customerName).filter(Boolean) as string[];
    const fromDatabase = customers.map(c => c.fullName);
    const unique = new Set([...fromAppointments, ...fromDatabase]);
    return Array.from(unique).sort();
  }, [appointments, customers]);

  const uniqueCompanies = React.useMemo(() => {
    const fromAppointments = appointments.map(a => a.signingCompany || a.companyName).filter(Boolean) as string[];
    const fromDatabase = companies.map(c => c.companyName);
    const defaults = ['Rocket Close', 'Snapdocs', 'Amrock', 'ServiceLink', 'Xome', 'Signature Closings', 'Bancserv'];
    
    const combined = [...defaults, ...fromAppointments, ...fromDatabase];
    const unique = new Set(combined);
    return Array.from(unique).sort();
  }, [appointments, companies]);

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

  const allSigningTypes = React.useMemo(() => {
    const fromAppointments = appointments.map(a => a.signingType).filter(Boolean);
    const unique = new Set([...defaultSigningTypes, ...fromAppointments]);
    return Array.from(unique).sort();
  }, [appointments]);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab, isOpen]);

  useEffect(() => {
    if (appointment) {
      const data = { ...appointment };
      // Derive first/last name if missing
      if (data.customerName && (!data.firstName || !data.lastName)) {
        const parts = data.customerName.trim().split(/\s+/);
        if (!data.firstName) data.firstName = parts[0] || '';
        if (!data.lastName) data.lastName = parts.slice(1).join(' ') || '';
      }

      // Initialize signers array if missing
      if (!data.signers || data.signers.length === 0) {
        if (data.firstName || data.lastName) {
          data.signers = [{
            id: Math.random().toString(36).substr(2, 9),
            firstName: data.firstName || '',
            lastName: data.lastName || '',
            email: data.email,
            phone: data.phone,
            idType: data.idType,
            idNumber: data.idNumber,
            idIssueDate: data.idIssueDate,
            idExpiration: data.idExpiration,
            dob: data.dob,
            address: data.address,
            city: data.city,
            state: data.state,
            zip: data.zip
          }];
        } else {
          data.signers = [];
        }
      }
      // Initialize fee tracking fields if missing
      if (data.agreedFee === undefined) data.agreedFee = data.fee || 0;
      if (data.offeredFee === undefined) data.offeredFee = data.agreedFee;
      if (data.amountCollected === undefined) data.amountCollected = 0;
      if (data.amountOutstanding === undefined) data.amountOutstanding = (data.agreedFee || 0) - (data.amountCollected || 0);
      if (!data.paymentStatus) {
        if (data.status === 'Paid') data.paymentStatus = 'Paid';
        else data.paymentStatus = 'Not Sent';
      }

      if (!data.scanbackStatus) {
        data.scanbackStatus = 'Not Required';
      }

      // Initialize mileage & profit fields if missing
      if (data.milesDriven === undefined) data.milesDriven = 0;
      if (data.mileageRate === undefined) data.mileageRate = DEFAULT_MILEAGE_RATE;
      if (data.parkingTollsCost === undefined) data.parkingTollsCost = 0;
      if (data.printingCost === undefined) data.printingCost = 0;
      if (data.otherSigningCost === undefined) data.otherSigningCost = 0;
      if (data.roundTripMiles === undefined) data.roundTripMiles = true;
      
      // Calculate derived fields
      const travelCost = (data.milesDriven || 0) * (data.mileageRate || DEFAULT_MILEAGE_RATE);
      const totalJobCost = travelCost + (data.parkingTollsCost || 0) + (data.printingCost || 0) + (data.otherSigningCost || 0);
      const estimatedProfit = (data.agreedFee || 0) - totalJobCost;
      const profitMarginPercent = (data.agreedFee || 0) > 0 ? (estimatedProfit / (data.agreedFee || 0)) * 100 : 0;
      
      data.travelCost = travelCost;
      data.totalJobCost = totalJobCost;
      data.estimatedProfit = estimatedProfit;
      data.profitMarginPercent = profitMarginPercent;
      
      // Derive address/city/state/zip if missing
      if (data.location && (!data.address || !data.city || !data.state || !data.zip)) {
        const parts = data.location.split(',').map((p: string) => p.trim());
        if (!data.address) data.address = parts[0] || '';
        
        if (parts.length > 1) {
          const cityPart = parts[1];
          const zipMatch = cityPart.match(/\d{5}(-\d{4})?$/);
          if (zipMatch) {
            if (!data.zip) data.zip = zipMatch[0];
            const withoutZip = cityPart.replace(zipMatch[0], '').trim();
            const stateMatch = withoutZip.match(/\s([A-Z]{2})$/);
            if (stateMatch) {
              if (!data.state) data.state = stateMatch[1];
              if (!data.city) data.city = withoutZip.replace(stateMatch[0], '').trim();
            } else {
              if (!data.city) data.city = withoutZip;
            }
          } else {
            if (!data.city) data.city = cityPart;
          }
        }
        
        if (parts.length > 2 && !data.state) {
          const stateZipPart = parts[2];
          const zipMatch = stateZipPart.match(/\d{5}(-\d{4})?$/);
          if (zipMatch) {
            if (!data.zip) data.zip = zipMatch[0];
            data.state = stateZipPart.replace(zipMatch[0], '').trim();
          } else {
            data.state = stateZipPart;
          }
        }
      }
      if (data.signingCompany && !data.companyName) {
        data.companyName = data.signingCompany;
      } else if (data.companyName && !data.signingCompany) {
        data.signingCompany = data.companyName;
      }

      // Check if current signing type is custom
      if (data.signingType && !defaultSigningTypes.includes(data.signingType)) {
        setIsCustomType(false); // It's already in the list because we derive allSigningTypes
      }

      setFormData(data);
    } else {
      const now = new Date();
      const dateStr = format(now, 'yyyyMMdd');
      const randomStr = Math.random().toString(36).substr(2, 4).toUpperCase();
      setFormData({
        id: Math.random().toString(36).substr(2, 9),
        userId: userId,
        date: format(now, 'yyyy-MM-dd'),
        time: '10:00 AM',
        signingType: 'Loan Signing',
        fee: 150,
        agreedFee: 150,
        offeredFee: 150,
        amountCollected: 0,
        amountOutstanding: 150,
        paymentStatus: 'Not Sent',
        invoiceSent: false,
        status: 'Scheduled',
        customerName: '',
        signers: [],
        companyName: '',
        location: '',
        invoiceNumber: `INV-${dateStr}-${randomStr}`,
        milesDriven: 0,
        mileageRate: DEFAULT_MILEAGE_RATE,
        parkingTollsCost: 0,
        printingCost: 0,
        otherSigningCost: 0,
        travelCost: 0,
        totalJobCost: 0,
        estimatedProfit: 150, // agreedFee (150) - totalJobCost (0)
        profitMarginPercent: 100,
        roundTripMiles: true,
        scanbackStatus: 'Not Required'
      });
    }
  }, [appointment, isOpen, userId]);

  if (!isOpen) return null;

  const handleSave = () => {
    const computedCustomerName = updateSignerSummary(formData.signers || []) || formData.customerName || "";
    
    if (formData.id && formData.date && formData.time && computedCustomerName && formData.signingType && formData.location && formData.fee !== undefined && formData.status) {
      if (!formData.docs || formData.docs.length === 0) {
        setShowDocError(true);
        setActiveTab('Documents');
        return;
      }
      
      // Ensure fee and agreedFee are in sync and documents are validated
      const finalDocs = validateDocuments(formData.docs || []);
      const finalData = { 
        ...formData, 
        customerName: computedCustomerName,
        fee: formData.agreedFee || formData.fee || 0,
        agreedFee: formData.agreedFee || formData.fee || 0,
        docs: finalDocs
      };
      
      onSave(finalData as Appointment);
      onClose();
    }
  };

  const updateProfitFields = (updatedData: Partial<Appointment>) => {
    const miles = updatedData.milesDriven !== undefined ? updatedData.milesDriven : (formData.milesDriven || 0);
    const rate = updatedData.mileageRate !== undefined ? updatedData.mileageRate : (formData.mileageRate || DEFAULT_MILEAGE_RATE);
    const parkingTolls = updatedData.parkingTollsCost !== undefined ? updatedData.parkingTollsCost : (formData.parkingTollsCost || 0);
    const printing = updatedData.printingCost !== undefined ? updatedData.printingCost : (formData.printingCost || 0);
    const other = updatedData.otherSigningCost !== undefined ? updatedData.otherSigningCost : (formData.otherSigningCost || 0);
    const agreed = updatedData.agreedFee !== undefined ? updatedData.agreedFee : (formData.agreedFee || 0);

    const travelCost = miles * rate;
    const totalJobCost = travelCost + parkingTolls + printing + other;
    const estimatedProfit = agreed - totalJobCost;
    const profitMarginPercent = agreed > 0 ? (estimatedProfit / agreed) * 100 : 0;

    setFormData(prev => ({
      ...prev,
      ...updatedData,
      travelCost,
      totalJobCost,
      estimatedProfit,
      profitMarginPercent
    }));
  };

  const toggleDoc = (doc: string) => {
    const currentDocs = formData.docs || [];
    const newDocs = mergeUniqueDocuments(currentDocs, [doc], formData.signingType);
    
    // If merge didn't add anything (because it was already there), then we remove it (toggle behavior)
    if (currentDocs.includes(normalizeDocName(doc, formData.signingType))) {
      const normalizedToRemove = normalizeDocName(doc, formData.signingType);
      setFormData({ ...formData, docs: currentDocs.filter(d => d !== normalizedToRemove) });
    } else {
      setFormData({ ...formData, docs: newDocs });
      if (newDocs.length > 0) setShowDocError(false);
    }
  };

  const addCustomDoc = () => {
    if (customDoc.trim()) {
      toggleDoc(customDoc.trim());
      setCustomDoc('');
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
            <h2 className="text-2xl font-bold text-slate-800">{appointment ? 'View Entry' : 'New Entry'}:</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
          <AnimatePresence>
            {hybridDocsLoaded && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="bg-sky-50 border border-sky-100 rounded-lg p-3 flex items-center gap-3 text-sky-700 mb-2"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span className="text-xs font-bold">Hybrid Loan Package loaded: 9 canonical documents added.</span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Main Form Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-4">
            {/* Left Column */}
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <label className="text-sm font-bold text-slate-700 w-20 text-right">Type:</label>
                <div className="flex-1 flex flex-col gap-2">
                  <select 
                    value={isCustomType ? "Other" : (formData.signingType || "Loan Signing")}
                    onChange={(e) => {
                      if (e.target.value === "Other") {
                        setIsCustomType(true);
                      } else {
                        setIsCustomType(false);
                        setFormData({ ...formData, signingType: e.target.value });
                      }
                    }}
                    className="w-full bg-white border border-slate-300 rounded px-3 py-2 text-sm focus:ring-1 focus:ring-sky-500 outline-none transition-all"
                  >
                    <optgroup label="Standard Types">
                      {defaultSigningTypes.map(type => (
                        <option key={type} value={type}>{type}</option>
                      ))}
                    </optgroup>
                    <optgroup label="Previously Used / Custom">
                      {allSigningTypes.filter(t => !defaultSigningTypes.includes(t)).map(type => (
                        <option key={type} value={type}>{type}</option>
                      ))}
                      <option value="Other">Other / Custom...</option>
                    </optgroup>
                  </select>
                  
                  {isCustomType && (
                    <div className="flex gap-2 animate-in slide-in-from-top-1 duration-200">
                      <input 
                        type="text"
                        value={customType}
                        onChange={(e) => {
                          setCustomType(e.target.value);
                          setFormData({ ...formData, signingType: e.target.value });
                        }}
                        placeholder="Enter custom signing type..."
                        className="flex-1 border border-slate-300 rounded px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-sky-500"
                        autoFocus
                      />
                      <button 
                        type="button"
                        onClick={() => {
                          setIsCustomType(false);
                          setCustomType('');
                        }}
                        className="text-xs text-slate-400 hover:text-slate-600 px-2"
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-4">
                <label className="text-sm font-bold text-slate-700 w-20 text-right">Date:</label>
                <div className="flex-1 relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input 
                    type="date" 
                    value={formData.date || ""}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded text-sm outline-none focus:ring-1 focus:ring-sky-500" 
                  />
                </div>
              </div>

              <div className="flex items-center gap-4">
                <label className="text-sm font-bold text-slate-700 w-20 text-right">Time:</label>
                <div className="flex-1 relative">
                  <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input 
                    type="text" 
                    value={formData.time || ""}
                    onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                    className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded text-sm outline-none focus:ring-1 focus:ring-sky-500" 
                    placeholder="10:00 AM"
                  />
                </div>
              </div>
            </div>

            {/* Right Column */}
            <div className="space-y-4">
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

              <div className="flex items-center gap-4">
                <label className="text-sm font-bold text-slate-700 w-20 text-right">Company:</label>
                <div className="flex-1 flex gap-2">
                  <select 
                    value={formData.companyName || ""}
                    onChange={(e) => {
                      const selectedName = e.target.value;
                      const company = companies.find(c => c.companyName === selectedName);
                      setFormData({ 
                        ...formData, 
                        companyName: selectedName,
                        signingCompany: selectedName,
                        companyId: company?.id || undefined
                      });
                    }}
                    className="flex-1 bg-white border border-slate-300 rounded px-3 py-2 text-sm focus:ring-1 focus:ring-sky-500 outline-none transition-all"
                  >
                    <option value="">Select Company</option>
                    {uniqueCompanies.map(company => (
                      <option key={company} value={company}>{company}</option>
                    ))}
                  </select>
                  <button 
                    type="button"
                    onClick={() => setIsNewCompanyModalOpen(true)}
                    className="p-2 bg-sky-50 text-sky-600 border border-sky-100 rounded hover:bg-sky-100 transition-all"
                    title="Add New Company to Database"
                  >
                    <PlusCircle className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          <SigningCompanyModal 
            isOpen={isNewCompanyModalOpen}
            onClose={() => setIsNewCompanyModalOpen(false)}
            onSave={(c) => {
              onSaveCompany(c);
              setFormData({ 
                ...formData, 
                signingCompany: c.companyName, 
                companyName: c.companyName,
                companyId: c.id 
              });
              setIsNewCompanyModalOpen(false);
            }}
            userId={userId}
          />


          {/* Location Section */}
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <label className="text-sm font-bold text-slate-700 w-20 text-right">Location:</label>
              <div className="flex-1 relative">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input 
                  type="text" 
                  value={formData.location || ""}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded text-sm outline-none focus:ring-1 focus:ring-sky-500" 
                  placeholder="Street Address, City, State Zip"
                />
              </div>
            </div>

            <div className="flex items-center gap-4">
              <label className="text-sm font-bold text-slate-700 w-20 text-right">Signer(s):</label>
              <div className="flex-1 flex gap-2">
                <div className="flex-1 relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input 
                    type="text" 
                    readOnly
                    value={updateSignerSummary(formData.signers || []) || formData.customerName || ""}
                    className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded text-sm outline-none bg-slate-50 text-slate-500 cursor-not-allowed" 
                    placeholder="Signers will be added in the Signer(s) tab"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Status Section */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="flex items-center gap-4">
              <label className="text-sm font-bold text-slate-700 w-20 text-right">Status:</label>
              <div className="flex-1 flex gap-2 flex-wrap">
                {['Scheduled', 'Completed', 'Paid', 'Cancelled', 'No Show'].map((status) => (
                  <button
                    key={status}
                    onClick={() => setFormData({ ...formData, status: status as AppointmentStatus })}
                    className={cn(
                      "flex-1 min-w-[80px] py-1.5 text-[10px] font-bold rounded border transition-all",
                      formData.status === status 
                        ? "bg-sky-50 border-sky-500 text-sky-700" 
                        : "bg-white border-slate-200 text-slate-500 hover:border-slate-300"
                    )}
                  >
                    {status}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-4">
              <label className="text-sm font-bold text-slate-700 w-20 text-right">Scanbacks:</label>
              <div className="flex-1 flex gap-2 flex-wrap">
                {['Not Required', 'Pending', 'Sent', 'Confirmed'].map((sStatus) => (
                  <button
                    key={sStatus}
                    onClick={() => setFormData({ ...formData, scanbackStatus: sStatus as any })}
                    className={cn(
                      "flex-1 min-w-[70px] py-1.5 text-[10px] font-bold rounded border transition-all",
                      formData.scanbackStatus === sStatus 
                        ? "bg-amber-50 border-amber-500 text-amber-700" 
                        : "bg-white border-slate-200 text-slate-500 hover:border-slate-300"
                    )}
                  >
                    {sStatus}
                  </button>
                ))}
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
                { name: 'Documents', icon: List },
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
                  {tab.name === 'Signer(s)' && (formData.signers || []).length > 0 && (
                    <span className={cn(
                      "text-[10px] px-1.5 py-0.5 rounded-full font-bold",
                      activeTab === tab.name ? "bg-indigo-100 text-indigo-700" : "bg-slate-200 text-slate-500"
                    )}>
                      {(formData.signers || []).length}
                    </span>
                  )}
                  {tab.name === 'Documents' && (formData.docs || []).length > 0 && (
                    <span className={cn(
                      "text-[10px] px-1.5 py-0.5 rounded-full font-bold",
                      activeTab === tab.name ? "bg-indigo-100 text-indigo-700" : "bg-slate-200 text-slate-500"
                    )}>
                      {(formData.docs || []).length}
                    </span>
                  )}
                </button>
              ))}
            </div>

            <div className="p-6 space-y-4">
              {activeTab === 'Signer(s)' && (
                <div className="space-y-6">
                  {/* Signers List */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Signer(s) List</h3>
                      <button 
                        onClick={() => {
                          const newSigner: Signer = {
                            id: Math.random().toString(36).substr(2, 9),
                            firstName: '',
                            lastName: ''
                          };
                          const updatedSigners = [...(formData.signers || []), newSigner];
                          setFormData({ ...formData, signers: updatedSigners });
                          setEditingSignerId(newSigner.id);
                        }}
                        className="flex items-center gap-1 text-[10px] font-bold text-indigo-600 hover:text-indigo-700 uppercase tracking-wider transition-colors"
                      >
                        <PlusCircle className="w-3 h-3" />
                        Add Signer
                      </button>
                    </div>

                    <div className="grid grid-cols-1 gap-2">
                      {(formData.signers || []).map((signer, index) => (
                        <div 
                          key={signer.id}
                          className={cn(
                            "flex items-center justify-between p-3 rounded-xl border transition-all",
                            editingSignerId === signer.id 
                              ? "bg-indigo-50 border-indigo-200 ring-1 ring-indigo-200" 
                              : "bg-white border-slate-200 hover:border-slate-300"
                          )}
                        >
                          <div className="flex items-center gap-3">
                            <div className={cn(
                              "w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs",
                              editingSignerId === signer.id ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-500"
                            )}>
                              {index + 1}
                            </div>
                            <div>
                              <p className="text-sm font-bold text-slate-800">
                                {signer.firstName || signer.lastName ? `${signer.firstName} ${signer.lastName}`.trim() : "New Signer"}
                              </p>
                              <p className="text-[10px] text-slate-400 font-medium">
                                {signer.email || "No email"} • {signer.phone || "No phone"}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            <button 
                              onClick={() => setEditingSignerId(editingSignerId === signer.id ? null : signer.id)}
                              className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-indigo-600 transition-all"
                              title="Edit Signer"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={() => {
                                const updatedSigners = (formData.signers || []).filter(s => s.id !== signer.id);
                                setFormData({ ...formData, signers: updatedSigners });
                                if (editingSignerId === signer.id) setEditingSignerId(null);
                              }}
                              className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-rose-600 transition-all"
                              title="Remove Signer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                      {(formData.signers || []).length === 0 && (
                        <div className="text-center py-8 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                          <User className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                          <p className="text-xs font-medium text-slate-400">No signers added yet</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Signer Form */}
                  <AnimatePresence mode="wait">
                    {editingSignerId && (
                      <motion.div 
                        key={editingSignerId}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="space-y-4 pt-4 border-t border-slate-100"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <h3 className="text-xs font-bold text-indigo-600 uppercase tracking-widest">
                            Editing Signer { (formData.signers || []).findIndex(s => s.id === editingSignerId) + 1 }
                          </h3>
                          <button 
                            onClick={() => setEditingSignerId(null)}
                            className="text-[10px] font-bold text-slate-400 hover:text-slate-600 uppercase tracking-wider"
                          >
                            Close Form
                          </button>
                        </div>

                        {(() => {
                          const signer = (formData.signers || []).find(s => s.id === editingSignerId);
                          if (!signer) return null;

                          const updateSigner = (updates: Partial<Signer>) => {
                            const updatedSigners = (formData.signers || []).map(s => 
                              s.id === editingSignerId ? { ...s, ...updates } : s
                            );
                            
                            const isFirstSigner = updatedSigners[0]?.id === editingSignerId;
                            
                            setFormData({ 
                              ...formData, 
                              signers: updatedSigners,
                              customerName: updateSignerSummary(updatedSigners),
                              ...(isFirstSigner ? {
                                firstName: updates.firstName !== undefined ? updates.firstName : signer.firstName,
                                lastName: updates.lastName !== undefined ? updates.lastName : signer.lastName,
                                email: updates.email !== undefined ? updates.email : signer.email,
                                phone: updates.phone !== undefined ? updates.phone : signer.phone,
                                address: updates.address !== undefined ? updates.address : signer.address,
                                city: updates.city !== undefined ? updates.city : signer.city,
                                state: updates.state !== undefined ? updates.state : signer.state,
                                zip: updates.zip !== undefined ? updates.zip : signer.zip,
                              } : {})
                            });
                          };

                          return (
                            <div className="space-y-4">
                              <div className="flex justify-end mb-2">
                                <select 
                                  className="text-[10px] font-bold text-slate-500 bg-slate-50 border border-slate-200 rounded px-2 py-1 outline-none focus:ring-1 focus:ring-indigo-500"
                                  onChange={(e) => {
                                    const customer = customers.find(c => c.id === e.target.value);
                                    if (customer) {
                                      updateSigner({
                                        firstName: customer.firstName,
                                        lastName: customer.lastName,
                                        email: customer.email,
                                        phone: customer.phone,
                                        address: customer.address,
                                        city: customer.city,
                                        state: customer.state,
                                        zip: customer.zip
                                      });
                                    }
                                  }}
                                  value=""
                                >
                                  <option value="">Select from Contacts</option>
                                  {customers.map(c => (
                                    <option key={c.id} value={c.id}>{c.fullName}</option>
                                  ))}
                                </select>
                              </div>
                              <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">First Name</label>
                                  <input 
                                    type="text" 
                                    value={signer.firstName || ""}
                                    onChange={(e) => updateSigner({ firstName: e.target.value })}
                                    className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all" 
                                  />
                                </div>
                                <div className="space-y-1">
                                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Last Name</label>
                                  <input 
                                    type="text" 
                                    value={signer.lastName || ""}
                                    onChange={(e) => updateSigner({ lastName: e.target.value })}
                                    className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all" 
                                  />
                                </div>
                              </div>

                              <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Email</label>
                                  <input 
                                    type="email" 
                                    value={signer.email || ""}
                                    onChange={(e) => updateSigner({ email: e.target.value })}
                                    className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all" 
                                  />
                                </div>
                                <div className="space-y-1">
                                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Phone</label>
                                  <input 
                                    type="tel" 
                                    value={signer.phone || ""}
                                    onChange={(e) => updateSigner({ phone: e.target.value })}
                                    className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all" 
                                  />
                                </div>
                              </div>

                              <div className="space-y-1">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Street Address</label>
                                <input 
                                  type="text" 
                                  value={signer.address || ""}
                                  onChange={(e) => {
                                    const newAddress = e.target.value;
                                    updateSigner({ 
                                      address: newAddress,
                                    });
                                    // If first signer, also update location
                                    if ((formData.signers || [])[0]?.id === editingSignerId) {
                                      setFormData(prev => ({
                                        ...prev,
                                        location: `${newAddress}, ${signer.city || ''}${signer.state ? `, ${signer.state}` : ''}${signer.zip ? ` ${signer.zip}` : ''}`.trim()
                                      }));
                                    }
                                  }}
                                  className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all" 
                                />
                              </div>

                              <div className="grid grid-cols-3 gap-4">
                                <div className="space-y-1">
                                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">City</label>
                                  <input 
                                    type="text" 
                                    value={signer.city || ""}
                                    onChange={(e) => updateSigner({ city: e.target.value })}
                                    className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all" 
                                  />
                                </div>
                                <div className="space-y-1">
                                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">State</label>
                                  <input 
                                    type="text" 
                                    value={signer.state || ""}
                                    onChange={(e) => updateSigner({ state: e.target.value })}
                                    className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all" 
                                  />
                                </div>
                                <div className="space-y-1">
                                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Zip</label>
                                  <input 
                                    type="text" 
                                    value={signer.zip || ""}
                                    onChange={(e) => updateSigner({ zip: e.target.value })}
                                    className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all" 
                                  />
                                </div>
                              </div>

                              <div className="pt-4 border-t border-slate-100 space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                  <div className="space-y-1">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">ID Type</label>
                                    <select 
                                      value={signer.idType || ""}
                                      onChange={(e) => updateSigner({ idType: e.target.value })}
                                      className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all bg-white"
                                    >
                                      <option value="">Select ID Type</option>
                                      <option>NC Driver's License</option>
                                      <option>Out-of-State Driver's License</option>
                                      <option>US Passport</option>
                                      <option>Military ID</option>
                                      <option>State-Issued ID Card</option>
                                      <option>Personal Knowledge</option>
                                      <option>Credible Witness</option>
                                      <option>Other</option>
                                    </select>
                                  </div>
                                  <div className="space-y-1">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">ID Number</label>
                                    <input 
                                      type="text" 
                                      value={signer.idNumber || ""}
                                      onChange={(e) => updateSigner({ idNumber: e.target.value })}
                                      className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all" 
                                    />
                                  </div>
                                </div>

                                <div className="grid grid-cols-3 gap-4">
                                  <div className="space-y-1">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">ID Expiration</label>
                                    <input 
                                      type="date" 
                                      value={signer.idExpiration || ""}
                                      onChange={(e) => updateSigner({ idExpiration: e.target.value })}
                                      className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all" 
                                    />
                                  </div>
                                  <div className="space-y-1">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Date of Birth</label>
                                    <input 
                                      type="date" 
                                      value={signer.dob || ""}
                                      onChange={(e) => updateSigner({ dob: e.target.value })}
                                      className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all" 
                                    />
                                  </div>
                                  <div className="space-y-1">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">ID Issue Date</label>
                                    <input 
                                      type="date" 
                                      value={signer.idIssueDate || ""}
                                      onChange={(e) => updateSigner({ idIssueDate: e.target.value })}
                                      className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all" 
                                    />
                                  </div>
                                </div>

                                {(signer.idType === "NC Driver's License" || signer.idType === "Out-of-State Driver's License") && (
                                  <div className="pt-2">
                                    <input 
                                      type="file" 
                                      accept="image/*" 
                                      capture="environment"
                                      className="hidden" 
                                      ref={fileInputRef}
                                      onChange={handleScanLicense}
                                    />
                                    <button
                                      type="button"
                                      onClick={() => fileInputRef.current?.click()}
                                      disabled={isScanning}
                                      className={cn(
                                        "w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all shadow-sm",
                                        isScanning 
                                          ? "bg-slate-100 text-slate-400 cursor-not-allowed" 
                                          : "bg-indigo-600 text-white hover:bg-indigo-700 active:scale-95 shadow-indigo-200 shadow-lg"
                                      )}
                                    >
                                      {isScanning ? (
                                        <>
                                          <Loader2 className="w-4 h-4 animate-spin" />
                                          Scanning...
                                        </>
                                      ) : (
                                        <>
                                          <Camera className="w-4 h-4" />
                                          Scan License
                                        </>
                                      )}
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })()}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}
              {activeTab === 'Contacts' && (
                <div className="space-y-4">
                  <div className="flex items-center gap-4">
                    <label className="text-sm font-bold text-slate-700 w-24 text-right">Phone:</label>
                    <input 
                      type="tel" 
                      value={formData.phone || ""}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="flex-1 border border-slate-300 rounded px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-sky-500" 
                    />
                  </div>
                  <div className="flex items-center gap-4">
                    <label className="text-sm font-bold text-slate-700 w-24 text-right">Email:</label>
                    <input 
                      type="email" 
                      value={formData.email || ""}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="flex-1 border border-slate-300 rounded px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-sky-500" 
                    />
                  </div>
                  <div className="flex items-center gap-4">
                    <label className="text-sm font-bold text-slate-700 w-24 text-right">Customer:</label>
                    <select 
                      value={formData.customer || ""}
                      onChange={(e) => setFormData({ ...formData, customer: e.target.value })}
                      className="flex-1 border border-slate-300 rounded px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-sky-500 bg-white"
                    >
                      <option value="">Select a Customer</option>
                      {customers.map(customer => (
                        <option key={customer.id} value={customer.fullName}>
                          {customer.fullName}
                        </option>
                      ))}
                      <option value="Rocket Close">Rocket Close (Default)</option>
                    </select>
                  </div>
                </div>
              )}
              {activeTab === 'Invoice' && (
                <div className="space-y-6">
                  <div className="bg-slate-50 p-6 rounded-xl border border-slate-200">
                    <div className="flex justify-between items-center mb-6">
                      <h3 className="font-bold text-slate-800 flex items-center gap-2">
                        <Banknote className="w-5 h-5 text-emerald-600" />
                        Fee Tracking & Billing
                      </h3>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Payment Status:</span>
                        <select 
                          value={formData.paymentStatus || "Not Sent"}
                          onChange={(e) => setFormData({ ...formData, paymentStatus: e.target.value as any })}
                          className={cn(
                            "px-3 py-1 rounded text-[10px] font-black uppercase tracking-wider border outline-none",
                            formData.paymentStatus === 'Paid' ? "bg-emerald-50 border-emerald-200 text-emerald-700" : 
                            formData.paymentStatus === 'Partial' ? "bg-sky-50 border-sky-200 text-sky-700" :
                            formData.paymentStatus === 'Follow Up' ? "bg-amber-50 border-amber-200 text-amber-700" :
                            "bg-slate-100 border-slate-200 text-slate-600"
                          )}
                        >
                          <option>Not Sent</option>
                          <option>Sent</option>
                          <option>Partial</option>
                          <option>Paid</option>
                          <option>Follow Up</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div className="space-y-4">
                        <div>
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Offered Fee</label>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs">$</span>
                            <input 
                              type="number" 
                              value={formData.offeredFee || 0}
                              onChange={(e) => setFormData({ ...formData, offeredFee: parseFloat(e.target.value) })}
                              className="w-full pl-7 pr-3 py-2 border border-slate-300 rounded text-sm outline-none focus:ring-1 focus:ring-sky-500"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Agreed Fee</label>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs">$</span>
                            <input 
                              type="number" 
                              value={formData.agreedFee || 0}
                              onChange={(e) => {
                                const val = parseFloat(e.target.value);
                                updateProfitFields({ 
                                  agreedFee: val,
                                  fee: val,
                                  amountOutstanding: val - (formData.amountCollected || 0)
                                });
                              }}
                              className="w-full pl-7 pr-3 py-2 border border-slate-300 rounded text-sm font-bold outline-none focus:ring-1 focus:ring-sky-500"
                            />
                          </div>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <div>
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Amount Collected</label>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs">$</span>
                            <input 
                              type="number" 
                              value={formData.amountCollected || 0}
                              onChange={(e) => {
                                const collected = parseFloat(e.target.value);
                                const agreed = formData.agreedFee || 0;
                                const outstanding = agreed - collected;
                                
                                let status = formData.paymentStatus;
                                if (collected >= agreed && agreed > 0) status = 'Paid';
                                else if (collected > 0 && collected < agreed) status = 'Partial';
                                
                                setFormData({ 
                                  ...formData, 
                                  amountCollected: collected,
                                  amountOutstanding: outstanding,
                                  paymentStatus: status as any
                                });
                              }}
                              className="w-full pl-7 pr-3 py-2 border border-slate-300 rounded text-sm outline-none focus:ring-1 focus:ring-sky-500"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Outstanding</label>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs">$</span>
                            <input 
                              type="number" 
                              readOnly
                              value={formData.amountOutstanding || 0}
                              className="w-full pl-7 pr-3 py-2 bg-slate-100 border border-slate-200 rounded text-sm font-bold text-rose-600 outline-none"
                            />
                          </div>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <div>
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Payment Method</label>
                          <select 
                            value={formData.paymentMethod || ""}
                            onChange={(e) => setFormData({ ...formData, paymentMethod: e.target.value })}
                            className="w-full px-3 py-2 border border-slate-300 rounded text-sm outline-none focus:ring-1 focus:ring-sky-500 bg-white"
                          >
                            <option value="">Select Method</option>
                            <option>Check</option>
                            <option>Direct Deposit / ACH</option>
                            <option>Zelle</option>
                            <option>Venmo</option>
                            <option>Cash</option>
                            <option>Credit Card</option>
                            <option>Snapdocs Pay</option>
                          </select>
                        </div>
                        <div className="flex items-center justify-between pt-2">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Invoice Sent</label>
                          <button 
                            onClick={() => setFormData({ ...formData, invoiceSent: !formData.invoiceSent })}
                            className={cn(
                              "w-12 h-6 rounded-full transition-all relative",
                              formData.invoiceSent ? "bg-emerald-500" : "bg-slate-300"
                            )}
                          >
                            <div className={cn(
                              "absolute top-1 w-4 h-4 bg-white rounded-full transition-all",
                              formData.invoiceSent ? "left-7" : "left-1"
                            )} />
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-6 mt-6 pt-6 border-t border-slate-200">
                      <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Payment Due Date</label>
                        <input 
                          type="date" 
                          value={formData.paymentDueDate || ""}
                          onChange={(e) => setFormData({ ...formData, paymentDueDate: e.target.value })}
                          className="w-full border border-slate-300 rounded px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-sky-500"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Payment Received Date</label>
                        <input 
                          type="date" 
                          value={formData.paymentReceivedDate || ""}
                          onChange={(e) => {
                            const date = e.target.value;
                            setFormData({ 
                              ...formData, 
                              paymentReceivedDate: date,
                              paymentStatus: date ? 'Paid' : formData.paymentStatus,
                              amountCollected: date ? (formData.agreedFee || formData.fee || 0) : formData.amountCollected,
                              amountOutstanding: date ? 0 : (formData.agreedFee || 0) - (formData.amountCollected || 0)
                            });
                          }}
                          className="w-full border border-slate-300 rounded px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-sky-500"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Travel & Profit Section */}
                  <div className="bg-slate-50 p-6 rounded-xl border border-slate-200">
                    <div className="flex justify-between items-center mb-6">
                      <h3 className="font-bold text-slate-800 flex items-center gap-2">
                        <Car className="w-5 h-5 text-indigo-600" />
                        Travel & Profit
                      </h3>
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Round Trip:</span>
                          <button 
                            onClick={() => updateProfitFields({ roundTripMiles: !formData.roundTripMiles })}
                            className={cn(
                              "w-10 h-5 rounded-full transition-all relative",
                              formData.roundTripMiles ? "bg-indigo-500" : "bg-slate-300"
                            )}
                          >
                            <div className={cn(
                              "absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all",
                              formData.roundTripMiles ? "left-5.5" : "left-0.5"
                            )} />
                          </button>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Margin:</span>
                          <div className={cn(
                            "px-3 py-1 rounded text-[10px] font-black uppercase tracking-wider border",
                            (formData.profitMarginPercent || 0) >= 70 ? "bg-emerald-50 border-emerald-200 text-emerald-700" :
                            (formData.profitMarginPercent || 0) >= 40 ? "bg-amber-50 border-amber-200 text-amber-700" :
                            "bg-rose-50 border-rose-200 text-rose-700"
                          )}>
                            {Math.round(formData.profitMarginPercent || 0)}%
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Miles Driven</label>
                        <input 
                          type="number" 
                          value={formData.milesDriven || 0}
                          onChange={(e) => updateProfitFields({ milesDriven: parseFloat(e.target.value) })}
                          className="w-full px-3 py-2 border border-slate-300 rounded text-sm outline-none focus:ring-1 focus:ring-sky-500"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Mileage Rate</label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs">$</span>
                          <input 
                            type="number" 
                            step="0.01"
                            value={formData.mileageRate || DEFAULT_MILEAGE_RATE}
                            onChange={(e) => updateProfitFields({ mileageRate: parseFloat(e.target.value) })}
                            className="w-full pl-7 pr-3 py-2 border border-slate-300 rounded text-sm outline-none focus:ring-1 focus:ring-sky-500"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Travel Cost</label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs">$</span>
                          <input 
                            type="number" 
                            readOnly
                            value={formData.travelCost?.toFixed(2) || 0}
                            className="w-full pl-7 pr-3 py-2 bg-slate-100 border border-slate-200 rounded text-sm outline-none"
                          />
                        </div>
                      </div>
                      <div className="bg-indigo-50/50 p-3 rounded-lg border border-indigo-100 flex flex-col justify-center">
                        <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest block mb-1">Profit Amount</span>
                        <div className="flex items-center gap-2">
                          <TrendingUp className="w-4 h-4 text-indigo-600" />
                          <span className="text-lg font-black text-indigo-700">${formData.estimatedProfit?.toFixed(2) || 0}</span>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mt-4">
                      <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Parking/Tolls</label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs">$</span>
                          <input 
                            type="number" 
                            value={formData.parkingTollsCost || 0}
                            onChange={(e) => updateProfitFields({ parkingTollsCost: parseFloat(e.target.value) })}
                            className="w-full pl-7 pr-3 py-2 border border-slate-300 rounded text-sm outline-none focus:ring-1 focus:ring-sky-500"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Printing</label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs">$</span>
                          <input 
                            type="number" 
                            value={formData.printingCost || 0}
                            onChange={(e) => updateProfitFields({ printingCost: parseFloat(e.target.value) })}
                            className="w-full pl-7 pr-3 py-2 border border-slate-300 rounded text-sm outline-none focus:ring-1 focus:ring-sky-500"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Other Exp.</label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs">$</span>
                          <input 
                            type="number" 
                            value={formData.otherSigningCost || 0}
                            onChange={(e) => updateProfitFields({ otherSigningCost: parseFloat(e.target.value) })}
                            className="w-full pl-7 pr-3 py-2 border border-slate-300 rounded text-sm outline-none focus:ring-1 focus:ring-sky-500"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Total Exp.</label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs">$</span>
                          <input 
                            type="number" 
                            readOnly
                            value={formData.totalJobCost?.toFixed(2) || 0}
                            className="w-full pl-7 pr-3 py-2 bg-slate-100 border border-slate-200 rounded text-sm font-bold outline-none"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">Billing Notes:</label>
                    <textarea 
                      value={formData.notesBilling || ""}
                      onChange={(e) => setFormData({ ...formData, notesBilling: e.target.value })}
                      placeholder="Payment terms, follow-up history, etc..."
                      className="w-full h-24 border border-slate-300 rounded-lg px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 resize-none transition-all"
                    />
                  </div>
                </div>
              )}
              {activeTab === 'Documents' && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-bold text-slate-700">Documents Signed:</label>
                    {showDocError && (
                      <span className="text-xs font-bold text-rose-500 animate-pulse">
                        At least one document must be selected
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-h-64 overflow-y-auto pr-2 custom-scrollbar">
                    {docGroups.map((group) => (
                      <div key={group.title} className="space-y-3">
                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-1">
                          {group.title}
                        </h4>
                        <div className="space-y-2">
                          {group.items.map((item) => (
                            <label key={item} className="flex items-center gap-2 cursor-pointer group">
                              <input 
                                type="checkbox"
                                checked={(formData.docs || []).includes(item)}
                                onChange={() => toggleDoc(item)}
                                className="rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                              />
                              <span className="text-xs text-slate-600 group-hover:text-slate-900 transition-colors">
                                {item}
                              </span>
                            </label>
                          ))}
                          {group.title === 'Other' && (
                            <div className="pt-2 space-y-2">
                              <div className="flex gap-2">
                                <input 
                                  type="text"
                                  value={customDoc}
                                  onChange={(e) => setCustomDoc(e.target.value)}
                                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addCustomDoc())}
                                  placeholder="Custom document..."
                                  className="flex-1 border border-slate-300 rounded px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-sky-500"
                                />
                                <button 
                                  onClick={addCustomDoc}
                                  className="p-1 bg-sky-100 text-sky-600 rounded hover:bg-sky-200 transition-colors"
                                >
                                  <Plus className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="pt-4 border-t border-slate-100">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Selected Documents:</p>
                    <div className="flex flex-wrap gap-2">
                      {(formData.docs || []).length > 0 ? (
                        (formData.docs || []).map((doc) => (
                          <span 
                            key={doc}
                            className="inline-flex items-center gap-1 px-2 py-1 bg-sky-50 text-sky-700 rounded-full text-[10px] font-bold border border-sky-100 group"
                          >
                            {doc}
                            <button 
                              onClick={() => toggleDoc(doc)}
                              className="hover:text-rose-500 transition-colors"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </span>
                        ))
                      ) : (
                        <p className="text-xs italic text-slate-400">No documents selected</p>
                      )}
                    </div>
                  </div>
                </div>
              )}
              {activeTab === 'Notes' && (
                <div className="space-y-4">
                  <label className="text-sm font-bold text-slate-700 block">Additional Notes (optional):</label>
                  <textarea 
                    value={formData.notes || ""}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="Loan number, lender, title company, or any other details..."
                    className="w-full h-48 border border-slate-300 rounded-lg px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 resize-none transition-all"
                  />
                </div>
              )}
              {activeTab !== 'Signer(s)' && activeTab !== 'Notes' && activeTab !== 'Contacts' && activeTab !== 'Invoice' && (
                <div className="py-12 text-center text-slate-400 italic">
                  Content for {activeTab} tab will be implemented soon.
                </div>
              )}
            </div>
          </div>

          {/* Notes Section (Duplicate removed in refactor) */}
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

export default NewSigningModal;
