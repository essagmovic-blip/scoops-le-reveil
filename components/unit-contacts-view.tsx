'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Check, Download, Edit3, Mail, MapPin, Phone, Plus, Search, Trash2, Truck, Users } from 'lucide-react';
import type { Invoice, UnitId } from '@/lib/data';
import { units } from '@/lib/data';
import { EmptyState } from '@/components/empty-state';
import { Modal, SectionHeading, StatCard } from '@/components/ui';
import { formatFCFA } from '@/lib/format';
import { FARM_STORAGE_KEYS, readLocal, subscribeToFarmData, writeLocal } from '@/lib/farm-storage';

type ContactType = 'clients' | 'fournisseurs';
type ContactRecord = { id: string; unit: UnitId; name: string; phone: string; email: string; address: string; category: string; note: string };
type CommercialSettings = Record<string, { clientRebatePercent?: number }>;

export function UnitContactsView({ unitId, type }: { unitId: UnitId; type: ContactType }) {
  const [records, setRecords] = useState<ContactRecord[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [rebatePercent, setRebatePercent] = useState(0);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ContactRecord | null>(null);
  const [feedback, setFeedback] = useState('');
  const unit = units.find((item) => item.id === unitId);
  const key = type === 'clients' ? FARM_STORAGE_KEYS.unitClients : FARM_STORAGE_KEYS.unitSuppliers;
  const title = type === 'clients' ? 'Clients de l’unité' : 'Fournisseurs de l’unité';
  const noun = type === 'clients' ? 'client' : 'fournisseur';

  useEffect(() => {
    const load = () => {
      const all = readLocal<Array<ContactRecord & { contact?: string; paymentTerms?: string; balance?: number }>>(key, []);
      const settings = readLocal<CommercialSettings>(FARM_STORAGE_KEYS.unitCommercialSettings, {});
      setRecords(all.filter((record) => record.unit === unitId).map((record) => ({ id: record.id, unit: record.unit, name: record.name, phone: record.phone, email: record.email, address: record.address, category: record.category, note: record.note })));
      setInvoices(readLocal<Invoice[]>(FARM_STORAGE_KEYS.invoices, []));
      setRebatePercent(Math.max(Number(settings[unitId]?.clientRebatePercent ?? 0), 0));
    };
    load();
    return subscribeToFarmData([key, FARM_STORAGE_KEYS.invoices, FARM_STORAGE_KEYS.unitCommercialSettings], load);
  }, [key, unitId]);

  function persistRecords(nextRecords: ContactRecord[]) {
    const all = readLocal<ContactRecord[]>(key, []).filter((record) => record.unit !== unitId);
    writeLocal(key, [...all, ...nextRecords]);
  }
  function notify(message: string) { setFeedback(message); window.setTimeout(() => setFeedback(''), 3800); }
  function purchaseTotalFor(clientName: string) { return invoices.filter((invoice) => invoice.unit === unitId && invoice.client.trim().toLowerCase() === clientName.trim().toLowerCase()).reduce((sum, invoice) => sum + Number(invoice.amount || 0), 0); }
  function rebateFor(clientName: string) { return purchaseTotalFor(clientName) * rebatePercent / 100; }

  const visible = useMemo(() => records.filter((record) => `${record.id} ${record.name} ${record.phone} ${record.email} ${record.category} ${record.address}`.toLowerCase().includes(query.toLowerCase())), [records, query]);
  const categories = new Set(records.map((record) => record.category).filter(Boolean)).size;
  const purchaseTotal = type === 'clients' ? records.reduce((sum, record) => sum + purchaseTotalFor(record.name), 0) : 0;
  const rebateTotal = type === 'clients' ? records.reduce((sum, record) => sum + rebateFor(record.name), 0) : 0;

  function saveContact(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const record: ContactRecord = { id: editing?.id ?? `${type === 'clients' ? 'CLI' : 'FOU'}-${unitId.toUpperCase()}-${Date.now()}`, unit: unitId, name: String(form.get('name') ?? '').trim(), phone: String(form.get('phone') ?? '').trim(), email: String(form.get('email') ?? '').trim(), address: String(form.get('address') ?? '').trim(), category: String(form.get('category') ?? '').trim(), note: String(form.get('note') ?? '').trim() };
    if (!record.name || !record.phone) return;
    const nextRecords = editing ? records.map((item) => item.id === editing.id ? record : item) : [record, ...records];
    setRecords(nextRecords); persistRecords(nextRecords); setEditing(null); setOpen(false);
    notify(`${record.name} a été ${editing ? 'modifié' : 'ajouté'} dans les ${type === 'clients' ? 'clients' : 'fournisseurs'} de ${unit?.label ?? 'l’unité'}.`);
  }
  function deleteContact(record: ContactRecord) { if (!window.confirm(`Supprimer ${record.name} de cette rubrique ?`)) return; const nextRecords = records.filter((item) => item.id !== record.id); setRecords(nextRecords); persistRecords(nextRecords); notify(`${record.name} a été supprimé de la rubrique.`); }
  function exportContacts() {
    const header = type === 'clients' ? 'ID client;Client;Téléphone;Email;Adresse;Catégorie;Achats cumulés;Ristourne calculée;Note' : 'ID fournisseur;Fournisseur;Téléphone;Email;Adresse;Catégorie;Note';
    const rows = type === 'clients' ? visible.map((record) => [record.id, record.name, record.phone, record.email, record.address, record.category, purchaseTotalFor(record.name), rebateFor(record.name), record.note].join(';')) : visible.map((record) => [record.id, record.name, record.phone, record.email, record.address, record.category, record.note].join(';'));
    const csv = ['SCOOPS LE REVEIL', `${title} — ${unit?.label ?? unitId}`, '', header, ...rows].join('\n');
    const link = document.createElement('a'); link.href = URL.createObjectURL(new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8' })); link.download = `${type}-${unitId}.csv`; link.click(); URL.revokeObjectURL(link.href); notify(`La liste des ${type} a été exportée.`);
  }

  return <div className="fade-in space-y-7"><div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between"><div><Link href={`/dashboard/${unitId}`} className="mb-4 inline-flex items-center gap-2 text-[11px] font-bold text-[#6c8176] hover:text-forest">← Retour au dashboard {unit?.shortLabel?.toLowerCase() ?? 'de l’unité'}</Link><p className="eyebrow mb-2">{unit?.label ?? 'Unité'} · Contacts</p><h1 className="page-title">{title}</h1><p className="muted mt-2 max-w-2xl text-[13px]">Cette rubrique contient uniquement les {type === 'clients' ? 'clients' : 'fournisseurs'} rattachés à {unit?.label ?? 'l’unité'}. Les paiements et règlements sont suivis dans la caisse.</p></div><div className="flex flex-wrap gap-2"><button className="btn-secondary" onClick={exportContacts}><Download size={15} /> Exporter</button><button className="btn-primary" onClick={() => { setEditing(null); setOpen(true); }}><Plus size={16} /> Nouveau {noun}</button></div></div>{feedback && <div className="flex items-center gap-2 rounded-xl border border-[#cde8c7] bg-[#effaeb] px-4 py-3 text-[12px] font-semibold text-[#4d8f51]"><Check size={14} />{feedback}</div>}
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><StatCard label={type === 'clients' ? 'Clients enregistrés' : 'Fournisseurs enregistrés'} value={String(records.length)} change={records.length ? 'données de l’unité' : 'À créer'} detail={unit?.label ?? 'unité active'} icon={Users} tone="green" /><StatCard label="Avec téléphone" value={String(records.filter((record) => record.phone).length)} change="contacts joignables" detail="registre local" icon={Phone} tone="blue" /><StatCard label="Catégories" value={String(categories)} change="classifications" detail="dans cette unité" icon={type === 'clients' ? Users : Truck} tone="orange" />{type === 'clients' ? <StatCard label="Ristournes calculées" value={rebateTotal} change={`${rebatePercent}% du total achats`} detail={`achats : ${formatFCFA(purchaseTotal)}`} icon={Mail} tone="purple" /> : <StatCard label="Adresses renseignées" value={String(records.filter((record) => record.address).length)} change="fiches complètes" detail="registre fournisseurs" icon={MapPin} tone="purple" />}</div>
    <div className="surface overflow-hidden"><div className="flex flex-col gap-4 border-b border-[#edf0eb] px-5 pb-4 pt-5 sm:px-6"><div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><SectionHeading eyebrow="Carnet de l’unité" title={`${records.length} ${type === 'clients' ? 'client' : 'fournisseur'}${records.length > 1 ? 's' : ''}`} description={type === 'clients' ? `Les achats sont lus depuis les factures de l’unité. Taux de ristourne actuel : ${rebatePercent}%.` : 'Les fournisseurs sont enregistrés sans solde ni conditions de paiement dans ce carnet.'} /><div className="relative min-w-[235px]"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9aa69f]" /><input className="input-base h-9 rounded-lg bg-[#fbfcfa] pl-9 text-[11px]" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={`Rechercher un ${noun}...`} /></div></div></div><div className="table-scroll"><table className="w-full text-left"><thead><tr className="table-head"><th>ID</th><th>{type === 'clients' ? 'Client' : 'Fournisseur'}</th><th>Téléphone</th><th>Email</th><th>Catégorie</th>{type === 'clients' ? <><th>Achats</th><th>Ristourne</th></> : <><th>Adresse</th><th>Note</th></>}<th /></tr></thead><tbody>{visible.length ? visible.map((record) => <tr className="table-row table-line" key={record.id}><td className="font-bold text-ink">{record.id}</td><td><p className="font-bold text-ink">{record.name}</p></td><td><a href={`tel:${record.phone}`} className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#5b9d5b]"><Phone size={12} />{record.phone}</a></td><td>{record.email ? <a href={`mailto:${record.email}`} className="inline-flex items-center gap-1 text-[10px] text-[#6385bd]"><Mail size={12} />{record.email}</a> : '—'}</td><td>{record.category || '—'}</td>{type === 'clients' ? <><td className="font-semibold text-ink">{formatFCFA(purchaseTotalFor(record.name))}</td><td className="font-bold text-[#5b9d5b]">{formatFCFA(rebateFor(record.name))}</td></> : <><td><span className="inline-flex max-w-[180px] items-center gap-1 truncate text-[10px] text-[#718078]"><MapPin size={12} />{record.address || '—'}</span></td><td>{record.note || '—'}</td></>}<td><div className="flex gap-1"><button className="icon-btn h-8 w-8" onClick={() => { setEditing(record); setOpen(true); }} aria-label={`Modifier ${record.name}`}><Edit3 size={14} /></button><button className="icon-btn h-8 w-8 text-[#b45d5d]" onClick={() => deleteContact(record)} aria-label={`Supprimer ${record.name}`}><Trash2 size={14} /></button></div></td></tr>) : <tr><td colSpan={type === 'clients' ? 8 : 8} className="px-6 py-14 text-center"><EmptyState title={`Aucun ${noun} enregistré`} description={`Ajoutez le premier ${noun} rattaché à ${unit?.label ?? 'cette unité'}.`} action={<button className="btn-primary" onClick={() => { setEditing(null); setOpen(true); }}><Plus size={15} /> Nouveau {noun}</button>} /></td></tr>}</tbody></table></div></div>
    <Modal open={open} onClose={() => { setOpen(false); setEditing(null); }} title={`${editing ? 'Modifier' : 'Nouveau'} ${noun}`}><form onSubmit={saveContact} className="space-y-5"><div className="rounded-xl border border-[#dcebdd] bg-[#f5faf2] px-3 py-2.5 text-[11px] text-[#5b8f60]">Ce contact sera enregistré uniquement dans le carnet de {unit?.label ?? 'l’unité active'}.</div><div className="grid gap-4 sm:grid-cols-2"><label className="block sm:col-span-2"><span className="field-label">{type === 'clients' ? 'ID client' : 'ID fournisseur'}</span><div className="input-base bg-[#f5faf2] font-bold text-[#4d8f52]">{editing?.id ?? 'Généré automatiquement à l’enregistrement'}</div></label><label className="block sm:col-span-2"><span className="field-label">Nom du {noun}</span><input name="name" className="input-base" defaultValue={editing?.name ?? ''} placeholder={type === 'clients' ? 'Ex. Hôtel, grossiste ou éleveur' : 'Ex. Fournisseur d’aliments ou de matériel'} required /></label><label className="block"><span className="field-label">Téléphone</span><input name="phone" className="input-base" defaultValue={editing?.phone ?? ''} required /></label><label className="block"><span className="field-label">Email</span><input name="email" type="email" className="input-base" defaultValue={editing?.email ?? ''} /></label><label className="block"><span className="field-label">Catégorie</span><input name="category" className="input-base" defaultValue={editing?.category ?? ''} placeholder={type === 'clients' ? 'Grossiste, restaurant, éleveur...' : 'Aliments, animaux, matériel...'} /></label><label className="block"><span className="field-label">Adresse</span><input name="address" className="input-base" defaultValue={editing?.address ?? ''} /></label><label className="block sm:col-span-2"><span className="field-label">Note</span><textarea name="note" className="input-base min-h-[70px] resize-none" defaultValue={editing?.note ?? ''} /></label></div><div className="flex justify-end gap-2"><button type="button" className="btn-secondary" onClick={() => setOpen(false)}>Annuler</button><button type="submit" className="btn-primary"><Check size={15} /> Enregistrer</button></div></form></Modal>
  </div>;
}
