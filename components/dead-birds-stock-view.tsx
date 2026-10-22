'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowDownRight, ArrowUpRight, Check, CircleDollarSign, Download, Package, Search, Trash2, X } from 'lucide-react';
import { Modal, SectionHeading, StatCard } from '@/components/ui';
import { StatusBadge } from '@/components/status-badge';
import { FARM_STORAGE_KEYS, readLocal, subscribeToFarmData, writeLocal } from '@/lib/farm-storage';
import { formatDate, formatFCFA, formatNumber } from '@/lib/format';
import type { DagoReport } from '@/lib/dago';
import { reconcileDeadBirdStock, remainingSpoiled, remainingVendable, type DeadBirdStockItem, type DeadBirdStockMovement } from '@/lib/dead-birds-stock';

type Feedback = { type: 'success' | 'error'; message: string };
type DisposalSource = 'vendable' | 'spoiled';

export function DeadBirdsStockView() {
  const [items, setItems] = useState<DeadBirdStockItem[]>([]);
  const [movements, setMovements] = useState<DeadBirdStockMovement[]>([]);
  const [query, setQuery] = useState('');
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [disposalItem, setDisposalItem] = useState<DeadBirdStockItem | null>(null);

  useEffect(() => {
    const load = () => {
      const reports = readLocal<DagoReport[]>(FARM_STORAGE_KEYS.dagoReports, []);
      const current = readLocal<DeadBirdStockItem[]>(FARM_STORAGE_KEYS.deadBirdStock, []);
      const next = reconcileDeadBirdStock(reports, current);
      const currentMovements = readLocal<DeadBirdStockMovement[]>(FARM_STORAGE_KEYS.deadBirdStockMovements, []);
      const entryReportIds = new Set(currentMovements.filter((movement) => movement.type === 'Entrée').map((movement) => movement.reportId));
      const missingEntries = next.filter((item) => !entryReportIds.has(item.reportId)).map((item): DeadBirdStockMovement => ({ id: `MORT-ENTREE-${item.reportId}`, date: item.receivedDate, type: 'Entrée', stockId: item.id, reportId: item.reportId, buildingName: item.buildingName, batchId: item.batchId, sourceLocation: item.sourceLocation, quantity: item.quantityReceived, reason: 'Réception enregistrée par le responsable des poulets morts', operator: 'Système' }));
      const nextMovements = missingEntries.length ? [...missingEntries, ...currentMovements] : currentMovements;
      setItems(next);
      setMovements(nextMovements);
      if (JSON.stringify(next) !== JSON.stringify(current)) writeLocal(FARM_STORAGE_KEYS.deadBirdStock, next);
      if (JSON.stringify(nextMovements) !== JSON.stringify(currentMovements)) writeLocal(FARM_STORAGE_KEYS.deadBirdStockMovements, nextMovements);
    };
    load();
    return subscribeToFarmData([FARM_STORAGE_KEYS.dagoReports, FARM_STORAGE_KEYS.deadBirdStock, FARM_STORAGE_KEYS.deadBirdStockMovements], load);
  }, []);

  const visibleItems = useMemo(() => items.filter((item) => `${item.reportId} ${item.buildingName} ${item.batchId}`.toLowerCase().includes(query.toLowerCase())).sort((a, b) => b.receivedDate.localeCompare(a.receivedDate)), [items, query]);
  const receivedTotal = items.reduce((sum, item) => sum + item.quantityReceived, 0);
  const vendableTotal = items.reduce((sum, item) => sum + remainingVendable(item), 0);
  const spoiledTotal = items.reduce((sum, item) => sum + remainingSpoiled(item), 0);
  const clinicTotal = items.reduce((sum, item) => sum + Number(item.quantityClinic || 0), 0);
  const soldTotal = items.reduce((sum, item) => sum + item.quantitySold, 0);
  const batchSummaries = useMemo(() => {
    const grouped = new Map<string, { buildingName: string; batchId: string; received: number; sold: number; remaining: number; sourceLocations: Set<string> }>();
    items.forEach((item) => {
      const key = `${item.buildingName}|${item.batchId || 'Sans bande'}`;
      const current = grouped.get(key) ?? { buildingName: item.buildingName, batchId: item.batchId || 'Sans bande', received: 0, sold: 0, remaining: 0, sourceLocations: new Set<string>() };
      current.received += item.quantityReceived;
      current.sold += item.quantitySold;
      current.remaining += remainingVendable(item);
      current.sourceLocations.add(item.sourceLocation === 'clinique' ? 'Clinique' : 'Grande salle');
      grouped.set(key, current);
    });
    return Array.from(grouped.values()).sort((first, second) => first.buildingName.localeCompare(second.buildingName, 'fr') || first.batchId.localeCompare(second.batchId, 'fr'));
  }, [items]);

  function notify(message: string, type: Feedback['type'] = 'success') {
    setFeedback({ type, message });
    window.setTimeout(() => setFeedback(null), 4500);
  }

  function persist(nextItems: DeadBirdStockItem[], nextMovements: DeadBirdStockMovement[]) {
    setItems(nextItems);
    setMovements(nextMovements);
    writeLocal(FARM_STORAGE_KEYS.deadBirdStock, nextItems);
    writeLocal(FARM_STORAGE_KEYS.deadBirdStockMovements, nextMovements);
  }

  function saveDisposal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!disposalItem) return;
    const form = new FormData(event.currentTarget);
    const source = String(form.get('source') ?? 'spoiled') as DisposalSource;
    const quantity = Number(form.get('quantity') ?? 0);
    const date = String(form.get('date') ?? new Date().toISOString().slice(0, 10));
    const reason = String(form.get('reason') ?? '').trim();
    const available = source === 'vendable' ? remainingVendable(disposalItem) : remainingSpoiled(disposalItem);
    if (quantity <= 0 || quantity > available || !reason) {
      notify(`Vérifiez la quantité (maximum ${formatNumber(available)}) et le motif de sortie.`, 'error');
      return;
    }
    const movement: DeadBirdStockMovement = { id: `MORT-SORTIE-${Date.now()}`, date, type: 'Sortie / destruction', stockId: disposalItem.id, reportId: disposalItem.reportId, buildingName: disposalItem.buildingName, batchId: disposalItem.batchId, sourceLocation: disposalItem.sourceLocation, quantity, source: source === 'vendable' ? 'Vendable' : 'Gâté / isolé', reason, operator: 'Administrateur' };
    const nextItems = items.map((item) => item.id === disposalItem.id ? source === 'vendable' ? { ...item, quantityDisposedVendable: item.quantityDisposedVendable + quantity } : { ...item, quantityDisposedSpoiled: item.quantityDisposedSpoiled + quantity } : item);
    persist(nextItems, [movement, ...movements]);
    setDisposalItem(null);
    notify(`${formatNumber(quantity)} poulet(s) sortis du stock (${source === 'vendable' ? 'vendable' : 'gâté / isolé'}).`);
  }

  function exportStock() {
    const rows = ['SCOOPS LE REVEIL', 'Stock séparé — Poulets morts', '', 'Réception;Référence;Bâtiment;Bande;Origine;Reçu;Vendable restant;Gâté restant;Vendu', ...visibleItems.map((item) => [item.receivedDate, item.reportId, item.buildingName, item.batchId, item.sourceLocation === 'clinique' ? 'Clinique' : 'Grande salle', item.quantityReceived, remainingVendable(item), remainingSpoiled(item), item.quantitySold].join(';'))].join('\n');
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([`\ufeff${rows}`], { type: 'text/csv;charset=utf-8' }));
    link.download = 'stock-poulets-morts.csv';
    link.click();
    URL.revokeObjectURL(link.href);
    notify('Le registre du stock des poulets morts a été exporté.');
  }

  return (
    <div className="fade-in space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div><p className="eyebrow mb-2">Poulets morts · stock indépendant</p><h1 className="page-title">Gestion du stock des poulets morts</h1><p className="muted mt-2 max-w-3xl text-[13px] leading-5">Ce stock est séparé du stock de la ferme. Les réceptions sont alimentées automatiquement par les constats enregistrés, puis les ventes et sorties sont tracées par bâtiment et par bande.</p></div>
        <button type="button" className="btn-secondary" onClick={exportStock}><Download size={15} /> Exporter le stock</button>
      </div>
      <div className="flex items-start gap-3 rounded-xl border border-[#dcebdd] bg-[#f5faf2] px-4 py-3 text-[11px] leading-5 text-[#5b8f60]"><Package size={16} className="mt-0.5 shrink-0" /><span>Une réception par le responsable des poulets morts crée une ligne de stock. Le stock vendable et le stock gâté / isolé sont suivis ici ; les ventes se font exclusivement depuis Ventes & factures, tandis que les sorties et destructions restent tracées dans ce registre.</span></div>
      {feedback && <div className={`flex items-start gap-2 rounded-xl px-4 py-3 text-[11px] font-semibold ${feedback.type === 'error' ? 'border border-[#f0c9c5] bg-[#fff4f3] text-[#b85b59]' : 'border border-[#cde8c7] bg-[#effaeb] text-[#4d8f51]'}`}><Check size={15} className="mt-0.5 shrink-0" />{feedback.message}</div>}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5"><StatCard label="Poulets reçus" value={formatNumber(receivedTotal)} change={`${items.length} réception(s)`} detail="tous bâtiments" icon={ArrowDownRight} tone="blue" /><StatCard label="Stock vendable" value={formatNumber(vendableTotal)} change="disponible" detail="sujets frais" icon={Package} tone="green" /><StatCard label="Stock gâté / isolé" value={formatNumber(spoiledTotal)} change="à traiter" detail="sujets décomposés" icon={Trash2} tone="orange" /><StatCard label="Sujets en clinique" value={formatNumber(clinicTotal)} change="suivi clinique" detail="non vendables" icon={Package} tone="purple" /><StatCard label="Poulets vendus" value={formatNumber(soldTotal)} change="sorties commerciales" detail="caisse alimentée" icon={CircleDollarSign} tone="purple" /></div>
      <div className="surface overflow-hidden"><div className="border-b border-[#edf0eb] px-5 py-5 sm:px-6"><SectionHeading eyebrow="Ventes par périmètre" title="Quantités vendues par bâtiment et par bande" description="Les ventes restent rattachées à la réception, au bâtiment et à la bande d’origine." /></div><div className="table-scroll"><table className="w-full min-w-[720px] text-left"><thead><tr className="table-head"><th>Bâtiment</th><th>Bande</th><th>Origine(s)</th><th>Reçu</th><th>Vendu</th><th>Reste vendable</th></tr></thead><tbody>{batchSummaries.length ? batchSummaries.map((summary) => <tr className="table-row table-line" key={`${summary.buildingName}-${summary.batchId}`}><td className="font-bold text-ink">{summary.buildingName}</td><td>{summary.batchId}</td><td>{Array.from(summary.sourceLocations).join(' · ')}</td><td>{formatNumber(summary.received)}</td><td className="font-bold text-[#6385bd]">{formatNumber(summary.sold)}</td><td className="font-bold text-[#5b9d5b]">{formatNumber(summary.remaining)}</td></tr>) : <tr><td colSpan={6} className="px-6 py-10 text-center text-[11px] text-[#89968f]">Aucune vente de poulets morts enregistrée.</td></tr>}</tbody></table></div></div>
      <div className="surface overflow-hidden"><div className="flex flex-col gap-4 border-b border-[#edf0eb] px-5 pb-4 pt-5 sm:flex-row sm:items-center sm:justify-between sm:px-6"><SectionHeading eyebrow="Registre du stock indépendant" title="Réceptions par bâtiment" description="Chaque ligne correspond à un signalement réceptionné et conserve sa traçabilité." /><div className="relative min-w-[240px]"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9aa69f]" /><input value={query} onChange={(event) => setQuery(event.target.value)} className="input-base h-9 rounded-lg bg-[#fbfcfa] pl-9 text-[11px]" placeholder="Bâtiment, bande, référence…" /></div></div><div className="table-scroll"><table className="w-full min-w-[1050px] text-left"><thead><tr className="table-head"><th>Réception</th><th>Bâtiment / bande</th><th>Origine</th><th>Quantité reçue</th><th>Vendable restant</th><th>Gâté / isolé restant</th><th>Clinique</th><th>Vendu</th><th>État</th><th>Actions</th></tr></thead><tbody>{visibleItems.length ? visibleItems.map((item) => { const vendable = remainingVendable(item); const spoiled = remainingSpoiled(item); const state = vendable || spoiled ? spoiled ? 'À traiter' : 'Disponible' : 'Épuisé'; return <tr className="table-row table-line" key={item.id}><td><p className="font-bold text-ink">{formatDate(item.receivedDate)}</p><p className="mt-1 text-[10px] text-[#89968f]">{item.reportId}</p></td><td><p className="font-bold text-ink">{item.buildingName}</p><p className="mt-1 text-[10px] text-[#89968f]">{item.batchId || 'Sans bande'}</p></td><td><span className="rounded-full bg-[#edf3ff] px-2 py-1 text-[9px] font-bold text-[#6385bd]">{item.sourceLocation === 'clinique' ? 'Clinique' : 'Grande salle'}</span></td><td className="font-bold text-ink">{formatNumber(item.quantityReceived)}</td><td className="font-bold text-[#5b9d5b]">{formatNumber(vendable)}</td><td className="font-bold text-[#bd7737]">{formatNumber(spoiled)}</td><td className="font-bold text-[#8066a6]">{formatNumber(item.quantityClinic ?? 0)}</td><td>{formatNumber(item.quantitySold)}</td><td><StatusBadge status={state} /></td><td><div className="flex flex-wrap gap-1">{vendable > 0 && <Link href={`/factures/ferme/nouvelle?deadStockId=${encodeURIComponent(item.id)}`} className="btn-primary px-2 py-1.5 text-[10px]"><CircleDollarSign size={12} /> Créer une facture</Link>}{vendable + spoiled > 0 && <button type="button" className="btn-secondary px-2 py-1.5 text-[10px]" onClick={() => setDisposalItem(item)}><Trash2 size={12} /> Sortie</button>}</div></td></tr>; }) : <tr><td colSpan={10} className="px-6 py-14 text-center text-[11px] text-[#89968f]">Aucune réception n’alimente encore le stock des poulets morts.</td></tr>}</tbody></table></div></div>
      <div className="surface overflow-hidden"><div className="border-b border-[#edf0eb] px-5 py-5 sm:px-6"><SectionHeading eyebrow="Mouvements du stock" title="Historique des entrées et sorties" description="Les ventes et sorties restent rattachées à leur réception d’origine." /></div><div className="table-scroll"><table className="w-full min-w-[900px] text-left"><thead><tr className="table-head"><th>Date</th><th>Type</th><th>Bâtiment / bande</th><th>Quantité</th><th>Montant / client</th><th>Motif</th></tr></thead><tbody>{movements.length ? movements.slice(0, 40).map((movement) => <tr className="table-row table-line" key={movement.id}><td>{formatDate(movement.date)}</td><td><span className={`inline-flex items-center gap-1.5 text-[10px] font-bold ${movement.type === 'Entrée' ? 'text-[#5b9d5b]' : movement.type === 'Vente' ? 'text-[#6385bd]' : 'text-[#bd7737]'}`}>{movement.type === 'Entrée' ? <ArrowDownRight size={13} /> : movement.type === 'Vente' ? <ArrowUpRight size={13} /> : <Trash2 size={13} />}{movement.type}</span></td><td><p className="font-bold text-ink">{movement.buildingName}</p><p className="mt-1 text-[10px] text-[#89968f]">{movement.batchId || 'Sans bande'} · {movement.reportId}</p></td><td>{formatNumber(movement.quantity)} poulet(s)<p className="mt-1 text-[10px] text-[#89968f]">{movement.source || '—'}</p></td><td>{movement.type === 'Vente' ? <><strong className="text-[#5b9d5b]">{formatFCFA(movement.amount ?? 0)}</strong><p className="mt-1 text-[10px] text-[#89968f]">{movement.customer} · {movement.method}</p></> : '—'}</td><td>{movement.reason}</td></tr>) : <tr><td colSpan={6} className="px-6 py-12 text-center text-[11px] text-[#89968f]">Aucun mouvement de stock enregistré.</td></tr>}</tbody></table></div></div>
      <Modal open={Boolean(disposalItem)} onClose={() => setDisposalItem(null)} title="Sortir du stock / détruire">{disposalItem && <form onSubmit={saveDisposal} className="space-y-5"><div className="rounded-xl border border-[#f0d5ad] bg-[#fff8ea] p-4 text-[11px] leading-5 text-[#986c3e]"><strong>{disposalItem.buildingName} · {disposalItem.batchId || 'Sans bande'}</strong><p className="mt-1">Vendable restant : {formatNumber(remainingVendable(disposalItem))} · gâté / isolé restant : {formatNumber(remainingSpoiled(disposalItem))}.</p></div><label className="block"><span className="field-label">Origine de la sortie</span><select name="source" className="input-base" defaultValue="spoiled"><option value="spoiled">Gâté / isolé</option><option value="vendable">Vendable</option></select></label><div className="grid gap-4 sm:grid-cols-2"><label className="block"><span className="field-label">Quantité sortie</span><input name="quantity" type="number" min="1" step="1" className="input-base" required /></label><label className="block"><span className="field-label">Date</span><input name="date" type="date" defaultValue={new Date().toISOString().slice(0, 10)} className="input-base" required /></label></div><label className="block"><span className="field-label">Motif obligatoire</span><textarea name="reason" className="input-base min-h-[80px] resize-none" placeholder="Destruction, perte, don, autre sortie justifiée…" required /></label><div className="flex justify-end gap-2"><button type="button" className="btn-secondary" onClick={() => setDisposalItem(null)}><X size={14} /> Annuler</button><button type="submit" className="btn-primary"><Trash2 size={15} /> Enregistrer la sortie</button></div></form>}</Modal>
    </div>
  );
}
