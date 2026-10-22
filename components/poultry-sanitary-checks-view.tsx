'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Check, ClipboardCheck, Clock3, Download, Eye, HeartPulse, Plus, Search, ShieldCheck, X } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { poultryBuildings, poultryLots } from '@/lib/data';
import { loadFarmSnapshot } from '@/lib/farm-calculations';
import { FARM_STORAGE_KEYS, readLocal, subscribeToFarmData, writeLocal } from '@/lib/farm-storage';
import { formatDate, formatNumber } from '@/lib/format';
import { normalizePoultryUrgentStatus, sanitaryCheckAlerts, sanitaryCheckStatus, type DroppingsColor, type DroppingsTexture, type PoultryGeneralStateQuestionnaire, type PoultrySanitaryCheck, type PoultryServiceShift, type RespiratoryType, type SanitaryAnswer } from '@/lib/poultry-sanitary';
import { Modal, SectionHeading } from '@/components/ui';

type FarmBuilding = typeof poultryBuildings[number] & { cleaningStartDate?: string; cleaningEndDate?: string; availabilityDate?: string };
type FarmLot = typeof poultryLots[number];
type ShiftFilter = 'Toutes' | PoultryServiceShift;
type StatusFilter = 'Tous' | PoultrySanitaryCheck['status'];

type AnswerFieldProps = {
  name: string;
  label: string;
  defaultValue?: SanitaryAnswer;
  help?: string;
};

