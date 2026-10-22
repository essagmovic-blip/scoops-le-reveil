import { FARM_STORAGE_KEYS, readLocal, writeLocal } from '@/lib/farm-storage';

export const POULTRY_FEED_BAG_WEIGHT_KG = 50;

type FeedStockScope = 'central' | 'building';
export type PoultryFeedStockBalance = {
  id: string;
  scope: FeedStockScope;
  buildingId?: string;
  buildingName?: string;
  kilograms: number;
  updatedAt: string;
};

export type PoultryFeedStockMovementType = 'Réception centrale' | 'Approvisionnement bâtiment' | 'Consommation tâche' | 'Ajustement';
export type PoultryFeedStockMovement = {
  id: string;
  date: string;
  type: PoultryFeedStockMovementType;
  quantityKg: number;
  sacks: number;
  source: string;
  destination: string;
  buildingId?: string;
  buildingName?: string;
  batchId?: string;
  taskId?: string;
  operatorId: string;
  operatorName: string;
  reason: string;
};

type StockResult = { ok: true; balanceKg: number; movement?: PoultryFeedStockMovement; alreadyRecorded?: boolean } | { ok: false; message: string };

export function poultryFeedSackEquivalent(kilograms: number) {
  return Math.max(0, Number(kilograms) || 0) / POULTRY_FEED_BAG_WEIGHT_KG;
}

export function getPoultryCentralFeedStockKg() {
  return readBalances().find((balance) => balance.id === 'central')?.kilograms ?? 0;
}

export function getPoultryBuildingFeedStockKg(buildingId: string) {
  return readBalances().find((balance) => balance.id === `building:${buildingId}`)?.kilograms ?? 0;
}

export function receivePoultryCentralFeed(input: { sacks: number; operatorId: string; operatorName: string; reason?: string }): StockResult {
  const sacks = Math.floor(Number(input.sacks) || 0);
  if (sacks <= 0) return { ok: false, message: 'Indiquez un nombre de sacs supérieur à zéro.' };
  const quantityKg = sacks * POULTRY_FEED_BAG_WEIGHT_KG;
  const now = new Date();
  const balances = readBalances();
  const current = balances.find((balance) => balance.id === 'central')?.kilograms ?? 0;
  const nextBalanceKg = current + quantityKg;
  const movement: PoultryFeedStockMovement = { id: `ALIMENT-ENTREE-${Date.now()}`, date: now.toISOString(), type: 'Réception centrale', quantityKg, sacks, source: input.reason?.trim() || 'Réception aliment', destination: 'Stock central Poulets bio', operatorId: input.operatorId || 'unknown', operatorName: input.operatorName || 'Responsable stock', reason: input.reason?.trim() || 'Réception aliment' };
  writeStock(balances, [movement, ...readMovements()]);
  writeLocal(FARM_STORAGE_KEYS.poultryFeedStock, upsertBalance(balances, { id: 'central', scope: 'central', kilograms: nextBalanceKg, updatedAt: now.toISOString() }));
  return { ok: true, balanceKg: nextBalanceKg, movement };
}

