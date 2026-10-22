'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, BarChart3, Check, ChevronRight, Droplets, FlaskConical, Lock, Package, PawPrint, Sprout, ShieldCheck, Users, Wheat } from 'lucide-react';
import { units, type UnitId } from '@/lib/data';
import { FARM_STORAGE_KEYS, readLocal } from '@/lib/farm-storage';

const unitMeta: Record<UnitId, { description: string; icon: typeof PawPrint; tone: string; image: string }> = {
  poulets: { description: 'Élevage de poulets bio : lots, bâtiments, suivi quotidien, santé et performances.', icon: PawPrint, tone: 'green', image: '/unit-poulets-bio.jpg' },
  provenderie: { description: 'Recettes, matières premières, productions et transferts d’aliments.', icon: Wheat, tone: 'orange', image: '/unit-provenderie.jpg' },
  bio: { description: 'Fabrication, traçabilité et approvisionnement des produits naturels.', icon: FlaskConical, tone: 'purple', image: '/unit-produits-bio.jpg' },
  pressoir: { description: 'Pressage, rendement, huile et tourteaux par lot.', icon: Droplets, tone: 'yellow', image: '/unit-pressoir.jpg' },
  stocks: { description: '90 % de produits agricoles et de machines agricoles, avec inventaire, alertes et autres articles.', icon: Package, tone: 'blue', image: '/unit-magasin-central.jpg' },
  chevrerie: { description: 'Animaux, reproduction, santé, alimentation, productions et transferts du cheptel caprin.', icon: Sprout, tone: 'green', image: '/unit-chevrerie.jpg' },
  rh: { description: 'Personnel des six unités, présences, congés, paie et administration de la société.', icon: Users, tone: 'purple', image: '/unit-rh.jpg' },
};

