import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { addPdfFooter, addPdfLetterhead } from '@/lib/pdf-letterhead';

export type InvoicePdfLine = { description: string; quantity: number; unit: string; unitPrice: number; total: number };
export type InvoicePdfData = { id: string; customer: string; customerType?: string; poultryCategory?: string; building?: string; unitLabel: string; issueDate: string; taxRate: number; subtotal: number; tax: number; total: number; paid: number; remaining: number; status: string; paymentMethod: string; lines: InvoicePdfLine[] };

export async function downloadInvoicePdf(invoice: InvoicePdfData) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const contentStart = await addPdfLetterhead(doc, { title: 'Facture', reference: invoice.id, context: [`Date : ${invoice.issueDate}`, `Unité : ${invoice.unitLabel}`] });
  doc.setFillColor(242, 249, 239);
  doc.roundedRect(14, contentStart, 182, 22, 3, 3, 'F');
  doc.setTextColor(25, 56, 46);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('CLIENT', 20, contentStart + 9);
  doc.setFont('helvetica', 'normal');
  doc.text(invoice.customer || 'Client non renseigné', 20, contentStart + 16);
  if (invoice.customerType) doc.text(`Type : ${invoice.customerType}`, 112, contentStart + 16);
  if (invoice.poultryCategory) doc.text(`Catégorie : ${invoice.poultryCategory}`, 112, contentStart + 9);
  if (invoice.building) doc.text(`Bâtiment : ${invoice.building}`, 112, contentStart + 16);
  autoTable(doc, { startY: contentStart + 32, head: [['Description', 'Catégorie', 'Qté', 'Prix unitaire', 'Montant']], body: invoice.lines.map((line) => [line.description, invoice.poultryCategory ?? 'Poulet', `${line.quantity} ${line.unit}`, `${line.unitPrice.toLocaleString('fr-FR')} FCFA`, `${line.total.toLocaleString('fr-FR')} FCFA`]), styles: { fontSize: 8, cellPadding: 3 }, headStyles: { fillColor: [25, 56, 46], textColor: 255 }, alternateRowStyles: { fillColor: [248, 251, 247] }, margin: { left: 14, right: 14 } });
  const tableEnd = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 110;
  const summaryTop = Math.max(tableEnd + 12, 125);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(`Sous-total : ${invoice.subtotal.toLocaleString('fr-FR')} FCFA`, 125, summaryTop);
  doc.text(`TVA (${invoice.taxRate} %) : ${invoice.tax.toLocaleString('fr-FR')} FCFA`, 125, summaryTop + 7);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text(`TOTAL TTC : ${invoice.total.toLocaleString('fr-FR')} FCFA`, 125, summaryTop + 17);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(`Versement : ${invoice.paid.toLocaleString('fr-FR')} FCFA`, 125, summaryTop + 27);
  doc.text(`Reste à payer : ${invoice.remaining.toLocaleString('fr-FR')} FCFA`, 125, summaryTop + 34);
  doc.text(`Statut : ${invoice.status}`, 14, summaryTop + 27);
  doc.text(`Mode de paiement : ${invoice.paymentMethod || 'Non renseigné'}`, 14, summaryTop + 34);
  addPdfFooter(doc);
  doc.save(`${invoice.id}.pdf`);
}
