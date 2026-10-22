import { units, type UnitId } from '@/lib/data';
import type { PoultryGeneralStateQuestionnaire } from '@/lib/poultry-sanitary';

export type DailyTaskUnitId = Exclude<UnitId, 'rh'>;
export type DailyTaskShift = 'jour' | 'nuit';
export type DailyTaskRosterMode = 'rotation' | 'jour' | 'nuit';
export type DailyTaskType = 'Tâche' | 'Pause';
export type DailyTaskStatus = 'À faire' | 'En cours' | 'Terminée' | 'Non faite';
export type PoultryTaskPhase = 'poussiniere' | 'croissance-finition';
export type DailyTaskScheduleMode = 'fixe' | 'recurrence' | 'libre';
export type DailyTaskCategory = 'standard' | 'service-eau' | 'service-aliment' | 'stimulation' | 'nettoyage' | 'temperature-humidite' | 'vaccination' | 'pesee' | 'remuage-copeaux' | 'repos-sujets' | 'pause-vague' | 'renouvellement-air' | 'etat-general-sujets';
export type DailyTaskTiming = 'En avance' | 'À l’heure' | 'En retard' | '';
export type DailyTaskCompletion = 'À temps' | 'En retard' | '';
export type DailyTaskValidation = 'Aucune' | 'En attente de validation RH' | 'Gain validé' | 'Perte validée' | 'Rejeté';

export type DailyTaskSettings = {
  taskBonusAmount: number;
  taskPenaltyAmount: number;
  taskWorkdayStart: string;
  taskWorkdayEnd: string;
  dayShiftStart: string;
  dayShiftEnd: string;
  nightShiftStart: string;
  nightShiftEnd: string;
  taskGapMinutes: number;
};

export const DEFAULT_DAILY_TASK_SETTINGS: DailyTaskSettings = {
  taskBonusAmount: 1000,
  taskPenaltyAmount: 500,
  taskWorkdayStart: '07:30',
  taskWorkdayEnd: '17:30',
  dayShiftStart: '07:30',
  dayShiftEnd: '17:30',
  nightShiftStart: '17:30',
  nightShiftEnd: '07:30',
  taskGapMinutes: 10,
};

/** Délai de tolérance appliqué après l’heure de fin prévue. */
export const DAILY_TASK_COMPLETION_GRACE_MINUTES = 5;

export type DailyTaskRosterEntry = {
  employeeId: string;
  unitId: DailyTaskUnitId;
  mode: DailyTaskRosterMode;
  initialShift: DailyTaskShift;
  rotationAnchorDate: string;
  updatedAt: string;
};

export type PoultryCategoryAssignmentStatus = 'Active' | 'Terminée';
export type PoultryCategoryAssignment = {
  id: string;
  employeeId: string;
  employeeName: string;
  unitId: 'poulets';
  poultryPhase: PoultryTaskPhase;
  startAt: string;
  endAt: string;
  status: PoultryCategoryAssignmentStatus;
  validatedAt: string;
  validatedBy: string;
};

export type DailyTaskTemplate = {
  id: string;
  title: string;
  type: DailyTaskType;
  shift: DailyTaskShift;
  order: number;
  unitId: DailyTaskUnitId;
  startTime: string;
  durationMinutes: number;
  assignedEmployeeId: string;
  assignedRole: string;
  assignedBuildingId?: string;
  assignedBuildingName?: string;
  /** Champs métier facultatifs pour les fiches Poulets bio. */
  poultryPhase?: PoultryTaskPhase;
  scheduleMode?: DailyTaskScheduleMode;
  recurrenceMinutes?: number;
  alertAfterMinutes?: number;
  category?: DailyTaskCategory;
  protocol?: string[];
  protocolId?: string;
  protocolVersion?: number;
  requiresWaterQuantity?: boolean;
  requiresFeedQuantity?: boolean;
  requiresTemperatureHumidity?: boolean;
  requiresGeneralStateQuestionnaire?: boolean;
  poultryAgeDay?: number;
  lifecycleTask?: boolean;
  effectiveFrom: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

export type DailyTaskInstance = {
  id: string;
  templateId: string;
  date: string;
  title: string;
  type: DailyTaskType;
  shift: DailyTaskShift;
  unitId: DailyTaskUnitId;
  startTime: string;
  durationMinutes: number;
  assignedEmployeeId: string;
  assignedEmployeeName: string;
  assignedRole: string;
  /** Utilisateur ayant réellement démarré/terminé la tâche. */
  startedById?: string;
  startedByName?: string;
  completedById?: string;
  completedByName?: string;
  assignedBuildingId?: string;
  assignedBuildingName?: string;
  poultryPhase?: PoultryTaskPhase;
  scheduleMode?: DailyTaskScheduleMode;
  recurrenceIndex?: number;
  /** Numéro de passage pour une tâche sans horaire fixe, réexécutable dans la journée. */
  executionNumber?: number;
  recurrenceMinutes?: number;
  alertAfterMinutes?: number;
  category?: DailyTaskCategory;
  protocol?: string[];
  protocolId?: string;
  protocolVersion?: number;
  requiresWaterQuantity?: boolean;
  requiresFeedQuantity?: boolean;
  requiresTemperatureHumidity?: boolean;
  requiresGeneralStateQuestionnaire?: boolean;
  protocolChecks?: string[];
  waterQuantityLiters?: number;
  feedQuantityKg?: number;
  temperatureC?: number;
  humidityPercent?: number;
  generalStateQuestionnaire?: PoultryGeneralStateQuestionnaire;
  generalStateQuestionnaireDraft?: Partial<PoultryGeneralStateQuestionnaire>;
  poultryAgeDay?: number;
  dueDate?: string;
  noticeDate?: string;
  lifecycleTask?: boolean;
  status: DailyTaskStatus;
  startedAt: string;
  completedAt: string;
  startTiming: DailyTaskTiming;
  completion: DailyTaskCompletion;
  actualDurationMinutes: number;
  comment: string;
  bonusAmount: number;
  penaltyAmount: number;
  validationStatus: DailyTaskValidation;
  validationComment: string;
  validatedAt: string;
  validatedBy: string;
};

export type DailyTaskEmployee = { id: string; name: string; unitId: DailyTaskUnitId; linkedUserId?: string; sourceEmployeeId?: string; identifier?: string; position?: string; status?: string };

export function isDailyTaskUnit(value: string): value is DailyTaskUnitId { return units.some((unit) => unit.id === value && unit.id !== 'rh'); }
export function todayIso(date = new Date()) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; }
export function addDaysIso(dateIso: string, days: number) { const date = new Date(`${dateIso}T12:00:00`); date.setDate(date.getDate() + days); return todayIso(date); }
export function timeToMinutes(value: string) { const [hours, minutes] = value.split(':').map(Number); return (Number.isFinite(hours) ? hours : 0) * 60 + (Number.isFinite(minutes) ? minutes : 0); }
export function minutesToTime(value: number) { const minutes = Math.max(0, value); return `${String(Math.floor(minutes / 60) % 24).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`; }
export function plannedEndTime(task: Pick<DailyTaskTemplate | DailyTaskInstance, 'startTime' | 'durationMinutes'>) {
  return task.startTime ? minutesToTime(timeToMinutes(task.startTime) + task.durationMinutes) : '';
}
export function unitLabel(unitId: string) { return units.find((unit) => unit.id === unitId)?.shortLabel ?? unitId; }
export function responsibleLabel(task: { assignedEmployeeName?: string; assignedRole: string }) { return task.assignedEmployeeName || task.assignedRole || 'Poste à préciser'; }

