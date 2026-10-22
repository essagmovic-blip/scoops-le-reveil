'use client';

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import QRCode from 'qrcode';
import { Check, Package, QrCode, Search, Truck, X } from 'lucide-react';
import { units } from '@/lib/data';
import { FARM_STORAGE_KEYS, readLocal, writeLocal } from '@/lib/farm-storage';
import { customerOrderStatusClass, customerOrderUnitLabel, type CustomerOrder, type CustomerOrderStatus } from '@/lib/customer-orders';
import { SectionHeading, StatCard } from '@/components/ui';
import { StatusBadge } from '@/components/status-badge';

const orderUnits = units.filter((unit) => unit.id !== 'rh');
type ScannerProps = { onCode: (code: string) => void; onClose: () => void };

export function CustomerOrdersManager() {
  const [orders, setOrders] = useState<CustomerOrder[]>([]);
  const [selected, setSelected] = useState<CustomerOrder | null>(null);
  const [qrImage, setQrImage] = useState('');
  const [unitFilter, setUnitFilter] = useState('Toutes');
  const [statusFilter, setStatusFilter] = useState('Tous');
  const [query, setQuery] = useState('');
  const [scannerOpen, setScannerOpen] = useState(false);
  const [feedback, setFeedback] = useState('');

  useEffect(() => {
    let disposed = false;
    const load = async () => {
      try {
        const response = await fetch('/api/customer-orders', { cache: 'no-store' });
        if (response.ok) {
          const data = await response.json() as { orders?: CustomerOrder[] };
          if (!disposed) { setOrders(data.orders ?? []); writeLocal(FARM_STORAGE_KEYS.customerOrders, data.orders ?? []); }
          return;
        }
      } catch { /* fallback local */ }
      if (!disposed) setOrders(readLocal<CustomerOrder[]>(FARM_STORAGE_KEYS.customerOrders, []));
    };
    void load();
    return () => { disposed = true; };
  }, []);

  useEffect(() => {
    if (!selected) { setQrImage(''); return; }
    void QRCode.toDataURL(selected.qrPayload, { width: 260, margin: 2 }).then(setQrImage).catch(() => setQrImage(''));
  }, [selected]);

  const visible = useMemo(() => orders.filter((order) => (unitFilter === 'Toutes' || order.unitId === unitFilter) && (statusFilter === 'Tous' || order.status === statusFilter) && `${order.code} ${order.customerName} ${order.customerPhone} ${order.lines.map((line) => line.description).join(' ')}`.toLowerCase().includes(query.toLowerCase())), [orders, unitFilter, statusFilter, query]);
  const pending = orders.filter((order) => ['Reçue', 'Confirmée'].includes(order.status)).length;
  const preparing = orders.filter((order) => ['En préparation', 'Prête'].includes(order.status)).length;
  const delivering = orders.filter((order) => order.status === 'En livraison').length;
  const delivered = orders.filter((order) => order.status === 'Livrée').length;

  function notify(message: string) { setFeedback(message); window.setTimeout(() => setFeedback(''), 4000); }
  async function updateStatus(order: CustomerOrder, status: CustomerOrderStatus) {
    let stockWarning = '';
    let stockDeductedAt = order.stockDeductedAt;
    if (status === 'Prête' && !order.stockDeductedAt) {
      const stockResult = deductCustomerOrderStock(order);
      stockDeductedAt = stockResult.matched ? new Date().toISOString() : '';
      if (!stockResult.matched) stockWarning = ' Aucun article n’a été débité automatiquement : vérifiez les libellés du stock.';
    }
    const patch = { id: order.id, status, deliveredBy: status === 'Livrée' ? getCookie('agroflux_user_name') : undefined, deliveryComment: status === 'Livrée' ? 'Livraison confirmée par AgroFlux.' : undefined, stockDeductedAt };
    try {
      const response = await fetch('/api/customer-orders', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch) });
      const data = await response.json() as { order?: CustomerOrder; error?: string };
      if (!response.ok || !data.order) { notify(data.error ?? 'Modification refusée.'); return; }
      const next = orders.map((item) => item.id === order.id ? data.order! : item);
      setOrders(next); writeLocal(FARM_STORAGE_KEYS.customerOrders, next); setSelected(data.order); notify(`${order.code} est maintenant « ${status} ».${stockWarning}`);
    } catch { notify('Le serveur de commandes est indisponible.'); }
  }

  function handleScanned(value: string) {
    const code = value.replace('AGROFLUX:CLIENT:', '').trim();
    const order = orders.find((item) => item.code === code || item.id === code);
    setScannerOpen(false);
    if (!order) { notify(`Aucune commande trouvée pour le code ${code}.`); return; }
    setSelected(order);
    if (order.status === 'Prête') void updateStatus(order, 'En livraison');
    else if (order.status === 'En livraison') void updateStatus(order, 'Livrée');
    else notify(`Commande ${order.code} sélectionnée. Son statut est « ${order.status} ».`);
  }

  return <div className="fade-in space-y-7"><div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between"><div><p className="eyebrow mb-2">Commerce · Commandes clients</p><h1 className="page-title">Commandes clients en ligne</h1><p className="muted mt-2 max-w-2xl text-[13px]">Préparez les commandes reçues depuis la page publique et utilisez le QR code pour enregistrer le départ puis la livraison.</p></div><div className="flex flex-wrap gap-2"><button className="btn-secondary" onClick={() => setScannerOpen(true)}><QrCode size={15} /> Scanner un QR code</button><a href="/commandes-clients/scanner" className="btn-secondary"><QrCode size={15} /> Espace livreur / scanner</a><a href="/commande" target="_blank" rel="noreferrer" className="btn-primary"><Package size={15} /> Ouvrir la commande publique</a></div></div>{feedback && <div className="flex items-center gap-2 rounded-xl border border-[#cde8c7] bg-[#effaeb] px-4 py-3 text-[12px] font-semibold text-[#4d8f51]"><Check size={14} />{feedback}</div>}<div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><StatCard label="Nouvelles commandes" value={String(pending)} change="à confirmer" detail="reçues en ligne" icon={Package} tone="orange" /><StatCard label="Préparation" value={String(preparing)} change="à préparer / prêtes" detail="flux opérationnel" icon={Check} tone="purple" /><StatCard label="En livraison" value={String(delivering)} change="suivi QR" detail="départs enregistrés" icon={Truck} tone="blue" /><StatCard label="Livrées" value={String(delivered)} change="historique" detail="commandes terminées" icon={Check} tone="green" /></div><div className="flex flex-wrap gap-2"><div className="relative"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9aa59f]" /><input className="input-base h-9 pl-9 text-[11px]" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Code, client, téléphone..." /></div><select className="input-base h-9 w-auto text-[11px]" value={unitFilter} onChange={(event) => setUnitFilter(event.target.value)}><option>Toutes</option>{orderUnits.map((unit) => <option key={unit.id} value={unit.id}>{unit.shortLabel}</option>)}</select><select className="input-base h-9 w-auto text-[11px]" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option>Tous</option><option>Reçue</option><option>Confirmée</option><option>En préparation</option><option>Prête</option><option>En livraison</option><option>Livrée</option><option>Annulée</option></select></div><div className="surface overflow-hidden"><div className="border-b border-[#edf0eb] px-5 py-5 sm:px-6"><SectionHeading eyebrow="Registre des commandes" title="Commandes reçues" description="Le QR code ne contient que la référence de commande. Les données client restent dans AgroFlux." /></div><div className="table-scroll"><table className="w-full text-left"><thead><tr className="table-head"><th>Commande</th><th>Client</th><th>Unité</th><th>Articles</th><th>Date souhaitée</th><th>Statut</th><th>Action</th></tr></thead><tbody>{visible.length ? visible.map((order) => <tr key={order.id} className="table-row table-line"><td><button className="text-left" onClick={() => setSelected(order)}><strong className="block text-[#4d8e52] underline-offset-2 hover:underline">{order.code}</strong><small className="text-[10px] text-[#89968f]">{new Date(order.createdAt).toLocaleString('fr-FR')}</small></button></td><td><strong className="block text-ink">{order.customerName}</strong><small className="text-[10px] text-[#89968f]">{order.customerPhone}</small></td><td>{customerOrderUnitLabel(order.unitId)}</td><td>{order.lines.map((line) => `${line.quantity} ${line.unit} ${line.description}`).join(' · ')}</td><td>{order.requestedDate}</td><td><StatusBadge status={order.status} /></td><td><div className="flex flex-wrap gap-1">{order.status === 'Reçue' && <button className="btn-secondary px-2 py-1.5 text-[10px]" onClick={() => void updateStatus(order, 'Confirmée')}>Confirmer</button>}{order.status === 'Confirmée' && <button className="btn-primary px-2 py-1.5 text-[10px]" onClick={() => void updateStatus(order, 'En préparation')}>Préparer</button>}{order.status === 'En préparation' && <button className="btn-primary px-2 py-1.5 text-[10px]" onClick={() => void updateStatus(order, 'Prête')}>Marquer prête</button>}{order.status === 'Prête' && <button className="btn-primary px-2 py-1.5 text-[10px]" onClick={() => void updateStatus(order, 'En livraison')}>Départ</button>}{order.status === 'En livraison' && <button className="btn-primary px-2 py-1.5 text-[10px]" onClick={() => void updateStatus(order, 'Livrée')}>Livrée</button>}<button className="icon-btn h-8 w-8" onClick={() => setSelected(order)} aria-label="Voir le QR code"><QrCode size={14} /></button></div></td></tr>) : <tr><td colSpan={7} className="px-6 py-14 text-center text-[11px] text-[#89968f]">Aucune commande client dans ce périmètre.</td></tr>}</tbody></table></div></div><div className="rounded-xl border border-[#dce8db] bg-[#f5faf2] px-4 py-3 text-[11px] leading-5 text-[#5b8f60]">Scannez le même QR code au départ pour passer en « En livraison », puis à l’arrivée pour passer en « Livrée ». Les changements restent rattachés au code unique de la commande.</div><OrderDetail order={selected} qrImage={qrImage} onClose={() => setSelected(null)} onStatus={updateStatus} />{scannerOpen && <QrScanner onCode={handleScanned} onClose={() => setScannerOpen(false)} />}</div>;
}

