'use client';

import Image from 'next/image';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, Menu, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { PublicContactSection } from '@/components/public-contact-section';
import { DEFAULT_PUBLIC_SITE_CONTENT, type PublicSiteContent } from '@/lib/public-site';
import { FARM_STORAGE_KEYS, readLocal, subscribeToFarmData } from '@/lib/farm-storage';

type SavedPublicSiteContent = Partial<PublicSiteContent> & { heroImage?: string };
type SavedFooter = Partial<PublicSiteContent['footer']> & { address?: string; phone?: string };

function loadPublicSiteContent(): PublicSiteContent {
  const saved = readLocal<SavedPublicSiteContent>(FARM_STORAGE_KEYS.publicSiteContent, {});
  const heroImages = Array.isArray(saved.heroImages)
    ? saved.heroImages.filter(Boolean)
    : saved.heroImage
      ? [saved.heroImage]
      : DEFAULT_PUBLIC_SITE_CONTENT.heroImages;
  const savedFooter = (saved.footer ?? {}) as SavedFooter;
  const addresses = Array.isArray(savedFooter.addresses)
    ? savedFooter.addresses.filter(Boolean)
    : savedFooter.address
      ? [savedFooter.address]
      : DEFAULT_PUBLIC_SITE_CONTENT.footer.addresses;
  const phones = Array.isArray(savedFooter.phones)
    ? savedFooter.phones.filter(Boolean)
    : savedFooter.phone
      ? [savedFooter.phone]
      : DEFAULT_PUBLIC_SITE_CONTENT.footer.phones;

  return {
    ...DEFAULT_PUBLIC_SITE_CONTENT,
    ...saved,
    heroImages,
    activities: saved.activities ?? DEFAULT_PUBLIC_SITE_CONTENT.activities,
    commitments: saved.commitments ?? DEFAULT_PUBLIC_SITE_CONTENT.commitments,
    footer: {
      ...DEFAULT_PUBLIC_SITE_CONTENT.footer,
      ...savedFooter,
      addresses,
      phones,
    },
  };
}

