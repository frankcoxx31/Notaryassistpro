/**
 * Client Consent & Disclosure forms.
 *
 * Flow:
 *   1. Lead arrives from the public website form  -> `websiteLeads` + `customers`
 *   2. Notary generates a consent form for that customer in the CRM (status: draft)
 *   3. Form is emailed with an HMAC-signed link      (status: sent)
 *   4. Client opens the link                         (status: viewed)
 *   5. Client types/draws a signature and submits    (status: signed)
 *
 * Signature validity rests on ESIGN/UETA, which requires four things — all
 * captured below: consent to do business electronically (`agreedToElectronic`),
 * intent to sign (`intentAcknowledged`), association of the signature with the
 * record (`renderedHtml` is frozen at signing time), and the ability to retain
 * a copy (a signed copy is emailed to both parties).
 */

export type ConsentFormStatus = 'draft' | 'sent' | 'viewed' | 'signed' | 'declined' | 'voided' | 'expired';

export type ConsentTemplateId = 'real-estate' | 'estate-planning' | 'hospital-facility' | 'general-notary';

export type ConsentFieldType = 'text' | 'textarea' | 'date' | 'time' | 'currency' | 'number' | 'select' | 'checkbox';

export interface ConsentField {
  key: string;
  label: string;
  type: ConsentFieldType;
  required?: boolean;
  placeholder?: string;
  help?: string;
  options?: string[];
  /** Customer property this field is pre-filled from, when available. */
  prefillFrom?: 'fullName' | 'email' | 'phone' | 'address' | 'propertyAddress' | 'spouseName';
}

export interface ConsentClause {
  heading: string;
  /** Supports {{fieldKey}} and {{business.name}} style interpolation. */
  body: string;
}

export interface ConsentAcknowledgement {
  key: string;
  label: string;
  /** Required acknowledgements block submission until checked. */
  required: boolean;
}

export interface ConsentTemplate {
  id: ConsentTemplateId;
  name: string;
  description: string;
  /** Matches the drip segment this template belongs to. */
  segment: string;
  documentTitle: string;
  fields: ConsentField[];
  clauses: ConsentClause[];
  acknowledgements: ConsentAcknowledgement[];
}

export interface ConsentAuditEntry {
  event: 'created' | 'sent' | 'viewed' | 'signed' | 'declined' | 'voided' | 'resent';
  at: string;
  ip?: string;
  userAgent?: string;
  detail?: string;
}

export interface ConsentSignature {
  /** Typed legal name, as entered by the signer. */
  typedName: string;
  /** Optional drawn signature, stored as a base64 PNG data URL. */
  drawnPng?: string;
  signedAt: string;
  ip?: string;
  userAgent?: string;
}

export interface ConsentForm {
  id: string;
  userId: string;
  customerId?: string;
  templateId: ConsentTemplateId;
  templateName: string;
  documentTitle?: string;
  status: ConsentFormStatus;

  /** Business details frozen alongside the document when it is sent. */
  businessName?: string;
  businessEmail?: string;
  businessPhone?: string;
  /** Acknowledgement definitions as they stood when the form was sent. */
  acknowledgementList?: ConsentAcknowledgement[];

  clientName: string;
  clientEmail: string;

  /** Values for the template's fields, keyed by ConsentField.key. */
  fields: Record<string, string>;
  /** Acknowledgement checkbox results, keyed by ConsentAcknowledgement.key. */
  acknowledgements?: Record<string, boolean>;

  /**
   * The exact HTML the signer saw, frozen when the form is sent. Re-rendering
   * later from the template would break the signature/record association.
   */
  renderedHtml?: string;

  agreedToElectronic?: boolean;
  intentAcknowledged?: boolean;
  signature?: ConsentSignature;
  declineReason?: string;

  /** Link expiry — ISO string. Signing after this is rejected. */
  expiresAt?: string;
  sentAt?: string;
  viewedAt?: string;
  signedAt?: string;

  audit: ConsentAuditEntry[];
  createdAt: string;
  updatedAt: string;
}

/** Shape submitted by the public website intake form. */
export interface WebsiteLead {
  id: string;
  userId: string;
  fullName: string;
  email: string;
  phone: string;
  serviceType: string;
  preferredDate?: string;
  location?: string;
  message?: string;
  consentToContact: boolean;
  source: string;
  /** Estimate the client generated on the intake form, recomputed server-side. */
  quote?: {
    signatures: number;
    roundTripMiles: number;
    notaryFee: number;
    travelFee: number;
    locationType: string;
    total: number;
  };
  ip?: string;
  userAgent?: string;
  customerId?: string;
  createdAt: string;
}
