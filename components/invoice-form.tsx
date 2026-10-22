'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, CalendarDays, Check, ChevronDown, FileDown, Pencil, Plus, Send, Trash2 } from 'lucide-react';
import { units } from '@/lib/data';
import type { poultryBuildings, poultryLots } from '@/lib/data';
import { formatFCFA } from '@/lib/format';
import { openInvoicePrint } from '@/lib/invoice-print';
import { StatusBadge } from '@/components/status-badge';
import { FARM_STORAGE_KEYS, readLocal, subscribeToFarmData, writeLocal } from '@/lib/farm-storage';
import { loadFarmSnapshot, registerPoultrySale } from '@/lib/farm-calculations';
import { registerDeadBirdStockSale, reconcileDeadBirdStock, remainingVendable, type DeadBirdStockItem } from '@/lib/dead-birds-stock';
import type { DagoReport } from '@/lib/dago';

const productOptions = [
  { label: 'Poulet de chair vivant', unit: 'tête', price: 4500 },
  { label: 'Aliment poulet croissance', unit: 'kg', price: 575 },
  { label: 'Huile de soja', unit: 'L', price: 1450 },
  { label: 'Tourteaux de soja', unit: 'kg', price: 420 },
  { label: 'Chèvre adulte', unit: 'tête', price: 68000 },
];
const poultryProductOptions = [...productOptions.filter((product) => ['Poulet de chair vivant', 'Aliment poulet croissance'].includes(product.label)), { label: 'Poulets morts', unit: 'tête', price: 0 }];
const DEAD_BIRD_BATCH_ID = 'POULETS_MORTS';
const provenderieProductOptions = [
  { label: 'Aliment démarrage granulé', unit: 'kg', price: 0 },
  { label: 'Aliment démarrage poudre', unit: 'kg', price: 0 },
  { label: 'Aliment croissance granulé', unit: 'kg', price: 0 },
  { label: 'Aliment croissance poudre', unit: 'kg', price: 0 },
  { label: 'Aliment finition granulé', unit: 'kg', price: 0 },
  { label: 'Aliment finition poudre', unit: 'kg', price: 0 },
];
const bioProductOptions = [
  { label: 'Complément végétal', unit: 'kg', price: 0 },
  { label: 'Préparation bio en poudre', unit: 'kg', price: 0 },
  { label: 'Préparation bio liquide', unit: 'litre', price: 0 },
];
const pressProductOptions = [
  { label: 'Huile de soja', unit: 'litre', price: 0 },
  { label: 'Huile d’arachide', unit: 'litre', price: 0 },
  { label: 'Huile de coton', unit: 'litre', price: 0 },
  { label: 'Huile de tournesol', unit: 'litre', price: 0 },
  { label: 'Tourteaux', unit: 'kg', price: 0 },
];
const centralProductOptions = [
  { label: 'Produit agricole', unit: 'unité', price: 0 },
  { label: 'Machine agricole', unit: 'unité', price: 0 },
];
const goatProductOptions = [
  { label: 'Lait de chèvre', unit: 'litre', price: 0 },
  { label: 'Chèvre adulte', unit: 'tête', price: 0 },
  { label: 'Chevreau', unit: 'unité', price: 0 },
  { label: 'Fumier de chèvre', unit: 'kg', price: 0 },
];

type InvoiceLine = { id: number; description: string; quantity: number; price: number; unit: string };

const defaultCustomerTypes = ['Restaurant', 'Grossiste', 'Éleveur', 'Particulier', 'Distributeur'];
const defaultChickenCategories = ['Poulet vivant', 'Poulet prêt à cuire', 'Poulet standard'];

