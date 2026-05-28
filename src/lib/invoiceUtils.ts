import { format } from 'date-fns';
import { Appointment, BusinessProfile } from '../types';

export const printInvoice = (appointment: Appointment, profile: BusinessProfile | null) => {
  // Profile is required to print an invoice — it supplies the business name,
  // email, phone, and address that appear on the document.  Callers must ensure
  // the profile has been loaded before invoking this function.
  if (!profile || !profile.companyName) {
    alert(
      'Your business profile is incomplete.\n\n' +
      'Please go to Settings → Business Profile and fill in your company name, ' +
      'email, phone, and address before printing invoices.'
    );
    return;
  }

  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document;
  if (!doc) return;

  const bizName    = profile.companyName;
  const bizEmail   = profile.email   || '';
  const bizPhone   = profile.phone   || '';
  const bizAddress = profile.address || '';
  const commission = profile.commissionNumber ? `Commission #: ${profile.commissionNumber}` : '';
  const logoUrl    = profile.logoUrl || '';

  const invoiceDate = format(new Date(), 'MMMM d, yyyy');
  const dueDate = appointment.paymentDueDate ? format(new Date(appointment.paymentDueDate), 'MMMM d, yyyy') : format(new Date(), 'MMMM d, yyyy');
  const signingDate = format(new Date(appointment.date), 'MMMM d, yyyy');

  const subtotal = Number(appointment.agreedFee ?? appointment.fee ?? 0);
  const travelFee = 0; // Could be split out if needed
  const total = subtotal + travelFee;

  doc.open();
  doc.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Invoice - ${appointment.invoiceNumber || appointment.id}</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
          
          body {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
            color: #1e293b;
            line-height: 1.5;
            padding: 40px;
            margin: 0;
            background: white;
          }

          .invoice-container {
            max-width: 800px;
            margin: 0 auto;
          }

          .header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            margin-bottom: 60px;
          }

          .brand-logo {
            color: #4f46e5;
            font-weight: 800;
            font-size: 24px;
            letter-spacing: -0.025em;
            margin-bottom: 8px;
          }

          .business-info {
            font-size: 13px;
            color: #64748b;
          }

          .invoice-title {
            text-align: right;
          }

          .invoice-title h1 {
            font-size: 36px;
            font-weight: 800;
            margin: 0;
            color: #0f172a;
            text-transform: uppercase;
            letter-spacing: 0.05em;
          }

          .invoice-meta {
            margin-top: 20px;
            font-size: 13px;
            text-align: right;
          }

          .meta-row {
            display: flex;
            justify-content: flex-end;
            gap: 20px;
            margin-bottom: 4px;
          }

          .meta-label {
            font-weight: 600;
            color: #64748b;
          }

          .meta-value {
            font-weight: 700;
            color: #0f172a;
          }

          .billing-section {
            display: flex;
            gap: 60px;
            margin-bottom: 60px;
          }

          .bill-to, .ship-to {
            flex: 1;
          }

          .section-label {
            font-size: 11px;
            font-weight: 800;
            color: #94a3b8;
            text-transform: uppercase;
            letter-spacing: 0.1em;
            margin-bottom: 12px;
            border-bottom: 1px solid #f1f5f9;
            padding-bottom: 4px;
          }

          .billing-info {
            font-size: 14px;
            font-weight: 500;
          }

          .billing-info strong {
            display: block;
            font-size: 16px;
            color: #0f172a;
            margin-bottom: 4px;
          }

          table {
            width: 100%;
            border-collapse: collapse;
            margin: 40px 0;
          }

          th {
            text-align: left;
            font-size: 11px;
            font-weight: 800;
            color: #64748b;
            text-transform: uppercase;
            letter-spacing: 0.1em;
            padding: 12px 16px;
            background: #f8fafc;
            border-bottom: 2px solid #e2e8f0;
          }

          td {
            padding: 16px;
            border-bottom: 1px solid #f1f5f9;
            font-size: 14px;
          }

          .col-description { width: 60%; }
          .col-qty { width: 10%; text-align: center; }
          .col-price { width: 15%; text-align: right; }
          .col-total { width: 15%; text-align: right; font-weight: 700; }

          .item-name {
            font-weight: 700;
            color: #0f172a;
            margin-bottom: 4px;
          }

          .item-details {
            font-size: 12px;
            color: #64748b;
          }

          .totals-section {
            display: flex;
            justify-content: flex-end;
            margin-top: 40px;
          }

          .totals-table {
            width: 250px;
          }

          .total-row {
            display: flex;
            justify-content: space-between;
            padding: 8px 0;
            font-size: 14px;
          }

          .total-row.grand-total {
            margin-top: 12px;
            padding-top: 12px;
            border-top: 2px solid #0f172a;
            font-size: 18px;
            font-weight: 800;
            color: #0f172a;
          }

          .notes-section {
            margin-top: 60px;
            padding-top: 30px;
            border-top: 1px solid #f1f5f9;
          }

          .notes-title {
            font-size: 11px;
            font-weight: 800;
            color: #94a3b8;
            text-transform: uppercase;
            letter-spacing: 0.1em;
            margin-bottom: 8px;
          }

          .notes-content {
            font-size: 13px;
            color: #64748b;
            font-style: italic;
          }

          .footer {
            margin-top: 100px;
            text-align: center;
            font-size: 12px;
            color: #94a3b8;
            padding-top: 40px;
            border-top: 1px solid #f1f5f9;
          }

          @media print {
            body { padding: 0; }
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="invoice-container">
          <div class="header">
            <div>
              ${logoUrl
                ? `<img src="${logoUrl}" alt="${bizName}" style="max-height:72px;max-width:200px;object-fit:contain;margin-bottom:10px;display:block;" referrerpolicy="no-referrer" />`
                : `<div class="brand-logo">${bizName}</div>`
              }
              <div class="business-info">
                <strong style="color:#0f172a;font-size:14px;">${bizName}</strong><br>
                ${bizAddress}<br>
                ${bizPhone}<br>
                ${bizEmail}<br>
                ${commission}
              </div>
            </div>
            <div class="invoice-title">
              <h1>Invoice</h1>
              <div class="invoice-meta">
                <div class="meta-row">
                  <span class="meta-label">Invoice #:</span>
                  <span class="meta-value">${appointment.invoiceNumber || appointment.id.slice(0, 8).toUpperCase()}</span>
                </div>
                <div class="meta-row">
                  <span class="meta-label">Date:</span>
                  <span class="meta-value">${invoiceDate}</span>
                </div>
                <div class="meta-row">
                  <span class="meta-label">Due Date:</span>
                  <span class="meta-value">${dueDate}</span>
                </div>
              </div>
            </div>
          </div>

          <div class="billing-section">
            <div class="bill-to">
              <div class="section-label">Bill To</div>
              <div class="billing-info">
                <strong>${appointment.signingCompany || appointment.companyName || appointment.customerName || appointment.clientName}</strong>
                ${appointment.location || ''}
              </div>
            </div>
            <div class="ship-to">
              <div class="section-label">Signing Details</div>
              <div class="billing-info">
                <strong>${appointment.signingType}</strong>
                Date: ${signingDate}<br>
                Time: ${appointment.time}<br>
                Order #: ${appointment.orderNumber || 'N/A'}
              </div>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th class="col-description">Description</th>
                <th class="col-qty">Qty</th>
                <th class="col-price">Rate</th>
                <th class="col-total">Amount</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td class="col-description">
                  <div class="item-name">${appointment.signingType} Service</div>
                  <div class="item-details">
                    Principal: ${appointment.customerName || appointment.clientName}<br>
                    Location: ${appointment.city || ''}, ${appointment.state || ''}
                  </div>
                </td>
                <td class="col-qty">1</td>
                <td class="col-price">$${subtotal.toFixed(2)}</td>
                <td class="col-total">$${subtotal.toFixed(2)}</td>
              </tr>
            </tbody>
          </table>

          <div class="totals-section">
            <div class="totals-table">
              <div class="total-row">
                <span class="meta-label">Subtotal</span>
                <span class="meta-value">$${subtotal.toFixed(2)}</span>
              </div>
              <div class="total-row">
                <span class="meta-label">Tax</span>
                <span class="meta-value">$0.00</span>
              </div>
              <div class="total-row grand-total">
                <span>Total Due</span>
                <span>$${total.toFixed(2)}</span>
              </div>
            </div>
          </div>

          <div class="notes-section">
            <div class="notes-title">Notes</div>
            <div class="notes-content">
              Thank you for your business. Please make checks payable to <strong>${bizName}</strong>. 
              Payment is due within 30 days of the signing date unless otherwise agreed.
            </div>
          </div>

          <div class="footer">
            Professional Notary Services | ${bizName} | Generated by NotaryPro
          </div>
        </div>
      </body>
    </html>
  `);
  doc.close();

  setTimeout(() => {
    iframe.contentWindow?.focus();
    iframe.contentWindow?.print();
    setTimeout(() => {
      document.body.removeChild(iframe);
    }, 1000);
  }, 500);
};
