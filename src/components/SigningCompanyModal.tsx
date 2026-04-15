import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { X, Building2, Globe, Phone, Mail, MapPin, Tag, Star, CreditCard, Clock, FileText, Save } from 'lucide-react';
import { SigningCompany } from '../types';
import { cn } from '../lib/utils';

interface SigningCompanyModalProps {
  isOpen: boolean;
  onClose: () => void;
  company?: SigningCompany | null;
  onSave: (c: SigningCompany) => void;
  userId: string;
}

const SigningCompanyModal = ({ isOpen, onClose, company, onSave, userId }: SigningCompanyModalProps) => {
  const [formData, setFormData] = useState<Partial<SigningCompany>>({});
  const [activeTab, setActiveTab] = useState<'General' | 'Payment' | 'Notes'>('General');

  useEffect(() => {
    if (company) {
      setFormData(company);
    } else {
      setFormData({
        id: Math.random().toString(36).substr(2, 9),
        userId: userId,
        companyName: '',
        contactName: '',
        phone: '',
        email: '',
        website: '',
        address: '',
        notes: '',
        status: 'Active',
        companyType: 'Signing Company',
        preferredPaymentMethod: '',
        paymentTerms: '',
        tags: [],
        rating: 0,
        favorite: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    }
  }, [company, isOpen, userId]);

  if (!isOpen) return null;

  const handleSave = () => {
    if (formData.id && formData.companyName && formData.status) {
      onSave({
        ...formData,
        updatedAt: new Date().toISOString()
      } as SigningCompany);
    }
  };

  const toggleTag = (tag: string) => {
    const currentTags = formData.tags || [];
    if (currentTags.includes(tag)) {
      setFormData({ ...formData, tags: currentTags.filter(t => t !== tag) });
    } else {
      setFormData({ ...formData, tags: [...currentTags, tag] });
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-300">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="bg-white rounded-lg shadow-2xl w-full max-w-3xl overflow-hidden border border-slate-200 flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-white shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-sky-600 rounded-lg flex items-center justify-center shadow-lg shadow-sky-200">
              <Building2 className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-slate-800">{company ? 'Edit Signing Company' : 'New Signing Company'}</h2>
              <p className="text-xs text-slate-500 font-medium">Manage your relationship with this agency</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setFormData({ ...formData, favorite: !formData.favorite })}
              className={cn(
                "p-2 rounded-full transition-all",
                formData.favorite ? "text-amber-500 bg-amber-50" : "text-slate-300 hover:text-slate-400 hover:bg-slate-50"
              )}
            >
              <Star className={cn("w-6 h-6", formData.favorite && "fill-current")} />
            </button>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="px-6 border-b border-slate-100 bg-slate-50/50 flex items-center gap-6 shrink-0">
          {(['General', 'Payment', 'Notes'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                "py-3 text-xs font-bold uppercase tracking-widest border-b-2 transition-all",
                activeTab === tab 
                  ? "border-sky-600 text-sky-600" 
                  : "border-transparent text-slate-400 hover:text-slate-600"
              )}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
          {activeTab === 'General' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Company Name</label>
                    <div className="relative">
                      <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input 
                        type="text" 
                        value={formData.companyName || ''}
                        onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                        placeholder="Agency Name"
                        className="w-full pl-10 pr-3 py-2 border border-slate-300 rounded text-sm outline-none focus:ring-1 focus:ring-sky-500"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Contact Person</label>
                    <input 
                      type="text" 
                      value={formData.contactName || ''}
                      onChange={(e) => setFormData({ ...formData, contactName: e.target.value })}
                      placeholder="Main Contact Name"
                      className="w-full px-3 py-2 border border-slate-300 rounded text-sm outline-none focus:ring-1 focus:ring-sky-500"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Company Type</label>
                    <select 
                      value={formData.companyType || 'Signing Company'}
                      onChange={(e) => setFormData({ ...formData, companyType: e.target.value as any })}
                      className="w-full px-3 py-2 border border-slate-300 rounded text-sm outline-none focus:ring-1 focus:ring-sky-500 bg-white"
                    >
                      <option value="Signing Company">Signing Company</option>
                      <option value="Title Company">Title Company</option>
                      <option value="Law Firm">Law Firm</option>
                      <option value="Attorney">Attorney</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Status</label>
                    <select 
                      value={formData.status || 'Active'}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                      className="w-full px-3 py-2 border border-slate-300 rounded text-sm outline-none focus:ring-1 focus:ring-sky-500 bg-white"
                    >
                      <option value="Active">Active</option>
                      <option value="Watch">Watch</option>
                      <option value="Do Not Work With">Do Not Work With</option>
                      <option value="Inactive">Inactive</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Email Address</label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input 
                        type="email" 
                        value={formData.email || ''}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        placeholder="billing@agency.com"
                        className="w-full pl-10 pr-3 py-2 border border-slate-300 rounded text-sm outline-none focus:ring-1 focus:ring-sky-500"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Phone Number</label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input 
                        type="tel" 
                        value={formData.phone || ''}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        placeholder="(555) 000-0000"
                        className="w-full pl-10 pr-3 py-2 border border-slate-300 rounded text-sm outline-none focus:ring-1 focus:ring-sky-500"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Website / Portal</label>
                    <div className="relative">
                      <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input 
                        type="url" 
                        value={formData.website || ''}
                        onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                        placeholder="https://portal.agency.com"
                        className="w-full pl-10 pr-3 py-2 border border-slate-300 rounded text-sm outline-none focus:ring-1 focus:ring-sky-500"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Office Address</label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                  <textarea 
                    value={formData.address || ''}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    placeholder="123 Business Way, Suite 100..."
                    className="w-full pl-10 pr-3 py-2 border border-slate-300 rounded text-sm outline-none focus:ring-1 focus:ring-sky-500 min-h-[80px] resize-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Quick Tags</label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {['High Paying', 'Fast Payer', 'Slow Payer', 'Snapdocs', 'SigningOrder', 'Direct', 'Local'].map(tag => (
                    <button
                      key={tag}
                      onClick={() => toggleTag(tag)}
                      className={cn(
                        "px-3 py-1 rounded-full text-[10px] font-bold border transition-all",
                        (formData.tags || []).includes(tag)
                          ? "bg-sky-600 border-sky-600 text-white"
                          : "bg-white border-slate-200 text-slate-500 hover:border-sky-300 hover:text-sky-600"
                      )}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'Payment' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Preferred Payment Method</label>
                  <div className="relative">
                    <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <select 
                      value={formData.preferredPaymentMethod || ''}
                      onChange={(e) => setFormData({ ...formData, preferredPaymentMethod: e.target.value })}
                      className="w-full pl-10 pr-3 py-2 border border-slate-300 rounded text-sm outline-none focus:ring-1 focus:ring-sky-500 bg-white"
                    >
                      <option value="">Select Method</option>
                      <option value="Check">Check</option>
                      <option value="Direct Deposit">Direct Deposit / ACH</option>
                      <option value="Deluxe eCheck">Deluxe eCheck</option>
                      <option value="Zelle">Zelle</option>
                      <option value="Venmo">Venmo</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Payment Terms</label>
                  <div className="relative">
                    <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <select 
                      value={formData.paymentTerms || ''}
                      onChange={(e) => setFormData({ ...formData, paymentTerms: e.target.value })}
                      className="w-full pl-10 pr-3 py-2 border border-slate-300 rounded text-sm outline-none focus:ring-1 focus:ring-sky-500 bg-white"
                    >
                      <option value="">Select Terms</option>
                      <option value="Immediate">Immediate</option>
                      <option value="Net 7">Net 7</option>
                      <option value="Net 15">Net 15</option>
                      <option value="Net 30">Net 30</option>
                      <option value="Net 45">Net 45</option>
                      <option value="Net 60">Net 60</option>
                    </select>
                  </div>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Billing Instructions</label>
                <div className="relative">
                  <FileText className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                  <textarea 
                    value={formData.billingInstructions || ''}
                    onChange={(e) => setFormData({ ...formData, billingInstructions: e.target.value })}
                    placeholder="Enter specific billing requirements, portal upload instructions, etc."
                    className="w-full pl-10 pr-3 py-2 border border-slate-300 rounded text-sm outline-none focus:ring-1 focus:ring-sky-500 min-h-[120px] resize-none"
                  />
                </div>
              </div>

              <div className="bg-sky-50 p-4 rounded-lg border border-sky-100">
                <div className="flex items-start gap-3">
                  <Star className="w-5 h-5 text-sky-600 mt-0.5" />
                  <div>
                    <h4 className="text-sm font-bold text-sky-900">Payment Reliability</h4>
                    <p className="text-xs text-sky-700 mt-1">This score is automatically calculated based on your signing history with this company.</p>
                    <div className="flex items-center gap-1 mt-3">
                      {[1, 2, 3, 4, 5].map(star => (
                        <Star 
                          key={star} 
                          className={cn(
                            "w-4 h-4",
                            star <= (formData.rating || 0) ? "text-amber-500 fill-current" : "text-slate-300"
                          )} 
                        />
                      ))}
                      <span className="text-xs font-bold text-slate-500 ml-2">{(formData.rating || 0).toFixed(1)} / 5.0</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'Notes' && (
            <div className="space-y-4">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Internal Notes</label>
              <textarea 
                value={formData.notes || ''}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Add private notes about your experience with this company, portal logins, etc."
                className="w-full px-3 py-2 border border-slate-300 rounded text-sm outline-none focus:ring-1 focus:ring-sky-500 min-h-[300px] resize-none"
              />
            </div>
          )}
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
            className="bg-sky-600 hover:bg-sky-700 text-white px-8 py-2 rounded text-sm font-medium shadow-sm transition-colors flex items-center gap-2"
          >
            <Save className="w-4 h-4" />
            {company ? 'Update Company' : 'Save Company'}
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export default SigningCompanyModal;
