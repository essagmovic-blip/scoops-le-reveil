import type { poultryDailyRecords } from '@/lib/data';
import type { DagoReport } from '@/lib/dago';
import type { DailyTaskInstance } from '@/lib/daily-tasks';
import { handoverDeathTotal, type PoultryHandoverRecord } from '@/lib/poultry-handovers';
import { FARM_STORAGE_KEYS, readLocal, writeLocal } from '@/lib/farm-storage';

export type PoultryAutomaticDailyRecord = typeof poultryDailyRecords[number] & {
  shift?: 'jour' | 'nuit';
  source?: 'manuel' | 'automatique';
  buildingId?: string;
  taskCount?: number;
  waterTaskCount?: number;
  feedTaskCount?: number;
  deathReportCount?: number;
  handoverCount?: number;
  handoverDeathQuantity?: number;
  automationUpdatedAt?: string;
  note?: string;
};

type PoultryBuildingReference = {
  id: string;
  name: string;
  batch?: string;
};

type TaskAggregate = {
  date: string;
  shift: 'jour' | 'nuit';
  buildingId: string;
  buildingName: string;
  batch: string;
  feed: number;
  water: number;
  taskCount: number;
  feedTaskCount: number;
  waterTaskCount: number;
  lastRecordedBy: string;
};

type DeathAggregate = {
  date: string;
  buildingId: string;
  buildingName: string;
  batch: string;
  deaths: number;
  deathReportCount: number;
};

type HandoverDeathAggregate = {
  date: string;
  buildingId: string;
  buildingName: string;
  batch: string;
  shift: 'jour' | 'nuit';
  deaths: number;
  handoverCount: number;
};

type CombinedDeathAggregate = {
  date: string;
  buildingId: string;
  buildingName: string;
  batch: string;
  shift: 'jour' | 'nuit';
  deaths: number;
  deathReportCount: number;
  handoverCount: number;
  handoverDeathQuantity: number;
};

/**
 * Reconstitue les lignes du suivi quotidien à partir des saisies réellement
 * terminées dans les tâches et des signalements de mortalité. Les lignes
 * manuelles restent utilisées pour les champs qui ne sont pas encore saisis
 * dans le moteur (poids, température, valeurs attendues, etc.).
 */
