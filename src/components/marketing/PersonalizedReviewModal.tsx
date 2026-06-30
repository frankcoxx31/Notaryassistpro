import React, { useState, useMemo, useEffect } from 'react';
import { X, Send, Loader2, Check, AlertTriangle, Sparkles, Eye } from 'lucide-react';
import { motion } from 'motion/react';
import { auth } from '../../firebase';
import { cn } from '../../lib/utils';

export interface OutreachDraft {
  customerId: string;
  fullName: string;
  email: string;
  company: string;
  practiceArea: string;
  subject: string;
  html: string;
  error?: string;
}

interface Props {
  isOpen: boolean;
  drafts: OutreachDraft[];
  campaignId: string | null;
  campaignName?: string;
  onClose: () => void;
  onSent: (sentCount: number) => void;
}

const PersonalizedReviewModal: React.FC<Props> = ({ isOpen, drafts, campaignId, campaignName, onClose, onSent }) => {
  const [rows, setRows] = useState<OutreachDraft[]>(drafts);
  const [approved, setApproved] = useState<Set<string>>(new Set());
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  // Re-seed local state whenever a fresh batch of drafts arrives.
  useEffect(() => {
    setRows(drafts);
    const ok = drafts.filter(d => !d.error && d.html && d.subject).map(d => d.customerId);
    setApproved(new Set(ok));
    setPreviewId(ok[0] ?? drafts[0]?.customerId ?? null);
    setError('');
  }, [drafts]);

  const previewDraft = useMemo(() => rows.find(r => r.customerId === previewId) || null, [rows, previewId]);
  const approvedCount = approved.size;
  const failedCount = rows.filter(r => r.error).length;

  if (!isOpen) return null;

  const toggle = (id: string) => {
    setApproved(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const setSubject = (id: string, subject: string) => {
    setRows(prev => prev.map(r => (r.customerId === id ? { ...r, subject } : r)));
  };

  const allSendable = rows.filter(r => !r.error && r.html);
  const toggleAll = () => {
    if (approved.size === allSendable.length) setApproved(new Set());
    else setApproved(new Set(allSendable.map(r => r.customerId)));
  };

  const handleSend = async () => {
    const toSend = rows.filter(r => approved.has(r.customerId) && r.html && r.subject);
    if (toSend.length === 0) { setError('Approve at least one email to send.'); return; }
    setSending(true);
    setError('');
    try {
      const token = await auth.currentUser?.getIdToken() ?? '';
      const res = await fetch('/api/email/send-personalized', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          campaignId,
          drafts: toSend.map(d => ({ customerId: d.customerId, email: d.email, subject: d.subject, html: d.html })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to send');
      onSent(data.sent || 0);
      alert(`Sent ${data.sent} personalized email${data.sent === 1 ? '' : 's'}${data.failed ? `, ${data.failed} failed` : ''}.`);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Something went wrong.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl h-[88vh] flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-600 text-white rounded-lg"><Sparkles className="w-5 h-5" /></div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">Review Personalized Emails</h2>
              <p className="text-xs text-slate-500 font-medium">
                {campaignName ? `${campaignName} — ` : ''}{approvedCount} approved of {rows.length}
                {failedCount > 0 && <span className="text-amber-600"> · {failedCount} failed</span>}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        {/* Body: list + preview */}
        <div className="flex-1 flex min-h-0">
          {/* Recipient list */}
          <div className="w-1/2 border-r border-slate-100 flex flex-col min-h-0">
            <div className="px-4 py-2 border-b border-slate-100 flex items-center justify-between bg-white">
              <button onClick={toggleAll} className="text-xs font-bold text-indigo-600 hover:text-indigo-700">
                {approved.size === allSendable.length ? 'Deselect all' : 'Select all'}
              </button>
              <span className="text-[11px] text-slate-400 font-medium">{allSendable.length} sendable</span>
            </div>
            <div className="flex-1 overflow-y-auto">
              {rows.map((r) => (
                <div
                  key={r.customerId}
                  className={cn(
                    'px-4 py-3 border-b border-slate-50 flex gap-3 items-start cursor-pointer',
                    previewId === r.customerId ? 'bg-indigo-50/60' : 'hover:bg-slate-50',
                  )}
                  onClick={() => setPreviewId(r.customerId)}
                >
                  <input
                    type="checkbox"
                    checked={approved.has(r.customerId)}
                    disabled={!!r.error || !r.html}
                    onChange={(e) => { e.stopPropagation(); toggle(r.customerId); }}
                    onClick={(e) => e.stopPropagation()}
                    className="mt-1 w-4 h-4 accent-indigo-600 disabled:opacity-40"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold text-slate-900 truncate">{r.fullName}</p>
                      <span className="text-[10px] font-bold uppercase tracking-wide text-indigo-500 bg-indigo-50 px-1.5 py-0.5 rounded shrink-0">{r.practiceArea}</span>
                    </div>
                    <p className="text-[11px] text-slate-400 truncate">{r.company || r.email}</p>
                    {r.error ? (
                      <p className="text-[11px] text-amber-600 flex items-center gap-1 mt-1"><AlertTriangle className="w-3 h-3" /> {r.error}</p>
                    ) : (
                      <input
                        value={r.subject}
                        onChange={(e) => setSubject(r.customerId, e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        placeholder="Subject line"
                        className="mt-1.5 w-full text-xs px-2 py-1 border border-slate-200 rounded-md focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                      />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Preview */}
          <div className="w-1/2 flex flex-col min-h-0 bg-slate-100">
            <div className="px-4 py-2 border-b border-slate-100 bg-white flex items-center gap-2 text-xs font-bold text-slate-500">
              <Eye className="w-3.5 h-3.5" /> Preview {previewDraft ? `— ${previewDraft.fullName}` : ''}
            </div>
            <div className="flex-1 overflow-hidden p-3">
              {previewDraft && previewDraft.html ? (
                <iframe
                  title="email-preview"
                  srcDoc={previewDraft.html}
                  sandbox=""
                  className="w-full h-full bg-white rounded-lg border border-slate-200"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-slate-400 text-sm">
                  {previewDraft?.error ? 'This draft failed to generate.' : 'Select a recipient to preview.'}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-3">
          {error ? <p className="text-sm text-red-600 font-medium">{error}</p> : <span className="text-xs text-slate-400">Edit subjects inline. Only approved rows are sent.</span>}
          <div className="flex items-center gap-3">
            <button onClick={onClose} disabled={sending} className="px-4 py-2 text-slate-500 text-sm font-bold hover:text-slate-700 transition-colors">
              Cancel
            </button>
            <button
              onClick={handleSend}
              disabled={sending || approvedCount === 0}
              className="flex items-center gap-2 px-6 py-2 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 active:scale-95 disabled:opacity-50"
            >
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              Send Approved ({approvedCount})
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default PersonalizedReviewModal;
