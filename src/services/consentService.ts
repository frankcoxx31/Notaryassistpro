import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { auth, db } from '../firebase';
import type { ConsentForm, ConsentTemplateId } from '../types/consent';

/**
 * Consent forms are written exclusively by the server (Admin SDK) so that the
 * public signing page can update them without any client credentials, and so a
 * signed record cannot be edited from the browser. The client therefore reads
 * from Firestore and writes through the API.
 */

async function authHeaders(): Promise<Record<string, string>> {
  const token = (await auth.currentUser?.getIdToken()) ?? '';
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
}

async function postJson(url: string, body?: unknown, method: 'POST' | 'PUT' = 'POST') {
  const res = await fetch(url, {
    method,
    headers: await authHeaders(),
    body: JSON.stringify(body ?? {}),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

export const consentService = {
  /** Live list of the signed-in notary's consent forms, newest first. */
  subscribe(userId: string, onChange: (forms: ConsentForm[]) => void, onError?: (e: Error) => void) {
    const q = query(collection(db, 'consentForms'), where('userId', '==', userId));
    return onSnapshot(
      q,
      snapshot => {
        const forms = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as ConsentForm));
        forms.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
        onChange(forms);
      },
      err => {
        console.error('[Consent] Subscription error:', err);
        onError?.(err as Error);
      },
    );
  },

  async create(input: {
    templateId: ConsentTemplateId;
    customerId?: string;
    fields: Record<string, string>;
  }): Promise<ConsentForm> {
    const data = await postJson('/api/consent/forms', input);
    return data.form as ConsentForm;
  },

  async update(formId: string, fields: Record<string, string>) {
    return postJson(`/api/consent/forms/${formId}`, { fields }, 'PUT');
  },

  /** Freezes the document text and emails the signing link to the client. */
  async send(formId: string, note?: string): Promise<{ signingUrl: string; expiresAt: string }> {
    const data = await postJson(`/api/consent/forms/${formId}/send`, { note });
    return { signingUrl: data.signingUrl, expiresAt: data.expiresAt };
  },

  async void(formId: string) {
    return postJson(`/api/consent/forms/${formId}/void`);
  },
};

/** Public (unauthenticated) calls used by the signing page. */
export const publicConsentApi = {
  async load(formId: string, token: string, exp: string) {
    const res = await fetch(`/api/public/consent/${formId}?token=${encodeURIComponent(token)}&exp=${encodeURIComponent(exp)}`);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'This form could not be loaded.');
    return data.form;
  },

  async sign(formId: string, payload: {
    token: string;
    exp: string;
    typedName: string;
    drawnPng?: string;
    agreedToElectronic: boolean;
    intentAcknowledged: boolean;
    acknowledgements: Record<string, boolean>;
  }) {
    const res = await fetch(`/api/public/consent/${formId}/sign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Your signature could not be saved.');
    return data;
  },

  async decline(formId: string, payload: { token: string; exp: string; reason: string }) {
    const res = await fetch(`/api/public/consent/${formId}/decline`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Could not submit your response.');
    return data;
  },
};

/** Public website intake submission. */
export async function submitWebsiteIntake(payload: {
  fullName: string;
  email: string;
  phone: string;
  serviceType: string;
  preferredDate?: string;
  location?: string;
  message?: string;
  consentToContact: boolean;
  company?: string;
  ownerId?: string;
  quoteSignatures?: number;
  quoteRoundTripMiles?: number;
  quoteNotaryFee?: number;
  quoteTravelFee?: number;
  quoteTotal?: number;
  quoteLocationType?: string;
}) {
  const res = await fetch('/api/public/intake', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Could not submit your request.');
  return data;
}