export function shiftBounds(shift: DailyTaskShift, settings: DailyTaskSettings) { return shift === 'jour' ? { start: settings.dayShiftStart, end: settings.dayShiftEnd } : { start: settings.nightShiftStart, end: settings.nightShiftEnd }; }
export function shiftTimeOffset(startTime: string, shift: DailyTaskShift, settings: DailyTaskSettings) { const bounds = shiftBounds(shift, settings); const start = timeToMinutes(bounds.start); let value = timeToMinutes(startTime); if (shift === 'nuit' && value < start) value += 1440; return value; }
export function taskFitsShift(startTime: string, durationMinutes: number, shift: DailyTaskShift, settings: DailyTaskSettings) { const bounds = shiftBounds(shift, settings); const start = shiftTimeOffset(startTime, shift, settings); let end = timeToMinutes(bounds.end); if (shift === 'nuit' && end <= timeToMinutes(bounds.start)) end += 1440; return start >= timeToMinutes(bounds.start) && start + durationMinutes <= end; }

export function weekStartIso(dateIso: string) { const date = new Date(`${dateIso}T12:00:00`); const day = date.getDay() || 7; date.setDate(date.getDate() - day + 1); return todayIso(date); }
export function shiftForEmployee(employeeId: string, dateIso: string, roster: DailyTaskRosterEntry[], unitId?: DailyTaskUnitId) {
  const entry = roster.find((item) => item.employeeId === employeeId && (!unitId || item.unitId === unitId));
  if (!entry) return undefined;
  if (entry.mode === 'jour') return 'jour' as const;
  if (entry.mode === 'nuit') return 'nuit' as const;
  const anchor = weekStartIso(entry.rotationAnchorDate || dateIso);
  const current = weekStartIso(dateIso);
  const weeks = Math.floor((new Date(`${current}T12:00:00`).getTime() - new Date(`${anchor}T12:00:00`).getTime()) / (7 * 86400000));
  const flips = Math.max(0, weeks) % 2;
  return flips === 0 ? entry.initialShift : entry.initialShift === 'jour' ? 'nuit' : 'jour';
}

export function activePoultryCategoryAssignment(assignments: PoultryCategoryAssignment[], employeeIds: string[], now = new Date()) {
  const nowIso = now.toISOString();
  return assignments
    .filter((assignment) => assignment.unitId === 'poulets' && assignment.status === 'Active' && employeeIds.includes(assignment.employeeId) && assignment.startAt <= nowIso && (!assignment.endAt || nowIso < assignment.endAt))
    .sort((first, second) => second.startAt.localeCompare(first.startAt))[0];
}

export function poultryTaskPhase(task: Pick<DailyTaskTemplate | DailyTaskInstance, 'poultryPhase' | 'lifecycleTask' | 'poultryAgeDay'>): PoultryTaskPhase | undefined {
  if (task.poultryPhase) return task.poultryPhase === 'poussiniere' || task.poultryPhase === 'croissance-finition' ? task.poultryPhase : undefined;
  if (task.lifecycleTask && task.poultryAgeDay !== undefined) return task.poultryAgeDay <= 20 ? 'poussiniere' : 'croissance-finition';
  return undefined;
}

export function sortTaskTemplates(templates: DailyTaskTemplate[], settings: DailyTaskSettings = DEFAULT_DAILY_TASK_SETTINGS) { return [...templates].sort((a, b) => (a.shift ?? 'jour').localeCompare(b.shift ?? 'jour') || (Number.isFinite(a.order) ? a.order : shiftTimeOffset(a.startTime, a.shift ?? 'jour', settings)) - (Number.isFinite(b.order) ? b.order : shiftTimeOffset(b.startTime, b.shift ?? 'jour', settings)) || a.startTime.localeCompare(b.startTime) || a.createdAt.localeCompare(b.createdAt)); }

/**
 * Crée le socle opérationnel des fiches de poste Poulets bio, sans doublon.
 * Les valeurs sont des modèles métier modifiables par RH, pas des données
 * d’activité : aucun suivi ni aucune présence n’est créé par cette fonction.
 */
