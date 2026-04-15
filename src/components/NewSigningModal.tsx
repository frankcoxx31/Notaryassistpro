import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, Edit2, MapPin, User, Calendar, Clock, 
  HelpCircle, CheckCircle2, Phone, Banknote, 
  List, Pencil, Plus, Trash2, Camera, Loader2, AlertCircle,
  Car, TrendingUp, PlusCircle
} from 'lucide-react';
import { format, parse } from 'date-fns';
import { Appointment, AppointmentStatus, Customer, SigningCompany } from '../types';
import { cn } from '../lib/utils';
import { GoogleGenAI, Type } from "@google/genai";
import SigningCompanyModal from './SigningCompanyModal';

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

const DEFAULT_MILEAGE_RATE = 0.67;

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
  
  // Scanner state
  const [isScanning, setIsScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [scanSuccess, setScanSuccess] = useState(false);
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

  const handleScanLicense = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

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

      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      
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

        setFormData(prev => ({
          ...prev,
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
        }));
        setScanSuccess(true);
      } else {
        throw new Error("Could not extract data");
      }
    } catch (error) {
      console.error("Scan error:", error);
      setScanError("Could not read license. Please enter information manually.");
    } finally {
      setIsScanning(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const docGroups = [
    {
      title: 'Loan Signing Documents',
      items: [
        'Closing / Disbursement Instructions',
        'Title Company Client Acknowledgement (Owner\'s Affidavit)',
        'Loan Proceeds Delivery Instructions',
        'Correction Agreement',
        'Identity Verification & Acknowledgment Certification',
        'Deed of Trust / Mortgage / Security Instrument',
        'Note',
        'Occupancy Statement',
        'Signature / Name Affidavit (Borrower)',
        'Signature / Name Affidavit (Non-Borrowing Party)',
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

  const uniqueCustomers = React.useMemo(() => {
    const fromAppointments = appointments.map(a => a.customerName).filter(Boolean) as string[];
    const fromDatabase = customers.map(c => c.fullName);
    const unique = new Set([...fromAppointments, ...fromDatabase]);
    return Array.from(unique).sort();
  }, [appointments, customers]);

  const uniqueCompanies = React.useMemo(() => {
    const fromAppointments = appointments.map(a => a.companyName).filter(Boolean) as string[];
    const fromDatabase = companies.map(c => c.companyName);
    const defaults = ['Rocket Close', 'Snapdocs', 'Amrock', 'ServiceLink', 'Xome', 'Signature Closings', 'Bancserv'];
    
    const combined = [...defaults, ...fromAppointments, ...fromDatabase];
    const unique = new Set(combined);
    return Array.from(unique).sort();
  }, [appointments, companies]);

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
      // Initialize fee tracking fields if missing
      if (data.agreedFee === undefined) data.agreedFee = data.fee || 0;
      if (data.offeredFee === undefined) data.offeredFee = data.agreedFee;
      if (data.amountCollected === undefined) data.amountCollected = 0;
      if (data.amountOutstanding === undefined) data.amountOutstanding = (data.agreedFee || 0) - (data.amountCollected || 0);
      if (!data.paymentStatus) {
        if (data.status === 'Paid') data.paymentStatus = 'Paid';
        else data.paymentStatus = 'Not Sent';
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
        signingType: 'General Loan Signing Work',
        fee: 150,
        agreedFee: 150,
        offeredFee: 150,
        amountCollected: 0,
        amountOutstanding: 150,
        paymentStatus: 'Not Sent',
        invoiceSent: false,
        status: 'Scheduled',
        customerName: '',
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
        roundTripMiles: true
      });
    }
  }, [appointment, isOpen, userId]);

  if (!isOpen) return null;

  const handleSave = () => {
    if (formData.id && formData.date && formData.time && formData.customerName && formData.signingType && formData.location && formData.fee !== undefined && formData.status) {
      if (!formData.docs || formData.docs.length === 0) {
        setShowDocError(true);
        setActiveTab('Documents');
        return;
      }
      
      // Ensure fee and agreedFee are in sync
      const finalData = { 
        ...formData, 
        fee: formData.agreedFee || formData.fee || 0,
        agreedFee: formData.agreedFee || formData.fee || 0
      };
      
      onSave(finalData as Appointment);
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
    const newDocs = currentDocs.includes(doc)
      ? currentDocs.filter(d => d !== doc)
      : [...currentDocs, doc];
    setFormData({ ...formData, docs: newDocs });
    if (newDocs.length > 0) setShowDocError(false);
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
          {/* Main Form Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-4">
            {/* Left Column */}
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <label className="text-sm font-bold text-slate-700 w-20 text-right">Type:</label>
                <select 
                  value={formData.signingType || "Loan Signing — Refinance"}
                  onChange={(e) => setFormData({ ...formData, signingType: e.target.value })}
                  className="flex-1 bg-white border border-slate-300 rounded px-3 py-2 text-sm focus:ring-1 focus:ring-sky-500 outline-none transition-all"
                >
                  <optgroup label="Loan Signings">
                    <option>Loan Signing — Refinance</option>
                    <option>Loan Signing — Purchase (Buyer)</option>
                    <option>Loan Signing — Seller Package</option>
                    <option>Loan Signing — HELOC</option>
                    <option>Loan Signing — Reverse Mortgage</option>
                  </optgroup>
                  <optgroup label="Traditional Acts">
                    <option>Acknowledgment</option>
                    <option>Jurat/Oath</option>
                    <option>Verification/Proof</option>
                    <option>Signature Witnessing</option>
                    <option>Copy Certification</option>
                    <option>Inventory of Safe Deposit Box</option>
                    <option>Other</option>
                  </optgroup>
                </select>
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
              setFormData({ ...formData, signingCompany: c.companyName, companyId: c.id });
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
                    list="customer-list"
                    value={formData.customerName || ""}
                    onChange={(e) => {
                      const selectedName = e.target.value;
                      const customer = customers.find(c => c.fullName === selectedName);
                      if (customer) {
                        setFormData({ 
                          ...formData, 
                          customerName: selectedName,
                          customerId: customer.id,
                          firstName: customer.firstName,
                          lastName: customer.lastName,
                          email: customer.email,
                          phone: customer.phone,
                          address: customer.address,
                          city: customer.city,
                          state: customer.state,
                          zip: customer.zip,
                          location: `${customer.address}, ${customer.city}, ${customer.state} ${customer.zip}`
                        });
                      } else {
                        setFormData({ ...formData, customerName: selectedName });
                      }
                    }}
                    className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded text-sm outline-none focus:ring-1 focus:ring-sky-500" 
                    placeholder="Name of Signer"
                  />
                  <datalist id="customer-list">
                    {uniqueCustomers.map(name => (
                      <option key={name} value={name} />
                    ))}
                  </datalist>
                </div>
              </div>
            </div>
          </div>

          {/* Status Section */}
          <div className="flex items-center gap-4">
            <label className="text-sm font-bold text-slate-700 w-20 text-right">Status:</label>
            <div className="flex-1 flex gap-2 flex-wrap">
              {['Scheduled', 'Completed', 'Paid', 'Cancelled', 'No Show'].map((status) => (
                <button
                  key={status}
                  onClick={() => setFormData({ ...formData, status: status as AppointmentStatus })}
                  className={cn(
                    "flex-1 min-w-[80px] py-2 text-[10px] font-bold rounded border transition-all",
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
                      onChange={(e) => setFormData({ ...formData, lastName: e.target.value, customerName: `${formData.firstName || ''} ${e.target.value}`.trim() })}
                      className="flex-1 border border-slate-300 rounded px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-sky-500" 
                    />
                  </div>
                  <div className="flex items-center gap-4">
                    <label className="text-sm font-bold text-slate-700 w-24 text-right">First Name:</label>
                    <input 
                      type="text" 
                      value={formData.firstName || ""}
                      onChange={(e) => setFormData({ ...formData, firstName: e.target.value, customerName: `${e.target.value} ${formData.lastName || ''}`.trim() })}
                      className="flex-1 border border-slate-300 rounded px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-sky-500" 
                    />
                  </div>
                  <div className="flex items-center gap-4">
                    <label className="text-sm font-bold text-slate-700 w-24 text-right">Address:</label>
                    <input 
                      type="text" 
                      value={formData.address || ""}
                      onChange={(e) => {
                        const newAddress = e.target.value;
                        setFormData({ 
                          ...formData, 
                          address: newAddress, 
                          location: `${newAddress}, ${formData.city || ''}${formData.state ? `, ${formData.state}` : ''}${formData.zip ? ` ${formData.zip}` : ''}`.trim() 
                        });
                      }}
                      className="flex-1 border border-slate-300 rounded px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-sky-500" 
                    />
                  </div>
                  <div className="flex items-center gap-4">
                    <label className="text-sm font-bold text-slate-700 w-24 text-right">City:</label>
                    <input 
                      type="text" 
                      value={formData.city || ""}
                      onChange={(e) => {
                        const newCity = e.target.value;
                        setFormData({ 
                          ...formData, 
                          city: newCity, 
                          location: `${formData.address || ''}, ${newCity}${formData.state ? `, ${formData.state}` : ''}${formData.zip ? ` ${formData.zip}` : ''}`.trim() 
                        });
                      }}
                      className="flex-1 border border-slate-300 rounded px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-sky-500" 
                    />
                  </div>
                  <div className="flex items-center gap-4">
                    <label className="text-sm font-bold text-slate-700 w-24 text-right">State:</label>
                    <select 
                      value={formData.state || "North Carolina"}
                      onChange={(e) => {
                        const newState = e.target.value;
                        setFormData({ 
                          ...formData, 
                          state: newState, 
                          location: `${formData.address || ''}, ${formData.city || ''}, ${newState}${formData.zip ? ` ${formData.zip}` : ''}`.trim() 
                        });
                      }}
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
                      onChange={(e) => {
                        const newZip = e.target.value;
                        setFormData({ 
                          ...formData, 
                          zip: newZip, 
                          location: `${formData.address || ''}, ${formData.city || ''}${formData.state ? `, ${formData.state}` : ''}${newZip ? ` ${newZip}` : ''}`.trim() 
                        });
                      }}
                      className="flex-1 border border-slate-300 rounded px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-sky-500" 
                    />
                  </div>

                  <div className="pt-4 border-t border-slate-100 mt-4 space-y-4">
                    <div className="flex items-center gap-4">
                      <label className="text-sm font-bold text-slate-700 w-24 text-right">ID Type:</label>
                      <select 
                        value={formData.idType || ""}
                        onChange={(e) => setFormData({ ...formData, idType: e.target.value })}
                        className="flex-1 border border-slate-300 rounded px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-sky-500 bg-white"
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

                    {(formData.idType === "NC Driver's License" || formData.idType === "Out-of-State Driver's License") && (
                      <div className="flex flex-col gap-2 ml-24">
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
                            "flex items-center justify-center gap-2 px-4 py-2 rounded text-sm font-bold transition-all shadow-sm",
                            isScanning 
                              ? "bg-slate-100 text-slate-400 cursor-not-allowed" 
                              : "bg-indigo-600 text-white hover:bg-indigo-700 active:scale-95"
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
                        <p className="text-[10px] text-slate-400 italic">
                          License image is used for field extraction only and is never stored.
                        </p>
                        
                        <AnimatePresence>
                          {scanSuccess && (
                            <motion.div 
                              initial={{ opacity: 0, y: -10 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0 }}
                              className="flex items-center gap-2 text-emerald-600 text-[11px] font-bold bg-emerald-50 p-2 rounded border border-emerald-100"
                            >
                              <CheckCircle2 className="w-3 h-3" />
                              License scanned successfully — please verify all fields.
                            </motion.div>
                          )}
                          {scanError && (
                            <motion.div 
                              initial={{ opacity: 0, y: -10 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0 }}
                              className="flex items-center gap-2 text-rose-600 text-[11px] font-bold bg-rose-50 p-2 rounded border border-rose-100"
                            >
                              <AlertCircle className="w-3 h-3" />
                              {scanError}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    )}

                    <div className="flex items-center gap-4">
                      <label className="text-sm font-bold text-slate-700 w-24 text-right">ID Number:</label>
                      <input 
                        type="text" 
                        value={formData.idNumber || ""}
                        onChange={(e) => setFormData({ ...formData, idNumber: e.target.value })}
                        className="flex-1 border border-slate-300 rounded px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-sky-500" 
                      />
                    </div>

                    <div className="flex items-center gap-4">
                      <label className="text-sm font-bold text-slate-700 w-24 text-right">ID Expiration:</label>
                      <input 
                        type="date" 
                        value={formData.idExpiration || ""}
                        onChange={(e) => setFormData({ ...formData, idExpiration: e.target.value })}
                        className="flex-1 border border-slate-300 rounded px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-sky-500" 
                      />
                    </div>

                    {(formData.idType === "NC Driver's License" || formData.idType === "Out-of-State Driver's License") && (
                      <motion.div 
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        className="space-y-4"
                      >
                        <div className="flex items-center gap-4">
                          <label className="text-sm font-bold text-slate-700 w-24 text-right">Date of Birth:</label>
                          <input 
                            type="date" 
                            value={formData.dob || ""}
                            onChange={(e) => setFormData({ ...formData, dob: e.target.value })}
                            className="flex-1 border border-slate-300 rounded px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-sky-500" 
                          />
                        </div>

                        <div className="flex items-center gap-4">
                          <label className="text-sm font-bold text-slate-700 w-24 text-right">ID Issue Date:</label>
                          <div className="flex-1 flex items-center gap-2">
                            <input 
                              type="date" 
                              value={formData.idIssueDate || ""}
                              onChange={(e) => setFormData({ ...formData, idIssueDate: e.target.value })}
                              className="flex-1 border border-slate-300 rounded px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-sky-500" 
                            />
                            <span className="text-[10px] font-bold text-slate-400 uppercase">DL Only</span>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </div>
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
