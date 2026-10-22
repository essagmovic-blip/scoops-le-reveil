'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import { Activity, AlertTriangle, ArrowLeftRight, ArrowRight, CalendarDays, Check, ChevronDown, ClipboardCheck, Clock3, Droplets, Edit3, FileText, MessageSquare, MoreHorizontal, PawPrint, Plus, Ruler, Search, Settings, ShieldCheck, Thermometer, Trash2, Wheat, X } from 'lucide-react';
import type { poultryBuildings, poultryHealthEvents, poultryLots, poultryTransfers } from '@/lib/data';
import { formatDate, formatFCFA, formatNumber, formatPercent } from '@/lib/format';
import { FARM_STORAGE_KEYS, readLocal, writeLocal } from '@/lib/farm-storage';
import { calculatePoultrySanitarySchedule, DEFAULT_POULTRY_SANITARY_SETTINGS, loadFarmSnapshot, poultryBandAge, poultryBandPhase, poultryDailyRationGrams, poultryExpectedDailyFeedKg, poultrySanitaryPhase, shortenPoultrySanitarySchedule, type PoultryBandPhase, type PoultryBuildingEmptyReason, type PoultryCleaningProduct, type PoultryCleaningRecord, type PoultrySanitarySchedule, type PoultrySanitarySettings } from '@/lib/farm-calculations';
import { MiniProgress, Modal, SectionHeading, StatCard, ViewAll } from '@/components/ui';
import { StatusBadge } from '@/components/status-badge';
import { DagoView } from '@/components/dago-view';
import { BuildingDeadBirdConfirmations } from '@/components/building-dead-birds-confirmations';
import { PoultrySanitaryChecksView } from '@/components/poultry-sanitary-checks-view';
import { PoultryFeedingProtocolsView } from '@/components/poultry-feeding-protocols-view';
import { PoultrySubjectLocationsView } from '@/components/poultry-subject-locations-view';
import { PoultryFeedStockView } from '@/components/poultry-feed-stock-view';
import { syncPoultrySubjectLocations, type PoultrySubjectLocationState } from '@/lib/poultry-subject-locations';
import { PoultryBuilding24hReport } from '@/components/poultry-building-24h-report';
import { PoultryHealthCalendarView } from '@/components/poultry-health-calendar-view';
import { PoultryNurseryCalculator } from '@/components/poultry-nursery-calculator';
import type { PoultryChickReception, PoultryRoomPreparation } from '@/lib/poultry-preparation';
import { DEFAULT_HR_SETTINGS, type HRSettings } from '@/components/hr-settings-view';
import { dagoGraceDeadline, type DagoReport, type DagoSourceLocation } from '@/lib/dago';
import { syncPoultryDailyFollowUps, type PoultryAutomaticDailyRecord } from '@/lib/poultry-daily-automation';
import { syncPoultryHealthCalendar } from '@/lib/poultry-health-calendar';
import type { PoultryServiceShift } from '@/lib/poultry-sanitary';
import { addDaysIso, todayIso } from '@/lib/daily-tasks';

type Tab = 'overview' | 'bands' | 'buildings' | 'daily' | 'health' | 'dago' | 'transfers';
type BandAllocation = { id: number; building: string; quantity: number };
type FarmLot = typeof poultryLots[number] & { phase?: PoultryBandPhase };
type DailyRecord = PoultryAutomaticDailyRecord;
type CleaningRecord = PoultryCleaningRecord;
type CleaningProductDraft = { id: number; type: string; dosage: string };
type FarmBuilding = Omit<typeof poultryBuildings[number], 'status' | 'cleanliness'> & { status: string; cleanliness: string; phase?: PoultryBandPhase; lengthM?: number; widthM?: number; batchEndedDate?: string; emptyReason?: PoultryBuildingEmptyReason; sanitaryPhase?: string; sanitarySchedule?: PoultrySanitarySchedule; cleaningStartDate?: string; cleaningEndDate?: string; restStartDate?: string; restEndDate?: string; cleaningProduct?: string; cleaningProducts?: PoultryCleaningProduct[]; cleaningEquipment?: string[]; cleaningOperator?: string; cleaningNote?: string; availabilityDate?: string; cleaningHistory?: CleaningRecord[] };
type HealthEvent = typeof poultryHealthEvents[number] & { source?: string };

