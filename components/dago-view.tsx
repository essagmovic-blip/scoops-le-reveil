'use client';

import { FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, Check, Clock3, ShieldAlert, X } from 'lucide-react';
import { FARM_STORAGE_KEYS, readLocal, subscribeToFarmData, writeLocal } from '@/lib/farm-storage';
import { DEFAULT_HR_SETTINGS, type HRSettings } from '@/components/hr-settings-view';
import { Modal, SectionHeading, StatCard } from '@/components/ui';
import { StatusBadge } from '@/components/status-badge';
import { dagoResponsibility, type DagoCondition, type DagoReport } from '@/lib/dago';

type Feedback = { type: 'success' | 'error'; message: string };

export function DagoView({ onFeedback, buildingIds }: { onFeedback?: (message: string) => void; buildingIds?: string[] }) {
  const [reports, setReports] = useState<DagoReport[]>([]);
  const [settings, setSettings] = useState<Pick<HRSettings, 'dagoGracePeriodMinutes' | 'poultryProductionCostPerBird'>>({ dagoGracePeriodMinutes: DEFAULT_HR_SETTINGS.dagoGracePeriodMinutes, poultryProductionCostPerBird: DEFAULT_HR_SETTINGS.poultryProductionCostPerBird });
  const [receiving, setReceiving] = useState<DagoReport | null>(null);
  const [freshQuantity, setFreshQuantity] = useState(0);
  const [decomposedQuantity, setDecomposedQuantity] = useState(0);
  const [clinicQuantity, setClinicQuantity] = useState(0);
  const [clinicComment, setClinicComment] = useState('');
  const [condition, setCondition] = useState<DagoCondition>('Bon état');
  const [conditionNote, setConditionNote] = useState('');
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [user, setUser] = useState({ id: 'unknown', name: 'Responsable poulets morts' });

  useEffect(() => {
    const cookie = (name: string) => { const part = document.cookie.split('; ').find((item) => item.startsWith(`${name}=`)); return part ? decodeURIComponent(part.slice(name.length + 1)) : ''; };
    setUser({ id: cookie('agroflux_user_id') || 'unknown', name: cookie('agroflux_user_name') || 'Responsable poulets morts' });
    const assignedBuildingIds = parseCookieArray(cookie('agroflux_assigned_buildings'));
    const resolvedBuildingIds = cookie('agroflux_is_admin') === '1' ? undefined : buildingIds ?? (assignedBuildingIds.length ? assignedBuildingIds : undefined);
    const load = () => {
      const allReports = readLocal<DagoReport[]>(FARM_STORAGE_KEYS.dagoReports, []);
      const scopedReports = resolvedBuildingIds?.length ? allReports.filter((report) => resolvedBuildingIds.includes(report.buildingId)) : allReports;
      setReports(scopedReports);
      const hr = { ...DEFAULT_HR_SETTINGS, ...readLocal<Partial<HRSettings>>(FARM_STORAGE_KEYS.rhSettings, {}) };
      setSettings({ dagoGracePeriodMinutes: hr.dagoGracePeriodMinutes, poultryProductionCostPerBird: hr.poultryProductionCostPerBird });
    };
    load();
    return subscribeToFarmData([FARM_STORAGE_KEYS.dagoReports, FARM_STORAGE_KEYS.rhSettings], load);
  }, [buildingIds]);

  const pending = reports.filter((report) => report.status === 'En attente de réception');
  const disputes = reports.filter((report) => report.rhStatus === 'En attente validation RH');
  const received = reports.filter((report) => report.status !== 'En attente de réception').length;
  const buildingConfirmations = reports.filter((report) => report.status === 'En attente confirmation bâtiment').length;
  const goodQuantity = freshQuantity;

  function notify(message: string, type: Feedback['type'] = 'success') {
    setFeedback({ type, message });
    if (type === 'success') onFeedback?.(message);
    window.setTimeout(() => setFeedback(null), 4500);
  }

  function persist(next: DagoReport[]) {
    setReports(next);
    const allReports = readLocal<DagoReport[]>(FARM_STORAGE_KEYS.dagoReports, []);
    const nextById = new Map(next.map((report) => [report.id, report]));
    const merged = allReports.map((report) => nextById.get(report.id) ?? report);
    writeLocal(FARM_STORAGE_KEYS.dagoReports, merged);
  }

  function openReception(report: DagoReport) {
    const fallbackFresh = report.goodQuantity > 0 || report.spoiledQuantity > 0 ? report.goodQuantity : Math.max(report.quantity - report.spoiledQuantity, 0);
    const nextDecomposed = report.decomposedQuantity ?? report.spoiledQuantity ?? 0;
    setReceiving(report);
    setFreshQuantity(report.freshQuantity ?? fallbackFresh);
    setDecomposedQuantity(nextDecomposed);
    setClinicQuantity(report.clinicQuantity ?? 0);
    setClinicComment(report.clinicComment ?? '');
    setCondition(nextDecomposed > 0 ? 'Poulet(s) gâté(s)/abîmé(s)' : 'Bon état');
    setConditionNote(report.conditionNote ?? '');
    setSubmitAttempted(false);
    setFeedback(null);
  }

  function closeReception() {
    setReceiving(null);
    setSubmitAttempted(false);
    setConditionNote('');
    setClinicComment('');
    setFreshQuantity(0);
    setDecomposedQuantity(0);
    setClinicQuantity(0);
    setCondition('Bon état');
  }

  function receiveDeath(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!receiving) return;
    setSubmitAttempted(true);
    const note = conditionNote.trim();
    const totalClassified = freshQuantity + decomposedQuantity + clinicQuantity;
    const hasSpoiled = decomposedQuantity > 0;
    const conditionIsValid = hasSpoiled ? condition === 'Poulet(s) gâté(s)/abîmé(s)' : condition === 'Bon état';
    if (totalClassified !== receiving.quantity) {
      notify(`La répartition doit totaliser exactement ${receiving.quantity} sujet(s). Total saisi : ${totalClassified}.`, 'error');
      return;
    }
    if (clinicQuantity > 0 && !clinicComment.trim()) {
      notify('Le commentaire clinique est obligatoire lorsqu’un sujet est envoyé en clinique.', 'error');
      return;
    }
    if (!conditionIsValid || !note && hasSpoiled) {
      notify(hasSpoiled ? 'Décrivez obligatoirement l’observation des sujets décomposés avant de valider.' : 'Indiquez un état cohérent avec la répartition saisie.', 'error');
      return;
    }

    const now = new Date().toISOString();
    const receiver = user;
    const responsibility = dagoResponsibility({ ...receiving, receivedById: receiver.id, receivedByName: receiver.name }, now, decomposedQuantity);
    const dispute = hasSpoiled;
    const nextReport: DagoReport = {
      ...receiving,
      receivedAt: now,
      receivedById: receiver.id,
      receivedByName: receiver.name,
      goodQuantity: freshQuantity,
      spoiledQuantity: decomposedQuantity,
      decomposedQuantity,
      freshQuantity,
      clinicQuantity,
      clinicComment: clinicComment.trim(),
      condition,
      conditionNote: note,
      responsibleId: '',
      responsibleName: '',
      proposedResponsibleId: dispute ? responsibility.id : '',
      proposedResponsibleName: dispute ? responsibility.name : '',
      amount: dispute ? decomposedQuantity * receiving.productionCostPerBird : 0,
      buildingConfirmationStatus: 'En attente',
      buildingConfirmedAt: '',
      buildingConfirmedById: '',
      buildingConfirmedByName: '',
      buildingConfirmationComment: '',
      status: 'En attente confirmation bâtiment',
      rhStatus: 'Aucune',
    };
    persist(reports.map((report) => report.id === receiving.id ? nextReport : report));
    closeReception();
    notify(dispute ? `Litige Poulets morts transmis à RH. Responsabilité proposée : ${responsibility.name}.` : 'Réception Poulets morts validée : bon état, aucune alerte générée.');
  }

  return <div className="space-y-6"><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><StatCard label="En attente de réception" value={String(pending.length)} change="signalements bâtiment" detail="à constater" icon={Clock3} tone="orange" /><StatCard label="Réceptions traitées" value={String(received)} change="historique Poulets morts" detail="bon état ou litiges" icon={Check} tone="green" /><StatCard label="Litiges à valider RH" value={String(disputes.length)} change={disputes.length ? 'Action RH' : 'Aucun'} detail="après confirmation bâtiment" icon={ShieldAlert} tone="purple" /><StatCard label="Confirmations attendues" value={String(buildingConfirmations)} change={buildingConfirmations ? 'Action bâtiment' : 'Aucune'} detail="à confirmer dans Bâtiments" icon={Clock3} tone="blue" /></div><div className="flex items-center justify-between"><SectionHeading eyebrow="Poulets morts · mortalités" title="Réception des poulets morts" description={`Délai de grâce : ${settings.dagoGracePeriodMinutes} min · coût de référence : ${settings.poultryProductionCostPerBird} FCFA / poulet`} /></div>{feedback && <div className={`flex items-start gap-2 rounded-xl px-4 py-3 text-[11px] font-semibold ${feedback.type === 'error' ? 'border border-[#f0c9c5] bg-[#fff4f3] text-[#b85b59]' : 'border border-[#cde8c7] bg-[#effaeb] text-[#4d8f51]'}`}>{feedback.type === 'error' ? <AlertTriangle size={15} className="mt-0.5 shrink-0" /> : <Check size={15} className="mt-0.5 shrink-0" />}{feedback.message}</div>}<div className="surface overflow-hidden"><div className="divide-y divide-[#edf0eb]">{reports.length ? reports.map((report) => <div key={report.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:px-6"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#fff2e2] text-[#bd7737]"><AlertTriangle size={17} /></div><div className="min-w-0 flex-1"><strong className="block text-[12px] text-ink">{report.id} · {report.quantity} poulet(s) · {report.buildingName} · origine : {report.sourceLocation === 'clinique' ? 'Clinique' : 'Grande salle'}</strong><p className="mt-1 text-[10px] text-[#89968f]">Signalé par {report.reportedByName} le {new Date(report.reportedAt).toLocaleString('fr-FR')} · grâce jusqu’à {new Date(report.graceDeadline).toLocaleString('fr-FR')}</p>{report.receivedAt && <p className="mt-1 text-[10px] text-[#66766d]">Reçu par {report.receivedByName} · {report.freshQuantity ?? report.goodQuantity} frais · {report.decomposedQuantity ?? report.spoiledQuantity} décomposé(s) · {report.clinicQuantity ?? 0} clinique(s) · {report.proposedResponsibleName ? `proposition : ${report.proposedResponsibleName}` : 'aucune responsabilité'}</p>}{report.buildingConfirmedAt && <p className="mt-1 text-[10px] text-[#5b8f60]">Confirmé par {report.buildingConfirmedByName} le {new Date(report.buildingConfirmedAt).toLocaleString('fr-FR')}</p>}</div><div className="flex flex-wrap items-center justify-end gap-2"><StatusBadge status={report.status} />{report.status === 'En attente de réception' && <button className="btn-primary px-2.5 py-1.5 text-[10px]" onClick={() => openReception(report)}>Réceptionner</button>}{report.status === 'En attente confirmation bâtiment' && <Link href="/poulets/batiments" className="rounded-full bg-[#fff2e2] px-2 py-1 text-[9px] font-bold text-[#bd7737] hover:underline">Confirmer dans Bâtiments</Link>}</div></div>) : <p className="px-6 py-14 text-center text-[11px] text-[#89968f]">Aucun signalement de mortalité.</p>}</div></div><Modal open={Boolean(receiving)} onClose={closeReception} title="Réceptionner le signalement Poulets morts">{receiving && <form onSubmit={receiveDeath} className="space-y-5"><div className="rounded-xl border border-[#edf0eb] bg-[#fbfcfa] p-4 text-[11px]">{receiving.id} · {receiving.quantity} poulet(s) · {receiving.sourceLocation === 'clinique' ? 'Clinique' : 'Grande salle'} · signalé à {new Date(receiving.reportedAt).toLocaleString('fr-FR')}</div><div className="rounded-xl border border-[#dce8db] bg-[#f6faf4] p-4"><p className="field-label">Répartition détaillée de la mortalité</p><p className="mb-3 text-[10px] leading-5 text-[#718078]">Répartissez exactement le signalement entre sujets frais, sujets décomposés et sujets mis en clinique.</p><div className="grid gap-4 sm:grid-cols-3"><label className="block"><span className="field-label">Sujets frais</span><input name="freshQuantity" type="number" min="0" max={receiving.quantity} value={freshQuantity} onChange={(event) => setFreshQuantity(Math.min(receiving.quantity, Math.max(0, Number(event.target.value) || 0)))} className="input-base" required /></label><label className="block"><span className="field-label">Sujets décomposés</span><input name="decomposedQuantity" type="number" min="0" max={receiving.quantity} value={decomposedQuantity} onChange={(event) => { const value = Math.min(receiving.quantity, Math.max(0, Number(event.target.value) || 0)); setDecomposedQuantity(value); setCondition(value > 0 ? 'Poulet(s) gâté(s)/abîmé(s)' : 'Bon état'); }} className="input-base" required /></label><label className="block"><span className="field-label">Sujets mis en clinique</span><input name="clinicQuantity" type="number" min="0" max={receiving.quantity} value={clinicQuantity} onChange={(event) => setClinicQuantity(Math.min(receiving.quantity, Math.max(0, Number(event.target.value) || 0)))} className="input-base" required /></label></div><p className={`mt-3 rounded-lg px-3 py-2 text-[10px] font-bold ${freshQuantity + decomposedQuantity + clinicQuantity === receiving.quantity ? 'bg-[#edf8e9] text-[#4d9352]' : 'bg-[#fff2e2] text-[#bd7737]'}`}>Total réparti : {freshQuantity + decomposedQuantity + clinicQuantity} / {receiving.quantity} sujet(s)</p>{clinicQuantity > 0 && <label className="mt-3 block"><span className="field-label">Commentaire clinique obligatoire</span><textarea name="clinicComment" value={clinicComment} onChange={(event) => setClinicComment(event.target.value)} className="input-base min-h-[80px] resize-none" required placeholder="Motif, observation et consigne de suivi clinique…" /></label>}</div>
<label className="block"><span className="field-label">Observation des sujets décomposés <strong className="text-[#b85b59]">{decomposedQuantity > 0 ? '*' : ''}</strong></span><textarea name="conditionNote" value={conditionNote} onChange={(event) => setConditionNote(event.target.value)} className={`input-base min-h-[80px] resize-none ${submitAttempted && decomposedQuantity > 0 && !conditionNote.trim() ? 'border-[#d9706b] bg-[#fff4f3]' : ''}`} required={decomposedQuantity > 0} aria-required={decomposedQuantity > 0} placeholder={decomposedQuantity > 0 ? 'Décrivez précisément l’état observé…' : 'Facultatif si aucun sujet n’est décomposé'} /></label><div className="flex justify-end gap-2"><button type="button" className="btn-secondary" onClick={closeReception}><X size={14} /> Annuler</button><button type="submit" className="btn-primary"><Check size={15} /> Valider la réception</button></div></form>}</Modal></div>;
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
