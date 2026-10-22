'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { ArrowDownUp, Check, ChevronDown, Download, FileText, Filter, MoreHorizontal, Plus, Search, SlidersHorizontal } from 'lucide-react';
import { invoices as initialInvoices, units, type Invoice, type InvoiceStatus } from '@/lib/data';
import { formatDate, formatFCFA } from '@/lib/format';
import { Modal, SectionHeading, ViewAll } from '@/components/ui';
import { StatusBadge } from '@/components/status-badge';
import { FARM_STORAGE_KEYS, subscribeToFarmData } from '@/lib/farm-storage';

const filters = ['Toutes', 'Poulets morts', 'Payées', 'Partiellement payées', 'Impayées', 'Envoyées', 'Brouillons', 'En retard'];

function invoiceUnitName(unitId?: string) { return unitId === 'provenderie' ? 'Provenderie' : unitId === 'bio' ? 'Produits bio' : unitId === 'pressoir' ? 'Pressoir à huile' : unitId === 'stocks' ? 'Magasin central' : unitId === 'chevrerie' ? 'Chèvrerie' : unitId === 'poulets' ? 'Ferme de poulets bio' : ''; }

function isDeadBirdInvoice(invoice: Invoice) {
  return invoice.unit === 'poulets' && (invoice.saleType === 'poulets-morts' || Number(invoice.deadBirdQuantity ?? 0) > 0 || Boolean(invoice.lines?.some((line) => line.description === 'Poulets morts')));
}

function deadBirdQuantityForInvoice(invoice: Invoice) {
  if (!isDeadBirdInvoice(invoice)) return 0;
  return Number(invoice.deadBirdQuantity ?? invoice.lines?.filter((line) => line.description === 'Poulets morts').reduce((sum, line) => sum + Number(line.quantity || 0), 0) ?? 0);
}

