import type { poultryBuildings, poultryDailyRecords, poultryHealthEvents, poultryLots, poultryTransfers } from '@/lib/data';
import { FARM_STORAGE_KEYS, readLocal, writeLocal } from '@/lib/farm-storage';
import { addDaysIso, todayIso } from '@/lib/daily-tasks';

export type PoultryBandPhase = 'Poussinière' | 'Croissance et finition';
export type PoultryBuildingEmptyReason = 'Vente terminée' | 'Transfert complet' | 'Mise à vide';

/** Retourne l’âge métier de la bande en jours, J0 étant le jour d’arrivée. */
export function poultryBandAge(startDate: string, date = todayIso()) {
  const start = new Date(`${startDate}T12:00:00`).getTime();
  const current = new Date(`${date}T12:00:00`).getTime();
  return Number.isFinite(start) && Number.isFinite(current) ? Math.max(0, Math.floor((current - start) / 86400000)) : 0;
}

/** J0–J20 : poussinière (21 jours), J21–J44 : croissance et finition (24 jours). */
export function poultryBandPhase(startDate: string, date = todayIso()): PoultryBandPhase {
  return poultryBandAge(startDate, date) < 21 ? 'Poussinière' : 'Croissance et finition';
}

/**
 * Ration journalière de référence en grammes par sujet. La liste fournie
 * contient 45 valeurs ; J45 reprend donc provisoirement la dernière valeur
 * (210 g) jusqu’à validation d’une valeur spécifique par la Direction.
 */
export const POULTRY_DAILY_RATION_GRAMS = [12, 14, 16, 19, 22, 25, 28, 32, 36, 40, 44, 49, 54, 60, 66, 72, 79, 86, 93, 100, 108, 115, 122, 129, 136, 143, 150, 156, 162, 168, 173, 178, 183, 187, 191, 194, 197, 200, 202, 204, 206, 207, 208, 209, 210] as const;

export function poultryDailyRationGrams(ageDays: number) {
  const index = Math.min(Math.max(0, Math.floor(Number(ageDays) || 0)), POULTRY_DAILY_RATION_GRAMS.length - 1);
  return POULTRY_DAILY_RATION_GRAMS[index];
}

/** Formule métier : ration (g) × effectif ÷ 1000 = quantité journalière en kg. */
export function poultryExpectedDailyFeedKg(ageDays: number, headcount: number) {
  return poultryDailyRationGrams(ageDays) * Math.max(0, Number(headcount) || 0) / 1000;
}
export type FarmLot = (typeof poultryLots)[number] & { phase?: PoultryBandPhase };
export type FarmBuilding = (typeof poultryBuildings)[number] & { phase?: PoultryBandPhase; batchEndedDate?: string; sanitaryPhase?: PoultrySanitaryPhase; sanitarySchedule?: PoultrySanitarySchedule; cleaningStartDate?: string; cleaningEndDate?: string; restStartDate?: string; restEndDate?: string; availabilityDate?: string; cleaningProduct?: string; cleaningProducts?: PoultryCleaningProduct[]; cleaningEquipment?: string[]; cleaningOperator?: string; cleaningNote?: string; cleaningHistory?: PoultryCleaningRecord[] };
type BuildingWithCleaning = FarmBuilding & {
  batchEndedDate?: string;
  sanitaryPhase?: PoultrySanitaryPhase;
  sanitarySchedule?: PoultrySanitarySchedule;
  cleaningStartDate?: string;
  cleaningEndDate?: string;
  restStartDate?: string;
  restEndDate?: string;
  availabilityDate?: string;
  cleaningProduct?: string;
  cleaningProducts?: PoultryCleaningProduct[];
  cleaningEquipment?: string[];
  cleaningOperator?: string;
  cleaningNote?: string;
  cleaningHistory?: PoultryCleaningRecord[];
};
function refreshBuildingAvailability(building: BuildingWithCleaning, date = todayIso()): BuildingWithCleaning {
  if (building.sanitarySchedule) {
    const phase = poultrySanitaryPhase(building.sanitarySchedule, date);
    const status = phase === 'Disponible' ? (Number(building.current || 0) > 0 ? 'Occupé' : 'Vide') : phase;
    return { ...building, sanitaryPhase: phase, status, cleaningStartDate: building.sanitarySchedule.cleaningStartDate, cleaningEndDate: building.sanitarySchedule.cleaningEndDate, restStartDate: building.sanitarySchedule.restStartDate, restEndDate: building.sanitarySchedule.restEndDate, availabilityDate: building.sanitarySchedule.availabilityDate };
  }
  // Compatibilité avec les anciennes périodes manuelles qui ne possèdent pas
  // encore de calendrier de vide sanitaire complet.
  if (!building.cleaningEndDate || date <= building.cleaningEndDate) return building;
  return { ...building, cleaningStartDate: '', cleaningEndDate: '', restStartDate: '', restEndDate: '', availabilityDate: '', cleaningProduct: '', cleaningProducts: [], cleaningEquipment: [], cleaningOperator: '', cleaningNote: '', sanitaryPhase: 'Disponible', status: Number(building.current || 0) > 0 ? 'Occupé' : 'Vide', cleanliness: 'Conforme' };
}
export type FarmDailyRecord = (typeof poultryDailyRecords)[number];
export type FarmHealthEvent = (typeof poultryHealthEvents)[number];
export type FarmTransfer = (typeof poultryTransfers)[number];