export function poultryDefaultTaskTemplates(buildings: Array<{ id: string; name: string }>, existing: DailyTaskTemplate[] = [], now = new Date()) {
  const effectiveFrom = todayIso(now);
  const createdAt = now.toISOString();
  const definitions: Array<{ key: string; phase?: PoultryTaskPhase; shift: DailyTaskShift; startTime: string; durationMinutes: number; title: string; type?: DailyTaskType; scheduleMode?: DailyTaskScheduleMode; recurrenceMinutes?: number; alertAfterMinutes?: number; category?: DailyTaskCategory; protocol?: string[]; requiresWaterQuantity?: boolean; requiresFeedQuantity?: boolean; requiresTemperatureHumidity?: boolean; requiresGeneralStateQuestionnaire?: boolean; poultryAgeDay?: number; lifecycleTask?: boolean }> = [
    { key: 'poussiniere-air-jour', phase: 'poussiniere', shift: 'jour', startTime: '', durationMinutes: 10, title: 'Poussinière · renouvellement de l’air — première tâche du jour', scheduleMode: 'libre', category: 'renouvellement-air', protocol: ['Ouvrir les entrées d’air selon le besoin', 'Vérifier le renouvellement sans courant d’air direct sur les sujets', 'Contrôler l’odeur et l’ambiance de la salle'] },
    { key: 'poussiniere-eau-jour', phase: 'poussiniere', shift: 'jour', startTime: '07:30', durationMinutes: 15, title: 'Poussinière · service eau et contrôle des abreuvoirs', scheduleMode: 'recurrence', recurrenceMinutes: 60, alertAfterMinutes: 10, category: 'service-eau', protocol: ['Rincer les abreuvoirs', 'Vérifier la propreté de l’éponge', 'Donner une eau propre', 'Contrôler l’accès des sujets à l’eau'], requiresWaterQuantity: true },
    { key: 'poussiniere-etat-general-jour', phase: 'poussiniere', shift: 'jour', startTime: '', durationMinutes: 15, title: 'Poussinière · état général des sujets', scheduleMode: 'libre', category: 'etat-general-sujets', requiresGeneralStateQuestionnaire: true },
    { key: 'poussiniere-aliment-jour', phase: 'poussiniere', shift: 'jour', startTime: '07:45', durationMinutes: 20, title: 'Poussinière · service aliment', scheduleMode: 'recurrence', recurrenceMinutes: 60, alertAfterMinutes: 10, category: 'service-aliment', protocol: ['Vérifier les mangeoires', 'Remuer les copeaux si nécessaire', 'Contrôler la prise alimentaire'], requiresFeedQuantity: true },
    { key: 'poussiniere-stimulation-jour', phase: 'poussiniere', shift: 'jour', startTime: '07:30', durationMinutes: 5, title: 'Poussinière · stimulation des poussins', scheduleMode: 'recurrence', recurrenceMinutes: 30, alertAfterMinutes: 10, category: 'stimulation', protocol: ['Observer la répartition des poussins', 'Stimuler doucement les sujets éloignés des points d’eau et d’aliment'] },
    { key: 'poussiniere-ambiance-jour', phase: 'poussiniere', shift: 'jour', startTime: '07:50', durationMinutes: 10, title: 'Poussinière · relever température et humidité', scheduleMode: 'recurrence', recurrenceMinutes: 60, alertAfterMinutes: 10, category: 'temperature-humidite', requiresTemperatureHumidity: true },
    { key: 'poussiniere-nettoyage-jour', phase: 'poussiniere', shift: 'jour', startTime: '', durationMinutes: 30, title: 'Poussinière · nettoyage abreuvoirs et mangeoires', scheduleMode: 'libre', category: 'nettoyage', protocol: ['Laver les abreuvoirs', 'Nettoyer les mangeoires', 'Ranger le matériel'] },
    { key: 'croissance-air-jour', phase: 'croissance-finition', shift: 'jour', startTime: '07:30', durationMinutes: 10, title: 'Croissance et finition · renouvellement de l’air — première tâche du jour', alertAfterMinutes: 10, category: 'renouvellement-air', protocol: ['Ouvrir les entrées d’air selon le besoin', 'Vérifier le renouvellement sans courant d’air direct sur les sujets', 'Contrôler l’odeur et l’ambiance de la salle'] },
    { key: 'croissance-eau-jour', phase: 'croissance-finition', shift: 'jour', startTime: '08:00', durationMinutes: 25, title: 'Croissance et finition · service eau', alertAfterMinutes: 10, category: 'service-eau', protocol: ['Rincer les abreuvoirs', 'Donner une eau propre', 'Vérifier l’écoulement'], requiresWaterQuantity: true },
    { key: 'croissance-etat-general-jour', phase: 'croissance-finition', shift: 'jour', startTime: '09:00', durationMinutes: 15, title: 'Croissance et finition · état général des sujets', alertAfterMinutes: 10, category: 'etat-general-sujets', requiresGeneralStateQuestionnaire: true },
    { key: 'croissance-aliment-jour', phase: 'croissance-finition', shift: 'jour', startTime: '08:30', durationMinutes: 35, title: 'Croissance et finition · service aliment', alertAfterMinutes: 10, category: 'service-aliment', protocol: ['Vérifier les mangeoires', 'Remuer les copeaux', 'Contrôler la consommation'], requiresFeedQuantity: true },
    { key: 'croissance-ambiance-jour', phase: 'croissance-finition', shift: 'jour', startTime: '09:15', durationMinutes: 15, title: 'Croissance et finition · relever température et humidité', alertAfterMinutes: 10, category: 'temperature-humidite', requiresTemperatureHumidity: true },
    { key: 'croissance-nettoyage-jour', phase: 'croissance-finition', shift: 'jour', startTime: '11:00', durationMinutes: 30, title: 'Croissance et finition · nettoyage abreuvoirs et mangeoires', alertAfterMinutes: 10, category: 'nettoyage', protocol: ['Laver les abreuvoirs', 'Nettoyer les mangeoires', 'Ranger le matériel'] },
    { key: 'pause-vague-1', phase: 'poussiniere', shift: 'jour', startTime: '12:00', durationMinutes: 60, title: 'Pause journée · première vague (12h–13h)', type: 'Pause', category: 'pause-vague' },
    { key: 'pause-vague-2', phase: 'poussiniere', shift: 'jour', startTime: '13:00', durationMinutes: 60, title: 'Pause journée · deuxième vague (13h–14h)', type: 'Pause', category: 'pause-vague' },
    { key: 'poussiniere-air-nuit', phase: 'poussiniere', shift: 'nuit', startTime: '', durationMinutes: 10, title: 'Poussinière · renouvellement de l’air', scheduleMode: 'libre', category: 'renouvellement-air', protocol: ['Ouvrir les entrées d’air selon le besoin', 'Vérifier le renouvellement sans courant d’air direct sur les sujets', 'Contrôler l’odeur et l’ambiance de la salle'] },
    { key: 'poussiniere-eau-nuit', phase: 'poussiniere', shift: 'nuit', startTime: '17:30', durationMinutes: 15, title: 'Poussinière · service eau et contrôle des abreuvoirs', scheduleMode: 'recurrence', recurrenceMinutes: 60, alertAfterMinutes: 10, category: 'service-eau', protocol: ['Rincer les abreuvoirs', 'Vérifier la propreté de l’éponge', 'Donner une eau propre', 'Contrôler l’accès des sujets à l’eau'], requiresWaterQuantity: true },
    { key: 'poussiniere-etat-general-nuit', phase: 'poussiniere', shift: 'nuit', startTime: '', durationMinutes: 15, title: 'Poussinière · état général des sujets', scheduleMode: 'libre', category: 'etat-general-sujets', requiresGeneralStateQuestionnaire: true },
    { key: 'poussiniere-aliment-nuit', phase: 'poussiniere', shift: 'nuit', startTime: '17:45', durationMinutes: 20, title: 'Poussinière · service aliment', scheduleMode: 'recurrence', recurrenceMinutes: 60, alertAfterMinutes: 10, category: 'service-aliment', protocol: ['Vérifier les mangeoires', 'Remuer les copeaux si nécessaire', 'Contrôler la prise alimentaire'], requiresFeedQuantity: true },
    { key: 'poussiniere-stimulation-nuit', phase: 'poussiniere', shift: 'nuit', startTime: '17:30', durationMinutes: 5, title: 'Poussinière · stimulation des poussins', scheduleMode: 'recurrence', recurrenceMinutes: 30, alertAfterMinutes: 10, category: 'stimulation', protocol: ['Observer la répartition des poussins', 'Stimuler doucement les sujets éloignés des points d’eau et d’aliment'] },
    { key: 'poussiniere-ambiance-nuit', phase: 'poussiniere', shift: 'nuit', startTime: '17:50', durationMinutes: 10, title: 'Poussinière · relever température et humidité', scheduleMode: 'recurrence', recurrenceMinutes: 60, alertAfterMinutes: 10, category: 'temperature-humidite', requiresTemperatureHumidity: true },
    { key: 'poussiniere-nettoyage-nuit', phase: 'poussiniere', shift: 'nuit', startTime: '', durationMinutes: 30, title: 'Poussinière · nettoyage abreuvoirs et mangeoires', scheduleMode: 'libre', category: 'nettoyage', protocol: ['Retirer et laver les abreuvoirs', 'Nettoyer les mangeoires', 'Ranger le matériel'] },
    { key: 'repos-sujets-nuit', phase: 'poussiniere', shift: 'nuit', startTime: '', durationMinutes: 15, title: 'Poussinière · mettre les sujets au repos', scheduleMode: 'libre', category: 'repos-sujets', protocol: ['Vérifier que la salle est calme', 'Contrôler la répartition des sujets', 'Transmettre toute anomalie au service suivant'] },
    { key: 'croissance-air-nuit', phase: 'croissance-finition', shift: 'nuit', startTime: '17:30', durationMinutes: 10, title: 'Croissance et finition · renouvellement de l’air', alertAfterMinutes: 10, category: 'renouvellement-air', protocol: ['Ouvrir les entrées d’air selon le besoin', 'Vérifier le renouvellement sans courant d’air direct sur les sujets', 'Contrôler l’odeur et l’ambiance de la salle'] },
    { key: 'croissance-eau-nuit', phase: 'croissance-finition', shift: 'nuit', startTime: '18:00', durationMinutes: 25, title: 'Croissance et finition · service eau', alertAfterMinutes: 10, category: 'service-eau', protocol: ['Rincer les abreuvoirs', 'Donner une eau propre', 'Vérifier l’écoulement'], requiresWaterQuantity: true },
    { key: 'croissance-etat-general-nuit', phase: 'croissance-finition', shift: 'nuit', startTime: '18:45', durationMinutes: 15, title: 'Croissance et finition · état général des sujets', alertAfterMinutes: 10, category: 'etat-general-sujets', requiresGeneralStateQuestionnaire: true },
    { key: 'croissance-aliment-nuit', phase: 'croissance-finition', shift: 'nuit', startTime: '18:00', durationMinutes: 35, title: 'Croissance et finition · service aliment', alertAfterMinutes: 10, category: 'service-aliment', protocol: ['Vérifier les mangeoires', 'Remuer les copeaux', 'Contrôler la consommation'], requiresFeedQuantity: true },
    { key: 'croissance-ambiance-nuit', phase: 'croissance-finition', shift: 'nuit', startTime: '18:45', durationMinutes: 15, title: 'Croissance et finition · relever température et humidité', alertAfterMinutes: 10, category: 'temperature-humidite', requiresTemperatureHumidity: true },
    { key: 'croissance-nettoyage-nuit', phase: 'croissance-finition', shift: 'nuit', startTime: '05:30', durationMinutes: 30, title: 'Croissance et finition · nettoyage abreuvoirs et mangeoires', alertAfterMinutes: 10, category: 'nettoyage', protocol: ['Retirer et laver les abreuvoirs', 'Nettoyer les mangeoires', 'Ranger le matériel'] },
    { key: 'repos-sujets-croissance-nuit', phase: 'croissance-finition', shift: 'nuit', startTime: '22:00', durationMinutes: 15, title: 'Croissance et finition · mettre les sujets au repos', alertAfterMinutes: 10, category: 'repos-sujets', protocol: ['Vérifier que la salle est calme', 'Contrôler la répartition des sujets', 'Transmettre toute anomalie au service suivant'] },
    { key: 'pause-vague-1-croissance', phase: 'croissance-finition', shift: 'jour', startTime: '12:00', durationMinutes: 60, title: 'Pause journée · première vague (12h–13h)', type: 'Pause', category: 'pause-vague' },
    { key: 'pause-vague-2-croissance', phase: 'croissance-finition', shift: 'jour', startTime: '13:00', durationMinutes: 60, title: 'Pause journée · deuxième vague (13h–14h)', type: 'Pause', category: 'pause-vague' },
    { key: 'vaccination-j8', shift: 'jour', startTime: '08:00', durationMinutes: 30, title: 'Vaccination de la bande — J8', alertAfterMinutes: 10, category: 'vaccination', poultryAgeDay: 8, lifecycleTask: true },
    { key: 'vaccination-j15', shift: 'jour', startTime: '08:00', durationMinutes: 30, title: 'Vaccination de la bande — J15', alertAfterMinutes: 10, category: 'vaccination', poultryAgeDay: 15, lifecycleTask: true },
    { key: 'vaccination-j22', shift: 'jour', startTime: '08:00', durationMinutes: 30, title: 'Vaccination de la bande — J22', alertAfterMinutes: 10, category: 'vaccination', poultryAgeDay: 22, lifecycleTask: true },
    { key: 'pesee-j7', shift: 'jour', startTime: '08:30', durationMinutes: 30, title: 'Pesée de contrôle de la bande — J7', alertAfterMinutes: 10, category: 'pesee', poultryAgeDay: 7, lifecycleTask: true },
    { key: 'pesee-j14', shift: 'jour', startTime: '08:30', durationMinutes: 30, title: 'Pesée de contrôle de la bande — J14', alertAfterMinutes: 10, category: 'pesee', poultryAgeDay: 14, lifecycleTask: true },
    { key: 'pesee-j21', shift: 'jour', startTime: '08:30', durationMinutes: 30, title: 'Pesée de contrôle de la bande — J21', alertAfterMinutes: 10, category: 'pesee', poultryAgeDay: 21, lifecycleTask: true },
    { key: 'pesee-j28', shift: 'jour', startTime: '08:30', durationMinutes: 30, title: 'Pesée de contrôle de la bande — J28', alertAfterMinutes: 10, category: 'pesee', poultryAgeDay: 28, lifecycleTask: true },
    { key: 'pesee-j35', shift: 'jour', startTime: '08:30', durationMinutes: 30, title: 'Pesée de contrôle de la bande — J35', alertAfterMinutes: 10, category: 'pesee', poultryAgeDay: 35, lifecycleTask: true },
    { key: 'pesee-j42', shift: 'jour', startTime: '08:30', durationMinutes: 30, title: 'Pesée de contrôle de la bande — J42', alertAfterMinutes: 10, category: 'pesee', poultryAgeDay: 42, lifecycleTask: true },
  ];
  const remuageDefinitions: Array<(typeof definitions)[number]> = Array.from({ length: 15 }, (_, index) => {
    const poultryAgeDay = (index + 1) * 3;
    return {
      key: `remuage-copeaux-j${poultryAgeDay}`,
      phase: poultryAgeDay <= 20 ? 'poussiniere' as PoultryTaskPhase : 'croissance-finition' as PoultryTaskPhase,
      shift: 'jour' as DailyTaskShift,
      startTime: '08:00',
      durationMinutes: 20,
      title: `Remuage des copeaux — J${poultryAgeDay}`,
      alertAfterMinutes: 10,
      category: 'remuage-copeaux' as DailyTaskCategory,
      protocol: ['Remuer les copeaux de manière homogène', 'Observer l’humidité et les zones compactées', 'Signaler toute odeur ou zone anormale'],
      poultryAgeDay,
      lifecycleTask: true,
    };
  });
  const allDefinitions = [...definitions, ...remuageDefinitions];
  const result = existing.filter((template) => !template.id.startsWith('TPL-POULETS-'));
  for (const building of buildings) for (const definition of allDefinitions) {
    const id = `TPL-POULETS-${building.id}-${definition.key}`;
    result.push({ id, title: definition.title, type: definition.type ?? 'Tâche', shift: definition.shift, order: result.filter((template) => template.unitId === 'poulets' && template.assignedBuildingId === building.id && (template.shift ?? 'jour') === definition.shift && template.poultryPhase === definition.phase).length + 1, unitId: 'poulets', startTime: definition.startTime, durationMinutes: definition.durationMinutes, assignedEmployeeId: '', assignedRole: 'Responsable du bâtiment', assignedBuildingId: building.id, assignedBuildingName: building.name, poultryPhase: definition.phase, scheduleMode: definition.scheduleMode ?? 'fixe', recurrenceMinutes: definition.recurrenceMinutes, alertAfterMinutes: definition.scheduleMode === 'libre' ? undefined : definition.alertAfterMinutes ?? 10, category: definition.category ?? 'standard', protocol: definition.protocol, requiresWaterQuantity: definition.requiresWaterQuantity, requiresFeedQuantity: definition.requiresFeedQuantity, requiresTemperatureHumidity: definition.requiresTemperatureHumidity, requiresGeneralStateQuestionnaire: definition.requiresGeneralStateQuestionnaire, poultryAgeDay: definition.poultryAgeDay, lifecycleTask: definition.lifecycleTask, effectiveFrom, active: true, createdAt, updatedAt: createdAt });
  }
  return result;
}

