'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { BarChart3, Building2, ChevronLeft, ChevronRight, FileCog, Globe2, Inbox, LogOut, MailWarning, Menu, MessageCircle, PanelLeft, ShieldCheck, Truck, Users, X } from 'lucide-react';

const links = [
  { label: 'Vue d’ensemble', href: '/dashboard-admin', icon: BarChart3 },
  { label: 'Utilisateurs', href: '/dashboard-admin/utilisateurs', icon: Users },
  { label: 'Unités', href: '/dashboard-admin/unites', icon: Building2 },
  { label: 'Communication publique', href: '/dashboard-admin/communication', icon: Globe2 },
  { label: 'Messages de contact', href: '/dashboard-admin/messages-contact', icon: Inbox },
  { label: 'Messagerie', href: '/chat', icon: MessageCircle },
  { label: 'Commandes inter-unités globales', href: '/dashboard-admin/commandes', icon: Truck },
  { label: 'Courriers confidentiels', href: '/courriers-confidentiels', icon: MailWarning },
  { label: 'Réglages globaux', href: '/dashboard-admin/parametres', icon: FileCog },
];

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  useEffect(() => {
    if (pathname === '/dashboard-admin') {
      document.cookie = 'agroflux_active_unit=; path=/; max-age=0; samesite=lax';
      window.localStorage.removeItem('agroflux-active-unit');
    }
  }, [pathname]);
  async function logout() { await fetch('/api/auth/logout', { method: 'POST' }); window.location.assign('/connexion'); }
  return <div className="min-h-screen bg-[#f4f6f1] text-ink"><aside className={`fixed bottom-0 left-0 top-0 z-[100] flex w-[270px] flex-col bg-[#182f27] text-white shadow-xl transition-transform lg:translate-x-0 ${collapsed ? 'lg:w-[84px]' : ''} ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}><div className="flex h-[82px] items-center justify-between border-b border-white/10 px-5"><Link href="/dashboard-admin" className="flex min-w-0 items-center gap-3"><span className="relative flex h-10 w-10 shrink-0 overflow-hidden rounded-xl bg-white"><Image src="/scoops-le-reveil-logo.jpg" alt="SCOOPS LE REVEIL" fill className="object-contain" sizes="40px" /></span>{!collapsed && <span className="min-w-0"><strong className="block truncate text-[13px] font-black">ADMIN · MOVIC</strong><small className="mt-1 block text-[9px] uppercase tracking-[.16em] text-[#9cb5a6]">Contrôle du SaaS</small></span>}</Link><button className="hidden h-8 w-8 items-center justify-center rounded-lg text-[#a9c3b4] hover:bg-white/10 lg:flex" onClick={() => setCollapsed((current) => !current)} aria-label={collapsed ? 'Ouvrir la navigation' : 'Réduire la navigation'}>{collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}</button><button className="h-8 w-8 items-center justify-center rounded-lg text-[#a9c3b4] hover:bg-white/10 lg:hidden" onClick={() => setMobileOpen(false)} aria-label="Fermer"><X size={17} /></button></div><nav className="flex-1 space-y-1 overflow-y-auto px-3 py-6">{links.map(({ label, href, icon: Icon }) => <Link key={href} href={href} onClick={() => setMobileOpen(false)} title={collapsed ? label : undefined} className={`flex items-center gap-3 rounded-xl px-3 py-3 text-[12px] font-semibold transition ${collapsed ? 'justify-center' : ''} ${pathname === href || (href !== '/dashboard-admin' && pathname.startsWith(href)) ? 'bg-[#a4eb91] text-[#173b2c]' : 'text-[#b4cbbc] hover:bg-white/[.08] hover:text-white'}`}><Icon size={17} />{!collapsed && <span>{label}</span>}</Link>)}</nav><div className="border-t border-white/10 p-3">{!collapsed && <div className="mb-3 rounded-xl border border-[#a4eb91]/20 bg-[#a4eb91]/10 p-3 text-[10px] leading-4 text-[#cde7d0]"><ShieldCheck size={14} className="mb-2" />Accès réservé au compte administrateur principal MOVIC.</div>}<button onClick={logout} className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-[12px] font-semibold text-[#b4cbbc] hover:bg-white/[.08] hover:text-white ${collapsed ? 'justify-center' : ''}`} title="Se déconnecter"><LogOut size={16} />{!collapsed && 'Se déconnecter'}</button></div></aside>{mobileOpen && <button className="fixed inset-0 z-[90] bg-black/30 lg:hidden" onClick={() => setMobileOpen(false)} aria-label="Fermer la navigation" />}<main className={`min-h-screen transition-[margin] lg:ml-[270px] ${collapsed ? 'lg:ml-[84px]' : ''}`}><header className="sticky top-0 z-50 flex h-[82px] items-center justify-between border-b border-[#e1e8df] bg-[#f4f6f1]/90 px-5 backdrop-blur-xl sm:px-8"><div className="flex items-center gap-3"><button className="icon-btn h-9 w-9 lg:hidden" onClick={() => setMobileOpen(true)} aria-label="Ouvrir la navigation"><Menu size={17} /></button><div><p className="eyebrow">SCOOPS LE REVEIL · ADMINISTRATION</p><h1 className="mt-1 text-[15px] font-bold text-ink">Espace de contrôle du SaaS</h1></div></div><span className="rounded-full border border-[#cde2cb] bg-[#edf8e9] px-3 py-2 text-[10px] font-bold text-[#4d8f52]">MOVIC · Administrateur principal</span></header><div className="px-5 py-7 sm:px-8">{children}</div></main></div>;
}
