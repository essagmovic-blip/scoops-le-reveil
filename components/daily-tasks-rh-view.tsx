'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Check, Clock3, Edit3, GripVertical, ListChecks, PauseCircle, PlayCircle, Plus, Save, ShieldCheck, Trash2, Users, X } from 'lucide-react';
import { poultryBuildings, units } from '@/lib/data';
import { FARM_STORAGE_KEYS, readLocal, subscribeToFarmData, writeLocal } from '@/lib/farm-storage';
import { DEFAULT_HR_SETTINGS, type HRSettings } from '@/components/hr-settings-view';
import { mergeTaskEmployees, type AccessDirectoryUser, type HRDirectoryEmployee } from '@/lib/hr-directory';
import { loadFarmSnapshot } from '@/lib/farm-calculations';
import { Modal, SectionHeading, StatCard } from '@/components/ui';
import { StatusBadge } from '@/components/status-badge';
import { activePoultryCategoryAssignment, addDaysIso, closeDailyInstances, completeDailyTask, currentServiceDate, DEFAULT_DAILY_TASK_SETTINGS, ensureDailyInstances, filterDeletedTaskTemplates, isDailyTaskUnit, isTaskDayClosed, plannedEndTime, poultryDefaultTaskTemplates, ensurePoultryLifecycleInstances, ensurePoultryRemuageTaskTemplates, responsibleLabel, recalculateTemplateSchedule, reorderTaskTemplates, sortTaskTemplates, shiftForEmployee, taskFitsShift, todayIso, weekStartIso, type DailyTaskCategory, type DailyTaskEmployee, type DailyTaskInstance, type DailyTaskRosterEntry, type DailyTaskScheduleMode, type DailyTaskSettings, type DailyTaskTemplate, type DailyTaskUnitId, type DailyTaskShift, type PoultryCategoryAssignment, type PoultryTaskPhase } from '@/lib/daily-tasks';
import { getActivePoultryProtocol, linkPoultryPendingTaskInstances, linkPoultryTaskTemplates, poultryProtocolTypeForCategory, type PoultryProtocol } from '@/lib/poultry-protocols';

const operatingUnits = units.filter((unit) => unit.id !== 'rh');
type RHTasksTab = 'templates' | 'planning' | 'validation';

type TaskAction = { task: DailyTaskInstance; action: 'gain' | 'perte' | 'reject' } | null;