/** Ajoute uniquement les nouvelles fiches Poulets bio oubliées, sans écraser
 * les modèles déjà personnalisés par RH. */
export function ensurePoultryRemuageTaskTemplates(buildings: Array<{ id: string; name: string }>, existing: DailyTaskTemplate[] = [], deletedTemplateIds: string[] = [], now = new Date()) {
  const deleted = new Set(deletedTemplateIds);
  const defaults = poultryDefaultTaskTemplates(buildings, [], now).filter((template) => template.category === 'remuage-copeaux');
  const next = [...existing];
  for (const template of defaults) {
    if (deleted.has(template.id) || next.some((item) => item.id === template.id)) continue;
    next.push(template);
  }
  return next;
}

export function ensurePoultryDefaultTaskAdditions(buildings: Array<{ id: string; name: string }>, existing: DailyTaskTemplate[] = [], now = new Date()) {
  const freeNurseryKeys = new Set(['poussiniere-air-jour', 'poussiniere-etat-general-jour', 'poussiniere-nettoyage-jour', 'poussiniere-air-nuit', 'poussiniere-etat-general-nuit', 'poussiniere-nettoyage-nuit', 'repos-sujets-nuit']);
  const migratedExisting = existing.map((template) => {
    const isDefaultFreeNurseryTask = template.id.startsWith('TPL-POULETS-') && template.poultryPhase === 'poussiniere' && Array.from(freeNurseryKeys).some((key) => template.id.endsWith(`-${key}`));
    return isDefaultFreeNurseryTask && template.scheduleMode !== 'libre' ? { ...template, scheduleMode: 'libre' as const, startTime: '', alertAfterMinutes: undefined, updatedAt: now.toISOString() } : template;
  });
  if (!migratedExisting.some((template) => template.id.startsWith('TPL-POULETS-'))) return migratedExisting;
  const additionKeys = new Set(['poussiniere-air-jour', 'poussiniere-etat-general-jour', 'croissance-air-jour', 'croissance-etat-general-jour', 'poussiniere-air-nuit', 'poussiniere-etat-general-nuit', 'croissance-air-nuit', 'croissance-etat-general-nuit']);
  const defaults = poultryDefaultTaskTemplates(buildings, [], now).filter((template) => Array.from(additionKeys).some((key) => template.id.endsWith(`-${key}`)));
  const next = [...migratedExisting];
  for (const template of defaults) {
    if (next.some((item) => item.id === template.id)) continue;
    const group = next.filter((item) => item.unitId === 'poulets' && item.assignedBuildingId === template.assignedBuildingId && (item.shift ?? 'jour') === template.shift && item.poultryPhase === template.poultryPhase);
    const maxOrder = Math.max(0, ...group.map((item) => Number(item.order) || 0));
    next.push({ ...template, order: template.category === 'renouvellement-air' ? 0 : maxOrder + 1 });
  }
  return next;
}