export function InvoiceForm({ unitId = 'poulets' }: { unitId?: string }) {
  const [customer, setCustomer] = useState('');
  const [unit, setUnit] = useState(unitId);
  const [buildings, setBuildings] = useState<typeof poultryBuildings>([]);
  const [lots, setLots] = useState<typeof poultryLots>([]);
  const [deadBirdStock, setDeadBirdStock] = useState<DeadBirdStockItem[]>([]);
  const [building, setBuilding] = useState('Non rattaché');
  const [batchId, setBatchId] = useState('');
  const [deadStockId, setDeadStockId] = useState('');
  const availableProducts = unitId === 'poulets' ? poultryProductOptions : unitId === 'provenderie' ? provenderieProductOptions : unitId === 'bio' ? bioProductOptions : unitId === 'pressoir' ? pressProductOptions : unitId === 'stocks' ? centralProductOptions : unitId === 'chevrerie' ? goatProductOptions : productOptions;
  useEffect(() => {
    const load = () => {
      const snapshot = loadFarmSnapshot();
      setBuildings(snapshot.buildings);
      setLots(snapshot.lots);
      const reports = readLocal<DagoReport[]>(FARM_STORAGE_KEYS.dagoReports, []);
      const currentDeadBirdStock = readLocal<DeadBirdStockItem[]>(FARM_STORAGE_KEYS.deadBirdStock, []);
      const nextDeadBirdStock = reconcileDeadBirdStock(reports, currentDeadBirdStock);
      setDeadBirdStock(nextDeadBirdStock);
      if (JSON.stringify(nextDeadBirdStock) !== JSON.stringify(currentDeadBirdStock)) writeLocal(FARM_STORAGE_KEYS.deadBirdStock, nextDeadBirdStock);
    };
    load();
    return subscribeToFarmData([FARM_STORAGE_KEYS.buildings, FARM_STORAGE_KEYS.lots, FARM_STORAGE_KEYS.dagoReports, FARM_STORAGE_KEYS.deadBirdStock, FARM_STORAGE_KEYS.deadBirdStockMovements], load);
  }, []);
  const [customerType, setCustomerType] = useState(defaultCustomerTypes[0]);
  const [chickenCategory, setChickenCategory] = useState(defaultChickenCategories[0]);
  const [customerTypes, setCustomerTypes] = useState(defaultCustomerTypes);
  const [chickenCategories, setChickenCategories] = useState(defaultChickenCategories);
  const [issueDate, setIssueDate] = useState('2026-08-13');
  const [taxRate, setTaxRate] = useState(18);
  const [initialPayment, setInitialPayment] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState('Espèces');
  const [lines, setLines] = useState<InvoiceLine[]>([
    { id: 1, description: '', quantity: 1, price: 0, unit: 'unité' },
  ]);
  const [editingInvoiceId, setEditingInvoiceId] = useState('');
  const [feedback, setFeedback] = useState('');

  useEffect(() => {
    const queryDeadStockId = new URLSearchParams(window.location.search).get('deadStockId') ?? '';
    if (queryDeadStockId && unitId === 'poulets') {
      setBatchId(DEAD_BIRD_BATCH_ID);
      setDeadStockId(queryDeadStockId);
      setLines([{ id: Date.now(), description: 'Poulets morts', quantity: 1, price: 0, unit: 'tête' }]);
    }
    const raw = window.localStorage.getItem('agroflux-edit-invoice');
    if (!raw) return;
    try {
      const invoice = JSON.parse(raw);
      if (invoice.unit && invoice.unit !== unitId) return;
      setEditingInvoiceId(String(invoice.id ?? ''));
      setCustomer(invoice.client ?? invoice.customer ?? '');
      setUnit(invoice.unit ?? unitId);
      setBuilding(invoice.building ?? 'Non rattaché');
      setBatchId(invoice.saleType === 'poulets-morts' || invoice.deadBirdStockId ? DEAD_BIRD_BATCH_ID : invoice.batchId ?? '');
      setDeadStockId(invoice.deadBirdStockId ?? '');
      setCustomerType(invoice.customerType ?? defaultCustomerTypes[0]);
      setChickenCategory(invoice.chickenCategory ?? defaultChickenCategories[0]);
      setIssueDate(invoice.issueDate ?? invoice.date ?? '2026-08-13');
      setTaxRate(Number(invoice.taxRate ?? 18));
      setInitialPayment(Number(invoice.paid ?? 0));
      setPaymentMethod(invoice.paymentMethod ?? 'Espèces');
      if (Array.isArray(invoice.lines) && invoice.lines.length) {
        setLines(invoice.lines.map((line: { id?: number; description?: string; quantity?: number; price?: number; unit?: string; unitPrice?: number }) => ({ id: line.id ?? Date.now() + Math.random(), description: line.description ?? '', quantity: Number(line.quantity ?? 1), price: Number(line.price ?? line.unitPrice ?? 0), unit: line.unit ?? 'unité' })));
      }
      window.localStorage.removeItem('agroflux-edit-invoice');
    } catch {
      window.localStorage.removeItem('agroflux-edit-invoice');
    }
  }, [unitId]);

  useEffect(() => {
    if (!deadStockId) return;
    const stock = deadBirdStock.find((item) => item.id === deadStockId);
    if (stock) setBuilding(stock.buildingName);
  }, [deadStockId, deadBirdStock]);

  const subtotal = useMemo(() => lines.reduce((sum, line) => sum + line.quantity * line.price, 0), [lines]);
  const tax = Math.round(subtotal * taxRate / 100);
  const total = subtotal + tax;
  const paidAmount = Math.min(Math.max(initialPayment, 0), total);
  const remainingAmount = Math.max(total - paidAmount, 0);
  const paymentStatus = paidAmount >= total && total > 0 ? 'Payée' : paidAmount > 0 ? 'Partiellement payée' : 'Impayée';
  const deadBirdSaleSelected = unit === 'poulets' && batchId === DEAD_BIRD_BATCH_ID;
  const selectedDeadStock = deadBirdStock.find((item) => item.id === deadStockId);
  const deadBirdQuantityPreview = deadBirdSaleSelected ? lines.filter((line) => line.description === 'Poulets morts').reduce((sum, line) => sum + Number(line.quantity || 0), 0) : 0;
  const deadBirdRemainingAfterSale = selectedDeadStock ? remainingVendable(selectedDeadStock) - deadBirdQuantityPreview : null;

  function addCustomerType() {
    const value = window.prompt('Nom du type de client');
    if (!value?.trim()) return;
    const next = value.trim();
    setCustomerTypes((current) => current.includes(next) ? current : [...current, next]);
    setCustomerType(next);
  }

  function editCustomerType() {
    const value = window.prompt('Modifier le type de client', customerType);
    if (!value?.trim()) return;
    const next = value.trim();
    setCustomerTypes((current) => current.map((item) => item === customerType ? next : item));
    setCustomerType(next);
  }

  function addChickenCategory() {
    const value = window.prompt('Nom de la catégorie de poulet');
    if (!value?.trim()) return;
    const next = value.trim();
    setChickenCategories((current) => current.includes(next) ? current : [...current, next]);
    setChickenCategory(next);
  }

  function editChickenCategory() {
    const value = window.prompt('Modifier la catégorie de poulet', chickenCategory);
    if (!value?.trim()) return;
    const next = value.trim();
    setChickenCategories((current) => current.map((item) => item === chickenCategory ? next : item));
    setChickenCategory(next);
  }

  function updateLine(id: number, key: keyof InvoiceLine, value: string | number) {
    setLines((current) => current.map((line) => line.id === id ? { ...line, [key]: value } : line));
  }

  function addLine() {
    setLines((current) => [...current, { id: Date.now(), description: '', quantity: 1, price: 0, unit: 'unité' }]);
  }

  function removeLine(id: number) {
    setLines((current) => current.length > 1 ? current.filter((line) => line.id !== id) : current);
  }

  function handleProductChange(id: number, description: string) {
    const product = availableProducts.find((option) => option.label === description);
    if (!product) return updateLine(id, 'description', description);
    if (unitId === 'poulets' && product.label === 'Poulets morts') {
      setBatchId(DEAD_BIRD_BATCH_ID);
      setDeadStockId('');
      setBuilding('Non rattaché');
    } else if (unitId === 'poulets' && batchId === DEAD_BIRD_BATCH_ID) {
      setBatchId('');
      setDeadStockId('');
      setBuilding('Non rattaché');
    }
    setLines((current) => current.map((line) => line.id === id ? { ...line, description: product.label, price: product.price, unit: product.unit } : line));
  }

  function save() {
    if (initialPayment > total) {
      setFeedback(`Le versement ne peut pas dépasser le montant total de ${formatFCFA(total)}.`);
      return;
    }
    const poultryLines = unit === 'poulets' ? lines.filter((line) => line.description === 'Poulet de chair vivant') : [];
    const deadBirdLines = unit === 'poulets' ? lines.filter((line) => line.description === 'Poulets morts') : [];
    const poultryQuantity = poultryLines.reduce((sum, line) => sum + Number(line.quantity || 0), 0);
    const deadBirdQuantity = deadBirdLines.reduce((sum, line) => sum + Number(line.quantity || 0), 0);
    const deadBirdTotal = deadBirdLines.reduce((sum, line) => sum + line.quantity * line.price, 0);
    const selectedBuilding = buildings.find((item) => item.name === building);
    const selectedBatch = lots.find((lot) => lot.id === (batchId || selectedBuilding?.batch));
    if (poultryQuantity > 0 && deadBirdQuantity > 0) {
      setFeedback('Séparez les poulets vivants et les poulets morts sur deux factures pour conserver une traçabilité claire.');
      return;
    }
    if (deadBirdQuantity > 0 && (!deadBirdSaleSelected || !selectedDeadStock)) {
      setFeedback('Pour facturer des poulets morts, choisissez « Poulets morts » dans Bande concernée puis une réception du stock séparé.');
      return;
    }
    if (deadBirdSaleSelected && deadBirdQuantity === 0) {
      setFeedback('Ajoutez une ligne « Poulets morts » avant d’enregistrer cette facture.');
      return;
    }
    if (deadBirdQuantity > 0 && deadBirdTotal <= 0) {
      setFeedback('Saisissez un tarif unitaire supérieur à zéro pour les poulets morts.');
      return;
    }
    if (selectedDeadStock && deadBirdQuantity > remainingVendable(selectedDeadStock)) {
      setFeedback(`La quantité facturée (${deadBirdQuantity}) dépasse le stock vendable disponible (${remainingVendable(selectedDeadStock)}).`);
      return;
    }
    if (poultryQuantity > 0 && !selectedBatch) {
      setFeedback('Sélectionnez la bande concernée avant d’enregistrer la facture de poulets vivants.');
      return;
    }
    if (poultryQuantity > 0 && selectedBatch && poultryQuantity > selectedBatch.alive) {
      setFeedback(`La quantité facturée (${poultryQuantity}) dépasse l’effectif disponible de la bande (${selectedBatch.alive}).`);
      return;
    }
    const invoiceId = editingInvoiceId || `FAC-${issueDate.slice(0, 4)}-${String(Date.now()).slice(-6)}`;
    if (!editingInvoiceId && deadBirdQuantity > 0 && selectedDeadStock) {
      const saleRecorded = registerDeadBirdStockSale({ invoiceId, stockId: selectedDeadStock.id, date: issueDate, quantity: deadBirdQuantity, unitPrice: Math.round(deadBirdTotal / deadBirdQuantity), amount: deadBirdTotal, customer, paymentMethod });
      if (!saleRecorded) {
        setFeedback('La vente n’a pas pu être enregistrée : vérifiez le stock vendable disponible.');
        return;
      }
    }
    const saved = { id: invoiceId, client: customer, email: '', date: issueDate, amount: total, items: lines.length, customer, customerType, chickenCategory, building: deadBirdQuantity > 0 ? selectedDeadStock?.buildingName ?? building : building, batchId: deadBirdQuantity > 0 ? DEAD_BIRD_BATCH_ID : selectedBatch?.id ?? '', deadBirdBatchId: deadBirdQuantity > 0 ? selectedDeadStock?.batchId ?? '' : '', deadBirdStockId: deadBirdQuantity > 0 ? selectedDeadStock?.id ?? '' : '', deadBirdQuantity, saleType: deadBirdQuantity > 0 ? 'poulets-morts' : 'poulets-vivants', unit, issueDate, dueDate: '', taxRate, lines, subtotal, tax, total, paid: paidAmount, remaining: remainingAmount, paymentMethod, status: paymentStatus, payments: paidAmount > 0 ? [{ date: issueDate, amount: paidAmount, method: paymentMethod }] : [] };
    if (!editingInvoiceId && poultryQuantity > 0 && selectedBatch) {
      const poultryTotal = poultryLines.reduce((sum, line) => sum + line.quantity * line.price, 0);
      const saleRecorded = registerPoultrySale({ id: `VENTE-${invoiceId}`, batchId: selectedBatch.id, buildingName: selectedBuilding?.name, date: issueDate, quantity: poultryQuantity, unitPrice: Math.round(poultryTotal / poultryQuantity), total: poultryTotal, customer, paymentMethod });
      if (!saleRecorded) {
        setFeedback('La vente n’a pas pu être enregistrée : vérifiez l’effectif disponible.');
        return;
      }
    }
    const existing = readLocal(FARM_STORAGE_KEYS.invoices, [] as Array<{ id?: string }>);
    writeLocal('agroflux-last-invoice', saved);
    writeLocal(FARM_STORAGE_KEYS.invoices, [saved, ...existing.filter((item) => item.id !== invoiceId)]);
    openInvoicePrint({ id: invoiceId, customer, customerType, poultryCategory: chickenCategory, building: deadBirdQuantity > 0 ? selectedDeadStock?.buildingName ?? building : building, unitLabel: units.find((item) => item.id === unit)?.label ?? unit, issueDate, taxRate, subtotal, tax, total, paid: paidAmount, remaining: remainingAmount, status: paymentStatus, paymentMethod, lines: lines.map((line) => ({ description: line.description || 'Article', quantity: line.quantity, unit: line.unit, unitPrice: line.price, total: line.quantity * line.price })) });
    setFeedback(`La facture ${invoiceId} a été validée et enregistrée. Reste à payer : ${formatFCFA(remainingAmount)}.`);
    window.setTimeout(() => setFeedback(''), 5000);
  }

  function printInvoice() {
    if (initialPayment > total) {
      setFeedback(`Le versement ne peut pas dépasser le montant total de ${formatFCFA(total)}.`);
      return;
    }
    openInvoicePrint({ id: editingInvoiceId || 'APERÇU', customer, customerType, poultryCategory: chickenCategory, building, unitLabel: units.find((item) => item.id === unit)?.label ?? unit, issueDate, taxRate, subtotal, tax, total, paid: paidAmount, remaining: remainingAmount, status: paymentStatus, paymentMethod, lines: lines.map((line) => ({ description: line.description || 'Article', quantity: line.quantity, unit: line.unit, unitPrice: line.price, total: line.quantity * line.price })) });
  }

  return <div className="fade-in mx-auto max-w-[1100px] space-y-6">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><Link href={unitId === 'poulets' ? '/factures/ferme' : unitId === 'provenderie' ? '/factures/provenderie' : unitId === 'bio' ? '/factures/bio' : unitId === 'pressoir' ? '/factures/pressoir' : unitId === 'stocks' ? '/factures/stocks' : unitId === 'chevrerie' ? '/factures/chevrerie' : '/factures'} className="mb-4 inline-flex items-center gap-2 text-[11px] font-bold text-[#6c8176] hover:text-forest"><ArrowLeft size={14} /> Retour aux factures</Link><p className="eyebrow mb-2">Commerce · Nouvelle facture</p><h1 className="page-title">Créer une facture</h1><p className="muted mt-2 text-[13px]">Préparez une facture claire pour vos produits et services.</p></div><div className="flex flex-wrap items-center gap-2"><button className="btn-secondary" onClick={printInvoice}><FileDown size={15} /> Imprimer</button><button className="btn-primary" onClick={() => save()}><Send size={15} /> {editingInvoiceId ? 'Enregistrer les modifications' : 'Enregistrer et valider'}</button></div></div>

    {feedback && <div className="flex items-center gap-2 rounded-xl border border-[#cde8c7] bg-[#effaeb] px-4 py-3 text-[12px] font-semibold text-[#4d8f51]"><span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#72bf70] text-white"><Check size={13} /></span>{feedback}</div>}

    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_310px]">
      <div className="surface p-5 sm:p-7">
        <div className="mb-6 flex items-start justify-between gap-4"><div><h2 className="text-[17px] font-bold tracking-[-.03em]">Informations de la facture</h2><p className="muted mt-1 text-[12px]">Les informations seront visibles sur le document final.</p></div><span className="rounded-lg bg-[#edf7e9] px-2.5 py-1.5 text-[10px] font-bold text-[#568e57]">{editingInvoiceId || 'Numéro généré à la validation'}</span></div>
        <div className="grid gap-4 sm:grid-cols-2"><label className="block"><span className="field-label">Nom du client</span><input value={customer} onChange={(e) => setCustomer(e.target.value)} className="input-base" placeholder="Saisir le nom du client" required /></label><label className="block"><span className="field-label">Unité facturante</span>{unitId === 'poulets' ? <div className="input-base bg-[#f5faf2] font-bold text-[#4d8f52]">Ferme de poulets bio</div> : unitId === 'provenderie' ? <div className="input-base bg-[#fff7ed] font-bold text-[#bd7737]">Provenderie</div> : unitId === 'bio' ? <div className="input-base bg-[#f1ecff] font-bold text-[#8b73b8]">Produits bio</div> : unitId === 'pressoir' ? <div className="input-base bg-[#fff6d9] font-bold text-[#a9801e]">Pressoir à huile</div> : unitId === 'stocks' ? <div className="input-base bg-[#edf3ff] font-bold text-[#6385bd]">Magasin central</div> : unitId === 'chevrerie' ? <div className="input-base bg-[#edf8ea] font-bold text-[#5b9d5b]">Chèvrerie</div> : <div className="relative"><select value={unit} onChange={(e) => setUnit(e.target.value)} className="input-base appearance-none pr-9">{units.filter((item) => item.id !== 'stocks').map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select><ChevronDown size={15} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#8d9992]" /></div>}</label><label className="block"><span className="field-label">Bâtiment concerné</span>{deadBirdSaleSelected ? <div className="input-base bg-[#fff8ea] font-bold text-[#bd7737]">{selectedDeadStock?.buildingName ?? 'Bâtiment défini par la réception sélectionnée'}</div> : <select value={building} onChange={(e) => { const nextBuilding = e.target.value; setBuilding(nextBuilding); setBatchId(buildings.find((item) => item.name === nextBuilding)?.batch ?? ''); setDeadStockId(''); }} className="input-base"><option>Non rattaché</option>{buildings.filter((item) => unitId !== 'poulets' || item.status === 'Occupé').map((item) => <option key={item.id}>{item.name}</option>)}</select>}</label>{unitId === 'poulets' && <label className="block"><span className="field-label">Bande concernée</span><select value={batchId} onChange={(e) => { const nextBatch = e.target.value; setBatchId(nextBatch); setDeadStockId(''); if (nextBatch === DEAD_BIRD_BATCH_ID) setBuilding('Non rattaché'); }} className="input-base"><option value="">Sélectionner une bande</option>{lots.filter((lot) => lot.status !== 'Terminé' && lot.status !== 'Archivée').map((lot) => <option key={lot.id} value={lot.id}>{lot.id} · {lot.name} · {lot.alive} sujets</option>)}<option value={DEAD_BIRD_BATCH_ID}>Poulets morts · stock séparé</option></select></label>}{unitId === 'poulets' && deadBirdSaleSelected && <label className="block sm:col-span-2"><span className="field-label">Réception du stock poulets morts</span><select value={deadStockId} onChange={(e) => { const nextId = e.target.value; setDeadStockId(nextId); const stock = deadBirdStock.find((item) => item.id === nextId); if (stock) setBuilding(stock.buildingName); }} className="input-base" required><option value="">Sélectionner une réception</option>{deadBirdStock.filter((item) => remainingVendable(item) > 0).map((item) => <option key={item.id} value={item.id}>{item.reportId} · {item.buildingName} · {item.batchId || 'Sans bande'} · {remainingVendable(item)} vendable(s)</option>)}</select><p className="mt-1 text-[10px] text-[#89968f]">La quantité facturée sera déduite de cette réception et de son stock vendable.</p></label>}{deadBirdSaleSelected && selectedDeadStock && <div className="rounded-xl border border-[#e2d9f0] bg-[#faf7fd] p-4 sm:col-span-2"><p className="field-label">Stock vendu par bâtiment et par bande</p><div className="mt-3 grid gap-3 sm:grid-cols-4"><div><span className="block text-[9px] text-[#89968f]">Bâtiment</span><strong className="text-[11px] text-ink">{selectedDeadStock.buildingName}</strong></div><div><span className="block text-[9px] text-[#89968f]">Bande</span><strong className="text-[11px] text-ink">{selectedDeadStock.batchId || 'Sans bande'}</strong></div><div><span className="block text-[9px] text-[#89968f]">Déjà vendu</span><strong className="text-[11px] text-[#bd7737]">{selectedDeadStock.quantitySold}</strong></div><div><span className="block text-[9px] text-[#89968f]">Reste après vente</span><strong className={`text-[11px] ${deadBirdRemainingAfterSale !== null && deadBirdRemainingAfterSale < 0 ? 'text-[#b85b59]' : 'text-[#4d9352]'}`}>{deadBirdRemainingAfterSale ?? remainingVendable(selectedDeadStock)}</strong></div></div></div>}<label className="block"><span className="field-label">Type de client</span><div className="flex gap-2"><select value={customerType} onChange={(e) => setCustomerType(e.target.value)} className="input-base"><option value="">Sélectionner un type</option>{customerTypes.map((type) => <option key={type}>{type}</option>)}</select><button type="button" className="icon-btn h-10 w-10 shrink-0" onClick={addCustomerType} aria-label="Ajouter un type"><Plus size={14} /></button><button type="button" className="icon-btn h-10 w-10 shrink-0" onClick={editCustomerType} aria-label="Modifier le type"><Pencil size={14} /></button></div></label><label className="block"><span className="field-label">Catégorie de poulet</span><div className="flex gap-2"><select value={chickenCategory} onChange={(e) => setChickenCategory(e.target.value)} className="input-base">{chickenCategories.map((category) => <option key={category}>{category}</option>)}</select><button type="button" className="icon-btn h-10 w-10 shrink-0" onClick={addChickenCategory} aria-label="Ajouter une catégorie"><Plus size={14} /></button><button type="button" className="icon-btn h-10 w-10 shrink-0" onClick={editChickenCategory} aria-label="Modifier la catégorie"><Pencil size={14} /></button></div></label><label className="block"><span className="field-label">Date d’émission</span><div className="relative"><input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} className="input-base pr-9" /><CalendarDays size={15} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#8d9992]" /></div></label></div>

        <div className="my-7 h-px bg-[#edf0eb]" />
        <div className="mb-4 flex items-center justify-between"><div><h2 className="text-[17px] font-bold tracking-[-.03em]">Lignes de facture</h2><p className="muted mt-1 text-[12px]">Ajoutez les produits ou services à facturer.</p></div><button className="btn-secondary px-3 py-2 text-[11px]" onClick={addLine}><Plus size={14} /> Ajouter une ligne</button></div>
        <div className="hidden grid-cols-[minmax(0,1.8fr)_95px_130px_145px_36px] gap-3 px-3 pb-2 text-[9px] font-bold uppercase tracking-[.12em] text-[#9ba59f] sm:grid"><span>Description</span><span>Qté</span><span>Unité</span><span>Prix unitaire</span><span /></div>
        <div className="space-y-3"><datalist id="invoice-products">{availableProducts.map((product) => <option key={product.label} value={product.label} />)}</datalist>{lines.map((line) => <div key={line.id} className="rounded-xl border border-[#e8ede7] bg-[#fbfcfa] p-3 sm:grid sm:grid-cols-[minmax(0,1.8fr)_95px_130px_145px_36px] sm:items-center sm:gap-3 sm:border-0 sm:bg-transparent sm:p-0"><label className="block sm:contents"><span className="field-label sm:hidden">Description</span><input list="invoice-products" value={line.description} onChange={(e) => handleProductChange(line.id, e.target.value)} className="input-base" placeholder="Saisir ou choisir une description" /></label><label className="mt-3 block sm:mt-0"><span className="field-label sm:hidden">Quantité</span><input type="number" min="1" value={line.quantity} onChange={(e) => updateLine(line.id, 'quantity', Number(e.target.value))} className="input-base" /></label><label className="mt-3 block sm:mt-0"><span className="field-label sm:hidden">Unité</span><input value={line.unit} onChange={(e) => updateLine(line.id, 'unit', e.target.value)} className="input-base" /></label><label className="mt-3 block sm:mt-0"><span className="field-label sm:hidden">Prix unitaire</span><div className="relative"><input type="number" min="0" value={line.price} onChange={(e) => updateLine(line.id, 'price', Number(e.target.value))} className="input-base pr-12" /><span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-semibold text-[#a0aaa4]">FCFA</span></div></label><div className="mt-3 flex items-center justify-between sm:mt-0"><span className="text-[12px] font-bold text-ink sm:hidden">{formatFCFA(line.quantity * line.price)}</span><button className="icon-btn h-9 w-9 text-[#b45d5d] hover:border-[#f0c7c5] hover:bg-[#fff6f5]" onClick={() => removeLine(line.id)} aria-label="Supprimer la ligne"><Trash2 size={15} /></button></div><div className="mt-3 border-t border-dashed border-[#e5ebe3] pt-2 text-right text-[11px] font-bold text-ink sm:hidden">Total ligne : {formatFCFA(line.quantity * line.price)}</div></div>)}</div>
        <button className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-[#cddccf] py-3 text-[11px] font-bold text-[#5c9560] hover:bg-[#f7fbf5]" onClick={addLine}><Plus size={14} /> Ajouter une autre ligne</button>
      </div>

      <div className="space-y-5"><div className="surface sticky top-[102px] p-5 sm:p-6"><h2 className="text-[17px] font-bold tracking-[-.03em]">Résumé</h2><div className="mt-5 space-y-3 text-[12px]"><div className="flex justify-between text-[#7f8c84]"><span>Sous-total</span><strong className="font-semibold text-ink">{formatFCFA(subtotal)}</strong></div><div className="flex items-center justify-between gap-3 text-[#7f8c84]"><span>TVA</span><label className="relative"><select value={taxRate} onChange={(e) => setTaxRate(Number(e.target.value))} className="h-7 appearance-none rounded-md border border-[#dfe8df] bg-[#fbfcfa] py-0 pl-2 pr-6 text-[11px] font-bold text-ink"><option value={0}>0 %</option><option value={18}>18 %</option><option value={19.25}>19,25 %</option></select><ChevronDown size={12} className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-[#86938b]" /></label></div><div className="flex justify-between text-[#7f8c84]"><span>Montant TVA</span><strong className="font-semibold text-ink">{formatFCFA(tax)}</strong></div><div className="my-4 h-px bg-[#edf0eb]" /><div className="space-y-3 rounded-xl bg-[#fbfcfa] p-3"><div className="flex items-center justify-between gap-3"><span className="text-[#7f8c84]">Versement</span><div className="relative w-[145px]"><input type="number" min="0" value={initialPayment} onChange={(e) => setInitialPayment(Number(e.target.value))} className="input-base h-8 pr-12 text-right text-[11px]" /><span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[9px] font-bold text-[#a0aaa4]">FCFA</span></div></div><div className="flex items-center justify-between gap-3 text-[#7f8c84]"><span>Reste à payer</span><strong className="font-bold text-[#bd7737]">{formatFCFA(remainingAmount)}</strong></div><div className="flex items-center justify-between gap-3 text-[#7f8c84]"><span>Statut</span><StatusBadge status={paymentStatus} /></div><label className="block"><span className="field-label">Mode de paiement</span><select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} className="input-base h-8 text-[11px]"><option>Espèces</option><option>Mobile Money</option><option>Virement bancaire</option></select></label></div><div className="flex items-end justify-between"><span className="text-[13px] font-bold text-ink">Total TTC</span><strong className="text-[22px] font-black tracking-[-.05em] text-forest">{formatFCFA(total)}</strong></div></div><div className="mt-5 rounded-xl bg-[#f5faf2] p-3.5"><p className="text-[10px] font-bold text-[#568e57]">Paiement</p><p className="mt-1 text-[11px] leading-4 text-[#759076]">La facture sera validée et son PDF sera généré. Vous pourrez ensuite enregistrer d’autres versements depuis la fiche facture.</p></div><div className="mt-5 grid gap-2"><button className="btn-primary w-full" onClick={() => save()}><Send size={14} /> {editingInvoiceId ? 'Enregistrer les modifications' : 'Enregistrer la facture'}</button></div></div><div className="surface-flat p-4"><p className="flex items-center gap-2 text-[11px] font-bold text-ink"><Check size={14} className="text-[#5eab64]" /> TVA configurable</p><p className="mt-1.5 text-[10px] leading-4 text-[#7f8c84]">Le taux proposé ici est modifiable selon le régime fiscal de votre entreprise.</p></div></div>
    </div>
  </div>;
}