export function InvoicesView({ unitId }: { unitId?: string }) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('Toutes');
  const [period, setPeriod] = useState('Toutes les périodes');
  const [unitFilter, setUnitFilter] = useState('Toutes les unités');
  const [selected, setSelected] = useState<string[]>([]);
  // Une unité opérationnelle ne doit jamais récupérer les factures de démonstration.
  const [invoiceRows, setInvoiceRows] = useState(() => unitId ? [] : initialInvoices);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [actionInvoice, setActionInvoice] = useState<string | null>(null);
  const [minAmount, setMinAmount] = useState('');
  const [maxAmount, setMaxAmount] = useState('');
  useEffect(() => {
    const load = () => {
      const saved = window.localStorage.getItem(FARM_STORAGE_KEYS.invoices);
      try {
        const parsed = saved ? JSON.parse(saved) : [];
        if (Array.isArray(parsed)) {
          setInvoiceRows(unitId ? parsed.filter((invoice: { unit?: string }) => invoice.unit === unitId) : parsed.length ? parsed : initialInvoices);
          return;
        }
      } catch {
        // Une donnée locale corrompue ne doit pas faire réapparaître des données de démonstration dans la ferme.
      }
      setInvoiceRows(unitId ? [] : initialInvoices);
    };
    load();
    return subscribeToFarmData([FARM_STORAGE_KEYS.invoices], load);
  }, [unitId]);
  const scopedInvoices = useMemo(() => unitId ? invoiceRows.filter((invoice) => invoice.unit === unitId) : invoiceRows, [unitId, invoiceRows]);
  const totalInvoiced = scopedInvoices.reduce((sum, invoice) => sum + invoice.amount, 0);
  const totalCollected = scopedInvoices.reduce((sum, invoice) => sum + invoice.paid, 0);
  const totalOutstanding = totalInvoiced - totalCollected;
  const totalOverdue = scopedInvoices.filter((invoice) => invoice.status === 'En retard').reduce((sum, invoice) => sum + invoice.amount - invoice.paid, 0);
  const deadBirdInvoices = scopedInvoices.filter(isDeadBirdInvoice);
  const deadBirdQuantity = deadBirdInvoices.reduce((sum, invoice) => sum + deadBirdQuantityForInvoice(invoice), 0);
  const deadBirdRevenue = deadBirdInvoices.reduce((sum, invoice) => sum + invoice.amount, 0);
  const deadBirdOutstanding = deadBirdInvoices.reduce((sum, invoice) => sum + Math.max(invoice.amount - invoice.paid, 0), 0);

  const visible = useMemo(() => scopedInvoices.filter((invoice) => {
    const matchesQuery = `${invoice.id} ${invoice.client}`.toLowerCase().includes(query.toLowerCase());
    const matchesFilter = filter === 'Toutes' || (filter === 'Poulets morts' && isDeadBirdInvoice(invoice)) || (filter === 'Payées' && invoice.status === 'Payée') || (filter === 'Partiellement payées' && invoice.status === 'Partiellement payée') || (filter === 'Impayées' && (invoice.status === 'Impayée' || invoice.status === 'En retard')) || (filter === 'Envoyées' && invoice.status === 'Envoyée') || (filter === 'Brouillons' && invoice.status === 'Brouillon') || (filter === 'En retard' && invoice.status === 'En retard');
    const matchesUnit = Boolean(unitId) || unitFilter === 'Toutes les unités' || invoice.unit === units.find((unit) => unit.label === unitFilter)?.id;
    const matchesAmount = (!minAmount || invoice.amount >= Number(minAmount)) && (!maxAmount || invoice.amount <= Number(maxAmount));
    return matchesQuery && matchesFilter && matchesUnit && matchesAmount;
  }), [query, filter, unitFilter, unitId, scopedInvoices, minAmount, maxAmount]);

  const selectedAll = visible.length > 0 && visible.every((invoice) => selected.includes(invoice.id));
  const toggleAll = () => setSelected(selectedAll ? selected.filter((id) => !visible.some((invoice) => invoice.id === id)) : [...new Set([...selected, ...visible.map((invoice) => invoice.id)])]);

  return <div className="fade-in space-y-7">
    <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between"><div><p className="eyebrow mb-2">{unitId ? `${invoiceUnitName(unitId)} · Commerce` : 'Commerce · Suivi client'}</p><h1 className="page-title">{unitId ? `Ventes & factures ${invoiceUnitName(unitId).toLowerCase()}` : 'Ventes & factures'}</h1><p className="muted mt-2 text-[13px]">{unitId ? `Gérez les ventes et factures propres à l’unité ${invoiceUnitName(unitId).toLowerCase()}.` : 'Créez, suivez et encaissez vos ventes depuis un seul espace.'}</p></div><div className="flex flex-wrap gap-2"><button className="btn-secondary"><Download size={15} /> Exporter</button><Link href={unitId === 'poulets' ? '/factures/ferme/nouvelle' : unitId === 'provenderie' ? '/factures/provenderie/nouvelle' : unitId === 'bio' ? '/factures/bio/nouvelle' : unitId === 'pressoir' ? '/factures/pressoir/nouvelle' : unitId === 'stocks' ? '/factures/stocks/nouvelle' : unitId === 'chevrerie' ? '/factures/chevrerie/nouvelle' : '/factures/nouvelle'} className="btn-primary"><Plus size={16} /> Nouvelle facture</Link></div></div>

    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><SummaryCard label="Total facturé" value={formatFCFA(totalInvoiced, true)} hint={`${scopedInvoices.length} factures`} tone="green" /><SummaryCard label="Total encaissé" value={formatFCFA(totalCollected, true)} hint={`${totalInvoiced ? Math.round(totalCollected / totalInvoiced * 100) : 0} % du total`} tone="blue" /><SummaryCard label="En attente" value={formatFCFA(totalOutstanding, true)} hint={`${scopedInvoices.filter((invoice) => invoice.paid < invoice.amount).length} factures`} tone="orange" /><SummaryCard label="En retard" value={formatFCFA(totalOverdue, true)} hint={`${scopedInvoices.filter((invoice) => invoice.status === 'En retard').length} factures`} tone="red" /></div>

    {(!unitId || unitId === 'poulets') && <section className="surface border-[#e2d9f0] bg-[#fbf8ff] p-5 sm:p-6"><div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><SectionHeading eyebrow="Ventes spécifiques · Poulets morts" title="Statistiques des ventes de poulets morts" description="Les factures rattachées au stock séparé sont comptabilisées ici, sans être mélangées aux ventes de poulets vivants." /><span className="rounded-full bg-[#f1ecff] px-3 py-1.5 text-[10px] font-bold text-[#8066a6]">{deadBirdInvoices.length} facture{deadBirdInvoices.length > 1 ? 's' : ''}</span></div><div className="mt-5 grid gap-3 sm:grid-cols-3"><SalesStat label="Quantité vendue" value={`${deadBirdQuantity} poulet${deadBirdQuantity > 1 ? 's' : ''}`} detail="déduite du stock vendable" /><SalesStat label="Chiffre d’affaires" value={formatFCFA(deadBirdRevenue, true)} detail="factures poulets morts" /><SalesStat label="Reste à encaisser" value={formatFCFA(deadBirdOutstanding, true)} detail="sur ces factures" /></div></section>}

    <div className="surface overflow-hidden"><div className="flex flex-col gap-4 border-b border-[#edf0eb] px-5 pb-4 pt-5 sm:px-6"><div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between"><div className="flex gap-1 overflow-x-auto rounded-xl bg-[#f4f7f2] p-1">{filters.filter((item) => !unitId || unitId === 'poulets' || item !== 'Poulets morts').map((item) => <button key={item} onClick={() => setFilter(item)} className={`whitespace-nowrap rounded-lg px-3 py-2 text-[11px] font-bold transition ${filter === item ? 'bg-white text-forest shadow-sm' : 'text-[#87948c] hover:text-ink'}`}>{item}{item === 'En retard' && <span className="ml-1.5 rounded-full bg-[#fdebea] px-1.5 py-0.5 text-[9px] text-[#b85c5d]">2</span>}{item === 'Poulets morts' && <span className="ml-1.5 rounded-full bg-[#f1ecff] px-1.5 py-0.5 text-[9px] text-[#8066a6]">{deadBirdInvoices.length}</span>}</button>)}</div><div className="flex flex-wrap gap-2"><div className="relative min-w-[210px] flex-1 sm:flex-none"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9aa69f]" /><input value={query} onChange={(e) => setQuery(e.target.value)} className="input-base h-9 rounded-lg bg-[#fbfcfa] pl-9 text-[11px]" placeholder="Rechercher une facture..." /></div>{!unitId && <label className="relative"><select value={unitFilter} onChange={(e) => setUnitFilter(e.target.value)} className="input-base h-9 w-[158px] appearance-none rounded-lg bg-[#fbfcfa] pr-8 text-[11px] font-semibold"><option>Toutes les unités</option>{units.map((unit) => <option key={unit.id}>{unit.label}</option>)}</select><ChevronDown size={13} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#87958d]" /></label>}<label className="relative"><select value={period} onChange={(e) => setPeriod(e.target.value)} className="input-base h-9 w-[155px] appearance-none rounded-lg bg-[#fbfcfa] pr-8 text-[11px] font-semibold"><option>Toutes les périodes</option><option>Ce mois-ci</option><option>Le mois dernier</option></select><ChevronDown size={13} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#87958d]" /></label><button className="icon-btn h-9 w-9" onClick={() => setAdvancedOpen(true)} aria-label="Filtres avancés"><SlidersHorizontal size={15} /></button></div></div></div>
      {selected.length > 0 && <div className="flex items-center gap-3 border-b border-[#dcebdd] bg-[#f1faee] px-5 py-2.5 text-[11px] font-semibold text-[#4d8f53] sm:px-6"><span>{selected.length} sélectionnée(s)</span><button className="ml-auto text-[#b45858] hover:underline">Marquer comme envoyée</button><button className="text-[#687c70] hover:underline" onClick={() => setSelected([])}>Annuler</button></div>}
      <div className="table-scroll"><table className="w-full text-left"><thead><tr className="border-b border-[#edf0eb] text-[10px] uppercase tracking-[.12em] text-[#9ba59f]"><th className="w-10 px-5 py-3 sm:px-6"><input type="checkbox" checked={selectedAll} onChange={toggleAll} className="h-3.5 w-3.5 accent-[#5eaa64]" aria-label="Tout sélectionner" /></th><th className="px-2 py-3 font-bold">Référence</th><th className="px-3 py-3 font-bold">Client</th><th className="px-3 py-3 font-bold">Unité</th><th className="px-3 py-3 font-bold">Date</th><th className="px-3 py-3 font-bold">Montant</th><th className="px-3 py-3 font-bold">Payé</th><th className="px-3 py-3 font-bold">Reste</th><th className="px-3 py-3 font-bold">Statut</th><th className="px-5 py-3 sm:px-6" /></tr></thead><tbody>{visible.map((invoice) => <tr key={invoice.id} className="table-row border-b border-[#f0f3ef] last:border-0"><td className="px-5 py-4 sm:px-6"><input type="checkbox" checked={selected.includes(invoice.id)} onChange={() => setSelected((current) => current.includes(invoice.id) ? current.filter((id) => id !== invoice.id) : [...current, invoice.id])} className="h-3.5 w-3.5 accent-[#5eaa64]" /></td><td className="px-2 py-4"><Link href={unitId ? `/factures/${invoice.id}?unit=${unitId}` : `/factures/${invoice.id}`} className="text-[12px] font-bold text-ink hover:text-[#4c9858]">{invoice.id}</Link><span className="mt-1 block text-[10px] text-[#a0aaa4]">{invoice.items} article{invoice.items > 1 ? 's' : ''}</span></td><td className="px-3 py-4"><p className="text-[12px] font-semibold text-ink">{invoice.client}</p><p className="mt-1 text-[10px] text-[#8d9992]">{invoice.email}</p></td><td className="px-3 py-4"><span className="rounded-full bg-[#f1f5ef] px-2 py-1 text-[10px] font-bold text-[#66766d]">{units.find((unit) => unit.id === invoice.unit)?.shortLabel}</span></td><td className="px-3 py-4 text-[11px] text-[#718078]">{formatDate(invoice.date)}</td><td className="px-3 py-4 text-[12px] font-bold text-ink">{formatFCFA(invoice.amount)}</td><td className="px-3 py-4 text-[11px] font-semibold text-[#5b9d5b]">{formatFCFA(invoice.paid)}</td><td className="px-3 py-4 text-[11px] font-bold text-[#bd7737]">{formatFCFA(invoice.amount - invoice.paid)}</td><td className="px-3 py-4"><StatusBadge status={invoice.status as InvoiceStatus} /></td><td className="px-5 py-4 sm:px-6"><button className="icon-btn h-8 w-8" onClick={() => setActionInvoice(invoice.id)} aria-label="Actions facture"><MoreHorizontal size={15} /></button></td></tr>)}</tbody></table></div>
      {visible.length === 0 && <div className="px-6 py-16 text-center"><FileText className="mx-auto text-[#b4c3b7]" size={28} /><p className="mt-3 text-[13px] font-bold text-ink">Aucune facture trouvée</p><p className="muted mt-1 text-[11px]">Essayez une autre recherche ou un autre filtre.</p></div>}
      <div className="flex flex-col gap-3 border-t border-[#edf0eb] px-5 py-4 text-[11px] text-[#8a9790] sm:flex-row sm:items-center sm:justify-between sm:px-6"><span>Affichage de <strong className="text-ink">{visible.length}</strong> facture{visible.length > 1 ? 's' : ''}</span><div className="flex items-center gap-1"><button className="icon-btn h-8 w-8" disabled><ChevronDown size={14} className="rotate-90" /></button><span className="flex h-8 min-w-8 items-center justify-center rounded-lg bg-[#edf8e9] px-2 font-bold text-[#4d9352]">1</span><button className="icon-btn h-8 w-8"><ChevronDown size={14} className="-rotate-90" /></button></div></div>
    </div>
    <Modal open={advancedOpen} onClose={() => setAdvancedOpen(false)} title="Filtres avancés"><div className="space-y-5"><p className="muted text-[12px] leading-5">Filtrez la liste selon le montant de la facture. Les autres filtres restent accessibles dans la barre principale.</p><div className="grid gap-4 sm:grid-cols-2"><label className="block"><span className="field-label">Montant minimum</span><input type="number" min="0" value={minAmount} onChange={(event) => setMinAmount(event.target.value)} className="input-base" placeholder="0 FCFA" /></label><label className="block"><span className="field-label">Montant maximum</span><input type="number" min="0" value={maxAmount} onChange={(event) => setMaxAmount(event.target.value)} className="input-base" placeholder="0 FCFA" /></label></div><div className="flex justify-end gap-2"><button className="btn-secondary" onClick={() => { setMinAmount(''); setMaxAmount(''); setAdvancedOpen(false); }}>Réinitialiser</button><button className="btn-primary" onClick={() => setAdvancedOpen(false)}><Check size={15} /> Appliquer</button></div></div></Modal>
    <Modal open={Boolean(actionInvoice)} onClose={() => setActionInvoice(null)} title="Actions sur la facture">{actionInvoice && <div className="space-y-3"><Link href={unitId ? `/factures/${actionInvoice}?unit=${unitId}` : `/factures/${actionInvoice}`} className="quick-action"><FileText size={15} /> Voir le détail <span>›</span></Link><Link href={unitId ? unitId === 'poulets' ? '/caisse/ferme' : `/caisse/${unitId}` : '/caisse'} className="quick-action"><CircleDollarSignIcon /> Enregistrer un versement <span>›</span></Link><button className="quick-action" onClick={() => setActionInvoice(null)}><Check size={15} /> Marquer comme payée <span>›</span></button><button className="quick-action danger" onClick={() => setActionInvoice(null)}><TrashIcon /> Fermer <span>›</span></button></div>}</Modal>
  </div>;
}

