'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { AlertTriangle, ArrowDownRight, ArrowLeft, ArrowUpRight, Banknote, Boxes, Check, ClipboardCheck, ClipboardList, Download, FileText, History, MoreHorizontal, Package, Pencil, Plus, RefreshCw, Search, SlidersHorizontal, Tag, Truck, Warehouse } from 'lucide-react';
import type { inventory as initialInventory } from '@/lib/data';
import { formatDate, formatFCFA, formatNumber } from '@/lib/format';
import { Modal, SectionHeading, StatCard, ViewAll } from '@/components/ui';
import { StatusBadge } from '@/components/status-badge';
import { FARM_STORAGE_KEYS, readLocal, writeLocal } from '@/lib/farm-storage';
import { addPdfFooter, addPdfLetterhead } from '@/lib/pdf-letterhead';

type StockItem = typeof initialInventory[number] & { purchasePrice?: number };
type MovementType = 'Entrée' | 'Sortie' | 'Ajustement';
type FarmMovement = { id: string; date: string; type: MovementType; itemId: string; itemName: string; quantity: number; unit: string; delta: number; reason: string; building?: string; batch?: string; user: string };
type FarmOrder = { id: string; date: string; supplier: string; itemId: string; itemName: string; quantity: number; unit: string; status: 'Brouillon' | 'Envoyée' | 'Partiellement reçue' | 'Reçue'; priority: 'Normale' | 'Urgente' };

const inventoryDate = '2026-08-13';

function stockStatus(item: StockItem) {
  if (item.quantity <= 0) return 'Rupture';
  if (item.expiryDate) {
    if (item.expiryDate < inventoryDate) return 'Expiré';
    const days = Math.ceil((new Date(item.expiryDate).getTime() - new Date(inventoryDate).getTime()) / 86400000);
    if (days <= 30) return 'Expire bientôt';
  }
  if (item.quantity <= item.min) return 'Faible';
  return 'Normal';
}

function expiryLabel(expiryDate?: string) {
  if (!expiryDate) return 'Sans expiration';
  return `Expire le ${expiryDate.split('-').reverse().join('/')}`;
}


