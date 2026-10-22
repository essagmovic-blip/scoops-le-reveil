'use client';

import { useEffect, useMemo, useState } from 'react';
import autoTable from 'jspdf-autotable';
import jsPDF from 'jspdf';
import { Check, Clock3, Download } from 'lucide-react';
import { FARM_STORAGE_KEYS, readLocal, subscribeToFarmData } from '@/lib/farm-storage';
import { DEFAULT_HR_SETTINGS, type HRSettings } from '@/components/hr-settings-view';
import { SectionHeading } from '@/components/ui';
import { addPdfFooter, addPdfLetterhead } from '@/lib/pdf-letterhead';
import { formatNumber } from '@/lib/format';
import { isTaskDayClosed, plannedEndTime, todayIso, type DailyTaskInstance, type DailyTaskSettings } from '@/lib/daily-tasks';
import type { DagoReport } from '@/lib/dago';
import { handoverDeathTotal, type PoultryHandoverRecord } from '@/lib/poultry-handovers';
import type { PoultryLocationBuilding, PoultrySubjectLocationState } from '@/lib/poultry-subject-locations';

type Props = { buildings: PoultryLocationBuilding[] };
export function PoultryBuilding24hReport({ buildings }: Props) {
  const [selectedBuildingId, setSelectedBuildingId] = useState('');
  const [serviceDate, setServiceDate] = useState(todayIso());
  const [tasks, setTasks] = useState<DailyTaskInstance[]>([]);
  const [handovers, setHandovers] = useState<PoultryHandoverRecord[]>([]);
  const [deaths, setDeaths] = useState<DagoReport[]>([]);
  const [locations, setLocations] = useState<PoultrySubjectLocationState[]>([]);
  const [settings, setSettings] = useState<DailyTaskSettings>({ ...DEFAULT_HR_SETTINGS, taskBonusAmount: DEFAULT_HR_SETTINGS.taskBonusAmount, taskPenaltyAmount: DEFAULT_HR_SETTINGS.taskPenaltyAmount, taskGapMinutes: DEFAULT_HR_SETTINGS.taskGapMinutes });
  const [feedback, setFeedback] = useState('');
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    if (!selectedBuildingId && buildings[0]) setSelectedBuildingId(buildings[0].id);
    if (selectedBuildingId && !buildings.some((building) => building.id === selectedBuildingId)) setSelectedBuildingId(buildings[0]?.id ?? '');
  }, [buildings, selectedBuildingId]);

  useEffect(() => {
    const load = () => {
      const hr = { ...DEFAULT_HR_SETTINGS, ...readLocal<Partial<HRSettings>>(FARM_STORAGE_KEYS.rhSettings, {}) };
      setSettings({ taskBonusAmount: hr.taskBonusAmount, taskPenaltyAmount: hr.taskPenaltyAmount, taskWorkdayStart: hr.taskWorkdayStart, taskWorkdayEnd: hr.taskWorkdayEnd, dayShiftStart: hr.dayShiftStart, dayShiftEnd: hr.dayShiftEnd, nightShiftStart: hr.nightShiftStart, nightShiftEnd: hr.nightShiftEnd, taskGapMinutes: hr.taskGapMinutes });
      setTasks(readLocal<DailyTaskInstance[]>(FARM_STORAGE_KEYS.dailyTaskInstances, []));
      setHandovers(readLocal<PoultryHandoverRecord[]>(FARM_STORAGE_KEYS.poultryHandovers, []));
      setDeaths(readLocal<DagoReport[]>(FARM_STORAGE_KEYS.dagoReports, []));
      setLocations(readLocal<PoultrySubjectLocationState[]>(FARM_STORAGE_KEYS.poultrySubjectLocations, []));
    };
    load();
    return subscribeToFarmData([FARM_STORAGE_KEYS.dailyTaskInstances, FARM_STORAGE_KEYS.poultryHandovers, FARM_STORAGE_KEYS.dagoReports, FARM_STORAGE_KEYS.poultrySubjectLocations, FARM_STORAGE_KEYS.rhSettings], load);
  }, []);

  const building = buildings.find((item) => item.id === selectedBuildingId);
  const cycleTasks = useMemo(() => tasks.filter((task) => task.unitId === 'poulets' && task.assignedBuildingId === selectedBuildingId && task.date === serviceDate), [tasks, selectedBuildingId, serviceDate]);
  const cycleHandovers = useMemo(() => handovers.filter((handover) => handover.buildingId === selectedBuildingId && handover.outgoingServiceDate === serviceDate && handover.status === 'Réalisée'), [handovers, selectedBuildingId, serviceDate]);
  const cycleDeaths = useMemo(() => deaths.filter((report) => report.buildingId === selectedBuildingId && report.reportedDate === serviceDate), [deaths, selectedBuildingId, serviceDate]);
  const completedTasks = cycleTasks.filter((task) => task.status === 'Terminée');
  const waterTotal = completedTasks.reduce((sum, task) => sum + (Number(task.waterQuantityLiters) || 0), 0);
  const feedTotal = completedTasks.reduce((sum, task) => sum + (Number(task.feedQuantityKg) || 0), 0);
  const handoverDeaths = cycleHandovers.reduce((sum, handover) => sum + handoverDeathTotal(handover), 0);
  const signalDeaths = cycleDeaths.reduce((sum, report) => sum + Math.max(0, Number(report.quantity) || 0), 0);
  const totalDeaths = signalDeaths + handoverDeaths;
  const cycleClosed = serviceDate < todayIso() || isTaskDayClosed(serviceDate, new Date(), settings, 'nuit');
  const location = locations.find((item) => item.buildingId === selectedBuildingId && item.batchId === building?.batch);

  function notify(message: string) {
    setFeedback(message);
    window.setTimeout(() => setFeedback(''), 4500);
  }

  async function exportReport() {
    if (!building) {
      notify('Sélectionnez un bâtiment avant de générer le rapport.');
      return;
    }
    setExporting(true);
    try {
      const doc = new jsPDF({ unit: 'mm', format: 'a4' });
      const start = await addPdfLetterhead(doc, { title: 'Rapport global du bâtiment · 24 heures', reference: `BAT-24H-${serviceDate}-${safePart(building.id)}`, context: [`Bâtiment : ${building.name}`, `Bande : ${building.batch || '—'}`, `Cycle : ${serviceDate} · jour + nuit`, `${cycleTasks.length} tâche(s) · ${cycleHandovers.length} transmission(s)`] });
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(25, 56, 46);
      doc.text('Synthèse globale du bâtiment sur 24 heures', 14, start);
      autoTable(doc, { startY: start + 5, head: [['Tâches', 'Terminées', 'En retard / non faites', 'Eau totale', 'Aliment total', 'Mortalité totale', 'Sujets en clinique']], body: [[`${cycleTasks.length}`, `${completedTasks.length}`, `${cycleTasks.filter((task) => task.status === 'Non faite' || task.completion === 'En retard').length}`, `${formatPdfNumber(waterTotal)} L`, `${formatPdfNumber(feedTotal)} kg`, `${totalDeaths}`, `${location?.clinicQuantity ?? '—'}`]], theme: 'grid', styles: { fontSize: 7.5, cellPadding: 2.5, halign: 'center' }, headStyles: { fillColor: [25, 56, 46], textColor: 255, fontStyle: 'bold' }, bodyStyles: { textColor: [29, 46, 39], fontStyle: 'bold' }, margin: { left: 14, right: 14 } });
      let lastY = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? start + 20;
      doc.setFontSize(11);
      doc.text('Détail des tâches jour et nuit', 14, lastY + 12);
      autoTable(doc, { startY: lastY + 17, head: [['Service', 'Tâche', 'Horaire', 'Responsable réel', 'Début → fin', 'Eau / aliment', 'État / commentaire']], body: cycleTasks.sort((a, b) => (a.shift ?? 'jour').localeCompare(b.shift ?? 'jour') || a.startTime.localeCompare(b.startTime)).map((task) => [`${task.shift === 'nuit' ? 'Nuit' : 'Jour'}\n${task.date}`, task.title, taskScheduleLabel(task), task.completedByName || task.startedByName || task.assignedEmployeeName || task.assignedRole || '—', `${formatDateTime(task.startedAt)} → ${formatDateTime(task.completedAt)}`, `${task.waterQuantityLiters !== undefined ? `${formatPdfNumber(task.waterQuantityLiters)} L` : '—'} / ${task.feedQuantityKg !== undefined ? `${formatPdfNumber(task.feedQuantityKg)} kg` : '—'}`, `${task.status}${task.comment ? `\n${task.comment}` : ''}`]), theme: 'grid', styles: { fontSize: 6.5, cellPadding: 2.2, overflow: 'linebreak', valign: 'top' }, headStyles: { fillColor: [91, 157, 91], textColor: 255, fontSize: 7, fontStyle: 'bold' }, bodyStyles: { textColor: [42, 59, 49] }, alternateRowStyles: { fillColor: [249, 252, 248] }, columnStyles: { 0: { cellWidth: 22 }, 1: { cellWidth: 38 }, 2: { cellWidth: 27 }, 3: { cellWidth: 30 }, 4: { cellWidth: 30 }, 5: { cellWidth: 20 }, 6: { cellWidth: 27 } }, margin: { left: 14, right: 14, bottom: 22 } });
      lastY = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? lastY + 30;
      if (cycleHandovers.length) {
        doc.setFontSize(11);
        doc.text('Transmissions de service', 14, lastY + 12);
        autoTable(doc, { startY: lastY + 17, head: [['Service entrant', 'Entrant', 'Sortant', 'Morts trouvés', 'Contrôles du bâtiment', 'Sacs aliment / observation']], body: cycleHandovers.map((handover) => [`${handover.incomingShift === 'nuit' ? 'Nuit' : 'Jour'} · ${handover.serviceDate}`, handover.incomingResponsibleName, handover.outgoingResponsibleName, `${handover.deathsFoundQuantity}\nGrande salle : ${handover.deathsMainRoomQuantity}\nClinique : ${handover.deathsClinicQuantity}`, `Abreuvoirs : ${handover.waterersWashed}\nFûts : ${handover.waterDrumsFilled}\nMatériel : ${handover.equipmentStored}\nSalle : ${handover.roomClean}\nPédiluve : ${handover.footbathReady}`, `${handover.feedBagsFound}\n${handover.comment || handover.deathsObservation || '—'}`]), theme: 'grid', styles: { fontSize: 6.6, cellPadding: 2.2, overflow: 'linebreak', valign: 'top' }, headStyles: { fillColor: [189, 119, 55], textColor: 255, fontSize: 7, fontStyle: 'bold' }, bodyStyles: { textColor: [66, 59, 42] }, alternateRowStyles: { fillColor: [255, 250, 242] }, columnStyles: { 0: { cellWidth: 24 }, 1: { cellWidth: 26 }, 2: { cellWidth: 26 }, 3: { cellWidth: 29 }, 4: { cellWidth: 35 }, 5: { cellWidth: 28 } }, margin: { left: 14, right: 14, bottom: 22 } });
        lastY = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? lastY + 30;
      }
      doc.setFontSize(11);
      doc.text('Mortalités signalées et origine', 14, lastY + 12);
      autoTable(doc, { startY: lastY + 17, head: [['Origine', 'Quantité', 'Signalé par', 'Date / statut', 'Répartition / observation']], body: [...cycleDeaths.map((report) => [report.sourceLocation === 'clinique' ? 'Clinique' : 'Grande salle', `${report.quantity}`, report.reportedByName, `${formatDateTime(report.reportedAt)}\n${report.status}`, `Frais : ${report.freshQuantity ?? report.goodQuantity}\nDécomposés : ${report.decomposedQuantity ?? report.spoiledQuantity}\n${report.conditionNote || '—'}`]), ...cycleHandovers.filter((handover) => handoverDeathTotal(handover) > 0).map((handover) => ['Transmission · sources détaillées', `${handoverDeathTotal(handover)}`, handover.incomingResponsibleName, `${formatDateTime(handover.answeredAt)}\nService sortant`, `Grande salle : ${handover.deathsMainRoomQuantity}\nClinique : ${handover.deathsClinicQuantity}\n${handover.deathsObservation || '—'}`])], theme: 'grid', styles: { fontSize: 7, cellPadding: 2.5, overflow: 'linebreak', valign: 'top' }, headStyles: { fillColor: [189, 92, 89], textColor: 255, fontSize: 7, fontStyle: 'bold' }, bodyStyles: { textColor: [70, 48, 47] }, alternateRowStyles: { fillColor: [255, 247, 247] }, columnStyles: { 0: { cellWidth: 35 }, 1: { cellWidth: 20 }, 2: { cellWidth: 35 }, 3: { cellWidth: 35 }, 4: { cellWidth: 55 } }, margin: { left: 14, right: 14, bottom: 22 } });
      addPdfFooter(doc, 'Rapport global du bâtiment sur 24 heures · AgroFlux · SCOOPS LE REVEIL');
      doc.save(`rapport-batiment-24h-${safePart(building.name)}-${serviceDate}.pdf`);
      notify('Le rapport global du bâtiment sur 24 heures a été téléchargé.');
    } catch {
      notify('Impossible de générer le rapport global du bâtiment.');
    } finally {
      setExporting(false);
    }
  }

  if (!buildings.length) return null;
  return <section className="surface overflow-hidden"><div className="flex flex-col gap-4 border-b border-[#edf0eb] px-5 py-5 sm:px-6 lg:flex-row lg:items-end lg:justify-between"><SectionHeading eyebrow="Clôture de bâtiment · cycle complet" title="Rapport global sur 24 heures" description="Le rapport additionne les services jour et nuit du même bâtiment, tout en conservant le détail par responsable et par transmission." /><div className="flex flex-wrap gap-2"><select className="input-base h-9 text-[11px]" value={selectedBuildingId} onChange={(event) => setSelectedBuildingId(event.target.value)} aria-label="Bâtiment du rapport">{buildings.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select><input type="date" className="input-base h-9 text-[11px]" value={serviceDate} onChange={(event) => setServiceDate(event.target.value)} aria-label="Date du cycle" /><button type="button" className="btn-primary h-9 px-3 text-[10px]" onClick={() => void exportReport()} disabled={exporting || !cycleClosed}><Download size={14} /> {exporting ? 'Génération…' : 'Générer le rapport 24 h'}</button></div></div><div className="border-b border-[#edf0eb] bg-[#fbfcfa] px-5 py-3 sm:px-6"><div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[10px] text-[#718078]"><span><strong className="text-ink">{building?.name ?? '—'}</strong> · bande {building?.batch || '—'}</span><span>{cycleTasks.length} tâche(s) · {completedTasks.length} terminée(s)</span><span>{formatNumber(waterTotal)} L eau · {formatNumber(feedTotal)} kg aliment</span><span>{formatNumber(totalDeaths)} mort(s) compté(s)</span>{cycleClosed ? <span className="inline-flex items-center gap-1 font-bold text-[#5b9d5b]"><Check size={12} /> Cycle clôturé</span> : <span className="inline-flex items-center gap-1 font-bold text-[#bd7737]"><Clock3 size={12} /> Disponible après la fin du service nuit</span>}</div></div>{feedback && <div className="mx-5 mt-4 rounded-xl border border-[#cde8c7] bg-[#effaeb] px-4 py-3 text-[11px] font-semibold text-[#4d9352] sm:mx-6">{feedback}</div>}<div className="grid gap-3 p-5 sm:grid-cols-4 sm:p-6"><ReportMetric label="Eau 24 h" value={`${formatNumber(waterTotal)} L`} /><ReportMetric label="Aliment 24 h" value={`${formatNumber(feedTotal)} kg`} /><ReportMetric label="Mortalité 24 h" value={formatNumber(totalDeaths)} /><ReportMetric label="Clinique actuelle" value={location ? formatNumber(location.clinicQuantity) : '—'} /></div></section>;
}

function ReportMetric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-[#e1ebe0] bg-[#f5faf2] p-3"><span className="block text-[10px] font-semibold text-[#6d9071]">{label}</span><strong className="mt-1 block text-[17px] font-black text-[#3e7546]">{value}</strong></div>;
}

function taskScheduleLabel(task: Pick<DailyTaskInstance, 'scheduleMode' | 'startTime' | 'recurrenceMinutes' | 'durationMinutes'>) {
  if (task.scheduleMode === 'libre') return 'À tout moment';
  if (task.scheduleMode === 'recurrence') return `Toutes les ${task.recurrenceMinutes ?? 60} min`;
  return task.startTime ? `${task.startTime} → ${plannedEndTime(task)}` : 'Horaire non défini';
}

function formatDateTime(value: string) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('fr-FR', { timeZone: 'Africa/Douala' });
}

function formatPdfNumber(value: number) {
  return Number(value || 0).toLocaleString('fr-FR', { maximumFractionDigits: 2 });
}

function safePart(value: string) {
  return value.trim().replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '') || 'batiment';
}
