'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { Check, ExternalLink, PackageCheck, ScanLine, Truck, X } from 'lucide-react';
import { type CustomerOrder, type CustomerOrderStatus } from '@/lib/customer-orders';
import { FARM_STORAGE_KEYS, readLocal, subscribeToFarmData, writeLocal } from '@/lib/farm-storage';
import { deliveryMissionStatus, internalUnitLabel, type InternalOrder, type LogisticsNotification } from '@/lib/internal-logistics';

type SessionUser = { id: string; name: string };

export function CustomerOrderScannerView() {
  const [orders, setOrders] = useState<CustomerOrder[]>([]);
  const [internalOrders, setInternalOrders] = useState<InternalOrder[]>([]);
  const [logisticsNotifications, setLogisticsNotifications] = useState<LogisticsNotification[]>([]);
  const [currentUser, setCurrentUser] = useState<SessionUser>({ id: '', name: '' });
  const [message, setMessage] = useState('');
  const [manualCode, setManualCode] = useState('');
  const [scanning, setScanning] = useState(false);
  const [selected, setSelected] = useState<CustomerOrder | null>(null);
  const [selectedMission, setSelectedMission] = useState<InternalOrder | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | undefined>(undefined);
  const timerRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    const user = { id: getCookie('agroflux_user_id'), name: getCookie('agroflux_user_name') || 'Livreur' };
    setCurrentUser(user);
    let disposed = false;
    const loadCustomerOrders = async () => {
      try {
        const response = await fetch('/api/customer-orders', { cache: 'no-store' });
        const data = await response.json() as { orders?: CustomerOrder[] };
        if (!disposed && response.ok) {
          setOrders(data.orders ?? []);
          writeLocal(FARM_STORAGE_KEYS.customerOrders, data.orders ?? []);
          return;
        }
      } catch {
        // Le registre local reste consultable si l'API n'est pas disponible.
      }
      if (!disposed) setOrders(readLocal<CustomerOrder[]>(FARM_STORAGE_KEYS.customerOrders, []));
    };
    const loadLocalMissions = () => {
      if (disposed) return;
      setInternalOrders(readLocal<InternalOrder[]>(FARM_STORAGE_KEYS.internalOrders, []));
      setLogisticsNotifications(readLocal<LogisticsNotification[]>(FARM_STORAGE_KEYS.logisticsNotifications, []));
      setNow(Date.now());
    };
    void loadCustomerOrders();
    loadLocalMissions();
    const refreshTimer = window.setInterval(() => { loadLocalMissions(); void loadCustomerOrders(); }, 5000);
    const unsubscribe = subscribeToFarmData([FARM_STORAGE_KEYS.internalOrders, FARM_STORAGE_KEYS.logisticsNotifications], loadLocalMissions);
    return () => { disposed = true; window.clearInterval(refreshTimer); unsubscribe(); stopScanner(); };
  }, []);

  const missions = useMemo(() => internalOrders.filter((order) => order.assignedDelivererId === currentUser.id), [internalOrders, currentUser.id]);
  const activeMissions = missions.filter((order) => order.status === 'En livraison');
  const completedMissions = missions.filter((order) => order.status.startsWith('Reçue') || deliveryMissionStatus(order) === 'Terminée');
  const missionNotifications = logisticsNotifications.filter((item) => item.recipientUserId === currentUser.id && !item.read).slice(0, 5);

  async function startScanner() {
    setScanning(true);
    setMessage('');
    const Detector = (window as unknown as { BarcodeDetector?: new (options?: { formats: string[] }) => { detect: (video: HTMLVideoElement) => Promise<Array<{ rawValue?: string }>> } }).BarcodeDetector;
    if (!Detector || !navigator.mediaDevices?.getUserMedia || !videoRef.current) {
      setMessage('Le scan caméra n’est pas disponible ici. Saisissez le numéro manuellement.');
      return;
    }
    try {
      streamRef.current = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } } });
      videoRef.current.srcObject = streamRef.current;
      await videoRef.current.play();
      const detector = new Detector({ formats: ['qr_code'] });
      timerRef.current = window.setInterval(async () => {
        if (!videoRef.current) return;
        const found = await detector.detect(videoRef.current);
        const value = found[0]?.rawValue;
        if (value) await processCode(value);
      }, 700);
    } catch {
      setMessage('La caméra est indisponible ou son accès a été refusé. Utilisez la saisie manuelle.');
    }
  }

  function stopScanner() {
    if (timerRef.current) window.clearInterval(timerRef.current);
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = undefined;
    setScanning(false);
  }

  async function processCode(value: string) {
    const code = value.replace('AGROFLUX:CLIENT:', '').trim();
    const order = orders.find((item) => item.code === code || item.id === code);
    if (!order) {
      setMessage(`Aucune commande client trouvée pour ${code}.`);
      return;
    }
    setSelected(order);
    stopScanner();
    const nextStatus: CustomerOrderStatus | null = order.status === 'Prête' ? 'En livraison' : order.status === 'En livraison' ? 'Livrée' : null;
    if (!nextStatus) {
      setMessage(`Commande ${order.code} trouvée. Son statut est « ${order.status} » ; aucune transition QR automatique n’est nécessaire.`);
      return;
    }
    const response = await fetch('/api/customer-orders', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: order.id, status: nextStatus, deliveredBy: nextStatus === 'Livrée' ? currentUser.name : undefined, deliveryComment: nextStatus === 'Livrée' ? 'Livraison confirmée par scan QR.' : undefined }) });
    const data = await response.json() as { order?: CustomerOrder; error?: string };
    if (!response.ok || !data.order) {
      setMessage(data.error ?? 'La transition de commande a été refusée.');
      return;
    }
    const next = orders.map((item) => item.id === order.id ? data.order! : item);
    setOrders(next);
    setSelected(data.order);
    writeLocal(FARM_STORAGE_KEYS.customerOrders, next);
    setMessage(`Scan accepté : ${order.code} est maintenant « ${nextStatus} ».`);
  }

  function confirmInternalArrival(order: InternalOrder) {
    if (order.assignedDelivererId !== currentUser.id || order.status !== 'En livraison') {
      setMessage('Cette mission n’est pas modifiable depuis ce compte.');
      return;
    }
    const confirmedAt = new Date().toISOString();
    const nextOrder: InternalOrder = { ...order, delivererConfirmedAt: confirmedAt, delivererConfirmedById: currentUser.id, deliveryMissionStatus: 'Arrivée signalée' };
    const nextOrders = internalOrders.map((item) => item.id === order.id ? nextOrder : item);
    setInternalOrders(nextOrders);
    writeLocal(FARM_STORAGE_KEYS.internalOrders, nextOrders);
    const nextNotifications: LogisticsNotification[] = [{ id: `LOG-ARRIVAL-${order.id}-${Date.now()}`, createdAt: confirmedAt, recipientUnitId: order.recipientUnitId, orderId: order.id, title: 'Arrivée du livreur signalée', message: `${currentUser.name} signale l’arrivée de ${order.id} (${order.product}). L’unité destinataire doit confirmer la réception.`, kind: 'unit', read: false }, ...logisticsNotifications];
    setLogisticsNotifications(nextNotifications);
    writeLocal(FARM_STORAGE_KEYS.logisticsNotifications, nextNotifications);
    setSelectedMission(nextOrder);
    setMessage(`Arrivée de ${order.id} signalée. La mission sera terminée après la confirmation de réception par ${internalUnitLabel(order.recipientUnitId)}.`);
  }

  return <main className="min-h-screen bg-[#f6f7f2] px-5 py-10 text-ink sm:px-8"><div className="mx-auto max-w-[850px]"><header className="mb-8 flex items-center justify-between"><Link href="/commandes-clients" className="text-[12px] font-black text-forest">← Commandes clients</Link><Link href="/dashboard" className="text-[11px] font-bold text-[#6c8176]">Dashboard</Link></header><div className="mb-6"><p className="eyebrow">Logistique · Espace personnel</p><h1 className="mt-2 text-[28px] font-black tracking-[-.05em] text-forest">Espace livreur unifié</h1><p className="mt-2 max-w-2xl text-[12px] leading-6 text-[#718078]">Une seule page pour les livraisons clients par QR code et les missions de commandes inter-unités. Les missions sont filtrées sur le compte connecté.</p></div>{message && <div className="mb-5 rounded-xl border border-[#dce8db] bg-[#f5faf2] px-4 py-3 text-[11px] font-semibold leading-5 text-[#5b8f60]">{message}</div>}{missionNotifications.length > 0 && <div className="mb-5 rounded-xl border border-[#c9ddf5] bg-[#f3f8ff] px-4 py-3 text-[11px] leading-5 text-[#5176a7]"><strong>Nouvelles notifications de mission</strong>{missionNotifications.map((item) => <p key={item.id} className="mt-1">{item.message}</p>)}</div>}

