import type { Invoice } from '../types';

export function printInvoicePdf(invoice: Invoice): void {
  const rows = invoice.lineItems
    .map(
      (li) =>
        `<tr>
          <td style="padding:8px;border-bottom:1px solid #ddd">${li.name}</td>
          <td style="padding:8px;border-bottom:1px solid #ddd;text-align:right">₱${li.unitPrice.toFixed(2)}</td>
          <td style="padding:8px;border-bottom:1px solid #ddd;text-align:center">${li.quantity}</td>
          <td style="padding:8px;border-bottom:1px solid #ddd;text-align:right">₱${li.total.toFixed(2)}</td>
        </tr>`
    )
    .join('');

  const html = `<!DOCTYPE html>
<html>
<head>
  <title>Invoice ${invoice.id}</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      padding: 40px;
      color: #222;
    }

    h1 {
      margin-bottom: 4px;
    }

    .meta {
      color: #555;
      margin-bottom: 24px;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      margin: 24px 0;
    }

    th {
      text-align: left;
      padding: 8px;
      border-bottom: 2px solid #333;
    }

    .totals {
      margin-top: 16px;
      text-align: right;
    }

    .totals p {
      margin: 4px 0;
    }

    .balance {
      font-size: 1.2em;
      font-weight: bold;
    }
  </style>
</head>

<body>
  <h1>CaterFlex Invoice</h1>

  <p class="meta">
    Invoice ID: ${invoice.id}<br>
    Generated: ${new Date(invoice.generatedAt).toLocaleString()}<br>
    Customer: ${invoice.customerName} (${invoice.customerEmail})<br>
    Event: ${invoice.eventType} — ${new Date(invoice.eventDate).toLocaleDateString()}
  </p>

  <table>
    <thead>
      <tr>
        <th>Item</th>
        <th style="text-align:right">Unit Price</th>
        <th style="text-align:center">Qty (guests)</th>
        <th style="text-align:right">Total</th>
      </tr>
    </thead>

    <tbody>${rows}</tbody>
  </table>

  <div class="totals">
    <p>Subtotal: ₱${invoice.subtotal.toFixed(2)}</p>
    <p>Payments received: ₱${invoice.paymentsMade.toFixed(2)}</p>
    <p class="balance">Balance due: ₱${invoice.balanceDue.toFixed(2)}</p>
  </div>
</body>
</html>`;

  const win = window.open('', '_blank');

  if (!win) return;

  win.document.write(html);
  win.document.close();
  win.focus();
  win.print();
}