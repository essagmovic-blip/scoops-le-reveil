'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { Archive, BarChart3, Check, Filter, PawPrint, Receipt, Search, TrendingDown, TrendingUp, Wheat } from 'lucide-react';
import { formatDate, formatFCFA, formatNumber } from '@/lib/format';
import { DateRangePicker } from '@/components/date-range-picker';
import { MiniProgress, SectionHeading, StatCard } from '@/components/ui';
import { StatusBadge } from '@/components/status-badge';
import { FARM_STORAGE_KEYS, readLocal, subscribeToFarmData } from '@/lib/farm-storage';
import { loadFarmSnapshot, type BatchArchive } from '@/lib/farm-calculations';

type ComparisonRow = BatchArchive & { archived: boolean };

export function PoultryStatisticsView() {
  const [archives, setArchives] = useState<BatchArchive[]>([]);
  const [rows, setRows] = useState<ComparisonRow[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [query, setQuery] = useState('');
  const [from, setFrom] = useState('2026-01-01');
  const [to, setTo] = useState('2026-12-31');
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
      const buildingScopeActive = accessReady && assignedBuildingIds !== null && assignedBuildingIds.length > 0;
      const visibleBuildings = buildingScopeActive ? snapshot.buildings.filter((building) => assignedBuildingIds?.includes(building.id)) : snapshot.buildings;
      const visibleBuildingNames = new Set(visibleBuildings.map((building) => building.name));
      const visibleRecords = buildingScopeActive ? snapshot.daily.filter((record) => visibleBuildingNames.has(record.building)) : snapshot.daily;
      const visibleBatchIds = new Set([...visibleBuildings.map((building) => building.batch), ...visibleRecords.map((record) => record.batch)].filter((batch) => batch && batch !== '—'));
      const visibleLots = buildingScopeActive ? snapshot.lots.filter((lot) => visibleBatchIds.has(lot.id)) : snapshot.lots;
      const savedArchives = readLocal(FARM_STORAGE_KEYS.archives, [] as BatchArchive[]);
      const scopedArchives = buildingScopeActive ? savedArchives.filter((archive) => (archive.buildings ?? []).some((building) => visibleBuildingNames.has(building))) : savedArchives;
      const archiveRows: ComparisonRow[] = scopedArchives.map((archive) => ({ ...archive, archived: true }));
      const activeRows: ComparisonRow[] = visibleLots.filter((lot) => lot.status !== 'Terminé' && lot.status !== 'Archivée').map((lot) => {
        const records = visibleRecords.filter((record) => record.batch === lot.id);
        const deaths = records.reduce((sum, record) => sum + Number(record.deaths || 0), 0);
        const feedTotal = records.reduce((sum, record) => sum + Number(record.feed || 0), 0);
        const expectedFeedTotal = records.reduce((sum, record) => sum + Number(record.expectedFeed || 0), 0);
        const waterTotal = records.reduce((sum, record) => sum + Number(record.water || 0), 0);
        return { id: `active-${lot.id}`, batchId: lot.id, name: lot.name, closedAt: '', closedBy: '', initialCount: lot.initial, totalDeaths: deaths, totalSold: Math.max(lot.initial - lot.alive - deaths, 0), finalAlive: lot.alive, finalWeight: lot.weight, feedTotal, expectedFeedTotal, waterTotal, mortalityRate: lot.initial ? deaths / lot.initial * 100 : 0, salesTotal: 0, expensesTotal: 0, margin: 0, recordsCount: records.length, buildings: visibleBuildings.filter((building) => building.batch === lot.id).map((building) => building.name), archived: false };
      });
      const nextRows = [...archiveRows, ...activeRows];
      setArchives(scopedArchives);
      setRows(nextRows);
      setSelectedIds((current) => current.filter((id) => nextRows.some((row) => row.id === id)).length ? current.filter((id) => nextRows.some((row) => row.id === id)) : nextRows.slice(0, 3).map((row) => row.id));
    };
    load();
    return subscribeToFarmData([FARM_STORAGE_KEYS.archives, FARM_STORAGE_KEYS.lots, FARM_STORAGE_KEYS.buildings, FARM_STORAGE_KEYS.daily], load);
  }, [accessReady, assignedBuildingIds]);

  const visibleRows = useMemo(() => rows.filter((row) => row.name.toLowerCase().includes(query.toLowerCase()) && (!row.archived || (row.closedAt >= from && row.closedAt <= to))), [rows, query, from, to]);
  const selectedRows = visibleRows.filter((row) => selectedIds.includes(row.id));
  const archivedTotal = archives.length;
  const soldTotal = archives.reduce((sum, archive) => sum + archive.totalSold, 0);
  const revenueTotal = archives.reduce((sum, archive) => sum + archive.salesTotal, 0);
  const averageMortality = archives.length ? archives.reduce((sum, archive) => sum + archive.mortalityRate, 0) / archives.length : 0;

  function toggleRow(id: string) {
    setSelectedIds((current) => current.includes(id) ? current.filter((item) => item !== id) : current.length < 4 ? [...current, id] : current);
  }

  return <div className="fade-in space-y-7"><div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between"><div><Link href="/dashboard/poulets" className="mb-4 inline-flex items-center gap-2 text-[11px] font-bold text-[#6c8176] hover:text-forest">← Retour au dashboard ferme</Link><p className="eyebrow mb-2">Ferme · Analyse comparative</p><h1 className="page-title">Statistiques des bandes</h1><p className="muted mt-2 max-w-2xl text-[13px] leading-5">Comparez les bandes clôturées et les bandes encore en cours à partir des données réellement enregistrées.</p></div><DateRangePicker from={from} to={to} onApply={(nextFrom, nextTo) => { setFrom(nextFrom); setTo(nextTo); }} /></div><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><StatCard label="Bandes archivées" value={String(archivedTotal)} change={archivedTotal ? 'comparables' : 'Aucune archive'} detail="clôture officielle" icon={Archive} tone="green" /><StatCard label="Poulets vendus" value={formatNumber(soldTotal)} change="archives uniquement" detail="quantité cumulée" icon={PawPrint} tone="blue" /><StatCard label="Mortalité moyenne" value={`${averageMortality.toFixed(1).replace('.', ',')} %`} change={archivedTotal ? 'bandes archivées' : 'À calculer'} detail="comparaison historique" icon={TrendingDown} tone="orange" /><StatCard label="CA réalisé" value={revenueTotal} change="archives uniquement" detail="ventes enregistrées" icon={Receipt} tone="purple" /></div><div className="surface border border-[#dcebdd] bg-[#f5faf2] p-5 sm:p-6"><div className="flex items-start gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-[#5b9d5b]"><Archive size={18} /></span><div><h2 className="text-[14px] font-bold text-[#3e7546]">Quand une bande est-elle archivée ?</h2><p className="mt-1 text-[11px] leading-5 text-[#6d9071]">La clôture est manuelle et réservée à l’administrateur. Elle est possible lorsque l’effectif restant est nul : tous les sujets ont été vendus ou déclarés morts. La synthèse devient alors un snapshot de comparaison.</p></div></div></div><div className="surface overflow-hidden"><div className="flex flex-col gap-4 border-b border-[#edf0eb] px-5 pb-4 pt-5 sm:flex-row sm:items-center sm:justify-between sm:px-6"><SectionHeading eyebrow="Sélection comparative" title="Choisir les bandes à comparer" description="Les bandes en cours sont indiquées comme provisoires." /><div className="relative min-w-[220px]"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9aa69f]" /><input value={query} onChange={(event) => setQuery(event.target.value)} className="input-base h-9 rounded-lg bg-[#fbfcfa] pl-9 text-[11px]" placeholder="Rechercher une bande..." /></div></div><div className="table-scroll"><table className="w-full text-left"><thead><tr className="table-head"><th>Comparer</th><th>Bande</th><th>Statut</th><th>Effectif initial</th><th>Vendus</th><th>Mortalité</th><th>Aliment</th><th>CA</th></tr></thead><tbody>{visibleRows.length ? visibleRows.map((row) => <tr className="table-row table-line" key={row.id}><td><input type="checkbox" checked={selectedIds.includes(row.id)} onChange={() => toggleRow(row.id)} className="ml-6 h-3.5 w-3.5 accent-[#5eaa64]" aria-label={`Comparer ${row.name}`} /></td><td><p className="font-bold text-ink">{row.batchId}</p><p className="mt-1 text-[10px] text-[#9aa59f]">{row.name}</p></td><td><StatusBadge status={row.archived ? 'Archivée' : 'En cours'} /></td><td>{formatNumber(row.initialCount)}</td><td>{formatNumber(row.totalSold)}</td><td className="font-bold text-[#5b9d5b]">{row.mortalityRate.toFixed(1).replace('.', ',')} %</td><td>{formatNumber(row.feedTotal)} kg</td><td>{row.archived ? formatFCFA(row.salesTotal) : '—'}</td></tr>) : <tr><td colSpan={8} className="px-6 py-14 text-center text-[11px] text-[#89968f]">Aucune bande enregistrée dans cette période.</td></tr>}</tbody></table></div><div className="border-t border-[#edf0eb] px-5 py-3 text-[10px] text-[#89968f]">Sélectionnez jusqu’à 4 bandes pour les graphiques ci-dessous.</div></div><div className="grid gap-5 xl:grid-cols-2"><div className="surface p-5 sm:p-6"><SectionHeading eyebrow="Graphique 1" title="Mortalité par bande" description="Taux de mortalité cumulé sur l’effectif initial." /><div className="mt-6 space-y-4">{selectedRows.length ? selectedRows.map((row) => <div key={`mort-${row.id}`}><div className="mb-2 flex items-center justify-between gap-3 text-[11px]"><span className="truncate font-bold text-ink">{row.batchId}</span><strong className="text-[#bd7737]">{row.mortalityRate.toFixed(1).replace('.', ',')} %</strong></div><MiniProgress value={Math.min(row.mortalityRate / 5 * 100, 100)} color="orange" /></div>) : <EmptyChart text="Sélectionnez des bandes pour afficher la comparaison." />}</div></div><div className="surface p-5 sm:p-6"><SectionHeading eyebrow="Graphique 2" title="Aliment réel vs attendu" description="La consommation cumulée saisie dans les suivis." /><div className="mt-6 space-y-4">{selectedRows.length ? selectedRows.map((row) => <div key={`feed-${row.id}`}><div className="mb-2 flex items-center justify-between gap-3 text-[11px]"><span className="truncate font-bold text-ink">{row.batchId}</span><span className="text-[#6f7d75]">{formatNumber(row.feedTotal)} / {formatNumber(row.expectedFeedTotal)} kg</span></div><div className="h-2 overflow-hidden rounded-full bg-[#edf1eb]"><div className={`h-full rounded-full ${row.expectedFeedTotal && row.feedTotal > row.expectedFeedTotal ? 'bg-[#d9706b]' : 'bg-[#71bd76]'}`} style={{ width: `${row.expectedFeedTotal ? Math.min(row.feedTotal / row.expectedFeedTotal * 100, 100) : 0}%` }} /></div></div>) : <EmptyChart text="Sélectionnez des bandes pour afficher la comparaison." />}</div></div></div><div className="surface overflow-hidden"><div className="border-b border-[#edf0eb] px-5 py-5 sm:px-6"><SectionHeading eyebrow="Tableau de performance" title="Comparatif professionnel" description="Les archives sont figées ; les lignes en cours restent provisoires." /></div><div className="table-scroll"><table className="w-full text-left"><thead><tr className="table-head"><th>Bande</th><th>Clôture</th><th>Survie finale</th><th>Poids final</th><th>Eau</th><th>Dépenses liées</th><th>Marge</th></tr></thead><tbody>{selectedRows.length ? selectedRows.map((row) => <tr className="table-row table-line" key={`detail-${row.id}`}><td className="font-bold text-ink">{row.batchId}</td><td>{row.archived ? formatDate(row.closedAt) : 'En cours'}</td><td>{row.initialCount ? `${((row.finalAlive / row.initialCount) * 100).toFixed(1).replace('.', ',')} %` : '—'}</td><td>{Number(row.finalWeight || 0).toFixed(2).replace('.', ',')} kg</td><td>{formatNumber(row.waterTotal)} L</td><td>{row.archived ? formatFCFA(row.expensesTotal) : '—'}</td><td>{row.archived ? formatFCFA(row.margin) : '—'}</td></tr>) : <tr><td colSpan={7} className="px-6 py-12 text-center text-[11px] text-[#89968f]">Aucune sélection.</td></tr>}</tbody></table></div></div></div>;
}

function EmptyChart({ text }: { text: string }) { return <div className="flex min-h-[130px] items-center justify-center rounded-xl border border-dashed border-[#dce8db] bg-[#fbfcfa] px-5 text-center text-[11px] text-[#89968f]"><BarChart3 size={17} className="mr-2 text-[#a5b8a8]" />{text}</div>; }
