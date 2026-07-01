/**
 * Saves the three 4-email follow-up drip sequences (Real Estate, Estate
 * Planning, Hospital & Nursing Home) into NotaryAssistPro's Firestore
 * `marketingTemplates` collection, so they appear in the app's Template
 * dropdown (Campaigns + Send Email modal).
 *
 * Run from the repo root:
 *   node scripts/drip-sequences/save-drip-templates.mjs
 * Requires: npm install firebase   (already a dependency of this app)
 *
 * Idempotent — deterministic doc ids, so re-running overwrites/updates.
 */

import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc } from 'firebase/firestore';

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

const PHONE_TEL = '9803724103';
const PHONE = '980-372-4103';
const SITE = 'https://www.integrityclosingsclt.com';

// ─── Branded email wrapper (email-client-safe, inline styles) ─────────────────
function wrap({ paragraphs, ctaLabel, ctaHref }) {
  const body = paragraphs
    .map(p => `<p style="margin:0 0 18px 0;font-size:15px;line-height:1.7;color:#374151;font-family:Georgia,serif;">${p}</p>`)
    .join('\n              ');

  const cta = ctaLabel
    ? `<table cellpadding="0" cellspacing="0" style="margin:8px 0 4px 0;"><tr><td style="background-color:#C9A96E;border-radius:6px;">
                <a href="${ctaHref}" style="display:inline-block;padding:13px 30px;color:#0B1829;font-family:Arial,sans-serif;font-size:14px;font-weight:bold;text-decoration:none;letter-spacing:0.04em;">${ctaLabel}</a>
              </td></tr></table>`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /></head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:Georgia,serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;padding:32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.06);">

        <!-- HEADER -->
        <tr><td style="background-color:#0B1829;padding:26px 40px;text-align:center;">
          <p style="margin:0 0 3px 0;font-style:italic;font-size:12px;letter-spacing:0.12em;color:#C9A96E;text-transform:uppercase;">Professional Mobile Notary</p>
          <h1 style="margin:0;font-size:22px;font-weight:normal;color:#ffffff;letter-spacing:0.04em;">Integrity Closings CLT</h1>
        </td></tr>

        <!-- BODY -->
        <tr><td style="padding:36px 40px 20px 40px;">
              <p style="margin:0 0 18px 0;font-size:15px;line-height:1.7;color:#374151;font-family:Georgia,serif;">Hi {{firstName}},</p>
              ${body}
              ${cta}
        </td></tr>

        <!-- SIGNATURE -->
        <tr><td style="padding:8px 40px 30px 40px;border-top:1px solid #eceae6;">
          <p style="margin:18px 0 2px 0;font-size:15px;font-family:Georgia,serif;font-weight:bold;color:#0B1829;">Frank Coxx</p>
          <p style="margin:0 0 6px 0;font-size:12px;font-family:Arial,sans-serif;color:#6b7280;">Certified Notary Signing Agent &middot; Integrity Closings CLT &middot; Greater Charlotte, NC</p>
          <p style="margin:0;font-size:12px;font-family:Arial,sans-serif;color:#6b7280;">
            <a href="tel:${PHONE_TEL}" style="color:#A88040;text-decoration:none;">${PHONE}</a> &nbsp;&middot;&nbsp;
            <a href="${SITE}" style="color:#A88040;text-decoration:none;">integrityclosingsclt.com</a>
          </p>
        </td></tr>

        <!-- FOOTER -->
        <tr><td style="background-color:#0B1829;padding:16px 40px;text-align:center;">
          <p style="margin:0;font-size:11px;font-family:Arial,sans-serif;color:#6b7280;">Integrity Closings CLT &middot; Mobile Notary &amp; Loan Signing &middot; Charlotte, NC</p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

const CALL = { ctaLabel: `Call ${PHONE}`, ctaHref: `tel:${PHONE_TEL}` };
const BOOK = { ctaLabel: 'Book a Signing', ctaHref: `${SITE}/book` };

