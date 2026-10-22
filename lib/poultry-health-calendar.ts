import type { poultryHealthEvents } from '@/lib/data';
import type { DailyTaskInstance, DailyTaskTemplate } from '@/lib/daily-tasks';
import { addDaysIso, todayIso } from '@/lib/daily-tasks';
import { FARM_STORAGE_KEYS, readLocal, writeLocal } from '@/lib/farm-storage';

export type PoultryHealthCalendarStatus = 'À faire' | 'En retard' | 'Réalisée';

export type PoultryHealthCalendarEvent = typeof poultryHealthEvents[number] & {
  buildingId?: string;
  source?: string;
  scheduleSource?: 'automatique';
  scheduleStatus?: PoultryHealthCalendarStatus;
  dueDate?: string;
  noticeDate?: string;
  poultryAgeDay?: number;
  plannedTaskId?: string;
  completedAt?: string;
  completedBy?: string;
};

type PoultryHealthCalendarContext = {
  buildingId: string;
  buildingName: string;
  batchId: string;
  startDate: string;
};

type PoultryBuildingReference = {
  id: string;
  name: string;
  status: string;
  batch?: string;
};

type PoultryLotReference = {
  id: string;
  start: string;
};

/** Génère les événements sanitaires planifiés visibles dès J-1. */
export function reconcilePoultryHealthCalendar(
  events: PoultryHealthCalendarEvent[],
  templates: DailyTaskTemplate[],
  instances: DailyTaskInstance[],
  contexts: PoultryHealthCalendarContext[],
  asOfDate = todayIso(),
) {
  const next = [...events];
  const lifecycleTemplates = templates.filter((template) => template.unitId === 'poulets' && template.active && template.lifecycleTask && (template.category === 'vaccination' || template.category === 'pesee') && template.poultryAgeDay !== undefined);

  for (const template of lifecycleTemplates) for (const context of contexts) {
    const dueDate = addDaysIso(context.startDate, template.poultryAgeDay!);
    const noticeDate = addDaysIso(dueDate, -1);
    if (asOfDate < noticeDate) continue;
    const plannedTaskId = `LIFE-${context.batchId}-${context.buildingId}-${template.id}`;
    const task = instances.find((instance) => instance.id === plannedTaskId || instance.templateId === template.id && instance.assignedBuildingId === context.buildingId && instance.dueDate === dueDate);
    const status: PoultryHealthCalendarStatus = task?.status === 'Terminée' ? 'Réalisée' : asOfDate >= dueDate ? 'En retard' : 'À faire';
    const id = `CAL-POULETS-${context.batchId}-${context.buildingId}-${template.id}`;
    const existingIndex = next.findIndex((event) => event.id === id);
    const event: PoultryHealthCalendarEvent = {
      id,
      date: dueDate,
      batch: context.batchId,
      building: context.buildingName,
      buildingId: context.buildingId,
      type: template.category === 'vaccination' ? 'Vaccination' : 'Pesée',
      product: template.category === 'vaccination' ? `Vaccination J${template.poultryAgeDay}` : `Pesée J${template.poultryAgeDay}`,
      operator: task?.assignedEmployeeName || task?.assignedRole || template.assignedRole || 'Responsable du bâtiment',
      status,
      note: status === 'Réalisée' ? task?.comment || 'Échéance réalisée depuis la tâche quotidienne.' : status === 'En retard' ? 'Échéance dépassée : réaliser la tâche sanitaire et transmettre la justification.' : 'Événement visible 24 heures avant l’échéance.',
      source: 'Calendrier automatique',
      scheduleSource: 'automatique',
      scheduleStatus: status,
      dueDate,
      noticeDate,
      poultryAgeDay: template.poultryAgeDay,
      plannedTaskId,
      completedAt: task?.completedAt || '',
      completedBy: task?.assignedEmployeeName || task?.assignedRole || '',
    };
    if (existingIndex >= 0) next[existingIndex] = { ...next[existingIndex], ...event };
    else next.push(event);
  }

  return next;
}

/** Synchronise le calendrier automatique dans le carnet sanitaire partagé. */
export function syncPoultryHealthCalendar(asOfDate = todayIso()) {
  if (typeof window === 'undefined') return [] as PoultryHealthCalendarEvent[];
  const events = readLocal<PoultryHealthCalendarEvent[]>(FARM_STORAGE_KEYS.health, []);
  const templates = readLocal<DailyTaskTemplate[]>(FARM_STORAGE_KEYS.dailyTaskTemplates, []);
  const instances = readLocal<DailyTaskInstance[]>(FARM_STORAGE_KEYS.dailyTaskInstances, []);
  const buildings = readLocal<PoultryBuildingReference[]>(FARM_STORAGE_KEYS.buildings, []);
  const lots = readLocal<PoultryLotReference[]>(FARM_STORAGE_KEYS.lots, []);
  const contexts = buildings.filter((building) => building.status === 'Occupé' && Boolean(building.batch) && building.batch !== '—').map((building) => {
    const lot = lots.find((item) => item.id === building.batch);
    return lot ? { buildingId: building.id, buildingName: building.name, batchId: building.batch!, startDate: lot.start } : null;
  }).filter((context): context is PoultryHealthCalendarContext => context !== null);
  const next = reconcilePoultryHealthCalendar(events, templates, instances, contexts, asOfDate);
  if (JSON.stringify(events) !== JSON.stringify(next)) writeLocal(FARM_STORAGE_KEYS.health, next);
  return next;
}
