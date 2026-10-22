'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Check, ClipboardList, Package, Plus, RotateCcw, Search, UserCheck } from 'lucide-react';
import { FARM_STORAGE_KEYS, readLocal, subscribeToFarmData, writeLocal } from '@/lib/farm-storage';
import { Modal, SectionHeading, StatCard } from '@/components/ui';
import { StatusBadge } from '@/components/status-badge';

type CrateCustody = { id: string; employeeId: string; employeeName: string; unitId: string; quantityTaken: number; quantityReturned: number; quantityOutstanding: number; takenAt: string; lastReturnAt: string; reason: string; orderId: string; status: 'En cours' | 'Partiellement rendu' | 'Rendu'; returnHistory: Array<{ id: string; quantity: number; returnedAt: string; note: string }> };
type Employee = { id: string; name: string; unitId: string; position?: string; status?: string };
type StockItem = { id: string; name?: string; itemName?: string; category?: string; quantity: number; unit: string; min?: number; [key: string]: unknown };

export function CrateCustodyView() {
  const [custodies, setCustodies] = useState<CrateCustody[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [stock, setStock] = useState<StockItem[]>([]);
  const [open, setOpen] = useState(false);
  const [returning, setReturning] = useState<CrateCustody | null>(null);
  const [query, setQuery] = useState('');
  const [feedback, setFeedback] = useState('');

  useEffect(() => {
    const load = () => {
      setCustodies(readLocal<CrateCustody[]>(FARM_STORAGE_KEYS.crateCustodies, []));
      setEmployees(readLocal<Employee[]>(FARM_STORAGE_KEYS.rhEmployees, []));
      setStock(readLocal<StockItem[]>(FARM_STORAGE_KEYS.stock, []));
    };
    load();
    return subscribeToFarmData([FARM_STORAGE_KEYS.crateCustodies, FARM_STORAGE_KEYS.rhEmployees, FARM_STORAGE_KEYS.stock], load);
  }, []);
  const crateItems = stock.filter((item) => item.category?.toLowerCase().includes('caisse') || item.name?.toLowerCase().includes('caisse') || item.itemName?.toLowerCase().includes('caisse'));
  const availableCrates = crateItems.reduce((sum, item) => sum + item.quantity, 0);
  const visible = useMemo(() => custodies.filter((item) => `${item.employeeName} ${item.id} ${item.reason} ${item.orderId}`.toLowerCase().includes(query.toLowerCase())), [custodies, query]);
  const outstanding = custodies.filter((item) => item.quantityOutstanding > 0).reduce((sum, item) => sum + item.quantityOutstanding, 0);

  function notify(message: string) { setFeedback(message); window.setTimeout(() => setFeedback(''), 4000); }
  function updateCrateStock(delta: number) {
    if (!crateItems.length) { notify('Aucun article identifié comme caisse dans le stock de la ferme. Créez d’abord l’article Caisse(s).'); return false; }
    const total = crateItems.reduce((sum, item) => sum + item.quantity, 0);
    if (delta < 0 && total < Math.abs(delta)) { notify(`Stock de caisses insuffisant : ${total} disponible(s).`); return false; }
    let remaining = Math.abs(delta);
    const next = stock.map((item) => {
      if (!crateItems.some((crate) => crate.id === item.id) || remaining <= 0) return item;
      const movement = delta < 0 ? Math.min(item.quantity, remaining) : remaining;
      remaining -= movement;
      return { ...item, quantity: delta < 0 ? item.quantity - movement : item.quantity + movement };
    });
    if (delta > 0 && remaining > 0) {
      const first = crateItems[0];
      const nextItem = { ...first, quantity: first.quantity + remaining };
      writeLocal(FARM_STORAGE_KEYS.stock, next.map((item) => item.id === first.id ? nextItem : item));
      setStock(next.map((item) => item.id === first.id ? nextItem : item));
    } else {
      writeLocal(FARM_STORAGE_KEYS.stock, next);
      setStock(next);
    }
    return true;
  }

  function takeCrates(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const employee = employees.find((item) => item.id === String(form.get('employeeId') ?? ''));
    const quantity = Number(form.get('quantity') ?? 0);
    if (!employee || quantity <= 0 || !updateCrateStock(-quantity)) return;
    const now = new Date().toISOString();
    const custody: CrateCustody = { id: `CAISSE-${Date.now()}`, employeeId: employee.id, employeeName: employee.name, unitId: employee.unitId, quantityTaken: quantity, quantityReturned: 0, quantityOutstanding: quantity, takenAt: now, lastReturnAt: '', reason: String(form.get('reason') ?? '').trim(), orderId: String(form.get('orderId') ?? '').trim(), status: 'En cours', returnHistory: [] };
    setCustodies((current) => [custody, ...current]);
    writeLocal(FARM_STORAGE_KEYS.crateCustodies, [custody, ...custodies]);
    const notifications = readLocal<Array<{ id: string; createdAt: string; type: string; custodyId: string; employeeId: string; employeeName: string; quantity: number; message: string }>>(FARM_STORAGE_KEYS.crateNotifications, []);
    writeLocal(FARM_STORAGE_KEYS.crateNotifications, [{ id: `CAISSE-NOTIF-${Date.now()}`, createdAt: now, type: 'Retrait', custodyId: custody.id, employeeId: employee.id, employeeName: employee.name, quantity, message: `${employee.name} a retiré ${quantity} caisse(s).` }, ...notifications]);
    setOpen(false);
    notify(`${quantity} caisse(s) retirée(s) par ${employee.name}.`);
  }

  function returnCrates(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!returning) return;
    const form = new FormData(event.currentTarget);
    const quantity = Number(form.get('quantity') ?? 0);
    if (quantity <= 0 || quantity > returning.quantityOutstanding || !updateCrateStock(quantity)) return;
    const now = new Date().toISOString();
    const next = custodies.map((item) => item.id === returning.id ? { ...item, quantityReturned: item.quantityReturned + quantity, quantityOutstanding: item.quantityOutstanding - quantity, lastReturnAt: now, status: (item.quantityOutstanding - quantity) === 0 ? 'Rendu' as const : 'Partiellement rendu' as const, returnHistory: [...item.returnHistory, { id: `RET-${Date.now()}`, quantity, returnedAt: now, note: String(form.get('note') ?? '').trim() }] } : item);
    setCustodies(next);
    writeLocal(FARM_STORAGE_KEYS.crateCustodies, next);
    const notifications = readLocal<Array<{ id: string; createdAt: string; type: string; custodyId: string; employeeId: string; employeeName: string; quantity: number; message: string }>>(FARM_STORAGE_KEYS.crateNotifications, []);
    writeLocal(FARM_STORAGE_KEYS.crateNotifications, [{ id: `CAISSE-NOTIF-${Date.now()}`, createdAt: now, type: 'Retour', custodyId: returning.id, employeeId: returning.employeeId, employeeName: returning.employeeName, quantity, message: `${returning.employeeName} a remis ${quantity} caisse(s).` }, ...notifications]);
    setReturning(null);
    notify(`${quantity} caisse(s) remise(s) le ${new Date(now).toLocaleString('fr-FR')}.`);
  }

  return <div className="fade-in space-y-7"><div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between"><div><Link href="/dashboard/poulets" className="mb-4 inline-flex items-center gap-2 text-[11px] font-bold text-[#6c8176] hover:text-forest">← Retour au dashboard ferme</Link><p className="eyebrow mb-2">Poulets bio · Logistique commerciale</p><h1 className="page-title">Gestion des caisses</h1><p className="muted mt-2 max-w-2xl text-[13px]">Chaque retrait est rattaché à l’identifiant de l’employé. Les retours partiels restent visibles jusqu’à restitution complète.</p></div><button className="btn-primary" onClick={() => setOpen(true)}><Plus size={15} /> Retirer des caisses</button></div>{feedback && <div className="flex items-center gap-2 rounded-xl border border-[#cde8c7] bg-[#effaeb] px-4 py-3 text-[12px] font-semibold text-[#4d8f51]"><Check size={14} />{feedback}</div>}<div className="grid gap-4 sm:grid-cols-3"><StatCard label="Caisses disponibles" value={String(availableCrates)} change="stock ferme" detail="articles caisse" icon={Package} tone="green" /><StatCard label="Caisses dehors" value={String(outstanding)} change="à récupérer" detail="toutes personnes" icon={ClipboardList} tone="orange" /><StatCard label="Retraits actifs" value={String(custodies.filter((item) => item.quantityOutstanding > 0).length)} change="suivi nominatif" detail="historique local" icon={UserCheck} tone="blue" /></div><div className="flex justify-end"><div className="relative min-w-[250px]"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9aa59f]" /><input className="input-base h-9 pl-9 text-[11px]" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Rechercher une personne ou référence..." /></div></div><div className="surface overflow-hidden"><div className="border-b border-[#edf0eb] px-5 py-5 sm:px-6"><SectionHeading eyebrow="Traçabilité des contenants" title="Retraits et retours" description="Le solde restant dehors est calculé après chaque remise, même partielle." /></div><div className="table-scroll"><table className="w-full text-left"><thead><tr className="table-head"><th>Responsable</th><th>Retrait</th><th>Retour</th><th>Solde dehors</th><th>Motif / commande</th><th>Historique</th><th>Action</th></tr></thead><tbody>{visible.length ? visible.map((item) => <tr key={item.id} className="table-row table-line"><td><strong className="block text-ink">{item.employeeName}</strong><small className="text-[10px] text-[#89968f]">ID : {item.employeeId} · {item.id}</small></td><td>{item.quantityTaken} · {new Date(item.takenAt).toLocaleString('fr-FR')}</td><td>{item.quantityReturned}{item.lastReturnAt && <small className="mt-1 block text-[10px] text-[#89968f]">Dernier : {new Date(item.lastReturnAt).toLocaleString('fr-FR')}</small>}</td><td className="font-black text-[#bd7737]">{item.quantityOutstanding}</td><td>{item.reason || '—'}{item.orderId && <small className="mt-1 block text-[10px] text-[#6385bd]">Commande : {item.orderId}</small>}</td><td><StatusBadge status={item.status} /><small className="mt-1 block text-[10px] text-[#89968f]">{item.returnHistory.length} retour(s)</small></td><td>{item.quantityOutstanding > 0 ? <button className="btn-primary px-2.5 py-1.5 text-[10px]" onClick={() => setReturning(item)}><RotateCcw size={12} /> Remettre</button> : <span className="text-[10px] font-bold text-[#5b9d5b]">Solde nul</span>}</td></tr>) : <tr><td colSpan={7} className="px-6 py-14 text-center text-[11px] text-[#89968f]">Aucun retrait de caisse enregistré.</td></tr>}</tbody></table></div></div><Modal open={open} onClose={() => setOpen(false)} title="Retirer des caisses"><form onSubmit={takeCrates} className="space-y-5"><label className="block"><span className="field-label">Personne qui retire</span><select name="employeeId" className="input-base" required><option value="">Choisir un commercial / employé</option>{employees.filter((employee) => employee.status !== 'Sorti').map((employee) => <option key={employee.id} value={employee.id}>{employee.name} · {employee.id} · {employee.position ?? employee.unitId}</option>)}</select></label><div className="grid gap-4 sm:grid-cols-2"><label className="block"><span className="field-label">Quantité</span><input name="quantity" type="number" min="1" step="1" className="input-base" required /></label><label className="block"><span className="field-label">Commande / activité</span><input name="orderId" className="input-base" placeholder="Référence facultative" /></label><label className="block sm:col-span-2"><span className="field-label">Motif</span><textarea name="reason" className="input-base min-h-[70px] resize-none" placeholder="Vente, tournée commerciale..." required /></label></div><div className="flex justify-end gap-2"><button type="button" className="btn-secondary" onClick={() => setOpen(false)}>Annuler</button><button className="btn-primary" type="submit"><Package size={15} /> Débiter le stock</button></div></form></Modal><Modal open={Boolean(returning)} onClose={() => setReturning(null)} title="Remettre des caisses"><form onSubmit={returnCrates} className="space-y-5"><p className="rounded-xl border border-[#e1ebe0] bg-[#f6faf4] p-4 text-[11px] leading-5"><strong>{returning?.employeeName}</strong> · il reste <strong>{returning?.quantityOutstanding}</strong> caisse(s) dehors.</p><label className="block"><span className="field-label">Quantité rendue</span><input name="quantity" type="number" min="1" max={returning?.quantityOutstanding} step="1" className="input-base" required /></label><label className="block"><span className="field-label">Note du retour</span><textarea name="note" className="input-base min-h-[70px] resize-none" placeholder="État, manque constaté..." /></label><div className="flex justify-end gap-2"><button type="button" className="btn-secondary" onClick={() => setReturning(null)}>Annuler</button><button className="btn-primary" type="submit"><RotateCcw size={15} /> Enregistrer le retour</button></div></form></Modal></div>;
}
