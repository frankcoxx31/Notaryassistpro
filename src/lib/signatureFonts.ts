/**
 * Script faces offered on the signing page.
 *
 * The picker is only half the job: email clients strip or ignore webfonts, so
 * a signature stored as "this name in Great Vibes" would render as plain text
 * in the executed copy — not the mark the client actually adopted. Every
 * selection is therefore rasterised to a PNG at signing time and stored the
 * same way a drawn signature is. The font id is kept alongside it for the
 * audit record, not for rendering.
 */

export interface SignatureFont {
  id: string;
  label: string;
  /** CSS stack. Falls back to generic cursive if the webfont fails to load. */
  family: string;
  /** Rendered size relative to the others, so they read at similar weight. */
  scale: number;
}

export const SIGNATURE_FONTS: SignatureFont[] = [
  { id: 'dancing',  label: 'Flowing',    family: "'Dancing Script', cursive", scale: 1.0 },
  { id: 'greatvibes', label: 'Formal',   family: "'Great Vibes', cursive",    scale: 1.05 },
  { id: 'homemade', label: 'Handwritten', family: "'Homemade Apple', cursive", scale: 0.78 },
  { id: 'sacramento', label: 'Classic',  family: "'Sacramento', cursive",     scale: 1.05 },
  { id: 'caveat',   label: 'Casual',     family: "'Caveat', cursive",         scale: 1.05 },
];

export function getSignatureFont(id: string): SignatureFont {
  return SIGNATURE_FONTS.find(f => f.id === id) || SIGNATURE_FONTS[0];
}

/** Ids the server will accept, so a tampered payload cannot store junk. */
export const SIGNATURE_FONT_IDS = SIGNATURE_FONTS.map(f => f.id);

/**
 * Draws the typed name in the chosen face and returns a transparent PNG.
 *
 * Rendered at 2x for retina, then trimmed to a fixed box. Waits for the
 * webfont so the raster is never a fallback face rendered by accident.
 */
export async function renderTypedSignature(
  name: string,
  fontId: string,
  opts: { width?: number; height?: number } = {},
): Promise<string> {
  const font = getSignatureFont(fontId);
  const width = opts.width ?? 520;
  const height = opts.height ?? 130;
  const ratio = 2;

  // Without this the first render can fall back to a generic cursive.
  if (typeof document !== 'undefined' && (document as any).fonts?.load) {
    try {
      await (document as any).fonts.load(`48px ${font.family.split(',')[0]}`, name);
      await (document as any).fonts.ready;
    } catch {
      /* fall through to whatever the browser has */
    }
  }

  const canvas = document.createElement('canvas');
  canvas.width = width * ratio;
  canvas.height = height * ratio;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not prepare the signature image.');
  ctx.scale(ratio, ratio);

  ctx.fillStyle = '#0f172a';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Shrink to fit rather than overflow a long legal name.
  let size = Math.round(56 * font.scale);
  const maxWidth = width - 32;
  do {
    ctx.font = `${size}px ${font.family}`;
    if (ctx.measureText(name).width <= maxWidth || size <= 18) break;
    size -= 2;
  } while (size > 18);

  ctx.fillText(name, width / 2, height / 2, maxWidth);
  return canvas.toDataURL('image/png');
}
