import { FARM_STORAGE_KEYS, readLocal, writeLocal } from '@/lib/farm-storage';

export type PoultrySubjectLocation = 'grande-salle' | 'clinique';
export type PoultrySubjectLocationState = {
  id: string;
  buildingId: string;
  buildingName: string;
  batchId: string;
  grandeSalleQuantity: number;
  clinicQuantity: number;
  updatedAt: string;
};

export type PoultrySubjectLocationMovement = {
  id: string;
  date: string;
  buildingId: string;
  buildingName: string;
  batchId: string;
  from: PoultrySubjectLocation;
  to: PoultrySubjectLocation;
  quantity: number;
  reason: string;
  operatorId: string;
  operatorName: string;
};

export type PoultryLocationBuilding = { id: string; name: string; batch?: string; current?: number; status?: string };

export function poultrySubjectLocationLabel(location: PoultrySubjectLocation) {
  return location === 'grande-salle' ? 'Grande salle' : 'Clinique';
}

export function poultrySubjectLocationTotal(state: Pick<PoultrySubjectLocationState, 'grandeSalleQuantity' | 'clinicQuantity'>) {
  return Math.max(0, Number(state.grandeSalleQuantity) || 0) + Math.max(0, Number(state.clinicQuantity) || 0);
}

export function syncPoultrySubjectLocations(buildings: PoultryLocationBuilding[], existing = readLocal<PoultrySubjectLocationState[]>(FARM_STORAGE_KEYS.poultrySubjectLocations, []), now = new Date()) {
  const next = [...existing];
  for (const building of buildings) {
    if (!building.id || !building.batch || building.batch === '—' || Number(building.current || 0) <= 0) continue;
    const found = next.find((state) => state.buildingId === building.id && state.batchId === building.batch);
    if (found) {
      found.buildingName = building.name;
      found.updatedAt = found.updatedAt || now.toISOString();
      continue;
    }
    next.push({ id: `LOC-${building.id}-${building.batch}`, buildingId: building.id, buildingName: building.name, batchId: building.batch, grandeSalleQuantity: Math.max(0, Math.floor(Number(building.current) || 0)), clinicQuantity: 0, updatedAt: now.toISOString() });
  }
  return next;
}

export function movePoultrySubjects(input: { building: PoultryLocationBuilding; from: PoultrySubjectLocation; to: PoultrySubjectLocation; quantity: number; reason: string; operatorId: string; operatorName: string; date?: string }) {
  if (input.from === input.to || input.quantity <= 0 || !input.reason.trim()) return { ok: false as const, message: 'Indiquez deux emplacements différents, une quantité positive et un motif.' };
  const states = syncPoultrySubjectLocations([input.building]);
  const state = states.find((item) => item.buildingId === input.building.id && item.batchId === input.building.batch);
  if (!state) return { ok: false as const, message: 'Aucun stock vivant n’est initialisé pour ce bâtiment et cette bande.' };
  const available = input.from === 'grande-salle' ? state.grandeSalleQuantity : state.clinicQuantity;
  const quantity = Math.floor(Number(input.quantity) || 0);
  if (quantity <= 0 || quantity > available) return { ok: false as const, message: `Quantité indisponible dans ${poultrySubjectLocationLabel(input.from)} : ${available} sujet(s) disponible(s).` };
  if (input.from === 'grande-salle') {
    state.grandeSalleQuantity -= quantity;
    state.clinicQuantity += quantity;
  } else {
    state.clinicQuantity -= quantity;
    state.grandeSalleQuantity += quantity;
  }
  const now = new Date().toISOString();
  state.updatedAt = now;
  const movement: PoultrySubjectLocationMovement = { id: `LOC-MVT-${Date.now()}`, date: input.date ?? now.slice(0, 10), buildingId: input.building.id, buildingName: input.building.name, batchId: input.building.batch ?? '', from: input.from, to: input.to, quantity, reason: input.reason.trim(), operatorId: input.operatorId, operatorName: input.operatorName };
  const movements = readLocal<PoultrySubjectLocationMovement[]>(FARM_STORAGE_KEYS.poultrySubjectLocationMovements, []);
  writeLocal(FARM_STORAGE_KEYS.poultrySubjectLocations, states);
  writeLocal(FARM_STORAGE_KEYS.poultrySubjectLocationMovements, [movement, ...movements]);
  return { ok: true as const, state, movement };
}
