import { units, type UnitId } from '@/lib/data';

export type InternalOrderUnitId = Exclude<UnitId, 'rh'>;
export type InternalOrderStatus = 'En attente' | 'En livraison' | 'Reçue conforme' | 'Reçue incomplète' | 'Reçue endommagée' | 'Annulée';
export type InternalOrderCondition = 'Bon état' | 'Endommagée' | '';
export type DeliveryMissionStatus = 'À assigner' | 'En cours' | 'Arrivée signalée' | 'Terminée';

export type InternalOrder = {
  id: string;
  createdAt: string;
  requestedDate: string;
  supplierUnitId: InternalOrderUnitId;
  recipientUnitId: InternalOrderUnitId;
  product: string;
  quantity: number;
  unit: string;
  requestedById: string;
  requestedByName: string;
  status: InternalOrderStatus;
  departedAt: string;
  departedById: string;
  arrivedAt: string;
  arrivedById: string;
  requestedQuantity: number;
  receivedQuantity: number;
  missingQuantity: number;
  condition: InternalOrderCondition;
  damageComment: string;
  receptionComment: string;
  deliveryMinutes: number;
  stockDebitedAt: string;
  stockReceivedAt: string;
  assignedDelivererId?: string;
  assignedDelivererName?: string;
  deliveryMissionStatus?: DeliveryMissionStatus;
  delivererConfirmedAt?: string;
  delivererConfirmedById?: string;
};

export type LogisticsNotification = {
  id: string;
  createdAt: string;
  recipientUnitId: InternalOrderUnitId;
  recipientUserId?: string;
  recipientUserName?: string;
  orderId: string;
  title: string;
  message: string;
  kind?: 'mission' | 'unit' | 'reception';
  read: boolean;
};

export const internalOrderUnits = units.filter((unit) => unit.id !== 'rh');

export function internalUnitLabel(unitId: string) {
  return units.find((unit) => unit.id === unitId)?.shortLabel ?? unitId;
}

export function deliveryMinutesBetween(departedAt: string, arrivedAt: string) {
  if (!departedAt || !arrivedAt) return 0;
  return Math.max(0, Math.round((new Date(arrivedAt).getTime() - new Date(departedAt).getTime()) / 60000));
}

export function formatDeliveryDuration(minutes: number) {
  if (!minutes) return '—';
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return hours ? `${hours} h${rest ? ` ${rest} min` : ''}` : `${rest} min`;
}

export function orderStatusLabel(status: InternalOrderStatus) {
  return status;
}

export function orderIsVisible(order: InternalOrder, allowedUnits: readonly string[], isAdmin: boolean) {
  return isAdmin || allowedUnits.includes(order.supplierUnitId) || allowedUnits.includes(order.recipientUnitId);
}

export function isDelivererProfile(profile: { role?: string | null; access?: readonly string[] | null }) {
  const role = profile.role?.trim().toLowerCase() ?? '';
  return role.includes('livreur') || (profile.access ?? []).some((right) => right.trim().toLowerCase() === 'livreur');
}

export function deliveryMissionStatus(order: Pick<InternalOrder, 'status' | 'assignedDelivererId' | 'delivererConfirmedAt' | 'deliveryMissionStatus'>): DeliveryMissionStatus {
  if (order.status.startsWith('Reçue') || order.status === 'Annulée' || order.deliveryMissionStatus === 'Terminée') return 'Terminée';
  if (!order.assignedDelivererId) return 'À assigner';
  if (order.delivererConfirmedAt || order.deliveryMissionStatus === 'Arrivée signalée') return 'Arrivée signalée';
  return 'En cours';
}