function OrderDetail({ order, qrImage, onClose, onStatus }: { order: CustomerOrder | null; qrImage: string; onClose: () => void; onStatus: (order: CustomerOrder, status: CustomerOrderStatus) => void }) { if (!order) return null; return <div className="fixed inset-0 z-[80] flex items-center justify-center bg-[#102d23]/35 p-4" onMouseDown={onClose}><div className="surface max-h-[90vh] w-full max-w-2xl overflow-auto p-6" onMouseDown={(event) => event.stopPropagation()}><div className="flex items-start justify-between gap-4"><div><p className="eyebrow">Détail et QR code</p><h2 className="mt-1 text-xl font-black text-forest">{order.code}</h2><p className="mt-1 text-[11px] text-[#89968f]">{order.customerName} · {order.customerPhone} · {customerOrderUnitLabel(order.unitId)}</p></div><button className="icon-btn h-8 w-8" onClick={onClose} aria-label="Fermer"><X size={15} /></button></div><div className="mt-5 grid gap-5 sm:grid-cols-[1fr_220px]"><div><p className="text-[12px] font-bold text-ink">{order.deliveryAddress}</p><p className="mt-3 text-[11px] leading-5 text-[#718078]">{order.note || 'Aucune précision client.'}</p><div className="mt-5 space-y-2 rounded-xl border border-[#edf0eb] p-4">{order.lines.map((line) => <div key={line.id} className="flex justify-between gap-3 text-[11px]"><span>{line.description}</span><strong>{line.quantity} {line.unit}</strong></div>)}</div><p className="mt-4 text-[11px] text-[#89968f]">Montant : {order.amount ? `${order.amount.toLocaleString('fr-FR')} FCFA` : 'À confirmer par l’unité'}</p><div className="mt-5 flex flex-wrap gap-2">{order.status === 'Reçue' && <button className="btn-secondary" onClick={() => void onStatus(order, 'Confirmée')}>Confirmer</button>}{order.status === 'Confirmée' && <button className="btn-primary" onClick={() => void onStatus(order, 'En préparation')}>Préparer</button>}{order.status === 'En préparation' && <button className="btn-primary" onClick={() => void onStatus(order, 'Prête')}>Marquer prête</button>}{order.status === 'Prête' && <button className="btn-primary" onClick={() => void onStatus(order, 'En livraison')}>Départ</button>}{order.status === 'En livraison' && <button className="btn-primary" onClick={() => void onStatus(order, 'Livrée')}>Confirmer livraison</button>}</div></div><div className="flex flex-col items-center rounded-xl bg-white p-3"><p className="mb-2 text-[10px] font-bold text-[#66766d]">Scanner ce QR code</p>{qrImage && <Image src={qrImage} alt="QR code de la commande" width={190} height={190} unoptimized className="h-[190px] w-[190px]" />}<p className={`mt-3 rounded-full px-2.5 py-1 text-[9px] font-bold ${customerOrderStatusClass(order.status)}`}>{order.status}</p></div></div></div></div>; }

