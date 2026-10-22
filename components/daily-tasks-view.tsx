'use client';

import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import autoTable from 'jspdf-autotable';
import jsPDF from 'jspdf';
import { AlertTriangle, CalendarDays, Check, ClipboardCheck, Clock3, Download, HeartPulse, Lock, MessageSquare, Play, ShieldCheck, Square, TimerReset } from 'lucide-react';
import { FARM_STORAGE_KEYS, readLocal, subscribeToFarmData, writeLocal } from '@/lib/farm-storage';
import { units } from '@/lib/data';
import { DEFAULT_HR_SETTINGS, type HRSettings } from '@/components/hr-settings-view';
import { mergeTaskEmployees, type AccessDirectoryUser, type HRDirectoryEmployee } from '@/lib/hr-directory';
import { loadFarmSnapshot, poultryBandPhase } from '@/lib/farm-calculations';
import { Modal, SectionHeading, StatCard } from '@/components/ui';
import { activePoultryCategoryAssignment, closeDailyInstances, completeDailyTask, currentServiceDate, currentShiftAt, DAILY_TASK_COMPLETION_GRACE_MINUTES, ensureDailyInstances, ensurePoultryLifecycleInstances, ensurePoultryRemuageTaskTemplates, filterDeletedTaskTemplates, isTaskDayClosed, isTaskDayStarted, plannedEndTime, poultryTaskPhase, shiftForEmployee, startTimingFor, taskCompletionGraceActive, taskIsLate, taskScheduledStartAt, taskMinutesLate, todayIso, type DailyTaskEmployee, type DailyTaskInstance, type DailyTaskRosterEntry, type DailyTaskSettings, type PoultryCategoryAssignment, type DailyTaskTemplate, type DailyTaskUnitId } from '@/lib/daily-tasks';
import { linkPoultryPendingTaskInstances, linkPoultryTaskTemplates, type PoultryProtocol } from '@/lib/poultry-protocols';
import { PoultryServiceHandoverView } from '@/components/poultry-service-handover-view';
import { handoverHasStarted, type PoultryHandoverRecord, type PoultryHandoverStart } from '@/lib/poultry-handovers';
import { syncPoultryDailyFollowUps } from '@/lib/poultry-daily-automation';
import { consumePoultryBuildingFeed } from '@/lib/poultry-feed-stock';
import { syncPoultryHealthCalendar } from '@/lib/poultry-health-calendar';
import { urgentPoultrySanitaryCheck, type DroppingsColor, type DroppingsTexture, type PoultryGeneralStateQuestionnaire, type PoultrySanitaryCheck, type RespiratoryType, type SanitaryAnswer } from '@/lib/poultry-sanitary';
import { addPdfFooter, addPdfLetterhead } from '@/lib/pdf-letterhead';
import type { ServiceReport } from '@/lib/service-reports';

type RecurrenceDisplaySummary = { totalCount: number; completedCount: number; lateCount: number; pendingCount: number; nextTask?: DailyTaskInstance; alertTask?: DailyTaskInstance };
type TaskDisplay = { task: DailyTaskInstance; recurrence?: RecurrenceDisplaySummary };