export type PoultryNurserySettings = {
  densitySubjectsPerM2: number;
  initialBeddingDepthCm: number;
  bagsPerM2AtInitialDepth: number;
  renewalCountBeforeWeeklyAddition: number;
  additionalBeddingDepthCmPerWeek: number;
  subjectsPerDrinker: number;
  subjectsPerFeeder: number;
  subjectsPerRadiant: number;
};

/**
 * Références terrain modifiables : la densité et la litière disposent d’une
 * base de travail ; les capacités du matériel sont laissées à 0 tant que la
 * Direction n’a pas validé les paliers d’équipement.
 */
export const DEFAULT_POULTRY_NURSERY_SETTINGS: PoultryNurserySettings = {
  densitySubjectsPerM2: 45,
  initialBeddingDepthCm: 5,
  bagsPerM2AtInitialDepth: 1,
  renewalCountBeforeWeeklyAddition: 2,
  additionalBeddingDepthCmPerWeek: 5,
  subjectsPerDrinker: 0,
  subjectsPerFeeder: 0,
  subjectsPerRadiant: 0,
};

export type PoultryNurseryNeeds = {
  plannedCount: number;
  requiredSurfaceM2: number;
  initialBeddingBags: number;
  weeksAfterRenewals: number;
  additionalBeddingDepthCm: number;
  totalBeddingDepthCm: number;
  totalBeddingBags: number;
  drinkers: number;
  feeders: number;
  radiants: number;
  equipmentConfigured: boolean;
};

export type PoultryBuildingDimensioningPhase = 'Démarrage' | 'Croissance' | 'Finition';

export type PoultryBuildingDimensioningSettings = {
  densitySubjectsPerM2: number;
  starterEndDay: number;
  growthEndDay: number;
  starterSurfaceFraction: number;
  growthSurfaceFraction: number;
  starterSubjectsPerTray: number;
  starterSubjectsPerDrinker: number;
  growthSubjectsPerFeeder: number;
  growthSubjectsPerBellDrinker: number;
  growthSubjectsPerNipple: number;
};

/** Références du simulateur J1–J45, indépendantes de la préparation J0 actuelle. */
export const DEFAULT_POULTRY_BUILDING_DIMENSIONING_SETTINGS: PoultryBuildingDimensioningSettings = {
  densitySubjectsPerM2: 10,
  starterEndDay: 10,
  growthEndDay: 20,
  starterSurfaceFraction: 1 / 3,
  growthSurfaceFraction: 2 / 3,
  starterSubjectsPerTray: 50,
  starterSubjectsPerDrinker: 50,
  growthSubjectsPerFeeder: 40,
  growthSubjectsPerBellDrinker: 80,
  growthSubjectsPerNipple: 10,
};