export function UnitSelectionView() {
  const [selected, setSelected] = useState('');
  const [currentRole, setCurrentRole] = useState('Administratrice');
  const [sessionName, setSessionName] = useState('MOVIC');
  const [allowedUnits, setAllowedUnits] = useState<UnitId[] | null>(null);
  const [accessReady, setAccessReady] = useState(false);
  const [poultryLotsCount, setPoultryLotsCount] = useState(0);
  const [feedback, setFeedback] = useState('');

  useEffect(() => {
    const cookieMap = Object.fromEntries(document.cookie.split('; ').filter(Boolean).map((part) => { const index = part.indexOf('='); return [part.slice(0, index), decodeURIComponent(part.slice(index + 1))]; }));
    const role = cookieMap.agroflux_role || readLocal(FARM_STORAGE_KEYS.currentUserRole, 'Administratrice');
    const isAdmin = cookieMap.agroflux_is_admin === '1';
    const parsedAllowed = parseCookieArray(cookieMap.agroflux_allowed_units).filter((value): value is UnitId => units.some((unit) => unit.id === value));
    setSessionName(cookieMap.agroflux_user_name || 'Utilisateur');
    setCurrentRole(role);
    setAllowedUnits(isAdmin ? null : parsedAllowed);
    setAccessReady(true);

    const denied = new URLSearchParams(window.location.search).get('denied');
    const reason = new URLSearchParams(window.location.search).get('reason');
    if (denied) setFeedback(reason === 'access' ? 'Accès non autorisé pour votre compte. Sélectionnez une unité autorisée.' : 'Cette page n’est pas disponible pour votre compte.');

    try {
      const raw = window.localStorage.getItem(FARM_STORAGE_KEYS.lots);
      const lots = raw ? JSON.parse(raw) : [];
      setPoultryLotsCount(Array.isArray(lots) ? lots.filter((lot: { status?: string }) => lot.status !== 'Terminé' && lot.status !== 'Archivée').length : 0);
    } catch {
      setPoultryLotsCount(0);
    }
  }, []);

  const toneClasses: Record<string, string> = {
    green: 'bg-[#eaf7e7] text-[#579b58] border-[#d4ead0]',
    orange: 'bg-[#fff1e2] text-[#bd7737] border-[#f1dfca]',
    purple: 'bg-[#f1ecff] text-[#8b73b8] border-[#e4daf6]',
    yellow: 'bg-[#fff6d9] text-[#a9801e] border-[#f3e7b8]',
    blue: 'bg-[#edf3ff] text-[#6385bd] border-[#d9e5fb]',
  };

  const isDirectionRole = ['PDG', 'DG', 'ADMINISTRATRICE'].includes(currentRole.trim().toUpperCase());
  const isUnitAllowed = (unitId: UnitId) => !accessReady || allowedUnits === null || allowedUnits.includes(unitId);

  function enterUnit(unitId: string) {
    if (!accessReady) {
      setFeedback('Vérification de vos autorisations en cours…');
      return;
    }
    if (unitId === 'global' && !isDirectionRole) {
      setFeedback('La vue consolidée est réservée aux rôles de direction.');
      return;
    }
    if (unitId !== 'global' && accessReady && allowedUnits !== null && !allowedUnits.includes(unitId as UnitId)) {
      setSelected('');
      setFeedback('Accès non autorisé pour votre compte. Cette unité reste visible, mais elle est verrouillée.');
      return;
    }
    setSelected(unitId);
    window.localStorage.setItem(FARM_STORAGE_KEYS.activeUnit, unitId);
    document.cookie = `agroflux_active_unit=${unitId}; path=/; max-age=${60 * 60 * 24 * 7}; samesite=lax`;
    window.setTimeout(() => window.location.assign(`/dashboard/${unitId}`), 120);
  }

  return <main className="min-h-screen bg-[#f6f7f2] px-5 py-8 text-ink sm:px-8 lg:px-12"><div className="mx-auto max-w-[1180px]">
    <header className="flex items-center justify-between"><Link href="/" className="flex items-center gap-3"><span className="relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-[13px] bg-white shadow-[0_8px_18px_rgba(91,157,91,.16)]"><Image src="/scoops-le-reveil-logo.jpg" alt="Logo SCOOPS LE REVEIL" fill className="object-contain" sizes="44px" /></span><span><span className="block text-[18px] font-black tracking-[-.07em] text-forest">agro<span className="text-[#5a9f5b]">flux</span></span><span className="block text-[8px] font-bold uppercase tracking-[.18em] text-[#8b9891]">SCOOPS LE REVEIL</span></span></Link><span className="rounded-full border border-[#dce8db] bg-white px-3 py-2 text-[10px] font-bold text-[#6c8176]">{accessReady && allowedUnits !== null ? `${sessionName} · ${currentRole}` : 'Session administrateur'}</span></header>
    <div className="mx-auto max-w-[920px] pb-10 pt-16 text-center sm:pt-20"><p className="eyebrow">Espace de travail</p><h1 className="mt-4 text-[36px] font-bold leading-[.98] tracking-[-.065em] text-forest sm:text-[52px]">Dans quelle unité<br /><span className="landing-serif text-[#e9975c]">souhaitez-vous travailler ?</span></h1><p className="muted mx-auto mt-5 max-w-[580px] text-[13px] leading-6">Les sept unités restent visibles. Les cartes verrouillées indiquent simplement les espaces qui ne sont pas autorisés pour votre compte.</p></div>
    {feedback && <div className="mx-auto mb-5 flex max-w-[760px] items-center gap-2 rounded-xl border border-[#f0d5ad] bg-[#fff8ea] px-4 py-3 text-left text-[12px] font-semibold leading-5 text-[#986c3e]"><ShieldCheck size={16} className="shrink-0" />{feedback}</div>}
    <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{units.map((unit) => { const meta = unitMeta[unit.id]; const Icon = meta.icon; const allowed = isUnitAllowed(unit.id); return <button key={unit.id} type="button" aria-disabled={!allowed} className={`group surface relative flex min-h-[230px] flex-col p-5 text-left transition ${allowed ? 'hover:-translate-y-1 hover:border-[#bcd8bb] hover:shadow-[0_18px_38px_rgba(35,72,45,.09)]' : 'cursor-not-allowed border-[#e1e6e0] bg-[#eef1ed]/80 opacity-65 grayscale-[.35]'} ${selected === unit.id ? 'border-[#74bd70] ring-2 ring-[#a4eb91]/40' : ''}`} onClick={() => enterUnit(unit.id)}><div className="relative h-24 overflow-hidden rounded-2xl bg-[#edf2ec]"><Image src={meta.image} alt="" fill className="object-cover transition duration-500 group-hover:scale-105" sizes="(max-width: 1024px) 50vw, 33vw" /><div className={`absolute inset-0 ${allowed ? 'bg-gradient-to-t from-[#19382e]/50 via-transparent to-transparent' : 'bg-[#44574d]/45'}`} /><div className="absolute bottom-2 left-2"><span className={`flex h-9 w-9 items-center justify-center rounded-xl border border-white/70 ${toneClasses[meta.tone]}`}><Icon size={18} /></span></div><span className={`absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full shadow-sm ${allowed ? 'bg-white/90 text-[#5b9d5b]' : 'bg-[#5b6b63]/90 text-white'}`}>{allowed ? <ChevronRight size={17} /> : <Lock size={15} />}</span></div><div className="mt-5 flex items-center justify-between gap-2"><h2 className="text-[17px] font-bold tracking-[-.035em] text-forest">{unit.label}</h2>{!allowed && <span className="rounded-full bg-[#dce3dd] px-2 py-1 text-[9px] font-bold text-[#68786f]">Verrouillée</span>}</div><p className="mt-2 min-h-[40px] text-[11px] leading-5 text-[#7a897f]">{meta.description}</p><div className="mt-auto flex items-center justify-between border-t border-[#edf0eb] pt-4"><span className={`text-[10px] font-bold ${allowed ? (unit.id === 'poulets' ? 'text-[#5d9b5d]' : 'text-[#9a7a44]') : 'text-[#89968f]'}`}>{unit.id === 'poulets' && allowed ? `${poultryLotsCount} bande${poultryLotsCount > 1 ? 's' : ''} active${poultryLotsCount > 1 ? 's' : ''}` : allowed ? (unit.id === 'rh' ? 'Unité transversale' : 'Unité opérationnelle') : 'Accès non autorisé'}</span><span className={`text-[10px] font-semibold ${allowed ? 'text-[#a0aba4]' : 'text-[#89968f]'}`}>{allowed ? 'Ouvrir' : 'Déverrouiller avec un droit adapté'}</span></div></button>; })}</section>
    <section className="mt-5 grid gap-4 lg:grid-cols-[1fr_1fr]">{isDirectionRole ? <button type="button" className="group flex items-center gap-4 rounded-2xl border border-[#d7e5d7] bg-[#edf8e9] p-5 text-left transition hover:border-[#a8d3a5]" onClick={() => enterUnit('global')}><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-white text-[#5b9d5b]"><BarChart3 size={20} /></span><span className="min-w-0 flex-1"><span className="block text-[13px] font-bold text-[#3e7546]">Vue consolidée de la direction</span><span className="mt-1 block text-[10px] text-[#6f9073]">Accès réservé aux rôles PDG, DG et au compte administrateur principal.</span></span><ArrowRight size={17} className="text-[#5a9d5b] transition group-hover:translate-x-1" /></button> : <div className="flex items-center gap-4 rounded-2xl border border-[#eadff3] bg-[#f8f4fc] p-5"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-white text-[#8b73b8]"><ShieldCheck size={20} /></span><span><span className="block text-[13px] font-bold text-[#70578f]">Vue consolidée de la direction</span><span className="mt-1 block text-[10px] leading-4 text-[#896f9f]">Accès réservé aux utilisateurs ayant le rôle PDG ou DG.</span></span></div>}<div className="flex items-center gap-3 rounded-2xl border border-[#e2eae1] bg-white p-5"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#f4f7f2] text-[#6f8478]"><Check size={17} /></span><div><p className="text-[11px] font-bold text-ink">Vos données restent séparées</p><p className="mt-1 text-[10px] leading-4 text-[#849188]">Les transferts entre unités sont suivis par mouvements inter-unités.</p></div></div></section><p className="mt-10 text-center text-[10px] font-semibold text-[#9aa59f]">Vous pourrez changer d’espace depuis la barre supérieure du dashboard.</p>
  </div></main>;
}

function parseCookieArray(value: string | undefined): string[] {
  if (!value) return [];
  let current = value;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const parsed = JSON.parse(current) as unknown;
      return Array.isArray(parsed) ? parsed.map(String) : [];
    } catch {
      try { current = decodeURIComponent(current); } catch { return []; }
    }
  }
  return [];
}
