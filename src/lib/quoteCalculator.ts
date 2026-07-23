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

/**
 * Office the travel distance is measured from. Matches the coordinates used by
 * the calculator on integrityclosingsclt.com so both quote the same mileage.
 */
export const OFFICE_ORIGIN = {
  lat: 35.1813,
  lng: -80.6556,
  label: 'Mint Hill, NC',
  region: 'NC',
};

export interface AddressMatch {
  label: string;
  lat: number;
  lon: number;
}

/**
 * Address lookup via Nominatim (OpenStreetMap).
 *
 * Nominatim asks for no more than one request per second, so callers should
 * debounce. Returns several candidates so the client picks the right one
 * rather than silently routing to the wrong street.
 */
export async function lookupAddress(query: string, limit = 5): Promise<AddressMatch[]> {
  const q = query.trim();
  if (q.length < 4) return [];
  const url =
    `https://nominatim.openstreetmap.org/search?format=json&limit=${limit}` +
    `&countrycodes=us&q=${encodeURIComponent(`${q}, ${OFFICE_ORIGIN.region}`)}`;
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error('Address lookup is unavailable right now.');
  const data = await res.json();
  if (!Array.isArray(data)) return [];
  return data.map((d: any) => ({
    label: String(d.display_name || ''),
    lat: parseFloat(d.lat),
    lon: parseFloat(d.lon),
  })).filter(m => Number.isFinite(m.lat) && Number.isFinite(m.lon));
}

/**
 * Round-trip driving miles from the office to a point, via OSRM.
 * Rounded to one decimal, matching the site's calculator.
 */
export async function roundTripMilesTo(lat: number, lon: number): Promise<number> {
  const url =
    `https://router.project-osrm.org/route/v1/driving/` +
    `${OFFICE_ORIGIN.lng},${OFFICE_ORIGIN.lat};${lon},${lat}?overview=false`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Could not calculate the driving route.');
  const data = await res.json();
  if (data.code !== 'Ok' || !data.routes?.length) {
    throw new Error('Could not calculate a driving route to that address.');
  }
  const oneWayMiles = data.routes[0].distance * 0.000621371;
  return Number((oneWayMiles * 2).toFixed(1));
}

/** Convenience: first match for a free-text address, plus its round-trip miles. */
export async function milesForAddress(address: string): Promise<{ miles: number; matched: string }> {
  const matches = await lookupAddress(address, 1);
  if (!matches.length) throw new Error('Address not found. Try adding a city or ZIP code.');
  const miles = await roundTripMilesTo(matches[0].lat, matches[0].lon);
  return { miles, matched: matches[0].label };
}

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