export type PoultryBuildingDimensioningDay = {
  day: number;
  phase: PoultryBuildingDimensioningPhase;
  surfaceFraction: number;
  totalRequiredSurfaceM2: number;
  usefulSurfaceM2: number;
  starterTrays: number;
  starterDrinkers: number;
  circularFeeders: number;
  bellDrinkers: number;
  nippleDrinkers: number;
  feedGramsPerSubject: number;
};

export function calculatePoultryBuildingDimensioningDay(
  day: number,
  headcount: number,
  settings: PoultryBuildingDimensioningSettings = DEFAULT_POULTRY_BUILDING_DIMENSIONING_SETTINGS,
): PoultryBuildingDimensioningDay {
  const normalizedDay = Math.min(45, Math.max(1, Math.floor(Number(day) || 1)));
  const count = Math.max(0, Math.ceil(Number(headcount) || 0));
  const density = Math.max(0.1, Number(settings.densitySubjectsPerM2) || 0.1);
  const totalRequiredSurfaceM2 = count > 0 ? Math.ceil(count / density) : 0;
  const phase = normalizedDay <= settings.starterEndDay ? 'Démarrage' : normalizedDay <= settings.growthEndDay ? 'Croissance' : 'Finition';
  const surfaceFraction = normalizedDay <= settings.starterEndDay ? settings.starterSurfaceFraction : normalizedDay <= settings.growthEndDay ? settings.growthSurfaceFraction : 1;
  const usefulSurfaceM2 = Math.round(totalRequiredSurfaceM2 * surfaceFraction * 100) / 100;
  const ceilBy = (subjectsPerUnit: number) => subjectsPerUnit > 0 && count > 0 ? Math.ceil(count / subjectsPerUnit) : 0;
  return {
    day: normalizedDay,
    phase,
    surfaceFraction,
    totalRequiredSurfaceM2,
    usefulSurfaceM2,
    starterTrays: normalizedDay <= settings.starterEndDay ? ceilBy(settings.starterSubjectsPerTray) : 0,
    starterDrinkers: normalizedDay <= settings.starterEndDay ? ceilBy(settings.starterSubjectsPerDrinker) : 0,
    circularFeeders: normalizedDay > settings.starterEndDay ? ceilBy(settings.growthSubjectsPerFeeder) : 0,
    bellDrinkers: normalizedDay > settings.starterEndDay ? ceilBy(settings.growthSubjectsPerBellDrinker) : 0,
    nippleDrinkers: normalizedDay > settings.starterEndDay ? ceilBy(settings.growthSubjectsPerNipple) : 0,
    feedGramsPerSubject: poultryDailyRationGrams(normalizedDay - 1),
  };
}

/** Calcule les besoins de la poussinière sans dépendre de l’interface. */
export function calculatePoultryNurseryNeeds(
  plannedCount: number,
  weeksAfterRenewals = 0,
  settings: PoultryNurserySettings = DEFAULT_POULTRY_NURSERY_SETTINGS,
): PoultryNurseryNeeds {
  const count = Math.max(0, Math.ceil(Number(plannedCount) || 0));
  const density = Math.max(0, Number(settings.densitySubjectsPerM2) || 0);
  const initialDepth = Math.max(0.1, Number(settings.initialBeddingDepthCm) || 0.1);
  const bagsPerM2 = Math.max(0, Number(settings.bagsPerM2AtInitialDepth) || 0);
  const weeklyDepth = Math.max(0, Number(settings.additionalBeddingDepthCmPerWeek) || 0);
  const weeks = Math.max(0, Math.floor(Number(weeksAfterRenewals) || 0));
  const requiredSurfaceM2 = count > 0 && density > 0 ? Math.ceil(count / density) : 0;
  const additionalBeddingDepthCm = weeks * weeklyDepth;
  const totalBeddingDepthCm = count > 0 ? initialDepth + additionalBeddingDepthCm : 0;
  const initialBeddingBags = requiredSurfaceM2 > 0 ? Math.ceil(requiredSurfaceM2 * bagsPerM2) : 0;
  const totalBeddingBags = requiredSurfaceM2 > 0 ? Math.ceil(initialBeddingBags * (totalBeddingDepthCm / initialDepth)) : 0;
  const equipmentCount = (capacity: number) => count > 0 && Number(capacity) > 0 ? Math.ceil(count / Number(capacity)) : 0;
  const drinkers = equipmentCount(settings.subjectsPerDrinker);
  const feeders = equipmentCount(settings.subjectsPerFeeder);
  const radiants = equipmentCount(settings.subjectsPerRadiant);
  return { plannedCount: count, requiredSurfaceM2, initialBeddingBags, weeksAfterRenewals: weeks, additionalBeddingDepthCm, totalBeddingDepthCm, totalBeddingBags, drinkers, feeders, radiants, equipmentConfigured: Number(settings.subjectsPerDrinker) > 0 && Number(settings.subjectsPerFeeder) > 0 && Number(settings.subjectsPerRadiant) > 0 };
}

