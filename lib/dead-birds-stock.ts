import type { DagoReport } from '@/lib/dago';
import { FARM_STORAGE_KEYS, readLocal, writeLocal } from '@/lib/farm-storage';

export type DeadBirdStockItem = {
  id: string;
  reportId: string;
  receivedAt: string;
  receivedDate: string;
  buildingId: string;
  buildingName: string;
  batchId: string;
  sourceLocation?: 'grande-salle' | 'clinique';
  quantityReceived: number;
  quantityVendable: number;
  quantitySpoiled: number;
  quantityClinic?: number;
  quantitySold: number;
  quantityDisposedVendable: number;
  quantityDisposedSpoiled: number;
};

export type DeadBirdStockMovement = {
  id: string;
  date: string;
  type: 'Entrée' | 'Vente' | 'Sortie / destruction';
  stockId: string;
  reportId: string;
  buildingName: string;
  batchId: string;
  sourceLocation?: 'grande-salle' | 'clinique';
  quantity: number;
  source?: 'Vendable' | 'Gâté / isolé';
  unitPrice?: number;
  amount?: number;
  customer?: string;
  method?: string;
  reason: string;
  operator: string;
};

export function stockItemFromReport(report: DagoReport): DeadBirdStockItem {
  const spoiled = Math.max(0, Number(report.decomposedQuantity ?? report.spoiledQuantity ?? 0));
  const clinic = Math.max(0, Number(report.clinicQuantity || 0));
  const reportedFresh = Number(report.freshQuantity ?? report.goodQuantity);
  const vendable = report.freshQuantity !== undefined || report.decomposedQuantity !== undefined || report.clinicQuantity !== undefined
    ? Math.max(0, reportedFresh)
    : reportedFresh > 0 || spoiled > 0 ? Math.max(0, reportedFresh) : Math.max(0, Number(report.quantity || 0) - spoiled);
  return {
    id: `STK-MORT-${report.id}`,
    reportId: report.id,
    receivedAt: report.receivedAt,
    receivedDate: report.receivedAt.slice(0, 10),
    buildingId: report.buildingId,
    buildingName: report.buildingName,
    batchId: report.batchId,
    sourceLocation: report.sourceLocation,
    quantityReceived: Math.max(0, Number(report.quantity || 0)),
    quantityVendable: vendable,
    quantitySpoiled: spoiled,
    quantityClinic: clinic,
    quantitySold: 0,
    quantityDisposedVendable: 0,
    quantityDisposedSpoiled: 0,
  };
}

export function reconcileDeadBirdStock(reports: DagoReport[], current: DeadBirdStockItem[]) {
  const receivedReports = reports.filter((report) => Boolean(report.receivedAt));
  const currentByReport = new Map(current.map((item) => [item.reportId, item]));
  const receivedIds = new Set(receivedReports.map((report) => report.id));
  const next = receivedReports.map((report) => {
    const base = stockItemFromReport(report);
    const existing = currentByReport.get(report.id);
    if (!existing) return base;
    return { ...existing, ...base, quantitySold: existing.quantitySold, quantityDisposedVendable: existing.quantityDisposedVendable, quantityDisposedSpoiled: existing.quantityDisposedSpoiled };
  });
  return [...next, ...current.filter((item) => !receivedIds.has(item.reportId))];
}

export function remainingVendable(item: DeadBirdStockItem) {
  return Math.max(0, Number(item.quantityVendable || 0) - Number(item.quantitySold || 0) - Number(item.quantityDisposedVendable || 0));
}

export function remainingSpoiled(item: DeadBirdStockItem) {
  return Math.max(0, Number(item.quantitySpoiled || 0) - Number(item.quantityDisposedSpoiled || 0));
}

export function registerDeadBirdStockSale(input: { invoiceId: string; stockId: string; date: string; quantity: number; unitPrice: number; amount: number; customer: string; paymentMethod: string; operator?: string }) {
  const items = readLocal<DeadBirdStockItem[]>(FARM_STORAGE_KEYS.deadBirdStock, []);
  const item = items.find((current) => current.id === input.stockId);
  if (!item || input.quantity <= 0 || input.unitPrice <= 0 || input.quantity > remainingVendable(item)) return false;
  const nextItems = items.map((current) => current.id === item.id ? { ...current, quantitySold: current.quantitySold + input.quantity } : current);
  const movement: DeadBirdStockMovement = { id: `MORT-VENTE-${input.invoiceId}`, date: input.date, type: 'Vente', stockId: item.id, reportId: item.reportId, buildingName: item.buildingName, batchId: item.batchId, sourceLocation: item.sourceLocation, quantity: input.quantity, source: 'Vendable', unitPrice: input.unitPrice, amount: input.amount, customer: input.customer, method: input.paymentMethod, reason: `Vente enregistrée par la facture ${input.invoiceId}`, operator: input.operator ?? 'Administrateur' };
  const movements = readLocal<DeadBirdStockMovement[]>(FARM_STORAGE_KEYS.deadBirdStockMovements, []);
  writeLocal(FARM_STORAGE_KEYS.deadBirdStock, nextItems);
  writeLocal(FARM_STORAGE_KEYS.deadBirdStockMovements, [movement, ...movements.filter((current) => current.id !== movement.id)]);
  return true;
}
