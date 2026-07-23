import React, { useMemo, useState } from 'react';
import { X, FileSignature, Send, Eye, Loader2, ChevronLeft, AlertCircle, Home, Scale, HeartPulse, Stamp, MapPin } from 'lucide-react';
import { MILEAGE_RATE, milesForAddress } from '../../lib/quoteCalculator';
import { CONSENT_TEMPLATES, computeConsentCost, renderConsentDocument } from '../../lib/consentTemplates';
import { consentService } from '../../services/consentService';
import type { ConsentTemplate, ConsentTemplateId } from '../../types/consent';
import type { BusinessProfile, Customer } from '../../types';

const TEMPLATE_ICONS: Record<ConsentTemplateId, React.ElementType> = {
  'general-notary': Stamp,
  'real-estate': Home,
  'estate-planning': Scale,
  'hospital-facility': HeartPulse,
};

/** Pre-fills a template's fields from the selected customer record. */
function prefill(template: ConsentTemplate, customer: Customer | null): Record<string, string> {
  const values: Record<string, string> = {};
  for (const f of template.fields) {
    let v = '';
    if (customer && f.prefillFrom) {
      v = String((customer as any)[f.prefillFrom] ?? '');
      if (f.prefillFrom === 'address' && customer) {
        v = [customer.address, customer.city, customer.state, customer.zip].filter(Boolean).join(', ');
      }
    }
    if (f.key === 'notarialFee' && !v) v = '10.00';
    if (f.key === 'actCount' && !v) v = '1';
    values[f.key] = v;
  }
  return values;
}

