'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import QRCode from 'qrcode';
import { Check, Clock3, Package, Truck } from 'lucide-react';
import { customerOrderStatusClass, customerOrderUnitLabel, type CustomerOrder } from '@/lib/customer-orders';

export function CustomerOrderTrackingView({ code }: { code: string }) {
  const [order, setOrder] = useState<CustomerOrder | null>(null);
  const [qrImage, setQrImage] = useState('');
  const [error, setError] = useState('');
  useEffect(() => {
    let disposed = false;
    const load = async () => {
      const response = await fetch(`/api/public/orders/${encodeURIComponent(code)}`, { cache: 'no-store' });
      const data = await response.json() as { order?: CustomerOrder; error?: string };
      if (disposed) return;
      if (!response.ok || !data.order) { setError(data.error ?? 'Commande introuvable.'); return; }
      setOrder(data.order);
      setQrImage(await QRCode.toDataURL(data.order.qrPayload, { width: 230, margin: 2 }));
    };
    void load();
    const timer = window.setInterval(() => { void load(); }, 30000);
    return () => { disposed = true; window.clearInterval(timer); };
  }, [code]);
  if (error) return <main className="flex min-h-screen items-center justify-center bg-[#f6f7f2] p-5"><div className="surface max-w-md p-8 text-center"><Package size={30} className="mx-auto text-[#bd5c5c]" /><h1 className="mt-4 text-xl font-bold text-ink">{error}</h1><Link href="/commande" className="btn-primary mt-5 inline-flex">Nouvelle commande</Link></div></main>;
  if (!order) return <main className="flex min-h-screen items-center justify-center bg-[#f6f7f2] text-[12px] text-[#89968f]">Chargement de la commande…</main>;
  const steps: CustomerOrder['status'][] = ['Reçue', 'Confirmée', 'En préparation', 'Prête', 'En livraison', 'Livrée'];
  const currentIndex = steps.indexOf(order.status);
  return <main className="min-h-screen bg-[#f6f7f2] px-5 py-10 text-ink sm:px-8"><div className="mx-auto max-w-[900px]"><header className="mb-8 flex items-center justify-between"><Link href="/" className="text-[12px] font-black text-forest">SCOOPS LE REVEIL</Link><Link href="/commande" className="text-[11px] font-bold text-[#5b9d5b]">Nouvelle commande</Link></header><div className="surface p-6 sm:p-8"><div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between"><div><p className="eyebrow">Suivi de commande</p><h1 className="mt-2 break-all text-[25px] font-black text-forest">{order.code}</h1><p className="mt-2 text-[12px] text-[#718078]">{order.customerName} · {customerOrderUnitLabel(order.unitId)} · créée le {new Date(order.createdAt).toLocaleString('fr-FR')}</p></div><div className="rounded-xl bg-white p-2 shadow-sm">{qrImage && <Image src={qrImage} alt="QR code de suivi" width={160} height={160} unoptimized className="h-40 w-40" />}</div></div><div className="mt-8 grid gap-3 sm:grid-cols-6">{steps.map((step, index) => <div key={step} className="flex items-center gap-2 sm:block"><span className={`flex h-8 w-8 items-center justify-center rounded-full text-[10px] font-black ${index <= currentIndex ? 'bg-[#a4eb91] text-forest' : 'bg-[#edf1eb] text-[#89968f]'}`}>{index < currentIndex ? <Check size={14} /> : index + 1}</span><span className={`text-[10px] font-bold ${index <= currentIndex ? 'text-forest' : 'text-[#89968f]'}`}>{step}</span></div>)}</div><div className="mt-8 rounded-2xl border border-[#dce8db] bg-[#f5faf2] p-5"><div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-[#5b9d5b]"><Truck size={18} /></span><div><p className="text-[11px] text-[#718078]">Statut actuel</p><p className={`mt-1 inline-flex rounded-full px-3 py-1 text-[12px] font-black ${customerOrderStatusClass(order.status)}`}>{order.status}</p></div></div>{order.deliveredAt && <p className="mt-4 text-[11px] text-[#718078]">Livrée le {new Date(order.deliveredAt).toLocaleString('fr-FR')}{order.deliveryComment ? ` · ${order.deliveryComment}` : ''}</p>}</div><div className="mt-6"><h2 className="text-[14px] font-bold text-ink">Détail de la demande</h2><div className="mt-3 divide-y divide-[#edf0eb] rounded-xl border border-[#edf0eb] bg-white">{order.lines.map((line) => <div key={line.id} className="flex items-center justify-between gap-4 px-4 py-3 text-[11px]"><span>{line.description}</span><strong>{line.quantity} {line.unit}</strong></div>)}</div><p className="mt-3 text-[11px] text-[#89968f]">Adresse : {order.deliveryAddress}</p></div></div></div></main>;
}