export function PoultrySanitaryChecksView({ readOnly = false }: { readOnly?: boolean }) {
  const [checks, setChecks] = useState<PoultrySanitaryCheck[]>([]);
  const [buildings, setBuildings] = useState<FarmBuilding[]>([]);
  const [lots, setLots] = useState<FarmLot[]>([]);
  const [open, setOpen] = useState(false);
  const [selectedCheck, setSelectedCheck] = useState<PoultrySanitaryCheck | null>(null);
  const [urgentResponseCheck, setUrgentResponseCheck] = useState<PoultrySanitaryCheck | null>(null);
  const [urgentResponseDraft, setUrgentResponseDraft] = useState('');
  const [feedback, setFeedback] = useState('');
  const [shiftFilter, setShiftFilter] = useState<ShiftFilter>('Toutes');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('Tous');
  const [buildingFilter, setBuildingFilter] = useState('Toutes');
  const [query, setQuery] = useState('');
  const [assignedBuildings, setAssignedBuildings] = useState<string[] | null>(null);
  const [user, setUser] = useState({ id: 'unknown', name: readOnly ? 'RH' : 'Responsable Poulets bio' });

  useEffect(() => {
    const cookie = (name: string) => {
      const part = document.cookie.split('; ').find((item) => item.startsWith(`${name}=`));
      return part ? decodeURIComponent(part.slice(name.length + 1)) : '';
    };
    setUser({ id: cookie('agroflux_user_id') || 'unknown', name: cookie('agroflux_user_name') || (readOnly ? 'RH' : 'Responsable Poulets bio') });
    if (readOnly || cookie('agroflux_is_admin') === '1') setAssignedBuildings(null);
    else {
      try { setAssignedBuildings(JSON.parse(cookie('agroflux_assigned_buildings') || '[]')); } catch { setAssignedBuildings([]); }
    }
    const load = () => {
      const snapshot = loadFarmSnapshot();
      setChecks(readLocal<PoultrySanitaryCheck[]>(FARM_STORAGE_KEYS.sanitaryChecks, []));
      setBuildings(snapshot.buildings as FarmBuilding[]);
      setLots(snapshot.lots as FarmLot[]);
    };
    load();
    return subscribeToFarmData([FARM_STORAGE_KEYS.sanitaryChecks, FARM_STORAGE_KEYS.buildings, FARM_STORAGE_KEYS.lots], load);
  }, [readOnly]);

  const accessibleBuildings = useMemo(() => buildings.filter((building) => assignedBuildings === null || !assignedBuildings.length || assignedBuildings.includes(building.id)), [buildings, assignedBuildings]);
  const buildingNames = useMemo(() => {
    const visibleCheckNames = checks.filter((check) => assignedBuildings === null || !assignedBuildings.length || assignedBuildings.includes(check.buildingId)).map((check) => check.buildingName);
    return Array.from(new Set([...accessibleBuildings.map((building) => building.name), ...visibleCheckNames])).sort((first, second) => first.localeCompare(second, 'fr'));
  }, [accessibleBuildings, assignedBuildings, checks]);
  const visibleChecks = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return checks.filter((check) => {
      const buildingVisible = assignedBuildings === null || !assignedBuildings.length || assignedBuildings.includes(check.buildingId);
      const searchable = `${check.id} ${check.date} ${check.buildingName} ${check.batchId} ${check.recordedByName} ${check.comment}`.toLowerCase();
      return buildingVisible
        && (shiftFilter === 'Toutes' || check.shift === shiftFilter)
        && (statusFilter === 'Tous' || check.status === statusFilter)
        && (buildingFilter === 'Toutes' || check.buildingName === buildingFilter)
        && (!normalizedQuery || searchable.includes(normalizedQuery));
    }).sort((first, second) => second.date.localeCompare(first.date) || second.recordedAt.localeCompare(first.recordedAt));
  }, [checks, assignedBuildings, shiftFilter, statusFilter, buildingFilter, query]);
  const attentionCount = visibleChecks.filter((check) => check.status === 'À surveiller').length;
  const urgentCount = visibleChecks.filter((check) => check.urgent && normalizePoultryUrgentStatus(check.urgentStatus) === 'Déclenchée').length;
  const dayCount = visibleChecks.filter((check) => check.shift === 'jour').length;
  const nightCount = visibleChecks.filter((check) => check.shift === 'nuit').length;

  function notify(message: string) {
    setFeedback(message);
    window.setTimeout(() => setFeedback(''), 4500);
  }

  function updateStoredUrgentCheck(id: string, updater: (check: PoultrySanitaryCheck) => PoultrySanitaryCheck) {
    const allChecks = readLocal<PoultrySanitaryCheck[]>(FARM_STORAGE_KEYS.sanitaryChecks, []);
    const next = allChecks.map((check) => check.id === id ? updater(check) : check);
    setChecks(next);
    writeLocal(FARM_STORAGE_KEYS.sanitaryChecks, next);
    const updated = next.find((check) => check.id === id);
    if (updated) {
      setSelectedCheck((current) => current?.id === id ? updated : current);
      setUrgentResponseCheck((current) => current?.id === id ? updated : current);
    }
  }

  function markUrgentViewed(check: PoultrySanitaryCheck) {
    if (!check.urgent || normalizePoultryUrgentStatus(check.urgentStatus) !== 'Déclenchée') return;
    const now = new Date().toISOString();
    updateStoredUrgentCheck(check.id, (current) => ({ ...current, urgentStatus: 'Vue', urgentViewedAt: now, urgentViewedById: user.id, urgentViewedByName: user.name }));
    notify('L’urgence sanitaire est marquée comme vue par RH.');
  }

  function openUrgentResponse(check: PoultrySanitaryCheck) {
    setUrgentResponseCheck(check);
    setUrgentResponseDraft(check.urgentResponse ?? '');
  }

  function saveUrgentResponse(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!urgentResponseCheck || !readOnly) return;
    const response = urgentResponseDraft.trim();
    if (!response) {
      notify('La consigne ou la réponse RH est obligatoire.',);
      return;
    }
    const now = new Date().toISOString();
    const start = new Date(urgentResponseCheck.urgentAt || urgentResponseCheck.recordedAt).getTime();
    const responseDelayMinutes = Number.isFinite(start) ? Math.max(0, Math.round((new Date(now).getTime() - start) / 60000)) : undefined;
    updateStoredUrgentCheck(urgentResponseCheck.id, (current) => ({ ...current, urgentStatus: 'Répondue', urgentViewedAt: current.urgentViewedAt || now, urgentViewedById: current.urgentViewedById || user.id, urgentViewedByName: current.urgentViewedByName || user.name, urgentResponse: response, urgentRespondedAt: now, urgentRespondedById: user.id, urgentRespondedByName: user.name, responseDelayMinutes }));
    setUrgentResponseCheck(null);
    setUrgentResponseDraft('');
    notify('La réponse RH a été enregistrée et l’urgence est clôturée.');
  }

  function openNewCheck() {
    setSelectedCheck(null);
    setOpen(true);
  }

  function saveCheck(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (readOnly) return;
    const form = new FormData(event.currentTarget);
    const date = String(form.get('date') ?? '');
    const shift = String(form.get('shift') ?? '') as PoultryServiceShift;
    const buildingId = String(form.get('buildingId') ?? '');
    const building = accessibleBuildings.find((item) => item.id === buildingId);
    const batchId = String(form.get('batchId') ?? '');
    const mobilityVigorous = String(form.get('mobilityVigorous') ?? '') as SanitaryAnswer;
    const foodConsumptionNormal = String(form.get('foodConsumptionNormal') ?? '') as SanitaryAnswer;
    const foodConsumptionWhy = String(form.get('foodConsumptionWhy') ?? '').trim();
    const lamenessNormal = String(form.get('lamenessNormal') ?? '') as SanitaryAnswer;
    const digestiveProblems = String(form.get('digestiveProblems') ?? '') as SanitaryAnswer;
    const droppingsColor = String(form.get('droppingsColor') ?? '') as DroppingsColor;
    const droppingsTexture = String(form.get('droppingsTexture') ?? '') as DroppingsTexture;
    const respiratoryProblems = String(form.get('respiratoryProblems') ?? '') as SanitaryAnswer;
    const respiratoryTypes = form.getAll('respiratoryTypes').map(String).filter((value): value is RespiratoryType => value === 'Buccale' || value === 'Nasale');
    const ruffledFeathers = String(form.get('ruffledFeathers') ?? '') as SanitaryAnswer;
    const wingsAway = String(form.get('wingsAway') ?? '') as SanitaryAnswer;
    const cough = String(form.get('cough') ?? '') as SanitaryAnswer;
    const rattles = String(form.get('rattles') ?? '') as SanitaryAnswer;
    const wheezing = String(form.get('wheezing') ?? '') as SanitaryAnswer;
    const drinkersWashed = String(form.get('drinkersWashed') ?? '') as SanitaryAnswer;
    const feedersFilled = String(form.get('feedersFilled') ?? '') as SanitaryAnswer;
    const materialStored = String(form.get('materialStored') ?? '') as SanitaryAnswer;
    const roomClean = String(form.get('roomClean') ?? '') as SanitaryAnswer;
    const ventilationChecked = String(form.get('ventilationChecked') ?? '') as SanitaryAnswer;
    const comment = String(form.get('comment') ?? '').trim();

    if (!date || !['jour', 'nuit'].includes(shift) || !building || !batchId) {
      notify('Sélectionnez une date, un service, un bâtiment et une bande.');
      return;
    }
    if (foodConsumptionNormal === 'Non' && !foodConsumptionWhy) {
      notify('Expliquez la cause de la consommation alimentaire anormale.');
      return;
    }
    if (respiratoryProblems === 'Oui' && !respiratoryTypes.length) {
      notify('Précisez si le problème respiratoire est buccal ou nasal.');
      return;
    }
    const now = new Date().toISOString();
    const checkBase = { mobilityVigorous, foodConsumptionNormal, lamenessNormal, digestiveProblems, respiratoryProblems, ruffledFeathers, wingsAway, cough, rattles, wheezing };
    const check: PoultrySanitaryCheck = {
      id: `SAN-CHECK-${Date.now()}`,
      date,
      shift,
      buildingId: building.id,
      buildingName: building.name,
      batchId,
      ...checkBase,
      foodConsumptionWhy,
      droppingsColor,
      droppingsTexture,
      respiratoryTypes,
      ruffledFeathers,
      wingsAway,
      cough,
      rattles,
      wheezing,
      drinkersWashed,
      feedersFilled,
      materialStored,
      roomClean,
      ventilationChecked,
      comment,
      status: sanitaryCheckStatus({ ...checkBase, droppingsColor, droppingsTexture }),
      recordedById: user.id,
      recordedByName: user.name,
      recordedAt: now,
    };
    const previous = checks.find((item) => item.date === date && item.shift === shift && item.buildingId === building.id && item.batchId === batchId);
    const next = [check, ...checks.filter((item) => item.id !== previous?.id)];
    setChecks(next);
    writeLocal(FARM_STORAGE_KEYS.sanitaryChecks, next);
    setOpen(false);
    notify(previous ? 'La checklist de ce service a été mise à jour.' : `Checklist ${shift === 'jour' ? 'jour' : 'nuit'} enregistrée pour ${building.name}.`);
  }

  function exportChecks() {
    const header = 'Date;Service;Bâtiment;Bande;Statut;Priorité RH;Vue par RH;Vue le;Réponse RH;Répondu le;Délai réponse (min);Mobilité;Consommation;Boisson;Boiterie;Digestif;Fientes;Respiratoire;Plumes;Ailes;Toux;Râles;Sifflements;Abreuvoirs;Mangeoires;Matériel;Salle;Aération;Observation;Saisi par';
    const rows = visibleChecks.map((check) => [
      check.date, serviceLabel(check.shift), check.buildingName, check.batchId, check.status, check.urgent ? `Urgence RH · ${normalizePoultryUrgentStatus(check.urgentStatus)}` : 'Normale', check.urgentViewedByName ?? '', check.urgentViewedAt ?? '', check.urgentResponse ?? '', check.urgentRespondedAt ?? '', check.responseDelayMinutes ?? '', check.mobilityVigorous, check.foodConsumptionNormal, check.waterConsumptionNormal ?? '', check.lamenessNormal, check.digestiveProblems, `${check.droppingsColor} / ${check.droppingsTexture}`, check.respiratoryProblems, check.ruffledFeathers, check.wingsAway, check.cough, check.rattles, check.wheezing, check.drinkersWashed, check.feedersFilled, check.materialStored, check.roomClean, check.ventilationChecked, check.comment, check.recordedByName,
    ].map(csvCell).join(';'));
    const url = URL.createObjectURL(new Blob([`\ufeff${[header, ...rows].join('\n')}`], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'checklists-sanitaires-poulets.csv';
    link.click();
    URL.revokeObjectURL(url);
  }

  return <section className="surface overflow-hidden">
    <div className="flex flex-col gap-4 border-b border-[#edf0eb] px-5 py-5 sm:px-6 lg:flex-row lg:items-end lg:justify-between">
      <SectionHeading eyebrow={readOnly ? 'Poulets bio · lecture RH' : 'Poulets bio · contrôle sanitaire'} title={readOnly ? 'Checklists sanitaires transmises' : 'Checklist sanitaire quotidienne'} description={readOnly ? 'RH consulte les contrôles structurés saisis par les équipes jour et nuit pour préparer les traitements.' : 'Renseignez une checklist par bâtiment, bande et service afin de détecter rapidement les signes à traiter.'} />
      <div className="flex flex-wrap gap-2">{readOnly ? null : <button type="button" className="btn-primary" onClick={openNewCheck}><Plus size={15} /> Nouvelle checklist</button>}<button type="button" className="btn-secondary" onClick={exportChecks}><Download size={15} /> Exporter</button></div>
    </div>
    <div className="grid gap-3 border-b border-[#edf0eb] p-5 sm:grid-cols-2 xl:grid-cols-5 sm:p-6"><SummaryCard label="Contrôles affichés" value={visibleChecks.length} detail="historique filtré" tone="blue" icon={ClipboardCheck} /><SummaryCard label="À surveiller" value={attentionCount} detail="préparation traitement" tone="orange" icon={AlertTriangle} /><SummaryCard label="Urgences RH nouvelles" value={urgentCount} detail="transmissions à lire" tone="orange" icon={AlertTriangle} /><SummaryCard label="Service jour" value={dayCount} detail="contrôles jour" tone="green" icon={Clock3} /><SummaryCard label="Service nuit" value={nightCount} detail="contrôles nuit" tone="purple" icon={HeartPulse} /></div>
    <div className="border-b border-[#edf0eb] bg-[#fbfcfa] px-5 py-4 sm:px-6"><div className="flex flex-col gap-2 lg:flex-row lg:items-center"><div className="relative min-w-[220px] flex-1"><Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#9aa59f]" /><input className="input-base h-9 pl-9 text-[11px]" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Rechercher un bâtiment, une bande ou une observation…" /></div><div className="grid gap-2 sm:grid-cols-3 lg:flex"><select aria-label="Filtrer par service" className="input-base h-9 text-[11px]" value={shiftFilter} onChange={(event) => setShiftFilter(event.target.value as ShiftFilter)}><option value="Toutes">Jour et nuit</option><option value="jour">Service jour</option><option value="nuit">Service nuit</option></select><select aria-label="Filtrer par statut" className="input-base h-9 text-[11px]" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}><option value="Tous">Tous les états</option><option value="Conforme">Conforme</option><option value="À surveiller">À surveiller</option></select><select aria-label="Filtrer par bâtiment" className="input-base h-9 text-[11px]" value={buildingFilter} onChange={(event) => setBuildingFilter(event.target.value)}><option value="Toutes">Tous les bâtiments</option>{buildingNames.map((name) => <option key={name} value={name}>{name}</option>)}</select></div></div><p className="mt-3 text-[10px] text-[#89968f]">{visibleChecks.length} contrôle(s) correspondent aux filtres.{attentionCount ? ` ${attentionCount} nécessite(nt) une lecture RH.` : ''}</p></div>
    <div className="table-scroll"><table className="w-full min-w-[1120px] text-left"><thead><tr className="table-head"><th>Date</th><th>Service</th><th>Bâtiment / bande</th><th>Mobilité</th><th>Alimentation</th><th>Digestif</th><th>Respiratoire</th><th>Fin de poste</th><th>État</th><th /></tr></thead><tbody>{visibleChecks.length ? visibleChecks.map((check) => { const alerts = sanitaryCheckAlerts(check); return <tr key={check.id} className="table-row table-line"><td>{formatDate(check.date)}</td><td><span className={`rounded-full px-2 py-1 text-[9px] font-bold ${check.shift === 'nuit' ? 'bg-[#eee7f8] text-[#8066a6]' : 'bg-[#fff2e2] text-[#bd7737]'}`}>{serviceLabel(check.shift)}</span></td><td><p className="font-bold text-ink">{check.buildingName}</p><p className="mt-1 text-[10px] text-[#89968f]">{check.batchId}</p></td><td><span className={check.mobilityVigorous === 'Oui' ? 'font-semibold text-[#5b9d5b]' : 'font-bold text-[#bd5c5c]'}>{check.mobilityVigorous}</span></td><td><span className={check.foodConsumptionNormal === 'Oui' ? 'font-semibold text-[#5b9d5b]' : 'font-bold text-[#bd5c5c]'}>{check.foodConsumptionNormal}</span></td><td><span className={check.digestiveProblems === 'Oui' ? 'font-bold text-[#bd5c5c]' : 'font-semibold text-[#5b9d5b]'}>{check.digestiveProblems}</span></td><td><span className={check.respiratoryProblems === 'Oui' ? 'font-bold text-[#bd5c5c]' : 'font-semibold text-[#5b9d5b]'}>{check.respiratoryProblems}</span></td><td><span className={check.roomClean === 'Oui' && check.ventilationChecked === 'Oui' ? 'font-semibold text-[#5b9d5b]' : 'font-bold text-[#bd7737]'}>{check.roomClean === 'Oui' && check.ventilationChecked === 'Oui' ? 'Contrôlée' : 'À revoir'}</span></td><td><div>{alerts.length ? <span className="inline-flex items-center gap-1 rounded-full bg-[#fff2e2] px-2 py-1 text-[9px] font-bold text-[#bd7737]"><AlertTriangle size={11} /> À surveiller</span> : <span className="inline-flex items-center gap-1 rounded-full bg-[#edf8e9] px-2 py-1 text-[9px] font-bold text-[#5b9d5b]"><Check size={11} /> Conforme</span>}</div>{check.urgent && <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-[#fdeceb] px-2 py-1 text-[9px] font-bold text-[#bd5c5c]"><AlertTriangle size={10} /> Urgence RH · {normalizePoultryUrgentStatus(check.urgentStatus)}</span>}</td><td><button type="button" className="icon-btn h-8 w-8" onClick={() => setSelectedCheck(check)} aria-label={`Voir le détail ${check.id}`}><Eye size={14} /></button></td></tr>; }) : <tr><td colSpan={10} className="px-6 py-14 text-center text-[11px] text-[#89968f]">Aucune checklist sanitaire ne correspond aux filtres sélectionnés.</td></tr>}</tbody></table></div>
    <div className="border-t border-[#edf0eb] bg-[#f5faf2] px-5 py-3 text-[10px] leading-5 text-[#6d9071]">Les contrôles sont rattachés à une bande, un bâtiment, une date et un service. Un état « À surveiller » sert de signal de préparation pour RH ; il ne remplace pas la décision du responsable ni celle du vétérinaire.</div>
    {!readOnly && <Modal open={open} onClose={() => setOpen(false)} title="Renseigner une checklist sanitaire"><form onSubmit={saveCheck} className="space-y-5"><div className="grid gap-4 sm:grid-cols-2"><label className="block"><span className="field-label">Date du contrôle</span><input name="date" type="date" defaultValue={todayIso()} className="input-base" required /></label><label className="block"><span className="field-label">Service</span><select name="shift" className="input-base" defaultValue="jour" required><option value="jour">Service jour</option><option value="nuit">Service nuit</option></select></label><label className="block"><span className="field-label">Bâtiment</span><select name="buildingId" className="input-base" defaultValue="" required><option value="">Choisir un bâtiment</option>{accessibleBuildings.map((building) => <option key={building.id} value={building.id}>{building.name} · {building.status}</option>)}</select></label><label className="block"><span className="field-label">Bande</span><select name="batchId" className="input-base" defaultValue="" required><option value="">Choisir une bande</option>{lots.filter((lot) => lot.status !== 'Terminé' && lot.status !== 'Archivée').map((lot) => <option key={lot.id} value={lot.id}>{lot.id} · {lot.name}</option>)}</select></label></div><div className="rounded-xl border border-[#e1ebe0] bg-[#f6faf4] p-4"><div className="flex items-start gap-2"><ShieldCheck size={16} className="mt-0.5 shrink-0 text-[#5b9d5b]" /><p className="text-[10px] leading-5 text-[#6d8972]">Répondez à chaque observation. Une réponse défavorable crée un état « À surveiller » pour la lecture de RH.</p></div></div><div className="grid gap-4 sm:grid-cols-2"><AnswerField name="mobilityVigorous" label="Mobilité : sujets vifs" /><AnswerField name="foodConsumptionNormal" label="Consommation alimentaire normale" /><AnswerField name="lamenessNormal" label="Boiterie normale" /><AnswerField name="digestiveProblems" label="Problèmes digestifs" defaultValue="Non" /></div><div className="grid gap-4 sm:grid-cols-2"><label className="block"><span className="field-label">Si consommation anormale, pourquoi ?</span><textarea name="foodConsumptionWhy" className="input-base min-h-[70px] resize-none" placeholder="Cause observée, quantité, comportement…" /></label><div className="grid gap-4 sm:grid-cols-2"><label className="block"><span className="field-label">Couleur des fientes</span><select name="droppingsColor" className="input-base" defaultValue="Marron" required><option>Marron</option><option>Rouge</option><option>Blanche</option><option>Verte</option></select></label><label className="block"><span className="field-label">Texture des fientes</span><select name="droppingsTexture" className="input-base" defaultValue="Solide" required><option>Liquide</option><option>Solide</option></select></label></div></div><div className="rounded-xl border border-[#e8e0f2] bg-[#faf7fd] p-4"><p className="field-label">Signes respiratoires</p><AnswerField name="respiratoryProblems" label="Problème respiratoire" defaultValue="Non" /><div className="mt-3 flex flex-wrap gap-3"><label className="flex items-center gap-2 text-[11px] font-semibold text-[#65766c]"><input type="checkbox" name="respiratoryTypes" value="Buccale" className="h-4 w-4 accent-[#8066a6]" />Respiration buccale</label><label className="flex items-center gap-2 text-[11px] font-semibold text-[#65766c]"><input type="checkbox" name="respiratoryTypes" value="Nasale" className="h-4 w-4 accent-[#8066a6]" />Respiration nasale</label></div></div><div className="grid gap-4 sm:grid-cols-2"><AnswerField name="ruffledFeathers" label="Plumes ébouriffées" defaultValue="Non" /><AnswerField name="wingsAway" label="Ailes détachées du corps" defaultValue="Non" /><AnswerField name="cough" label="Toux" defaultValue="Non" /><AnswerField name="rattles" label="Râles" defaultValue="Non" /><AnswerField name="wheezing" label="Sifflements" defaultValue="Non" /></div><div className="rounded-xl border border-[#e1ebe0] bg-[#fbfcfa] p-4"><p className="field-label">Checklist de fin de poste</p><div className="mt-3 grid gap-4 sm:grid-cols-2"><AnswerField name="drinkersWashed" label="Tous les abreuvoirs sont lavés" /><AnswerField name="feedersFilled" label="Tous les sites / mangeoires sont remplis" /><AnswerField name="materialStored" label="Matériel rangé à sa place" /><AnswerField name="roomClean" label="Salle balayée et propre" /><AnswerField name="ventilationChecked" label="Aération de la salle contrôlée" /></div></div><label className="block"><span className="field-label">Observation et transmission</span><textarea name="comment" className="input-base min-h-[85px] resize-none" placeholder="Nombre de morts connu, comportement, intervention ou consigne pour l’autre service…" /></label><div className="flex justify-end gap-2"><button type="button" className="btn-secondary" onClick={() => setOpen(false)}><X size={14} /> Annuler</button><button type="submit" className="btn-primary"><ClipboardCheck size={15} /> Enregistrer le contrôle</button></div></form></Modal>}
    <Modal open={Boolean(selectedCheck)} onClose={() => setSelectedCheck(null)} title="Détail de la checklist sanitaire">{selectedCheck && <div className="space-y-5"><div className="rounded-xl border border-[#dce8db] bg-[#f6faf4] p-4"><div className="flex flex-wrap items-center gap-2"><strong className="text-[13px] text-ink">{selectedCheck.buildingName} · {selectedCheck.batchId}</strong><span className={`rounded-full px-2 py-1 text-[9px] font-bold ${selectedCheck.shift === 'nuit' ? 'bg-[#eee7f8] text-[#8066a6]' : 'bg-[#fff2e2] text-[#bd7737]'}`}>{serviceLabel(selectedCheck.shift)}</span><span className={`rounded-full px-2 py-1 text-[9px] font-bold ${selectedCheck.status === 'À surveiller' ? 'bg-[#fff2e2] text-[#bd7737]' : 'bg-[#edf8e9] text-[#5b9d5b]'}`}>{selectedCheck.status}</span>{selectedCheck.urgent && <span className="rounded-full bg-[#fdeceb] px-2 py-1 text-[9px] font-bold text-[#bd5c5c]">Urgence RH · {normalizePoultryUrgentStatus(selectedCheck.urgentStatus)}</span>}</div><p className="mt-1 text-[10px] text-[#718078]">{formatDate(selectedCheck.date)} · {selectedCheck.id} · saisi par {selectedCheck.recordedByName}</p></div>{selectedCheck.urgent && <UrgentWorkflow check={selectedCheck} readOnly={readOnly} onMarkViewed={() => markUrgentViewed(selectedCheck)} onRespond={() => openUrgentResponse(selectedCheck)} />}<div className="grid gap-3 sm:grid-cols-2"><DetailLine label="Mobilité" value={selectedCheck.mobilityVigorous} /><DetailLine label="Consommation alimentaire" value={`${selectedCheck.foodConsumptionNormal}${selectedCheck.foodConsumptionWhy ? ` · ${selectedCheck.foodConsumptionWhy}` : ''}`} /><DetailLine label="Boisson" value={`${selectedCheck.waterConsumptionNormal ?? '—'}${selectedCheck.waterConsumptionWhy ? ` · ${selectedCheck.waterConsumptionWhy}` : ''}`} /><DetailLine label="Boiterie" value={selectedCheck.lamenessNormal} /><DetailLine label="Digestif" value={selectedCheck.digestiveProblems} /><DetailLine label="Fientes" value={`${selectedCheck.droppingsColor} · ${selectedCheck.droppingsTexture}`} /><DetailLine label="Respiratoire" value={`${selectedCheck.respiratoryProblems}${selectedCheck.respiratoryTypes.length ? ` · ${selectedCheck.respiratoryTypes.join(' / ')}` : ''}`} /><DetailLine label="Plumes / ailes" value={`${selectedCheck.ruffledFeathers} · ${selectedCheck.wingsAway}`} /><DetailLine label="Toux / râles / sifflements" value={`${selectedCheck.cough} · ${selectedCheck.rattles} · ${selectedCheck.wheezing}`} /></div>{selectedCheck.generalStateQuestionnaire && <GeneralStateDetail questionnaire={selectedCheck.generalStateQuestionnaire} />}<div className="grid gap-3 sm:grid-cols-2"><DetailLine label="Abreuvoirs / mangeoires" value={`${selectedCheck.drinkersWashed} · ${selectedCheck.feedersFilled}`} /><DetailLine label="Matériel / salle / aération" value={`${selectedCheck.materialStored} · ${selectedCheck.roomClean} · ${selectedCheck.ventilationChecked}`} /></div><div className="rounded-xl border border-[#edf0eb] bg-[#fbfcfa] p-4 text-[11px] leading-5"><strong>Observation et transmission</strong><p className="mt-1 whitespace-pre-wrap text-[#53675b]">{selectedCheck.comment || 'Aucune observation.'}</p></div>{sanitaryCheckAlerts(selectedCheck).length > 0 && <div className="rounded-xl border border-[#f0d5ad] bg-[#fff8ea] p-4 text-[11px] leading-5 text-[#986c3e]"><strong>Points à examiner</strong><ul className="mt-2 list-disc space-y-1 pl-4">{sanitaryCheckAlerts(selectedCheck).map((alert) => <li key={alert}>{alert}</li>)}</ul></div>}<div className="flex justify-end"><button type="button" className="btn-primary" onClick={() => setSelectedCheck(null)}>Fermer</button></div></div>}</Modal>
    <Modal open={Boolean(urgentResponseCheck)} onClose={() => { setUrgentResponseCheck(null); setUrgentResponseDraft(''); }} title="Répondre à l’urgence sanitaire">{urgentResponseCheck && <form onSubmit={saveUrgentResponse} className="space-y-5"><div className="rounded-xl border border-[#f0c9c5] bg-[#fff8f7] p-4 text-[11px] leading-5 text-[#8d5b58]"><strong>{urgentResponseCheck.buildingName} · {urgentResponseCheck.batchId}</strong><p className="mt-1">{formatDate(urgentResponseCheck.date)} · {serviceLabel(urgentResponseCheck.shift)} · {urgentResponseCheck.recordedByName}</p><p className="mt-1">L’urgence a été déclenchée le {formatUrgentDate(urgentResponseCheck.urgentAt || urgentResponseCheck.recordedAt)}.</p></div><label className="block"><span className="field-label">Consigne ou réponse RH obligatoire</span><textarea value={urgentResponseDraft} onChange={(event) => setUrgentResponseDraft(event.target.value)} className="input-base min-h-[130px] resize-y" placeholder="Consigne donnée au bâtiment, décision de suivi, demande de visite vétérinaire…" required /></label><div className="flex justify-end gap-2"><button type="button" className="btn-secondary" onClick={() => { setUrgentResponseCheck(null); setUrgentResponseDraft(''); }}><X size={14} /> Annuler</button><button type="submit" className="btn-primary"><Check size={15} /> Enregistrer la réponse</button></div></form>}</Modal>
  </section>;
}

function AnswerField({ name, label, defaultValue = 'Oui', help }: AnswerFieldProps) {
  return <fieldset><legend className="field-label">{label}</legend>{help && <p className="mb-2 text-[10px] text-[#89968f]">{help}</p>}<div className="flex gap-2"><label className="flex flex-1 items-center gap-2 rounded-lg border border-[#e6ede5] bg-white px-3 py-2 text-[11px] font-semibold text-[#65766c]"><input type="radio" name={name} value="Oui" defaultChecked={defaultValue === 'Oui'} className="h-4 w-4 accent-[#5da561]" required />Oui</label><label className="flex flex-1 items-center gap-2 rounded-lg border border-[#e6ede5] bg-white px-3 py-2 text-[11px] font-semibold text-[#65766c]"><input type="radio" name={name} value="Non" defaultChecked={defaultValue === 'Non'} className="h-4 w-4 accent-[#bd5c5c]" required />Non</label></div></fieldset>;
}

function SummaryCard({ label, value, detail, tone, icon: Icon }: { label: string; value: number; detail: string; tone: 'green' | 'orange' | 'blue' | 'purple'; icon: LucideIcon }) {
  const classes = { green: 'bg-[#edf8e9] text-[#5b9d5b]', orange: 'bg-[#fff2e2] text-[#bd7737]', blue: 'bg-[#edf3ff] text-[#6385bd]', purple: 'bg-[#eee7f8] text-[#8066a6]' };
  return <div className="rounded-xl border border-[#edf0eb] bg-white p-3"><div className="flex items-start justify-between gap-2"><div><p className="text-[10px] font-semibold text-[#77857e]">{label}</p><p className="mt-1 text-[22px] font-black tracking-[-.05em] text-ink">{formatNumber(value)}</p></div><span className={`flex h-8 w-8 items-center justify-center rounded-lg ${classes[tone]}`}><Icon size={15} /></span></div><p className="mt-2 truncate text-[10px] text-[#89968f]">{detail}</p></div>;
}

function DetailLine({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-[#edf0eb] bg-[#fbfcfa] p-3"><span className="block text-[9px] font-bold uppercase tracking-[.1em] text-[#89968f]">{label}</span><strong className="mt-1 block text-[11px] text-ink">{value}</strong></div>;
}

function UrgentWorkflow({ check, readOnly, onMarkViewed, onRespond }: { check: PoultrySanitaryCheck; readOnly: boolean; onMarkViewed: () => void; onRespond: () => void }) {
  const status = normalizePoultryUrgentStatus(check.urgentStatus);
  return <div className="rounded-xl border border-[#f0c9c5] bg-[#fff8f7] p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-[11px] font-black text-[#a34f4d]">Workflow urgence RH</p><p className="mt-1 text-[10px] text-[#9e6966]">Déclenchée le {formatUrgentDate(check.urgentAt || check.recordedAt)} · statut : <strong>{status}</strong></p></div>{readOnly && <div className="flex flex-wrap gap-2">{status === 'Déclenchée' && <button type="button" className="btn-secondary px-2.5 py-1.5 text-[10px]" onClick={onMarkViewed}><Eye size={13} /> Marquer comme vue</button>}{status !== 'Répondue' && <button type="button" className="btn-primary px-2.5 py-1.5 text-[10px]" onClick={onRespond}><HeartPulse size={13} /> Répondre à l’urgence</button>}</div>}</div>{check.urgentViewedAt && <p className="mt-3 text-[10px] text-[#718078]">Vue par {check.urgentViewedByName || 'RH'} le {formatUrgentDate(check.urgentViewedAt)}.</p>}{check.urgentResponse && <div className="mt-3 rounded-lg border border-[#eadfdc] bg-white p-3 text-[10px] leading-5 text-[#53675b]"><strong>Réponse RH · {check.urgentRespondedByName || 'RH'} · {formatUrgentDate(check.urgentRespondedAt || '')}</strong><p className="mt-1 whitespace-pre-wrap">{check.urgentResponse}</p>{check.responseDelayMinutes !== undefined && <p className="mt-1 font-semibold text-[#6385bd]">Délai de réponse : {check.responseDelayMinutes} minute(s).</p>}</div>}</div>;
}

function formatUrgentDate(value: string) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('fr-FR', { timeZone: 'Africa/Douala' });
}

function GeneralStateDetail({ questionnaire }: { questionnaire: PoultryGeneralStateQuestionnaire }) {
  return <div className="rounded-xl border border-[#f0c9c5] bg-[#fff8f7] p-4"><div className="flex items-center gap-2 text-[11px] font-black text-[#a34f4d]"><AlertTriangle size={14} /> Questionnaire transmis en urgence à RH</div><div className="mt-3 grid gap-3 sm:grid-cols-2"><DetailLine label="Sujets vifs" value={`${questionnaire.subjectsVigorous}${questionnaire.subjectsVigorousWhy ? ` · ${questionnaire.subjectsVigorousWhy}` : ''}`} /><DetailLine label="Consommation alimentaire" value={`${questionnaire.foodConsumptionNormal}${questionnaire.foodConsumptionWhy ? ` · ${questionnaire.foodConsumptionWhy}` : ''}`} /><DetailLine label="Consommation d’eau" value={`${questionnaire.waterConsumptionNormal}${questionnaire.waterConsumptionWhy ? ` · ${questionnaire.waterConsumptionWhy}` : ''}`} /><DetailLine label="Fientes" value={`${questionnaire.droppingsColor} · ${questionnaire.droppingsTexture}`} /><DetailLine label="Respiration" value={`${questionnaire.respiratoryProblems}${questionnaire.respiratoryType ? ` · ${questionnaire.respiratoryType}` : ''}`} /><DetailLine label="Signes associés" value={`Plumes ${questionnaire.ruffledFeathers} · ailes ${questionnaire.wingsAway} · toux ${questionnaire.cough} · râles ${questionnaire.rattles} · sifflements ${questionnaire.wheezing}`} /></div></div>;
}

function serviceLabel(shift: PoultryServiceShift) {
  return shift === 'nuit' ? 'Nuit' : 'Jour';
}

function csvCell(value: unknown) {
  return `"${String(value ?? '').replaceAll('"', '""')}"`;
}

function todayIso() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
