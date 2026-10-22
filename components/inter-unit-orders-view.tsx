'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, Check, Clock3, ExternalLink, PackageCheck, Plus, Search, Truck, X } from 'lucide-react';
import { FARM_STORAGE_KEYS, readLocal, subscribeToFarmData, writeLocal } from '@/lib/farm-storage';
import { Modal, SectionHeading, StatCard } from '@/components/ui';
import { StatusBadge } from '@/components/status-badge';
import {
  deliveryMissionStatus,
  formatDeliveryDuration,
  deliveryMinutesBetween,
  internalOrderUnits,
  internalUnitLabel,
  orderIsVisible,
  type InternalOrder,
  type InternalOrderCondition,
  type InternalOrderStatus,
  type InternalOrderUnitId,
  type LogisticsNotification,
} from '@/lib/internal-logistics';

const unitIds = internalOrderUnits.map((unit) => unit.id) as InternalOrderUnitId[];
type StockRecord = { id: string; name?: string; itemName?: string; quantity: number; unit: string; [key: string]: unknown };
type DelivererOption = { id: string; name: string; role: string; allowedUnits: string[] };
type SessionUser = { id: string; name: string; role: string };

export function InterUnitOrdersView({ scopeUnitId }: { scopeUnitId?: InternalOrderUnitId }) {
  const [orders, setOrders] = useState<InternalOrder[]>([]);
  const [notifications, setNotifications] = useState<LogisticsNotification[]>([]);
  const [deliverers, setDeliverers] = useState<DelivererOption[]>([]);
  const [allowedUnits, setAllowedUnits] = useState<string[]>([]);
  const [sessionAccess, setSessionAccess] = useState<string[]>([]);
  const [currentUser, setCurrentUser] = useState<SessionUser>({ id: 'unknown', name: 'Utilisateur', role: '' });
  const [isAdmin, setIsAdmin] = useState(false);
  const [open, setOpen] = useState(false);
  const [departing, setDeparting] = useState<InternalOrder | null>(null);
  const [receiving, setReceiving] = useState<InternalOrder | null>(null);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'Tous' | InternalOrderStatus>('Tous');
  const [showAll, setShowAll] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const cookieMap = Object.fromEntries(document.cookie.split('; ').filter(Boolean).map((part) => {
      const index = part.indexOf('=');
      return [part.slice(0, index), decodeURIComponent(part.slice(index + 1))];
    }));
    setIsAdmin(cookieMap.agroflux_is_admin === '1');
    setCurrentUser({ id: cookieMap.agroflux_user_id || 'unknown', name: cookieMap.agroflux_user_name || 'Utilisateur', role: cookieMap.agroflux_role || '' });
    try { setAllowedUnits(JSON.parse(cookieMap.agroflux_allowed_units || '[]')); } catch { setAllowedUnits([]); }
    try { setSessionAccess(JSON.parse(cookieMap.agroflux_access || '[]')); } catch { setSessionAccess([]); }

    const load = () => {
      setOrders(readLocal<InternalOrder[]>(FARM_STORAGE_KEYS.internalOrders, []));
      setNotifications(readLocal<LogisticsNotification[]>(FARM_STORAGE_KEYS.logisticsNotifications, []));
      setNow(Date.now());
    };
    const loadDeliverers = async () => {
      try {
        const params = new URLSearchParams();
        if (scopeUnitId) params.set('supplierUnitId', scopeUnitId);
        const response = await fetch(`/api/logistics/deliverers${params.toString() ? `?${params.toString()}` : ''}`, { cache: 'no-store' });
        if (!response.ok) return;
        const data = await response.json() as { deliverers?: DelivererOption[] };
        setDeliverers(data.deliverers ?? []);
      } catch {
        setDeliverers([]);
      }
    };

    load();
    void loadDeliverers();
    const refreshTimer = window.setInterval(load, 5000);
    const unsubscribe = subscribeToFarmData([FARM_STORAGE_KEYS.internalOrders, FARM_STORAGE_KEYS.logisticsNotifications], load);
    return () => { window.clearInterval(refreshTimer); unsubscribe(); };
  }, [scopeUnitId]);

  const scopedOrders = useMemo(() => orders.filter((order) => orderIsVisible(order, allowedUnits, isAdmin) && (!scopeUnitId || showAll || order.supplierUnitId === scopeUnitId || order.recipientUnitId === scopeUnitId)), [orders, allowedUnits, isAdmin, scopeUnitId, showAll]);
  const matchesQuery = (order: InternalOrder) => `${order.id} ${order.product} ${internalUnitLabel(order.supplierUnitId)} ${internalUnitLabel(order.recipientUnitId)} ${order.assignedDelivererName ?? ''}`.toLowerCase().includes(query.trim().toLowerCase());
  const visibleOrders = scopedOrders.filter((order) => (statusFilter === 'Tous' || order.status === statusFilter) && matchesQuery(order));
  const activeDeliveryOrders = scopedOrders.filter((order) => order.status === 'En livraison' && matchesQuery(order));
  const pending = visibleOrders.filter((order) => order.status === 'En attente').length;
  const inDelivery = visibleOrders.filter((order) => order.status === 'En livraison').length;
  const received = visibleOrders.filter((order) => order.status.startsWith('Reçue')).length;
  const visibleNotifications = notifications.filter((item) => !item.read && (item.recipientUserId ? item.recipientUserId === currentUser.id : isAdmin || allowedUnits.includes(item.recipientUnitId))).slice(0, 8);
  const canOpenDeliverySpace = isAdmin || sessionAccess.includes('Commandes clients') || sessionAccess.includes('Livreur') || currentUser.role.toLowerCase().includes('livreur');

  function notify(message: string) {
    setFeedback(message);
    window.setTimeout(() => setFeedback(''), 4200);
  }

  function persistOrders(next: InternalOrder[]) {
    setOrders(next);
    writeLocal(FARM_STORAGE_KEYS.internalOrders, next);
  }

  function persistNotifications(next: LogisticsNotification[]) {
    setNotifications(next);
    writeLocal(FARM_STORAGE_KEYS.logisticsNotifications, next);
  }

  function createOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const supplierUnitId = String(form.get('supplierUnitId') ?? '') as InternalOrderUnitId;
    const recipientUnitId = String(form.get('recipientUnitId') ?? '') as InternalOrderUnitId;
    const product = String(form.get('product') ?? '').trim();
    const quantity = Number(form.get('quantity') ?? 0);
    const unit = String(form.get('unit') ?? 'kg');
    const requestedDate = String(form.get('requestedDate') ?? new Date().toISOString().slice(0, 10));
    const canWriteSupplier = isAdmin || allowedUnits.includes(supplierUnitId);
    const canWriteRecipient = isAdmin || allowedUnits.includes(recipientUnitId);
    if (!unitIds.includes(supplierUnitId) || !unitIds.includes(recipientUnitId) || supplierUnitId === recipientUnitId || (scopeUnitId && supplierUnitId !== scopeUnitId && recipientUnitId !== scopeUnitId) || !canWriteSupplier || !canWriteRecipient || !product || quantity <= 0) {
      notify('Choisissez deux unités différentes autorisées, un produit et une quantité valide.');
      return;
    }
    const createdAt = new Date().toISOString();
    const order: InternalOrder = {
      id: `CMD-INT-${Date.now()}`,
      createdAt,
      requestedDate,
      supplierUnitId,
      recipientUnitId,
      product,
      quantity,
      unit,
      requestedById: currentUser.id,
      requestedByName: currentUser.name,
      status: 'En attente',
      departedAt: '',
      departedById: '',
      arrivedAt: '',
      arrivedById: '',
      requestedQuantity: quantity,
      receivedQuantity: 0,
      missingQuantity: 0,
      condition: '',
      damageComment: '',
      receptionComment: '',
      deliveryMinutes: 0,
      stockDebitedAt: '',
      stockReceivedAt: '',
      deliveryMissionStatus: 'À assigner',
    };
    persistOrders([order, ...orders]);
    setOpen(false);
    notify(`La commande ${order.id} a été envoyée à ${internalUnitLabel(recipientUnitId)}.`);
  }

  function openDeparture(order: InternalOrder) {
    if (!isAdmin && !allowedUnits.includes(order.supplierUnitId)) {
      notify('Seule l’unité fournisseuse peut marquer le départ.');
      return;
    }
    if (order.status !== 'En attente') return;
    if (!deliverers.length) {
      notify('Aucun livreur actif n’est disponible. Créez un compte avec le rôle ou le droit « Livreur ».');
      return;
    }
    setDeparting(order);
  }

  function confirmDeparture(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!departing) return;
    const delivererId = String(new FormData(event.currentTarget).get('assignedDelivererId') ?? '');
    const deliverer = deliverers.find((item) => item.id === delivererId);
    if (!deliverer) {
      notify('La sélection d’un livreur est obligatoire avant le départ.');
      return;
    }
    markDeparture(departing, deliverer);
  }

  function markDeparture(order: InternalOrder, deliverer: DelivererOption) {
    if (!isAdmin && !allowedUnits.includes(order.supplierUnitId)) {
      notify('Seule l’unité fournisseuse peut marquer le départ.');
      return;
    }
    if (order.status !== 'En attente') return;
    const departedAt = new Date().toISOString();
    if (!adjustUnitStock(order.supplierUnitId, order.product, -order.quantity, order.unit)) {
      notify(`L’article « ${order.product} » n’a pas été trouvé ou son unité ne correspond pas au stock de ${internalUnitLabel(order.supplierUnitId)}.`);
      return;
    }
    const nextOrder: InternalOrder = {
      ...order,
      status: 'En livraison',
      departedAt,
      departedById: currentUser.id,
      stockDebitedAt: departedAt,
      assignedDelivererId: deliverer.id,
      assignedDelivererName: deliverer.name,
      deliveryMissionStatus: 'En cours',
    };
    const stockMovements = readLocal<Array<Record<string, unknown>>>(FARM_STORAGE_KEYS.interUnitMovements, []);
    writeLocal(FARM_STORAGE_KEYS.interUnitMovements, [{ id: `CMD-MVT-${Date.now()}`, date: departedAt.slice(0, 10), from: order.supplierUnitId, to: order.recipientUnitId, product: order.product, quantity: order.quantity, unit: order.unit, status: 'En livraison', type: 'Sortie interne', cause: 'Commande inter-unités', reference: order.id, requestedBy: currentUser.name, assignedDelivererId: deliverer.id, assignedDelivererName: deliverer.name }, ...stockMovements]);
    persistOrders(orders.map((item) => item.id === order.id ? nextOrder : item));
    persistNotifications([
      {
        id: `LOG-MISSION-${order.id}-${Date.now()}`,
        createdAt: departedAt,
        recipientUnitId: order.recipientUnitId,
        recipientUserId: deliverer.id,
        recipientUserName: deliverer.name,
        orderId: order.id,
        title: 'Mission de livraison inter-unités',
        message: `${order.product} · ${order.quantity} ${order.unit} · ${internalUnitLabel(order.supplierUnitId)} → ${internalUnitLabel(order.recipientUnitId)}. Départ à ${new Date(departedAt).toLocaleString('fr-FR')}.`,
        kind: 'mission',
        read: false,
      },
      {
        id: `LOG-UNIT-${order.id}-${Date.now()}`,
        createdAt: departedAt,
        recipientUnitId: order.recipientUnitId,
        orderId: order.id,
        title: 'Livraison inter-unités en cours',
        message: `${deliverer.name} transporte ${order.quantity} ${order.unit} de ${order.product} depuis ${internalUnitLabel(order.supplierUnitId)}.`,
        kind: 'unit',
        read: false,
      },
      ...notifications,
    ]);
    setDeparting(null);
    notify(`Départ enregistré. ${deliverer.name} a reçu sa mission dans l’espace livreur.`);
  }

  function confirmReception(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!receiving) return;
    if (!isAdmin && !allowedUnits.includes(receiving.recipientUnitId)) {
      notify('Seule l’unité destinataire peut confirmer la réception.');
      return;
    }
    const form = new FormData(event.currentTarget);
    const condition = String(form.get('condition') ?? '') as InternalOrderCondition;
    const receivedQuantity = Number(form.get('receivedQuantity') ?? 0);
    const comment = String(form.get('receptionComment') ?? '').trim();
    const damageComment = String(form.get('damageComment') ?? '').trim();
    if (!['Bon état', 'Endommagée'].includes(condition) || receivedQuantity < 0 || receivedQuantity > receiving.quantity || (condition === 'Endommagée' && !damageComment)) {
      notify('État, quantité et commentaire d’endommagement sont obligatoires si nécessaire.');
      return;
    }
    const arrivedAt = new Date().toISOString();
    const missingQuantity = Math.max(receiving.quantity - receivedQuantity, 0);
    const status: InternalOrderStatus = condition === 'Endommagée' ? 'Reçue endommagée' : missingQuantity > 0 ? 'Reçue incomplète' : 'Reçue conforme';
    if (receivedQuantity > 0) adjustUnitStock(receiving.recipientUnitId, receiving.product, receivedQuantity, receiving.unit);
    const nextOrder: InternalOrder = {
      ...receiving,
      status,
      arrivedAt,
      arrivedById: currentUser.id,
      receivedQuantity,
      missingQuantity,
      condition,
      damageComment,
      receptionComment: comment,
      deliveryMinutes: deliveryMinutesBetween(receiving.departedAt, arrivedAt),
      stockReceivedAt: arrivedAt,
      deliveryMissionStatus: 'Terminée',
    };
    const stockMovements = readLocal<Array<Record<string, unknown>>>(FARM_STORAGE_KEYS.interUnitMovements, []);
    writeLocal(FARM_STORAGE_KEYS.interUnitMovements, [{ id: `CMD-MVT-${Date.now()}`, date: arrivedAt.slice(0, 10), from: receiving.supplierUnitId, to: receiving.recipientUnitId, product: receiving.product, quantity: receivedQuantity, unit: receiving.unit, status, type: 'Réception interne', cause: 'Commande inter-unités', reference: receiving.id, requestedBy: currentUser.name, missingQuantity }, ...stockMovements]);
    persistOrders(orders.map((item) => item.id === receiving.id ? nextOrder : item));
    const completionMessage = `${internalUnitLabel(receiving.recipientUnitId)} a réceptionné ${receivedQuantity}/${receiving.quantity} ${receiving.unit} de ${receiving.product} · ${status} · délai ${formatDeliveryDuration(nextOrder.deliveryMinutes)}.`;
    const completionNotifications: LogisticsNotification[] = [
      { id: `LOG-RECEPTION-${receiving.id}-${Date.now()}`, createdAt: arrivedAt, recipientUnitId: receiving.supplierUnitId, orderId: receiving.id, title: 'Commande interne réceptionnée', message: completionMessage, kind: 'reception', read: false },
    ];
    if (receiving.assignedDelivererId) {
      completionNotifications.push({ id: `LOG-MISSION-DONE-${receiving.id}-${Date.now()}`, createdAt: arrivedAt, recipientUnitId: receiving.recipientUnitId, recipientUserId: receiving.assignedDelivererId, recipientUserName: receiving.assignedDelivererName, orderId: receiving.id, title: 'Mission de livraison terminée', message: `La réception de ${receiving.id} est validée par ${currentUser.name}. La mission est terminée.`, kind: 'mission', read: false });
    }
    persistNotifications([...completionNotifications, ...notifications]);
    setReceiving(null);
    notify(`Réception de ${receiving.id} enregistrée. La mission du livreur est terminée.`);
  }

  const unreadNotificationCount = visibleNotifications.length;
  return <div className="fade-in space-y-7">
    <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <Link href={scopeUnitId ? `/dashboard/${scopeUnitId}` : '/dashboard'} className="mb-4 inline-flex items-center gap-2 text-[11px] font-bold text-[#6c8176] hover:text-forest">← Retour au dashboard</Link>
        <p className="eyebrow mb-2">Logistique · Transferts internes</p>
        <h1 className="page-title">Commandes inter-unités{scopeUnitId ? ` · ${internalUnitLabel(scopeUnitId)}` : ''}</h1>
        <p className="muted mt-2 max-w-2xl text-[13px]">{scopeUnitId ? `Vue des commandes où ${internalUnitLabel(scopeUnitId)} est fournisseuse ou destinataire.` : 'Une commande interne n’est jamais une vente client : elle suit son départ, sa livraison, sa réception et son impact stock séparément.'}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {canOpenDeliverySpace && <Link href="/commandes-clients/scanner" className="btn-secondary"><ExternalLink size={14} /> Espace livreur unifié</Link>}
        {scopeUnitId && isAdmin && <button className="btn-secondary" onClick={() => setShowAll((value) => !value)}>{showAll ? 'Voir uniquement cette unité' : 'Voir toutes les commandes inter-unités'}</button>}
        <button className="btn-primary" onClick={() => setOpen(true)}><Plus size={15} /> Nouvelle commande</button>
      </div>
    </div>
    {feedback && <div className="flex items-center gap-2 rounded-xl border border-[#cde8c7] bg-[#effaeb] px-4 py-3 text-[12px] font-semibold text-[#4d8f51]"><Check size={14} />{feedback}</div>}
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard label="En attente" value={String(pending)} change="à expédier" detail="commandes visibles" icon={Clock3} tone="orange" />
      <StatCard label="En livraison" value={String(inDelivery)} change="départs enregistrés" detail="suivi actif" icon={Truck} tone="blue" />
      <StatCard label="Réceptionnées" value={String(received)} change="historique" detail="conformes, incomplètes ou endommagées" icon={PackageCheck} tone="green" />
      <StatCard label="Notifications" value={String(unreadNotificationCount)} change="à consulter" detail="missions et réceptions" icon={AlertTriangle} tone="purple" />
    </div>
    <div className="flex flex-wrap gap-2">
      <div className="relative"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9aa59f]" /><input className="input-base h-9 pl-9 text-[11px]" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Rechercher une commande..." /></div>
      <select className="input-base h-9 w-auto text-[11px]" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as 'Tous' | InternalOrderStatus)}><option>Tous</option><option>En attente</option><option>En livraison</option><option>Reçue conforme</option><option>Reçue incomplète</option><option>Reçue endommagée</option></select>
    </div>
    <section className="surface overflow-hidden">
      <div className="border-b border-[#edf0eb] px-5 py-5 sm:px-6"><SectionHeading eyebrow="Suivi automatique" title="Livraisons en cours" description="Le temps écoulé depuis le départ se met à jour automatiquement. La même commande est visible par le fournisseur et le destinataire." /></div>
      <div className="p-5 sm:p-6">{activeDeliveryOrders.length ? <div className="grid gap-3 lg:grid-cols-2">{activeDeliveryOrders.map((order) => <DeliveryTrackingCard key={order.id} order={order} now={now} canReceive={isAdmin || allowedUnits.includes(order.recipientUnitId)} onReceive={() => setReceiving(order)} />)}</div> : <p className="py-5 text-center text-[11px] text-[#89968f]">Aucune livraison active dans ce périmètre.</p>}</div>
    </section>
    <section className="surface overflow-hidden">
      <div className="border-b border-[#edf0eb] px-5 py-5 sm:px-6"><SectionHeading eyebrow="Historique partagé" title="Commandes et livraisons" description="L’unité fournisseuse et l’unité destinataire voient le même suivi, sans mélange avec les factures clients." /></div>
      <div className="table-scroll"><table className="w-full text-left"><thead><tr className="table-head"><th>Commande</th><th>Flux</th><th>Produit</th><th>Quantité</th><th>Livraison</th><th>Réception</th><th>Action</th></tr></thead><tbody>{visibleOrders.length ? visibleOrders.map((order) => <tr key={order.id} className="table-row table-line"><td><strong className="block text-ink">{order.id}</strong><small className="text-[10px] text-[#89968f]">{order.requestedDate} · par {order.requestedByName}</small></td><td><span className="text-[10px] font-bold text-[#66766d]">{internalUnitLabel(order.supplierUnitId)} → {internalUnitLabel(order.recipientUnitId)}</span></td><td>{order.product}</td><td>{order.quantity} {order.unit}{order.missingQuantity > 0 && <small className="mt-1 block text-[10px] font-bold text-[#bd5c5c]">Manque : {order.missingQuantity} {order.unit}</small>}</td><td><span className="text-[10px]">Départ : {order.departedAt ? new Date(order.departedAt).toLocaleString('fr-FR') : '—'}</span>{order.assignedDelivererName && <span className="mt-1 block text-[10px] font-semibold text-[#5b8f60]">Livreur : {order.assignedDelivererName}</span>}{order.status === 'En livraison' && <span className="mt-1 block text-[10px] font-bold text-[#6385bd]">Écoulé : {elapsedSince(order.departedAt, now)}</span>}{order.status.startsWith('Reçue') && order.deliveryMinutes > 0 && <small className="mt-1 block font-bold text-[#6385bd]">Délai : {formatDeliveryDuration(order.deliveryMinutes)}</small>}<span className="mt-1 block text-[9px] text-[#89968f]">Mission : {deliveryMissionStatus(order)}</span></td><td><StatusBadge status={orderStatus(order.status)} /><span className="mt-1 block text-[9px] text-[#89968f]">{order.condition || '—'}{order.receptionComment ? ` · ${order.receptionComment}` : ''}</span></td><td>{order.status === 'En attente' && (isAdmin || allowedUnits.includes(order.supplierUnitId)) ? <button className="btn-primary px-2.5 py-1.5 text-[10px]" onClick={() => openDeparture(order)}><Truck size={12} /> Marquer départ</button> : order.status === 'En livraison' && (isAdmin || allowedUnits.includes(order.recipientUnitId)) ? <button className="btn-primary px-2.5 py-1.5 text-[10px]" onClick={() => setReceiving(order)}><PackageCheck size={12} /> Confirmer réception</button> : <span className="text-[10px] text-[#89968f]">Suivi enregistré</span>}</td></tr>) : <tr><td colSpan={7} className="px-6 py-14 text-center text-[11px] text-[#89968f]">Aucune commande inter-unité dans ce périmètre.</td></tr>}</tbody></table></div>
    </section>
    <div className="space-y-3">{visibleNotifications.map((item) => <div key={item.id} className="flex items-start gap-3 rounded-xl border border-[#dce8db] bg-[#f5faf2] px-4 py-3 text-[11px]"><AlertTriangle size={15} className="mt-0.5 shrink-0 text-[#5b9d5b]" /><span><strong>{item.title}</strong><span className="mt-1 block leading-5 text-[#718078]">{item.message}</span></span></div>)}</div>

    <Modal open={open} onClose={() => setOpen(false)} title="Créer une commande inter-unités"><form onSubmit={createOrder} className="space-y-5"><div className="grid gap-4 sm:grid-cols-2"><label className="block"><span className="field-label">Unité fournisseuse</span><select name="supplierUnitId" className="input-base" defaultValue={scopeUnitId ?? (isAdmin ? 'provenderie' : allowedUnits[0])} required>{internalOrderUnits.filter((unit) => isAdmin || allowedUnits.includes(unit.id)).map((unit) => <option key={unit.id} value={unit.id}>{unit.label}</option>)}</select></label><label className="block"><span className="field-label">Unité destinataire</span><select name="recipientUnitId" className="input-base" defaultValue={scopeUnitId ? (unitIds.find((unit) => unit !== scopeUnitId) ?? 'poulets') : (isAdmin ? 'poulets' : allowedUnits[1])} required>{internalOrderUnits.filter((unit) => isAdmin || allowedUnits.includes(unit.id)).map((unit) => <option key={unit.id} value={unit.id}>{unit.label}</option>)}</select></label><label className="block sm:col-span-2"><span className="field-label">Produit / article</span><input name="product" className="input-base" placeholder="Ex. Aliment croissance, sacs, huile..." required /></label><label className="block"><span className="field-label">Quantité</span><input name="quantity" type="number" min="0.01" step="0.01" className="input-base" required /></label><label className="block"><span className="field-label">Unité</span><select name="unit" className="input-base"><option>kg</option><option>sac</option><option>litre</option><option>caisse</option><option>unité</option></select></label><label className="block sm:col-span-2"><span className="field-label">Date souhaitée</span><input name="requestedDate" type="date" className="input-base" defaultValue={new Date().toISOString().slice(0, 10)} required /></label></div><p className="text-[10px] text-[#89968f]">La commande sera débitée du stock fournisseur au départ, puis ajoutée au stock destinataire à la réception si l’article existe dans son catalogue.</p><div className="flex justify-end gap-2"><button type="button" className="btn-secondary" onClick={() => setOpen(false)}><X size={14} /> Annuler</button><button className="btn-primary" type="submit"><Plus size={15} /> Enregistrer la commande</button></div></form></Modal>

    <Modal open={Boolean(departing)} onClose={() => setDeparting(null)} title="Assigner le livreur et marquer le départ"><form onSubmit={confirmDeparture} className="space-y-5"><div className="rounded-xl border border-[#e1ebe0] bg-[#f6faf4] p-4 text-[11px]"><strong>{departing?.id} · {departing?.product}</strong><p className="mt-1 text-[#718078]">{departing?.quantity} {departing?.unit} · {departing ? internalUnitLabel(departing.supplierUnitId) : ''} → {departing ? internalUnitLabel(departing.recipientUnitId) : ''}</p></div><label className="block"><span className="field-label">Livreur assigné (obligatoire)</span><select name="assignedDelivererId" className="input-base" defaultValue="" required><option value="">Sélectionner un livreur actif</option>{deliverers.map((deliverer) => <option key={deliverer.id} value={deliverer.id}>{deliverer.name} · {deliverer.role}</option>)}</select></label><p className="text-[10px] leading-5 text-[#89968f]">La mission sera horodatée, visible dans l’espace livreur unifié et suivie par les deux unités. {isAdmin && <Link className="font-bold text-[#5b9d5b]" href="/dashboard-admin/utilisateurs">Gérer les comptes livreurs</Link>}</p><div className="flex justify-end gap-2"><button type="button" className="btn-secondary" onClick={() => setDeparting(null)}>Annuler</button><button className="btn-primary" type="submit"><Truck size={15} /> Marquer le départ</button></div></form></Modal>

    <Modal open={Boolean(receiving)} onClose={() => setReceiving(null)} title="Confirmer la réception"><form onSubmit={confirmReception} className="space-y-5"><div className="rounded-xl border border-[#e1ebe0] bg-[#f6faf4] p-4 text-[11px]"><strong>{receiving?.id} · {receiving?.product}</strong><p className="mt-1 text-[#718078]">Quantité commandée : {receiving?.quantity} {receiving?.unit} · départ : {receiving?.departedAt ? new Date(receiving.departedAt).toLocaleString('fr-FR') : '—'} · livreur : {receiving?.assignedDelivererName ?? 'non assigné'}</p></div><label className="block"><span className="field-label">État de la marchandise</span><select name="condition" className="input-base"><option>Bon état</option><option>Endommagée</option></select></label><label className="block"><span className="field-label">Quantité reçue</span><input name="receivedQuantity" type="number" min="0" step="0.01" className="input-base" defaultValue={receiving?.quantity ?? 0} required /></label><label className="block"><span className="field-label">Commentaire si endommagée</span><textarea name="damageComment" className="input-base min-h-[70px] resize-none" placeholder="Décrivez l’état des articles" /></label><label className="block"><span className="field-label">Commentaire de réception (facultatif)</span><textarea name="receptionComment" className="input-base min-h-[70px] resize-none" /></label><div className="flex justify-end gap-2"><button type="button" className="btn-secondary" onClick={() => setReceiving(null)}>Annuler</button><button className="btn-primary" type="submit"><Check size={15} /> Confirmer la réception</button></div></form></Modal>
  </div>;
}

