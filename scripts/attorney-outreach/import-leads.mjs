/**
 * One-time import: charlotte_attorneys_notary_leads → NotaryAssistPro Firestore
 * Run: node import-leads.mjs
 * Requires: npm install firebase
 */

import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc, getDoc } from 'firebase/firestore';
import { leads } from './leads.mjs';

const firebaseConfig = {
  apiKey: "AIzaSyDKQCNO_aPVzBw_ydGCUiSG3xuJi_S4myg",
  authDomain: "gen-lang-client-0145482726.firebaseapp.com",
  projectId: "gen-lang-client-0145482726",
  storageBucket: "gen-lang-client-0145482726.firebasestorage.app",
  messagingSenderId: "695597520251",
  appId: "1:695597520251:web:bcda1b533036f03f5e19de",
  databaseId: "ai-studio-65685a95-d245-4bf3-97e1-8775f84f70ab"
};

const USER_ID = 'n3I1KimZW6cw3sy0GrXC73yQny62';

const app = initializeApp(firebaseConfig);
const db = getFirestore(app, 'ai-studio-65685a95-d245-4bf3-97e1-8775f84f70ab');

function generateId() {
  return Math.random().toString(36).substr(2, 9) + Math.random().toString(36).substr(2, 9);
}

function splitName(fullName) {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return { firstName: parts[0], lastName: '' };
  const firstName = parts[0];
  const lastName = parts.slice(1).join(' ');
  return { firstName, lastName };
}


async function importLeads() {
  const now = new Date().toISOString();
  let imported = 0;
  let skipped = 0;

  console.log(`Starting import of ${leads.length} attorney leads...`);

  for (const lead of leads) {
    const { firstName, lastName } = splitName(lead.fullName);
    const id = generateId();

    const customer = {
      id,
      userId: USER_ID,
      firstName,
      lastName,
      fullName: lead.fullName,
      email: lead.email,
      phone: lead.phone || '',
      address: '',
      city: 'Charlotte',
      state: 'NC',
      zip: '',
      customerType: 'Closing Attorney',
      notes: `${lead.title} at ${lead.company}`,
      tags: ['attorney', 'lead', 'charlotte', 'nc'],
      preferredContactMethod: 'Email',
      createdAt: now,
      updatedAt: now,
    };

    // Remove undefined/empty optional fields
    const sanitized = Object.fromEntries(
      Object.entries(customer).filter(([, v]) => v !== undefined && v !== null)
    );

    try {
      await setDoc(doc(db, 'customers', id), sanitized);
      console.log(`✓ ${lead.fullName} (${lead.email})`);
      imported++;
    } catch (err) {
      console.error(`✗ Failed: ${lead.fullName} — ${err.message}`);
      skipped++;
    }
  }

  console.log(`\nDone! ${imported} imported, ${skipped} failed.`);
  process.exit(0);
}

importLeads();
