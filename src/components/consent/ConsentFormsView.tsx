import React, { useEffect, useMemo, useState } from 'react';
import {
  FileSignature, Plus, Search, Send, Ban, Eye, CheckCircle2, Clock, MailOpen,
  AlertCircle, X, Loader2, Printer,
} from 'lucide-react';
import { consentService } from '../../services/consentService';
import ConsentFormModal from './ConsentFormModal';
import type { ConsentForm, ConsentFormStatus } from '../../types/consent';
import type { BusinessProfile, Customer } from '../../types';

const STATUS_STYLES: Record<ConsentFormStatus, { label: string; cls: string; Icon: React.ElementType }> = {
  draft:    { label: 'Draft',     cls: 'bg-slate-100 text-slate-600',     Icon: Clock },
  sent:     { label: 'Sent',      cls: 'bg-blue-50 text-blue-700',        Icon: Send },
  viewed:   { label: 'Viewed',    cls: 'bg-amber-50 text-amber-700',      Icon: MailOpen },
  signed:   { label: 'Signed',    cls: 'bg-emerald-50 text-emerald-700',  Icon: CheckCircle2 },
  declined: { label: 'Declined',  cls: 'bg-rose-50 text-rose-700',        Icon: Ban },
  voided:   { label: 'Voided',    cls: 'bg-slate-100 text-slate-500',     Icon: Ban },
  expired:  { label: 'Expired',   cls: 'bg-slate-100 text-slate-500',     Icon: Clock },
};

function formatDate(iso?: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
  });
}

