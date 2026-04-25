import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, Edit2, MapPin, User, Calendar, Clock, 
  HelpCircle, CheckCircle2, Phone, Banknote, 
  List, Pencil, Plus, Trash2, Camera, Loader2, AlertCircle,
  Car, TrendingUp, PlusCircle, Upload, ChevronLeft, ChevronRight,
  FileText, ShieldCheck
} from 'lucide-react';
import { format, parse } from 'date-fns';
import { Appointment, AppointmentStatus, Customer, SigningCompany, Signer } from '../types';
import { cn } from '../lib/utils';
import { GoogleGenAI, Type } from "@google/genai";
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../firebase';
import SigningCompanyModal from './SigningCompanyModal';

import { HYBRID_LOAN_PACKAGE, PACKAGE_CONFIGS, mergeUniqueDocuments, validateDocuments, normalizeDocName } from '../lib/packageConfigs';

interface NewJournalEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  appointment?: Appointment | null;
  onSave: (app: Appointment) => Promise<void> | void;
  initialTab?: string;
  userId: string;
  customers: Customer[];
  appointments: Appointment[];
  companies: SigningCompany[];
  onSaveCompany: (company: SigningCompany) => void;
  autoScan?: boolean;
}

const DEFAULT_MILEAGE_RATE = 0.725;

const SIGNING_TYPES = [
  "Refinance", "Purchase - Buyer", "Seller Package", "HELOC", "Reverse Mortgage", 
  "Loan Modification", "Cash Purchase", "Commercial Loan", "Hybrid Closing", "Other Signing"
];

const DOCUMENT_TYPES = [
  "Closing Disclosure", "Promissory Note", "Deed of Trust / Mortgage", "Occupancy Affidavit", 
  "Signature / Name Affidavit", "Compliance Agreement", "Right to Cancel", "Loan Application", 
  "Escrow / Impound Disclosure", "First Payment Letter", "Borrower Certification / Authorization", 
  "Identity Verification Form", "Owner’s Affidavit", "Limited Power of Attorney", "Warranty Deed", 
  "Quitclaim Deed", "Grant Deed", "Deed of Reconveyance", "Subordination Agreement", 
  "Loan Modification Agreement", "HELOC Agreement", "Reverse Mortgage Documents", 
  "Seller Closing Documents", "Buyer Closing Documents", "Disbursement Authorization", 
  "Settlement Statement / ALTA / HUD-1", "Certificate of Trust", "Tax / Escrow Documents", 
  "Other Loan Document"
];

const NOTARIAL_ACTS = [
  "Acknowledgment", "Jurat", "Oath / Affirmation", "Verification / Proof", "No Notarial Act Required"
];