export function FarmStockView() {
  const [tab, setTab] = useState<'stock' | 'movements' | 'inventory' | 'orders'>('stock');
  const [items, setItems] = useState<StockItem[]>([]);
  const [movements, setMovements] = useState<FarmMovement[]>([]);
  const [orders, setOrders] = useState<FarmOrder[]>([]);
  const [movementOpen, setMovementOpen] = useState(false);
  const [orderOpen, setOrderOpen] = useState(false);
  const [articleOpen, setArticleOpen] = useState(false);
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<StockItem | null>(null);
  const [categories, setCategories] = useState<string[]>([]);
  const [editingCategory, setEditingCategory] = useState('');
  const [feedback, setFeedback] = useState('');
  const [query, setQuery] = useState('');
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const load = () => {
      setItems(readLocal(FARM_STORAGE_KEYS.stock, [] as StockItem[]));
      setMovements(readLocal(FARM_STORAGE_KEYS.movements, [] as FarmMovement[]));
      setOrders(readLocal(FARM_STORAGE_KEYS.orders, [] as FarmOrder[]));
      setCategories(readLocal(FARM_STORAGE_KEYS.stockCategories, [] as string[]));
      setHydrated(true);
    };
    load();
  }, []);
  useEffect(() => { if (hydrated) writeLocal(FARM_STORAGE_KEYS.stock, items); }, [items, hydrated]);
  useEffect(() => { if (hydrated) writeLocal(FARM_STORAGE_KEYS.movements, movements); }, [movements, hydrated]);
  useEffect(() => { if (hydrated) writeLocal(FARM_STORAGE_KEYS.orders, orders); }, [orders, hydrated]);
  useEffect(() => { if (hydrated) writeLocal(FARM_STORAGE_KEYS.stockCategories, categories); }, [categories, hydrated]);

  const filteredItems = useMemo(() => items.filter((item) => `${item.id} ${item.name} ${item.category}`.toLowerCase().includes(query.toLowerCase())), [items, query]);
  const lowStock = items.filter((item) => ['Faible', 'Rupture'].includes(stockStatus(item)));
  const expiringItems = items.filter((item) => ['Expiré', 'Expire bientôt'].includes(stockStatus(item)));
  const stockValue = items.reduce((sum, item) => sum + item.quantity * Number(item.purchasePrice ?? 0), 0);

  function notify(message: string) { setFeedback(message); window.setTimeout(() => setFeedback(''), 4000); }

  function createMovement(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const itemId = String(form.get('itemId') ?? '');
    const type = String(form.get('type') ?? 'Entrée') as MovementType;
    const quantity = Number(form.get('quantity') ?? 0);
    const reason = String(form.get('reason') ?? '').trim();
    const item = items.find((current) => current.id === itemId);
    if (!item || quantity <= 0) return;
    const newQuantity = type === 'Entrée' ? item.quantity + quantity : type === 'Sortie' ? item.quantity - quantity : quantity;
    if (newQuantity < 0) { notify(`Stock insuffisant : il reste ${formatNumber(item.quantity)} ${item.unit}.`); return; }
    const delta = newQuantity - item.quantity;
    const movement: FarmMovement = { id: `MFG-${Date.now()}`, date: String(form.get('date') ?? '2026-08-12'), type, itemId, itemName: item.name, quantity: type === 'Ajustement' ? Math.abs(delta) : quantity, unit: item.unit, delta, reason: reason || (type === 'Ajustement' ? 'Inventaire physique' : 'Mouvement manuel'), building: String(form.get('building') ?? ''), batch: String(form.get('batch') ?? ''), user: 'Administrateur' };
    setItems((current) => current.map((currentItem) => currentItem.id === itemId ? { ...currentItem, quantity: newQuantity, status: newQuantity <= currentItem.min ? newQuantity <= currentItem.min / 2 ? 'Critique' : 'Faible' : 'Normal' } : currentItem));
    setMovements((current) => [movement, ...current]);
    setMovementOpen(false);
    notify(type === 'Ajustement' ? `Stock de ${item.name} ajusté à ${formatNumber(newQuantity)} ${item.unit}.` : `${type} enregistrée : ${formatNumber(quantity)} ${item.unit} de ${item.name}.`);
  }

  function createOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const item = items.find((current) => current.id === String(form.get('itemId') ?? '')) ?? items[0];
    const order: FarmOrder = { id: `CMD-F-${String(Date.now()).slice(-3)}`, date: String(form.get('date') ?? '2026-08-12'), supplier: String(form.get('supplier') ?? 'Fournisseur'), itemId: item.id, itemName: item.name, quantity: Number(form.get('quantity') ?? 0), unit: item.unit, status: 'Brouillon', priority: String(form.get('priority') ?? 'Normale') as FarmOrder['priority'] };
    setOrders((current) => [order, ...current]);
    setOrderOpen(false);
    notify(`${order.id} a été créé en brouillon.`);
  }

  function updateOrderStatus(id: string, status: FarmOrder['status']) {
    const order = orders.find((current) => current.id === id);
    if (!order) return;
    if (status === 'Reçue' && order.status !== 'Reçue') {
      setItems((current) => current.map((item) => item.id === order.itemId ? { ...item, quantity: item.quantity + order.quantity, status: 'Normal' } : item));
      setMovements((current) => [{ id: `MFG-${Date.now()}`, date: '2026-08-12', type: 'Entrée', itemId: order.itemId, itemName: order.itemName, quantity: order.quantity, unit: order.unit, delta: order.quantity, reason: `Réception de ${order.id}`, user: 'Administrateur' }, ...current]);
      notify(`${order.id} réceptionnée : ${formatNumber(order.quantity)} ${order.unit} ajoutés au stock.`);
    } else {
      notify(`${id} est maintenant « ${status} ».`);
    }
    setOrders((current) => current.map((currentOrder) => currentOrder.id === id ? { ...currentOrder, status } : currentOrder));
  }

  async function generateInventoryPdf() {
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const contentStart = await addPdfLetterhead(doc, { title: 'Rapport d’inventaire', reference: `INV-${inventoryDate}`, context: ['Unité : Ferme de poulets de chair', `Date : ${inventoryDate}`] });
    autoTable(doc, { startY: contentStart, head: [['Article', 'Catégorie', 'Quantité', 'Seuil', 'Prix achat', 'Expiration', 'Statut', 'Valeur']], body: items.map((item) => [item.name, item.category, `${item.quantity} ${item.unit}`, `${item.min} ${item.unit}`, formatFCFA(item.purchasePrice ?? 0), expiryLabel(item.expiryDate), stockStatus(item), formatFCFA(item.quantity * Number(item.purchasePrice ?? 0))]), styles: { fontSize: 7 }, headStyles: { fillColor: [25, 56, 46] }, alternateRowStyles: { fillColor: [245, 249, 243] }, margin: { left: 14, right: 14 } });
    const finalY = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? contentStart + 8;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text(`Références : ${items.length} · Valeur estimée : ${formatFCFA(stockValue)} · Alertes : ${lowStock.length + expiringItems.length}`, 14, finalY + 10);
    doc.setFontSize(12);
    doc.text('Mouvements de stock enregistrés', 14, finalY + 24);
    doc.setFont('helvetica', 'normal');
    autoTable(doc, { startY: finalY + 28, head: [['Date', 'Type', 'Article', 'Variation', 'Motif', 'Rattachement']], body: movements.slice(0, 20).map((movement) => [formatDate(movement.date), movement.type, movement.itemName, `${movement.delta > 0 ? '+' : ''}${movement.delta} ${movement.unit}`, movement.reason, movement.building ?? 'Stock ferme']), styles: { fontSize: 7 }, headStyles: { fillColor: [91, 157, 91] }, alternateRowStyles: { fillColor: [250, 252, 249] }, margin: { left: 14, right: 14 } });
    addPdfFooter(doc);
    doc.save(`inventaire-ferme-${inventoryDate}.pdf`);
    notify('Le rapport PDF de l’inventaire a été généré avec le logo SCOOPS LE REVEIL.');
  }

  function saveArticle(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get('name') ?? '').trim();
    const category = String(form.get('category') ?? 'Consommables');
    const measurementUnit = String(form.get('measurementUnit') ?? 'unité');
    const expiryDate = String(form.get('expiryDate') ?? '');
    const quantity = Number(form.get('quantity') ?? 0);
    const minimum = Number(form.get('minimum') ?? 0);
    const purchasePrice = Number(form.get('purchasePrice') ?? 0);
    if (!name || purchasePrice < 0) return;
    if (editingItem) {
      setItems((current) => current.map((item) => item.id === editingItem.id ? { ...item, name, category, unit: measurementUnit, quantity, min: minimum, purchasePrice, expiryDate, status: 'Normal' } : item));
      notify(`${name} a été modifié.`);
    } else {
      const id = `ST-F-${String(Date.now()).slice(-4)}`;
      setItems((current) => [...current, { id, name, category, quantity, unit: measurementUnit, unitId: 'poulets', min: minimum, purchasePrice, location: 'Magasin ferme', expiryDate, status: 'Normal', color: '#9ab4a3' }]);
      notify(`${name} a été ajouté au catalogue de la ferme.`);
    }
    setEditingItem(null);
    setArticleOpen(false);
  }

  function saveCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = String(new FormData(event.currentTarget).get('categoryName') ?? '').trim();
    if (!name) return;
    if (editingCategory) {
      setCategories((current) => current.map((category) => category === editingCategory ? name : category));
      notify(`La catégorie « ${editingCategory} » a été renommée.`);
    } else if (!categories.includes(name)) {
      setCategories((current) => [...current, name]);
      notify(`La catégorie « ${name} » a été créée.`);
    }
    setEditingCategory('');
  }

  return <div className="fade-in space-y-7"><div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between"><div><Link href="/dashboard/poulets" className="mb-4 inline-flex items-center gap-2 text-[11px] font-bold text-[#6c8176] hover:text-forest"><ArrowLeft size={14} /> Retour au dashboard ferme</Link><p className="eyebrow mb-2">Ferme · Articles propres à l’unité</p><h1 className="page-title">Articles de la ferme</h1><p className="muted mt-2 max-w-2xl text-[13px] leading-5">Enregistrez tout le matériel et tous les articles détenus par la ferme. Chaque article peut ensuite être confié à un employé avec une traçabilité complète.</p></div><div className="flex flex-wrap gap-2"><button className="btn-secondary" onClick={() => { setEditingItem(null); setArticleOpen(true); }}><Plus size={15} /> Nouvel article</button><Link href="/stocks/attributions/poulets" className="btn-secondary"><ClipboardList size={15} /> Articles confiés</Link><button className="btn-secondary" onClick={() => setCategoryOpen(true)}><Tag size={15} /> Catégories</button><button className="btn-secondary" onClick={() => setTab('inventory')}><RefreshCw size={15} /> Mettre à jour l’inventaire</button><button className="btn-primary" onClick={() => setMovementOpen(true)}><Plus size={16} /> Nouveau mouvement</button></div></div>{feedback && <div className="flex items-start gap-2 rounded-xl border border-[#cde8c7] bg-[#effaeb] px-4 py-3 text-[12px] font-semibold leading-5 text-[#4d8f51]"><span className="mt-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-[#72bf70] text-white"><Check size={13} /></span>{feedback}</div>}
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><StatCard label="Valeur du stock ferme" value={stockValue} change="2 unités suivies" detail="poulets uniquement" icon={Warehouse} tone="green" /><StatCard label="Références" value={String(items.length)} change="catalogue actif" detail="dans l’unité ferme" icon={Boxes} tone="blue" /><StatCard label="Alertes stock" value={String(lowStock.length + expiringItems.length)} change={lowStock.length ? 'Rupture / seuil faible' : expiringItems.length ? 'Expiration proche' : 'Tout est normal'} detail="stock & dates" trend={lowStock.length || expiringItems.length ? 'down' : 'up'} icon={AlertTriangle} tone="orange" /><StatCard label="Mouvements ce mois" value={String(movements.length)} change="Entrées & sorties" detail="traçabilité locale" icon={History} tone="purple" /></div>
    <div className="flex gap-1 overflow-x-auto rounded-xl bg-[#f0f5ee] p-1"><TabButton active={tab === 'stock'} onClick={() => setTab('stock')}>Stock actuel</TabButton><TabButton active={tab === 'movements'} onClick={() => setTab('movements')}>Mouvements</TabButton><TabButton active={tab === 'inventory'} onClick={() => setTab('inventory')}>Inventaire</TabButton><TabButton active={tab === 'orders'} onClick={() => setTab('orders')}>Commandes</TabButton></div>
    {tab === 'stock' && <StockTable items={filteredItems} query={query} setQuery={setQuery} lowStock={lowStock} expiringItems={expiringItems} onMovement={() => setMovementOpen(true)} onEdit={(item) => { setEditingItem(item); setArticleOpen(true); }} />}
    {tab === 'movements' && <MovementsTable movements={movements} onMovement={() => setMovementOpen(true)} />}
    {tab === 'inventory' && <InventoryView items={items} movements={movements} onMovement={() => setMovementOpen(true)} onExport={generateInventoryPdf} />}
    {tab === 'orders' && <OrdersView orders={orders} onOrder={() => setOrderOpen(true)} onStatus={updateOrderStatus} />}
    <Modal open={movementOpen} onClose={() => setMovementOpen(false)} title="Nouveau mouvement de stock"><form onSubmit={createMovement} className="space-y-5"><p className="muted text-[12px] leading-5">Une entrée augmente le stock, une sortie le diminue. L’ajustement remplace la quantité par le résultat de l’inventaire physique.</p><div className="grid gap-4 sm:grid-cols-2"><label className="block"><span className="field-label">Type de mouvement</span><select name="type" className="input-base"><option>Entrée</option><option>Sortie</option><option>Ajustement</option></select></label><label className="block"><span className="field-label">Date</span><input name="date" type="date" defaultValue="2026-08-12" className="input-base" /></label><label className="block sm:col-span-2"><span className="field-label">Article</span><select name="itemId" className="input-base">{items.map((item) => <option key={item.id} value={item.id}>{item.name} · disponible {item.quantity} {item.unit}</option>)}</select></label><label className="block"><span className="field-label">Quantité</span><input name="quantity" type="number" min="0.1" step="0.1" className="input-base" placeholder="0" required /></label><label className="block"><span className="field-label">Bâtiment</span><select name="building" className="input-base"><option value="">Non rattaché</option><option>Bâtiment A</option><option>Bâtiment B</option><option>Bâtiment C</option></select></label><label className="block"><span className="field-label">Bande (facultatif)</span><input name="batch" className="input-base" placeholder="LP-26-004" /></label></div><label className="block"><span className="field-label">Motif</span><textarea name="reason" className="input-base min-h-[72px] resize-none" placeholder="Consommation, réception, inventaire physique..." /></label><div className="flex justify-end gap-2"><button type="button" className="btn-secondary" onClick={() => setMovementOpen(false)}>Annuler</button><button type="submit" className="btn-primary"><Check size={15} /> Valider le mouvement</button></div></form></Modal>
    <Modal open={orderOpen} onClose={() => setOrderOpen(false)} title="Créer une commande"><form onSubmit={createOrder} className="space-y-5"><p className="muted text-[12px] leading-5">La commande reste dans le périmètre de la ferme. Une réception mettra à jour le stock par une entrée.</p><div className="grid gap-4 sm:grid-cols-2"><label className="block"><span className="field-label">Fournisseur</span><input name="supplier" className="input-base" placeholder="Nom du fournisseur" required /></label><label className="block"><span className="field-label">Date</span><input name="date" type="date" defaultValue="2026-08-12" className="input-base" /></label><label className="block sm:col-span-2"><span className="field-label">Article</span><select name="itemId" className="input-base">{items.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.unit}</option>)}</select></label><label className="block"><span className="field-label">Quantité demandée</span><input name="quantity" type="number" min="1" className="input-base" placeholder="50" required /></label><label className="block"><span className="field-label">Priorité</span><select name="priority" className="input-base"><option>Normale</option><option>Urgente</option></select></label></div><div className="flex justify-end gap-2"><button type="button" className="btn-secondary" onClick={() => setOrderOpen(false)}>Annuler</button><button type="submit" className="btn-primary"><Truck size={15} /> Créer la commande</button></div></form></Modal>
    <Modal open={articleOpen} onClose={() => { setArticleOpen(false); setEditingItem(null); }} title={editingItem ? 'Modifier un article' : 'Créer un article'}><form onSubmit={saveArticle} className="space-y-5"><p className="muted text-[12px] leading-5">Le catalogue de la ferme est évolutif : vous pouvez ajouter ou modifier les articles utilisés par l’élevage.</p><div className="grid gap-4 sm:grid-cols-2"><label className="block sm:col-span-2"><span className="field-label">Nom de l’article</span><input name="name" className="input-base" defaultValue={editingItem?.name ?? ''} placeholder="Ex. Aliment finition 50 kg" required /></label><label className="block"><span className="field-label">Catégorie</span><select name="category" className="input-base" defaultValue={editingItem?.category ?? categories[0]}>{categories.map((category) => <option key={category}>{category}</option>)}</select></label><label className="block"><span className="field-label">Unité</span><select name="measurementUnit" className="input-base" defaultValue={editingItem?.unit ?? 'kg'}><option>kg</option><option>sac</option><option>flacon</option><option>litre</option><option>pièce</option><option>carton</option></select></label><label className="block"><span className="field-label">Prix d’achat unitaire (FCFA)</span><input name="purchasePrice" type="number" min="0" step="1" className="input-base" defaultValue={editingItem?.purchasePrice ?? 0} placeholder="Ex. 575" required /></label><label className="block"><span className="field-label">Date d’expiration (facultatif)</span><input name="expiryDate" type="date" className="input-base" defaultValue={editingItem?.expiryDate ?? ''} /></label><label className="block"><span className="field-label">Quantité actuelle</span><input name="quantity" type="number" min="0" step="0.1" className="input-base" defaultValue={editingItem?.quantity ?? 0} /></label><label className="block"><span className="field-label">Seuil d’alerte</span><input name="minimum" type="number" min="0" step="0.1" className="input-base" defaultValue={editingItem?.min ?? 0} /></label></div><div className="flex items-center justify-between rounded-xl bg-[#f5faf2] px-3 py-2.5 text-[10px] text-[#6f9073]"><span>Vous voulez une autre catégorie ?</span><button type="button" className="font-bold text-[#5b9d5b] hover:underline" onClick={() => { setArticleOpen(false); setCategoryOpen(true); }}>Gérer les catégories</button></div><div className="flex justify-end gap-2"><button type="button" className="btn-secondary" onClick={() => { setArticleOpen(false); setEditingItem(null); }}>Annuler</button><button type="submit" className="btn-primary"><Check size={15} /> {editingItem ? 'Enregistrer les modifications' : 'Créer l’article'}</button></div></form></Modal>
    <Modal open={categoryOpen} onClose={() => { setCategoryOpen(false); setEditingCategory(''); }} title="Catégories d’articles"><div className="space-y-4"><p className="muted text-[12px] leading-5">Créez ou renommez les catégories utilisées par le catalogue de la ferme.</p><div className="space-y-2">{categories.map((category) => <div className="flex items-center gap-2 rounded-xl border border-[#edf0eb] px-3 py-2.5" key={category}><Tag size={14} className="text-[#5b9d5b]" /><span className="flex-1 text-[11px] font-bold text-ink">{category}</span><button className="icon-btn h-7 w-7" onClick={() => setEditingCategory(category)} aria-label="Modifier la catégorie"><Pencil size={13} /></button></div>)}</div><form onSubmit={saveCategory} className="flex gap-2 border-t border-[#edf0eb] pt-4"><input name="categoryName" className="input-base" defaultValue={editingCategory} placeholder="Nouvelle catégorie" key={editingCategory || 'new'} required /><button type="submit" className="btn-primary px-3"><Plus size={14} /> {editingCategory ? 'Renommer' : 'Créer'}</button></form>{editingCategory && <button className="text-[10px] font-bold text-[#87958d] hover:underline" onClick={() => setEditingCategory('')}>Annuler la modification</button>}</div></Modal>
  </div>;
}