export function DailyTasksView({ unitId }: { unitId: DailyTaskUnitId }) {
  const [instances, setInstances] = useState<DailyTaskInstance[]>([]);
  const [templates, setTemplates] = useState<DailyTaskTemplate[]>([]);
  const [roster, setRoster] = useState<DailyTaskRosterEntry[]>([]);
  const [categoryAssignments, setCategoryAssignments] = useState<PoultryCategoryAssignment[]>([]);
  const [handoverStarts, setHandoverStarts] = useState<PoultryHandoverStart[]>([]);
  const [handovers, setHandovers] = useState<PoultryHandoverRecord[]>([]);
  const [taskEmployees, setTaskEmployees] = useState<DailyTaskEmployee[]>([]);
  const [settings, setSettings] = useState<DailyTaskSettings>({ taskBonusAmount: 1000, taskPenaltyAmount: 500, taskWorkdayStart: '07:30', taskWorkdayEnd: '17:30', dayShiftStart: '07:30', dayShiftEnd: '17:30', nightShiftStart: '17:30', nightShiftEnd: '07:30', taskGapMinutes: 10 });
  const [finishTask, setFinishTask] = useState<DailyTaskInstance | null>(null);
  const executionFormRef = useRef<HTMLFormElement | null>(null);
  const taskAlertEventsRef = useRef(new Set<string>());
  const [feedback, setFeedback] = useState('');
  const [sessionName, setSessionName] = useState('Responsable');
  const [currentUserId, setCurrentUserId] = useState('');
  const [sessionAdmin, setSessionAdmin] = useState(false);
  const [assignedBuildings, setAssignedBuildings] = useState<string[] | null>(null);
  const [poultryPhaseByBuilding, setPoultryPhaseByBuilding] = useState<Record<string, string>>({});
  const [clockTick, setClockTick] = useState(() => Date.now());
  const [exporting, setExporting] = useState(false);
  const [generatedReport, setGeneratedReport] = useState<ServiceReport | null>(null);

  const today = todayIso();

  useEffect(() => {
    const nameCookie = document.cookie.split('; ').find((part) => part.startsWith('agroflux_user_name='));
    const idCookie = document.cookie.split('; ').find((part) => part.startsWith('agroflux_user_id='));
    if (nameCookie) setSessionName(decodeURIComponent(nameCookie.slice('agroflux_user_name='.length)));
    if (idCookie) setCurrentUserId(decodeURIComponent(idCookie.slice('agroflux_user_id='.length)));
    const adminCookie = document.cookie.split('; ').find((part) => part.startsWith('agroflux_is_admin='));
    const isAdmin = adminCookie?.endsWith('=1') === true;
    setSessionAdmin(isAdmin);
    const buildingCookie = document.cookie.split('; ').find((part) => part.startsWith('agroflux_assigned_buildings='));
    if (isAdmin) setAssignedBuildings(null);
    else {
      try { setAssignedBuildings(JSON.parse(buildingCookie ? decodeURIComponent(buildingCookie.slice('agroflux_assigned_buildings='.length)) : '[]')); } catch { setAssignedBuildings([]); }
    }
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setClockTick(Date.now()), 30000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    let disposed = false;
    const refresh = () => {
      const rawTemplates = readLocal<DailyTaskTemplate[]>(FARM_STORAGE_KEYS.dailyTaskTemplates, []);
      const deletedTemplateIds = readLocal<string[]>(FARM_STORAGE_KEYS.dailyTaskDeletedTemplates, []);
      const protocols = readLocal<PoultryProtocol[]>(FARM_STORAGE_KEYS.poultryProtocols, []);
      const poultrySnapshot = unitId === 'poulets' ? loadFarmSnapshot() : null;
      const templateSource = unitId === 'poulets' && poultrySnapshot ? ensurePoultryRemuageTaskTemplates(poultrySnapshot.buildings, rawTemplates, deletedTemplateIds) : rawTemplates;
      const nextTemplates = filterDeletedTaskTemplates(linkPoultryTaskTemplates(templateSource, protocols), deletedTemplateIds);
      if (JSON.stringify(rawTemplates) !== JSON.stringify(nextTemplates)) writeLocal(FARM_STORAGE_KEYS.dailyTaskTemplates, nextTemplates);
      const nextRoster = readLocal<DailyTaskRosterEntry[]>(FARM_STORAGE_KEYS.dailyTaskRoster, []);
      const nextCategoryAssignments = readLocal<PoultryCategoryAssignment[]>(FARM_STORAGE_KEYS.poultryCategoryAssignments, []);
      const nextHandoverStarts = readLocal<PoultryHandoverStart[]>(FARM_STORAGE_KEYS.poultryHandoverStarts, []);
      const nextHandovers = readLocal<PoultryHandoverRecord[]>(FARM_STORAGE_KEYS.poultryHandovers, []);
      const hrSettings = { ...DEFAULT_HR_SETTINGS, ...readLocal<Partial<HRSettings>>(FARM_STORAGE_KEYS.rhSettings, {}) };
      const nextSettings: DailyTaskSettings = { taskBonusAmount: hrSettings.taskBonusAmount, taskPenaltyAmount: hrSettings.taskPenaltyAmount, taskWorkdayStart: hrSettings.taskWorkdayStart, taskWorkdayEnd: hrSettings.taskWorkdayEnd, dayShiftStart: hrSettings.dayShiftStart, dayShiftEnd: hrSettings.dayShiftEnd, nightShiftStart: hrSettings.nightShiftStart, nightShiftEnd: hrSettings.nightShiftEnd, taskGapMinutes: hrSettings.taskGapMinutes };
      const rhEmployees = readLocal<HRDirectoryEmployee[]>(FARM_STORAGE_KEYS.rhEmployees, []);
      const accessUsers = readLocal<AccessDirectoryUser[]>(FARM_STORAGE_KEYS.users, []);
      const nextEmployees = mergeTaskEmployees(rhEmployees, accessUsers);
      let poultryContexts: Array<{ buildingId: string; buildingName: string; batchId: string; startDate: string }> = [];
      if (unitId === 'poulets' && poultrySnapshot) {
        const snapshot = poultrySnapshot;
        setPoultryPhaseByBuilding(Object.fromEntries(snapshot.buildings.map((building) => {
          const lot = snapshot.lots.find((item) => item.id === building.batch);
          return [building.id, lot ? poultryBandPhase(lot.start) === 'Poussinière' ? 'poussiniere' : 'croissance-finition' : ''];
        })));
        poultryContexts = snapshot.buildings.filter((building) => building.status === 'Occupé' && building.batch && building.batch !== '—').map((building) => {
          const lot = snapshot.lots.find((item) => item.id === building.batch);
          return lot ? { buildingId: building.id, buildingName: building.name, batchId: building.batch, startDate: lot.start } : null;
        }).filter((context): context is { buildingId: string; buildingName: string; batchId: string; startDate: string } => context !== null);
      } else setPoultryPhaseByBuilding({});
      const storedPrevious = readLocal<DailyTaskInstance[]>(FARM_STORAGE_KEYS.dailyTaskInstances, []);
      const previous = linkPoultryPendingTaskInstances(storedPrevious, protocols);
      const nightDate = currentServiceDate('nuit', new Date(), nextSettings);
      let next = ensureDailyInstances(today, unitId, nextTemplates, previous, nextEmployees, nextSettings, nextRoster);
      if (nightDate !== today) next = ensureDailyInstances(nightDate, unitId, nextTemplates, next, nextEmployees, nextSettings, nextRoster);
      if (unitId === 'poulets') {
        next = ensurePoultryLifecycleInstances(today, nextTemplates, next, poultryContexts, nextEmployees);
        if (nightDate !== today) next = ensurePoultryLifecycleInstances(nightDate, nextTemplates, next, poultryContexts, nextEmployees);
      }
      next = closeDailyInstances(today, next, new Date(), nextSettings);
      if (nightDate !== today) next = closeDailyInstances(nightDate, next, new Date(), nextSettings);
      if (JSON.stringify(storedPrevious) !== JSON.stringify(next)) writeLocal(FARM_STORAGE_KEYS.dailyTaskInstances, next);
      if (disposed) return;
      setTemplates(nextTemplates);
      setRoster(nextRoster);
      setCategoryAssignments(nextCategoryAssignments);
      setHandoverStarts(nextHandoverStarts);
      setHandovers(nextHandovers);
      setTaskEmployees(nextEmployees);
      setSettings(nextSettings);
      setInstances(next);
    };
    refresh();
    const timer = window.setInterval(refresh, 30000);
    const unsubscribe = subscribeToFarmData([FARM_STORAGE_KEYS.dailyTaskTemplates, FARM_STORAGE_KEYS.dailyTaskDeletedTemplates, FARM_STORAGE_KEYS.poultryProtocols, FARM_STORAGE_KEYS.dailyTaskRoster, FARM_STORAGE_KEYS.poultryCategoryAssignments, FARM_STORAGE_KEYS.poultryHandovers, FARM_STORAGE_KEYS.poultryHandoverStarts, FARM_STORAGE_KEYS.dailyTaskInstances, FARM_STORAGE_KEYS.rhEmployees, FARM_STORAGE_KEYS.rhSettings, FARM_STORAGE_KEYS.users], refresh);
    return () => { disposed = true; window.clearInterval(timer); unsubscribe(); };
  }, [today, unitId]);

  const nightDate = currentServiceDate('nuit', new Date(), settings);
  const tasks = useMemo(() => instances.filter((task) => {
    const rightServiceDate = (task.shift ?? 'jour') === 'jour' ? task.date === today : task.date === nightDate;
    const lifecycleVisible = task.lifecycleTask ? task.date <= today && task.status !== 'Terminée' : rightServiceDate;
    const activeTemplate = templates.find((template) => template.id === task.templateId);
    const active = activeTemplate ? (activeTemplate.active || ['Terminée', 'Non faite'].includes(task.status)) : ['Terminée', 'Non faite'].includes(task.status);
    const rightPhase = unitId !== 'poulets' || !task.poultryPhase || !task.assignedBuildingId || !poultryPhaseByBuilding[task.assignedBuildingId] || poultryPhaseByBuilding[task.assignedBuildingId] === task.poultryPhase;
    return task.unitId === unitId && lifecycleVisible && active && rightPhase;
  }).sort((a, b) => (a.shift ?? 'jour').localeCompare(b.shift ?? 'jour') || a.startTime.localeCompare(b.startTime)), [instances, templates, today, nightDate, unitId, poultryPhaseByBuilding]);
  const currentEmployeeIds = useMemo(() => {
    const ids = new Set<string>();
    if (currentUserId) {
      ids.add(currentUserId);
      taskEmployees.filter((employee) => employee.id === currentUserId || employee.linkedUserId === currentUserId || employee.sourceEmployeeId === currentUserId).forEach((employee) => { ids.add(employee.id); if (employee.sourceEmployeeId) ids.add(employee.sourceEmployeeId); });
    }
    return ids;
  }, [currentUserId, taskEmployees]);
  const currentTime = useMemo(() => new Date(clockTick), [clockTick]);
  const currentCategoryAssignment = useMemo(() => sessionAdmin || unitId !== 'poulets' ? undefined : activePoultryCategoryAssignment(categoryAssignments, Array.from(currentEmployeeIds), new Date(clockTick)), [sessionAdmin, unitId, categoryAssignments, currentEmployeeIds, clockTick]);
  const currentRosterEntry = useMemo(() => sessionAdmin ? undefined : roster.find((entry) => entry.unitId === unitId && currentEmployeeIds.has(entry.employeeId)), [sessionAdmin, roster, unitId, currentEmployeeIds]);
  const visibleTasks = useMemo(() => tasks.filter((task) => {
    const effectiveTaskDate = task.lifecycleTask && task.dueDate ? task.dueDate : task.date;
    const assignedShift = currentRosterEntry ? shiftForEmployee(currentRosterEntry.employeeId, effectiveTaskDate, roster, unitId) : undefined;
    const buildingVisible = !task.assignedBuildingId || assignedBuildings === null || !assignedBuildings?.length || assignedBuildings.includes(task.assignedBuildingId);
    const taskPhase = poultryTaskPhase(task);
    const categoryVisible = unitId !== 'poulets' || sessionAdmin || Boolean(currentCategoryAssignment && taskPhase === currentCategoryAssignment.poultryPhase);
    return buildingVisible && categoryVisible && (!currentRosterEntry || assignedShift === (task.shift ?? 'jour'));
  }), [tasks, currentRosterEntry, roster, unitId, assignedBuildings, sessionAdmin, currentCategoryAssignment]);
  const personalTasks = useMemo(() => visibleTasks.filter((task) => {
    const performedByCurrent = (task.startedById ? currentEmployeeIds.has(task.startedById) : false) || (task.completedById ? currentEmployeeIds.has(task.completedById) : false);
    const explicitlyAssigned = Boolean(task.assignedEmployeeId && currentEmployeeIds.has(task.assignedEmployeeId));
    return performedByCurrent || explicitlyAssigned;
  }), [visibleTasks, currentEmployeeIds]);
  const dayTasks = visibleTasks.filter((task) => (task.shift ?? 'jour') === 'jour');
  const nightTasks = visibleTasks.filter((task) => (task.shift ?? 'jour') === 'nuit');
  const dayTaskDisplays = useMemo(() => groupTaskDisplays(dayTasks, settings, currentTime), [dayTasks, settings, currentTime]);
  const nightTaskDisplays = useMemo(() => groupTaskDisplays(nightTasks, settings, currentTime), [nightTasks, settings, currentTime]);
  const displayedTaskItems = useMemo(() => [...dayTaskDisplays, ...nightTaskDisplays], [dayTaskDisplays, nightTaskDisplays]);
  const lifecyclePreparationTasks = useMemo(() => unitId === 'poulets' ? displayedTaskItems.filter(({ task }) => task.lifecycleTask && task.noticeDate === today && task.status === 'À faire') : [], [displayedTaskItems, today, unitId]);
  const lifecycleOverdueTasks = useMemo(() => unitId === 'poulets' ? displayedTaskItems.filter(({ task }) => task.lifecycleTask && task.dueDate && today > task.dueDate && !['Terminée', 'Non faite'].includes(task.status)) : [], [displayedTaskItems, today, unitId]);
  const dayServiceVisible = !currentRosterEntry || shiftForEmployee(currentRosterEntry.employeeId, today, roster, unitId) === 'jour';
  const nightServiceVisible = !currentRosterEntry || shiftForEmployee(currentRosterEntry.employeeId, nightDate, roster, unitId) === 'nuit';
  const handoverStartedForTask = (task: DailyTaskInstance) => {
    if (unitId !== 'poulets' || sessionAdmin || !task.assignedBuildingId || !currentUserId) return true;
    const effectiveTaskDate = task.lifecycleTask && task.dueDate ? task.dueDate : task.date;
    return handoverHasStarted(handoverStarts, handovers, task.assignedBuildingId, effectiveTaskDate, task.shift ?? 'jour', currentUserId);
  };
  const canActOnTask = (task: DailyTaskInstance) => { 
    const assignedToCurrent = !task.assignedEmployeeId || currentEmployeeIds.has(task.assignedEmployeeId);
    const effectiveTaskDate = task.lifecycleTask && task.dueDate ? task.dueDate : task.date;
    const currentShift = currentRosterEntry ? shiftForEmployee(currentRosterEntry.employeeId, effectiveTaskDate, roster, unitId) : undefined;
    const taskPhase = poultryTaskPhase(task);
    const categoryAllowed = unitId !== 'poulets' || sessionAdmin || Boolean(currentCategoryAssignment && taskPhase === currentCategoryAssignment.poultryPhase);
    return assignedToCurrent && categoryAllowed && handoverStartedForTask(task) && (!currentRosterEntry || currentShift === (task.shift ?? 'jour'));
  };
  const completed = displayedTaskItems.filter(({ task }) => task.status === 'Terminée').length;
  const todo = displayedTaskItems.filter(({ task }) => task.status === 'À faire').length;
  const inProgress = displayedTaskItems.filter(({ task }) => task.status === 'En cours').length;
  const clockShift = currentShiftAt(currentTime, settings);
  const rosterServiceDate = clockShift === 'nuit' ? nightDate : today;
  const operationalShift = currentRosterEntry ? shiftForEmployee(currentRosterEntry.employeeId, rosterServiceDate, roster, unitId) ?? clockShift : clockShift;
  const operationalServiceDate = operationalShift === 'nuit' ? currentServiceDate('nuit', currentTime, settings) : today;
  const lateTasks = displayedTaskItems.filter(({ task }) => taskIsLate(task, currentTime, settings));
  const dayClosed = isTaskDayClosed(today, new Date(), settings, 'jour');
  const nightClosed = isTaskDayClosed(nightDate, new Date(), settings, 'nuit');
  const closed = dayClosed && nightClosed;

  useEffect(() => {
    const now = currentTime.getTime();
    const playAlert = () => {
      try {
        const sound = new Audio('/sounds/notification.wav');
        sound.volume = 0.35;
        void sound.play().catch(() => undefined);
      } catch {
        // Le navigateur peut bloquer le son avant une interaction utilisateur.
      }
    };
    lifecyclePreparationTasks.forEach(({ task }) => {
      const preparationEvent = `${task.id}:preparation-24h`;
      if (!taskAlertEventsRef.current.has(preparationEvent)) {
        taskAlertEventsRef.current.add(preparationEvent);
        playAlert();
      }
    });
    displayedTaskItems.forEach(({ task, recurrence }) => {
      const pendingTask = recurrence?.alertTask ?? recurrence?.nextTask ?? task;
      if (!pendingTask.startTime || pendingTask.scheduleMode === 'libre' || pendingTask.status !== 'À faire') return;
      const dueAt = taskScheduledStartAt(pendingTask, settings).getTime();
      if (!Number.isFinite(dueAt)) return;
      const dueEvent = `${pendingTask.id}:heure`;
      const lateEvent = `${pendingTask.id}:retard-10`;
      if (now >= dueAt && !taskAlertEventsRef.current.has(dueEvent)) {
        taskAlertEventsRef.current.add(dueEvent);
        playAlert();
      }
      if (now >= dueAt + 10 * 60000 && !taskAlertEventsRef.current.has(lateEvent)) {
        taskAlertEventsRef.current.add(lateEvent);
        playAlert();
      }
    });
  }, [currentTime, displayedTaskItems, lifecyclePreparationTasks, settings]);

  function notify(message: string) { setFeedback(message); window.setTimeout(() => setFeedback(''), 4200); }

  function buildServiceReport(tasksForExport: DailyTaskInstance[], personalHandovers: PoultryHandoverRecord[]): ServiceReport {
    const buildingMap = new Map<string, string>();
    tasksForExport.forEach((task) => { const id = task.assignedBuildingId || task.assignedBuildingName || ''; if (id) buildingMap.set(id, task.assignedBuildingName || id); });
    personalHandovers.forEach((handover) => buildingMap.set(handover.buildingId, handover.buildingName));
    const buildingIds = Array.from(buildingMap.keys());
    const buildingNames = Array.from(buildingMap.values()).filter(Boolean);
    const tasks = tasksForExport.map((task) => ({ id: task.id, title: task.title, buildingId: task.assignedBuildingId, buildingName: task.assignedBuildingName, poultryPhase: task.poultryPhase, shift: task.shift, status: task.status, completion: task.completion, startedAt: task.startedAt, completedAt: task.completedAt, startedByName: task.startedByName, completedByName: task.completedByName, actualDurationMinutes: task.actualDurationMinutes, comment: task.comment, protocol: task.protocol, protocolChecks: task.protocolChecks, waterQuantityLiters: task.waterQuantityLiters, feedQuantityKg: task.feedQuantityKg, temperatureC: task.temperatureC, humidityPercent: task.humidityPercent, generalStateQuestionnaire: task.generalStateQuestionnaire }));
    return { id: `SERVICE-${operationalServiceDate}-${operationalShift}-${safeDownloadPart(currentUserId || sessionName)}`, unitId: unitId as ServiceReport['unitId'], serviceDate: operationalServiceDate, shift: operationalShift, responsibleId: currentUserId || sessionName, responsibleName: sessionName, buildingIds, buildingNames, poultryPhases: Array.from(new Set(tasksForExport.map((task) => task.poultryPhase).filter((phase): phase is NonNullable<typeof phase> => Boolean(phase)))), generatedAt: new Date().toISOString(), submittedAt: '', status: 'Non lu', tasks, handovers: personalHandovers, summary: { taskCount: tasksForExport.length, completedTaskCount: tasksForExport.filter((task) => task.status === 'Terminée').length, lateTaskCount: tasksForExport.filter((task) => task.completion === 'En retard' || task.status === 'Non faite').length, waterLiters: tasksForExport.reduce((sum, task) => sum + (Number(task.waterQuantityLiters) || 0), 0), feedKg: tasksForExport.reduce((sum, task) => sum + (Number(task.feedQuantityKg) || 0), 0), deathsFound: personalHandovers.reduce((sum, handover) => sum + handover.deathsFoundQuantity, 0) } };
  }

  async function exportTaskHistory() {
    const tasksForExport = [...personalTasks].sort((first, second) => (first.shift ?? 'jour').localeCompare(second.shift ?? 'jour') || first.startTime.localeCompare(second.startTime));
    const handovers = unitId === 'poulets' ? readLocal<PoultryHandoverRecord[]>(FARM_STORAGE_KEYS.poultryHandovers, []) : [];
    const personalHandovers = handovers.filter((handover) => {
      const incomingMatch = (currentEmployeeIds.has(handover.incomingResponsibleId) || handover.incomingResponsibleName === sessionName) && handover.serviceDate === operationalServiceDate && handover.incomingShift === operationalShift;
      const outgoingMatch = (currentEmployeeIds.has(handover.outgoingResponsibleId) || handover.outgoingResponsibleName === sessionName) && handover.outgoingServiceDate === operationalServiceDate && handover.outgoingShift === operationalShift;
      return incomingMatch || outgoingMatch;
    });
    if (!tasksForExport.length && !personalHandovers.length) {
      notify('Aucune tâche ni transmission personnelle à exporter pour ce service.');
      return;
    }
    setExporting(true);
    let submittedToRH = false;
    try {
      const report = buildServiceReport(tasksForExport, personalHandovers);
      const localReports = readLocal<ServiceReport[]>(FARM_STORAGE_KEYS.serviceReports, []);
      writeLocal(FARM_STORAGE_KEYS.serviceReports, [report, ...localReports.filter((item) => item.id !== report.id)]);
      setGeneratedReport(report);
      try {
        const response = await fetch('/api/rh/service-reports', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(report) });
        if (response.ok) {
          const data = await response.json() as { report?: ServiceReport };
          if (data.report) {
            submittedToRH = true;
            setGeneratedReport(data.report);
            writeLocal(FARM_STORAGE_KEYS.serviceReports, [data.report, ...localReports.filter((item) => item.id !== data.report?.id)]);
          }
        }
      } catch {
        // Le rapport local reste lisible ; l’interface informe si l’envoi serveur échoue.
      }
      const doc = new jsPDF({ unit: 'mm', format: 'a4' });
      const completedTasks = tasksForExport.filter((task) => task.status === 'Terminée').length;
      const lateTasksCount = tasksForExport.filter((task) => task.completion === 'En retard' || task.status === 'Non faite').length;
      const waterTotal = tasksForExport.reduce((sum, task) => sum + (Number(task.waterQuantityLiters) || 0), 0);
      const feedTotal = tasksForExport.reduce((sum, task) => sum + (Number(task.feedQuantityKg) || 0), 0);
      const deathTotal = personalHandovers.reduce((sum, handover) => sum + handover.deathsFoundQuantity, 0);
      const start = await addPdfLetterhead(doc, {
        title: 'Rapport personnel de service',
        reference: `SERVICE-${operationalServiceDate}-${safeDownloadPart(currentUserId || sessionName).toUpperCase()}`,
        context: [`Responsable : ${sessionName}`, `Service : ${operationalShift === 'nuit' ? 'nuit' : 'jour'}`, `Bâtiment(s) : ${Array.from(new Set(tasksForExport.map((task) => task.assignedBuildingName).filter(Boolean))).join(' · ') || personalHandovers.map((handover) => handover.buildingName).filter((name, index, list) => list.indexOf(name) === index).join(' · ') || '—'}`, `${tasksForExport.length} tâche(s) · ${completedTasks} terminée(s)`],
      });
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(25, 56, 46);
      doc.text('Synthèse personnelle du service', 14, start);
      autoTable(doc, {
        startY: start + 5,
        head: [['Tâches suivies', 'Terminées', 'En cours / à faire', 'En retard / non faites', 'Eau saisie', 'Aliment saisi', 'Morts trouvés à la passation']],
        body: [[`${tasksForExport.length}`, `${completedTasks}`, `${tasksForExport.length - completedTasks}`, `${lateTasksCount}`, `${formatPdfNumber(waterTotal)} L`, `${formatPdfNumber(feedTotal)} kg`, `${deathTotal}`]],
        theme: 'grid',
        styles: { fontSize: 7.5, cellPadding: 2.5, halign: 'center', valign: 'middle' },
        headStyles: { fillColor: [25, 56, 46], textColor: 255, fontStyle: 'bold' },
        bodyStyles: { textColor: [29, 46, 39], fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [245, 250, 242] },
        margin: { left: 14, right: 14 },
      });
      const summaryEnd = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? start + 20;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(25, 56, 46);
      doc.text('Détail de ce que j’ai réalisé', 14, summaryEnd + 12);
      autoTable(doc, {
        startY: summaryEnd + 17,
        head: [['Réf.', 'Service / bâtiment', 'Tâche', 'Horaire prévu', 'Début réel → fin réelle', 'Détails opérationnels']],
        body: tasksForExport.map((task, index) => [
          `${index + 1}\n${task.id}`,
          `${task.shift === 'nuit' ? 'Nuit' : 'Jour'}${task.assignedBuildingName ? `\n${task.assignedBuildingName}` : ''}${task.poultryPhase ? `\n${task.poultryPhase === 'poussiniere' ? 'Poussinière' : 'Croissance et finition'}` : ''}`,
          task.title,
          `${taskScheduleLabel(task)}${task.dueDate ? `\nÉchéance : ${task.dueDate}` : ''}`,
          `${formatTaskTimestamp(task.startedAt) || 'Non démarrée'} → ${formatTaskTimestamp(task.completedAt) || 'Non terminée'}`,
          pdfTaskDetails(task),
        ]),
        theme: 'grid',
        styles: { fontSize: 6.6, cellPadding: 2.2, overflow: 'linebreak', valign: 'top', lineColor: [220, 230, 220], lineWidth: 0.25 },
        headStyles: { fillColor: [91, 157, 91], textColor: 255, fontSize: 7, fontStyle: 'bold', valign: 'middle' },
        bodyStyles: { textColor: [42, 59, 49] },
        alternateRowStyles: { fillColor: [249, 252, 248] },
        columnStyles: { 0: { cellWidth: 22 }, 1: { cellWidth: 28 }, 2: { cellWidth: 43 }, 3: { cellWidth: 25 }, 4: { cellWidth: 32 }, 5: { cellWidth: 32 } },
        margin: { left: 14, right: 14, bottom: 22 },
        didParseCell: (data) => { if (data.section === 'body' && data.column.index === 5 && String(data.cell.raw).includes('État : Terminée')) data.cell.styles.textColor = [46, 116, 58]; },
      });
      const taskEnd = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? summaryEnd + 25;
      if (personalHandovers.length) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.setTextColor(25, 56, 46);
        doc.text('Transmission validée par moi', 14, taskEnd + 12);
        autoTable(doc, {
          startY: taskEnd + 17,
          head: [['Bâtiment', 'Service précédent', 'Morts trouvés', 'Contrôles', 'Sacs aliment', 'Observation']],
          body: personalHandovers.map((handover) => [`${handover.buildingName}\n${handover.batchId || '—'}`, `${handover.outgoingShift === 'nuit' ? 'Nuit' : 'Jour'} · ${handover.outgoingResponsibleName}`, `${handover.deathsFoundQuantity} (grande salle : ${handover.deathsMainRoomQuantity}, clinique : ${handover.deathsClinicQuantity})\nFrais : ${handover.deathsFreshQuantity} · décomposés : ${handover.deathsDecomposedQuantity}`, `Abreuvoirs : ${handover.waterersWashed}\nFûts : ${handover.waterDrumsFilled}\nMatériel : ${handover.equipmentStored}\nSalle : ${handover.roomClean}\nPédiluve : ${handover.footbathReady}`, `${handover.feedBagsFound}`, handover.comment || handover.deathsObservation || '—']),
          theme: 'grid',
          styles: { fontSize: 6.8, cellPadding: 2.5, overflow: 'linebreak', valign: 'top' },
          headStyles: { fillColor: [189, 119, 55], textColor: 255, fontSize: 7, fontStyle: 'bold' },
          bodyStyles: { textColor: [66, 59, 42] },
          alternateRowStyles: { fillColor: [255, 250, 242] },
          columnStyles: { 0: { cellWidth: 27 }, 1: { cellWidth: 30 }, 2: { cellWidth: 35 }, 3: { cellWidth: 35 }, 4: { cellWidth: 17 }, 5: { cellWidth: 26 } },
          margin: { left: 14, right: 14, bottom: 22 },
        });
      }
      addPdfFooter(doc, 'Rapport personnel de service · AgroFlux · SCOOPS LE REVEIL');
      doc.save(`rapport-service-${operationalServiceDate}-${safeDownloadPart(currentUserId || sessionName)}.pdf`);
      notify(submittedToRH ? `Le rapport a été envoyé à RH et le PDF a été téléchargé (${tasksForExport.length} tâche(s), ${personalHandovers.length} transmission(s)).` : `Le rapport est lisible dans AgroFlux et le PDF a été téléchargé, mais l’envoi serveur à RH est indisponible.`);
    } catch {
      notify('Impossible de générer le rapport PDF personnel du service.');
    } finally {
      setExporting(false);
    }
  }

  function updateTask(id: string, updater: (task: DailyTaskInstance) => DailyTaskInstance) {
    const all = readLocal<DailyTaskInstance[]>(FARM_STORAGE_KEYS.dailyTaskInstances, []);
    const next = all.map((task) => task.id === id ? updater(task) : task);
    setInstances(next);
    writeLocal(FARM_STORAGE_KEYS.dailyTaskInstances, next);
  }

  function sendGeneralStateToRH(task: DailyTaskInstance, questionnaire: PoultryGeneralStateQuestionnaire, recordedAt: string) {
    const snapshot = loadFarmSnapshot();
    const building = snapshot.buildings.find((item) => item.id === task.assignedBuildingId);
    const buildingId = task.assignedBuildingId || building?.id || task.assignedBuildingName || 'non-affecte';
    const buildingName = task.assignedBuildingName || building?.name || 'Bâtiment non précisé';
    const batchId = building?.batch && building.batch !== '—' ? building.batch : '—';
    const check = urgentPoultrySanitaryCheck({ taskId: task.id, date: task.date, shift: task.shift, buildingId, buildingName, batchId, recordedById: currentUserId || task.assignedEmployeeId || 'unknown', recordedByName: sessionName || task.assignedEmployeeName || task.assignedRole || 'Responsable bâtiment', recordedAt }, questionnaire);
    const existing = readLocal<PoultrySanitaryCheck[]>(FARM_STORAGE_KEYS.sanitaryChecks, []);
    writeLocal(FARM_STORAGE_KEYS.sanitaryChecks, [check, ...existing.filter((item) => item.id !== check.id)]);
  }

  function saveExecutionDraft() {
    if (!finishTask || !executionFormRef.current) return;
    const draft = readTaskExecutionDraft(executionFormRef.current);
    updateTask(finishTask.id, (current) => ({ ...current, ...draft }));
    setFinishTask((current) => current ? { ...current, ...draft } : current);
  }

  function closeExecutionForm() {
    saveExecutionDraft();
    setFinishTask(null);
  }

  function startTask(task: DailyTaskInstance) {
    if (!canActOnTask(task)) { notify('Cette tâche appartient à un autre service ou votre affectation RH n’est pas active maintenant.'); return; }
    const shift = task.shift ?? 'jour';
    const effectiveTaskDate = task.lifecycleTask && task.dueDate ? task.dueDate : task.date;
    const taskClosed = isTaskDayClosed(effectiveTaskDate, new Date(), settings, shift);
    const taskStarted = isTaskDayStarted(effectiveTaskDate, new Date(), settings, shift);
    if (taskClosed) { notify(`Le service ${shift === 'nuit' ? 'nuit' : 'jour'} est terminé : aucune tâche ne peut plus démarrer.`); return; }
    if (!taskStarted) { notify(`Le service ${shift === 'nuit' ? 'nuit' : 'jour'} démarre à ${shift === 'nuit' ? settings.nightShiftStart : settings.dayShiftStart}.`); return; }
    if (task.status !== 'À faire') return;
    const startedAt = new Date().toISOString();
    const startedTask: DailyTaskInstance = { ...task, status: 'En cours', startedAt, startedById: currentUserId || task.assignedEmployeeId || 'unknown', startedByName: sessionName || task.assignedEmployeeName || task.assignedRole, startTiming: startTimingFor(task.startTime, startedAt) };
    updateTask(task.id, () => startedTask);
    if (taskHasExecutionForm(startedTask)) setFinishTask(startedTask);
    notify(taskHasExecutionForm(startedTask) ? `« ${task.title} » est en cours. Le questionnaire est ouvert immédiatement.` : `« ${task.title} » est maintenant en cours.`);
  }

  function finishTaskDirectly(task: DailyTaskInstance) {
    if (task.type !== 'Pause') return;
    if (!canActOnTask(task)) { notify('Cette tâche appartient à un autre service ou votre affectation RH n’est pas active maintenant.'); setFinishTask(null); return; }
    const effectiveTaskDate = task.lifecycleTask && task.dueDate ? task.dueDate : task.date;
    const now = new Date();
    if (isTaskDayClosed(effectiveTaskDate, now, settings, task.shift ?? 'jour') && !taskCompletionGraceActive(task, now, settings)) { notify('Le service est terminé : cette pause ne peut plus être terminée.'); setFinishTask(null); return; }
    if (task.status !== 'En cours') return;
    const completedAt = new Date().toISOString();
    updateTask(task.id, (current) => ({ ...completeDailyTask(current, completedAt, '', settings), completedById: currentUserId || current.startedById || current.assignedEmployeeId || 'unknown', completedByName: sessionName || current.startedByName || current.assignedEmployeeName || current.assignedRole, generalStateQuestionnaireDraft: undefined, generalStateQuestionnaire: undefined }));
    if (unitId === 'poulets') syncPoultryDailyFollowUps();
    setFinishTask(null);
    notify(`« ${task.title} » est terminée. Durée réelle enregistrée : ${Math.max(0, Math.round((new Date(completedAt).getTime() - new Date(task.startedAt).getTime()) / 60000))} minute(s).`);
  }

  function requestFinishTask(task: DailyTaskInstance) {
    if (task.type === 'Pause') {
      finishTaskDirectly(task);
      return;
    }
    setFinishTask(task);
  }

  function finish(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!finishTask) return;
    if (finishTask.type === 'Pause') { finishTaskDirectly(finishTask); return; }
    if (!canActOnTask(finishTask)) { notify('Cette tâche appartient à un autre service ou votre affectation RH n’est pas active maintenant.'); setFinishTask(null); return; }
    const effectiveTaskDate = finishTask.lifecycleTask && finishTask.dueDate ? finishTask.dueDate : finishTask.date;
    const now = new Date();
    if (isTaskDayClosed(effectiveTaskDate, now, settings, finishTask.shift ?? 'jour') && !taskCompletionGraceActive(finishTask, now, settings)) { notify('Le service est terminé : cette tâche ne peut plus être terminée.'); setFinishTask(null); return; }
    const form = new FormData(event.currentTarget);
    const comment = String(form.get('comment') ?? '').trim();
    if (!comment) { notify('Le commentaire est obligatoire avant de terminer la tâche.'); return; }
    const requiredProtocol = finishTask.protocol ?? [];
    const protocolChecks = form.getAll('protocolCheck').map(String);
    if (requiredProtocol.length && protocolChecks.length < requiredProtocol.length) { notify('Cochez toutes les étapes du protocole avant de terminer la tâche.'); return; }
    const waterRequired = finishTask.requiresWaterQuantity === true;
    const feedRequired = finishTask.requiresFeedQuantity === true;
    const temperatureHumidityRequired = finishTask.requiresTemperatureHumidity === true;
    const waterQuantityLiters = Number(form.get('waterQuantityLiters') ?? 0);
    const feedQuantityKg = Number(form.get('feedQuantityKg') ?? 0);
    const temperatureC = Number(form.get('temperatureC') ?? 0);
    const humidityPercent = Number(form.get('humidityPercent') ?? 0);
    if (waterRequired && (!Number.isFinite(waterQuantityLiters) || waterQuantityLiters < 0)) { notify('Indiquez la quantité d’eau donnée à la fin du service.'); return; }
    if (feedRequired && (!Number.isFinite(feedQuantityKg) || feedQuantityKg < 0)) { notify('Indiquez la quantité d’aliment donnée pendant le service.'); return; }
    if (temperatureHumidityRequired && (!Number.isFinite(temperatureC) || temperatureC < 0 || !Number.isFinite(humidityPercent) || humidityPercent < 0 || humidityPercent > 100)) { notify('Indiquez une température et une humidité valides.'); return; }
    const generalStateRequired = finishTask.requiresGeneralStateQuestionnaire === true || finishTask.category === 'etat-general-sujets';
    const generalStateResult = generalStateRequired ? readGeneralStateQuestionnaire(form) : { questionnaire: undefined };
    if (generalStateRequired && !generalStateResult.questionnaire) { notify(generalStateResult.error || 'Complétez le questionnaire de l’état général des sujets.'); return; }
    const generalStateQuestionnaire = generalStateResult.questionnaire;
    const completedAt = new Date().toISOString();
    updateTask(finishTask.id, (current) => ({ ...completeDailyTask(current, completedAt, comment, settings), completedById: currentUserId || current.startedById || current.assignedEmployeeId || 'unknown', completedByName: sessionName || current.startedByName || current.assignedEmployeeName || current.assignedRole, generalStateQuestionnaireDraft: undefined, protocolChecks, waterQuantityLiters: waterRequired ? waterQuantityLiters : undefined, feedQuantityKg: feedRequired ? feedQuantityKg : undefined, temperatureC: temperatureHumidityRequired ? temperatureC : undefined, humidityPercent: temperatureHumidityRequired ? humidityPercent : undefined, generalStateQuestionnaire }));
    if (unitId === 'poulets') {
      syncPoultryDailyFollowUps();
      if (finishTask.lifecycleTask) syncPoultryHealthCalendar();
      if (generalStateQuestionnaire) sendGeneralStateToRH(finishTask, generalStateQuestionnaire, completedAt);
    }
    setFinishTask(null);
    notify(generalStateQuestionnaire ? `« ${finishTask.title} » est terminée. Le relevé a été transmis en urgence à RH.` : `« ${finishTask.title} » est terminée et en attente de validation RH.`);
  }

  const unitName = unitLabel(unitId);
  return <div className="fade-in space-y-7"><div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between"><div><Link href={`/dashboard/${unitId}`} className="mb-4 inline-flex items-center gap-2 text-[11px] font-bold text-[#6c8176] hover:text-forest">← Retour au dashboard {unitName.toLowerCase()}</Link><p className="eyebrow mb-2">{unitName} · Planning opérationnel</p><h1 className="page-title">Tâches quotidiennes</h1><p className="muted mt-2 max-w-2xl text-[13px] leading-5">Bonjour {sessionName}. Voici uniquement les tâches de votre service jour ou nuit, établies par RH, avec les pauses dans l’ordre prévu.</p></div><div className="flex flex-wrap items-center gap-2"><button type="button" className="btn-secondary" onClick={() => void exportTaskHistory()} disabled={exporting}><Download size={14} /> {exporting ? 'Génération du rapport…' : 'Générer mon rapport de service'}</button><div className={`flex items-center gap-2 rounded-full px-3 py-2 text-[10px] font-bold ${closed ? 'bg-[#f1f5ef] text-[#66766d]' : 'bg-[#edf8e9] text-[#5b9d5b]'}`}>{closed ? <Lock size={13} /> : <Clock3 size={13} />}{closed ? 'Services jour et nuit terminés' : `Jour ${settings.dayShiftStart}–${settings.dayShiftEnd} · Nuit ${settings.nightShiftStart}–${settings.nightShiftEnd}`}</div></div></div>{feedback && <div className="flex items-center gap-2 rounded-xl border border-[#cde8c7] bg-[#effaeb] px-4 py-3 text-[12px] font-semibold text-[#4d8f51]"><Check size={14} />{feedback}</div>}{unitId === 'poulets' && <PoultryServiceHandoverView currentShift={operationalShift} serviceDate={operationalServiceDate} currentUserId={currentUserId} currentUserName={sessionName} assignedBuildingIds={sessionAdmin ? null : assignedBuildings} onSaved={() => setInstances(readLocal<DailyTaskInstance[]>(FARM_STORAGE_KEYS.dailyTaskInstances, []))} />}{unitId === 'poulets' && !sessionAdmin && !currentCategoryAssignment && <div className="flex items-start gap-3 rounded-xl border border-[#f0d5ad] bg-[#fffaf2] px-4 py-3 text-[11px] leading-5 text-[#986c3e]"><ShieldCheck size={16} className="mt-0.5 shrink-0" /><span>Votre catégorie Poussinière ou Croissance et finition n’est pas encore validée par RH. Aucune tâche Poulets bio ne sera affichée avant cette validation.</span></div>}{(lifecyclePreparationTasks.length > 0 || lifecycleOverdueTasks.length > 0) && <div className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-[11px] leading-5 ${lifecycleOverdueTasks.length ? 'border-[#f0c9c5] bg-[#fff4f3] text-[#a34f4d]' : 'border-[#f0d5ad] bg-[#fffaf2] text-[#8d6135]'}`}><CalendarDays size={16} className="mt-0.5 shrink-0" /><div><strong>{lifecycleOverdueTasks.length ? 'Échéance sanitaire à traiter' : 'Préparation de l’équipe dans 24 heures'}</strong><div className="mt-1 space-y-1">{[...lifecyclePreparationTasks, ...lifecycleOverdueTasks].map(({ task }) => <p key={task.id}>• {task.title}{task.assignedBuildingName ? ` · ${task.assignedBuildingName}` : ''}{task.dueDate ? ` · échéance ${task.dueDate.split('-').reverse().join('/')}` : ''}</p>)}</div></div></div>}<div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5"><StatCard label="Tâches de mon service" value={String(displayedTaskItems.length)} change={displayedTaskItems.length ? 'planning RH' : 'Aucune tâche sur ce service'} detail={today} icon={TimerReset} tone="blue" /><StatCard label="À faire" value={String(todo)} change="à démarrer" detail="dans la journée" icon={Play} tone="orange" /><StatCard label="En cours" value={String(inProgress)} change="maintenant" detail="suivi en direct" icon={Clock3} tone="purple" /><StatCard label="Terminées" value={String(completed)} change={`${displayedTaskItems.length ? Math.round(completed / displayedTaskItems.length * 100) : 0}%`} detail="commentaire enregistré" icon={Check} tone="green" /><StatCard label="Alertes de retard" value={String(lateTasks.length)} change={lateTasks.length ? 'Action requise' : 'Aucune'} detail="plus de 10 min" icon={Clock3} tone="orange" /></div><div className="surface overflow-hidden"><div className="border-b border-[#edf0eb] px-5 py-5 sm:px-6"><SectionHeading eyebrow={`Planning du ${today.split('-').reverse().join('/')}`} title="Journée complète" description={`Les modèles RH sont générés automatiquement. Une tolérance de fin de +${DAILY_TASK_COMPLETION_GRACE_MINUTES} minutes est appliquée aux tâches avec un horaire. Une tâche terminée ne peut plus être modifiée par l’unité.`} /></div><div className="divide-y divide-[#edf0eb]">{visibleTasks.length ? <>{dayServiceVisible && <ShiftBlock label={`Service jour · ${settings.dayShiftStart}–${settings.dayShiftEnd}`} tasks={dayTasks} settings={settings} now={currentTime} closed={dayClosed} canAct={canActOnTask} handoverBlocked={(task) => !handoverStartedForTask(task)} isLate={(task) => taskIsLate(task, currentTime, settings)} lateMinutes={(task) => taskMinutesLate(task, currentTime, settings)} onStart={startTask} onFinish={requestFinishTask} />}{nightServiceVisible && <ShiftBlock label={`Service nuit · ${settings.nightShiftStart}–${settings.nightShiftEnd}`} tasks={nightTasks} settings={settings} now={currentTime} closed={nightClosed} canAct={canActOnTask} handoverBlocked={(task) => !handoverStartedForTask(task)} isLate={(task) => taskIsLate(task, currentTime, settings)} lateMinutes={(task) => taskMinutesLate(task, currentTime, settings)} onStart={startTask} onFinish={requestFinishTask} />}</> : <div className="px-6 py-16 text-center"><TimerReset size={28} className="mx-auto text-[#b4c3b7]" /><p className="mt-3 text-[13px] font-bold text-ink">Planning en préparation</p><p className="mt-1 text-[11px] text-[#89968f]">RH n’a pas encore créé de modèle actif pour cette unité ou il sera activé demain.</p></div>}</div></div><div className="flex items-start gap-3 rounded-xl border border-[#e2d9f0] bg-[#f7f2fc] px-4 py-3 text-[11px] leading-5 text-[#70578f]"><ShieldCheck size={16} className="mt-0.5 shrink-0" /><span>Chaque tâche, y compris une pause, est évaluée selon sa durée réelle. Les gains et pénalités restent proposés jusqu’à la validation de RH.</span></div><Modal open={Boolean(finishTask)} onClose={closeExecutionForm} title="Questionnaire et exécution de la tâche"><form ref={executionFormRef} onSubmit={finish} className="space-y-5"><div className="rounded-xl border border-[#e1ebe0] bg-[#f6faf4] p-4"><p className="text-[13px] font-bold text-ink">{finishTask?.title}</p><p className="mt-1 text-[10px] text-[#89968f]">{finishTask ? finishTask.scheduleMode === 'libre' ? 'Exécution libre : à tout moment, plusieurs passages possibles dans le service' : `Prévu : ${taskScheduleLabel(finishTask)} · ${finishTask.durationMinutes} minutes` : ''}</p><p className="mt-2 text-[10px] font-semibold text-[#6385bd]">La tâche est déjà en cours. Saisissez le questionnaire maintenant, puis validez la fin lorsque l’intervention est terminée. Les réponses peuvent être enregistrées sans clôturer la tâche.</p></div>{finishTask?.protocol?.length ? <fieldset className="rounded-xl border border-[#e1ebe0] bg-[#fbfcfa] p-4"><legend className="field-label">Protocole à cocher</legend><div className="mt-2 space-y-2">{finishTask.protocol.map((step) => <label className="flex items-start gap-2 text-[11px] font-semibold text-[#65766c]" key={step}><input type="checkbox" name="protocolCheck" value={step} defaultChecked={finishTask?.protocolChecks?.includes(step)} className="mt-0.5 h-4 w-4 accent-[#5da561]" />{step}</label>)}</div></fieldset> : null}{finishTask?.requiresWaterQuantity && <label className="block"><span className="field-label">Quantité d’eau donnée à la fin du service (L)</span><input name="waterQuantityLiters" type="number" min="0" step="0.1" className="input-base" defaultValue={finishTask?.waterQuantityLiters ?? ''} required /></label>}{finishTask?.requiresFeedQuantity && <label className="block"><span className="field-label">Quantité d’aliment donnée pendant le service (kg)</span><input name="feedQuantityKg" type="number" min="0" step="0.1" className="input-base" defaultValue={finishTask?.feedQuantityKg ?? ''} required /></label>}{finishTask?.requiresTemperatureHumidity && <div className="grid gap-4 sm:grid-cols-2"><label className="block"><span className="field-label">Température relevée (°C)</span><input name="temperatureC" type="number" min="0" step="0.1" className="input-base" defaultValue={finishTask?.temperatureC ?? ''} required /></label><label className="block"><span className="field-label">Humidité relevée (%)</span><input name="humidityPercent" type="number" min="0" max="100" step="1" className="input-base" defaultValue={finishTask?.humidityPercent ?? ''} required /></label></div>}{(finishTask?.requiresGeneralStateQuestionnaire || finishTask?.category === 'etat-general-sujets') && <GeneralStateQuestionnaireFields key={finishTask.id} initialDraft={finishTask.generalStateQuestionnaireDraft} />}<label className="block"><span className="field-label">Commentaire obligatoire</span><textarea name="comment" className="input-base min-h-[110px] resize-none" defaultValue={finishTask?.comment ?? ''} placeholder="Ex. Tout s’est bien passé ou détail du problème rencontré" required /></label><div className="flex justify-end gap-2"><button type="button" className="btn-secondary" onClick={closeExecutionForm}>Enregistrer et fermer</button><button type="submit" className="btn-primary"><Check size={15} /> Confirmer la fin</button></div></form></Modal><Modal open={Boolean(generatedReport)} onClose={() => setGeneratedReport(null)} title="Rapport de service envoyé à RH">{generatedReport && <ServiceReportReader report={generatedReport} onClose={() => setGeneratedReport(null)} />}</Modal></div>;
}