function DeliveryTrackingCard({ order, now, canReceive, onReceive }: { order: InternalOrder; now: number; canReceive: boolean; onReceive: () => void }) {
  return <div className="rounded-2xl border border-[#dce8db] bg-[#f7fbf5] p-4"><div className="flex items-start gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#e9f7e5] text-[#5b9d5b]"><Truck size={18} /></span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><strong className="text-[12px] text-ink">{order.id}</strong><StatusBadge status="En transit" /></div><p className="mt-1 text-[11px] font-semibold text-[#53675b]">{order.product} · {order.quantity} {order.unit}</p><p className="mt-1 text-[10px] text-[#718078]">{internalUnitLabel(order.supplierUnitId)} → {internalUnitLabel(order.recipientUnitId)}</p></div></div><div className="mt-4 grid gap-2 text-[10px] sm:grid-cols-3"><div><span className="block text-[#89968f]">Temps écoulé</span><strong className="mt-1 block text-[14px] text-[#6385bd]">{elapsedSince(order.departedAt, now)}</strong></div><div><span className="block text-[#89968f]">Livreur</span><strong className="mt-1 block text-ink">{order.assignedDelivererName ?? 'Non renseigné'}</strong></div><div><span className="block text-[#89968f]">Départ</span><strong className="mt-1 block text-ink">{order.departedAt ? new Date(order.departedAt).toLocaleTimeString('fr-FR') : '—'}</strong></div></div>{canReceive && <button className="btn-primary mt-4 w-full justify-center text-[10px]" onClick={onReceive}><PackageCheck size={13} /> Confirmer la réception</button>}</div>;
}

