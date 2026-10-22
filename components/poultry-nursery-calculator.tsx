'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Calculator, Check, ClipboardCheck, Clock3, Info, Ruler, Save, Settings2, Wheat, X } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { FARM_STORAGE_KEYS, readLocal, subscribeToFarmData, writeLocal } from '@/lib/farm-storage';
import { addDaysIso, todayIso } from '@/lib/daily-tasks';
import { calculatePoultryBuildingDimensioningDay, calculatePoultryNurseryNeeds, DEFAULT_POULTRY_BUILDING_DIMENSIONING_SETTINGS, DEFAULT_POULTRY_NURSERY_SETTINGS, poultryBandAge, poultryBandPhase, type PoultryNurserySettings } from '@/lib/farm-calculations';
import { roomPreparationStatus, validRehydrationWindow, type PoultryChickReception, type PoultryRoomPreparation, type PreparationAnswer } from '@/lib/poultry-preparation';

type NurseryBuildingContext = { id: string; name: string; capacity: number; current: number; batch?: string; phase?: string; bandStartDate?: string; lengthM?: number; widthM?: number };
type PoultryNurseryCalculatorProps = { initialCount?: number; building?: NurseryBuildingContext; mode?: 'preparation' | 'dimensionnement'; initialTab?: PreparationTab; onPreparationSaved?: () => void; onReceptionSaved?: () => void };
type StoredPoultryLot = { id: string; name: string; start: string; initial: number; alive: number; age: number; weight: number; mortality: number; status: string; color: string; phase?: string };
type StoredPoultryBuilding = { id: string; name: string; capacity: number; current: number; status: string; batch: string; batchName: string; age: number; cleanliness: string; temperature: string; humidity: string; phase?: string; [key: string]: unknown };
type StoredDailyRecord = { id: string; date: string; shift?: 'jour' | 'nuit'; building: string; batch: string; deaths: number; expectedDeaths: number; feed: number; expectedFeed: number; water: number; sold: number; averageWeight: number; temperature: number; humidity: number; recordedBy: string; note?: string; source?: 'manuel' | 'automatique'; buildingId?: string; [key: string]: unknown };
type PreparationTab = 'dimensionnement' | 'preparation' | 'j0';

type AnswerFieldProps = { name: string; label: string; defaultValue?: PreparationAnswer };

