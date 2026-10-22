'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Activity, Archive, ArrowLeft, ArrowRight, BarChart3, CalendarDays, Check, ClipboardCheck, Droplets, MoreHorizontal, PawPrint, Plus, Receipt, ShieldCheck, ShoppingCart, Thermometer, Wheat } from 'lucide-react';
import type { poultryBuildings, poultryDailyRecords, poultryHealthEvents, poultryLots } from '@/lib/data';
import { formatDate, formatFCFA, formatNumber, formatPercent } from '@/lib/format';
import { MiniProgress, Modal, SectionHeading, StatCard } from '@/components/ui';
import { StatusBadge } from '@/components/status-badge';
import { EmptyState } from '@/components/empty-state';
import { FARM_STORAGE_KEYS, readLocal, subscribeToFarmData, writeLocal } from '@/lib/farm-storage';
import { loadFarmSnapshot, registerPoultrySale, type BatchArchive, type FarmLot } from '@/lib/farm-calculations';

type FarmSale = { id: string; batch: string; date: string; quantity: number; unitPrice: number; total: number; customer: string; paymentMethod: string; buildingName?: string };

export function PoultryBatchDetailView({ id }: { id: string }) {
  const [lot, setLot] = useState<FarmLot | null>(null);
  const [availableCount, setAvailableCount] = useState(0);
  const [buildings, setBuildings] = useState<typeof poultryBuildings>([]);
  const [dailyRecords, setDailyRecords] = useState<typeof poultryDailyRecords>([]);
  const [healthEvents, setHealthEvents] = useState<typeof poultryHealthEvents>([]);
  const [sales, setSales] = useState<FarmSale[]>([]);
  const [saleOpen, setSaleOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [accessDenied, setAccessDenied] = useState(false);
  const [buildingScopeActive, setBuildingScopeActive] = useState(false);
  const [feedback, setFeedback] = useState('');

  useEffect(() => {
    const cookie = (name: string) => { const part = document.cookie.split('; ').find((item) => item.startsWith(`${name}=`)); return part ? decodeURIComponent(part.slice(name.length + 1)) : ''; };
    const isAdmin = cookie('agroflux_is_admin') === '1';
    let assigned = [] as string[];
    if (!isAdmin) {
      try { assigned = JSON.parse(cookie('agroflux_assigned_buildings') || '[]') as string[]; } catch { assigned = []; }
    }
    const scopeActive = !isAdmin && assigned.length > 0;
    setBuildingScopeActive(scopeActive);
    const load = () => {
      const snapshot = loadFarmSnapshot();
      const scopedBuildings = scopeActive ? snapshot.buildings.filter((building) => assigned.includes(building.id)) : snapshot.buildings;
      const scopedNames = new Set(scopedBuildings.map((building) => building.name));
      const savedLot = snapshot.lots.find((item) => item.id === id) ?? null;
      const lotVisible = !scopeActive || scopedBuildings.some((building) => building.batch === id) || snapshot.daily.some((record) => record.batch === id && scopedNames.has(record.building)) || snapshot.health.some((event) => event.batch === id && scopedNames.has(event.building));
      setAccessDenied(Boolean(savedLot && !lotVisible));
      setLot(lotVisible ? savedLot : null);
      setAvailableCount(lotVisible ? (scopeActive ? scopedBuildings.filter((building) => building.batch === id).reduce((sum, building) => sum + Number(building.current || 0), 0) : savedLot?.alive ?? 0) : 0);
      setBuildings(scopedBuildings);
      setDailyRecords(scopeActive ? snapshot.daily.filter((record) => scopedNames.has(record.building)) : snapshot.daily);
      setHealthEvents(scopeActive ? snapshot.health.filter((event) => scopedNames.has(event.building)) : snapshot.health);
      setSales(readLocal(FARM_STORAGE_KEYS.sales, [] as FarmSale[]));
    };
    load();
    return subscribeToFarmData([FARM_STORAGE_KEYS.lots, FARM_STORAGE_KEYS.buildings, FARM_STORAGE_KEYS.daily, FARM_STORAGE_KEYS.health, FARM_STORAGE_KEYS.sales], load);
  }, [id]);

  if (accessDenied) {
    return <div className="fade-in space-y-6"><Link href="/poulets/bandes" className="inline-flex items-center gap-2 text-[11px] font-bold text-[#6c8176] hover:text-forest"><ArrowLeft size={14} /> Retour aux bandes</Link><EmptyState title="Bande non accessible" description="Votre compte est limité aux bâtiments qui vous ont été attribués. Les données des autres bâtiments ne sont pas affichées." action={<Link href="/poulets/bandes" className="btn-primary">Retour aux bandes autorisées</Link>} /></div>;
  }
  if (!lot) {
    return <div className="fade-in space-y-6"><Link href="/poulets/bandes" className="inline-flex items-center gap-2 text-[11px] font-bold text-[#6c8176] hover:text-forest"><ArrowLeft size={14} /> Retour aux bandes</Link><EmptyState title="Bande introuvable" description="Cette bande n’existe pas dans les données de la ferme. Les données de démonstration ne sont pas utilisées." action={<Link href="/poulets/bandes" className="btn-primary">Voir les bandes</Link>} /></div>;
  }

  const building = buildings.find((item) => item.batch === lot.id);
  const records = dailyRecords.filter((record) => record.batch === lot.id);
  const health = healthEvents.filter((event) => event.batch === lot.id);
  const visibleSales = buildingScopeActive ? sales.filter((sale) => sale.buildingName && buildings.some((item) => item.name === sale.buildingName)) : sales;
  const dailySold = records.reduce((sum, record) => sum + Number(record.sold || 0), 0);
  const registeredSold = visibleSales.filter((sale) => sale.batch === lot.id).reduce((sum, sale) => sum + Number(sale.quantity || 0), 0);
  const totalSold = Math.max(dailySold, registeredSold);
  const estimatedRevenue = availableCount * 4500;

  function recordSale(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!lot) return;
    const form = new FormData(event.currentTarget);
    const quantity = Number(form.get('quantity') ?? 0);
    const unitPrice = Number(form.get('unitPrice') ?? 0);
    const customer = String(form.get('customer') ?? '').trim();
    if (quantity <= 0 || quantity > availableCount) {
      setFeedback(`Quantité invalide. Il reste ${availableCount} sujets disponibles.`);
      return;
    }
    const sale = { id: `VENTE-${Date.now()}`, batch: lot.id, date: String(form.get('date') ?? '2026-08-13'), quantity, unitPrice, total: quantity * unitPrice, customer, paymentMethod: String(form.get('paymentMethod') ?? 'Espèces') };
    const saleRecorded = registerPoultrySale({ ...sale, batchId: lot.id, buildingName: building?.name });
    if (!saleRecorded) {
      setFeedback('La vente n’a pas été enregistrée : vérifiez la bande et l’effectif disponible.');
      return;
    }
    setLot((current) => current ? ({ ...current, alive: Math.max(current.alive - quantity, 0), status: current.alive - quantity <= 0 ? 'Terminé' : current.status }) : current);
    setAvailableCount((current) => current - quantity);
    setSaleOpen(false);
    setFeedback(`${quantity} sujets vendus pour ${formatFCFA(sale.total)}.`);
    window.setTimeout(() => setFeedback(''), 4000);
  }

  function archiveBatch() {
    if (!lot) return;
    if (lot.alive > 0) {
      setFeedback(`La bande ne peut pas être archivée : ${lot.alive} sujet(s) restent à vendre ou à déclarer.`);
      setArchiveOpen(false);
      return;
    }
    const archives = readLocal(FARM_STORAGE_KEYS.archives, [] as BatchArchive[]);
    if (archives.some((archive) => archive.batchId === lot.id)) {
      setFeedback('Cette bande est déjà archivée.');
      setArchiveOpen(false);
      return;
    }
    const deaths = records.reduce((sum, record) => sum + Number(record.deaths || 0), 0);
    const feedTotal = records.reduce((sum, record) => sum + Number(record.feed || 0), 0);
    const expectedFeedTotal = records.reduce((sum, record) => sum + Number(record.expectedFeed || 0), 0);
    const waterTotal = records.reduce((sum, record) => sum + Number(record.water || 0), 0);
    const salesTotal = visibleSales.filter((sale) => sale.batch === lot.id).reduce((sum, sale) => sum + Number(sale.total || 0), 0);
    const expenses = readLocal(FARM_STORAGE_KEYS.expenses, [] as Array<{ batch?: string; amount: number }>).filter((expense) => expense.batch === lot.id);
    const expensesTotal = expenses.reduce((sum, expense) => sum + Number(expense.amount || 0), 0);
    const finalRecord = records.slice().sort((a, b) => b.date.localeCompare(a.date))[0];
    const closedAt = new Date().toISOString().slice(0, 10);
    const archive: BatchArchive = { id: `ARCH-${lot.id}-${Date.now()}`, batchId: lot.id, name: lot.name, closedAt, closedBy: 'Administrateur', initialCount: lot.initial, totalDeaths: deaths, totalSold, finalAlive: lot.alive, finalWeight: Number(finalRecord?.averageWeight || lot.weight || 0), feedTotal, expectedFeedTotal, waterTotal, mortalityRate: lot.initial ? deaths / lot.initial * 100 : 0, salesTotal, expensesTotal, margin: salesTotal - expensesTotal, recordsCount: records.length, buildings: buildings.filter((item) => item.batch === lot.id).map((item) => item.name) };
    writeLocal(FARM_STORAGE_KEYS.archives, [archive, ...archives]);
    writeLocal(FARM_STORAGE_KEYS.lots, readLocal(FARM_STORAGE_KEYS.lots, [] as typeof poultryLots).map((item) => item.id === lot.id ? { ...item, status: 'Archivée', archivedAt: closedAt } : item));
    writeLocal(FARM_STORAGE_KEYS.buildings, readLocal(FARM_STORAGE_KEYS.buildings, [] as typeof poultryBuildings).map((item) => item.batch === lot.id ? { ...item, current: 0, status: item.status === 'Vide' ? 'En attente vide sanitaire' : item.status, batch: '—', batchName: 'Aucun lot', age: 0 } : item));
    setArchiveOpen(false);
    setFeedback(`La bande ${lot.id} a été archivée. Elle est maintenant disponible dans Statistiques.`);
  }

  return <div className="fade-in space-y-7"><div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between"><div><Link href="/poulets" className="mb-4 inline-flex items-center gap-2 text-[11px] font-bold text-[#6c8176] hover:text-forest"><ArrowLeft size={14} /> Retour à la ferme</Link><div className="flex flex-wrap items-center gap-3"><p className="eyebrow">Ferme · Fiche bande</p><StatusBadge status={lot.status} /></div><h1 className="page-title mt-2">{lot.id}</h1><p className="muted mt-2 text-[13px]">{lot.name} · démarrée le {formatDate(lot.start)}</p></div><div className="flex flex-wrap gap-2"><Link href={`/poulets/suivi?batch=${lot.id}`} className="btn-secondary"><CalendarDays size={15} /> Saisie du jour</Link>{lot.status !== 'Archivée' && <><button className="btn-secondary" onClick={() => setArchiveOpen(true)}><Archive size={15} /> Archiver la bande</button><button className="btn-primary" onClick={() => setSaleOpen(true)}><Plus size={16} /> Enregistrer une vente</button></>}{lot.status === 'Archivée' && <Link href="/poulets/statistiques" className="btn-primary"><BarChart3 size={15} /> Voir les statistiques</Link>}</div></div>{feedback && <div className="flex items-center gap-2 rounded-xl border border-[#cde8c7] bg-[#effaeb] px-4 py-3 text-[12px] font-semibold text-[#4d8f51]"><Check size={14} />{feedback}</div>}<div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6"><StatCard label="Effectif restant" value={formatNumber(availableCount)} change={buildingScopeActive ? 'bâtiment(s) attribué(s)' : `sur ${formatNumber(lot.initial)}`} detail={buildingScopeActive ? 'périmètre visible' : 'sujets au démarrage'} icon={PawPrint} tone="green" /><StatCard label="Poulets vendus" value={formatNumber(totalSold)} change="quantité cumulée" detail="sur cette bande" icon={ShoppingCart} tone="blue" /><StatCard label="Âge de la bande" value={`J${lot.age}`} change="Cycle 45 jours" detail="objectif de vente" icon={CalendarDays} tone="blue" /><StatCard label="Mortalité moyenne" value={formatPercent(lot.mortality)} change={lot.mortality > 4 ? 'À surveiller' : 'Dans la cible'} detail="taux sur la bande" trend={lot.mortality > 4 ? 'down' : 'up'} icon={ShieldCheck} tone="orange" /><StatCard label="Mortalité totale" value={`${Math.round(lot.initial * lot.mortality / 100)} sujets`} change="quantité cumulée" detail="sur cette bande" icon={Activity} tone="purple" /><StatCard label="CA estimé" value={estimatedRevenue} change="avant dépenses" detail="à confirmer à la vente" icon={Receipt} tone="green" /></div><div className="grid gap-5 xl:grid-cols-[1.2fr_.8fr]"><div className="surface p-5 sm:p-6"><SectionHeading eyebrow="Progression" title="Cycle de production" description="Avancement de la bande par rapport à son objectif de vente." /><div className="mt-6"><div className="flex items-end justify-between"><div><p className="text-[34px] font-black tracking-[-.06em] text-forest">{Math.min(Math.round(lot.age / 45 * 100), 100)}<span className="text-[16px]">%</span></p><p className="text-[11px] text-[#829087]">du cycle théorique</p></div><div className="text-right"><p className="text-[13px] font-bold text-ink">{lot.weight.toFixed(2).replace('.', ',')} kg</p><p className="text-[10px] text-[#829087]">poids moyen actuel</p></div></div><div className="mt-4 h-3 overflow-hidden rounded-full bg-[#edf2eb]"><div className="h-full rounded-full bg-[#77c870]" style={{ width: `${Math.min(lot.age / 45 * 100, 100)}%` }} /></div><div className="mt-3 flex justify-between text-[10px] font-semibold text-[#93a098]"><span>J1 · Arrivée</span><span>J45 · Vente cible</span></div></div><div className="mt-7 grid gap-3 sm:grid-cols-3"><Kpi label="Aliment cumulé" value={lot.id === 'LP-26-003' ? '5 840 kg' : '2 920 kg'} icon={Wheat} /><Kpi label="GMQ estimé" value={lot.id === 'LP-26-003' ? '48 g/j' : '53 g/j'} icon={Activity} /><Kpi label="Eau aujourd’hui" value={lot.id === 'LP-26-003' ? '392 L' : '348 L'} icon={Droplets} /></div></div><div className="surface p-5 sm:p-6"><SectionHeading eyebrow="Affectation" title="Bâtiment actuel" /><div className="mt-5 rounded-2xl bg-[#f5faf2] p-4"><div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#dff3d9] text-[#5b9d5b]"><PawPrint size={18} /></span><div><p className="text-[13px] font-bold text-[#477c4a]">{building?.name ?? 'Non affecté'}</p><p className="mt-1 text-[10px] text-[#719174]">Capacité : {building ? formatNumber(building.capacity) : '—'} sujets</p></div></div><div className="mt-4"><MiniProgress value={building ? building.current / building.capacity * 100 : 0} color="green" label="Occupation" right={building ? `${Math.round(building.current / building.capacity * 100)} %` : '—'} /></div></div><div className="mt-4 space-y-3"><InfoRow label="Phase de la bande" value={lot.phase ?? 'À préciser'} /><InfoRow label="Souche" value={lot.name.includes('Cobb') ? 'Cobb 500' : 'Ross 308'} /><InfoRow label="Fournisseur" value="Couvoir partenaire" /><InfoRow label="Prochaine action" value={lot.status === 'Prêt à vendre' ? 'Préparer la vente' : 'Saisie quotidienne'} /></div><Link href="/mouvements" className="mt-5 flex items-center justify-center gap-2 rounded-xl border border-dashed border-[#cad8cc] py-2.5 text-[11px] font-bold text-[#5c8f61]">Voir les mouvements de la bande <ArrowRight size={14} /></Link></div></div><div className="grid gap-5 lg:grid-cols-[1.2fr_.8fr]"><div className="surface overflow-hidden"><div className="flex items-center justify-between border-b border-[#edf0eb] px-5 py-5 sm:px-6"><SectionHeading eyebrow="Journal" title="Derniers suivis" /><button className="icon-btn h-8 w-8"><MoreHorizontal size={15} /></button></div><div className="table-scroll"><table className="w-full text-left"><thead><tr className="table-head"><th>Date</th><th>Bâtiment</th><th>Mortalité</th><th>Aliment</th><th>Poids</th><th>Ambiance</th></tr></thead><tbody>{records.map((record) => <tr className="table-row table-line" key={record.id}><td>{formatDate(record.date)}</td><td>{record.building}</td><td><span className={record.deaths > 2 ? 'font-bold text-[#c76662]' : 'font-semibold text-[#5b9d5b]'}>{record.deaths}</span></td><td>{record.feed} kg</td><td>{record.averageWeight.toFixed(2).replace('.', ',')} kg</td><td><span className="inline-flex items-center gap-1 text-[10px] text-[#75857b]"><Thermometer size={12} />{record.temperature}°C</span></td></tr>)}</tbody></table></div></div><div className="surface overflow-hidden"><div className="flex items-center justify-between border-b border-[#edf0eb] px-5 py-5 sm:px-6"><SectionHeading eyebrow="Sanitaire" title="Derniers événements" /><ShieldCheck size={18} className="text-[#5b9d5b]" /></div><div className="divide-y divide-[#f0f3ef]">{health.length ? health.map((event) => <div className="px-5 py-4" key={event.id}><div className="flex items-start justify-between gap-3"><div><p className="text-[11px] font-bold text-ink">{event.product}</p><p className="mt-1 text-[10px] text-[#8b9891]">{event.type} · {formatDate(event.date)}</p></div><span className="status-badge badge-success"><Check size={12} />{event.status}</span></div><p className="mt-2 text-[10px] text-[#78877e]">{event.note}</p></div>) : <div className="p-6 text-center text-[11px] text-[#89968f]">Aucun événement sanitaire.</div>}</div><Link href="/poulets" className="flex items-center justify-center border-t border-[#edf0eb] py-3 text-[11px] font-bold text-[#5c8f61]">Ouvrir le carnet sanitaire <ArrowRight size={13} className="ml-1" /></Link></div></div>
    <Modal open={saleOpen} onClose={() => setSaleOpen(false)} title="Enregistrer une vente"><form onSubmit={recordSale} className="space-y-5"><p className="muted text-[12px] leading-5">La vente diminuera l’effectif disponible de cette bande et sera conservée dans les données locales de la ferme.</p><div className="rounded-xl bg-[#f5faf2] p-3"><p className="text-[10px] font-bold text-[#6f8873]">Sujets disponibles</p><p className="mt-1 text-[20px] font-black text-forest">{availableCount}</p></div><div className="grid gap-4 sm:grid-cols-2"><label className="block"><span className="field-label">Client</span><input name="customer" className="input-base" placeholder="Nom du client" required /></label><label className="block"><span className="field-label">Date</span><input name="date" type="date" defaultValue="2026-08-13" className="input-base" required /></label><label className="block"><span className="field-label">Nombre de sujets</span><input name="quantity" type="number" min="1" max={availableCount} className="input-base" required /></label><label className="block"><span className="field-label">Prix unitaire</span><input name="unitPrice" type="number" min="1" defaultValue="4500" className="input-base" required /></label><label className="block sm:col-span-2"><span className="field-label">Mode de paiement</span><select name="paymentMethod" className="input-base"><option>Espèces</option><option>Mobile Money</option><option>Virement bancaire</option></select></label></div><div className="flex justify-end gap-2"><button type="button" className="btn-secondary" onClick={() => setSaleOpen(false)}>Annuler</button><button type="submit" className="btn-primary"><Check size={15} /> Valider la vente</button></div></form></Modal>
    <Modal open={archiveOpen} onClose={() => setArchiveOpen(false)} title="Archiver la bande"><div className="space-y-5"><div className="rounded-xl border border-[#dcebdd] bg-[#f5faf2] p-4"><p className="text-[12px] font-bold text-[#3e7546]">Clôture officielle de {lot.id}</p><p className="mt-1 text-[11px] leading-5 text-[#6d9071]">La bande sera figée dans un snapshot de comparaison. Cette action est possible uniquement lorsque l’effectif restant est nul.</p></div><div className="space-y-3"><InfoRow label="Effectif restant" value={`${formatNumber(lot.alive)} sujets`} /><InfoRow label="Poulets vendus" value={`${formatNumber(totalSold)} sujets`} /><InfoRow label="Mortalité cumulée" value={`${Math.round(lot.initial * lot.mortality / 100)} sujets`} /></div><div className="flex justify-end gap-2"><button type="button" className="btn-secondary" onClick={() => setArchiveOpen(false)}>Annuler</button><button type="button" className="btn-primary" onClick={archiveBatch}><Archive size={15} /> Confirmer l’archivage</button></div></div></Modal>
  </div>;
}

function Kpi({ label, value, icon: Icon }: { label: string; value: string; icon: LucideIcon }) { return <div className="rounded-xl border border-[#e7ece5] bg-[#fbfcfa] p-3"><Icon size={15} className="text-[#609c60]" /><p className="mt-2 text-[10px] font-semibold text-[#7f8c84]">{label}</p><p className="mt-1 text-[14px] font-black tracking-[-.03em] text-ink">{value}</p></div>; }
function InfoRow({ label, value }: { label: string; value: string }) { return <div className="flex items-center justify-between gap-3 border-b border-[#f0f3ef] pb-2 text-[11px] last:border-0 last:pb-0"><span className="text-[#849188]">{label}</span><strong className="text-right font-bold text-ink">{value}</strong></div>; }