export function PoultryFarmView({ initialTab = 'overview' }: { initialTab?: Tab }) {
  const [tab, setTab] = useState<Tab>(initialTab);
  const [query, setQuery] = useState('');
  const [dailyOpen, setDailyOpen] = useState(false);
  const [batchOpen, setBatchOpen] = useState(false);
  const [strainOpen, setStrainOpen] = useState(false);
  const [editingStrain, setEditingStrain] = useState('');
  const [transferOpen, setTransferOpen] = useState(false);
  const [buildingOpen, setBuildingOpen] = useState(false);
  const [cleaningOpen, setCleaningOpen] = useState(false);
  const [emergencyRestOpen, setEmergencyRestOpen] = useState(false);
  const [emergencyBuilding, setEmergencyBuilding] = useState<FarmBuilding | null>(null);
  const [emergencyRestDuration, setEmergencyRestDuration] = useState(1);
  const [emergencyRestReason, setEmergencyRestReason] = useState('');
  const [cleaningBuildingName, setCleaningBuildingName] = useState('');
  const [cleaningProductsDraft, setCleaningProductsDraft] = useState<CleaningProductDraft[]>([{ id: 1, type: '', dosage: '' }]);
  const [historyBuilding, setHistoryBuilding] = useState<FarmBuilding | null>(null);
  const [editingBuilding, setEditingBuilding] = useState<FarmBuilding | null>(null);
  const [healthOpen, setHealthOpen] = useState(false);
  const [healthDetail, setHealthDetail] = useState<HealthEvent | null>(null);
  const [dagoOpen, setDagoOpen] = useState(false);
  const [nurseryBuilding, setNurseryBuilding] = useState<FarmBuilding | null>(null);
  const [nurseryMode, setNurseryMode] = useState<'preparation' | 'dimensionnement'>('preparation');
  const [nurseryInitialTab, setNurseryInitialTab] = useState<'dimensionnement' | 'preparation' | 'j0'>('dimensionnement');
  const [dimensioningPickerOpen, setDimensioningPickerOpen] = useState(false);
  const [cleaningSettingsOpen, setCleaningSettingsOpen] = useState(false);
  const [sanitarySettings, setSanitarySettings] = useState<PoultrySanitarySettings>(DEFAULT_POULTRY_SANITARY_SETTINGS);
  const [canEditSanitarySettings, setCanEditSanitarySettings] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [dailyRecords, setDailyRecords] = useState<DailyRecord[]>([]);
  const [roomPreparations, setRoomPreparations] = useState<PoultryRoomPreparation[]>([]);
  const [chickReceptions, setChickReceptions] = useState<PoultryChickReception[]>([]);
  const [healthEvents, setHealthEvents] = useState<HealthEvent[]>([]);
  const [transfers, setTransfers] = useState<typeof poultryTransfers>([]);
  const [lots, setLots] = useState<FarmLot[]>([]);
  const [buildings, setBuildings] = useState<FarmBuilding[]>([]);
  const [strains, setStrains] = useState<string[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [allocations, setAllocations] = useState<BandAllocation[]>([{ id: 1, building: '', quantity: 0 }]);
  const [batchInitialCount, setBatchInitialCount] = useState(0);
  const [assignedBuildings, setAssignedBuildings] = useState<string[] | null>(null);
  const [accessReady, setAccessReady] = useState(false);

  useEffect(() => {
    const cookie = (name: string) => { const part = document.cookie.split('; ').find((item) => item.startsWith(`${name}=`)); return part ? decodeURIComponent(part.slice(name.length + 1)) : ''; };
    const isAdmin = cookie('agroflux_is_admin') === '1';
    let hasSettingsAccess = isAdmin;
    try { hasSettingsAccess = hasSettingsAccess || (JSON.parse(cookie('agroflux_access') || '[]') as unknown[]).includes('Paramètres'); } catch { /* les droits serveur restent la référence */ }
    setCanEditSanitarySettings(hasSettingsAccess);
    try { setAssignedBuildings(isAdmin ? null : JSON.parse(cookie('agroflux_assigned_buildings') || '[]')); } catch { setAssignedBuildings([]); }
    setAccessReady(true);
    const load = () => {
      syncPoultryHealthCalendar();
      const snapshot = loadFarmSnapshot();
      const nextSanitarySettings = { ...DEFAULT_POULTRY_SANITARY_SETTINGS, ...readLocal<Partial<PoultrySanitarySettings>>(FARM_STORAGE_KEYS.sanitarySettings, {}) };
      setSanitarySettings(nextSanitarySettings);
      setBuildings(snapshot.buildings.map((building) => refreshBuildingAvailability(building as FarmBuilding, todayIso(), nextSanitarySettings)));
      setStrains(readLocal(FARM_STORAGE_KEYS.strains, []));
      setLots(snapshot.lots);
      setRoomPreparations(readLocal<PoultryRoomPreparation[]>(FARM_STORAGE_KEYS.roomPreparations, []));
      setChickReceptions(readLocal<PoultryChickReception[]>(FARM_STORAGE_KEYS.chickReceptions, []));
      setDailyRecords(syncPoultryDailyFollowUps());
      setHealthEvents(snapshot.health.map((event) => ({ ...event, source: (event as HealthEvent).source ?? 'Unité' })));
      setTransfers(snapshot.transfers);
      setHydrated(true);
    };
    load();
  }, []);
  useEffect(() => { if (!hydrated) return; writeLocal(FARM_STORAGE_KEYS.buildings, buildings); }, [buildings, hydrated]);
  useEffect(() => {
    const refresh = () => setBuildings((current) => current.map((building) => refreshBuildingAvailability(building, todayIso(), sanitarySettings)));
    refresh();
    const timer = window.setInterval(refresh, 60000);
    return () => window.clearInterval(timer);
  }, [sanitarySettings]);
  useEffect(() => { if (!hydrated) return; writeLocal(FARM_STORAGE_KEYS.strains, strains); }, [strains, hydrated]);
  useEffect(() => { if (!hydrated) return; writeLocal(FARM_STORAGE_KEYS.lots, lots); }, [lots, hydrated]);
  useEffect(() => { if (!hydrated) return; writeLocal(FARM_STORAGE_KEYS.daily, dailyRecords); }, [dailyRecords, hydrated]);
  useEffect(() => { if (!hydrated) return; writeLocal(FARM_STORAGE_KEYS.health, healthEvents); }, [healthEvents, hydrated]);
  useEffect(() => { if (!hydrated) return; writeLocal(FARM_STORAGE_KEYS.transfers, transfers); }, [transfers, hydrated]);

  const buildingScopeActive = accessReady && assignedBuildings !== null && assignedBuildings.length > 0;
  const visibleBuildings = buildingScopeActive ? buildings.filter((building) => assignedBuildings?.includes(building.id)) : buildings;
  const visibleBuildingNames = new Set(visibleBuildings.map((building) => building.name));
  const visibleDailyRecords = buildingScopeActive ? dailyRecords.filter((record) => visibleBuildingNames.has(record.building)) : dailyRecords;
  const visibleHealthEvents = buildingScopeActive ? healthEvents.filter((event) => visibleBuildingNames.has(event.building)) : healthEvents;
  const visibleTransfers = buildingScopeActive ? transfers.filter((transfer) => visibleBuildingNames.has(transfer.source) || visibleBuildingNames.has(transfer.destination)) : transfers;
  const visibleBatchIds = new Set([...visibleBuildings.map((building) => building.batch), ...visibleDailyRecords.map((record) => record.batch)].filter((batch) => batch && batch !== '—'));
  const visibleLots = buildingScopeActive ? lots.filter((lot) => visibleBatchIds.has(lot.id)) : lots;
  const filteredLots = useMemo(() => visibleLots.filter((lot) => `${lot.id} ${lot.name} ${lot.status}`.toLowerCase().includes(query.toLowerCase())), [visibleLots, query]);
  const filteredDaily = useMemo(() => visibleDailyRecords.filter((record) => `${record.id} ${record.batch} ${record.building}`.toLowerCase().includes(query.toLowerCase())), [visibleDailyRecords, query]);
  const activeLots = visibleLots.filter((lot) => lot.status !== 'Terminé' && lot.status !== 'Archivée');
  const totalAlive = activeLots.reduce((sum, lot) => sum + Number(lot.alive || 0), 0);
  const totalMortality = visibleLots.reduce((sum, lot) => sum + Math.round(Number(lot.initial || 0) * Number(lot.mortality || 0) / 100), 0);
  const averageMortality = visibleLots.length ? visibleLots.reduce((sum, lot) => sum + Number(lot.mortality || 0), 0) / visibleLots.length : 0;
  const currentMonth = '2026-08';
  const monthRecords = visibleDailyRecords.filter((record) => record.date.startsWith(currentMonth));
  const monthFeed = monthRecords.reduce((sum, record) => sum + Number(record.feed || 0), 0);
  const expectedDailyFeedTotalKg = visibleBuildings.reduce((sum, building) => {
    if (sanitaryDisplayStatus(building) !== 'Occupé') return sum;
    const lot = visibleLots.find((item) => item.id === building.batch);
    const age = lot ? poultryBandAge(lot.start) : Math.max(0, Number(building.age) || 0);
    return sum + poultryExpectedDailyFeedKg(age, building.current);
  }, 0);
  const allocatedCount = allocations.reduce((sum, allocation) => sum + Math.max(0, Number(allocation.quantity) || 0), 0);
  const allocationHasErrors = allocations.some((allocation) => Boolean(allocationError(allocation)));
  const distributionComplete = batchInitialCount > 0 && allocatedCount === batchInitialCount && !allocationHasErrors;
  const allocationDifference = batchInitialCount - allocatedCount;

  function canEditBuilding(buildingName: string) { return !accessReady || assignedBuildings === null || !assignedBuildings.length || assignedBuildings.includes(buildings.find((building) => building.name === buildingName)?.id ?? buildingName); }
  function guardBuilding(buildingName: string) { if (canEditBuilding(buildingName)) return true; notify(`Vous n’êtes pas responsable de ${buildingName}.`); return false; }

  function notify(message: string) {
    setFeedback(message);
    window.setTimeout(() => setFeedback(''), 3800);
  }

  function allocationQuantityForBuilding(buildingName: string, excludeId?: number) {
    return allocations.filter((allocation) => allocation.building === buildingName && allocation.id !== excludeId).reduce((sum, allocation) => sum + Math.max(0, Number(allocation.quantity) || 0), 0);
  }

  function remainingCapacityForAllocation(buildingName: string, allocationId?: number) {
    const building = buildings.find((item) => item.name === buildingName);
    if (!building || isBuildingUnavailable(building)) return 0;
    return Math.max(0, Number(building.capacity) - Number(building.current) - allocationQuantityForBuilding(buildingName, allocationId));
  }

  function allocationError(allocation: BandAllocation) {
    if (!allocation.building) return 'Choisissez un bâtiment.';
    const building = buildings.find((item) => item.name === allocation.building);
    if (!building) return 'Bâtiment introuvable.';
    if (isBuildingUnavailable(building)) return `${building.name} est indisponible pendant son nettoyage.`;
    if (building.status === 'Occupé' && building.batch !== '—') return `${building.name} est déjà occupé par la bande ${building.batch}. Choisissez un bâtiment disponible.`;
    const remaining = Math.max(0, Number(building.capacity) - Number(building.current));
    const totalForBuilding = allocationQuantityForBuilding(allocation.building, allocation.id) + Math.max(0, Number(allocation.quantity) || 0);
    return totalForBuilding > remaining ? `Ce bâtiment ne peut accueillir que ${formatNumber(remaining)} sujets supplémentaires.` : '';
  }

  function reportDeath(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const buildingId = String(form.get('buildingId') ?? '');
    const building = buildings.find((item) => item.id === buildingId);
    const quantity = Number(form.get('quantity') ?? 0);
    if (!building || quantity <= 0 || !guardBuilding(building.name)) {
      if (!building || quantity <= 0) notify('Choisissez un bâtiment autorisé et une quantité valide.');
      return;
    }
    const cookie = (name: string) => { const part = document.cookie.split('; ').find((item) => item.startsWith(`${name}=`)); return part ? decodeURIComponent(part.slice(name.length + 1)) : ''; };
    const sourceLocation = String(form.get('sourceLocation') ?? 'grande-salle') as DagoSourceLocation;
    const currentLocations = readLocal<PoultrySubjectLocationState[]>(FARM_STORAGE_KEYS.poultrySubjectLocations, []);
    const syncedLocations = syncPoultrySubjectLocations([building], currentLocations);
    const locationState = syncedLocations.find((state) => state.buildingId === building.id && state.batchId === building.batch);
    const availableAtLocation = sourceLocation === 'clinique' ? Number(locationState?.clinicQuantity || 0) : Number(locationState?.grandeSalleQuantity || 0);
    if (!locationState || quantity > availableAtLocation) {
      notify(`Stock insuffisant dans ${sourceLocation === 'clinique' ? 'la Clinique' : 'la Grande salle'} : ${availableAtLocation} sujet(s) vivant(s) disponible(s).`);
      return;
    }
    const nextLocations = syncedLocations.map((state) => {
      if (state.id !== locationState.id) return state;
      return sourceLocation === 'clinique'
        ? { ...state, clinicQuantity: Math.max(0, state.clinicQuantity - quantity), updatedAt: new Date().toISOString() }
        : { ...state, grandeSalleQuantity: Math.max(0, state.grandeSalleQuantity - quantity), updatedAt: new Date().toISOString() };
    });
    writeLocal(FARM_STORAGE_KEYS.poultrySubjectLocations, nextLocations);
    const hrSettings = { ...DEFAULT_HR_SETTINGS, ...readLocal<Partial<HRSettings>>(FARM_STORAGE_KEYS.rhSettings, {}) };
    const reportedAt = new Date().toISOString();
    const report: DagoReport = { id: `DAGO-${Date.now()}`, reportedAt, reportedDate: reportedAt.slice(0, 10), buildingId: building.id, buildingName: building.name, batchId: building.batch || '', sourceLocation, quantity, reportedById: cookie('agroflux_user_id') || 'unknown', reportedByName: cookie('agroflux_user_name') || 'Responsable bâtiment', status: 'En attente de réception', receivedAt: '', receivedById: '', receivedByName: '', goodQuantity: 0, spoiledQuantity: 0, condition: '', conditionNote: '', graceDeadline: dagoGraceDeadline(reportedAt, hrSettings.dagoGracePeriodMinutes), responsibleId: '', responsibleName: '', productionCostPerBird: hrSettings.poultryProductionCostPerBird, amount: 0, rhStatus: 'Aucune', rhComment: '', rhValidatedAt: '' };
    const previous = readLocal<DagoReport[]>(FARM_STORAGE_KEYS.dagoReports, []);
    writeLocal(FARM_STORAGE_KEYS.dagoReports, [report, ...previous]);
    syncPoultryDailyFollowUps();
    setDagoOpen(false);
    notify(`Le signalement ${report.id} a été transmis au responsable des poulets morts.`);
  }

  function openBatchForm() {
    setBatchInitialCount(0);
    setAllocations([{ id: Date.now(), building: '', quantity: 0 }]);
    setBatchOpen(true);
  }

  function addAllocation() { setAllocations((current) => [...current, { id: Date.now(), building: '', quantity: 0 }]); }
  function updateAllocation(id: number, key: 'building' | 'quantity', value: string | number) { setAllocations((current) => current.map((allocation) => allocation.id === id ? { ...allocation, [key]: value } : allocation)); }
  function removeAllocation(id: number) { setAllocations((current) => current.length > 1 ? current.filter((allocation) => allocation.id !== id) : current); }

  function createBatch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const initialCount = Number(form.get('initialCount') ?? 0);
    const allocatedCount = allocations.reduce((sum, allocation) => sum + Math.max(0, Number(allocation.quantity) || 0), 0);
    const invalidAllocation = allocations.find((allocation) => allocationError(allocation));
    if (!initialCount || allocatedCount <= 0) {
      notify('Saisissez le nombre de poussins et répartissez-les dans les bâtiments.');
      return;
    }
    if (invalidAllocation) {
      notify(allocationError(invalidAllocation) || 'Répartition par bâtiment invalide.');
      return;
    }
    if (allocatedCount !== initialCount) {
      const difference = initialCount - allocatedCount;
      notify(difference > 0 ? `Il reste ${formatNumber(difference)} poussin(s) non réparti(s).` : `La répartition dépasse de ${formatNumber(Math.abs(difference))} poussin(s) le nombre saisi.`);
      return;
    }
    const selectedStrain = String(form.get('strain') ?? 'Ross 308');
    const customStrain = String(form.get('customStrain') ?? '').trim();
    const strain = selectedStrain === 'Autre' ? customStrain || 'Souche personnalisée' : selectedStrain;
    const reference = String(form.get('reference') ?? `LP-${Date.now()}`).trim();
    const start = String(form.get('startDate') ?? '2026-08-13');
    const newLot: FarmLot = { id: reference, name: `Lot ${strain} — ${allocations.map((allocation) => allocation.building).join(' & ')}`, start, initial: initialCount, alive: initialCount, age: 0, weight: 0, mortality: 0, status: 'En cours', color: '#9be789', phase: poultryBandPhase(start) };
    const allocatedByBuilding = allocations.reduce((map, allocation) => map.set(allocation.building, (map.get(allocation.building) ?? 0) + Number(allocation.quantity)), new Map<string, number>());
    setLots((current) => [newLot, ...current.filter((lot) => lot.id !== reference)]);
    setBuildings((current) => current.map((building) => {
      const allocated = allocatedByBuilding.get(building.name);
      if (!allocated) return building;
      return { ...building, current: Number(building.current || 0) + allocated, status: 'Occupé', batch: reference, batchName: strain, phase: newLot.phase, age: 0 };
    }));
    setAllocations([{ id: Date.now(), building: '', quantity: 0 }]);
    setBatchInitialCount(0);
    setBatchOpen(false);
    notify(`La bande ${reference} a été enregistrée avec la souche ${strain} et répartie dans ${allocations.length} bâtiment(s).`);
  }

  function saveStrain(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = String(new FormData(event.currentTarget).get('strainName') ?? '').trim();
    if (!value) return;
    if (editingStrain) {
      setStrains((current) => current.map((strain) => strain === editingStrain ? value : strain));
      notify(`La souche « ${editingStrain} » a été modifiée.`);
    } else if (!strains.includes(value)) {
      setStrains((current) => [...current, value]);
      notify(`La souche « ${value} » a été ajoutée.`);
    }
    setEditingStrain('');
  }

  function createDailyRecord(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const building = String(form.get('building') ?? '');
    const selectedBuilding = buildings.find((item) => item.name === building);
    const shift = String(form.get('shift') ?? 'jour') as PoultryServiceShift;
    if (!guardBuilding(building)) return;
    if (!selectedBuilding || !selectedBuilding.batch || selectedBuilding.batch === '—') {
      notify('Impossible d’enregistrer le suivi : ce bâtiment n’est pas affecté à une bande.');
      return;
    }
    if (!['jour', 'nuit'].includes(shift)) {
      notify('Sélectionnez un service jour ou nuit.');
      return;
    }
    const syncedRecords = syncPoultryDailyFollowUps();
    const recordsForSave = syncedRecords.length ? syncedRecords : dailyRecords;
    const date = String(form.get('date') ?? '2026-08-13');
    const existingAutomaticRecord = recordsForSave.find((record) => record.date === date && (record.shift ?? 'jour') === shift && record.building === building && record.batch === selectedBuilding.batch && record.source === 'automatique');
    const automaticDeaths = (existingAutomaticRecord?.deathReportCount ?? 0) > 0;
    const automaticFeed = (existingAutomaticRecord?.feedTaskCount ?? 0) > 0;
    const automaticWater = (existingAutomaticRecord?.waterTaskCount ?? 0) > 0;
    const hasAutomaticValues = automaticDeaths || automaticFeed || automaticWater;
    const newRecord: DailyRecord = {
      id: `SUIVI-${Date.now()}`,
      date,
      shift,
      building,
      batch: selectedBuilding.batch,
      deaths: automaticDeaths ? existingAutomaticRecord!.deaths : Number(form.get('deaths') ?? 0),
      expectedDeaths: Number(form.get('expectedDeaths') ?? 0),
      feed: automaticFeed ? existingAutomaticRecord!.feed : Number(form.get('feed') ?? 0),
      expectedFeed: Number(form.get('expectedFeed') ?? 0),
      water: automaticWater ? existingAutomaticRecord!.water : Number(form.get('water') ?? 0),
      sold: Number(form.get('sold') ?? 0),
      averageWeight: Number(form.get('weight') ?? 0),
      temperature: Number(form.get('temperature') ?? 0),
      humidity: Number(form.get('humidity') ?? 0),
      recordedBy: hasAutomaticValues ? existingAutomaticRecord!.recordedBy : 'Administrateur',
      note: String(form.get('note') ?? '').trim(),
      source: hasAutomaticValues ? 'automatique' : 'manuel',
      buildingId: selectedBuilding.id,
      taskCount: existingAutomaticRecord?.taskCount,
      waterTaskCount: existingAutomaticRecord?.waterTaskCount,
      feedTaskCount: existingAutomaticRecord?.feedTaskCount,
      deathReportCount: existingAutomaticRecord?.deathReportCount,
      automationUpdatedAt: existingAutomaticRecord?.automationUpdatedAt,
    };
    // Une seule ligne par bâtiment, bande et date et par service : une nouvelle
    // saisie corrige la précédente au lieu de compter deux fois les mêmes valeurs.
    const previousRecord = recordsForSave.find((record) => record.date === newRecord.date && (record.shift ?? 'jour') === newRecord.shift && record.building === newRecord.building && record.batch === newRecord.batch);
    const nextDailyRecords = [newRecord, ...recordsForSave.filter((record) => record.id !== previousRecord?.id)];
    const deathDelta = newRecord.deaths - (previousRecord?.deaths ?? 0);
    const soldDelta = newRecord.sold - (previousRecord?.sold ?? 0);
    const sales = readLocal(FARM_STORAGE_KEYS.sales, [] as Array<{ batch: string; quantity: number }>);
    setDailyRecords(nextDailyRecords);
    setLots((current) => current.map((lot) => {
      if (lot.id !== newRecord.batch) return lot;
      const deaths = nextDailyRecords.filter((record) => record.batch === lot.id).reduce((sum, record) => sum + Number(record.deaths || 0), 0);
      const dailySold = nextDailyRecords.filter((record) => record.batch === lot.id).reduce((sum, record) => sum + Number(record.sold || 0), 0);
      const registeredSales = sales.filter((sale) => sale.batch === lot.id).reduce((sum, sale) => sum + Number(sale.quantity || 0), 0);
      const sold = Math.max(dailySold, registeredSales);
      const alive = Math.max(Number(lot.initial || 0) - deaths - sold, 0);
      const age = Math.max(0, Math.floor((new Date(newRecord.date).getTime() - new Date(lot.start).getTime()) / 86400000));
      return { ...lot, alive, age, weight: newRecord.averageWeight > 0 ? newRecord.averageWeight : lot.weight, mortality: lot.initial ? deaths / lot.initial * 100 : 0, phase: poultryBandPhase(lot.start, newRecord.date), status: alive === 0 ? 'Terminé' : lot.status };
    }));
    setBuildings((current) => current.map((item) => item.name === building ? { ...item, current: Math.max(Number(item.current || 0) - deathDelta - soldDelta, 0) } : item));
    setDailyOpen(false);
    notify(`Le suivi du ${newRecord.date} a été enregistré : ${newRecord.deaths} mortalité(s), effectifs recalculés.`);
  }

  function createTransfer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const batch = String(form.get('batch') ?? '');
    const source = String(form.get('source') ?? '');
    const destination = String(form.get('destination') ?? '');
    const quantity = Number(form.get('quantity') ?? 0);
    const transferDate = String(form.get('date') ?? todayIso());
    const sourceBuilding = buildings.find((building) => building.name === source);
    if (!guardBuilding(source)) return;
    const destinationBuilding = buildings.find((building) => building.name === destination);
    if (!batch || !sourceBuilding || !destinationBuilding || source === destination || quantity <= 0 || quantity > sourceBuilding.current || !transferDate) {
      notify('Transfert invalide : vérifiez la bande, les bâtiments, la date et la quantité disponible.');
      return;
    }
    const lot = lots.find((item) => item.id === batch);
    const transfer = {
      id: `TRF-${Date.now()}`,
      date: transferDate,
      batch,
      source,
      destination,
      quantity,
      reason: String(form.get('reason') ?? '').trim() || 'Transfert interne',
      status: 'Validé',
      recordedBy: 'Administrateur',
    };
    setTransfers((current) => [transfer, ...current]);
    setBuildings((current) => current.map((building) => {
      if (building.name === source) {
        const nextCurrent = Math.max(Number(building.current || 0) - quantity, 0);
        if (nextCurrent === 0) {
          const schedule = calculatePoultrySanitarySchedule(transferDate, sanitarySettings, undefined, '', 'Transfert complet');
          return { ...building, current: 0, sanitarySchedule: schedule, sanitaryPhase: poultrySanitaryPhase(schedule, transferDate), batchEndedDate: transferDate, cleaningStartDate: schedule.cleaningStartDate, cleaningEndDate: schedule.cleaningEndDate, restStartDate: schedule.restStartDate, restEndDate: schedule.restEndDate, availabilityDate: schedule.availabilityDate, status: poultrySanitaryPhase(schedule, transferDate), batch: '—', batchName: 'Aucun lot', age: 0 };
        }
        return { ...building, current: nextCurrent, status: building.status };
      }
      if (building.name === destination) return { ...building, current: Number(building.current || 0) + quantity, status: 'Occupé', batch, batchName: lot?.name.replace(/^Lot /, '').split(' — ')[0] ?? building.batchName, phase: lot?.phase ?? building.phase, age: lot?.age ?? building.age };
      return building;
    }));
    setTransferOpen(false);
    notify(`Le transfert de ${quantity} sujets de ${source} vers ${destination} a été enregistré.${sourceBuilding.current - quantity <= 0 ? ' Le vide sanitaire du bâtiment source est maintenant programmé automatiquement.' : ''}`);
  }

  function openBuildingForm(building?: FarmBuilding) {
    if (building && !guardBuilding(building.name)) return;
    setEditingBuilding(building ?? null);
    setBuildingOpen(true);
  }

  function saveBuilding(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get('name') ?? '').trim();
    const capacity = Number(form.get('capacity') ?? 0);
    const lengthM = Math.max(0, Number(form.get('lengthM') ?? 0));
    const widthM = Math.max(0, Number(form.get('widthM') ?? 0));
    const cleanliness = String(form.get('cleanliness') ?? 'À contrôler').trim() || 'À contrôler';
    const temperature = String(form.get('temperature') ?? '—').trim() || '—';
    const humidity = String(form.get('humidity') ?? '—').trim() || '—';
    if (!name || capacity <= 0) { notify('Le nom et une capacité positive sont obligatoires.'); return; }
    if ((lengthM > 0 && widthM <= 0) || (widthM > 0 && lengthM <= 0)) { notify('Renseignez la longueur et la largeur du bâtiment, ou laissez les deux vides.'); return; }
    if (!editingBuilding && assignedBuildings !== null && assignedBuildings.length) { notify('Votre compte ne peut pas créer ou modifier la liste des bâtiments.'); return; }
    if (editingBuilding && !guardBuilding(editingBuilding.name)) return;
    if (buildings.some((building) => building.name.toLowerCase() === name.toLowerCase() && building.id !== editingBuilding?.id)) { notify('Un autre bâtiment porte déjà ce nom.'); return; }
    if (editingBuilding && capacity < Number(editingBuilding.current || 0)) { notify(`La capacité ne peut pas être inférieure aux ${formatNumber(editingBuilding.current)} sujets présents.`); return; }
    if (editingBuilding) {
      const previousName = editingBuilding.name;
      const updated: FarmBuilding = { ...editingBuilding, name, capacity, lengthM: lengthM || undefined, widthM: widthM || undefined, cleanliness, temperature, humidity };
      setBuildings((current) => current.map((building) => building.id === updated.id ? updated : building));
      if (previousName !== name) {
        setDailyRecords((current) => current.map((record) => record.building === previousName ? { ...record, building: name } : record));
        setHealthEvents((current) => current.map((event) => event.building === previousName ? { ...event, building: name } : event));
        setTransfers((current) => current.map((transfer) => ({ ...transfer, source: transfer.source === previousName ? name : transfer.source, destination: transfer.destination === previousName ? name : transfer.destination })));
        const reports = readLocal<DagoReport[]>(FARM_STORAGE_KEYS.dagoReports, []);
        writeLocal(FARM_STORAGE_KEYS.dagoReports, reports.map((report) => report.buildingId === updated.id ? { ...report, buildingName: name } : report));
      }
      setBuildingOpen(false);
      setEditingBuilding(null);
      notify(`${name} a été modifié. Les historiques liés ont été conservés.`);
      return;
    }
    const building: FarmBuilding = { id: `BAT-${Date.now()}`, name, capacity, lengthM: lengthM || undefined, widthM: widthM || undefined, current: 0, status: 'Vide', batch: '—', batchName: 'Aucun lot', age: 0, cleanliness, temperature, humidity };
    setBuildings((current) => [...current, building]);
    setBuildingOpen(false);
    notify(`${name} a été ajouté à la ferme.`);
  }

  function deleteBuilding(building: FarmBuilding) {
    if (!guardBuilding(building.name)) return;
    const hasActiveBand = building.status === 'Occupé' && (building.batch !== '—' || Number(building.current || 0) > 0);
    const hasHistory = dailyRecords.some((record) => record.building === building.name) || healthEvents.some((event) => event.building === building.name) || transfers.some((transfer) => transfer.source === building.name || transfer.destination === building.name) || Boolean(building.cleaningHistory?.length) || readLocal<DagoReport[]>(FARM_STORAGE_KEYS.dagoReports, []).some((report) => report.buildingId === building.id || report.buildingName === building.name);
    if (hasActiveBand || hasHistory) { notify(`Suppression impossible pour ${building.name} : une bande active ou des historiques y sont liés. Désactivez le bâtiment plutôt que de perdre ces références.`); return; }
    if (!window.confirm(`Supprimer définitivement ${building.name} ?`)) return;
    setBuildings((current) => current.filter((item) => item.id !== building.id));
    notify(`${building.name} a été supprimé.`);
  }

  function createHealthEvent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const building = String(form.get('building') ?? 'Bâtiment A');
    const batch = buildings.find((item) => item.name === building)?.batch ?? 'LP-26-004';
    if (!guardBuilding(building)) return;
    const healthEvent = {
      id: `SAN-${Date.now()}`,
      date: String(form.get('date') ?? '2026-08-12'),
      batch,
      building,
      type: String(form.get('type') ?? 'Vaccination'),
      product: String(form.get('product') ?? ''),
      operator: 'Administrateur',
      status: 'Réalisée',
      note: String(form.get('note') ?? ''),
      source: 'Unité',
    };
    setHealthEvents((current) => [healthEvent, ...current]);
    setHealthOpen(false);
    notify('L’événement sanitaire a été ajouté au carnet de la ferme.');
  }

  function exportHealthReport() {
    const header = 'Date;Bande;Bâtiment;Type;Produit;Opérateur;Statut;Observation';
    const rows = visibleHealthEvents.map((event) => [event.date, event.batch, event.building, event.type, event.product, event.operator, event.status, event.note].map((value) => `"${String(value).replaceAll('"', '""')}"`).join(';'));
    const blob = new Blob([`\ufeff${[header, ...rows].join('\n')}`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'carnet-sanitaire-ferme.csv';
    link.click();
    URL.revokeObjectURL(url);
    notify('Le carnet sanitaire a été téléchargé au format CSV.');
  }

  function openNurseryForBuilding(building: FarmBuilding, initialTab: 'dimensionnement' | 'preparation' | 'j0' = 'preparation') {
    if (!guardBuilding(building.name)) return;
    setNurseryMode('preparation');
    setNurseryInitialTab(initialTab);
    setNurseryBuilding(building);
  }

  function openDimensioningForBuilding(building: FarmBuilding) {
    if (!guardBuilding(building.name)) return;
    setDimensioningPickerOpen(false);
    setNurseryMode('dimensionnement');
    setNurseryInitialTab('dimensionnement');
    setNurseryBuilding(building);
  }

  function openCleaningForm(building?: FarmBuilding) {
    if (building && !guardBuilding(building.name)) return;
    setCleaningBuildingName(building?.name ?? '');
    setCleaningProductsDraft([{ id: Date.now(), type: '', dosage: '' }]);
    setCleaningOpen(true);
  }

  function openEmergencyShortening(building: FarmBuilding) {
    if (!building.sanitarySchedule || building.sanitarySchedule.restDurationDays <= 1) return;
    if (!guardBuilding(building.name)) return;
    setEmergencyBuilding(building);
    setEmergencyRestDuration(Math.max(1, building.sanitarySchedule.restDurationDays - 1));
    setEmergencyRestReason('');
    setEmergencyRestOpen(true);
  }

  function saveEmergencyRest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!emergencyBuilding?.sanitarySchedule) return;
    if (!guardBuilding(emergencyBuilding.name)) return;
    const restDays = Math.max(1, Math.floor(Number(new FormData(event.currentTarget).get('restDurationDays') ?? 0)));
    const reason = emergencyRestReason.trim();
    const normalDays = emergencyBuilding.sanitarySchedule.restDurationDays;
    if (!reason || restDays >= normalDays) {
      notify(`Un motif est obligatoire et le repos d’urgence doit être inférieur à ${normalDays} jour(s).`);
      return;
    }
    const schedule = shortenPoultrySanitarySchedule(emergencyBuilding.sanitarySchedule, restDays, reason);
    const cookie = (name: string) => { const part = document.cookie.split('; ').find((item) => item.startsWith(`${name}=`)); return part ? decodeURIComponent(part.slice(name.length + 1)) : ''; };
    const operator = cookie('agroflux_user_name') || emergencyBuilding.cleaningOperator || 'Responsable bâtiment';
    const now = new Date().toISOString();
    const emergencyRecord: CleaningRecord = { id: `NET-${Date.now()}`, batchEndedDate: schedule.batchEndedDate, emptyReason: schedule.emptyReason, startDate: schedule.cleaningStartDate, endDate: schedule.cleaningEndDate, restStartDate: schedule.restStartDate, availabilityDate: schedule.availabilityDate, products: emergencyBuilding.cleaningProducts ?? [], equipment: emergencyBuilding.cleaningEquipment ?? [], operator, note: `Repos sanitaire raccourci en urgence à ${restDays} jour(s).`, shortened: true, shorteningReason: reason, recordedAt: now };
    setBuildings((current) => current.map((building) => building.id === emergencyBuilding.id ? { ...building, sanitarySchedule: schedule, sanitaryPhase: poultrySanitaryPhase(schedule), cleaningStartDate: schedule.cleaningStartDate, cleaningEndDate: schedule.cleaningEndDate, restStartDate: schedule.restStartDate, restEndDate: schedule.restEndDate, availabilityDate: schedule.availabilityDate, cleaningHistory: [...(building.cleaningHistory ?? []), emergencyRecord], cleaningOperator: operator, cleaningNote: emergencyRecord.note, status: poultrySanitaryPhase(schedule), cleanliness: `Repos sanitaire raccourci jusqu’au ${formatDate(schedule.restEndDate)}` } : building));
    setEmergencyRestOpen(false);
    setEmergencyBuilding(null);
    setEmergencyRestReason('');
    notify(`Le repos sanitaire de ${emergencyBuilding.name} est exceptionnellement réduit à ${restDays} jour(s).`);
  }

  function addCleaningProduct() {
    setCleaningProductsDraft((current) => [...current, { id: Date.now(), type: '', dosage: '' }]);
  }

  function updateCleaningProduct(id: number, key: 'type' | 'dosage', value: string) {
    setCleaningProductsDraft((current) => current.map((product) => product.id === id ? { ...product, [key]: value } : product));
  }

  function removeCleaningProduct(id: number) {
    setCleaningProductsDraft((current) => current.length > 1 ? current.filter((product) => product.id !== id) : [{ id: Date.now(), type: '', dosage: '' }]);
  }

  function saveCleaningSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canEditSanitarySettings) {
      notify('Votre compte ne peut pas modifier les paramètres du vide sanitaire.');
      return;
    }
    const form = new FormData(event.currentTarget);
    const next: PoultrySanitarySettings = {
      saleToCleaningDelayDays: Math.max(0, Math.floor(Number(form.get('saleToCleaningDelayDays') ?? 0))),
      cleaningDurationDays: Math.max(1, Math.floor(Number(form.get('cleaningDurationDays') ?? 1))),
      restDurationDays: Math.max(1, Math.floor(Number(form.get('restDurationDays') ?? 1))),
    };
    setSanitarySettings(next);
    writeLocal(FARM_STORAGE_KEYS.sanitarySettings, next);
    setCleaningSettingsOpen(false);
    notify('Les paramètres du vide sanitaire sont enregistrés pour les prochains calendriers.');
  }

  function recordCleaning(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const buildingName = String(form.get('building') ?? '');
    const target = buildings.find((building) => building.name === buildingName);
    const batchEndedDate = target?.batchEndedDate || target?.sanitarySchedule?.batchEndedDate || todayIso();
    const operator = String(form.get('operator') ?? '').trim();
    const note = String(form.get('note') ?? '').trim();
    const enteredProducts: PoultryCleaningProduct[] = cleaningProductsDraft.map((product) => ({ type: product.type.trim(), dosage: product.dosage.trim() })).filter((product) => product.type || product.dosage);
    if (cleaningProductsDraft.some((product) => Boolean(product.type.trim()) !== Boolean(product.dosage.trim()))) { notify('Chaque produit utilisé doit avoir un type et un dosage.'); return; }
    const products = enteredProducts.length ? enteredProducts : (target?.cleaningProducts ?? []);
    const equipment = String(form.get('equipment') ?? '').split(/[,\\n]/).map((item) => item.trim()).filter(Boolean);
    if (!target || !guardBuilding(buildingName)) return;
    if (!batchEndedDate || !operator) { notify('La fin de bande et le responsable du nettoyage sont obligatoires.'); return; }
    if (target.status === 'Occupé' && Number(target.current || 0) > 0) { notify('Ce bâtiment contient encore une bande active. Terminez ou déplacez la bande avant de planifier son vide sanitaire.'); return; }
    if (!products.length && !target.sanitarySchedule) { notify('Renseignez au moins un produit utilisé avec son dosage.'); return; }
    const schedule = target.sanitarySchedule ?? calculatePoultrySanitarySchedule(batchEndedDate, { ...sanitarySettings, saleToCleaningDelayDays: 0 }, undefined, '', 'Mise à vide');
    const phase = poultrySanitaryPhase(schedule);
    const now = new Date().toISOString();
    const cleaning: CleaningRecord = { id: `NET-${Date.now()}`, batchEndedDate, emptyReason: schedule.emptyReason, startDate: schedule.cleaningStartDate, endDate: schedule.cleaningEndDate, restStartDate: schedule.restStartDate, availabilityDate: schedule.availabilityDate, products, equipment, operator, note, shortened: schedule.shortened, shorteningReason: schedule.shorteningReason, recordedAt: now };
    const productSummary = products.map((product) => `${product.type} · ${product.dosage}`).join(' / ');
    setBuildings((current) => current.map((building) => building.id === target.id ? { ...building, batchEndedDate, sanitarySchedule: schedule, sanitaryPhase: phase, cleaningStartDate: schedule.cleaningStartDate, cleaningEndDate: schedule.cleaningEndDate, restStartDate: schedule.restStartDate, restEndDate: schedule.restEndDate, availabilityDate: schedule.availabilityDate, cleaningProduct: productSummary, cleaningProducts: products, cleaningEquipment: equipment, cleaningOperator: operator, cleaningNote: note, cleaningHistory: [...(building.cleaningHistory ?? []), cleaning], status: phase, cleanliness: `Nettoyage du ${formatDate(schedule.cleaningStartDate)} au ${formatDate(schedule.cleaningEndDate)} · repos jusqu’au ${formatDate(schedule.restEndDate)}` } : building));
    setCleaningOpen(false);
    setCleaningBuildingName('');
    notify(`${buildingName} est planifié : nettoyage du ${formatDate(schedule.cleaningStartDate)} au ${formatDate(schedule.cleaningEndDate)}, disponibilité le ${formatDate(schedule.availabilityDate)}.`);
  }

  return <div className="fade-in space-y-7">
    <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between"><div><Link href="/dashboard/poulets" className="mb-4 inline-flex items-center gap-2 text-[11px] font-bold text-[#6c8176] hover:text-forest">← Retour au dashboard de la ferme</Link><p className="eyebrow mb-2">Unité · Ferme de poulets de chair</p><h1 className="page-title">Ferme de poulets</h1><p className="muted mt-2 max-w-2xl text-[13px] leading-5">Bâtiments, bandes et suivi quotidien réunis dans un espace autonome pour l’élevage.</p></div><div className="flex flex-wrap gap-2">{tab === 'transfers' && <button className="btn-primary" onClick={() => setTransferOpen(true)}><ArrowLeftRight size={15} /> Transférer des sujets</button>}{tab === 'bands' && <><button className="btn-secondary" onClick={() => setStrainOpen(true)}><PawPrint size={15} /> Gérer les souches</button><button className="btn-primary" onClick={openBatchForm}><Plus size={16} /> Nouvelle bande</button></>}{tab === 'buildings' && <><button className="btn-secondary" onClick={() => setDagoOpen(true)}><AlertTriangle size={15} /> Signaler une mortalité</button><button className="btn-secondary" onClick={() => setDimensioningPickerOpen(true)}><Ruler size={15} /> Dimensionner</button><button className="btn-primary" onClick={() => openBuildingForm()}><Plus size={15} /> Ajouter un bâtiment</button></>}{tab === 'daily' && <><button className="btn-secondary" onClick={() => setDagoOpen(true)}><AlertTriangle size={15} /> Signaler une mortalité</button><button className="btn-primary" onClick={() => setDailyOpen(true)}><ClipboardCheck size={15} /> Saisir aujourd’hui</button></>}{tab === 'health' && <button className="btn-primary" onClick={() => setHealthOpen(true)}><ShieldCheck size={15} /> Ajouter un événement</button>}{tab === 'dago' && <button className="btn-primary" onClick={() => setTab('daily')}><ClipboardCheck size={15} /> Retour au suivi</button>}</div></div>
    {feedback && <div className="flex items-start gap-2 rounded-xl border border-[#cde8c7] bg-[#effaeb] px-4 py-3 text-[12px] font-semibold leading-5 text-[#4d8f51]"><span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#72bf70] text-white"><Check size={13} /></span>{feedback}</div>}
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><StatCard label="Animaux en élevage" value={formatNumber(totalAlive)} change={visibleLots.length ? `${activeLots.length} bande(s) active(s)` : 'Aucune donnée'} detail="ferme de poulets" icon={PawPrint} tone="green" /><StatCard label="Bâtiments actifs" value={`${visibleBuildings.filter((building) => sanitaryDisplayStatus(building) === 'Occupé').length} / ${visibleBuildings.length}`} change={visibleBuildings.length ? `${visibleBuildings.filter((building) => sanitaryDisplayStatus(building) !== 'Occupé').length} indisponible(s) ou libre(s)` : 'À créer'} detail="périmètre attribué" icon={ShieldCheck} tone="blue" /><StatCard label="Mortalité moyenne" value={`${averageMortality.toFixed(1).replace('.', ',')} %`} change={visibleLots.length ? `${totalMortality} sujet(s)` : 'Aucune donnée'} detail="bandes visibles" icon={Activity} tone="orange" /><StatCard label="Aliment consommé" value={`${formatNumber(monthFeed)} kg`} change={monthRecords.length ? `${monthRecords.length} suivi(s)` : 'Aucune donnée'} detail="mois en cours" icon={Wheat} tone="purple" />{tab === 'buildings' && <StatCard label="Consommation prévue du jour" value={`${formatNumber(expectedDailyFeedTotalKg)} kg`} change="ration automatique" detail="bâtiments visibles" icon={Wheat} tone="blue" />}</div>
    {tab === 'overview' && <Overview buildings={visibleBuildings} dailyRecords={visibleDailyRecords} lots={visibleLots} />}
    {tab === 'bands' && <BandsView lots={filteredLots} query={query} setQuery={setQuery} />}
    {tab === 'buildings' && <BuildingsView buildings={visibleBuildings} lots={visibleLots} roomPreparations={roomPreparations} chickReceptions={chickReceptions} onClean={openCleaningForm} onSettings={() => setCleaningSettingsOpen(true)} onPrepare={openNurseryForBuilding} onShorten={openEmergencyShortening} onHistory={(building) => setHistoryBuilding(building)} onEdit={openBuildingForm} onDelete={deleteBuilding} />}
    {tab === 'daily' && <><PoultryBuilding24hReport buildings={visibleBuildings} /><DailyView records={filteredDaily} query={query} setQuery={setQuery} onOpenDaily={() => setDailyOpen(true)} /></>}
    {tab === 'health' && <HealthView events={visibleHealthEvents} buildings={visibleBuildings} onAdd={() => setHealthOpen(true)} onView={(event) => setHealthDetail(event)} onExport={exportHealthReport} />}
    {tab === 'dago' && <DagoView buildingIds={buildingScopeActive ? assignedBuildings ?? undefined : undefined} onFeedback={notify} />}
    {tab === 'transfers' && <TransfersView transfers={visibleTransfers} />}
    <Modal open={dagoOpen} onClose={() => setDagoOpen(false)} title="Signaler une mortalité au responsable des poulets morts"><form onSubmit={reportDeath} className="space-y-5"><p className="muted text-[12px] leading-5">Le signalement est horodaté à l’instant du constat et sera réceptionné ensuite dans la rubrique Poulets morts.</p><label className="block"><span className="field-label">Bâtiment responsable</span><select name="buildingId" className="input-base" required><option value="">Choisir un bâtiment</option>{visibleBuildings.filter((building) => building.status === 'Occupé').map((building) => <option key={building.id} value={building.id}>{building.name} · {building.batch || 'Sans bande'}</option>)}</select></label><label className="block"><span className="field-label">Emplacement d’origine</span><select name="sourceLocation" className="input-base" required><option value="grande-salle">Grande salle</option><option value="clinique">Clinique</option></select><p className="mt-1 text-[10px] text-[#89968f]">Le choix de l’emplacement décrémente automatiquement le stock vivant correspondant après validation.</p></label><label className="block"><span className="field-label">Quantité de poulets morts</span><input name="quantity" type="number" min="1" step="1" className="input-base" required /></label><div className="rounded-xl border border-[#e1ebe0] bg-[#f6faf4] p-3 text-[10px] leading-5 text-[#6d8972]">Le délai de grâce est calculé depuis ce signalement. Le responsable des poulets morts ne peut pas créer lui-même de signalement depuis son écran de réception.</div><div className="flex justify-end gap-2"><button type="button" className="btn-secondary" onClick={() => setDagoOpen(false)}>Annuler</button><button type="submit" className="btn-primary"><AlertTriangle size={15} /> Transmettre le signalement</button></div></form></Modal>
    <Modal open={dimensioningPickerOpen} onClose={() => setDimensioningPickerOpen(false)} title="Choisir un bâtiment à dimensionner"><div className="space-y-4"><p className="muted text-[12px] leading-5">Choisissez un bâtiment pour calculer automatiquement les besoins J1 à J45 à partir de sa bande et de son effectif actuel.</p><div className="space-y-2">{visibleBuildings.length ? visibleBuildings.map((building) => <button type="button" key={building.id} className="flex w-full items-center gap-3 rounded-xl border border-[#edf0eb] bg-white p-3 text-left transition hover:border-[#bdd6bc] hover:bg-[#f5faf2]" onClick={() => openDimensioningForBuilding(building)}><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#edf3ff] text-[#6385bd]"><Ruler size={16} /></span><span className="min-w-0 flex-1"><strong className="block text-[11px] text-ink">{building.name}</strong><span className="mt-1 block text-[10px] text-[#89968f]">{building.batch && building.batch !== '—' ? `${building.batch} · ${formatNumber(building.current)} sujet(s)` : 'Aucune bande actuellement'}</span></span><ArrowRight size={15} className="shrink-0 text-[#9aa59f]" /></button>) : <p className="rounded-xl border border-dashed border-[#dce8db] p-6 text-center text-[11px] text-[#89968f]">Aucun bâtiment dans votre périmètre.</p>}</div></div></Modal>
    <Modal open={Boolean(nurseryBuilding)} onClose={() => setNurseryBuilding(null)} title={nurseryMode === 'dimensionnement' ? 'Dimensionner la salle' : 'Préparer la salle'}>{nurseryBuilding && <PoultryNurseryCalculator initialCount={nurseryBuilding.current > 0 ? nurseryBuilding.current : undefined} mode={nurseryMode} initialTab={nurseryInitialTab} building={{ id: nurseryBuilding.id, name: nurseryBuilding.name, capacity: nurseryBuilding.capacity, current: nurseryBuilding.current, batch: nurseryBuilding.batch, phase: nurseryBuilding.phase, bandStartDate: lots.find((lot) => lot.id === nurseryBuilding.batch)?.start, lengthM: nurseryBuilding.lengthM, widthM: nurseryBuilding.widthM }} onPreparationSaved={() => { setRoomPreparations(readLocal<PoultryRoomPreparation[]>(FARM_STORAGE_KEYS.roomPreparations, [])); setChickReceptions(readLocal<PoultryChickReception[]>(FARM_STORAGE_KEYS.chickReceptions, [])); }} onReceptionSaved={() => { const snapshot = loadFarmSnapshot(); setBuildings(snapshot.buildings.map((item) => refreshBuildingAvailability(item as FarmBuilding, todayIso(), sanitarySettings))); setLots(snapshot.lots); setRoomPreparations(readLocal<PoultryRoomPreparation[]>(FARM_STORAGE_KEYS.roomPreparations, [])); setChickReceptions(readLocal<PoultryChickReception[]>(FARM_STORAGE_KEYS.chickReceptions, [])); setDailyRecords(syncPoultryDailyFollowUps()); }} />}</Modal>
    <Modal open={batchOpen} onClose={() => setBatchOpen(false)} title="Créer une nouvelle bande">
      <form onSubmit={createBatch} className="space-y-5">
        <p className="muted text-[12px] leading-5">Une bande pourra ensuite être répartie dans un ou plusieurs bâtiments. Les indicateurs démarreront à la date d’arrivée des poussins.</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block"><span className="field-label">Référence de la bande</span><input name="reference" className="input-base" placeholder="Ex. LP-26-005" required /></label>
          <label className="block"><span className="field-label">Date de démarrage</span><input name="startDate" type="date" defaultValue="2026-08-12" className="input-base" required /></label>
          <label className="block"><span className="field-label">Nombre de poussins</span><input name="initialCount" type="number" min="1" className="input-base" placeholder="1200" value={batchInitialCount || ''} onChange={(event) => setBatchInitialCount(Math.max(0, Number(event.target.value) || 0))} required /></label>
          <label className="block"><span className="field-label">Souche</span><select name="strain" className="input-base">{strains.map((strain) => <option key={strain}>{strain}</option>)}<option>Autre</option></select></label>
          <label className="block"><span className="field-label">Souche personnalisée (facultatif)</span><input name="customStrain" className="input-base" placeholder="Ex. Hubbard Flex" /></label>
          <label className="block"><span className="field-label">Couvoir fournisseur</span><input name="hatchery" className="input-base" placeholder="Nom du couvoir" /></label>
          <div className="rounded-xl border border-[#e4ece2] bg-[#fbfcfa] p-3 sm:col-span-2">
            <div className="mb-3 flex items-center justify-between gap-3"><div><span className="field-label mb-0">Répartition dans les bâtiments</span><p className="mt-1 text-[10px] text-[#87958d]">Chaque ligne est contrôlée contre la capacité restante du bâtiment.</p></div><button type="button" className="btn-secondary px-2.5 py-1.5 text-[10px]" onClick={addAllocation}><Plus size={13} /> Ajouter un bâtiment</button></div>
            <div className="space-y-3">
              {allocations.map((allocation) => <div className="rounded-xl border border-[#edf0eb] bg-white p-2.5" key={allocation.id}>
                <div className="flex items-center gap-2"><select value={allocation.building} onChange={(event) => updateAllocation(allocation.id, 'building', event.target.value)} className="input-base min-w-0 flex-1"><option value="">Choisir un bâtiment</option>{visibleBuildings.map((building) => { const unavailable = isBuildingUnavailable(building) || (building.status === 'Occupé' && building.batch !== '—'); return <option key={building.id} value={building.name} disabled={unavailable}>{building.name} — {isBuildingUnavailable(building) ? 'indisponible' : building.status === 'Occupé' && building.batch !== '—' ? `occupé · ${building.batch}` : `${formatNumber(remainingCapacityForAllocation(building.name, allocation.id))} places restantes`}</option>; })}</select><input type="number" min="0" value={allocation.quantity || ''} onChange={(event) => updateAllocation(allocation.id, 'quantity', Number(event.target.value) || 0)} className="input-base w-[130px]" placeholder="Sujets" /><button type="button" className="icon-btn h-9 w-9 text-[#b45d5d]" onClick={() => removeAllocation(allocation.id)} aria-label="Supprimer la répartition"><Trash2 size={14} /></button></div>
                {allocationError(allocation) && <p className="mt-2 text-[10px] font-bold text-[#bd5c5c]">{allocationError(allocation)}</p>}
              </div>)}
            </div>
            <div className={`mt-3 rounded-xl px-3 py-2.5 text-[10px] font-bold ${distributionComplete ? 'bg-[#edf8e9] text-[#4d9352]' : 'bg-[#fff2e2] text-[#bd5c5c]'}`}><div className="flex justify-between gap-3"><span>Total réparti : {formatNumber(allocatedCount)}</span><span>Nombre saisi : {formatNumber(batchInitialCount)}</span></div>{batchInitialCount > 0 && <p className="mt-1">{allocationDifference === 0 ? 'Répartition complète.' : allocationDifference > 0 ? `Il reste ${formatNumber(allocationDifference)} poussin(s) non réparti(s).` : `La répartition dépasse de ${formatNumber(Math.abs(allocationDifference))} poussin(s).`}</p>}</div>
          </div>
          <label className="block sm:col-span-2"><span className="field-label">Note</span><textarea name="note" className="input-base min-h-[78px] resize-none" placeholder="Numéro de lot d’incubation, observation..." /></label>
        </div>
        <div className="flex justify-end gap-2 pt-1"><button type="button" className="btn-secondary" onClick={() => setBatchOpen(false)}>Annuler</button><button type="submit" className="btn-primary" disabled={!distributionComplete}><Plus size={15} /> Créer la bande</button></div>
      </form>
    </Modal>
    <Modal open={dailyOpen} onClose={() => setDailyOpen(false)} title="Saisir le suivi du jour"><form onSubmit={createDailyRecord} className="space-y-5"><p className="muted text-[12px] leading-5">Saisissez les données complémentaires du bâtiment. Les quantités d’eau et d’aliment des tâches terminées, ainsi que les mortalités signalées, sont additionnées automatiquement dans le rapport quotidien.</p><div className="rounded-xl border border-[#dce8db] bg-[#f5faf2] p-3 text-[10px] leading-5 text-[#6d9071]">Les champs mortalité, aliment et eau restent disponibles comme secours lorsqu’aucune saisie automatique n’existe encore pour ce service.</div><div className="grid gap-4 sm:grid-cols-2"><label className="block"><span className="field-label">Date du suivi</span><input name="date" type="date" defaultValue="2026-08-12" className="input-base" required /></label><label className="block"><span className="field-label">Service</span><select name="shift" className="input-base" defaultValue="jour"><option value="jour">Service jour</option><option value="nuit">Service nuit</option></select></label><label className="block"><span className="field-label">Bâtiment</span><select name="building" className="input-base">{visibleBuildings.filter((item) => item.status === 'Occupé').map((building) => <option key={building.id}>{building.name}</option>)}</select></label><label className="block"><span className="field-label">Mortalité du service</span><input name="deaths" type="number" min="0" defaultValue="0" className="input-base" /></label><label className="block"><span className="field-label">Mortalité attendue</span><input name="expectedDeaths" type="number" min="0" defaultValue="1" className="input-base" /></label><label className="block"><span className="field-label">Sujets vendus</span><input name="sold" type="number" min="0" defaultValue="0" className="input-base" /></label><label className="block"><span className="field-label">Aliment consommé réel (kg)</span><input name="feed" type="number" min="0" step="0.1" className="input-base" placeholder="0" required /></label><label className="block"><span className="field-label">Aliment attendu (kg)</span><input name="expectedFeed" type="number" min="0" step="0.1" className="input-base" placeholder="Ex. 200" required /></label><label className="block"><span className="field-label">Eau consommée (L)</span><input name="water" type="number" min="0" step="0.1" className="input-base" placeholder="0" required /></label><label className="block"><span className="field-label">Poids moyen (kg)</span><input name="weight" type="number" min="0" step="0.01" className="input-base" placeholder="0,00" /></label><label className="block"><span className="field-label">Température moyenne (°C)</span><input name="temperature" type="number" min="0" step="0.1" className="input-base" placeholder="27,0" /></label><label className="block"><span className="field-label">Humidité (%)</span><input name="humidity" type="number" min="0" max="100" step="1" className="input-base" placeholder="60" /></label></div><label className="block"><span className="field-label">Observation</span><textarea name="note" className="input-base min-h-[68px] resize-none" placeholder="Maladie, chaleur, comportement, intervention..." /></label><div className="flex justify-end gap-2 pt-1"><button type="button" className="btn-secondary" onClick={() => setDailyOpen(false)}>Annuler</button><button type="submit" className="btn-primary"><Check size={15} /> Enregistrer le suivi</button></div></form></Modal>
    <Modal open={transferOpen} onClose={() => setTransferOpen(false)} title="Transférer des sujets"><form onSubmit={createTransfer} className="space-y-5"><p className="muted text-[12px] leading-5">Le transfert conserve la même bande et le même âge. Les effectifs des deux bâtiments seront recalculés.</p><div className="grid gap-4 sm:grid-cols-2"><label className="block"><span className="field-label">Bande</span><select name="batch" className="input-base">{visibleLots.filter((lot) => lot.status !== 'Terminé' && lot.status !== 'Archivée').map((lot) => <option key={lot.id}>{lot.id}</option>)}</select></label><label className="block"><span className="field-label">Quantité de sujets</span><input name="quantity" type="number" min="1" className="input-base" placeholder="80" required /></label><label className="block"><span className="field-label">Bâtiment source</span><select name="source" className="input-base">{visibleBuildings.filter((building) => building.status === 'Occupé').map((building) => <option key={building.id}>{building.name}</option>)}</select></label><label className="block"><span className="field-label">Bâtiment destination</span><select name="destination" className="input-base">{visibleBuildings.filter((building) => building.status !== 'Hors service').map((building) => <option key={building.id}>{building.name}</option>)}</select></label></div><label className="block"><span className="field-label">Motif</span><textarea name="reason" className="input-base min-h-[70px] resize-none" placeholder="Ex. Rééquilibrage de densité" required /></label><div className="flex justify-end gap-2 pt-1"><button type="button" className="btn-secondary" onClick={() => setTransferOpen(false)}>Annuler</button><button type="submit" className="btn-primary"><ArrowLeftRight size={15} /> Valider le transfert</button></div></form></Modal>
    <Modal open={buildingOpen} onClose={() => { setBuildingOpen(false); setEditingBuilding(null); }} title={editingBuilding ? `Modifier ${editingBuilding.name}` : 'Ajouter un bâtiment'}><form onSubmit={saveBuilding} className="space-y-5"><p className="muted text-[12px] leading-5">{editingBuilding ? 'Modifiez les informations descriptives sans changer les références opérationnelles.' : 'Ajoutez un bâtiment vide qui pourra recevoir une bande après contrôle sanitaire.'}</p><div className="grid gap-4 sm:grid-cols-2"><label className="block"><span className="field-label">Nom du bâtiment</span><input name="name" className="input-base" defaultValue={editingBuilding?.name ?? ''} placeholder="Ex. Bâtiment D" required /></label><label className="block"><span className="field-label">Capacité (sujets)</span><input name="capacity" type="number" min="1" className="input-base" defaultValue={editingBuilding?.capacity ?? ''} placeholder="1200" required /></label><label className="block"><span className="field-label">Longueur (m) · facultatif</span><input name="lengthM" type="number" min="0" step="0.1" className="input-base" defaultValue={editingBuilding?.lengthM ?? ''} placeholder="Ex. 30" /></label><label className="block"><span className="field-label">Largeur (m) · facultatif</span><input name="widthM" type="number" min="0" step="0.1" className="input-base" defaultValue={editingBuilding?.widthM ?? ''} placeholder="Ex. 10" /></label><label className="block"><span className="field-label">État d’hygiène</span><select name="cleanliness" className="input-base" defaultValue={editingBuilding?.cleanliness ?? 'À contrôler'}><option>À contrôler</option><option>À planifier</option><option>Conforme</option><option>Vide sanitaire</option></select></label><label className="block"><span className="field-label">Température</span><input name="temperature" className="input-base" defaultValue={editingBuilding?.temperature ?? '—'} placeholder="Ex. 26,5 °C" /></label><label className="block"><span className="field-label">Humidité</span><input name="humidity" className="input-base" defaultValue={editingBuilding?.humidity ?? '—'} placeholder="Ex. 60 %" /></label></div>{editingBuilding && <div className="rounded-xl border border-[#e1ebe0] bg-[#f6faf4] p-3 text-[10px] leading-5 text-[#6d8972]">Effectif actuel : {formatNumber(editingBuilding.current)} sujets · bande : {editingBuilding.batch}</div>}<div className="flex justify-end gap-2"><button type="button" className="btn-secondary" onClick={() => { setBuildingOpen(false); setEditingBuilding(null); }}>Annuler</button><button type="submit" className="btn-primary"><Check size={15} /> {editingBuilding ? 'Enregistrer les modifications' : 'Ajouter le bâtiment'}</button></div></form></Modal>
    <Modal open={healthOpen} onClose={() => setHealthOpen(false)} title="Ajouter un événement sanitaire"><form onSubmit={createHealthEvent} className="space-y-5"><p className="muted text-[12px] leading-5">Ajoutez une vaccination, un traitement ou une observation au carnet de la bande.</p><div className="grid gap-4 sm:grid-cols-2"><label className="block"><span className="field-label">Date</span><input name="date" type="date" defaultValue="2026-08-12" className="input-base" required /></label><label className="block"><span className="field-label">Bâtiment</span><select name="building" className="input-base">{visibleBuildings.filter((item) => item.status === 'Occupé').map((building) => <option key={building.id}>{building.name}</option>)}</select></label><label className="block"><span className="field-label">Type</span><select name="type" className="input-base"><option>Vaccination</option><option>Traitement</option><option>Observation</option></select></label><label className="block"><span className="field-label">Produit ou événement</span><input name="product" className="input-base" placeholder="Ex. Newcastle — rappel" required /></label></div><label className="block"><span className="field-label">Observation</span><textarea name="note" className="input-base min-h-[70px] resize-none" placeholder="Dose, opérateur, délai d’attente..." /></label><div className="flex justify-end gap-2"><button type="button" className="btn-secondary" onClick={() => setHealthOpen(false)}>Annuler</button><button type="submit" className="btn-primary"><Check size={15} /> Enregistrer</button></div></form></Modal>
    <Modal open={strainOpen} onClose={() => { setStrainOpen(false); setEditingStrain(''); }} title="Gérer les souches"><div className="space-y-4"><p className="muted text-[12px] leading-5">Ajoutez ou modifiez les souches disponibles dans le formulaire de création des bandes.</p><div className="space-y-2">{strains.map((strain) => <div className="flex items-center gap-2 rounded-xl border border-[#edf0eb] px-3 py-2.5" key={strain}><PawPrint size={14} className="text-[#5b9d5b]" /><span className="flex-1 text-[11px] font-bold text-ink">{strain}</span><button className="icon-btn h-7 w-7" onClick={() => setEditingStrain(strain)} aria-label="Modifier la souche"><PencilIcon /></button></div>)}</div><form onSubmit={saveStrain} className="flex gap-2 border-t border-[#edf0eb] pt-4"><input name="strainName" key={editingStrain || 'new-strain'} defaultValue={editingStrain} className="input-base" placeholder="Ex. Hubbard Flex" required /><button type="submit" className="btn-primary px-3"><Plus size={14} /> {editingStrain ? 'Renommer' : 'Ajouter'}</button></form>{editingStrain && <button className="text-[10px] font-bold text-[#87958d] hover:underline" onClick={() => setEditingStrain('')}>Annuler la modification</button>}</div></Modal>
    <Modal open={cleaningSettingsOpen} onClose={() => setCleaningSettingsOpen(false)} title="Paramètres du vide sanitaire">{canEditSanitarySettings ? <form onSubmit={saveCleaningSettings} className="space-y-5"><p className="muted text-[12px] leading-5">Ces paramètres s’appliquent aux prochains calendriers. Les calendriers déjà enregistrés restent inchangés pour conserver leur traçabilité.</p><div className="grid gap-4 sm:grid-cols-2"><label className="block"><span className="field-label">Délai après fin de bande (jours)</span><input name="saleToCleaningDelayDays" type="number" min="0" step="1" className="input-base" defaultValue={sanitarySettings.saleToCleaningDelayDays} required /><p className="mt-1 text-[10px] text-[#89968f]">Référence actuelle : 1 jour / 24 h.</p></label><label className="block"><span className="field-label">Durée nettoyage + désinfection (jours)</span><input name="cleaningDurationDays" type="number" min="1" step="1" className="input-base" defaultValue={sanitarySettings.cleaningDurationDays} required /></label><label className="block sm:col-span-2"><span className="field-label">Repos sanitaire minimum (jours)</span><input name="restDurationDays" type="number" min="1" step="1" className="input-base" defaultValue={sanitarySettings.restDurationDays} required /><p className="mt-1 text-[10px] text-[#89968f]">Une réduction ponctuelle reste possible uniquement avec un motif d’urgence enregistré.</p></label></div><div className="flex justify-end gap-2"><button type="button" className="btn-secondary" onClick={() => setCleaningSettingsOpen(false)}>Annuler</button><button type="submit" className="btn-primary"><Check size={15} /> Enregistrer les paramètres</button></div></form> : <div className="space-y-4"><p className="muted text-[12px] leading-5">Votre compte peut consulter le calendrier, mais seul l’administrateur ou un profil disposant du droit Paramètres peut modifier ces valeurs.</p><div className="rounded-xl border border-[#e2d9f0] bg-[#f7f2fc] p-4 text-[11px] leading-5 text-[#70578f]">Délai : {sanitarySettings.saleToCleaningDelayDays} jour(s) · nettoyage : {sanitarySettings.cleaningDurationDays} jour(s) · repos : {sanitarySettings.restDurationDays} jour(s).</div><button type="button" className="btn-primary w-full" onClick={() => setCleaningSettingsOpen(false)}>Fermer</button></div>}</Modal>
    <Modal open={cleaningOpen} onClose={() => setCleaningOpen(false)} title="Planifier un vide sanitaire"><form onSubmit={recordCleaning} className="space-y-5"><p className="muted text-[12px] leading-5">Pour une mise en vide sanitaire manuelle, le nettoyage commence immédiatement. Lorsqu’un bâtiment atteint automatiquement zéro sujet, AgroFlux applique le délai de {sanitarySettings.saleToCleaningDelayDays} jour(s), puis {sanitarySettings.cleaningDurationDays} jour(s) de nettoyage et {sanitarySettings.restDurationDays} jour(s) de repos minimum.</p><div className="grid gap-4 sm:grid-cols-2"><label className="block"><span className="field-label">Bâtiment</span><select name="building" className="input-base" defaultValue={cleaningBuildingName} required>{visibleBuildings.map((building) => <option key={building.id}>{building.name}</option>)}</select></label><div className="rounded-xl border border-[#edf0eb] bg-[#fbfcfa] p-3"><span className="field-label">Mise à vide du bâtiment</span><p className="mt-1 text-[10px] leading-4 text-[#66766d]">La date est prise automatiquement dès que le bâtiment atteint zéro sujet. Elle ne peut pas être prévisionnée manuellement.</p></div><label className="block sm:col-span-2"><span className="field-label">Responsable du nettoyage</span><input name="operator" className="input-base" placeholder="Nom du responsable" required /></label></div><div className="rounded-xl border border-[#dce8db] bg-[#f5faf2] p-4 text-[10px] leading-5 text-[#6d9071]">Après l’enregistrement, les dates théoriques seront tracées dans l’historique du bâtiment. Le bâtiment restera indisponible jusqu’à la date de disponibilité calculée.</div><div className="rounded-xl border border-[#e1ebe0] bg-[#fbfcfa] p-4"><div className="flex items-start justify-between gap-3"><div><p className="field-label mb-0">Produits utilisés — type et dosage obligatoires</p><p className="mt-1 text-[10px] text-[#89968f]">Ajoutez autant de produits que nécessaire pour décrire le protocole réel.</p></div><button type="button" className="btn-secondary shrink-0 px-2.5 py-1.5 text-[10px]" onClick={addCleaningProduct}><Plus size={13} /> Ajouter</button></div><div className="mt-3 space-y-3">{cleaningProductsDraft.map((product, index) => <div className="grid gap-2 rounded-xl border border-[#edf0eb] bg-white p-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end" key={product.id}><label className="block"><span className="text-[10px] font-semibold text-[#718078]">Type de produit {index + 1}</span><select value={product.type} onChange={(event) => updateCleaningProduct(product.id, 'type', event.target.value)} className="input-base mt-1"><option value="">Choisir un produit</option><option>Virkon</option><option>Eau de Javel</option><option>D4</option><option>Crésyl</option><option>Sel</option><option>Vinaigre blanc + citron</option><option>Bicarbonate</option><option>Autre</option></select></label><label className="block"><span className="text-[10px] font-semibold text-[#718078]">Dosage</span><input value={product.dosage} onChange={(event) => updateCleaningProduct(product.id, 'dosage', event.target.value)} className="input-base mt-1" placeholder="Ex. 1 % ou 20 ml/L" /></label><button type="button" className="icon-btn h-9 w-9 text-[#b45d5d]" onClick={() => removeCleaningProduct(product.id)} aria-label={`Supprimer le produit ${index + 1}`}><X size={14} /></button></div>)}</div></div><label className="block"><span className="field-label">Matériel et zones traitées</span><textarea name="equipment" className="input-base min-h-[70px] resize-none" placeholder="Abreuvoirs, mangeoires, salle, pédiluve, brosses…" /></label><label className="block"><span className="field-label">Observation complémentaire</span><textarea name="note" className="input-base min-h-[70px] resize-none" placeholder="Nettoyage, désinfection, contrôle ou réserve…" /></label><div className="flex justify-end gap-2"><button type="button" className="btn-secondary" onClick={() => setCleaningOpen(false)}>Annuler</button><button type="submit" className="btn-primary"><Check size={15} /> Enregistrer et valider le nettoyage</button></div></form></Modal>
    <Modal open={emergencyRestOpen} onClose={() => { setEmergencyRestOpen(false); setEmergencyBuilding(null); }} title="Raccourcir le repos sanitaire (urgence)">{emergencyBuilding?.sanitarySchedule && <form onSubmit={saveEmergencyRest} className="space-y-5"><div className="rounded-xl border border-[#f0d5ad] bg-[#fff8ea] p-4 text-[11px] leading-5 text-[#8d6135]"><strong>Bâtiment concerné : {emergencyBuilding.name}</strong><p className="mt-1">Cette fenêtre concerne uniquement le raccourcissement exceptionnel du repos sanitaire. Les informations de nettoyage restent dans le formulaire principal.</p></div><div className="grid gap-4 sm:grid-cols-2"><div className="rounded-xl border border-[#edf0eb] bg-[#fbfcfa] p-3"><span className="field-label">Repos normal</span><p className="mt-1 text-[20px] font-black text-ink">{emergencyBuilding.sanitarySchedule.restDurationDays} jour(s)</p><p className="mt-1 text-[10px] text-[#89968f]">Disponibilité normale le {formatDate(emergencyBuilding.sanitarySchedule.availabilityDate)}</p></div><label className="block"><span className="field-label">Repos appliqué en urgence (jours)</span><input name="restDurationDays" type="number" min="1" max={Math.max(1, emergencyBuilding.sanitarySchedule.restDurationDays - 1)} className="input-base" value={emergencyRestDuration} onChange={(event) => setEmergencyRestDuration(Math.max(1, Number(event.target.value) || 1))} required /><p className="mt-1 text-[10px] text-[#a86f36]">Doit être inférieur au repos normal.</p></label></div><label className="block"><span className="field-label">Motif obligatoire et autorisation donnée</span><textarea className="input-base min-h-[110px] resize-none" value={emergencyRestReason} onChange={(event) => setEmergencyRestReason(event.target.value)} placeholder="Décrivez l’urgence, la raison et l’autorisation reçue…" required /></label><div className="flex justify-end gap-2"><button type="button" className="btn-secondary" onClick={() => { setEmergencyRestOpen(false); setEmergencyBuilding(null); }}>Annuler</button><button type="submit" className="btn-primary"><AlertTriangle size={15} /> Valider le raccourcissement</button></div></form>}</Modal>
    <Modal open={Boolean(historyBuilding)} onClose={() => setHistoryBuilding(null)} title="Historique du bâtiment">{historyBuilding && <div className="space-y-4"><div className="rounded-xl bg-[#f5faf2] p-4"><p className="text-[14px] font-bold text-[#477c4a]">{historyBuilding.name}</p><p className="mt-1 text-[10px] text-[#719174]">Capacité : {formatNumber(historyBuilding.capacity)} sujets · Statut : {sanitaryDisplayStatus(historyBuilding)}</p></div><div className="space-y-3"><InfoLine label="Bande actuelle" value={historyBuilding.batch} /><InfoLine label="Hygiène" value={historyBuilding.cleanliness} /><InfoLine label="Fin de bande / mise à vide" value={historyBuilding.batchEndedDate ? `${formatDate(historyBuilding.batchEndedDate)} · ${historyBuilding.sanitarySchedule?.emptyReason ?? 'Mise à vide'}` : 'Non enregistrée'} /><InfoLine label="Nettoyage / désinfection" value={historyBuilding.sanitarySchedule ? `${formatDate(historyBuilding.sanitarySchedule.cleaningStartDate)} → ${formatDate(historyBuilding.sanitarySchedule.cleaningEndDate)}` : isCleaningActive(historyBuilding) ? `${formatDate(historyBuilding.cleaningStartDate ?? '')} → ${formatDate(historyBuilding.cleaningEndDate ?? '')}` : 'Non planifié'} /><InfoLine label="Repos sanitaire" value={historyBuilding.sanitarySchedule ? `${formatDate(historyBuilding.sanitarySchedule.restStartDate)} → ${formatDate(historyBuilding.sanitarySchedule.restEndDate)}` : 'Non planifié'} /><InfoLine label="Disponibilité" value={historyBuilding.availabilityDate ? formatDate(historyBuilding.availabilityDate) : 'Selon occupation'} /></div><div><p className="field-label">Calendrier appliqué</p>{historyBuilding.sanitarySchedule ? <div className="mt-2 rounded-xl border border-[#e1ebe0] bg-[#f6faf4] p-3 text-[10px] leading-5 text-[#6d8972]"><p>Attente après fin de bande : {formatDate(historyBuilding.sanitarySchedule.batchEndedDate)} → nettoyage le {formatDate(historyBuilding.sanitarySchedule.cleaningStartDate)}.</p><p>Disponibilité théorique : {formatDate(historyBuilding.sanitarySchedule.availabilityDate)}.</p>{historyBuilding.sanitarySchedule.shortened && <p className="mt-1 font-bold text-[#a86f36]">Repos raccourci en urgence : {historyBuilding.sanitarySchedule.restDurationDays} jour(s) · {historyBuilding.sanitarySchedule.shorteningReason}</p>}</div> : <p className="mt-2 text-[11px] text-[#89968f]">Aucun calendrier détaillé enregistré.</p>}</div><div><p className="field-label">Nettoyages enregistrés</p>{historyBuilding.cleaningHistory?.length ? <div className="mt-2 space-y-2">{historyBuilding.cleaningHistory.slice().reverse().map((cleaning) => <div className="rounded-xl border border-[#edf0eb] bg-[#fbfcfa] p-3 text-[10px]" key={cleaning.id}><p className="font-bold text-ink">{formatDate(cleaning.startDate)} → {formatDate(cleaning.endDate)} · {cleaning.operator}</p><p className="mt-1 text-[#718078]">{cleaning.products?.length ? cleaning.products.map((product) => `${product.type} · ${product.dosage}`).join(' / ') : cleaning.product || 'Produits non détaillés'} · {cleaning.note || 'Aucune observation'}</p>{cleaning.equipment?.length ? <p className="mt-1 text-[#718078]">Matériel : {cleaning.equipment.join(', ')}</p> : null}{cleaning.shortened && <p className="mt-1 font-bold text-[#a86f36]">Urgence : {cleaning.shorteningReason}</p>}</div>)}</div> : <p className="mt-2 text-[11px] text-[#89968f]">Aucun nettoyage enregistré.</p>}</div><button className="btn-primary w-full" onClick={() => setHistoryBuilding(null)}>Fermer</button></div>}</Modal>
    <Modal open={Boolean(healthDetail)} onClose={() => setHealthDetail(null)} title="Détail de l’événement sanitaire">{healthDetail && <div className="space-y-4"><div className="rounded-xl bg-[#f5faf2] p-4"><p className="text-[13px] font-bold text-[#477c4a]">{healthDetail.product}</p><p className="mt-1 text-[10px] text-[#719174]">{healthDetail.type} · {formatDate(healthDetail.date)}</p></div><div className="space-y-3"><InfoLine label="Bande" value={healthDetail.batch} /><InfoLine label="Bâtiment" value={healthDetail.building} /><InfoLine label="Opérateur" value={healthDetail.operator} /><InfoLine label="Source" value={healthDetail.source === 'RH' ? 'Ajouté par RH' : 'Unité'} /><InfoLine label="Statut" value={healthDetail.status} /><InfoLine label="Observation" value={healthDetail.note} /></div><button className="btn-primary w-full" onClick={() => setHealthDetail(null)}>Fermer</button></div>}</Modal>
  </div>;
}

function PencilIcon() { return <span className="text-[12px]">✎</span>; }

function InfoLine({ label, value }: { label: string; value: string }) { return <div className="flex items-center justify-between gap-4 border-b border-[#edf0eb] pb-2 text-[11px]"><span className="text-[#849188]">{label}</span><strong className="text-right font-bold text-ink">{value}</strong></div>; }

function Overview({ buildings, dailyRecords, lots }: { buildings: FarmBuilding[]; dailyRecords: DailyRecord[]; lots: typeof poultryLots }) {
  const latestDate = dailyRecords.slice().sort((a, b) => b.date.localeCompare(a.date))[0]?.date;
  const latestRecords = latestDate ? dailyRecords.filter((record) => record.date === latestDate) : [];
  const feed = latestRecords.reduce((sum, record) => sum + Number(record.feed || 0), 0);
  const water = latestRecords.reduce((sum, record) => sum + Number(record.water || 0), 0);
  return <div className="space-y-5"><div className="grid gap-5 lg:grid-cols-[1.15fr_.85fr]"><div className="surface overflow-hidden"><div className="flex items-center justify-between border-b border-[#edf0eb] px-5 py-5 sm:px-6"><SectionHeading eyebrow="Occupation" title="État des bâtiments" /><ViewAll href="/poulets/batiments" label="Gérer les bâtiments" /></div><div className="grid gap-3 p-5 sm:grid-cols-3 sm:p-6">{buildings.length ? buildings.map((building) => <BuildingCard key={building.id} building={building} lot={lots.find((lot) => lot.id === building.batch)} />) : <EmptyFarmMessage text="Aucun bâtiment enregistré." />}</div></div><div className="surface p-5 sm:p-6"><SectionHeading eyebrow="Suivi terrain" title="Résumé du dernier jour" action={<Link href="/poulets/suivi" className="icon-btn h-8 w-8"><ArrowRight size={15} /></Link>} /><div className="mt-5 rounded-2xl bg-[#f5faf2] p-4"><div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#dff3d9] text-[#579b5a]"><ClipboardCheck size={18} /></span><div><p className="text-[12px] font-bold text-[#477c4a]">{latestRecords.length ? `${latestRecords.length} suivi(s) enregistré(s)` : 'Aucune saisie enregistrée'}</p><p className="mt-1 text-[10px] leading-4 text-[#719174]">{latestDate ? `Dernière saisie : ${formatDate(latestDate)}` : 'Commencez par saisir le suivi quotidien.'}</p></div></div><Link href="/poulets/suivi" className="btn-secondary mt-4 flex w-full"><ClipboardCheck size={14} /> Voir le suivi quotidien</Link></div><div className="mt-4 grid grid-cols-2 gap-3"><MiniMetric label="Aliment du dernier suivi" value={`${formatNumber(feed)} kg`} icon={Wheat} /><MiniMetric label="Eau du dernier suivi" value={`${formatNumber(water)} L`} icon={Droplets} /></div></div></div><div className="surface overflow-hidden"><div className="flex items-center justify-between border-b border-[#edf0eb] px-5 py-5 sm:px-6"><SectionHeading eyebrow="Journal récent" title="Derniers suivis" /><Link href="/poulets/suivi" className="icon-btn h-8 w-8" aria-label="Ouvrir tous les suivis"><ArrowRight size={15} /></Link></div><div className="table-scroll"><table className="w-full text-left"><thead><tr className="table-head"><th>Date</th><th>Bâtiment</th><th>Morts</th><th>Aliment réel / attendu</th><th>Poids</th></tr></thead><tbody>{dailyRecords.length ? dailyRecords.slice(0, 4).map((record) => <tr className="table-row table-line" key={record.id}><td>{formatDate(record.date)}</td><td><p className="font-bold text-ink">{record.building}</p><p className="mt-1 text-[10px] text-[#9aa59f]">{record.batch}</p></td><td><span className={record.deaths > 2 ? 'font-bold text-[#c76662]' : 'font-semibold text-[#5b9d5b]'}>{record.deaths}</span></td><td><strong className="text-ink">{record.feed} kg</strong><span className="ml-1 text-[10px] text-[#9aa59f]">/ {Number(record.expectedFeed || 0)} kg</span></td><td>{Number(record.averageWeight || 0).toFixed(2).replace('.', ',')} kg</td></tr>) : <tr><td colSpan={5} className="px-6 py-10 text-center text-[11px] text-[#89968f]">Aucun suivi quotidien enregistré.</td></tr>}</tbody></table></div></div></div>;
}

function EmptyFarmMessage({ text }: { text: string }) { return <div className="rounded-2xl border border-dashed border-[#dce8db] bg-[#fbfcfa] p-6 text-center text-[11px] text-[#89968f] sm:col-span-3">{text}</div>; }

function BandsView({ lots, query, setQuery }: { lots: FarmLot[]; query: string; setQuery: (value: string) => void }) { return <div className="surface overflow-hidden"><div className="flex flex-col gap-4 border-b border-[#edf0eb] px-5 pb-4 pt-5 sm:px-6"><div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><SectionHeading eyebrow="Cycle de production" title="Toutes les bandes" description="Chaque bande est suivie jusqu’à sa clôture." /><div className="relative min-w-[230px]"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9aa69f]" /><input value={query} onChange={(event) => setQuery(event.target.value)} className="input-base h-9 rounded-lg bg-[#fbfcfa] pl-9 text-[11px]" placeholder="Rechercher une bande..." /></div></div></div><div className="table-scroll"><table className="w-full text-left"><thead><tr className="table-head"><th>Bande</th><th>Démarrage</th><th>Phase</th><th>Effectif initial</th><th>Effectif restant</th><th>Âge</th><th>Poids</th><th>Morts</th><th>Taux mortalité</th><th>Statut</th><th /></tr></thead><tbody>{lots.map((lot) => <tr className="table-row table-line" key={lot.id}><td><Link href={`/poulets/${lot.id}`} className="font-bold text-ink hover:text-[#579b5b]">{lot.id}</Link><p className="mt-1 text-[10px] text-[#9aa59f]">{lot.name}</p></td><td>{formatDate(lot.start)}</td><td><span className="rounded-full bg-[#edf3ff] px-2 py-1 text-[9px] font-bold text-[#6385bd]">{lot.phase ?? 'À préciser'}</span></td><td>{formatNumber(lot.initial)}</td><td className="font-bold text-ink">{formatNumber(lot.alive)}</td><td>{lot.age ? `${lot.age} jours` : '—'}</td><td>{lot.weight.toFixed(2).replace('.', ',')} kg</td><td><strong className="text-ink">{mortalityCount(lot)}</strong> sujets</td><td><span className={lot.mortality > 4 ? 'font-bold text-[#c76662]' : 'font-semibold text-[#5b9d5b]'}>{formatPercent(lot.mortality)}</span></td><td><StatusBadge status={lot.status} /></td><td><button className="icon-btn h-8 w-8" onClick={() => window.location.assign(`/poulets/${lot.id}`)} aria-label={`Ouvrir ${lot.id}`}><MoreHorizontal size={14} /></button></td></tr>)}</tbody></table></div></div>; }

function BuildingsView({ buildings, lots, roomPreparations, chickReceptions, onClean, onSettings, onPrepare, onShorten, onHistory, onEdit, onDelete }: { buildings: FarmBuilding[]; lots: FarmLot[]; roomPreparations: PoultryRoomPreparation[]; chickReceptions: PoultryChickReception[]; onClean: (building?: FarmBuilding) => void; onSettings: () => void; onPrepare: (building: FarmBuilding, initialTab?: 'dimensionnement' | 'preparation' | 'j0') => void; onShorten: (building: FarmBuilding) => void; onHistory: (building: FarmBuilding) => void; onEdit: (building: FarmBuilding) => void; onDelete: (building: FarmBuilding) => void }) {
  return <div className="space-y-5"><BuildingDeadBirdConfirmations /><PoultrySubjectLocationsView buildings={buildings} /><PoultryFeedStockView buildings={buildings} /><div className="grid gap-4 md:grid-cols-3">{buildings.map((building) => <BuildingCard key={building.id} building={building} lot={lots.find((lot) => lot.id === building.batch)} roomPreparation={roomPreparations.find((item) => item.buildingId === building.id && item.batchId === building.batch)} chickReception={chickReceptions.find((item) => item.buildingId === building.id && item.batchId === building.batch)} detailed onClean={onClean} onPrepare={onPrepare} onShorten={onShorten} onEdit={onEdit} onDelete={onDelete} />)}</div><div className="surface overflow-hidden"><div className="flex flex-col gap-3 border-b border-[#edf0eb] px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6"><SectionHeading eyebrow="Prévention et traitement" title="Historique des bâtiments" /><div className="flex flex-wrap gap-2"><button className="btn-secondary px-3 py-2 text-[11px]" onClick={onSettings}><Settings size={14} /> Paramètres du vide sanitaire</button><button className="btn-secondary px-3 py-2 text-[11px]" onClick={() => onClean()}><ShieldCheck size={14} /> Planifier un vide sanitaire</button></div></div><div className="table-scroll"><table className="w-full text-left"><thead><tr className="table-head"><th>Bâtiment</th><th>Statut</th><th>Disponibilité</th><th>Hygiène</th><th>Température</th><th>Humidité</th><th>Actions</th></tr></thead><tbody>{buildings.map((building) => <tr className="table-row table-line" key={building.id}><td className="font-bold text-ink">{building.name}</td><td><StatusBadge status={sanitaryDisplayStatus(building)} /></td><td className="text-[10px]">{building.sanitarySchedule ? `${sanitaryDisplayStatus(building)} · disponibilité le ${formatDate(building.availabilityDate ?? building.sanitarySchedule.availabilityDate)}` : isCleaningActive(building) ? `Disponible à partir du ${formatDate(building.availabilityDate ?? (building.cleaningEndDate ? addDaysIso(building.cleaningEndDate, 1) : ''))}` : building.cleaningStartDate && building.cleaningStartDate > todayIso() ? `Nettoyage prévu du ${formatDate(building.cleaningStartDate)} au ${formatDate(building.cleaningEndDate ?? '')}` : 'Disponible selon occupation'}</td><td>{building.cleanliness}</td><td>{building.temperature}</td><td>{building.humidity}</td><td><div className="flex flex-wrap gap-1"><button className="btn-secondary px-2 py-1.5 text-[10px]" onClick={() => onEdit(building)}><Edit3 size={13} /> Modifier</button><button className="icon-btn h-8 w-8 text-[#b45d5d]" onClick={() => onDelete(building)} aria-label={`Supprimer ${building.name}`}><Trash2 size={14} /></button>{building.sanitarySchedule && isBuildingUnavailable(building) && building.sanitarySchedule.restDurationDays > 1 && <button className="btn-secondary px-2 py-1.5 text-[10px] text-[#a86f36]" onClick={() => onShorten(building)}><AlertTriangle size={12} /> Urgence</button>}<button className="text-[10px] font-bold text-[#5b9d5b] hover:underline" onClick={() => onHistory(building)}>Historique</button></div></td></tr>)}</tbody></table></div></div></div>;
}
function DailyView({ records, query, setQuery, onOpenDaily: _onOpenDaily }: { records: DailyRecord[]; query: string; setQuery: (value: string) => void; onOpenDaily: () => void }) {
  const [selected, setSelected] = useState<DailyRecord | null>(null);
  return <div className="surface overflow-hidden"><div className="flex flex-col gap-4 border-b border-[#edf0eb] px-5 pb-4 pt-5 sm:px-6"><div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><SectionHeading eyebrow="Saisie terrain" title="Suivi quotidien" description="Les quantités eau, aliment et mortalité sont consolidées automatiquement depuis les saisies de la journée." /><div className="relative min-w-[225px]"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9aa69f]" /><input value={query} onChange={(event) => setQuery(event.target.value)} className="input-base h-9 rounded-lg bg-[#fbfcfa] pl-9 text-[11px]" placeholder="Rechercher un suivi..." /></div></div></div><div className="table-scroll"><table className="w-full min-w-[960px] text-left"><thead><tr className="table-head"><th>Date</th><th>Service</th><th>Bâtiment / bande</th><th>Mortalité réel / attendue</th><th>Aliment réel / attendu</th><th>Eau</th><th>Ambiance</th><th>Observation</th><th>Saisi par</th><th>Origine</th></tr></thead><tbody>{records.map((record) => <tr className="table-row table-line" key={record.id}><td>{formatDate(record.date)}</td><td><span className={`rounded-full px-2 py-1 text-[9px] font-bold ${(record.shift ?? 'jour') === 'nuit' ? 'bg-[#eee7f8] text-[#8066a6]' : record.shift === 'jour' ? 'bg-[#fff2e2] text-[#bd7737]' : 'bg-[#f1f5ef] text-[#66766d]'}`}>{record.shift === 'nuit' ? 'Nuit' : record.shift === 'jour' ? 'Jour' : 'Non renseigné'}</span></td><td><p className="font-bold text-ink">{record.building}</p><p className="mt-1 text-[10px] text-[#9aa59f]">{record.batch}</p></td><td><span className={record.deaths > 2 ? 'font-bold text-[#c76662]' : 'font-semibold text-[#5b9d5b]'}>{record.deaths} / {record.expectedDeaths} morts</span></td><td><strong className="text-ink">{record.feed} kg</strong><span className="ml-1 text-[10px] text-[#9aa59f]">/ {Number(record.expectedFeed || 0)} kg</span></td><td>{record.water} L</td><td><span className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-[#6f7e75]"><Thermometer size={13} />{record.temperature}°C · {record.humidity}%</span></td><td>{record.note?.trim() ? <button type="button" className="inline-flex max-w-[180px] items-center gap-1 text-left text-[10px] font-semibold text-[#6385bd] hover:underline" onClick={() => setSelected(record)}><MessageSquare size={12} /> <span className="truncate">{record.note}</span></button> : <button type="button" className="text-[10px] italic text-[#9aa59f] hover:underline" onClick={() => setSelected(record)}>Aucune observation</button>}</td><td>{record.recordedBy}</td><td>{record.source === 'automatique' ? <span className="rounded-full bg-[#edf3ff] px-2 py-1 text-[9px] font-bold text-[#6385bd]">Automatique</span> : <span className="rounded-full bg-[#f1f5ef] px-2 py-1 text-[9px] font-bold text-[#66766d]">Manuel</span>}</td></tr>)}</tbody></table>{!records.length && <p className="px-6 py-14 text-center text-[11px] text-[#89968f]">Aucun suivi quotidien enregistré.</p>}</div><Modal open={Boolean(selected)} onClose={() => setSelected(null)} title="Détail du suivi quotidien">{selected && <div className="space-y-5"><div className="grid gap-3 sm:grid-cols-2"><InfoLine label="Date" value={formatDate(selected.date)} /><InfoLine label="Bâtiment" value={selected.building} /><InfoLine label="Bande" value={selected.batch} /><InfoLine label="Saisi par" value={selected.recordedBy} /><InfoLine label="Mortalité" value={`${selected.deaths} / ${selected.expectedDeaths} attendue(s)`} /><InfoLine label="Morts trouvés à la passation" value={selected.handoverDeathQuantity ? `${selected.handoverDeathQuantity} sujet(s) · ${selected.handoverCount ?? 0} transmission(s)` : 'Aucun'} /><InfoLine label="Aliment" value={`${selected.feed} kg / ${Number(selected.expectedFeed || 0)} kg attendu(s)`} /><InfoLine label="Eau" value={`${selected.water} L`} /><InfoLine label="Ambiance" value={`${selected.temperature} °C · ${selected.humidity} %`} /><InfoLine label="Origine" value={selected.source === 'automatique' ? `Automatique${selected.taskCount ? ` · ${selected.taskCount} tâche(s)` : ''}` : 'Saisie manuelle'} /></div><div className="rounded-xl border border-[#e1ebe0] bg-[#f6faf4] p-4 text-[11px] leading-5"><strong>Observation</strong><p className="mt-1 whitespace-pre-wrap text-[#53675b]">{selected.note?.trim() || 'Aucune observation'}</p></div><div className="flex justify-end"><button type="button" className="btn-primary" onClick={() => setSelected(null)}>Fermer</button></div></div>}</Modal></div>;
}

function TransfersView({ transfers }: { transfers: typeof poultryTransfers }) { return <div className="surface overflow-hidden"><div className="flex flex-col gap-4 border-b border-[#edf0eb] px-5 pb-4 pt-5 sm:flex-row sm:items-center sm:justify-between sm:px-6"><SectionHeading eyebrow="Mouvements internes" title="Transferts entre bâtiments" description="Les sujets restent dans la même bande et leur historique est conservé." /><span className="rounded-full bg-[#edf8e9] px-3 py-1.5 text-[10px] font-bold text-[#5b9d5b]">{transfers.length} transfert{transfers.length > 1 ? 's' : ''}</span></div><div className="table-scroll"><table className="w-full text-left"><thead><tr className="table-head"><th>Référence</th><th>Date</th><th>Bande</th><th>Source</th><th>Destination</th><th>Quantité</th><th>Motif</th><th>Statut</th></tr></thead><tbody>{transfers.length ? transfers.map((transfer) => <tr className="table-row table-line" key={transfer.id}><td className="font-bold text-ink">{transfer.id}</td><td>{formatDate(transfer.date)}</td><td>{transfer.batch}</td><td>{transfer.source}</td><td>{transfer.destination}</td><td><strong className="text-ink">{transfer.quantity}</strong> sujets</td><td>{transfer.reason}</td><td><StatusBadge status={transfer.status} /></td></tr>) : <tr><td colSpan={8} className="px-6 py-12 text-center text-[11px] text-[#89968f]">Aucun transfert enregistré.</td></tr>}</tbody></table></div><div className="border-t border-[#edf0eb] bg-[#fbfcfa] px-5 py-4 text-[11px] leading-5 text-[#77877e] sm:px-6"><ArrowLeftRight size={14} className="mr-1 inline text-[#5b9d5b]" /> Un transfert validé produit une sortie dans le bâtiment source et une entrée dans le bâtiment destination.</div></div>; }

function HealthView({ events, buildings, onAdd, onView, onExport }: { events: HealthEvent[]; buildings: FarmBuilding[]; onAdd: () => void; onView: (event: HealthEvent) => void; onExport: () => void }) {
  const occupied = buildings.filter((building) => building.status === 'Occupé');
  const cleanlinessPending = buildings.filter((building) => !['Conforme', 'Vide sanitaire'].includes(building.cleanliness));
  return <div className="space-y-5"><PoultryHealthCalendarView /><PoultryFeedingProtocolsView /><PoultrySanitaryChecksView /><div className="grid gap-5 lg:grid-cols-[1.2fr_.8fr]"><div className="surface overflow-hidden"><div className="flex items-center justify-between border-b border-[#edf0eb] px-5 py-5 sm:px-6"><SectionHeading eyebrow="Carnet sanitaire" title="Événements récents" /></div><div className="table-scroll"><table className="w-full text-left"><thead><tr className="table-head"><th>Date</th><th>Bande / bâtiment</th><th>Type</th><th>Produit</th><th>Statut</th><th /></tr></thead><tbody>{events.length ? events.map((event) => <tr className="table-row table-line" key={event.id}><td>{formatDate(event.date)}</td><td><p className="font-bold text-ink">{event.batch}</p><p className="mt-1 text-[10px] text-[#9aa59f]">{event.building}</p></td><td><span className="rounded-full bg-[#edf3ff] px-2 py-1 text-[10px] font-bold text-[#6385bd]">{event.type}</span></td><td>{event.product}</td><td><span className="status-badge badge-success"><Check size={12} />{event.status}</span>{event.source === 'RH' && <span className="mt-1 block w-fit rounded-full bg-[#eee7f8] px-2 py-1 text-[9px] font-bold text-[#8066a6]">Ajouté par RH</span>}</td><td><button className="icon-btn h-8 w-8" onClick={() => onView(event)} aria-label="Voir le détail"><MoreHorizontal size={14} /></button></td></tr>) : <tr><td colSpan={6} className="px-6 py-12 text-center text-[11px] text-[#89968f]">Aucun événement sanitaire enregistré.</td></tr>}</tbody></table></div></div><div className="surface p-5 sm:p-6"><SectionHeading eyebrow="Prévention et traitement" title="Points de contrôle" /><div className="mt-5 space-y-3"><ControlRow label="Bâtiments occupés suivis" value={occupied.length ? `${occupied.length} bâtiment(s)` : 'Aucun bâtiment occupé'} ok={occupied.length > 0} /><ControlRow label="Événements sanitaires" value={events.length ? `${events.length} événement(s) enregistré(s)` : 'Aucune donnée'} ok={events.length > 0} /><ControlRow label="Nettoyage des bâtiments" value={buildings.length ? (cleanlinessPending.length ? `${cleanlinessPending.length} à contrôler` : 'Tous conformes') : 'Aucun bâtiment'} ok={buildings.length > 0 && cleanlinessPending.length === 0} /><ControlRow label="Échéances sanitaires" value="À renseigner" /></div><div className="mt-5 grid gap-2"><button className="btn-primary w-full" onClick={onAdd}><ShieldCheck size={14} /> Ajouter un événement</button><button className="btn-secondary w-full" onClick={onExport}><FileText size={14} /> Exporter le carnet sanitaire</button></div></div></div></div>;
}

function mortalityCount(lot: typeof poultryLots[number]) {
  return Math.round(lot.initial * lot.mortality / 100);
}

function sanitaryDisplayStatus(building: FarmBuilding, date = todayIso()) {
  if (building.sanitarySchedule) {
    const phase = poultrySanitaryPhase(building.sanitarySchedule, date);
    return phase === 'Disponible' ? (Number(building.current || 0) > 0 ? 'Occupé' : 'Vide') : phase;
  }
  return isCleaningActive(building, date) ? 'En nettoyage / indisponible' : building.status;
}

function isCleaningActive(building: Pick<FarmBuilding, 'cleaningStartDate' | 'cleaningEndDate'>, date = todayIso()) {
  return Boolean(building.cleaningStartDate && building.cleaningEndDate && building.cleaningStartDate <= date && date <= building.cleaningEndDate);
}

function refreshBuildingAvailability(building: FarmBuilding, date = todayIso(), settings: PoultrySanitarySettings = DEFAULT_POULTRY_SANITARY_SETTINGS): FarmBuilding {
  if (!building.sanitarySchedule && Number(building.current || 0) <= 0 && building.batch && building.batch !== '—') {
    const batchEndedDate = building.batchEndedDate || date;
    const schedule = calculatePoultrySanitarySchedule(batchEndedDate, settings, undefined, '', 'Mise à vide');
    const phase = poultrySanitaryPhase(schedule, date);
    return { ...building, batchEndedDate, sanitarySchedule: schedule, sanitaryPhase: phase, status: phase === 'Disponible' ? 'Vide' : phase, cleaningStartDate: schedule.cleaningStartDate, cleaningEndDate: schedule.cleaningEndDate, restStartDate: schedule.restStartDate, restEndDate: schedule.restEndDate, availabilityDate: schedule.availabilityDate };
  }
  if (building.sanitarySchedule) {
    const phase = poultrySanitaryPhase(building.sanitarySchedule, date);
    return { ...building, sanitaryPhase: phase, status: phase === 'Disponible' ? (Number(building.current || 0) > 0 ? 'Occupé' : 'Vide') : phase, cleaningStartDate: building.sanitarySchedule.cleaningStartDate, cleaningEndDate: building.sanitarySchedule.cleaningEndDate, restStartDate: building.sanitarySchedule.restStartDate, restEndDate: building.sanitarySchedule.restEndDate, availabilityDate: building.sanitarySchedule.availabilityDate };
  }
  if (!building.cleaningEndDate || date <= building.cleaningEndDate) return building;
  return { ...building, cleaningStartDate: '', cleaningEndDate: '', restStartDate: '', restEndDate: '', availabilityDate: '', cleaningProduct: '', cleaningProducts: [], cleaningEquipment: [], cleaningOperator: '', cleaningNote: '', sanitaryPhase: 'Disponible', status: Number(building.current || 0) > 0 ? 'Occupé' : 'Vide', cleanliness: 'Conforme' };
}

function isBuildingUnavailable(building: FarmBuilding, date = todayIso()) {
  return ['Attente 24h avant nettoyage', 'En nettoyage / désinfection', 'En repos sanitaire', 'En nettoyage / indisponible'].includes(sanitaryDisplayStatus(building, date));
}

function BuildingPreparationProgress({ building, roomPreparation, chickReception, onClean, onPrepare }: { building: FarmBuilding; roomPreparation?: PoultryRoomPreparation; chickReception?: PoultryChickReception; onClean?: (building?: FarmBuilding) => void; onPrepare?: (building: FarmBuilding, initialTab?: 'dimensionnement' | 'preparation' | 'j0') => void }) {
  const today = todayIso();
  const hasSubjects = Number(building.current || 0) > 0;
  if (hasSubjects) return <div className="mt-3 rounded-xl border border-[#dce8db] bg-[#f5faf2] p-3"><div className="flex items-center justify-between gap-3"><div><p className="text-[9px] font-bold uppercase tracking-[.12em] text-[#6d9071]">Cycle du bâtiment</p><p className="mt-1 text-[11px] font-bold text-[#3e7546]">{hasSubjects ? 'Élevage en cours · préparation J0 clôturée' : 'Bande déjà reçue · préparation J0 clôturée'}</p></div><span className="rounded-full bg-[#dff3d9] px-2 py-1 text-[9px] font-bold text-[#4d9352]">{hasSubjects ? 'Actif' : 'Historique'}</span></div><p className="mt-2 text-[10px] leading-4 text-[#6d9071]">La préparation de salle n’est plus à lancer sur ce bâtiment. Le bouton Dimensionner reste disponible pour simuler les besoins de la bande.</p></div>;
  const schedule = building.sanitarySchedule;
  const cleaningRecord = schedule ? Boolean(building.cleaningHistory?.some((record) => record.startDate === schedule.cleaningStartDate && record.endDate === schedule.cleaningEndDate)) : building.cleanliness === 'Conforme';
  const cleaningWindowOpen = !schedule || today >= schedule.cleaningStartDate;
  const cleaningPeriodDone = schedule ? today > schedule.cleaningEndDate : true;
  const cleaningDone = cleaningRecord && cleaningPeriodDone;
  const restDone = cleaningRecord && (schedule ? today > schedule.restEndDate : true);
  const available = cleaningRecord && !isBuildingUnavailable(building) && (schedule ? today >= schedule.availabilityDate : building.cleanliness === 'Conforme');
  const preparationDone = roomPreparation?.status === 'Prête';
  const receptionDone = Boolean(chickReception);
  const steps = [
    { label: 'Bâtiment vidé', done: Number(building.current || 0) <= 0 },
    { label: 'Nettoyage / désinfection', done: cleaningDone },
    { label: 'Repos sanitaire', done: restDone },
    { label: 'Bâtiment disponible', done: available },
    { label: 'Préparation J-1', done: preparationDone },
    { label: 'Réception J0', done: receptionDone },
  ];
  const completed = steps.filter((step) => step.done).length;
  const cleaningNeedsValidation = !cleaningRecord && cleaningWindowOpen;
  const currentStep = !cleaningRecord ? (schedule && today < schedule.cleaningStartDate ? 'Nettoyage à démarrer' : 'Nettoyage / désinfection à valider') : !cleaningDone ? 'Nettoyage / désinfection en cours' : !restDone ? 'Repos sanitaire' : !available ? 'Contrôle de disponibilité' : !roomPreparation ? 'Préparation J-1 à lancer' : !preparationDone ? 'Checklist J-1 à compléter' : !receptionDone ? 'Réception J0 à enregistrer' : 'Préparation terminée';
  const alertMessage = !cleaningRecord ? (schedule && today < schedule.cleaningStartDate ? `Le nettoyage commencera le ${formatDate(schedule.cleaningStartDate)}.` : 'Action requise : enregistrer et valider le nettoyage / la désinfection.') : !cleaningDone ? `Nettoyage enregistré : période prévue jusqu’au ${formatDate(schedule?.cleaningEndDate ?? today)}.` : !restDone ? `Bâtiment indisponible pendant le repos sanitaire${schedule?.restEndDate ? ` jusqu’au ${formatDate(schedule.restEndDate)}` : ''}.` : !available ? 'Action requise : confirmer que le bâtiment est disponible.' : !roomPreparation ? 'Alerte : la préparation J-1 n’a pas encore été lancée.' : !preparationDone ? 'Alerte : la checklist J-1 reste à compléter.' : !receptionDone ? 'Salle prête : la réception J0 doit encore être enregistrée.' : 'Toutes les étapes de préparation sont terminées.';
  const showCleaningAction = Boolean(onClean && cleaningNeedsValidation);
  const showPreparationAction = Boolean(onPrepare && available && !preparationDone);
  const showReceptionAction = Boolean(onPrepare && available && preparationDone && !receptionDone);
  return <div className="mt-3 rounded-xl border border-[#e1ebe0] bg-white p-3"><div className="flex items-start justify-between gap-3"><div><p className="text-[9px] font-bold uppercase tracking-[.12em] text-[#7d9183]">Préparation du bâtiment</p><p className="mt-1 text-[11px] font-bold text-ink">{currentStep}</p></div><span className={`rounded-full px-2 py-1 text-[9px] font-bold ${completed === steps.length ? 'bg-[#dff3d9] text-[#4d9352]' : completed > 0 ? 'bg-[#fff2e2] text-[#bd7737]' : 'bg-[#f1f5ef] text-[#66766d]'}`}>{completed}/{steps.length} étapes</span></div><div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[#edf1eb]"><div className={`h-full rounded-full ${completed === steps.length ? 'bg-[#72bf70]' : 'bg-[#e9a05f]'}`} style={{ width: `${completed / steps.length * 100}%` }} /></div><div className="mt-3 grid gap-1.5 sm:grid-cols-2">{steps.map((step) => <div key={step.label} className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-[9px] font-semibold ${step.done ? 'bg-[#f5faf2] text-[#4d9352]' : 'bg-[#fbfcfa] text-[#89968f]'}`}><span className={`h-2 w-2 shrink-0 rounded-full ${step.done ? 'bg-[#72bf70]' : 'bg-[#d8dfd7]'}`} />{step.label}</div>)}</div><div className={`mt-3 flex items-start gap-2 rounded-lg px-2.5 py-2 text-[10px] leading-4 ${completed === steps.length ? 'bg-[#f5faf2] text-[#5b8f60]' : 'bg-[#fff8ea] text-[#986c3e]'}`}><AlertTriangle size={13} className="mt-0.5 shrink-0" /><span>{alertMessage}</span></div>{(showCleaningAction || showPreparationAction || showReceptionAction) && <div className="mt-3 flex flex-wrap gap-2">{showCleaningAction && <button type="button" className="btn-primary px-2.5 py-1.5 text-[10px]" onClick={() => onClean?.(building)}><ClipboardCheck size={13} /> Enregistrer et valider le nettoyage</button>}{showPreparationAction && <button type="button" className="btn-primary px-2.5 py-1.5 text-[10px]" onClick={() => onPrepare?.(building, 'preparation')}><ClipboardCheck size={13} /> Ouvrir la checklist J-1</button>}{showReceptionAction && <button type="button" className="btn-primary px-2.5 py-1.5 text-[10px]" onClick={() => onPrepare?.(building, 'j0')}><Clock3 size={13} /> Enregistrer la réception J0</button>}</div>}</div>;
}

function BuildingCard({ building, lot, roomPreparation, chickReception, detailed = false, onClean, onPrepare, onShorten, onEdit, onDelete }: { building: FarmBuilding; lot?: FarmLot; roomPreparation?: PoultryRoomPreparation; chickReception?: PoultryChickReception; detailed?: boolean; onClean?: (building?: FarmBuilding) => void; onPrepare?: (building: FarmBuilding, initialTab?: 'dimensionnement' | 'preparation' | 'j0') => void; onShorten?: (building: FarmBuilding) => void; onEdit?: (building: FarmBuilding) => void; onDelete?: (building: FarmBuilding) => void }) {
  const sanitaryStatus = sanitaryDisplayStatus(building);
  const unavailable = isBuildingUnavailable(building);
  const occupied = sanitaryStatus === 'Occupé' && !unavailable;
  const progress = building.capacity ? building.current / building.capacity * 100 : 0;
  const ageDays = lot ? poultryBandAge(lot.start) : Math.max(0, Number(building.age) || 0);
  const rationGrams = poultryDailyRationGrams(ageDays);
  const expectedDailyFeedKg = poultryExpectedDailyFeedKg(ageDays, building.current);
  return <div className={`rounded-2xl border p-4 ${unavailable ? 'border-[#f0d5ad] bg-[#fffaf0]' : 'border-[#edf0eb] bg-[#fbfcfa]'}`}><div className="flex items-start justify-between gap-3"><span className={`flex h-9 w-9 items-center justify-center rounded-xl ${unavailable ? 'bg-[#fff0d8] text-[#bd7737]' : occupied ? 'bg-[#edf8ea] text-[#5b9d5b]' : 'bg-[#fff3e4] text-[#bd7837]'}`}><PawPrint size={17} /></span><div className="flex items-center gap-1"><StatusBadge status={sanitaryStatus} />{onEdit && <button className="icon-btn h-8 w-8" onClick={() => onEdit(building)} aria-label={`Modifier ${building.name}`}><Edit3 size={14} /></button>}{onDelete && <button className="icon-btn h-8 w-8 text-[#b45d5d]" onClick={() => onDelete(building)} aria-label={`Supprimer ${building.name}`}><Trash2 size={14} /></button>}</div></div><p className="mt-4 text-[13px] font-bold text-ink">{building.name}</p>{unavailable ? <div className="mt-1 rounded-lg bg-[#fff0d8] px-2.5 py-2 text-[10px] font-semibold text-[#a86f36]">{sanitaryStatus} · disponibilité le {formatDate(building.availabilityDate ?? building.sanitarySchedule?.availabilityDate ?? '')}</div> : building.cleaningStartDate && building.cleaningStartDate > todayIso() ? <p className="mt-1 text-[10px] font-semibold text-[#a86f36]">Nettoyage planifié du {formatDate(building.cleaningStartDate)} au {formatDate(building.cleaningEndDate ?? '')}</p> : <p className="mt-1 text-[10px] text-[#8b9891]">{occupied ? `${building.batch} · ${building.batchName}${building.phase ? ` · ${building.phase}` : ''}` : building.cleanliness}</p>}{occupied && <><div className="mt-4"><MiniProgress value={progress} color="green" label="Occupation" right={`${Math.round(progress)} %`} /></div><div className="mt-4 flex items-end justify-between"><div><p className="text-[18px] font-black tracking-[-.05em] text-ink">{formatNumber(building.current)}</p><p className="text-[9px] text-[#8b9891]">sujets présents</p></div><div className="text-right"><p className="text-[12px] font-bold text-ink">J{building.age}</p><p className="text-[9px] text-[#8b9891]">âge de la bande</p></div></div></>}{occupied && <div className="mt-4 rounded-xl border border-[#dce8db] bg-[#f5faf2] p-3"><div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-semibold text-[#6d9071]">Consommation alimentaire prévue aujourd’hui</p><p className="mt-1 text-[22px] font-black tracking-[-.05em] text-[#3e7546]">{formatNumber(expectedDailyFeedKg)} kg</p></div><Wheat size={17} className="mt-1 text-[#5b9d5b]" /></div><p className="mt-2 text-[10px] leading-4 text-[#6d9071]">Ration : <strong>{rationGrams} g par sujet</strong> · J{ageDays} · {formatNumber(building.current)} sujets pris en compte.</p></div>}{detailed && <div className="mt-4 border-t border-[#e7ece5] pt-3 text-[10px] text-[#7d8c82]"><p>{building.temperature} · {building.humidity}</p><p className="mt-1">Hygiène : {building.cleanliness}</p><p className="mt-1">Historique nettoyage : {building.cleaningHistory?.length ?? 0} enregistrement(s)</p><BuildingPreparationProgress building={building} roomPreparation={roomPreparation} chickReception={chickReception} onClean={onClean} onPrepare={onPrepare} />{onShorten && building.sanitarySchedule && unavailable && building.sanitarySchedule.restDurationDays > 1 && <button type="button" className="btn-secondary mt-2 w-full px-2.5 py-1.5 text-[10px] text-[#a86f36]" onClick={() => onShorten(building)}><AlertTriangle size={13} /> Raccourcir le repos (urgence)</button>}</div>}</div>;
}
function MiniMetric({ label, value, icon: Icon }: { label: string; value: string; icon: LucideIcon }) { return <div className="rounded-xl border border-[#e7ece5] bg-white p-3"><Icon size={15} className="text-[#6a9e69]" /><p className="mt-2 text-[10px] font-semibold text-[#7e8c83]">{label}</p><p className="mt-1 text-[15px] font-black tracking-[-.04em] text-ink">{value}</p></div>; }
function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) { return <button className={`whitespace-nowrap rounded-lg px-3 py-2 text-[11px] font-bold transition ${active ? 'bg-white text-forest shadow-sm' : 'text-[#87948c] hover:text-ink'}`} onClick={onClick}>{children}</button>; }
function ControlRow({ label, value, ok = false }: { label: string; value: string; ok?: boolean }) { return <div className="flex items-center gap-3 rounded-xl border border-[#edf0eb] p-3"><span className={`flex h-8 w-8 items-center justify-center rounded-lg ${ok ? 'bg-[#edf8ea] text-[#5b9d5b]' : 'bg-[#fff2e2] text-[#c07839]'}`}>{ok ? <Check size={15} /> : <AlertTriangle size={15} />}</span><div className="min-w-0 flex-1"><p className="text-[11px] font-bold text-ink">{label}</p><p className="mt-1 text-[10px] text-[#8b9891]">{value}</p></div></div>; }
