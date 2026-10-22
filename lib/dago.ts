export type DagoStatus = 'En attente de réception' | 'En attente confirmation bâtiment' | 'Réceptionné bon état' | 'Litige en attente RH' | 'Validé RH' | 'Rejeté RH';
export type DagoCondition = 'Bon état' | 'Poulet(s) gâté(s)/abîmé(s)' | '';
export type DagoSourceLocation = 'grande-salle' | 'clinique';
export type DagoReport = {
  id: string;
  reportedAt: string;
  reportedDate: string;
  buildingId: string;
  buildingName: string;
  batchId: string;
  /** Emplacement d’origine des sujets morts constatés. */
  sourceLocation?: DagoSourceLocation;
  quantity: number;
  reportedById: string;
  reportedByName: string;
  status: DagoStatus;
  receivedAt: string;
  receivedById: string;
  receivedByName: string;
  buildingConfirmationStatus?: 'En attente' | 'Confirmé' | 'Refusé';
  buildingConfirmedAt?: string;
  buildingConfirmedById?: string;
  buildingConfirmedByName?: string;
  buildingConfirmationComment?: string;
  goodQuantity: number;
  spoiledQuantity: number;
  /** Répartition détaillée de la mortalité constatée à la réception. */
  freshQuantity?: number;
  decomposedQuantity?: number;
  clinicQuantity?: number;
  clinicComment?: string;
  condition: DagoCondition;
  conditionNote: string;
  graceDeadline: string;
  responsibleId: string;
  responsibleName: string;
  proposedResponsibleId?: string;
  proposedResponsibleName?: string;
  productionCostPerBird: number;
  amount: number;
  rhStatus: 'Aucune' | 'En attente validation RH' | 'Validé RH' | 'Rejeté RH';
  rhComment: string;
  rhValidatedAt: string;
};

export function dagoGraceDeadline(reportedAt: string, minutes: number) { return new Date(new Date(reportedAt).getTime() + Math.max(0, minutes) * 60000).toISOString(); }
export function dagoWithinGrace(report: Pick<DagoReport, 'graceDeadline'>, receivedAt: string) { return new Date(receivedAt).getTime() <= new Date(report.graceDeadline).getTime(); }
export function dagoResponsibility(report: DagoReport, receivedAt: string, spoiledQuantity: number) { return spoiledQuantity > 0 && dagoWithinGrace(report, receivedAt) ? { id: report.reportedById, name: report.reportedByName } : { id: report.receivedById, name: report.receivedByName }; }
export function dagoSettings(settings: { dagoGracePeriodMinutes: number; poultryProductionCostPerBird: number }) { return { grace: settings.dagoGracePeriodMinutes, cost: settings.poultryProductionCostPerBird }; }
export function validatedDagoSummary(employeeIds: string | string[], period: string, reports: DagoReport[]) { const ids = Array.isArray(employeeIds) ? employeeIds : [employeeIds]; const selected = reports.filter((report) => ids.includes(report.responsibleId) && report.rhStatus === 'Validé RH' && report.reportedDate.startsWith(period)); return { penalty: selected.reduce((sum, report) => sum + report.amount, 0), count: selected.length }; }
