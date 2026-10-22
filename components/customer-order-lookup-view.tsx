'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Truck } from 'lucide-react';
import Link from 'next/link';

export function CustomerOrderLookupView() {
  const [code, setCode] = useState('');
  const router = useRouter();
  function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const value = code.trim(); if (value) router.push(`/commande/${encodeURIComponent(value)}`); }
  return <main className="min-h-screen bg-[#f6f7f2] px-5 py-12 text-ink sm:px-8"><div className="mx-auto max-w-[650px]"><header className="mb-10 flex items-center justify-between"><Link href="/" className="text-[13px] font-black text-forest">SCOOPS LE REVEIL</Link><Link href="/commande" className="text-[11px] font-bold text-[#5b9d5b]">Commander en ligne</Link></header><div className="surface p-6 text-center sm:p-10"><span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#edf8e9] text-[#5b9d5b]"><Truck size={27} /></span><p className="eyebrow mt-5">Suivi livraison</p><h1 className="mt-2 text-[30px] font-black tracking-[-.06em] text-forest">Suivre ma commande</h1><p className="mx-auto mt-3 max-w-md text-[12px] leading-6 text-[#718078]">Saisissez le numéro reçu après votre commande. Vous pouvez également ouvrir directement le lien contenu dans votre QR code.</p><form onSubmit={submit} className="mx-auto mt-7 flex max-w-md gap-2"><input value={code} onChange={(event) => setCode(event.target.value)} className="input-base h-11 flex-1" placeholder="CMD-CLI-2026-..." aria-label="Numéro de commande" required /><button className="btn-primary h-11 px-4" type="submit"><Search size={15} /> Suivre</button></form></div></div></main>;
}