export function recalculateTemplateSchedule(templates: DailyTaskTemplate[], settings: DailyTaskSettings = DEFAULT_DAILY_TASK_SETTINGS) {
  const next = [...templates];
  for (const unit of units.filter((item) => item.id !== 'rh')) for (const shift of ['jour', 'nuit'] as DailyTaskShift[]) {
    const group = next.filter((template) => template.unitId === unit.id && (template.shift ?? 'jour') === shift).sort((a, b) => (Number.isFinite(a.order) ? a.order : 999999) - (Number.isFinite(b.order) ? b.order : 999999) || a.startTime.localeCompare(b.startTime));
    let cursor = timeToMinutes(shiftBounds(shift, settings).start);
    group.forEach((template, index) => { const updated = { ...template, shift, order: index + 1, startTime: template.unitId === 'poulets' ? template.startTime : minutesToTime(cursor), updatedAt: new Date().toISOString() }; const position = next.findIndex((item) => item.id === template.id); if (position >= 0) next[position] = updated; cursor += template.durationMinutes + settings.taskGapMinutes; });
  }
  return next;
}

export function reorderTaskTemplates(templates: DailyTaskTemplate[], unitId: DailyTaskUnitId, shift: DailyTaskShift, draggedId: string, targetId: string, settings: DailyTaskSettings = DEFAULT_DAILY_TASK_SETTINGS) {
  const group = templates.filter((template) => template.unitId === unitId && (template.shift ?? 'jour') === shift).sort((a, b) => (Number.isFinite(a.order) ? a.order : 999999) - (Number.isFinite(b.order) ? b.order : 999999));
  const from = group.findIndex((template) => template.id === draggedId); const to = group.findIndex((template) => template.id === targetId); if (from < 0 || to < 0 || from === to) return templates;
  const [item] = group.splice(from, 1); group.splice(to, 0, item);
  const ordered = group.map((template, index) => ({ ...template, order: index + 1 }));
  return recalculateTemplateSchedule(templates.map((template) => ordered.find((item) => item.id === template.id) ?? template), settings);
}
export function taskIsEffective(template: DailyTaskTemplate, date: string) { return template.active && template.effectiveFrom <= date; }