export function supplyPoultryBuildingFeed(input: { buildingId: string; buildingName: string; batchId?: string; sacks: number; operatorId: string; operatorName: string; reason?: string }): StockResult {
  const sacks = Math.floor(Number(input.sacks) || 0);
  if (sacks <= 0) return { ok: false, message: 'Indiquez un nombre de sacs supérieur à zéro.' };
  const quantityKg = sacks * POULTRY_FEED_BAG_WEIGHT_KG;
  const balances = readBalances();
  const centralKg = balances.find((balance) => balance.id === 'central')?.kilograms ?? 0;
  if (centralKg < quantityKg) return { ok: false, message: `Stock central insuffisant : ${formatKg(centralKg)} kg disponibles, ${formatKg(quantityKg)} kg demandés.` };
  const now = new Date();
  const buildingId = `building:${input.buildingId}`;
  const buildingKg = balances.find((balance) => balance.id === buildingId)?.kilograms ?? 0;
  const movement: PoultryFeedStockMovement = { id: `ALIMENT-APPRO-${Date.now()}`, date: now.toISOString(), type: 'Approvisionnement bâtiment', quantityKg, sacks, source: 'Stock central Poulets bio', destination: input.buildingName, buildingId: input.buildingId, buildingName: input.buildingName, batchId: input.batchId || '', operatorId: input.operatorId || 'unknown', operatorName: input.operatorName || 'Responsable stock', reason: input.reason?.trim() || 'Approvisionnement du bâtiment' };
  const nextBalances = upsertBalance(upsertBalance(balances, { id: 'central', scope: 'central', kilograms: centralKg - quantityKg, updatedAt: now.toISOString() }), { id: buildingId, scope: 'building', buildingId: input.buildingId, buildingName: input.buildingName, kilograms: buildingKg + quantityKg, updatedAt: now.toISOString() });
  writeStock(nextBalances, [movement, ...readMovements()]);
  return { ok: true, balanceKg: buildingKg + quantityKg, movement };
}

export function consumePoultryBuildingFeed(input: { buildingId: string; buildingName: string; batchId?: string; quantityKg: number; taskId: string; operatorId: string; operatorName: string }): StockResult {
  const quantityKg = Math.max(0, Number(input.quantityKg) || 0);
  const movements = readMovements();
  const previous = movements.find((movement) => movement.type === 'Consommation tâche' && movement.taskId === input.taskId);
  if (previous) return { ok: true, balanceKg: getPoultryBuildingFeedStockKg(input.buildingId), movement: previous, alreadyRecorded: true };
  if (quantityKg === 0) return { ok: true, balanceKg: getPoultryBuildingFeedStockKg(input.buildingId) };
  const balances = readBalances();
  const id = `building:${input.buildingId}`;
  const currentKg = balances.find((balance) => balance.id === id)?.kilograms ?? 0;
  if (currentKg < quantityKg) return { ok: false, message: `Stock aliment insuffisant dans ${input.buildingName} : ${formatKg(currentKg)} kg disponibles, ${formatKg(quantityKg)} kg demandés.` };
  const now = new Date();
  const movement: PoultryFeedStockMovement = { id: `ALIMENT-CONS-${Date.now()}`, date: now.toISOString(), type: 'Consommation tâche', quantityKg, sacks: poultryFeedSackEquivalent(quantityKg), source: input.buildingName, destination: 'Consommation élevage', buildingId: input.buildingId, buildingName: input.buildingName, batchId: input.batchId || '', taskId: input.taskId, operatorId: input.operatorId || 'unknown', operatorName: input.operatorName || 'Responsable bâtiment', reason: 'Service aliment confirmé' };
  const nextBalances = upsertBalance(balances, { id, scope: 'building', buildingId: input.buildingId, buildingName: input.buildingName, kilograms: currentKg - quantityKg, updatedAt: now.toISOString() });
  writeStock(nextBalances, [movement, ...movements]);
  return { ok: true, balanceKg: currentKg - quantityKg, movement };
}

export function readPoultryFeedStockMovements() {
  return readMovements();
}

function readBalances() {
  return readLocal<PoultryFeedStockBalance[]>(FARM_STORAGE_KEYS.poultryFeedStock, []);
}

function readMovements() {
  return readLocal<PoultryFeedStockMovement[]>(FARM_STORAGE_KEYS.poultryFeedStockMovements, []);
}

function upsertBalance(balances: PoultryFeedStockBalance[], next: PoultryFeedStockBalance) {
  return [next, ...balances.filter((balance) => balance.id !== next.id)];
}

function writeStock(balances: PoultryFeedStockBalance[], movements: PoultryFeedStockMovement[]) {
  writeLocal(FARM_STORAGE_KEYS.poultryFeedStock, balances);
  writeLocal(FARM_STORAGE_KEYS.poultryFeedStockMovements, movements);
}

function formatKg(value: number) {
  return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 }).format(value);
}