export type PoultrySanitarySettings = {
  saleToCleaningDelayDays: number;
  cleaningDurationDays: number;
  restDurationDays: number;
};

export const DEFAULT_POULTRY_SANITARY_SETTINGS: PoultrySanitarySettings = {
  saleToCleaningDelayDays: 1,
  cleaningDurationDays: 3,
  restDurationDays: 14,
};

export type PoultryCleaningProduct = {
  type: string;
  dosage: string;
};

export type PoultrySanitarySchedule = {
  batchEndedDate: string;
  emptyReason: PoultryBuildingEmptyReason;
  cleaningStartDate: string;
  cleaningEndDate: string;
  restStartDate: string;
  restEndDate: string;
  availabilityDate: string;
  restDurationDays: number;
  shortened: boolean;
  shorteningReason: string;
};

export type PoultrySanitaryPhase = 'Attente 24h avant nettoyage' | 'En nettoyage / désinfection' | 'En repos sanitaire' | 'Disponible';

export type PoultryCleaningRecord = {
  id: string;
  batchEndedDate: string;
  emptyReason: PoultryBuildingEmptyReason;
  startDate: string;
  endDate: string;
  restStartDate: string;
  availabilityDate: string;
  products?: PoultryCleaningProduct[];
  /** Ancien champ conservé pour les historiques créés avant le questionnaire structuré. */
  product?: string;
  equipment?: string[];
  operator: string;
  note: string;
  shortened: boolean;
  shorteningReason: string;
  recordedAt: string;
};

/** Calcule le calendrier d’un vide sanitaire à partir de la fin de bande. */
export function calculatePoultrySanitarySchedule(
  batchEndedDate: string,
  settings: PoultrySanitarySettings = DEFAULT_POULTRY_SANITARY_SETTINGS,
  restDurationOverride?: number,
  shorteningReason = '',
  emptyReason: PoultryBuildingEmptyReason = 'Mise à vide',
): PoultrySanitarySchedule {
  const delayDays = Math.max(0, Math.ceil(Number(settings.saleToCleaningDelayDays) || 0));
  const cleaningDays = Math.max(1, Math.floor(Number(settings.cleaningDurationDays) || 1));
  const standardRestDays = Math.max(1, Math.floor(Number(settings.restDurationDays) || 1));
  const requestedRestDays = restDurationOverride === undefined ? standardRestDays : Math.max(1, Math.floor(Number(restDurationOverride) || 1));
  const restDurationDays = Math.min(requestedRestDays, standardRestDays);
  const cleaningStartDate = addDaysIso(batchEndedDate, delayDays);
  const cleaningEndDate = addDaysIso(cleaningStartDate, cleaningDays - 1);
  const restStartDate = addDaysIso(cleaningEndDate, 1);
  const restEndDate = addDaysIso(restStartDate, restDurationDays - 1);
  const availabilityDate = addDaysIso(restStartDate, restDurationDays);
  const shortened = restDurationDays < standardRestDays;
  return { batchEndedDate, emptyReason, cleaningStartDate, cleaningEndDate, restStartDate, restEndDate, availabilityDate, restDurationDays, shortened, shorteningReason: shortened ? shorteningReason.trim() : '' };
}

