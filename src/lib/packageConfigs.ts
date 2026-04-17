
export interface PackageConfig {
  type: string;
  canonicalDocs: string[];
  matchers: {
    label: string;
    keywords: string[];
  }[];
}

export const HYBRID_LOAN_PACKAGE: PackageConfig = {
  type: 'Hybrid Loan Package',
  canonicalDocs: [
    'Title Company Client Acknowledgement (Owner Affidavit)',
    'Loan Proceeds Delivery Instructions',
    'Correction Agreement',
    'Deed of Trust',
    'Occupancy Statement',
    'Signature/Name Affidavit – Borrower',
    'Signature/Name Affidavit – Non-Borrowing Party',
    'Errors and Omissions / Compliance Agreement',
    'Note'
  ],
  matchers: [
    { 
      label: 'Title Company Client Acknowledgement (Owner Affidavit)', 
      keywords: ['title company client acknowledgement', 'owner affidavit', 'owner\'s affidavit', 'acknowledgement (owner affidavit)'] 
    },
    { 
      label: 'Loan Proceeds Delivery Instructions', 
      keywords: ['loan proceeds delivery instructions', 'how would you like to receive your money', 'delivery of loan proceeds'] 
    },
    { 
      label: 'Correction Agreement', 
      keywords: ['correction agreement', 'limited power of attorney/correction agreement', 'notice of correction'] 
    },
    { 
      label: 'Deed of Trust', 
      keywords: ['deed of trust', 'mortgage', 'security instrument', 'deed of trust/mortgage'] 
    },
    { 
      label: 'Occupancy Statement', 
      keywords: ['occupancy statement', 'owner occupied', 'second home', 'investment property', 'occupancy affidavit'] 
    },
    { 
      label: 'Signature/Name Affidavit – Borrower', 
      keywords: ['signature/name affidavit', 'borrower', 'name affidavit', 'signature affidavit'] 
    },
    { 
      label: 'Signature/Name Affidavit – Non-Borrowing Party', 
      keywords: ['signature/name affidavit', 'non-borrowing party', 'non-borrower affidavit'] 
    },
    { 
      label: 'Errors and Omissions / Compliance Agreement', 
      keywords: ['errors and omissions', 'compliance agreement', 'e&o agreement', 'e & o'] 
    },
    { 
      label: 'Note', 
      keywords: ['note', 'borrower’s promise to pay', 'promissory note', 'the note'] 
    }
  ]
};

export const PACKAGE_CONFIGS: Record<string, PackageConfig> = {
  [HYBRID_LOAN_PACKAGE.type]: HYBRID_LOAN_PACKAGE
};

/**
 * Normalizes a document name based on package-specific rules or patterns.
 */
export function normalizeDocName(text: string, packageType?: string): string {
  const trimmed = text.trim();
  if (!trimmed) return '';

  // 1. Try package-specific matches first
  if (packageType && PACKAGE_CONFIGS[packageType]) {
    const config = PACKAGE_CONFIGS[packageType];
    const t = trimmed.toLowerCase();

    for (const matcher of config.matchers) {
      if (matcher.keywords.some(k => t.includes(k.toLowerCase()))) {
        console.log(`[Normalization] Matched "${trimmed}" to canonical "${matcher.label}"`);
        return matcher.label;
      }
    }
  }

  // 2. Generic cleaning for non-package docs or if no specific match
  return trimmed;
}

/**
 * Merges new documents into an existing list, applying normalization and deduplication.
 */
export function mergeUniqueDocuments(existing: string[] = [], additions: string[] = [], packageType?: string): string[] {
  console.log(`[Merge] Merging ${additions.length} new docs into ${existing.length} existing docs. Type: ${packageType || 'None'}`);
  
  const normalizedAdditions = additions
    .map(doc => normalizeDocName(doc, packageType))
    .filter(doc => !!doc);

  const combined = [...existing, ...normalizedAdditions];
  
  const unique = new Set<string>();
  const result: string[] = [];
  
  for (const doc of combined) {
    if (!unique.has(doc)) {
      unique.add(doc);
      result.push(doc);
    }
  }
  
  console.log(`[Merge] Final document count: ${result.length}`);
  return result;
}

/**
 * Validates a document list before saving.
 */
export function validateDocuments(docs: string[]): string[] {
  return docs
    .filter(d => typeof d === 'string' && d.trim().length > 0)
    .map(d => d.trim());
}
