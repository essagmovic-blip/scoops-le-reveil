'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { ArrowLeftRight, ArrowRight, Check, Download, MoreHorizontal, Plus, Search, Truck } from 'lucide-react';
import { units } from '@/lib/data';
import { formatDate, formatNumber } from '@/lib/format';
import { SectionHeading, StatCard, Modal } from '@/components/ui';
import { StatusBadge } from '@/components/status-badge';
import { FARM_STORAGE_KEYS, readLocal, writeLocal } from '@/lib/farm-storage';
import { printFooterMarkup, printFooterStyles, printLetterheadMarkup, printLetterheadStyles } from '@/lib/pdf-letterhead';

type MovementStatus = 'Demandée' | 'En transit' | 'Réceptionné' | 'Annulé';
type DeliveryNote = { id: string; date: string; supplier: string; driverName: string; driverPhone: string; vehicle: string; productionId: string; sourceLabel?: string; note: string };
type InterUnitMovement = { id: string; date: string; from: string; to: string; product: string; quantity: number; quantityKg?: number; unit: string; status: MovementStatus; requestedBy: string; requestedByUnit?: string; supplier?: string; sourceProductionId?: string; deliveryNote?: DeliveryNote; note: string };
type FeedProductionOption = { id: string; recipeId: string; recipeName: string; quantity: number; remainingQuantity?: number; costPerKg?: number; date: string; status?: string };
type FeedFinishedOption = { id: string; recipeId: string; recipeName: string; quantity: number; unit: string; costPerKg?: number; lastProduction?: string };
type CentralStockOption = { id: string; name: string; type?: string; category?: string; quantity: number; unit: string; min?: number; purchasePrice?: number; supplier?: string; location?: string; condition?: string };
type GoatFinishedOption = { id: string; name: string; category?: string; quantity: number; unit: string; sellable?: boolean; salePrice?: number; lastProduction?: string };

function unitLabel(id: string) { return units.find((unit) => unit.id === id)?.label ?? id; }

