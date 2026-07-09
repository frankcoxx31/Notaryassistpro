import { BusinessProfile } from '../types';

export interface EnvelopeContact {
  fullName: string;
  companyName?: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  attn?: string;
}

const escapeHtml = (str: string) =>
  (str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/**
 * Opens a print-ready window with one #10 envelope (9.5in x 4.125in) per
 * contact that has a mailing address. Contacts missing an address are
 * skipped and counted in the on-screen warning.
 */
export function printEnvelopes(contacts: EnvelopeContact[], businessProfile: BusinessProfile | null) {
  const withAddress = contacts.filter(m => m.address && m.city && m.state);
  const missing = contacts.length - withAddress.length;

  if (withAddress.length === 0) {
    alert(`${contacts.length === 1 ? 'This contact doesn\'t' : `None of the ${contacts.length} contacts`} have a mailing address on file. Add an address first.`);
    return;
  }

  const bizName = businessProfile?.companyName || businessProfile?.name || '';
  const returnAddress = businessProfile?.address || '';

  const envelopesHtml = withAddress.map(m => {
    const recipientCompany = m.companyName ? `<div>${escapeHtml(m.companyName)}</div>` : '';
    const line2 = escapeHtml(m.address || '');
    const line3 = escapeHtml(`${m.city}, ${m.state} ${m.zip || ''}`.trim());
    // Optional attention line, printed on its own line beneath the address.
    const attnLine = m.attn ? `<div class="attn-line">${escapeHtml(m.attn)}</div>` : '';
    return `
      <div class="envelope">
        <div class="return-address">
          <div>${escapeHtml(bizName)}</div>
          <div>${escapeHtml(returnAddress)}</div>
        </div>
        <div class="recipient-address">
          <div>${escapeHtml(m.fullName)}</div>
          ${recipientCompany}
          <div>${line2}</div>
          <div>${line3}</div>
          ${attnLine}
        </div>
      </div>`;
  }).join('');

  const title = withAddress.length === 1 ? `Envelope — ${escapeHtml(withAddress[0].fullName)}` : `Envelopes (${withAddress.length})`;

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<title>${title}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Courier New', Courier, monospace; background: #f8fafc; }
  .toolbar { padding: 16px; display: flex; align-items: center; gap: 14px; background: #fff; border-bottom: 1px solid #e2e8f0; }
  button { padding: 9px 20px; border-radius: 8px; font-size: 13px; font-weight: 700; cursor: pointer; border: none; }
  .btn-print { background: #1e3a5f; color: #fff; }
  .btn-close { background: #e2e8f0; color: #475569; }
  .warn { font-size: 12px; color: #b45309; font-weight: 700; }
  .envelope {
    width: 9.5in;
    height: 4.125in;
    position: relative;
    page-break-after: always;
    background: #fff;
    margin: 24px auto;
    box-shadow: 0 1px 6px rgba(0,0,0,.12);
  }
  .return-address { position: absolute; top: 0.5in; left: 0.5in; font-size: 11px; line-height: 1.4; color: #1e293b; }
  .recipient-address { position: absolute; top: 2in; left: 4.5in; font-size: 14px; line-height: 1.5; color: #0f172a; }
  @media print {
    body { background: #fff; }
    .toolbar { display: none; }
    @page { size: 9.5in 4.125in landscape; margin: 0; }
    .envelope { margin: 0; box-shadow: none; }
  }
</style>
</head>
<body>
  <div class="toolbar">
    <button class="btn-print" onclick="window.print()">🖨 Print ${withAddress.length} Envelope${withAddress.length === 1 ? '' : 's'}</button>
    <button class="btn-close" onclick="window.close()">✕ Close</button>
    ${missing > 0 ? `<span class="warn">${missing} contact(s) skipped — no mailing address on file</span>` : ''}
  </div>
  ${envelopesHtml}
</body>
</html>`;

  const win = window.open('', '_blank', 'width=1000,height=750,scrollbars=yes');
  if (win) {
    win.document.write(html);
    win.document.close();
  }
}