export function PoultryNurseryCalculator({ initialCount, building, mode = 'preparation', initialTab = 'dimensionnement', onPreparationSaved, onReceptionSaved }: PoultryNurseryCalculatorProps) {
  const [activeTab, setActiveTab] = useState<PreparationTab>(initialTab);
  const [plannedCount, setPlannedCount] = useState(initialCount ?? 0);
  const [arrivalDate, setArrivalDate] = useState(todayIso());
  const [batchReference, setBatchReference] = useState(building?.batch && building.batch !== '—' ? building.batch : '');
  const [weeksAfterRenewals, setWeeksAfterRenewals] = useState(0);
  const [settings, setSettings] = useState<PoultryNurserySettings>(DEFAULT_POULTRY_NURSERY_SETTINGS);
  const [draftSettings, setDraftSettings] = useState<PoultryNurserySettings>(DEFAULT_POULTRY_NURSERY_SETTINGS);
  const [preparations, setPreparations] = useState<PoultryRoomPreparation[]>([]);
  const [receptions, setReceptions] = useState<PoultryChickReception[]>([]);
  const [parametersOpen, setParametersOpen] = useState(false);
  const [canEditSettings, setCanEditSettings] = useState(false);
  const [feedback, setFeedback] = useState('');

  useEffect(() => {
    if (initialCount !== undefined) setPlannedCount(initialCount);
  }, [initialCount]);

  useEffect(() => {
    if (mode === 'preparation') setActiveTab(initialTab);
  }, [initialTab, mode]);

  useEffect(() => {
    if (building?.batch && building.batch !== '—') setBatchReference(building.batch);
  }, [building?.batch]);

  useEffect(() => {
    const load = () => {
      const saved = readLocal<Partial<PoultryNurserySettings>>(FARM_STORAGE_KEYS.nurserySettings, {});
      const next = { ...DEFAULT_POULTRY_NURSERY_SETTINGS, ...saved };
      setSettings(next);
      setDraftSettings(next);
      setPreparations(readLocal<PoultryRoomPreparation[]>(FARM_STORAGE_KEYS.roomPreparations, []));
      setReceptions(readLocal<PoultryChickReception[]>(FARM_STORAGE_KEYS.chickReceptions, []));
    };
    const cookie = (name: string) => {
      const part = document.cookie.split('; ').find((item) => item.startsWith(`${name}=`));
      return part ? decodeURIComponent(part.slice(name.length + 1)) : '';
    };
    const access = parseCookieArray(cookie('agroflux_access'));
    setCanEditSettings(cookie('agroflux_is_admin') === '1' || access.includes('Paramètres'));
    load();
    return subscribeToFarmData([FARM_STORAGE_KEYS.nurserySettings, FARM_STORAGE_KEYS.roomPreparations, FARM_STORAGE_KEYS.chickReceptions], load);
  }, []);

  const needs = useMemo(() => calculatePoultryNurseryNeeds(plannedCount, weeksAfterRenewals, settings), [plannedCount, weeksAfterRenewals, settings]);
  const currentPreparation = preparations.find((item) => item.buildingId === building?.id && item.batchId === batchReference.trim() && item.j0Date === arrivalDate);
  const currentReception = receptions.find((item) => item.buildingId === building?.id && item.batchId === batchReference.trim() && item.j0Date === arrivalDate);

  function notify(message: string) {
    setFeedback(message);
    window.setTimeout(() => setFeedback(''), 4200);
  }

  function saveSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canEditSettings) return;
    const form = new FormData(event.currentTarget);
    const next: PoultryNurserySettings = {
      densitySubjectsPerM2: Math.max(0, Number(form.get('densitySubjectsPerM2') ?? 0)),
      initialBeddingDepthCm: Math.max(0.1, Number(form.get('initialBeddingDepthCm') ?? 0.1)),
      bagsPerM2AtInitialDepth: Math.max(0, Number(form.get('bagsPerM2AtInitialDepth') ?? 0)),
      renewalCountBeforeWeeklyAddition: Math.max(0, Math.floor(Number(form.get('renewalCountBeforeWeeklyAddition') ?? 0))),
      additionalBeddingDepthCmPerWeek: Math.max(0, Number(form.get('additionalBeddingDepthCmPerWeek') ?? 0)),
      subjectsPerDrinker: Math.max(0, Math.floor(Number(form.get('subjectsPerDrinker') ?? 0))),
      subjectsPerFeeder: Math.max(0, Math.floor(Number(form.get('subjectsPerFeeder') ?? 0))),
      subjectsPerRadiant: Math.max(0, Math.floor(Number(form.get('subjectsPerRadiant') ?? 0))),
    };
    if (next.densitySubjectsPerM2 <= 0) {
      notify('La densité de la salle doit être supérieure à zéro.');
      return;
    }
    setSettings(next);
    setDraftSettings(next);
    writeLocal(FARM_STORAGE_KEYS.nurserySettings, next);
    setParametersOpen(false);
    notify('Les paramètres de préparation de la salle sont enregistrés.');
  }

  function saveRoomPreparation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!building || !batchReference.trim() || !arrivalDate) {
      notify('Renseignez le bâtiment, la référence de bande et la date J0.');
      return;
    }
    const form = new FormData(event.currentTarget);
    const answers = {
      drinkersRinsed: String(form.get('drinkersRinsed') ?? '') as PreparationAnswer,
      feedersRinsed: String(form.get('feedersRinsed') ?? '') as PreparationAnswer,
      heatingStarted: String(form.get('heatingStarted') ?? '') as PreparationAnswer,
    };
    if (!answers.drinkersRinsed || !answers.feedersRinsed || !answers.heatingStarted) {
      notify('Répondez à toutes les questions de préparation de la salle.');
      return;
    }
    const now = new Date().toISOString();
    const record: PoultryRoomPreparation = {
      id: currentPreparation?.id ?? `PREP-SALLE-${Date.now()}`,
      buildingId: building.id,
      buildingName: building.name,
      batchId: batchReference.trim(),
      j0Date: arrivalDate,
      preparationDate: addDaysIso(arrivalDate, -1),
      plannedCount: needs.plannedCount,
      dimensioning: { requiredSurfaceM2: needs.requiredSurfaceM2, initialBeddingBags: needs.initialBeddingBags, totalBeddingBags: needs.totalBeddingBags, drinkers: needs.drinkers, feeders: needs.feeders, radiants: needs.radiants },
      ...answers,
      comment: String(form.get('comment') ?? '').trim(),
      status: roomPreparationStatus(answers),
      recordedById: getCookie('agroflux_user_id') || 'unknown',
      recordedByName: getCookie('agroflux_user_name') || 'Responsable de la salle',
      recordedAt: now,
    };
    const next = [record, ...preparations.filter((item) => item.id !== currentPreparation?.id)];
    setPreparations(next);
    writeLocal(FARM_STORAGE_KEYS.roomPreparations, next);
    onPreparationSaved?.();
    notify(record.status === 'Prête' ? `La salle ${building.name} est confirmée prête pour le ${formatDateLabel(arrivalDate)}.` : 'La checklist est enregistrée, mais la salle reste à compléter.');
  }

  function saveJ0Reception(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!building || !batchReference.trim() || !arrivalDate) {
      notify('Renseignez le bâtiment, la référence de bande et la date J0.');
      return;
    }
    const preparation = preparations.find((item) => item.buildingId === building.id && item.batchId === batchReference.trim() && item.j0Date === arrivalDate && item.status === 'Prête');
    if (!preparation) {
      notify('La préparation de la salle doit être confirmée prête avant la tâche fixe J0.');
      return;
    }
    const form = new FormData(event.currentTarget);
    const cartonsDelivered = Math.floor(Number(form.get('cartonsDelivered') ?? 0));
    const chicksDelivered = Math.floor(Number(form.get('chicksDelivered') ?? 0));
    const deadInCrate = Math.floor(Number(form.get('deadInCrate') ?? 0));
    const startingWeightKg = Number(form.get('startingWeightKg') ?? 0);
    const installationCompleted = String(form.get('installationCompleted') ?? '') as PreparationAnswer;
    const rehydrationStartAt = String(form.get('rehydrationStartAt') ?? '');
    const solutionServiceMinutes = Math.floor(Number(form.get('solutionServiceMinutes') ?? 180));
    const feedStartAt = String(form.get('feedStartAt') ?? '');
    if (cartonsDelivered <= 0 || chicksDelivered <= 0 || deadInCrate < 0 || deadInCrate > chicksDelivered || startingWeightKg <= 0 || installationCompleted !== 'Oui') {
      notify('Vérifiez les cartons, les poussins, les morts en caisse, le poids et la confirmation d’installation.');
      return;
    }
    if (solutionServiceMinutes <= 0 || solutionServiceMinutes > 180) {
      notify('La solution d’hydratation ne peut pas dépasser 3 heures (180 minutes).');
      return;
    }
    const actualMinutes = validRehydrationWindow(rehydrationStartAt, feedStartAt, 24 * 60);
    if (actualMinutes === null || actualMinutes < solutionServiceMinutes) {
      notify(`Le service aliment doit commencer après les ${solutionServiceMinutes} minutes de solution d’hydratation.`);
      return;
    }
    const startAt = new Date(rehydrationStartAt);
    const endAt = new Date(startAt.getTime() + solutionServiceMinutes * 60000);
    const now = new Date().toISOString();
    const normalizedBatchReference = batchReference.trim();
    const storedBuildings = readLocal<StoredPoultryBuilding[]>(FARM_STORAGE_KEYS.buildings, []);
    const storedBuilding = storedBuildings.find((item) => item.id === building.id);
    if (storedBuilding && storedBuilding.batch && storedBuilding.batch !== '—' && storedBuilding.batch !== normalizedBatchReference && Number(storedBuilding.current || 0) > 0) {
      notify(`Impossible d’affecter la bande ${normalizedBatchReference} : ${storedBuilding.name} contient déjà la bande ${storedBuilding.batch}.`);
      return;
    }
    const reception: PoultryChickReception = {
      id: currentReception?.id ?? `J0-RECEPTION-${Date.now()}`,
      buildingId: building.id,
      buildingName: building.name,
      batchId: normalizedBatchReference,
      j0Date: arrivalDate,
      cartonsDelivered,
      chicksDelivered,
      deadInCrate,
      startingWeightKg,
      installationCompleted,
      rehydrationStartAt,
      rehydrationEndAt: toDateTimeLocal(endAt),
      solutionServiceMinutes,
      feedStartAt,
      comment: String(form.get('comment') ?? '').trim(),
      recordedById: getCookie('agroflux_user_id') || 'unknown',
      recordedByName: getCookie('agroflux_user_name') || 'Responsable réception J0',
      recordedAt: now,
    };
    const nextReceptions = [reception, ...receptions.filter((item) => item.id !== currentReception?.id)];
    const storedLots = readLocal<StoredPoultryLot[]>(FARM_STORAGE_KEYS.lots, []);
    const existingLot = storedLots.find((lot) => lot.id === normalizedBatchReference);
    const aliveAtJ0 = Math.max(chicksDelivered - deadInCrate, 0);
    const lot: StoredPoultryLot = {
      id: normalizedBatchReference,
      name: existingLot?.name ?? `Lot réception J0 — ${normalizedBatchReference}`,
      start: arrivalDate,
      initial: chicksDelivered,
      alive: aliveAtJ0,
      age: 0,
      weight: startingWeightKg,
      mortality: chicksDelivered ? deadInCrate / chicksDelivered * 100 : 0,
      status: aliveAtJ0 > 0 ? 'En cours' : 'Terminé',
      color: existingLot?.color ?? '#9be789',
      phase: poultryBandPhase(arrivalDate, arrivalDate),
    };
    const nextLots = [lot, ...storedLots.filter((item) => item.id !== normalizedBatchReference)];
    const baseBuilding: StoredPoultryBuilding = storedBuilding ?? { id: building.id, name: building.name, capacity: building.capacity, current: 0, status: 'Vide', batch: '—', batchName: 'Aucun lot', age: 0, cleanliness: 'À contrôler', temperature: '—', humidity: '—' };
    const updatedBuilding: StoredPoultryBuilding = { ...baseBuilding, current: aliveAtJ0, status: aliveAtJ0 > 0 ? 'Occupé' : 'Vide', batch: normalizedBatchReference, batchName: existingLot?.name.replace(/^Lot /, '').split(' — ')[0] ?? 'Réception J0', age: 0, phase: poultryBandPhase(arrivalDate, arrivalDate) };
    const nextBuildings = storedBuilding ? storedBuildings.map((item) => item.id === building.id ? updatedBuilding : item) : [...storedBuildings, updatedBuilding];
    const storedDaily = readLocal<StoredDailyRecord[]>(FARM_STORAGE_KEYS.daily, []);
    const previousDaily = storedDaily.find((record) => record.date === arrivalDate && (record.shift ?? 'jour') === 'jour' && record.building === building.name && record.batch === normalizedBatchReference);
    const j0Daily: StoredDailyRecord = {
      ...(previousDaily ?? {}),
      id: previousDaily?.id ?? `J0-SUIVI-${safeStorageId(building.id)}-${safeStorageId(normalizedBatchReference)}-${arrivalDate}`,
      date: arrivalDate,
      shift: 'jour',
      building: building.name,
      batch: normalizedBatchReference,
      deaths: deadInCrate,
      expectedDeaths: previousDaily?.expectedDeaths ?? 0,
      feed: previousDaily?.feed ?? 0,
      expectedFeed: previousDaily?.expectedFeed ?? 0,
      water: previousDaily?.water ?? 0,
      sold: previousDaily?.sold ?? 0,
      averageWeight: startingWeightKg,
      temperature: previousDaily?.temperature ?? 0,
      humidity: previousDaily?.humidity ?? 0,
      recordedBy: reception.recordedByName,
      source: previousDaily?.source ?? 'manuel',
      buildingId: building.id,
      note: [previousDaily?.note, `Réception J0 : ${cartonsDelivered} carton(s), ${chicksDelivered} poussin(s), ${deadInCrate} mort(s) en caisse.`].filter(Boolean).join(' '),
    };
    const nextDaily = [j0Daily, ...storedDaily.filter((record) => record.id !== previousDaily?.id)];
    setReceptions(nextReceptions);
    writeLocal(FARM_STORAGE_KEYS.chickReceptions, nextReceptions);
    writeLocal(FARM_STORAGE_KEYS.lots, nextLots);
    writeLocal(FARM_STORAGE_KEYS.buildings, nextBuildings);
    writeLocal(FARM_STORAGE_KEYS.daily, nextDaily);
    onReceptionSaved?.();
    notify(`La réception J0 de la bande ${normalizedBatchReference} est enregistrée. La bande et le bâtiment ont été mis à jour automatiquement.`);
  }

  if (!building) return <div className="rounded-xl border border-[#f0d5ad] bg-[#fff8ea] p-4 text-[11px] leading-5 text-[#986c3e]"><Info size={15} className="mr-1 inline" /> Sélectionnez d’abord un bâtiment depuis la rubrique Bâtiments pour préparer une salle liée à son périmètre.</div>;

  if (mode === 'dimensionnement') return <section className="space-y-5"><div className="flex flex-col gap-4 border-b border-[#edf0eb] pb-5"><div><p className="eyebrow mb-2">Dimensionnement automatique · modèle J1–J45</p><h2 className="text-[22px] font-semibold tracking-[-.04em] text-ink">Dimensionner la salle</h2><p className="muted mt-1 max-w-2xl text-[12px] leading-5">Les données du bâtiment, de la bande et de l’effectif sont récupérées automatiquement. Le calcul sert à simuler les besoins sans modifier le bâtiment ni la bande.</p></div></div><DimensioningSimulationView building={building} headcount={plannedCount} setHeadcount={setPlannedCount} /></section>;

  return <section className="space-y-5">
    <div className="flex flex-col gap-4 border-b border-[#edf0eb] pb-5 sm:flex-row sm:items-end sm:justify-between"><div><p className="eyebrow mb-2">Préparation de la salle · bâtiment lié</p><h2 className="text-[22px] font-semibold tracking-[-.04em] text-ink">Préparer la salle avant J0</h2><p className="muted mt-1 max-w-2xl text-[12px] leading-5">Le dimensionnement, la checklist 24 h avant J0 et la réception fixe du jour d’arrivée sont rattachés au bâtiment sélectionné.</p></div><button type="button" className="btn-secondary shrink-0" onClick={() => { setDraftSettings(settings); setParametersOpen((current) => !current); }}><Settings2 size={15} /> {parametersOpen ? 'Fermer les paramètres' : 'Paramétrer les références'}</button></div>
    <div className="flex items-start gap-3 rounded-xl border border-[#dce8db] bg-[#f5faf2] px-4 py-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-[#5b9d5b]"><Ruler size={16} /></span><div><p className="text-[11px] font-bold text-[#3e7546]">Bâtiment lié : {building.name}</p><p className="mt-1 text-[10px] leading-4 text-[#6d9071]">Capacité : {formatNumber(building.capacity)} sujets{building.current > 0 ? ` · effectif actuel : ${formatNumber(building.current)}` : ''}{building.batch && building.batch !== '—' ? ` · bande ${building.batch}` : ''}{building.phase ? ` · ${building.phase}` : ''}.</p></div></div>
    {feedback && <div className="flex items-center gap-2 rounded-xl border border-[#cde8c7] bg-[#effaeb] px-4 py-3 text-[11px] font-semibold text-[#4d8f51]"><Check size={14} />{feedback}</div>}
    <div className="grid gap-4 sm:grid-cols-3"><label className="block"><span className="field-label">Référence de la bande</span><input className="input-base h-10" value={batchReference} onChange={(event) => setBatchReference(event.target.value)} placeholder="Ex. LP-26-005" /></label><label className="block"><span className="field-label">Date J0 d’arrivée</span><input type="date" className="input-base h-10" value={arrivalDate} onChange={(event) => setArrivalDate(event.target.value)} /></label><div className="rounded-xl border border-[#e1ebe0] bg-[#fbfcfa] px-3 py-2.5 text-[10px] text-[#6d8972]"><span className="block font-bold">Checklist préparation</span><span className="mt-1 block">J-1 · {formatDateLabel(addDaysIso(arrivalDate, -1))} · 24 h avant J0</span></div></div>
    <div className="flex flex-wrap gap-2 rounded-xl border border-[#edf0eb] bg-[#f7faf6] p-1"><TabButton active={activeTab === 'dimensionnement'} onClick={() => setActiveTab('dimensionnement')}><Calculator size={14} /> Dimensionnement</TabButton><TabButton active={activeTab === 'preparation'} onClick={() => setActiveTab('preparation')}><ClipboardCheck size={14} /> Préparation 24 h avant J0{currentPreparation?.status === 'Prête' ? ' · prête' : ''}</TabButton><TabButton active={activeTab === 'j0'} onClick={() => setActiveTab('j0')}><Clock3 size={14} /> Tâche fixe J0{currentReception ? ' · enregistrée' : ''}</TabButton></div>
    {activeTab === 'dimensionnement' && <DimensioningView plannedCount={plannedCount} setPlannedCount={setPlannedCount} arrivalDate={arrivalDate} setArrivalDate={setArrivalDate} weeksAfterRenewals={weeksAfterRenewals} setWeeksAfterRenewals={setWeeksAfterRenewals} settings={settings} needs={needs} parametersOpen={parametersOpen} canEditSettings={canEditSettings} draftSettings={draftSettings} saveSettings={saveSettings} setDraftSettings={setDraftSettings} setParametersOpen={setParametersOpen} />}
    {activeTab === 'preparation' && <form onSubmit={saveRoomPreparation} className="space-y-5"><div className="rounded-xl border border-[#e1ebe0] bg-[#f6faf4] p-4 text-[11px] leading-5 text-[#6d8972]"><strong>Préparation de la salle — J-1</strong><p className="mt-1">Cette checklist doit être remplie 24 heures avant l’arrivée prévue au J0. Le dimensionnement calculé pour ce bâtiment sera conservé avec la confirmation.</p></div><div className="grid gap-4 sm:grid-cols-3"><AnswerField name="drinkersRinsed" label="Rinçage des abreuvoirs" defaultValue={currentPreparation?.drinkersRinsed ?? 'Non'} /><AnswerField name="feedersRinsed" label="Rinçage des mangeoires" defaultValue={currentPreparation?.feedersRinsed ?? 'Non'} /><AnswerField name="heatingStarted" label="Mise en chauffage de la salle" defaultValue={currentPreparation?.heatingStarted ?? 'Non'} /></div><DimensioningSummary needs={needs} settings={settings} /><label className="block"><span className="field-label">Observation de préparation</span><textarea name="comment" className="input-base min-h-[80px] resize-none" defaultValue={currentPreparation?.comment ?? ''} placeholder="Température relevée, matériel disponible, réserve à transmettre…" /></label><div className="flex justify-end gap-2"><button type="button" className="btn-secondary" onClick={() => setActiveTab('dimensionnement')}>Retour au calcul</button><button type="submit" className="btn-primary"><Check size={15} /> {currentPreparation?.status === 'Prête' ? 'Mettre à jour la confirmation' : 'Enregistrer et confirmer'}</button></div></form>}
    {activeTab === 'j0' && <form onSubmit={saveJ0Reception} className="space-y-5"><div className={`rounded-xl border p-4 text-[11px] leading-5 ${currentPreparation?.status === 'Prête' ? 'border-[#cde8c7] bg-[#f5faf2] text-[#5b8f60]' : 'border-[#f0d5ad] bg-[#fff8ea] text-[#986c3e]'}`}><strong>Tâche fixe J0 — Réception des poussins</strong><p className="mt-1">{currentPreparation?.status === 'Prête' ? 'La salle est confirmée prête. Vous pouvez renseigner la réception réelle.' : 'La checklist de préparation 24 h avant J0 doit être entièrement validée avant de confirmer la réception.'}</p></div><div className="grid gap-4 sm:grid-cols-2"><label className="block"><span className="field-label">Nombre de cartons livrés</span><input name="cartonsDelivered" type="number" min="1" step="1" className="input-base" defaultValue={currentReception?.cartonsDelivered ?? ''} required /></label><label className="block"><span className="field-label">Nombre de poussins reçus</span><input name="chicksDelivered" type="number" min="1" step="1" className="input-base" defaultValue={currentReception?.chicksDelivered ?? (plannedCount || '')} required /></label><label className="block"><span className="field-label">Morts en caisse à la livraison</span><input name="deadInCrate" type="number" min="0" step="1" className="input-base" defaultValue={currentReception?.deadInCrate ?? 0} required /></label><label className="block"><span className="field-label">Poids moyen de départ (kg)</span><input name="startingWeightKg" type="number" min="0" step="0.001" className="input-base" defaultValue={currentReception?.startingWeightKg ?? ''} placeholder="Ex. 0,045" required /></label></div><AnswerField name="installationCompleted" label="Installation des poussins terminée" defaultValue={currentReception?.installationCompleted ?? 'Non'} /><div className="rounded-xl border border-[#e1ebe0] bg-[#fbfcfa] p-4"><p className="field-label">Solution d’hydratation puis aliment</p><p className="mb-3 text-[10px] leading-5 text-[#718078]">Le service de solution d’hydratation est limité à 3 heures maximum. Le service aliment ne peut commencer qu’après la durée déclarée.</p><div className="grid gap-4 sm:grid-cols-3"><label className="block"><span className="field-label">Début solution</span><input name="rehydrationStartAt" type="datetime-local" className="input-base" defaultValue={currentReception?.rehydrationStartAt ?? `${arrivalDate}T08:00`} required /></label><label className="block"><span className="field-label">Durée solution (minutes)</span><input name="solutionServiceMinutes" type="number" min="1" max="180" step="1" className="input-base" defaultValue={currentReception?.solutionServiceMinutes ?? 180} required /><p className="mt-1 text-[10px] text-[#89968f]">Maximum : 180 min</p></label><label className="block"><span className="field-label">Début service aliment</span><input name="feedStartAt" type="datetime-local" className="input-base" defaultValue={currentReception?.feedStartAt ?? `${arrivalDate}T11:00`} required /></label></div></div><label className="block"><span className="field-label">Observation et transmission J0</span><textarea name="comment" className="input-base min-h-[80px] resize-none" defaultValue={currentReception?.comment ?? ''} placeholder="État des poussins, installation, consigne transmise au service suivant…" /></label><div className="flex justify-end gap-2"><button type="button" className="btn-secondary" onClick={() => setActiveTab('preparation')}>Revoir la préparation</button><button type="submit" className="btn-primary"><Check size={15} /> Enregistrer la réception J0</button></div>{currentReception && <div className="rounded-xl border border-[#cde8c7] bg-[#effaeb] px-4 py-3 text-[10px] font-semibold text-[#4d8f51]">Réception J0 enregistrée : {formatNumber(currentReception.chicksDelivered)} poussin(s), {currentReception.deadInCrate} mort(s) en caisse · aliment à partir du {formatDateTimeLocal(currentReception.feedStartAt)}.</div>}</form>}
    {parametersOpen && activeTab !== 'dimensionnement' && <div className="rounded-xl border border-[#e2d9f0] bg-[#faf7fd] p-4 text-[10px] leading-5 text-[#896f9f]">Les paramètres se modifient depuis l’onglet Dimensionnement.</div>}
  </section>;
}

