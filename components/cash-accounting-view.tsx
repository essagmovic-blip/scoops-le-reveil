'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowDownRight, ArrowUpRight, Banknote, CalendarDays, Check, ChevronDown, CircleDollarSign, Download, FileText, Plus, Receipt, Search, WalletCards } from 'lucide-react';
import type { Invoice, InvoiceStatus } from '@/lib/data';
import { formatDate, formatFCFA } from '@/lib/format';
import { Modal, SectionHeading, StatCard, ViewAll } from '@/components/ui';
import { StatusBadge } from '@/components/status-badge';
import { FARM_STORAGE_KEYS, readLocal, writeLocal } from '@/lib/farm-storage';

type CashEntry = { id: string; date: string; type: 'Encaissement' | 'Décaissement'; label: string; amount: number; method: string; invoice?: string; unit: string; destination?: 'Banque' | 'DG' | 'PDG' | 'Responsable' | 'Fournisseur' | 'Autre'; nature?: string; beneficiary?: string; proofReference?: string; proofType?: string };

function unitName(unitId: string) { return unitId === 'provenderie' ? 'Provenderie' : unitId === 'bio' ? 'Produits bio' : unitId === 'pressoir' ? 'Pressoir à huile' : unitId === 'stocks' ? 'Magasin central' : unitId === 'chevrerie' ? 'Chèvrerie' : 'Ferme de poulets bio'; }

