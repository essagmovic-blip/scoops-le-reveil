import type { DailyTaskInstance, DailyTaskShift } from '@/lib/daily-tasks';

export type PoultryHandoverAnswer = 'Oui' | 'Non';
export type PoultryHandoverStatus = 'À compléter' | 'Réalisée';

export type PoultryHandoverStart = {
  id: string;
  buildingId: string;
  serviceDate: string;
  incomingShift: DailyTaskShift;
  responsibleId: string;
  responsibleName: string;
  startedAt: string;
};

export type PoultryHandoverRecord = {
  id: string;
  buildingId: string;
  buildingName: string;
  batchId: string;
  /** Date opérationnelle du service entrant. */
  serviceDate: string;
  incomingShift: DailyTaskShift;
  outgoingShift: DailyTaskShift;
  outgoingServiceDate: string;
  incomingResponsibleId: string;
  incomingResponsibleName: string;
  outgoingResponsibleId: string;
  outgoingResponsibleName: string;
  createdAt: string;
  answeredAt: string;
  status: PoultryHandoverStatus;
  roomTour: PoultryHandoverAnswer | '';
  deathsFound: PoultryHandoverAnswer | '';
  deathsFoundQuantity: number;
  deathsMainRoomQuantity: number;
  deathsClinicQuantity: number;
  deathsFreshQuantity: number;
  deathsDecomposedQuantity: number;
  deathsObservation: string;
  waterersWashed: PoultryHandoverAnswer | '';
  waterDrumsFilled: PoultryHandoverAnswer | '';
  equipmentStored: PoultryHandoverAnswer | '';
  roomClean: PoultryHandoverAnswer | '';
  footbathReady: PoultryHandoverAnswer | '';
  feedBagsFound: number;
  comment: string;
};

export type PoultryHandoverBuilding = { id: string; name: string; batchId?: string; current?: number };

export function oppositeShift(shift: DailyTaskShift): DailyTaskShift {
  return shift === 'jour' ? 'nuit' : 'jour';
}

export function poultryHandoverId(buildingId: string, serviceDate: string, incomingShift: DailyTaskShift, incomingResponsibleId: string) {
  return `HANDOVER-${safePart(buildingId)}-${serviceDate}-${incomingShift}-${safePart(incomingResponsibleId || 'responsable')}`;
}

export function poultryHandoverStartId(buildingId: string, serviceDate: string, incomingShift: DailyTaskShift, responsibleId: string) {
  return `HANDOVER-START-${safePart(buildingId)}-${serviceDate}-${incomingShift}-${safePart(responsibleId || 'responsable')}`;
}

export function handoverHasStarted(starts: PoultryHandoverStart[], records: PoultryHandoverRecord[], buildingId: string, serviceDate: string, incomingShift: DailyTaskShift, responsibleId: string) {
  return starts.some((start) => start.buildingId === buildingId && start.serviceDate === serviceDate && start.incomingShift === incomingShift && start.responsibleId === responsibleId)
    || records.some((record) => record.buildingId === buildingId && record.serviceDate === serviceDate && record.incomingShift === incomingShift && record.incomingResponsibleId === responsibleId);
}

export function isHandoverAnswered(record: PoultryHandoverRecord | undefined) {
  return record?.status === 'Réalisée';
}

/**
 * Le responsable sortant est déterminé à partir des tâches réellement
 * terminées dans le service précédent. Le dernier utilisateur ayant terminé
 * une tâche est privilégié, puis viennent l'utilisateur de démarrage et enfin
 * l'affectation RH historique.
 */
export function outgoingResponsibleForTasks(tasks: DailyTaskInstance[], buildingId: string, serviceDate: string, shift: DailyTaskShift) {
  const candidates = tasks
    .filter((task) => task.unitId === 'poulets' && task.assignedBuildingId === buildingId && task.date === serviceDate && (task.shift ?? 'jour') === shift && (task.status === 'Terminée' || task.status === 'Non faite'))
    .sort((first, second) => (second.completedAt || second.startedAt || '').localeCompare(first.completedAt || first.startedAt || ''));
  const candidate = candidates.find((task) => task.completedById || task.completedByName) ?? candidates.find((task) => task.startedById || task.startedByName) ?? candidates[0];
  if (!candidate) return { id: '', name: 'Responsable sortant non identifié' };
  return {
    id: candidate.completedById || candidate.startedById || candidate.assignedEmployeeId || '',
    name: candidate.completedByName || candidate.startedByName || candidate.assignedEmployeeName || candidate.assignedRole || 'Responsable sortant non identifié',
  };
}

export function handoverForBuilding(records: PoultryHandoverRecord[], buildingId: string, serviceDate: string, incomingShift: DailyTaskShift, incomingResponsibleId: string) {
  return records.find((record) => record.buildingId === buildingId && record.serviceDate === serviceDate && record.incomingShift === incomingShift && record.incomingResponsibleId === incomingResponsibleId);
}

export function handoverDeathTotal(record: Pick<PoultryHandoverRecord, 'deathsMainRoomQuantity' | 'deathsClinicQuantity'>) {
  return Math.max(0, Number(record.deathsMainRoomQuantity) || 0) + Math.max(0, Number(record.deathsClinicQuantity) || 0);
}

export function handoverConditionTotal(record: Pick<PoultryHandoverRecord, 'deathsFreshQuantity' | 'deathsDecomposedQuantity'>) {
  return Math.max(0, Number(record.deathsFreshQuantity) || 0) + Math.max(0, Number(record.deathsDecomposedQuantity) || 0);
}

function safePart(value: string) {
  return value.trim().replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '') || 'inconnu';
}