<section className="surface p-6 sm:p-8"><div className="flex items-center gap-3"><span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#edf8e9] text-[#5b9d5b]"><ScanLine size={24} /></span><div><p className="eyebrow">Commandes clients à livrer</p><h2 className="text-[22px] font-black text-forest">Scanner livraison QR</h2></div></div><p className="mt-4 text-[12px] leading-6 text-[#718078]">Scannez le QR code au départ puis à l’arrivée. Le même code fait évoluer une commande client de « Prête » à « En livraison », puis à « Livrée ».</p><div className="mt-5 flex flex-wrap gap-2"><button className="btn-primary" onClick={() => void startScanner()}><ScanLine size={15} /> Ouvrir la caméra</button>{scanning && <button className="btn-secondary" onClick={stopScanner}><X size={15} /> Arrêter le scan</button>}</div>{scanning && <video ref={videoRef} className="mt-5 aspect-video w-full rounded-2xl bg-[#142e25] object-cover" muted playsInline />}{!scanning && <div className="mt-5 flex gap-2"><input className="input-base h-11 flex-1" value={manualCode} onChange={(event) => setManualCode(event.target.value)} placeholder="CMD-CLI-2026-..." /><button className="btn-secondary h-11" onClick={() => manualCode.trim() && void processCode(manualCode.trim())}>Valider le code</button></div>}{orders.filter((order) => ['Prête', 'En livraison'].includes(order.status)).length > 0 && <div className="mt-6 rounded-2xl border border-[#edf0eb] bg-white p-4"><p className="text-[10px] font-bold uppercase tracking-[.14em] text-[#89968f]">Commandes clientes prêtes ou en livraison</p><div className="mt-3 space-y-2">{orders.filter((order) => ['Prête', 'En livraison'].includes(order.status)).slice(0, 5).map((order) => <div key={order.id} className="flex flex-wrap items-center gap-2 text-[11px]"><strong>{order.code}</strong><span className="text-[#718078]">{order.lines.map((line) => `${line.quantity} ${line.unit} ${line.description}`).join(' · ')}</span><span className="ml-auto rounded-full bg-[#edf8e9] px-2 py-1 text-[9px] font-bold text-[#5b9d5b]">{order.status}</span></div>)}</div></div>}{selected && <div className="mt-6 rounded-2xl border border-[#edf0eb] bg-white p-5"><div className="flex items-center gap-3"><PackageCheck size={18} className="text-[#5b9d5b]" /><div><p className="text-[12px] font-bold text-ink">{selected.code}</p><p className="mt-1 text-[10px] text-[#89968f]">{selected.customerName} · {selected.deliveryAddress}</p></div><span className="ml-auto rounded-full bg-[#edf8e9] px-2.5 py-1 text-[9px] font-bold text-[#5b9d5b]">{selected.status}</span></div><p className="mt-4 text-[11px] text-[#718078]">{selected.lines.map((line) => `${line.quantity} ${line.unit} ${line.description}`).join(' · ')}</p></div>}</section>

