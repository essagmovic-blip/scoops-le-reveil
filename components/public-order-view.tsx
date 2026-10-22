'use client';

import { FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import QRCode from 'qrcode';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Check, MapPin, Package, Plus, Search, Send, Truck } from 'lucide-react';
import { units } from '@/lib/data';
import { FARM_STORAGE_KEYS, writeLocal } from '@/lib/farm-storage';
import { customerOrderStatusClass, customerOrderUnitLabel, customerOrderProducts, type CustomerOrder } from '@/lib/customer-orders';
import { formatFCFA } from '@/lib/format';
import { addPdfFooter, addPdfLetterhead } from '@/lib/pdf-letterhead';

const orderUnits = units.filter((unit) => unit.id !== 'rh');

type LineForm = { id: string; description: string; quantity: number; unit: string };

export function PublicOrderView() {
  const [selectedUnit, setSelectedUnit] = useState('poulets');
  const [lines, setLines] = useState<LineForm[]>([{ id: `line-${Date.now()}`, description: customerOrderProducts('poulets')[0]?.label ?? '', quantity: 1, unit: customerOrderProducts('poulets')[0]?.unit ?? 'unité' }]);
  const [submitted, setSubmitted] = useState<CustomerOrder | null>(null);
  const [qrImage, setQrImage] = useState('');
  const [feedback, setFeedback] = useState('');

  function updateLine(id: string, patch: Partial<LineForm>) { setLines((current) => current.map((line) => line.id === id ? { ...line, ...patch } : line)); }
  function changeUnit(unitId: string) { const option = customerOrderProducts(unitId)[0]; setSelectedUnit(unitId); setLines([{ id: `line-${Date.now()}`, description: option?.label ?? '', quantity: 1, unit: option?.unit ?? 'unité' }]); }
  function addLine() { const option = customerOrderProducts(selectedUnit)[0]; setLines((current) => [...current, { id: `line-${Date.now()}`, description: option?.label ?? '', quantity: 1, unit: option?.unit ?? 'unité' }]); }
  function removeLine(id: string) { setLines((current) => current.length > 1 ? current.filter((line) => line.id !== id) : current); }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const payload = { requestedDate: String(form.get('requestedDate') ?? new Date().toISOString().slice(0, 10)), unitId: selectedUnit, customerName: String(form.get('customerName') ?? '').trim(), customerPhone: String(form.get('customerPhone') ?? '').trim(), customerEmail: String(form.get('customerEmail') ?? '').trim(), deliveryAddress: String(form.get('deliveryAddress') ?? '').trim(), note: String(form.get('note') ?? '').trim(), lines: lines.map((line) => ({ description: line.description.trim(), quantity: line.quantity, unit: line.unit, unitPrice: 0 })) };
    if (!payload.customerName || !payload.customerPhone || !payload.deliveryAddress || payload.lines.some((line) => !line.description || line.quantity <= 0)) { setFeedback('Renseignez vos coordonnées et chaque article de la commande.'); return; }
    try {
      const response = await fetch('/api/public/orders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const data = await response.json() as { order?: CustomerOrder; error?: string };
      if (!response.ok || !data.order) { setFeedback(data.error ?? 'Impossible d’enregistrer la commande.'); return; }
      setSubmitted(data.order);
      writeLocal(FARM_STORAGE_KEYS.customerOrders, [data.order]);
      const qr = await QRCode.toDataURL(data.order.qrPayload, { width: 260, margin: 2, errorCorrectionLevel: 'M' });
      setQrImage(qr);
      await downloadCustomerReceipt(data.order, qr);
    } catch { setFeedback('Le service de commande est momentanément indisponible.'); }
  }

  if (submitted) return <div className="min-h-screen bg-[#f6f7f2] px-5 py-10 text-ink sm:px-8"><div className="mx-auto max-w-[850px]"><div className="mb-6 flex items-center justify-between"><Link href="/" className="text-[12px] font-bold text-[#4d8e52]">SCOOPS LE REVEIL</Link><Link href={`/commande/${submitted.code}`} className="text-[11px] font-bold text-[#4d8e52]">Suivre la commande</Link></div><div className="surface grid gap-8 p-6 sm:grid-cols-[1fr_280px] sm:p-8"><div><span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#edf8e9] text-[#5b9d5b]"><Check size={25} /></span><p className="eyebrow mt-5">Commande reçue</p><h1 className="mt-2 text-[28px] font-black tracking-[-.05em] text-forest">Merci pour votre commande</h1><p className="mt-3 text-[12px] leading-6 text-[#718078]">Votre demande a été transmise à {customerOrderUnitLabel(submitted.unitId)}. Conservez le code ci-dessous pour suivre sa préparation et sa livraison.</p><div className="mt-6 rounded-2xl border border-[#dce8db] bg-[#f5faf2] p-4"><p className="text-[10px] uppercase tracking-[.14em] text-[#718078]">Code de commande</p><p className="mt-2 break-all text-[18px] font-black text-forest">{submitted.code}</p><p className="mt-2 text-[10px] text-[#89968f]">Statut : {submitted.status} · unité : {customerOrderUnitLabel(submitted.unitId)}</p></div><Link href={`/commande/${submitted.code}`} className="btn-primary mt-6 inline-flex">Suivre ma commande <Truck size={15} /></Link></div><div className="flex flex-col items-center justify-center rounded-2xl bg-white p-4"><p className="mb-3 text-[10px] font-bold text-[#66766d]">QR code de suivi</p>{qrImage && <Image src={qrImage} alt={`QR code de la commande ${submitted.code}`} width={230} height={230} unoptimized className="h-[230px] w-[230px]" />}<p className="mt-3 text-center text-[9px] leading-4 text-[#89968f]">Ce code sera utilisé par SCOOPS LE REVEIL pour suivre la livraison.</p></div></div></div></div>;

  return <main className="min-h-screen bg-[#f6f7f2] px-5 py-10 text-ink sm:px-8"><div className="mx-auto max-w-[900px]"><header className="mb-8 flex items-center justify-between"><Link href="/" className="flex items-center gap-3"><span className="relative flex h-11 w-11 items-center justify-center overflow-hidden rounded-xl bg-white shadow-[0_7px_16px_rgba(91,157,91,.16)]"><Image src="/scoops-le-reveil-logo.jpg" alt="Logo SCOOPS LE REVEIL" fill className="object-contain" sizes="44px" /></span><span><strong className="block text-[15px] font-black text-forest">SCOOPS LE REVEIL</strong><small className="text-[9px] uppercase tracking-[.16em] text-[#89968f]">Commande en ligne</small></span></Link><Link href="/commande/suivre" className="text-[11px] font-bold text-[#6c8176]">Suivre ma commande</Link></header><div className="mb-7 text-center"><p className="eyebrow">Service commercial</p><h1 className="mt-3 text-[34px] font-black tracking-[-.06em] text-forest sm:text-[48px]">Passez votre commande</h1><p className="mx-auto mt-3 max-w-xl text-[13px] leading-6 text-[#718078]">Décrivez votre besoin. L’équipe de l’unité concernée vous recontactera pour confirmer les prix, la disponibilité et la livraison.</p></div>{feedback && <div className="mb-5 rounded-xl border border-[#f0d5ad] bg-[#fff8ea] px-4 py-3 text-[12px] font-semibold text-[#986c3e]">{feedback}</div>}<form onSubmit={submit} className="surface space-y-7 p-5 sm:p-8"><section><h2 className="text-[16px] font-bold text-ink">Vos coordonnées</h2><div className="mt-4 grid gap-4 sm:grid-cols-2"><label className="block"><span className="field-label">Nom complet</span><input name="customerName" className="input-base" required /></label><label className="block"><span className="field-label">Téléphone</span><input name="customerPhone" className="input-base" required /></label><label className="block"><span className="field-label">Email</span><input name="customerEmail" type="email" className="input-base" /></label><label className="block"><span className="field-label">Unité souhaitée</span><select name="unitId" className="input-base" value={selectedUnit} onChange={(event) => changeUnit(event.target.value)}>{orderUnits.map((unit) => <option key={unit.id} value={unit.id}>{unit.label}</option>)}</select></label><label className="block sm:col-span-2"><span className="field-label">Adresse de livraison</span><div className="relative"><MapPin size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#89968f]" /><input name="deliveryAddress" className="input-base pl-9" placeholder="Quartier, ville, repère..." required /></div></label><label className="block"><span className="field-label">Date souhaitée</span><input name="requestedDate" type="date" className="input-base" defaultValue={new Date().toISOString().slice(0, 10)} /></label></div></section><section><div className="flex items-center justify-between"><div><h2 className="text-[16px] font-bold text-ink">Articles souhaités</h2><p className="mt-1 text-[11px] text-[#89968f]">Les prix et la disponibilité seront confirmés par l’unité.</p></div><button type="button" className="btn-secondary px-3 py-2 text-[10px]" onClick={addLine}><Plus size={14} /> Ajouter un article</button></div><div className="mt-4 space-y-3">{lines.map((line) => <div key={line.id} className="grid gap-3 rounded-xl border border-[#edf0eb] bg-[#fbfcfa] p-3 sm:grid-cols-[1fr_100px_120px_36px]"><select value={line.description} onChange={(event) => { const option = customerOrderProducts(selectedUnit).find((item) => item.label === event.target.value); updateLine(line.id, { description: event.target.value, unit: option?.unit ?? line.unit }); }} className="input-base" required>{customerOrderProducts(selectedUnit).map((option) => <option key={option.label} value={option.label}>{option.label}</option>)}</select><input type="number" min="0.01" step="0.01" value={line.quantity} onChange={(event) => updateLine(line.id, { quantity: Number(event.target.value) })} className="input-base" required /><select value={line.unit} onChange={(event) => updateLine(line.id, { unit: event.target.value })} className="input-base"><option>unité</option><option>kg</option><option>litre</option><option>sac</option><option>caisse</option></select><button type="button" className="icon-btn h-10 w-10 text-[#bd5c5c]" onClick={() => removeLine(line.id)} aria-label="Supprimer"><span>×</span></button></div>)}</div></section><label className="block"><span className="field-label">Commentaire ou précision</span><textarea name="note" className="input-base min-h-[95px] resize-none" placeholder="Quantité, conditionnement, consignes de livraison..." /></label><div className="flex justify-end"><button type="submit" className="btn-primary"><Send size={15} /> Envoyer la commande</button></div></form><div className="mt-5 flex items-center justify-center gap-2 text-[10px] text-[#89968f]"><Search size={13} /> Vous recevrez un code et un QR code pour le suivi.</div></div></main>;
}

