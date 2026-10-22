'use client';

import Link from 'next/link';
import { FormEvent, useState } from 'react';
import { ArrowLeft, Check, KeyRound, LockKeyhole, ShieldCheck, X } from 'lucide-react';

export function AccountPasswordView() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedback('');
    setError('');
    setSaving(true);
    try {
      const response = await fetch('/api/account/password', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ currentPassword, newPassword, confirmation }) });
      const data = await response.json() as { message?: string; error?: string };
      if (!response.ok) { setError(data.error ?? 'Impossible de modifier le mot de passe.'); return; }
      setCurrentPassword('');
      setNewPassword('');
      setConfirmation('');
      setFeedback(data.message ?? 'Mot de passe modifié.');
    } catch {
      setError('Le serveur est indisponible. Réessayez.');
    } finally {
      setSaving(false);
    }
  }

  return <div className="fade-in mx-auto max-w-[680px] space-y-6"><Link href="/mon-profil" className="inline-flex items-center gap-2 text-[11px] font-bold text-[#6c8176] hover:text-forest"><ArrowLeft size={14} /> Retour à mon profil</Link><div><p className="eyebrow mb-2">Sécurité du compte</p><h1 className="page-title">Changer le mot de passe</h1><p className="muted mt-2 text-[13px]">Modifiez uniquement le mot de passe de votre propre compte connecté.</p></div>{feedback && <div className="flex items-center gap-2 rounded-xl border border-[#cde8c7] bg-[#effaeb] px-4 py-3 text-[12px] font-semibold text-[#4d8f51]"><Check size={14} />{feedback}</div>}{error && <div className="flex items-center gap-2 rounded-xl border border-[#f2cecb] bg-[#fff4f3] px-4 py-3 text-[12px] font-semibold text-[#b85b59]"><X size={14} />{error}</div>}<section className="surface overflow-hidden"><div className="border-b border-[#edf0eb] px-6 py-5"><div className="flex items-center gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#f5f2fb] text-[#70578f]"><KeyRound size={20} /></span><div><h2 className="text-[16px] font-bold text-ink">Nouveau mot de passe</h2><p className="mt-1 text-[11px] text-[#89968f]">Minimum 8 caractères.</p></div></div></div><form onSubmit={submit} className="space-y-5 p-6"><label className="block"><span className="field-label">Mot de passe actuel</span><div className="relative"><LockKeyhole size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#89968f]" /><input type="password" autoComplete="current-password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} className="input-base pl-9" required /></div></label><label className="block"><span className="field-label">Nouveau mot de passe</span><input type="password" autoComplete="new-password" minLength={8} value={newPassword} onChange={(event) => setNewPassword(event.target.value)} className="input-base" required /></label><label className="block"><span className="field-label">Confirmer le nouveau mot de passe</span><input type="password" autoComplete="new-password" minLength={8} value={confirmation} onChange={(event) => setConfirmation(event.target.value)} className="input-base" required /></label><div className="flex items-start gap-2 rounded-xl border border-[#dce8db] bg-[#f5faf2] px-3.5 py-3 text-[10px] leading-4 text-[#5b8f60]"><ShieldCheck size={14} className="mt-0.5 shrink-0" />Votre nouveau mot de passe est vérifié et enregistré côté serveur.</div><div className="flex justify-end"><button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Modification…' : 'Modifier le mot de passe'}</button></div></form></section></div>;
}