function elapsedSince(value: string, now: number) {
  if (!value) return '—';
  const elapsedMinutes = Math.max(0, Math.floor((now - new Date(value).getTime()) / 60000));
  if (elapsedMinutes < 1) return 'moins d’une min';
  return formatDeliveryDuration(elapsedMinutes);
}

function orderStatus(status: InternalOrderStatus) {
  return status === 'Reçue conforme' ? 'Réceptionné' : status === 'En livraison' ? 'En transit' : status === 'En attente' ? 'Demandée' : status;
}

function adjustUnitStock(unitId: InternalOrderUnitId, product: string, delta: number, unit: string) {
  const key = unitId === 'poulets' ? FARM_STORAGE_KEYS.stock : unitId === 'stocks' ? FARM_STORAGE_KEYS.centralStock : unitId === 'provenderie' ? FARM_STORAGE_KEYS.feedFinishedStock : unitId === 'bio' ? FARM_STORAGE_KEYS.bioFinishedStock : unitId === 'pressoir' ? FARM_STORAGE_KEYS.pressFinishedStock : FARM_STORAGE_KEYS.goatFinishedStock;
  const stock = readLocal<StockRecord[]>(key, []);
  const match = stock.find((item) => String(item.name ?? item.itemName ?? item.recipeName ?? '').toLowerCase() === product.toLowerCase() || String(item.name ?? item.itemName ?? item.recipeName ?? '').toLowerCase().includes(product.toLowerCase()));
  if (!match) {
    if (delta <= 0) return false;
    const created = { id: `INT-STOCK-${Date.now()}`, name: product, itemName: product, quantity: delta, unit, category: 'Réception inter-unités', location: 'Stock de l’unité' };
    writeLocal(key, [...stock, created]);
    return true;
  }
  const quantity = convertQuantity(delta, unit, match.unit);
  if (quantity === undefined || (delta < 0 && match.quantity < Math.abs(quantity))) return false;
  const next = stock.map((item) => item.id === match.id ? { ...item, quantity: Math.max(0, item.quantity + quantity) } : item).filter((item) => item.quantity > 0 || delta > 0);
  writeLocal(key, next);
  return true;
}

function convertQuantity(quantity: number, fromUnit: string, toUnit: string) {
  const from = fromUnit.toLowerCase();
  const to = toUnit.toLowerCase();
  if (from === to || (from.includes('sac') && to.includes('sac'))) return quantity;
  const sack = from.match(/sac(?: de)?\s*([0-9]+(?:[.,][0-9]+)?)?\s*kg/);
  if (sack && to === 'kg') return quantity * Number((sack[1] || '50').replace(',', '.'));
  if (from === 'kg' && to.includes('sac')) return quantity / 50;
  return undefined;
}