export function shortenPoultrySanitarySchedule(schedule: PoultrySanitarySchedule, restDurationDays: number, shorteningReason: string): PoultrySanitarySchedule {
  const restDays = Math.max(1, Math.min(schedule.restDurationDays, Math.floor(Number(restDurationDays) || 1)));
  const restEndDate = addDaysIso(schedule.restStartDate, restDays - 1);
  const availabilityDate = addDaysIso(schedule.restStartDate, restDays);
  return { ...schedule, restDurationDays: restDays, restEndDate, availabilityDate, shortened: true, shorteningReason: shorteningReason.trim() };
}

export function poultrySanitaryPhase(schedule: PoultrySanitarySchedule, date = todayIso()): PoultrySanitaryPhase {
  if (date < schedule.cleaningStartDate) return 'Attente 24h avant nettoyage';
  if (date <= schedule.cleaningEndDate) return 'En nettoyage / désinfection';
  if (date < schedule.availabilityDate) return 'En repos sanitaire';
  return 'Disponible';
}

export type FarmSnapshot = {
  lots: FarmLot[];
  buildings: FarmBuilding[];
  daily: FarmDailyRecord[];
  health: FarmHealthEvent[];
  transfers: FarmTransfer[];
};

export type BatchArchive = {
  id: string;
  batchId: string;
  name: string;
  closedAt: string;
  closedBy: string;
  initialCount: number;
  totalDeaths: number;
  totalSold: number;
  finalAlive: number;
  finalWeight: number;
  feedTotal: number;
  expectedFeedTotal: number;
  waterTotal: number;
  mortalityRate: number;
  salesTotal: number;
  expensesTotal: number;
  margin: number;
  recordsCount: number;
  buildings: string[];
};

export type PoultrySaleInput = {
  id: string;
  batchId: string;
  buildingName?: string;
  date: string;
  quantity: number;
  unitPrice: number;
  total: number;
  customer: string;
  paymentMethod: string;
};

/** Enregistre une vente de sujets et répercute immédiatement l'effectif. */
export function registerPoultrySale(input: PoultrySaleInput) {
  if (typeof window === 'undefined' || input.quantity <= 0) return false;
  const lots = readLocal(FARM_STORAGE_KEYS.lots, [] as FarmLot[]);
  const lot = lots.find((item) => item.id === input.batchId);
  if (!lot || input.quantity > Number(lot.alive || 0)) return false;
  const sales = readLocal(FARM_STORAGE_KEYS.sales, [] as PoultrySaleInput[]);
  if (sales.some((sale) => sale.id === input.id)) return true;
  writeLocal(FARM_STORAGE_KEYS.sales, [input, ...sales]);
  const alive = Math.max(Number(lot.alive || 0) - input.quantity, 0);
  writeLocal(FARM_STORAGE_KEYS.lots, lots.map((item) => item.id === lot.id ? { ...item, alive, status: alive === 0 ? 'Terminé' : item.status } : item));
  const buildings = readLocal(FARM_STORAGE_KEYS.buildings, [] as BuildingWithCleaning[]);
  const target = buildings.find((item) => input.buildingName ? item.name === input.buildingName : item.batch === input.batchId);
  if (target) {
    const current = Math.max(Number(target.current || 0) - input.quantity, 0);
    if (alive === 0 || current === 0) {
      const sanitarySettings = { ...DEFAULT_POULTRY_SANITARY_SETTINGS, ...readLocal<Partial<PoultrySanitarySettings>>(FARM_STORAGE_KEYS.sanitarySettings, {}) };
      const sanitarySchedule = calculatePoultrySanitarySchedule(input.date || todayIso(), sanitarySettings, undefined, '', 'Vente terminée');
      const sanitaryPhase = poultrySanitaryPhase(sanitarySchedule, input.date || todayIso());
      writeLocal(FARM_STORAGE_KEYS.buildings, buildings.map((item) => item.id === target.id ? { ...item, current, batchEndedDate: input.date || todayIso(), sanitarySchedule, sanitaryPhase, cleaningStartDate: sanitarySchedule.cleaningStartDate, cleaningEndDate: sanitarySchedule.cleaningEndDate, restStartDate: sanitarySchedule.restStartDate, restEndDate: sanitarySchedule.restEndDate, availabilityDate: sanitarySchedule.availabilityDate, status: sanitaryPhase } : item));
    } else writeLocal(FARM_STORAGE_KEYS.buildings, buildings.map((item) => item.id === target.id ? { ...item, current, status: item.status === 'Vide' ? 'Occupé' : item.status } : item));
  }
  return true;
}