function StockTable({ items, query, setQuery, lowStock, expiringItems, onMovement, onEdit }: { items: StockItem[]; query: string; setQuery: (value: string) => void; lowStock: StockItem[]; expiringItems: StockItem[]; onMovement: () => void; onEdit: (item: StockItem) => void }) { return <div className="space-y-5"><div className="flex flex-col gap-4 rounded-2xl border border-[#f2dfc1] bg-[#fff9ed] p-5 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-start gap-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#ffeccf] text-[#bd7937]"><AlertTriangle size={17} /></span><div><p className="text-[12px] font-bold text-[#85552c]">{lowStock.length || expiringItems.length ? `${lowStock.length} rupture(s)/stock(s) faible · ${expiringItems.length} expiration(s)` : 'Aucune alerte de stock'}</p><p className="mt-1 text-[10px] leading-4 text-[#a4754d]">{lowStock.length || expiringItems.length ? 'Traitez les ruptures, les seuils faibles et les articles proches de l’expiration.' : 'Les niveaux et dates d’expiration de la ferme sont corrects.'}</p></div></div><button className="btn-secondary border-[#f2d8b7] bg-white text-[#a86631]" onClick={onMovement}><Plus size={14} /> Mettre à jour</button></div><div className="surface overflow-hidden"><div className="flex flex-col gap-4 border-b border-[#edf0eb] px-5 pb-4 pt-5 sm:flex-row sm:items-center sm:justify-between sm:px-6"><SectionHeading eyebrow="Stock propre à la ferme" title="Articles disponibles" description="Aucune donnée des autres unités n’est affichée ici." /><div className="relative min-w-[230px]"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9aa69f]" /><input value={query} onChange={(event) => setQuery(event.target.value)} className="input-base h-9 rounded-lg bg-[#fbfcfa] pl-9 text-[11px]" placeholder="Rechercher un article..." /></div></div><div className="table-scroll"><table className="w-full text-left"><thead><tr className="table-head"><th>Article</th><th>Catégorie</th><th>Quantité disponible</th><th>Seuil</th><th>Prix d’achat</th><th>Expiration</th><th>Valeur estimée</th><th>Statut</th><th /></tr></thead><tbody>{items.map((item) => <tr className="table-row table-line" key={item.id}><td><p className="font-bold text-ink">{item.name}</p><p className="mt-1 text-[10px] text-[#9aa59f]">{item.id} · {item.location}</p></td><td>{item.category}</td><td className="font-bold text-ink">{formatNumber(item.quantity)} {item.unit}</td><td>{formatNumber(item.min)} {item.unit}</td><td>{formatFCFA(item.purchasePrice ?? 0)}</td><td><span className={['Expiré', 'Expire bientôt'].includes(stockStatus(item)) ? 'font-bold text-[#bd7737]' : 'text-[#7e8c84]'}>{expiryLabel(item.expiryDate)}</span></td><td>{formatFCFA(item.quantity * Number(item.purchasePrice ?? 0))}</td><td><StatusBadge status={stockStatus(item)} /></td><td><button className="icon-btn h-8 w-8" onClick={() => onEdit(item)} aria-label="Modifier l’article"><Pencil size={14} /></button></td></tr>)}</tbody></table></div></div></div>; }

function MovementsTable({ movements, onMovement }: { movements: FarmMovement[]; onMovement: () => void }) { return <div className="surface overflow-hidden"><div className="flex items-center justify-between border-b border-[#edf0eb] px-5 py-5 sm:px-6"><SectionHeading eyebrow="Traçabilité stock" title="Mouvements de la ferme" description="Chaque entrée, sortie ou correction met à jour le stock local." /><button className="btn-primary px-3 py-2 text-[11px]" onClick={onMovement}><Plus size={14} /> Nouveau mouvement</button></div><div className="table-scroll"><table className="w-full text-left"><thead><tr className="table-head"><th>Date</th><th>Référence</th><th>Type</th><th>Article</th><th>Quantité</th><th>Rattachement</th><th>Motif</th></tr></thead><tbody>{movements.map((movement) => <tr className="table-row table-line" key={movement.id}><td>{formatDate(movement.date)}</td><td className="font-bold text-ink">{movement.id}</td><td><span className={`inline-flex items-center gap-1.5 text-[10px] font-bold ${movement.type === 'Entrée' ? 'text-[#5b9d5b]' : movement.type === 'Sortie' ? 'text-[#bd7737]' : 'text-[#6385bd]'}`}>{movement.type === 'Entrée' ? <ArrowUpRight size={13} /> : movement.type === 'Sortie' ? <ArrowDownRight size={13} /> : <RefreshCw size={13} />}{movement.type}</span></td><td>{movement.itemName}</td><td className="font-bold text-ink">{movement.delta > 0 ? '+' : ''}{movement.delta} {movement.unit}</td><td>{movement.building ? `${movement.building}${movement.batch ? ` · ${movement.batch}` : ''}` : 'Stock ferme'}</td><td>{movement.reason}</td></tr>)}</tbody></table></div></div>; }

function InventoryView({ items, movements, onMovement, onExport }: { items: StockItem[]; movements: FarmMovement[]; onMovement: () => void; onExport: () => void }) { const entries = movements.filter((movement) => movement.type === 'Entrée').reduce((sum, movement) => sum + movement.quantity, 0); const exits = movements.filter((movement) => movement.type === 'Sortie').reduce((sum, movement) => sum + movement.quantity, 0); return <div className="space-y-5"><div className="flex flex-wrap justify-end gap-2"><button className="btn-secondary" onClick={onMovement}><ClipboardCheck size={14} /> Commencer l’inventaire</button><button className="btn-primary" onClick={onExport}><FileText size={14} /> Générer le rapport PDF</button></div><div className="grid gap-4 sm:grid-cols-3"><InventorySummary label="Articles en stock" value={String(items.length)} detail="références actives" icon={Boxes} tone="green" /><InventorySummary label="Entrées enregistrées" value={`${formatNumber(entries)}`} detail="unités cumulées" icon={ArrowUpRight} tone="blue" /><InventorySummary label="Sorties enregistrées" value={`${formatNumber(exits)}`} detail="unités cumulées" icon={ArrowDownRight} tone="orange" /></div><div className="grid gap-5 lg:grid-cols-[1fr_.8fr]"><div className="surface p-5 sm:p-6"><SectionHeading eyebrow="Inventaire physique" title="État général du stock" description="Comparez la quantité théorique, la quantité constatée et les dates d’expiration." /><div className="mt-5 space-y-3">{items.map((item) => <div className="flex items-center gap-3 rounded-xl border border-[#edf0eb] p-3" key={item.id}><span className={`flex h-9 w-9 items-center justify-center rounded-xl ${stockStatus(item) === 'Rupture' ? 'bg-[#fdeceb] text-[#bd5c5c]' : 'bg-[#edf8ea] text-[#5b9d5b]'}`}><Boxes size={16} /></span><div className="min-w-0 flex-1"><p className="truncate text-[11px] font-bold text-ink">{item.name}</p><p className="mt-1 text-[10px] text-[#8b9891]">Théorique : {item.quantity} {item.unit} · achat : {formatFCFA(item.purchasePrice ?? 0)} / {item.unit} · seuil : {item.min} · {expiryLabel(item.expiryDate)}</p></div><StatusBadge status={stockStatus(item)} /><button className="btn-secondary px-2.5 py-1.5 text-[10px]" onClick={onMovement}>Ajuster</button></div>)}</div></div><div className="surface bg-forest p-5 text-white sm:p-6"><RefreshCw size={21} className="text-[#a4eb91]" /><p className="eyebrow mt-5 text-[#91af9f]">Rapport professionnel</p><h2 className="mt-2 text-[20px] font-bold tracking-[-.04em]">Un inventaire complet, prêt à exporter.</h2><p className="mt-2 text-[11px] leading-5 text-[#a8c4ae]">Le PDF reprend SCOOPS LE REVEIL, l’unité ferme, la date, les articles, les quantités, les seuils, les expirations et les mouvements d’entrée/sortie.</p><button className="mt-5 inline-flex items-center gap-2 rounded-lg bg-[#a4eb91] px-3.5 py-2.5 text-[11px] font-bold text-forest" onClick={onExport}><Download size={14} /> Télécharger l’inventaire</button></div></div></div>; }
function InventorySummary({ label, value, detail, icon: Icon, tone }: { label: string; value: string; detail: string; icon: typeof Boxes; tone: 'green' | 'blue' | 'orange' }) { const classes = { green: 'bg-[#edf8ea] text-[#5b9d5b]', blue: 'bg-[#edf3ff] text-[#6385bd]', orange: 'bg-[#fff2e2] text-[#bd7737]' }; return <div className="surface flex items-center gap-3 p-4"><span className={`flex h-9 w-9 items-center justify-center rounded-xl ${classes[tone]}`}><Icon size={16} /></span><div><p className="text-[10px] font-semibold text-[#849188]">{label}</p><p className="mt-1 text-[17px] font-black text-ink">{value}</p><p className="mt-1 text-[9px] text-[#9aa59f]">{detail}</p></div></div>; }

function OrdersView({ orders, onOrder, onStatus }: { orders: FarmOrder[]; onOrder: () => void; onStatus: (id: string, status: FarmOrder['status']) => void }) { return <div className="surface overflow-hidden"><div className="flex items-center justify-between border-b border-[#edf0eb] px-5 py-5 sm:px-6"><SectionHeading eyebrow="Approvisionnement ferme" title="Commandes de stock" description="Commandez des articles de la ferme et réceptionnez-les dans le stock propre." /><button className="btn-primary px-3 py-2 text-[11px]" onClick={onOrder}><Plus size={14} /> Créer une commande</button></div><div className="table-scroll"><table className="w-full text-left"><thead><tr className="table-head"><th>Commande</th><th>Date</th><th>Fournisseur</th><th>Article</th><th>Quantité</th><th>Priorité</th><th>Statut</th><th>Action</th></tr></thead><tbody>{orders.map((order) => <tr className="table-row table-line" key={order.id}><td className="font-bold text-ink">{order.id}</td><td>{formatDate(order.date)}</td><td>{order.supplier}</td><td>{order.itemName}</td><td>{order.quantity} {order.unit}</td><td><span className={order.priority === 'Urgente' ? 'rounded-full bg-[#fdeceb] px-2 py-1 text-[10px] font-bold text-[#bd5c5c]' : 'rounded-full bg-[#f1f5ef] px-2 py-1 text-[10px] font-bold text-[#66766d]'}>{order.priority}</span></td><td><StatusBadge status={order.status === 'Reçue' ? 'Réceptionné' : order.status === 'Brouillon' ? 'Brouillon' : 'Envoyée'} /></td><td>{order.status === 'Brouillon' ? <button className="btn-secondary px-2.5 py-1.5 text-[10px]" onClick={() => onStatus(order.id, 'Envoyée')}>Envoyer</button> : order.status !== 'Reçue' ? <button className="btn-primary px-2.5 py-1.5 text-[10px]" onClick={() => onStatus(order.id, 'Reçue')}>Réceptionner</button> : <span className="text-[10px] font-semibold text-[#5b9d5b]">Stock mis à jour</span>}</td></tr>)}</tbody></table></div></div>; }

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) { return <button className={`whitespace-nowrap rounded-lg px-3 py-2 text-[11px] font-bold transition ${active ? 'bg-white text-forest shadow-sm' : 'text-[#87948c] hover:text-ink'}`} onClick={onClick}>{children}</button>; }
