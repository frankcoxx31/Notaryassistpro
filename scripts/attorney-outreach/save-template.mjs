/**
 * One-time script: saves the attorney outreach email as a marketing template
 * in NotaryAssistPro's Firestore marketingTemplates collection.
 * Run from the repo root:
 *   node scripts/attorney-outreach/save-template.mjs
 */

import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc } from 'firebase/firestore';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const firebaseConfig = {
  apiKey: "AIzaSyDKQCNO_aPVzBw_ydGCUiSG3xuJi_S4myg",
  authDomain: "gen-lang-client-0145482726.firebaseapp.com",
  projectId: "gen-lang-client-0145482726",
  storageBucket: "gen-lang-client-0145482726.firebasestorage.app",
  messagingSenderId: "695597520251",
  appId: "1:695597520251:web:bcda1b533036f03f5e19de",
};

const USER_ID = 'n3I1KimZW6cw3sy0GrXC73yQny62';

const app = initializeApp(firebaseConfig);
const db = getFirestore(app, 'ai-studio-65685a95-d245-4bf3-97e1-8775f84f70ab');

const __dirname = dirname(fileURLToPath(import.meta.url));
const htmlContent = readFileSync(join(__dirname, 'attorney-outreach-email.html'), 'utf-8');

const template = {
  userId: USER_ID,
  name: 'Attorney Outreach — Notary Services',
  subject: 'Professional Notary Services Available for Your Clients',
  htmlContent,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const id = 'attorney-outreach-notary-services';

async function run() {
  await setDoc(doc(db, 'marketingTemplates', id), template);
  console.log('✓ Template saved! Open your NotaryAssistPro app and select "Attorney Outreach — Notary Services" from the Template dropdown in any Send Email modal.');
  process.exit(0);
}

run().catch(err => { console.error(err); process.exit(1); });
