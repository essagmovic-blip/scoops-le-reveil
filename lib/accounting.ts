import type { Invoice } from '@/lib/data';

export type PaymentEntry = {
  id: string;
  invoiceId: string;
  invoiceNumber: string;
  invoiceDate: string;
  paymentDate: string;
  amount: number;
  method: string;
  client: string;
  unit: string;
  isAdvance: boolean;
};

export function extractPaymentEntries(invoices: Invoice[], unitId?: string): PaymentEntry[] {
  const entries: PaymentEntry[] = [];
  invoices.filter((invoice) => !unitId || invoice.unit === unitId).forEach((invoice) => {
    if (invoice.payments && invoice.payments.length > 0) {
      invoice.payments.forEach((payment, index) => entries.push({ id: `${invoice.id}-payment-${index}`, invoiceId: invoice.id, invoiceNumber: invoice.id, invoiceDate: invoice.date, paymentDate: payment.date.slice(0, 10), amount: payment.amount, method: payment.method, client: invoice.client, unit: invoice.unit, isAdvance: payment.date.slice(0, 10) > invoice.date }));
      return;
    }
    if (invoice.paid > 0) entries.push({ id: `${invoice.id}-legacy-payment`, invoiceId: invoice.id, invoiceNumber: invoice.id, invoiceDate: invoice.date, paymentDate: invoice.date, amount: invoice.paid, method: 'Non renseigné', client: invoice.client, unit: invoice.unit, isAdvance: false });
  });
  return entries.sort((a, b) => b.paymentDate.localeCompare(a.paymentDate));
}
