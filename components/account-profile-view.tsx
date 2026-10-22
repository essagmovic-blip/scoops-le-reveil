'use client';

import Image from 'next/image';
import Link from 'next/link';
import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from 'react';
import { Camera, Check, KeyRound, Phone, Save, ShieldCheck, UserRound, X } from 'lucide-react';
import { units } from '@/lib/data';

export type AccountProfile = {
  id: string;
  name: string;
  identifier: string;
  role: string;
  allowedUnits: string[];
  unitLabels?: string[];
  access: string[];
  status: string;
  phone: string;
  profilePhoto: string;
};

export function AccountProfileView() {
  const [profile, setProfile] = useState<AccountProfile | null>(null);
  const [phone, setPhone] = useState('');
  const [photo, setPhoto] = useState('');
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let disposed = false;
    fetch('/api/account/profile', { cache: 'no-store' })
      .then(async (response) => {
        const data = await response.json() as { profile?: AccountProfile; error?: string };
        if (!response.ok || !data.profile) throw new Error(data.error ?? 'Impossible de charger votre profil.');
        if (!disposed) {
          setProfile(data.profile);
          setPhone(data.profile.phone ?? '');
          setPhoto(data.profile.profilePhoto ?? '');
        }
      })
      .catch((reason: unknown) => { if (!disposed) setError(reason instanceof Error ? reason.message : 'Impossible de charger votre profil.'); })
      .finally(() => { if (!disposed) setLoading(false); });
    return () => { disposed = true; };
  }, []);

  const initials = useMemo(() => profile?.name.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase() || 'AG', [profile?.name]);
  const unitLabels = profile?.unitLabels?.length ? profile.unitLabels : profile?.allowedUnits?.length ? profile.allowedUnits.map((id) => units.find((unit) => unit.id === id)?.label ?? id) : ['Toutes les unités'];

  async function selectPhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) { setError('Sélectionnez une image.'); return; }
    if (file.size > 2 * 1024 * 1024) { setError('La photo ne doit pas dépasser 2 Mo.'); return; }
    try {
      setPhoto(await fileToDataUrl(file));
      setError('');
    } catch {
      setError('La photo n’a pas pu être chargée.');
    }
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!profile) return;
    setSaving(true);
    setError('');
    setFeedback('');
    try {
      const response = await fetch('/api/account/profile', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone: phone.trim(), profilePhoto: photo }) });
      const data = await response.json() as { profile?: AccountProfile; error?: string };
      if (!response.ok || !data.profile) { setError(data.error ?? 'Impossible d’enregistrer votre profil.'); return; }
      setProfile(data.profile);
      setPhone(data.profile.phone ?? '');
      setPhoto(data.profile.profilePhoto ?? '');
      window.dispatchEvent(new CustomEvent('agroflux-profile-updated', { detail: data.profile }));
      setFeedback('Vos informations de contact ont été enregistrées.');
    } catch {
      setError('Le serveur est indisponible. Réessayez.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="mx-auto max-w-[920px] py-10 text-center text-[12px] text-[#89968f]">Chargement de votre profil…</div>;
  if (!profile) return <div className="mx-auto max-w-[920px] rounded-2xl border border-[#f2cecb] bg-[#fff4f3] p-5 text-[12px] font-semibold text-[#b85b59]">{error || 'Profil indisponible.'}</div>;

  return <div className="fade-in mx-auto max-w-[920px] space-y-6"><div><p className="eyebrow mb-2">Compte connecté</p><h1 className="page-title">Mon profil</h1><p className="muted mt-2 max-w-2xl text-[13px]">Consultez vos droits AgroFlux et maintenez vos coordonnées de contact à jour.</p></div>{feedback && <div className="flex items-center gap-2 rounded-xl border border-[#cde8c7] bg-[#effaeb] px-4 py-3 text-[12px] font-semibold text-[#4d8f51]"><Check size={14} />{feedback}</div>}{error && <div className="flex items-center gap-2 rounded-xl border border-[#f2cecb] bg-[#fff4f3] px-4 py-3 text-[12px] font-semibold text-[#b85b59]"><X size={14} />{error}</div>}<div className="grid gap-5 lg:grid-cols-[280px_minmax(0,1fr)]"><section className="surface p-6"><div className="flex flex-col items-center text-center"><div className="relative flex h-28 w-28 items-center justify-center overflow-hidden rounded-full bg-[#e9ba83] text-[30px] font-black text-forest ring-4 ring-[#f4faf1]">{photo ? <Image src={photo} alt={`Photo de ${profile.name}`} fill unoptimized className="object-cover" sizes="112px" /> : initials}</div><p className="mt-4 text-[16px] font-black text-forest">{profile.name}</p><p className="mt-1 text-[11px] text-[#718078]">{profile.role}</p><span className="mt-3 rounded-full bg-[#edf8e9] px-3 py-1 text-[10px] font-bold text-[#5b9d5b]">{profile.status}</span><label className="btn-secondary mt-5 w-full cursor-pointer justify-center text-[11px]"><Camera size={14} /> {photo ? 'Remplacer la photo' : 'Ajouter une photo'}<input type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="hidden" onChange={(event) => void selectPhoto(event)} /></label>{photo && <button type="button" className="mt-2 text-[10px] font-bold text-[#b45d5d] hover:underline" onClick={() => setPhoto('')}>Supprimer la photo</button>}</div><div className="mt-6 border-t border-[#edf0eb] pt-5"><Link href="/mon-profil/mot-de-passe" className="quick-action"><KeyRound size={15} /> Changer le mot de passe <span>›</span></Link></div></section><section className="surface overflow-hidden"><div className="border-b border-[#edf0eb] px-6 py-5"><div className="flex items-center gap-2"><ShieldCheck size={17} className="text-[#5b9d5b]" /><h2 className="text-[16px] font-bold text-ink">Informations du compte</h2></div><p className="mt-1 text-[11px] text-[#89968f]">Les informations d’identité et les droits sont gérés par l’Administrateur.</p></div><form onSubmit={save} className="space-y-6 p-6"><div className="grid gap-4 sm:grid-cols-2"><ReadOnlyField label="Nom complet" value={profile.name} /><ReadOnlyField label="Identifiant de connexion" value={profile.identifier} /><ReadOnlyField label="Rôle" value={profile.role} /><ReadOnlyField label="Statut" value={profile.status} /></div><div><span className="field-label">Unités autorisées</span><div className="mt-2 flex flex-wrap gap-2">{unitLabels.map((label) => <span key={label} className="rounded-full bg-[#edf3ff] px-2.5 py-1.5 text-[10px] font-bold text-[#6385bd]">{label}</span>)}</div></div><div><span className="field-label">Droits d’accès</span><div className="mt-2 flex flex-wrap gap-2">{profile.access.length ? profile.access.map((right) => <span key={right} className="rounded-full bg-[#f5f2fb] px-2.5 py-1.5 text-[10px] font-semibold text-[#70578f]">{right}</span>) : <span className="text-[11px] text-[#89968f]">Aucun droit complémentaire</span>}</div></div><div className="border-t border-[#edf0eb] pt-5"><label className="block"><span className="field-label">Numéro de téléphone</span><div className="relative"><Phone size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#89968f]" /><input value={phone} onChange={(event) => setPhone(event.target.value)} className="input-base pl-9" placeholder="+237 6…" maxLength={40} /></div><span className="mt-1 block text-[10px] text-[#89968f]">Utilisé pour vous joindre au sujet des notifications AgroFlux.</span></label></div><div className="flex justify-end"><button type="submit" className="btn-primary" disabled={saving}><Save size={15} /> {saving ? 'Enregistrement…' : 'Enregistrer mes coordonnées'}</button></div></form></section></div><div className="rounded-xl border border-[#dce8db] bg-[#f5faf2] px-4 py-3 text-[11px] leading-5 text-[#5b8f60]"><UserRound size={14} className="mr-2 inline-block" />Le nom, l’identifiant, le rôle, les unités et les droits ne sont pas modifiables depuis cet espace.</div></div>;
}

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return <div><span className="field-label">{label}</span><div className="mt-1 rounded-xl border border-[#edf0eb] bg-[#f8faf7] px-3.5 py-3 text-[12px] font-semibold text-[#53675b]">{value || 'Non renseigné'}</div></div>;
}

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('Photo illisible'));
    reader.onerror = () => reject(reader.error ?? new Error('Photo illisible'));
    reader.readAsDataURL(file);
  });
}