export function CashAccountingView({ unitId = 'poulets' }: { unitId?: string }) {
  const [tab, setTab] = useState<'overview' | 'unpaid' | 'payments' | 'journal'>('overview');
  const [invoiceRows, setInvoiceRows] = useState<Invoice[]>([]);
  const [entries, setEntries] = useState<CashEntry[]>([]);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [entryOpen, setEntryOpen] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [query, setQuery] = useState('');
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    const load = () => {
      const storedInvoices = readLocal(FARM_STORAGE_KEYS.invoices, [] as Invoice[]);
      const storedEntries = readLocal(FARM_STORAGE_KEYS.cashEntries, [] as CashEntry[]);
      setInvoiceRows(storedInvoices.filter((invoice) => invoice.unit === unitId));
      setEntries(storedEntries.filter((entry) => entry.unit === unitId));
      setHydrated(true);
    };
    load();
  }, [unitId]);
  useEffect(() => {
    if (!hydrated) return;
    const all = readLocal(FARM_STORAGE_KEYS.invoices, [] as Invoice[]).filter((invoice) => invoice.unit !== unitId);
    writeLocal(FARM_STORAGE_KEYS.invoices, [...all, ...invoiceRows]);
  }, [invoiceRows, hydrated, unitId]);
  useEffect(() => {
    if (!hydrated) return;
    const all = readLocal(FARM_STORAGE_KEYS.cashEntries, [] as CashEntry[]).filter((entry) => entry.unit !== unitId);
    writeLocal(FARM_STORAGE_KEYS.cashEntries, [...all, ...entries]);
  }, [entries, hydrated, unitId]);

  const totalInvoiced = invoiceRows.reduce((sum, invoice) => sum + invoice.amount, 0);
  const totalCollected = invoiceRows.reduce((sum, invoice) => sum + invoice.paid, 0);
  const outstanding = totalInvoiced - totalCollected;
  const overdue = invoiceRows.filter((invoice) => invoice.status === 'En retard').reduce((sum, invoice) => sum + invoice.amount - invoice.paid, 0);
  const filteredInvoices = useMemo(() => invoiceRows.filter((invoice) => `${invoice.id} ${invoice.client}`.toLowerCase().includes(query.toLowerCase())), [invoiceRows, query]);
  const receipts = entries.filter((entry) => entry.type === 'Encaissement');
  const disbursements = entries.filter((entry) => entry.type === 'Décaissement');
  const cashIn = entries.reduce((sum, entry) => sum + (entry.type === 'Encaissement' ? entry.amount : 0), 0);
  const cashOut = entries.reduce((sum, entry) => sum + (entry.type === 'Décaissement' ? entry.amount : 0), 0);

  function notify(message: string) {
    setFeedback(message);
    window.setTimeout(() => setFeedback(''), 4000);
  }

  function recordPayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const invoiceId = String(form.get('invoice') ?? '');
    const amount = Number(form.get('amount') ?? 0);
    const method = String(form.get('method') ?? 'Espèces');
    const date = String(form.get('date') ?? '2026-08-12');
    const invoice = invoiceRows.find((item) => item.id === invoiceId);
    if (!invoice || amount <= 0) return;
    const balance = invoice.amount - invoice.paid;
    if (amount > balance) {
      notify(`Le montant ne peut pas dépasser le solde de ${formatFCFA(balance)}.`);
      return;
    }
    const paid = invoice.paid + amount;
    const status: InvoiceStatus = paid >= invoice.amount ? 'Payée' : 'Partiellement payée';
    setInvoiceRows((current) => current.map((item) => item.id === invoiceId ? { ...item, paid, status } : item));
    setEntries((current) => [{ id: `ENC-${Date.now()}`, date, type: 'Encaissement', label: `${invoice.client} · versement`, amount, method, invoice: invoice.id, unit: invoice.unit }, ...current]);
    setPaymentOpen(false);
    notify(`${formatFCFA(amount)} enregistré sur ${invoice.id}. Nouveau statut : ${status}.`);
  }

  function exportJournal() {
    const rows = ['SCOOPS LE REVEIL', `Journal de caisse — ${unitName(unitId)}`, '', 'Date;Type;Libellé;Destination;Bénéficiaire;Justificatif;Nature;Mode;Montant', ...entries.map((entry) => [entry.date, entry.type, entry.label, entry.destination ?? '', entry.beneficiary ?? '', `${entry.proofType ?? ''} ${entry.proofReference ?? ''}`.trim(), entry.nature ?? '', entry.method, entry.type === 'Décaissement' ? -entry.amount : entry.amount].join(';'))].join('\n');
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([`\ufeff${rows}`], { type: 'text/csv;charset=utf-8' }));
    link.download = `journal-caisse-${unitId}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
    notify('Le journal de caisse a été exporté.');
  }

  function createEntry(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const type = String(form.get('type') ?? 'Décaissement') as CashEntry['type'];
    const amount = Number(form.get('amount') ?? 0);
    if (amount <= 0) return;
    const destination = String(form.get('destination') ?? 'Autre') as CashEntry['destination'];
    const nature = String(form.get('nature') ?? 'Dépense ferme');
    const beneficiary = String(form.get('beneficiary') ?? '').trim();
    const proofReference = String(form.get('proofReference') ?? '').trim();
    const proofType = String(form.get('proofType') ?? '').trim();
    const entry: CashEntry = { id: `${type === 'Encaissement' ? 'ENC' : 'DEC'}-${Date.now()}`, date: String(form.get('date') ?? '2026-08-13'), type, label: String(form.get('label') ?? 'Écriture caisse'), amount, method: String(form.get('method') ?? 'Espèces'), destination, nature, beneficiary, proofReference, proofType, unit: unitId };
    setEntries((current) => [entry, ...current]);
    setEntryOpen(false);
    notify(`${type} de ${formatFCFA(amount)} vers ${destination} enregistré dans le journal.`);
  }

  return <div className="fade-in space-y-7"><div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between"><div><p className="eyebrow mb-2">Gestion financière · {unitName(unitId)}</p><h1 className="page-title">Caisse & comptabilité</h1><p className="muted mt-2 max-w-2xl text-[13px] leading-5">Suivez les encaissements, les versements partiels, les factures impayées et les décaissements de l’unité active.</p></div><div className="flex flex-wrap gap-2"><button className="btn-secondary" onClick={exportJournal}><Download size={15} /> Exporter le journal</button><button className="btn-secondary" onClick={() => setEntryOpen(true)}><ArrowDownRight size={15} /> Nouvelle sortie caisse</button><button className="btn-primary" onClick={() => setPaymentOpen(true)}><Plus size={16} /> Enregistrer un versement client</button></div></div>{feedback && <div className="flex items-start gap-2 rounded-xl border border-[#cde8c7] bg-[#effaeb] px-4 py-3 text-[12px] font-semibold leading-5 text-[#4d8f51]"><span className="mt-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-[#72bf70] text-white"><Check size={13} /></span>{feedback}</div>}
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><StatCard label="Solde de caisse" value={cashIn - cashOut} change="données locales" detail="après mouvements" icon={WalletCards} tone="green" /><StatCard label="Total encaissé" value={totalCollected} change={`${totalInvoiced ? Math.round(totalCollected / totalInvoiced * 100) : 0} %`} detail="des factures" icon={ArrowUpRight} tone="blue" /><StatCard label="Factures impayées" value={outstanding} change={`${invoiceRows.filter((invoice) => invoice.paid < invoice.amount).length} factures`} detail="solde à recouvrer" trend="neutral" icon={Receipt} tone="orange" /><StatCard label="En retard" value={overdue} change="À relancer" detail="factures échues" trend="neutral" icon={CircleDollarSign} tone="purple" /></div>
    <div className="flex gap-1 overflow-x-auto rounded-xl bg-[#f0f5ee] p-1"><TabButton active={tab === 'overview'} onClick={() => setTab('overview')}>Vue d’ensemble</TabButton><TabButton active={tab === 'unpaid'} onClick={() => setTab('unpaid')}>Factures impayées</TabButton><TabButton active={tab === 'payments'} onClick={() => setTab('payments')}>Versements</TabButton><TabButton active={tab === 'journal'} onClick={() => setTab('journal')}>Journal de caisse</TabButton></div>
    {tab === 'overview' && <Overview totalInvoiced={totalInvoiced} totalCollected={totalCollected} outstanding={outstanding} cashIn={cashIn} cashOut={cashOut} invoices={invoiceRows} onPayment={() => setPaymentOpen(true)} journalHref={unitId === 'poulets' ? '/caisse/ferme' : `/caisse/${unitId}`} />}
    {tab === 'unpaid' && <UnpaidInvoices invoices={filteredInvoices.filter((invoice) => invoice.paid < invoice.amount)} query={query} setQuery={setQuery} onPayment={() => setPaymentOpen(true)} />}
    {tab === 'payments' && <PaymentsView entries={receipts} onExport={exportJournal} />}
    {tab === 'journal' && <JournalView entries={entries} onNewEntry={() => setEntryOpen(true)} />}
    <Modal open={paymentOpen} onClose={() => setPaymentOpen(false)} title="Enregistrer un versement"><form onSubmit={recordPayment} className="space-y-5"><p className="muted text-[12px] leading-5">Enregistrez un paiement total ou partiel. Le solde et le statut de la facture seront recalculés automatiquement.</p><label className="block"><span className="field-label">Facture</span><select name="invoice" className="input-base" required defaultValue={invoiceRows.find((invoice) => invoice.paid < invoice.amount)?.id}>{invoiceRows.filter((invoice) => invoice.paid < invoice.amount).map((invoice) => <option key={invoice.id} value={invoice.id}>{invoice.id} · {invoice.client} · solde {formatFCFA(invoice.amount - invoice.paid)}</option>)}</select></label><div className="grid gap-4 sm:grid-cols-2"><label className="block"><span className="field-label">Montant du versement</span><input name="amount" type="number" min="1" className="input-base" placeholder="250000" required /></label><label className="block"><span className="field-label">Date</span><input name="date" type="date" defaultValue="2026-08-12" className="input-base" required /></label></div><label className="block"><span className="field-label">Mode de paiement</span><select name="method" className="input-base"><option>Espèces</option><option>Mobile Money</option><option>Virement</option><option>Chèque</option></select></label><div className="flex justify-end gap-2"><button type="button" className="btn-secondary" onClick={() => setPaymentOpen(false)}>Annuler</button><button type="submit" className="btn-primary"><Check size={15} /> Enregistrer le versement</button></div></form></Modal>
    <Modal open={entryOpen} onClose={() => setEntryOpen(false)} title="Nouvelle écriture caisse"><form onSubmit={createEntry} className="space-y-5"><p className="muted text-[12px] leading-5">Enregistrez une entrée ou une sortie de caisse. Pour un client, préférez le bouton « Enregistrer un versement » afin de rattacher le paiement à une facture.</p><div className="grid gap-4 sm:grid-cols-2"><label className="block"><span className="field-label">Type</span><select name="type" className="input-base"><option>Décaissement</option><option>Encaissement</option></select></label><label className="block"><span className="field-label">Date</span><input name="date" type="date" defaultValue="2026-08-13" className="input-base" /></label><label className="block"><span className="field-label">Destination / bénéficiaire</span><select name="destination" className="input-base"><option>Banque</option><option>DG</option><option>PDG</option><option>Responsable</option><option>Fournisseur</option><option>Autre</option></select></label><label className="block"><span className="field-label">Nature de l’opération</span><select name="nature" className="input-base"><option>Dépôt en banque</option><option>Avance au DG</option><option>Avance au PDG</option><option>Remise au responsable</option><option>Remboursement de dépense</option><option>Règlement fournisseur</option><option>Dépense ferme</option><option>Autre</option></select></label></div><label className="block"><span className="field-label">Motif / libellé</span><input name="label" className="input-base" placeholder="Ex. Dépôt bancaire ou remise au responsable" required /></label><div className="grid gap-4 sm:grid-cols-2"><label className="block"><span className="field-label">Bénéficiaire / banque</span><input name="beneficiary" className="input-base" placeholder="Nom de la banque ou du responsable" required /></label><label className="block"><span className="field-label">Type de justificatif</span><select name="proofType" className="input-base"><option>Bordereau bancaire</option><option>Décharge signée</option><option>Reçu</option><option>Autre</option></select></label><label className="block sm:col-span-2"><span className="field-label">Numéro du justificatif</span><input name="proofReference" className="input-base" placeholder="N° reçu, bordereau ou décharge" required /></label></div><div className="grid gap-4 sm:grid-cols-2"><label className="block"><span className="field-label">Montant</span><input name="amount" type="number" min="1" className="input-base" placeholder="0" required /></label><label className="block"><span className="field-label">Mode de paiement</span><select name="method" className="input-base"><option>Espèces</option><option>Banque</option><option>Mobile Money</option><option>Virement bancaire</option></select></label></div><div className="flex justify-end gap-2"><button type="button" className="btn-secondary" onClick={() => setEntryOpen(false)}>Annuler</button><button type="submit" className="btn-primary"><Check size={15} /> Enregistrer l’écriture</button></div></form></Modal>
  </div>;
}

function Overview({ totalInvoiced, totalCollected, outstanding, cashIn, cashOut, invoices, onPayment, journalHref }: { totalInvoiced: number; totalCollected: number; outstanding: number; cashIn: number; cashOut: number; invoices: Invoice[]; onPayment: () => void; journalHref: string }) { return <div className="grid gap-5 xl:grid-cols-[1.2fr_.8fr]"><div className="surface p-5 sm:p-6"><SectionHeading eyebrow="Situation" title="Facturation et recouvrement" description="La direction voit ce qui est facturé, encaissé et encore dû." /><div className="mt-6 space-y-5"><MoneyBar label="Total facturé" value={formatFCFA(totalInvoiced)} progress={100} color="#6f9fe8" /><MoneyBar label="Total encaissé" value={formatFCFA(totalCollected)} progress={totalInvoiced ? totalCollected / totalInvoiced * 100 : 0} color="#71bd76" /><MoneyBar label="Reste à recouvrer" value={formatFCFA(outstanding)} progress={totalInvoiced ? outstanding / totalInvoiced * 100 : 0} color="#e9975c" /></div><button className="btn-primary mt-6" onClick={onPayment}><Plus size={15} /> Ajouter un versement</button></div><div className="surface p-5 sm:p-6"><SectionHeading eyebrow="À relancer" title="Prochains recouvrements" /><div className="mt-5 space-y-3">{invoices.filter((invoice) => invoice.paid < invoice.amount).slice(0, 3).map((invoice) => <div className="flex items-center gap-3 rounded-xl border border-[#edf0eb] p-3" key={invoice.id}><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#fff2e2] text-[#bd7737]"><Receipt size={16} /></span><div className="min-w-0 flex-1"><p className="truncate text-[11px] font-bold text-ink">{invoice.client}</p><p className="mt-1 text-[10px] text-[#8b9891]">{invoice.id} · reste {formatFCFA(invoice.amount - invoice.paid)}</p></div><StatusBadge status={invoice.status} /></div>)}</div></div><div className="surface overflow-hidden xl:col-span-2"><div className="flex items-center justify-between border-b border-[#edf0eb] px-5 py-5 sm:px-6"><SectionHeading eyebrow="Trésorerie" title="Mouvements du jour" /><ViewAll href={journalHref} label="Voir le journal" /></div><div className="grid gap-3 p-5 sm:grid-cols-3 sm:p-6"><CashSummary icon={ArrowUpRight} label="Encaissements" value={cashIn} tone="green" /><CashSummary icon={ArrowDownRight} label="Décaissements" value={cashOut} tone="orange" /><CashSummary icon={Banknote} label="Solde d’ouverture" value={0} tone="blue" /></div></div></div>; }

function UnpaidInvoices({ invoices, query, setQuery, onPayment }: { invoices: Invoice[]; query: string; setQuery: (value: string) => void; onPayment: () => void }) { return <div className="surface overflow-hidden"><div className="flex flex-col gap-4 border-b border-[#edf0eb] px-5 pb-4 pt-5 sm:px-6"><div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><SectionHeading eyebrow="Recouvrement" title="Factures impayées" description="Suivez les soldes et enregistrez les paiements partiels au moment de l’encaissement." /><div className="flex gap-2"><div className="relative min-w-[220px]"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9aa69f]" /><input value={query} onChange={(event) => setQuery(event.target.value)} className="input-base h-9 rounded-lg bg-[#fbfcfa] pl-9 text-[11px]" placeholder="Rechercher un client..." /></div><button className="btn-primary px-3 py-2 text-[11px]" onClick={onPayment}><Plus size={14} /> Versement</button></div></div></div><div className="table-scroll"><table className="w-full text-left"><thead><tr className="table-head"><th>Facture</th><th>Client</th><th>Émise le</th><th>Total</th><th>Déjà payé</th><th>Reste dû</th><th>Statut</th><th /></tr></thead><tbody>{invoices.map((invoice) => <tr className="table-row table-line" key={invoice.id}><td><Link href={`/factures/${invoice.id}?unit=${invoice.unit}`} className="font-bold text-ink hover:text-[#579b5b]">{invoice.id}</Link></td><td>{invoice.client}</td><td>{formatDate(invoice.date)}</td><td>{formatFCFA(invoice.amount)}</td><td className="font-semibold text-[#5b9d5b]">{formatFCFA(invoice.paid)}</td><td className="font-bold text-[#bd7737]">{formatFCFA(invoice.amount - invoice.paid)}</td><td><StatusBadge status={invoice.status} /></td><td><button className="btn-secondary px-2.5 py-1.5 text-[10px]" onClick={onPayment}>Encaisser</button></td></tr>)}</tbody></table></div></div>; }

function PaymentsView({ entries, onExport }: { entries: CashEntry[]; onExport: () => void }) { return <div className="surface overflow-hidden"><div className="flex items-center justify-between border-b border-[#edf0eb] px-5 py-5 sm:px-6"><SectionHeading eyebrow="Encaissements" title="Versements enregistrés" description="Chaque versement est rattaché à une facture et à une unité." /><button className="btn-secondary px-3 py-2 text-[11px]" onClick={onExport}><Download size={14} /> Exporter</button></div><div className="table-scroll"><table className="w-full text-left"><thead><tr className="table-head"><th>Date</th><th>Référence</th><th>Client</th><th>Facture</th><th>Mode</th><th>Montant</th></tr></thead><tbody>{entries.map((entry) => <tr className="table-row table-line" key={entry.id}><td>{formatDate(entry.date)}</td><td className="font-bold text-ink">{entry.id}</td><td>{entry.label}</td><td>{entry.invoice ?? '—'}</td><td><span className="rounded-full bg-[#f1f5ef] px-2 py-1 text-[10px] font-bold text-[#66766d]">{entry.method}</span></td><td className="font-bold text-[#5b9d5b]">{formatFCFA(entry.amount)}</td></tr>)}</tbody></table></div></div>; }

function JournalView({ entries, onNewEntry }: { entries: CashEntry[]; onNewEntry: () => void }) { return <div className="surface overflow-hidden"><div className="flex items-center justify-between border-b border-[#edf0eb] px-5 py-5 sm:px-6"><SectionHeading eyebrow="Trésorerie" title="Journal de caisse" description="Entrées et sorties de l’unité active." /><button className="btn-primary px-3 py-2 text-[11px]" onClick={onNewEntry}><Plus size={14} /> Nouvelle écriture</button></div><div className="table-scroll"><table className="w-full text-left"><thead><tr className="table-head"><th>Date</th><th>Type</th><th>Libellé</th><th>Destination</th><th>Bénéficiaire / justificatif</th><th>Nature</th><th>Mode</th><th>Montant</th></tr></thead><tbody>{entries.map((entry) => <tr className="table-row table-line" key={entry.id}><td>{formatDate(entry.date)}</td><td><span className={`inline-flex items-center gap-1.5 text-[10px] font-bold ${entry.type === 'Encaissement' ? 'text-[#5b9d5b]' : 'text-[#bd7737]'}`}>{entry.type === 'Encaissement' ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}{entry.type}</span></td><td>{entry.label}</td><td>{entry.destination ?? '—'}</td><td>{entry.beneficiary ?? '—'}{entry.proofReference ? ` · ${entry.proofReference}` : ''}</td><td>{entry.nature ?? '—'}</td><td>{entry.method}</td><td className={`font-bold ${entry.type === 'Encaissement' ? 'text-[#5b9d5b]' : 'text-[#bd7737]'}`}>{entry.type === 'Encaissement' ? '+' : '-'}{formatFCFA(entry.amount)}</td></tr>)}</tbody></table></div></div>; }

function MoneyBar({ label, value, progress, color }: { label: string; value: string; progress: number; color: string }) { return <div><div className="mb-2 flex items-center justify-between gap-3 text-[11px]"><span className="font-semibold text-[#77867e]">{label}</span><strong className="text-ink">{value}</strong></div><div className="h-2.5 overflow-hidden rounded-full bg-[#eff2ee]"><div className="h-full rounded-full" style={{ width: `${Math.min(progress, 100)}%`, background: color }} /></div></div>; }
function CashSummary({ icon: Icon, label, value, tone }: { icon: typeof ArrowUpRight; label: string; value: number; tone: 'green' | 'orange' | 'blue' }) { const classes = { green: 'bg-[#edf8ea] text-[#5b9d5b]', orange: 'bg-[#fff2e2] text-[#bd7737]', blue: 'bg-[#edf3ff] text-[#6385bd]' }; return <div className="flex items-center gap-3 rounded-2xl border border-[#edf0eb] p-4"><span className={`flex h-9 w-9 items-center justify-center rounded-xl ${classes[tone]}`}><Icon size={17} /></span><div><p className="text-[10px] font-semibold text-[#849188]">{label}</p><p className="mt-1 text-[16px] font-black tracking-[-.04em] text-ink">{formatFCFA(value)}</p></div></div>; }
function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) { return <button className={`whitespace-nowrap rounded-lg px-3 py-2 text-[11px] font-bold transition ${active ? 'bg-white text-forest shadow-sm' : 'text-[#87948c] hover:text-ink'}`} onClick={onClick}>{children}</button>; }
