'use client';

import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CalendarDays, Check, Clock3, Download, Eye, HeartPulse, Search } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { syncPoultryDailyFollowUps, type PoultryAutomaticDailyRecord } from '@/lib/poultry-daily-automation';
import { FARM_STORAGE_KEYS, readLocal, subscribeToFarmData } from '@/lib/farm-storage';
import { formatDate, formatNumber } from '@/lib/format';
import { Modal, SectionHeading } from '@/components/ui';

type DailyFollowUpShift = 'jour' | 'nuit';
type DailyFollowUpRecord = PoultryAutomaticDailyRecord;
type ShiftFilter = 'Toutes' | DailyFollowUpShift | 'non-renseigne';

type BuildingOption = { id: string; name: string };

export function RHDailyFollowUpReport() {
  const [records, setRecords] = useState<DailyFollowUpRecord[]>([]);
  const [buildingOptions, setBuildingOptions] = useState<BuildingOption[]>([]);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [shiftFilter, setShiftFilter] = useState<ShiftFilter>('Toutes');
  const [buildingFilter, setBuildingFilter] = useState('Toutes');
  const [query, setQuery] = useState('');
  const [selectedRecord, setSelectedRecord] = useState<DailyFollowUpRecord | null>(null);

  useEffect(() => {
    const load = () => {
      const nextRecords = syncPoultryDailyFollowUps();
      const savedBuildings = readLocal<BuildingOption[]>(FARM_STORAGE_KEYS.buildings, []);
      const recordBuildings = nextRecords.map((record) => ({ id: record.building, name: record.building }));
      const options = [...savedBuildings, ...recordBuildings].filter((building, index, list) => building.name && list.findIndex((item) => item.name === building.name) === index).sort((a, b) => a.name.localeCompare(b.name, 'fr'));
      setRecords(nextRecords);
      setBuildingOptions(options);
    };
    load();
    return subscribeToFarmData([FARM_STORAGE_KEYS.daily, FARM_STORAGE_KEYS.dailyTaskInstances, FARM_STORAGE_KEYS.dagoReports, FARM_STORAGE_KEYS.buildings], load);
  }, []);

  const filteredRecords = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return records
      .filter((record) => {
        const service = record.shift ?? 'non-renseigne';
        const searchable = `${record.date} ${record.building} ${record.batch} ${record.recordedBy} ${record.note ?? ''}`.toLowerCase();
        return (!fromDate || record.date >= fromDate)
          && (!toDate || record.date <= toDate)
          && (shiftFilter === 'Toutes' || service === shiftFilter)
          && (buildingFilter === 'Toutes' || record.building === buildingFilter)
          && (!normalizedQuery || searchable.includes(normalizedQuery));
      })
      .sort((first, second) => second.date.localeCompare(first.date) || shiftOrder(first.shift) - shiftOrder(second.shift) || first.building.localeCompare(second.building, 'fr'));
  }, [records, fromDate, toDate, shiftFilter, buildingFilter, query]);

  const dayRecords = filteredRecords.filter((record) => record.shift === 'jour');
  const nightRecords = filteredRecords.filter((record) => record.shift === 'nuit');
  const legacyRecords = filteredRecords.filter((record) => !record.shift);
  const totalDeaths = filteredRecords.reduce((sum, record) => sum + Math.max(0, Number(record.deaths) || 0), 0);
  const expectedDeaths = filteredRecords.reduce((sum, record) => sum + Math.max(0, Number(record.expectedDeaths) || 0), 0);
  const alertRecords = filteredRecords.filter((record) => followUpAlerts(record).length);

  function exportReport() {
    const header = 'Date;Service;Bâtiment;Bande;Mortalité réelle;Mortalité attendue;Aliment réel (kg);Aliment attendu (kg);Eau (L);Température (°C);Humidité (%);Observation;Saisi par;Origine';
    const rows = filteredRecords.map((record) => [
      record.date,
      serviceLabel(record.shift),
      record.building,
      record.batch,
      record.deaths,
      record.expectedDeaths,
      record.feed,
      record.expectedFeed,
      record.water,
      record.temperature,
      record.humidity,
      record.note ?? '',
      record.recordedBy,
      record.source === 'automatique' ? 'Automatique' : 'Manuel',
    ].map(csvCell).join(';'));
    const blob = new Blob([`\ufeff${[header, ...rows].join('\n')}`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `rapport-suivi-quotidien-poulets-${fromDate || 'debut'}-${toDate || 'fin'}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return <section className="surface overflow-hidden">
    <div className="flex flex-col gap-4 border-b border-[#edf0eb] px-5 py-5 sm:px-6 lg:flex-row lg:items-end lg:justify-between">
      <SectionHeading eyebrow="Poulets bio · rapport transmis à RH" title="Suivi quotidien jour et nuit" description="RH dispose ici des relevés consolidés depuis les tâches terminées et les signalements de mortalité." />
      <button type="button" className="btn-secondary shrink-0" onClick={exportReport}><Download size={15} /> Exporter le rapport</button>
    </div>
    <div className="border-b border-[#edf0eb] bg-[#f5faf2] px-5 py-3 text-[10px] leading-5 text-[#6d9071] sm:px-6">Les quantités d’eau et d’aliment sont additionnées à partir des tâches de service terminées. Les sujets morts sont repris depuis les signalements Poulets morts, avec une seule ligne de mortalité par bâtiment et par journée.</div>
    <div className="grid gap-3 border-b border-[#edf0eb] p-5 sm:grid-cols-2 xl:grid-cols-4 sm:p-6">
      <SummaryCard label="Suivis affichés" value={filteredRecords.length} detail={dateRangeLabel(fromDate, toDate)} tone="blue" icon={CalendarDays} />
      <SummaryCard label="Mortalités relevées" value={totalDeaths} detail={`${expectedDeaths} attendue(s)`} tone="orange" icon={AlertTriangle} />
      <SummaryCard label="Service jour" value={dayRecords.length} detail={`${sumDeaths(dayRecords)} mort(s)`} tone="green" icon={Clock3} />
      <SummaryCard label="Service nuit" value={nightRecords.length} detail={`${sumDeaths(nightRecords)} mort(s)`} tone="purple" icon={HeartPulse} />
    </div>
    <div className="border-b border-[#edf0eb] bg-[#fbfcfa] px-5 py-4 sm:px-6">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
        <div className="relative min-w-[220px] flex-1"><Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#9aa59f]" /><input className="input-base h-9 pl-9 text-[11px]" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Rechercher un bâtiment, une bande ou une observation…" /></div>
        <div className="grid gap-2 sm:grid-cols-2 lg:flex">
          <label className="flex items-center gap-2"><span className="sr-only">Date de début</span><input aria-label="Date de début" type="date" className="input-base h-9 text-[11px]" value={fromDate} onChange={(event) => setFromDate(event.target.value)} /></label>
          <label className="flex items-center gap-2"><span className="sr-only">Date de fin</span><input aria-label="Date de fin" type="date" className="input-base h-9 text-[11px]" value={toDate} onChange={(event) => setToDate(event.target.value)} /></label>
          <select aria-label="Filtrer par service" className="input-base h-9 text-[11px]" value={shiftFilter} onChange={(event) => setShiftFilter(event.target.value as ShiftFilter)}><option value="Toutes">Jour et nuit</option><option value="jour">Service jour</option><option value="nuit">Service nuit</option><option value="non-renseigne">Service non renseigné</option></select>
          <select aria-label="Filtrer par bâtiment" className="input-base h-9 text-[11px]" value={buildingFilter} onChange={(event) => setBuildingFilter(event.target.value)}><option value="Toutes">Tous les bâtiments</option>{buildingOptions.map((building) => <option value={building.name} key={building.id}>{building.name}</option>)}</select>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3 text-[10px] text-[#89968f]"><span>{filteredRecords.length} relevé(s) correspondent aux filtres.</span>{legacyRecords.length > 0 && <span className="font-semibold text-[#8066a6]">{legacyRecords.length} ancien(s) sans service indiqué</span>}{alertRecords.length > 0 && <span className="flex items-center gap-1 font-bold text-[#bd7737]"><AlertTriangle size={12} />{alertRecords.length} relevé(s) à examiner</span>}</div>
    </div>
    <div className="table-scroll">
      <table className="w-full min-w-[1120px] text-left">
        <thead><tr className="table-head"><th>Date</th><th>Service</th><th>Bâtiment / bande</th><th>Mortalité</th><th>Aliment</th><th>Eau</th><th>Ambiance</th><th>Observation</th><th>Origine</th><th>État</th><th /></tr></thead>
        <tbody>{filteredRecords.length ? filteredRecords.map((record) => {
          const alerts = followUpAlerts(record);
          return <tr key={record.id} className="table-row table-line">
            <td>{formatDate(record.date)}</td>
            <td><span className={`rounded-full px-2 py-1 text-[9px] font-bold ${record.shift === 'nuit' ? 'bg-[#eee7f8] text-[#8066a6]' : record.shift === 'jour' ? 'bg-[#fff2e2] text-[#bd7737]' : 'bg-[#f1f5ef] text-[#66766d]'}`}>{serviceLabel(record.shift)}</span></td>
            <td><p className="font-bold text-ink">{record.building}</p><p className="mt-1 text-[10px] text-[#89968f]">{record.batch || 'Bande non renseignée'}</p></td>
            <td><strong className={Number(record.deaths) > Number(record.expectedDeaths) ? 'text-[#bd5c5c]' : 'text-[#5b9d5b]'}>{formatNumber(Number(record.deaths) || 0)}</strong><span className="text-[10px] text-[#89968f]"> / {formatNumber(Number(record.expectedDeaths) || 0)} attendue(s)</span></td>
            <td><strong className="text-ink">{formatNumber(Number(record.feed) || 0)} kg</strong><span className="block text-[10px] text-[#89968f]">/ {formatNumber(Number(record.expectedFeed) || 0)} kg</span></td>
            <td>{formatNumber(Number(record.water) || 0)} L</td>
            <td><span className="text-[10px]">{record.temperature || '—'} °C</span><span className="block text-[10px] text-[#89968f]">{record.humidity || '—'} %</span></td>
            <td><span className="block max-w-[180px] truncate text-[10px] text-[#66766d]">{record.note || 'Aucune observation'}</span></td>
            <td>{record.source === 'automatique' ? <span className="inline-flex items-center gap-1 rounded-full bg-[#edf3ff] px-2 py-1 text-[9px] font-bold text-[#6385bd]">Automatique</span> : <span className="inline-flex items-center gap-1 rounded-full bg-[#f1f5ef] px-2 py-1 text-[9px] font-bold text-[#66766d]">Manuel</span>}</td>
            <td>{alerts.length ? <span className="inline-flex items-center gap-1 rounded-full bg-[#fff2e2] px-2 py-1 text-[9px] font-bold text-[#bd7737]"><AlertTriangle size={11} /> À examiner</span> : <span className="inline-flex items-center gap-1 rounded-full bg-[#edf8e9] px-2 py-1 text-[9px] font-bold text-[#5b9d5b]"><Check size={11} /> Conforme</span>}</td>
            <td><button type="button" className="icon-btn h-8 w-8" onClick={() => setSelectedRecord(record)} aria-label={`Voir le détail du suivi ${record.id}`}><Eye size={14} /></button></td>
          </tr>;
        }) : <tr><td colSpan={11} className="px-6 py-14 text-center text-[11px] text-[#89968f]">Aucun suivi quotidien ne correspond aux filtres sélectionnés.</td></tr>}</tbody>
      </table>
    </div>
    <div className="border-t border-[#edf0eb] bg-[#f5faf2] px-5 py-3 text-[10px] leading-5 text-[#6d9071] sm:px-6"><HeartPulse size={13} className="mr-1 inline" /> Les relevés automatiques sont recalculés à partir des saisies terminées. Les anciens relevés sans service restent visibles sous « Service non renseigné ».</div>
    <Modal open={Boolean(selectedRecord)} onClose={() => setSelectedRecord(null)} title="Détail du suivi quotidien">
      {selectedRecord && <div className="space-y-5">
        <div className="rounded-xl border border-[#dce8db] bg-[#f6faf4] p-4"><div className="flex flex-wrap items-center gap-2"><strong className="text-[13px] text-ink">{selectedRecord.building} · {selectedRecord.batch || 'Bande non renseignée'}</strong><span className="rounded-full bg-white px-2 py-1 text-[9px] font-bold text-[#5b9d5b]">{serviceLabel(selectedRecord.shift)}</span></div><p className="mt-1 text-[10px] text-[#718078]">{formatDate(selectedRecord.date)} · saisi par {selectedRecord.recordedBy}</p></div>
        <div className="grid gap-3 sm:grid-cols-2"><DetailLine label="Mortalité réelle / attendue" value={`${formatNumber(Number(selectedRecord.deaths) || 0)} / ${formatNumber(Number(selectedRecord.expectedDeaths) || 0)} sujet(s)`} /><DetailLine label="Aliment réel / attendu" value={`${formatNumber(Number(selectedRecord.feed) || 0)} kg / ${formatNumber(Number(selectedRecord.expectedFeed) || 0)} kg`} /><DetailLine label="Eau consommée" value={`${formatNumber(Number(selectedRecord.water) || 0)} L`} /><DetailLine label="Ambiance" value={`${selectedRecord.temperature || '—'} °C · ${selectedRecord.humidity || '—'} %`} /><DetailLine label="Origine" value={selectedRecord.source === 'automatique' ? `Automatique${selectedRecord.taskCount ? ` · ${selectedRecord.taskCount} tâche(s)` : ''}` : 'Saisie manuelle'} /></div>
        <div className="rounded-xl border border-[#edf0eb] bg-[#fbfcfa] p-4 text-[11px] leading-5"><strong>Observation du terrain</strong><p className="mt-1 whitespace-pre-wrap text-[#53675b]">{selectedRecord.note || 'Aucune observation enregistrée.'}</p></div>
        {followUpAlerts(selectedRecord).length > 0 && <div className="rounded-xl border border-[#f0d5ad] bg-[#fff8ea] p-4 text-[11px] leading-5 text-[#986c3e]"><strong>Points à examiner pour la préparation santé / biosécurité</strong><ul className="mt-2 list-disc space-y-1 pl-4">{followUpAlerts(selectedRecord).map((alert) => <li key={alert}>{alert}</li>)}</ul></div>}
        <div className="flex justify-end"><button type="button" className="btn-primary" onClick={() => setSelectedRecord(null)}>Fermer</button></div>
      </div>}
    </Modal>
  </section>;
}

function SummaryCard({ label, value, detail, tone, icon: Icon }: { label: string; value: number; detail: string; tone: 'green' | 'orange' | 'blue' | 'purple'; icon: LucideIcon }) {
  const classes = { green: 'bg-[#edf8e9] text-[#5b9d5b]', orange: 'bg-[#fff2e2] text-[#bd7737]', blue: 'bg-[#edf3ff] text-[#6385bd]', purple: 'bg-[#eee7f8] text-[#8066a6]' };
  return <div className="rounded-xl border border-[#edf0eb] bg-white p-3"><div className="flex items-start justify-between gap-2"><div><p className="text-[10px] font-semibold text-[#77857e]">{label}</p><p className="mt-1 text-[22px] font-black tracking-[-.05em] text-ink">{formatNumber(value)}</p></div><span className={`flex h-8 w-8 items-center justify-center rounded-lg ${classes[tone]}`}><Icon size={15} /></span></div><p className="mt-2 truncate text-[10px] text-[#89968f]">{detail}</p></div>;
}

function DetailLine({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-[#edf0eb] bg-[#fbfcfa] p-3"><span className="block text-[9px] font-bold uppercase tracking-[.1em] text-[#89968f]">{label}</span><strong className="mt-1 block text-[11px] text-ink">{value}</strong></div>;
}

function sumDeaths(records: DailyFollowUpRecord[]) {
  return records.reduce((sum, record) => sum + Math.max(0, Number(record.deaths) || 0), 0);
}

function serviceLabel(shift?: DailyFollowUpShift) {
  return shift === 'nuit' ? 'Nuit' : shift === 'jour' ? 'Jour' : 'Non renseigné';
}

function shiftOrder(shift?: DailyFollowUpShift) {
  return shift === 'jour' ? 0 : shift === 'nuit' ? 1 : 2;
}

function followUpAlerts(record: DailyFollowUpRecord) {
  const alerts: string[] = [];
  const deaths = Number(record.deaths) || 0;
  const expectedDeaths = Number(record.expectedDeaths) || 0;
  const feed = Number(record.feed) || 0;
  const expectedFeed = Number(record.expectedFeed) || 0;
  if (deaths > expectedDeaths) alerts.push(`Mortalité supérieure à l’attendu : ${deaths} contre ${expectedDeaths}.`);
  if (expectedFeed > 0 && feed > expectedFeed) alerts.push(`Consommation d’aliment supérieure à l’attendu : ${feed} kg contre ${expectedFeed} kg.`);
  return alerts;
}

function dateRangeLabel(from: string, to: string) {
  if (from && to) return `${formatDate(from)} → ${formatDate(to)}`;
  if (from) return `Depuis le ${formatDate(from)}`;
  if (to) return `Jusqu’au ${formatDate(to)}`;
  return 'Toutes les dates';
}

function csvCell(value: unknown) {
  return `"${String(value ?? '').replaceAll('"', '""')}"`;
}
