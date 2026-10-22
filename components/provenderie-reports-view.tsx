'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowDownRight, ArrowLeft, ArrowUpRight, BarChart3, Download, Factory, Receipt, Wheat } from 'lucide-react';
import type { Invoice } from '@/lib/data';
import { extractPaymentEntries } from '@/lib/accounting';
import { formatDate, formatFCFA, formatNumber } from '@/lib/format';
import { DateRangePicker } from '@/components/date-range-picker';
import { MiniProgress, SectionHeading, StatCard } from '@/components/ui';
import { FARM_STORAGE_KEYS, readLocal, subscribeToFarmData } from '@/lib/farm-storage';
import { LogisticsSummary } from '@/components/logistics-summary';
import { DailyTasksReport } from '@/components/daily-tasks-report';

type FeedProductionReport = { id: string; date: string; recipeName: string; stage: string; form: string; quantity: number; cost: number; costPerKg: number };
type UnitExpenseReport = { id: string; unit: string; date: string; label: string; category: string; amount: number };

export function ProvenderieReportsView({ unitId = 'provenderie' }: { unitId?: 'provenderie' | 'bio' | 'pressoir' }) {
  const unitName = unitId === 'bio' ? 'Produits bio' : unitId === 'pressoir' ? 'Pressoir à huile' : 'Provenderie';
  const [from, setFrom] = useState('2026-08-01');
  const [to, setTo] = useState('2026-08-13');
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [expenses, setExpenses] = useState<UnitExpenseReport[]>([]);
  const [productions, setProductions] = useState<FeedProductionReport[]>([]);
  useEffect(() => {
    const load = () => {
      setInvoices(readLocal(FARM_STORAGE_KEYS.invoices, [] as Invoice[]).filter((invoice) => invoice.unit === unitId));
      setExpenses(readLocal(FARM_STORAGE_KEYS.unitExpenses, [] as UnitExpenseReport[]).filter((expense) => expense.unit === unitId));
      setProductions(readLocal(unitId === 'bio' ? FARM_STORAGE_KEYS.bioProductions : unitId === 'pressoir' ? FARM_STORAGE_KEYS.pressProductions : FARM_STORAGE_KEYS.feedProductions, [] as FeedProductionReport[]));
    };
    load();
    return subscribeToFarmData([FARM_STORAGE_KEYS.invoices, FARM_STORAGE_KEYS.unitExpenses, unitId === 'bio' ? FARM_STORAGE_KEYS.bioProductions : unitId === 'pressoir' ? FARM_STORAGE_KEYS.pressProductions : FARM_STORAGE_KEYS.feedProductions], load);
  }, [unitId]);
  const payments = useMemo(() => extractPaymentEntries(invoices, unitId).filter((payment) => payment.paymentDate >= from && payment.paymentDate <= to), [invoices, from, to, unitId]);
  const periodExpenses = expenses.filter((expense) => expense.date >= from && expense.date <= to);
  const periodProductions = productions.filter((production) => production.date >= from && production.date <= to);
  const revenue = payments.reduce((sum, payment) => sum + payment.amount, 0);
  const expenseTotal = periodExpenses.reduce((sum, expense) => sum + expense.amount, 0);
  const productionTotal = periodProductions.reduce((sum, production) => sum + production.quantity, 0);
  const productionCost = periodProductions.reduce((sum, production) => sum + production.cost, 0);
  function exportReport() {
    const rows = ['SCOOPS LE REVEIL', `Rapport ${unitName}`, `Période;${from};${to}`, '', 'Date;Type;Libellé;Montant', ...payments.map((payment) => [payment.paymentDate, 'Recette', `${payment.invoiceNumber} - ${payment.client}`, payment.amount].join(';')), ...periodExpenses.map((expense) => [expense.date, 'Dépense', expense.label, -expense.amount].join(';')), ...periodProductions.map((production) => [production.date, 'Production', `${production.recipeName} ${production.stage} ${production.form}`, -production.cost].join(';'))].join('\n');
    const link = document.createElement('a'); link.href = URL.createObjectURL(new Blob([`\ufeff${rows}`], { type: 'text/csv;charset=utf-8' })); link.download = `rapport-${unitId}-${from}-${to}.csv`; link.click(); URL.revokeObjectURL(link.href);
  }
  return <div className="fade-in space-y-7"><div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between"><div><Link href={`/dashboard/${unitId}`} className="mb-4 inline-flex items-center gap-2 text-[11px] font-bold text-[#6c8176] hover:text-forest"><ArrowLeft size={14} /> Retour au dashboard provenderie</Link><p className="eyebrow mb-2">{unitName} · Analyse</p><h1 className="page-title">Rapports de {unitName.toLowerCase()}</h1><p className="muted mt-2 text-[13px]">Production, coûts, recettes encaissées et dépenses de l’unité active.</p></div><div className="flex flex-wrap gap-2"><DateRangePicker from={from} to={to} onApply={(nextFrom, nextTo) => { setFrom(nextFrom); setTo(nextTo); }} /><button className="btn-primary" onClick={exportReport}><Download size={15} /> Exporter le rapport</button></div></div><LogisticsSummary unitId={unitId} from={from} to={to} /><DailyTasksReport unitId={unitId} /><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><StatCard label="Production" value={`${formatNumber(productionTotal)} kg`} change={`${periodProductions.length} lot(s)`} detail="période active" icon={Factory} tone="green" /><StatCard label="Coût de production" value={productionCost} change={productionTotal ? `${formatFCFA(productionCost / productionTotal)} / kg` : 'Aucune production'} detail="matières consommées" icon={Wheat} tone="orange" /><StatCard label="Recettes encaissées" value={revenue} change={`${payments.length} paiement(s)`} detail={`factures ${unitName.toLowerCase()}`} icon={ArrowUpRight} tone="blue" /><StatCard label="Dépenses" value={expenseTotal} change={`${periodExpenses.length} écriture(s)`} detail="unité provenderie" icon={ArrowDownRight} tone="purple" /></div><div className="grid gap-5 lg:grid-cols-[1.1fr_.9fr]"><div className="surface p-5 sm:p-6"><SectionHeading eyebrow="Finance" title="Solde de la période" description="Les recettes sont basées sur les paiements reçus." /><div className="mt-6 space-y-5"><ReportLine label="Recettes encaissées" value={formatFCFA(revenue)} progress={revenue ? 100 : 0} color="green" /><ReportLine label="Dépenses" value={formatFCFA(expenseTotal)} progress={revenue ? Math.min(expenseTotal / revenue * 100, 100) : 0} color="orange" /><ReportLine label="Solde recettes - dépenses" value={formatFCFA(revenue - expenseTotal)} progress={revenue ? Math.max(Math.min((revenue - expenseTotal) / revenue * 100, 100), 0) : 0} color="blue" /></div></div><div className="surface p-5 sm:p-6"><SectionHeading eyebrow="Productions" title="Répartition des fabrications" /><div className="mt-5 space-y-4">{periodProductions.length ? periodProductions.slice(0, 5).map((production) => <div key={production.id}><div className="mb-2 flex items-center justify-between text-[11px]"><span className="font-semibold text-[#66766d]">{production.recipeName} · {production.stage}</span><strong className="text-ink">{formatNumber(production.quantity)} kg</strong></div><MiniProgress value={productionTotal ? production.quantity / productionTotal * 100 : 0} color="green" /></div>) : <p className="py-8 text-center text-[11px] text-[#89968f]">Aucune production dans la période.</p>}</div></div></div><div className="surface overflow-hidden"><div className="border-b border-[#edf0eb] px-5 py-5 sm:px-6"><SectionHeading eyebrow="Journal" title="Synthèse des mouvements financiers" /></div><div className="table-scroll"><table className="w-full text-left"><thead><tr className="table-head"><th>Date</th><th>Type</th><th>Libellé</th><th>Montant</th></tr></thead><tbody>{[...payments.map((payment) => ({ date: payment.paymentDate, type: 'Recette', label: `${payment.invoiceNumber} · ${payment.client}`, amount: payment.amount })), ...periodExpenses.map((expense) => ({ date: expense.date, type: 'Dépense', label: expense.label, amount: -expense.amount }))].sort((a, b) => b.date.localeCompare(a.date)).map((row, index) => <tr className="table-row table-line" key={`${row.date}-${row.label}-${index}`}><td>{formatDate(row.date)}</td><td className={row.amount >= 0 ? 'font-bold text-[#5b9d5b]' : 'font-bold text-[#bd7737]'}>{row.type}</td><td>{row.label}</td><td className={row.amount >= 0 ? 'font-bold text-[#5b9d5b]' : 'font-bold text-[#bd7737]'}>{row.amount >= 0 ? '+' : ''}{formatFCFA(row.amount)}</td></tr>)}</tbody></table></div></div></div>;
}

function ReportLine({ label, value, progress, color }: { label: string; value: string; progress: number; color: 'green' | 'orange' | 'blue' }) { return <div><div className="mb-2 flex items-center justify-between text-[11px]"><span className="font-semibold text-[#718078]">{label}</span><strong className="text-ink">{value}</strong></div><MiniProgress value={progress} color={color} /></div>; }
