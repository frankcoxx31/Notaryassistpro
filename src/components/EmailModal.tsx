import { useState } from 'react';
import { X, Send, Mail, ChevronDown } from 'lucide-react';
import { Customer } from '../types';
import { auth } from '../firebase';

interface EmailModalProps {
  customer: Customer;
  onClose: () => void;
}

const TEMPLATES = [
  { id: 'custom', label: 'Custom Message' },
  { id: 'thank_you', label: 'Thank You' },
  { id: 'appointment_reminder', label: 'Appointment Reminder' },
  { id: 'new_service', label: 'New Service Announcement' },
  { id: 'general_outreach', label: 'General Outreach' },
];

const REMINDER_FIELDS = ['date', 'time', 'location', 'signingType'];

export default function EmailModal({ customer, onClose }: EmailModalProps) {
  const [templateId, setTemplateId] = useState('custom');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [reminderData, setReminderData] = useState({
    date: '', time: '', location: '', signingType: ''
  });
  const [status, setStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  const isReminder = templateId === 'appointment_reminder';

  async function handleSend() {
    if (!customer.email) {
      setErrorMsg('This customer has no email address on file.');
      setStatus('error');
      return;
    }

    let token = '';
    try {
      token = await auth.currentUser?.getIdToken() ?? '';
    } catch {
      setErrorMsg('Authentication error. Please log in again.');
      setStatus('error');
      return;
    }

    if (!token) {
      setErrorMsg('Not authenticated. Please log in again.');
      setStatus('error');
      return;
    }

    setStatus('sending');
    setErrorMsg('');

    try {
      const res = await fetch('/api/email/send-single', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          to: customer.email,
          toName: customer.fullName,
          customerId: customer.id,
          templateId: templateId === 'custom' ? null : templateId,
          subject,
          body,
          templateData: isReminder ? reminderData : {}
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to send');
      setStatus('success');
    } catch (err: any) {
      setErrorMsg(err.message || 'Something went wrong.');
      setStatus('error');
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <Mail className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-semibold text-slate-900">Send Email</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {status === 'success' ? (
          <div className="px-6 py-12 text-center">
            <div className="text-5xl mb-4">✅</div>
            <h3 className="text-lg font-semibold text-slate-900 mb-2">Email Sent!</h3>
            <p className="text-slate-500 mb-6">Your email to {customer.firstName} has been delivered.</p>
            <button
              onClick={onClose}
              className="bg-blue-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors"
            >
              Done
            </button>
          </div>
        ) : (
          <div className="px-6 py-5 space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">To</label>
              <div className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-600">
                {customer.fullName} &lt;{customer.email || 'No email on file'}&gt;
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Template</label>
              <div className="relative">
                <select
                  value={templateId}
                  onChange={e => {
                    setTemplateId(e.target.value);
                    setSubject('');
                    setBody('');
                  }}
                  className="w-full appearance-none bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 pr-8"
                >
                  {TEMPLATES.map(t => (
                    <option key={t.id} value={t.id}>{t.label}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2 top-2.5 w-4 h-4 text-slate-400 pointer-events-none" />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Subject {templateId !== 'custom' && <span className="text-slate-400 font-normal">(optional — uses template default)</span>}
              </label>
              <input
                type="text"
                value={subject}
                onChange={e => setSubject(e.target.value)}
                placeholder="Enter subject line..."
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {isReminder && (
              <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 space-y-3">
                <p className="text-xs font-medium text-blue-700 uppercase tracking-wide">Appointment Details</p>
                {REMINDER_FIELDS.map(field => (
                  <div key={field}>
                    <label className="block text-xs font-medium text-slate-600 mb-1 capitalize">{field}</label>
                    <input
                      type="text"
                      value={(reminderData as any)[field]}
                      onChange={e => setReminderData(prev => ({ ...prev, [field]: e.target.value }))}
                      placeholder={field === 'date' ? 'e.g. May 25, 2026' : field === 'time' ? 'e.g. 2:00 PM' : field === 'location' ? 'e.g. 123 Main St' : 'e.g. Loan Signing'}
                      className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                ))}
              </div>
            )}

            {(templateId === 'custom' || templateId === 'general_outreach' || templateId === 'new_service') && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Message</label>
                <textarea
                  value={body}
                  onChange={e => setBody(e.target.value)}
                  rows={5}
                  placeholder="Write your message here..."
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>
            )}

            {status === 'error' && (
              <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-600">
                {errorMsg}
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button
                onClick={onClose}
                className="flex-1 border border-slate-200 text-slate-600 rounded-lg py-2.5 text-sm font-medium hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSend}
                disabled={status === 'sending' || !customer.email}
                className="flex-1 bg-blue-600 text-white rounded-lg py-2.5 text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {status === 'sending' ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
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
          </div>
        )}
      </div>
    </div>
  );
}