/** Read-only view of one form, including the signature and audit trail. */
const ConsentDetail: React.FC<{ form: ConsentForm; onClose: () => void }> = ({ form, onClose }) => {
  const print = () => {
    const win = window.open('', '_blank', 'width=820,height=900');
    if (!win) return;
    win.document.write(`<!DOCTYPE html><html><head><title>${form.documentTitle || form.templateName}</title>
      <style>body{margin:0;padding:36px;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;color:#0f172a;}</style>
      </head><body>${form.renderedHtml || ''}${
        form.signature
          ? `<div style="margin-top:28px;padding-top:16px;border-top:1px solid #e2e8f0;">
               ${form.signature.drawnPng ? `<img src="${form.signature.drawnPng}" style="max-width:320px;display:block;margin-bottom:8px;"/>` : ''}
               <p style="font-family:Georgia,serif;font-style:italic;font-size:18px;margin:0;">${form.signature.typedName}</p>
               <p style="font-size:12px;color:#64748b;margin:6px 0 0;">Signed ${formatDate(form.signature.signedAt)}${form.signature.ip ? ' · IP ' + form.signature.ip : ''}</p>
             </div>`
          : ''
      }</body></html>`);
    win.document.close();
    win.focus();
    win.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-slate-900/60 backdrop-blur-sm overflow-y-auto p-4 sm:p-8">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl my-auto">
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-200">
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-slate-900 truncate">{form.templateName}</h2>
            <p className="text-xs text-slate-500 truncate">{form.clientName} · {form.clientEmail}</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={print} className="p-2 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-slate-100 transition-colors" title="Print / save as PDF">
              <Printer className="w-5 h-5" />
            </button>
            <button onClick={onClose} className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="px-6 py-5 max-h-[70vh] overflow-y-auto space-y-6">
          {form.renderedHtml ? (
            <div className="rounded-xl border border-slate-200 p-6" dangerouslySetInnerHTML={{ __html: form.renderedHtml }} />
          ) : (
            <p className="text-sm text-slate-500">This form is still a draft — the document text is frozen when it is sent.</p>
          )}

          {form.signature && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-5">
              <h3 className="text-sm font-bold text-emerald-800 mb-3">Electronic Signature</h3>
              {form.signature.drawnPng && (
                <img src={form.signature.drawnPng} alt="Signature" className="max-w-[280px] border-b border-slate-400 mb-3" />
              )}
              <p className="text-xl font-serif italic text-slate-900">{form.signature.typedName}</p>
              <p className="text-xs text-slate-500 mt-1.5">
                Signed {formatDate(form.signature.signedAt)}
                {form.signature.ip && ` · IP ${form.signature.ip}`}
              </p>
              <p className="text-[11px] text-slate-400 mt-1 break-all">Device: {form.signature.userAgent || 'unknown'}</p>
            </div>
          )}

          <div>
            <h3 className="text-sm font-bold text-slate-700 mb-2">Audit Trail</h3>
            <div className="rounded-xl border border-slate-200 divide-y divide-slate-100">
              {(form.audit || []).map((e, i) => (
                <div key={i} className="flex items-center justify-between px-4 py-2.5 text-sm">
                  <span className="font-semibold text-slate-700 capitalize">{e.event}</span>
                  <span className="text-xs text-slate-500">{formatDate(e.at)}{e.ip ? ` · ${e.ip}` : ''}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export const ConsentFormsView: React.FC<{
  userId: string;
  customers: Customer[];
  businessProfile: BusinessProfile | null;
}> = ({ userId, customers, businessProfile }) => {
  const [forms, setForms] = useState<ConsentForm[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | ConsentFormStatus>('All');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [detail, setDetail] = useState<ConsentForm | null>(null);
  const [banner, setBanner] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) { setLoading(false); return; }
    const unsub = consentService.subscribe(
      userId,
      f => { setForms(f); setLoading(false); },
      e => { setBanner({ kind: 'err', text: e.message }); setLoading(false); },
    );
    return unsub;
  }, [userId]);

  const filtered = useMemo(() => forms.filter(f => {
    const q = search.toLowerCase();
    const matchesSearch = !q
      || (f.clientName || '').toLowerCase().includes(q)
      || (f.clientEmail || '').toLowerCase().includes(q)
      || (f.templateName || '').toLowerCase().includes(q);
    return matchesSearch && (statusFilter === 'All' || f.status === statusFilter);
  }), [forms, search, statusFilter]);

  const counts = useMemo(() => ({
    awaiting: forms.filter(f => f.status === 'sent' || f.status === 'viewed').length,
    signed: forms.filter(f => f.status === 'signed').length,
  }), [forms]);

  const resend = async (form: ConsentForm) => {
    setBusyId(form.id);
    setBanner(null);
    try {
      await consentService.send(form.id);
      setBanner({ kind: 'ok', text: `Signing link re-sent to ${form.clientEmail}.` });
    } catch (e: any) {
      setBanner({ kind: 'err', text: e.message });
    } finally {
      setBusyId(null);
    }
  };

  const voidForm = async (form: ConsentForm) => {
    if (!window.confirm(`Void the ${form.templateName} form for ${form.clientName}? Their signing link will stop working.`)) return;
    setBusyId(form.id);
    setBanner(null);
    try {
      await consentService.void(form.id);
      setBanner({ kind: 'ok', text: 'Form voided.' });
    } catch (e: any) {
      setBanner({ kind: 'err', text: e.message });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Consent Forms</h1>
          <p className="text-slate-500">Send disclosure and consent forms for clients to sign electronically.</p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-sm flex items-center justify-center gap-2"
        >
          <Plus className="w-4 h-4" /> New Consent Form
        </button>
      </div>

      {banner && (
        <div className={`flex items-start justify-between gap-3 p-4 rounded-xl border text-sm ${
          banner.kind === 'ok'
            ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
            : 'bg-rose-50 border-rose-200 text-rose-700'
        }`}>
          <div className="flex items-start gap-2">
            {banner.kind === 'ok' ? <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" /> : <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />}
            <span>{banner.text}</span>
          </div>
          <button onClick={() => setBanner(null)} className="shrink-0 opacity-60 hover:opacity-100"><X className="w-4 h-4" /></button>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Forms', value: forms.length },
          { label: 'Awaiting Signature', value: counts.awaiting },
          { label: 'Signed', value: counts.signed },
          { label: 'Customers in CRM', value: customers.length },
        ].map(stat => (
          <div key={stat.label} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">{stat.label}</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by client, email, or form type..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
          />
        </div>
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value as any)}
          className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
        >
          <option value="All">All Statuses</option>
          {Object.entries(STATUS_STYLES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-slate-400">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm py-16 text-center">
          <FileSignature className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <h3 className="font-bold text-slate-700">No consent forms yet</h3>
          <p className="text-sm text-slate-500 mt-1">Create one and email it to a client to sign on their phone.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm divide-y divide-slate-100 overflow-hidden">
          {filtered.map(form => {
            const s = STATUS_STYLES[form.status] || STATUS_STYLES.draft;
            return (
              <div key={form.id} className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-4 hover:bg-slate-50/60 transition-colors">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-bold text-slate-900 truncate">{form.clientName || form.clientEmail}</h3>
                    <span className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${s.cls}`}>
                      <s.Icon className="w-3 h-3" /> {s.label}
                    </span>
                  </div>
                  <p className="text-sm text-slate-500 mt-0.5 truncate">{form.templateName} · {form.clientEmail}</p>
                  <p className="text-xs text-slate-400 mt-1">
                    {form.status === 'signed'
                      ? `Signed ${formatDate(form.signedAt)}`
                      : form.sentAt
                        ? `Sent ${formatDate(form.sentAt)}`
                        : `Created ${formatDate(form.createdAt)}`}
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => setDetail(form)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors"
                  >
                    <Eye className="w-3.5 h-3.5" /> View
                  </button>
                  {form.status !== 'signed' && form.status !== 'voided' && (
                    <>
                      <button
                        onClick={() => resend(form)}
                        disabled={busyId === form.id}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 transition-colors"
                      >
                        {busyId === form.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                        {form.sentAt ? 'Resend' : 'Send'}
                      </button>
                      <button
                        onClick={() => voidForm(form)}
                        disabled={busyId === form.id}
                        className="p-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 disabled:opacity-50 transition-colors"
                        title="Void form"
                      >
                        <Ban className="w-4 h-4" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <ConsentFormModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        customer={null}
        customers={customers}
        businessProfile={businessProfile}
        onSent={text => setBanner({ kind: 'ok', text })}
      />

      {detail && <ConsentDetail form={detail} onClose={() => setDetail(null)} />}
    </div>
  );
};

export default ConsentFormsView;
