'use client';

import Link from 'next/link';
import { useMemo, useState, type ElementType } from 'react';
import {
  Activity, AlertTriangle, ArrowUpRight, BarChart3, CalendarDays, ChevronDown, CircleDollarSign, FlaskConical,
  ClipboardCheck, MoreHorizontal, Package, PawPrint, Plus, Receipt, Sprout, TrendingUp, WalletCards,
  Wheat, Zap,
} from 'lucide-react';
import { activities, chartData, invoices, inventory, poultryLots } from '@/lib/data';
import { formatDate, formatFCFA, formatNumber } from '@/lib/format';
import { MiniProgress, SectionHeading, StatCard, ViewAll } from '@/components/ui';
import { PeriodSelector } from '@/components/period-selector';
import { StatusBadge } from '@/components/status-badge';

export function DashboardView() {
  const [range, setRange] = useState('6 derniers mois');
  const [period, setPeriod] = useState('Ce mois-ci');
  const periodInvoices = useMemo(() => invoices.filter((invoice) => isInvoiceInPeriod(invoice.date, period)), [period]);
  const billed = periodInvoices.reduce((sum, invoice) => sum + invoice.amount, 0);
  const collected = periodInvoices.reduce((sum, invoice) => sum + invoice.paid, 0);
  const pending = billed - collected;
  return <div className="fade-in space-y-7">
    <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <p className="eyebrow mb-2">Mardi 11 août 2026 · Yaoundé</p>
        <h1 className="page-title">Bonjour, MOVIC <span className="inline-block">👋</span></h1>
        <p className="muted mt-2 max-w-xl text-[13px] leading-5">Voici ce qui se passe dans votre exploitation aujourd’hui. Votre activité progresse bien.</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <PeriodSelector onChange={setPeriod} />
        <Link href="/factures/nouvelle" className="btn-primary"><Plus size={16} strokeWidth={2.5} /> Nouvelle facture</Link>
      </div>
    </div>

    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard label={`Total facturé · ${period}`} value={formatFCFA(billed, true)} change={`${periodInvoices.length} factures`} detail="dans la période" icon={CircleDollarSign} tone="green" />
      <StatCard label={`Reste à encaisser · ${period}`} value={formatFCFA(pending, true)} change={`${formatFCFA(collected, true)} encaissés`} detail="dans la période" trend="neutral" icon={WalletCards} tone="orange" />
      <StatCard label="Lots d’élevage actifs" value="04 lots" change="+1 lot" detail="ce mois-ci" icon={PawPrint} tone="blue" />
      <StatCard label="Alertes de stock" value="02 alertes" change="À surveiller" detail="maïs & vaccins" trend="neutral" icon={AlertTriangle} tone="purple" />
    </section>

    <section className="grid gap-5 xl:grid-cols-[minmax(0,1.55fr)_minmax(310px,.8fr)]">
      <div className="surface overflow-hidden p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div><p className="eyebrow mb-2">Performance financière</p><h2 className="text-[19px] font-semibold tracking-[-.035em]">Revenus & dépenses</h2><p className="muted mt-1 text-[12px]">Suivez l’évolution de votre activité sur la période.</p></div>
          <label className="relative"><span className="sr-only">Période</span><select value={range} onChange={(e) => setRange(e.target.value)} className="input-base h-9 w-[150px] appearance-none rounded-lg bg-[#fbfcf9] pr-8 text-[11px] font-semibold"><option>6 derniers mois</option><option>Cette année</option><option>12 derniers mois</option></select><ChevronDown size={13} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#86928b]" /></label>
        </div>
        <div className="mt-6 flex items-center gap-5 text-[11px] font-semibold"><span className="flex items-center gap-2"><i className="h-2 w-2 rounded-full bg-[#5ca663]" /> Revenus</span><span className="flex items-center gap-2 text-[#87928c]"><i className="h-2 w-2 rounded-full bg-[#d9e2da]" /> Dépenses</span><span className="ml-auto hidden items-center gap-1 text-[#4f9654] sm:flex"><TrendingUp size={14} /> +24,6 %</span></div>
        <div className="mt-5 flex h-[215px] gap-3">
          <div className="flex flex-col justify-between pb-5 pt-1 text-[10px] font-medium text-[#a0aaa4]"><span>15 M</span><span>10 M</span><span>5 M</span><span>0</span></div>
          <div className="relative min-w-0 flex-1">
            <div className="absolute inset-x-0 top-0 border-t border-dashed border-[#e8ede7]" /><div className="absolute inset-x-0 top-1/3 border-t border-dashed border-[#e8ede7]" /><div className="absolute inset-x-0 top-2/3 border-t border-dashed border-[#e8ede7]" /><div className="absolute inset-x-0 bottom-5 border-t border-[#e8ede7]" />
            <div className="absolute inset-0 bottom-5 flex items-end justify-around gap-2 px-1 sm:px-4">
              {chartData.map((item, index) => <div key={item.month} className="flex h-full flex-1 items-end justify-center gap-1.5 sm:gap-2.5">
                <div className="bar-rise w-2.5 rounded-t-[5px] bg-[#71bd76] sm:w-4" style={{ height: `${(item.income / 15) * 100}%`, animationDelay: `${index * 70}ms` }} title={`Revenus ${item.income} M`} />
                <div className="bar-rise w-2.5 rounded-t-[5px] bg-[#e1e9e2] sm:w-4" style={{ height: `${(item.expense / 15) * 100}%`, animationDelay: `${index * 70 + 90}ms` }} title={`Dépenses ${item.expense} M`} />
              </div>)}
            </div>
            <div className="absolute inset-x-0 bottom-0 flex justify-around px-1 text-[10px] font-medium text-[#9aa59f] sm:px-4">{chartData.map((item) => <span key={item.month}>{item.month}</span>)}</div>
          </div>
        </div>
      </div>

      <div className="surface overflow-hidden p-5 sm:p-6">
        <SectionHeading eyebrow="Opérations" title="Vue d’activité" action={<button className="icon-btn h-8 w-8"><MoreHorizontal size={16} /></button>} />
        <div className="mt-5 space-y-5">
          <div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#edf8ea] text-[#5b9e59]"><PawPrint size={18} /></span><div className="min-w-0 flex-1"><div className="flex justify-between gap-3 text-[12px] font-bold"><span>Poulets de chair</span><span>1 969</span></div><p className="muted mt-1 text-[10px]">animaux en élevage</p><div className="mt-2"><MiniProgress value={78} color="green" /></div></div></div>
          <div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#fff5e7] text-[#c27a3e]"><Wheat size={18} /></span><div className="min-w-0 flex-1"><div className="flex justify-between gap-3 text-[12px] font-bold"><span>Production aliments</span><span>4 200 kg</span></div><p className="muted mt-1 text-[10px]">fabriqués ce mois</p><div className="mt-2"><MiniProgress value={64} color="orange" /></div></div></div>
          <div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#eef3ff] text-[#5d80bd]"><Sprout size={18} /></span><div className="min-w-0 flex-1"><div className="flex justify-between gap-3 text-[12px] font-bold"><span>Cheptel caprin</span><span>24 têtes</span></div><p className="muted mt-1 text-[10px]">dont 4 naissances récentes</p><div className="mt-2"><MiniProgress value={48} color="blue" /></div></div></div>
          <div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#f1ecff] text-[#8b73b8]"><FlaskConical size={18} /></span><div className="min-w-0 flex-1"><div className="flex justify-between gap-3 text-[12px] font-bold"><span>Produits bio</span><span>950 kg/L</span></div><p className="muted mt-1 text-[10px]">fabriqués pour les poulets</p><div className="mt-2"><MiniProgress value={58} color="blue" /></div></div></div>
        </div>
        <Link href="/rapports" className="mt-5 flex items-center justify-center gap-2 rounded-xl border border-dashed border-[#cad8cc] py-2.5 text-[11px] font-bold text-[#5c8f61] transition hover:border-[#8fc68b] hover:bg-[#f7fbf5]"><BarChart3 size={14} /> Voir le rapport d’activité <ArrowUpRight size={14} /></Link>
      </div>
    </section>

    <section className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,.75fr)]">
      <div className="surface overflow-hidden">
        <div className="flex items-center justify-between border-b border-[#edf0eb] px-5 py-5 sm:px-6"><SectionHeading eyebrow="Commerce" title="Dernières factures" /><ViewAll href="/factures" /></div>
        <div className="table-scroll"><table className="w-full text-left"><thead><tr className="border-b border-[#edf0eb] text-[10px] uppercase tracking-[.12em] text-[#9aa49f]"><th className="px-5 py-3 font-bold sm:px-6">Facture</th><th className="hidden px-3 py-3 font-bold md:table-cell">Client</th><th className="px-3 py-3 font-bold">Date</th><th className="px-3 py-3 font-bold">Montant</th><th className="px-5 py-3 font-bold sm:px-6">Statut</th></tr></thead><tbody>{periodInvoices.slice(0, 4).map((invoice) => <tr key={invoice.id} className="table-row border-b border-[#f0f3ef] last:border-0"><td className="px-5 py-4 sm:px-6"><Link href={`/factures/${invoice.id}`} className="text-[12px] font-bold text-ink hover:text-[#4c9858]">{invoice.id}</Link><span className="mt-1 block text-[10px] text-[#a0aaa4] md:hidden">{invoice.client}</span></td><td className="hidden px-3 py-4 text-[12px] font-medium text-[#596a61] md:table-cell">{invoice.client}</td><td className="px-3 py-4 text-[11px] text-[#78857f]">{formatDate(invoice.date)}</td><td className="px-3 py-4 text-[12px] font-bold text-ink">{formatFCFA(invoice.amount, true)}</td><td className="px-5 py-4 sm:px-6"><StatusBadge status={invoice.status} /></td></tr>)}</tbody></table></div>
      </div>

      <div className="surface overflow-hidden">
        <div className="flex items-center justify-between border-b border-[#edf0eb] px-5 py-5"><SectionHeading eyebrow="À ne pas manquer" title="Activité récente" /><button className="icon-btn h-8 w-8"><MoreHorizontal size={16} /></button></div>
        <div className="divide-y divide-[#f0f3ef]">{activities.map((activity) => <div className="flex gap-3 px-5 py-4" key={activity.id}><ActivityIcon tone={activity.tone} type={activity.icon} /><div className="min-w-0 flex-1"><p className="text-[11px] font-bold text-ink">{activity.title}</p><p className="mt-0.5 truncate text-[10px] text-[#7b8981]">{activity.description}</p><p className="mt-1.5 text-[9px] font-medium text-[#a1aaa5]">{activity.time}</p></div></div>)}</div>
        <Link href="/rapports" className="flex items-center justify-center border-t border-[#edf0eb] py-3 text-[11px] font-bold text-[#5c8f61] hover:bg-[#fbfdf9]">Voir toute l’activité <ArrowUpRight size={13} className="ml-1" /></Link>
      </div>
    </section>

    <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(310px,.8fr)]">
      <div className="surface overflow-hidden p-5 sm:p-6">
        <SectionHeading eyebrow="Élevage" title="Lots en cours" action={<ViewAll href="/poulets" label="Gérer les lots" />} />
        <div className="mt-5 grid gap-3 sm:grid-cols-3">{poultryLots.map((lot) => <div key={lot.id} className="rounded-2xl border border-[#edf0eb] bg-[#fbfcfa] p-4 transition hover:border-[#cfe3cc] hover:bg-[#f7fbf5]"><div className="mb-4 flex items-start justify-between"><span className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ background: `${lot.color}44`, color: lot.color === '#f5cf67' ? '#a87916' : '#4e9b52' }}><PawPrint size={17} /></span><StatusBadge status={lot.status} /></div><p className="truncate text-[12px] font-bold text-ink">{lot.name}</p><p className="mt-1 text-[10px] text-[#8b9891]">{lot.id} · {lot.age ? `${lot.age} jours` : 'Cycle terminé'}</p><div className="mt-4 flex items-end justify-between"><div><p className="text-[19px] font-bold tracking-[-.05em] text-ink">{formatNumber(lot.alive)}</p><p className="text-[9px] text-[#8b9891]">animaux présents</p></div><div className="text-right"><p className="text-[12px] font-bold text-ink">{lot.weight.toFixed(2).replace('.', ',')} kg</p><p className="text-[9px] text-[#8b9891]">poids moyen</p></div></div><div className="mt-3"><MiniProgress value={lot.status === 'Terminé' ? 100 : lot.age / 56 * 100} color={lot.status === 'Prêt à vendre' ? 'orange' : 'green'} label="Cycle" right={`${Math.min(Math.round(lot.age / 56 * 100), 100)}%`} /></div></div>)}</div>
      </div>
      <div className="surface overflow-hidden p-5 sm:p-6"><SectionHeading eyebrow="Stocks" title="Alertes à traiter" action={<ViewAll href="/stocks" label="Voir le magasin" />} /><div className="mt-5 space-y-3"><StockAlert name="Maïs grain" quantity="420 kg" threshold="Seuil : 1 000 kg" tone="orange" /><StockAlert name="Vaccin Newcastle" quantity="18 flacons" threshold="Seuil : 24 flacons" tone="red" /><div className="mt-4 rounded-2xl bg-[#edf8e9] p-4"><div className="flex items-start gap-3"><div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white text-[#59a057]"><ClipboardCheck size={16} /></div><div><p className="text-[11px] font-bold text-[#3e7144]">Inventaire en attente</p><p className="mt-1 text-[10px] leading-4 text-[#6d9171]">Le prochain inventaire magasin est prévu vendredi 14 août.</p></div></div></div></div></div>
    </section>

    <div className="subtle-grid relative overflow-hidden rounded-[20px] bg-forest px-6 py-6 text-white sm:px-8"><div className="relative z-10 max-w-xl"><div className="mb-3 flex items-center gap-2 text-[#a4eb91]"><Zap size={16} fill="currentColor" /><span className="text-[10px] font-bold uppercase tracking-[.15em]">Conseil du jour</span></div><h2 className="text-[20px] font-bold tracking-[-.04em]">Gardez une longueur d’avance sur vos stocks.</h2><p className="mt-2 text-[12px] leading-5 text-[#b6cdbd]">Avec un seuil d’alerte bien configuré, vous évitez les ruptures et sécurisez la continuité de vos productions.</p><Link href="/stocks" className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[#a4eb91] px-3.5 py-2.5 text-[11px] font-bold text-forest transition hover:bg-[#baf1aa]">Configurer les alertes <ArrowUpRight size={14} /></Link></div><div className="absolute -right-12 -top-16 h-56 w-56 rounded-full border-[30px] border-[#a4eb91]/10" /><div className="absolute -bottom-24 right-28 h-44 w-44 rounded-full border-[20px] border-[#a4eb91]/10" /></div>
  </div>;
}

function isInvoiceInPeriod(date: string, period: string) {
  if (period === 'Ce mois-ci') return date.startsWith('2026-08');
  if (period === 'Le mois dernier') return date.startsWith('2026-07');
  if (period === '3 derniers mois') return date >= '2026-06-01' && date <= '2026-08-31';
  return date.startsWith('2026-');
}

function ActivityIcon({ tone, type }: { tone: string; type: string }) {
  const icons: Record<string, ElementType> = { package: Package, receipt: Receipt, alert: AlertTriangle, sprout: Sprout };
  const colors: Record<string, string> = { green: 'bg-[#edf8ea] text-[#5a9c58]', blue: 'bg-[#eef3ff] text-[#6687c1]', orange: 'bg-[#fff3e4] text-[#bd783c]', purple: 'bg-[#f1ecff] text-[#8b73b8]' };
  const Icon = icons[type] ?? Activity;
  return <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${colors[tone] ?? colors.green}`}><Icon size={15} /></span>;
}

function StockAlert({ name, quantity, threshold, tone }: { name: string; quantity: string; threshold: string; tone: 'orange' | 'red' }) {
  return <div className="flex items-center gap-3 rounded-xl border border-[#edf0eb] p-3"><span className={`flex h-9 w-9 items-center justify-center rounded-xl ${tone === 'red' ? 'bg-[#fdeceb] text-[#bd5c5c]' : 'bg-[#fff2e2] text-[#c27a3e]'}`}><AlertTriangle size={16} /></span><div className="min-w-0 flex-1"><p className="text-[11px] font-bold text-ink">{name}</p><p className="mt-1 text-[10px] text-[#8b9891]">{threshold}</p></div><span className={`text-right text-[11px] font-bold ${tone === 'red' ? 'text-[#bd5c5c]' : 'text-[#be7836]'}`}>{quantity}</span></div>;
}

