'use client';

import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Check, Clock3, Download, Syringe } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { poultryBuildings } from '@/lib/data';
import { formatDate, formatNumber } from '@/lib/format';
import { FARM_STORAGE_KEYS, readLocal, subscribeToFarmData } from '@/lib/farm-storage';
import { todayIso } from '@/lib/daily-tasks';
import { StatusBadge } from '@/components/status-badge';
import { SectionHeading } from '@/components/ui';
import { syncPoultryHealthCalendar, type PoultryHealthCalendarEvent, type PoultryHealthCalendarStatus } from '@/lib/poultry-health-calendar';

type FarmBuilding = typeof poultryBuildings[number];
type StatusFilter = 'Tous' | PoultryHealthCalendarStatus;

export function PoultryHealthCalendarView() {
  const [events, setEvents] = useState<PoultryHealthCalendarEvent[]>([]);
  const [buildingNames, setBuildingNames] = useState<string[]>([]);
  const [assignedBuildings, setAssignedBuildings] = useState<string[] | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('Tous');
  const [buildingFilter, setBuildingFilter] = useState('Tous');

  useEffect(() => {
    const cookie = (name: string) => {
      const part = document.cookie.split('; ').find((item) => item.startsWith(`${name}=`));
      return part ? decodeURIComponent(part.slice(name.length + 1)) : '';
    };
    const isAdmin = cookie('agroflux_is_admin') === '1';
    const resolvedBuildingIds = isAdmin ? null : (() => {
      try { return JSON.parse(cookie('agroflux_assigned_buildings') || '[]') as string[]; } catch { return [] as string[]; }
    })();
    setAssignedBuildings(resolvedBuildingIds);
    const load = () => {
      const next = syncPoultryHealthCalendar();
      const buildings = readLocal<FarmBuilding[]>(FARM_STORAGE_KEYS.buildings, []);
      setEvents(next.filter((event) => event.scheduleSource === 'automatique'));
      setBuildingNames(buildings.filter((building) => resolvedBuildingIds === null || !resolvedBuildingIds.length || resolvedBuildingIds.includes(building.id)).map((building) => building.name));
    };
    load();
    return subscribeToFarmData([FARM_STORAGE_KEYS.health, FARM_STORAGE_KEYS.dailyTaskTemplates, FARM_STORAGE_KEYS.dailyTaskInstances, FARM_STORAGE_KEYS.buildings, FARM_STORAGE_KEYS.lots], load);
  }, []);

  const visibleEvents = useMemo(() => events.filter((event) => {
    const buildingVisible = assignedBuildings === null || !assignedBuildings.length || assignedBuildings.includes(event.buildingId ?? event.building);
    return buildingVisible && (statusFilter === 'Tous' || event.scheduleStatus === statusFilter) && (buildingFilter === 'Tous' || event.building === buildingFilter);
  }).sort((first, second) => (first.dueDate ?? first.date).localeCompare(second.dueDate ?? second.date) || first.building.localeCompare(second.building, 'fr')), [events, assignedBuildings, statusFilter, buildingFilter]);
  const dueCount = visibleEvents.filter((event) => event.scheduleStatus === 'À faire').length;
  const lateCount = visibleEvents.filter((event) => event.scheduleStatus === 'En retard').length;
  const completedCount = visibleEvents.filter((event) => event.scheduleStatus === 'Réalisée').length;
  const preparationEvents = visibleEvents.filter((event) => event.noticeDate === todayIso() && event.scheduleStatus === 'À faire');

  function exportCalendar() {
    const header = 'Échéance;Visible depuis;Type;Bâtiment;Bande;Âge;Statut;Tâche liée;Réalisé le;Réalisé par;Observation';
    const rows = visibleEvents.map((event) => [event.dueDate ?? event.date, event.noticeDate ?? '', event.type, event.building, event.batch, event.poultryAgeDay !== undefined ? `J${event.poultryAgeDay}` : '', event.scheduleStatus ?? event.status, event.plannedTaskId ?? '', event.completedAt ?? '', event.completedBy ?? '', event.note ?? ''].map(csvCell).join(';'));
    const url = URL.createObjectURL(new Blob([`\ufeff${[header, ...rows].join('\n')}`], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'calendrier-sanitaire-poulets.csv';
    link.click();
    URL.revokeObjectURL(url);
  }

  return <section className="surface overflow-hidden"><div className="flex flex-col gap-4 border-b border-[#edf0eb] px-5 py-5 sm:px-6 lg:flex-row lg:items-end lg:justify-between"><SectionHeading eyebrow="Carnet sanitaire · échéances automatiques" title="Calendrier vaccinations et pesées" description="Les échéances apparaissent 24 heures avant la date prévue et se mettent à jour depuis la tâche quotidienne liée." /><button type="button" className="btn-secondary shrink-0" onClick={exportCalendar}><Download size={15} /> Exporter le calendrier</button></div>{preparationEvents.length > 0 && <div className="mx-5 mt-4 rounded-xl border border-[#f0d5ad] bg-[#fffaf2] px-4 py-3 text-[11px] text-[#8d6135] sm:mx-6"><div className="flex items-start gap-2"><AlertTriangle size={15} className="mt-0.5 shrink-0 text-[#bd7737]" /><div><strong>Préparation de l’équipe dans 24 heures</strong><div className="mt-2 space-y-1">{preparationEvents.map((event) => <p key={event.id}>• {event.type} · {event.building} · {event.batch} · échéance {formatDate(event.dueDate ?? event.date)} · {event.plannedTaskId ?? 'tâche à préparer'}</p>)}</div></div></div></div>}<div className="grid gap-3 border-b border-[#edf0eb] p-5 sm:grid-cols-3 sm:p-6"><CalendarCard label="À faire" value={dueCount} detail="échéances à venir" tone="blue" icon={Clock3} /><CalendarCard label="En retard" value={lateCount} detail="échéances dépassées" tone="orange" icon={AlertTriangle} /><CalendarCard label="Réalisées" value={completedCount} detail="tâches exécutées" tone="green" icon={Check} /></div><div className="border-b border-[#edf0eb] bg-[#fbfcfa] px-5 py-4 sm:px-6"><div className="flex flex-wrap gap-2"><select aria-label="Filtrer par statut" className="input-base h-9 text-[11px]" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}><option value="Tous">Tous les statuts</option><option value="À faire">À faire</option><option value="En retard">En retard</option><option value="Réalisée">Réalisée</option></select><select aria-label="Filtrer par bâtiment" className="input-base h-9 text-[11px]" value={buildingFilter} onChange={(event) => setBuildingFilter(event.target.value)}><option value="Tous">Tous les bâtiments</option>{buildingNames.map((name) => <option value={name} key={name}>{name}</option>)}</select></div><p className="mt-3 text-[10px] text-[#89968f]">{formatNumber(visibleEvents.length)} échéance(s) correspondent aux filtres.</p></div><div className="table-scroll"><table className="w-full min-w-[980px] text-left"><thead><tr className="table-head"><th>Échéance</th><th>Visible depuis</th><th>Type</th><th>Bâtiment / bande</th><th>Âge</th><th>Statut</th><th>Tâche liée</th><th>Réalisation</th><th>Observation</th></tr></thead><tbody>{visibleEvents.length ? visibleEvents.map((event) => <tr className="table-row table-line" key={event.id}><td className="font-bold text-ink">{formatDate(event.dueDate ?? event.date)}</td><td className="text-[10px]">{formatDate(event.noticeDate ?? event.date)}</td><td><span className="inline-flex items-center gap-1.5 rounded-full bg-[#edf3ff] px-2 py-1 text-[9px] font-bold text-[#6385bd]"><Syringe size={11} />{event.type}</span></td><td><p className="font-bold text-ink">{event.building}</p><p className="mt-1 text-[10px] text-[#89968f]">{event.batch}</p></td><td>{event.poultryAgeDay !== undefined ? `J${event.poultryAgeDay}` : '—'}</td><td><StatusBadge status={event.scheduleStatus ?? event.status} /></td><td className="text-[10px]">{event.plannedTaskId ?? '—'}</td><td><span className="text-[10px]">{event.completedAt ? formatDateTime(event.completedAt) : '—'}</span>{event.completedBy && <small className="mt-1 block text-[10px] text-[#89968f]">{event.completedBy}</small>}</td><td><span className="block max-w-[220px] truncate text-[10px] text-[#66766d]">{event.note || '—'}</span></td></tr>) : <tr><td colSpan={9} className="px-6 py-14 text-center text-[11px] text-[#89968f]">Aucune échéance sanitaire automatique pour le moment.</td></tr>}</tbody></table></div><div className="border-t border-[#edf0eb] bg-[#f5faf2] px-5 py-3 text-[10px] leading-5 text-[#6d9071] sm:px-6">Le calendrier reste rattaché au bâtiment et à la bande concernés. L’exécution et la preuve détaillée restent enregistrées dans la tâche quotidienne.</div></section>;
}

function CalendarCard({ label, value, detail, tone, icon: Icon }: { label: string; value: number; detail: string; tone: 'blue' | 'orange' | 'green'; icon: LucideIcon }) {
  const classes = { blue: 'bg-[#edf3ff] text-[#6385bd]', orange: 'bg-[#fff2e2] text-[#bd7737]', green: 'bg-[#edf8e9] text-[#5b9d5b]' };
  return <div className="rounded-xl border border-[#edf0eb] bg-white p-3"><div className="flex items-start justify-between gap-2"><div><p className="text-[10px] font-semibold text-[#77857e]">{label}</p><p className="mt-1 text-[22px] font-black tracking-[-.05em] text-ink">{formatNumber(value)}</p></div><span className={`flex h-8 w-8 items-center justify-center rounded-lg ${classes[tone]}`}><Icon size={15} /></span></div><p className="mt-2 text-[10px] text-[#89968f]">{detail}</p></div>;
}

function formatDateTime(value: string) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('fr-FR', { timeZone: 'Africa/Douala' });
}

function csvCell(value: unknown) {
  return `"${String(value ?? '').replaceAll('"', '""')}"`;
}
