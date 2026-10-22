'use client';

import { FormEvent, useEffect, useState } from 'react';
import { AlertTriangle, Check, Clock3, X } from 'lucide-react';
import { Modal, SectionHeading } from '@/components/ui';
import { StatusBadge } from '@/components/status-badge';
import { FARM_STORAGE_KEYS, readLocal, subscribeToFarmData, writeLocal } from '@/lib/farm-storage';
import { formatNumber } from '@/lib/format';
import type { DagoReport } from '@/lib/dago';

type Feedback = { type: 'success' | 'error'; message: string };

export function BuildingDeadBirdConfirmations() {
  const [reports, setReports] = useState<DagoReport[]>([]);
  const [selectedReport, setSelectedReport] = useState<DagoReport | null>(null);
  const [comment, setComment] = useState('');
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [assignedBuildings, setAssignedBuildings] = useState<string[] | null>(null);
  const [user, setUser] = useState({ id: 'unknown', name: 'Responsable bâtiment' });

  useEffect(() => {
    const cookie = (name: string) => {
      const part = document.cookie.split('; ').find((item) => item.startsWith(`${name}=`));
      return part ? decodeURIComponent(part.slice(name.length + 1)) : '';
    };
    setUser({ id: cookie('agroflux_user_id') || 'unknown', name: cookie('agroflux_user_name') || 'Responsable bâtiment' });
    try {
      setAssignedBuildings(cookie('agroflux_is_admin') === '1' ? null : parseCookieArray(cookie('agroflux_assigned_buildings')));
    } catch {
      setAssignedBuildings([]);
    }
    const load = () => setReports(readLocal<DagoReport[]>(FARM_STORAGE_KEYS.dagoReports, []));
    load();
    return subscribeToFarmData([FARM_STORAGE_KEYS.dagoReports], load);
  }, []);

  const visibleReports = reports.filter((report) => canConfirm(report));
  const today = businessDate(new Date());
  const reportsToday = visibleReports.filter((report) => reportDay(report) === today);
  const reportedQuantityToday = reportsToday.reduce((sum, report) => sum + Math.max(0, Number(report.quantity) || 0), 0);
  const awaitingReceptionToday = reportsToday.filter((report) => report.status === 'En attente de réception').reduce((sum, report) => sum + Math.max(0, Number(report.quantity) || 0), 0);
  const awaitingConfirmationToday = reportsToday.filter((report) => report.status === 'En attente confirmation bâtiment').reduce((sum, report) => sum + Math.max(0, Number(report.quantity) || 0), 0);
  const pendingReports = reports.filter((report) => report.status === 'En attente confirmation bâtiment' && canConfirm(report));

  function canConfirm(report: DagoReport) {
    if (assignedBuildings === null) return true;
    return !assignedBuildings.length || assignedBuildings.includes(report.buildingId);
  }

  function notify(message: string, type: Feedback['type'] = 'success') {
    setFeedback({ type, message });
    window.setTimeout(() => setFeedback(null), 4500);
  }

  function openConfirmation(report: DagoReport) {
    setSelectedReport(report);
    setComment('');
    setFeedback(null);
  }

  function closeConfirmation() {
    setSelectedReport(null);
    setComment('');
  }

  function confirmReception(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedReport || !canConfirm(selectedReport)) {
      notify('Seul le responsable du bâtiment concerné peut confirmer cette réception.', 'error');
      return;
    }
    const now = new Date().toISOString();
    const hasSpoiled = selectedReport.spoiledQuantity > 0;
    const nextReport: DagoReport = {
      ...selectedReport,
      buildingConfirmationStatus: 'Confirmé',
      buildingConfirmedAt: now,
      buildingConfirmedById: user.id,
      buildingConfirmedByName: user.name,
      buildingConfirmationComment: comment.trim(),
      status: hasSpoiled ? 'Litige en attente RH' : 'Réceptionné bon état',
      rhStatus: hasSpoiled ? 'En attente validation RH' : 'Aucune',
    };
    const next = reports.map((report) => report.id === selectedReport.id ? nextReport : report);
    setReports(next);
    writeLocal(FARM_STORAGE_KEYS.dagoReports, next);
    closeConfirmation();
    notify(hasSpoiled ? 'La confirmation du bâtiment est enregistrée. Le dossier est transmis à RH.' : 'La confirmation du bâtiment est enregistrée. Le dossier est clôturé en bon état.');
  }

  return (
    <section className="surface overflow-hidden">
      <div className="border-b border-[#edf0eb] px-5 py-5 sm:px-6">
        <SectionHeading eyebrow="Poulets morts · étape bâtiment" title="Confirmations à effectuer" description="Après la réception par le responsable des poulets morts, le responsable du bâtiment confirme ici les quantités et les observations." />
      </div>
      <div className="border-b border-[#f0e4d3] bg-[#fffaf2] px-5 py-4 sm:px-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#fff0d8] text-[#bd7737]"><AlertTriangle size={18} /></span>
            <div><p className="text-[12px] font-bold text-[#8d6135]">Compteur quotidien des mortalités</p><p className="mt-1 text-[10px] leading-4 text-[#a1784e]">Total des poulets morts signalés aujourd’hui dans vos bâtiments, quel que soit leur état de traitement.</p></div>
          </div>
          <div className="flex items-baseline gap-2 rounded-xl border border-[#f0d5ad] bg-white px-4 py-2.5"><strong className="text-[24px] font-black tracking-[-.05em] text-[#a8672f]">{formatNumber(reportedQuantityToday)}</strong><span className="text-[10px] font-bold text-[#9a7652]">mort(s) signalé(s)</span></div>
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-3"><div className="rounded-lg border border-[#f3e6d4] bg-white/75 px-3 py-2"><span className="block text-[9px] font-bold uppercase tracking-[.1em] text-[#a1784e]">Signalements du jour</span><strong className="mt-1 block text-[13px] text-[#8d6135]">{reportsToday.length}</strong></div><div className="rounded-lg border border-[#f3e6d4] bg-white/75 px-3 py-2"><span className="block text-[9px] font-bold uppercase tracking-[.1em] text-[#a1784e]">À réceptionner</span><strong className="mt-1 block text-[13px] text-[#8d6135]">{formatNumber(awaitingReceptionToday)} poulet(s)</strong></div><div className="rounded-lg border border-[#f3e6d4] bg-white/75 px-3 py-2"><span className="block text-[9px] font-bold uppercase tracking-[.1em] text-[#a1784e]">À confirmer ici</span><strong className="mt-1 block text-[13px] text-[#8d6135]">{formatNumber(awaitingConfirmationToday)} poulet(s)</strong></div></div>
      </div>
      {feedback && <div className={`mx-5 mt-4 flex items-start gap-2 rounded-xl px-4 py-3 text-[11px] font-semibold sm:mx-6 ${feedback.type === 'error' ? 'border border-[#f0c9c5] bg-[#fff4f3] text-[#b85b59]' : 'border border-[#cde8c7] bg-[#effaeb] text-[#4d8f51]'}`}><Check size={15} className="mt-0.5 shrink-0" />{feedback.message}</div>}
      <div className="divide-y divide-[#edf0eb]">
        {pendingReports.length ? pendingReports.map((report) => (
          <div key={report.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:px-6">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#fff2e2] text-[#bd7737]"><Clock3 size={17} /></div>
            <div className="min-w-0 flex-1">
              <strong className="block text-[12px] text-ink">{report.id} · {report.buildingName} · origine : {report.sourceLocation === 'clinique' ? 'Clinique' : 'Grande salle'} · {report.decomposedQuantity ?? report.spoiledQuantity} décomposé(s) · {report.clinicQuantity ?? 0} clinique(s)</strong>
              <p className="mt-1 text-[10px] text-[#89968f]">Réceptionné par {report.receivedByName} · {report.goodQuantity} bon(s) · {report.spoiledQuantity} gâté(s)</p>
              <p className="mt-1 text-[10px] text-[#66766d]">Signalé par {report.reportedByName} · {new Date(report.receivedAt).toLocaleString('fr-FR')}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2"><StatusBadge status="En attente confirmation bâtiment" /><button type="button" className="btn-primary px-2.5 py-1.5 text-[10px]" onClick={() => openConfirmation(report)}><Check size={13} /> Confirmer</button></div>
          </div>
        )) : <div className="flex items-center gap-3 px-5 py-8 text-[11px] text-[#89968f] sm:px-6"><Check size={16} className="text-[#5b9d5b]" />Aucune confirmation de poulets morts ne vous attend.</div>}
      </div>
      <Modal open={Boolean(selectedReport)} onClose={closeConfirmation} title="Confirmer côté bâtiment">
        {selectedReport && <form onSubmit={confirmReception} className="space-y-5">
          <div className="rounded-xl border border-[#e1ebe0] bg-[#f6faf4] p-4 text-[11px]"><strong>{selectedReport.id} · {selectedReport.buildingName}</strong><p className="mt-1 text-[#718078]">Le responsable des poulets morts a réceptionné {selectedReport.goodQuantity} bon(s) et {selectedReport.spoiledQuantity} gâté(s), signalés par {selectedReport.reportedByName}.</p><p className="mt-1 text-[#718078]">Responsabilité proposée : {selectedReport.proposedResponsibleName || 'aucune'}.</p></div>
          <label className="block"><span className="field-label">Observation du responsable bâtiment</span><textarea name="comment" value={comment} onChange={(event) => setComment(event.target.value)} className="input-base min-h-[100px] resize-none" placeholder="Décrivez ce que vous confirmez ou toute différence constatée…" /></label>
          <div className="rounded-xl border border-[#dce8db] bg-[#f5faf2] px-3 py-3 text-[10px] leading-5 text-[#5b8f60]">Cette confirmation est enregistrée avec votre identité et l’heure exacte. Un éventuel litige sera ensuite traité par RH.</div>
          <div className="flex justify-end gap-2"><button type="button" className="btn-secondary" onClick={closeConfirmation}><X size={14} /> Annuler</button><button type="submit" className="btn-primary"><Check size={15} /> Confirmer la réception</button></div>
        </form>}
      </Modal>
    </section>
  );
}

function reportDay(report: Pick<DagoReport, 'reportedAt' | 'reportedDate'>) {
  const reportedAt = new Date(report.reportedAt);
  return Number.isNaN(reportedAt.getTime()) ? report.reportedDate : businessDate(reportedAt);
}

function businessDate(value: Date) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Douala' }).format(value);
}

function parseCookieArray(value: string) {
  if (!value) return [];
  let current = value;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const parsed = JSON.parse(current) as unknown;
      return Array.isArray(parsed) ? parsed.map(String) : [];
    } catch {
      try { current = decodeURIComponent(current); } catch { return []; }
    }
  }
  return [];
}
