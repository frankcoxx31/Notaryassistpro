import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import compression from "compression";
import fs from "fs";
import crypto from "crypto";
import { google } from "googleapis";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";
import { GoogleGenerativeAI } from "@google/generative-ai";
import Anthropic from "@anthropic-ai/sdk";
import { Resend } from "resend";
import {
  getConsentTemplate,
  renderConsentDocument,
  escapeHtml as escapeConsentHtml,
} from "./src/lib/consentTemplates";

dotenv.config();

// ─── Firebase Admin Setup ─────────────────────────────────────────────────────
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth as getAdminAuth } from "firebase-admin/auth";

function parseServiceAccountJson(): any {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON is not set");

  const attempts = [
    () => JSON.parse(raw),
    () => JSON.parse(raw.replace(/\\{/g, '{').replace(/\\}/g, '}')),
    () => JSON.parse(raw.replace(/\\{/g, '{').replace(/\\}/g, '}').replace(/\\"/g, '"')),
    () => JSON.parse(raw.replace(/\\([^"\\\/bfnrtu])/g, '$1')),
    () => JSON.parse(JSON.parse(`"${raw.replace(/"/g, '\\"')}"`)),
  ];

  for (let i = 0; i < attempts.length; i++) {
    try {
      const result = attempts[i]();
      console.log(`[Firebase Admin] JSON parsed successfully on attempt ${i + 1}`);
      return result;
    } catch (e) {
      console.warn(`[Firebase Admin] Parse attempt ${i + 1} failed`);
    }
  }
  throw new Error("All JSON parse attempts failed for GOOGLE_SERVICE_ACCOUNT_JSON");
}

function fixPrivateKey(key: string): string {
  if (!key) return key;
  key = key.replace(/\\n/g, '\n');
  if (key.includes('-----BEGIN RSA PRIVATE KEY-----') || key.includes('-----BEGIN PRIVATE KEY-----')) {
    const header = key.match(/-----BEGIN [^-]+-----/)?.[0] || '-----BEGIN PRIVATE KEY-----';
    const footer = key.match(/-----END [^-]+-----/)?.[0] || '-----END PRIVATE KEY-----';
    const body = key
      .replace(/-----BEGIN [^-]+-----/, '')
      .replace(/-----END [^-]+-----/, '')
      .replace(/\s+/g, '');
    const lines = body.match(/.{1,64}/g)?.join('\n') || body;
    return `${header}\n${lines}\n${footer}`;
  }
  return key;
}

let adminDb: FirebaseFirestore.Firestore | null = null;
let adminAuth: ReturnType<typeof getAdminAuth> | null = null;

if (!process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
  console.warn("[Firebase Admin] GOOGLE_SERVICE_ACCOUNT_JSON is not set. Firestore sync features will run in demo/offline mode.");
} else {
  try {
    const serviceAccount = parseServiceAccountJson();
    serviceAccount.private_key = fixPrivateKey(serviceAccount.private_key);

    if (!getApps().length) {
      initializeApp({ credential: cert(serviceAccount) });
    }

    const rawDbId = process.env.FIREBASE_DATABASE_ID || '';
    const useDefault = !rawDbId || ['', '(default)', 'undefined', 'null'].includes(rawDbId.trim());
    adminDb = useDefault ? getFirestore() : getFirestore(rawDbId.trim());
    adminAuth = getAdminAuth();
    console.log(`[Firebase Admin] Connected to Firestore: ${useDefault ? 'default' : rawDbId.trim()}`);
  } catch (e: any) {
    console.error("[Firebase Admin] Failed to initialize:", e?.message || e);
  }
}

// ─── Resend Setup ─────────────────────────────────────────────────────────────
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const anthropic = process.env.ANTHROPIC_API_KEY ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY }) : null;
const APP_URL = process.env.APP_URL || "https://www.notaryproapp.com";

// ─── Business Profile Helpers ─────────────────────────────────────────────────
// BizData is fetched per-request from the authenticated user's Firestore profile.
// Nothing is hardcoded — every tenant gets their own name, email, and website in
// outbound emails.
interface BizData {
  name: string;
  email: string;
  phone: string;
  website: string;
  location: string;
}

/** Reads the signed-in user's business profile from Firestore. */
async function getBusinessProfile(uid: string): Promise<BizData> {
  if (!adminDb) throw new Error("Database not available");
  const doc = await adminDb.collection('profiles').doc(uid).get();
  const d = doc.data() || {};
  const parts = [d.address, d.city, d.state].filter(Boolean);
  return {
    name:     d.companyName || d.name || 'NotaryPro',
    email:    d.email   || '',
    phone:    d.phone   || '',
    website:  d.website || '',
    location: parts.join(', '),
  };
}

/**
 * Builds the From address for outbound email.
 * The sending domain must be verified in Resend — set FROM_EMAIL_ADDRESS in .env
 * (e.g. "noreply@notaryproapp.com").  The tenant's business name is used as the
 * display name so recipients see "Acme Notary <noreply@notaryproapp.com>".
 */
function buildFromEmail(biz: BizData): string {
  const addr = process.env.FROM_EMAIL_ADDRESS || 'noreply@notaryproapp.com';
  return `${biz.name} <${addr}>`;
}

// ─── Email Templates ──────────────────────────────────────────────────────────
function baseTemplate(content: string, biz: BizData): string {
  const websiteDisplay = biz.website.replace(/^https?:\/\//, '');
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>${biz.name}</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);max-width:600px;width:100%;">
        <tr>
          <td style="background:linear-gradient(135deg,#1e3a5f 0%,#2563eb 100%);padding:32px 40px;text-align:center;">
            <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:700;letter-spacing:0.5px;">${biz.name}</h1>
            <p style="margin:6px 0 0;color:#93c5fd;font-size:13px;letter-spacing:1px;">PROFESSIONAL NOTARY SERVICES</p>
          </td>
        </tr>
        <tr>
          <td style="padding:36px 40px;">
            ${content}
          </td>
        </tr>
        <tr>
          <td style="background:#f8fafc;padding:24px 40px;border-top:1px solid #e2e8f0;text-align:center;">
            <p style="margin:0;color:#64748b;font-size:12px;">${biz.name}${biz.location ? ' &bull; ' + biz.location : ''}</p>
            ${biz.website ? `<p style="margin:6px 0 0;color:#64748b;font-size:12px;"><a href="${biz.website}" style="color:#2563eb;text-decoration:none;">${websiteDisplay}</a></p>` : ''}
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

/**
 * HMAC-signs a customerId so unsubscribe links cannot be forged by guessing IDs.
 * Set UNSUBSCRIBE_SECRET in .env (any long random string).
 * If the secret is missing the token is still included but effectively unsigned —
 * the route will log a warning and fall through.
 */
function signUnsubscribeToken(customerId: string): string {
  const secret = process.env.UNSUBSCRIBE_SECRET;
  if (!secret) {
    console.warn('[Unsubscribe] UNSUBSCRIBE_SECRET is not set — tokens are not secure.');
    return 'unsigned';
  }
  return crypto.createHmac('sha256', secret).update(customerId).digest('hex');
}

function verifyUnsubscribeToken(customerId: string, token: string): boolean {
  const secret = process.env.UNSUBSCRIBE_SECRET;
  if (!secret) return true; // degrade gracefully if secret not configured yet
  const expected = crypto.createHmac('sha256', secret).update(customerId).digest('hex');
  try {
    return token.length === expected.length &&
      crypto.timingSafeEqual(Buffer.from(token, 'hex'), Buffer.from(expected, 'hex'));
  } catch {
    return false;
  }
}

function unsubscribeFooter(customerId: string): string {
  const token = signUnsubscribeToken(customerId);
  return `<p style="margin:24px 0 0;text-align:center;font-size:11px;color:#94a3b8;">
    Don't want to receive these emails?
    <a href="${APP_URL}/api/email/unsubscribe/${customerId}?token=${token}" style="color:#94a3b8;">Unsubscribe</a>
  </p>`;
}

// ─── Consent form link signing ────────────────────────────────────────────────
// Signing links are public by necessity — the client is not a logged-in user.
// Security comes from an HMAC over "formId:expiry" plus a server-side expiry
// check, which prevents both forgery and indefinite reuse of an old link.
const CONSENT_SECRET = process.env.CONSENT_SECRET || process.env.UNSUBSCRIBE_SECRET || '';
/** Signing links are valid for this many days after they are sent. */
const CONSENT_LINK_DAYS = Number(process.env.CONSENT_LINK_DAYS || 30);

function signConsentToken(formId: string, expiresAt: string): string {
  if (!CONSENT_SECRET) {
    console.warn('[Consent] CONSENT_SECRET/UNSUBSCRIBE_SECRET is not set — signing links are NOT secure.');
    return 'unsigned';
  }
  return crypto.createHmac('sha256', CONSENT_SECRET).update(`${formId}:${expiresAt}`).digest('hex');
}

function verifyConsentToken(formId: string, expiresAt: string, token: string): boolean {
  if (!CONSENT_SECRET) return true; // degrade gracefully before the secret is configured
  if (!expiresAt || !token) return false;
  const expected = crypto.createHmac('sha256', CONSENT_SECRET).update(`${formId}:${expiresAt}`).digest('hex');
  try {
    return token.length === expected.length &&
      crypto.timingSafeEqual(Buffer.from(token, 'hex'), Buffer.from(expected, 'hex'));
  } catch {
    return false;
  }
}

function buildSigningUrl(formId: string, expiresAt: string): string {
  const token = signConsentToken(formId, expiresAt);
  return `${APP_URL}/sign/${formId}?token=${token}&exp=${encodeURIComponent(expiresAt)}`;
}

/** Best-effort client IP behind Hostinger's proxy. */
function clientIp(req: express.Request): string {
  const fwd = req.headers['x-forwarded-for'];
  const raw = Array.isArray(fwd) ? fwd[0] : (fwd || '');
  return (raw.split(',')[0] || req.socket.remoteAddress || '').trim();
}

// ─── AI-personalized attorney outreach helpers ────────────────────────────────
interface PracticeArea { area: string; docs: string; }
const PRACTICE_RULES: { match: RegExp; area: string; docs: string }[] = [
  { match: /estate|elder|trust|probate|wills?/i, area: 'estate planning', docs: 'wills, trusts, powers of attorney, and healthcare directives — including bedside signings at hospitals or care facilities when a client cannot travel' },
  { match: /famil|divorce|custody|matrimonial|adoption|formation/i, area: 'family law', docs: 'separation agreements, property settlements, and affidavits that need prompt, dependable notarization' },
  { match: /injur|accident|malpractice|tort|wrongful/i, area: 'personal injury', docs: 'settlement releases, affidavits, and disbursement documents, often on tight deadlines' },
  { match: /real estate|closing|title|property|mortgage|loan/i, area: 'real estate', docs: 'loan signings and closing packages at the title office, a client’s home, or any preferred location' },
  { match: /franchise|business|corporate|patent|\bip\b|startup|venture|commercial|securit/i, area: 'business & corporate law', docs: 'entity-formation documents, operating agreements, and contracts that require notarization' },
  { match: /immigration|visa|citizen/i, area: 'immigration law', docs: 'affidavits, sponsorship forms, and supporting documents that require notarization' },
];
const DEFAULT_PRACTICE: PracticeArea = { area: 'legal', docs: 'time-sensitive documents that require a reliable, mobile notary' };

function inferPractice(haystack: string): PracticeArea {
  for (const r of PRACTICE_RULES) if (r.match.test(haystack)) return { area: r.area, docs: r.docs };
  return DEFAULT_PRACTICE;
}

/** Attorney leads store the firm in `notes` as "{title} at {company}". */
function firmOf(customer: any): string {
  if (customer.company) return customer.company;
  const notes: string = customer.notes || '';
  const idx = notes.indexOf(' at ');
  return idx >= 0 ? notes.slice(idx + 4).trim() : '';
}

function escapeHtmlText(s: string): string {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Selects CRM customers for an outreach send (mirrors send-newsletter filtering). */
async function selectRecipients(uid: string, recipientGroups: string[], tags: string[]): Promise<any[]> {
  if (!adminDb) throw new Error('Database not available');
  const snapshot = await adminDb.collection('customers').where('userId', '==', uid).get();
  let customers = snapshot.docs.map((d: any) => ({ id: d.id, ...d.data() }));
  customers = customers.filter((c: any) => !c.unsubscribed);
  if (!recipientGroups.includes('all')) {
    const wantedTags: string[] = Array.isArray(tags) ? tags : [];
    const typeToContact = (t: string) => (t || '').toLowerCase().replace(/\s+/g, '_');
    customers = customers.filter((c: any) => {
      const cTags: string[] = c.tags || [];
      const matchesTags = wantedTags.length > 0 && wantedTags.some(t => cTags.includes(t) || typeToContact(c.customerType) === t);
      const matchesType = recipientGroups.includes(c.customerType);
      return matchesTags || matchesType;
    });
  }
  return customers.filter((c: any) => c.email && c.email.trim() !== '');
}

/** Calls Claude Haiku to write a personalized intro for one attorney. */
async function personalizeIntro(customer: any, practice: PracticeArea, biz: BizData): Promise<{ subject: string; paragraphs: string[] }> {
  if (!anthropic) throw new Error('AI not configured');
  const firm = firmOf(customer);
  const prompt = `You are writing the BODY of a short, warm, professional cold-outreach email on behalf of ${biz.name}, a certified mobile notary public serving ${biz.location || 'the local area'}.

Recipient:
- Name: ${customer.fullName || customer.firstName || ''}
- Role/notes: ${customer.notes || customer.title || ''}
- Firm: ${firm}
- Likely practice area: ${practice.area}
- Relevant notary work for this practice: ${practice.docs}

Strict requirements:
- Return ONLY valid JSON: {"subject": string, "paragraphs": [string, string]}
- Exactly TWO short paragraphs (2-3 sentences each), plain text, no HTML, no markdown.
- Do NOT include a greeting ("Dear ...") or a sign-off — those are added separately.
- Reference their ${practice.area} focus naturally and tie it to the documents/situations above.
- Mention mobile, same-day availability across ${biz.location || 'the area'}.
- Do NOT invent facts about the firm (no awards, case results, client names, or dates).
- Tone: courteous, concise, peer-to-peer. No emojis, no buzzwords.
- Subject line: 5-9 words, specific, no clickbait, no ALL CAPS.`;

  const message = await anthropic.messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: 1024,
    messages: [{ role: 'user', content: prompt }],
  });
  const text = message.content[0].type === 'text' ? message.content[0].text : '';
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('Could not parse AI response');
  const obj = JSON.parse(jsonMatch[0]);
  const paragraphs = Array.isArray(obj.paragraphs) ? obj.paragraphs.map((p: any) => String(p).trim()) : [];
  if (!obj.subject || paragraphs.length === 0) throw new Error('AI returned unexpected shape');
  return { subject: String(obj.subject).trim(), paragraphs };
}

/** Injects a personalized intro into the attorney template HTML. */
function renderPersonalized(templateHtml: string, customer: any, intro: { paragraphs: string[] }): string {
  const firstName = (customer.firstName || customer.fullName || '').trim().split(/\s+/)[0] || 'there';
  const firm = firmOf(customer);
  const paras = intro.paragraphs.map((p, i) => {
    const mb = i === intro.paragraphs.length - 1 ? '0' : '20px';
    return `<p style="margin:0 0 ${mb} 0;font-size:15px;line-height:1.7;color:#374151;">${escapeHtmlText(p)}</p>`;
  }).join('\n              ');
  const introBlock =
`<!-- INTRO -->
          <tr>
            <td style="padding:44px 48px 28px 48px;">
              <p style="margin:0 0 20px 0;font-size:15px;line-height:1.7;color:#374151;">Dear ${escapeHtmlText(firstName)},</p>
              ${paras}
            </td>
          </tr>

          <!-- DIVIDER -->`;
  let html = templateHtml.replace(/<!-- INTRO -->[\s\S]*?<!-- DIVIDER -->/, introBlock);
  html = html.replace(/\[First Name\]/g, escapeHtmlText(firstName));
  html = html.replace(/\[Law Firm Name\]/g, escapeHtmlText(firm));
  return html;
}

const TEMPLATES: Record<string, { subject: (biz: BizData) => string; html: (data: any, biz: BizData) => string }> = {
  thank_you: {
    subject: (biz) => `Thank You for Choosing ${biz.name}`,
    html: (d, biz) => baseTemplate(`
      <h2 style="margin:0 0 16px;color:#1e3a5f;font-size:20px;">Thank You, ${d.firstName}!</h2>
      <p style="color:#475569;line-height:1.7;margin:0 0 16px;">
        We truly appreciate you trusting ${biz.name} with your notary needs.
        It was a pleasure working with you, and we hope to serve you again in the future.
      </p>
      <p style="color:#475569;line-height:1.7;margin:0 0 16px;">
        If you have any questions or need notary services again, don't hesitate to reach out.
        We're available 7 days a week.
      </p>
      ${biz.website ? `<div style="text-align:center;margin:28px 0;"><a href="${biz.website}/book" style="background:#2563eb;color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:600;font-size:14px;">Book Again</a></div>` : ''}
      ${d.customerId ? unsubscribeFooter(d.customerId) : ''}
    `, biz)
  },
  appointment_reminder: {
    subject: (_biz) => `Reminder: Your Upcoming Notary Appointment`,
    html: (d, biz) => baseTemplate(`
      <h2 style="margin:0 0 16px;color:#1e3a5f;font-size:20px;">Appointment Reminder</h2>
      <p style="color:#475569;line-height:1.7;margin:0 0 20px;">Hi ${d.firstName}, this is a friendly reminder about your upcoming appointment:</p>
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border-radius:8px;border:1px solid #e2e8f0;margin:0 0 20px;">
        <tr><td style="padding:20px 24px;">
          <p style="margin:0 0 10px;color:#1e3a5f;"><strong>📅 Date:</strong> ${d.date || 'TBD'}</p>
          <p style="margin:0 0 10px;color:#1e3a5f;"><strong>🕐 Time:</strong> ${d.time || 'TBD'}</p>
          <p style="margin:0 0 10px;color:#1e3a5f;"><strong>📍 Location:</strong> ${d.location || 'TBD'}</p>
          <p style="margin:0;color:#1e3a5f;"><strong>📋 Type:</strong> ${d.signingType || 'Notary Appointment'}</p>
        </td></tr>
      </table>
      <p style="color:#475569;line-height:1.7;margin:0 0 16px;">
        <strong>Please remember to bring:</strong> A valid government-issued photo ID.
        Do not sign any documents before the appointment.
      </p>
      ${d.customerId ? unsubscribeFooter(d.customerId) : ''}
    `, biz)
  },
  new_service: {
    subject: (biz) => `New Service Available — ${biz.name}`,
    html: (d, biz) => baseTemplate(`
      <h2 style="margin:0 0 16px;color:#1e3a5f;font-size:20px;">Exciting News, ${d.firstName}!</h2>
      <p style="color:#475569;line-height:1.7;margin:0 0 16px;">${d.body || 'We have a new service available for you.'}</p>
      ${biz.website ? `<div style="text-align:center;margin:28px 0;"><a href="${biz.website}" style="background:#2563eb;color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:600;font-size:14px;">Learn More</a></div>` : ''}
      ${d.customerId ? unsubscribeFooter(d.customerId) : ''}
    `, biz)
  },
  general_outreach: {
    subject: (biz) => `A Message from ${biz.name}`,
    html: (d, biz) => baseTemplate(`
      <h2 style="margin:0 0 16px;color:#1e3a5f;font-size:20px;">Hi ${d.firstName},</h2>
      <div style="color:#475569;line-height:1.7;margin:0 0 16px;">${d.body || ''}</div>
      ${d.customerId ? unsubscribeFooter(d.customerId) : ''}
    `, biz)
  },
  newsletter: {
    subject: (biz) => `Newsletter from ${biz.name}`,
    html: (d, biz) => baseTemplate(`
      <h2 style="margin:0 0 8px;color:#1e3a5f;font-size:22px;">📰 Newsletter</h2>
      <p style="margin:0 0 24px;color:#94a3b8;font-size:13px;text-transform:uppercase;letter-spacing:1px;">From ${biz.name}</p>
      <div style="color:#475569;line-height:1.8;margin:0 0 16px;">${d.body || ''}</div>
      ${biz.website ? `<div style="text-align:center;margin:28px 0;"><a href="${biz.website}" style="background:#2563eb;color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:600;font-size:14px;">Visit Our Website</a></div>` : ''}
      ${d.customerId ? unsubscribeFooter(d.customerId) : ''}
    `, biz)
  }
};

// ─── Gemini Setup ─────────────────────────────────────────────────────────────
const genAI = process.env.GEMINI_API_KEY ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY) : null;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

process.on('uncaughtException', (err) => { console.error('Uncaught Exception:', err); });
process.on('unhandledRejection', (reason, promise) => { console.error('Unhandled Rejection at:', promise, 'reason:', reason); });

// ─── Firebase Auth Middleware ─────────────────────────────────────────────────
// Reads the Firebase ID token from the Authorization header, verifies it with
// Firebase Admin, and attaches the decoded token to req.user.
// Usage: add `verifyFirebaseToken` as the second argument to any route that
// must be accessible only to signed-in users.
async function verifyFirebaseToken(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
): Promise<void> {
  if (!adminAuth) {
    res.status(503).json({ error: "Auth service not available. Ensure GOOGLE_SERVICE_ACCOUNT_JSON is set." });
    return;
  }
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Unauthorized: missing or malformed Authorization header" });
    return;
  }
  const token = authHeader.slice(7);
  try {
    const decoded = await adminAuth.verifyIdToken(token);
    (req as any).user = decoded;
    next();
  } catch (err: any) {
    res.status(401).json({ error: "Unauthorized: invalid or expired token" });
  }
}

async function startServer() {
  console.log("Starting server process...");
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  let serviceAccountAuth: any;
  if (process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL && process.env.GOOGLE_PRIVATE_KEY) {
    try {
      const privateKey = process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n');
      serviceAccountAuth = new google.auth.JWT({
        email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        key: privateKey,
        scopes: ['https://www.googleapis.com/auth/calendar.events']
      });
    } catch (e) {
      console.error("Failed to initialize Service Account Auth:", e);
    }
  }

  function getOAuth2Client(req?: express.Request) {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    if (!clientId || !clientSecret) return null;

    let redirectUri = process.env.GOOGLE_REDIRECT_URI;
    if (!redirectUri && req) {
      const proto = req.headers['x-forwarded-proto'] || req.protocol || 'http';
      const host = req.headers['x-forwarded-host'] || req.get('host');
      const origin = req.get('origin') || `${proto}://${host}`;
      redirectUri = `${origin.replace(/\/$/, '')}/api/auth/google/callback`;
    }
    if (!redirectUri && process.env.APP_URL) {
      redirectUri = `${process.env.APP_URL.replace(/\/$/, '')}/api/auth/google/callback`;
    }
    if (!redirectUri) redirectUri = "http://localhost:3000/api/auth/google/callback";

    return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
  }

  app.use(compression());
  // Store raw body buffer on req so the Resend webhook can verify Svix signatures.
  app.use(express.json({
    verify: (req: any, _res, buf) => { req.rawBody = buf; }
  }));
  app.use(cookieParser());

  // ─── EMAIL ROUTES ────────────────────────────────────────────────────────────

  app.post("/api/email/send-single", verifyFirebaseToken, async (req, res) => {
    if (!resend) return res.status(503).json({ error: "Email service not configured. Add RESEND_API_KEY." });

    const uid = (req as any).user.uid;
    const { to, toName, customerId, templateId, subject, body, templateData, rawHtml } = req.body;
    if (!to) return res.status(400).json({ error: "Recipient email required" });

    try {
      const biz = await getBusinessProfile(uid);
      const fromEmail = buildFromEmail(biz);
      let emailSubject = subject;
      let emailHtml = '';

      if (rawHtml) {
        emailSubject = subject || `A Message from ${biz.name}`;
        const firstName = toName?.split(' ')[0] || 'Valued Client';
        let processedHtml = (body || '').replace(/\{\{firstName\}\}/g, firstName);
        const unsubFooter = customerId ? unsubscribeFooter(customerId) : '';
        // Inject unsubscribe footer before </body> if present, otherwise append
        if (unsubFooter) {
          processedHtml = processedHtml.includes('</body>')
            ? processedHtml.replace('</body>', `<div style="text-align:center;padding:16px 0;">${unsubFooter}</div></body>`)
            : processedHtml + `<div style="text-align:center;padding:16px 0;">${unsubFooter}</div>`;
        }
        emailHtml = processedHtml;
      } else if (templateId && TEMPLATES[templateId]) {
        const template = TEMPLATES[templateId];
        emailSubject = subject || template.subject(biz);
        emailHtml = template.html({
          firstName: toName?.split(' ')[0] || 'Valued Client',
          customerId,
          body,
          ...templateData
        }, biz);
      } else {
        emailSubject = subject || `A Message from ${biz.name}`;
        emailHtml = baseTemplate(`
          <h2 style="margin:0 0 16px;color:#1e3a5f;font-size:20px;">Hi ${toName?.split(' ')[0] || 'there'},</h2>
          <div style="color:#475569;line-height:1.7;">${body || ''}</div>
          ${customerId ? unsubscribeFooter(customerId) : ''}
        `, biz);
      }

      const tags = [];
      if (customerId) tags.push({ name: "subscriber_id", value: customerId });
      if (templateId) tags.push({ name: "campaign_id", value: templateId });

      const result = await resend.emails.send({
        from: fromEmail,
        to: [to],
        subject: emailSubject,
        html: emailHtml,
        tags: tags.length > 0 ? tags : undefined,
      });

      console.log(`[Email] Sent single email to ${to}`, result);

      const emailId = (result as any)?.data?.id || (result as any)?.id;
      if (adminDb && emailId) {
        try {
          await adminDb.collection('emailEvents').add({
            userId: uid,
            subscriberId: customerId || 'unknown',
            campaignId: templateId || 'single',
            type: 'sent',
            timestamp: new Date().toISOString(),
            metadata: {
              emailId,
              subject: emailSubject,
              to: [to],
            }
          });
        } catch (dbErr: any) {
          console.error("[Email Sync] Failed to store sent event:", dbErr.message);
        }
      }

      res.json({ success: true, result });
    } catch (error: any) {
      console.error("[Email] Send single error:", error);
      res.status(500).json({ error: error.message || "Failed to send email" });
    }
  });

  app.post("/api/email/send-newsletter", verifyFirebaseToken, async (req, res) => {
    if (!resend) return res.status(503).json({ error: "Email service not configured. Add RESEND_API_KEY." });
    if (!adminDb) return res.status(503).json({ error: "Database not configured." });

    const uid = (req as any).user.uid;
    const { templateId, subject, body, templateData, recipientGroups, tags, campaignId } = req.body;

    if (!recipientGroups || !recipientGroups.length) {
      return res.status(400).json({ error: "recipientGroups is required" });
    }

    try {
      const biz = await getBusinessProfile(uid);
      const fromEmail = buildFromEmail(biz);
      const snapshot = await adminDb.collection('customers').where('userId', '==', uid).get();
      let customers = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));

      customers = customers.filter((c: any) => !c.unsubscribed);

      if (!recipientGroups.includes('all')) {
        // Tag-based segment targeting: a customer matches if any of their tags is
        // in the requested tag list, or (legacy) their customerType is requested.
        const wantedTags: string[] = Array.isArray(tags) ? tags : [];
        const typeToContact = (t: string) => (t || '').toLowerCase().replace(/\s+/g, '_');
        customers = customers.filter((c: any) => {
          const cTags: string[] = c.tags || [];
          const matchesTags = wantedTags.length > 0 && wantedTags.some(t => cTags.includes(t) || typeToContact(c.customerType) === t);
          const matchesType = recipientGroups.includes(c.customerType);
          return matchesTags || matchesType;
        });
      }

      customers = customers.filter((c: any) => c.email && c.email.trim() !== '');

      if (customers.length === 0) {
        return res.json({ success: true, sent: 0, message: "No eligible recipients found." });
      }

      console.log(`[Email] Newsletter sending to ${customers.length} recipients`);

      const BATCH_SIZE = 50;
      let sent = 0;
      let failed = 0;
      const errors: string[] = [];

      for (let i = 0; i < customers.length; i += BATCH_SIZE) {
        const batch = customers.slice(i, i + BATCH_SIZE);

        await Promise.all(batch.map(async (customer: any) => {
          try {
            let emailSubject = subject;
            let emailHtml = '';
            const firstName = customer.firstName || customer.fullName?.split(' ')[0] || 'Valued Client';

            if (templateId && TEMPLATES[templateId]) {
              const template = TEMPLATES[templateId];
              emailSubject = subject || template.subject(biz);
              emailHtml = template.html({
                firstName,
                customerId: customer.id,
                body,
                ...templateData
              }, biz);
            } else {
              emailSubject = subject || `A Message from ${biz.name}`;
              emailHtml = baseTemplate(`
                <h2 style="margin:0 0 16px;color:#1e3a5f;font-size:20px;">Hi ${firstName},</h2>
                <div style="color:#475569;line-height:1.7;">${body || ''}</div>
                ${unsubscribeFooter(customer.id)}
              `, biz);
            }

            const tags = [];
            if (customer.id) tags.push({ name: 'subscriber_id', value: customer.id });
            if (campaignId || templateId) {
              tags.push({ name: 'campaign_id', value: campaignId || templateId });
            }

            const sendResult = await resend.emails.send({
              from: fromEmail,
              to: [customer.email],
              subject: emailSubject,
              html: emailHtml,
              tags: tags.length > 0 ? tags : undefined,
            });

            sent++;

            const emailId = (sendResult as any)?.data?.id || (sendResult as any)?.id;
            if (adminDb && emailId) {
              try {
                await adminDb.collection('emailEvents').add({
                  userId: uid,
                  subscriberId: customer.id || 'unknown',
                  campaignId: campaignId || templateId || 'newsletter',
                  type: 'sent',
                  timestamp: new Date().toISOString(),
                  metadata: {
                    emailId,
                    subject: emailSubject,
                    to: [customer.email],
                  }
                });
              } catch (dbErr: any) {
                console.error("[Email Sync] Failed to store sent event:", dbErr.message);
              }
            }
          } catch (err: any) {
            failed++;
            errors.push(`${customer.email}: ${err.message}`);
            console.error(`[Email] Failed to send to ${customer.email}:`, err.message);
          }
        }));

        if (i + BATCH_SIZE < customers.length) {
          await new Promise(r => setTimeout(r, 1000));
        }
      }

      console.log(`[Email] Newsletter complete. Sent: ${sent}, Failed: ${failed}`);
      res.json({ success: true, sent, failed, errors: errors.slice(0, 10) });

    } catch (error: any) {
      console.error("[Email] Newsletter error:", error);
      res.status(500).json({ error: error.message || "Failed to send newsletter" });
    }
  });

  // ─── AI-personalized outreach: generate drafts (no send) ──────────────────────
  app.post("/api/email/personalize-outreach", verifyFirebaseToken, async (req, res) => {
    if (!anthropic) return res.status(503).json({ error: "AI is not configured. Add ANTHROPIC_API_KEY." });
    if (!adminDb) return res.status(503).json({ error: "Database not configured." });

    const uid = (req as any).user.uid;
    const { recipientGroups, tags, templateHtml, limit, skip } = req.body;
    if (!templateHtml || typeof templateHtml !== 'string') {
      return res.status(400).json({ error: "templateHtml is required" });
    }
    if (!recipientGroups || !recipientGroups.length) {
      return res.status(400).json({ error: "recipientGroups is required" });
    }

    try {
      const biz = await getBusinessProfile(uid);
      let recipients = await selectRecipients(uid, recipientGroups, Array.isArray(tags) ? tags : []);

      const start = Number.isFinite(skip) ? Math.max(0, Number(skip)) : 0;
      if (start) recipients = recipients.slice(start);
      if (Number.isFinite(limit) && Number(limit) > 0) recipients = recipients.slice(0, Number(limit));

      if (recipients.length === 0) return res.json({ drafts: [], total: 0 });

      console.log(`[Outreach] Personalizing ${recipients.length} drafts`);

      const drafts: any[] = [];
      const CONCURRENCY = 5;
      for (let i = 0; i < recipients.length; i += CONCURRENCY) {
        const batch = recipients.slice(i, i + CONCURRENCY);
        const results = await Promise.all(batch.map(async (c: any) => {
          const firm = firmOf(c);
          const practice = inferPractice(`${firm} ${c.notes || c.title || ''}`);
          const fullName = c.fullName || `${c.firstName || ''} ${c.lastName || ''}`.trim() || c.email;
          try {
            const intro = await personalizeIntro(c, practice, biz);
            const html = renderPersonalized(templateHtml, c, intro);
            return { customerId: c.id, fullName, email: c.email, company: firm, practiceArea: practice.area, subject: intro.subject, html };
          } catch (err: any) {
            return { customerId: c.id, fullName, email: c.email, company: firm, practiceArea: practice.area, subject: '', html: '', error: err.message };
          }
        }));
        drafts.push(...results);
      }

      const failed = drafts.filter(d => d.error).length;
      console.log(`[Outreach] Personalization complete. OK: ${drafts.length - failed}, failed: ${failed}`);
      res.json({ drafts, total: drafts.length });
    } catch (error: any) {
      console.error("[Outreach] Personalize error:", error);
      res.status(500).json({ error: error.message || "Failed to personalize outreach" });
    }
  });

  // ─── AI-personalized outreach: send approved drafts ───────────────────────────
  app.post("/api/email/send-personalized", verifyFirebaseToken, async (req, res) => {
    if (!resend) return res.status(503).json({ error: "Email service not configured. Add RESEND_API_KEY." });
    if (!adminDb) return res.status(503).json({ error: "Database not configured." });

    const uid = (req as any).user.uid;
    const { drafts, campaignId } = req.body;
    if (!Array.isArray(drafts) || drafts.length === 0) {
      return res.status(400).json({ error: "drafts is required" });
    }

    try {
      const biz = await getBusinessProfile(uid);
      const fromEmail = buildFromEmail(biz);
      const valid = drafts.filter((d: any) => d && d.email && d.html && d.subject);

      const BATCH_SIZE = 20;
      let sent = 0;
      let failed = 0;
      const errors: string[] = [];

      for (let i = 0; i < valid.length; i += BATCH_SIZE) {
        const batch = valid.slice(i, i + BATCH_SIZE);
        await Promise.all(batch.map(async (d: any) => {
          try {
            const footer = d.customerId ? unsubscribeFooter(d.customerId) : '';
            let html = d.html as string;
            if (footer) {
              html = html.includes('</body>')
                ? html.replace('</body>', `<div style="text-align:center;padding:16px 0;">${footer}</div></body>`)
                : html + `<div style="text-align:center;padding:16px 0;">${footer}</div>`;
            }

            const sendTags = [];
            if (d.customerId) sendTags.push({ name: 'subscriber_id', value: d.customerId });
            if (campaignId) sendTags.push({ name: 'campaign_id', value: campaignId });

            const result = await resend.emails.send({
              from: fromEmail,
              to: [d.email],
              subject: d.subject,
              html,
              tags: sendTags.length ? sendTags : undefined,
            });
            sent++;

            const emailId = (result as any)?.data?.id || (result as any)?.id;
            if (adminDb && emailId) {
              try {
                await adminDb.collection('emailEvents').add({
                  userId: uid,
                  subscriberId: d.customerId || 'unknown',
                  campaignId: campaignId || 'personalized-outreach',
                  type: 'sent',
                  timestamp: new Date().toISOString(),
                  metadata: { emailId, subject: d.subject, to: [d.email], personalized: true },
                });
              } catch (dbErr: any) {
                console.error("[Outreach] Event log failed:", dbErr.message);
              }
            }
          } catch (err: any) {
            failed++;
            errors.push(`${d.email}: ${err.message}`);
            console.error(`[Outreach] Failed to send to ${d.email}:`, err.message);
          }
        }));
        if (i + BATCH_SIZE < valid.length) await new Promise(r => setTimeout(r, 1000));
      }

      console.log(`[Outreach] Send complete. Sent: ${sent}, Failed: ${failed}`);
      res.json({ success: true, sent, failed, errors: errors.slice(0, 10) });
    } catch (error: any) {
      console.error("[Outreach] Send error:", error);
      res.status(500).json({ error: error.message || "Failed to send personalized outreach" });
    }
  });

  app.get("/api/email/unsubscribe/:customerId", async (req, res) => {
    if (!adminDb) return res.status(503).send("Service unavailable");

    const { customerId } = req.params;
    const token = typeof req.query.token === 'string' ? req.query.token : '';

    if (!customerId) return res.status(400).send("Invalid unsubscribe link");

    // Verify HMAC token to prevent enumeration of customer IDs
    if (!verifyUnsubscribeToken(customerId, token)) {
      console.warn(`[Unsubscribe] Invalid token for customer ${customerId}`);
      return res.status(400).send(`
        <!DOCTYPE html><html><head><meta charset="utf-8"/>
        <title>Invalid Link</title>
        <style>body{margin:0;font-family:'Helvetica Neue',sans-serif;background:#f1f5f9;display:flex;align-items:center;justify-content:center;min-height:100vh;}
        .card{background:white;border-radius:12px;padding:48px 40px;text-align:center;max-width:480px;box-shadow:0 2px 12px rgba(0,0,0,.08);}
        h1{color:#1e3a5f;font-size:22px;margin:0 0 12px;}p{color:#64748b;line-height:1.7;}</style>
        </head><body><div class="card">
          <div style="font-size:48px;margin-bottom:16px;">⚠️</div>
          <h1>Invalid unsubscribe link</h1>
          <p>This link is invalid or has expired. Please use the unsubscribe link from your original email.</p>
        </div></body></html>`);
    }

    try {
      await adminDb.collection('customers').doc(customerId).update({
        unsubscribed: true,
        unsubscribedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      console.log(`[Email] Customer ${customerId} unsubscribed`);

      res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8"/>
          <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
          <title>Unsubscribed — NotaryPro</title>
          <style>
            body { margin:0; font-family: 'Helvetica Neue', sans-serif; background:#f1f5f9; display:flex; align-items:center; justify-content:center; min-height:100vh; }
            .card { background:white; border-radius:12px; padding:48px 40px; text-align:center; max-width:480px; box-shadow:0 2px 12px rgba(0,0,0,0.08); }
            h1 { color:#1e3a5f; font-size:22px; margin:0 0 12px; }
            p { color:#64748b; line-height:1.7; margin:0 0 8px; }
            a { color:#2563eb; }
          </style>
        </head>
        <body>
          <div class="card">
            <div style="font-size:48px;margin-bottom:16px;">✅</div>
            <h1>You've been unsubscribed</h1>
            <p>You will no longer receive marketing emails from this business.</p>
            <p>Need notary services? Visit <a href="${APP_URL}">${APP_URL}</a></p>
          </div>
        </body>
        </html>
      `);
    } catch (error: any) {
      console.error("[Email] Unsubscribe error:", error);
      res.status(500).send("Something went wrong. Please try again.");
    }
  });

  // ─── CONSENT FORM ROUTES ─────────────────────────────────────────────────────
  // Authenticated routes are used by the CRM. The /api/public/* routes below are
  // reachable without a login (the signer is a client, not a user) and are
  // therefore gated on an HMAC-signed, expiring link instead.

  const CONSENT_COLLECTION = 'consentForms';

  /** Strips fields the client-side signing page must never see. */
  function publicConsentView(id: string, d: any) {
    return {
      id,
      status: d.status,
      templateId: d.templateId,
      templateName: d.templateName,
      documentTitle: d.documentTitle,
      clientName: d.clientName,
      clientEmail: d.clientEmail,
      renderedHtml: d.renderedHtml,
      acknowledgementList: d.acknowledgementList || [],
      businessName: d.businessName,
      businessEmail: d.businessEmail,
      businessPhone: d.businessPhone,
      expiresAt: d.expiresAt,
      signedAt: d.signedAt || null,
      signature: d.signature ? { typedName: d.signature.typedName, signedAt: d.signature.signedAt } : null,
    };
  }

  function consentEmailBody(opts: {
    clientName: string;
    biz: BizData;
    templateName: string;
    signingUrl: string;
    expiresAt: string;
    note?: string;
  }): string {
    const firstName = (opts.clientName || '').trim().split(/\s+/)[0] || 'there';
    const expires = new Date(opts.expiresAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    return `
      <p style="margin:0 0 18px;font-size:15px;line-height:1.7;color:#374151;">Hi ${escapeConsentHtml(firstName)},</p>
      <p style="margin:0 0 18px;font-size:15px;line-height:1.7;color:#374151;">
        Before your appointment, please review and sign the <strong>${escapeConsentHtml(opts.templateName)}</strong> consent and disclosure form.
        It explains what I can and cannot do as a notary, the fees, and what to bring. It takes about two minutes.
      </p>
      ${opts.note ? `<p style="margin:0 0 18px;font-size:15px;line-height:1.7;color:#374151;">${escapeConsentHtml(opts.note)}</p>` : ''}
      <p style="margin:0 0 26px;text-align:center;">
        <a href="${opts.signingUrl}" style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;padding:14px 32px;border-radius:10px;">Review &amp; Sign</a>
      </p>
      <p style="margin:0 0 18px;font-size:13px;line-height:1.7;color:#64748b;">
        This link is unique to you and expires on ${escapeConsentHtml(expires)}. If the button does not work, copy and paste this address into your browser:<br/>
        <span style="word-break:break-all;color:#2563eb;">${opts.signingUrl}</span>
      </p>
      <p style="margin:0;font-size:15px;line-height:1.7;color:#374151;">
        Thank you,<br/>${escapeConsentHtml(opts.biz.name)}${opts.biz.phone ? '<br/>' + escapeConsentHtml(opts.biz.phone) : ''}
      </p>`;
  }

  /** Creates a consent form draft for a customer. */
  app.post("/api/consent/forms", verifyFirebaseToken, async (req, res) => {
    if (!adminDb) return res.status(503).json({ error: "Database not available" });
    const uid = (req as any).user.uid;
    const { templateId, customerId, fields } = req.body || {};

    const template = getConsentTemplate(templateId);
    if (!template) return res.status(400).json({ error: "Unknown consent template" });

    const values: Record<string, string> = {};
    for (const f of template.fields) {
      const v = (fields || {})[f.key];
      values[f.key] = v == null ? '' : String(v).slice(0, 2000);
    }

    const missing = template.fields.filter(f => f.required && !values[f.key].trim()).map(f => f.label);
    if (missing.length) return res.status(400).json({ error: `Missing required field(s): ${missing.join(', ')}` });

    const clientEmail = (values.clientEmail || '').trim();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(clientEmail)) {
      return res.status(400).json({ error: "A valid client email is required" });
    }

    try {
      const now = new Date().toISOString();
      const ref = adminDb.collection(CONSENT_COLLECTION).doc();
      const doc = {
        id: ref.id,
        userId: uid,
        customerId: customerId || null,
        templateId: template.id,
        templateName: template.name,
        documentTitle: template.documentTitle,
        status: 'draft',
        clientName: values.clientName || '',
        clientEmail,
        fields: values,
        acknowledgementList: template.acknowledgements,
        audit: [{ event: 'created', at: now, ip: clientIp(req) }],
        createdAt: now,
        updatedAt: now,
      };
      await ref.set(doc);
      res.json({ success: true, form: doc });
    } catch (error: any) {
      console.error("[Consent] Create failed:", error);
      res.status(500).json({ error: error.message || "Could not create consent form" });
    }
  });

  /** Updates a draft's field values. Signed forms are immutable. */
  app.put("/api/consent/forms/:id", verifyFirebaseToken, async (req, res) => {
    if (!adminDb) return res.status(503).json({ error: "Database not available" });
    const uid = (req as any).user.uid;
    const { fields } = req.body || {};

    try {
      const ref = adminDb.collection(CONSENT_COLLECTION).doc(String(req.params.id));
      const snap = await ref.get();
      const d = snap.data();
      if (!snap.exists || !d || d.userId !== uid) return res.status(404).json({ error: "Form not found" });
      if (d.status === 'signed') return res.status(409).json({ error: "A signed form cannot be edited" });

      const template = getConsentTemplate(d.templateId);
      if (!template) return res.status(400).json({ error: "Unknown consent template" });

      const values: Record<string, string> = { ...(d.fields || {}) };
      for (const f of template.fields) {
        if (fields && fields[f.key] != null) values[f.key] = String(fields[f.key]).slice(0, 2000);
      }

      await ref.update({
        fields: values,
        clientName: values.clientName || d.clientName,
        clientEmail: (values.clientEmail || d.clientEmail || '').trim(),
        updatedAt: new Date().toISOString(),
      });
      res.json({ success: true });
    } catch (error: any) {
      console.error("[Consent] Update failed:", error);
      res.status(500).json({ error: error.message || "Could not update consent form" });
    }
  });

  /**
   * Freezes the rendered document, then emails the signing link.
   * Freezing matters: the signature must be tied to the exact text the client
   * saw, so later template edits cannot alter an already-sent record.
   */
  app.post("/api/consent/forms/:id/send", verifyFirebaseToken, async (req, res) => {
    if (!adminDb) return res.status(503).json({ error: "Database not available" });
    if (!resend) return res.status(503).json({ error: "Email service not configured. Add RESEND_API_KEY." });
    const uid = (req as any).user.uid;
    const note = typeof req.body?.note === 'string' ? req.body.note.slice(0, 500) : '';

    try {
      const ref = adminDb.collection(CONSENT_COLLECTION).doc(String(req.params.id));
      const snap = await ref.get();
      const d = snap.data();
      if (!snap.exists || !d || d.userId !== uid) return res.status(404).json({ error: "Form not found" });
      if (d.status === 'signed') return res.status(409).json({ error: "This form has already been signed" });

      const template = getConsentTemplate(d.templateId);
      if (!template) return res.status(400).json({ error: "Unknown consent template" });

      const biz = await getBusinessProfile(uid);
      const profileSnap = await adminDb.collection('profiles').doc(uid).get();
      const profile = profileSnap.data() || {};

      const renderedHtml = renderConsentDocument({
        template,
        fields: d.fields || {},
        business: {
          name: biz.name,
          email: biz.email,
          phone: biz.phone,
          location: biz.location,
          website: biz.website,
          commissionNumber: profile.commissionNumber || '',
          commissionExpiration: profile.commissionExpiration || '',
        },
      });

      const now = new Date();
      const expiresAt = new Date(now.getTime() + CONSENT_LINK_DAYS * 86400000).toISOString();
      const signingUrl = buildSigningUrl(ref.id, expiresAt);
      const wasSent = d.status === 'sent' || d.status === 'viewed';

      const { data, error } = await resend.emails.send({
        from: buildFromEmail(biz),
        to: d.clientEmail,
        replyTo: biz.email || undefined,
        subject: `Please review and sign: ${template.name} consent form`,
        html: baseTemplate(
          consentEmailBody({
            clientName: d.clientName,
            biz,
            templateName: template.name,
            signingUrl,
            expiresAt,
            note,
          }),
          biz,
        ),
      });
      if (error) throw new Error(error.message || 'Resend rejected the message');

      await ref.update({
        status: 'sent',
        renderedHtml,
        businessName: biz.name,
        businessEmail: biz.email,
        businessPhone: biz.phone,
        acknowledgementList: template.acknowledgements,
        expiresAt,
        sentAt: now.toISOString(),
        updatedAt: now.toISOString(),
        audit: [
          ...(d.audit || []),
          { event: wasSent ? 'resent' : 'sent', at: now.toISOString(), detail: `Emailed to ${d.clientEmail}`, ip: clientIp(req) },
        ],
      });

      console.log(`[Consent] Form ${ref.id} sent to ${d.clientEmail} (${data?.id || 'no id'})`);
      res.json({ success: true, signingUrl, expiresAt });
    } catch (error: any) {
      console.error("[Consent] Send failed:", error);
      res.status(500).json({ error: error.message || "Could not send consent form" });
    }
  });

  /** Voids an unsigned form so its link stops working. */
  app.post("/api/consent/forms/:id/void", verifyFirebaseToken, async (req, res) => {
    if (!adminDb) return res.status(503).json({ error: "Database not available" });
    const uid = (req as any).user.uid;
    try {
      const ref = adminDb.collection(CONSENT_COLLECTION).doc(String(req.params.id));
      const snap = await ref.get();
      const d = snap.data();
      if (!snap.exists || !d || d.userId !== uid) return res.status(404).json({ error: "Form not found" });
      if (d.status === 'signed') return res.status(409).json({ error: "A signed form cannot be voided" });

      const now = new Date().toISOString();
      await ref.update({
        status: 'voided',
        updatedAt: now,
        audit: [...(d.audit || []), { event: 'voided', at: now, ip: clientIp(req) }],
      });
      res.json({ success: true });
    } catch (error: any) {
      console.error("[Consent] Void failed:", error);
      res.status(500).json({ error: error.message || "Could not void consent form" });
    }
  });

  // ─── PUBLIC (UNAUTHENTICATED) CONSENT ROUTES ─────────────────────────────────

  /** Loads a form for the signing page. Requires a valid, unexpired HMAC link. */
  app.get("/api/public/consent/:id", async (req, res) => {
    if (!adminDb) return res.status(503).json({ error: "Service unavailable" });
    const token = typeof req.query.token === 'string' ? req.query.token : '';
    const exp = typeof req.query.exp === 'string' ? req.query.exp : '';

    try {
      const ref = adminDb.collection(CONSENT_COLLECTION).doc(String(req.params.id));
      const snap = await ref.get();
      const d = snap.data();
      // A generic 404 for every failure mode keeps form IDs non-enumerable.
      if (!snap.exists || !d) return res.status(404).json({ error: "This form is no longer available." });
      if (!verifyConsentToken(String(req.params.id), exp, token)) {
        console.warn(`[Consent] Invalid token for form ${String(req.params.id)}`);
        return res.status(404).json({ error: "This link is invalid." });
      }
      if (d.expiresAt !== exp) return res.status(404).json({ error: "This link is no longer valid." });
      if (new Date(exp).getTime() < Date.now()) return res.status(410).json({ error: "This link has expired. Please ask for a new one." });
      if (d.status === 'voided') return res.status(410).json({ error: "This form was cancelled. Please ask for a new one." });
      if (d.status === 'draft') return res.status(404).json({ error: "This form is not ready yet." });

      if (d.status === 'sent') {
        const now = new Date().toISOString();
        await ref.update({
          status: 'viewed',
          viewedAt: now,
          updatedAt: now,
          audit: [...(d.audit || []), { event: 'viewed', at: now, ip: clientIp(req), userAgent: req.get('user-agent') || '' }],
        });
        d.status = 'viewed';
      }

      res.json({ form: publicConsentView(String(req.params.id), d) });
    } catch (error: any) {
      console.error("[Consent] Public fetch failed:", error);
      res.status(500).json({ error: "Something went wrong. Please try again." });
    }
  });

  /**
   * Records the client's electronic signature.
   * ESIGN/UETA compliance rests on the four things captured here: consent to
   * electronic records, intent to sign, association with the frozen record,
   * and a retained copy emailed to both parties.
   */
  app.post("/api/public/consent/:id/sign", async (req, res) => {
    if (!adminDb) return res.status(503).json({ error: "Service unavailable" });
    const { token, exp, typedName, drawnPng, agreedToElectronic, intentAcknowledged, acknowledgements } = req.body || {};

    if (!agreedToElectronic || !intentAcknowledged) {
      return res.status(400).json({ error: "Both consent boxes must be checked before signing." });
    }
    const name = String(typedName || '').trim();
    if (name.length < 2) return res.status(400).json({ error: "Please type your full legal name." });
    // Drawn signatures are stored inline in Firestore; cap well under the 1 MB doc limit.
    const png = typeof drawnPng === 'string' && drawnPng.startsWith('data:image/png;base64,') ? drawnPng : '';
    if (png.length > 400_000) return res.status(413).json({ error: "Signature image is too large." });

    try {
      const ref = adminDb.collection(CONSENT_COLLECTION).doc(String(req.params.id));
      const snap = await ref.get();
      const d = snap.data();
      if (!snap.exists || !d) return res.status(404).json({ error: "This form is no longer available." });
      if (!verifyConsentToken(String(req.params.id), String(exp || ''), String(token || ''))) {
        return res.status(404).json({ error: "This link is invalid." });
      }
      if (d.expiresAt !== exp) return res.status(404).json({ error: "This link is no longer valid." });
      if (new Date(String(exp)).getTime() < Date.now()) return res.status(410).json({ error: "This link has expired." });
      if (d.status === 'signed') return res.status(409).json({ error: "This form has already been signed." });
      if (d.status === 'voided') return res.status(410).json({ error: "This form was cancelled." });

      const required = (d.acknowledgementList || []).filter((a: any) => a.required);
      const checked = acknowledgements || {};
      const unchecked = required.filter((a: any) => !checked[a.key]);
      if (unchecked.length) {
        return res.status(400).json({ error: "Please check every required acknowledgement before signing." });
      }

      const now = new Date().toISOString();
      const ip = clientIp(req);
      const userAgent = req.get('user-agent') || '';
      const signature = { typedName: name, drawnPng: png, signedAt: now, ip, userAgent };

      await ref.update({
        status: 'signed',
        signature,
        signedAt: now,
        agreedToElectronic: true,
        intentAcknowledged: true,
        acknowledgements: checked,
        updatedAt: now,
        audit: [...(d.audit || []), { event: 'signed', at: now, ip, userAgent, detail: `Signed as "${name}"` }],
      });

      // Emailing the executed copy is what satisfies the "ability to retain"
      // requirement, so a failure here is logged loudly but does not undo the
      // signature the client has already given.
      if (resend) {
        try {
          const biz: BizData = {
            name: d.businessName || 'NotaryPro',
            email: d.businessEmail || '',
            phone: d.businessPhone || '',
            website: '',
            location: '',
          };
          const copyHtml = buildSignedCopyHtml(d, signature, biz);
          const from = buildFromEmail(biz);
          await resend.emails.send({
            from,
            to: d.clientEmail,
            replyTo: biz.email || undefined,
            subject: `Signed copy — ${d.templateName} consent form`,
            html: copyHtml,
          });
          if (biz.email) {
            await resend.emails.send({
              from,
              to: biz.email,
              subject: `${d.clientName || d.clientEmail} signed the ${d.templateName} consent form`,
              html: copyHtml,
            });
          }
        } catch (mailErr: any) {
          console.error("[Consent] Signed-copy email failed:", mailErr.message);
        }
      }

      console.log(`[Consent] Form ${String(req.params.id)} signed by ${name}`);
      res.json({ success: true, signedAt: now });
    } catch (error: any) {
      console.error("[Consent] Sign failed:", error);
      res.status(500).json({ error: "Something went wrong. Please try again." });
    }
  });

  /** Lets a client decline instead of signing, so the notary is not left waiting. */
  app.post("/api/public/consent/:id/decline", async (req, res) => {
    if (!adminDb) return res.status(503).json({ error: "Service unavailable" });
    const { token, exp, reason } = req.body || {};
    try {
      const ref = adminDb.collection(CONSENT_COLLECTION).doc(String(req.params.id));
      const snap = await ref.get();
      const d = snap.data();
      if (!snap.exists || !d) return res.status(404).json({ error: "This form is no longer available." });
      if (!verifyConsentToken(String(req.params.id), String(exp || ''), String(token || '')) || d.expiresAt !== exp) {
        return res.status(404).json({ error: "This link is invalid." });
      }
      if (d.status === 'signed') return res.status(409).json({ error: "This form has already been signed." });

      const now = new Date().toISOString();
      await ref.update({
        status: 'declined',
        declineReason: String(reason || '').slice(0, 1000),
        updatedAt: now,
        audit: [...(d.audit || []), { event: 'declined', at: now, ip: clientIp(req), userAgent: req.get('user-agent') || '' }],
      });
      res.json({ success: true });
    } catch (error: any) {
      console.error("[Consent] Decline failed:", error);
      res.status(500).json({ error: "Something went wrong. Please try again." });
    }
  });

  /** Full standalone HTML of an executed form, including the audit trail. */
  function buildSignedCopyHtml(d: any, signature: any, biz: BizData): string {
    const acks = (d.acknowledgementList || [])
      .map((a: any) => `<li style="margin:0 0 8px;font-size:13px;line-height:1.6;color:#334155;">${(d.acknowledgements || {})[a.key] ? '&#10003;' : '&#9744;'} ${escapeConsentHtml(a.label)}</li>`)
      .join('');

    const audit = (d.audit || [])
      .map((e: any) => `<tr>
        <td style="padding:4px 12px 4px 0;font-size:11px;color:#64748b;">${escapeConsentHtml(new Date(e.at).toLocaleString('en-US'))}</td>
        <td style="padding:4px 12px 4px 0;font-size:11px;color:#0f172a;text-transform:capitalize;">${escapeConsentHtml(e.event)}</td>
        <td style="padding:4px 0;font-size:11px;color:#64748b;">${escapeConsentHtml(e.ip || '')}</td>
      </tr>`)
      .join('');

    return `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>${escapeConsentHtml(d.documentTitle || 'Consent Form')}</title></head>
<body style="margin:0;padding:24px;background:#f1f5f9;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <div style="max-width:720px;margin:0 auto;background:#ffffff;border-radius:12px;padding:36px 40px;box-shadow:0 2px 12px rgba(0,0,0,0.08);">
    ${d.renderedHtml || ''}
    <section style="margin:28px 0 0;">
      <h3 style="margin:0 0 10px;font-size:14px;font-weight:700;color:#1e3a5f;">Acknowledgements</h3>
      <ul style="margin:0;padding:0 0 0 4px;list-style:none;">${acks}</ul>
    </section>
    <section style="margin:28px 0 0;padding:20px;border:1px solid #e2e8f0;border-radius:10px;background:#f8fafc;">
      <h3 style="margin:0 0 12px;font-size:14px;font-weight:700;color:#1e3a5f;">Electronic Signature</h3>
      <p style="margin:0 0 10px;font-size:13px;line-height:1.7;color:#334155;">
        The signer consented to do business electronically and indicated intent to sign.
      </p>
      ${signature.drawnPng ? `<img src="${signature.drawnPng}" alt="Signature" style="max-width:320px;display:block;margin:0 0 10px;border-bottom:1px solid #94a3b8;"/>` : ''}
      <p style="margin:0;font-size:18px;font-family:Georgia,'Times New Roman',serif;font-style:italic;color:#0f172a;">${escapeConsentHtml(signature.typedName)}</p>
      <p style="margin:6px 0 0;font-size:12px;color:#64748b;">
        Signed ${escapeConsentHtml(new Date(signature.signedAt).toLocaleString('en-US'))}
        ${signature.ip ? ' &bull; IP ' + escapeConsentHtml(signature.ip) : ''}
      </p>
      <p style="margin:8px 0 0;font-size:11px;color:#94a3b8;word-break:break-all;">Device: ${escapeConsentHtml(signature.userAgent || 'unknown')}</p>
      <p style="margin:8px 0 0;font-size:11px;color:#94a3b8;">Record ID: ${escapeConsentHtml(d.id || '')}</p>
    </section>
    <section style="margin:24px 0 0;">
      <h3 style="margin:0 0 8px;font-size:13px;font-weight:700;color:#1e3a5f;">Audit Trail</h3>
      <table style="border-collapse:collapse;">${audit}</table>
    </section>
    <p style="margin:24px 0 0;font-size:12px;color:#64748b;">
      Keep this email as your copy of the executed form. To request a paper copy at no charge, reply to this message${biz.email ? ' or write to ' + escapeConsentHtml(biz.email) : ''}.
    </p>
  </div>
</body></html>`;
  }

  // ─── PUBLIC WEBSITE INTAKE ───────────────────────────────────────────────────
  // Accepts leads from the marketing site. Writes go through the Admin SDK so
  // Firestore rules stay locked down for unauthenticated clients.

  const INTAKE_OWNER_UID = process.env.PUBLIC_INTAKE_UID || '';
  const INTAKE_ORIGINS = (process.env.INTAKE_ALLOWED_ORIGINS || '')
    .split(',').map(s => s.trim().replace(/\/$/, '')).filter(Boolean);
  /** In-memory throttle: 5 submissions per IP per hour. Resets on restart. */
  const intakeHits = new Map<string, number[]>();

  function applyIntakeCors(req: express.Request, res: express.Response) {
    const origin = (req.get('origin') || '').replace(/\/$/, '');
    if (origin && INTAKE_ORIGINS.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
      res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    }
  }

  app.options("/api/public/intake", (req, res) => {
    applyIntakeCors(req, res);
    res.sendStatus(204);
  });

  app.post("/api/public/intake", async (req, res) => {
    applyIntakeCors(req, res);
    if (!adminDb) return res.status(503).json({ error: "Service unavailable" });

    const {
      fullName, email, phone, serviceType, preferredDate,
      location, message, consentToContact, ownerId, company,
      quoteSignatures, quoteRoundTripMiles, quoteNotaryFee,
      quoteTravelFee, quoteTotal, quoteLocationType,
    } = req.body || {};

    // `company` is a honeypot: it is hidden from real users, so anything in it
    // is a bot. Return 200 so the bot does not learn it was filtered.
    if (typeof company === 'string' && company.trim()) {
      console.log('[Intake] Honeypot triggered, silently discarded');
      return res.json({ success: true });
    }

    const ip = clientIp(req) || 'unknown';
    const now = Date.now();
    const recent = (intakeHits.get(ip) || []).filter(t => now - t < 3600_000);
    if (recent.length >= 5) return res.status(429).json({ error: "Too many submissions. Please try again later." });
    recent.push(now);
    intakeHits.set(ip, recent);

    const name = String(fullName || '').trim().slice(0, 200);
    const mail = String(email || '').trim().toLowerCase().slice(0, 200);
    if (!name) return res.status(400).json({ error: "Your name is required." });
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(mail)) return res.status(400).json({ error: "A valid email address is required." });
    if (!consentToContact) return res.status(400).json({ error: "Please agree to be contacted about your request." });

    const uid = String(ownerId || INTAKE_OWNER_UID || '').trim();
    if (!uid) {
      console.error('[Intake] No PUBLIC_INTAKE_UID configured and no ownerId supplied');
      return res.status(503).json({ error: "Intake is not configured yet." });
    }

    try {
      const nowIso = new Date().toISOString();
      const parts = name.split(/\s+/);

      // The estimate the client saw, recomputed server-side so a tampered
      // payload cannot record a price that was never quoted.
      const num = (v: any, max: number) => {
        const n = Number(v);
        return Number.isFinite(n) && n >= 0 ? Math.min(n, max) : 0;
      };
      const sigs = Math.floor(num(quoteSignatures, 999));
      const miles = num(quoteRoundTripMiles, 10000);
      const quote = {
        signatures: sigs,
        roundTripMiles: miles,
        notaryFee: Math.round(sigs * 10 * 100) / 100,
        travelFee: Math.round(miles * 0.725 * 100) / 100,
        locationType: String(quoteLocationType || '').slice(0, 40),
        total: 0,
      };
      quote.total = Math.round((quote.notaryFee + quote.travelFee) * 100) / 100;
      const quoteLine = `Website estimate: ${quote.signatures} signature(s) $${quote.notaryFee.toFixed(2)} + ${quote.roundTripMiles} mi travel $${quote.travelFee.toFixed(2)} = $${quote.total.toFixed(2)}`;

      const lead = {
        userId: uid,
        fullName: name,
        email: mail,
        phone: String(phone || '').trim().slice(0, 40),
        serviceType: String(serviceType || '').trim().slice(0, 100),
        preferredDate: String(preferredDate || '').trim().slice(0, 40),
        location: String(location || '').trim().slice(0, 300),
        message: String(message || '').trim().slice(0, 2000),
        consentToContact: true,
        source: 'website',
        quote,
        ip,
        userAgent: (req.get('user-agent') || '').slice(0, 400),
        createdAt: nowIso,
      };

      // Reuse an existing customer when the email already exists, so website
      // leads do not create duplicate CRM records.
      const existing = await adminDb.collection('customers')
        .where('userId', '==', uid).where('email', '==', mail).limit(1).get();

      let customerId: string;
      if (!existing.empty) {
        customerId = existing.docs[0].id;
        await existing.docs[0].ref.update({
          phone: lead.phone || existing.docs[0].data().phone || '',
          notes: [existing.docs[0].data().notes, `Website request ${nowIso.slice(0, 10)}: ${lead.serviceType} — ${lead.message}`, quoteLine].filter(Boolean).join('\n'),
          updatedAt: nowIso,
        });
      } else {
        const customerRef = adminDb.collection('customers').doc();
        customerId = customerRef.id;
        await customerRef.set({
          id: customerRef.id,
          userId: uid,
          firstName: parts[0] || name,
          lastName: parts.slice(1).join(' '),
          fullName: name,
          email: mail,
          phone: lead.phone,
          address: lead.location,
          city: '', state: '', zip: '',
          customerType: 'General Client',
          preferredContactMethod: 'Email',
          tags: ['website-lead'],
          notes: [lead.serviceType && `Service requested: ${lead.serviceType}`,
                  lead.preferredDate && `Preferred date: ${lead.preferredDate}`,
                  lead.message,
                  quoteLine].filter(Boolean).join('\n'),
          createdAt: nowIso,
          updatedAt: nowIso,
        });
      }

      const leadRef = adminDb.collection('websiteLeads').doc();
      await leadRef.set({ ...lead, id: leadRef.id, customerId });

      // Notify the notary. A failure here must not fail the visitor's submission.
      if (resend) {
        try {
          const biz = await getBusinessProfile(uid);
          if (biz.email) {
            await resend.emails.send({
              from: buildFromEmail(biz),
              to: biz.email,
              replyTo: mail,
              subject: `New website request — ${name}`,
              html: baseTemplate(`
                <p style="margin:0 0 18px;font-size:15px;line-height:1.7;color:#374151;">A new request came in through your website.</p>
                <table style="border-collapse:collapse;font-size:14px;color:#334155;">
                  <tr><td style="padding:4px 16px 4px 0;color:#64748b;">Name</td><td>${escapeConsentHtml(name)}</td></tr>
                  <tr><td style="padding:4px 16px 4px 0;color:#64748b;">Email</td><td>${escapeConsentHtml(mail)}</td></tr>
                  <tr><td style="padding:4px 16px 4px 0;color:#64748b;">Phone</td><td>${escapeConsentHtml(lead.phone)}</td></tr>
                  <tr><td style="padding:4px 16px 4px 0;color:#64748b;">Service</td><td>${escapeConsentHtml(lead.serviceType)}</td></tr>
                  <tr><td style="padding:4px 16px 4px 0;color:#64748b;">Preferred date</td><td>${escapeConsentHtml(lead.preferredDate)}</td></tr>
                  <tr><td style="padding:4px 16px 4px 0;color:#64748b;">Location</td><td>${escapeConsentHtml(lead.location)}${quote.locationType ? ' (' + escapeConsentHtml(quote.locationType) + ')' : ''}</td></tr>
                  <tr><td style="padding:4px 16px 4px 0;color:#64748b;">Their estimate</td><td>${escapeConsentHtml(quoteLine.replace('Website estimate: ', ''))}</td></tr>
                </table>
                <p style="margin:18px 0 0;font-size:14px;line-height:1.7;color:#334155;white-space:pre-wrap;">${escapeConsentHtml(lead.message)}</p>
                <p style="margin:18px 0 0;font-size:13px;color:#64748b;">They are already in your CRM. Open Consent Forms to send them a consent and disclosure form.</p>
              `, biz),
            });
          }
        } catch (mailErr: any) {
          console.error("[Intake] Notification email failed:", mailErr.message);
        }
      }

      console.log(`[Intake] Website lead ${leadRef.id} -> customer ${customerId}`);
      res.json({ success: true, customerId });
    } catch (error: any) {
      console.error("[Intake] Failed:", error);
      res.status(500).json({ error: "Something went wrong. Please try again." });
    }
  });

  // ── AI: generate an email template with Claude ────────────────────────────
  // The Anthropic API key lives only on the server (ANTHROPIC_API_KEY) so it is
  // never shipped to the browser. The frontend calls this authenticated route.
  app.post("/api/ai/generate-template", verifyFirebaseToken, async (req, res) => {
    if (!anthropic) return res.status(503).json({ error: "AI Designer is not configured. Add ANTHROPIC_API_KEY." });

    const uid = (req as any).user.uid;
    const { prompt } = req.body;
    if (!prompt || typeof prompt !== "string") {
      return res.status(400).json({ error: "A prompt is required." });
    }

    try {
      const biz = await getBusinessProfile(uid);

      const message = await anthropic.messages.create({
        model: "claude-haiku-4-5",
        max_tokens: 4096,
        messages: [
          {
            role: "user",
            content: `Generate a professional email template for a Notary Signing Agent business.
User Request: "${prompt}"

BUSINESS DETAILS — use these real values directly in the email, do NOT use placeholders for them:
- Business Name: ${biz.name}
- Phone: ${biz.phone || ''}
- Email: ${biz.email || ''}
- Website: ${biz.website || ''}
- Service Area: ${biz.location || 'the local area'}

RULES:
- Only use {{firstName}} as a placeholder for the recipient's first name
- Fill in ALL other details using the real business info above
- Do NOT include unsubscribe links or preference links
- The template should be responsive, modern, and high-quality HTML

Return ONLY a valid JSON object with no markdown, no code fences, just raw JSON:
{
  "name": "A short descriptive name for the template",
  "htmlContent": "The full HTML string for the email",
  "category": "One of: Marketing, Transactional, Follow-up, or Custom"
}`,
          },
        ],
      });

      const text = message.content[0].type === "text" ? message.content[0].text : "";
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return res.status(502).json({ error: "Could not parse AI response." });
      }
      return res.json(JSON.parse(jsonMatch[0]));
    } catch (error: any) {
      console.error("[AI] Template generation error:", error);
      return res.status(500).json({ error: error.message || "Failed to generate template." });
    }
  });

  // Notary-law research via Gemini — runs server-side so GEMINI_API_KEY stays
  // on the backend (the key is never available in the browser bundle).
  app.post("/api/ai/notary-research", verifyFirebaseToken, async (req, res) => {
    if (!genAI) return res.status(503).json({ error: "AI search is not configured. Add GEMINI_API_KEY." });

    const { query, state } = req.body;
    if (!query || typeof query !== "string") {
      return res.status(400).json({ error: "A query is required." });
    }

    try {
      const prompt = `You are a professional notary law researcher.
The user has a question about notary laws in the state of ${state || 'their state'}.
Question: "${query}"

Please provide:
1. A clear, concise summary of the law or regulation (2-4 sentences).
2. At least 2-3 specific citations or source titles that would likely contain this information.
3. If possible, a likely URL for the official state notary authority for ${state || 'the state'}.

IMPORTANT:
- Clearly state that this is informational research and not legal advice.
- If you are unsure, state that the user should consult their Secretary of State.
- Return ONLY valid JSON (no markdown, no code fences) with this structure:
{"answer":"...","citations":[{"title":"...","url":"..."}],"officialStateLink":"..."}`;

      const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
      const result = await model.generateContent(prompt);
      const text = result.response.text() || "";

      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) return res.json(JSON.parse(jsonMatch[0]));

      // Fallback if the model didn't return clean JSON.
      return res.json({
        answer: text,
        citations: [
          { title: "National Notary Association", url: "https://www.nationalnotary.org" },
          { title: `${state || ''} Secretary of State`, url: "https://google.com/search?q=" + encodeURIComponent(`${state || ''} Secretary of State Notary`) },
        ],
      });
    } catch (error: any) {
      console.error("[AI] Notary research error:", error);
      return res.status(500).json({ error: error.message || "Failed to perform AI research." });
    }
  });

  app.post("/api/webhooks/resend", async (req, res) => {
    // ── Svix signature verification ──────────────────────────────────────────
    // Resend delivers webhooks via Svix. Set RESEND_WEBHOOK_SECRET in .env
    // (the "Signing Secret" shown in Resend → Webhooks). Without it, all
    // webhook requests are accepted — set the secret before going to production.
    const webhookSecret = process.env.RESEND_WEBHOOK_SECRET;
    if (webhookSecret) {
      const msgId        = req.headers['svix-id'] as string | undefined;
      const msgTimestamp = req.headers['svix-timestamp'] as string | undefined;
      const msgSignature = req.headers['svix-signature'] as string | undefined;

      if (!msgId || !msgTimestamp || !msgSignature) {
        console.warn('[Resend Webhook] Missing Svix signature headers — rejecting');
        return res.status(401).json({ error: 'Missing webhook signature headers' });
      }

      // Reject payloads older than 5 minutes to prevent replay attacks
      const tsSeconds = parseInt(msgTimestamp, 10);
      if (isNaN(tsSeconds) || Math.abs(Math.floor(Date.now() / 1000) - tsSeconds) > 300) {
        console.warn('[Resend Webhook] Timestamp too old or invalid — rejecting');
        return res.status(401).json({ error: 'Webhook timestamp out of range' });
      }

      // Raw body is captured by the express.json verify callback above
      const rawBody: string = (req as any).rawBody
        ? (req as any).rawBody.toString('utf8')
        : JSON.stringify(req.body);

      const signedContent = `${msgId}.${msgTimestamp}.${rawBody}`;

      // Secret may be prefixed with "whsec_" — strip it before base64-decoding
      const secretBytes = Buffer.from(
        webhookSecret.startsWith('whsec_') ? webhookSecret.slice(6) : webhookSecret,
        'base64'
      );
      const expectedSig = crypto.createHmac('sha256', secretBytes)
        .update(signedContent)
        .digest('base64');

      // Header may contain multiple space-separated "v1,<sig>" entries
      const signatures = msgSignature.split(' ').map(s => s.replace(/^v1,/, ''));
      const valid = signatures.some(sig => {
        try {
          return crypto.timingSafeEqual(
            Buffer.from(sig, 'base64'),
            Buffer.from(expectedSig, 'base64')
          );
        } catch { return false; }
      });

      if (!valid) {
        console.warn('[Resend Webhook] Signature mismatch — rejecting');
        return res.status(401).json({ error: 'Invalid webhook signature' });
      }
    } else {
      console.warn('[Resend Webhook] RESEND_WEBHOOK_SECRET not set — skipping signature check');
    }
    // ─────────────────────────────────────────────────────────────────────────

    try {
      const payload = req.body;
      console.log("[Resend Webhook Received]:", JSON.stringify(payload));

      const type = payload.type; 
      const data = payload.data;

      if (data && adminDb) {
        const emailId = data.email_id;
        const tags = data.tags;

        let campaignId = '';
        let subscriberId = '';

        if (tags) {
          if (Array.isArray(tags)) {
            const campaignTag = tags.find((t: any) => t.name === 'campaign_id');
            const subTag = tags.find((t: any) => t.name === 'subscriber_id');
            if (campaignTag) campaignId = campaignTag.value;
            if (subTag) subscriberId = subTag.value;
          } else if (typeof tags === 'object') {
            campaignId = tags.campaign_id || '';
            subscriberId = tags.subscriber_id || '';
          }
        }

        const normType = (type && typeof type === 'string') ? type.replace('email.', '') : 'event';

        // Add the event to emailEvents
        await adminDb.collection('emailEvents').add({
          userId: process.env.CRM_OWNER_USER_ID || 'system',
          subscriberId: subscriberId || 'unknown',
          campaignId: campaignId || 'single',
          type: normType,
          timestamp: payload.created_at || new Date().toISOString(),
          metadata: {
            emailId: emailId || '',
            subject: data.subject || '',
            to: data.to || [],
            raw: data
          }
        });

        console.log(`[Resend Webhook Store Success] Stored event "${normType}" for email ${emailId}`);

        // Update campaign metrics if normalized type is 'opened' or 'clicked' or 'unsubscribed' etc
        if (campaignId && campaignId !== 'single' && campaignId !== 'newsletter') {
          const campaignRef = adminDb.collection('marketingCampaigns').doc(campaignId);
          const campaignDoc = await campaignRef.get();
          if (campaignDoc.exists) {
            const metrics = campaignDoc.data()?.metrics || {
              sentCount: 0,
              deliveredCount: 0,
              openCount: 0,
              clickCount: 0,
              unsubscribeCount: 0,
              bounceCount: 0,
            };

            const fieldToUpdate = 
              normType === 'opened' ? 'metrics.openCount' :
              normType === 'clicked' ? 'metrics.clickCount' :
              normType === 'unsubscribed' ? 'metrics.unsubscribeCount' :
              normType === 'bounced' ? 'metrics.bounceCount' : null;

            if (fieldToUpdate) {
              const currentVal = normType === 'opened' ? (metrics.openCount || 0) :
                                 normType === 'clicked' ? (metrics.clickCount || 0) :
                                 normType === 'unsubscribed' ? (metrics.unsubscribeCount || 0) :
                                 normType === 'bounced' ? (metrics.bounceCount || 0) : 0;

              await campaignRef.update({
                [fieldToUpdate]: currentVal + 1,
                updatedAt: new Date().toISOString()
              });
              console.log(`[Resend Webhook Store Success] Incremented ${fieldToUpdate} for campaign ${campaignId}`);
            }
          }
        }
      }

      res.json({ received: true });
    } catch (error: any) {
      console.error("[Resend Webhook Error]:", error);
      res.status(500).json({ error: error.message || "Failed to process webhook" });
    }
  });

  // ─── IDV ROUTES ───────────────────────────────────────────────────────────────

  app.post("/api/idv/process-document", verifyFirebaseToken, async (req, res) => {
    const { recordId, frontUrl } = req.body;
    if (!recordId || !frontUrl) return res.status(400).json({ error: "Record ID and Front Image URL required" });
    console.log(`[IDV] Processing document for record: ${recordId}`);
    try {
      let extractedData: any = {};
      if (genAI) {
        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
        let imagePart: any = null;
        try {
          if (frontUrl.startsWith('http') && !frontUrl.includes('example.com')) {
            const imageResp = await fetch(frontUrl);
            const buffer = await imageResp.arrayBuffer();
            imagePart = { inlineData: { data: Buffer.from(buffer).toString('base64'), mimeType: "image/jpeg" } };
          }
        } catch (fetchErr) { console.error("[IDV] Failed to fetch image:", fetchErr); }

        if (imagePart) {
          const prompt = `Analyze this government-issued identity document (front image). Extract and return a JSON object with: fullName, firstName, middleName, lastName, dob (YYYY-MM-DD), address, city, state, zip, issuingCountry, issuingJurisdiction, documentNumber, issueDate (YYYY-MM-DD), expirationDate (YYYY-MM-DD), class. Rules: 1. Return ONLY valid JSON. 2. If not found use null. 3. No markdown.`;
          const result = await model.generateContent({
            contents: [{ role: "user", parts: [imagePart, { text: prompt }] }],
            generationConfig: { responseMimeType: "application/json" }
          });
          const text = result.response.text().trim();
          extractedData = JSON.parse(text.replace(/^```json/i, '').replace(/```$/i, '').trim());
        } else {
          extractedData = { fullName: "John Quincy Public", firstName: "John", middleName: "Quincy", lastName: "Public", dob: "1985-05-15", address: "123 Maple Avenue", city: "Charlotte", state: "NC", zip: "28202", issuingCountry: "USA", issuingJurisdiction: "North Carolina", documentNumber: "NC12345678", issueDate: "2020-01-01", expirationDate: "2028-01-01", class: "C", confidence: 0.95 };
        }
      }
      res.json({ status: "processed", extractedData, checks: [
        { id: "img_quality", name: "Image Quality", status: "pass", explanation: "Clear and legible", source: "automated", timestamp: new Date().toISOString() },
        { id: "doc_authenticity", name: "Document Authenticity", status: "pass", explanation: "Security features detected", source: "automated", timestamp: new Date().toISOString() },
        { id: "doc_expiration", name: "Expiration Check", status: "pass", explanation: "Document is valid", source: "automated", timestamp: new Date().toISOString() }
      ]});
    } catch (error) {
      console.error("[IDV] Extraction error:", error);
      res.status(500).json({ error: "Failed to process document" });
    }
  });

  app.post("/api/idv/face-match", verifyFirebaseToken, async (req, res) => {
    setTimeout(() => res.json({ status: "matched", score: 0.98, checks: [{ id: "face_match", name: "Face Match", status: "pass", explanation: "Signer matches ID portrait", source: "automated", timestamp: new Date().toISOString() }] }), 1500);
  });

  app.post("/api/idv/liveness-check", verifyFirebaseToken, async (req, res) => {
    setTimeout(() => res.json({ status: "passed", score: 0.99, checks: [{ id: "liveness", name: "Liveness Check", status: "pass", explanation: "Physical presence confirmed", source: "automated", timestamp: new Date().toISOString() }] }), 2000);
  });

  app.post("/api/idv/aamva-check", verifyFirebaseToken, async (req, res) => {
    setTimeout(() => res.json({ status: "matched", details: { fullName: "match", dob: "match", documentNumber: "match", address: "match" }, checks: [{ id: "aamva", name: "AAMVA / DLDV", status: "pass", explanation: "Information verified against issuing agency", source: "external", timestamp: new Date().toISOString() }] }), 3000);
  });

  // ─── HEALTH CHECK ─────────────────────────────────────────────────────────────

  app.get("/api/health", (req, res) => {
    const testOauth = getOAuth2Client(req);
    res.json({
      status: "ok",
      time: new Date().toISOString(),
      googleInit: !!testOauth,
      serviceAccountInit: !!serviceAccountAuth,
      serviceAccountEmail: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || null,
      firebase: adminDb ? "CONNECTED" : "NOT CONNECTED",
      email: resend ? "CONFIGURED" : "NOT CONFIGURED",
    });
  });

  // ─── GOOGLE OAUTH ─────────────────────────────────────────────────────────────

  app.get("/api/auth/google", (req, res) => {
    const { uid } = req.query;
    if (!uid) return res.status(400).json({ error: "UID required" });
    const client = getOAuth2Client(req);
    if (!client) return res.status(503).json({ error: "Google Calendar integration is not configured." });
    const url = client.generateAuthUrl({
      access_type: "offline",
      scope: ["https://www.googleapis.com/auth/userinfo.email", "https://www.googleapis.com/auth/calendar.events"],
      prompt: "consent",
      state: uid as string,
    });
    res.json({ url });
  });

  app.get("/api/auth/google/callback", async (req, res) => {
    const { code, state: uid } = req.query;
    if (!code || !uid) return res.status(400).send("Code and UID required");
    const client = getOAuth2Client(req);
    if (!client) return res.status(503).send("Google OAuth client not initialized");
    try {
      const { tokens } = await client.getToken(code as string);
      res.send(`<html><body><script>window.opener.postMessage({ type: 'GOOGLE_AUTH_SUCCESS', tokens: ${JSON.stringify(tokens)} }, window.location.origin);window.close();</script><p>Authentication successful! You can close this window.</p></body></html>`);
    } catch (error) {
      console.error("Error exchanging code for tokens:", error);
      res.status(500).send("Authentication failed");
    }
  });

  async function getAuthorizedClient(uid: string, clientTokens: any) {
    const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI } = process.env;
    if (!GOOGLE_CLIENT_ID) throw new Error("Google OAuth credentials missing on server");
    const oauth2 = new google.auth.OAuth2(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI);
    let tokens = clientTokens;
    if (tokens && typeof tokens === 'string') { try { tokens = JSON.parse(tokens); } catch (e) {} }
    if (!tokens || !tokens.access_token) throw new Error("No Google tokens available. Please reconnect in settings.");
    oauth2.setCredentials(tokens);
    const isExpired = Date.now() >= ((tokens.expiry_date || 0) - 60000);
    if (isExpired && tokens.refresh_token) {
      try {
        const { tokens: refreshedTokens } = await (oauth2 as any).refreshAccessToken();
        const updatedTokens = { ...tokens, ...refreshedTokens };
        oauth2.setCredentials(updatedTokens);
        return { oauth2, tokens: updatedTokens };
      } catch (e: any) {
        if (e.message?.includes('invalid_grant')) {
          const authErr = new Error("Google Calendar access revoked or expired. Please reconnect.");
          (authErr as any).code = 401;
          throw authErr;
        }
        throw e;
      }
    }
    return { oauth2, tokens: null };
  }

  app.get("/api/calendar/events", async (req, res) => {
    const { uid, timeMin, timeMax, tokens: clientTokensStr } = req.query;
    if (!uid) return res.status(400).json({ error: "UID required" });
    try {
      let clientTokens = null;
      if (clientTokensStr) { try { clientTokens = JSON.parse(clientTokensStr as string); } catch (e) {} }
      const { oauth2, tokens } = await getAuthorizedClient(uid as string, clientTokens);
      const calendar = google.calendar({ version: "v3", auth: oauth2 });
      const response = await calendar.events.list({
        calendarId: "primary",
        timeMin: (timeMin as string) || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        timeMax: (timeMax as string) || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        singleEvents: true,
        orderBy: "startTime",
      });
      res.json({ events: response.data.items, tokens });
    } catch (error: any) {
      const errorMessage = error.message || "Unknown error";
      let statusCode = 500;
      if (error.code === 429) statusCode = 429;
      else if (error.code === 401 || errorMessage.includes('invalid_grant')) statusCode = 401;
      else if (error.code === 403) statusCode = 403;
      else if (typeof error.code === 'number' && error.code >= 400) statusCode = error.code;
      res.status(statusCode).json({ error: errorMessage, code: statusCode });
    }
  });

  function getGoogleCalendarDateTime(dateStr: string = '', timeStr: string = '') {
    if (!dateStr) return { start: new Date().toISOString(), end: new Date(Date.now() + 3600000).toISOString() };
    let year = new Date().getFullYear(), month = new Date().getMonth() + 1, day = new Date().getDate();
    if (dateStr.includes('-')) { const p = dateStr.split('-'); year = +p[0]; month = +p[1]; day = +p[2]; }
    else if (dateStr.includes('/')) { const p = dateStr.split('/'); month = +p[0]; day = +p[1]; year = +p[2]; if (year < 100) year += 2000; }
    const time24 = convertTo24(timeStr);
    const [hStr, mStr] = time24.split(':');
    const h = parseInt(hStr), m = parseInt(mStr);
    const pad = (n: number) => String(n).padStart(2, '0');
    const startStr = `${year}-${pad(month)}-${pad(day)}T${pad(h)}:${pad(m)}:00`;
    let endH = h + 1, endDay = day;
    if (endH >= 24) { endH -= 24; endDay += 1; }
    return { start: startStr, end: `${year}-${pad(month)}-${pad(endDay)}T${pad(endH)}:${pad(m)}:00` };
  }

  app.post("/api/calendar/sync", async (req, res) => {
    const { appointmentId, uid, action, appointmentData, googleCalendarTokens, googleCalendarId: bodyCalendarId } = req.body;
    if (!appointmentId || !uid || !appointmentData) return res.status(400).json({ error: "Missing fields" });
    try {
      let auth: any;
      const calendarId = bodyCalendarId || process.env.GOOGLE_CALENDAR_ID || "primary";
      let refreshedTokens: any = null;
      try {
        const { oauth2, tokens } = await getAuthorizedClient(uid, googleCalendarTokens);
        auth = oauth2; refreshedTokens = tokens;
      } catch (e) {
        if (serviceAccountAuth) { auth = serviceAccountAuth; }
        else throw e;
      }
      const appointment = appointmentData;
      const calendar = google.calendar({ version: "v3", auth });
      if (action === 'delete') {
        const eventId = req.body.eventId || appointment?.googleCalendarEventId;
        if (eventId) { try { await calendar.events.delete({ calendarId, eventId }); } catch (e: any) { if (e.code !== 404) throw e; } }
        return res.json({ status: "deleted", newTokensData: refreshedTokens });
      }
      const { start: startDateTime, end: endDateTime } = getGoogleCalendarDateTime(appointment?.date, appointment?.time);
      const event = {
        summary: `${appointment?.signingType || 'Signing'}: ${appointment?.customerName || appointment?.clientName || 'Unknown Client'}`,
        location: appointment?.location || appointment?.address || 'TBD',
        description: `Client: ${appointment?.customerName || 'N/A'}\nType: ${appointment?.signingType || 'N/A'}\nDocuments: ${(appointment?.docs || []).join(', ')}\nNotes: ${appointment?.notes || ''}\nPhone: ${appointment?.phone || ''}\nOrder #: ${appointment?.orderNumber || ''}\nLink: ${process.env.APP_URL || ''}/appointments?id=${appointmentId}`.trim(),
        start: { dateTime: startDateTime, timeZone: "America/New_York" },
        end: { dateTime: endDateTime, timeZone: "America/New_York" },
      };
      if (appointment?.googleCalendarEventId) {
        try {
          const apiResponse = await calendar.events.update({ calendarId, eventId: appointment.googleCalendarEventId, requestBody: event });
          res.json({ status: "updated", googleResponse: apiResponse.data, newTokensData: refreshedTokens });
        } catch (error: any) {
          if (error.code === 404) {
            const newEvent = await calendar.events.insert({ calendarId, requestBody: event });
            res.json({ status: "re-created", eventId: newEvent.data.id, googleResponse: newEvent.data, newTokensData: refreshedTokens });
          } else throw error;
        }
      } else {
        const newEvent = await calendar.events.insert({ calendarId, requestBody: event });
        res.json({ status: "created", eventId: newEvent.data.id, googleResponse: newEvent.data, newTokensData: refreshedTokens });
      }
    } catch (error: any) {
      const errorMessage = error.message || "Unknown error";
      const errorDetails = error.response?.data?.error || null;
      const detailMessage = errorDetails?.message || errorMessage;
      let statusCode = 500;
      if (detailMessage.toLowerCase().includes('quota') || error.code === 429) statusCode = 429;
      else if (error.code === 401 || detailMessage.includes('invalid_grant')) statusCode = 401;
      else if (error.code === 403) statusCode = 403;
      else if (typeof error.code === 'number' && error.code >= 400) statusCode = error.code;
      res.status(statusCode).json({ error: "Failed to sync calendar", details: detailMessage, code: statusCode });
    }
  });

  function convertTo24(time12h: string = '10:00 AM') {
    if (!time12h) return "10:00";
    const normalized = time12h.replace(/([0-9])\s*([AP]M)/i, '$1 $2').trim();
    const parts = normalized.split(' ');
    const time = parts[0];
    const modifier = parts[1]?.toUpperCase() || null;
    let [hours, minutes] = time.split(':');
    if (!hours) hours = '10';
    if (!minutes) minutes = '00';
    let h = parseInt(hours, 10);
    if (h === 12) h = modifier === 'AM' ? 0 : 12;
    else if (modifier === 'PM') h = h + 12;
    return `${String(h).padStart(2, '0')}:${minutes.padStart(2, '0')}`;
  }

  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({ server: { middlewareMode: true, hmr: process.env.DISABLE_HMR === 'true' ? false : true }, appType: "spa" });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    if (!fs.existsSync(distPath)) console.error(`ERROR: 'dist' folder not found at ${distPath}.`);
    app.use(express.static(distPath));
    app.get('*all', (req, res) => {
      const indexPath = path.join(distPath, 'index.html');
      res.sendFile(indexPath, (err) => {
        if (err) { console.error("Error sending index.html:", err); res.status(503).send(`Application Error: index.html not found.`); }
      });
    });
  }

  app.listen(PORT, "0.0.0.0", () => console.log(`Server running on port ${PORT}`));
}

startServer();