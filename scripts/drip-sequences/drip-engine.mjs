/**
 * Drip engine — advances the follow-up sequences one step at a time.
 *
 * On each run it: (1) enrolls newly-tagged customers, (2) finds enrollments
 * whose next email is due, (3) sends up to a daily cap via Resend, and
 * (4) advances each enrollment to the next step. State lives in Firestore
 * `dripEnrollments`; email bodies come from the `marketingTemplates` created
 * by save-drip-templates.mjs. Designed to run once/day (see the /notary-drip
 * skill or the GitHub Actions cron).
 *
 * Uses the Firebase Admin SDK (same credential the app server uses), so it
 * bypasses security rules and works unattended.
 *
 * SAFE BY DEFAULT: dry-run (plans only). Add --send to actually send.
 *
 * Env required:
 *   GOOGLE_SERVICE_ACCOUNT_JSON   the app's service-account JSON (full string)
 *   FIREBASE_DATABASE_ID          optional; defaults to the app's named DB
 * Env required for --send:
 *   RESEND_API_KEY, FROM_EMAIL ("Frank Coxx <frank@integrityclosingsclt.com>"),
 *   APP_URL (for working unsubscribe links), UNSUBSCRIBE_SECRET
 *
 * Usage:
 *   node scripts/drip-sequences/drip-engine.mjs                 # dry-run, all sequences
 *   node scripts/drip-sequences/drip-engine.mjs --sequence real-estate
 *   node scripts/drip-sequences/drip-engine.mjs --send --cap 25
 */

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import crypto from 'node:crypto';

const USER_ID = 'n3I1KimZW6cw3sy0GrXC73yQny62';
const DEFAULT_DB_ID = 'ai-studio-65685a95-d245-4bf3-97e1-8775f84f70ab';

