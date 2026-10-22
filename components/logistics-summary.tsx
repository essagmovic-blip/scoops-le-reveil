'use client';

import { useEffect, useMemo, useState } from 'react';
import { ArrowUpRight, Boxes, Truck } from 'lucide-react';
import { FARM_STORAGE_KEYS, readLocal, subscribeToFarmData } from '@/lib/farm-storage';
import { StatCard } from '@/components/ui';
import { formatNumber } from '@/lib/format';
import { internalUnitLabel, type InternalOrder } from '@/lib/internal-logistics';
import type { UnitId } from '@/lib/data';

type InvoiceLike = { id: string; unit: string; date: string; items?: number; lines?: Array<{ quantity?: number }>; status?: string };

export function LogisticsSummary({ unitId, from, to }: { unitId: Exclude<UnitId, 'rh'>; from?: string; to?: string }) {
  const [invoices, setInvoices] = useState<InvoiceLike[]>([]);
  const [orders, setOrders] = useState<InternalOrder[]>([]);
  useEffect(() => {
    const load = () => {
      setInvoices(readLocal<InvoiceLike[]>(FARM_STORAGE_KEYS.invoices, []).filter((invoice) => invoice.unit === unitId));
      setOrders(readLocal<InternalOrder[]>(FARM_STORAGE_KEYS.internalOrders, []).filter((order) => order.supplierUnitId === unitId));
    };
    load();
    return subscribeToFarmData([FARM_STORAGE_KEYS.invoices, FARM_STORAGE_KEYS.internalOrders], load);
  }, [unitId]);
  const filteredInvoices = useMemo(() => invoices.filter((invoice) => (!from || invoice.date >= from) && (!to || invoice.date <= to)), [invoices, from, to]);
  const filteredOrders = useMemo(() => orders.filter((order) => (!from || order.requestedDate >= from) && (!to || order.requestedDate <= to)), [orders, from, to]);
  const clientQuantity = filteredInvoices.reduce((sum, invoice) => sum + (invoice.lines?.reduce((lineSum, line) => lineSum + Number(line.quantity ?? 0), 0) || Number(invoice.items ?? 0)), 0);
  const internalQuantity = filteredOrders.filter((order) => order.status !== 'Annulée' && order.status !== 'En attente').reduce((sum, order) => sum + Number(order.quantity ?? 0), 0);
  return <div className="space-y-4"><div className="grid gap-4 sm:grid-cols-2"><StatCard label="Quantité vendue aux clients" value={formatNumber(clientQuantity)} change={`${filteredInvoices.length} facture(s)`} detail="facturation / caisse" icon={ArrowUpRight} tone="green" /><StatCard label="Quantité envoyée aux unités" value={formatNumber(internalQuantity)} change={`${filteredOrders.length} commande(s)`} detail="sorties internes séparées" icon={Truck} tone="blue" /></div><div className="rounded-xl border border-[#dce8db] bg-[#f5faf2] px-4 py-3 text-[11px] leading-5 text-[#5b8f60]"><Boxes size={14} className="mr-2 inline" />Les ventes clients utilisent les factures. Les sorties vers {filteredOrders.length ? internalUnitLabel(filteredOrders[0]?.recipientUnitId ?? '') : 'les autres unités'} utilisent les commandes inter-unités et ne passent jamais dans la caisse client.</div></div>;
}
