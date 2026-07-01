/**
 * Drip engine — advances the follow-up sequences one step at a time.
 *
 * On each run it: (1) enrolls newly-tagged customers, (2) finds enrollments
 * whose next email is due, (3) sends up to a daily cap via Resend, and
 * (4) advances each enrollment to the next step. State lives in Firestore
 * `dripEnrollments`; email bodies come from the `marketingTemplates` created
 * by save-drip-templates.mjs. Designed to be run once/day (see the /notary-drip
 * skill or a scheduled Routine).
 *
 * SAFE BY DEFAULT: dry-run (plans only). Add --send to actually send.
 *
 * Env required for --send:
 *   RESEND_API_KEY   (same key the app uses)
 *   FROM_EMAIL       e.g. "Frank Coxx <frank@integrityclosingsclt.com>" (verified in Resend)
 *   APP_URL          your deployed app URL (for working unsubscribe links)
 *   UNSUBSCRIBE_SECRET  (same value the app uses, so unsubscribe links validate)
 *
 * Usage:
 *   node scripts/drip-sequences/drip-engine.mjs                 # dry-run, all sequences
 *   node scripts/drip-sequences/drip-engine.mjs --sequence real-estate
 *   node scripts/drip-sequences/drip-engine.mjs --send --cap 25 --from "Frank Coxx <frank@integrityclosingsclt.com>"
 *
 * Tagging: a customer is enrolled in a sequence if it carries one of that
 * sequence's tags (or a matching customerType). See SEQUENCES below.
 */

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, query, where, getDocs, doc, getDoc, setDoc } from 'firebase/firestore';
import crypto from 'node:crypto';

const firebaseConfig = {
  apiKey: "AIzaSyDKQCNO_aPVzBw_ydGCUiSG3xuJi_S4myg",
  authDomain: "gen-lang-client-0145482726.firebaseapp.com",
  projectId: "gen-lang-client-0145482726",
  storageBucket: "gen-lang-client-0145482726.firebasestorage.app",
  messagingSenderId: "695597520251",
  appId: "1:695597520251:web:bcda1b533036f03f5e19de",
};
const USER_ID = 'n3I1KimZW6cw3sy0GrXC73yQny62';
const DB_ID = 'ai-studio-65685a95-d245-4bf3-97e1-8775f84f70ab';

const app = initializeApp(firebaseConfig);
const db = getFirestore(app, DB_ID);

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

const SEQUENCES = {
  'real-estate':     { prefix: 'drip-real-estate',     tags: ['real-estate', 'realtor', 'title', 'lender'], types: ['Real Estate Agent', 'Title Company', 'Lender', 'Closing Attorney'] },
  'estate-planning': { prefix: 'drip-estate-planning', tags: ['estate-planning', 'estate', 'elder-law'],     types: ['Estate Planning Attorney'] },
  'hospital-nursing':{ prefix: 'drip-hospital-nursing',tags: ['hospital', 'nursing-home', 'hospice', 'assisted-living'], types: ['Hospital', 'Nursing Home', 'Assisted Living', 'Hospice'] },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
const typeToTag = (t) => (t || '').toLowerCase().replace(/\s+/g, '-');

function matchesSequence(customer, cfg) {
  const tags = customer.tags || [];
  if (cfg.tags.some(t => tags.includes(t))) return true;
  if (cfg.types.includes(customer.customerType)) return true;
  if (cfg.tags.includes(typeToTag(customer.customerType))) return true;
  return false;
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
  const snap = await getDoc(doc(db, 'marketingTemplates', id));
  if (!snap.exists()) throw new Error(`Template ${id} not found — run save-drip-templates.mjs first`);
  const d = snap.data();
  templateCache[id] = { html: d.htmlContent || '', subject: d.subjectSuggestion || 'A note from Integrity Closings CLT' };
  return templateCache[id];
}

async function getCustomers() {
  const snap = await getDocs(query(collection(db, 'customers'), where('userId', '==', USER_ID)));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
    .filter(c => c.email && String(c.email).trim() !== '' && !c.unsubscribed);
}

async function getEnrollments(seqKey) {
  const snap = await getDocs(query(collection(db, 'dripEnrollments'),
    where('userId', '==', USER_ID), where('sequence', '==', seqKey)));
  const map = {};
  snap.docs.forEach(d => { map[d.data().customerId] = { id: d.id, ...d.data() }; });
  return map;
}

let resend = null;
async function getResend() {
  if (resend) return resend;
  if (!process.env.RESEND_API_KEY) throw new Error('RESEND_API_KEY is not set');
  if (!FROM) throw new Error('--from "Name <email@verified-domain>" (or FROM_EMAIL) is required to send');
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
    tags: [
      { name: 'subscriber_id', value: customer.id },
      { name: 'campaign_id', value: 'drip' },
    ],
  });
  if (result.error) throw new Error(result.error.message || JSON.stringify(result.error));
  const emailId = result.data?.id || 'sent';
  try {
    await setDoc(doc(collection(db, 'emailEvents')), {
      userId: USER_ID, subscriberId: customer.id, campaignId: `drip-${subject}`.slice(0, 60),
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

  console.log(`\nDrip engine  ·  ${DO_SEND ? `SEND (cap ${CAP})` : 'DRY-RUN (no send)'}  ·  from: ${FROM || '(unset)'}`);

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
        enrollments[c.id] = { id: `${seqKey}__${c.id}`, ...enr };
        if (DO_SEND) await setDoc(doc(db, 'dripEnrollments', enr_id(seqKey, c.id)), enr);
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

      plan.push({ seq: seqKey, name: c.fullName || c.email, email: c.email, step: stepToSend, subject: tpl.subject });

      if (DO_SEND) {
        try {
          await sendEmail(c, tpl.subject, html);
          const nextStep = stepToSend; // = e.step + 1
          const done = nextStep >= 4;
          const { id: _omit, ...enrData } = e;
          await setDoc(doc(db, 'dripEnrollments', enr_id(seqKey, c.id)), {
            ...enrData, step: nextStep, lastSentAt: new Date(now).toISOString(),
            nextDueAt: done ? null : new Date(now + DELTAS[nextStep] * DAY).toISOString(),
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
  if (!DO_SEND) console.log(`Add --send (with RESEND_API_KEY + --from + APP_URL + UNSUBSCRIBE_SECRET) to deliver.`);
  process.exit(0);
}

function enr_id(seqKey, custId) { return `${seqKey}__${custId}`; }

main().catch(err => { console.error('\nFatal:', err); process.exit(1); });
