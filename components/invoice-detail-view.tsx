'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';
import { ArrowLeft, Check, Edit3, Mail, MoreHorizontal, Printer, Receipt, Send, Trash2 } from 'lucide-react';
import { units, type Invoice, type InvoiceStatus } from '@/lib/data';
import { formatDate, formatFCFA } from '@/lib/format';
import { openInvoicePrint } from '@/lib/invoice-print';
import { Modal } from '@/components/ui';
import { StatusBadge } from '@/components/status-badge';
import { EmptyState } from '@/components/empty-state';
import { FARM_STORAGE_KEYS, readLocal, subscribeToFarmData, writeLocal } from '@/lib/farm-storage';

export function InvoiceDetailView({ id }: { id: string }) {
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [paidAmount, setPaidAmount] = useState(0);
  const [currentStatus, setCurrentStatus] = useState<InvoiceStatus>('Impayée');
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [paymentHistoryOpen, setPaymentHistoryOpen] = useState(false);
  const [paymentError, setPaymentError] = useState('');
  const [feedback, setFeedback] = useState('');
  const [paymentHistory, setPaymentHistory] = useState<Array<{ date: string; amount: number; method: string }>>([]);

  useEffect(() => {
    const load = () => {
      const stored = readLocal(FARM_STORAGE_KEYS.invoices, [] as Invoice[]);
      const current = stored.find((item) => item.id === id) ?? null;
      setInvoice(current);
      setPaidAmount(current?.paid ?? 0);
      setCurrentStatus(current?.status ?? 'Impayée');
      setPaymentHistory(current?.payments ?? (current && current.paid > 0 ? [{ date: current.date, amount: current.paid, method: 'Non renseigné' }] : []));
    };
    load();
    return subscribeToFarmData([FARM_STORAGE_KEYS.invoices], load);
  }, [id]);

  if (!invoice) {
    return <div className="fade-in space-y-6"><Link href="/factures/ferme" className="inline-flex items-center gap-2 text-[11px] font-bold text-[#6c8176] hover:text-forest"><ArrowLeft size={14} /> Retour aux factures</Link><EmptyState title="Facture introuvable" description="Cette facture n’existe pas dans les données locales de l’unité ferme." action={<Link href="/factures/ferme" className="btn-primary">Voir les factures</Link>} /></div>;
  }

  const remaining = invoice.amount - paidAmount;
  const detailLines = invoice.lines?.length ? invoice.lines.map((line) => ({ description: line.description, quantity: Number(line.quantity || 0), unit: line.unit || 'unité', price: Number(line.price ?? line.unitPrice ?? 0) })) : [
    { description: 'Poulet de chair vivant', quantity: invoice.items > 2 ? 250 : 180, unit: 'tête', price: 4500 },
    { description: invoice.items > 2 ? 'Aliment poulet croissance' : 'Huile de soja', quantity: invoice.items > 2 ? 420 : 85, unit: invoice.items > 2 ? 'kg' : 'L', price: invoice.items > 2 ? 575 : 1450 },
    ...(invoice.items > 2 ? [{ description: 'Tourteaux de soja', quantity: 115, unit: 'kg', price: 420 }] : []),
  ];

  function recordPayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!invoice) return;
    const form = new FormData(event.currentTarget);
    const amount = Number(form.get('amount') ?? 0);
    if (amount <= 0 || amount > remaining) {
      setPaymentError(`Le montant doit être compris entre 1 et ${formatFCFA(remaining)}.`);
      return;
    }
    const nextPaid = paidAmount + amount;
    setPaidAmount(nextPaid);
    setCurrentStatus(nextPaid >= invoice.amount ? 'Payée' : 'Partiellement payée');
    setPaymentHistory((current) => [...current, { date: String(form.get('date') ?? '2026-08-13'), amount, method: String(form.get('method') ?? 'Espèces') }]);
    setPaymentError('');
    setPaymentOpen(false);
    setFeedback(`Versement de ${formatFCFA(amount)} enregistré.`);
    window.setTimeout(() => setFeedback(''), 3500);
  }

  function updateStoredInvoice(paid: number, status: InvoiceStatus) {
    if (!invoice) return;
    const stored = readLocal(FARM_STORAGE_KEYS.invoices, [] as Invoice[]);
    const updated = stored.map((item) => item.id === invoice.id ? { ...item, paid, montant_paye: paid, remaining: invoice.amount - paid, solde_restant: invoice.amount - paid, status } : item);
    writeLocal(FARM_STORAGE_KEYS.invoices, updated);
  }

  function sendInvoice() {
    if (!invoice) return;
    window.open(`mailto:${invoice.email}?subject=Facture ${invoice.id} - SCOOPS LE REVEIL&body=Bonjour ${invoice.client}, veuillez trouver les informations de votre facture ${invoice.id}.`, '_blank');
    setFeedback('La fenêtre email a été ouverte.');
    window.setTimeout(() => setFeedback(''), 3500);
  }

  function markAsPaid() {
    if (!invoice) return;
    setPaidAmount(invoice.amount);
    setCurrentStatus('Payée');
    updateStoredInvoice(invoice.amount, 'Payée');
    setFeedback('La facture est maintenant marquée comme payée.');
    window.setTimeout(() => setFeedback(''), 3500);
  }

  function editInvoice() {
    if (!invoice) return;
    window.localStorage.setItem('agroflux-edit-invoice', JSON.stringify(invoice));
    window.location.assign(invoice.unit === 'provenderie' ? '/factures/provenderie/nouvelle' : invoice.unit === 'bio' ? '/factures/bio/nouvelle' : invoice.unit === 'pressoir' ? '/factures/pressoir/nouvelle' : invoice.unit === 'stocks' ? '/factures/stocks/nouvelle' : invoice.unit === 'chevrerie' ? '/factures/chevrerie/nouvelle' : invoice.unit === 'poulets' ? '/factures/ferme/nouvelle' : '/factures/nouvelle');
  }

  function deleteInvoice() {
    if (!invoice) return;
    if (!window.confirm(`Supprimer définitivement ${invoice.id} ?`)) return;
    const stored = readLocal(FARM_STORAGE_KEYS.invoices, [] as Invoice[]);
    writeLocal(FARM_STORAGE_KEYS.invoices, stored.filter((item) => item.id !== invoice.id));
    window.location.assign(invoice.unit === 'provenderie' ? '/factures/provenderie' : invoice.unit === 'bio' ? '/factures/bio' : invoice.unit === 'pressoir' ? '/factures/pressoir' : invoice.unit === 'stocks' ? '/factures/stocks' : invoice.unit === 'chevrerie' ? '/factures/chevrerie' : invoice.unit === 'poulets' ? '/factures/ferme' : '/factures');
  }

  function printInvoice() {
    if (!invoice) return;
    openInvoicePrint({ id: invoice.id, customer: invoice.client, unitLabel: units.find((unit) => unit.id === invoice.unit)?.label ?? invoice.unit, issueDate: formatDate(invoice.date), taxRate: 18, subtotal: Math.round(invoice.amount / 1.18), tax: invoice.amount - Math.round(invoice.amount / 1.18), total: invoice.amount, paid: paidAmount, remaining, status: currentStatus, paymentMethod: 'Non renseigné', lines: detailLines.map((line) => ({ description: line.description, quantity: line.quantity, unit: line.unit, unitPrice: line.price, total: line.quantity * line.price })) });
  }
  return <div className="fade-in mx-auto max-w-[1050px] space-y-6">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><Link href={invoice.unit === 'provenderie' ? '/factures/provenderie' : invoice.unit === 'bio' ? '/factures/bio' : invoice.unit === 'pressoir' ? '/factures/pressoir' : invoice.unit === 'stocks' ? '/factures/stocks' : invoice.unit === 'chevrerie' ? '/factures/chevrerie' : invoice.unit === 'poulets' ? '/factures/ferme' : '/factures'} className="mb-4 inline-flex items-center gap-2 text-[11px] font-bold text-[#6c8176] hover:text-forest"><ArrowLeft size={14} /> Retour aux factures</Link><p className="eyebrow mb-2">Commerce · Détail de la facture</p><div className="flex flex-wrap items-center gap-3"><h1 className="page-title">{invoice.id}</h1><StatusBadge status={currentStatus} /></div><p className="muted mt-2 text-[13px]">Créée le {formatDate(invoice.date)}</p></div><div className="flex flex-wrap gap-2"><button className="btn-secondary" onClick={printInvoice}><Printer size={15} /> Imprimer</button><button className="btn-secondary" onClick={editInvoice}><Edit3 size={15} /> Modifier</button><button className="btn-primary" onClick={sendInvoice}><Send size={15} /> Envoyer</button></div></div>
    {feedback && <div className="flex items-center gap-2 rounded-xl border border-[#cde8c7] bg-[#effaeb] px-4 py-3 text-[12px] font-semibold text-[#4d8f51]"><Check size={14} />{feedback}</div>}

    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
      <div className="surface overflow-hidden"><div className="flex flex-col gap-5 border-b border-[#edf0eb] p-6 sm:p-8 sm:flex-row sm:items-start sm:justify-between"><div><div className="mb-4 flex items-center gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-[14px] bg-[#a4eb91] text-forest"><Receipt size={21} /></span><div><p className="text-[18px] font-black tracking-[-.06em] text-forest">agro<span className="text-[#69a65d]">flux</span></p><p className="text-[9px] font-bold uppercase tracking-[.14em] text-[#87958d]">Gestion intégrée</p></div></div><p className="text-[13px] font-bold text-ink">SCOOPS LE REVEIL</p><p className="mt-1 text-[11px] leading-5 text-[#7b8981]">Nkolbisson, Yaoundé<br />Cameroun · +237 6 70 00 12 45</p></div><div className="sm:text-right"><p className="eyebrow">Facture</p><p className="mt-1 text-[19px] font-black tracking-[-.04em] text-ink">{invoice.id}</p><p className="mt-3 text-[11px] text-[#7b8981]">Date d’émission : <strong className="font-semibold text-ink">{formatDate(invoice.date)}</strong></p><p className="mt-1 text-[11px] text-[#7b8981]">Unité : <strong className="font-semibold text-ink">{units.find((unit) => unit.id === invoice.unit)?.label}</strong></p></div></div><div className="bg-[#fbfcfa] px-6 py-5 sm:px-8"><p className="eyebrow mb-2">Facturé à</p><p className="text-[14px] font-bold text-ink">{invoice.client}</p><p className="mt-1 text-[11px] text-[#7b8981]">{invoice.email}</p></div><div className="table-scroll px-6 py-5 sm:px-8"><table className="w-full min-w-[520px] text-left"><thead><tr className="border-b border-[#edf0eb] text-[10px] uppercase tracking-[.12em] text-[#9ba59f]"><th className="pb-3 font-bold">Description</th><th className="pb-3 text-right font-bold">Qté</th><th className="pb-3 text-right font-bold">Prix unitaire</th><th className="pb-3 text-right font-bold">Total</th></tr></thead><tbody>{detailLines.map((line, index) => <InvoiceLine key={`${line.description}-${index}`} description={line.description} quantity={line.quantity} unit={line.unit} price={line.price} />)}</tbody></table></div><div className="flex justify-end border-t border-[#edf0eb] px-6 py-6 sm:px-8"><div className="w-full max-w-[280px] space-y-3 text-[12px]"><div className="flex justify-between text-[#7d8a83]"><span>Sous-total</span><span className="font-semibold text-ink">{formatFCFA(Math.round(invoice.amount / 1.18))}</span></div><div className="flex justify-between text-[#7d8a83]"><span>TVA (18 %)</span><span className="font-semibold text-ink">{formatFCFA(invoice.amount - Math.round(invoice.amount / 1.18))}</span></div><div className="my-3 h-px bg-[#e5ebe3]" /><div className="flex justify-between text-[14px] font-bold text-ink"><span>Total TTC</span><span className="text-[20px] font-black tracking-[-.04em] text-forest">{formatFCFA(invoice.amount)}</span></div></div></div><div className="flex flex-col gap-3 border-t border-[#edf0eb] bg-[#fbfcfa] px-6 py-5 text-[11px] text-[#78867e] sm:flex-row sm:items-center sm:justify-between sm:px-8"><span>Merci pour votre confiance.</span><span>Conditions : règlement à échéance.</span></div></div>
      <div className="space-y-5"><div className="surface p-5 sm:p-6"><div className="flex items-center justify-between"><h2 className="text-[16px] font-bold tracking-[-.03em]">Résumé paiement</h2><button className="icon-btn h-8 w-8" onClick={() => setPaymentHistoryOpen(true)} aria-label="Historique des paiements"><MoreHorizontal size={15} /></button></div><div className="mt-5 rounded-2xl bg-[#f4faf2] p-4"><p className="text-[10px] font-bold text-[#6f8873]">Montant restant</p><p className="mt-1 text-[23px] font-black tracking-[-.05em] text-forest">{formatFCFA(remaining)}</p><div className="mt-3 h-2 overflow-hidden rounded-full bg-white"><div className="h-full rounded-full bg-[#79bd70]" style={{ width: `${Math.max(paidAmount / invoice.amount * 100, 0)}%` }} /></div><p className="mt-2 text-[10px] text-[#759276]">{formatFCFA(paidAmount)} encaissés sur {formatFCFA(invoice.amount)}</p></div><button className="btn-primary mt-4 w-full" onClick={() => setPaymentOpen(true)}><CirclePlusIcon /> Enregistrer un paiement</button></div><div className="surface p-5 sm:p-6"><h2 className="text-[16px] font-bold tracking-[-.03em]">Actions rapides</h2><div className="mt-4 space-y-2"><button className="quick-action" onClick={sendInvoice}><Mail size={15} /> Envoyer par email <span>›</span></button><button className="quick-action" onClick={printInvoice}><Printer size={15} /> Imprimer la facture <span>›</span></button><button className="quick-action" onClick={markAsPaid}><Check size={15} /> Marquer comme payée <span>›</span></button><button className="quick-action danger" onClick={deleteInvoice}><Trash2 size={15} /> Supprimer la facture <span>›</span></button></div></div></div>
    </div>
    <Modal open={paymentHistoryOpen} onClose={() => setPaymentHistoryOpen(false)} title="Historique des paiements"><div className="space-y-3">{paymentHistory.length ? paymentHistory.map((payment, index) => <div key={`${payment.date}-${index}`} className="flex items-center gap-3 rounded-xl border border-[#edf0eb] p-3"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#edf8ea] text-[#5b9d5b]"><Check size={15} /></span><div className="min-w-0 flex-1"><p className="text-[11px] font-bold text-ink">{payment.date.slice(0, 10)} · {payment.method}</p><p className="mt-1 text-[10px] text-[#8b9891]">Versement enregistré sur {invoice.id}</p></div><strong className="text-[12px] font-bold text-[#5b9d5b]">{formatFCFA(payment.amount)}</strong></div>) : <p className="py-6 text-center text-[11px] text-[#89968f]">Aucun paiement enregistré.</p>}<button className="btn-primary w-full" onClick={() => setPaymentHistoryOpen(false)}>Fermer</button></div></Modal>
    <Modal open={paymentOpen} onClose={() => setPaymentOpen(false)} title="Enregistrer un paiement"><form onSubmit={recordPayment} className="space-y-5"><p className="muted text-[12px] leading-5">Le paiement sera enregistré sur cette facture. Le statut deviendra « Partiellement payée » ou « Payée ».</p><div className="rounded-xl bg-[#f4faf2] p-3"><p className="text-[10px] font-bold text-[#6f8873]">Solde disponible</p><p className="mt-1 text-[18px] font-black text-forest">{formatFCFA(remaining)}</p></div><label className="block"><span className="field-label">Montant du paiement</span><input name="amount" type="number" min="1" max={remaining} className="input-base" placeholder="250000" required /></label><div className="grid gap-4 sm:grid-cols-2"><label className="block"><span className="field-label">Date</span><input name="date" type="date" defaultValue="2026-08-12" className="input-base" /></label><label className="block"><span className="field-label">Mode de paiement</span><select name="method" className="input-base"><option>Espèces</option><option>Mobile Money</option><option>Virement bancaire</option><option>Chèque</option></select></label></div>{paymentError && <p className="rounded-lg bg-[#fff4f3] px-3 py-2 text-[11px] font-semibold text-[#b85b59]">{paymentError}</p>}<div className="flex justify-end gap-2"><button type="button" className="btn-secondary" onClick={() => setPaymentOpen(false)}>Annuler</button><button type="submit" className="btn-primary"><Check size={15} /> Enregistrer le paiement</button></div></form></Modal>
  </div>;
}

function InvoiceLine({ description, quantity, unit, price }: { description: string; quantity: number; unit: string; price: number }) {
  return <tr className="border-b border-[#f0f3ef] last:border-0"><td className="py-4"><p className="text-[12px] font-semibold text-ink">{description}</p><p className="mt-1 text-[10px] text-[#9aa59f]">Unité : {unit}</p></td><td className="py-4 text-right text-[12px] text-[#66766d]">{quantity}</td><td className="py-4 text-right text-[12px] text-[#66766d]">{formatFCFA(price)}</td><td className="py-4 text-right text-[12px] font-bold text-ink">{formatFCFA(quantity * price)}</td></tr>;
}

function CirclePlusIcon() { return <span className="flex h-4 w-4 items-center justify-center rounded-full border border-white/60 text-[14px] leading-none">+</span>; }