function ServiceReportReader({ report, onClose }: { report: ServiceReport; onClose: () => void }) {
  return <div className="space-y-5"><div className="grid gap-3 sm:grid-cols-2"><ReportInfo label="Date" value={`${report.serviceDate} · service ${report.shift === 'nuit' ? 'nuit' : 'jour'}`} /><ReportInfo label="Responsable" value={report.responsibleName} /><ReportInfo label="Bâtiment(s)" value={report.buildingNames.join(' · ') || '—'} /><ReportInfo label="Statut RH" value={report.status} /><ReportInfo label="Tâches" value={`${report.summary.completedTaskCount}/${report.summary.taskCount} terminée(s)`} /><ReportInfo label="Mortalité" value={`${report.summary.deathsFound} sujet(s)`} /></div><div className="rounded-xl border border-[#edf0eb] bg-[#fbfcfa] p-4"><p className="field-label">Détail des tâches</p><div className="mt-3 space-y-2">{report.tasks.map((task) => <div className="rounded-lg border border-[#e7ece5] bg-white p-3" key={task.id}><div className="flex flex-wrap items-center justify-between gap-2"><strong className="text-[11px] text-ink">{task.title}</strong><span className="rounded-full bg-[#edf8e9] px-2 py-1 text-[9px] font-bold text-[#4d9352]">{task.status}</span></div><p className="mt-1 text-[10px] text-[#89968f]">{task.buildingName || 'Bâtiment non précisé'} · {task.actualDurationMinutes} min · {task.completedAt ? `terminée ${formatTaskTimestamp(task.completedAt)}` : 'non terminée'}</p>{task.comment && <p className="mt-1 text-[10px] text-[#66766d]">{task.comment}</p>}</div>)}</div></div>{report.handovers.length > 0 && <div className="rounded-xl border border-[#f0d5ad] bg-[#fffaf2] p-4"><p className="field-label">Transmissions</p><div className="mt-3 space-y-2">{report.handovers.map((handover) => <p className="text-[10px] text-[#8d6135]" key={handover.id}><strong>{handover.buildingName}</strong> · {handover.deathsFoundQuantity} mort(s) trouvé(s) · Pédiluve : {handover.footbathReady} · {handover.comment || 'Aucune observation'}</p>)}</div></div>}<div className="flex justify-end"><button type="button" className="btn-primary" onClick={onClose}><Check size={14} /> Fermer</button></div></div>;
}