function DimensioningSimulationView({ building, headcount, setHeadcount }: { building: NurseryBuildingContext; headcount: number; setHeadcount: (value: number) => void }) {
  const currentAge = building.bandStartDate ? poultryBandAge(building.bandStartDate) : null;
  const automaticDay = currentAge === null ? 1 : Math.min(45, Math.max(1, currentAge || 1));
  const [selectedDay, setSelectedDay] = useState(automaticDay);
  useEffect(() => { setSelectedDay(automaticDay); }, [automaticDay]);
  const simulation = useMemo(() => Array.from({ length: 45 }, (_, index) => calculatePoultryBuildingDimensioningDay(index + 1, headcount, DEFAULT_POULTRY_BUILDING_DIMENSIONING_SETTINGS)), [headcount]);
  const selected = simulation[selectedDay - 1] ?? simulation[0];
  const availableSurface = building.lengthM && building.widthM ? building.lengthM * building.widthM : null;
  const surfaceCheck = availableSurface === null ? 'Surface du bâtiment à renseigner' : availableSurface >= selected.totalRequiredSurfaceM2 ? 'Surface globale suffisante' : 'Surface globale insuffisante';
  const surfaceCheckClass = availableSurface === null ? 'border-[#f0d5ad] bg-[#fff8ea] text-[#986c3e]' : availableSurface >= selected.totalRequiredSurfaceM2 ? 'border-[#cde8c7] bg-[#f5faf2] text-[#5b8f60]' : 'border-[#f0c9c5] bg-[#fff8f7] text-[#a34f4d]';
  const feederLabel = selected.day <= 10 ? `${formatNumber(selected.starterTrays)} plateau(x) de démarrage` : `${formatNumber(selected.circularFeeders)} mangeoire(s) trémie`;
  const drinkerLabel = selected.day <= 10 ? `${formatNumber(selected.starterDrinkers)} mini-abreuvoir(s) siphoïde(s)` : `${formatNumber(selected.bellDrinkers)} abreuvoir(s) à cloche · ou ${formatNumber(selected.nippleDrinkers)} pipette(s)`;
  return <div className="space-y-5"><div className="flex items-start gap-3 rounded-xl border border-[#dce8db] bg-[#f5faf2] px-4 py-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-[#5b9d5b]"><Ruler size={16} /></span><div><p className="text-[11px] font-bold text-[#3e7546]">{building.name}{building.batch && building.batch !== '—' ? ` · ${building.batch}` : ''}</p><p className="mt-1 text-[10px] leading-4 text-[#6d9071]">Effectif automatique : {formatNumber(building.current)} sujet(s) · {currentAge === null ? 'âge de bande non disponible' : `âge calculé : J${currentAge}`}.</p></div></div><div className="grid gap-4 sm:grid-cols-3"><label className="block"><span className="field-label">Effectif utilisé pour la simulation</span><input type="number" min="0" step="1" className="input-base h-10" value={headcount || ''} onChange={(event) => setHeadcount(Math.max(0, Number(event.target.value) || 0))} placeholder="Effectif actuel" /><p className="mt-1 text-[10px] text-[#89968f]">Prérempli avec l’effectif vivant du bâtiment, mais modifiable pour simuler.</p></label><div className="rounded-xl border border-[#e1ebe0] bg-[#fbfcfa] px-3 py-2.5 text-[10px] text-[#6d8972]"><span className="block font-bold">Jour automatique</span><span className="mt-1 block">{currentAge === null ? 'Impossible sans date J0' : `J${currentAge} · ligne ${automaticDay}`}</span></div><label className="block"><span className="field-label">Jour à consulter</span><select className="input-base h-10" value={selectedDay} onChange={(event) => setSelectedDay(Math.max(1, Math.min(45, Number(event.target.value) || 1)))}>{simulation.map((row) => <option key={row.day} value={row.day}>J{row.day} · {row.phase}</option>)}</select></label></div><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><NeedCard label="Surface globale nécessaire" value={selected.totalRequiredSurfaceM2 ? `${formatNumber(selected.totalRequiredSurfaceM2)} m²` : '—'} detail="10 sujets / m²" icon={Ruler} tone="green" /><NeedCard label={`Surface utile à J${selected.day}`} value={selected.usefulSurfaceM2 ? `${formatDecimal(selected.usefulSurfaceM2)} m²` : '—'} detail={`${Math.round(selected.surfaceFraction * 100)} % de la surface`} icon={Ruler} tone="blue" /><NeedCard label={`Mangeoires à J${selected.day}`} value={selected.day <= 10 ? formatNumber(selected.starterTrays) : formatNumber(selected.circularFeeders)} detail={selected.day <= 10 ? 'plateaux / 50 sujets' : 'trémies / 40 sujets'} icon={Wheat} tone="orange" /><NeedCard label={`Abreuvoirs à J${selected.day}`} value={selected.day <= 10 ? formatNumber(selected.starterDrinkers) : formatNumber(selected.bellDrinkers)} detail={selected.day <= 10 ? 'mini / 50 sujets' : 'cloches / 80 sujets'} icon={Calculator} tone="purple" /></div><div className={`rounded-xl border p-4 text-[11px] leading-5 ${surfaceCheckClass}`}><strong>{surfaceCheck}</strong><p className="mt-1">{availableSurface === null ? 'Les dimensions longueur × largeur ne sont pas encore enregistrées sur ce bâtiment.' : `Surface enregistrée : ${formatDecimal(availableSurface)} m² · besoin global : ${formatNumber(selected.totalRequiredSurfaceM2)} m².`}</p></div><div className="rounded-xl border border-[#dce8db] bg-[#f5faf2] p-4 text-[11px] leading-5 text-[#6d9071]"><strong>Résultat automatique pour J{selected.day}</strong><p className="mt-1">Phase : {selected.phase} · {feederLabel} · {drinkerLabel} · ration de référence : {formatNumber(selected.feedGramsPerSubject)} g/sujet/jour.</p><p className="mt-1 text-[10px]">La température et la consommation d’eau journalière restent à paramétrer avec les références validées par la Direction.</p></div><div className="surface overflow-hidden"><div className="border-b border-[#edf0eb] px-5 py-5 sm:px-6"><p className="eyebrow mb-1">Simulation complète</p><h3 className="text-[15px] font-bold text-ink">Besoins du J1 au J45</h3><p className="mt-1 text-[10px] text-[#89968f]">Les équipements sont arrondis à l’unité supérieure pour ne jamais sous-dimensionner la salle.</p></div><div className="table-scroll"><table className="w-full min-w-[920px] text-left"><thead><tr className="table-head"><th>Jour</th><th>Phase</th><th>Surface utile</th><th>Mangeoires</th><th>Abreuvoirs</th><th>Aliment</th></tr></thead><tbody>{simulation.map((row) => <tr key={row.day} className={`table-row table-line ${row.day === automaticDay ? 'bg-[#f5faf2]' : ''}`}><td className="font-bold text-ink">J{row.day}{row.day === automaticDay && <span className="ml-2 rounded-full bg-[#dff3d9] px-2 py-1 text-[9px] font-bold text-[#4d9352]">Aujourd’hui</span>}</td><td>{row.phase}</td><td>{formatDecimal(row.usefulSurfaceM2)} m² <span className="text-[10px] text-[#89968f]">({Math.round(row.surfaceFraction * 100)} %)</span></td><td>{row.day <= 10 ? `${formatNumber(row.starterTrays)} plateau(x)` : `${formatNumber(row.circularFeeders)} trémie(s)`}</td><td>{row.day <= 10 ? `${formatNumber(row.starterDrinkers)} mini` : `${formatNumber(row.bellDrinkers)} cloche(s) / ${formatNumber(row.nippleDrinkers)} pipette(s)`}</td><td>{formatNumber(row.feedGramsPerSubject)} g/sujet</td></tr>)}</tbody></table></div></div></div>;
}