function QrScanner({ onCode, onClose }: ScannerProps) {
  const [manualCode, setManualCode] = useState('');
  const [message, setMessage] = useState('');
  useEffect(() => {
    const Detector = (window as unknown as { BarcodeDetector?: new (options?: { formats: string[] }) => { detect: (video: HTMLVideoElement) => Promise<Array<{ rawValue?: string }>> } }).BarcodeDetector;
    const video = document.getElementById('agroflux-qr-video') as HTMLVideoElement | null;
    let stream: MediaStream | undefined;
    let timer: number | undefined;
    if (!Detector || !video || !navigator.mediaDevices?.getUserMedia) { setMessage('Le scan caméra n’est pas disponible dans ce navigateur. Utilisez le champ manuel.'); return undefined; }
    const start = async () => {
      try { stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } } }); video.srcObject = stream; await video.play(); const detector = new Detector({ formats: ['qr_code'] }); timer = window.setInterval(async () => { const results = await detector.detect(video); const value = results[0]?.rawValue; if (value) onCode(value); }, 700); } catch { setMessage('Caméra refusée ou indisponible. Utilisez le champ manuel.'); }
    };
    void start();
    return () => { if (timer) window.clearInterval(timer); stream?.getTracks().forEach((track) => track.stop()); };
  }, [onCode]);
  return <div className="fixed inset-0 z-[90] flex items-center justify-center bg-[#102d23]/45 p-4"><div className="surface w-full max-w-md p-6"><div className="flex items-center justify-between"><h2 className="text-lg font-bold text-ink">Scanner un QR code</h2><button className="icon-btn h-8 w-8" onClick={onClose} aria-label="Fermer"><X size={15} /></button></div><video id="agroflux-qr-video" className="mt-5 aspect-square w-full rounded-xl bg-[#142e25] object-cover" muted playsInline />{message && <p className="mt-3 rounded-xl bg-[#fff8ea] px-3 py-2 text-[10px] text-[#986c3e]">{message}</p>}<div className="mt-4 flex gap-2"><input className="input-base h-10 flex-1 text-[11px]" value={manualCode} onChange={(event) => setManualCode(event.target.value)} placeholder="CMD-CLI-..." /><button className="btn-primary px-3" onClick={() => manualCode.trim() && onCode(manualCode.trim())}>Valider</button></div></div></div>;
}