<section className="mt-6 surface overflow-hidden"><div className="border-b border-[#edf0eb] px-6 py-5 sm:px-8"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="eyebrow">Missions personnelles</p><h2 className="text-[22px] font-black text-forest">Commandes inter-unités à livrer</h2><p className="mt-2 text-[12px] leading-5 text-[#718078]">Confirmez votre arrivée pour prévenir l’unité destinataire. La mission passe automatiquement à « Terminée » dès sa réception.</p></div><Link href="/mouvements" className="btn-secondary"><ExternalLink size={14} /> Suivi des mouvements</Link></div></div><div className="p-6 sm:p-8">{!currentUser.id ? <p className="py-6 text-center text-[11px] text-[#89968f]">Chargement de votre espace personnel…</p> : activeMissions.length === 0 && completedMissions.length === 0 ? <p className="py-6 text-center text-[11px] text-[#89968f]">Aucune mission de commande inter-unité ne vous est assignée.</p> : <div className="space-y-6">{activeMissions.length > 0 && <div><div className="mb-3 flex items-center gap-2"><Truck size={15} className="text-[#6385bd]" /><h3 className="text-[13px] font-bold text-ink">Missions en cours</h3><span className="rounded-full bg-[#edf3ff] px-2 py-1 text-[9px] font-bold text-[#6385bd]">{activeMissions.length}</span></div><div className="grid gap-3">{activeMissions.map((order) => <MissionCard key={order.id} order={order} now={now} onConfirm={() => confirmInternalArrival(order)} onSelect={() => setSelectedMission(order)} />)}</div></div>}{completedMissions.length > 0 && <div><h3 className="mb-3 text-[13px] font-bold text-ink">Missions terminées</h3><div className="grid gap-3">{completedMissions.slice(0, 10).map((order) => <MissionCard key={order.id} order={order} now={now} onConfirm={() => undefined} onSelect={() => setSelectedMission(order)} />)}</div></div>}{selectedMission && <div className="rounded-xl border border-[#edf0eb] bg-[#fbfcfa] p-4 text-[11px]"><strong>{selectedMission.id} · {selectedMission.product}</strong><p className="mt-1 text-[#718078]">{internalUnitLabel(selectedMission.supplierUnitId)} → {internalUnitLabel(selectedMission.recipientUnitId)} · mission : {deliveryMissionStatus(selectedMission)}</p></div>}</div>}</div></section><div className="mt-5 flex items-center justify-center gap-2 text-[10px] text-[#89968f]"><Truck size={13} /> Les horodatages et confirmations restent rattachés à l’utilisateur et à la commande.</div></div></main>;
}

