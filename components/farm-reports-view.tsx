'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { BarChart3, Check, Download, FileBarChart, PawPrint, Receipt, TrendingUp, Wheat } from 'lucide-react';
import type { poultryBuildings, poultryLots } from '@/lib/data';
import { formatFCFA, formatNumber } from '@/lib/format';
import { MiniProgress, SectionHeading, StatCard } from '@/components/ui';
import { DateRangePicker } from '@/components/date-range-picker';
import { FARM_STORAGE_KEYS, readLocal, subscribeToFarmData } from '@/lib/farm-storage';
import { loadFarmSnapshot } from '@/lib/farm-calculations';
import type { Invoice } from '@/lib/data';
import { LogisticsSummary } from '@/components/logistics-summary';
import { syncPoultryDailyFollowUps, type PoultryAutomaticDailyRecord } from '@/lib/poultry-daily-automation';
import { DailyTasksReport } from '@/components/daily-tasks-report';
import { PoultryBuilding24hReport } from '@/components/poultry-building-24h-report';

function inRange(date: string, from: string, to: string) { return date >= from && date <= to; }

export function FarmReportsView() {
  const [from, setFrom] = useState('2026-08-01');
  const [to, setTo] = useState('2026-08-13');
  const [lots, setLots] = useState<typeof poultryLots>([]);
  const [records, setRecords] = useState<PoultryAutomaticDailyRecord[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [buildings, setBuildings] = useState<typeof poultryBuildings>([]);
  const [assignedBuildingIds, setAssignedBuildingIds] = useState<string[] | null>(null);
  const [accessReady, setAccessReady] = useState(false);

  useEffect(() => {
    const cookie = (name: string) => { const part = document.cookie.split('; ').find((item) => item.startsWith(`${name}=`)); return part ? decodeURIComponent(part.slice(name.length + 1)) : ''; };
    if (cookie('agroflux_is_admin') === '1') setAssignedBuildingIds(null);
    else {
      try { setAssignedBuildingIds(JSON.parse(cookie('agroflux_assigned_buildings') || '[]')); } catch { setAssignedBuildingIds([]); }
    }
    setAccessReady(true);
  }, []);

  useEffect(() => {
    const load = () => {
      const snapshot = loadFarmSnapshot();
      setLots(snapshot.lots);
      setBuildings(snapshot.buildings);
      setRecords(syncPoultryDailyFollowUps());
      const savedInvoices = readLocal(FARM_STORAGE_KEYS.invoices, [] as Invoice[]);
      setInvoices(savedInvoices.filter((invoice) => invoice.unit === 'poulets'));
    };
    load();
    return subscribeToFarmData([FARM_STORAGE_KEYS.lots, FARM_STORAGE_KEYS.buildings, FARM_STORAGE_KEYS.daily, FARM_STORAGE_KEYS.dailyTaskInstances, FARM_STORAGE_KEYS.dagoReports, FARM_STORAGE_KEYS.invoices], load);
  }, []);

  const buildingScopeActive = accessReady && assignedBuildingIds !== null && assignedBuildingIds.length > 0;
  const visibleBuildings = buildingScopeActive ? buildings.filter((building) => assignedBuildingIds?.includes(building.id)) : buildings;
  const visibleBuildingNames = new Set(visibleBuildings.map((building) => building.name));
  const visibleRecords = buildingScopeActive ? records.filter((record) => visibleBuildingNames.has(record.building)) : records;
  const visibleBatchIds = new Set([...visibleBuildings.map((building) => building.batch), ...visibleRecords.map((record) => record.batch)].filter((batch) => batch && batch !== '—'));
  const visibleLots = buildingScopeActive ? lots.filter((lot) => visibleBatchIds.has(lot.id)) : lots;
  const visibleInvoices = buildingScopeActive ? invoices.filter((invoice) => Boolean(invoice.building && visibleBuildingNames.has(invoice.building))) : invoices;
  const daily = useMemo(() => visibleRecords.filter((record) => inRange(record.date, from, to)), [visibleRecords, from, to]);
  const activeLots = visibleLots.filter((lot) => lot.status !== 'Terminé' && lot.status !== 'Archivée');
  const mortality = visibleLots.length ? visibleLots.reduce((sum, lot) => sum + Number(lot.mortality || 0), 0) / visibleLots.length : 0;
  const collected = visibleInvoices.reduce((sum, invoice) => sum + Number(invoice.paid || 0), 0);

  function exportReport() {
    const csv = ['SCOOPS LE REVEIL', 'Rapport ferme de poulets', `Période;${from};${to}`, '', 'Bande;Bâtiment;Date;Service;Morts réels;Morts attendus;Aliment kg;Eau L;Poids kg;Origine', ...daily.map((record) => [record.batch, record.building, record.date, record.shift ?? 'Non renseigné', record.deaths, record.expectedDeaths, record.feed, record.water, record.averageWeight, record.source === 'automatique' ? 'Automatique' : 'Manuel'].join(';'))].join('\n');
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8' }));
    link.download = `rapport-ferme-${from}-${to}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  return <div className="fade-in space-y-7"><div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between"><div><Link href="/dashboard/poulets" className="mb-4 inline-flex items-center gap-2 text-[11px] font-bold text-[#6c8176] hover:text-forest">← Retour au dashboard ferme</Link><p className="eyebrow mb-2">Ferme · Analyse</p><h1 className="page-title">Rapports de la ferme</h1><p className="muted mt-2 text-[13px]">Les rapports de cette page concernent uniquement les poulets de chair, leurs bâtiments et leurs résultats.</p></div><div className="flex flex-wrap gap-2"><DateRangePicker from={from} to={to} onApply={(nextFrom, nextTo) => { setFrom(nextFrom); setTo(nextTo); }} /><button className="btn-primary" onClick={exportReport}><Download size={15} /> Exporter la période</button></div></div><div className="rounded-xl border border-[#dcebdd] bg-[#f5faf2] px-4 py-3 text-[11px] font-semibold text-[#5b8f60]">Période active : {from.split('-').reverse().join('/')} — {to.split('-').reverse().join('/')} · {daily.length} suivi(s) enregistré(s)</div>{buildingScopeActive && <div className="rounded-xl border border-[#dce8db] bg-[#f5faf2] px-4 py-3 text-[11px] font-semibold text-[#5b8f60]">Périmètre attribué : <strong>{visibleBuildings.map((building) => building.name).join(' · ')}</strong>. Les autres bâtiments et bandes ne sont pas affichés.</div>}<LogisticsSummary unitId="poulets" from={from} to={to} /><PoultryBuilding24hReport buildings={visibleBuildings} /><DailyTasksReport unitId="poulets" buildingIds={buildingScopeActive ? assignedBuildingIds ?? undefined : undefined} /><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><StatCard label="Bandes actives" value={String(activeLots.length)} change={visibleLots.length ? 'données locales' : 'À créer'} detail="sur la ferme" icon={PawPrint} tone="green" /><StatCard label="Mortalité moyenne" value={`${mortality.toFixed(1).replace('.', ',')} %`} change={visibleLots.length ? 'calculée' : 'Aucune donnée'} detail="bandes enregistrées" icon={TrendingUp} tone="blue" /><StatCard label="Aliment consommé" value={`${formatNumber(daily.reduce((sum, record) => sum + Number(record.feed || 0), 0))} kg`} change="Période choisie" detail="suivi ferme" icon={Wheat} tone="orange" /><StatCard label="Paiements reçus" value={collected} change={visibleInvoices.length ? `${visibleInvoices.length} facture(s)` : 'Aucune facture'} detail="unité ferme" icon={Receipt} tone="purple" /></div><div className="grid gap-5 lg:grid-cols-[1.15fr_.85fr]"><div className="surface p-5 sm:p-6"><SectionHeading eyebrow="Zootechnie" title="Performance des bandes" description="Les indicateurs réels de la ferme par rapport aux données saisies." /><div className="mt-6 space-y-5"><ReportLine label="Effectif conservé" value={`${formatNumber(activeLots.reduce((sum, lot) => sum + Number(lot.alive || 0), 0))} sujets`} progress={visibleLots.length ? 100 : 0} color="green" /><ReportLine label="Poids moyen enregistré" value={visibleLots.length ? `${(visibleLots.reduce((sum, lot) => sum + Number(lot.weight || 0), 0) / visibleLots.length).toFixed(2).replace('.', ',')} kg` : 'Aucune donnée'} progress={visibleLots.length ? 100 : 0} color="blue" /><ReportLine label="Mortalité enregistrée" value={visibleLots.length ? `${mortality.toFixed(1).replace('.', ',')} %` : 'Aucune donnée'} progress={visibleLots.length ? Math.min(mortality / 5 * 100, 100) : 0} color="orange" /></div></div><div className="surface p-5 sm:p-6"><SectionHeading eyebrow="Clôture" title="Rapports disponibles" /><div className="mt-5 space-y-3"><ReportLink icon={FileBarChart} title="Clôture de bande" text={visibleLots.length ? 'Synthèse à partir des lots enregistrés' : 'Aucune bande à clôturer'} /><ReportLink icon={BarChart3} title="Suivi quotidien" text={`${daily.length} saisie(s) dans la période`} /><ReportLink icon={Receipt} title="Ventes de la ferme" text={visibleInvoices.length ? `${visibleInvoices.length} facture(s) enregistrée(s)` : 'Aucune facture enregistrée'} /></div></div></div><div className="surface overflow-hidden"><div className="flex items-center justify-between border-b border-[#edf0eb] px-5 py-5 sm:px-6"><SectionHeading eyebrow="Bandes" title="Comparatif rapide" /><span className="text-[10px] font-bold text-[#6d8175]">Période filtrée</span></div><div className="table-scroll"><table className="w-full text-left"><thead><tr className="table-head"><th>Bande</th><th>Effectif</th><th>Âge</th><th>Poids moyen</th><th>Mortalité</th><th>Valeur encaissée</th></tr></thead><tbody>{activeLots.length ? activeLots.map((lot) => <tr className="table-row table-line" key={lot.id}><td><p className="font-bold text-ink">{lot.id}</p><p className="mt-1 text-[10px] text-[#9aa59f]">{lot.name}</p></td><td>{formatNumber(lot.alive)}</td><td>J{lot.age}</td><td>{Number(lot.weight || 0).toFixed(2).replace('.', ',')} kg</td><td className="font-bold text-[#5b9d5b]">{Number(lot.mortality || 0).toFixed(1).replace('.', ',')} %</td><td>{formatFCFA(visibleInvoices.filter((invoice) => invoice.building && lot.name.includes(invoice.building)).reduce((sum, invoice) => sum + Number(invoice.paid || 0), 0), true)}</td></tr>) : <tr><td colSpan={6} className="px-6 py-12 text-center text-[11px] text-[#89968f]">Aucune bande enregistrée.</td></tr>}</tbody></table></div></div></div>;
}
function ReportLine({ label, value, progress, color }: { label: string; value: string; progress: number; color: 'green' | 'blue' | 'orange' }) { return <div><div className="mb-2 flex items-center justify-between"><span className="text-[11px] font-semibold text-[#718078]">{label}</span><strong className="text-[12px] text-ink">{value}</strong></div><MiniProgress value={progress} color={color} /></div>; }
function ReportLink({ icon: Icon, title, text }: { icon: typeof FileBarChart; title: string; text: string }) { return <div className="flex w-full items-center gap-3 rounded-xl border border-[#edf0eb] p-4 text-left"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#edf8ea] text-[#5c9d5a]"><Icon size={16} /></span><span className="min-w-0 flex-1"><span className="block text-[11px] font-bold text-ink">{title}</span><span className="mt-1 block text-[10px] text-[#89968f]">{text}</span></span><Check size={14} className="text-[#5a9d5b]" /></div>; }
