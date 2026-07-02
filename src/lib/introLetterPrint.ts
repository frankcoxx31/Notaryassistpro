import { BusinessProfile } from '../types';

export interface LetterContact {
  fullName: string;
  companyName?: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
}

const escapeHtml = (str: string) =>
  (str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const firstNameOf = (fullName: string) => (fullName || '').trim().split(/\s+/)[0] || 'there';

const todayLong = () =>
  new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

const defaultBody = (senderName: string, bizName: string) => `
<p>My name is ${escapeHtml(senderName)}, and I run ${escapeHtml(bizName)}, a mobile notary and loan signing service in the Charlotte / Mint Hill / Union County area.</p>
<p>I work directly with real estate attorneys, title companies, and lenders to handle loan signings, general notary work, and mobile closings — meeting borrowers wherever is most convenient, including their home, office, or your closing table.</p>
<p>What I offer:</p>
<ul>
  <li>Commissioned North Carolina Notary Public</li>
  <li>Loan signing agent for purchase, refinance, and HELOC packages</li>
  <li>Prompt scan-backs and same-day document shipping</li>
  <li>Flexible scheduling, including evenings and weekends</li>
</ul>
<p>If your office ever needs a reliable notary for a closing in the area, I'd welcome the opportunity to be added to your list of trusted signing agents. Feel free to reach out any time with questions — I'd love the chance to work with you.</p>
`;

/**
 * Opens a print-ready window with one personalized introduction letter per
 * contact (US Letter, 8.5x11in). The body is editable in the print preview
 * so the pitch can be tweaked before printing without touching code.
 */
export function printIntroLetters(contacts: LetterContact[], businessProfile: BusinessProfile | null) {
  if (contacts.length === 0) {
    alert('No contacts selected.');
    return;
  }

  const bizName = businessProfile?.companyName || businessProfile?.name || 'Your Notary Service';
  const senderName = businessProfile?.name || bizName;
  const senderAddress = businessProfile?.address || '';
  const senderPhone = businessProfile?.phone || '';
  const senderEmail = businessProfile?.email || '';
  // Prefer the logo as the letterhead's visual identifier; fall back to the
  // bold business name only when no logo is on file.
  const logo = businessProfile?.logoUrl
    ? `<img src="${businessProfile.logoUrl}" alt="${escapeHtml(bizName)} logo" class="logo" referrerpolicy="no-referrer" />`
    : `<div class="biz-name">${escapeHtml(bizName)}</div>`;
  const date = todayLong();

  const lettersHtml = contacts.map((c, i) => {
    const recipientCompany = c.companyName ? `<div>${escapeHtml(c.companyName)}</div>` : '';
    const cityStateZip = escapeHtml(`${c.city || ''}, ${c.state || ''} ${c.zip || ''}`.replace(/^,\s*/, '').trim());
    return `
      <div class="page">
        <div class="letterhead">
          ${logo}
          <div class="letterhead-text">
            <div class="biz-meta">${escapeHtml(senderAddress)}</div>
            <div class="biz-meta">${[senderPhone, senderEmail].filter(Boolean).map(escapeHtml).join(' &nbsp;|&nbsp; ')}</div>
          </div>
        </div>

        <div class="date">${date}</div>

        <div class="recipient">
          <div>${escapeHtml(c.fullName)}</div>
          ${recipientCompany}
          <div>${escapeHtml(c.address || '')}</div>
          <div>${cityStateZip}</div>
        </div>

        <div class="salutation">Dear ${escapeHtml(firstNameOf(c.fullName))},</div>

        <div class="body" contenteditable="true" data-letter-index="${i}">
          ${defaultBody(senderName, bizName)}
        </div>

        <div class="closing">
          <p>Thank you for your time — I look forward to potentially working together.</p>
          <p class="signoff">Sincerely,</p>
          <p class="signature">${escapeHtml(senderName)}</p>
          <p class="signature-sub">${escapeHtml(bizName)}${senderPhone ? ` &nbsp;|&nbsp; ${escapeHtml(senderPhone)}` : ''}${senderEmail ? ` &nbsp;|&nbsp; ${escapeHtml(senderEmail)}` : ''}</p>
        </div>
      </div>`;
  }).join('');

  const title = contacts.length === 1 ? `Letter — ${escapeHtml(contacts[0].fullName)}` : `Letters (${contacts.length})`;

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<title>${title}</title>
<style>
  * { box-sizing: border-box; }
  body { margin: 0; padding: 0; background: #f8fafc; font-family: Georgia, 'Times New Roman', serif; color: #1e293b; }
  .toolbar { padding: 16px; display: flex; align-items: center; gap: 14px; background: #fff; border-bottom: 1px solid #e2e8f0; position: sticky; top: 0; z-index: 10; font-family: Arial, sans-serif; }
  .toolbar p { font-size: 12px; color: #64748b; font-weight: 600; margin: 0; }
  button { padding: 9px 20px; border-radius: 8px; font-size: 13px; font-weight: 700; cursor: pointer; border: none; font-family: Arial, sans-serif; }
  .btn-print { background: #1e3a5f; color: #fff; }
  .btn-close { background: #e2e8f0; color: #475569; }
  .page {
    width: 8.5in;
    min-height: 11in;
    margin: 24px auto;
    padding: 0.85in 1in;
    background: #fff;
    box-shadow: 0 1px 6px rgba(0,0,0,.12);
    page-break-after: always;
    font-size: 13px;
    line-height: 1.6;
  }
  .letterhead { display: flex; flex-direction: column; align-items: flex-start; gap: 4px; border-bottom: 2px solid #1e3a5f; padding-bottom: 16px; margin-bottom: 28px; }
  .logo { max-height: 130px; max-width: 380px; object-fit: contain; }
  .biz-name { font-size: 22px; font-weight: 700; color: #1e3a5f; }
  .biz-meta { font-size: 11px; color: #64748b; }
  .date { margin-bottom: 24px; }
  .recipient { margin-bottom: 24px; }
  .salutation { margin-bottom: 16px; }
  .body { outline: none; }
  .body p { margin: 0 0 14px; }
  .body ul { margin: 0 0 14px; padding-left: 22px; }
  .body li { margin-bottom: 4px; }
  .closing { margin-top: 24px; }
  .closing p { margin: 0 0 4px; }
  .signoff { margin-top: 20px !important; }
  .signature { margin-top: 28px !important; font-weight: 700; }
  .signature-sub { font-size: 11px; color: #64748b; font-family: Arial, sans-serif; }
  @media print {
    body { background: #fff; }
    .toolbar { display: none; }
    @page { size: letter; margin: 0; }
    .page { margin: 0; box-shadow: none; }
  }
</style>
</head>
<body>
  <div class="toolbar">
    <button class="btn-print" onclick="window.print()">🖨 Print ${contacts.length} Letter${contacts.length === 1 ? '' : 's'}</button>
    <button class="btn-close" onclick="window.close()">✕ Close</button>
    <p>Click the letter text to edit it before printing.</p>
  </div>
  ${lettersHtml}
</body>
</html>`;

  const win = window.open('', '_blank', 'width=1000,height=750,scrollbars=yes');
  if (win) {
    win.document.write(html);
    win.document.close();
  }
}
