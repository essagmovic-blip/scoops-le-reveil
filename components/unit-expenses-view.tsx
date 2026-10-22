'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Check, Download, Plus, WalletCards } from 'lucide-react';
import { formatDate, formatFCFA } from '@/lib/format';
import { DateRangePicker } from '@/components/date-range-picker';
import { Modal, SectionHeading, StatCard } from '@/components/ui';
import { FARM_STORAGE_KEYS, readLocal, writeLocal } from '@/lib/farm-storage';

type UnitExpense = { id: string; unit: string; date: string; label: string; category: string; amount: number; method: string; reference: string };

export function UnitExpensesView({ unitId = 'provenderie' }: { unitId?: string }) {
  const unitName = unitId === 'provenderie' ? 'Provenderie' : unitId === 'bio' ? 'Produits bio' : unitId === 'pressoir' ? 'Pressoir à huile' : unitId === 'stocks' ? 'Magasin central' : unitId === 'chevrerie' ? 'Chèvrerie' : 'Ferme de poulets bio';
  const [expenses, setExpenses] = useState<UnitExpense[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [from, setFrom] = useState('2026-08-01');
  const [to, setTo] = useState('2026-08-13');
  const [open, setOpen] = useState(false);
  const [feedback, setFeedback] = useState('');

  useEffect(() => {
    const all = readLocal(FARM_STORAGE_KEYS.unitExpenses, [] as UnitExpense[]);
    setExpenses(all.filter((expense) => expense.unit === unitId));
    setHydrated(true);
  }, [unitId]);
  useEffect(() => {
    if (!hydrated) return;
    const all = readLocal(FARM_STORAGE_KEYS.unitExpenses, [] as UnitExpense[]).filter((expense) => expense.unit !== unitId);
    writeLocal(FARM_STORAGE_KEYS.unitExpenses, [...all, ...expenses]);
  }, [expenses, hydrated, unitId]);

  const visible = useMemo(() => expenses.filter((expense) => expense.date >= from && expense.date <= to), [expenses, from, to]);
  const total = visible.reduce((sum, expense) => sum + expense.amount, 0);
  const categories = [...new Set(visible.map((expense) => expense.category))];

  function notify(message: string) { setFeedback(message); window.setTimeout(() => setFeedback(''), 3500); }
  function saveExpense(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const expense: UnitExpense = { id: `DEP-${unitId.toUpperCase()}-${Date.now()}`, unit: unitId, date: String(form.get('date') ?? '2026-08-13'), label: String(form.get('label') ?? '').trim(), category: String(form.get('category') ?? 'Autre'), amount: Number(form.get('amount') ?? 0), method: String(form.get('method') ?? 'Espèces'), reference: String(form.get('reference') ?? '').trim() };
    if (!expense.label || expense.amount <= 0) return;
    setExpenses((current) => [expense, ...current]);
    setOpen(false);
    notify(`La dépense de ${unitName} a été enregistrée.`);
  }
  function exportExpenses() {
    const csv = ['SCOOPS LE REVEIL', `Dépenses — ${unitName}`, `Période;${from};${to}`, '', 'Référence;Date;Libellé;Catégorie;Mode;Montant', ...visible.map((expense) => [expense.reference, expense.date, expense.label, expense.category, expense.method, expense.amount].join(';'))].join('\n');
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8' }));
    link.download = `depenses-${unitId}-${from}-${to}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
    notify('Le journal des dépenses a été exporté.');
  }

  return <div className="fade-in space-y-7"><div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between"><div><Link href={`/dashboard/${unitId}`} className="mb-4 inline-flex items-center gap-2 text-[11px] font-bold text-[#6c8176] hover:text-forest"><ArrowLeft size={14} /> Retour au dashboard {unitName.toLowerCase()}</Link><p className="eyebrow mb-2">{unitName} · Finance</p><h1 className="page-title">Dépenses de la {unitName.toLowerCase()}</h1><p className="muted mt-2 text-[13px]">Les dépenses sont propres à l’unité active et réutilisables dans la comptabilité.</p></div><div className="flex flex-wrap gap-2"><DateRangePicker from={from} to={to} onApply={(nextFrom, nextTo) => { setFrom(nextFrom); setTo(nextTo); }} /><button className="btn-secondary" onClick={exportExpenses}><Download size={15} /> Exporter</button><button className="btn-primary" onClick={() => setOpen(true)}><Plus size={16} /> Nouvelle dépense</button></div></div>{feedback && <div className="flex items-center gap-2 rounded-xl border border-[#cde8c7] bg-[#effaeb] px-4 py-3 text-[12px] font-semibold text-[#4d8f51]"><Check size={14} />{feedback}</div>}<div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><StatCard label={`Dépenses · ${from.split('-').reverse().join('/')} — ${to.split('-').reverse().join('/')}`} value={total} change={`${visible.length} écriture(s)`} detail={unitName} icon={WalletCards} tone="orange" /><StatCard label="Catégories" value={String(categories.length)} change="période active" detail="charges classées" icon={WalletCards} tone="green" /><StatCard label="Plus grosse charge" value={visible.length ? Math.max(...visible.map((expense) => expense.amount)) : 0} change="période active" detail="dépense maximale" icon={WalletCards} tone="blue" /><StatCard label="Données" value={String(expenses.length)} change="enregistrées" detail="dans l’unité" icon={WalletCards} tone="purple" /></div><div className="surface overflow-hidden"><div className="border-b border-[#edf0eb] px-5 py-5 sm:px-6"><SectionHeading eyebrow="Journal financier" title="Dépenses de la période" description="Chaque charge reste rattachée à l’unité active." /></div><div className="table-scroll"><table className="w-full text-left"><thead><tr className="table-head"><th>Référence</th><th>Date</th><th>Libellé</th><th>Catégorie</th><th>Mode</th><th>Montant</th></tr></thead><tbody>{visible.length ? visible.map((expense) => <tr className="table-row table-line" key={expense.id}><td className="font-bold text-ink">{expense.reference || expense.id}</td><td>{formatDate(expense.date)}</td><td>{expense.label}</td><td>{expense.category}</td><td>{expense.method}</td><td className="font-bold text-ink">{formatFCFA(expense.amount)}</td></tr>) : <tr><td colSpan={6} className="px-6 py-14 text-center text-[11px] text-[#89968f]">Aucune dépense enregistrée dans cette période.</td></tr>}</tbody></table></div></div><Modal open={open} onClose={() => setOpen(false)} title={`Nouvelle dépense · ${unitName}`}><form onSubmit={saveExpense} className="space-y-5"><label className="block"><span className="field-label">Libellé</span><input name="label" className="input-base" placeholder="Ex. Achat de maïs ou électricité" required /></label><div className="grid gap-4 sm:grid-cols-2"><label className="block"><span className="field-label">Montant (FCFA)</span><input name="amount" type="number" min="1" className="input-base" placeholder="0" required /></label><label className="block"><span className="field-label">Date</span><input name="date" type="date" defaultValue="2026-08-13" className="input-base" required /></label><label className="block"><span className="field-label">Catégorie</span><input name="category" className="input-base" placeholder="Matières premières, énergie..." required /></label><label className="block"><span className="field-label">Mode de paiement</span><select name="method" className="input-base"><option>Espèces</option><option>Mobile Money</option><option>Virement bancaire</option><option>Chèque</option></select></label></div><label className="block"><span className="field-label">Référence / justificatif</span><input name="reference" className="input-base" placeholder="Numéro de reçu ou facture fournisseur" /></label><div className="flex justify-end gap-2"><button type="button" className="btn-secondary" onClick={() => setOpen(false)}>Annuler</button><button className="btn-primary" type="submit"><Check size={15} /> Enregistrer</button></div></form></Modal></div>;
}
