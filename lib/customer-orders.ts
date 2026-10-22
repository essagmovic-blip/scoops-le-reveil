import type { UnitId } from '@/lib/data';

export type CustomerOrderUnitId = Exclude<UnitId, 'rh'>;

export type CustomerOrderProductOption = { label: string; unit: string };
export const CUSTOMER_ORDER_PRODUCTS: Record<CustomerOrderUnitId, CustomerOrderProductOption[]> = {
  poulets: [{ label: 'Poulet de chair vivant', unit: 'tête' }, { label: 'Aliment poulet croissance', unit: 'kg' }],
  provenderie: [{ label: 'Aliment démarrage granulé', unit: 'kg' }, { label: 'Aliment croissance granulé', unit: 'kg' }, { label: 'Aliment finition granulé', unit: 'kg' }],
  bio: [{ label: 'Complément végétal', unit: 'kg' }, { label: 'Préparation bio en poudre', unit: 'kg' }, { label: 'Préparation bio liquide', unit: 'litre' }],
  pressoir: [{ label: 'Huile de soja', unit: 'litre' }, { label: 'Huile d’arachide', unit: 'litre' }, { label: 'Huile de coton', unit: 'litre' }, { label: 'Tourteaux', unit: 'kg' }],
  stocks: [{ label: 'Produit agricole', unit: 'unité' }, { label: 'Machine agricole', unit: 'unité' }, { label: 'Caisse', unit: 'unité' }],
  chevrerie: [{ label: 'Lait de chèvre', unit: 'litre' }, { label: 'Chèvre adulte', unit: 'tête' }, { label: 'Chevreau', unit: 'unité' }, { label: 'Fumier de chèvre', unit: 'kg' }],
};

export function customerOrderProducts(unitId: string) {
  return CUSTOMER_ORDER_PRODUCTS[unitId as CustomerOrderUnitId] ?? [];
}

export type CustomerOrderStatus = 'Reçue' | 'Confirmée' | 'En préparation' | 'Prête' | 'En livraison' | 'Livrée' | 'Annulée';
export type CustomerOrderPaymentStatus = 'À payer' | 'Partiellement payée' | 'Payée';

export type CustomerOrderLine = {
  id: string;
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  total: number;
};

export type CustomerOrder = {
  id: string;
  code: string;
  createdAt: string;
  requestedDate: string;
  unitId: CustomerOrderUnitId;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  deliveryAddress: string;
  note: string;
  lines: CustomerOrderLine[];
  amount: number;
  paidAmount: number;
  paymentStatus: CustomerOrderPaymentStatus;
  status: CustomerOrderStatus;
  qrPayload: string;
  confirmedAt: string;
  preparedAt: string;
  readyAt: string;
  departedAt: string;
  deliveredAt: string;
  deliveryComment: string;
  deliveredBy: string;
  stockDeductedAt: string;
  invoiceId: string;
};

export function customerOrderStatusLabel(status: CustomerOrderStatus) {
  return status;
}

export function customerOrderStatusClass(status: CustomerOrderStatus) {
  if (status === 'Livrée') return 'bg-[#edf8e9] text-[#5b9d5b]';
  if (status === 'Annulée') return 'bg-[#fdeceb] text-[#bd5c5c]';
  if (status === 'En livraison') return 'bg-[#edf3ff] text-[#6385bd]';
  if (status === 'Prête') return 'bg-[#fff2e2] text-[#bd7737]';
  return 'bg-[#f1f5ef] text-[#66766d]';
}

export function customerOrderUnitLabel(unitId: string) {
  const labels: Record<CustomerOrderUnitId, string> = { poulets: 'Poulets bio', provenderie: 'Provenderie', bio: 'Produits bio', pressoir: 'Pressoir à huile', stocks: 'Magasin central', chevrerie: 'Chèvrerie' };
  return labels[unitId as CustomerOrderUnitId] ?? unitId;
}

export function customerOrderTotal(lines: CustomerOrderLine[]) {
  return lines.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0);
}
