'use client';

import Image from 'next/image';
import { FormEvent, useState } from 'react';
import { ArrowRight, Eye, EyeOff, LockKeyhole, ShieldCheck, UserRound } from 'lucide-react';

export function LoginView() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error ?? 'Impossible de vous connecter.');
        return;
      }
      window.location.assign(data.redirect ?? '/selection-unite');
    } catch {
      setError('Le serveur est indisponible. Vérifiez votre connexion et réessayez.');
    } finally {
      setLoading(false);
    }
  }

  return <main className="flex min-h-screen bg-[#f6f7f2] text-ink"><section className="relative hidden min-h-screen flex-1 overflow-hidden bg-forest lg:flex"><div className="absolute -right-36 -top-36 h-[500px] w-[500px] rounded-full border-[70px] border-[#a4eb91]/10" /><div className="absolute -bottom-44 -left-24 h-[440px] w-[440px] rounded-full border-[44px] border-[#e9975c]/10" /><div className="relative z-10 flex h-full flex-col justify-between p-12 xl:p-16"><div className="flex items-center gap-3"><span className="relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-[14px] bg-white shadow-[0_8px_18px_rgba(0,0,0,.12)]"><Image src="/scoops-le-reveil-logo.jpg" alt="Logo SCOOPS LE REVEIL" fill className="object-contain" sizes="48px" /></span><span><span className="block text-[19px] font-black tracking-[-.055em] text-white">SCOOPS <span className="text-[#a4eb91]">LE REVEIL</span></span><span className="block text-[8px] font-bold uppercase tracking-[.18em] text-[#9bb4a4]">Société coopérative agricole</span></span></div><div className="max-w-[500px]"><p className="eyebrow text-[#a4eb91]">Espace sécurisé</p><h1 className="mt-5 text-[56px] font-bold leading-[.94] tracking-[-.07em] text-white xl:text-[70px]">Votre ferme,<br /><span className="landing-serif text-[#e9975c]">au même endroit.</span></h1><p className="mt-6 max-w-md text-[14px] leading-7 text-[#acc4b3]">Retrouvez vos unités, vos stocks, vos productions et vos mouvements dans une vue claire et maîtrisée.</p><div className="mt-8 flex items-center gap-3 text-[11px] font-bold text-[#c7dbca]"><span className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/10 text-[#a4eb91]"><ShieldCheck size={16} /></span>Données séparées par unité · FCFA natif</div></div><p className="text-[10px] font-semibold text-[#7f9d8c]">© 2026 SCOOPS LE REVEIL</p></div></section><section className="relative flex w-full flex-col justify-center px-5 py-10 sm:px-10 lg:max-w-[540px] lg:px-16 xl:max-w-[590px]"><div className="mx-auto w-full max-w-[390px]"><div className="mb-8 lg:hidden"><span className="relative flex h-12 w-12 items-center justify-center overflow-hidden rounded-[14px] bg-white shadow-[0_8px_18px_rgba(91,157,91,.18)]"><Image src="/scoops-le-reveil-logo.jpg" alt="Logo SCOOPS LE REVEIL" fill className="object-contain" sizes="48px" /></span><p className="mt-3 text-[19px] font-black tracking-[-.055em] text-forest">SCOOPS <span className="text-[#6baf65]">LE REVEIL</span></p></div><p className="eyebrow mb-3">Connexion administrateur</p><h2 className="text-[32px] font-bold tracking-[-.06em] text-forest">Bienvenue dans votre espace.</h2><p className="muted mt-3 text-[13px] leading-6">Connectez-vous pour accéder au pilotage de vos unités.</p><form onSubmit={handleSubmit} className="mt-8 space-y-5"><label className="block"><span className="field-label">Identifiant</span><div className="relative"><UserRound size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#9aa69f]" /><input className="input-base h-12 rounded-xl bg-white pl-11" value={username} onChange={(event) => setUsername(event.target.value)} placeholder="Votre identifiant" autoComplete="username" required /></div></label><label className="block"><span className="field-label">Mot de passe</span><div className="relative"><LockKeyhole size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#9aa69f]" /><input className="input-base h-12 rounded-xl bg-white pl-11 pr-11" type={showPassword ? 'text' : 'password'} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Votre mot de passe" autoComplete="current-password" required /><button type="button" className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#87958d] hover:text-forest" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}>{showPassword ? <EyeOff size={16} /> : <Eye size={16} />}</button></div></label>{error && <div className="rounded-xl border border-[#f2cecb] bg-[#fff4f3] px-3.5 py-3 text-[11px] font-semibold leading-5 text-[#b85b59]">{error}</div>}<button type="submit" className="btn-primary h-12 w-full rounded-xl" disabled={loading}>{loading ? 'Connexion en cours…' : <>Se connecter <ArrowRight size={16} /></>}</button></form><div className="mt-7 flex items-start gap-2 rounded-xl border border-[#e1eae0] bg-white p-3.5"><ShieldCheck size={15} className="mt-0.5 shrink-0 text-[#5a9d5b]" /><p className="text-[10px] leading-4 text-[#77877c]">Votre session est protégée. Les identifiants sont vérifiés côté serveur et ne sont pas affichés dans l’interface.</p></div></div></section></main>;
}
