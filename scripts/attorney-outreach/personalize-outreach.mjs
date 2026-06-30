/**
 * AI-personalized attorney outreach.
 *
 * For each attorney in leads.mjs:
 *   1. Infers their practice area from firm name + title.
 *   2. Asks Gemini to write a tailored 2-paragraph intro + subject line.
 *   3. Renders it into attorney-outreach-email.html (your existing template).
 *   4. Stages a ready-to-send .html per attorney + a review.csv.
 *
 * SAFE BY DEFAULT: staging only. Nothing is sent until you pass --send.
 *
 * Setup (deps @google/genai + resend already ship with this app):
 *   export GEMINI_API_KEY="..."          # or set in your shell / .env
 *
 * Run from the repo root:
 *   node scripts/attorney-outreach/personalize-outreach.mjs                # stage ALL drafts to _drafts/
 *   node scripts/attorney-outreach/personalize-outreach.mjs --limit 3      # stage just the first 3 (test)
 *   node scripts/attorney-outreach/personalize-outreach.mjs --out mydrafts # custom output folder
 *   node scripts/attorney-outreach/personalize-outreach.mjs --send \       # actually send via Resend
 *        --from "Frank Coxx <frank@integrityclosingsclt.com>"
 *
 * Without GEMINI_API_KEY the script still runs, using practice-area
 * heuristics so you can preview the pipeline offline.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { leads } from './leads.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ─── Args ───────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
function flag(name) { return args.includes(`--${name}`); }
function opt(name, fallback) {
  const i = args.indexOf(`--${name}`);
  return i !== -1 && args[i + 1] ? args[i + 1] : fallback;
}

const LIMIT = parseInt(opt('limit', '0'), 10) || 0;
const OUT_DIR = join(__dirname, opt('out', '_drafts'));
const DO_SEND = flag('send');
const FROM = opt('from', process.env.FROM_EMAIL || '');
const MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const API_KEY = process.env.GEMINI_API_KEY || '';
const SEND_DELAY_MS = parseInt(opt('delay', '600'), 10);

// ─── Business context (used in the AI prompt) ─────────────────────────────────
const BIZ = {
  name: 'Frank Coxx — Professional Notary Services / Integrity Closings CLT',
  notary: 'Frank Coxx',
  area: 'the greater Charlotte / Mint Hill, NC metro area',
  website: 'https://www.integrityclosingsclt.com',
};

// ─── Practice-area inference ──────────────────────────────────────────────────
const PRACTICE_RULES = [
  { match: /estate|elder|trust|probate|wills?/i, area: 'estate planning',
    docs: 'wills, trusts, powers of attorney, and healthcare directives — including bedside signings at hospitals or care facilities when a client cannot travel' },
  { match: /famil|divorce|custody|matrimonial|adoption|formation/i, area: 'family law',
    docs: 'separation agreements, property settlements, and affidavits that need prompt, dependable notarization' },
  { match: /injur|accident|malpractice|tort|wrongful/i, area: 'personal injury',
    docs: 'settlement releases, affidavits, and disbursement documents, often on tight deadlines' },
  { match: /real estate|closing|title|property|mortgage|loan/i, area: 'real estate',
    docs: 'loan signings and closing packages at the title office, a client’s home, or any preferred location' },
  { match: /franchise|business|corporate|patent|\bip\b|startup|venture|commercial|securit/i, area: 'business & corporate law',
    docs: 'entity-formation documents, operating agreements, and contracts that require notarization' },
  { match: /immigration|visa|citizen/i, area: 'immigration law',
    docs: 'affidavits, sponsorship forms, and supporting documents that require notarization' },
];
const DEFAULT_PRACTICE = { area: 'legal', docs: 'time-sensitive documents that require a reliable, mobile notary' };

function inferPractice(lead) {
  const hay = `${lead.company} ${lead.title}`;
  for (const rule of PRACTICE_RULES) if (rule.match.test(hay)) return rule;
  return DEFAULT_PRACTICE;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function firstNameOf(fullName) {
  return fullName.trim().split(/\s+/)[0].replace(/[^A-Za-z'-]/g, '');
}
function slugify(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}
function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ─── AI generation (Gemini) ───────────────────────────────────────────────────
let ai = null;
async function getAI() {
  if (!API_KEY) return null;
  if (ai) return ai;
  const { GoogleGenAI } = await import('@google/genai');
  ai = new GoogleGenAI({ apiKey: API_KEY });
  return ai;
}

function buildPrompt(lead, practice) {
  return `You are writing a short, warm, professional cold-outreach email on behalf of ${BIZ.notary}, a certified mobile notary public serving ${BIZ.area}.

Recipient:
- Name: ${lead.fullName}
- Title: ${lead.title}
- Law firm: ${lead.company}
- Likely practice area: ${practice.area}
- Relevant notary work for this practice: ${practice.docs}

Write the BODY of an introductory email offering reliable mobile notary services to this attorney's firm and clients.

Strict requirements:
- Return ONLY valid JSON: {"subject": string, "paragraphs": [string, string]}
- Exactly TWO short paragraphs (2-3 sentences each), plain text, no HTML, no markdown.
- Do NOT include a greeting ("Dear ...") or a sign-off — those are added separately.
- Reference their ${practice.area} focus naturally and tie it to the specific documents/situations above.
- Mention mobile, same-day availability across ${BIZ.area}.
- Do NOT invent facts about the firm (no awards, case results, client names, founding dates, or specifics you weren't given).
- Tone: courteous, concise, peer-to-peer. Not pushy or salesy. No emojis. No buzzwords.
- Subject line: 5-9 words, specific, no clickbait, no ALL CAPS.`;
}

function parseAI(text) {
  let t = String(text).trim();
  // strip ```json fences if present
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) t = fence[1].trim();
  const start = t.indexOf('{');
  const end = t.lastIndexOf('}');
  if (start !== -1 && end !== -1) t = t.slice(start, end + 1);
  const obj = JSON.parse(t);
  if (!obj.subject || !Array.isArray(obj.paragraphs) || obj.paragraphs.length === 0) {
    throw new Error('AI returned unexpected shape');
  }
  return { subject: String(obj.subject).trim(), paragraphs: obj.paragraphs.map(p => String(p).trim()) };
}

// Heuristic fallback when no API key / AI fails — still practice-area aware.
function fallbackContent(lead, practice) {
  const firmShort = lead.company.split(/,|\bPLLC\b|\bP\.?A\.?\b|\bPC\b|\bLLP\b/i)[0].trim();
  return {
    subject: `Reliable mobile notary support for ${firmShort}`,
    paragraphs: [
      `I'm ${BIZ.notary}, a certified mobile notary public serving ${BIZ.area}. I'm reaching out to introduce my services to ${lead.company} as a dependable resource for your ${practice.area} clients whenever a notarization is needed.`,
      `I regularly handle ${practice.docs}. I offer same-day, mobile availability and come to wherever your client needs to sign, so your matters keep moving without scheduling friction.`,
    ],
  };
}

async function generateFor(lead, practice) {
  const client = await getAI();
  if (!client) return { ...fallbackContent(lead, practice), source: 'fallback' };
  try {
    const res = await client.models.generateContent({
      model: MODEL,
      contents: buildPrompt(lead, practice),
      config: { responseMimeType: 'application/json', temperature: 0.8 },
    });
    const parsed = parseAI(res.text);
    return { ...parsed, source: 'gemini' };
  } catch (err) {
    console.warn(`  ! Gemini failed for ${lead.fullName} (${err.message}) — using fallback`);
    return { ...fallbackContent(lead, practice), source: 'fallback' };
  }
}

// ─── Template rendering ───────────────────────────────────────────────────────
const TEMPLATE = readFileSync(join(__dirname, 'attorney-outreach-email.html'), 'utf-8');

function renderEmail(lead, content) {
  const firstName = firstNameOf(lead.fullName);
  const paras = content.paragraphs
    .map((p, i) => {
      const mb = i === content.paragraphs.length - 1 ? '0' : '20px';
      return `<p style="margin:0 0 ${mb} 0;font-size:15px;line-height:1.7;color:#374151;">${escapeHtml(p)}</p>`;
    })
    .join('\n              ');

  const introBlock =
`<!-- INTRO -->
          <tr>
            <td style="padding:44px 48px 28px 48px;">
              <p style="margin:0 0 20px 0;font-size:15px;line-height:1.7;color:#374151;">Dear ${escapeHtml(firstName)},</p>
              ${paras}
            </td>
          </tr>

          <!-- DIVIDER -->`;

  let html = TEMPLATE.replace(/<!-- INTRO -->[\s\S]*?<!-- DIVIDER -->/, introBlock);
  // Replace any remaining placeholders defensively.
  html = html.replace(/\[First Name\]/g, escapeHtml(firstName));
  html = html.replace(/\[Law Firm Name\]/g, escapeHtml(lead.company));
  return html;
}

// ─── Sending (Resend) ─────────────────────────────────────────────────────────
let resend = null;
async function getResend() {
  if (resend) return resend;
  if (!process.env.RESEND_API_KEY) throw new Error('RESEND_API_KEY is not set');
  if (!FROM) throw new Error('--from "Name <email@verified-domain>" is required to send');
  const { Resend } = await import('resend');
  resend = new Resend(process.env.RESEND_API_KEY);
  return resend;
}

async function sendEmail(lead, subject, html) {
  const client = await getResend();
  const result = await client.emails.send({ from: FROM, to: [lead.email], subject, html });
  if (result.error) throw new Error(result.error.message || JSON.stringify(result.error));
  return result.data?.id || 'sent';
}

// ─── Main ─────────────────────────────────────────────────────────────────────
function csvCell(s) { return `"${String(s).replace(/"/g, '""')}"`; }

async function main() {
  const list = LIMIT > 0 ? leads.slice(0, LIMIT) : leads;

  console.log(`\nAI-personalized attorney outreach`);
  console.log(`  Leads:   ${list.length}${LIMIT ? ` (limited from ${leads.length})` : ''}`);
  console.log(`  AI:      ${API_KEY ? `Gemini (${MODEL})` : 'OFF — using practice-area fallback (set GEMINI_API_KEY for AI)'}`);
  console.log(`  Mode:    ${DO_SEND ? `SEND via Resend  from: ${FROM || '(missing --from!)'}` : 'STAGE only (safe) — add --send to deliver'}`);
  console.log(`  Output:  ${OUT_DIR}\n`);

  if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });

  const rows = [['fullName', 'email', 'firm', 'practiceArea', 'subject', 'source', 'file', 'status']];
  const indexLinks = [];
  let ok = 0, failed = 0;

  for (const lead of list) {
    const practice = inferPractice(lead);
    process.stdout.write(`• ${lead.fullName} <${lead.email}> [${practice.area}] ... `);

    let content, html, status = 'staged', file = '';
    try {
      content = await generateFor(lead, practice);
      html = renderEmail(lead, content);

      file = `${slugify(lead.fullName)}-${slugify(lead.company).slice(0, 24)}.html`;
      writeFileSync(join(OUT_DIR, file), html, 'utf-8');
      indexLinks.push(`<li><a href="./${file}">${escapeHtml(lead.fullName)}</a> — ${escapeHtml(lead.company)} <em>(${practice.area})</em><br><small>${escapeHtml(content.subject)}</small></li>`);

      if (DO_SEND) {
        const id = await sendEmail(lead, content.subject, html);
        status = `sent:${id}`;
      }
      console.log(`${content.source}${DO_SEND ? ' → sent' : ' → staged'}`);
      ok++;
    } catch (err) {
      status = `ERROR: ${err.message}`;
      console.log(`FAILED (${err.message})`);
      failed++;
    }

    rows.push([lead.fullName, lead.email, lead.company, practice.area, content?.subject || '', content?.source || '', file, status]);
    if (DO_SEND) await sleep(SEND_DELAY_MS); // be gentle on the send API
  }

  // review.csv
  const csv = rows.map(r => r.map(csvCell).join(',')).join('\n');
  writeFileSync(join(OUT_DIR, 'review.csv'), csv, 'utf-8');

  // index.html for quick visual review
  const index = `<!doctype html><meta charset="utf-8"><title>Outreach drafts</title>
<style>body{font:15px/1.6 system-ui,sans-serif;max-width:780px;margin:40px auto;padding:0 20px;color:#222}
h1{font-size:20px}li{margin:0 0 14px}small{color:#666}a{color:#0B1829;font-weight:600}</style>
<h1>Attorney outreach drafts (${ok})</h1>
<p>Open each to review before sending. Then run with <code>--send --from "Frank Coxx &lt;you@verified-domain&gt;"</code>.</p>
<ol>${indexLinks.join('\n')}</ol>`;
  writeFileSync(join(OUT_DIR, 'index.html'), index, 'utf-8');

  console.log(`\nDone. ${ok} ${DO_SEND ? 'sent' : 'staged'}, ${failed} failed.`);
  console.log(`  Review:  ${join(OUT_DIR, 'index.html')}`);
  console.log(`  Sheet:   ${join(OUT_DIR, 'review.csv')}`);
  if (!DO_SEND) console.log(`\n  Next: review the drafts, then send a test with:\n    node scripts/attorney-outreach/personalize-outreach.mjs --limit 1 --send --from "Frank Coxx <you@verified-domain>"`);
}

main().catch(err => { console.error('\nFatal:', err); process.exit(1); });