// ─── Firebase Admin (mirrors the app server's init) ───────────────────────────
function parseServiceAccountJson() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON is not set');
  const attempts = [
    () => JSON.parse(raw),
    () => JSON.parse(raw.replace(/\\{/g, '{').replace(/\\}/g, '}')),
    () => JSON.parse(raw.replace(/\\{/g, '{').replace(/\\}/g, '}').replace(/\\"/g, '"')),
    () => JSON.parse(raw.replace(/\\([^"\\/bfnrtu])/g, '$1')),
    () => JSON.parse(JSON.parse(`"${raw.replace(/"/g, '\\"')}"`)),
  ];
  for (const attempt of attempts) { try { return attempt(); } catch { /* next */ } }
  throw new Error('Could not parse GOOGLE_SERVICE_ACCOUNT_JSON');
}
function fixPrivateKey(key) {
  if (!key) return key;
  key = key.replace(/\\n/g, '\n');
  if (key.includes('-----BEGIN')) {
    const header = key.match(/-----BEGIN [^-]+-----/)?.[0] || '-----BEGIN PRIVATE KEY-----';
    const footer = key.match(/-----END [^-]+-----/)?.[0] || '-----END PRIVATE KEY-----';
    const body = key.replace(/-----BEGIN [^-]+-----/, '').replace(/-----END [^-]+-----/, '').replace(/\s+/g, '');
    const lines = body.match(/.{1,64}/g)?.join('\n') || body;
    return `${header}\n${lines}\n${footer}`;
  }
  return key;
}

const serviceAccount = parseServiceAccountJson();
serviceAccount.private_key = fixPrivateKey(serviceAccount.private_key);
if (!getApps().length) initializeApp({ credential: cert(serviceAccount) });
const rawDbId = process.env.FIREBASE_DATABASE_ID || DEFAULT_DB_ID;
const useDefault = ['', '(default)', 'undefined', 'null'].includes(rawDbId.trim());
const db = useDefault ? getFirestore() : getFirestore(rawDbId.trim());

// ─── Args / env ───────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const flag = (n) => args.includes(`--${n}`);
const opt = (n, d) => { const i = args.indexOf(`--${n}`); return i !== -1 && args[i + 1] ? args[i + 1] : d; };

const DO_SEND = flag('send');
const CAP = parseInt(opt('cap', '25'), 10);
const ONLY_SEQ = opt('sequence', '');
const NO_ENROLL = flag('no-enroll');
const FROM = opt('from', process.env.FROM_EMAIL || '');
const APP_URL = (process.env.APP_URL || 'https://www.notaryproapp.com').replace(/\/$/, '');
const UNSUB_SECRET = process.env.UNSUBSCRIBE_SECRET || '';

// Days after the PREVIOUS email that each step goes out. Email 1 is immediate.
const DELTAS = [0, 4, 7, 10];
const DAY = 86400000;

// A contact enrolls in a sequence ONLY if it carries one of that sequence's
// tags. Tag contacts intentionally in the app — nothing is auto-swept by
// customerType, so mixed lists (e.g. attorneys) don't land in the wrong drip.
// Tags match the app's segment-tag buttons (NewCustomerModal SEGMENT_TAGS):
//   Loan Officer -> loan_officer, Closing Attorney -> closing-attorney,
//   Estate Planning -> estate-planning-attorney, Hospital / Care Facility -> hospital.
// Extra generic aliases are kept in case tags are added manually elsewhere.
const SEQUENCES = {
  'real-estate':      { prefix: 'drip-real-estate',      tags: ['closing-attorney', 'loan_officer', 'real-estate', 'realtor', 'title', 'lender'] },
  'estate-planning':  { prefix: 'drip-estate-planning',  tags: ['estate-planning-attorney', 'estate-planning', 'estate', 'elder-law'] },
  'hospital-nursing': { prefix: 'drip-hospital-nursing', tags: ['hospital', 'nursing-home', 'hospice', 'assisted-living'] },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
const enr_id = (seqKey, custId) => `${seqKey}__${custId}`;

function matchesSequence(customer, cfg) {
  const tags = customer.tags || [];
  return cfg.tags.some(t => tags.includes(t));
}
function firstNameOf(c) {
  return (c.firstName || c.fullName || '').trim().split(/\s+/)[0] || 'there';
}
function unsubscribeFooter(customerId) {
  if (UNSUB_SECRET) {
    const token = crypto.createHmac('sha256', UNSUB_SECRET).update(customerId).digest('hex');
    const link = `${APP_URL}/api/email/unsubscribe/${customerId}?token=${token}`;
    return `<div style="text-align:center;padding:16px 0;"><p style="margin:0;font-size:11px;color:#94a3b8;font-family:Arial,sans-serif;">Prefer not to receive these? <a href="${link}" style="color:#94a3b8;">Unsubscribe</a>.</p></div>`;
  }
  return `<div style="text-align:center;padding:16px 0;"><p style="margin:0;font-size:11px;color:#94a3b8;font-family:Arial,sans-serif;">Reply "unsubscribe" to opt out.</p></div>`;
}
function injectFooter(html, customerId) {
  const footer = unsubscribeFooter(customerId);
  return html.includes('</body>') ? html.replace('</body>', `${footer}</body>`) : html + footer;
}

const templateCache = {};
async function fetchTemplate(prefix, step) {
  const id = `${prefix}-${step}`;
  if (templateCache[id]) return templateCache[id];
  const snap = await db.collection('marketingTemplates').doc(id).get();
  if (!snap.exists) throw new Error(`Template ${id} not found — run save-drip-templates.mjs first`);
  const d = snap.data();
  templateCache[id] = { html: d.htmlContent || '', subject: d.subjectSuggestion || 'A note from Integrity Closings CLT' };
  return templateCache[id];
}

async function getCustomers() {
  const snap = await db.collection('customers').where('userId', '==', USER_ID).get();
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
    .filter(c => c.email && String(c.email).trim() !== '' && !c.unsubscribed);
}
async function getEnrollments(seqKey) {
  const snap = await db.collection('dripEnrollments')
    .where('userId', '==', USER_ID).where('sequence', '==', seqKey).get();
  const map = {};
  snap.docs.forEach(d => { map[d.data().customerId] = { id: d.id, ...d.data() }; });
  return map;
}

let resend = null;
async function getResend() {
  if (resend) return resend;
  if (!process.env.RESEND_API_KEY) throw new Error('RESEND_API_KEY is not set');
  if (!FROM) throw new Error('FROM_EMAIL (or --from) is required to send');
  const { Resend } = await import('resend');
  resend = new Resend(process.env.RESEND_API_KEY);
  return resend;
}
async function sendEmail(customer, subject, html) {
  const client = await getResend();
  const result = await client.emails.send({
    from: FROM,
    to: [customer.email],
    subject,
    html,
    tags: [{ name: 'subscriber_id', value: customer.id }, { name: 'campaign_id', value: 'drip' }],
  });
  if (result.error) throw new Error(result.error.message || JSON.stringify(result.error));
  const emailId = result.data?.id || 'sent';
  try {
    await db.collection('emailEvents').add({
      userId: USER_ID, subscriberId: customer.id, campaignId: 'drip',
      type: 'sent', timestamp: new Date().toISOString(),
      metadata: { emailId, subject, to: [customer.email], drip: true },
    });
  } catch { /* non-fatal */ }
  return emailId;
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  const now = Date.now();
  const seqKeys = ONLY_SEQ ? [ONLY_SEQ] : Object.keys(SEQUENCES);
  for (const k of seqKeys) if (!SEQUENCES[k]) { console.error(`Unknown sequence: ${k}`); process.exit(1); }

  console.log(`\nDrip engine  ·  ${DO_SEND ? `SEND (cap ${CAP})` : 'DRY-RUN (no send)'}  ·  from: ${FROM || '(unset)'}  ·  db: ${useDefault ? 'default' : rawDbId}`);

  const customers = await getCustomers();
  let budget = CAP;
  const plan = [];

  for (const seqKey of seqKeys) {
    const cfg = SEQUENCES[seqKey];
    const matched = customers.filter(c => matchesSequence(c, cfg));
    const enrollments = await getEnrollments(seqKey);

    // Enroll new matches (only persists in --send mode).
    for (const c of matched) {
      if (!enrollments[c.id] && !NO_ENROLL) {
        const enr = {
          userId: USER_ID, sequence: seqKey, customerId: c.id, email: c.email,
          step: 0, enrolledAt: new Date(now).toISOString(),
          nextDueAt: new Date(now).toISOString(), lastSentAt: null, status: 'active',
          updatedAt: new Date(now).toISOString(),
        };
        enrollments[c.id] = { id: enr_id(seqKey, c.id), ...enr };
        if (DO_SEND) await db.collection('dripEnrollments').doc(enr_id(seqKey, c.id)).set(enr);
      }
    }

    // Find due enrollments (step < 4, due now, customer still eligible).
    const byId = Object.fromEntries(matched.map(c => [c.id, c]));
    const due = Object.values(enrollments)
      .filter(e => e.status === 'active' && e.step < 4 && byId[e.customerId] && new Date(e.nextDueAt).getTime() <= now)
      .sort((a, b) => new Date(a.nextDueAt) - new Date(b.nextDueAt));

    for (const e of due) {
      if (budget <= 0) break;
      const c = byId[e.customerId];
      const stepToSend = e.step + 1; // 1..4
      const tpl = await fetchTemplate(cfg.prefix, stepToSend);
      const html = injectFooter(tpl.html.replace(/\{\{firstName\}\}/g, firstNameOf(c)), c.id);

      plan.push({ seq: seqKey, name: c.fullName || c.email, step: stepToSend, subject: tpl.subject });

      if (DO_SEND) {
        try {
          await sendEmail(c, tpl.subject, html);
          const done = stepToSend >= 4;
          const { id: _omit, ...enrData } = e;
          await db.collection('dripEnrollments').doc(enr_id(seqKey, c.id)).set({
            ...enrData, step: stepToSend, lastSentAt: new Date(now).toISOString(),
            nextDueAt: done ? null : new Date(now + DELTAS[stepToSend] * DAY).toISOString(),
            status: done ? 'complete' : 'active', updatedAt: new Date(now).toISOString(),
          });
          console.log(`  ✓ [${seqKey} #${stepToSend}] ${c.fullName || c.email}`);
        } catch (err) {
          console.error(`  ✗ [${seqKey} #${stepToSend}] ${c.email} — ${err.message}`);
        }
      } else {
        console.log(`  • would send [${seqKey} #${stepToSend}] ${c.fullName || c.email} — "${tpl.subject}"`);
      }
      budget--;
    }
  }

  console.log(`\n${DO_SEND ? 'Sent/advanced' : 'Would send'} ${plan.length} email(s). Cap ${CAP}, remaining budget ${Math.max(0, budget)}.`);
  if (!DO_SEND) console.log('Add --send (with RESEND_API_KEY + FROM_EMAIL + APP_URL + UNSUBSCRIBE_SECRET) to deliver.');
  process.exit(0);
}

main().catch(err => { console.error('\nFatal:', err.message || err); process.exit(1); });
