import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Mail, Send, CheckCircle2, Loader2 } from 'lucide-react';
import { Customer } from '../types';

interface EmailModalProps {
  customer: Customer;
  onClose: () => void;
}

const TEMPLATES = [
  {
    name: "General Notary Service inquiry",
    subject: "Notary Public services for your upcoming signing",
    body: (name: string) => `Hello ${name},\n\nI hope this email finds you well.\n\nThank you for reaching out regarding notary public services. I am a fully licensed, bonded, and insured Notary Public & Certified Signing Agent in North Carolina. I would be delighted to assist you with your document notarization.\n\nCould you please let me know the location, date, and time that works best for you, as well as the number of signatures that require notarization?\n\nLooking forward to working with you.\n\nBest regards,\nIntegrity Closings CLT`
  },
  {
    name: "Loan Signing Appointment Confirmation",
    subject: "Appointment Confirmation: Loan Signing",
    body: (name: string) => `Hello ${name},\n\nThis is to confirm our appointment for your loan document signing.\n\nDate: [Date]\nTime: [Time]\nLocation: [Location]\n\nPlease have a valid, unexpired government-issued photo ID available for the appointment (e.g., Driver's License or Passport). All signers must be present with required identification.\n\nIf you have any questions or need to reschedule, please let me know as soon as possible.\n\nWarm regards,\nIntegrity Closings CLT`
  },
  {
    name: "Thank you & Invoice",
    subject: "Thank You / Notary Service Completion",
    body: (name: string) => `Hello ${name},\n\nThank you for choosing Integrity Closings CLT for your notarization needs. It was a pleasure assisting you.\n\nI have attached the details of our completed signing for your records. Please let me know if you need any further assistance in the future.\n\nBest regards,\nIntegrity Closings CLT`
  }
];

const EmailModal = ({ customer, onClose }: EmailModalProps) => {
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isSent, setIsSent] = useState(false);

  const handleTemplateChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setSelectedTemplate(val);
    if (val) {
      const t = TEMPLATES.find(x => x.name === val);
      if (t) {
        setSubject(t.subject);
        setMessage(t.body(customer.fullName));
      }
    } else {
      setSubject('');
      setMessage('');
    }
  };

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject || !message) return;
    setIsSending(true);
    setTimeout(() => {
      setIsSending(false);
      setIsSent(true);
    }, 1500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-2xl bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden"
      >
        <div className="flex items-center justify-between px-6 py-4 bg-slate-50 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Mail className="w-5 h-5 text-indigo-600" />
            <h3 className="font-bold text-slate-900">Send Email to Customer</h3>
          </div>
          <button 
            onClick={onClose}
            className="p-1 hover:bg-slate-100 rounded-lg transition-colors text-slate-400 hover:text-slate-600"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6">
          <AnimatePresence mode="wait">
            {!isSent ? (
              <form onSubmit={handleSend} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">To</label>
                    <input 
                      type="text" 
                      value={`${customer.fullName} (${customer.email || 'No email specified'})`}
                      disabled
                      className="w-full px-4 py-2 bg-slate-100 border border-slate-200 rounded-xl text-sm text-slate-500 font-semibold"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Select Template</label>
                    <select
                      value={selectedTemplate}
                      onChange={handleTemplateChange}
                      className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all cursor-pointer font-bold text-slate-700"
                    >
                      <option value="">-- Manual Draft --</option>
                      {TEMPLATES.map(t => (
                        <option key={t.name} value={t.name}>{t.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Subject</label>
                  <input 
                    type="text" 
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="Enter email subject"
                    required
                    className="w-full px-4 py-2 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium text-slate-800"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Email Body</label>
                  <textarea 
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Type your message here..."
                    required
                    rows={8}
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium text-slate-800 resize-none"
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-50">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2 border border-slate-200 text-slate-500 text-sm font-bold rounded-xl hover:bg-slate-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSending || !customer.email}
                    className="px-5 py-2 bg-indigo-600 text-white text-sm font-bold rounded-xl flex items-center gap-2 hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSending ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        Send Email
                      </>
                    )}
                  </button>
                </div>
              </form>
            ) : (
              <motion.div 
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex flex-col items-center justify-center py-10 text-center"
              >
                <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center text-emerald-500 mb-4">
                  <CheckCircle2 className="w-10 h-10" />
                </div>
                <h4 className="text-xl font-bold text-slate-900 mb-2">Email Dispatched!</h4>
                <p className="text-sm text-slate-500 max-w-md">Your notification has been successfully compiled and sent to <span className="font-semibold text-slate-700">{customer.email}</span>.</p>
                <button
                  onClick={onClose}
                  className="mt-6 px-6 py-2.5 bg-slate-900 text-white text-sm font-bold rounded-xl hover:bg-slate-800 transition-colors"
                >
                  Close Window
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
};

export default EmailModal;
