'use client';

import { useEffect, useMemo, useState } from 'react';
import { Check, Clock3, ListChecks } from 'lucide-react';
import type { UnitId } from '@/lib/data';
import { FARM_STORAGE_KEYS, readLocal, subscribeToFarmData } from '@/lib/farm-storage';
import { formatFCFA } from '@/lib/format';
import { SectionHeading } from '@/components/ui';
import { shiftForEmployee, todayIso, type DailyTaskInstance, type DailyTaskRosterEntry, type DailyTaskUnitId } from '@/lib/daily-tasks';

export function DailyTasksReport({ unitId, buildingIds }: { unitId: Exclude<UnitId, 'rh'>; buildingIds?: string[] }) {
  const [tasks, setTasks] = useState<DailyTaskInstance[]>([]);
  const date = todayIso();
  useEffect(() => {
    const load = () => {
      const userId = decodeURIComponent(document.cookie.split('; ').find((part) => part.startsWith('agroflux_user_id='))?.slice('agroflux_user_id='.length) ?? '');
      const isAdmin = document.cookie.split('; ').some((part) => part === 'agroflux_is_admin=1');
      const roster = readLocal<DailyTaskRosterEntry[]>(FARM_STORAGE_KEYS.dailyTaskRoster, []);
      const employees = readLocal<Array<{ id: string; linkedUserId?: string; unitId: DailyTaskUnitId }>>(FARM_STORAGE_KEYS.rhEmployees, []);
      const employeeIds = new Set([userId, ...employees.filter((employee) => employee.id === userId || employee.linkedUserId === userId).map((employee) => employee.id)].filter(Boolean));
      const rosterEntry = isAdmin ? undefined : roster.find((entry) => entry.unitId === unitId && employeeIds.has(entry.employeeId));
      setTasks(readLocal<DailyTaskInstance[]>(FARM_STORAGE_KEYS.dailyTaskInstances, []).filter((task) => {
        const assignedShift = rosterEntry ? shiftForEmployee(rosterEntry.employeeId, task.date, roster, unitId) : undefined;
        return task.unitId === unitId && task.date === date && (!rosterEntry || assignedShift === (task.shift ?? 'jour')) && (!buildingIds?.length || !task.assignedBuildingId || buildingIds.includes(task.assignedBuildingId));
      }));
    };
    load();
    return subscribeToFarmData([FARM_STORAGE_KEYS.dailyTaskInstances, FARM_STORAGE_KEYS.dailyTaskRoster, FARM_STORAGE_KEYS.rhEmployees], load);
  }, [unitId, date, buildingIds]);
  const done = tasks.filter((task) => task.status === 'Terminée').length;
  const proposedBonus = tasks.reduce((sum, task) => sum + task.bonusAmount, 0);
  const proposedPenalty = tasks.reduce((sum, task) => sum + task.penaltyAmount, 0);
  const sorted = useMemo(() => [...tasks].sort((a, b) => a.startTime.localeCompare(b.startTime)), [tasks]);
  return <div className="surface overflow-hidden"><div className="border-b border-[#edf0eb] px-5 py-5 sm:px-6"><SectionHeading eyebrow="Suivi opérationnel" title="Tâches du jour" description="Les gains et pertes proposés restent soumis à la validation RH." /></div><div className="grid gap-3 p-5 sm:grid-cols-3 sm:p-6"><div className="rounded-xl bg-[#edf8e9] p-3"><p className="text-[10px] text-[#6d9071]">Accomplies</p><p className="mt-1 text-[18px] font-black text-[#4d9352]">{done} / {tasks.length}</p></div><div className="rounded-xl bg-[#edf3ff] p-3"><p className="text-[10px] text-[#6385bd]">Prime proposée</p><p className="mt-1 text-[18px] font-black text-[#6385bd]">{formatFCFA(proposedBonus)}</p></div><div className="rounded-xl bg-[#fff2e2] p-3"><p className="text-[10px] text-[#bd7737]">Pénalité proposée</p><p className="mt-1 text-[18px] font-black text-[#bd7737]">{formatFCFA(proposedPenalty)}</p></div></div><div className="divide-y divide-[#edf0eb]">{sorted.length ? sorted.map((task) => <div key={task.id} className="flex flex-col gap-2 px-5 py-4 sm:flex-row sm:items-center sm:px-6"><span className="w-24 text-[11px] font-black text-ink">{task.scheduleMode === 'libre' ? `Libre · n°${task.executionNumber ?? 1}` : task.startTime}</span><span className="min-w-0 flex-1"><strong className="block text-[11px] text-ink">{task.title}</strong><small className="text-[10px] text-[#89968f]">{task.assignedEmployeeName || task.assignedRole || 'Poste non assigné'} · {task.comment || 'Aucun commentaire'}</small></span><span className={`flex items-center gap-1 rounded-full px-2 py-1 text-[9px] font-bold ${task.status === 'Terminée' && task.completion === 'À temps' ? 'bg-[#edf8e9] text-[#5b9d5b]' : task.status === 'Terminée' ? 'bg-[#fdeceb] text-[#bd5c5c]' : 'bg-[#f1f5ef] text-[#66766d]'}`}>{task.status === 'Terminée' ? <Check size={11} /> : <Clock3 size={11} />}{task.status === 'Terminée' ? `${task.validationStatus} · ${task.completion}` : task.status}</span></div>) : <div className="px-6 py-12 text-center text-[11px] text-[#89968f]"><ListChecks size={25} className="mx-auto mb-2 text-[#b4c3b7]" />Aucune instance de tâche pour aujourd’hui.</div>}</div></div>;
}
