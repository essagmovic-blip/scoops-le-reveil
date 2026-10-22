'use client';

import { useEffect, useMemo, useState } from 'react';
import { Check, ClipboardList, Clock3, FileText, RefreshCw, Search, ShieldCheck, X } from 'lucide-react';
import { FARM_STORAGE_KEYS, readLocal, writeLocal } from '@/lib/farm-storage';
import { formatDate, formatNumber } from '@/lib/format';
import type { ServiceReport, ServiceReportStatus } from '@/lib/service-reports';
import { Modal, SectionHeading, StatCard } from '@/components/ui';

export function ServiceReportsView() {
  const [reports, setReports] = useState<ServiceReport[]>([]);
  const [selected, setSelected] = useState<ServiceReport | null>(null);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<'Tous' | ServiceReportStatus>('Tous');
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState('');

  async function loadReports() {
    setLoading(true);
    const local = readLocal<ServiceReport[]>(FARM_STORAGE_KEYS.serviceReports, []);
    try {
      const response = await fetch('/api/rh/service-reports', { cache: 'no-store' });
      if (!response.ok) throw new Error('Accès impossible');
      const data = await response.json() as { reports?: ServiceReport[] };
      const merged = [...(data.reports ?? []), ...local].filter((report, index, list) => list.findIndex((item) => item.id === report.id) === index).sort((first, second) => second.submittedAt.localeCompare(first.submittedAt));
      setReports(merged);
    } catch {
      setReports(local.sort((first, second) => second.submittedAt.localeCompare(first.submittedAt)));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void loadReports(); }, []);

  const visible = useMemo(() => reports.filter((report) => {
    const matchesStatus = status === 'Tous' || report.status === status;
    const haystack = `${report.id} ${report.responsibleName} ${report.serviceDate} ${report.shift} ${report.buildingNames.join(' ')}`.toLowerCase();
    return matchesStatus && haystack.includes(query.toLowerCase());
  }), [reports, query, status]);
  const unread = reports.filter((report) => report.status === 'Non lu').length;
  const toReview = reports.filter((report) => report.status === 'Lu' || report.status === 'À corriger').length;
  const validated = reports.filter((report) => report.status === 'Validé').length;

  async function updateReport(report: ServiceReport, nextStatus: ServiceReportStatus) {
    const validationComment = nextStatus === 'À corriger' ? ((window.prompt('Commentaire à transmettre au responsable', report.validationComment || '') ?? report.validationComment) || '') : report.validationComment || '';
    try {
      const response = await fetch(`/api/rh/service-reports/${encodeURIComponent(report.id)}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: nextStatus, validationComment }) });
      if (!response.ok) throw new Error('Mise à jour impossible');
      const data = await response.json() as { report: ServiceReport };
      setReports((current) => current.map((item) => item.id === report.id ? data.report : item));
      setSelected(data.report);
      setFeedback(`Le rapport est maintenant « ${nextStatus} ».`);
    } catch {
      setFeedback('Le rapport n’a pas pu être mis à jour sur le serveur.');
    }
  }

  async function openReport(report: ServiceReport) {
    setSelected(report);
    if (report.status !== 'Non lu') return;
    try {
      const response = await fetch(`/api/rh/service-reports/${encodeURIComponent(report.id)}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'Lu' }) });
      if (!response.ok) return;
      const data = await response.json() as { report: ServiceReport };
      setReports((current) => current.map((item) => item.id === report.id ? data.report : item));
      setSelected(data.report);
    } catch {
      // La lecture locale reste disponible même si le serveur est momentanément indisponible.
    }
  }

  return <div className="fade-in space-y-7"><div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between"><div><p className="eyebrow mb-2">RH & administration · Réception</p><h1 className="page-title">Rapports de service</h1><p className="muted mt-2 max-w-2xl text-[13px]">Les rapports envoyés par les responsables sont lisibles directement dans AgroFlux, sans devoir ouvrir un PDF.</p></div><button type="button" className="btn-secondary" onClick={() => void loadReports()} disabled={loading}><RefreshCw size={14} /> Actualiser</button></div>{feedback && <div className="rounded-xl border border-[#cde8c7] bg-[#effaeb] px-4 py-3 text-[11px] font-semibold text-[#4d8f51]">{feedback}</div>}<div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><StatCard label="Rapports reçus" value={String(reports.length)} change="tous services" detail="registre serveur" icon={FileText} tone="blue" /><StatCard label="Non lus" value={String(unread)} change="à ouvrir" detail="nouveaux rapports" icon={Clock3} tone="orange" /><StatCard label="À examiner" value={String(toReview)} change="lecture / correction" detail="action RH" icon={ShieldCheck} tone="purple" /><StatCard label="Validés" value={String(validated)} change="clôturés" detail="validation RH" icon={Check} tone="green" /></div><div className="flex flex-wrap gap-2"><div className="relative min-w-[250px]"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9aa59f]" /><input className="input-base h-9 pl-9 text-[11px]" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Responsable, bâtiment, date..." /></div><select className="input-base h-9 w-auto text-[11px]" value={status} onChange={(event) => setStatus(event.target.value as 'Tous' | ServiceReportStatus)}><option value="Tous">Tous les statuts</option><option value="Non lu">Non lus</option><option value="Lu">Lus</option><option value="À corriger">À corriger</option><option value="Validé">Validés</option></select></div><div className="surface overflow-hidden"><div className="border-b border-[#edf0eb] px-5 py-5 sm:px-6"><SectionHeading eyebrow="Boîte de réception RH" title="Rapports envoyés" description="Ouvrez un rapport pour le marquer comme lu, puis validez-le ou demandez une correction." /></div><div className="table-scroll"><table className="w-full min-w-[900px] text-left"><thead><tr className="table-head"><th>Statut</th><th>Date / service</th><th>Responsable</th><th>Bâtiment(s)</th><th>Tâches</th><th>Mortalité</th><th>Envoyé le</th><th /></tr></thead><tbody>{visible.length ? visible.map((report) => <tr className={`table-row table-line ${report.status === 'Non lu' ? 'bg-[#fffaf2]' : ''}`} key={report.id}><td><span className={`rounded-full px-2 py-1 text-[9px] font-bold ${report.status === 'Non lu' ? 'bg-[#fff2e2] text-[#bd7737]' : report.status === 'Validé' ? 'bg-[#edf8e9] text-[#4d9352]' : report.status === 'À corriger' ? 'bg-[#fdeceb] text-[#b45d5d]' : 'bg-[#edf3ff] text-[#6385bd]'}`}>{report.status}</span></td><td><strong className="block text-ink">{formatDate(report.serviceDate)}</strong><small className="text-[10px] text-[#89968f]">Service {report.shift === 'nuit' ? 'nuit' : 'jour'}</small></td><td className="font-bold text-ink">{report.responsibleName}</td><td>{report.buildingNames.join(' · ') || '—'}</td><td>{report.summary.completedTaskCount}/{report.summary.taskCount} terminée(s)</td><td>{formatNumber(report.summary.deathsFound)} sujet(s)</td><td className="text-[10px]">{formatDate(report.submittedAt.slice(0, 10))}</td><td><button type="button" className="btn-secondary px-2.5 py-1.5 text-[10px]" onClick={() => void openReport(report)}>Lire le rapport</button></td></tr>) : <tr><td colSpan={8} className="px-6 py-14 text-center text-[11px] text-[#89968f]">{loading ? 'Chargement des rapports...' : 'Aucun rapport de service reçu.'}</td></tr>}</tbody></table></div></div><Modal open={Boolean(selected)} onClose={() => setSelected(null)} title={selected ? `Rapport de service · ${selected.responsibleName}` : 'Rapport de service'}>{selected && <ServiceReportDetail report={selected} onStatus={(nextStatus) => void updateReport(selected, nextStatus)} onClose={() => setSelected(null)} />}</Modal></div>;
}

