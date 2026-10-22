'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Check, ClipboardCheck, Clock3, FileWarning, X } from 'lucide-react';
import { FARM_STORAGE_KEYS, readLocal, subscribeToFarmData, writeLocal } from '@/lib/farm-storage';
import { loadFarmSnapshot } from '@/lib/farm-calculations';
import { addDaysIso, type DailyTaskInstance, type DailyTaskShift } from '@/lib/daily-tasks';
import { handoverConditionTotal, handoverDeathTotal, handoverForBuilding, handoverHasStarted, oppositeShift, outgoingResponsibleForTasks, poultryHandoverId, poultryHandoverStartId, type PoultryHandoverAnswer, type PoultryHandoverBuilding, type PoultryHandoverRecord, type PoultryHandoverStart } from '@/lib/poultry-handovers';
import type { PoultrySubjectLocationState } from '@/lib/poultry-subject-locations';
import { syncPoultryDailyFollowUps } from '@/lib/poultry-daily-automation';

type Props = {
  currentShift: DailyTaskShift;
  serviceDate: string;
  currentUserId: string;
  currentUserName: string;
  assignedBuildingIds: string[] | null;
  onSaved?: () => void;
};

type Feedback = { type: 'success' | 'error'; message: string };

export function PoultryServiceHandoverView({ currentShift, serviceDate, currentUserId, currentUserName, assignedBuildingIds, onSaved }: Props) {
  const [buildings, setBuildings] = useState<PoultryHandoverBuilding[]>([]);
  const [tasks, setTasks] = useState<DailyTaskInstance[]>([]);
  const [handovers, setHandovers] = useState<PoultryHandoverRecord[]>([]);
  const [handoverStarts, setHandoverStarts] = useState<PoultryHandoverStart[]>([]);
  const [locations, setLocations] = useState<PoultrySubjectLocationState[]>([]);
  const [selectedBuilding, setSelectedBuilding] = useState<PoultryHandoverBuilding | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  const outgoingShift = oppositeShift(currentShift);
  const outgoingServiceDate = currentShift === 'jour' ? addDaysIso(serviceDate, -1) : serviceDate;

  useEffect(() => {
    const load = () => {
      const snapshot = loadFarmSnapshot();
      const scopeActive = assignedBuildingIds !== null && assignedBuildingIds.length > 0;
      const nextBuildings = snapshot.buildings.filter((building) => !scopeActive || assignedBuildingIds?.includes(building.id)).map((building) => ({ id: building.id, name: building.name, batchId: building.batch !== '—' ? building.batch : '', current: Number(building.current || 0) }));
      setBuildings(nextBuildings);
      setTasks(readLocal<DailyTaskInstance[]>(FARM_STORAGE_KEYS.dailyTaskInstances, []));
      setHandovers(readLocal<PoultryHandoverRecord[]>(FARM_STORAGE_KEYS.poultryHandovers, []));
      setHandoverStarts(readLocal<PoultryHandoverStart[]>(FARM_STORAGE_KEYS.poultryHandoverStarts, []));
      setLocations(readLocal<PoultrySubjectLocationState[]>(FARM_STORAGE_KEYS.poultrySubjectLocations, []));
    };
    load();
    return subscribeToFarmData([FARM_STORAGE_KEYS.poultryHandovers, FARM_STORAGE_KEYS.poultryHandoverStarts, FARM_STORAGE_KEYS.dailyTaskInstances, FARM_STORAGE_KEYS.poultrySubjectLocations, FARM_STORAGE_KEYS.buildings], load);
  }, [assignedBuildingIds]);

  const currentHandovers = useMemo(() => buildings.map((building) => {
    const record = handoverForBuilding(handovers, building.id, serviceDate, currentShift, currentUserId);
    const outgoing = outgoingResponsibleForTasks(tasks, building.id, outgoingServiceDate, outgoingShift);
    const location = locations.find((state) => state.buildingId === building.id && state.batchId === building.batchId);
    const started = handoverHasStarted(handoverStarts, handovers, building.id, serviceDate, currentShift, currentUserId);
    return { building, record, outgoing, location, started };
  }), [buildings, handovers, handoverStarts, tasks, locations, serviceDate, currentShift, currentUserId, outgoingServiceDate, outgoingShift]);

  function notify(message: string, type: Feedback['type'] = 'success') {
    setFeedback({ type, message });
    window.setTimeout(() => setFeedback(null), 4500);
  }

  function beginHandover(building: PoultryHandoverBuilding) {
    if (!handoverHasStarted(handoverStarts, handovers, building.id, serviceDate, currentShift, currentUserId)) {
      const startedAt = new Date().toISOString();
      const start: PoultryHandoverStart = { id: poultryHandoverStartId(building.id, serviceDate, currentShift, currentUserId), buildingId: building.id, serviceDate, incomingShift: currentShift, responsibleId: currentUserId, responsibleName: currentUserName, startedAt };
      const next = [start, ...handoverStarts.filter((item) => item.id !== start.id)];
      setHandoverStarts(next);
      writeLocal(FARM_STORAGE_KEYS.poultryHandoverStarts, next);
      onSaved?.();
    }
    setSelectedBuilding(building);
    setFeedback(null);
  }

  function openForm(building: PoultryHandoverBuilding) {
    setSelectedBuilding(building);
    setFeedback(null);
  }

  function closeForm() {
    setSelectedBuilding(null);
  }

  function saveHandover(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedBuilding) return;
    const form = new FormData(event.currentTarget);
    const answer = (name: string) => String(form.get(name) ?? '') as PoultryHandoverAnswer | '';
    const roomTour = answer('roomTour');
    const deathsFound = answer('deathsFound');
    const deathsMainRoomQuantity = positiveInteger(form.get('deathsMainRoomQuantity'));
    const deathsClinicQuantity = positiveInteger(form.get('deathsClinicQuantity'));
    const deathsFoundQuantity = handoverDeathTotal({ deathsMainRoomQuantity, deathsClinicQuantity });
    const deathsFreshQuantity = positiveInteger(form.get('deathsFreshQuantity'));
    const deathsDecomposedQuantity = positiveInteger(form.get('deathsDecomposedQuantity'));
    const deathsObservation = String(form.get('deathsObservation') ?? '').trim();
    const feedBagsFound = nonNegativeInteger(form.get('feedBagsFound'));
    const comment = String(form.get('comment') ?? '').trim();
    const answers = [roomTour, answer('waterersWashed'), answer('waterDrumsFilled'), answer('equipmentStored'), answer('roomClean'), answer('footbathReady')];
    if (answers.some((value) => value !== 'Oui' && value !== 'Non')) {
      notify('Répondez à toutes les questions de contrôle de la transmission.', 'error');
      return;
    }
    if (deathsFound !== 'Oui' && deathsFound !== 'Non') {
      notify('Indiquez si des sujets morts ont été trouvés.', 'error');
      return;
    }
    if (deathsFound === 'Non' && deathsFoundQuantity > 0) {
      notify('Les quantités de morts doivent être à zéro lorsque vous répondez Non.', 'error');
      return;
    }
    if (deathsFound === 'Oui' && deathsFoundQuantity <= 0) {
      notify('Indiquez la quantité de morts trouvés par emplacement.', 'error');
      return;
    }
    if (deathsFoundQuantity > 0 && handoverConditionTotal({ deathsFreshQuantity, deathsDecomposedQuantity }) !== deathsFoundQuantity) {
      notify('La répartition de l’état des morts doit correspondre exactement au nombre trouvé.', 'error');
      return;
    }
    if (deathsDecomposedQuantity > 0 && !deathsObservation) {
      notify('Décrivez obligatoirement l’état des sujets décomposés.', 'error');
      return;
    }

    const previous = handoverForBuilding(handovers, selectedBuilding.id, serviceDate, currentShift, currentUserId);
    const now = new Date().toISOString();
    const outgoing = outgoingResponsibleForTasks(tasks, selectedBuilding.id, outgoingServiceDate, outgoingShift);
    const nextRecord: PoultryHandoverRecord = {
      id: previous?.id ?? poultryHandoverId(selectedBuilding.id, serviceDate, currentShift, currentUserId),
      buildingId: selectedBuilding.id,
      buildingName: selectedBuilding.name,
      batchId: selectedBuilding.batchId ?? '',
      serviceDate,
      incomingShift: currentShift,
      outgoingShift,
      outgoingServiceDate,
      incomingResponsibleId: currentUserId,
      incomingResponsibleName: currentUserName,
      outgoingResponsibleId: outgoing.id,
      outgoingResponsibleName: outgoing.name,
      createdAt: previous?.createdAt ?? now,
      answeredAt: now,
      status: 'Réalisée',
      roomTour,
      deathsFound,
      deathsFoundQuantity,
      deathsMainRoomQuantity,
      deathsClinicQuantity,
      deathsFreshQuantity,
      deathsDecomposedQuantity,
      deathsObservation,
      waterersWashed: answer('waterersWashed'),
      waterDrumsFilled: answer('waterDrumsFilled'),
      equipmentStored: answer('equipmentStored'),
      roomClean: answer('roomClean'),
      footbathReady: answer('footbathReady'),
      feedBagsFound,
      comment,
    };
    const next = [nextRecord, ...handovers.filter((record) => record.id !== nextRecord.id)];
    setHandovers(next);
    writeLocal(FARM_STORAGE_KEYS.poultryHandovers, next);
    syncPoultryDailyFollowUps();
    closeForm();
    onSaved?.();
    notify(`La transmission du bâtiment ${selectedBuilding.name} est enregistrée. Le service ${currentShift === 'jour' ? 'jour' : 'nuit'} peut continuer avec la trace de la passation.`);
  }

  if (!currentUserId || !buildings.length) return null;

  return <section className="surface overflow-hidden">
    <div className="border-b border-[#f0d5ad] bg-[#fffaf2] px-5 py-5 sm:px-6"><div className="flex items-start gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#fff0d8] text-[#bd7737]"><ClipboardCheck size={18} /></span><div><p className="eyebrow mb-1 text-[#a1784e]">Passation obligatoire · avant le service {currentShift === 'jour' ? 'jour' : 'nuit'}</p><h2 className="text-[18px] font-black text-[#8d6135]">Transmission de service</h2><p className="mt-1 max-w-3xl text-[11px] leading-5 text-[#986c3e]">Le responsable entrant vérifie le bâtiment et valide les informations du service {outgoingShift === 'jour' ? 'jour' : 'nuit'} précédent. Les autres tâches restent bloquées tant que la transmission n’a pas été commencée pour chaque bâtiment.</p></div></div></div>
    {feedback && <div className={`mx-5 mt-4 flex items-start gap-2 rounded-xl px-4 py-3 text-[11px] font-semibold sm:mx-6 ${feedback.type === 'error' ? 'border border-[#f0c9c5] bg-[#fff4f3] text-[#b85b59]' : 'border border-[#cde8c7] bg-[#effaeb] text-[#4d8f51]'}`}><Check size={15} className="mt-0.5 shrink-0" />{feedback.message}</div>}
    <div className="divide-y divide-[#edf0eb]">{currentHandovers.map(({ building, record, outgoing, location, started }) => <div key={building.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:px-6"><div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${record ? 'bg-[#f5faf2] text-[#5b9d5b]' : started ? 'bg-[#fff2e2] text-[#bd7737]' : 'bg-[#fff0d8] text-[#bd7737]'}`}><ClipboardCheck size={17} /></div><div className="min-w-0 flex-1"><strong className="block text-[12px] text-ink">{building.name} · {building.batchId || 'Sans bande'}</strong><p className="mt-1 text-[10px] text-[#89968f]">Service précédent : {outgoingShift === 'jour' ? 'jour' : 'nuit'} · responsable sortant : {record?.outgoingResponsibleName || outgoing.name}</p><p className="mt-1 text-[10px] text-[#8066a6]">Stock vivant enregistré en clinique : {location?.clinicQuantity ?? 0} sujet(s)</p>{record ? <p className="mt-1 text-[10px] text-[#5b8f60]">Transmission réalisée le {formatDateTime(record.answeredAt)} · {record.deathsFoundQuantity} mort(s) trouvé(s)</p> : started ? <p className="mt-1 flex items-center gap-1 text-[10px] font-bold text-[#bd7737]"><AlertTriangle size={12} /> Transmission commencée mais encore à finaliser avant la clôture du service.</p> : <p className="mt-1 flex items-center gap-1 text-[10px] font-bold text-[#bd7737]"><AlertTriangle size={12} /> Transmission à commencer : les autres tâches de ce bâtiment sont bloquées.</p>}</div>{record ? <button type="button" className="btn-secondary px-3 py-1.5 text-[10px]" onClick={() => openForm(building)}>Modifier la transmission</button> : started ? <button type="button" className="btn-secondary px-3 py-1.5 text-[10px]" onClick={() => openForm(building)}>Continuer la transmission</button> : <button type="button" className="btn-primary px-3 py-1.5 text-[10px]" onClick={() => beginHandover(building)}>Commencer la transmission</button>}</div>)}</div>
    <div className="border-t border-[#edf0eb] bg-[#fbfcfa] px-5 py-3 text-[10px] leading-5 text-[#718078] sm:px-6"><FileWarning size={13} className="mr-1 inline text-[#bd7737]" />Les morts constatés ici sont ajoutés au suivi du service sortant. Pour la réception et le stock des Poulets morts, utilisez toujours le circuit existant de signalement et de confirmation.</div>
    <HandoverModal open={Boolean(selectedBuilding)} building={selectedBuilding} clinicQuantity={selectedBuilding ? locations.find((state) => state.buildingId === selectedBuilding.id && state.batchId === selectedBuilding.batchId)?.clinicQuantity ?? 0 : 0} currentShift={currentShift} outgoingShift={outgoingShift} record={selectedBuilding ? handoverForBuilding(handovers, selectedBuilding.id, serviceDate, currentShift, currentUserId) : undefined} onClose={closeForm} onSubmit={saveHandover} />
  </section>;
}

function HandoverModal({ open, building, clinicQuantity, currentShift, outgoingShift, record, onClose, onSubmit }: { open: boolean; building: PoultryHandoverBuilding | null; clinicQuantity: number; currentShift: DailyTaskShift; outgoingShift: DailyTaskShift; record?: PoultryHandoverRecord; onClose: () => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
  if (!open || !building) return null;
  return <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-[#183328]/40 p-4 sm:p-8"><div className="my-auto w-full max-w-3xl rounded-2xl bg-white shadow-2xl"><div className="flex items-start justify-between gap-4 border-b border-[#edf0eb] px-5 py-4 sm:px-6"><div><p className="eyebrow mb-1">Bâtiment {building.name} · service entrant {currentShift === 'jour' ? 'jour' : 'nuit'}</p><h2 className="text-[18px] font-black text-ink">Transmission du service {outgoingShift === 'jour' ? 'jour' : 'nuit'}</h2></div><button type="button" className="icon-btn h-8 w-8" onClick={onClose} aria-label="Fermer"><X size={15} /></button></div><form onSubmit={onSubmit} className="space-y-5 p-5 sm:p-6"><div className="grid gap-4 sm:grid-cols-2"><AnswerField name="roomTour" label="Tour de salle effectué" defaultValue={record?.roomTour} /><AnswerField name="deathsFound" label="Avez-vous trouvé des sujets morts ?" defaultValue={record?.deathsFound} /></div><fieldset className="rounded-xl border border-[#f0d5ad] bg-[#fffaf2] p-4"><legend className="field-label">Mortalité trouvée · origine et état</legend><p className="mt-1 text-[10px] leading-5 text-[#986c3e]">Indiquez l’emplacement d’origine. Ces morts seront rattachés au service précédent dans le suivi quotidien.</p><div className="mt-3 grid gap-4 sm:grid-cols-2"><label className="block"><span className="field-label">Morts trouvés dans la grande salle</span><input name="deathsMainRoomQuantity" type="number" min="0" step="1" defaultValue={record?.deathsMainRoomQuantity ?? 0} className="input-base" /></label><label className="block"><span className="field-label">Morts trouvés en clinique</span><input name="deathsClinicQuantity" type="number" min="0" step="1" defaultValue={record?.deathsClinicQuantity ?? 0} className="input-base" /></label><label className="block"><span className="field-label">Sujets morts frais</span><input name="deathsFreshQuantity" type="number" min="0" step="1" defaultValue={record?.deathsFreshQuantity ?? 0} className="input-base" /></label><label className="block"><span className="field-label">Sujets morts décomposés</span><input name="deathsDecomposedQuantity" type="number" min="0" step="1" defaultValue={record?.deathsDecomposedQuantity ?? 0} className="input-base" /></label></div><label className="mt-3 block"><span className="field-label">Observation de l’état des morts</span><textarea name="deathsObservation" className="input-base min-h-[70px] resize-none" defaultValue={record?.deathsObservation ?? ''} placeholder="Observation obligatoire si un sujet est décomposé…" /></label></fieldset><div className="grid gap-4 sm:grid-cols-2"><div className="rounded-xl border border-[#e2d9f0] bg-[#faf7fd] p-3"><span className="field-label">Stock actuel en clinique</span><p className="mt-1 text-[18px] font-black text-[#8066a6]">{clinicQuantity} sujet(s)</p><p className="mt-1 text-[10px] leading-4 text-[#8066a6]">Valeur lue automatiquement depuis le registre Grande salle / Clinique. Aucune ressaisie dans la transmission.</p></div><label className="block"><span className="field-label">Nombre de sacs d’aliment trouvés</span><input name="feedBagsFound" type="number" min="0" step="1" defaultValue={record?.feedBagsFound ?? 0} className="input-base" required /></label></div><fieldset className="rounded-xl border border-[#e1ebe0] bg-[#fbfcfa] p-4"><legend className="field-label">Contrôle du bâtiment</legend><div className="mt-3 grid gap-4 sm:grid-cols-2"><AnswerField name="waterersWashed" label="Tous les abreuvoirs sont-ils lavés ?" defaultValue={record?.waterersWashed} /><AnswerField name="waterDrumsFilled" label="Tous les fûts sont-ils remplis d’eau ?" defaultValue={record?.waterDrumsFilled} /><AnswerField name="equipmentStored" label="Le matériel est-il rangé à sa place ?" defaultValue={record?.equipmentStored} /><AnswerField name="roomClean" label="La salle est-elle balayée et propre ?" defaultValue={record?.roomClean} /><AnswerField name="footbathReady" label="Le pédiluve est-il fait et opérationnel ?" defaultValue={record?.footbathReady} /></div></fieldset><label className="block"><span className="field-label">Observation de transmission</span><textarea name="comment" className="input-base min-h-[80px] resize-none" defaultValue={record?.comment ?? ''} placeholder="Consignes laissées au service entrant, anomalie ou réserve…" /></label><div className="rounded-xl border border-[#dce8db] bg-[#f5faf2] px-3 py-3 text-[10px] leading-5 text-[#5b8f60]">Le responsable entrant valide cette fiche avec son identité et l’heure de réponse. Les stocks Grande salle / Clinique sont suivis séparément dans le registre des mouvements.</div><div className="flex justify-end gap-2"><button type="button" className="btn-secondary" onClick={onClose}>Annuler</button><button type="submit" className="btn-primary"><Check size={15} /> Valider la transmission</button></div></form></div></div>;
}

function AnswerField({ name, label, defaultValue = '' }: { name: string; label: string; defaultValue?: PoultryHandoverAnswer | '' }) {
  return <fieldset><legend className="field-label">{label}</legend><div className="mt-1 flex gap-2"><label className="flex flex-1 items-center gap-2 rounded-lg border border-[#e1ebe0] bg-white px-3 py-2 text-[11px] font-semibold text-[#65766c]"><input type="radio" name={name} value="Oui" defaultChecked={defaultValue === 'Oui'} required />Oui</label><label className="flex flex-1 items-center gap-2 rounded-lg border border-[#e1ebe0] bg-white px-3 py-2 text-[11px] font-semibold text-[#65766c]"><input type="radio" name={name} value="Non" defaultChecked={defaultValue === 'Non'} required />Non</label></div></fieldset>;
}

function positiveInteger(value: FormDataEntryValue | null) {
  const number = Number(value ?? 0);
  return Number.isFinite(number) && number > 0 ? Math.floor(number) : 0;
}

function nonNegativeInteger(value: FormDataEntryValue | null) {
  const number = Number(value ?? 0);
  return Number.isFinite(number) && number >= 0 ? Math.floor(number) : 0;
}

function formatDateTime(value: string) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('fr-FR', { timeZone: 'Africa/Douala' });
}