function ReportInfo({ label, value }: { label: string; value: string }) { return <div className="rounded-xl border border-[#edf0eb] bg-[#fbfcfa] p-3"><span className="block text-[9px] font-bold uppercase tracking-[.1em] text-[#89968f]">{label}</span><strong className="mt-1 block text-[11px] text-ink">{value}</strong></div>; }

function ShiftBlock({ label, tasks, settings, now, closed, canAct, handoverBlocked, isLate, lateMinutes, onStart, onFinish }: { label: string; tasks: DailyTaskInstance[]; settings: DailyTaskSettings; now: Date; closed: boolean; canAct: (task: DailyTaskInstance) => boolean; handoverBlocked: (task: DailyTaskInstance) => boolean; isLate: (task: DailyTaskInstance) => boolean; lateMinutes: (task: DailyTaskInstance) => number; onStart: (task: DailyTaskInstance) => void; onFinish: (task: DailyTaskInstance) => void }) {
  const displayed = groupTaskDisplays(tasks, settings, now);
  return <div><div className="flex items-center gap-2 bg-[#fbfcfa] px-5 py-3 sm:px-6"><Clock3 size={13} className="text-[#87958d]" /><strong className="text-[10px] uppercase tracking-[.12em] text-[#718078]">{label}</strong>{closed && <span className="ml-auto rounded-full bg-[#e5eae5] px-2 py-1 text-[9px] font-bold text-[#66766d]">Service terminé</span>}</div>{displayed.length ? displayed.map(({ task, recurrence }) => { const serviceWindow = taskServiceWindow(task, now, settings); return <TaskRow key={task.id} task={task} recurrence={recurrence} handoverBlocked={handoverBlocked(task)} canStart={serviceWindow.started && !serviceWindow.closed} canFinish={(serviceWindow.started && !serviceWindow.closed) || taskCompletionGraceActive(task, now, settings)} canAct={canAct(task)} windowMessage={serviceWindow.message} late={isLate(task)} lateMinutes={lateMinutes(task)} onStart={() => onStart(task)} onFinish={() => onFinish(task)} />; }) : <p className="px-6 py-5 text-[10px] text-[#a0aaa4]">Aucune tâche dans ce service.</p>}</div>;
}

