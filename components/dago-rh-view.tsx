'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import autoTable from 'jspdf-autotable';
import jsPDF from 'jspdf';
import { Check, Download, Eye, FileText, Search, ShieldAlert, UserCheck, X } from 'lucide-react';
import { FARM_STORAGE_KEYS, readLocal, subscribeToFarmData, writeLocal } from '@/lib/farm-storage';
import { Modal, SectionHeading, StatCard } from '@/components/ui';
import { StatusBadge } from '@/components/status-badge';
import { addPdfFooter, addPdfLetterhead } from '@/lib/pdf-letterhead';
import type { DagoReport } from '@/lib/dago';

type Decision = 'approve' | 'reject';
type Feedback = { type: 'success' | 'error'; message: string };
type ResponsibilityCandidate = { id: string; name: string; label: string };

export function DagoRHView() {
  const [reports, setReports] = useState<DagoReport[]>([]);
  const [selected, setSelected] = useState<DagoReport | null>(null);
  const [detailsReport, setDetailsReport] = useState<DagoReport | null>(null);
  const [decision, setDecision] = useState<Decision | null>(null);
  const [responsibleId, setResponsibleId] = useState('');
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('Tous');
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  useEffect(() => {
    const load = () => setReports(readLocal<DagoReport[]>(FARM_STORAGE_KEYS.dagoReports, []));
    load();
    return subscribeToFarmData([FARM_STORAGE_KEYS.dagoReports], load);
  }, []);

  const pending = reports.filter((report) => report.rhStatus === 'En attente validation RH');
  const filteredReports = useMemo(() => reports.filter((report) => (statusFilter === 'Tous' || report.status === statusFilter) && `${report.id} ${report.buildingName} ${report.batchId} ${report.reportedByName} ${report.receivedByName} ${report.responsibleName}`.toLowerCase().includes(query.trim().toLowerCase())), [reports, statusFilter, query]);

  function notify(message: string, type: Feedback['type'] = 'success') {
    setFeedback({ type, message });
    window.setTimeout(() => setFeedback(null), 4500);
  }

  function openDecision(report: DagoReport, nextDecision: Decision) {
    setSelected(report);
    setDecision(nextDecision);
    setResponsibleId('');
    setFeedback(null);
  }

  function closeDecision() {
    setSelected(null);
    setDecision(null);
    setResponsibleId('');
  }

  function saveDecision(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected || !decision) return;
    if (selected.buildingConfirmationStatus !== 'Confirmé') {
      notify('La confirmation du responsable bâtiment dans la rubrique Bâtiments est obligatoire avant la décision RH.', 'error');
      return;
    }
    const comment = String(new FormData(event.currentTarget).get('comment') ?? '').trim();
    if (!comment) {
      notify('Le commentaire RH est obligatoire pour conserver la justification de la décision.', 'error');
      return;
    }
    const candidates = responsibilityCandidates(selected);
    const responsible = candidates.find((candidate) => candidate.id === responsibleId);
    if (decision === 'approve' && !responsible) {
      notify('Choisissez la personne à qui imputer la perte avant de valider l’imputation.', 'error');
      return;
    }
    const status = decision === 'approve' ? 'Validé RH' : 'Rejeté RH';
    const next = reports.map((report) => report.id === selected.id ? {
      ...report,
      responsibleId: decision === 'approve' ? responsible!.id : '',
      responsibleName: decision === 'approve' ? responsible!.name : '',
      amount: decision === 'approve' ? decomposedQuantity(report) * report.productionCostPerBird : 0,
      rhStatus: status as DagoReport['rhStatus'],
      status: status as DagoReport['status'],
      rhComment: comment,
      rhValidatedAt: new Date().toISOString(),
    } : report);
    setReports(next);
    writeLocal(FARM_STORAGE_KEYS.dagoReports, next);
    closeDecision();
    notify(decision === 'approve' ? `Imputation validée sur ${responsible!.name}. La retenue peut maintenant être prise en compte en paie.` : 'Litige rejeté : aucune perte ne sera imputée.', 'success');
  }

  async function downloadHistoryPdf() {
    try {
      const doc = new jsPDF({ unit: 'mm', format: 'a4' });
      const start = await addPdfLetterhead(doc, { title: 'Historique Poulets morts · RH', reference: `EXPORT-${new Date().toISOString().slice(0, 10)}`, context: [`${reports.length} signalement(s)`, `${pending.length} litige(s) en attente`] });
      autoTable(doc, { startY: start, head: [['Référence', 'Signalement', 'Bâtiment / bande', 'Qté', 'Réception', 'État', 'Responsable', 'RH']], body: reports.map((report) => [report.id, formatDateTime(report.reportedAt), `${report.buildingName} · ${report.batchId || '—'} · ${report.sourceLocation === 'clinique' ? 'Clinique' : 'Grande salle'}`, `${report.quantity}`, report.receivedAt ? formatDateTime(report.receivedAt) : 'En attente', report.receivedAt ? `Frais : ${freshQuantity(report)} · Décomposés : ${decomposedQuantity(report)} · Clinique : ${clinicQuantity(report)}` : '—', report.responsibleName || `Proposition : ${report.proposedResponsibleName || 'À décider'}`, report.rhStatus]), styles: { fontSize: 6.5, cellPadding: 2 }, headStyles: { fillColor: [25, 56, 46], textColor: 255 }, alternateRowStyles: { fillColor: [248, 251, 247] }, margin: { left: 14, right: 14 } });
      const summaryEnd = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? start + 12;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(25, 56, 46);
      doc.text('Traçabilité détaillée', 14, summaryEnd + 12);
      autoTable(doc, { startY: summaryEnd + 17, head: [['Référence', 'Étape', 'Détails']], body: reports.flatMap((report) => [[report.id, 'Signalement', `${report.reportedByName} · ${formatDateTime(report.reportedAt)} · ${report.quantity} poulet(s)`], [report.id, 'Réception Poulets morts', report.receivedAt ? `${report.receivedByName} · ${formatDateTime(report.receivedAt)} · ${report.conditionNote || 'Sans observation'}` : 'Non réceptionné'], [report.id, 'Délai signalement → réception', elapsedBetween(report.reportedAt, report.receivedAt)], [report.id, 'Délai réception → confirmation', elapsedBetween(report.receivedAt, report.buildingConfirmedAt ?? '')], [report.id, 'Confirmation bâtiment', report.buildingConfirmationStatus === 'Confirmé' ? `${report.buildingConfirmedByName} · ${formatDateTime(report.buildingConfirmedAt ?? '')} · ${report.buildingConfirmationComment || 'Sans commentaire'}` : 'En attente de confirmation'], [report.id, 'Décision RH', `${report.rhStatus} · ${report.responsibleName || 'Aucune imputation'} · ${report.rhComment || 'Sans commentaire'}`]]), styles: { fontSize: 7, cellPadding: 2.5 }, headStyles: { fillColor: [91, 157, 91], textColor: 255 }, alternateRowStyles: { fillColor: [250, 252, 249] }, margin: { left: 14, right: 14 } });
      addPdfFooter(doc, 'Historique Poulets morts · RH · SCOOPS LE REVEIL');
      doc.save(`historique-dago-rh-${new Date().toISOString().slice(0, 10)}.pdf`);
      notify('L’historique Poulets morts complet a été téléchargé en PDF.');
    } catch {
      notify('Impossible de générer le PDF de l’historique Poulets morts.', 'error');
    }
  }

  async function downloadReportPdf(report: DagoReport) {
    try {
      const doc = new jsPDF({ unit: 'mm', format: 'a4' });
      const start = await addPdfLetterhead(doc, { title: 'Fiche Poulets morts · RH', reference: report.id, context: [`Bâtiment : ${report.buildingName}`, `Origine : ${report.sourceLocation === 'clinique' ? 'Clinique' : 'Grande salle'}`, `Statut : ${report.status}`] });
      autoTable(doc, { startY: start, head: [['Rubrique', 'Information']], body: [
        ['Signalement', `${report.reportedByName} · ${formatDateTime(report.reportedAt)}`],
        ['Bâtiment / bande', `${report.buildingName} · ${report.batchId || '—'} · ${report.sourceLocation === 'clinique' ? 'Clinique' : 'Grande salle'}`],
        ['Quantité signalée', `${report.quantity} poulet(s)`],
        ['Délai de grâce', formatDateTime(report.graceDeadline)],
        ['Réception Poulets morts', report.receivedAt ? `${report.receivedByName} · ${formatDateTime(report.receivedAt)}` : 'Non réceptionné'],
        ['Temps signalement → réception', elapsedBetween(report.reportedAt, report.receivedAt)],
        ['Temps réception → confirmation', elapsedBetween(report.receivedAt, report.buildingConfirmedAt ?? '')],
        ['Confirmation bâtiment', report.buildingConfirmationStatus === 'Confirmé' ? `${report.buildingConfirmedByName} · ${formatDateTime(report.buildingConfirmedAt ?? '')}` : 'En attente de confirmation'],
        ['Observation bâtiment', report.buildingConfirmationComment || '—'],
        ['État constaté', report.receivedAt ? `Frais : ${freshQuantity(report)} · décomposés : ${decomposedQuantity(report)} · clinique : ${clinicQuantity(report)} · ${report.condition}` : '—'],
        ['Observation', report.conditionNote || '—'],
        ['Responsable imputé', report.responsibleName || 'Aucune imputation'],
        ['Responsable proposé', report.proposedResponsibleName || '—'],
        ['Montant', `${formatNumber(report.amount)} FCFA`],
        ['Décision RH', `${report.rhStatus} · ${report.rhValidatedAt ? formatDateTime(report.rhValidatedAt) : '—'}`],
        ['Commentaire RH', report.rhComment || '—'],
      ], styles: { fontSize: 8, cellPadding: 3 }, headStyles: { fillColor: [25, 56, 46], textColor: 255 }, alternateRowStyles: { fillColor: [248, 251, 247] }, columnStyles: { 0: { fontStyle: 'bold', cellWidth: 42 }, 1: { cellWidth: 138 } }, margin: { left: 14, right: 14 } });
      addPdfFooter(doc, 'Fiche Poulets morts · RH · SCOOPS LE REVEIL');
      doc.save(`${report.id}-dago-rh.pdf`);
      notify(`La fiche ${report.id} a été téléchargée en PDF.`);
    } catch {
      notify('Impossible de générer la fiche PDF Poulets morts.', 'error');
    }
  }

  return <div className="fade-in space-y-6"><div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between"><div><p className="eyebrow mb-2">Poulets morts · contrôle RH</p><h1 className="page-title">Litiges et historique Poulets morts</h1><p className="muted mt-2 max-w-3xl text-[13px]">RH choisit explicitement la personne à imputer avant toute validation. Chaque signalement, réception et décision reste consultable et exportable.</p></div><button className="btn-primary" onClick={() => void downloadHistoryPdf()}><Download size={15} /> Télécharger l’historique PDF</button></div>{feedback && <div className={`flex items-start gap-2 rounded-xl px-4 py-3 text-[11px] font-semibold ${feedback.type === 'error' ? 'border border-[#f0c9c5] bg-[#fff4f3] text-[#b85b59]' : 'border border-[#cde8c7] bg-[#effaeb] text-[#4d8f60]'}`}>{feedback.type === 'error' ? <ShieldAlert size={15} className="mt-0.5 shrink-0" /> : <Check size={15} className="mt-0.5 shrink-0" />}{feedback.message}</div>}<div className="grid gap-4 sm:grid-cols-3"><StatCard label="Litiges Poulets morts" value={String(pending.length)} change={pending.length ? 'À décider' : 'Aucun'} detail="validation RH" icon={ShieldAlert} tone="orange" /><StatCard label="Imputations validées" value={String(reports.filter((report) => report.rhStatus === 'Validé RH').length)} change="Paie possible" detail="historique" icon={UserCheck} tone="green" /><StatCard label="Imputations rejetées" value={String(reports.filter((report) => report.rhStatus === 'Rejeté RH').length)} change="Aucune retenue" detail="décisions RH" icon={ShieldAlert} tone="purple" /></div><div className="surface overflow-hidden"><div className="border-b border-[#edf0eb] px-5 py-5 sm:px-6"><SectionHeading eyebrow="À traiter" title="Litiges en attente de décision" description="Sélectionnez le responsable de la perte avant de confirmer l’imputation." /></div><div className="divide-y divide-[#edf0eb]">{pending.length ? pending.map((report) => <div key={report.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:px-6"><div className="min-w-0 flex-1"><strong className="text-[12px] text-ink">{report.id} · {decomposedQuantity(report)} sujet(s) décomposé(s)</strong><p className="mt-1 text-[10px] text-[#89968f]">{report.buildingName} · origine : {report.sourceLocation === 'clinique' ? 'Clinique' : 'Grande salle'} · signalé par {report.reportedByName} · réceptionné par {report.receivedByName}</p><p className="mt-1 text-[10px] text-[#66766d]">Confirmation bâtiment : {report.buildingConfirmationStatus === 'Confirmé' ? `${report.buildingConfirmedByName} · ${formatDateTime(report.buildingConfirmedAt ?? '')}` : 'non renseignée'} · proposition : {report.proposedResponsibleName || report.responsibleName || 'À déterminer'} · montant : {formatNumber(report.amount)} FCFA</p><p className="mt-1 text-[10px] font-semibold text-[#6385bd]">Temps signalement → réception : {elapsedBetween(report.reportedAt, report.receivedAt)} · réception → confirmation bâtiment : {elapsedBetween(report.receivedAt, report.buildingConfirmedAt ?? '')}</p></div><div className="flex flex-wrap gap-2"><button className="btn-primary px-3 py-1.5 text-[10px]" onClick={() => openDecision(report, 'approve')}>Choisir et valider</button><button className="btn-secondary px-3 py-1.5 text-[10px]" onClick={() => openDecision(report, 'reject')}>Rejeter le litige</button><button className="icon-btn h-8 w-8" onClick={() => setDetailsReport(report)} aria-label="Voir la traçabilité"><Eye size={14} /></button></div></div>) : <p className="px-6 py-14 text-center text-[11px] text-[#89968f]">Aucun litige Poulets morts à valider.</p>}</div></div><div className="surface overflow-hidden"><div className="border-b border-[#edf0eb] px-5 py-5 sm:px-6"><div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between"><SectionHeading eyebrow="Traçabilité complète" title="Historique de tous les signalements" description="Les dossiers validés, rejetés et encore en attente restent disponibles pour contrôle et export." /><div className="flex flex-wrap gap-2"><div className="relative"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9aa59f]" /><input className="input-base h-9 pl-9 text-[11px]" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Référence, bâtiment, personne…" /></div><select className="input-base h-9 w-auto text-[11px]" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option>Tous</option><option>En attente de réception</option><option>Litige en attente RH</option><option>Validé RH</option><option>Rejeté RH</option><option>Réceptionné bon état</option></select></div></div></div><div className="table-scroll"><table className="w-full min-w-[960px] text-left"><thead><tr className="table-head"><th>Référence</th><th>Signalement</th><th>Réception</th><th>Répartition</th><th>Responsabilité</th><th>Décision RH</th><th>Traçabilité</th></tr></thead><tbody>{filteredReports.length ? filteredReports.map((report) => <tr key={report.id} className="table-row table-line"><td><strong className="text-ink">{report.id}</strong><small className="mt-1 block text-[10px] text-[#89968f]">{report.buildingName} · {report.batchId || '—'}</small></td><td><span className="text-[10px]">{formatDateTime(report.reportedAt)}</span><small className="mt-1 block text-[10px] text-[#89968f]">{report.reportedByName}</small></td><td><span className="text-[10px]">{report.receivedAt ? formatDateTime(report.receivedAt) : 'En attente'}</span><small className="mt-1 block text-[10px] text-[#89968f]">{report.receivedByName || '—'}</small></td><td>{report.receivedAt ? <span className="text-[10px]">{freshQuantity(report)} frais<br /><strong className={decomposedQuantity(report) > 0 ? 'text-[#bd5c5c]' : 'text-[#5b9d5b]'}>{decomposedQuantity(report)} décomposé(s)</strong><br /><span className="text-[#8066a6]">{clinicQuantity(report)} clinique(s)</span></span> : '—'}</td><td><span className="text-[10px] font-semibold">{report.responsibleName || 'À décider'}</span><small className="mt-1 block text-[10px] text-[#89968f]">Proposition : {report.proposedResponsibleName || '—'}</small>{report.amount > 0 && <small className="mt-1 block text-[10px] text-[#bd5c5c]">{formatNumber(report.amount)} FCFA</small>}</td><td><StatusBadge status={report.rhStatus === 'Aucune' ? report.status : report.rhStatus} /><small className="mt-1 block max-w-[190px] truncate text-[10px] text-[#89968f]">{report.rhComment || '—'}</small></td><td><div className="flex gap-1"><button className="btn-secondary px-2 py-1.5 text-[10px]" onClick={() => setDetailsReport(report)}><Eye size={13} /> Voir</button><button className="icon-btn h-8 w-8" onClick={() => void downloadReportPdf(report)} aria-label="Télécharger la fiche PDF"><FileText size={14} /></button></div></td></tr>) : <tr><td colSpan={7} className="px-6 py-14 text-center text-[11px] text-[#89968f]">Aucun dossier Poulets morts dans cet historique.</td></tr>}</tbody></table></div></div><Modal open={Boolean(selected && decision)} onClose={closeDecision} title={decision === 'approve' ? 'Choisir le responsable et valider' : 'Rejeter le litige Poulets morts'}>{selected && <form onSubmit={saveDecision} className="space-y-5"><div className="rounded-xl border border-[#f0d5d2] bg-[#fff8f7] p-4 text-[11px]"><strong>{selected.id} · {decomposedQuantity(selected)} sujet(s) décomposé(s)</strong><p className="mt-1 text-[#718078]">{selected.buildingName} · origine : {selected.sourceLocation === 'clinique' ? 'Clinique' : 'Grande salle'} · signalement par {selected.reportedByName} · réception par {selected.receivedByName}.</p></div><div className="rounded-xl border border-[#dce5f0] bg-[#f7fbff] p-4 text-[11px]"><p className="font-bold text-[#526f91]">Commentaires à examiner avant la décision</p><div className="mt-3 grid gap-3 sm:grid-cols-2"><div className="rounded-lg border border-[#e1ebf5] bg-white px-3 py-2.5"><span className="block text-[9px] font-bold uppercase tracking-[.1em] text-[#8297ad]">Observation à la réception</span><p className="mt-1 whitespace-pre-wrap leading-5 text-[#536a80]">{selected.conditionNote || 'Aucun commentaire de réception.'}</p></div><div className="rounded-lg border border-[#e1ebf5] bg-white px-3 py-2.5"><span className="block text-[9px] font-bold uppercase tracking-[.1em] text-[#8297ad]">Commentaire du bâtiment</span><p className="mt-1 whitespace-pre-wrap leading-5 text-[#536a80]">{selected.buildingConfirmationComment || 'Aucun commentaire du responsable bâtiment.'}</p></div></div><div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-[10px] text-[#71869c]"><span>Quantité signalée : <strong>{selected.quantity} poulet(s)</strong></span><span>Répartition : <strong>{freshQuantity(selected)} frais · {decomposedQuantity(selected)} décomposé(s) · {clinicQuantity(selected)} clinique(s)</strong></span><span>Clinique : <strong>{selected.clinicComment || 'Aucun commentaire'}</strong></span></div></div>{decision === 'approve' && <div><span className="field-label">Personne à imputer (obligatoire)</span><p className="mb-2 text-[10px] text-[#89968f]">La proposition automatique est indicative. RH doit confirmer explicitement le responsable avant validation.</p><div className="space-y-2">{responsibilityCandidates(selected).map((candidate) => <label key={candidate.id} className={`flex cursor-pointer items-start gap-3 rounded-xl border px-3 py-3 ${responsibleId === candidate.id ? 'border-[#76b875] bg-[#f5faf2]' : 'border-[#e6ede5] bg-white'}`}><input type="radio" name="responsibleId" value={candidate.id} checked={responsibleId === candidate.id} onChange={(event) => setResponsibleId(event.target.value)} className="mt-1 h-4 w-4 accent-[#5da561]" required /><span><strong className="block text-[11px] text-ink">{candidate.name}</strong><small className="mt-1 block text-[10px] text-[#718078]">{candidate.label}</small></span></label>)}</div></div>}{decision === 'reject' && <div className="rounded-xl border border-[#dce8db] bg-[#f5faf2] p-3 text-[10px] leading-5 text-[#5b8f60]">Le rejet annule l’imputation : aucun des deux protagonistes ne sera retenu sur cette décision.</div>}<label className="block"><span className="field-label">Commentaire RH obligatoire <strong className="text-[#b85b59]">*</strong></span><textarea name="comment" className="input-base min-h-[100px] resize-none" required placeholder="Expliquez le choix de responsabilité ou le rejet du litige." /></label><div className="flex justify-end gap-2"><button type="button" className="btn-secondary" onClick={closeDecision}>Annuler</button><button type="submit" className="btn-primary"><Check size={15} /> {decision === 'approve' ? 'Valider l’imputation' : 'Confirmer le rejet'}</button></div></form>}</Modal><Modal open={Boolean(detailsReport)} onClose={() => setDetailsReport(null)} title="Traçabilité complète du dossier Poulets morts">{detailsReport && <div className="space-y-5"><div className="grid gap-3 sm:grid-cols-2"><HistoryLine label="Référence" value={detailsReport.id} /><HistoryLine label="Bâtiment / bande" value={`${detailsReport.buildingName} · ${detailsReport.batchId || '—'}`} /><HistoryLine label="Emplacement d’origine" value={detailsReport.sourceLocation === 'clinique' ? 'Clinique' : 'Grande salle'} /><HistoryLine label="Signalé par" value={`${detailsReport.reportedByName} · ${formatDateTime(detailsReport.reportedAt)}`} /><HistoryLine label="Reçu par" value={detailsReport.receivedAt ? `${detailsReport.receivedByName} · ${formatDateTime(detailsReport.receivedAt)}` : 'En attente de réception'} /><HistoryLine label="Confirmation bâtiment" value={detailsReport.buildingConfirmationStatus === 'Confirmé' ? `${detailsReport.buildingConfirmedByName} · ${formatDateTime(detailsReport.buildingConfirmedAt ?? '')}` : 'En attente de confirmation'} /><HistoryLine label="Temps signalement → réception" value={elapsedBetween(detailsReport.reportedAt, detailsReport.receivedAt)} /><HistoryLine label="Temps réception → confirmation" value={elapsedBetween(detailsReport.receivedAt, detailsReport.buildingConfirmedAt ?? '')} /><HistoryLine label="Répartition" value={detailsReport.receivedAt ? `Frais : ${freshQuantity(detailsReport)} · décomposés : ${decomposedQuantity(detailsReport)} · clinique : ${clinicQuantity(detailsReport)}` : '—'} /><HistoryLine label="Délai de grâce" value={formatDateTime(detailsReport.graceDeadline)} /><HistoryLine label="Responsable imputé" value={detailsReport.responsibleName || 'À décider'} /><HistoryLine label="Montant" value={`${formatNumber(detailsReport.amount)} FCFA`} /></div><div className="rounded-xl border border-[#edf0eb] bg-[#fbfcfa] p-4 text-[11px] leading-5"><strong>Observation à la réception</strong><p className="mt-1 text-[#718078]">{detailsReport.conditionNote || 'Aucune observation.'}</p><strong className="mt-4 block">Commentaire clinique</strong><p className="mt-1 text-[#718078]">{detailsReport.clinicComment || 'Aucun commentaire clinique.'}</p><strong className="mt-4 block">Confirmation du bâtiment</strong><p className="mt-1 text-[#718078]">{detailsReport.buildingConfirmationComment || 'Aucune observation du responsable bâtiment.'}</p><strong className="mt-4 block">Décision RH</strong><p className="mt-1 text-[#718078]">{detailsReport.rhStatus} · {detailsReport.rhComment || 'Aucun commentaire.'}</p></div><div className="flex justify-end gap-2"><button className="btn-secondary" onClick={() => void downloadReportPdf(detailsReport)}><Download size={14} /> Télécharger cette fiche PDF</button><button className="btn-primary" onClick={() => setDetailsReport(null)}>Fermer</button></div></div>}</Modal></div>;
}

