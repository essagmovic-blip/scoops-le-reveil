'use client';

import { FormEvent, useState } from 'react';
import { Check, Clock3, Mail, MapPin, Phone, Send, X } from 'lucide-react';
import type { PublicSiteContent } from '@/lib/public-site';

type ContactProps = { footer: PublicSiteContent['footer']; animate?: boolean };

export function PublicContactSection({ footer, animate = true }: ContactProps) {
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [sending, setSending] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    setSending(true);
    setFeedback(null);
    const form = new FormData(formElement);
    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: String(form.get('name') ?? ''),
          email: String(form.get('email') ?? ''),
          phone: String(form.get('phone') ?? ''),
          subject: String(form.get('subject') ?? ''),
          message: String(form.get('message') ?? ''),
        }),
      });
      const data = await response.json() as { error?: string };
      if (!response.ok) {
        setFeedback({ type: 'error', text: data.error ?? 'Impossible d’envoyer le message.' });
        return;
      }
      formElement.reset();
      setFeedback({ type: 'success', text: 'Votre message a bien été enregistré. L’équipe de SCOOPS LE REVEIL vous répondra dès que possible.' });
    } catch {
      setFeedback({ type: 'error', text: 'Le service est momentanément indisponible. Réessayez plus tard.' });
    } finally {
      setSending(false);
    }
  }
  const addresses = footer.addresses?.length ? footer.addresses : footer.address ? [footer.address] : [];
  const phones = footer.phones?.length ? footer.phones : footer.phone ? [footer.phone] : [];
  return <section id="contact" className={`${animate ? 'landing-reveal' : ''} landing-contact-section bg-[#f6f7f2] px-5 py-20 sm:px-8 lg:px-12 lg:py-28`}><div className="mx-auto max-w-[1260px]"><div className="grid gap-10 lg:grid-cols-[.82fr_1.18fr] lg:items-start"><div><p className="landing-section-kicker">Contact</p><h2 className="landing-section-title mt-4">Parlons de votre <em>projet agricole.</em></h2><p className="mt-5 max-w-md text-[14px] leading-7 text-[#66766d]">Une question sur un produit, un partenariat ou la coopérative ? Notre équipe vous répond depuis Yaoundé et ses unités opérationnelles.</p><div className="mt-8 space-y-3"><ContactInfo icon={MapPin} title="Nous trouver" values={addresses.length ? addresses : ['Adresse à renseigner']} /><ContactInfo icon={Phone} title="Nous appeler" values={phones.length ? phones.map((phone) => <a key={phone} href={`tel:${phone.replace(/[^+\d]/g, '')}`} className="block text-[#5b9d5b] hover:underline">{phone}</a>) : ['Téléphone à renseigner']} /><ContactInfo icon={Mail} title="Nous écrire" values={[footer.email ? <a key={footer.email} href={`mailto:${footer.email}`} className="text-[#6385bd] hover:underline">{footer.email}</a> : 'Email à renseigner']} /><ContactInfo icon={Clock3} title="Horaires" values={[footer.hours || 'Horaires à renseigner']} /></div></div><div className="grid gap-5 lg:grid-cols-[1fr_.85fr]"><form onSubmit={submit} className="surface space-y-5 p-6 sm:p-8"><div><p className="eyebrow">Écrivez-nous</p><h3 className="mt-2 text-[22px] font-black text-forest">Votre demande</h3></div>{feedback && <div className={`flex items-start gap-2 rounded-xl px-3.5 py-3 text-[11px] font-semibold ${feedback.type === 'success' ? 'border border-[#cde8c7] bg-[#effaeb] text-[#4d8f51]' : 'border border-[#f0c9c5] bg-[#fff4f3] text-[#b85b59]'}`}>{feedback.type === 'success' ? <Check size={14} /> : <X size={14} />}{feedback.text}</div>}<div className="grid gap-4 sm:grid-cols-2"><label className="block"><span className="field-label">Nom complet</span><input name="name" className="input-base" required /></label><label className="block"><span className="field-label">Email</span><input name="email" type="email" className="input-base" required /></label><label className="block"><span className="field-label">Téléphone</span><input name="phone" type="tel" className="input-base" /></label><label className="block"><span className="field-label">Sujet</span><select name="subject" className="input-base" required><option value="">Choisir un sujet</option><option>Question sur un produit</option><option>Devenir partenaire / fournisseur</option><option>Recrutement</option><option>Commande et livraison</option><option>Autre</option></select></label></div><label className="block"><span className="field-label">Message</span><textarea name="message" className="input-base min-h-[140px] resize-y" required placeholder="Écrivez votre message…" /></label><div className="flex justify-end"><button className="landing-primary-btn" type="submit" disabled={sending}>{sending ? 'Envoi en cours…' : <>Envoyer le message <Send size={15} /></>}</button></div></form><div className="overflow-hidden rounded-[26px] border border-[#dce8db] bg-white shadow-[0_14px_30px_rgba(25,56,46,.06)]"><div className="border-b border-[#edf0eb] p-5"><p className="eyebrow">Nous trouver</p><h3 className="mt-2 text-[17px] font-bold text-forest">Nos sites</h3></div>{footer.mapEmbedUrl ? <iframe title="Carte de SCOOPS LE REVEIL" src={footer.mapEmbedUrl} className="h-[330px] w-full border-0" loading="lazy" referrerPolicy="no-referrer-when-downgrade" /> : <div className="flex h-[330px] flex-col items-center justify-center bg-[#edf4eb] px-6 text-center"><MapPin size={28} className="text-[#5b9d5b]" /><p className="mt-3 text-[12px] font-bold text-[#477c4a]">Carte à configurer</p><p className="mt-2 text-[10px] leading-5 text-[#718078]">L’administrateur peut renseigner l’URL Google Maps depuis le CMS public.</p></div>}{addresses.length > 0 && <div className="space-y-2 border-t border-[#edf0eb] p-5">{addresses.map((address) => <p key={address} className="flex items-start gap-2 text-[11px] leading-5 text-[#66766d]"><MapPin size={14} className="mt-0.5 shrink-0 text-[#5b9d5b]" />{address}</p>)}</div>}</div></div></div></div></section>;
}

function ContactInfo({ icon: Icon, title, values }: { icon: typeof MapPin; title: string; values: React.ReactNode[] }) { return <div className="flex items-start gap-3 rounded-2xl border border-[#e3ebe1] bg-white p-4"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#edf8e9] text-[#5b9d5b]"><Icon size={16} /></span><div><p className="text-[10px] font-bold uppercase tracking-[.12em] text-[#89968f]">{title}</p><div className="mt-1 space-y-0.5 text-[12px] font-semibold leading-5 text-[#53675b]">{values.map((value, index) => <div key={index}>{value}</div>)}</div></div></div>; }