function CircleDollarSignIcon() { return <span className="text-[15px]">₣</span>; }
function TrashIcon() { return <span className="text-[15px]">×</span>; }

function SalesStat({ label, value, detail }: { label: string; value: string; detail: string }) {
  return <div className="rounded-2xl border border-[#e8e0f2] bg-white p-4"><p className="text-[10px] font-semibold text-[#849188]">{label}</p><p className="mt-2 text-[21px] font-black tracking-[-.05em] text-forest">{value}</p><p className="mt-1 text-[10px] text-[#8a789d]">{detail}</p></div>;
}

function SummaryCard({ label, value, hint, tone }: { label: string; value: string; hint: string; tone: 'green' | 'blue' | 'orange' | 'red' }) {
  const styles = { green: 'bg-[#eaf7e8] text-[#5a9f59]', blue: 'bg-[#edf3ff] text-[#6285bf]', orange: 'bg-[#fff2e2] text-[#be7839]', red: 'bg-[#fdeceb] text-[#bc5d5d]' };
  return <div className="surface p-5"><div className="flex items-center justify-between"><p className="text-[11px] font-semibold text-[#7d8a83]">{label}</p><span className={`h-2 w-2 rounded-full ${styles[tone].split(' ')[0]}`} /></div><p className="mt-3 text-[23px] font-black tracking-[-.055em] text-ink">{value}</p><p className={`mt-2 text-[10px] font-semibold ${styles[tone].split(' ')[1]}`}>{hint}</p></div>;
}