async function downloadCustomerReceipt(order: CustomerOrder, qrImage: string) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const contentStart = await addPdfLetterhead(doc, { title: 'Bon de commande', reference: order.code, context: [`Créée le ${new Date(order.createdAt).toLocaleString('fr-FR')}`, `Unité : ${customerOrderUnitLabel(order.unitId)}`] });
  doc.setFillColor(245, 250, 242);
  doc.roundedRect(14, contentStart, 182, 31, 3, 3, 'F');
  doc.setTextColor(29, 46, 39);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('CLIENT', 20, contentStart + 8);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(`${order.customerName} · ${order.customerPhone}`, 20, contentStart + 15);
  doc.text(`Adresse : ${order.deliveryAddress}`, 20, contentStart + 22);
  doc.text(`Date souhaitée : ${order.requestedDate}`, 130, contentStart + 15);
  autoTable(doc, { startY: contentStart + 40, head: [['Article', 'Quantité', 'Unité', 'Montant']], body: order.lines.map((line) => [line.description, String(line.quantity), line.unit, line.total ? formatFCFA(line.total) : 'À confirmer']), theme: 'grid', headStyles: { fillColor: [47, 104, 80] }, styles: { fontSize: 9, cellPadding: 3 } });
  const finalY = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? contentStart + 72;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(`Total : ${order.amount ? formatFCFA(order.amount) : 'Prix à confirmer par l’unité'}`, 196, finalY + 12, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(`Statut : ${order.status}`, 14, finalY + 24);
  doc.text('Présentez ce numéro ou ce QR code pour suivre la livraison.', 14, finalY + 31);
  if (qrImage) doc.addImage(qrImage, 'PNG', 150, finalY + 20, 36, 36);
  addPdfFooter(doc);
  doc.save(`${order.code}-recu.pdf`);
}