/** Retire les modèles supprimés de façon persistante, notamment avant de
 * régénérer le socle automatique des tâches Poulets bio. */
export function filterDeletedTaskTemplates(templates: DailyTaskTemplate[], deletedTemplateIds: string[]) {
  const deleted = new Set(deletedTemplateIds);
  return templates.filter((template) => !deleted.has(template.id));
}

export function startTimingFor(startTime: string, startedAt: string) {
  if (!startTime) return '' as const;
  const date = new Date(startedAt);
  const actual = date.getHours() * 60 + date.getMinutes();
  const planned = timeToMinutes(startTime);
  if (actual < planned) return 'En avance' as const;
  if (actual === planned) return 'À l’heure' as const;
  return 'En retard' as const;
}

function shiftBoundary(date: string, shift: DailyTaskShift, boundary: 'start' | 'end', settings: DailyTaskSettings) { const bounds = shiftBounds(shift, settings); const time = boundary === 'start' ? bounds.start : bounds.end; const dateOffset = shift === 'nuit' && boundary === 'end' && timeToMinutes(bounds.end) <= timeToMinutes(bounds.start) ? 1 : 0; return new Date(`${addDaysIso(date, dateOffset)}T${time}:00`); }
export function isTaskDayClosed(date: string, now = new Date(), settings: DailyTaskSettings = DEFAULT_DAILY_TASK_SETTINGS, shift: DailyTaskShift = 'jour') { return now.getTime() >= shiftBoundary(date, shift, 'end', settings).getTime(); }
export function isTaskDayStarted(date: string, now = new Date(), settings: DailyTaskSettings = DEFAULT_DAILY_TASK_SETTINGS, shift: DailyTaskShift = 'jour') { return now.getTime() >= shiftBoundary(date, shift, 'start', settings).getTime(); }
export function currentServiceDate(shift: DailyTaskShift, now = new Date(), settings: DailyTaskSettings = DEFAULT_DAILY_TASK_SETTINGS) { const date = todayIso(now); const current = timeToMinutes(`${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`); if (shift === 'nuit' && current < timeToMinutes(settings.nightShiftEnd)) return addDaysIso(date, -1); return date; }

export function currentShiftAt(now = new Date(), settings: DailyTaskSettings = DEFAULT_DAILY_TASK_SETTINGS): DailyTaskShift {
  const current = timeToMinutes(`${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`);
  const start = timeToMinutes(settings.nightShiftStart);
  const end = timeToMinutes(settings.nightShiftEnd);
  const isNight = end <= start ? current >= start || current < end : current >= start && current < end;
  return isNight ? 'nuit' : 'jour';
}

export function taskScheduledStartAt(task: Pick<DailyTaskInstance, 'date' | 'startTime' | 'shift' | 'dueDate'>, settings: DailyTaskSettings = DEFAULT_DAILY_TASK_SETTINGS) {
  const start = new Date(`${task.dueDate ?? task.date}T${task.startTime}:00`);
  if (task.shift === 'nuit' && timeToMinutes(task.startTime) < timeToMinutes(settings.nightShiftStart)) start.setDate(start.getDate() + 1);
  return start;
}

export function taskScheduledEndAt(task: Pick<DailyTaskInstance, 'date' | 'startTime' | 'shift' | 'dueDate' | 'durationMinutes'>, settings: DailyTaskSettings = DEFAULT_DAILY_TASK_SETTINGS) {
  const start = taskScheduledStartAt(task, settings);
  const durationMinutes = Math.max(0, Number(task.durationMinutes) || 0);
  return new Date(start.getTime() + durationMinutes * 60000);
}

export function taskCompletionDeadlineAt(task: Pick<DailyTaskInstance, 'date' | 'startTime' | 'shift' | 'dueDate' | 'durationMinutes' | 'scheduleMode'>, settings: DailyTaskSettings = DEFAULT_DAILY_TASK_SETTINGS) {
  if (task.scheduleMode === 'libre' || !task.startTime) return null;
  const end = taskScheduledEndAt(task, settings).getTime();
  return Number.isFinite(end) ? new Date(end + DAILY_TASK_COMPLETION_GRACE_MINUTES * 60000) : null;
}

export function taskCompletionGraceActive(task: Pick<DailyTaskInstance, 'date' | 'startTime' | 'shift' | 'dueDate' | 'durationMinutes' | 'scheduleMode' | 'status'>, now = new Date(), settings: DailyTaskSettings = DEFAULT_DAILY_TASK_SETTINGS) {
  if (task.status !== 'En cours') return false;
  const deadline = taskCompletionDeadlineAt(task, settings);
  return Boolean(deadline && now.getTime() <= deadline.getTime());
}

export function taskCompletionIsLate(task: Pick<DailyTaskInstance, 'date' | 'startTime' | 'shift' | 'dueDate' | 'durationMinutes' | 'scheduleMode'>, completedAt: string, settings: DailyTaskSettings = DEFAULT_DAILY_TASK_SETTINGS) {
  const deadline = taskCompletionDeadlineAt(task, settings);
  if (!deadline) return false;
  const completed = new Date(completedAt).getTime();
  return Number.isFinite(completed) && completed > deadline.getTime();
}

export function taskIsLate(task: Pick<DailyTaskInstance, 'date' | 'startTime' | 'shift' | 'status' | 'alertAfterMinutes' | 'dueDate' | 'scheduleMode'>, now = new Date(), settings: DailyTaskSettings = DEFAULT_DAILY_TASK_SETTINGS) {
  if (task.scheduleMode === 'libre' || !task.startTime) return false;
  if (['Terminée', 'Non faite'].includes(task.status)) return false;
  if (task.dueDate && todayIso(now) < task.dueDate) return false;
  const alertAfter = 10;
  return now.getTime() >= taskScheduledStartAt(task, settings).getTime() + alertAfter * 60000;
}