function ServiceReportDetail({ report, onStatus, onClose }: { report: ServiceReport; onStatus: (status: ServiceReportStatus) => void; onClose: () => void }) {
  return <div className="space-y-5"><div className="grid gap-3 sm:grid-cols-2"><DetailItem label="Date" value={`${formatDate(report.serviceDate)} · service ${report.shift === 'nuit' ? 'nuit' : 'jour'}`} /><DetailItem label="Responsable" value={report.responsibleName} /><DetailItem label="Bâtiments" value={report.buildingNames.join(' · ') || '—'} /><DetailItem label="Statut" value={report.status} /><DetailItem label="Tâches" value={`${report.summary.completedTaskCount}/${report.summary.taskCount} terminée(s) · ${report.summary.lateTaskCount} en retard`} /><DetailItem label="Mortalité constatée" value={`${report.summary.deathsFound} sujet(s)`} /><DetailItem label="Eau saisie" value={`${report.summary.waterLiters} L`} /><DetailItem label="Aliment saisi" value={`${report.summary.feedKg} kg`} /></div><div className="rounded-xl border border-[#edf0eb] bg-[#fbfcfa] p-4"><p className="field-label">Détail des tâches réalisées</p><div className="mt-3 space-y-2">{report.tasks.length ? report.tasks.map((task) => <div className="rounded-lg border border-[#e7ece5] bg-white p-3" key={task.id}><div className="flex flex-wrap items-center justify-between gap-2"><strong className="text-[11px] text-ink">{task.title}</strong><span className={`rounded-full px-2 py-1 text-[9px] font-bold ${task.status === 'Terminée' ? 'bg-[#edf8e9] text-[#4d9352]' : 'bg-[#fff2e2] text-[#bd7737]'}`}>{task.status}</span></div><p className="mt-1 text-[10px] text-[#89968f]">{task.buildingName || 'Bâtiment non précisé'} · {task.completedAt ? `terminée ${formatDateTime(task.completedAt)}` : 'non terminée'} · {task.actualDurationMinutes} min</p>{task.comment && <p className="mt-1 text-[10px] text-[#66766d]">{task.comment}</p>}{(task.waterQuantityLiters !== undefined || task.feedQuantityKg !== undefined) && <p className="mt-1 text-[10px] text-[#6385bd]">{task.waterQuantityLiters !== undefined ? `Eau : ${task.waterQuantityLiters} L · ` : ''}{task.feedQuantityKg !== undefined ? `Aliment : ${task.feedQuantityKg} kg` : ''}</p>}</div>) : <p className="text-[11px] text-[#89968f]">Aucune tâche dans ce rapport.</p>}</div></div>{report.handovers.length > 0 && <div className="rounded-xl border border-[#f0d5ad] bg-[#fffaf2] p-4"><p className="field-label">Transmissions de service</p><div className="mt-3 space-y-2">{report.handovers.map((handover) => <div className="text-[10px] text-[#8d6135]" key={handover.id}><strong>{handover.buildingName}</strong> · {handover.deathsFoundQuantity} mort(s) trouvé(s) · Pédiluve : {handover.footbathReady} · {handover.comment || 'Aucune observation'}</div>)}</div></div>}{report.validationComment && <div className="rounded-xl border border-[#e2d9f0] bg-[#f7f2fc] p-3 text-[11px] text-[#70578f]"><strong>Commentaire RH :</strong> {report.validationComment}</div>}<div className="flex flex-wrap justify-end gap-2"><button type="button" className="btn-secondary" onClick={onClose}>Fermer</button>{report.status !== 'Validé' && <button type="button" className="btn-secondary text-[#b45d5d]" onClick={() => onStatus('À corriger')}>Demander correction</button>}{report.status !== 'Validé' && <button type="button" className="btn-primary" onClick={() => onStatus('Validé')}><Check size={14} /> Valider le rapport</button>}</div></div>;
}

function DetailItem({ label, value }: { label: string; value: string }) { return <div className="rounded-xl border border-[#edf0eb] bg-[#fbfcfa] p-3"><span className="block text-[9px] font-bold uppercase tracking-[.1em] text-[#89968f]">{label}</span><strong className="mt-1 block text-[11px] text-ink">{value}</strong></div>; }

function formatDateTime(value: string) { const date = new Date(value); return Number.isNaN(date.getTime()) ? value : date.toLocaleString('fr-FR', { timeZone: 'Africa/Douala' }); }