/**
 * Lit les données de la ferme et répare une fois les anciennes données qui
 * avaient des suivis de mortalité sans répercuter l'effectif.
 */
export function loadFarmSnapshot(): FarmSnapshot {
  const storedLots = readLocal(FARM_STORAGE_KEYS.lots, [] as FarmLot[]);
  const lots = storedLots.map((lot) => ({ ...lot, phase: poultryBandPhase(lot.start) }));
  const storedBuildings = readLocal(FARM_STORAGE_KEYS.buildings, [] as BuildingWithCleaning[]);
  const buildings = storedBuildings.map((building) => refreshBuildingAvailability(building));
  if (typeof window !== 'undefined' && JSON.stringify(storedBuildings) !== JSON.stringify(buildings)) writeLocal(FARM_STORAGE_KEYS.buildings, buildings);
  const daily = readLocal(FARM_STORAGE_KEYS.daily, [] as FarmDailyRecord[]);
  const health = readLocal(FARM_STORAGE_KEYS.health, [] as FarmHealthEvent[]);
  const transfers = readLocal(FARM_STORAGE_KEYS.transfers, [] as FarmTransfer[]);

  if (typeof window !== 'undefined' && window.localStorage.getItem(FARM_STORAGE_KEYS.calculationVersion) !== '2') {
    const sales = readLocal(FARM_STORAGE_KEYS.sales, [] as Array<{ batch: string; quantity: number }>);
    const reconciledLots = lots.map((lot) => {
      const lotRecords = daily.filter((record) => record.batch === lot.id);
      const deaths = lotRecords.reduce((sum, record) => sum + Number(record.deaths || 0), 0);
      const dailySold = lotRecords.reduce((sum, record) => sum + Number(record.sold || 0), 0);
      const registeredSales = sales.filter((sale) => sale.batch === lot.id).reduce((sum, sale) => sum + Number(sale.quantity || 0), 0);
      const sold = Math.max(dailySold, registeredSales);
      const latest = lotRecords.slice().sort((a, b) => b.date.localeCompare(a.date))[0];
      const alive = Math.max(Number(lot.initial || 0) - deaths - sold, 0);
      return {
        ...lot,
        alive,
        mortality: lot.initial ? deaths / lot.initial * 100 : 0,
        weight: latest && Number(latest.averageWeight) > 0 ? latest.averageWeight : lot.weight,
        status: alive === 0 ? 'Terminé' : lot.status,
      };
    });
    const reconciledBuildings = buildings.map((building) => {
      const buildingRecords = daily.filter((record) => record.building === building.name && record.batch === building.batch);
      const deaths = buildingRecords.reduce((sum, record) => sum + Number(record.deaths || 0), 0);
      const dailySold = buildingRecords.reduce((sum, record) => sum + Number(record.sold || 0), 0);
      const registeredSales = building.batch ? sales.filter((sale) => sale.batch === building.batch).reduce((sum, sale) => sum + Number(sale.quantity || 0), 0) : 0;
      const losses = deaths + Math.max(dailySold, registeredSales);
      return losses > 0 ? { ...building, current: Math.max(Number(building.current || 0) - losses, 0) } : building;
    });
    writeLocal(FARM_STORAGE_KEYS.lots, reconciledLots);
    writeLocal(FARM_STORAGE_KEYS.buildings, reconciledBuildings);
    window.localStorage.setItem(FARM_STORAGE_KEYS.calculationVersion, '2');
    return { lots: reconciledLots, buildings: reconciledBuildings, daily, health, transfers };
  }

  return { lots, buildings, daily, health, transfers };
}
