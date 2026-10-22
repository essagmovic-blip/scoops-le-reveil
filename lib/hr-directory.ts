import { FARM_STORAGE_KEYS, readLocal, writeLocal } from '@/lib/farm-storage';
import { normalizeAllowedUnits } from '@/lib/user-access';
import { todayIso, type DailyTaskEmployee, type DailyTaskUnitId } from '@/lib/daily-tasks';

export type HRDirectoryEmployee = {
  id: string;
  linkedUserId?: string;
  name: string;
  /** Matricule RH généré automatiquement, distinct de l’identifiant de connexion. */
  matricule?: string;
  identifier?: string;
  unitId: DailyTaskUnitId;
  position?: string;
  contract?: string;
  startDate?: string;
  phone?: string;
  email?: string;
  baseSalary?: number;
  paymentMethod?: string;
  status?: string;
  note?: string;
};

export type AccessDirectoryUser = {
  id: string;
  name: string;
  identifier?: string;
  role?: string;
  allowedUnits?: string[];
  status?: string;
};

export function nextHRMatricule(employees: Array<{ matricule?: string }> = [], now = new Date()) {
  const year = todayIso(now).slice(0, 4);
  const prefix = `SCOOPS-RH-${year}-`;
  const max = employees.reduce((highest, employee) => {
    const value = employee.matricule?.startsWith(prefix) ? Number(employee.matricule.slice(prefix.length)) : 0;
    return Number.isFinite(value) ? Math.max(highest, value) : highest;
  }, 0);
  return `${prefix}${String(max + 1).padStart(4, '0')}`;
}

export function ensureHRMatricules<T extends { matricule?: string }>(employees: T[], now = new Date()) {
  let next = [...employees];
  for (let index = 0; index < next.length; index += 1) {
    if (next[index].matricule) continue;
    const matricule = nextHRMatricule(next, now);
    next[index] = { ...next[index], matricule };
  }
  return next;
}

/** Crée/actualise les fiches RH liées au compte, sans demander une seconde saisie. */
export function syncManagedUserToHR(user: AccessDirectoryUser) {
  const allowed = normalizeAllowedUnits(user.allowedUnits ?? []).filter((unit): unit is DailyTaskUnitId => unit !== 'rh');
  const employees = readLocal<HRDirectoryEmployee[]>(FARM_STORAGE_KEYS.rhEmployees, []);
  const now = todayIso();
  let next = [...employees];
  for (const unitId of allowed) {
    const existing = next.find((employee) => employee.linkedUserId === user.id && employee.unitId === unitId) ?? next.find((employee) => employee.id === user.id && employee.unitId === unitId);
    const record: HRDirectoryEmployee = {
      id: existing?.id ?? `EMP-${user.id}-${unitId}`,
      linkedUserId: user.id,
      name: user.name,
      matricule: existing?.matricule ?? nextHRMatricule(next),
      identifier: user.identifier,
      unitId,
      position: existing?.position || user.role || 'Collaborateur',
      contract: existing?.contract || 'À compléter par RH',
      startDate: existing?.startDate || now,
      phone: existing?.phone || '',
      email: existing?.email || '',
      baseSalary: existing?.baseSalary ?? 0,
      paymentMethod: existing?.paymentMethod || 'Virement',
      status: user.status === 'Suspendu' ? 'Suspendu' : existing?.status || 'Actif',
      note: existing?.note || 'Fiche RH créée automatiquement depuis le compte AgroFlux.',
    };
    next = existing ? next.map((item) => item.id === existing.id ? { ...item, ...record } : item) : [record, ...next];
  }
  if (JSON.stringify(next) !== JSON.stringify(employees)) writeLocal(FARM_STORAGE_KEYS.rhEmployees, next);
  return next;
}

/** Fusionne les fiches RH et les comptes d'accès, avec l'id du compte comme clé d'exécution. */
export function mergeTaskEmployees(rhEmployees: HRDirectoryEmployee[], users: AccessDirectoryUser[]): DailyTaskEmployee[] {
  const result: DailyTaskEmployee[] = rhEmployees.map((employee) => ({ id: employee.linkedUserId || employee.id, linkedUserId: employee.linkedUserId, sourceEmployeeId: employee.id, name: employee.name, identifier: employee.matricule || employee.identifier, unitId: employee.unitId, position: employee.position, status: employee.status }));
  for (const user of users) {
    const allowed = normalizeAllowedUnits(user.allowedUnits ?? []).filter((unit): unit is DailyTaskUnitId => unit !== 'rh');
    for (const unitId of allowed) {
      if (!result.some((employee) => employee.id === user.id && employee.unitId === unitId)) result.push({ id: user.id, linkedUserId: user.id, sourceEmployeeId: user.id, name: user.name, identifier: user.identifier, unitId, position: user.role, status: user.status === 'Suspendu' ? 'Suspendu' : 'Actif' });
    }
  }
  return result;
}

export function linkedEmployeeIds(employee: { id: string; linkedUserId?: string }) {
  return Array.from(new Set([employee.id, employee.linkedUserId].filter(Boolean) as string[]));
}
