import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, Edit2, MapPin, User, Calendar, Clock, 
  HelpCircle, CheckCircle2, Phone, Banknote, 
  List, Pencil, Plus, Trash2, Camera, Loader2, AlertCircle,
  Car, TrendingUp, PlusCircle, Upload, ChevronLeft, ChevronRight,
  FileText, ShieldCheck, Settings, Printer
} from 'lucide-react';
import { format, parse } from 'date-fns';
import { Appointment, AppointmentStatus, Customer, SigningCompany, Signer, BusinessProfile } from '../types';
import { cn } from '../lib/utils';
import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../firebase';
import SigningCompanyModal from './SigningCompanyModal';
import { IdentityVerificationModule } from './idv/IdentityVerificationModule';
import { printInvoice } from '../lib/invoiceUtils';

import { HYBRID_LOAN_PACKAGE, PACKAGE_CONFIGS, mergeUniqueDocuments, validateDocuments, normalizeDocName } from '../lib/packageConfigs';

interface NewSigningModalProps {
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
  businessProfile: BusinessProfile | null;
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

const TIME_SLOTS = [
  "6:00 AM", "6:30 AM", "7:00 AM", "7:30 AM", "8:00 AM", "8:30 AM", "9:00 AM", "9:30 AM",
  "10:00 AM", "10:30 AM", "11:00 AM", "11:30 AM", "12:00 PM", "12:30 PM", "1:00 PM", "1:30 PM",
  "2:00 PM", "2:30 PM", "3:00 PM", "3:30 PM", "4:00 PM", "4:30 PM", "5:00 PM", "5:30 PM",
  "6:00 PM", "6:30 PM", "7:00 PM", "7:30 PM", "8:00 PM", "8:30 PM", "9:00 PM", "9:30 PM", "10:00 PM"
];

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
  onSaveCompany,
  autoScan = false,
  businessProfile
}: NewSigningModalProps) => {
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
  
  const [verifyingSignerId, setVerifyingSignerId] = useState<string | null>(null);
  const [userName, setUserName] = useState<string>('Notary User'); // Fallback or dynamic
  
  const steps = [
    { name: 'Signer(s)', icon: User, description: 'Details & Contact' },
    { name: 'ID Verification', icon: ShieldCheck, description: 'NIST/AAMVA Check' },
    { name: 'Documents', icon: List, description: 'Act Details' },
    { name: 'Contacts', icon: Phone, description: 'Communication' },
    { name: 'Invoice', icon: Banknote, description: 'Fee & Billing' },
    { name: 'Notes', icon: Pencil, description: 'Final Remarks' },
    { name: 'Status', icon: CheckCircle2, description: 'Mark as Done' },
  ];
  const [isScanning, setIsScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [scanSuccess, setScanSuccess] = useState(false);
  const [packageLoadedMessage, setPackageLoadedMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadInputRef = useRef<HTMLInputElement>(null);

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
    console.log("[Scan] Upload flow triggered.");
    const file = e.target.files?.[0];
    if (!file) {
      console.log("[Scan] No file selected.");
      return;
    }

    console.log(`[Scan] File selected: ${file.name} (Type: ${file.type}, Size: ${file.size} bytes)`);

    if (!file.type.startsWith('image/')) {
      console.error("[Scan] Invalid file type:", file.type);
      setScanError("Please select a valid image file of your driver's license.");
      return;
    }

    // Limit to 10MB
    const MAX_SIZE = 10 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      console.error("[Scan] File too large:", file.size);
      setScanError("Image is too large. Please select a file under 10MB.");
      return;
    }

    setIsScanning(true);
    setScanError(null);
    setScanSuccess(false);

    try {
      // 1. Upload file to Firebase Storage
      const tks = Date.now();
      const path = `scan-images/${userId}/${tks}-${file.name.replace(/[^a-z0-9.]/gi, "_")}`;
      const sRef = ref(storage, path);
      
      console.log("[Scan] Uploading to storage...");
      await uploadBytes(sRef, file);
      const downloadURL = await getDownloadURL(sRef);
      console.log("[Scan] Upload complete. URL:", downloadURL);

      // 2. Call backend for extraction
      console.log("[Scan] Requesting server-side extraction...");
      const response = await fetch('/api/idv/process-document', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recordId: `scan_${tks}`, frontUrl: downloadURL })
      });

      if (!response.ok) {
        throw new Error("Server extraction failed.");
      }

      const { extractedData: result } = await response.json();
      console.log("[Scan] Server Extraction successful:", result);
      
      if (result && (result.fullName || result.firstName || result.lastName)) {
        const fullName = result.fullName || `${result.firstName || ""} ${result.lastName || ""}`.trim();
        const firstName = result.firstName || fullName.split(' ')[0] || "";
        const lastName = result.lastName || fullName.split(' ').slice(1).join(' ') || "";

        // Parse address to extract city, state, zip
        const addrParts = (result.address || "").split(',').map((p: string) => p.trim());
        let city = result.city || "";
        let state = result.state || "";
        let zip = result.zip || "";
        
        if (!city && addrParts.length > 1) {
          city = addrParts[1];
          const zipMatch = city.match(/\d{5}(-\d{4})?$/);
          if (zipMatch) {
            zip = zipMatch[0];
            city = city.replace(zipMatch[0], '').trim();
          }
        }

        setFormData(prev => {
          const updatedSigners = [...(prev.signers || [])];
          const signerIndex = updatedSigners.findIndex(s => s.id === editingSignerId);
          
          const signerData = {
            firstName,
            lastName,
            address: result.address || addrParts[0] || "",
            city: result.city || city,
            state: result.state || state,
            zip: result.zip || zip,
            idType: result.idType || (signerIndex !== -1 ? updatedSigners[signerIndex]?.idType : undefined) || "NC Driver's License",
            idNumber: result.idNumber || result.documentNumber || "",
            dob: formatDateForInput(result.dateOfBirth || result.dob || ""),
            idIssueDate: formatDateForInput(result.issueDate || ""),
            idExpiration: formatDateForInput(result.expirationDate || ""),
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
              clientName: fullName,
              firstName,
              lastName,
              address: result.address || addrParts[0] || "",
              city: result.city || city,
              state: result.state || state,
              zip: result.zip || zip
            } : {})
          };
        });

        setScanSuccess(true);
        setTimeout(() => setScanSuccess(false), 3000);
      } else {
        throw new Error("AI could not extract enough information. Please ensure the image is clear and try again.");
      }
    } catch (err: any) {
      console.error("[Scan] Full error details:", err);
      setScanError(err.message || "An unexpected error occurred while scanning.");
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
    const stepIdx = steps.findIndex(s => s.name === initialTab);
    if (stepIdx !== -1) setCurrentStep(stepIdx);
  }, [initialTab, isOpen]);

  useEffect(() => {
    if (appointment) {
      const data = { ...appointment };
      
      // Initialize actType if missing
      if (!data.actType) {
        data.actType = 'Acknowledgment';
      }

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
        scanbackStatus: 'Not Required',
        actType: 'Acknowledgment'
      });
    }
  }, [appointment, isOpen, userId]);

  if (!isOpen) return null;

  const updateProfitFields = (updates: Partial<Appointment>) => {
    const newData = { ...formData, ...updates };
    
    // Recalculate costs
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
      setSaveError(err.message || 'Failed to save signing');
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
        {/* Header */}
        <div className="flex items-center justify-between px-8 py-5 border-b border-slate-100 bg-white">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center border border-indigo-100/50 shadow-sm">
              <ShieldCheck className="w-6 h-6 text-indigo-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">{appointment ? 'Edit Signing' : 'Schedule New Signing'}</h2>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest leading-none mt-1">Professional Appointment</p>
            </div>
          </div>
          <div className="flex items-center gap-6">
            {/* Step Progress Indicators */}
            <div className="hidden lg:flex items-center gap-2 mr-6">
              {steps.map((step, idx) => (
                <div key={step.name} className="flex items-center">
                  <div 
                    title={step.name}
                    className={cn(
                      "w-2.5 h-2.5 rounded-full transition-all duration-300",
                      idx <= currentStep ? "bg-indigo-600 shadow-[0_0_8px_rgba(79,70,229,0.4)]" : "bg-slate-200"
                    )} 
                  ></div>
                  {idx < steps.length - 1 && (
                    <div className={cn(
                      "w-8 h-[2px] mx-1 transition-all duration-300",
                      idx < currentStep ? "bg-indigo-600" : "bg-slate-100"
                    )} ></div>
                  )}
                </div>
              ))}
            </div>
            <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-xl transition-all">
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-0 flex flex-col lg:flex-row min-h-0 bg-white">
          {/* Enhanced Tab Sidebar */}
          <div className="w-full lg:w-72 bg-slate-50/50 border-r border-slate-100 p-6 space-y-2 border-t lg:border-t-0">
             <div className="mb-6">
               <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-4">Workflow Progress</p>
               {steps.map((step, idx) => (
                 <button
                   key={step.name}
                   onClick={() => {
                     setCurrentStep(idx);
                     setActiveTab(step.name);
                   }}
                   className={cn(
                     "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group text-left",
                     activeTab === step.name 
                       ? "bg-white text-slate-900 shadow-sm border border-slate-200" 
                       : "text-slate-500 hover:bg-white/50"
                   )}
                 >
                   <div className={cn(
                     "w-8 h-8 rounded-lg flex items-center justify-center transition-colors",
                     activeTab === step.name ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-400 group-hover:bg-slate-200"
                   )}>
                     <step.icon className="w-4 h-4" />
                   </div>
                   <div>
                     <p className="text-xs font-bold leading-none mb-1">{step.name}</p>
                     <p className="text-[10px] text-slate-400 font-medium leading-none">{step.description}</p>
                   </div>
                 </button>
               ))}
             </div>

             {/* Appointment Summary Card */}
             <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Signing Details</label>
                  <p className="text-xs font-bold text-slate-800">{formData.date ? format(new Date(formData.date), 'MMMM d, yyyy') : 'No Date'}</p>
                  <p className="text-[10px] font-bold text-slate-500">{formData.time || '10:00 AM'}</p>
                </div>
                <div className="space-y-1 pt-3 border-t border-slate-100">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Type</label>
                  <p className="text-xs font-bold text-indigo-600">{formData.signingType || 'Loan Signing'}</p>
                </div>
             </div>
          </div>

          {/* Main Content Area */}
          <div className="flex-1 p-8 overflow-y-auto custom-scrollbar">
            <AnimatePresence mode="wait">
              {activeTab === 'Signer(s)' && (
                <motion.div 
                   key="signer-tab"
                   initial={{ opacity: 0, x: 10 }}
                   animate={{ opacity: 1, x: 0 }}
                   exit={{ opacity: 0, x: -10 }}
                   className="space-y-8"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 border border-indigo-100">
                      <User className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-slate-900">Signer Identification</h3>
                      <p className="text-sm text-slate-500">Capture principal information and identity verification method.</p>
                    </div>
                  </div>

                  {/* Basic Info Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4 bg-slate-50/50 p-6 rounded-2xl border border-slate-100">
                    <div className="space-y-4">
                      <div className="flex items-center gap-4">
                        <label className="text-xs font-bold text-slate-700 w-24 text-right">Date:</label>
                        <div className="flex-1 relative">
                          <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                          <input 
                            type="date" 
                            value={formData.date || ""}
                            onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                            className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all bg-white" 
                          />
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        <label className="text-xs font-bold text-slate-700 w-24 text-right">Time:</label>
                        <div className="flex-1 relative">
                          <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                          <select 
                            value={formData.time || "10:00 AM"}
                            onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                            className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all bg-white appearance-none cursor-pointer font-bold text-slate-900" 
                          >
                            {TIME_SLOTS.map(slot => (
                              <option key={slot} value={slot}>{slot}</option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        <label className="text-xs font-bold text-slate-700 w-24 text-right">Signing Type:</label>
                        <div className="flex-1 relative">
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
                    </div>

                    <div className="space-y-4">
                      <div className="flex items-center gap-4">
                        <label className="text-xs font-bold text-slate-700 w-24 text-right">Doc Type:</label>
                        <div className="flex-1 relative">
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

                      <div className="flex items-center gap-4">
                        <label className="text-xs font-bold text-slate-700 w-24 text-right">Notarial Act:</label>
                        <div className="flex-1 relative">
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

                      <div className="flex items-center gap-4">
                        <label className="text-xs font-bold text-slate-700 w-24 text-right">Location:</label>
                        <div className="flex-1 relative">
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
                  </div>
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

                                {(signer.idType !== "Personal Knowledge" && signer.idType !== "Credible Witness") && (
                                  <div className="pt-2 space-y-2">
                                    {signer.idImageUrl && (
                                      <div className="relative group rounded-xl overflow-hidden aspect-video bg-slate-100 border border-slate-200 mb-2">
                                         <img src={signer.idImageUrl} alt="License" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                         <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                           <p className="text-white text-[10px] font-bold">ID Scan Saved</p>
                                         </div>
                                      </div>
                                    )}
                                    <input 
                                      type="file" 
                                      accept="image/*" 
                                      capture="environment"
                                      className="hidden" 
                                      ref={fileInputRef}
                                      onChange={handleScanLicense}
                                    />
                                    <input 
                                      type="file" 
                                      accept="image/*" 
                                      className="hidden" 
                                      ref={uploadInputRef}
                                      onChange={handleScanLicense}
                                    />

                                    <div className="grid grid-cols-2 gap-2">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          console.log("[Scan] Scan ID (Camera) clicked.");
                                          fileInputRef.current?.click();
                                        }}
                                        disabled={isScanning}
                                        className={cn(
                                          "flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-xs font-bold transition-all shadow-sm",
                                          isScanning 
                                            ? "bg-slate-100 text-slate-400 cursor-not-allowed" 
                                            : "bg-indigo-600 text-white hover:bg-indigo-700 active:scale-95 shadow-indigo-200 shadow-md"
                                        )}
                                      >
                                        {isScanning ? (
                                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                        ) : (
                                          <Camera className="w-3.5 h-3.5" />
                                        )}
                                        Scan ID
                                      </button>

                                      <button
                                        type="button"
                                        onClick={() => {
                                          console.log("[Scan] Upload ID (Files) clicked.");
                                          uploadInputRef.current?.click();
                                        }}
                                        disabled={isScanning}
                                        className={cn(
                                          "flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-xs font-bold transition-all shadow-sm",
                                          isScanning 
                                            ? "bg-slate-100 text-slate-400 cursor-not-allowed" 
                                            : "bg-indigo-50 text-indigo-600 border border-indigo-100 hover:bg-indigo-100 active:scale-95 shadow-indigo-50 shadow-md"
                                        )}
                                      >
                                        {isScanning ? (
                                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                        ) : (
                                          <Upload className="w-3.5 h-3.5" />
                                        )}
                                        Upload ID
                                      </button>
                                    </div>

                                    {scanError && (
                                      <div className="flex items-center gap-2 p-2 bg-rose-50 text-rose-600 rounded-lg text-xs animate-in slide-in-from-top-1">
                                        <AlertCircle className="w-3.5 h-3.5" />
                                        <p>{scanError}</p>
                                      </div>
                                    )}

                                    {scanSuccess && (
                                      <div className="flex items-center gap-2 p-2 bg-emerald-50 text-emerald-600 rounded-lg text-xs animate-in slide-in-from-top-1">
                                        <CheckCircle2 className="w-3.5 h-3.5" />
                                        <p>Scan successful! Details added.</p>
                                      </div>
                                    )}
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
            </motion.div>
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
                      <p className="text-sm text-slate-500">Manage contact information and assign responsible entities.</p>
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

              {activeTab === 'ID Verification' && (
                <motion.div 
                   key="idv-tab"
                   initial={{ opacity: 0, x: 10 }}
                   animate={{ opacity: 1, x: 0 }}
                   exit={{ opacity: 0, x: -10 }}
                   className="space-y-6"
                >
                   <div className="flex items-center justify-between">
                     <div className="flex items-center gap-4">
                       <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600 border border-emerald-100">
                         <ShieldCheck className="w-5 h-5" />
                       </div>
                       <div>
                         <h3 className="text-lg font-bold text-slate-900">Identity Assurance</h3>
                         <p className="text-sm text-slate-500">Biometric and Document-based verification platform.</p>
                       </div>
                     </div>
                     
                     <div className="flex items-center gap-3">
                        <select 
                          className="bg-white border border-slate-200 rounded-xl px-4 py-2 text-sm font-bold shadow-sm outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all cursor-pointer"
                          value={verifyingSignerId || ""}
                          onChange={(e) => setVerifyingSignerId(e.target.value)}
                        >
                          <option value="">Select Signer to Verify</option>
                          {(formData.signers || []).map(s => (
                            <option key={s.id} value={s.id}>{s.firstName} {s.lastName}</option>
                          ))}
                        </select>
                        <button className="p-2 hover:bg-slate-100 rounded-xl transition-colors text-slate-400">
                          <Settings className="w-5 h-5" />
                        </button>
                     </div>
                   </div>

                   {verifyingSignerId ? (
                     <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <IdentityVerificationModule 
                           signerId={verifyingSignerId}
                           appointmentId={formData.id || 'new'}
                           userId={userId}
                           userName={userName}
                           isAdmin={true}
                        />
                     </div>
                   ) : (
                     <div className="py-24 flex flex-col items-center justify-center bg-slate-50 rounded-[40px] border-2 border-dashed border-slate-200 space-y-4">
                        <div className="w-20 h-20 bg-white rounded-3xl flex items-center justify-center shadow-xl shadow-slate-200/50">
                           <User className="w-10 h-10 text-slate-300" />
                        </div>
                        <div className="text-center max-w-xs">
                           <h4 className="text-lg font-black text-slate-900 uppercase tracking-tight">Select a Signer</h4>
                           <p className="text-sm text-slate-500 font-medium leading-relaxed">Choose a signer from the list above to begin the multi-stage identity verification process.</p>
                        </div>
                        <div className="flex items-center gap-3 mt-4">
                           <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white rounded-full border border-slate-200 shadow-sm">
                              <span className="w-2 h-2 rounded-full bg-emerald-500" />
                              <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">AAMVA Ready</span>
                           </div>
                           <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white rounded-full border border-slate-200 shadow-sm">
                              <span className="w-2 h-2 rounded-full bg-indigo-500" />
                              <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">NIST IAL2</span>
                           </div>
                        </div>
                     </div>
                   )}
                </motion.div>
              )}
              {activeTab === 'Invoice' && (
                <motion.div 
                  key="invoice-tab"
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  className="space-y-6"
                >
                  <div className="bg-slate-50 p-6 rounded-xl border border-slate-200">
                    <div className="flex justify-between items-center mb-6">
                      <h3 className="font-bold text-slate-800 flex items-center gap-2">
                        <Banknote className="w-5 h-5 text-emerald-600" />
                        Fee Tracking & Billing
                      </h3>
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={() => printInvoice(formData as Appointment, businessProfile)}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 text-slate-700 rounded-lg text-[10px] font-black uppercase tracking-wider hover:bg-slate-50 transition-all shadow-sm"
                        >
                          <Printer className="w-3.5 h-3.5" />
                          Print Invoice
                        </button>
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
                </motion.div>
              )}
              {activeTab === 'Documents' && (
                <motion.div 
                  key="documents-tab"
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  className="space-y-6"
                >
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
                                  type="button"
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
                              type="button"
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
                </motion.div>
              )}
              {activeTab === 'Notes' && (
                <motion.div 
                  key="notes-tab"
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  className="space-y-4"
                >
                  <p className="text-sm font-bold text-slate-700 block mb-2">Additional Notes / Signing Company:</p>
                  <textarea 
                    value={formData.notes || ""}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="E.g. Rocket Closing, ServiceLink, Amrock... Also loan number, lender, etc."
                    className="w-full h-48 border border-slate-300 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 resize-none transition-all shadow-sm"
                  />
                </motion.div>
              )}
              {activeTab === 'Status' && (
                <motion.div 
                  key="status-tab"
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  className="space-y-8"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center border border-emerald-100 shadow-sm">
                      <CheckCircle2 className="w-6 h-6 text-emerald-600" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-slate-900">Final Step: Complete Signing</h3>
                      <p className="text-sm text-slate-500">Update the final status and record collection of payment.</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-50/50 p-8 rounded-3xl border border-slate-100 shadow-inner">
                    <div className="space-y-6">
                      <div className="space-y-3">
                        <label className="text-xs font-bold text-slate-700 block ml-1">Current Status</label>
                        <div className="flex flex-wrap gap-2">
                          {['Scheduled', 'Completed', 'Cancelled', 'No Show'].map((s) => (
                            <button
                              key={s}
                              type="button"
                              onClick={() => setFormData({ ...formData, status: s as any })}
                              className={cn(
                                "px-4 py-2 rounded-xl text-xs font-bold transition-all border",
                                formData.status === s 
                                  ? "bg-slate-900 text-white border-slate-900 shadow-md" 
                                  : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"
                              )}
                            >
                              {s}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="pt-4 space-y-4">
                        <div className="flex items-center justify-between p-4 bg-white rounded-2xl border border-slate-100 shadow-sm">
                          <div>
                            <p className="text-sm font-bold text-slate-800">Payment Collected?</p>
                            <p className="text-[10px] text-slate-500 font-medium">Was payment received at the table?</p>
                          </div>
                          <button 
                            type="button"
                            onClick={() => {
                              const isPaid = formData.paymentStatus !== 'Paid';
                              setFormData({ 
                                ...formData, 
                                paymentStatus: isPaid ? 'Paid' : 'Not Sent',
                                amountCollected: isPaid ? (formData.agreedFee || formData.fee || 0) : 0,
                                paymentReceivedDate: isPaid ? new Date().toISOString().split('T')[0] : ''
                              });
                            }}
                            className={cn(
                              "w-12 h-6 rounded-full transition-all relative",
                              formData.paymentStatus === 'Paid' ? "bg-emerald-500" : "bg-slate-300"
                            )}
                          >
                            <div className={cn(
                              "absolute top-1 w-4 h-4 bg-white rounded-full transition-all",
                              formData.paymentStatus === 'Paid' ? "left-7" : "left-1"
                            )} />
                          </button>
                        </div>

                        {formData.paymentStatus === 'Paid' && (
                          <div className="space-y-1.5 animate-in slide-in-from-top-2 duration-300">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Amount Collected</label>
                            <div className="relative">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
                              <input 
                                type="number" 
                                value={formData.amountCollected || 0}
                                onChange={(e) => setFormData({ ...formData, amountCollected: parseFloat(e.target.value) })}
                                className="w-full pl-8 pr-4 py-3 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all bg-white" 
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col items-center justify-center space-y-4 text-center">
                       <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center text-blue-600 mb-2">
                          <HelpCircle className="w-8 h-8" />
                       </div>
                       <div className="space-y-1">
                          <h4 className="font-bold text-slate-900">Ready to Finalize?</h4>
                          <p className="text-xs text-slate-500 leading-relaxed px-4">Ensure all documents are verified and identity information is correct before marking as complete.</p>
                       </div>
                       <button 
                         type="button"
                         onClick={handleSave}
                         className="w-full mt-4 bg-emerald-600 hover:bg-emerald-700 text-white font-black py-4 rounded-2xl shadow-lg shadow-emerald-200 transition-all flex items-center justify-center gap-2 active:scale-[0.98]"
                       >
                         <CheckCircle2 className="w-5 h-5" />
                         Finish & Mark Complete
                       </button>
                    </div>
                  </div>
                </motion.div>
              )}
              {activeTab !== 'Signer(s)' && activeTab !== 'ID Verification' && activeTab !== 'Notes' && activeTab !== 'Contacts' && activeTab !== 'Invoice' && activeTab !== 'Documents' && activeTab !== 'Status' && (
                <div className="py-12 text-center text-slate-400 italic">
                  Content for {activeTab} tab will be implemented soon.
                </div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Sticky Footer for Navigation */}
        <div className="mt-8 pt-6 border-t border-slate-100 flex items-center justify-between bg-white sticky bottom-0 z-10 w-full">
          <button
            type="button"
            onClick={handleBack}
            disabled={currentStep === 0}
            className={cn(
              "flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold transition-all",
              currentStep === 0 
                ? "bg-slate-50 text-slate-300 cursor-not-allowed border border-slate-100" 
                : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
            )}
          >
            <ChevronLeft className="w-4 h-4" /> Back
          </button>
          
          <div className="flex items-center gap-3">
            <button 
              type="button"
              onClick={onClose}
              className="hidden md:block px-6 py-3 text-slate-400 hover:text-slate-600 text-sm font-bold uppercase tracking-wider"
            >
              Discard
            </button>
            <button
              type="button"
              onClick={handleNext}
              className={cn(
                "flex items-center gap-2 px-8 py-3 rounded-xl text-sm font-bold transition-all shadow-lg",
                currentStep === steps.length - 1
                  ? "bg-emerald-600 text-white hover:bg-emerald-700 shadow-emerald-200"
                  : "bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-200"
              )}
            >
              {currentStep === steps.length - 1 ? 'Schedule Signing' : 'Next Step'}
              {currentStep < steps.length - 1 && <ChevronRight className="w-4 h-4" />}
              {currentStep === steps.length - 1 && isSaving && <Loader2 className="w-4 h-4 animate-spin ml-2" />}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default NewSigningModal;
