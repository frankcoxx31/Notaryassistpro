/**
 * Client-facing quote pricing.
 *
 * Single source of truth for the intake form's estimate and for the fee
 * language in consent forms, so a rate change lands in both places at once.
 *
 * North Carolina caps the notarial fee at $10.00 per principal signature.
 * Travel is billed separately as reimbursement at the IRS business mileage
 * rate, and must be agreed to before the appointment — which is exactly what
 * the consent form records.
 */

/** NC statutory maximum per notarized principal signature. */
export const NOTARY_FEE_PER_SIGNATURE = 10.0;

/** IRS standard business mileage rate. Matches DEFAULT_MILEAGE_RATE in App.tsx. */
export const MILEAGE_RATE = 0.725;

/** Where the appointment happens. Informational — it does not change the price. */
export const LOCATION_TYPES = [
  'Home',
  'Office',
  'Hospital',
  'Nursing Home',
  'Assisted Living',
] as const;

export type LocationType = (typeof LOCATION_TYPES)[number];

export interface QuoteInput {
  signatures: number;
  roundTripMiles: number;
}

export interface Quote {
  signatures: number;
  roundTripMiles: number;
  notaryFee: number;
  travelFee: number;
  total: number;
}

export function computeQuote({ signatures, roundTripMiles }: QuoteInput): Quote {
  const sigs = Math.max(0, Math.floor(Number(signatures) || 0));
  const miles = Math.max(0, Number(roundTripMiles) || 0);
  const notaryFee = round2(sigs * NOTARY_FEE_PER_SIGNATURE);
  const travelFee = round2(miles * MILEAGE_RATE);
  return {
    signatures: sigs,
    roundTripMiles: miles,
    notaryFee,
    travelFee,
    total: round2(notaryFee + travelFee),
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function formatCurrency(n: number): string {
  return `$${n.toFixed(2)}`;
}

/**
 * Mileage and travel-fee disclaimer shown under the quote calculator and
 * echoed in the consent form's fee clause.
 */
export const MILEAGE_DISCLAIMER =
  'In North Carolina the notarial fee is $10.00 per notarized principal signature. ' +
  'Travel is billed separately as mileage reimbursement at the IRS business rate of ' +
  `$${MILEAGE_RATE.toFixed(3)} per mile, calculated on round-trip distance from our office in Mint Hill, NC. ` +
  'Travel reimbursement is not a notarial fee and must be agreed to in advance. ' +
  'Mileage shown here is an estimate — the final figure is confirmed when your appointment is booked, ' +
  'and it may change if the address changes or a return trip is needed.';

/** Shorter line for tight spaces. */
export const QUOTE_ESTIMATE_NOTE =
  'This is an estimate only. Your final price is confirmed when the appointment is booked.';