// ─── The three sequences (4 emails each) ──────────────────────────────────────
const sequences = [
  {
    key: 'real-estate', label: 'Real Estate Drip',
    emails: [
      { slug: 'intro', name: 'Intro', subject: 'A backup signing agent for your closings',
        preview: 'Same-day, mobile, and NNA-certified across the Charlotte metro.', cta: CALL,
        paragraphs: [
          `Quick note to put a reliable mobile notary on your radar. I'm a certified Notary Signing Agent covering the greater Charlotte metro, and I handle loan signings, refinances, and closing packages wherever your client needs to sign — the title office, their kitchen table, or a job site.`,
          `Deals don't always fit business hours, so I keep same-day, evening, and weekend availability. If your usual signer is ever booked or a closing pops up last-minute, I'd be glad to be your backup.`,
          `No need to do anything today — just save my number so it's there when you need it: <strong>${PHONE}</strong>.`,
        ] },
      { slug: 'pain', name: 'The tough closings', subject: 'When a closing needs to happen tonight',
        preview: 'Mail-aways, remote sellers, and 5pm surprises — handled.', cta: CALL,
        paragraphs: [
          `The signings that cause the most stress are usually the unexpected ones: a seller who's out of state, a mail-away that has to be back tomorrow, or a package that lands at 4:45pm and has to close today.`,
          `That's exactly where I'm most useful. I come to the signer, confirm IDs, get the package executed cleanly, and get it back on time — so your closing stays on schedule and your client stays happy.`,
          `Next time one of those lands on your desk, call me: <strong>${PHONE}</strong>.`,
        ] },
      { slug: 'proof', name: 'What you get', subject: 'What you get with every signing',
        preview: 'Certified, background-checked, insured — and error-free packages.', cta: CALL,
        paragraphs: [
          `A signing agent is only worth it if the package comes back right the first time. Here's what you can count on with me:`,
          `&bull; NNA-certified &amp; background-checked, with E&amp;O insurance<br/>&bull; Same-day and after-hours availability, 7 days a week<br/>&bull; Dual-tray laser printing for full closing packages<br/>&bull; Careful, error-free execution — no missed signatures or dates`,
          `If it'd help, I'm happy to be added to your approved vendor/signing-agent list so your team can reach me directly. Just reply or call <strong>${PHONE}</strong>.`,
        ] },
      { slug: 'close', name: 'Soft close', subject: "I'll stay out of your inbox",
        preview: 'Here whenever a closing needs to get done.', cta: CALL,
        paragraphs: [
          `I won't keep filling your inbox — I know you're busy closing deals. I'll leave it here.`,
          `If you ever need a dependable mobile notary who can move fast and get the package right, I'm one call away: <strong>${PHONE}</strong>. And if it's easy, reply "add me" and I'll make sure you have everything on file to book me in seconds.`,
          `Either way, I appreciate your time and wish you smooth closings.`,
        ] },
    ],
  },
  {
    key: 'estate-planning', label: 'Estate Planning Drip',
    emails: [
      { slug: 'intro', name: 'Intro', subject: 'A mobile notary for your estate clients',
        preview: 'I come to them — home, hospital, or care facility.', cta: CALL,
        paragraphs: [
          `I wanted to introduce myself as a mobile notary resource for your estate planning clients. I serve the greater Charlotte metro and specialize in coming to the signer — their home, a hospital room, or a care facility — so wills, trusts, powers of attorney, and healthcare directives get executed without the client having to travel.`,
          `Many of your clients are older or have mobility challenges, and getting them to an office at the right moment isn't always easy. That's the gap I fill.`,
          `I'll keep this short — just wanted you to have my info: <strong>${PHONE}</strong>.`,
        ] },
      { slug: 'pain', name: "Clients who can't travel", subject: "For the clients who can't come to the office",
        preview: 'Bedside signings, coordinated witnesses, done with care.', cta: CALL,
        paragraphs: [
          `Estate documents often need to be signed at exactly the moment it's hardest for the client to travel — after a diagnosis, a hospital stay, or a move into assisted living.`,
          `I handle those signings with care: I come to the client, confirm they're signing willingly and aware of what they're signing, and can coordinate witnesses when your documents require them. Everything is done unhurried and with discretion for the family.`,
          `When you have a client who can't make it in, I can usually be there same-day. Just call <strong>${PHONE}</strong>.`,
        ] },
      { slug: 'trust', name: 'Executed properly', subject: 'Wills, trusts & POAs — executed properly',
        preview: 'Familiar with the formalities, so nothing gets invalidated.', cta: CALL,
        paragraphs: [
          `With estate documents, a small execution error can undo careful planning. I'm experienced with the formalities these signings require — proper notarial wording, witness coordination, and getting healthcare directives and durable POAs signed and acknowledged correctly.`,
          `&bull; Discreet and patient with elderly and ill clients<br/>&bull; Background-checked and insured<br/>&bull; Mobile &amp; same-day across the Charlotte metro, evenings and weekends<br/>&bull; Can bring witnesses when needed`,
          `If it's helpful, I'd be glad to be a referral resource your firm can hand clients when a mobile signing is needed. Reply or call <strong>${PHONE}</strong>.`,
        ] },
      { slug: 'close', name: 'Soft close', subject: "Here when a signing can't wait",
        preview: 'One call whenever a client needs to sign at home or bedside.', cta: CALL,
        paragraphs: [
          `I'll leave you be — but I wanted to close the loop.`,
          `When you have a client who needs documents notarized and can't get to the office, especially on short notice, I'm here and I move quickly: <strong>${PHONE}</strong>. Many of the estate signings I do are time-sensitive, and families are always grateful when it just gets handled.`,
          `Thank you for your time. I'd be honored to support your clients whenever the need comes up.`,
        ] },
    ],
  },
  {
    key: 'hospital-nursing', label: 'Hospital & Nursing Home Drip',
    emails: [
      { slug: 'intro', name: 'Intro', subject: 'A bedside notary for your patients & families',
        preview: 'Same-day, on-site, 7 days a week across the Charlotte metro.', cta: CALL,
        paragraphs: [
          `I'm a mobile notary serving the greater Charlotte metro, and I wanted your team to know I'm available for bedside and on-site notarizations for patients and families — powers of attorney, healthcare directives, and other time-sensitive documents.`,
          `These needs often come up suddenly and can't wait for someone to travel to an office. I come to the patient, 7 days a week, including evenings.`,
          `I'll keep this brief — please keep my number where your staff can find it: <strong>${PHONE}</strong>.`,
        ] },
      { slug: 'urgency', name: 'When a family needs one today', subject: 'When a family needs a notary today',
        preview: 'POAs, directives, and urgent paperwork — I come to you.', cta: CALL,
        paragraphs: [
          `When a patient's situation changes quickly, families often scramble to get a power of attorney or healthcare directive signed and notarized — sometimes within hours. That's a stressful moment to be searching for a notary who can actually come to the bedside.`,
          `That's exactly what I do. I respond fast, come directly to your facility, confirm the signer is aware and willing, and can coordinate witnesses when the documents call for it — calmly and respectfully for everyone in the room.`,
          `If a family at your facility needs a notary today, I'm one call away: <strong>${PHONE}</strong>.`,
        ] },
      { slug: 'reassure', name: 'Compassionate & experienced', subject: 'Compassionate, and used to your setting',
        preview: 'Experienced in hospitals and care facilities, with discretion.', cta: CALL,
        paragraphs: [
          `Notarizing at a bedside is different from signing at a desk, and I treat it that way. I'm experienced navigating hospitals, nursing homes, hospice, and assisted living, and I'm mindful of the patient, the family, and your staff's time.`,
          `&bull; Prompt, same-day response across the Charlotte metro, 7 days a week<br/>&bull; Patient and discreet with sensitive situations<br/>&bull; Careful to confirm the signer is aware and willing before proceeding<br/>&bull; Background-checked and insured; can bring witnesses when needed`,
          `If it's helpful, I'm glad to provide a card or flyer for your social workers or front desk so my number is on hand when a family asks. Just reply or call <strong>${PHONE}</strong>.`,
        ] },
      { slug: 'close', name: 'Soft close', subject: 'Save my number for the tough days',
        preview: 'When a family needs a notary right now, I\'ll be there.', cta: CALL,
        paragraphs: [
          `I'll stop here — I know your team has a lot on its plate.`,
          `The next time a patient or family needs a document notarized and can't wait, I hope you'll think of me: <strong>${PHONE}</strong>. I'll be there quickly and handle it with care, so that's one less thing for your staff to worry about.`,
          `Thank you for the work you and your team do.`,
        ] },
    ],
  },
];

async function run() {
  let n = 0;
  for (const seq of sequences) {
    for (let i = 0; i < seq.emails.length; i++) {
      const e = seq.emails[i];
      const id = `drip-${seq.key}-${i + 1}`;
      const template = {
        userId: USER_ID,
        name: `${seq.label} — ${i + 1}/4: ${e.name}`,
        category: 'Follow-up',
        subjectSuggestion: e.subject,
        previewTextSuggestion: e.preview,
        htmlContent: wrap({ paragraphs: e.paragraphs, ctaLabel: e.cta.ctaLabel, ctaHref: e.cta.ctaHref }),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await setDoc(doc(db, 'marketingTemplates', id), template);
      console.log(`✓ ${template.name}`);
      n++;
    }
  }
  console.log(`\nDone! Saved ${n} drip templates. They now appear in the Template dropdown (Campaigns + Send Email).`);
  process.exit(0);
}

run().catch(err => { console.error(err); process.exit(1); });
