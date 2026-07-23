import React, { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CheckCircle2, AlertCircle, Loader2, Send, Calculator } from 'lucide-react';
import { submitWebsiteIntake } from '../../services/consentService';
import {
  LOCATION_TYPES,
  MILEAGE_DISCLAIMER,
  MILEAGE_RATE,
  NOTARY_FEE_PER_SIGNATURE,
  computeQuote,
  formatCurrency,
} from '../../lib/quoteCalculator';

const SERVICE_TYPES = [
  'Real estate / loan signing',
  'Estate planning documents (will, trust, POA)',
  'Hospital or nursing home signing',
  'Single document notarization',
  'Apostille / document authentication',
  'Something else',
];

/**
 * Public request form for the marketing site. Submissions land in the CRM as a
 * customer plus a `websiteLeads` record, ready for a consent form to be sent.
 *
 * `company` is a honeypot field: hidden from real users, so anything typed in
 * it identifies a bot.
 */
export const PublicIntakePage: React.FC = () => {
  const [params] = useSearchParams();
  const ownerId = params.get('to') || undefined;

  const [values, setValues] = useState({
    fullName: '', email: '', phone: '', serviceType: '',
    preferredDate: '', location: '', message: '', company: '',
  });
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  // Quote estimate. Sent with the lead so the CRM shows what the client was quoted.
  const [signatures, setSignatures] = useState('1');
  const [roundTripMiles, setRoundTripMiles] = useState('10');
  const [locationType, setLocationType] = useState<string>('Home');

  const quote = useMemo(
    () => computeQuote({ signatures: Number(signatures), roundTripMiles: Number(roundTripMiles) }),
    [signatures, roundTripMiles],
  );

  const set = (key: keyof typeof values) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setValues(prev => ({ ...prev, [key]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await submitWebsiteIntake({
        ...values,
        consentToContact: consent,
        ownerId,
        quoteSignatures: quote.signatures,
        quoteRoundTripMiles: quote.roundTripMiles,
        quoteNotaryFee: quote.notaryFee,
        quoteTravelFee: quote.travelFee,
        quoteTotal: quote.total,
        quoteLocationType: locationType,
      });
      setDone(true);
    } catch (err: any) {
      setError(err.message || 'Could not submit your request.');
      setBusy(false);
    }
  };

  if (done) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl shadow-sm p-10 max-w-md text-center">
          <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-slate-900 mb-2">Request received</h1>
          <p className="text-sm text-slate-500 leading-relaxed">
            Thank you. You'll hear back shortly to confirm the appointment. Watch your email for a short
            consent and disclosure form to review before we meet.
          </p>
        </div>
      </div>
    );
  }

  const input = 'mt-1.5 w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all';
  const label = 'text-xs font-bold text-slate-500 uppercase tracking-wider';

  return (
    <div className="min-h-screen bg-slate-100 py-10 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="bg-gradient-to-br from-[#1e3a5f] to-blue-600 rounded-t-2xl px-7 py-8 text-white">
          <h1 className="text-xl font-bold">Request a Notary</h1>
          <p className="text-blue-100 text-sm mt-1">
            Tell us what you need notarized and when. We'll confirm by email.
          </p>
        </div>

        <form onSubmit={submit} className="bg-white rounded-b-2xl shadow-sm p-7 space-y-5">
          {error && (
            <div className="flex items-start gap-2 p-3 rounded-xl bg-rose-50 border border-rose-200 text-sm text-rose-700">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Honeypot — hidden from users, catches bots. */}
          <div aria-hidden="true" className="absolute w-px h-px -m-px overflow-hidden opacity-0 pointer-events-none">
            <label>Company<input type="text" tabIndex={-1} autoComplete="off" value={values.company} onChange={set('company')} /></label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="block">
              <span className={label}>Full name *</span>
              <input required type="text" autoComplete="name" value={values.fullName} onChange={set('fullName')} className={input} />
            </label>
            <label className="block">
              <span className={label}>Email *</span>
              <input required type="email" autoComplete="email" value={values.email} onChange={set('email')} className={input} />
            </label>
            <label className="block">
              <span className={label}>Phone</span>
              <input type="tel" autoComplete="tel" value={values.phone} onChange={set('phone')} className={input} />
            </label>
            <label className="block">
              <span className={label}>Preferred date</span>
              <input type="date" value={values.preferredDate} onChange={set('preferredDate')} className={input} />
            </label>
            <label className="block sm:col-span-2">
              <span className={label}>What do you need notarized? *</span>
              <select required value={values.serviceType} onChange={set('serviceType')} className={input}>
                <option value="">— Select —</option>
                {SERVICE_TYPES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </label>
            <label className="block sm:col-span-2">
              <span className={label}>Where should we meet?</span>
              <input
                type="text"
                placeholder="Address, hospital, or facility name"
                value={values.location}
                onChange={set('location')}
                className={input}
              />
            </label>
            <label className="block sm:col-span-2">
              <span className={label}>Anything else we should know?</span>
              <textarea rows={3} value={values.message} onChange={set('message')} className={input} />
            </label>
          </div>

          <div className="rounded-xl border border-slate-200 overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 bg-slate-50 border-b border-slate-200">
              <Calculator className="w-4 h-4 text-indigo-600" />
              <h2 className="text-sm font-bold text-slate-900">Estimate your cost</h2>
            </div>

            <div className="p-4 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <label className="block">
                  <span className={label}>Notarized signatures</span>
                  <input
                    type="number"
                    min={0}
                    step={1}
                    inputMode="numeric"
                    value={signatures}
                    onChange={e => setSignatures(e.target.value)}
                    className={input}
                  />
                </label>
                <label className="block">
                  <span className={label}>Round-trip miles</span>
                  <input
                    type="number"
                    min={0}
                    step={1}
                    inputMode="decimal"
                    value={roundTripMiles}
                    onChange={e => setRoundTripMiles(e.target.value)}
                    className={input}
                  />
                </label>
                <label className="block">
                  <span className={label}>Location type</span>
                  <select value={locationType} onChange={e => setLocationType(e.target.value)} className={input}>
                    {LOCATION_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </label>
              </div>

              <p className="text-xs text-slate-400">
                Location type is informational only and does not change the price.
              </p>

              <div className="rounded-xl bg-slate-50 p-4 space-y-2">
                <div className="flex items-baseline justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-700">Notary fee</p>
                    <p className="text-xs text-slate-500">
                      {quote.signatures} signature{quote.signatures === 1 ? '' : 's'} × {formatCurrency(NOTARY_FEE_PER_SIGNATURE)}
                    </p>
                  </div>
                  <span className="text-sm font-semibold text-slate-900 shrink-0">{formatCurrency(quote.notaryFee)}</span>
                </div>
                <div className="flex items-baseline justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-700">Travel reimbursement</p>
                    <p className="text-xs text-slate-500">
                      {quote.roundTripMiles} miles × ${MILEAGE_RATE.toFixed(3)}
                    </p>
                  </div>
                  <span className="text-sm font-semibold text-slate-900 shrink-0">{formatCurrency(quote.travelFee)}</span>
                </div>
                <div className="flex items-baseline justify-between gap-4 pt-2 border-t border-slate-200">
                  <p className="text-sm font-bold text-slate-900">Estimated total</p>
                  <span className="text-xl font-bold text-indigo-600 shrink-0">{formatCurrency(quote.total)}</span>
                </div>
              </div>

              <p className="text-[11px] text-slate-500 leading-relaxed">
                <span className="font-bold text-slate-600">Mileage &amp; travel disclaimer: </span>
                {MILEAGE_DISCLAIMER}
              </p>
            </div>
          </div>

          <label className="flex gap-3 items-start p-3 rounded-xl bg-slate-50 cursor-pointer">
            <input
              type="checkbox"
              checked={consent}
              onChange={e => setConsent(e.target.checked)}
              className="mt-0.5 w-5 h-5 shrink-0 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
            />
            <span className="text-sm text-slate-700 leading-relaxed">
              I agree to be contacted by email, phone, or text about this request. I understand the total above is an
              estimate that includes travel reimbursement, that the final amount is confirmed when the appointment is
              booked, and that a consent and disclosure form will be emailed to me to review before we
              meet.<span className="text-rose-500"> *</span>
            </span>
          </label>

          <button
            type="submit"
            disabled={busy || !consent}
            className="w-full flex items-center justify-center gap-2 px-6 py-4 rounded-xl text-base font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-sm"
          >
            {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
            {busy ? 'Sending…' : 'Send request'}
          </button>

          <p className="text-xs text-slate-400 text-center leading-relaxed">
            A notary public cannot give legal advice or explain documents. Your information is used only to schedule
            and complete your appointment.
          </p>
        </form>
      </div>
    </div>
  );
};

export default PublicIntakePage;