export function DailyTasksRHView({ initialTab = 'templates' }: { initialTab?: RHTasksTab }) {
  const [tab, setTab] = useState(initialTab);
  const [templates, setTemplates] = useState<DailyTaskTemplate[]>([]);
  const [roster, setRoster] = useState<DailyTaskRosterEntry[]>([]);
  const [categoryAssignments, setCategoryAssignments] = useState<PoultryCategoryAssignment[]>([]);
  const [categoryAssignmentEmployee, setCategoryAssignmentEmployee] = useState<DailyTaskEmployee | null>(null);
  const [categoryAssignmentOpen, setCategoryAssignmentOpen] = useState(false);
  const [instances, setInstances] = useState<DailyTaskInstance[]>([]);
  const [employees, setEmployees] = useState<DailyTaskEmployee[]>([]);
  const [settings, setSettings] = useState<DailyTaskSettings>(DEFAULT_DAILY_TASK_SETTINGS);
  const [templateOpen, setTemplateOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<DailyTaskTemplate | null>(null);
  const [taskAction, setTaskAction] = useState<TaskAction>(null);
  const [feedback, setFeedback] = useState('');
  const [unitFilter, setUnitFilter] = useState<DailyTaskUnitId | 'Toutes'>('Toutes');
  const [buildingFilter, setBuildingFilter] = useState('Tous');
  const [query, setQuery] = useState('');
  const [draggedTemplateId, setDraggedTemplateId] = useState('');
  const [newTaskShift, setNewTaskShift] = useState<DailyTaskShift>('jour');
  const [newTaskPhase, setNewTaskPhase] = useState<PoultryTaskPhase>('poussiniere');
  const [taskCatalogOpen, setTaskCatalogOpen] = useState(false);
  const [catalogPhase, setCatalogPhase] = useState<PoultryTaskPhase>('poussiniere');
  const [catalogShift, setCatalogShift] = useState<DailyTaskShift>('jour');
  const [catalogBuildingId, setCatalogBuildingId] = useState('');
  const [catalogSelection, setCatalogSelection] = useState<string[]>([]);
  const [buildingOptions, setBuildingOptions] = useState<Array<{ id: string; name: string }>>(poultryBuildings.map((building) => ({ id: building.id, name: building.name })));

  useEffect(() => {
    let disposed = false;
    const refresh = async () => {
      const rawTemplates = readLocal<DailyTaskTemplate[]>(FARM_STORAGE_KEYS.dailyTaskTemplates, []);
      const deletedTemplateIds = readLocal<string[]>(FARM_STORAGE_KEYS.dailyTaskDeletedTemplates, []);
      const savedBuildings = readLocal<Array<{ id: string; name: string }>>(FARM_STORAGE_KEYS.buildings, []);
      if (savedBuildings.length) setBuildingOptions(savedBuildings);
      const protocols = readLocal<PoultryProtocol[]>(FARM_STORAGE_KEYS.poultryProtocols, []);
      const poultrySnapshot = loadFarmSnapshot();
      const templateSource = ensurePoultryRemuageTaskTemplates(poultrySnapshot.buildings, filterDeletedTaskTemplates(rawTemplates, deletedTemplateIds), deletedTemplateIds);
      const nextTemplates = filterDeletedTaskTemplates(linkPoultryTaskTemplates(templateSource, protocols), deletedTemplateIds);
      if (JSON.stringify(rawTemplates) !== JSON.stringify(nextTemplates)) writeLocal(FARM_STORAGE_KEYS.dailyTaskTemplates, nextTemplates);
      const nextRoster = readLocal<DailyTaskRosterEntry[]>(FARM_STORAGE_KEYS.dailyTaskRoster, []);
      const nextCategoryAssignments = readLocal<PoultryCategoryAssignment[]>(FARM_STORAGE_KEYS.poultryCategoryAssignments, []);
      const hrSettings = { ...DEFAULT_HR_SETTINGS, ...readLocal<Partial<HRSettings>>(FARM_STORAGE_KEYS.rhSettings, {}) };
      const nextSettings: DailyTaskSettings = { taskBonusAmount: hrSettings.taskBonusAmount, taskPenaltyAmount: hrSettings.taskPenaltyAmount, taskWorkdayStart: hrSettings.taskWorkdayStart, taskWorkdayEnd: hrSettings.taskWorkdayEnd, dayShiftStart: hrSettings.dayShiftStart, dayShiftEnd: hrSettings.dayShiftEnd, nightShiftStart: hrSettings.nightShiftStart, nightShiftEnd: hrSettings.nightShiftEnd, taskGapMinutes: hrSettings.taskGapMinutes };
      const rhEmployees = readLocal<HRDirectoryEmployee[]>(FARM_STORAGE_KEYS.rhEmployees, []);
      const localUsers = readLocal<AccessDirectoryUser[]>(FARM_STORAGE_KEYS.users, []);
      let directoryUsers = localUsers;
      try {
        const response = await fetch('/api/hr/directory', { cache: 'no-store' });
        if (response.ok) {
          const data = await response.json() as { users?: AccessDirectoryUser[] };
          directoryUsers = [...localUsers, ...(data.users ?? [])].filter((user, index, list) => list.findIndex((item) => item.id === user.id) === index);
        }
      } catch {
        // La copie locale reste disponible si le registre serveur n'est pas joignable.
      }
      const nextEmployees = mergeTaskEmployees(rhEmployees, directoryUsers);
      const dates = Array.from(new Set([todayIso(), addDaysIso(todayIso(), -1), currentServiceDate('nuit', new Date(), nextSettings)]));
      const storedInstances = readLocal<DailyTaskInstance[]>(FARM_STORAGE_KEYS.dailyTaskInstances, []);
      let nextInstances = linkPoultryPendingTaskInstances(storedInstances, protocols);
      for (const date of dates) for (const unit of operatingUnits) nextInstances = ensureDailyInstances(date, unit.id as DailyTaskUnitId, nextTemplates, nextInstances, nextEmployees, nextSettings, nextRoster);
      const poultryContexts = poultrySnapshot.buildings.filter((building) => building.status === 'Occupé' && building.batch && building.batch !== '—').map((building) => {
        const lot = poultrySnapshot.lots.find((item) => item.id === building.batch);
        return lot ? { buildingId: building.id, buildingName: building.name, batchId: building.batch, startDate: lot.start } : null;
      }).filter((context): context is { buildingId: string; buildingName: string; batchId: string; startDate: string } => context !== null);
      nextInstances = ensurePoultryLifecycleInstances(todayIso(), nextTemplates, nextInstances, poultryContexts, nextEmployees);
      nextInstances = ensurePoultryLifecycleInstances(currentServiceDate('nuit', new Date(), nextSettings), nextTemplates, nextInstances, poultryContexts, nextEmployees);
      for (const date of dates) nextInstances = closeDailyInstances(date, nextInstances, new Date(), nextSettings);
      if (JSON.stringify(storedInstances) !== JSON.stringify(nextInstances)) writeLocal(FARM_STORAGE_KEYS.dailyTaskInstances, nextInstances);
      if (!disposed) {
        setTemplates(nextTemplates);
        setRoster(nextRoster);
        setCategoryAssignments(nextCategoryAssignments);
        setEmployees(nextEmployees);
        setSettings(nextSettings);
        setInstances(nextInstances);
      }
    };
    void refresh();
    const timer = window.setInterval(() => { void refresh(); }, 30000);
    const unsubscribe = subscribeToFarmData([FARM_STORAGE_KEYS.dailyTaskTemplates, FARM_STORAGE_KEYS.dailyTaskDeletedTemplates, FARM_STORAGE_KEYS.poultryProtocols, FARM_STORAGE_KEYS.dailyTaskRoster, FARM_STORAGE_KEYS.poultryCategoryAssignments, FARM_STORAGE_KEYS.buildings, FARM_STORAGE_KEYS.dailyTaskInstances, FARM_STORAGE_KEYS.rhEmployees, FARM_STORAGE_KEYS.rhSettings, FARM_STORAGE_KEYS.users], () => { void refresh(); });
    return () => { disposed = true; window.clearInterval(timer); unsubscribe(); };
  }, []);
  const today = todayIso();
  const currentNightDate = currentServiceDate('nuit', new Date(), settings);
  const todayInstances = useMemo(() => instances.filter((task) => {
    const template = templates.find((item) => item.id === task.templateId);
    const active = template ? (template.active || ['Terminée', 'Non faite'].includes(task.status)) : ['Terminée', 'Non faite'].includes(task.status);
    const lifecycleVisible = task.lifecycleTask ? task.date <= today && task.status !== 'Terminée' : ((task.shift ?? 'jour') === 'jour' ? task.date === today : task.date === currentNightDate);
    return lifecycleVisible && (unitFilter === 'Toutes' || task.unitId === unitFilter) && active;
  }), [instances, templates, today, currentNightDate, unitFilter]);
  const pendingValidation = useMemo(() => todayInstances.filter((task) => (task.status === 'Terminée' || task.status === 'Non faite') && task.validationStatus === 'En attente de validation RH'), [todayInstances]);
  const filteredTemplates = useMemo(() => sortTaskTemplates(templates.filter((template) => (unitFilter === 'Toutes' || template.unitId === unitFilter) && (buildingFilter === 'Tous' || template.unitId !== 'poulets' || template.assignedBuildingId === buildingFilter) && `${template.title} ${template.assignedRole} ${template.unitId}`.toLowerCase().includes(query.toLowerCase()))), [templates, unitFilter, buildingFilter, query]);
  const visibleBuildingOptions = buildingFilter === 'Tous' ? buildingOptions : buildingOptions.filter((building) => building.id === buildingFilter);
  const poultryTemplates = filteredTemplates.filter((template) => template.unitId === 'poulets');
  const otherDayTemplates = filteredTemplates.filter((template) => template.unitId !== 'poulets' && (template.shift ?? 'jour') === 'jour');
  const otherNightTemplates = filteredTemplates.filter((template) => template.unitId !== 'poulets' && (template.shift ?? 'jour') === 'nuit');
  const availableCatalogTasks = useMemo(() => {
    const building = buildingOptions.find((item) => item.id === catalogBuildingId);
    if (!building) return [];
    const existingIds = new Set(templates.map((template) => template.id));
    return poultryDefaultTaskTemplates([building], [], new Date()).filter((template) => poultryTemplatePhase(template) === catalogPhase && (template.shift ?? 'jour') === catalogShift && !existingIds.has(template.id));
  }, [buildingOptions, catalogBuildingId, catalogPhase, catalogShift, templates]);
  const activeTemplates = templates.filter((template) => template.active).length;
  const inProgress = todayInstances.filter((task) => task.status === 'En cours').length;
  const completed = todayInstances.filter((task) => task.status === 'Terminée').length;

  function notify(message: string) { setFeedback(message); window.setTimeout(() => setFeedback(''), 4200); }

  function openNewTemplate(shift: DailyTaskShift = 'jour', phase: PoultryTaskPhase = 'poussiniere', useCatalog = false, buildingId = '') {
    setEditingTemplate(null);
    setNewTaskShift(shift);
    setNewTaskPhase(phase);
    if (useCatalog) {
      setCatalogShift(shift);
      setCatalogPhase(phase);
      setCatalogBuildingId(buildingId || buildingOptions[0]?.id || '');
      setCatalogSelection([]);
      setTaskCatalogOpen(true);
      return;
    }
    setTemplateOpen(true);
  }

  function openCustomTemplateFromCatalog() {
    setTaskCatalogOpen(false);
    setEditingTemplate(null);
    setNewTaskShift(catalogShift);
    setNewTaskPhase(catalogPhase);
    setTemplateOpen(true);
  }

  function createSelectedCatalogTasks() {
    const building = buildingOptions.find((item) => item.id === catalogBuildingId);
    const selected = availableCatalogTasks.filter((template) => catalogSelection.includes(template.id));
    if (!building || !selected.length) {
      notify('Choisissez un bâtiment puis au moins une tâche dans la liste.');
      return;
    }
    const protocols = readLocal<PoultryProtocol[]>(FARM_STORAGE_KEYS.poultryProtocols, []);
    const deletedTemplateIds = readLocal<string[]>(FARM_STORAGE_KEYS.dailyTaskDeletedTemplates, []);
    const nextDeletedTemplateIds = deletedTemplateIds.filter((id) => !selected.some((template) => template.id === id));
    const now = new Date().toISOString();
    let next = [...templates];
    let order = Math.max(0, ...next.filter((template) => template.unitId === 'poulets' && template.assignedBuildingId === building.id && (template.shift ?? 'jour') === catalogShift && poultryTemplatePhase(template) === catalogPhase).map((template) => Number(template.order) || 0));
    const created = selected.map((source) => {
      order += 1;
      return { ...source, order, assignedEmployeeId: '', assignedRole: 'Responsable du bâtiment', assignedBuildingId: building.id, assignedBuildingName: building.name, poultryPhase: source.poultryPhase ?? (catalogPhase === 'poussiniere' ? 'poussiniere' : 'croissance-finition'), effectiveFrom: today, active: true, createdAt: now, updatedAt: now };
    });
    next = linkPoultryTaskTemplates([...next, ...created], protocols);
    next = recalculateTemplateSchedule(next, settings);
    setTemplates(next);
    writeLocal(FARM_STORAGE_KEYS.dailyTaskTemplates, next);
    if (nextDeletedTemplateIds.length !== deletedTemplateIds.length) writeLocal(FARM_STORAGE_KEYS.dailyTaskDeletedTemplates, nextDeletedTemplateIds);
    setTaskCatalogOpen(false);
    setCatalogSelection([]);
    notify(`${created.length} tâche(s) ont été créées pour ${building.name} · ${catalogPhase === 'poussiniere' ? 'Poussinière' : 'Croissance et finition'} · service ${catalogShift}.`);
  }

  function saveTemplate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const unitId = String(form.get('unitId') ?? '') as DailyTaskUnitId;
    const title = String(form.get('title') ?? '').trim();
    const type = String(form.get('type') ?? 'Tâche') as DailyTaskTemplate['type'];
    const shift = String(form.get('shift') ?? 'jour') as DailyTaskShift;
    const durationMinutes = Number(form.get('durationMinutes') ?? 0);
    const assignedEmployeeId = String(form.get('assignedEmployeeId') ?? '');
    const assignedRole = String(form.get('assignedRole') ?? '').trim();
    const assignedBuildingId = unitId === 'poulets' ? String(form.get('assignedBuildingId') ?? '') : '';
    const assignedBuildingName = buildingOptions.find((building) => building.id === assignedBuildingId)?.name ?? '';
    const existing = editingTemplate;
    const poultryPhase = unitId === 'poulets' ? String(form.get('poultryPhase') ?? existing?.poultryPhase ?? newTaskPhase) as PoultryTaskPhase : undefined;
    const selectedScheduleMode = unitId === 'poulets' ? String(form.get('scheduleMode') ?? existing?.scheduleMode ?? 'fixe') as DailyTaskScheduleMode : 'fixe';
    const scheduleMode = unitId === 'poulets' ? poultryPhase === 'poussiniere' ? selectedScheduleMode : selectedScheduleMode === 'libre' ? 'fixe' : selectedScheduleMode : undefined;
    const freeSchedule = scheduleMode === 'libre';
    const startTime = freeSchedule ? '' : String(form.get('startTime') ?? settings.dayShiftStart);
    const recurrenceMinutes = scheduleMode === 'recurrence' ? Math.max(1, Math.floor(Number(form.get('recurrenceMinutes') ?? existing?.recurrenceMinutes ?? 60))) : undefined;
    const alertAfterMinutes = unitId === 'poulets' && !freeSchedule ? 10 : undefined;
    const category = unitId === 'poulets' ? String(form.get('category') ?? existing?.category ?? 'standard') as DailyTaskCategory : undefined;
    const protocolType = unitId === 'poulets' ? poultryProtocolTypeForCategory(category) : undefined;
    const activeProtocol = protocolType && assignedBuildingId ? getActivePoultryProtocol(readLocal<PoultryProtocol[]>(FARM_STORAGE_KEYS.poultryProtocols, []), protocolType, assignedBuildingId) : undefined;
    const protocol = activeProtocol?.steps ?? (protocolType ? existing?.protocol : undefined);
    const protocolId = activeProtocol?.id ?? (protocolType ? existing?.protocolId : undefined);
    const protocolVersion = activeProtocol?.version ?? (protocolType ? existing?.protocolVersion : undefined);
    const requiresWaterQuantity = unitId === 'poulets' && form.get('requiresWaterQuantity') === 'on';
    const requiresFeedQuantity = unitId === 'poulets' && form.get('requiresFeedQuantity') === 'on';
    const requiresTemperatureHumidity = unitId === 'poulets' && form.get('requiresTemperatureHumidity') === 'on';
    const requiresGeneralStateQuestionnaire = unitId === 'poulets' && category === 'etat-general-sujets';
    const buildingRequired = unitId === 'poulets';
    const effectiveFrom = existing?.effectiveFrom ?? String(form.get('effectiveFrom') ?? today);
    const assignedEmployee = employees.find((employee) => employee.id === assignedEmployeeId);
    if (assignedEmployee && assignedEmployee.unitId !== unitId) {
      notify('L’employé responsable doit appartenir à l’unité choisie.');
      return;
    }
    if (buildingRequired && !assignedBuildingId) {
      notify('Cette tâche doit être rattachée à un bâtiment pour conserver le suivi sanitaire.');
      return;
    }
    const validTiming = freeSchedule || Boolean(startTime) && taskFitsShift(startTime, durationMinutes, shift, settings);
    if (!isDailyTaskUnit(unitId) || !['jour', 'nuit'].includes(shift) || !title || durationMinutes <= 0 || (!assignedEmployeeId && !assignedRole) || !validTiming || scheduleMode === 'recurrence' && !recurrenceMinutes) {
      notify(freeSchedule ? 'Renseignez le titre, le service, la durée et un employé ou un poste responsable.' : 'Renseignez le titre, le service, l’horaire, la durée et un employé ou un poste responsable. Une récurrence doit aussi avoir un intervalle.');
      return;
    }
    const now = new Date().toISOString();
    const order = existing?.order ?? (Math.max(0, ...templates.filter((item) => item.unitId === unitId && (item.shift ?? 'jour') === shift).map((item) => Number(item.order) || 0)) + 1);
    const template: DailyTaskTemplate = { id: existing?.id ?? `TPL-TASK-${Date.now()}`, title, type, shift, order, unitId, startTime, durationMinutes, assignedEmployeeId, assignedRole, assignedBuildingId, assignedBuildingName, poultryPhase, scheduleMode, recurrenceMinutes, alertAfterMinutes, category, protocol, protocolId, protocolVersion, requiresWaterQuantity, requiresFeedQuantity, requiresTemperatureHumidity, requiresGeneralStateQuestionnaire, poultryAgeDay: existing?.poultryAgeDay, lifecycleTask: existing?.lifecycleTask, effectiveFrom, active: existing?.active ?? true, createdAt: existing?.createdAt ?? now, updatedAt: now };
    const next = recalculateTemplateSchedule(existing ? templates.map((item) => item.id === existing.id ? template : item) : [...templates, template], settings);
    setTemplates(next);
    writeLocal(FARM_STORAGE_KEYS.dailyTaskTemplates, next);
    setTemplateOpen(false);
    setEditingTemplate(null);
    notify(existing ? 'Le modèle a été modifié sans changer son identifiant.' : `Le modèle est enregistré pour le ${effectiveFrom === today ? 'planning actif' : 'planning du lendemain'}.`);
  }

  function dropTemplate(target: DailyTaskTemplate) {
    const dragged = templates.find((item) => item.id === draggedTemplateId);
    if (!dragged || dragged.id === target.id || dragged.unitId !== target.unitId || (dragged.shift ?? 'jour') !== (target.shift ?? 'jour')) { setDraggedTemplateId(''); return; }
    const next = reorderTaskTemplates(templates, target.unitId, target.shift ?? 'jour', dragged.id, target.id, settings);
    setTemplates(next);
    writeLocal(FARM_STORAGE_KEYS.dailyTaskTemplates, next);
    setDraggedTemplateId('');
    notify('Planning réordonné : les heures suivantes ont été recalculées en cascade.');
  }

  function toggleTemplate(template: DailyTaskTemplate) {
    const next = templates.map((item) => item.id === template.id ? { ...item, active: !item.active, updatedAt: new Date().toISOString() } : item);
    setTemplates(next);
    writeLocal(FARM_STORAGE_KEYS.dailyTaskTemplates, next);
    notify(template.active ? 'Le modèle est désactivé pour les prochaines journées.' : 'Le modèle est réactivé.');
  }

  function deleteTemplate(template: DailyTaskTemplate) {
    if (!window.confirm(`Retirer la tâche « ${template.title} » du planning actif ? Elle restera disponible dans la liste proposée pour une réutilisation volontaire.`)) return;
    const deletedTemplateIds = readLocal<string[]>(FARM_STORAGE_KEYS.dailyTaskDeletedTemplates, []);
    const nextDeletedTemplateIds = deletedTemplateIds.filter((id) => id !== template.id);
    const nextTemplates = templates.filter((item) => item.id !== template.id);
    const storedInstances = readLocal<DailyTaskInstance[]>(FARM_STORAGE_KEYS.dailyTaskInstances, []);
    const nextInstances = storedInstances.filter((task) => task.templateId !== template.id || ['Terminée', 'Non faite'].includes(task.status));
    setTemplates(nextTemplates);
    setInstances(nextInstances);
    writeLocal(FARM_STORAGE_KEYS.dailyTaskDeletedTemplates, nextDeletedTemplateIds);
    writeLocal(FARM_STORAGE_KEYS.dailyTaskTemplates, nextTemplates);
    writeLocal(FARM_STORAGE_KEYS.dailyTaskInstances, nextInstances);
    notify(`La tâche « ${template.title} » a été retirée du planning. Elle reste disponible dans les tâches proposées.`);
  }

  function openCategoryAssignment(employee: DailyTaskEmployee) {
    if (employee.unitId !== 'poulets') return;
    setCategoryAssignmentEmployee(employee);
    setCategoryAssignmentOpen(true);
  }

  function saveCategoryAssignment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!categoryAssignmentEmployee) return;
    const phase = String(new FormData(event.currentTarget).get('poultryPhase') ?? 'poussiniere') as PoultryTaskPhase;
    const employeeIds = [categoryAssignmentEmployee.id, categoryAssignmentEmployee.linkedUserId, categoryAssignmentEmployee.sourceEmployeeId].filter(Boolean) as string[];
    const current = activePoultryCategoryAssignment(categoryAssignments, employeeIds, new Date());
    if (current?.poultryPhase === phase) {
      notify(`La catégorie ${phase === 'poussiniere' ? 'Poussinière' : 'Croissance et finition'} est déjà active pour ${categoryAssignmentEmployee.name}.`);
      setCategoryAssignmentOpen(false);
      return;
    }
    const now = new Date().toISOString();
    const next = categoryAssignments.map((assignment) => assignment.unitId === 'poulets' && employeeIds.includes(assignment.employeeId) && assignment.status === 'Active' && (!assignment.endAt || assignment.endAt > now) ? { ...assignment, status: 'Terminée' as const, endAt: now } : assignment);
    const assignment: PoultryCategoryAssignment = { id: `CAT-${categoryAssignmentEmployee.id}-${Date.now()}`, employeeId: categoryAssignmentEmployee.id, employeeName: categoryAssignmentEmployee.name, unitId: 'poulets', poultryPhase: phase, startAt: now, endAt: '', status: 'Active', validatedAt: now, validatedBy: 'RH' };
    const nextAssignments = [assignment, ...next];
    setCategoryAssignments(nextAssignments);
    writeLocal(FARM_STORAGE_KEYS.poultryCategoryAssignments, nextAssignments);
    setCategoryAssignmentOpen(false);
    notify(`${categoryAssignmentEmployee.name} est maintenant affecté à la catégorie ${phase === 'poussiniere' ? 'Poussinière' : 'Croissance et finition'}. L’ancienne affectation est clôturée.`);
  }

  function validateTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!taskAction) return;
    const comment = String(new FormData(event.currentTarget).get('validationComment') ?? '').trim();
    if (taskAction.action === 'reject' && !comment) { notify('Le commentaire RH est obligatoire pour rejeter un gain ou une pénalité.'); return; }
    const status = taskAction.action === 'gain' ? 'Gain validé' : taskAction.action === 'perte' ? 'Perte validée' : 'Rejeté';
    const next = instances.map((item) => item.id === taskAction.task.id ? { ...item, validationStatus: status as DailyTaskInstance['validationStatus'], validationComment: comment, validatedAt: new Date().toISOString(), validatedBy: 'RH' } : item);
    setInstances(next);
    writeLocal(FARM_STORAGE_KEYS.dailyTaskInstances, next);
    setTaskAction(null);
    notify(`La tâche « ${taskAction.task.title} » a été ${status.toLowerCase()}.`);
  }

  return <div className="fade-in space-y-7"><div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between"><div><Link href="/dashboard/rh" className="mb-4 inline-flex items-center gap-2 text-[11px] font-bold text-[#6c8176] hover:text-forest">← Retour au dashboard RH</Link><p className="eyebrow mb-2">RH & administration · Contrôle des tâches</p><h1 className="page-title">Tâches quotidiennes</h1><p className="muted mt-2 max-w-2xl text-[13px] leading-5">RH définit les plannings types des six unités, puis valide les gains et les pénalités avant toute intégration à la paie.</p></div><div className="flex flex-wrap gap-2"><button className={tab === 'templates' ? 'btn-primary' : 'btn-secondary'} onClick={() => setTab('templates')}><ListChecks size={15} /> Modèles de tâches</button><button className={tab === 'planning' ? 'btn-primary' : 'btn-secondary'} onClick={() => setTab('planning')}><Users size={15} /> Services & rotations</button><button className={tab === 'validation' ? 'btn-primary' : 'btn-secondary'} onClick={() => setTab('validation')}><ShieldCheck size={15} /> Suivi & validation{pendingValidation.length ? ` (${pendingValidation.length})` : ''}</button></div></div>{feedback && <div className="flex items-center gap-2 rounded-xl border border-[#cde8c7] bg-[#effaeb] px-4 py-3 text-[12px] font-semibold text-[#4d8f51]"><Check size={14} />{feedback}</div>}<div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><StatCard label="Modèles actifs" value={String(activeTemplates)} change="six unités" detail="planning type RH" icon={ListChecks} tone="purple" /><StatCard label="Tâches du jour" value={String(todayInstances.length)} change={isTaskDayClosed(today, new Date(), settings) ? 'Journée terminée' : 'Planning ouvert'} detail={today} icon={Clock3} tone="blue" /><StatCard label="En cours" value={String(inProgress)} change="vue en direct" detail="toutes unités" icon={Users} tone="orange" /><StatCard label="À valider RH" value={String(pendingValidation.length)} change={pendingValidation.length ? 'Action requise' : 'Aucune'} detail={`${completed} terminée(s)`} icon={ShieldCheck} tone="green" /></div><div className="flex flex-wrap items-center gap-2"><select className="input-base h-9 w-auto text-[11px]" value={unitFilter} onChange={(event) => setUnitFilter(event.target.value as DailyTaskUnitId | 'Toutes')}><option value="Toutes">Toutes les unités</option>{operatingUnits.map((unit) => <option key={unit.id} value={unit.id}>{unit.shortLabel}</option>)}</select>{tab === 'templates' && (unitFilter === 'Toutes' || unitFilter === 'poulets') && <select className="input-base h-9 w-auto text-[11px]" value={buildingFilter} onChange={(event) => setBuildingFilter(event.target.value)}><option value="Tous">Tous les bâtiments</option>{buildingOptions.map((building) => <option value={building.id} key={building.id}>{building.name}</option>)}</select>}{tab === 'templates' && <><input className="input-base h-9 min-w-[220px] text-[11px]" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Rechercher un modèle..." /><button className="btn-primary" onClick={() => unitFilter === 'poulets' || unitFilter === 'Toutes' ? openNewTemplate('jour', 'poussiniere', true, buildingFilter === 'Tous' ? '' : buildingFilter) : openNewTemplate('jour')}><Plus size={15} /> Ajouter une tâche</button></>}</div>{tab === 'templates' ? <div className="space-y-7">{(unitFilter === 'Toutes' || unitFilter === 'poulets' || poultryTemplates.length > 0) && <div className="space-y-3"><div className="rounded-xl border border-[#dce8db] bg-[#f5faf2] px-5 py-4 sm:px-6"><p className="eyebrow mb-1">Unité Poulets bio</p><h2 className="text-[19px] font-semibold tracking-[-.035em] text-ink">Tâches regroupées par bâtiment</h2><p className="muted mt-1 text-[12px]">Chaque bâtiment possède les catégories Poussinière et Croissance et finition, avec un service jour et un service nuit dans chaque catégorie.</p></div>{visibleBuildingOptions.map((building) => <PoultryBuildingSection key={building.id} building={building} templates={poultryTemplates.filter((template) => template.assignedBuildingId === building.id)} employees={employees} draggedTemplateId={draggedTemplateId} onNew={(shift, phase, buildingId) => openNewTemplate(shift, phase, true, buildingId)} onEdit={(template) => { setEditingTemplate(template); setNewTaskShift(template.shift ?? 'jour'); setNewTaskPhase(poultryTemplatePhase(template) ?? 'poussiniere'); setTemplateOpen(true); }} onToggle={toggleTemplate} onDelete={deleteTemplate} onDragStart={(id) => setDraggedTemplateId(id)} onDrop={dropTemplate} />)}{poultryTemplates.some((template) => !template.assignedBuildingId) && <PoultryOrphanTemplatesSection templates={poultryTemplates.filter((template) => !template.assignedBuildingId)} employees={employees} draggedTemplateId={draggedTemplateId} onNew={(shift) => openNewTemplate(shift, 'poussiniere', true)} onEdit={(template) => { setEditingTemplate(template); setNewTaskShift(template.shift ?? 'jour'); setNewTaskPhase(poultryTemplatePhase(template) ?? 'poussiniere'); setTemplateOpen(true); }} onToggle={toggleTemplate} onDelete={deleteTemplate} onDragStart={(id) => setDraggedTemplateId(id)} onDrop={dropTemplate} />}</div>}{unitFilter !== 'poulets' && <div className="grid gap-5 xl:grid-cols-2"><TemplateShiftSection label="Service jour" shift="jour" templates={otherDayTemplates} employees={employees} draggedTemplateId={draggedTemplateId} onNew={() => openNewTemplate('jour')} onEdit={(template) => { setEditingTemplate(template); setNewTaskShift(template.shift ?? 'jour'); setNewTaskPhase(template.poultryPhase ?? 'poussiniere'); setTemplateOpen(true); }} onToggle={toggleTemplate} onDelete={deleteTemplate} onDragStart={(id) => setDraggedTemplateId(id)} onDrop={dropTemplate} /><TemplateShiftSection label="Service nuit" shift="nuit" templates={otherNightTemplates} employees={employees} draggedTemplateId={draggedTemplateId} onNew={() => openNewTemplate('nuit')} onEdit={(template) => { setEditingTemplate(template); setNewTaskShift(template.shift ?? 'nuit'); setNewTaskPhase(template.poultryPhase ?? 'poussiniere'); setTemplateOpen(true); }} onToggle={toggleTemplate} onDelete={deleteTemplate} onDragStart={(id) => setDraggedTemplateId(id)} onDrop={dropTemplate} /></div>}</div> : tab === 'planning' ? <RosterView employees={employees} roster={roster} categoryAssignments={categoryAssignments} date={today} onCategoryAssign={openCategoryAssignment} onChange={(entry) => { const next = roster.filter((item) => !(item.employeeId === entry.employeeId && item.unitId === entry.unitId)).concat(entry); setRoster(next); writeLocal(FARM_STORAGE_KEYS.dailyTaskRoster, next); }} /> : <div className="space-y-5"><div className="surface overflow-hidden"><div className="border-b border-[#edf0eb] px-5 py-5 sm:px-6"><SectionHeading eyebrow="File de validation" title="Tâches terminées en attente" description="Aucune prime ni pénalité ne rejoint la paie avant une décision RH." /></div><div className="divide-y divide-[#edf0eb]">{pendingValidation.length ? pendingValidation.map((task) => <ValidationRow key={task.id} task={task} onAction={(action) => setTaskAction({ task, action })} />) : <p className="px-6 py-14 text-center text-[11px] text-[#89968f]">Aucune tâche terminée n’attend une validation.</p>}</div></div><div className="surface overflow-hidden"><div className="border-b border-[#edf0eb] px-5 py-5 sm:px-6"><SectionHeading eyebrow="En direct · {today}" title="Planning de toutes les unités" description="Les changements sont relus automatiquement toutes les 30 secondes et après chaque action locale." /></div><div className="divide-y divide-[#edf0eb]">{todayInstances.length ? <><LiveShiftBlock label="Service jour" tasks={todayInstances.filter((task) => (task.shift ?? 'jour') === 'jour')} /><LiveShiftBlock label="Service nuit" tasks={todayInstances.filter((task) => (task.shift ?? 'jour') === 'nuit')} /></> : <p className="px-6 py-14 text-center text-[11px] text-[#89968f]">Aucun planning généré pour aujourd’hui.</p>}</div></div></div>}
    <TaskCatalogModal open={taskCatalogOpen} buildings={buildingOptions} phase={catalogPhase} shift={catalogShift} buildingId={catalogBuildingId} selectedIds={catalogSelection} tasks={availableCatalogTasks} onClose={() => setTaskCatalogOpen(false)} onBuildingChange={(value) => { setCatalogBuildingId(value); setCatalogSelection([]); }} onPhaseChange={(value) => { setCatalogPhase(value); setCatalogSelection([]); }} onShiftChange={(value) => { setCatalogShift(value); setCatalogSelection([]); }} onSelectionChange={setCatalogSelection} onCreate={createSelectedCatalogTasks} onCustom={openCustomTemplateFromCatalog} />
    <Modal open={templateOpen} onClose={() => { setTemplateOpen(false); setEditingTemplate(null); }} title={editingTemplate ? 'Modifier un modèle de tâche' : 'Créer un modèle de tâche'}><form key={editingTemplate?.id ?? 'new-task'} onSubmit={saveTemplate} className="space-y-5"><div className="grid gap-4 sm:grid-cols-2"><label className="block sm:col-span-2"><span className="field-label">Titre</span><input name="title" className="input-base" defaultValue={editingTemplate?.title ?? ''} placeholder="Ex. Nettoyage du bâtiment A" required /></label><label className="block"><span className="field-label">Unité</span><select name="unitId" className="input-base" defaultValue={editingTemplate?.unitId ?? (unitFilter !== 'Toutes' ? unitFilter : 'poulets')}>{operatingUnits.map((unit) => <option key={unit.id} value={unit.id}>{unit.label}</option>)}</select></label><label className="block"><span className="field-label">Bâtiment concerné (obligatoire pour Poulets bio)</span><select name="assignedBuildingId" className="input-base" defaultValue={editingTemplate?.assignedBuildingId ?? catalogBuildingId}><option value="">Choisir un bâtiment</option>{buildingOptions.map((building) => <option key={building.id} value={building.id}>{building.name}</option>)}</select></label><label className="block"><span className="field-label">Phase Poulets bio</span><select name="poultryPhase" className="input-base" defaultValue={editingTemplate?.poultryPhase ?? newTaskPhase} onChange={(event) => setNewTaskPhase(event.target.value as PoultryTaskPhase)}><option value="poussiniere">Poussinière</option><option value="croissance-finition">Croissance et finition</option></select></label><label className="block"><span className="field-label">Mode de planification</span><select name="scheduleMode" className="input-base" defaultValue={editingTemplate?.scheduleMode ?? 'fixe'}><option value="fixe">Tâche à heure fixe</option><option value="recurrence">Récurrence automatique</option>{newTaskPhase === 'poussiniere' && <option value="libre">À tout moment · plusieurs exécutions</option>}</select></label><label className="block"><span className="field-label">Intervalle de récurrence (minutes)</span><input name="recurrenceMinutes" type="number" min="1" step="1" className="input-base" defaultValue={editingTemplate?.recurrenceMinutes ?? 60} /><p className="mt-1 text-[10px] text-[#89968f]">Utilisé pour les tâches toutes les 30 ou 60 minutes.</p></label><label className="block"><span className="field-label">Catégorie métier</span><select name="category" className="input-base" defaultValue={editingTemplate?.category ?? 'standard'}><option value="standard">Standard</option><option value="service-eau">Service eau</option><option value="service-aliment">Service aliment</option><option value="stimulation">Stimulation</option><option value="nettoyage">Nettoyage</option><option value="temperature-humidite">Température et humidité</option><option value="remuage-copeaux">Remuage des copeaux</option><option value="renouvellement-air">Renouvellement de l’air</option><option value="etat-general-sujets">État général des sujets · urgence RH</option><option value="repos-sujets">Repos des sujets</option><option value="pause-vague">Pause par vague</option><option value="vaccination">Vaccination</option><option value="pesee">Pesée</option></select></label><div className="rounded-xl border border-[#dce8db] bg-[#f5faf2] p-3 text-[10px] leading-5 text-[#6d9071]"><strong className="block text-[#3e7546]">Protocoles eau et aliment</strong><span>Ils sont créés et modifiés dans la rubrique <Link href="/poulets/sante" className="font-bold text-[#5b9d5b] hover:underline">Santé et traitement</Link>. Les tâches de service utilisent automatiquement la version active du bâtiment concerné.</span></div><label className="flex items-center gap-2 rounded-xl border border-[#e6ede5] px-3 py-3 text-[10px] font-semibold text-[#65766c]"><input name="requiresWaterQuantity" type="checkbox" defaultChecked={editingTemplate?.requiresWaterQuantity} className="h-3.5 w-3.5 accent-[#5da561]" /> Quantité d’eau obligatoire en fin de service</label><label className="flex items-center gap-2 rounded-xl border border-[#e6ede5] px-3 py-3 text-[10px] font-semibold text-[#65766c]"><input name="requiresFeedQuantity" type="checkbox" defaultChecked={editingTemplate?.requiresFeedQuantity} className="h-3.5 w-3.5 accent-[#5da561]" /> Quantité d’aliment obligatoire en fin de service</label><label className="flex items-center gap-2 rounded-xl border border-[#e6ede5] px-3 py-3 text-[10px] font-semibold text-[#65766c]"><input name="requiresTemperatureHumidity" type="checkbox" defaultChecked={editingTemplate?.requiresTemperatureHumidity} className="h-3.5 w-3.5 accent-[#5da561]" /> Température et humidité obligatoires</label><label className="block"><span className="field-label">Type</span><select name="type" className="input-base" defaultValue={editingTemplate?.type ?? 'Tâche'}><option>Tâche</option><option>Pause</option></select></label><label className="block"><span className="field-label">Service</span><select name="shift" className="input-base" defaultValue={editingTemplate?.shift ?? newTaskShift}><option value="jour">Service jour ({settings.dayShiftStart}–{settings.dayShiftEnd})</option><option value="nuit">Service nuit ({settings.nightShiftStart}–{settings.nightShiftEnd})</option></select></label><label className="block"><span className="field-label">Heure de début prévue (fixe ou récurrente)</span><input name="startTime" type="time" className="input-base" defaultValue={editingTemplate?.startTime ?? (newTaskShift === 'nuit' ? settings.nightShiftStart : settings.dayShiftStart)} /><p className="mt-1 text-[10px] text-[#89968f]">Pour une tâche « À tout moment » de la Poussinière, laissez ce champ vide : elle pourra être exécutée plusieurs fois dans le service.</p></label><label className="block"><span className="field-label">Durée attendue (minutes)</span><input name="durationMinutes" type="number" min="1" className="input-base" defaultValue={editingTemplate?.durationMinutes ?? 30} required /></label><label className="block sm:col-span-2"><span className="field-label">Employé responsable (ID stable)</span><select name="assignedEmployeeId" className="input-base" defaultValue={editingTemplate?.assignedEmployeeId ?? ''}><option value="">Aucun — utiliser un poste</option>{employees.filter((employee) => employee.status !== 'Sorti').map((employee) => <option key={employee.id} value={employee.id}>{employee.name} · {employee.id} · {operatingUnits.find((unit) => unit.id === employee.unitId)?.shortLabel}</option>)}</select></label><label className="block sm:col-span-2"><span className="field-label">Poste responsable (si aucun employé précis)</span><input name="assignedRole" className="input-base" defaultValue={editingTemplate?.assignedRole ?? ''} placeholder="Ex. Responsable d’élevage, magasinier, commercial" /></label>{!editingTemplate && <label className="block sm:col-span-2"><span className="field-label">Première date d’activation</span><input name="effectiveFrom" type="date" className="input-base" defaultValue={today} required /><p className="mt-1 text-[10px] text-[#89968f]">Choisissez aujourd’hui pour l’ajouter au service actif, ou une date future pour la mettre en pause jusqu’au moment voulu.</p></label>}</div><div className="rounded-xl border border-[#e1ebe0] bg-[#f6faf4] p-3 text-[11px] leading-5 text-[#6d8972]">Les tâches à heure fixe et récurrentes respectent les plages jour {settings.dayShiftStart}–{settings.dayShiftEnd} et nuit {settings.nightShiftStart}–{settings.nightShiftEnd}. Une tâche libre de la Poussinière n’a pas d’heure prévue et peut être exécutée plusieurs fois pendant le service. Les pauses conservent leur horaire défini.</div><div className="flex justify-end gap-2"><button type="button" className="btn-secondary" onClick={() => setTemplateOpen(false)}><X size={14} /> Annuler</button><button type="submit" className="btn-primary"><Save size={15} /> Enregistrer le modèle</button></div></form></Modal>
    <Modal open={categoryAssignmentOpen} onClose={() => { setCategoryAssignmentOpen(false); setCategoryAssignmentEmployee(null); }} title="Affecter une catégorie Poulets bio">{categoryAssignmentEmployee && <form onSubmit={saveCategoryAssignment} className="space-y-5"><div className="rounded-xl border border-[#e1ebe0] bg-[#f6faf4] p-4 text-[11px] leading-5"><strong>{categoryAssignmentEmployee.name}</strong><p className="mt-1 text-[#718078]">Une seule catégorie peut être active à la fois. La validation clôturera automatiquement l’ancienne affectation sans supprimer son historique.</p></div><label className="block"><span className="field-label">Nouvelle catégorie validée par RH</span><select name="poultryPhase" className="input-base" defaultValue={activePoultryCategoryAssignment(categoryAssignments, [categoryAssignmentEmployee.id, categoryAssignmentEmployee.linkedUserId, categoryAssignmentEmployee.sourceEmployeeId].filter(Boolean) as string[], new Date())?.poultryPhase ?? 'poussiniere'}><option value="poussiniere">Poussinière</option><option value="croissance-finition">Croissance et finition</option></select></label><div className="rounded-xl border border-[#dce8db] bg-[#f5faf2] p-3 text-[10px] leading-5 text-[#5b8f60]">Après validation, l’employé ne verra plus les tâches de l’autre catégorie. Il pourra être affecté à un autre bâtiment si ses droits bâtiment l’autorisent.</div><div className="flex justify-end gap-2"><button type="button" className="btn-secondary" onClick={() => { setCategoryAssignmentOpen(false); setCategoryAssignmentEmployee(null); }}>Annuler</button><button type="submit" className="btn-primary"><Check size={15} /> Valider l’affectation</button></div></form>}</Modal>
    <Modal open={Boolean(taskAction)} onClose={() => setTaskAction(null)} title={taskAction?.action === 'reject' ? 'Rejeter le gain ou la pénalité' : taskAction?.action === 'gain' ? 'Valider le gain' : 'Valider la pénalité'}>{taskAction && <form onSubmit={validateTask} className="space-y-5"><div className="rounded-xl border border-[#e1ebe0] bg-[#f6faf4] p-4 text-[11px] leading-5"><strong>{taskAction.task.title}</strong><p className="mt-1 text-[#718078]">{taskAction.task.assignedEmployeeName || taskAction.task.assignedRole} · {taskAction.task.completion === 'À temps' ? `Prime proposée : ${taskAction.task.bonusAmount} FCFA` : `Pénalité proposée : ${taskAction.task.penaltyAmount} FCFA`}</p><p className="mt-1 text-[#718078]">Commentaire du responsable : {taskAction.task.comment || '—'}</p></div><label className="block"><span className="field-label">Commentaire RH {taskAction.action === 'reject' ? '(obligatoire)' : '(facultatif)'}</span><textarea name="validationComment" className="input-base min-h-[90px] resize-none" required={taskAction.action === 'reject'} placeholder="Décision, justification ou remarque RH" /></label><div className="flex justify-end gap-2"><button type="button" className="btn-secondary" onClick={() => setTaskAction(null)}>Annuler</button><button type="submit" className={taskAction.action === 'reject' ? 'btn-secondary' : 'btn-primary'}><Check size={15} /> Confirmer</button></div></form>}</Modal>
  </div>;
}