export function taskMinutesLate(task: Pick<DailyTaskInstance, 'date' | 'startTime' | 'shift' | 'status' | 'alertAfterMinutes' | 'dueDate' | 'scheduleMode'>, now = new Date(), settings: DailyTaskSettings = DEFAULT_DAILY_TASK_SETTINGS) {
  if (!taskIsLate(task, now, settings)) return 0;
  return Math.max(0, Math.floor((now.getTime() - taskScheduledStartAt(task, settings).getTime()) / 60000));
}

export function taskInstanceId(date: string, templateId: string, recurrenceIndex?: number) {
  return `TASK-${date}-${templateId}${recurrenceIndex === undefined ? '' : `-${recurrenceIndex}`}`;
}

function taskSlots(template: DailyTaskTemplate, settings: DailyTaskSettings) {
  const scheduleMode = template.scheduleMode ?? 'fixe';
  const interval = Math.max(0, Math.floor(Number(template.recurrenceMinutes) || 0));
  if (scheduleMode === 'libre') return [{ startTime: '', recurrenceIndex: undefined }];
  if (scheduleMode !== 'recurrence' || interval <= 0) return [{ startTime: template.startTime, recurrenceIndex: undefined }];
  const shift = template.shift ?? 'jour';
  const bounds = shiftBounds(shift, settings);
  const start = shiftTimeOffset(template.startTime || bounds.start, shift, settings);
  let end = timeToMinutes(bounds.end);
  if (shift === 'nuit' && end <= timeToMinutes(bounds.start)) end += 1440;
  const duration = Math.max(0, Number(template.durationMinutes) || 0);
  const slots: Array<{ startTime: string; recurrenceIndex: number }> = [];
  let cursor = start;
  let recurrenceIndex = 0;
  while (cursor + duration <= end && recurrenceIndex < 100) {
    slots.push({ startTime: minutesToTime(cursor), recurrenceIndex });
    cursor += interval;
    recurrenceIndex += 1;
  }
  return slots;
}

function instanceTemplateKey(task: Pick<DailyTaskInstance, 'templateId' | 'recurrenceIndex'>) {
  return `${task.templateId}:${task.recurrenceIndex ?? 0}`;
}

function freeTaskInstanceId(date: string, templateId: string, executionNumber: number) {
  return `TASK-${date}-${templateId}-free-${executionNumber}`;
}

export function ensureDailyInstances(date: string, unitId: DailyTaskUnitId, templates: DailyTaskTemplate[], existing: DailyTaskInstance[], employees: DailyTaskEmployee[], settings: DailyTaskSettings = DEFAULT_DAILY_TASK_SETTINGS, roster: DailyTaskRosterEntry[] = [], now = new Date()): DailyTaskInstance[] {
  const current = existing.filter((task) => !(task.date === date && task.unitId === unitId));
  const already = existing.filter((task) => task.date === date && task.unitId === unitId).map((task) => {
    const template = templates.find((item) => item.id === task.templateId);
    if (!template || !['À faire', 'En cours'].includes(task.status)) return { ...task, shift: task.shift ?? 'jour' as const };
    return {
      ...task,
      title: template.title,
      shift: template.shift ?? task.shift ?? 'jour' as const,
      scheduleMode: template.scheduleMode ?? task.scheduleMode,
      startTime: template.scheduleMode === 'libre' ? '' : template.startTime || task.startTime,
      recurrenceMinutes: template.recurrenceMinutes ?? task.recurrenceMinutes,
      alertAfterMinutes: template.alertAfterMinutes ?? task.alertAfterMinutes,
      category: template.category ?? task.category,
      protocol: template.protocol ?? task.protocol,
      protocolId: template.protocolId ?? task.protocolId,
      protocolVersion: template.protocolVersion ?? task.protocolVersion,
      requiresWaterQuantity: template.requiresWaterQuantity ?? task.requiresWaterQuantity,
      requiresFeedQuantity: template.requiresFeedQuantity ?? task.requiresFeedQuantity,
      requiresTemperatureHumidity: template.requiresTemperatureHumidity ?? task.requiresTemperatureHumidity,
      requiresGeneralStateQuestionnaire: template.requiresGeneralStateQuestionnaire ?? task.requiresGeneralStateQuestionnaire,
    };
  });
  const existingByTemplate = new Set(already.filter((task) => task.scheduleMode !== 'libre').map(instanceTemplateKey));
  // Les instances planifiées sont créées dès que le modèle est actif, même
  // avant le début du service. Une tâche « libre » n'a pas d'heure prévue :
  // une seule exécution ouverte est proposée, puis une nouvelle exécution est
  // créée après chaque validation pour permettre plusieurs passages par jour.
  const generatedTasks = sortTaskTemplates(templates.filter((template) => template.unitId === unitId && !template.lifecycleTask && taskIsEffective(template, date)), settings)
    .flatMap((template) => {
      const scheduleMode = template.scheduleMode ?? 'fixe';
      const employee = employees.find((item) => item.id === template.assignedEmployeeId);
      if (scheduleMode === 'libre') {
        const hasOpenExecution = already.some((task) => task.templateId === template.id && ['À faire', 'En cours'].includes(task.status));
        if (hasOpenExecution) return [];
        const executionNumber = Math.max(0, ...already.filter((task) => task.templateId === template.id).map((task) => Number(task.executionNumber) || 0)) + 1;
        return [{ id: freeTaskInstanceId(date, template.id, executionNumber), templateId: template.id, date, title: template.title, type: template.type, shift: template.shift ?? 'jour', unitId: template.unitId, startTime: '', durationMinutes: template.durationMinutes, assignedEmployeeId: template.assignedEmployeeId, assignedEmployeeName: employee?.name ?? '', assignedRole: template.assignedRole, assignedBuildingId: template.assignedBuildingId, assignedBuildingName: template.assignedBuildingName, poultryPhase: template.poultryPhase, scheduleMode: 'libre' as const, executionNumber, recurrenceMinutes: undefined, alertAfterMinutes: undefined, category: template.category, protocol: template.protocol, protocolId: template.protocolId, protocolVersion: template.protocolVersion, requiresWaterQuantity: template.requiresWaterQuantity, requiresFeedQuantity: template.requiresFeedQuantity, requiresTemperatureHumidity: template.requiresTemperatureHumidity, requiresGeneralStateQuestionnaire: template.requiresGeneralStateQuestionnaire, protocolChecks: [], status: 'À faire' as const, startedAt: '', completedAt: '', startTiming: '' as const, completion: '' as const, actualDurationMinutes: 0, comment: '', bonusAmount: 0, penaltyAmount: 0, validationStatus: 'Aucune' as const, validationComment: '', validatedAt: '', validatedBy: '' } satisfies DailyTaskInstance];
      }
      return taskSlots(template, settings).filter((slot) => !existingByTemplate.has(`${template.id}:${slot.recurrenceIndex ?? 0}`)).map((slot): DailyTaskInstance => ({ id: taskInstanceId(date, template.id, slot.recurrenceIndex), templateId: template.id, date, title: template.title, type: template.type, shift: template.shift ?? 'jour', unitId: template.unitId, startTime: slot.startTime, durationMinutes: template.durationMinutes, assignedEmployeeId: template.assignedEmployeeId, assignedEmployeeName: employee?.name ?? '', assignedRole: template.assignedRole, assignedBuildingId: template.assignedBuildingId, assignedBuildingName: template.assignedBuildingName, poultryPhase: template.poultryPhase, scheduleMode: template.scheduleMode, recurrenceIndex: slot.recurrenceIndex, recurrenceMinutes: template.recurrenceMinutes, alertAfterMinutes: template.alertAfterMinutes, category: template.category, protocol: template.protocol, protocolId: template.protocolId, protocolVersion: template.protocolVersion, requiresWaterQuantity: template.requiresWaterQuantity, requiresFeedQuantity: template.requiresFeedQuantity, requiresTemperatureHumidity: template.requiresTemperatureHumidity, requiresGeneralStateQuestionnaire: template.requiresGeneralStateQuestionnaire, protocolChecks: [], status: 'À faire', startedAt: '', completedAt: '', startTiming: '', completion: '', actualDurationMinutes: 0, comment: '', bonusAmount: 0, penaltyAmount: 0, validationStatus: 'Aucune', validationComment: '', validatedAt: '', validatedBy: '' }));
    });
  return [...current, ...already, ...generatedTasks];
}