export const ConsentFormModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  customer: Customer | null;
  customers: Customer[];
  businessProfile: BusinessProfile | null;
  onSent: (message: string) => void;
}> = ({ isOpen, onClose, customer, customers, businessProfile, onSent }) => {
  const [step, setStep] = useState<'template' | 'fields' | 'preview'>('template');
  const [templateId, setTemplateId] = useState<ConsentTemplateId | null>(null);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>(customer?.id || '');
  const [fields, setFields] = useState<Record<string, string>>({});
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [lookingUp, setLookingUp] = useState(false);
  const [lookupError, setLookupError] = useState('');
  const [matchedAddress, setMatchedAddress] = useState('');

  const template = useMemo(() => CONSENT_TEMPLATES.find(t => t.id === templateId) || null, [templateId]);
  const activeCustomer = useMemo(
    () => customers.find(c => c.id === selectedCustomerId) || customer || null,
    [customers, selectedCustomerId, customer],
  );

  const business = {
    name: businessProfile?.companyName || businessProfile?.name || 'NotaryPro',
    email: businessProfile?.email || '',
    phone: businessProfile?.phone || '',
    location: businessProfile?.address || '',
    commissionNumber: businessProfile?.commissionNumber || '',
    commissionExpiration: businessProfile?.commissionExpiration || '',
  };

  if (!isOpen) return null;

  const reset = () => {
    setStep('template');
    setTemplateId(null);
    setFields({});
    setNote('');
    setError('');
    setBusy(false);
  };

  const close = () => { reset(); onClose(); };

  const chooseTemplate = (t: ConsentTemplate) => {
    setTemplateId(t.id);
    setFields(prefill(t, activeCustomer));
    setStep('fields');
  };

  const missingRequired = template
    ? template.fields.filter(f => f.required && !(fields[f.key] || '').trim())
    : [];

  const cost = computeConsentCost(fields, template?.pricingModel);
  const isFlat = template?.pricingModel === 'flat';

  /**
   * Fills round-trip miles and the travel fee from the appointment address.
   * The notary can still override either afterwards — this only seeds them.
   */
  const lookupMiles = async () => {
    const address = (fields.appointmentLocation || '').trim();
    if (!address) {
      setLookupError('Enter the appointment location first.');
      return;
    }
    setLookingUp(true);
    setLookupError('');
    try {
      const { miles, matched } = await milesForAddress(address);
      setFields(prev => ({
        ...prev,
        travelMiles: String(miles),
        travelFee: (miles * MILEAGE_RATE).toFixed(2),
      }));
      setMatchedAddress(matched);
    } catch (e: any) {
      setLookupError(e.message || 'Could not look up that address.');
    } finally {
      setLookingUp(false);
    }
  };

  const handleSend = async () => {
    if (!template) return;
    setBusy(true);
    setError('');
    try {
      const form = await consentService.create({
        templateId: template.id,
        customerId: selectedCustomerId || undefined,
        fields,
      });
      await consentService.send(form.id, note);
      onSent(`Consent form emailed to ${fields.clientEmail}.`);
      close();
    } catch (e: any) {
      setError(e.message || 'Could not send the form.');
      setBusy(false);
    }
  };

  const previewHtml = template
    ? renderConsentDocument({ template, fields, business })
    : '';

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-slate-900/60 backdrop-blur-sm overflow-y-auto p-4 sm:p-8">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl my-auto">
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-200">
          <div className="flex items-center gap-3 min-w-0">
            {step !== 'template' && (
              <button
                onClick={() => setStep(step === 'preview' ? 'fields' : 'template')}
                className="p-1.5 -ml-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
            )}
            <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center shrink-0">
              <FileSignature className="w-5 h-5 text-indigo-600" />
            </div>
            <div className="min-w-0">
              <h2 className="text-lg font-bold text-slate-900 truncate">
                {step === 'template' ? 'New Consent Form' : template?.name}
              </h2>
              <p className="text-xs text-slate-500 truncate">
                {step === 'template' && 'Choose the form that matches this appointment'}
                {step === 'fields' && 'Fill in the appointment details'}
                {step === 'preview' && 'This is exactly what your client will see and sign'}
              </p>
            </div>
          </div>
          <button onClick={close} className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-5 max-h-[65vh] overflow-y-auto">
          {error && (
            <div className="flex items-start gap-2 mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-sm text-rose-700">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {step === 'template' && (
            <div className="space-y-3">
              <label className="block">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Customer</span>
                <select
                  value={selectedCustomerId}
                  onChange={e => setSelectedCustomerId(e.target.value)}
                  className="mt-1.5 w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                >
                  <option value="">— Enter details manually —</option>
                  {customers.map(c => (
                    <option key={c.id} value={c.id}>{c.fullName} {c.email ? `(${c.email})` : ''}</option>
                  ))}
                </select>
              </label>

              <div className="pt-2 space-y-3">
                {CONSENT_TEMPLATES.map(t => {
                  const Icon = TEMPLATE_ICONS[t.id];
                  return (
                    <button
                      key={t.id}
                      onClick={() => chooseTemplate(t)}
                      className="w-full text-left p-4 rounded-xl border border-slate-200 hover:border-indigo-400 hover:bg-indigo-50/40 transition-all flex items-start gap-4 group"
                    >
                      <div className="w-11 h-11 rounded-xl bg-slate-100 group-hover:bg-white flex items-center justify-center shrink-0 transition-colors">
                        <Icon className="w-5 h-5 text-indigo-600" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-bold text-slate-900">{t.name}</h3>
                        <p className="text-sm text-slate-500 mt-0.5">{t.description}</p>
                        <span className="inline-block mt-2 text-[10px] font-bold uppercase tracking-wider text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded-full">
                          {t.segment}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {step === 'fields' && template && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {template.fields.map(f => {
                const value = fields[f.key] ?? '';
                const set = (v: string) => setFields(prev => ({ ...prev, [f.key]: v }));
                const cls = 'mt-1.5 w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500';

                // Waiving travel zeroes the charge, so the amount and mileage
                // inputs are disabled rather than silently ignored.
                if (f.type === 'checkbox') {
                  const checked = value === 'true';
                  return (
                    <label
                      key={f.key}
                      className="sm:col-span-2 flex items-start gap-3 p-3 rounded-xl border border-slate-200 bg-slate-50 cursor-pointer hover:bg-slate-100 transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={e => set(e.target.checked ? 'true' : '')}
                        className="mt-0.5 w-5 h-5 shrink-0 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold text-slate-800">{f.label}</span>
                        {f.help && <span className="block text-[11px] text-slate-500 leading-relaxed mt-0.5">{f.help}</span>}
                      </span>
                    </label>
                  );
                }

                if (f.key === 'appointmentLocation') {
                  return (
                    <div key={f.key} className="sm:col-span-2">
                      <label className="block">
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                          {f.label}{f.required && <span className="text-rose-500"> *</span>}
                        </span>
                        <textarea rows={2} value={value} onChange={e => set(e.target.value)} placeholder={f.placeholder} className={cls} />
                      </label>
                      {!isFlat && (
                        <>
                          <div className="flex items-center gap-2 mt-2">
                            <button
                              type="button"
                              onClick={lookupMiles}
                              disabled={lookingUp}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 disabled:opacity-50 transition-colors"
                            >
                              {lookingUp ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <MapPin className="w-3.5 h-3.5" />}
                              {lookingUp ? 'Calculating…' : 'Look up address & miles'}
                            </button>
                            <span className="text-[11px] text-slate-400">
                              Fills round-trip miles and travel fee at ${MILEAGE_RATE.toFixed(3)}/mile.
                            </span>
                          </div>
                          {lookupError && <p className="mt-1.5 text-[11px] text-rose-600">{lookupError}</p>}
                          {matchedAddress && !lookupError && (
                            <p className="mt-1.5 text-[11px] text-emerald-700">Matched: {matchedAddress}</p>
                          )}
                        </>
                      )}
                    </div>
                  );
                }

                const disabledByWaiver = cost.travelWaived && (f.key === 'travelFee' || f.key === 'travelMiles');

                return (
                  <label key={f.key} className={f.type === 'textarea' ? 'sm:col-span-2 block' : 'block'}>
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                      {f.label}{f.required && <span className="text-rose-500"> *</span>}
                    </span>
                    {f.type === 'textarea' ? (
                      <textarea rows={2} value={value} onChange={e => set(e.target.value)} placeholder={f.placeholder} className={cls} />
                    ) : f.type === 'select' ? (
                      <select value={value} onChange={e => set(e.target.value)} className={cls}>
                        <option value="">— Select —</option>
                        {(f.options || []).map(o => <option key={o} value={o}>{o}</option>)}
                      </select>
                    ) : (
                      <input
                        type={f.type === 'date' ? 'date' : f.type === 'time' ? 'time' : f.type === 'number' ? 'number' : 'text'}
                        inputMode={f.type === 'currency' ? 'decimal' : undefined}
                        value={disabledByWaiver ? '' : value}
                        disabled={disabledByWaiver}
                        onChange={e => set(e.target.value)}
                        placeholder={disabledByWaiver ? 'Waived' : (f.placeholder || (f.type === 'currency' ? '0.00' : ''))}
                        className={`${cls} disabled:opacity-50 disabled:cursor-not-allowed`}
                      />
                    )}
                    {f.help && <span className="block mt-1 text-[11px] text-slate-400 leading-relaxed">{f.help}</span>}
                  </label>
                );
              })}

              <label className="sm:col-span-2 block">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Personal note in the email (optional)</span>
                <textarea
                  rows={2}
                  value={note}
                  onChange={e => setNote(e.target.value)}
                  placeholder="e.g. Looking forward to meeting you Thursday — please have your ID ready."
                  className="mt-1.5 w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </label>
            </div>
          )}

          {step === 'preview' && (
            <div className="rounded-xl border border-slate-200 p-6 bg-white">
              <div dangerouslySetInnerHTML={{ __html: previewHtml }} />
              <div className="mt-6 pt-5 border-t border-slate-200">
                <h3 className="text-sm font-bold text-[#1e3a5f] mb-3">Acknowledgements the client must check</h3>
                <ul className="space-y-2">
                  {template?.acknowledgements.map(a => (
                    <li key={a.key} className="flex gap-2 text-[13px] leading-relaxed text-slate-600">
                      <span className="text-slate-400">☐</span>
                      <span>{a.label}{a.required && <span className="text-rose-500"> *</span>}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>

        {step !== 'template' && (
          <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-slate-200 bg-slate-50 rounded-b-2xl">
            <div className="min-w-0">
              <p className="text-sm font-bold text-slate-900">
                Client total: ${cost.total.toFixed(2)}
              </p>
              <p className="text-xs text-slate-500">
                {isFlat
                  ? 'Flat signing fee'
                  : <>
                      {cost.signatureCount} × ${cost.feePerSignature.toFixed(2)} = ${cost.notarialSubtotal.toFixed(2)}
                      {cost.travelWaived ? ' · travel waived' : ` + $${cost.travelFee.toFixed(2)} travel`}
                    </>}
                {missingRequired.length > 0 && ` · ${missingRequired.length} required field(s) empty`}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {step === 'fields' ? (
                <button
                  onClick={() => setStep('preview')}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 transition-colors"
                >
                  <Eye className="w-4 h-4" /> Preview
                </button>
              ) : (
                <button
                  onClick={() => setStep('fields')}
                  className="px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 transition-colors"
                >
                  Edit details
                </button>
              )}
              <button
                onClick={handleSend}
                disabled={busy || missingRequired.length > 0}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 transition-colors shadow-sm"
              >
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                {busy ? 'Sending…' : 'Send for signature'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ConsentFormModal;
