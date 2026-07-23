import React, { useEffect, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { CheckCircle2, AlertCircle, Loader2, ShieldCheck, FileSignature } from 'lucide-react';
import { publicConsentApi } from '../../services/consentService';
import SignaturePad from './SignaturePad';

interface PublicForm {
  id: string;
  status: string;
  templateName: string;
  documentTitle: string;
  clientName: string;
  clientEmail: string;
  renderedHtml: string;
  acknowledgementList: { key: string; label: string; required: boolean }[];
  businessName?: string;
  businessEmail?: string;
  businessPhone?: string;
  expiresAt?: string;
  signature?: { typedName: string; signedAt: string } | null;
}

/**
 * Public, unauthenticated signing page reached from the emailed link.
 * The signer is a client, not a user of the app, so there is no login here —
 * the HMAC token in the URL is the credential.
 */
export const PublicSignPage: React.FC = () => {
  const { formId = '' } = useParams();
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const exp = params.get('exp') || '';

  const [form, setForm] = useState<PublicForm | null>(null);
  const [loadError, setLoadError] = useState('');
  const [loading, setLoading] = useState(true);

  const [acks, setAcks] = useState<Record<string, boolean>>({});
  const [agreedToElectronic, setAgreedToElectronic] = useState(false);
  const [intentAcknowledged, setIntentAcknowledged] = useState(false);
  const [typedName, setTypedName] = useState('');
  const [drawnPng, setDrawnPng] = useState<string | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [done, setDone] = useState(false);
  const signBlockRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    publicConsentApi
      .load(formId, token, exp)
      .then(f => {
        if (!active) return;
        setForm(f);
        setTypedName(f.clientName || '');
        if (f.status === 'signed') setDone(true);
      })
      .catch(e => active && setLoadError(e.message))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [formId, token, exp]);

  const requiredAcks = (form?.acknowledgementList || []).filter(a => a.required);
  const allAcksChecked = requiredAcks.every(a => acks[a.key]);
  const canSign = allAcksChecked && agreedToElectronic && intentAcknowledged && typedName.trim().length >= 2;

  const submit = async () => {
    if (!canSign) return;
    setSubmitting(true);
    setSubmitError('');
    try {
      await publicConsentApi.sign(formId, {
        token,
        exp,
        typedName: typedName.trim(),
        drawnPng: drawnPng || undefined,
        agreedToElectronic,
        intentAcknowledged,
        acknowledgements: acks,
      });
      setDone(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e: any) {
      setSubmitError(e.message || 'Something went wrong.');
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <Loader2 className="w-7 h-7 text-slate-400 animate-spin" />
      </div>
    );
  }

  if (loadError || !form) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl shadow-sm p-10 max-w-md text-center">
          <AlertCircle className="w-10 h-10 text-amber-500 mx-auto mb-4" />
          <h1 className="text-lg font-bold text-slate-900 mb-2">This form isn't available</h1>
          <p className="text-sm text-slate-500 leading-relaxed">{loadError || 'Please ask for a new link.'}</p>
        </div>
      </div>
    );
  }

  if (done) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl shadow-sm p-10 max-w-lg text-center">
          <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-slate-900 mb-2">Thank you — your form is signed</h1>
          <p className="text-sm text-slate-500 leading-relaxed">
            A copy has been emailed to {form.clientEmail} for your records. You can request a paper copy at no charge
            {form.businessEmail ? <> by writing to <span className="font-semibold text-slate-700">{form.businessEmail}</span></> : ''}.
          </p>
          {form.businessName && (
            <p className="text-xs text-slate-400 mt-6">{form.businessName}{form.businessPhone ? ` · ${form.businessPhone}` : ''}</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 py-6 sm:py-10 px-4">
      <div className="max-w-3xl mx-auto space-y-5">
        <div className="bg-gradient-to-br from-[#1e3a5f] to-blue-600 rounded-2xl px-6 py-7 text-white">
          <div className="flex items-center gap-3">
            <FileSignature className="w-6 h-6" />
            <div>
              <h1 className="text-lg font-bold">{form.businessName || 'Consent Form'}</h1>
              <p className="text-blue-100 text-sm">{form.templateName} — please review and sign below</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm p-6 sm:p-8">
          <div dangerouslySetInnerHTML={{ __html: form.renderedHtml }} />
        </div>

        <div className="bg-white rounded-2xl shadow-sm p-6 sm:p-8">
          <h2 className="text-base font-bold text-slate-900 mb-4">Please confirm each of the following</h2>
          <div className="space-y-3">
            {(form.acknowledgementList || []).map(a => (
              <label key={a.key} className="flex gap-3 items-start p-3 rounded-xl hover:bg-slate-50 cursor-pointer transition-colors">
                <input
                  type="checkbox"
                  checked={!!acks[a.key]}
                  onChange={e => setAcks(prev => ({ ...prev, [a.key]: e.target.checked }))}
                  className="mt-0.5 w-5 h-5 shrink-0 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-sm text-slate-700 leading-relaxed">
                  {a.label}{a.required && <span className="text-rose-500"> *</span>}
                </span>
              </label>
            ))}
          </div>
        </div>

        <div ref={signBlockRef} className="bg-white rounded-2xl shadow-sm p-6 sm:p-8">
          <h2 className="text-base font-bold text-slate-900 mb-1">Sign electronically</h2>
          <p className="text-sm text-slate-500 mb-5">
            Your electronic signature has the same legal effect as signing by hand.
          </p>

          <div className="space-y-3 mb-6">
            <label className="flex gap-3 items-start p-3 rounded-xl bg-slate-50 cursor-pointer">
              <input
                type="checkbox"
                checked={agreedToElectronic}
                onChange={e => setAgreedToElectronic(e.target.checked)}
                className="mt-0.5 w-5 h-5 shrink-0 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              <span className="text-sm text-slate-700 leading-relaxed">
                I agree to do business electronically and to receive this record electronically. I understand I may
                request a paper copy at no charge and may withdraw this consent at any time.<span className="text-rose-500"> *</span>
              </span>
            </label>
            <label className="flex gap-3 items-start p-3 rounded-xl bg-slate-50 cursor-pointer">
              <input
                type="checkbox"
                checked={intentAcknowledged}
                onChange={e => setIntentAcknowledged(e.target.checked)}
                className="mt-0.5 w-5 h-5 shrink-0 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              <span className="text-sm text-slate-700 leading-relaxed">
                I have read this form, I intend to sign it, and I intend my electronic signature to be legally binding.
                <span className="text-rose-500"> *</span>
              </span>
            </label>
          </div>

          <label className="block mb-5">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Type your full legal name *</span>
            <input
              type="text"
              value={typedName}
              onChange={e => setTypedName(e.target.value)}
              autoComplete="name"
              className="mt-1.5 w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-lg font-serif italic focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            />
          </label>

          <div className="mb-6">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Draw your signature (optional)</span>
            <div className="mt-1.5">
              <SignaturePad onChange={setDrawnPng} disabled={submitting} />
            </div>
          </div>

          {submitError && (
            <div className="flex items-start gap-2 mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-sm text-rose-700">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{submitError}</span>
            </div>
          )}

          <button
            onClick={submit}
            disabled={!canSign || submitting}
            className="w-full flex items-center justify-center gap-2 px-6 py-4 rounded-xl text-base font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-sm"
          >
            {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <ShieldCheck className="w-5 h-5" />}
            {submitting ? 'Submitting…' : 'Sign and submit'}
          </button>
          {!canSign && (
            <p className="text-xs text-slate-400 text-center mt-3">
              Check every required box and type your name to enable signing.
            </p>
          )}
        </div>

        <p className="text-center text-xs text-slate-400 pb-6">
          Your name, email, IP address, device, and the date and time are recorded with your signature to verify this record.
        </p>
      </div>
    </div>
  );
};

export default PublicSignPage;