export function MovementsView({ unitId }: { unitId?: string }) {
  const [movements, setMovements] = useState<InterUnitMovement[]>([]);
  const [feedProductions, setFeedProductions] = useState<FeedProductionOption[]>([]);
  const [centralItems, setCentralItems] = useState<CentralStockOption[]>([]);
  const [goatFinishedStock, setGoatFinishedStock] = useState<GoatFinishedOption[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [pendingMovement, setPendingMovement] = useState<InterUnitMovement | null>(null);
  const [deliveryPreview, setDeliveryPreview] = useState<{ movement: InterUnitMovement; note: DeliveryNote } | null>(null);
  const [selectedProductionId, setSelectedProductionId] = useState('');
  const [requestUnit, setRequestUnit] = useState('sac de 50 kg');
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<'Tous' | MovementStatus>('Tous');
  const [open, setOpen] = useState(false);
  const [feedback, setFeedback] = useState('');

  useEffect(() => {
    const saved = readLocal(FARM_STORAGE_KEYS.interUnitMovements, [] as InterUnitMovement[]);
    // Les anciennes demandes de la ferme qui avaient inversé source/destination
    // sont remises dans le sens métier : provenderie → ferme.
    const normalized = saved.map((movement) => movement.requestedByUnit === 'poulets' && movement.from === 'poulets' && movement.to === 'provenderie' ? { ...movement, from: 'provenderie', to: 'poulets' } : movement);
    setMovements(normalized);
    setFeedProductions(readLocal(unitId === 'bio' ? FARM_STORAGE_KEYS.bioProductions : unitId === 'pressoir' ? FARM_STORAGE_KEYS.pressProductions : FARM_STORAGE_KEYS.feedProductions, [] as FeedProductionOption[]));
    setCentralItems(unitId === 'stocks' ? readLocal(FARM_STORAGE_KEYS.centralStock, [] as CentralStockOption[]) : []);
    setGoatFinishedStock(unitId === 'chevrerie' ? readLocal(FARM_STORAGE_KEYS.goatFinishedStock, [] as GoatFinishedOption[]) : []);
    setHydrated(true);
  }, [unitId]);
  useEffect(() => { if (hydrated) writeLocal(FARM_STORAGE_KEYS.interUnitMovements, movements); }, [movements, hydrated]);

  const scoped = useMemo(() => unitId ? movements.filter((movement) => movement.from === unitId || movement.to === unitId) : movements, [movements, unitId]);
  const visible = useMemo(() => scoped.filter((movement) => {
    const text = `${movement.id} ${movement.product} ${unitLabel(movement.from)} ${unitLabel(movement.to)}`.toLowerCase();
    return text.includes(query.toLowerCase()) && (status === 'Tous' || movement.status === status);
  }), [scoped, query, status]);
  const requested = scoped.filter((movement) => movement.status === 'Demandée').length;
  const inTransit = scoped.filter((movement) => movement.status === 'En transit').length;
  const received = scoped.filter((movement) => movement.status === 'Réceptionné').length;

  function notify(message: string) { setFeedback(message); window.setTimeout(() => setFeedback(''), 4000); }
  function saveMovement(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const from = String(form.get('from') ?? 'provenderie');
    const to = unitId === 'poulets' ? 'poulets' : String(form.get('to') ?? 'poulets');
    const quantity = Number(form.get('quantity') ?? 0);
    const product = String(form.get('product') ?? '').trim();
    const supplier = unitLabel(from);
    const selectedUnit = String(form.get('unit') ?? (from === 'provenderie' ? 'sac de 50 kg' : 'kg'));
    const quantityKg = quantityToKg(quantity, selectedUnit);
    if (!product || quantity <= 0 || from === to) { notify('Vérifiez l’unité productrice, le produit, la quantité et la destination.'); return; }
    const movement: InterUnitMovement = { id: `MVT-${Date.now()}`, date: String(form.get('date') ?? '2026-08-13'), from, to, product, quantity, quantityKg, unit: selectedUnit, status: 'Demandée', requestedBy: 'Administrateur', requestedByUnit: unitId ?? to, supplier, note: String(form.get('note') ?? '').trim() };
    setMovements((current) => [movement, ...current]);
    setOpen(false);
    notify(`La demande ${movement.id} a été envoyée de ${unitLabel(from)} vers ${unitLabel(to)}.`);
  }
  function updateStatus(id: string, next: MovementStatus, productionId?: string, delivery?: Pick<DeliveryNote, 'driverName' | 'driverPhone' | 'vehicle' | 'note'>) {
    const movement = movements.find((item) => item.id === id);
    if (!movement) return;
    let deliveryNote: DeliveryNote | undefined = movement.deliveryNote;
    if (next === 'En transit' && (movement.from === 'provenderie' || movement.from === 'bio' || movement.from === 'pressoir')) {
      const production = feedProductions.find((item) => item.id === productionId);
      if (!production) {
        notify('Choisissez la production exacte dont le stock doit être diminué.');
        return;
      }
      if (!delivery?.driverName.trim() || !delivery.vehicle.trim()) {
        notify('Renseignez le nom du livreur et le véhicule avant de valider l’expédition.');
        return;
      }
      const quantityInSource = movement.quantityKg ?? movement.quantity;
      const sourceUnit = movement.quantityKg !== undefined ? 'kg' : movement.unit;
      const remaining = Number(production.remainingQuantity ?? production.quantity);
      if (remaining < quantityInSource) {
        notify(`Cette production ne dispose plus de ${quantityInSource} ${sourceUnit} disponibles.`);
        return;
      }
      const finishedKey = movement.from === 'bio' ? FARM_STORAGE_KEYS.bioFinishedStock : movement.from === 'pressoir' ? FARM_STORAGE_KEYS.pressFinishedStock : FARM_STORAGE_KEYS.feedFinishedStock;
      const finished = readLocal<FeedFinishedOption[]>(finishedKey, []);
      const item = finished.find((stock) => stock.recipeId === production.recipeId && (!stock.unit || stock.unit === sourceUnit)) ?? finished.find((stock) => stock.recipeId === production.recipeId) ?? finished.find((stock) => stock.recipeName.toLowerCase().includes(production.recipeName.toLowerCase()) || production.recipeName.toLowerCase().includes(stock.recipeName.toLowerCase()));
      if (!item || item.quantity < quantityInSource) {
        notify(`Le stock fini lié à la production ${production.id} est insuffisant.`);
        return;
      }
      writeLocal(finishedKey, finished.map((stock) => stock.id === item.id ? { ...stock, quantity: stock.quantity - quantityInSource } : stock).filter((stock) => stock.quantity > 0));
      const updatedProductions = feedProductions.map((item) => item.id === production.id ? { ...item, remainingQuantity: remaining - quantityInSource } : item);
      setFeedProductions(updatedProductions);
      const productionKey = movement.from === 'bio' ? FARM_STORAGE_KEYS.bioProductions : movement.from === 'pressoir' ? FARM_STORAGE_KEYS.pressProductions : FARM_STORAGE_KEYS.feedProductions;
      writeLocal(productionKey, updatedProductions);
      deliveryNote = { id: `BL-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`, date: new Date().toISOString().slice(0, 10), supplier: movement.supplier ?? unitLabel(movement.from), driverName: delivery.driverName.trim(), driverPhone: delivery.driverPhone.trim(), vehicle: delivery.vehicle.trim(), productionId: production.id, sourceLabel: 'Production source', note: delivery.note.trim() };
    }
    if (next === 'En transit' && movement.from === 'stocks') {
      const item = centralItems.find((current) => current.id === productionId) ?? centralItems.find((current) => current.name.toLowerCase() === movement.product.toLowerCase());
      if (!item) {
        notify('Choisissez l’article exact du magasin à débiter.');
        return;
      }
      if (!delivery?.driverName.trim() || !delivery.vehicle.trim()) {
        notify('Renseignez le nom du livreur et le véhicule avant de valider l’expédition.');
        return;
      }
      const quantityInSource = quantityForStockItem(item, movement);
      if (quantityInSource === undefined) {
        notify(`L’unité demandée (${movement.unit}) ne correspond pas à l’unité stockée (${item.unit}) pour ${item.name}.`);
        return;
      }
      if (item.quantity < quantityInSource) {
        notify(`Stock insuffisant pour ${item.name} : il reste ${formatNumber(item.quantity)} ${item.unit}.`);
        return;
      }
      const updatedCentralStock = centralItems.map((current) => current.id === item.id ? { ...current, quantity: current.quantity - quantityInSource } : current).filter((current) => current.quantity > 0);
      writeLocal(FARM_STORAGE_KEYS.centralStock, updatedCentralStock);
      setCentralItems(updatedCentralStock);
      const centralMovement = { id: `MVT-MAG-${Date.now()}`, date: movement.date, type: 'Sortie' as const, itemId: item.id, itemName: item.name, quantity: quantityInSource, unit: item.unit, delta: -quantityInSource, reason: 'Transfert inter-unités', recipient: unitLabel(movement.to), reference: movement.id, operator: 'Administrateur' };
      const centralMovements = readLocal<Array<typeof centralMovement>>(FARM_STORAGE_KEYS.centralMovements, []);
      writeLocal(FARM_STORAGE_KEYS.centralMovements, [centralMovement, ...centralMovements]);
      deliveryNote = { id: `BL-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`, date: new Date().toISOString().slice(0, 10), supplier: movement.supplier ?? 'Magasin central', driverName: delivery.driverName.trim(), driverPhone: delivery.driverPhone.trim(), vehicle: delivery.vehicle.trim(), productionId: item.id, sourceLabel: 'Article magasin', note: delivery.note.trim() };
    }
    if (next === 'En transit' && movement.from === 'chevrerie') {
      const item = goatFinishedStock.find((current) => current.id === productionId) ?? goatFinishedStock.find((current) => current.name.toLowerCase() === movement.product.toLowerCase());
      if (!item) {
        notify('Choisissez le produit exact de la chèvrerie à débiter.');
        return;
      }
      if (!delivery?.driverName.trim() || !delivery.vehicle.trim()) {
        notify('Renseignez le nom du livreur et le véhicule avant de valider l’expédition.');
        return;
      }
      const quantityInSource = quantityForStockItem(item, movement);
      if (quantityInSource === undefined) {
        notify(`L’unité demandée (${movement.unit}) ne correspond pas à l’unité stockée (${item.unit}) pour ${item.name}.`);
        return;
      }
      if (item.quantity < quantityInSource) {
        notify(`Stock insuffisant pour ${item.name} : il reste ${formatNumber(item.quantity)} ${item.unit}.`);
        return;
      }
      const updatedGoatStock = goatFinishedStock.map((current) => current.id === item.id ? { ...current, quantity: current.quantity - quantityInSource } : current).filter((current) => current.quantity > 0);
      writeLocal(FARM_STORAGE_KEYS.goatFinishedStock, updatedGoatStock);
      setGoatFinishedStock(updatedGoatStock);
      const goatMovement = { id: `MVT-CH-${Date.now()}`, date: movement.date, type: 'Transfert inter-unités' as const, itemName: item.name, quantity: quantityInSource, unit: item.unit, source: 'Chèvrerie', destination: unitLabel(movement.to), reference: movement.id, operator: 'Administrateur' };
      const goatMovements = readLocal<Array<typeof goatMovement>>(FARM_STORAGE_KEYS.goatMovements, []);
      writeLocal(FARM_STORAGE_KEYS.goatMovements, [goatMovement, ...goatMovements]);
      deliveryNote = { id: `BL-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`, date: new Date().toISOString().slice(0, 10), supplier: movement.supplier ?? 'Chèvrerie', driverName: delivery.driverName.trim(), driverPhone: delivery.driverPhone.trim(), vehicle: delivery.vehicle.trim(), productionId: item.id, sourceLabel: 'Produit de la chèvrerie', note: delivery.note.trim() };
    }
    if (next === 'Réceptionné' && movement.to === 'poulets') {
      const receivedUnit = movement.unit.includes('sac') ? movement.unit : movement.unit;
      const receivedQuantity = movement.unit.includes('sac') ? movement.quantity : Number(movement.quantityKg ?? movement.quantity);
      const farmStock = readLocal<Array<{ id: string; name: string; category: string; quantity: number; unit: string; unitId: string; min: number; purchasePrice?: number; location: string; expiryDate?: string; status?: string; color?: string }>>(FARM_STORAGE_KEYS.stock, []);
      const existing = farmStock.find((item) => item.name.toLowerCase() === movement.product.toLowerCase() && item.unit === receivedUnit);
      const updated = existing
        ? farmStock.map((item) => item.id === existing.id ? { ...item, quantity: item.quantity + receivedQuantity, unit: receivedUnit, category: item.category || 'Produits reçus' } : item)
        : [...farmStock, { id: `ST-INTER-${Date.now()}`, name: movement.product, category: 'Produits reçus', quantity: receivedQuantity, unit: receivedUnit, unitId: 'poulets', min: 0, purchasePrice: 0, location: 'Magasin ferme', expiryDate: '', status: 'Normal', color: '#6f9fe8' }];
      writeLocal(FARM_STORAGE_KEYS.stock, updated);
    }
    if (next === 'Réceptionné' && movement.to === 'stocks') {
      const receivedUnit = movement.unit.includes('sac') ? 'sac' : movement.unit;
      const receivedQuantity = movement.unit.includes('sac') ? movement.quantity : Number(movement.quantityKg ?? movement.quantity);
      const centralStock = readLocal<CentralStockOption[]>(FARM_STORAGE_KEYS.centralStock, []);
      const existing = centralStock.find((item) => item.name.toLowerCase() === movement.product.toLowerCase() && item.unit === receivedUnit);
      const receivedItemId = existing?.id ?? `MAG-INTER-${Date.now()}`;
      const updated = existing
        ? centralStock.map((item) => item.id === existing.id ? { ...item, quantity: item.quantity + receivedQuantity } : item)
        : [...centralStock, { id: receivedItemId, name: movement.product, type: 'Produit agricole', category: 'Produits reçus', quantity: receivedQuantity, unit: receivedUnit, min: 0, purchasePrice: 0, supplier: movement.supplier ?? unitLabel(movement.from), location: 'Magasin central', condition: 'Bon' }];
      writeLocal(FARM_STORAGE_KEYS.centralStock, updated);
      setCentralItems(updated);
      const centralMovement = { id: `MVT-MAG-${Date.now()}`, date: movement.date, type: 'Entrée' as const, itemId: receivedItemId, itemName: movement.product, quantity: receivedQuantity, unit: receivedUnit, delta: receivedQuantity, reason: 'Réception inter-unités', recipient: 'Magasin central', reference: movement.id, operator: 'Administrateur' };
      const centralMovements = readLocal<Array<typeof centralMovement>>(FARM_STORAGE_KEYS.centralMovements, []);
      writeLocal(FARM_STORAGE_KEYS.centralMovements, [centralMovement, ...centralMovements]);
    }
    if (next === 'Réceptionné' && movement.to === 'chevrerie') {
      const receivedUnit = movement.unit.includes('sac') ? 'sac' : movement.unit;
      const receivedQuantity = movement.unit.includes('sac') ? movement.quantity : Number(movement.quantityKg ?? movement.quantity);
      const goatStock = readLocal<GoatFinishedOption[]>(FARM_STORAGE_KEYS.goatFinishedStock, []);
      const existing = goatStock.find((item) => item.name.toLowerCase() === movement.product.toLowerCase() && item.unit === receivedUnit);
      const receivedItemId = existing?.id ?? `FIN-CH-INTER-${Date.now()}`;
      const updated = existing
        ? goatStock.map((item) => item.id === existing.id ? { ...item, quantity: item.quantity + receivedQuantity } : item)
        : [...goatStock, { id: receivedItemId, name: movement.product, category: 'Produits reçus', quantity: receivedQuantity, unit: receivedUnit, sellable: true, salePrice: 0, lastProduction: movement.date }];
      writeLocal(FARM_STORAGE_KEYS.goatFinishedStock, updated);
      setGoatFinishedStock(updated);
      const goatMovement = { id: `MVT-CH-${Date.now()}`, date: movement.date, type: 'Production' as const, itemName: movement.product, quantity: receivedQuantity, unit: receivedUnit, source: unitLabel(movement.from), destination: 'Chèvrerie', reference: movement.id, operator: 'Administrateur' };
      const goatMovements = readLocal<Array<typeof goatMovement>>(FARM_STORAGE_KEYS.goatMovements, []);
      writeLocal(FARM_STORAGE_KEYS.goatMovements, [goatMovement, ...goatMovements]);
    }
    const updatedMovement = { ...movement, status: next, sourceProductionId: productionId ?? movement.sourceProductionId, deliveryNote };
    setMovements((current) => current.map((item) => item.id === id ? updatedMovement : item));
    setPendingMovement(null);
    setSelectedProductionId('');
    if (next === 'En transit' && deliveryNote) setDeliveryPreview({ movement: updatedMovement, note: deliveryNote });
    notify(next === 'En transit' ? `${movement.from === 'stocks' ? 'L’article du magasin' : movement.from === 'chevrerie' ? 'Le produit de la chèvrerie' : 'La production'} a été débité(e) et le bon de livraison a été créé.` : movement.to === 'stocks' ? 'La réception a été enregistrée et le stock du magasin central a été mis à jour.' : 'La réception a été enregistrée et le stock de la ferme a été mis à jour.');
  }
  function printDeliveryNote(movement: InterUnitMovement, note: DeliveryNote) {
    const popup = window.open('', '_blank', 'width=900,height=700');
    if (!popup) { notify('Le bon de livraison est prêt, mais la fenêtre d’impression a été bloquée par le navigateur.'); return; }
    const quantityKg = movement.quantityKg ?? quantityToKg(movement.quantity, movement.unit);
    const quantityLabel = `${movement.quantity} ${movement.unit}`;
    const equivalentLabel = quantityKg === undefined ? '—' : `${quantityKg} kg`;
    const header = printLetterheadMarkup({ title: 'Bon de livraison', reference: note.id, context: [`Date : ${note.date}`, 'Document inter-unités'] });
    popup.document.write(`<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>${escapeHtml(note.id)}</title><style>${printLetterheadStyles}${printFooterStyles}body{font-family:Arial,sans-serif;color:#1d2e27;margin:0;font-size:12px}.box{background:#f4faf2;border-radius:10px;padding:16px;margin:20px 0}table{border-collapse:collapse;width:100%;margin-top:20px}th{background:#19382e;color:#fff;text-align:left;padding:10px;font-size:12px}td{border-bottom:1px solid #e2eae1;padding:12px;font-size:13px}.sign{display:flex;gap:30px;margin-top:70px}.signature{border-top:1px solid #718078;flex:1;padding-top:8px;font-size:11px;color:#718078}@media print{button{display:none}}</style></head><body>${header}<div class="box"><strong>Fournisseur / expéditeur :</strong> ${escapeHtml(note.supplier)}<br><strong>Destination :</strong> ${escapeHtml(unitLabel(movement.to))}<br><strong>Livreur :</strong> ${escapeHtml(note.driverName)} · ${escapeHtml(note.driverPhone || 'Téléphone non renseigné')}<br><strong>Véhicule :</strong> ${escapeHtml(note.vehicle)}<br><strong>${escapeHtml(note.sourceLabel ?? 'Production source')} :</strong> ${escapeHtml(note.productionId)}</div><table><thead><tr><th>Produit</th><th>Quantité</th><th>Équivalent</th><th>Référence demande</th></tr></thead><tbody><tr><td>${escapeHtml(movement.product)}</td><td>${escapeHtml(quantityLabel)}</td><td>${escapeHtml(equivalentLabel)}</td><td>${escapeHtml(movement.id)}</td></tr></tbody></table><div class="box"><strong>Observation :</strong><br>${escapeHtml(note.note || 'Aucune observation')}</div><div class="sign"><div class="signature">Signature du livreur</div><div class="signature">Signature du réceptionnaire</div></div>${printFooterMarkup()}<script>window.onload=()=>window.print()</script></body></html>`);
    popup.document.close();
    popup.focus();
    window.setTimeout(() => popup.print(), 300);
  }

  function exportMovements() {
    const rows = ['SCOOPS LE REVEIL', 'Mouvements inter-unités', '', 'Référence;Date;Produit;Fournisseur;Source;Destination;Quantité;Statut;Bon de livraison;Note', ...visible.map((movement) => [movement.id, movement.date, movement.product, movement.supplier ?? '', unitLabel(movement.from), unitLabel(movement.to), `${movement.quantity} ${movement.unit} (${movement.quantityKg ?? ''} kg)`, movement.status, movement.deliveryNote?.id ?? '', movement.note].join(';'))].join('\n');
    const link = document.createElement('a'); link.href = URL.createObjectURL(new Blob([`\ufeff${rows}`], { type: 'text/csv;charset=utf-8' })); link.download = `mouvements-inter-unites-${unitId ?? 'global'}.csv`; link.click(); URL.revokeObjectURL(link.href); notify('Les mouvements ont été exportés.');
  }
  const defaultFrom = unitId === 'poulets' ? 'provenderie' : unitId ?? 'provenderie';
  const defaultTo = unitId === 'poulets' ? 'poulets' : 'poulets';

  return <div className="fade-in space-y-7"><div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between"><div><p className="eyebrow mb-2">{unitId ? `${unitLabel(unitId)} · Flux entre unités` : 'Opérations · Traçabilité'}</p><h1 className="page-title">{unitId ? `Mouvements de ${unitLabel(unitId).toLowerCase()}` : 'Mouvements inter-unités'}</h1><p className="muted mt-2 max-w-2xl text-[13px] leading-5">Une demande crée un mouvement suivi par la source et la destination : demandée, en transit puis réceptionnée.</p></div><div className="flex flex-wrap gap-2"><button className="btn-secondary" onClick={exportMovements}><Download size={15} /> Exporter</button><button className="btn-primary" onClick={() => setOpen(true)}><Plus size={16} /> {unitId === 'poulets' ? 'Demander un aliment' : 'Nouvelle demande'}</button></div></div>{feedback && <div className="flex items-start gap-2 rounded-xl border border-[#cde8c7] bg-[#effaeb] px-4 py-3 text-[12px] font-semibold leading-5 text-[#4d8f51]"><span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#72bf70] text-white"><Check size={13} /></span>{feedback}</div>}<div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><StatCard label="Demandes" value={String(requested)} change="à traiter" detail="dans le périmètre" icon={ArrowLeftRight} tone="orange" /><StatCard label="En transit" value={String(inTransit)} change="à réceptionner" detail="flux actifs" icon={Truck} tone="blue" /><StatCard label="Réceptionnés" value={String(received)} change="historique" detail="mouvements terminés" icon={Check} tone="green" /><StatCard label="Total visible" value={String(scoped.length)} change="traçabilité" detail="unité active" icon={ArrowRight} tone="purple" /></div><div className="surface overflow-hidden"><div className="flex flex-col gap-4 border-b border-[#edf0eb] px-5 pb-4 pt-5 sm:px-6"><div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between"><div className="flex gap-1 rounded-xl bg-[#f4f7f2] p-1"><button onClick={() => setStatus('Tous')} className={`rounded-lg px-3 py-2 text-[11px] font-bold ${status === 'Tous' ? 'bg-white text-forest shadow-sm' : 'text-[#87948c]'}`}>Tous</button><button onClick={() => setStatus('Demandée')} className={`rounded-lg px-3 py-2 text-[11px] font-bold ${status === 'Demandée' ? 'bg-white text-forest shadow-sm' : 'text-[#87948c]'}`}>Demandées</button><button onClick={() => setStatus('En transit')} className={`rounded-lg px-3 py-2 text-[11px] font-bold ${status === 'En transit' ? 'bg-white text-forest shadow-sm' : 'text-[#87948c]'}`}>En transit</button><button onClick={() => setStatus('Réceptionné')} className={`rounded-lg px-3 py-2 text-[11px] font-bold ${status === 'Réceptionné' ? 'bg-white text-forest shadow-sm' : 'text-[#87948c]'}`}>Réceptionnés</button></div><div className="relative min-w-[230px]"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9aa69f]" /><input value={query} onChange={(e) => setQuery(e.target.value)} className="input-base h-9 rounded-lg bg-[#fbfcfa] pl-9 text-[11px]" placeholder="Rechercher un produit ou une unité..." /></div></div></div><div className="table-scroll"><table className="w-full text-left"><thead><tr className="table-head"><th>Référence</th><th>Date</th><th>Produit</th><th>Unité productrice</th><th>Source</th><th>Destination</th><th>Quantité</th><th>Statut</th><th>Action</th></tr></thead><tbody>{visible.length ? visible.map((movement) => <tr key={movement.id} className="table-row table-line"><td><p className="font-bold text-ink">{movement.id}</p><p className="mt-1 text-[10px] text-[#9aa59f]">Demandé par {movement.requestedBy}</p></td><td>{formatDate(movement.date)}</td><td><p className="font-bold text-ink">{movement.product}</p><p className="mt-1 text-[10px] text-[#9aa59f]">{movement.note || '—'}</p></td><td>{movement.supplier ?? unitLabel(movement.from)}</td><td><UnitChip id={movement.from} /></td><td><UnitChip id={movement.to} /></td><td>{movement.unit.includes('sac') ? <><strong className="text-ink">{formatNumber(movement.quantity)}</strong> sacs <span className="ml-1 text-[10px] text-[#89968f]">({formatNumber(Number(movement.quantityKg ?? movement.quantity * 50))} kg)</span></> : <><strong className="text-ink">{formatNumber(movement.quantity)}</strong> {movement.unit}</>}</td><td><StatusBadge status={movement.status} /></td><td>{movement.status === 'Demandée' && movement.from === unitId ? <button className="btn-primary px-2.5 py-1.5 text-[10px]" onClick={() => { setPendingMovement(movement); setSelectedProductionId(''); }}>Choisir la production</button> : movement.status === 'En transit' && (movement.requestedByUnit === unitId || (!movement.requestedByUnit && movement.to === unitId)) ? <div className="flex flex-wrap gap-1"><button className="btn-primary px-2.5 py-1.5 text-[10px]" onClick={() => updateStatus(movement.id, 'Réceptionné')}>Réceptionner</button>{movement.deliveryNote && <button className="btn-secondary px-2.5 py-1.5 text-[10px]" onClick={() => printDeliveryNote(movement, movement.deliveryNote!)}>Bon de livraison</button>}</div> : movement.deliveryNote ? <button className="btn-secondary px-2.5 py-1.5 text-[10px]" onClick={() => printDeliveryNote(movement, movement.deliveryNote!)}>Bon de livraison</button> : <span className="text-[10px] text-[#89968f]">Suivi actif</span>}</td></tr>) : <tr><td colSpan={9} className="px-6 py-14 text-center"><ArrowLeftRight className="mx-auto text-[#b4c3b7]" size={28} /><p className="mt-3 text-[13px] font-bold text-ink">Aucun mouvement enregistré</p><p className="muted mt-1 text-[11px]">Créez une demande pour qu’elle apparaisse dans l’unité source et l’unité destinataire.</p></td></tr>}</tbody></table></div><div className="flex items-center justify-between border-t border-[#edf0eb] px-5 py-4 text-[11px] text-[#8a9790] sm:px-6"><span>{visible.length} mouvement{visible.length > 1 ? 's' : ''}</span><span className="font-semibold text-[#6c8176]">Stock source et destination séparés</span></div></div><div className="surface bg-forest p-5 text-white sm:p-6"><p className="eyebrow text-[#91af9f]">Cycle de validation</p><h2 className="mt-2 text-[19px] font-bold tracking-[-.04em]">Demande → transit → réception</h2><p className="mt-2 text-[11px] leading-5 text-[#a8c4ae]">La demande est enregistrée dans le stockage partagé de l’entreprise. L’unité source choisit sa production ou son article de magasin, expédie avec un bon de livraison, puis l’unité destinataire réceptionne.</p></div><Modal open={open} onClose={() => setOpen(false)} title={unitId === 'poulets' ? 'Demander un aliment à la provenderie' : 'Nouvelle demande inter-unités'}><form onSubmit={saveMovement} className="space-y-4"><p className="muted text-[12px] leading-5">La demande sera visible dans l’unité destinataire et suivra son cycle de validation.</p>{unitId === 'poulets' ? <label className="block"><span className="field-label">Unité productrice / fournisseur</span><select name="from" className="input-base" defaultValue={defaultFrom}>{units.filter((unit) => unit.id !== 'poulets' && unit.id !== 'rh').map((unit) => <option key={unit.id} value={unit.id}>{unit.label}</option>)}</select><p className="mt-1 text-[10px] text-[#89968f]">Choisissez l’unité qui fournit la marchandise demandée.</p></label> : <div className="grid gap-4 sm:grid-cols-2"><label className="block"><span className="field-label">Unité source</span><select name="from" className="input-base" defaultValue={defaultFrom}>{units.filter((unit) => unit.id !== 'rh').map((unit) => <option key={unit.id} value={unit.id}>{unit.label}</option>)}</select></label><label className="block"><span className="field-label">Unité destinataire</span><select name="to" className="input-base" defaultValue={defaultTo}>{units.filter((unit) => unit.id !== 'rh').map((unit) => <option key={unit.id} value={unit.id}>{unit.label}</option>)}</select></label></div>}<label className="block"><span className="field-label">Produit ou matière</span><input name="product" className="input-base" placeholder="Ex. Aliment croissance granulé" required /></label><div className="grid gap-4 sm:grid-cols-2"><label className="block"><span className="field-label">{unitId === 'poulets' ? 'Nombre de sacs (50 kg)' : 'Quantité'}</span><input name="quantity" type="number" min="0.01" step="0.01" className="input-base" placeholder={unitId === 'poulets' ? '20' : '500'} required /></label><label className="block"><span className="field-label">Unité de réception</span><select name="unit" value={requestUnit} onChange={(event) => setRequestUnit(event.target.value)} className="input-base"><option value="sac de 50 kg">Sac de 50 kg</option><option value="kg">Kilogramme (kg)</option><option value="litre">Litre</option><option value="unité">Unité</option><option value="carton">Carton</option></select></label><label className="block sm:col-span-2"><span className="field-label">Date de la demande</span><input name="date" type="date" defaultValue="2026-08-13" className="input-base" /></label></div><label className="block"><span className="field-label">Motif ou référence</span><textarea name="note" className="input-base min-h-[70px] resize-none" placeholder="Ex. Approvisionnement de la ferme" /></label><div className="flex justify-end gap-2 pt-2"><button type="button" className="btn-secondary" onClick={() => setOpen(false)}>Annuler</button><button type="submit" className="btn-primary"><Check size={15} /> Envoyer la demande</button></div></form></Modal><Modal open={Boolean(pendingMovement)} onClose={() => { setPendingMovement(null); setSelectedProductionId(''); }} title={unitId === 'stocks' ? 'Choisir l’article du magasin à débiter' : 'Choisir la production à débiter'}>{pendingMovement && <form onSubmit={(event) => { event.preventDefault(); const form = new FormData(event.currentTarget); updateStatus(pendingMovement.id, 'En transit', selectedProductionId, { driverName: String(form.get('driverName') ?? ''), driverPhone: String(form.get('driverPhone') ?? ''), vehicle: String(form.get('vehicle') ?? ''), note: String(form.get('deliveryNote') ?? '') }); }} className="space-y-5"><div className="rounded-xl border border-[#dcebdd] bg-[#f5faf2] p-4"><p className="text-[12px] font-bold text-[#3e7546]">Demande : {pendingMovement.quantity} {pendingMovement.unit}</p><p className="mt-1 text-[11px] text-[#6d9071]">{pendingMovement.product}</p><p className="mt-1 text-[10px] text-[#6d9071]">{quantityToKg(pendingMovement.quantity, pendingMovement.unit) !== undefined ? `Équivalent stock : ${formatNumber(Number(quantityToKg(pendingMovement.quantity, pendingMovement.unit)))} kg` : `Unité source : ${formatNumber(pendingMovement.quantity)} ${pendingMovement.unit}`}</p></div><label className="block"><span className="field-label">{unitId === 'stocks' ? 'Article source' : unitId === 'chevrerie' ? 'Produit source' : 'Production source'}</span><select value={selectedProductionId} onChange={(event) => setSelectedProductionId(event.target.value)} className="input-base" required><option value="">{unitId === 'stocks' ? 'Choisir l’article du magasin' : unitId === 'chevrerie' ? 'Choisir le produit de la chèvrerie' : 'Choisir le lot de production'}</option>{unitId === 'stocks' ? centralItems.filter((item) => item.quantity > 0).map((item) => <option key={item.id} value={item.id}>{item.name} · reste {formatNumber(item.quantity)} {item.unit}</option>) : unitId === 'chevrerie' ? goatFinishedStock.filter((item) => item.quantity > 0).map((item) => <option key={item.id} value={item.id}>{item.name} · reste {formatNumber(item.quantity)} {item.unit}</option>) : feedProductions.filter((production) => (production.status ?? 'Terminée') === 'Terminée' && Number(production.remainingQuantity ?? production.quantity) > 0).map((production) => <option key={production.id} value={production.id}>{production.id} · {production.recipeName} · reste {formatNumber(Number(production.remainingQuantity ?? production.quantity))} kg</option>)}</select></label><div className="grid gap-4 sm:grid-cols-2"><label className="block"><span className="field-label">Nom du livreur</span><input name="driverName" className="input-base" placeholder="Nom complet" required /></label><label className="block"><span className="field-label">Téléphone du livreur</span><input name="driverPhone" className="input-base" placeholder="Facultatif" /></label><label className="block sm:col-span-2"><span className="field-label">Véhicule / immatriculation</span><input name="vehicle" className="input-base" placeholder="Ex. Camion CE 123 AA" required /></label><label className="block sm:col-span-2"><span className="field-label">Observation du bon</span><textarea name="deliveryNote" className="input-base min-h-[65px] resize-none" placeholder="État des sacs, lieu de chargement..." /></label></div>{((unitId === 'stocks' && !centralItems.length) || (unitId === 'chevrerie' && !goatFinishedStock.length) || (unitId !== 'stocks' && unitId !== 'chevrerie' && !feedProductions.length)) && <p className="rounded-xl border border-dashed border-[#dce8db] p-4 text-center text-[11px] text-[#89968f]">{unitId === 'stocks' ? 'Aucun article disponible dans le magasin central.' : unitId === 'chevrerie' ? 'Aucun produit disponible dans le stock de la chèvrerie.' : 'Aucune production disponible. Lancez d’abord une production dans l’unité source.'}</p>}<div className="flex justify-end gap-2"><button type="button" className="btn-secondary" onClick={() => { setPendingMovement(null); setSelectedProductionId(''); }}>Annuler</button><button type="submit" className="btn-primary"><Check size={15} /> Accepter et expédier</button></div></form>}</Modal></div>;
}

function quantityToKg(quantity: number, unit: string) {
  if (unit === 'kg') return quantity;
  const sack = unit.match(/^sac de ([0-9]+(?:[.,][0-9]+)?) kg$/i);
  return sack ? quantity * Number(sack[1].replace(',', '.')) : undefined;
}

function quantityForStockItem(item: { unit: string; quantity: number }, movement: InterUnitMovement) {
  const itemUnit = item.unit.toLowerCase();
  const movementUnit = movement.unit.toLowerCase();
  if (itemUnit === 'kg' && movement.quantityKg !== undefined) return Number(movement.quantityKg);
  if (itemUnit === 'sac' && movementUnit.includes('sac')) return movement.quantity;
  if (itemUnit === movementUnit) return movement.quantity;
  return undefined;
}

function UnitChip({ id }: { id: string }) { const unit = units.find((item) => item.id === id); return <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-[10px] font-bold text-[#64756c]"><i className="h-2 w-2 rounded-full" style={{ background: unit?.color ?? '#9ab4a3' }} />{unit?.shortLabel ?? id}</span>; }
function escapeHtml(value: string) { return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;'); }