function DimensioningView({ plannedCount, setPlannedCount, arrivalDate, setArrivalDate, weeksAfterRenewals, setWeeksAfterRenewals, settings, needs, parametersOpen, canEditSettings, draftSettings, saveSettings, setDraftSettings, setParametersOpen }: { plannedCount: number; setPlannedCount: (value: number) => void; arrivalDate: string; setArrivalDate: (value: string) => void; weeksAfterRenewals: number; setWeeksAfterRenewals: (value: number) => void; settings: PoultryNurserySettings; needs: ReturnType<typeof calculatePoultryNurseryNeeds>; parametersOpen: boolean; canEditSettings: boolean; draftSettings: PoultryNurserySettings; saveSettings: (event: FormEvent<HTMLFormElement>) => void; setDraftSettings: (value: PoultryNurserySettings) => void; setParametersOpen: (value: boolean | ((current: boolean) => boolean)) => void }) {
  return <div className="space-y-5"><div className="grid gap-4 sm:grid-cols-2"><label className="block"><span className="field-label">Effectif prévu de la bande</span><input type="number" min="0" step="1" className="input-base h-11" value={plannedCount || ''} onChange={(event) => setPlannedCount(Math.max(0, Number(event.target.value) || 0))} placeholder="Ex. 3000" /></label><label className="block"><span className="field-label">Date prévue d’arrivée J0</span><input type="date" className="input-base h-11" value={arrivalDate} onChange={(event) => setArrivalDate(event.target.value)} /><p className="mt-1 text-[10px] text-[#89968f]">La préparation de la salle se fait le {formatDateLabel(addDaysIso(arrivalDate, -1))}.</p></label><label className="block sm:col-span-2"><span className="field-label">Semaines après les {settings.renewalCountBeforeWeeklyAddition} renouvellements</span><input type="number" min="0" step="1" className="input-base h-11" value={weeksAfterRenewals} onChange={(event) => setWeeksAfterRenewals(Math.max(0, Math.floor(Number(event.target.value) || 0)))} /><p className="mt-1 text-[10px] text-[#89968f]">La profondeur augmente de {formatNumber(settings.additionalBeddingDepthCmPerWeek)} cm par semaine après le seuil configuré.</p></label></div><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><NeedCard label="Surface nécessaire" value={needs.requiredSurfaceM2 ? `${formatNumber(needs.requiredSurfaceM2)} m²` : '—'} detail="densité de référence" icon={Ruler} tone="green" /><NeedCard label="Copeaux au démarrage" value={needs.initialBeddingBags ? `${formatNumber(needs.initialBeddingBags)} sac(s)` : '—'} detail={`${formatNumber(settings.initialBeddingDepthCm)} cm`} icon={Wheat} tone="orange" /><NeedCard label="Copeaux au total" value={needs.totalBeddingBags ? `${formatNumber(needs.totalBeddingBags)} sac(s)` : '—'} detail={`${formatNumber(needs.totalBeddingDepthCm)} cm`} icon={Wheat} tone="blue" /><NeedCard label="Équipements" value={needs.equipmentConfigured ? `${needs.drinkers + needs.feeders + needs.radiants}` : 'À paramétrer'} detail={needs.equipmentConfigured ? 'unités calculées' : 'capacités Direction'} icon={Calculator} tone="purple" /></div><div className="grid gap-4 lg:grid-cols-3"><EquipmentResult label="Abreuvoirs" value={needs.drinkers} capacity={settings.subjectsPerDrinker} icon={Calculator} /><EquipmentResult label="Mangeoires" value={needs.feeders} capacity={settings.subjectsPerFeeder} icon={Wheat} /><EquipmentResult label="Radians" value={needs.radiants} capacity={settings.subjectsPerRadiant} icon={Calculator} /></div><div className="rounded-xl border border-[#dce8db] bg-[#f5faf2] p-4 text-[11px] leading-5 text-[#6d9071]"><Info size={15} className="mr-1 inline" /> Formule appliquée : <strong>{formatNumber(needs.plannedCount)} sujets ÷ {formatNumber(settings.densitySubjectsPerM2)} sujets/m² = {formatNumber(needs.requiredSurfaceM2)} m² minimum</strong>. La checklist 24 h avant J0 reprendra automatiquement ces besoins.</div>{!needs.equipmentConfigured && <div className="rounded-xl border border-[#f0d5ad] bg-[#fff8ea] p-4 text-[11px] leading-5 text-[#986c3e]"><Info size={15} className="mr-1 inline" /> Les capacités des abreuvoirs, mangeoires et radians doivent être validées par la Direction.</div>}{parametersOpen && <div className="rounded-2xl border border-[#e2d9f0] bg-[#faf7fd] p-5 sm:p-6"><div className="mb-5 flex items-start gap-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-[#8066a6]"><Settings2 size={16} /></span><div><h3 className="text-[13px] font-bold text-[#70578f]">Paramètres de référence</h3><p className="mt-1 text-[10px] leading-4 text-[#896f9f]">Ces valeurs sont modifiables par l’administration et doivent être validées par la Direction.</p></div></div>{canEditSettings ? <form onSubmit={saveSettings} className="space-y-5"><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"><ParameterField name="densitySubjectsPerM2" label="Densité (sujets / m²)" value={draftSettings.densitySubjectsPerM2} step="0.1" /><ParameterField name="initialBeddingDepthCm" label="Épaisseur initiale (cm)" value={draftSettings.initialBeddingDepthCm} step="0.1" /><ParameterField name="bagsPerM2AtInitialDepth" label="Sacs / m² à l’épaisseur initiale" value={draftSettings.bagsPerM2AtInitialDepth} step="0.1" /><ParameterField name="renewalCountBeforeWeeklyAddition" label="Renouvellements avant ajout hebdomadaire" value={draftSettings.renewalCountBeforeWeeklyAddition} step="1" /><ParameterField name="additionalBeddingDepthCmPerWeek" label="Ajout de copeaux / semaine (cm)" value={draftSettings.additionalBeddingDepthCmPerWeek} step="0.1" /></div><div className="border-t border-[#e8e0f2] pt-5"><p className="field-label">Capacité de référence du matériel (sujets par unité)</p><p className="mb-3 text-[10px] text-[#896f9f]">Laissez 0 si la valeur n’est pas encore validée.</p><div className="grid gap-4 sm:grid-cols-3"><ParameterField name="subjectsPerDrinker" label="Sujets / abreuvoir" value={draftSettings.subjectsPerDrinker} step="1" /><ParameterField name="subjectsPerFeeder" label="Sujets / mangeoire" value={draftSettings.subjectsPerFeeder} step="1" /><ParameterField name="subjectsPerRadiant" label="Sujets / radiant" value={draftSettings.subjectsPerRadiant} step="1" /></div></div><div className="flex justify-end gap-2"><button type="button" className="btn-secondary" onClick={() => setParametersOpen(false)}><X size={14} /> Annuler</button><button type="submit" className="btn-primary"><Save size={15} /> Enregistrer les références</button></div></form> : <p className="rounded-xl border border-[#e8e0f2] bg-white px-3 py-3 text-[10px] leading-5 text-[#896f9f]">Seul l’administrateur ou un profil disposant du droit Paramètres peut modifier les références.</p>}</div>}</div>;
}

function DimensioningSummary({ needs, settings }: { needs: ReturnType<typeof calculatePoultryNurseryNeeds>; settings: PoultryNurserySettings }) {
  return <div className="rounded-xl border border-[#dce8db] bg-[#f5faf2] p-4"><p className="field-label">Dimensionnement à confirmer dans la salle</p><div className="mt-3 grid gap-2 sm:grid-cols-3"><SummaryMetric label="Surface" value={`${formatNumber(needs.requiredSurfaceM2)} m²`} /><SummaryMetric label="Copeaux" value={`${formatNumber(needs.initialBeddingBags)} sac(s)`} /><SummaryMetric label="Matériel" value={needs.equipmentConfigured ? `${needs.drinkers} A · ${needs.feeders} M · ${needs.radiants} R` : 'À paramétrer'} /></div><p className="mt-3 text-[10px] text-[#6d9071]">Référence : {formatNumber(settings.densitySubjectsPerM2)} sujets/m². Toute réserve doit être indiquée dans l’observation.</p></div>;
}

function AnswerField({ name, label, defaultValue = 'Non' }: AnswerFieldProps) {
  return <fieldset><legend className="field-label">{label}</legend><div className="flex gap-2"><label className="flex flex-1 items-center gap-2 rounded-lg border border-[#e6ede5] bg-white px-3 py-2 text-[11px] font-semibold text-[#65766c]"><input type="radio" name={name} value="Oui" defaultChecked={defaultValue === 'Oui'} className="h-4 w-4 accent-[#5da561]" required />Oui</label><label className="flex flex-1 items-center gap-2 rounded-lg border border-[#e6ede5] bg-white px-3 py-2 text-[11px] font-semibold text-[#65766c]"><input type="radio" name={name} value="Non" defaultChecked={defaultValue === 'Non'} className="h-4 w-4 accent-[#bd5c5c]" required />Non</label></div></fieldset>;
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button type="button" className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-[10px] font-bold transition ${active ? 'bg-white text-forest shadow-sm' : 'text-[#87948c] hover:text-ink'}`} onClick={onClick}>{children}</button>;
}

function NeedCard({ label, value, detail, icon: Icon, tone }: { label: string; value: string; detail: string; icon: LucideIcon; tone: 'green' | 'orange' | 'blue' | 'purple' }) {
  const tones = { green: 'bg-[#edf8e9] text-[#5b9d5b]', orange: 'bg-[#fff2e2] text-[#bd7737]', blue: 'bg-[#edf3ff] text-[#6385bd]', purple: 'bg-[#eee7f8] text-[#8066a6]' };
  return <div className="rounded-xl border border-[#edf0eb] bg-white p-4"><div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-semibold text-[#77857e]">{label}</p><p className="mt-2 text-[21px] font-black tracking-[-.05em] text-ink">{value}</p></div><span className={`flex h-8 w-8 items-center justify-center rounded-lg ${tones[tone]}`}><Icon size={15} /></span></div><p className="mt-2 text-[10px] text-[#89968f]">{detail}</p></div>;
}

function EquipmentResult({ label, value, capacity, icon: Icon }: { label: string; value: number; capacity: number; icon: LucideIcon }) {
  return <div className="rounded-xl border border-[#edf0eb] bg-[#fbfcfa] p-4"><div className="flex items-center gap-2"><Icon size={15} className="text-[#6a9e69]" /><p className="text-[11px] font-bold text-ink">{label}</p></div><p className="mt-3 text-[25px] font-black tracking-[-.05em] text-ink">{value > 0 ? formatNumber(value) : 'À paramétrer'}</p><p className="mt-1 text-[10px] text-[#89968f]">{capacity > 0 ? `${formatNumber(capacity)} sujets par unité` : 'Capacité de référence non renseignée'}</p></div>;
}

function SummaryMetric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg border border-[#dce8db] bg-white px-3 py-2"><span className="block text-[9px] font-bold uppercase tracking-[.1em] text-[#7d9a80]">{label}</span><strong className="mt-1 block text-[12px] text-[#3e7546]">{value}</strong></div>;
}

function ParameterField({ name, label, value, step }: { name: string; label: string; value: number; step: string }) {
  return <label className="block"><span className="field-label">{label}</span><input name={name} type="number" min="0" step={step} className="input-base" defaultValue={value} /></label>;
}

function getCookie(name: string) {
  const part = document.cookie.split('; ').find((item) => item.startsWith(`${name}=`));
  return part ? decodeURIComponent(part.slice(name.length + 1)) : '';
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

function toDateTimeLocal(value: Date) {
  const pad = (part: number) => String(part).padStart(2, '0');
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}T${pad(value.getHours())}:${pad(value.getMinutes())}`;
}

function formatDateTimeLocal(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('fr-FR');
}

function safeStorageId(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]+/g, '-');
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('fr-FR').format(Math.round(value));
}

function formatDecimal(value: number) {
  return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 }).format(value);
}

function formatDateLabel(value: string) {
  return value ? value.split('-').reverse().join('/') : '—';
}