function TaskRow({ task, recurrence, handoverBlocked, canStart, canFinish, canAct, windowMessage, late, lateMinutes, onStart, onFinish }: { task: DailyTaskInstance; recurrence?: RecurrenceDisplaySummary; handoverBlocked: boolean; canStart: boolean; canFinish: boolean; canAct: boolean; windowMessage: string; late: boolean; lateMinutes: number; onStart: () => void; onFinish: () => void }) {
  const freeSchedule = task.scheduleMode === 'libre';
  const recurrenceLabel = recurrence ? ` · ${recurrence.completedCount}/${recurrence.totalCount} réalisée(s)${recurrence.pendingCount ? ` · ${recurrence.pendingCount} à faire` : ''}${recurrence.lateCount ? ` · ${recurrence.lateCount} en retard` : ''}` : '';
  const completionClass = task.status === 'Terminée' && task.completion === 'À temps' ? 'border-[#cde8c7] bg-[#f4fbf1]' : task.status === 'Terminée' ? 'border-[#f1c9c6] bg-[#fff6f5]' : task.type === 'Pause' ? 'border-[#e2d9f0] bg-[#faf7fd]' : late ? 'border-[#f0d5ad] bg-[#fffaf2]' : 'border-[#edf0eb] bg-white';
  const scheduleDetail = freeSchedule ? `Passage n°${task.executionNumber ?? 1} · plusieurs exécutions possibles` : task.scheduleMode === 'recurrence' ? `Toutes les ${task.recurrenceMinutes ?? 60} min${recurrence?.nextTask ? ` · prochaine ${recurrence.nextTask.startTime}` : ''} · fin tolérée +${DAILY_TASK_COMPLETION_GRACE_MINUTES} min` : `→ ${plannedEndTime(task)} · fin tolérée +${DAILY_TASK_COMPLETION_GRACE_MINUTES} min`;
  return <div className={`flex flex-col gap-4 border-l-4 px-5 py-5 transition sm:flex-row sm:items-center sm:px-6 ${completionClass}`}><div className="flex w-32 shrink-0 flex-col gap-1"><span className="text-[17px] font-black text-ink">{freeSchedule ? 'Libre' : task.startTime || '—'}</span><span className="text-[10px] text-[#89968f]">{scheduleDetail}</span></div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="text-[13px] font-bold text-ink">{task.title}</h3><span className={`rounded-full px-2 py-1 text-[9px] font-bold ${task.type === 'Pause' ? 'bg-[#eee7f8] text-[#8066a6]' : 'bg-[#edf3ff] text-[#6385bd]'}`}>{task.type}</span>{task.poultryPhase && <span className="rounded-full bg-[#f5faf2] px-2 py-1 text-[9px] font-bold text-[#5b8f60]">{task.poultryPhase === 'poussiniere' ? 'Poussinière' : 'Croissance et finition'}</span>}{task.lifecycleTask && task.dueDate && <span className="rounded-full bg-[#edf3ff] px-2 py-1 text-[9px] font-bold text-[#6385bd]">Échéance {task.dueDate.split('-').reverse().join('/')}</span>}<TaskBadge task={task} /></div><p className="mt-1 text-[10px] text-[#87958d]">Responsable : {task.assignedEmployeeName || task.assignedRole || 'Poste non renseigné'}{task.assignedBuildingName ? ` · ${task.assignedBuildingName}` : ''}{freeSchedule ? ' · exécution libre pendant le service' : task.scheduleMode === 'recurrence' ? ` · toutes les ${task.recurrenceMinutes ?? 60} minutes${recurrenceLabel}` : ` · durée : ${task.durationMinutes} min`}</p>{late && <p className="mt-2 flex items-center gap-1 text-[10px] font-bold text-[#bd7737]"><Clock3 size={12} /> Alerte : non démarrée depuis {lateMinutes} minute(s) après l’heure prévue.</p>}{task.status === 'À faire' && handoverBlocked && <p className="mt-2 flex items-center gap-1 text-[10px] font-bold text-[#a86f36]"><ClipboardCheck size={12} /> Transmission obligatoire : commencez la transmission de ce bâtiment avant cette tâche.</p>}{task.status === 'À faire' && !handoverBlocked && canAct && !canStart && <p className="mt-2 flex items-center gap-1 text-[10px] font-bold text-[#a86f36]"><Clock3 size={12} /> {windowMessage}</p>}{task.status === 'En cours' && !canFinish && canAct && <p className="mt-2 flex items-center gap-1 text-[10px] font-bold text-[#a34f4d]"><Lock size={12} /> {windowMessage}</p>}{task.category === 'etat-general-sujets' && ['À faire', 'En cours'].includes(task.status) && <p className="mt-2 flex items-center gap-1 text-[10px] font-bold text-[#bd5c5d]"><AlertTriangle size={12} /> Ce relevé sera transmis en urgence à RH après validation.</p>}{!canAct && !handoverBlocked && task.status !== 'Terminée' && task.status !== 'Non faite' && <p className="mt-2 text-[10px] font-bold text-[#89968f]">Hors service ou tâche attribuée à un autre responsable.</p>}{task.status === 'En cours' && <p className="mt-2 text-[10px] font-bold text-[#bd7737]">Démarrée à {new Date(task.startedAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}{task.startTiming ? ` · ${task.startTiming}` : ''}</p>}{task.status === 'Terminée' && <p className="mt-2 text-[10px] text-[#66766d]">Réel : {task.actualDurationMinutes} min · {task.comment}</p>}</div><div className="flex shrink-0 items-center gap-2">{task.status === 'À faire' && (canAct || handoverBlocked) && <button type="button" disabled={!canStart || handoverBlocked} className={`btn-primary px-3 py-2 text-[10px] ${!canStart || handoverBlocked ? 'cursor-not-allowed opacity-50' : ''}`} onClick={onStart}><Play size={13} /> {handoverBlocked ? 'Transmission obligatoire' : canStart ? 'Démarrer' : 'Hors horaires'}</button>}{task.status === 'En cours' && (canAct || handoverBlocked) && <button type="button" disabled={!canFinish || handoverBlocked} className={`btn-primary px-3 py-2 text-[10px] ${!canFinish || handoverBlocked ? 'cursor-not-allowed opacity-50' : ''}`} onClick={onFinish}><Square size={13} /> {handoverBlocked ? 'Transmission obligatoire' : canFinish ? 'Terminer' : 'Hors horaires'}</button>}{task.status === 'Terminée' && <span className={`rounded-full px-2.5 py-1.5 text-[9px] font-bold ${task.completion === 'À temps' ? 'bg-[#dff3d9] text-[#4d9352]' : 'bg-[#f8dcd9] text-[#b45d5d]'}`}>{task.completion === 'À temps' ? `+${task.bonusAmount} FCFA proposé` : `-${task.penaltyAmount} FCFA proposé`}</span>}{task.status === 'Non faite' && <span className="rounded-full bg-[#f1f5ef] px-2.5 py-1.5 text-[9px] font-bold text-[#66766d]">Non faite</span>}</div></div>;
}

function TaskBadge({ task }: { task: DailyTaskInstance }) { const label = task.status === 'Terminée' ? task.validationStatus : task.status; return <span className={`rounded-full px-2 py-1 text-[9px] font-bold ${task.status === 'En cours' ? 'bg-[#fff2e2] text-[#bd7737]' : task.status === 'Terminée' && task.completion === 'À temps' ? 'bg-[#edf8e9] text-[#5b9d5b]' : task.status === 'Terminée' ? 'bg-[#fdeceb] text-[#bd5c5c]' : 'bg-[#f1f5ef] text-[#66766d]'}`}>{label}</span>; }

type TaskExecutionDraft = Partial<Pick<DailyTaskInstance, 'protocolChecks' | 'waterQuantityLiters' | 'feedQuantityKg' | 'temperatureC' | 'humidityPercent' | 'comment' | 'generalStateQuestionnaireDraft'>>;

type GeneralStateReadResult = { questionnaire?: PoultryGeneralStateQuestionnaire; error?: string };

function taskHasExecutionForm(task: DailyTaskInstance) {
  if (task.type === 'Pause') return false;
  const hasQuestionnaireDraft = Boolean(task.generalStateQuestionnaireDraft && Object.keys(task.generalStateQuestionnaireDraft).length);
  return Boolean(task.protocol?.length || task.protocolChecks?.length || task.requiresWaterQuantity || task.requiresFeedQuantity || task.requiresTemperatureHumidity || task.requiresGeneralStateQuestionnaire || task.category === 'etat-general-sujets' || hasQuestionnaireDraft);
}

function readOptionalNumber(form: FormData, name: string) {
  if (!form.has(name)) return undefined;
  const raw = String(form.get(name) ?? '').trim();
  if (!raw) return undefined;
  const value = Number(raw);
  return Number.isFinite(value) ? value : undefined;
}

function readTaskExecutionDraft(form: HTMLFormElement): TaskExecutionDraft {
  const data = new FormData(form);
  const generalStateQuestionnaireDraft = readGeneralStateQuestionnaireDraft(data);
  return {
    protocolChecks: data.getAll('protocolCheck').map(String),
    waterQuantityLiters: readOptionalNumber(data, 'waterQuantityLiters'),
    feedQuantityKg: readOptionalNumber(data, 'feedQuantityKg'),
    temperatureC: readOptionalNumber(data, 'temperatureC'),
    humidityPercent: readOptionalNumber(data, 'humidityPercent'),
    generalStateQuestionnaireDraft: Object.keys(generalStateQuestionnaireDraft).length ? generalStateQuestionnaireDraft : undefined,
    comment: String(data.get('comment') ?? '').trim(),
  };
}

function readGeneralStateQuestionnaireDraft(form: FormData): Partial<PoultryGeneralStateQuestionnaire> {
  const subjectsVigorous = String(form.get('subjectsVigorous') ?? '');
  const foodConsumptionNormal = String(form.get('foodConsumptionNormal') ?? '');
  const waterConsumptionNormal = String(form.get('waterConsumptionNormal') ?? '');
  const respiratoryProblems = String(form.get('respiratoryProblems') ?? '');
  const respiratoryType = String(form.get('respiratoryType') ?? '');
  const draft: Partial<PoultryGeneralStateQuestionnaire> = {};
  if (subjectsVigorous === 'Oui' || subjectsVigorous === 'Non') draft.subjectsVigorous = subjectsVigorous;
  if (foodConsumptionNormal === 'Oui' || foodConsumptionNormal === 'Non') draft.foodConsumptionNormal = foodConsumptionNormal;
  if (waterConsumptionNormal === 'Oui' || waterConsumptionNormal === 'Non') draft.waterConsumptionNormal = waterConsumptionNormal;
  if (respiratoryProblems === 'Oui' || respiratoryProblems === 'Non') draft.respiratoryProblems = respiratoryProblems;
  if (respiratoryType === 'Buccale' || respiratoryType === 'Nasale') draft.respiratoryType = respiratoryType;
  const textFields: Array<[keyof PoultryGeneralStateQuestionnaire, string | null]> = [
    ['subjectsVigorousWhy', form.get('subjectsVigorousWhy') ? String(form.get('subjectsVigorousWhy')) : null],
    ['foodConsumptionWhy', form.get('foodConsumptionWhy') ? String(form.get('foodConsumptionWhy')) : null],
    ['waterConsumptionWhy', form.get('waterConsumptionWhy') ? String(form.get('waterConsumptionWhy')) : null],
    ['droppingsColor', form.get('droppingsColor') ? String(form.get('droppingsColor')) : null],
    ['droppingsTexture', form.get('droppingsTexture') ? String(form.get('droppingsTexture')) : null],
    ['ruffledFeathers', form.get('ruffledFeathers') ? String(form.get('ruffledFeathers')) : null],
    ['wingsAway', form.get('wingsAway') ? String(form.get('wingsAway')) : null],
    ['cough', form.get('cough') ? String(form.get('cough')) : null],
    ['rattles', form.get('rattles') ? String(form.get('rattles')) : null],
    ['wheezing', form.get('wheezing') ? String(form.get('wheezing')) : null],
  ];
  textFields.forEach(([key, value]) => { if (value) draft[key] = value as never; });
  return draft;
}

function readGeneralStateQuestionnaire(form: FormData): GeneralStateReadResult {
  const subjectsVigorous = String(form.get('subjectsVigorous') ?? '') as SanitaryAnswer;
  const subjectsVigorousWhy = String(form.get('subjectsVigorousWhy') ?? '').trim();
  const foodConsumptionNormal = String(form.get('foodConsumptionNormal') ?? '') as SanitaryAnswer;
  const foodConsumptionWhy = String(form.get('foodConsumptionWhy') ?? '').trim();
  const waterConsumptionNormal = String(form.get('waterConsumptionNormal') ?? '') as SanitaryAnswer;
  const waterConsumptionWhy = String(form.get('waterConsumptionWhy') ?? '').trim();
  const droppingsColor = String(form.get('droppingsColor') ?? '') as DroppingsColor;
  const droppingsTexture = String(form.get('droppingsTexture') ?? '') as DroppingsTexture;
  const respiratoryProblems = String(form.get('respiratoryProblems') ?? '') as SanitaryAnswer;
  const respiratoryTypeValue = String(form.get('respiratoryType') ?? '');
  const respiratoryType = respiratoryTypeValue === 'Buccale' || respiratoryTypeValue === 'Nasale' ? respiratoryTypeValue as RespiratoryType : '';
  const ruffledFeathers = String(form.get('ruffledFeathers') ?? '') as SanitaryAnswer;
  const wingsAway = String(form.get('wingsAway') ?? '') as SanitaryAnswer;
  const cough = String(form.get('cough') ?? '') as SanitaryAnswer;
  const rattles = String(form.get('rattles') ?? '') as SanitaryAnswer;
  const wheezing = String(form.get('wheezing') ?? '') as SanitaryAnswer;

  const answers = [subjectsVigorous, foodConsumptionNormal, waterConsumptionNormal, respiratoryProblems, ruffledFeathers, wingsAway, cough, rattles, wheezing];
  if (answers.some((answer) => !isSanitaryAnswer(answer))) return { error: 'Répondez à toutes les questions Oui / Non de l’état général.' };
  if (!isDroppingsColor(droppingsColor) || !isDroppingsTexture(droppingsTexture)) return { error: 'Sélectionnez la couleur et la texture des fientes.' };
  if (subjectsVigorous === 'Non' && !subjectsVigorousWhy) return { error: 'Expliquez pourquoi les sujets ne sont pas vifs.' };
  if (foodConsumptionNormal === 'Non' && !foodConsumptionWhy) return { error: 'Expliquez pourquoi la consommation alimentaire est anormale.' };
  if (waterConsumptionNormal === 'Non' && !waterConsumptionWhy) return { error: 'Expliquez pourquoi les sujets ne boivent pas normalement.' };
  if (respiratoryProblems === 'Oui' && !respiratoryType) return { error: 'Précisez si la respiration est buccale ou nasale.' };
  return { questionnaire: { subjectsVigorous, subjectsVigorousWhy, foodConsumptionNormal, foodConsumptionWhy, waterConsumptionNormal, waterConsumptionWhy, droppingsColor, droppingsTexture, respiratoryProblems, respiratoryType: respiratoryProblems === 'Oui' ? respiratoryType : '', ruffledFeathers, wingsAway, cough, rattles, wheezing } };
}

function isSanitaryAnswer(value: string): value is SanitaryAnswer { return value === 'Oui' || value === 'Non'; }
function isDroppingsColor(value: string): value is DroppingsColor { return value === 'Marron' || value === 'Rouge' || value === 'Blanche' || value === 'Verte'; }
function isDroppingsTexture(value: string): value is DroppingsTexture { return value === 'Solide' || value === 'Liquide'; }

function GeneralStateQuestionnaireFields({ initialDraft }: { initialDraft?: Partial<PoultryGeneralStateQuestionnaire> }) {
  const [subjectsVigorous, setSubjectsVigorous] = useState<SanitaryAnswer | ''>(initialDraft?.subjectsVigorous ?? '');
  const [foodConsumptionNormal, setFoodConsumptionNormal] = useState<SanitaryAnswer | ''>(initialDraft?.foodConsumptionNormal ?? '');
  const [waterConsumptionNormal, setWaterConsumptionNormal] = useState<SanitaryAnswer | ''>(initialDraft?.waterConsumptionNormal ?? '');
  const [respiratoryProblems, setRespiratoryProblems] = useState<SanitaryAnswer | ''>(initialDraft?.respiratoryProblems ?? '');
  const [respiratoryType, setRespiratoryType] = useState<RespiratoryType | ''>(initialDraft?.respiratoryType ?? '');
  return <fieldset className="rounded-xl border border-[#f0c9c5] bg-[#fff8f7] p-4"><legend className="flex items-center gap-2 px-1 text-[12px] font-black text-[#a34f4d]"><HeartPulse size={15} /> État général des sujets · transmission urgente RH</legend><p className="mt-1 text-[10px] leading-5 text-[#9e6966]">Une réponse défavorable ouvre une justification obligatoire. Le questionnaire complet sera transmis à RH avec le bâtiment, la bande et le responsable.</p><div className="mt-4 grid gap-4 sm:grid-cols-2"><AnswerQuestion name="subjectsVigorous" label="Les sujets sont-ils vifs ?" value={subjectsVigorous} onChange={setSubjectsVigorous} />{subjectsVigorous === 'Non' && <label className="block"><span className="field-label">Si non, pourquoi ?</span><textarea name="subjectsVigorousWhy" className="input-base min-h-[70px] resize-none" defaultValue={initialDraft?.subjectsVigorousWhy ?? ''} required placeholder="Décrivez le comportement observé…" /></label>}<AnswerQuestion name="foodConsumptionNormal" label="Consomment-ils normalement ?" value={foodConsumptionNormal} onChange={setFoodConsumptionNormal} />{foodConsumptionNormal === 'Non' && <label className="block"><span className="field-label">Si non, pourquoi ?</span><textarea name="foodConsumptionWhy" className="input-base min-h-[70px] resize-none" defaultValue={initialDraft?.foodConsumptionWhy ?? ''} required placeholder="Décrivez la baisse ou l’anomalie…" /></label>}<AnswerQuestion name="waterConsumptionNormal" label="Boivent-ils normalement ?" value={waterConsumptionNormal} onChange={setWaterConsumptionNormal} />{waterConsumptionNormal === 'Non' && <label className="block"><span className="field-label">Si non, pourquoi ?</span><textarea name="waterConsumptionWhy" className="input-base min-h-[70px] resize-none" defaultValue={initialDraft?.waterConsumptionWhy ?? ''} required placeholder="Décrivez l’anomalie observée…" /></label>}<label className="block"><span className="field-label">Couleur des fientes</span><select name="droppingsColor" className="input-base" defaultValue={initialDraft?.droppingsColor ?? ''} required><option value="">Choisir</option><option value="Marron">Marron</option><option value="Rouge">Rouge</option><option value="Blanche">Blanche</option><option value="Verte">Verte</option></select></label><label className="block"><span className="field-label">Texture des fientes</span><select name="droppingsTexture" className="input-base" defaultValue={initialDraft?.droppingsTexture ?? ''} required><option value="">Choisir</option><option value="Solide">Solide</option><option value="Liquide">Liquide</option></select></label></div><div className="mt-4 rounded-xl border border-[#ecdfe9] bg-[#faf7fd] p-3"><AnswerQuestion name="respiratoryProblems" label="Présentent-ils des problèmes respiratoires ?" value={respiratoryProblems} onChange={(value) => { setRespiratoryProblems(value); if (value === 'Non') setRespiratoryType(''); }} />{respiratoryProblems === 'Oui' && <fieldset className="mt-3"><legend className="field-label">La respiration est-elle buccale ou nasale ?</legend><div className="flex gap-2"><ChoiceRadio name="respiratoryType" value="Buccale" checked={respiratoryType === 'Buccale'} onChange={() => setRespiratoryType('Buccale')} label="Buccale" required /><ChoiceRadio name="respiratoryType" value="Nasale" checked={respiratoryType === 'Nasale'} onChange={() => setRespiratoryType('Nasale')} label="Nasale" required /></div></fieldset>}</div><div className="mt-4 grid gap-4 sm:grid-cols-2"><AnswerQuestion name="ruffledFeathers" label="Plumes ébouriffées ?" defaultValue={initialDraft?.ruffledFeathers ?? ''} /><AnswerQuestion name="wingsAway" label="Ailes détachées du corps ?" defaultValue={initialDraft?.wingsAway ?? ''} /><AnswerQuestion name="cough" label="Toux ?" defaultValue={initialDraft?.cough ?? ''} /><AnswerQuestion name="rattles" label="Râles ?" defaultValue={initialDraft?.rattles ?? ''} /><AnswerQuestion name="wheezing" label="Sifflements ?" defaultValue={initialDraft?.wheezing ?? ''} /></div></fieldset>;
}

function AnswerQuestion({ name, label, value = '', defaultValue = '', onChange }: { name: string; label: string; value?: SanitaryAnswer | ''; defaultValue?: SanitaryAnswer | ''; onChange?: (value: SanitaryAnswer) => void }) {
  const controlled = Boolean(onChange);
  return <fieldset><legend className="field-label">{label}</legend><div className="flex gap-2"><ChoiceRadio name={name} value="Oui" checked={controlled ? value === 'Oui' : undefined} defaultChecked={!controlled && defaultValue === 'Oui'} onChange={controlled ? () => onChange?.('Oui') : undefined} label="Oui" required={!controlled} /><ChoiceRadio name={name} value="Non" checked={controlled ? value === 'Non' : undefined} defaultChecked={!controlled && defaultValue === 'Non'} onChange={controlled ? () => onChange?.('Non') : undefined} label="Non" required={!controlled} /></div></fieldset>;
}

function ChoiceRadio({ name, value, checked, defaultChecked = false, onChange, label, required = false }: { name: string; value: string; checked?: boolean; defaultChecked?: boolean; onChange?: () => void; label: string; required?: boolean }) {
  return <label className="flex flex-1 items-center gap-2 rounded-lg border border-[#eadfdc] bg-white px-3 py-2 text-[11px] font-semibold text-[#65766c]"><input type="radio" name={name} value={value} checked={checked} defaultChecked={defaultChecked} onChange={onChange} className="h-4 w-4 accent-[#bd5c5c]" required={required} />{label}</label>;
}

function groupTaskDisplays(tasks: DailyTaskInstance[], settings: DailyTaskSettings, now = new Date()): TaskDisplay[] {
  const groups = new Map<string, DailyTaskInstance[]>();
  tasks.forEach((task) => {
    const key = task.scheduleMode === 'recurrence' ? `recurrence:${task.templateId}` : `single:${task.id}`;
    groups.set(key, [...(groups.get(key) ?? []), task]);
  });
  return Array.from(groups.values()).map((group) => {
    const first = group[0];
    if (first.scheduleMode !== 'recurrence') return { task: first };
    const sorted = [...group].sort((a, b) => taskDisplayTime(a, settings) - taskDisplayTime(b, settings));
    const inProgress = sorted.find((task) => task.status === 'En cours');
    const pending = sorted.filter((task) => task.status === 'À faire');
    const duePending = pending.filter((task) => taskDisplayTime(task, settings) <= now.getTime());
    const alertTask = duePending[duePending.length - 1];
    const nextTask = pending.find((task) => taskDisplayTime(task, settings) > now.getTime());
    const representative = inProgress ?? alertTask ?? nextTask ?? sorted[sorted.length - 1];
    return {
      task: representative,
      recurrence: {
        totalCount: sorted.length,
        completedCount: sorted.filter((task) => task.status === 'Terminée').length,
        lateCount: sorted.filter((task) => task.status === 'Non faite' || task.completion === 'En retard' || task.status === 'À faire' && taskDisplayTime(task, settings) + 10 * 60000 <= now.getTime()).length,
        pendingCount: sorted.filter((task) => task.status === 'À faire' || task.status === 'En cours').length,
        nextTask,
        alertTask,
      },
    };
  }).sort((a, b) => (a.task.shift ?? 'jour').localeCompare(b.task.shift ?? 'jour') || taskDisplayTime(a.task, settings) - taskDisplayTime(b.task, settings));
}

function taskDisplayTime(task: DailyTaskInstance, settings: DailyTaskSettings) {
  return task.startTime ? taskScheduledStartAt(task, settings).getTime() : Number.MAX_SAFE_INTEGER;
}

function taskScheduleLabel(task: Pick<DailyTaskInstance, 'scheduleMode' | 'startTime' | 'recurrenceMinutes' | 'durationMinutes'>) {
  if (task.scheduleMode === 'libre') return 'À tout moment';
  if (task.scheduleMode === 'recurrence') return `Toutes les ${task.recurrenceMinutes ?? 60} min · fin tolérée +${DAILY_TASK_COMPLETION_GRACE_MINUTES} min`;
  return task.startTime ? `${task.startTime} → ${plannedEndTime(task)} · fin tolérée +${DAILY_TASK_COMPLETION_GRACE_MINUTES} min` : 'Horaire non défini';
}

function taskServiceWindow(task: DailyTaskInstance, now: Date, settings: DailyTaskSettings) {
  const effectiveDate = task.lifecycleTask && task.dueDate ? task.dueDate : task.date;
  const shift = task.shift ?? 'jour';
  const started = isTaskDayStarted(effectiveDate, now, settings, shift);
  const closed = isTaskDayClosed(effectiveDate, now, settings, shift);
  if (!started) return { started, closed, message: `Hors heures de service · le service ${shift === 'nuit' ? 'nuit' : 'jour'} commence à ${shift === 'nuit' ? settings.nightShiftStart : settings.dayShiftStart}.` };
  if (closed) return { started, closed, message: 'Service terminé · aucune nouvelle action n’est autorisée.' };
  return { started, closed, message: '' };
}

function formatTaskTimestamp(value: string) {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('fr-FR', { timeZone: 'Africa/Douala' });
}

function formatPdfNumber(value: number) {
  return Number(value || 0).toLocaleString('fr-FR', { maximumFractionDigits: 2 });
}

function pdfTaskDetails(task: DailyTaskInstance) {
  const state = task.generalStateQuestionnaire;
  const details = [
    `État : ${task.status}${task.completion ? ` · ${task.completion}` : ''}`,
    `Durée réelle : ${task.actualDurationMinutes || 0} min`,
    task.startedByName ? `Démarrée par : ${task.startedByName}` : '',
    task.completedByName ? `Terminée par : ${task.completedByName}` : '',
    task.protocol?.length ? `Protocole : ${task.protocol.join(' • ')}` : '',
    task.protocolChecks?.length ? `Étapes cochées : ${task.protocolChecks.join(' • ')}` : '',
    task.protocolVersion ? `Version protocole : ${task.protocolVersion}` : '',
    task.waterQuantityLiters !== undefined ? `Eau : ${formatPdfNumber(task.waterQuantityLiters)} L` : '',
    task.feedQuantityKg !== undefined ? `Aliment : ${formatPdfNumber(task.feedQuantityKg)} kg` : '',
    task.temperatureC !== undefined || task.humidityPercent !== undefined ? `Ambiance : ${task.temperatureC ?? '—'} °C · ${task.humidityPercent ?? '—'} %` : '',
    state ? `État sujets : vifs ${state.subjectsVigorous}${state.subjectsVigorousWhy ? ` · ${state.subjectsVigorousWhy}` : ''}` : '',
    state ? `Aliment : ${state.foodConsumptionNormal}${state.foodConsumptionWhy ? ` · ${state.foodConsumptionWhy}` : ''}` : '',
    state ? `Eau : ${state.waterConsumptionNormal}${state.waterConsumptionWhy ? ` · ${state.waterConsumptionWhy}` : ''}` : '',
    state ? `Fientes : ${state.droppingsColor} · ${state.droppingsTexture}` : '',
    state ? `Respiration : ${state.respiratoryProblems}${state.respiratoryType ? ` · ${state.respiratoryType}` : ''}` : '',
    state ? `Signes : plumes ${state.ruffledFeathers} · ailes ${state.wingsAway} · toux ${state.cough} · râles ${state.rattles} · sifflements ${state.wheezing}` : '',
    task.comment ? `Commentaire : ${task.comment}` : '',
    task.validationStatus !== 'Aucune' ? `RH : ${task.validationStatus}${task.validationComment ? ` · ${task.validationComment}` : ''}${task.validatedBy ? ` · par ${task.validatedBy}` : ''}` : '',
  ];
  return details.filter(Boolean).join('\n');
}

function safeDownloadPart(value: string) {
  return value.trim().replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '') || 'responsable';
}

function unitLabel(unitId: string) { return units.find((unit) => unit.id === unitId)?.label ?? unitId; }