function unitLabel(unitId: string) { return operatingUnits.find((unit) => unit.id === unitId)?.label ?? unitId; }
function poultryTemplatePhase(template: DailyTaskTemplate): PoultryTaskPhase | undefined {
  if (template.poultryPhase) return template.poultryPhase;
  if (template.lifecycleTask && template.poultryAgeDay !== undefined) return template.poultryAgeDay <= 20 ? 'poussiniere' : 'croissance-finition';
  return undefined;
}

function TaskCatalogModal({ open, buildings, phase, shift, buildingId, selectedIds, tasks, onClose, onBuildingChange, onPhaseChange, onShiftChange, onSelectionChange, onCreate, onCustom }: { open: boolean; buildings: Array<{ id: string; name: string }>; phase: PoultryTaskPhase; shift: DailyTaskShift; buildingId: string; selectedIds: string[]; tasks: DailyTaskTemplate[]; onClose: () => void; onBuildingChange: (value: string) => void; onPhaseChange: (value: PoultryTaskPhase) => void; onShiftChange: (value: DailyTaskShift) => void; onSelectionChange: (value: string[]) => void; onCreate: () => void; onCustom: () => void }) {
  const phaseLabel = phase === 'poussiniere' ? 'Poussinière' : 'Croissance et finition';
  const shiftLabel = shift === 'jour' ? 'Jour' : 'Nuit';
  return <Modal open={open} onClose={onClose} title="Choisir les tâches à créer"><div className="space-y-5"><div className="rounded-xl border border-[#dce8db] bg-[#f5faf2] p-4 text-[11px] leading-5 text-[#4d8f52]"><strong>Chaque tâche sera rattachée explicitement à un seul triplet :</strong><p className="mt-1">Bâtiment · catégorie · service. Aucune tâche ne sera créée avant votre validation.</p></div><div className="grid gap-4 sm:grid-cols-3"><label className="block"><span className="field-label">Bâtiment obligatoire</span><select className="input-base" value={buildingId} onChange={(event) => onBuildingChange(event.target.value)} required><option value="">Choisir un bâtiment</option>{buildings.map((building) => <option value={building.id} key={building.id}>{building.name}</option>)}</select></label><label className="block"><span className="field-label">Catégorie obligatoire</span><select className="input-base" value={phase} onChange={(event) => onPhaseChange(event.target.value as PoultryTaskPhase)}><option value="poussiniere">Poussinière</option><option value="croissance-finition">Croissance et finition</option></select></label><label className="block"><span className="field-label">Service obligatoire</span><select className="input-base" value={shift} onChange={(event) => onShiftChange(event.target.value as DailyTaskShift)}><option value="jour">Service jour</option><option value="nuit">Service nuit</option></select></label></div><div className="flex items-center justify-between gap-3"><div><p className="text-[13px] font-black text-ink">Tâches proposées</p><p className="mt-1 text-[10px] text-[#89968f]">{phaseLabel} · service {shiftLabel} · {buildings.find((building) => building.id === buildingId)?.name ?? 'bâtiment à choisir'}</p></div><span className="rounded-full bg-[#edf3ff] px-3 py-1.5 text-[10px] font-bold text-[#6385bd]">{selectedIds.length} sélectionnée{selectedIds.length > 1 ? 's' : ''}</span></div><div className="max-h-[390px] space-y-2 overflow-y-auto pr-1">{tasks.length ? tasks.map((task) => { const selected = selectedIds.includes(task.id); return <label className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition ${selected ? 'border-[#76b875] bg-[#f5faf2]' : 'border-[#e6ede5] bg-white hover:border-[#bdd6bc]'}`} key={task.id}><input type="checkbox" checked={selected} onChange={() => onSelectionChange(selected ? selectedIds.filter((id) => id !== task.id) : [...selectedIds, task.id])} className="mt-1 h-4 w-4 accent-[#5da561]" /><span className="min-w-0 flex-1"><strong className="block text-[11px] text-ink">{task.title}</strong><small className="mt-1 block text-[10px] text-[#718078]">{task.scheduleMode === 'libre' ? 'À tout moment · plusieurs exécutions' : task.scheduleMode === 'recurrence' ? `Toutes les ${task.recurrenceMinutes ?? 60} minutes · rappel après 10 min` : `${task.startTime}–${plannedEndTime(task)}`}</small></span></label>; }) : <div className="rounded-xl border border-dashed border-[#dce8db] px-4 py-10 text-center text-[11px] text-[#89968f]">Aucune tâche disponible pour ce triplet. Les tâches déjà créées sont retirées de la liste jusqu’à une nouvelle sélection volontaire.</div>}</div><div className="flex flex-wrap justify-between gap-2 border-t border-[#edf0eb] pt-4"><button type="button" className="btn-secondary" onClick={onCustom}>Créer une tâche personnalisée</button><div className="flex gap-2"><button type="button" className="btn-secondary" onClick={onClose}>Annuler</button><button type="button" className="btn-primary" onClick={onCreate} disabled={!selectedIds.length || !buildingId}>Créer les tâches sélectionnées</button></div></div></div></Modal>;
}

function PoultryBuildingSection({ building, templates, employees, draggedTemplateId, onNew, onEdit, onToggle, onDelete, onDragStart, onDrop }: { building: { id: string; name: string }; templates: DailyTaskTemplate[]; employees: DailyTaskEmployee[]; draggedTemplateId: string; onNew: (shift: DailyTaskShift, phase: PoultryTaskPhase, buildingId: string) => void; onEdit: (template: DailyTaskTemplate) => void; onToggle: (template: DailyTaskTemplate) => void; onDelete: (template: DailyTaskTemplate) => void; onDragStart: (id: string) => void; onDrop: (template: DailyTaskTemplate) => void }) {
  return <section className="rounded-2xl border border-[#dce8db] bg-[#fbfcfa] p-4 sm:p-5"><div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#e7eee5] pb-4"><div><p className="eyebrow mb-1">Bâtiment</p><h2 className="text-[21px] font-semibold tracking-[-.04em] text-ink">{building.name}</h2></div><span className="rounded-full bg-[#f5faf2] px-3 py-1.5 text-[10px] font-bold text-[#5b8f60]">2 catégories · 4 services</span></div><p className="mt-2 text-[11px] leading-5 text-[#718078]">Toutes les tâches de ce bâtiment restent séparées des autres bâtiments. Les catégories Poussinière et Croissance et finition possèdent chacune leur service jour et leur service nuit.</p><div className="mt-4 space-y-6"><PoultryPhaseSection label="Poussinière" phase="poussiniere" templates={templates.filter((template) => poultryTemplatePhase(template) === 'poussiniere')} employees={employees} draggedTemplateId={draggedTemplateId} onNew={(shift) => onNew(shift, 'poussiniere', building.id)} onEdit={onEdit} onToggle={onToggle} onDelete={onDelete} onDragStart={onDragStart} onDrop={onDrop} /><PoultryPhaseSection label="Croissance et finition" phase="croissance-finition" templates={templates.filter((template) => poultryTemplatePhase(template) === 'croissance-finition')} employees={employees} draggedTemplateId={draggedTemplateId} onNew={(shift) => onNew(shift, 'croissance-finition', building.id)} onEdit={onEdit} onToggle={onToggle} onDelete={onDelete} onDragStart={onDragStart} onDrop={onDrop} /></div></section>;
}

function PoultryOrphanTemplatesSection({ templates, employees, draggedTemplateId, onNew, onEdit, onToggle, onDelete, onDragStart, onDrop }: { templates: DailyTaskTemplate[]; employees: DailyTaskEmployee[]; draggedTemplateId: string; onNew: (shift: DailyTaskShift) => void; onEdit: (template: DailyTaskTemplate) => void; onToggle: (template: DailyTaskTemplate) => void; onDelete: (template: DailyTaskTemplate) => void; onDragStart: (id: string) => void; onDrop: (template: DailyTaskTemplate) => void }) {
  return <section className="rounded-2xl border border-[#f0d5ad] bg-[#fffaf2] p-4 sm:p-5"><p className="eyebrow mb-1 text-[#a1784e]">Contrôle de cohérence</p><h2 className="text-[18px] font-semibold text-[#8d6135]">Tâches sans bâtiment</h2><p className="mt-1 text-[11px] leading-5 text-[#986c3e]">Ces anciennes tâches doivent être modifiées pour choisir un bâtiment précis. Elles ne sont pas proposées dans les nouveaux plannings par bâtiment.</p><div className="mt-4 grid gap-5 xl:grid-cols-2"><TemplateShiftSection label="Service jour · à rattacher" shift="jour" templates={templates.filter((template) => (template.shift ?? 'jour') === 'jour')} employees={employees} draggedTemplateId={draggedTemplateId} onNew={() => onNew('jour')} onEdit={onEdit} onToggle={onToggle} onDelete={onDelete} onDragStart={onDragStart} onDrop={onDrop} /><TemplateShiftSection label="Service nuit · à rattacher" shift="nuit" templates={templates.filter((template) => (template.shift ?? 'jour') === 'nuit')} employees={employees} draggedTemplateId={draggedTemplateId} onNew={() => onNew('nuit')} onEdit={onEdit} onToggle={onToggle} onDelete={onDelete} onDragStart={onDragStart} onDrop={onDrop} /></div></section>;
}

function PoultryPhaseSection({ label, phase, templates, employees, draggedTemplateId, onNew, onEdit, onToggle, onDelete, onDragStart, onDrop }: { label: string; phase: PoultryTaskPhase; templates: DailyTaskTemplate[]; employees: DailyTaskEmployee[]; draggedTemplateId: string; onNew: (shift: DailyTaskShift) => void; onEdit: (template: DailyTaskTemplate) => void; onToggle: (template: DailyTaskTemplate) => void; onDelete: (template: DailyTaskTemplate) => void; onDragStart: (id: string) => void; onDrop: (template: DailyTaskTemplate) => void }) {
  const dayTemplates = templates.filter((template) => (template.shift ?? 'jour') === 'jour');
  const nightTemplates = templates.filter((template) => (template.shift ?? 'jour') === 'nuit');
  return <section className="space-y-3" data-phase={phase}><div className="rounded-xl border border-[#e2d9f0] bg-[#f8f5fc] px-5 py-4 sm:px-6"><div className="flex flex-wrap items-center justify-between gap-2"><div><p className="eyebrow mb-1">Catégorie de production</p><h2 className="text-[21px] font-semibold tracking-[-.04em] text-ink">{label}</h2></div><span className="rounded-full bg-white px-3 py-1.5 text-[10px] font-bold text-[#8066a6]">{templates.length} tâche{templates.length > 1 ? 's' : ''}</span></div><p className="mt-1 text-[11px] leading-5 text-[#77658d]">La catégorie est séparée en deux services fixes : Jour et Nuit. La suppression agit uniquement sur une tâche.</p></div><div className="grid gap-5 xl:grid-cols-2"><TemplateShiftSection label="Service jour" shift="jour" templates={dayTemplates} employees={employees} draggedTemplateId={draggedTemplateId} onNew={() => onNew('jour')} onEdit={onEdit} onToggle={onToggle} onDelete={onDelete} onDragStart={onDragStart} onDrop={onDrop} /><TemplateShiftSection label="Service nuit" shift="nuit" templates={nightTemplates} employees={employees} draggedTemplateId={draggedTemplateId} onNew={() => onNew('nuit')} onEdit={onEdit} onToggle={onToggle} onDelete={onDelete} onDragStart={onDragStart} onDrop={onDrop} /></div></section>;
}

function templateTimingLabel(template: DailyTaskTemplate) {
  if (template.scheduleMode === 'libre') return 'À tout moment';
  if (template.scheduleMode === 'recurrence') return `Toutes les ${template.recurrenceMinutes ?? 60} min`;
  return template.startTime ? `${template.startTime}–${plannedEndTime(template)}` : 'Horaire à préciser';
}

function templateScheduleDetail(template: DailyTaskTemplate) {
  if (template.scheduleMode === 'libre') return 'Exécutions multiples possibles pendant le service';
  if (template.scheduleMode === 'recurrence') return `Récurrence : ${template.recurrenceMinutes ?? 60} min`;
  return `Durée indicative : ${template.durationMinutes} min`;
}

function TemplateShiftSection({ label, shift, templates, employees, draggedTemplateId, onNew, onEdit, onToggle, onDelete, onDragStart, onDrop }: { label: string; shift: DailyTaskShift; templates: DailyTaskTemplate[]; employees: DailyTaskEmployee[]; draggedTemplateId: string; onNew: () => void; onEdit: (template: DailyTaskTemplate) => void; onToggle: (template: DailyTaskTemplate) => void; onDelete: (template: DailyTaskTemplate) => void; onDragStart: (id: string) => void; onDrop: (template: DailyTaskTemplate) => void }) {
  return <section className="surface overflow-hidden"><div className="flex items-start justify-between gap-3 border-b border-[#edf0eb] px-5 py-5 sm:px-6"><div><p className="eyebrow mb-2">Service séparé</p><h2 className="text-[19px] font-semibold tracking-[-.035em] text-ink">{label}</h2><p className="muted mt-1 text-[12px]">{templates.length} tâche{templates.length > 1 ? 's' : ''} créée{templates.length > 1 ? 's' : ''} dans ce service.</p></div><button type="button" className="btn-primary shrink-0 px-3 py-2 text-[10px]" onClick={onNew}><Plus size={14} /> Ajouter une tâche</button></div><div className="divide-y divide-[#edf0eb]">{templates.length ? templates.map((template) => <article key={template.id} draggable onDragStart={() => onDragStart(template.id)} onDragOver={(event) => event.preventDefault()} onDrop={() => onDrop(template)} className={`p-4 transition hover:bg-[#fbfcfa] sm:p-5 ${draggedTemplateId === template.id ? 'opacity-50' : ''}`}><div className="flex items-start gap-3"><span className="mt-1 cursor-grab text-[#9aa59f]" title="Glisser pour repositionner"><GripVertical size={15} /></span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><span className="text-[13px] font-black text-ink">{templateTimingLabel(template)}</span><span className="rounded-full bg-[#edf3ff] px-2 py-1 text-[9px] font-bold text-[#6385bd]">{template.type}</span>{template.poultryPhase && <span className="rounded-full bg-[#f5faf2] px-2 py-1 text-[9px] font-bold text-[#5b8f60]">{template.poultryPhase === 'poussiniere' ? 'Poussinière' : 'Croissance et finition'}</span>}<StatusBadge status={template.active ? 'Actif' : 'Suspendu'} /></div><h3 className="mt-3 text-[13px] font-bold text-ink">{template.title}</h3><p className="mt-1 text-[10px] leading-5 text-[#718078]">{operatingUnits.find((unit) => unit.id === template.unitId)?.shortLabel} · {template.assignedBuildingName || 'Tous les bâtiments'} · {template.assignedEmployeeId ? employees.find((employee) => employee.id === template.assignedEmployeeId)?.name ?? 'Employé supprimé' : template.assignedRole || 'Poste non renseigné'}</p><div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-[#89968f]"><span>{templateScheduleDetail(template)}</span>{template.scheduleMode !== 'libre' && template.alertAfterMinutes !== undefined && <span>Alerte : +10 min</span>}{template.scheduleMode === 'libre' && <span>Sans alerte d’horaire</span>}<span>Activation : {template.effectiveFrom}</span></div></div><div className="flex shrink-0 gap-1"><button type="button" className="icon-btn h-8 w-8" onClick={() => onEdit(template)} aria-label={`Modifier ${template.title}`} title="Modifier la tâche"><Edit3 size={14} /></button><button type="button" className="icon-btn h-8 w-8" onClick={() => onToggle(template)} aria-label={template.active ? `Mettre ${template.title} en pause` : `Réactiver ${template.title}`} title={template.active ? 'Mettre en pause' : 'Réactiver'}>{template.active ? <PauseCircle size={14} /> : <PlayCircle size={14} />}</button><button type="button" className="icon-btn h-8 w-8 text-[#bd5c5c] hover:bg-[#fff0ef]" onClick={() => onDelete(template)} aria-label={`Supprimer définitivement ${template.title}`} title="Supprimer définitivement la tâche"><Trash2 size={14} /></button></div></div></article>) : <div className="px-5 py-12 text-center sm:px-6"><Clock3 size={25} className="mx-auto text-[#b4c3b7]" /><p className="mt-3 text-[12px] font-bold text-ink">Aucune tâche pour le service {shift === 'jour' ? 'jour' : 'nuit'}.</p><p className="mt-1 text-[10px] text-[#89968f]">Ajoutez une tâche à ce service sans supprimer le service lui-même.</p></div>}</div></section>;
}

function RosterView({ employees, roster, categoryAssignments, date, onCategoryAssign, onChange }: { employees: DailyTaskEmployee[]; roster: DailyTaskRosterEntry[]; categoryAssignments: PoultryCategoryAssignment[]; date: string; onCategoryAssign: (employee: DailyTaskEmployee) => void; onChange: (entry: DailyTaskRosterEntry) => void }) {
  const unique = employees.filter((employee, index, list) => list.findIndex((item) => item.id === employee.id && item.unitId === employee.unitId) === index);
  return <div className="surface overflow-hidden"><div className="border-b border-[#edf0eb] px-5 py-5 sm:px-6"><SectionHeading eyebrow="Planning RH hebdomadaire" title="Affectation des services et catégories" description="Le mode de service, la rotation et la catégorie Poulets bio sont validés séparément. Un salarié ne peut avoir qu’une catégorie active à la fois." /></div><div className="table-scroll"><table className="w-full min-w-[1260px] text-left"><thead><tr className="table-head"><th>Employé / identifiant</th><th>Unité</th><th>Catégorie Poulets bio</th><th>Mode de service</th><th>Début de rotation</th><th>Cette semaine</th><th>Semaine prochaine</th></tr></thead><tbody>{unique.length ? unique.map((employee) => { const current = roster.find((item) => item.unitId === employee.unitId && [employee.id, employee.linkedUserId, employee.sourceEmployeeId].filter(Boolean).includes(item.employeeId)); const entry: DailyTaskRosterEntry = current ?? { employeeId: employee.id, unitId: employee.unitId, mode: 'rotation', initialShift: 'jour', rotationAnchorDate: weekStartIso(date), updatedAt: '' }; const thisShift = shiftForEmployee(employee.id, date, [entry]) ?? 'non défini'; const nextShift = shiftForEmployee(employee.id, addDaysIso(date, 7), [entry]) ?? 'non défini'; const employeeIds = [employee.id, employee.linkedUserId, employee.sourceEmployeeId].filter(Boolean) as string[]; const category = employee.unitId === 'poulets' ? activePoultryCategoryAssignment(categoryAssignments, employeeIds, new Date()) : undefined; return <tr key={`${employee.id}-${employee.unitId}`} className="table-row table-line"><td><strong className="block text-ink">{employee.name}</strong><small className="text-[10px] text-[#89968f]">Compte / ID : {employee.id}</small></td><td>{unitLabel(employee.unitId)}</td><td className="align-top">{employee.unitId === 'poulets' ? <div className="flex min-w-[250px] flex-col items-start gap-2"><span className={`rounded-full px-2 py-1 text-[9px] font-bold ${category?.poultryPhase === 'croissance-finition' ? 'bg-[#edf3ff] text-[#6385bd]' : category ? 'bg-[#f5faf2] text-[#5b8f60]' : 'bg-[#fff2e2] text-[#bd7737]'}`}>{category ? category.poultryPhase === 'poussiniere' ? 'Poussinière' : 'Croissance et finition' : 'Non affectée'}</span>{category && <small className="text-[10px] text-[#89968f]">Validée le {new Date(category.validatedAt).toLocaleDateString('fr-FR')}</small>}<button type="button" className="btn-secondary px-2.5 py-1.5 text-[10px]" onClick={() => onCategoryAssign(employee)}>{category ? 'Changer de catégorie' : 'Affecter une catégorie'}</button></div> : <span className="text-[10px] text-[#89968f]">Non applicable</span>}</td><td className="align-top"><label className="block min-w-[210px]"><span className="field-label">Mode de service</span><select className="input-base h-9 w-full text-[10px]" value={entry.mode} onChange={(event) => onChange({ ...entry, mode: event.target.value as DailyTaskRosterEntry['mode'], updatedAt: new Date().toISOString() })}><option value="rotation">Rotation hebdomadaire</option><option value="jour">Jour uniquement</option><option value="nuit">Nuit uniquement</option></select></label></td><td className="align-top">{entry.mode === 'rotation' ? <label className="block min-w-[210px]"><span className="field-label">La rotation commence</span><select className="input-base h-9 w-full text-[10px]" value={entry.initialShift} onChange={(event) => onChange({ ...entry, initialShift: event.target.value as DailyTaskShift, updatedAt: new Date().toISOString() })}><option value="jour">En service jour</option><option value="nuit">En service nuit</option></select></label> : <div className="min-w-[210px]"><span className="field-label">Service fixe</span><span className="flex h-9 items-center rounded-lg border border-[#dce8db] bg-[#f5faf2] px-3 text-[10px] font-bold text-[#4d8f52]">{entry.mode === 'jour' ? 'Jour uniquement' : 'Nuit uniquement'}</span></div>}</td><td><span className={`rounded-full px-2 py-1 text-[9px] font-bold ${thisShift === 'nuit' ? 'bg-[#eae7f8] text-[#74629b]' : 'bg-[#fff2e2] text-[#bd7737]'}`}>{thisShift === 'nuit' ? 'Nuit' : thisShift === 'jour' ? 'Jour' : 'Non défini'}</span></td><td><span className={`rounded-full px-2 py-1 text-[9px] font-bold ${nextShift === 'nuit' ? 'bg-[#eae7f8] text-[#74629b]' : 'bg-[#fff2e2] text-[#bd7737]'}`}>{nextShift === 'nuit' ? 'Nuit' : nextShift === 'jour' ? 'Jour' : 'Non défini'}</span></td></tr>; }) : <tr><td colSpan={7} className="px-6 py-14 text-center text-[11px] text-[#89968f]">Aucun compte ou employé disponible. Créez d’abord un utilisateur ou une fiche RH.</td></tr>}</tbody></table></div></div>;
}

function instanceTimingLabel(task: DailyTaskInstance) {
  if (task.scheduleMode === 'libre') return `À tout moment · passage n°${task.executionNumber ?? 1}`;
  if (task.scheduleMode === 'recurrence') return `Toutes les ${task.recurrenceMinutes ?? 60} min`;
  return task.startTime ? `${task.startTime}–${plannedEndTime(task)}` : 'Horaire non défini';
}

function LiveShiftBlock({ label, tasks }: { label: string; tasks: DailyTaskInstance[] }) { return <div><div className="flex items-center gap-2 bg-[#fbfcfa] px-5 py-3 sm:px-6"><Clock3 size={13} className="text-[#87958d}" /><strong className="text-[10px] uppercase tracking-[.12em] text-[#718078]">{label}</strong></div>{tasks.length ? tasks.sort((a, b) => a.startTime.localeCompare(b.startTime)).map((task) => <div key={task.id} className="flex flex-col gap-2 px-5 py-4 sm:flex-row sm:items-center sm:px-6"><span className="w-40 text-[12px] font-black text-ink">{instanceTimingLabel(task)}</span><span className="min-w-0 flex-1"><strong className="block text-[11px] text-ink">{task.title}</strong><small className="text-[10px] text-[#89968f]">{operatingUnits.find((unit) => unit.id === task.unitId)?.shortLabel} · {task.assignedEmployeeName || task.assignedRole || 'Poste non assigné'}{task.startedAt ? ` · démarrée à ${new Date(task.startedAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}` : ''}</small></span><TaskStatus task={task} /></div>) : <p className="px-6 py-5 text-[10px] text-[#a0aaa4]">Aucune tâche dans ce service.</p>}</div>; }
function ValidationRow({ task, onAction }: { task: DailyTaskInstance; onAction: (action: 'gain' | 'perte' | 'reject') => void }) { return <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:px-6"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#fff2e2] text-[#bd7737]"><Clock3 size={17} /></span><div className="min-w-0 flex-1"><strong className="block text-[12px] text-ink">{task.title} · {task.assignedEmployeeName || task.assignedRole}</strong><p className="mt-1 text-[10px] leading-5 text-[#87958d]">{operatingUnits.find((unit) => unit.id === task.unitId)?.label} · {instanceTimingLabel(task)} · réel : {task.startedAt ? new Date(task.startedAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '—'} → {task.completedAt ? new Date(task.completedAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '—'} · {task.actualDurationMinutes} min</p><p className="mt-1 text-[10px] text-[#66766d]">{task.comment || 'Aucun commentaire'}</p></div><div className="flex flex-wrap items-center gap-1"><span className={`rounded-full px-2 py-1 text-[9px] font-bold ${task.completion === 'À temps' ? 'bg-[#edf8e9] text-[#5b9d5b]' : 'bg-[#fdeceb] text-[#bd5c5c]'}`}>{task.completion === 'À temps' ? `+${task.bonusAmount} FCFA` : `-${task.penaltyAmount} FCFA`}</span><button className="btn-primary px-2.5 py-1.5 text-[10px]" onClick={() => onAction(task.completion === 'À temps' ? 'gain' : 'perte')}>{task.completion === 'À temps' ? 'Valider gain' : 'Valider perte'}</button><button className="btn-secondary px-2.5 py-1.5 text-[10px]" onClick={() => onAction('reject')}>Rejeter</button></div></div>; }

function TaskStatus({ task }: { task: DailyTaskInstance }) { const label = task.status === 'En cours' ? 'En cours' : task.status === 'Terminée' ? task.validationStatus : task.status; const className = task.status === 'Terminée' && task.completion === 'À temps' ? 'bg-[#edf8e9] text-[#5b9d5b]' : task.status === 'Terminée' ? 'bg-[#fdeceb] text-[#bd5c5c]' : task.status === 'En cours' ? 'bg-[#fff2e2] text-[#bd7737]' : 'bg-[#f1f5ef] text-[#66766d]'; return <span className={`rounded-full px-2.5 py-1 text-[9px] font-bold ${className}`}>{label}</span>; }
