'use client';

import { FormEvent, useEffect, useState } from 'react';
import { ArrowDownToLine, ArrowUpFromLine, Check, Package, RefreshCw, Wheat, X } from 'lucide-react';
import { Modal, SectionHeading } from '@/components/ui';
import { FARM_STORAGE_KEYS, readLocal, subscribeToFarmData } from '@/lib/farm-storage';
import { POULTRY_FEED_BAG_WEIGHT_KG, getPoultryBuildingFeedStockKg, getPoultryCentralFeedStockKg, poultryFeedSackEquivalent, readPoultryFeedStockMovements, receivePoultryCentralFeed, supplyPoultryBuildingFeed, type PoultryFeedStockBalance, type PoultryFeedStockMovement } from '@/lib/poultry-feed-stock';

type FeedBuilding = { id: string; name: string; batch?: string; current?: number };
type Props = { buildings: FeedBuilding[] };

type Mode = 'central' | 'building' | null;

export function PoultryFeedStockView({ buildings }: Props) {
  const [balances, setBalances] = useState<PoultryFeedStockBalance[]>([]);
  const [movements, setMovements] = useState<PoultryFeedStockMovement[]>([]);
  const [mode, setMode] = useState<Mode>(null);
  const [feedback, setFeedback] = useState('');
  const [selectedBuilding, setSelectedBuilding] = useState<FeedBuilding | null>(null);

  function load() {
    setBalances(readLocal<PoultryFeedStockBalance[]>(FARM_STORAGE_KEYS.poultryFeedStock, []));
    setMovements(readPoultryFeedStockMovements());
  }
  useEffect(() => subscribeToFarmData([FARM_STORAGE_KEYS.poultryFeedStock, FARM_STORAGE_KEYS.poultryFeedStockMovements], load), []);

  const centralKg = getPoultryCentralFeedStockKg();
  const activeBuildings = buildings.filter((building) => building.batch && building.batch !== '—');
  const operator = getCookie('agroflux_user_name') || 'Responsable stock';
  const operatorId = getCookie('agroflux_user_id') || 'unknown';

  function notify(message: string) {
    setFeedback(message);
    window.setTimeout(() => setFeedback(''), 4200);
  }

  function submitCentral(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const result = receivePoultryCentralFeed({ sacks: Number(form.get('sacks') ?? 0), operatorId, operatorName: operator, reason: String(form.get('reason') ?? '').trim() });
    if (!result.ok) { notify(result.message); return; }
    setMode(null); load(); notify(`${result.movement?.sacks ?? 0} sac(s) ajouté(s) au stock central.`);
  }

  function submitBuilding(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedBuilding) return;
    const form = new FormData(event.currentTarget);
    const result = supplyPoultryBuildingFeed({ buildingId: selectedBuilding.id, buildingName: selectedBuilding.name, batchId: selectedBuilding.batch, sacks: Number(form.get('sacks') ?? 0), operatorId, operatorName: operator, reason: String(form.get('reason') ?? '').trim() });
    if (!result.ok) { notify(result.message); return; }
    setMode(null); setSelectedBuilding(null); load(); notify(`${result.movement?.sacks ?? 0} sac(s) envoyé(s) vers ${selectedBuilding.name}.`);
  }

  return <section className="surface overflow-hidden"><div className="flex flex-col gap-3 border-b border-[#edf0eb] px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6"><SectionHeading eyebrow="Stock aliment · sacs de 50 kg" title="Aliment Poulets bio" description="Le stock central alimente les bâtiments. La tâche Service aliment retire automatiquement la quantité consommée du stock du bâtiment." /><div className="flex flex-wrap gap-2"><button type="button" className="btn-secondary px-3 py-2 text-[10px]" onClick={() => setMode('central')}><ArrowDownToLine size={14} /> Réceptionner des sacs</button><button type="button" className="btn-primary px-3 py-2 text-[10px]" onClick={() => setMode('building')}><ArrowUpFromLine size={14} /> Approvisionner un bâtiment</button></div></div>{feedback && <div className="mx-5 mt-4 flex items-center gap-2 rounded-xl border border-[#cde8c7] bg-[#effaeb] px-4 py-3 text-[11px] font-semibold text-[#4d8f51] sm:mx-6"><Check size={14} />{feedback}</div>}<div className="grid gap-4 p-5 sm:grid-cols-3 sm:p-6"><div className="rounded-2xl border border-[#dce8db] bg-[#f5faf2] p-4"><div className="flex items-center gap-2"><Wheat size={16} className="text-[#5b9d5b]" /><p className="text-[10px] font-bold uppercase tracking-[.12em] text-[#6d9071]">Stock central</p></div><p className="mt-2 text-[25px] font-black text-[#3e7546]">{formatKg(centralKg)} kg</p><p className="mt-1 text-[10px] text-[#6d9071]">{formatSacks(centralKg)} sac(s) de 50 kg</p></div><div className="rounded-2xl border border-[#e1ebe0] bg-[#fbfcfa] p-4"><div className="flex items-center gap-2"><Package size={16} className="text-[#6385bd]" /><p className="text-[10px] font-bold uppercase tracking-[.12em] text-[#718078]">Bâtiments approvisionnés</p></div><p className="mt-2 text-[25px] font-black text-ink">{balances.filter((balance) => balance.scope === 'building' && balance.kilograms > 0).length}</p><p className="mt-1 text-[10px] text-[#89968f]">stock par bâtiment</p></div><div className="rounded-2xl border border-[#e2d9f0] bg-[#faf7fd] p-4"><div className="flex items-center gap-2"><RefreshCw size={16} className="text-[#8066a6]" /><p className="text-[10px] font-bold uppercase tracking-[.12em] text-[#8066a6]">Consommations tracées</p></div><p className="mt-2 text-[25px] font-black text-[#8066a6]">{movements.filter((movement) => movement.type === 'Consommation tâche').length}</p><p className="mt-1 text-[10px] text-[#8066a6]">sorties liées aux tâches</p></div></div><div className="border-t border-[#edf0eb] px-5 py-4 sm:px-6"><p className="field-label">Stock aliment par bâtiment</p><div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{activeBuildings.length ? activeBuildings.map((building) => { const kilograms = getPoultryBuildingFeedStockKg(building.id); return <div className="rounded-xl border border-[#edf0eb] bg-[#fbfcfa] p-3" key={building.id}><div className="flex items-start justify-between gap-2"><div><p className="text-[11px] font-bold text-ink">{building.name}</p><p className="mt-1 text-[10px] text-[#89968f]">{building.batch} · {building.current ?? 0} sujet(s)</p></div><button type="button" className="btn-secondary px-2 py-1 text-[9px]" onClick={() => { setSelectedBuilding(building); setMode('building'); }}>Approvisionner</button></div><p className="mt-3 text-[20px] font-black text-[#3e7546]">{formatKg(kilograms)} kg</p><p className="text-[10px] text-[#6d9071]">{formatSacks(kilograms)} sac(s) équivalent(s)</p></div>; }) : <div className="rounded-xl border border-dashed border-[#dce8db] p-6 text-center text-[11px] text-[#89968f] sm:col-span-2 xl:col-span-3">Aucun bâtiment avec une bande affectée.</div>}</div></div><div className="border-t border-[#edf0eb] bg-[#fbfcfa] px-5 py-4 sm:px-6"><p className="field-label">Derniers mouvements aliment</p><div className="mt-3 space-y-2">{movements.slice(0, 8).length ? movements.slice(0, 8).map((movement) => <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-[#718078]" key={movement.id}><strong className="text-ink">{movement.type}</strong><span>{formatKg(movement.quantityKg)} kg · {formatSacks(movement.quantityKg)} sac(s)</span><span>{movement.destination}</span><span>{movement.operatorName}</span></div>) : <p className="text-[10px] text-[#89968f]">Aucun mouvement aliment enregistré.</p>}</div></div><Modal open={mode === 'central'} onClose={() => setMode(null)} title="Réceptionner des sacs d’aliment"><form onSubmit={submitCentral} className="space-y-5"><div className="rounded-xl border border-[#dce8db] bg-[#f5faf2] p-4 text-[11px] leading-5 text-[#5b8f60]">Chaque sac reçu est comptabilisé automatiquement à <strong>{POULTRY_FEED_BAG_WEIGHT_KG} kg</strong>.</div><label className="block"><span className="field-label">Nombre de sacs reçus</span><input name="sacks" type="number" min="1" step="1" className="input-base" required /></label><label className="block"><span className="field-label">Référence ou observation</span><textarea name="reason" className="input-base min-h-[70px] resize-none" placeholder="Fournisseur, bon de livraison, type d’aliment…" /></label><div className="flex justify-end gap-2"><button type="button" className="btn-secondary" onClick={() => setMode(null)}>Annuler</button><button type="submit" className="btn-primary"><Check size={15} /> Enregistrer la réception</button></div></form></Modal><Modal open={mode === 'building'} onClose={() => { setMode(null); setSelectedBuilding(null); }} title="Approvisionner un bâtiment"><form onSubmit={submitBuilding} className="space-y-5"><label className="block"><span className="field-label">Bâtiment destinataire</span><select className="input-base" value={selectedBuilding?.id ?? ''} onChange={(event) => setSelectedBuilding(activeBuildings.find((building) => building.id === event.target.value) ?? null)} required><option value="">Choisir un bâtiment</option>{activeBuildings.map((building) => <option key={building.id} value={building.id}>{building.name} · {building.batch}</option>)}</select></label><div className="rounded-xl border border-[#edf0eb] bg-[#fbfcfa] p-3 text-[10px] text-[#718078]">Stock central disponible : <strong>{formatKg(centralKg)} kg</strong> · {formatSacks(centralKg)} sac(s).</div><label className="block"><span className="field-label">Nombre de sacs à envoyer</span><input name="sacks" type="number" min="1" step="1" className="input-base" required /></label><label className="block"><span className="field-label">Motif ou référence</span><textarea name="reason" className="input-base min-h-[70px] resize-none" placeholder="Approvisionnement du service aliment…" /></label><div className="flex justify-end gap-2"><button type="button" className="btn-secondary" onClick={() => { setMode(null); setSelectedBuilding(null); }}>Annuler</button><button type="submit" className="btn-primary"><ArrowUpFromLine size={15} /> Approvisionner</button></div></form></Modal></section>;
}

function getCookie(name: string) {
  if (typeof document === 'undefined') return '';
  const part = document.cookie.split('; ').find((item) => item.startsWith(`${name}=`));
  return part ? decodeURIComponent(part.slice(name.length + 1)) : '';
}

function formatKg(value: number) {
  return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 }).format(Number(value) || 0);
}

function formatSacks(value: number) {
  return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 }).format(poultryFeedSackEquivalent(value));
}