export function reconcilePoultryDailyFollowUps(
  records: PoultryAutomaticDailyRecord[],
  tasks: DailyTaskInstance[],
  reports: DagoReport[],
  buildings: PoultryBuildingReference[],
  now = new Date(),
  handovers: PoultryHandoverRecord[] = [],
) {
  const next = records.map((record) => ({ ...record }));
  const taskAggregates = new Map<string, TaskAggregate>();
  const deathAggregates = new Map<string, DeathAggregate>();
  const handoverDeathAggregates = new Map<string, HandoverDeathAggregate>();
  const buildingById = new Map(buildings.map((building) => [building.id, building]));

  for (const task of tasks) {
    if (task.unitId !== 'poulets' || task.status !== 'Terminée' || !task.date) continue;
    if (task.category !== 'service-eau' && task.category !== 'service-aliment') continue;
    const building = task.assignedBuildingId ? buildingById.get(task.assignedBuildingId) : undefined;
    const buildingId = task.assignedBuildingId || building?.id || task.assignedBuildingName || '';
    const buildingName = task.assignedBuildingName || building?.name || '';
    if (!buildingId || !buildingName) continue;
    const shift = task.shift === 'nuit' ? 'nuit' : 'jour';
    const batch = building?.batch && building.batch !== '—' ? building.batch : findExistingBatch(next, task.date, buildingId, buildingName) || '';
    const key = `${task.date}|${buildingId}|${shift}`;
    const current = taskAggregates.get(key) ?? { date: task.date, shift, buildingId, buildingName, batch, feed: 0, water: 0, taskCount: 0, feedTaskCount: 0, waterTaskCount: 0, lastRecordedBy: '' };
    if (task.category === 'service-eau' && typeof task.waterQuantityLiters === 'number' && Number.isFinite(task.waterQuantityLiters)) {
      current.water += Math.max(0, task.waterQuantityLiters);
      current.waterTaskCount += 1;
      current.taskCount += 1;
    }
    if (task.category === 'service-aliment' && typeof task.feedQuantityKg === 'number' && Number.isFinite(task.feedQuantityKg)) {
      current.feed += Math.max(0, task.feedQuantityKg);
      current.feedTaskCount += 1;
      current.taskCount += 1;
    }
    current.lastRecordedBy = task.assignedEmployeeName || task.assignedRole || current.lastRecordedBy;
    taskAggregates.set(key, current);
  }

  for (const report of reports) {
    const date = reportDay(report);
    const buildingId = report.buildingId || report.buildingName;
    const buildingName = report.buildingName || buildingById.get(report.buildingId)?.name || '';
    if (!date || !buildingId || !buildingName) continue;
    const building = buildingById.get(report.buildingId);
    const batch = report.batchId || (building?.batch && building.batch !== '—' ? building.batch : findExistingBatch(next, date, buildingId, buildingName) || '');
    const key = `${date}|${buildingId}`;
    const current = deathAggregates.get(key) ?? { date, buildingId, buildingName, batch, deaths: 0, deathReportCount: 0 };
    current.deaths += Math.max(0, Number(report.quantity) || 0);
    current.deathReportCount += 1;
    if (!current.batch && batch) current.batch = batch;
    deathAggregates.set(key, current);
  }

  for (const handover of handovers) {
    if (handover.status !== 'Réalisée') continue;
    const deaths = handoverDeathTotal(handover);
    if (deaths <= 0 || !handover.outgoingServiceDate || !handover.buildingId) continue;
    const building = buildingById.get(handover.buildingId);
    const buildingName = handover.buildingName || building?.name || '';
    if (!buildingName) continue;
    const key = `${handover.outgoingServiceDate}|${handover.buildingId}|${handover.outgoingShift}`;
    const current = handoverDeathAggregates.get(key) ?? { date: handover.outgoingServiceDate, buildingId: handover.buildingId, buildingName, batch: handover.batchId || building?.batch || '', shift: handover.outgoingShift, deaths: 0, handoverCount: 0 };
    current.deaths += deaths;
    current.handoverCount += 1;
    if (!current.batch && handover.batchId) current.batch = handover.batchId;
    handoverDeathAggregates.set(key, current);
  }

  for (const aggregate of taskAggregates.values()) {
    if (aggregate.taskCount === 0) continue;
    const index = findRecordIndex(next, aggregate.date, aggregate.buildingId, aggregate.buildingName, aggregate.shift);
    const record = index >= 0 ? next[index] : createAutomaticRecord(aggregate, next, now);
    const updated: PoultryAutomaticDailyRecord = {
      ...record,
      buildingId: aggregate.buildingId,
      batch: record.batch || aggregate.batch,
      feed: aggregate.feedTaskCount > 0 ? roundQuantity(aggregate.feed) : record.feed,
      water: aggregate.waterTaskCount > 0 ? roundQuantity(aggregate.water) : record.water,
      source: 'automatique',
      taskCount: aggregate.taskCount,
      feedTaskCount: aggregate.feedTaskCount,
      waterTaskCount: aggregate.waterTaskCount,
      automationUpdatedAt: now.toISOString(),
      recordedBy: aggregate.lastRecordedBy || record.recordedBy || 'Tâches quotidiennes',
    };
    if (index >= 0) next[index] = updated;
    else next.push(updated);
  }

  // Les morts provenant des signalements classiques sont conservés sur la
  // ligne du service jour historique. Les morts constatés à la transmission
  // sont imputés au service sortant. Les deux sources sont ensuite fusionnées
  // par date, bâtiment et service, sans double comptage.
  const combinedDeathAggregates = new Map<string, CombinedDeathAggregate>();
  for (const aggregate of deathAggregates.values()) {
    const key = `${aggregate.date}|${aggregate.buildingId}|jour`;
    combinedDeathAggregates.set(key, { date: aggregate.date, buildingId: aggregate.buildingId, buildingName: aggregate.buildingName, batch: aggregate.batch, shift: 'jour', deaths: aggregate.deaths, deathReportCount: aggregate.deathReportCount, handoverCount: 0, handoverDeathQuantity: 0 });
  }
  for (const aggregate of handoverDeathAggregates.values()) {
    const key = `${aggregate.date}|${aggregate.buildingId}|${aggregate.shift}`;
    const current = combinedDeathAggregates.get(key) ?? { date: aggregate.date, buildingId: aggregate.buildingId, buildingName: aggregate.buildingName, batch: aggregate.batch, shift: aggregate.shift, deaths: 0, deathReportCount: 0, handoverCount: 0, handoverDeathQuantity: 0 };
    current.deaths += aggregate.deaths;
    current.handoverCount += aggregate.handoverCount;
    current.handoverDeathQuantity += aggregate.deaths;
    if (!current.batch && aggregate.batch) current.batch = aggregate.batch;
    combinedDeathAggregates.set(key, current);
  }
  for (const aggregate of combinedDeathAggregates.values()) {
    const index = findRecordIndex(next, aggregate.date, aggregate.buildingId, aggregate.buildingName, aggregate.shift);
    const record = index >= 0 ? next[index] : createAutomaticDeathRecord(aggregate, next, now);
    const updated: PoultryAutomaticDailyRecord = {
      ...record,
      buildingId: aggregate.buildingId,
      batch: record.batch || aggregate.batch,
      deaths: aggregate.deaths,
      source: 'automatique',
      deathReportCount: aggregate.deathReportCount || record.deathReportCount,
      handoverCount: aggregate.handoverCount || record.handoverCount,
      handoverDeathQuantity: aggregate.handoverDeathQuantity || record.handoverDeathQuantity,
      automationUpdatedAt: now.toISOString(),
      recordedBy: record.recordedBy || 'Signalements et transmissions',
    };
    if (index >= 0) next[index] = updated;
    else next.push(updated);
  }

  return next;
}