export function PublicContactPage() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [siteContent, setSiteContent] = useState<PublicSiteContent>(DEFAULT_PUBLIC_SITE_CONTENT);

  useEffect(() => {
    const load = () => setSiteContent(loadPublicSiteContent());
    load();
    return subscribeToFarmData([FARM_STORAGE_KEYS.publicSiteContent], load);
  }, []);

  const logo = siteContent.logo || DEFAULT_PUBLIC_SITE_CONTENT.logo;
  const closeMenu = () => setMenuOpen(false);

  return (
    <main className="landing-page min-h-screen overflow-hidden bg-[#f6f7f2] text-ink">
      <header className="sticky top-0 z-50 border-b border-[#dfe9df] bg-white/95 shadow-[0_10px_30px_rgba(25,56,46,.08)] backdrop-blur-xl">
        <div className="mx-auto flex min-h-[76px] max-w-[1260px] items-center justify-between gap-4 px-4 sm:px-8 lg:px-12">
          <Link href="/" className="flex min-w-0 items-center gap-2.5" onClick={closeMenu}>
            <span className="relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-[14px] bg-white shadow-[0_8px_18px_rgba(91,157,91,.18)]">
              <Image src={logo} unoptimized={logo.startsWith('data:')} alt="Logo SCOOPS LE REVEIL" fill className="object-contain" sizes="44px" />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-[16px] font-black tracking-[-.055em] text-forest sm:text-[18px]">SCOOPS <span className="text-[#6baf65]">LE REVEIL</span></span>
              <span className="block text-[8px] font-bold uppercase tracking-[.18em] text-[#8b9891]">Société coopérative agricole</span>
            </span>
          </Link>

          <nav className="hidden items-center gap-7 lg:flex" aria-label="Navigation publique">
            <Link href="/" className="landing-nav-link">Accueil</Link>
            <Link href="/#activites" className="landing-nav-link">Nos activités</Link>
            <Link href="/#engagements" className="landing-nav-link">Nos engagements</Link>
            <Link href="/#organisation" className="landing-nav-link">Notre organisation</Link>
            <Link href="/contact" aria-current="page" className="font-extrabold text-[#5b9d5b]">Contact</Link>
          </nav>

          <div className="hidden items-center gap-2 sm:flex">
            <Link href="/commande" className="landing-login">Commander <ArrowRight size={14} /></Link>
            <Link href="/commande/suivre" className="landing-login">Suivre ma commande</Link>
          </div>
          <button type="button" className="landing-menu-btn sm:hidden" onClick={() => setMenuOpen((open) => !open)} aria-label={menuOpen ? 'Fermer le menu' : 'Ouvrir le menu'} aria-expanded={menuOpen}>
            {menuOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
        {menuOpen && (
          <div className="border-t border-[#edf0eb] bg-white px-4 pb-4 pt-2 sm:hidden">
            <nav className="mx-auto flex max-w-[1260px] flex-col gap-1" aria-label="Navigation mobile">
              <Link onClick={closeMenu} href="/" className="landing-mobile-link">Accueil</Link>
              <Link onClick={closeMenu} href="/#activites" className="landing-mobile-link">Nos activités</Link>
              <Link onClick={closeMenu} href="/#engagements" className="landing-mobile-link">Nos engagements</Link>
              <Link onClick={closeMenu} href="/#organisation" className="landing-mobile-link">Notre organisation</Link>
              <Link onClick={closeMenu} href="/contact" className="landing-mobile-link font-extrabold text-[#5b9d5b]">Contact</Link>
              <Link onClick={closeMenu} href="/commande" className="landing-mobile-cta">Commander en ligne <ArrowRight size={15} /></Link>
              <Link onClick={closeMenu} href="/commande/suivre" className="landing-mobile-link">Suivre ma commande</Link>
            </nav>
          </div>
        )}
      </header>

      <section className="bg-forest px-5 py-14 text-white sm:px-8 sm:py-16 lg:px-12 lg:py-20">
        <div className="mx-auto max-w-[1260px]">
          <Link href="/" className="inline-flex items-center gap-2 text-[11px] font-bold text-[#b9d4be] transition hover:text-[#a4eb91]"><ArrowLeft size={14} /> Retour à l’accueil</Link>
          <p className="landing-section-kicker mt-10 text-[#a4eb91]">Contact · SCOOPS LE REVEIL</p>
          <h1 className="mt-4 max-w-3xl text-[clamp(42px,7vw,82px)] font-bold leading-[.94] tracking-[-.075em]">Une question, un projet,<br /><span className="landing-serif text-[#e9975c]">échangeons ensemble.</span></h1>
          <p className="mt-6 max-w-2xl text-[15px] leading-7 text-[#b5cdbb]">Retrouvez les coordonnées de la coopérative et adressez votre demande à l’équipe de SCOOPS LE REVEIL. Chaque message est transmis pour suivi par notre administration.</p>
        </div>
      </section>

      <PublicContactSection footer={siteContent.footer} animate={false} />

      <footer className="border-t border-white/10 bg-[#19382e] px-5 py-10 text-white sm:px-8 lg:px-12">
        <div className="mx-auto flex max-w-[1260px] flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Link href="/" className="text-[16px] font-black tracking-[-.055em]">SCOOPS <span className="text-[#a4eb91]">LE REVEIL</span></Link>
            <p className="mt-2 text-[11px] text-[#b4c9ba]">{siteContent.footer.addresses[0] ?? 'Adresse à renseigner'}</p>
          </div>
          <div className="flex flex-wrap gap-4 text-[11px] font-bold text-[#b4c9ba]">
            <Link href="/" className="transition hover:text-[#a4eb91]">Accueil</Link>
            <Link href="/commande" className="transition hover:text-[#a4eb91]">Commander</Link>
            <Link href="/contact" className="text-[#a4eb91]">Contact</Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