function deductCustomerOrderStock(order: CustomerOrder) {
  const key = order.unitId === 'poulets' ? FARM_STORAGE_KEYS.stock : order.unitId === 'stocks' ? FARM_STORAGE_KEYS.centralStock : order.unitId === 'provenderie' ? FARM_STORAGE_KEYS.feedFinishedStock : order.unitId === 'bio' ? FARM_STORAGE_KEYS.bioFinishedStock : order.unitId === 'pressoir' ? FARM_STORAGE_KEYS.pressFinishedStock : FARM_STORAGE_KEYS.goatFinishedStock;
  const stock = readLocal<Array<{ id: string; name?: string; itemName?: string; recipeName?: string; quantity: number; unit: string; [key: string]: unknown }>>(key, []);
  let matched = false;
  const next = stock.map((item) => {
    if (matched) return item;
    const label = String(item.name ?? item.itemName ?? item.recipeName ?? '').toLowerCase();
    const line = order.lines.find((entry) => label === entry.description.toLowerCase() || label.includes(entry.description.toLowerCase()));
    if (!line) return item;
    const quantity = line.unit.toLowerCase() === item.unit.toLowerCase() ? line.quantity : line.unit.toLowerCase() === 'kg' && item.unit.toLowerCase().includes('sac') ? line.quantity / 50 : line.unit.toLowerCase().includes('sac') && item.unit.toLowerCase() === 'kg' ? line.quantity * 50 : undefined;
    if (quantity === undefined || item.quantity < quantity) return item;
    matched = true;
    return { ...item, quantity: item.quantity - quantity };
  });
  if (!matched) return { matched: false };
  writeLocal(key, next);
  return { matched: true };
}

function getCookie(name: string) { const part = document.cookie.split('; ').find((item) => item.startsWith(`${name}=`)); return part ? decodeURIComponent(part.slice(name.length + 1)) : ''; }