/** Synchronise la clé daily sans créer de données d’activité fictives. */
export function syncPoultryDailyFollowUps() {
  if (typeof window === 'undefined') return [] as PoultryAutomaticDailyRecord[];
  const records = readLocal<PoultryAutomaticDailyRecord[]>(FARM_STORAGE_KEYS.daily, []);
  const tasks = readLocal<DailyTaskInstance[]>(FARM_STORAGE_KEYS.dailyTaskInstances, []);
  const reports = readLocal<DagoReport[]>(FARM_STORAGE_KEYS.dagoReports, []);
  const buildings = readLocal<PoultryBuildingReference[]>(FARM_STORAGE_KEYS.buildings, []);
  const handovers = readLocal<PoultryHandoverRecord[]>(FARM_STORAGE_KEYS.poultryHandovers, []);
  const next = reconcilePoultryDailyFollowUps(records, tasks, reports, buildings, new Date(), handovers);
  if (JSON.stringify(records) !== JSON.stringify(next)) writeLocal(FARM_STORAGE_KEYS.daily, next);
  return next;
}

function findRecordIndex(records: PoultryAutomaticDailyRecord[], date: string, buildingId: string, buildingName: string, shift: 'jour' | 'nuit') {
  return records.findIndex((record) => record.date === date && (record.buildingId === buildingId || record.building === buildingName) && (record.shift ?? 'jour') === shift);
}

function findExistingBatch(records: PoultryAutomaticDailyRecord[], date: string, buildingId: string, buildingName: string) {
  return records.find((record) => record.date === date && (record.buildingId === buildingId || record.building === buildingName) && record.batch && record.batch !== '—')?.batch ?? '';
}

function createAutomaticRecord(aggregate: TaskAggregate, records: PoultryAutomaticDailyRecord[], now: Date): PoultryAutomaticDailyRecord {
  const base = records.find((record) => record.date === aggregate.date && (record.buildingId === aggregate.buildingId || record.building === aggregate.buildingName));
  return {
    id: `AUTO-SUIVI-${safeId(aggregate.date)}-${safeId(aggregate.buildingId)}-${aggregate.shift}`,
    date: aggregate.date,
    building: aggregate.buildingName,
    batch: aggregate.batch || base?.batch || '',
    deaths: 0,
    expectedDeaths: 0,
    feed: 0,
    expectedFeed: 0,
    water: 0,
    sold: 0,
    averageWeight: 0,
    temperature: 0,
    humidity: 0,
    recordedBy: aggregate.lastRecordedBy || 'Tâches quotidiennes',
    shift: aggregate.shift,
    source: 'automatique',
    buildingId: aggregate.buildingId,
    taskCount: aggregate.taskCount,
    waterTaskCount: aggregate.waterTaskCount,
    feedTaskCount: aggregate.feedTaskCount,
    automationUpdatedAt: now.toISOString(),
  };
}

function createAutomaticDeathRecord(aggregate: CombinedDeathAggregate, records: PoultryAutomaticDailyRecord[], now: Date): PoultryAutomaticDailyRecord {
  const base = records.find((record) => record.date === aggregate.date && (record.buildingId === aggregate.buildingId || record.building === aggregate.buildingName));
  return {
    id: `AUTO-SUIVI-${safeId(aggregate.date)}-${safeId(aggregate.buildingId)}-${aggregate.shift}`,
    date: aggregate.date,
    building: aggregate.buildingName,
    batch: aggregate.batch || base?.batch || '',
    deaths: aggregate.deaths,
    expectedDeaths: 0,
    feed: 0,
    expectedFeed: 0,
    water: 0,
    sold: 0,
    averageWeight: 0,
    temperature: 0,
    humidity: 0,
    recordedBy: base?.recordedBy || 'Signalements et transmissions',
    shift: aggregate.shift,
    source: 'automatique',
    buildingId: aggregate.buildingId,
    deathReportCount: aggregate.deathReportCount,
    automationUpdatedAt: now.toISOString(),
  };
}

function reportDay(report: Pick<DagoReport, 'reportedAt' | 'reportedDate'>) {
  if (report.reportedDate) return report.reportedDate;
  const date = new Date(report.reportedAt);
  return Number.isNaN(date.getTime()) ? '' : new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Douala' }).format(date);
}

function roundQuantity(value: number) {
  return Math.round(value * 100) / 100;
}

function safeId(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]+/g, '-');
}
