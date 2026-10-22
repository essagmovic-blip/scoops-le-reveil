import type { DailyTaskCompletion, DailyTaskShift, DailyTaskStatus, DailyTaskUnitId, PoultryTaskPhase } from '@/lib/daily-tasks';
import type { PoultryGeneralStateQuestionnaire } from '@/lib/poultry-sanitary';
import type { PoultryHandoverRecord } from '@/lib/poultry-handovers';

export type ServiceReportStatus = 'Non lu' | 'Lu' | 'Validé' | 'À corriger';

export type ServiceReportTask = {
  id: string;
  title: string;
  buildingId?: string;
  buildingName?: string;
  poultryPhase?: PoultryTaskPhase;
  shift: DailyTaskShift;
  status: DailyTaskStatus;
  completion: DailyTaskCompletion;
  startedAt: string;
  completedAt: string;
  startedByName?: string;
  completedByName?: string;
  actualDurationMinutes: number;
  comment: string;
  protocol?: string[];
  protocolChecks?: string[];
  waterQuantityLiters?: number;
  feedQuantityKg?: number;
  temperatureC?: number;
  humidityPercent?: number;
  generalStateQuestionnaire?: PoultryGeneralStateQuestionnaire;
};

export type ServiceReport = {
  id: string;
  unitId: DailyTaskUnitId;
  serviceDate: string;
  shift: DailyTaskShift;
  responsibleId: string;
  responsibleName: string;
  buildingIds: string[];
  buildingNames: string[];
  poultryPhases: PoultryTaskPhase[];
  generatedAt: string;
  submittedAt: string;
  status: ServiceReportStatus;
  readAt?: string;
  readBy?: string;
  validationComment?: string;
  tasks: ServiceReportTask[];
  handovers: PoultryHandoverRecord[];
  summary: {
    taskCount: number;
    completedTaskCount: number;
    lateTaskCount: number;
    waterLiters: number;
    feedKg: number;
    deathsFound: number;
  };
};
