import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { 
  X, Edit2, MapPin, User, Calendar, Clock, 
  HelpCircle, CheckCircle2, Phone, Banknote, 
  List, Pencil 
} from 'lucide-react';
import { format } from 'date-fns';
import { Appointment, AppointmentStatus } from '../types';
import { cn } from '../lib/utils';

interface NewSigningModalProps {
  isOpen: boolean;
  onClose: () => void;
  appointment?: Appointment | null;
  onSave: (app: Appointment) => void;
  initialTab?: string;
  userId: string;
}

const NewSigningModal = ({ 
  isOpen, 
  onClose, 
  appointment, 
  onSave, 
  initialTab = 'Signer(s)',
  userId
}: NewSigningModalProps) => {
  const [activeTab, setActiveTab] = useState(initialTab);
  const [formData, setFormData] = useState<Partial<Appointment>>({});

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab, isOpen]);

  useEffect(() => {
    if (appointment) {
      const data = { ...appointment };
      // Derive first/last name if missing
      if (data.clientName && (!data.firstName || !data.lastName)) {
        const parts = data.clientName.trim().split(/\s+/);
        if (!data.firstName) data.firstName = parts[0] || '';
        if (!data.lastName) data.lastName = parts.slice(1).join(' ') || '';
      }
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
      setFormData({
        id: Math.random().toString(36).substr(2, 9),
        userId: userId,
        date: format(new Date(), 'yyyy-MM-dd'),
        time: '10:00 AM',
        signingType: 'General Loan Signing Work',
        fee: 150,
        status: 'Scheduled',
        clientName: '',
        location: ''
      });
    }
  }, [appointment, isOpen, userId]);

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
          {/* Main Form Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-4">
            {/* Left Column */}
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <label className="text-sm font-bold text-slate-700 w-20 text-right">Type:</label>
                <select 
                  value={formData.signingType || "General Loan Signing Work"}
                  onChange={(e) => setFormData({ ...formData, signingType: e.target.value })}
                  className="flex-1 bg-white border border-slate-300 rounded px-3 py-2 text-sm focus:ring-1 focus:ring-sky-500 outline-none transition-all"
                >
                  <option>General Loan Signing Work</option>
                  <option>Refinance</option>
                  <option>Purchase</option>
                  <option>Seller</option>
                  <option>HELOC</option>
                  <option>Reverse Mortgage</option>
                  <option>Loan Modification</option>
                  <option>Debt Settlement</option>
                  <option>Power of Attorney</option>
                  <option>Wills/Trusts</option>
                  <option>Other</option>
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
            </div>
          </div>


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
              <div className="flex-1 relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input 
                  type="text" 
                  value={formData.clientName || ""}
                  onChange={(e) => setFormData({ ...formData, clientName: e.target.value })}
                  className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded text-sm outline-none focus:ring-1 focus:ring-sky-500" 
                  placeholder="Name of Signer"
                />
              </div>
            </div>
          </div>

          {/* Status Section */}
          <div className="flex items-center gap-4">
            <label className="text-sm font-bold text-slate-700 w-20 text-right">Status:</label>
            <div className="flex-1 flex gap-2">
              {['Scheduled', 'Completed', 'Cancelled'].map((status) => (
                <button
                  key={status}
                  onClick={() => setFormData({ ...formData, status: status as AppointmentStatus })}
                  className={cn(
                    "flex-1 py-2 text-xs font-bold rounded border transition-all",
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
                    <input 
                      type="text" 
                      value={formData.customer || ""}
                      onChange={(e) => setFormData({ ...formData, customer: e.target.value })}
                      className="flex-1 border border-slate-300 rounded px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-sky-500" 
                      placeholder="e.g. Rocket Close"
                    />
                  </div>
                </div>
              )}
              {activeTab === 'Invoice' && (
                <div className="space-y-6">
                  <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="font-bold text-slate-800">Invoice Details</h3>
                      <span className={cn(
                        "px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider",
                        formData.status === 'Paid' ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"
                      )}>
                        {formData.status}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-slate-500 text-xs mb-1">Invoice Number</p>
                        <input 
                          type="text" 
                          value={formData.invoiceNumber || ""}
                          onChange={(e) => setFormData({ ...formData, invoiceNumber: e.target.value })}
                          className="w-full border border-slate-300 rounded px-2 py-1 text-sm outline-none focus:ring-1 focus:ring-sky-500"
                          placeholder="INV-000"
                        />
                      </div>
                      <div>
                        <p className="text-slate-500 text-xs mb-1">Fee Amount</p>
                        <p className="font-bold text-slate-900">${formData.fee?.toFixed(2)}</p>
                      </div>
                      <div>
                        <p className="text-slate-500 text-xs mb-1">Invoice Date</p>
                        <p className="font-bold text-slate-900">{formData.date}</p>
                      </div>
                      <div>
                        <p className="text-slate-500 text-xs mb-1">Invoice Sent Date</p>
                        <input 
                          type="date" 
                          value={formData.invoiceSentDate || ""}
                          onChange={(e) => setFormData({ ...formData, invoiceSentDate: e.target.value })}
                          className="w-full border border-slate-300 rounded px-2 py-1 text-sm outline-none focus:ring-1 focus:ring-sky-500"
                        />
                      </div>
                      <div>
                        <p className="text-slate-500 text-xs mb-1">Invoice Paid Date</p>
                        <input 
                          type="date" 
                          value={formData.invoicePaidDate || ""}
                          onChange={(e) => setFormData({ ...formData, invoicePaidDate: e.target.value })}
                          className="w-full border border-slate-300 rounded px-2 py-1 text-sm outline-none focus:ring-1 focus:ring-sky-500"
                        />
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    <div className="flex items-center gap-4">
                      <label className="text-sm font-bold text-slate-700 w-24 text-right">Status:</label>
                      <select 
                        value={formData.status || "Scheduled"}
                        onChange={(e) => setFormData({ ...formData, status: e.target.value as AppointmentStatus })}
                        className="flex-1 border border-slate-300 rounded px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-sky-500"
                      >
                        <option>Scheduled</option>
                        <option>Completed</option>
                        <option>Paid</option>
                        <option>Cancelled</option>
                        <option>No Show</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}
              {activeTab === 'Notes' && (
                <div className="space-y-4">
                  <label className="text-sm font-bold text-slate-700 block">Notes:</label>
                  <textarea 
                    value={formData.notes || ""}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="Add any special instructions or notes here..."
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
