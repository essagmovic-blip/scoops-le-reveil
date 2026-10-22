import { promises as fs } from 'fs';
import path from 'path';
import { randomBytes, scryptSync, timingSafeEqual } from 'crypto';
import { normalizeUserPermissions, unitLabelsFromIds } from '@/lib/user-access';

export type ServerManagedUser = {
  id: string;
  name: string;
  identifier: string;
  role: string;
  /** Champ historique conservé pour compatibilité d'affichage. Il est dérivé de allowedUnits et n'est jamais utilisé pour autoriser une route. */
  unit?: string;
  allowedUnits: string[];
  access: string[];
  assignedBuildings: string[];
  phone?: string;
  profilePhoto?: string;
  status: 'Actif' | 'Invité' | 'Suspendu';
  passwordHash: string;
  createdAt: string;
  updatedAt: string;
};

const storePath = path.join(process.cwd(), 'data', 'managed-users.json');

type UserInput = {
  id?: string;
  name: string;
  identifier: string;
  role: string;
  allowedUnits: string[];
  access: string[];
  assignedBuildings?: string[];
  phone?: string;
  profilePhoto?: string;
  status: ServerManagedUser['status'];
  password?: string;
};

async function writeUsers(users: ServerManagedUser[]) {
  await fs.mkdir(path.dirname(storePath), { recursive: true });
  await fs.writeFile(storePath, JSON.stringify(users, null, 2), 'utf8');
}

function normalizeStoredUser(user: ServerManagedUser): ServerManagedUser {
  // Les anciennes fiches pouvaient ne renseigner que `unit`. On l'utilise
  // uniquement une fois pour migrer vers la liste équivalente allowedUnits.
  const legacyUnits = user.allowedUnits?.length ? user.allowedUnits : user.unit ? [user.unit] : [];
  const permissions = normalizeUserPermissions(legacyUnits, user.access ?? []);
  return {
    ...user,
    unit: unitLabelsFromIds(permissions.allowedUnits).join(' · '),
    allowedUnits: permissions.allowedUnits,
    access: permissions.access,
    assignedBuildings: Array.isArray(user.assignedBuildings) ? user.assignedBuildings : [],
    phone: typeof user.phone === 'string' ? user.phone : '',
    profilePhoto: typeof user.profilePhoto === 'string' ? user.profilePhoto : '',
  };
}

/**
 * La lecture applique une migration légère des droits et unités hérités.
 * Les profils existants ne peuvent donc plus conserver un droit qui ne
 * correspond à aucune de leurs unités autorisées.
 */
async function readUsers(): Promise<ServerManagedUser[]> {
  try {
    const raw = JSON.parse(await fs.readFile(storePath, 'utf8')) as ServerManagedUser[];
    const normalized = raw.map(normalizeStoredUser);
    if (JSON.stringify(raw) !== JSON.stringify(normalized)) await writeUsers(normalized);
    return normalized;
  } catch {
    return [];
  }
}

export function hashManagedPassword(password: string) {
  const salt = randomBytes(16).toString('hex');
  return `${salt}:${scryptSync(password, salt, 64).toString('hex')}`;
}

export function verifyManagedPassword(password: string, stored: string) {
  try {
    const [salt, expectedHex] = stored.split(':');
    if (!salt || !expectedHex) return false;
    const actual = scryptSync(password, salt, 64);
    const expected = Buffer.from(expectedHex, 'hex');
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}

export async function listManagedUsers() {
  return readUsers();
}

export async function findManagedUser(identifier: string) {
  const normalized = identifier.trim().toLowerCase();
  return (await readUsers()).find((user) => user.identifier.trim().toLowerCase() === normalized);
}

export async function findManagedUserById(id: string) {
  return (await readUsers()).find((user) => user.id === id);
}

export async function upsertManagedUser(input: UserInput) {
  const users = await readUsers();
  const existing = input.id
    ? users.find((user) => user.id === input.id)
    : users.find((user) => user.identifier.trim().toLowerCase() === input.identifier.trim().toLowerCase());
  const permissions = normalizeUserPermissions(input.allowedUnits, input.access);
  const now = new Date().toISOString();
  const record: ServerManagedUser = {
    id: existing?.id ?? input.id ?? `USR-${Date.now()}`,
    name: input.name.trim(),
    identifier: input.identifier.trim(),
    role: input.role.trim(),
    unit: unitLabelsFromIds(permissions.allowedUnits).join(' · '),
    allowedUnits: permissions.allowedUnits,
    access: permissions.access,
    assignedBuildings: input.assignedBuildings ?? existing?.assignedBuildings ?? [],
    phone: input.phone ?? existing?.phone ?? '',
    profilePhoto: input.profilePhoto ?? existing?.profilePhoto ?? '',
    status: input.status,
    passwordHash: input.password ? hashManagedPassword(input.password) : existing?.passwordHash ?? '',
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
  await writeUsers(existing ? users.map((user) => user.id === existing.id ? record : user) : [record, ...users]);
  return record;
}

export async function updateManagedUser(
  id: string,
  patch: Partial<Pick<ServerManagedUser, 'name' | 'identifier' | 'role' | 'allowedUnits' | 'access' | 'assignedBuildings' | 'phone' | 'profilePhoto' | 'status'>> & { password?: string },
) {
  const users = await readUsers();
  const existing = users.find((user) => user.id === id);
  if (!existing) return null;
  const permissions = normalizeUserPermissions(patch.allowedUnits ?? existing.allowedUnits, patch.access ?? existing.access);
  const record: ServerManagedUser = {
    ...existing,
    name: patch.name?.trim() ?? existing.name,
    identifier: patch.identifier?.trim() ?? existing.identifier,
    role: patch.role?.trim() ?? existing.role,
    unit: unitLabelsFromIds(permissions.allowedUnits).join(' · '),
    allowedUnits: permissions.allowedUnits,
    access: permissions.access,
    assignedBuildings: patch.assignedBuildings ?? existing.assignedBuildings ?? [],
    phone: patch.phone ?? existing.phone ?? '',
    profilePhoto: patch.profilePhoto ?? existing.profilePhoto ?? '',
    status: patch.status ?? existing.status,
    passwordHash: patch.password ? hashManagedPassword(patch.password) : existing.passwordHash,
    updatedAt: new Date().toISOString(),
  };
  await writeUsers(users.map((user) => user.id === id ? record : user));
  return record;
}

export async function deleteManagedUser(id: string) {
  const users = await readUsers();
  await writeUsers(users.filter((user) => user.id !== id));
}