function responsibilityCandidates(report: DagoReport): ResponsibilityCandidate[] {
  const candidates: ResponsibilityCandidate[] = [];
  if (report.reportedById || report.reportedByName) candidates.push({ id: report.reportedById || `reported-${report.id}`, name: report.reportedByName || 'Responsable du bâtiment', label: 'Chef / responsable du bâtiment ayant signalé la mortalité' });
  if ((report.receivedById || report.receivedByName) && report.receivedById !== report.reportedById) candidates.push({ id: report.receivedById || `received-${report.id}`, name: report.receivedByName || 'Responsable Poulets morts', label: 'Responsable Poulets morts ayant réceptionné et constaté la perte' });
  return candidates;
}

function freshQuantity(report: Pick<DagoReport, 'freshQuantity' | 'goodQuantity'>) {
  return Math.max(0, Number(report.freshQuantity ?? report.goodQuantity ?? 0));
}

function decomposedQuantity(report: Pick<DagoReport, 'decomposedQuantity' | 'spoiledQuantity'>) {
  return Math.max(0, Number(report.decomposedQuantity ?? report.spoiledQuantity ?? 0));
}

function clinicQuantity(report: Pick<DagoReport, 'clinicQuantity'>) {
  return Math.max(0, Number(report.clinicQuantity ?? 0));
}

function formatDateTime(value: string) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('fr-FR');
}

function elapsedBetween(start: string, end: string) {
  if (!start || !end) return '—';
  const minutes = Math.max(0, Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60000));
  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;
  return hours ? `${hours} h${remaining ? ` ${remaining} min` : ''}` : `${remaining} min`;
}

function formatNumber(value: number) {
  return Number(value || 0).toLocaleString('fr-FR');
}

function HistoryLine({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-[#edf0eb] bg-[#fbfcfa] p-3"><span className="block text-[9px] font-bold uppercase tracking-[.12em] text-[#89968f]">{label}</span><strong className="mt-1 block text-[11px] text-ink">{value}</strong></div>;
}