export type PoultryLifecycleTaskContext = { buildingId: string; buildingName: string; batchId: string; startDate: string };

/** Génère les vaccinations et pesées à partir de J-1, jusqu’à leur exécution. */
export function ensurePoultryLifecycleInstances(date: string, templates: DailyTaskTemplate[], existing: DailyTaskInstance[], contexts: PoultryLifecycleTaskContext[], employees: DailyTaskEmployee[] = []) {
  const result = [...existing];
  for (const template of templates.filter((item) => item.active && item.lifecycleTask && item.poultryAgeDay !== undefined)) {
    for (const context of contexts) {
      const dueDate = addDaysIso(context.startDate, template.poultryAgeDay!);
      const noticeDate = addDaysIso(dueDate, -1);
      if (date < noticeDate) continue;
      const id = `LIFE-${context.batchId}-${context.buildingId}-${template.id}`;
      if (result.some((task) => task.id === id)) continue;
      const employee = employees.find((item) => item.id === template.assignedEmployeeId);
      result.push({ id, templateId: template.id, date: noticeDate, title: template.title.replace(/ — J\\d+$/, ` — ${dueDate}`), type: template.type, shift: template.shift, unitId: template.unitId, startTime: template.startTime, durationMinutes: template.durationMinutes, assignedEmployeeId: template.assignedEmployeeId, assignedEmployeeName: employee?.name ?? '', assignedRole: template.assignedRole, assignedBuildingId: context.buildingId, assignedBuildingName: context.buildingName, poultryPhase: template.poultryPhase, scheduleMode: 'fixe', alertAfterMinutes: template.alertAfterMinutes ?? 10, category: template.category, protocol: template.protocol, protocolId: template.protocolId, protocolVersion: template.protocolVersion, requiresWaterQuantity: template.requiresWaterQuantity, requiresFeedQuantity: template.requiresFeedQuantity, requiresTemperatureHumidity: template.requiresTemperatureHumidity, requiresGeneralStateQuestionnaire: template.requiresGeneralStateQuestionnaire, poultryAgeDay: template.poultryAgeDay, dueDate, noticeDate, lifecycleTask: true, status: 'À faire', startedAt: '', completedAt: '', startTiming: '', completion: '', actualDurationMinutes: 0, comment: '', bonusAmount: 0, penaltyAmount: 0, validationStatus: 'Aucune', validationComment: '', validatedAt: '', validatedBy: '' });
    }
  }
  return result;
}

export function closeDailyInstances(date: string, instances: DailyTaskInstance[], now = new Date(), settings: DailyTaskSettings = DEFAULT_DAILY_TASK_SETTINGS) {
  return instances.map((task) => {
    if (task.date !== date || task.scheduleMode === 'libre' || task.lifecycleTask && task.dueDate && date < task.dueDate || !isTaskDayClosed(date, now, settings, task.shift ?? 'jour') || !['À faire', 'En cours'].includes(task.status)) return task;
    // Une tâche déjà commencée conserve sa fenêtre de tolérance, même si elle
    // termine exactement à la fin du service. Les tâches non démarrées restent
    // clôturées à la fin du service comme auparavant.
    if (task.status === 'En cours' && taskCompletionGraceActive(task, now, settings)) return task;
    return { ...task, status: 'Non faite' as const, completion: 'En retard' as const, bonusAmount: 0, penaltyAmount: settings.taskPenaltyAmount, comment: task.comment || 'Tâche non démarrée ou non terminée avant la clôture du service.', validationStatus: 'En attente de validation RH' as const };
  });
}

export function completeDailyTask(task: DailyTaskInstance, completedAt: string, comment: string, settings: DailyTaskSettings) {
  const started = new Date(task.startedAt).getTime();
  const completed = new Date(completedAt).getTime();
  const actualDurationMinutes = Math.max(0, Math.round((completed - started) / 60000));
  const late = taskCompletionIsLate(task, completedAt, settings);
  return { ...task, status: 'Terminée' as const, completedAt, completion: late ? 'En retard' as const : 'À temps' as const, actualDurationMinutes, comment: comment.trim(), bonusAmount: late ? 0 : settings.taskBonusAmount, penaltyAmount: late ? settings.taskPenaltyAmount : 0, validationStatus: 'En attente de validation RH' as const };
}

export function validatedTaskSummary(employeeIds: string | string[], period: string, instances: DailyTaskInstance[]) { const ids = Array.isArray(employeeIds) ? employeeIds : [employeeIds]; const selected = instances.filter((task) => ids.includes(task.assignedEmployeeId) && task.date.startsWith(period)); const bonuses = selected.filter((task) => task.validationStatus === 'Gain validé'); const penalties = selected.filter((task) => task.validationStatus === 'Perte validée'); return { bonus: bonuses.reduce((sum, task) => sum + task.bonusAmount, 0), penalty: penalties.reduce((sum, task) => sum + task.penaltyAmount, 0), onTimeCount: bonuses.length, lateCount: penalties.length }; }
