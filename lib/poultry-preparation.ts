import type { PoultryNurseryNeeds } from '@/lib/farm-calculations';

export type PreparationAnswer = 'Oui' | 'Non';
export type RoomPreparationStatus = 'Prête' | 'À compléter';

export type PoultryRoomPreparation = {
  id: string;
  buildingId: string;
  buildingName: string;
  batchId: string;
  j0Date: string;
  preparationDate: string;
  plannedCount: number;
  dimensioning: Pick<PoultryNurseryNeeds, 'requiredSurfaceM2' | 'initialBeddingBags' | 'totalBeddingBags' | 'drinkers' | 'feeders' | 'radiants'>;
  drinkersRinsed: PreparationAnswer;
  feedersRinsed: PreparationAnswer;
  heatingStarted: PreparationAnswer;
  comment: string;
  status: RoomPreparationStatus;
  recordedById: string;
  recordedByName: string;
  recordedAt: string;
};

export type PoultryChickReception = {
  id: string;
  buildingId: string;
  buildingName: string;
  batchId: string;
  j0Date: string;
  cartonsDelivered: number;
  chicksDelivered: number;
  deadInCrate: number;
  startingWeightKg: number;
  installationCompleted: PreparationAnswer;
  rehydrationStartAt: string;
  rehydrationEndAt: string;
  solutionServiceMinutes: number;
  feedStartAt: string;
  comment: string;
  recordedById: string;
  recordedByName: string;
  recordedAt: string;
};

export function roomPreparationStatus(preparation: Pick<PoultryRoomPreparation, 'drinkersRinsed' | 'feedersRinsed' | 'heatingStarted'>): RoomPreparationStatus {
  return preparation.drinkersRinsed === 'Oui' && preparation.feedersRinsed === 'Oui' && preparation.heatingStarted === 'Oui' ? 'Prête' : 'À compléter';
}

export function validRehydrationWindow(startAt: string, endAt: string, maximumMinutes = 180) {
  const start = new Date(startAt).getTime();
  const end = new Date(endAt).getTime();
  const minutes = Math.round((end - start) / 60000);
  return Number.isFinite(start) && Number.isFinite(end) && minutes >= 0 && minutes <= maximumMinutes ? minutes : null;
}