const NewJournalEntryModal = ({ 
  isOpen, 
  onClose, 
  appointment, 
  onSave, 
  initialTab = 'Signer(s)',
  userId,
  customers,
  appointments,
  companies,
  onSaveCompany,
  autoScan = false
}: NewJournalEntryModalProps) => {
  const [activeTab, setActiveTab] = useState(initialTab);
  const [formData, setFormData] = useState<Partial<Appointment>>({});
  const [customDoc, setCustomDoc] = useState('');
  const [showDocError, setShowDocError] = useState(false);
  const [isNewCompanyModalOpen, setIsNewCompanyModalOpen] = useState(false);
  const [editingSignerId, setEditingSignerId] = useState<string | null>(null);
  const [isCustomType, setIsCustomType] = useState(false);
  const [customType, setCustomType] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState(0);
  
  const steps = [
    { name: 'Signer(s)', icon: User, description: 'Identity & IDs' },
    { name: 'Documents', icon: List, description: 'Act Details' },
    { name: 'Contacts', icon: Phone, description: 'Communication' },
    { name: 'Invoice', icon: Banknote, description: 'Fee & Billing' },
    { name: 'Notes', icon: Pencil, description: 'Final Remarks' },
  ];
  const [isScanning, setIsScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [scanSuccess, setScanSuccess] = useState(false);
  const [packageLoadedMessage, setPackageLoadedMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadInputRef = useRef<HTMLInputElement>(null);

  const formatDateForInput = (dateStr: string) => {
    if (!dateStr) return "";
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

    const MAX_SIZE = 10 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      setScanError("Image is too large. Please select a file under 10MB.");
      return;
    }

    setIsScanning(true);
    setScanError(null);
    setScanSuccess(false);

    try {
      const compressImage = async (imgFile: File): Promise<Blob> => {
        return new Promise((resolve, reject) => {
          const img = new Image();
          img.src = URL.createObjectURL(imgFile);
          img.onload = () => {
            const canvas = document.createElement("canvas");
            const MAX_SIZE = 1200;
            let w = img.width, h = img.height;
            if (w > h) { if (w > MAX_SIZE) { h *= MAX_SIZE / w; w = MAX_SIZE; } } 
            else { if (h > MAX_SIZE) { w *= MAX_SIZE / h; h = MAX_SIZE; } }
            canvas.width = w; canvas.height = h;
            const ctx = canvas.getContext("2d");
            ctx?.drawImage(img, 0, 0, w, h);
            canvas.toBlob(b => b ? resolve(b) : reject("Blob fail"), "image/jpeg", 0.7);
          };
          img.onerror = () => reject("Img fail");
        });
      };

      const [compBlob, b64] = await Promise.all([
        compressImage(file).catch(() => file),
        new Promise<string>((res, rej) => {
          const r = new FileReader();
          r.onload = () => res((r.result as string).split(",")[1]);
          r.onerror = rej;
          r.readAsDataURL(file);
        })
      ]);

      const tks = Date.now();
      const path = `scan-images/${userId}/${tks}-${file.name.replace(/[^a-z0-9.]/gi, "_")}`;
      const sRef = ref(storage, path);

      const uploadJob = async () => {
        await Promise.race([uploadBytes(sRef, compBlob as Blob), new Promise((_, r) => setTimeout(() => r("Upload Timeout"), 60000))]);
        return await getDownloadURL(sRef);
      };

      const apiKey = (import.meta.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY);
      if (!apiKey) throw new Error("Gemini API key missing.");
      const ai = new GoogleGenAI({ apiKey });
      
      const aiJob = async () => {
        const prompt = `Extract info from this ID image into JSON: fullName, address, idNumber, dateOfBirth (MM/DD/YYYY), issueDate, expirationDate, state, idType.`;
        const aiPromise = ai.models.generateContent({
          model: "gemini-3-flash-preview",
          contents: [{ role: "user", parts: [{ inlineData: { mimeType: "image/jpeg", data: b64 } }, { text: prompt }] }],
          config: { responseMimeType: "application/json" }
        });
        const aiTimeout = new Promise((_, reject) => 
          setTimeout(() => reject(new Error("AI Timeout")), 60000)
        );
        const response = await Promise.race([aiPromise, aiTimeout]) as any;
        return JSON.parse(response.text);
      };

      const [aiRes, upRes] = await Promise.allSettled([aiJob(), uploadJob()]);

      if (aiRes.status === "rejected") throw new Error(`AI Extraction failed: ${aiRes.reason}`);
      const result = aiRes.value;
      const downloadURL = upRes.status === "fulfilled" ? upRes.value : undefined;

      if (result.fullName) {
        const addrParts = (result.address || "").split(',').map((p: string) => p.trim());
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
            idType: result.idType || updatedSigners[signerIndex]?.idType || "NC Driver's License",
            idNumber: result.idNumber,
            dob: formatDateForInput(result.dateOfBirth),
            idIssueDate: formatDateForInput(result.issueDate),
            idExpiration: formatDateForInput(result.expirationDate),
            idImageUrl: downloadURL || undefined
          };

          if (signerIndex !== -1) {
            updatedSigners[signerIndex] = { ...updatedSigners[signerIndex], ...signerData };
          }

          const isFirstSigner = signerIndex === 0 || (signerIndex === -1 && updatedSigners.length === 0);

          return {
            ...prev,
            signers: updatedSigners,
            customerName: updateSignerSummary(updatedSigners),
            ...(isFirstSigner ? {
              clientName: result.fullName,
              firstName,
              lastName,
              address: addrParts[0] || "",
              city,
              state,
              zip,
              idType: result.idType || "NC Driver's License",
              idImageUrl: downloadURL || undefined,
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
        throw new Error("AI could not extract enough information from the image. Please enter manually.");
      }
    } catch (error: any) {
      console.error("[Scan] Error:", error);
      setScanError(error.message || "An error occurred during scanning.");
    } finally {
      setIsScanning(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
      if (uploadInputRef.current) uploadInputRef.current.value = '';
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
        setPackageLoadedMessage(`${config.type} loaded: ${config.canonicalDocs.length} canonical documents added.`);
        setTimeout(() => setPackageLoadedMessage(null), 3000);
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

  useEffect(() => {
    setActiveTab(initialTab);
    const stepIdx = steps.findIndex(s => s.name === initialTab);
    if (stepIdx !== -1) setCurrentStep(stepIdx);
  }, [initialTab, isOpen]);

  useEffect(() => {
    if (appointment) {
      const data = { ...appointment };
      
      if (!data.actType) {
        data.actType = 'Acknowledgment';
      }

      if (data.customerName && (!data.firstName || !data.lastName)) {
        const parts = data.customerName.trim().split(/\s+/);
        if (!data.firstName) data.firstName = parts[0] || '';
        if (!data.lastName) data.lastName = parts.slice(1).join(' ') || '';
      }

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

      if (data.milesDriven === undefined) data.milesDriven = 0;
      if (data.mileageRate === undefined) data.mileageRate = DEFAULT_MILEAGE_RATE;
      if (data.parkingTollsCost === undefined) data.parkingTollsCost = 0;
      if (data.printingCost === undefined) data.printingCost = 0;
      if (data.otherSigningCost === undefined) data.otherSigningCost = 0;
      if (data.roundTripMiles === undefined) data.roundTripMiles = true;
      
      const travelCost = (data.milesDriven || 0) * (data.mileageRate || DEFAULT_MILEAGE_RATE);
      const totalJobCost = travelCost + (data.parkingTollsCost || 0) + (data.printingCost || 0) + (data.otherSigningCost || 0);
      const estimatedProfit = (data.agreedFee || 0) - totalJobCost;
      const profitMarginPercent = (data.agreedFee || 0) > 0 ? (estimatedProfit / (data.agreedFee || 0)) * 100 : 0;
      
      data.travelCost = travelCost;
      data.totalJobCost = totalJobCost;
      data.estimatedProfit = estimatedProfit;
      data.profitMarginPercent = profitMarginPercent;
      
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

      // Try to find IDs for legacy records
      if (!data.companyId && (data.companyName || data.signingCompany)) {
        const name = data.companyName || data.signingCompany;
        const found = companies.find(c => c.companyName === name);
        if (found) data.companyId = found.id;
      }
      if (!data.customerId && (data.customerName || data.customer)) {
        const name = data.customerName || data.customer;
        const found = customers.find(c => c.fullName === name);
        if (found) data.customerId = found.id;
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
        estimatedProfit: 150,
        profitMarginPercent: 100,
        roundTripMiles: true,
        scanbackStatus: 'Not Required',
        actType: 'Acknowledgment'
      });
    }
  }, [appointment, isOpen, userId]);

  if (!isOpen) return null;

  const updateProfitFields = (updates: Partial<Appointment>) => {
    const newData = { ...formData, ...updates };
    const miles = newData.milesDriven || 0;
    const rate = newData.mileageRate || DEFAULT_MILEAGE_RATE;
    const parking = newData.parkingTollsCost || 0;
    const printing = newData.printingCost || 0;
    const other = newData.otherSigningCost || 0;
    const travelCost = miles * rate;
    const totalJobCost = travelCost + parking + printing + other;
    const estimatedProfit = (newData.agreedFee || 0) - totalJobCost;
    const profitMarginPercent = (newData.agreedFee || 0) > 0 ? (estimatedProfit / (newData.agreedFee || 0)) * 100 : 0;
    setFormData({
      ...newData,
      travelCost,
      totalJobCost,
      estimatedProfit,
      profitMarginPercent
    });
  };

  const toggleDoc = (doc: string) => {
    const currentDocs = formData.docs || [];
    if (currentDocs.includes(doc)) {
      setFormData({ ...formData, docs: currentDocs.filter(d => d !== doc) });
    } else {
      setFormData({ ...formData, docs: [...currentDocs, doc] });
    }
  };

  const addCustomDoc = () => {
    if (customDoc.trim()) {
      toggleDoc(customDoc.trim());
      setCustomDoc('');
    }
  };

  const handleSave = async () => {
    if ((formData.docs || []).length === 0) {
      setShowDocError(true);
      setActiveTab('Documents');
      setCurrentStep(1);
      return;
    }
    setIsSaving(true);
    setSaveError(null);
    try {
      const finalData = {
        ...formData,
        customerName: updateSignerSummary(formData.signers || []),
        updatedAt: new Date().toISOString()
      };
      await onSave(finalData as Appointment);
      onClose();
    } catch (err: any) {
      setSaveError(err.message || 'Failed to save entry');
    } finally {
      setIsSaving(false);
    }
  };

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(prev => prev + 1);
      setActiveTab(steps[currentStep + 1].name);
    } else {
      handleSave();
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
      setActiveTab(steps[currentStep - 1].name);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-[#0F172A]/40 backdrop-blur-sm animate-in fade-in duration-300">
      <motion.div 
        initial={{ opacity: 0, scale: 0.98, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[95vh] border border-slate-200"
      >
        <div className="flex items-center justify-between px-8 py-5 border-b border-slate-100 bg-white">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center border border-indigo-100/50 shadow-sm">
              <ShieldCheck className="w-6 h-6 text-indigo-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">{appointment ? 'Review Journal Entry' : 'New Journal Entry'}</h2>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest leading-none mt-1">Official Mandatory Record</p>
            </div>
          </div>
          <div className="flex items-center gap-6">
            <div className="hidden lg:flex items-center gap-2 mr-6">
              {steps.map((step, idx) => (
                <div key={step.name} className="flex items-center">
                  <div title={step.name} className={cn("w-2.5 h-2.5 rounded-full transition-all duration-300", idx <= currentStep ? "bg-indigo-600 shadow-[0_0_8px_rgba(79,70,229,0.4)]" : "bg-slate-200")}></div>
                  {idx < steps.length - 1 && <div className={cn("w-8 h-[2px] mx-1 transition-all duration-300", idx < currentStep ? "bg-indigo-600" : "bg-slate-100")}></div>}
                </div>
              ))}
            </div>
            <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-xl transition-all">
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-0 flex flex-col lg:flex-row min-h-0 bg-white">
          <div className="w-full lg:w-72 bg-slate-50/50 border-r border-slate-100 p-6 space-y-2 border-t lg:border-t-0">
             <div className="mb-6">
               <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-4">Workflow Progress</p>
               {steps.map((step, idx) => (
                 <button key={step.name} onClick={() => { setCurrentStep(idx); setActiveTab(step.name); }} className={cn("w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group text-left", activeTab === step.name ? "bg-white text-slate-900 shadow-sm border border-slate-200" : "text-slate-500 hover:bg-white/50")}>
                   <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center transition-colors", activeTab === step.name ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-400 group-hover:bg-slate-200")}><step.icon className="w-4 h-4" /></div>
                   <div><p className="text-xs font-bold leading-none mb-1">{step.name}</p><p className="text-[10px] text-slate-400 font-medium leading-none">{step.description}</p></div>
                 </button>
               ))}
             </div>
             <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Entry Details</label>
                  <p className="text-xs font-bold text-slate-800">{formData.date ? format(new Date(formData.date), 'MMMM d, yyyy') : 'No Date'}</p>
                  <p className="text-[10px] font-bold text-slate-500">{formData.time || '10:00 AM'}</p>
                </div>
                <div className="space-y-1 pt-3 border-t border-slate-100">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Notarial Act</label>
                  <p className="text-xs font-bold text-indigo-600">{formData.actType || 'Acknowledgment'}</p>
                </div>
             </div>
          </div>

          <div className="flex-1 p-8 overflow-y-auto custom-scrollbar">
            <AnimatePresence mode="wait">
              {activeTab === 'Signer(s)' && (
                <motion.div key="signer-tab" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} className="space-y-8">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 border border-indigo-100"><User className="w-5 h-5" /></div>
                    <div><h3 className="text-lg font-bold text-slate-900">Signer Identification</h3><p className="text-sm text-slate-500">Capture principal information and identity verification method.</p></div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 bg-slate-50/50 p-6 rounded-2xl border border-slate-100">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Date</label>
                      <div className="relative">
                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input 
                          type="date" 
                          value={formData.date || ""} 
                          onChange={(e) => setFormData({ ...formData, date: e.target.value })} 
                          className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all bg-white" 
                        />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Time</label>
                      <div className="relative">
                        <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input 
                          type="text" 
                          value={formData.time || ""} 
                          onChange={(e) => setFormData({ ...formData, time: e.target.value })} 
                          className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all bg-white" 
                          placeholder="10:00 AM" 
                        />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Signing Type</label>
                      <div className="relative">
                        <CheckCircle2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <select 
                          value={formData.signingType || ""} 
                          onChange={(e) => setFormData({ ...formData, signingType: e.target.value })} 
                          className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all bg-white appearance-none cursor-pointer"
                        >
                          <option value="">Select Signing Type</option>
                          {SIGNING_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Doc Type</label>
                      <div className="relative">
                        <FileText className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <select 
                          value={formData.docType || ""} 
                          onChange={(e) => setFormData({ ...formData, docType: e.target.value })} 
                          className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all bg-white appearance-none cursor-pointer"
                        >
                          <option value="">Select Document Type</option>
                          {DOCUMENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Notarial Act</label>
                      <div className="relative">
                        <ShieldCheck className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <select 
                          value={formData.actType || "Acknowledgment"} 
                          onChange={(e) => setFormData({ ...formData, actType: e.target.value })} 
                          className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all bg-white appearance-none cursor-pointer"
                        >
                          {NOTARIAL_ACTS.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                      </div>
                    </div>
                    <div className="space-y-1.5 sm:col-span-2 lg:col-span-3">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Location</label>
                      <div className="relative">
                        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input 
                          type="text" 
                          value={formData.location || ""} 
                          onChange={(e) => setFormData({ ...formData, location: e.target.value })} 
                          className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all bg-white" 
                          placeholder="Street Address, City, State Zip" 
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between"><h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Signer(s) List</h3><button onClick={() => { const newSigner: Signer = { id: Math.random().toString(36).substr(2, 9), firstName: '', lastName: '' }; const updatedSigners = [...(formData.signers || []), newSigner]; setFormData({ ...formData, signers: updatedSigners }); setEditingSignerId(newSigner.id); }} className="flex items-center gap-1 text-[10px] font-bold text-indigo-600 hover:text-indigo-700 uppercase tracking-wider transition-colors"><PlusCircle className="w-3 h-3" />Add Signer</button></div>
                    <div className="grid grid-cols-1 gap-2">
                      {(formData.signers || []).map((signer, index) => (
                        <div key={signer.id} className={cn("flex items-center justify-between p-3 rounded-xl border transition-all", editingSignerId === signer.id ? "bg-indigo-50 border-indigo-200 ring-1 ring-indigo-200" : "bg-white border-slate-200 hover:border-slate-300")}>
                          <div className="flex items-center gap-3"><div className={cn("w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs", editingSignerId === signer.id ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-500")}>{index + 1}</div><div><p className="text-sm font-bold text-slate-800">{signer.firstName || signer.lastName ? `${signer.firstName} ${signer.lastName}`.trim() : "New Signer"}</p><p className="text-[10px] text-slate-400 font-medium">{signer.email || "No email"} • {signer.phone || "No phone"}</p></div></div>
                          <div className="flex items-center gap-1"><button onClick={() => setEditingSignerId(editingSignerId === signer.id ? null : signer.id)} className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-indigo-600 transition-all" title="Edit Signer"><Pencil className="w-4 h-4" /></button><button onClick={() => { const updatedSigners = (formData.signers || []).filter(s => s.id !== signer.id); setFormData({ ...formData, signers: updatedSigners }); if (editingSignerId === signer.id) setEditingSignerId(null); }} className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-rose-600 transition-all" title="Remove Signer"><Trash2 className="w-4 h-4" /></button></div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <AnimatePresence mode="wait">
                    {editingSignerId && (
                      <motion.div key={editingSignerId} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-4 pt-4 border-t border-slate-100">
                        {(() => {
                           const signer = (formData.signers || []).find(s => s.id === editingSignerId);
                           if (!signer) return null;
                           const updateSigner = (updates: Partial<Signer>) => {
                             const updatedSigners = (formData.signers || []).map(s => s.id === editingSignerId ? { ...s, ...updates } : s);
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
                                 idType: updates.idType !== undefined ? updates.idType : signer.idType,
                                 idNumber: updates.idNumber !== undefined ? updates.idNumber : signer.idNumber,
                                 idIssueDate: updates.idIssueDate !== undefined ? updates.idIssueDate : signer.idIssueDate,
                                 idExpiration: updates.idExpiration !== undefined ? updates.idExpiration : signer.idExpiration,
                                 dob: updates.dob !== undefined ? updates.dob : signer.dob,
                               } : {}) 
                             });
                           };
                           return (
                             <div className="space-y-4">
                               <div className="grid grid-cols-2 gap-4"><div className="space-y-1"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">First Name</label><input type="text" value={signer.firstName || ""} onChange={(e) => updateSigner({ firstName: e.target.value })} className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all" /></div><div className="space-y-1"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Last Name</label><input type="text" value={signer.lastName || ""} onChange={(e) => updateSigner({ lastName: e.target.value })} className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all" /></div></div>
                               <div className="grid grid-cols-2 gap-4"><div className="space-y-1"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Email</label><input type="email" value={signer.email || ""} onChange={(e) => updateSigner({ email: e.target.value })} className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all" /></div><div className="space-y-1"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Phone</label><input type="tel" value={signer.phone || ""} onChange={(e) => updateSigner({ phone: e.target.value })} className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all" /></div></div>
                               <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Street Address</label><input type="text" value={signer.address || ""} onChange={(e) => updateSigner({ address: e.target.value })} className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all" /></div>
                               <div className="grid grid-cols-3 gap-4"><div className="space-y-1"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">City</label><input type="text" value={signer.city || ""} onChange={(e) => updateSigner({ city: e.target.value })} className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all" /></div><div className="space-y-1"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">State</label><input type="text" value={signer.state || ""} onChange={(e) => updateSigner({ state: e.target.value })} className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all" /></div><div className="space-y-1"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Zip</label><input type="text" value={signer.zip || ""} onChange={(e) => updateSigner({ zip: e.target.value })} className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all" /></div></div>
                               <div className="pt-4 border-t border-slate-100 space-y-4">
                                 <div className="grid grid-cols-2 gap-4">
                                   <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">ID Type</label><select value={signer.idType || ""} onChange={(e) => updateSigner({ idType: e.target.value })} className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all bg-white"><option value="">Select ID Type</option><option>NC Driver's License</option><option>Out-of-State Driver's License</option><option>US Passport</option><option>Military ID</option><option>State-Issued ID Card</option><option>Personal Knowledge</option><option>Credible Witness</option><option>Other</option></select></div>
                                   <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">ID Number</label><input type="text" value={signer.idNumber || ""} onChange={(e) => updateSigner({ idNumber: e.target.value })} className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all" /></div>
                                 </div>
                                 <div className="grid grid-cols-3 gap-4">
                                   <div className="space-y-1">
                                     <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Issue Date</label>
                                     <input 
                                       type="date" 
                                       value={signer.idIssueDate ? (signer.idIssueDate.includes('/') ? formatDateForInput(signer.idIssueDate) : signer.idIssueDate) : ""} 
                                       onChange={(e) => updateSigner({ idIssueDate: e.target.value })} 
                                       className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all" 
                                     />
                                   </div>
                                   <div className="space-y-1">
                                     <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Expire Date</label>
                                     <input 
                                       type="date" 
                                       value={signer.idExpiration ? (signer.idExpiration.includes('/') ? formatDateForInput(signer.idExpiration) : signer.idExpiration) : ""} 
                                       onChange={(e) => updateSigner({ idExpiration: e.target.value })} 
                                       className={cn(
                                         "w-full border rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 transition-all",
                                         signer.idExpiration && signer.idIssueDate && signer.idExpiration < signer.idIssueDate 
                                           ? "border-rose-300 focus:ring-rose-500/20 focus:border-rose-500 bg-rose-50" 
                                           : "border-slate-300 focus:ring-indigo-500/20 focus:border-indigo-500 bg-white"
                                       )}
                                     />
                                     {signer.idExpiration && signer.idIssueDate && signer.idExpiration < signer.idIssueDate && (
                                       <p className="text-[9px] text-rose-500 font-bold mt-0.5 ml-1">Cannot be before issue date</p>
                                     )}
                                   </div>
                                   <div className="space-y-1">
                                     <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Birthdate</label>
                                     <input 
                                       type="date" 
                                       value={signer.dob ? (signer.dob.includes('/') ? formatDateForInput(signer.dob) : signer.dob) : ""} 
                                       onChange={(e) => updateSigner({ dob: e.target.value })} 
                                       max={new Date().toISOString().split('T')[0]}
                                       className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all" 
                                     />
                                   </div>
                                 </div>
                                 <div className="pt-2 space-y-2">
                                    <input type="file" accept="image/*" capture="environment" className="hidden" ref={fileInputRef} onChange={handleScanLicense} />
                                    <button type="button" onClick={() => fileInputRef.current?.click()} disabled={isScanning} className={cn("flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-xs font-bold transition-all shadow-sm", isScanning ? "bg-slate-100 text-slate-400 cursor-not-allowed" : "bg-indigo-600 text-white hover:bg-indigo-700 active:scale-95 shadow-indigo-200 shadow-md")}>{isScanning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Camera className="w-3.5 h-3.5" />}Scan ID</button>
                                 </div>
                               </div>
                             </div>
                           );
                        })()}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              )}

              {activeTab === 'Documents' && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between"><label className="text-sm font-bold text-slate-700">Documents Signed:</label></div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-h-64 overflow-y-auto pr-2 custom-scrollbar">
                    {docGroups.map((group) => (
                      <div key={group.title} className="space-y-3">
                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-1">{group.title}</h4>
                        <div className="space-y-2">{group.items.map((item) => (<label key={item} className="flex items-center gap-2 cursor-pointer group"><input type="checkbox" checked={(formData.docs || []).includes(item)} onChange={() => toggleDoc(item)} className="rounded border-slate-300 text-sky-600 focus:ring-sky-500" /><span className="text-xs text-slate-600 group-hover:text-slate-900 transition-colors">{item}</span></label>))}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {activeTab === 'Contacts' && (
                <motion.div 
                  key="contacts-tab"
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  className="space-y-8"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 border border-blue-100">
                      <Phone className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-slate-900">Communication & Relationships</h3>
                      <p className="text-sm text-slate-500">Manage contact information and assign responsible entities for this journal entry.</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8 bg-slate-50/50 p-8 rounded-2xl border border-slate-100">
                    <div className="space-y-6">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Phone Number</label>
                        <div className="relative">
                          <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                          <input 
                            type="tel" 
                            value={formData.phone || ""}
                            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                            className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all bg-white" 
                            placeholder="(555) 000-0000"
                          />
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Email Address</label>
                        <div className="relative">
                          <X className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                          <input 
                            type="email" 
                            value={formData.email || ""}
                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                            className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all bg-white" 
                            placeholder="customer@example.com"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="space-y-6">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Signing Company</label>
                        <div className="relative">
                          <select 
                            value={formData.companyId || ""}
                            onChange={(e) => {
                              const company = companies.find(c => c.id === e.target.value);
                              setFormData({ 
                                ...formData, 
                                companyId: e.target.value, 
                                companyName: company?.companyName || "",
                                signingCompany: company?.companyName || ""
                              });
                            }}
                            className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all bg-white appearance-none cursor-pointer font-medium"
                          >
                            <option value="">Select a Company</option>
                            <option value="direct">Private Direct (No Company)</option>
                            {companies.sort((a, b) => a.companyName.localeCompare(b.companyName)).map(company => (
                              <option key={company.id} value={company.id}>
                                {company.companyName}
                              </option>
                            ))}
                          </select>
                          <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                            <ChevronRight className="w-4 h-4 text-slate-400 rotate-90" />
                          </div>
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Customer / Contact</label>
                        <div className="relative">
                          <select 
                            value={formData.customerId || ""}
                            onChange={(e) => {
                              const customer = customers.find(c => c.id === e.target.value);
                              setFormData({ 
                                ...formData, 
                                customerId: e.target.value, 
                                customerName: customer?.fullName || "",
                                customer: customer?.fullName || ""
                              });
                            }}
                            className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all bg-white appearance-none cursor-pointer font-medium"
                          >
                            <option value="">Select a Customer</option>
                            {customers.sort((a, b) => a.fullName.localeCompare(b.fullName)).map(customer => (
                              <option key={customer.id} value={customer.id}>
                                {customer.fullName}
                              </option>
                            ))}
                          </select>
                          <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                            <ChevronRight className="w-4 h-4 text-slate-400 rotate-90" />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              {activeTab === 'Invoice' && (
                <div className="space-y-6">
                  <div className="bg-slate-50 p-6 rounded-xl border border-slate-200">
                    <div className="flex justify-between items-center mb-6"><h3 className="font-bold text-slate-800 flex items-center gap-2"><Banknote className="w-5 h-5 text-emerald-600" />Fee Tracking & Billing</h3></div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                       <div><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Agreed Fee</label><div className="relative"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs">$</span><input type="number" value={formData.agreedFee || 0} onChange={(e) => updateProfitFields({ agreedFee: parseFloat(e.target.value), fee: parseFloat(e.target.value) })} className="w-full pl-7 pr-3 py-2 border border-slate-300 rounded text-sm font-bold outline-none focus:ring-1 focus:ring-sky-500" /></div></div>
                       <div><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Payment Method</label><select value={formData.paymentMethod || ""} onChange={(e) => setFormData({ ...formData, paymentMethod: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded text-sm outline-none focus:ring-1 focus:ring-sky-500 bg-white"><option value="">Select Method</option><option>Check</option><option>Direct Deposit / ACH</option><option>Zelle</option><option>Venmo</option><option>Cash</option></select></div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'Notes' && (
                <div className="space-y-4">
                  <p className="text-sm font-bold text-slate-700 block mb-2">Additional Notes / Signing Company:</p>
                  <textarea value={formData.notes || ""} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} placeholder="E.g. Rocket Closing, ServiceLink, Amrock... Also loan number, lender, etc." className="w-full h-48 border border-slate-300 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 resize-none transition-all shadow-sm" />
                </div>
              )}
            </AnimatePresence>
          </div>
        </div>

        <div className="mt-8 pt-6 border-t border-slate-100 flex items-center justify-between bg-white sticky bottom-0 z-10 w-full">
          <button type="button" onClick={handleBack} disabled={currentStep === 0} className={cn("flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold transition-all", currentStep === 0 ? "bg-slate-50 text-slate-300 cursor-not-allowed border border-slate-100" : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50")}><ChevronLeft className="w-4 h-4" /> Back</button>
          <div className="flex items-center gap-3">
            <button type="button" onClick={onClose} className="px-6 py-3 text-slate-400 hover:text-slate-600 text-sm font-bold uppercase tracking-wider">Discard</button>
            <button type="button" onClick={handleNext} className={cn("flex items-center gap-2 px-8 py-3 rounded-xl text-sm font-bold transition-all shadow-lg", currentStep === steps.length - 1 ? "bg-emerald-600 text-white hover:bg-emerald-700 shadow-emerald-200" : "bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-200")}>{currentStep === steps.length - 1 ? 'Commit to Journal' : 'Next Step'}{currentStep < steps.length - 1 && <ChevronRight className="w-4 h-4" />}{currentStep === steps.length - 1 && isSaving && <Loader2 className="w-4 h-4 animate-spin ml-2" />}</button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default NewJournalEntryModal;