function MissionCard({ order, now, onConfirm, onSelect }: { order: InternalOrder; now: number; onConfirm: () => void; onSelect: () => void }) {
  const isActive = order.status === 'En livraison';
  return <div className="rounded-2xl border border-[#edf0eb] bg-white p-4"><div className="flex flex-wrap items-start gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#edf3ff] text-[#6385bd]"><Truck size={18} /></span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><button className="text-left text-[12px] font-bold text-ink hover:text-forest" onClick={onSelect}>{order.id}</button><span className={`rounded-full px-2 py-1 text-[9px] font-bold ${isActive ? 'bg-[#edf3ff] text-[#6385bd]' : 'bg-[#edf8e9] text-[#5b9d5b]'}`}>{deliveryMissionStatus(order)}</span></div><p className="mt-1 text-[11px] font-semibold text-[#53675b]">{order.product} · {order.quantity} {order.unit}</p><p className="mt-1 text-[10px] text-[#718078]">{internalUnitLabel(order.supplierUnitId)} → {internalUnitLabel(order.recipientUnitId)} · départ {order.departedAt ? new Date(order.departedAt).toLocaleString('fr-FR') : '—'}</p></div><button className="btn-secondary px-2.5 py-1.5 text-[10px]" onClick={onSelect}>Détails</button></div><div className="mt-4 grid gap-2 text-[10px] sm:grid-cols-3"><div><span className="block text-[#89968f]">Temps écoulé</span><strong className="mt-1 block text-[#6385bd]">{isActive ? elapsedSince(order.departedAt, now) : order.deliveryMinutes ? `Durée ${formatDuration(order.deliveryMinutes)}` : 'Terminé'}</strong></div><div><span className="block text-[#89968f]">Réception</span><strong className="mt-1 block text-ink">{order.arrivedAt ? new Date(order.arrivedAt).toLocaleString('fr-FR') : 'En attente'}</strong></div><div><span className="block text-[#89968f]">Responsable réception</span><strong className="mt-1 block text-ink">{order.arrivedById || '—'}</strong></div></div>{isActive && deliveryMissionStatus(order) !== 'Arrivée signalée' && <button className="btn-primary mt-4 w-full justify-center text-[10px]" onClick={onConfirm}><Check size={13} /> Confirmer la livraison / signaler l’arrivée</button>}{isActive && deliveryMissionStatus(order) === 'Arrivée signalée' && <p className="mt-4 rounded-lg bg-[#f5faf2] px-3 py-2 text-[10px] font-semibold text-[#5b8f60]">Arrivée signalée · en attente de la réception par l’unité destinataire.</p>}</div>;
}

function elapsedSince(value: string, now: number) {
  if (!value) return '—';
  const elapsedMinutes = Math.max(0, Math.floor((now - new Date(value).getTime()) / 60000));
  return elapsedMinutes < 1 ? 'moins d’une min' : formatDuration(elapsedMinutes);
}

function formatDuration(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return hours ? `${hours} h${rest ? ` ${rest} min` : ''}` : `${rest} min`;
}

function getCookie(name: string) {
  const part = document.cookie.split('; ').find((item) => item.startsWith(`${name}=`));
  return part ? decodeURIComponent(part.slice(name.length + 1)) : '';
}
