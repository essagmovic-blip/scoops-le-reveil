'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Activity, AlertTriangle, ArrowLeft, ArrowLeftRight, BarChart3, Bell, Boxes, ChevronDown, ChevronLeft, ChevronRight,
  CalendarDays, CircleDollarSign, ClipboardList, CreditCard, FileText, FlaskConical, HeartPulse, Home, Leaf, Menu, Package, PanelLeft,
  Inbox, KeyRound, LogOut, MailWarning, MessageCircle, Plus, Receipt, Search, Settings, ShoppingCart, Sparkles, Sprout, Store, Truck, UserRound, Users, Wheat, QrCode,
  X, Droplets, PawPrint, ShieldCheck, WalletCards, Factory, Wrench,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { units, type UnitId } from '@/lib/data';
import { FARM_STORAGE_KEYS, readLocal, subscribeToFarmData, writeLocal } from '@/lib/farm-storage';
import { accessForNavigation, hasAccessToRequirements, unitForNavigation, unitFromPath } from '@/lib/route-access';
import { normalizeAllowedUnits } from '@/lib/user-access';
import { activePoultryCategoryAssignment, addDaysIso, currentServiceDate, DEFAULT_DAILY_TASK_SETTINGS, poultryTaskPhase, shiftForEmployee, todayIso, type DailyTaskRosterEntry, type DailyTaskUnitId, type PoultryCategoryAssignment } from '@/lib/daily-tasks';

type NotificationItem = { id: string; title: string; detail: string; href: string; tone: 'orange' | 'blue' | 'green' };
type SessionProfile = { name: string; role: string; initials: string; identifier: string; phone: string; profilePhoto: string; allowedUnits: UnitId[]; access: string[]; status: string };
type ProfileUpdatedDetail = Partial<Pick<SessionProfile, 'name' | 'role' | 'identifier' | 'phone' | 'profilePhoto' | 'allowedUnits' | 'access' | 'status'>>;

const navigation: { label: string; items: { label: string; href: string; icon: LucideIcon; badge?: string }[] }[] = [
  { label: 'Pilotage', items: [
    { label: 'Vue d’ensemble', href: '/dashboard', icon: Home },
    { label: 'Rapports', href: '/rapports', icon: BarChart3 },
  ] },
  { label: 'Opérations', items: [
    { label: 'Élevage de poulets bio', href: '/poulets', icon: PawPrint },
    { label: 'Chèvrerie', href: '/chevrerie', icon: Sprout },
    { label: 'Provenderie', href: '/provenderie', icon: Wheat },
    { label: 'Produits bio', href: '/produits-bio', icon: FlaskConical },
    { label: 'Pressoir à huile', href: '/pressoir', icon: Droplets },
    { label: 'Magasin & stocks', href: '/stocks', icon: Boxes, badge: '2' },
    { label: 'RH & administration', href: '/rh', icon: Users },
    { label: 'Mouvements inter-unités', href: '/mouvements', icon: ArrowLeftRight },
  ] },
  { label: 'Commerce', items: [
    { label: 'Ventes & factures', href: '/factures', icon: Receipt },
    { label: 'Commandes clients', href: '/commandes-clients', icon: Package },
    { label: 'Scanner livraison QR', href: '/commandes-clients/scanner', icon: QrCode },
    { label: 'Courriers confidentiels', href: '/courriers-confidentiels', icon: MailWarning },
    { label: 'Clients', href: '/clients', icon: Users },
    { label: 'Fournisseurs', href: '/fournisseurs', icon: Truck },
    { label: 'Messagerie privée', href: '/chat', icon: MessageCircle },
    { label: 'Achats', href: '/achats', icon: ShoppingCart },
    { label: 'Dépenses', href: '/depenses', icon: WalletCards },
    { label: 'Caisse & comptabilité', href: '/caisse', icon: CircleDollarSign },
  ] },
];

const provenderieNavigation: { label: string; items: { label: string; href: string; icon: LucideIcon; badge?: string }[] }[] = [
  { label: 'Provenderie', items: [
    { label: 'Dashboard provenderie', href: '/dashboard/provenderie', icon: Home },
    { label: 'Tâches quotidiennes', href: '/provenderie/taches', icon: ClipboardList },
    { label: 'Recettes', href: '/provenderie/recettes', icon: Wheat },
    { label: 'Matières premières', href: '/provenderie/matieres', icon: Boxes },
    { label: 'Productions', href: '/provenderie/productions', icon: Factory },
    { label: 'Stock aliments finis', href: '/provenderie/stocks', icon: Package },
    { label: 'Mouvements inter-unités', href: '/mouvements/provenderie', icon: ArrowLeftRight },
    { label: 'Commandes inter-unités', href: '/mouvements/commandes/provenderie', icon: Truck },
    { label: 'Articles confiés', href: '/stocks/attributions/provenderie', icon: ClipboardList },
  ] },
  { label: 'Contacts de l’unité', items: [
    { label: 'Clients provenderie', href: '/clients/provenderie', icon: Users },
    { label: 'Commandes clients', href: '/commandes-clients', icon: Package },
    { label: 'Scanner livraison QR', href: '/commandes-clients/scanner', icon: QrCode },
    { label: 'Courriers confidentiels', href: '/courriers-confidentiels', icon: MailWarning },
    { label: 'Fournisseurs provenderie', href: '/fournisseurs/provenderie', icon: Truck },
    { label: 'Messagerie privée', href: '/chat/provenderie', icon: MessageCircle },
  ] },
  { label: 'Finance', items: [
    { label: 'Factures provenderie', href: '/factures/provenderie', icon: Receipt },
    { label: 'Dépenses provenderie', href: '/depenses/provenderie', icon: WalletCards },
    { label: 'Caisse provenderie', href: '/caisse/provenderie', icon: CircleDollarSign },
    { label: 'Comptabilité provenderie', href: '/comptabilite/provenderie', icon: FileText },
    { label: 'Rapports provenderie', href: '/rapports/provenderie', icon: BarChart3 },
  ] },
];

const bioNavigation: { label: string; items: { label: string; href: string; icon: LucideIcon; badge?: string }[] }[] = [
  { label: 'Produits bio', items: [
    { label: 'Dashboard produits bio', href: '/dashboard/bio', icon: Home },
    { label: 'Tâches quotidiennes', href: '/produits-bio/taches', icon: ClipboardList },
    { label: 'Préparations bio', href: '/produits-bio/recettes', icon: FlaskConical },
    { label: 'Plantes naturelles', href: '/produits-bio/matieres', icon: Sprout },
    { label: 'Productions', href: '/produits-bio/productions', icon: Factory },
    { label: 'Stock produits bio', href: '/produits-bio/stocks', icon: Package },
    { label: 'Mouvements inter-unités', href: '/mouvements/bio', icon: ArrowLeftRight },
    { label: 'Commandes inter-unités', href: '/mouvements/commandes/bio', icon: Truck },
    { label: 'Articles confiés', href: '/stocks/attributions/bio', icon: ClipboardList },
  ] },
  { label: 'Contacts de l’unité', items: [
    { label: 'Clients produits bio', href: '/clients/bio', icon: Users },
    { label: 'Commandes clients', href: '/commandes-clients', icon: Package },
    { label: 'Scanner livraison QR', href: '/commandes-clients/scanner', icon: QrCode },
    { label: 'Courriers confidentiels', href: '/courriers-confidentiels', icon: MailWarning },
    { label: 'Fournisseurs produits bio', href: '/fournisseurs/bio', icon: Truck },
    { label: 'Messagerie privée', href: '/chat/bio', icon: MessageCircle },
  ] },
  { label: 'Finance', items: [
    { label: 'Factures produits bio', href: '/factures/bio', icon: Receipt },
    { label: 'Dépenses produits bio', href: '/depenses/bio', icon: WalletCards },
    { label: 'Caisse produits bio', href: '/caisse/bio', icon: CircleDollarSign },
    { label: 'Comptabilité produits bio', href: '/comptabilite/bio', icon: FileText },
    { label: 'Rapports produits bio', href: '/rapports/bio', icon: BarChart3 },
  ] },
];

const pressoirNavigation: { label: string; items: { label: string; href: string; icon: LucideIcon; badge?: string }[] }[] = [
  { label: 'Pressoir à huile', items: [
    { label: 'Dashboard pressoir', href: '/dashboard/pressoir', icon: Home },
    { label: 'Tâches quotidiennes', href: '/pressoir/taches', icon: ClipboardList },
    { label: 'Recettes de pressage', href: '/pressoir/recettes', icon: Droplets },
    { label: 'Graines à presser', href: '/pressoir/matieres', icon: Wheat },
    { label: 'Lots de pressage', href: '/pressoir/productions', icon: Factory },
    { label: 'Stock huile et tourteaux', href: '/pressoir/stocks', icon: Package },
    { label: 'Mouvements inter-unités', href: '/mouvements/pressoir', icon: ArrowLeftRight },
    { label: 'Commandes inter-unités', href: '/mouvements/commandes/pressoir', icon: Truck },
    { label: 'Articles confiés', href: '/stocks/attributions/pressoir', icon: ClipboardList },
  ] },
  { label: 'Contacts de l’unité', items: [
    { label: 'Clients pressoir', href: '/clients/pressoir', icon: Users },
    { label: 'Commandes clients', href: '/commandes-clients', icon: Package },
    { label: 'Scanner livraison QR', href: '/commandes-clients/scanner', icon: QrCode },
    { label: 'Courriers confidentiels', href: '/courriers-confidentiels', icon: MailWarning },
    { label: 'Fournisseurs pressoir', href: '/fournisseurs/pressoir', icon: Truck },
    { label: 'Messagerie privée', href: '/chat/pressoir', icon: MessageCircle },
  ] },
  { label: 'Finance', items: [
    { label: 'Factures pressoir', href: '/factures/pressoir', icon: Receipt },
    { label: 'Dépenses pressoir', href: '/depenses/pressoir', icon: WalletCards },
    { label: 'Caisse pressoir', href: '/caisse/pressoir', icon: CircleDollarSign },
    { label: 'Comptabilité pressoir', href: '/comptabilite/pressoir', icon: FileText },
    { label: 'Rapports pressoir', href: '/rapports/pressoir', icon: BarChart3 },
  ] },
];

const centralStoreNavigation: { label: string; items: { label: string; href: string; icon: LucideIcon; badge?: string }[] }[] = [
  { label: 'Magasin central', items: [
    { label: 'Dashboard magasin', href: '/dashboard/stocks', icon: Home },
    { label: 'Tâches quotidiennes', href: '/stocks/taches', icon: ClipboardList },
    { label: 'Stock central', href: '/stocks/central', icon: Boxes },
    { label: 'Machines agricoles', href: '/stocks/machines', icon: Wrench },
    { label: 'Mouvements magasin', href: '/stocks/mouvements', icon: ArrowLeftRight },
    { label: 'Articles confiés', href: '/stocks/attributions/stocks', icon: ClipboardList },
    { label: 'Mouvements inter-unités', href: '/mouvements/stocks', icon: ArrowLeftRight },
    { label: 'Commandes inter-unités', href: '/mouvements/commandes/stocks', icon: Truck },
    { label: 'Inventaire général', href: '/stocks/inventaire', icon: ClipboardList },
  ] },
  { label: 'Contacts de l’unité', items: [
    { label: 'Clients magasin', href: '/clients/stocks', icon: Users },
    { label: 'Commandes clients', href: '/commandes-clients', icon: Package },
    { label: 'Scanner livraison QR', href: '/commandes-clients/scanner', icon: QrCode },
    { label: 'Courriers confidentiels', href: '/courriers-confidentiels', icon: MailWarning },
    { label: 'Fournisseurs magasin', href: '/fournisseurs/stocks', icon: Truck },
    { label: 'Messagerie privée', href: '/chat/stocks', icon: MessageCircle },
  ] },
  { label: 'Finance', items: [
    { label: 'Factures magasin', href: '/factures/stocks', icon: Receipt },
    { label: 'Dépenses magasin', href: '/depenses/stocks', icon: WalletCards },
    { label: 'Caisse magasin', href: '/caisse/stocks', icon: CircleDollarSign },
    { label: 'Comptabilité magasin', href: '/comptabilite/stocks', icon: FileText },
    { label: 'Rapports magasin', href: '/rapports/stocks', icon: BarChart3 },
  ] },
];

const goatNavigation: { label: string; items: { label: string; href: string; icon: LucideIcon; badge?: string }[] }[] = [
  { label: 'Chèvrerie', items: [
    { label: 'Dashboard chèvrerie', href: '/dashboard/chevrerie', icon: Home },
    { label: 'Tâches quotidiennes', href: '/chevrerie/taches', icon: ClipboardList },
    { label: 'Animaux', href: '/chevrerie/animaux', icon: Sprout },
    { label: 'Reproduction', href: '/chevrerie/reproduction', icon: PawPrint },
    { label: 'Santé du cheptel', href: '/chevrerie/sante', icon: ShieldCheck },
    { label: 'Alimentation & rations', href: '/chevrerie/alimentation', icon: Wheat },
    { label: 'Productions', href: '/chevrerie/productions', icon: Factory },
    { label: 'Stock produits', href: '/chevrerie/stocks', icon: Package },
    { label: 'Mouvements inter-unités', href: '/mouvements/chevrerie', icon: ArrowLeftRight },
    { label: 'Commandes inter-unités', href: '/mouvements/commandes/chevrerie', icon: Truck },
    { label: 'Articles confiés', href: '/stocks/attributions/chevrerie', icon: ClipboardList },
  ] },
  { label: 'Contacts de l’unité', items: [
    { label: 'Clients chèvrerie', href: '/clients/chevrerie', icon: Users },
    { label: 'Commandes clients', href: '/commandes-clients', icon: Package },
    { label: 'Scanner livraison QR', href: '/commandes-clients/scanner', icon: QrCode },
    { label: 'Courriers confidentiels', href: '/courriers-confidentiels', icon: MailWarning },
    { label: 'Fournisseurs chèvrerie', href: '/fournisseurs/chevrerie', icon: Truck },
    { label: 'Messagerie privée', href: '/chat/chevrerie', icon: MessageCircle },
  ] },
  { label: 'Finance', items: [
    { label: 'Factures chèvrerie', href: '/factures/chevrerie', icon: Receipt },
    { label: 'Dépenses chèvrerie', href: '/depenses/chevrerie', icon: WalletCards },
    { label: 'Caisse chèvrerie', href: '/caisse/chevrerie', icon: CircleDollarSign },
    { label: 'Comptabilité chèvrerie', href: '/comptabilite/chevrerie', icon: FileText },
    { label: 'Rapports chèvrerie', href: '/rapports/chevrerie', icon: BarChart3 },
  ] },
];

const rhNavigation: { label: string; items: { label: string; href: string; icon: LucideIcon; badge?: string }[] }[] = [
  { label: 'RH & administration', items: [
    { label: 'Dashboard RH', href: '/dashboard/rh', icon: Home },
    { label: 'Tâches quotidiennes', href: '/rh/taches', icon: ClipboardList },
    { label: 'Rapports de service', href: '/rh/rapports-service', icon: FileText },
    { label: 'Poulets morts · Validation RH', href: '/rh/dago', icon: ShieldCheck },
    { label: 'Santé et traitement', href: '/rh/sante', icon: HeartPulse },
    { label: 'Personnel', href: '/rh/personnel', icon: Users },
    { label: 'Présences', href: '/rh/presences', icon: ClipboardList },
    { label: 'Congés & permissions', href: '/rh/conges', icon: CalendarDays },
    { label: 'Paie & paiements', href: '/rh/paie', icon: WalletCards },
    { label: 'Documents administratifs', href: '/rh/documents', icon: FileText },
  ] },
  { label: 'Communication', items: [
    { label: 'Courriers confidentiels', href: '/courriers-confidentiels', icon: MailWarning },
    { label: 'Messages de contact', href: '/rh/messages-contact', icon: Inbox },
    { label: 'Messagerie privée', href: '/chat/rh', icon: MessageCircle },
  ] },
  { label: 'Pilotage RH', items: [
    { label: 'Rapports RH', href: '/rapports/rh', icon: BarChart3 },
  ] },
];

const farmNavigation: { label: string; items: { label: string; href: string; icon: LucideIcon; badge?: string }[] }[] = [
  { label: 'Élevage de poulets bio', items: [
    { label: 'Dashboard ferme', href: '/dashboard/poulets', icon: Home },
    { label: 'Tâches quotidiennes', href: '/poulets/taches', icon: ClipboardList },
    { label: 'Poulets morts', href: '/poulets/dago', icon: ShieldCheck },
    { label: 'Bandes', href: '/poulets/bandes', icon: PawPrint },
    { label: 'Bâtiments', href: '/poulets/batiments', icon: Boxes },
    { label: 'Suivi quotidien', href: '/poulets/suivi', icon: ClipboardList },
    { label: 'Santé et traitement', href: '/poulets/sante', icon: ShieldCheck },
    { label: 'Statistiques', href: '/poulets/statistiques', icon: BarChart3 },
  ] },
  { label: 'Finance', items: [
    { label: 'Ventes & factures', href: '/factures/ferme', icon: Receipt },
    { label: 'Dépenses ferme', href: '/depenses/ferme', icon: WalletCards },
    { label: 'Caisse & comptabilité', href: '/caisse/ferme', icon: CircleDollarSign },
    { label: 'Comptabilité', href: '/comptabilite/ferme', icon: FileText },
    { label: 'Rapports financiers', href: '/rapports/ferme', icon: BarChart3 },
  ] },
  { label: 'Gestion de l’unité', items: [
    { label: 'Articles confiés', href: '/stocks/attributions/poulets', icon: ClipboardList },
    { label: 'Transferts internes', href: '/poulets/transferts', icon: ArrowLeftRight },
    { label: 'Mouvements inter-unités', href: '/mouvements/ferme', icon: ArrowLeftRight },
    { label: 'Commandes inter-unités', href: '/mouvements/commandes/poulets', icon: Truck },
    { label: 'Articles de la ferme', href: '/stocks/ferme', icon: Boxes },
  ] },
  { label: 'Contacts de l’unité', items: [
    { label: 'Clients ferme', href: '/clients/poulets', icon: Users },
    { label: 'Commandes clients', href: '/commandes-clients', icon: Package },
    { label: 'Scanner livraison QR', href: '/commandes-clients/scanner', icon: QrCode },
    { label: 'Courriers confidentiels', href: '/courriers-confidentiels', icon: MailWarning },
    { label: 'Fournisseurs ferme', href: '/fournisseurs/poulets', icon: Truck },
    { label: 'Messagerie privée', href: '/chat/poulets', icon: MessageCircle },
  ] },
];

function Logo({ compact = false }: { compact?: boolean }) {
  return <Link href="/dashboard" className={`flex items-center gap-3 ${compact ? 'justify-center' : ''}`}>
    <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-[12px] bg-[#a4eb91] text-forest shadow-[0_7px_16px_rgba(0,0,0,.15)]">
      <Leaf size={19} strokeWidth={2.6} />
      <span className="absolute bottom-[7px] right-[7px] h-1.5 w-1.5 rounded-full bg-forest" />
    </span>
    {!compact && <span className="leading-none"><span className="block text-[17px] font-black tracking-[-.06em] text-white">agro<span className="text-[#9be789]">flux</span></span><span className="mt-1 block text-[8px] font-bold uppercase tracking-[.18em] text-[#9bb1a4]">Gestion intégrée</span></span>}
  </Link>;
}

function ProfileAvatar({ photo, initials, className }: { photo?: string; initials: string; className: string }) {
  return <span className={`relative flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#e9ba83] font-black text-forest ${className}`}>{photo ? <Image src={photo} alt="Photo de profil" fill unoptimized className="object-cover" sizes="48px" /> : initials}</span>;
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);
  const [farmNotifications, setFarmNotifications] = useState({ lowStock: 0, pendingFollowUps: 0, payments: 0, interUnit: 0 });
  const [notificationItems, setNotificationItems] = useState<NotificationItem[]>([]);
  const [rubricNotificationCounts, setRubricNotificationCounts] = useState<Record<string, number>>({});
  const [rubricNotificationIds, setRubricNotificationIds] = useState<Record<string, string[]>>({});
  const rubricCountsRef = useRef<Record<string, number>>({});
  const rubricIdsRef = useRef<Record<string, string[]>>({});
  const previousRubricCountsRef = useRef<Record<string, number> | null>(null);
  const notificationSoundReadyRef = useRef(false);
  const notificationSoundReadyTimerRef = useRef<number | null>(null);
  const notificationSoundRef = useRef<HTMLAudioElement | null>(null);
  const notificationSoundTimerRef = useRef<number | null>(null);
  const [queryUnitId, setQueryUnitId] = useState<UnitId | undefined>(undefined);
  const [sessionProfile, setSessionProfile] = useState<SessionProfile>({ name: 'MOVIC', role: 'Administratrice', initials: 'MV', identifier: 'MOVIC', phone: '', profilePhoto: '', allowedUnits: [], access: [], status: 'Actif' });
  const [sessionAllowedUnits, setSessionAllowedUnits] = useState<UnitId[]>([]);
  const [sessionAccess, setSessionAccess] = useState<string[]>([]);
  const [sessionAdmin, setSessionAdmin] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);

  useEffect(() => {
    const queryUnit = new URLSearchParams(window.location.search).get('unit');
    const cookieMap = Object.fromEntries(document.cookie.split('; ').filter(Boolean).map((part) => { const index = part.indexOf('='); return [part.slice(0, index), decodeURIComponent(part.slice(index + 1))]; }));
    const cookieUnit = cookieMap.agroflux_active_unit;
    const isAdmin = cookieMap.agroflux_is_admin === '1';
    const isUnit = (value: string | null | undefined): value is UnitId => value === 'poulets' || value === 'chevrerie' || value === 'provenderie' || value === 'bio' || value === 'pressoir' || value === 'stocks' || value === 'rh';
    // L’Administrateur ne doit pas hériter d’un ancien contexte RH sur les pages transverses.
    // Un paramètre ?unit= explicite reste prioritaire, notamment lorsqu’il ouvre une unité volontairement.
    setQueryUnitId(isUnit(queryUnit) ? queryUnit : isAdmin ? undefined : isUnit(cookieUnit) ? cookieUnit : undefined);
  }, [pathname]);
  useEffect(() => {
    const cookieMap = Object.fromEntries(document.cookie.split('; ').filter(Boolean).map((part) => { const index = part.indexOf('='); return [part.slice(0, index), decodeURIComponent(part.slice(index + 1))]; }));
    const name = cookieMap.agroflux_user_name || 'MOVIC';
    const role = cookieMap.agroflux_role || 'Administratrice';
    const allowedUnits = parseCookieArray(cookieMap.agroflux_allowed_units).filter((unit): unit is UnitId => normalizeAllowedUnits([unit]).length > 0);
    const access = parseCookieArray(cookieMap.agroflux_access);
    const isAdmin = cookieMap.agroflux_is_admin === '1';
    const applyProfile = (detail: ProfileUpdatedDetail = {}) => {
      setSessionProfile((current) => {
        const nextName = detail.name ?? current.name;
        return { ...current, ...detail, name: nextName, initials: nextName.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase() };
      });
    };
    setSessionProfile({ name, role, initials: name.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase(), identifier: cookieMap.agroflux_user || name, phone: '', profilePhoto: '', allowedUnits, access, status: 'Actif' });
    setSessionAllowedUnits(allowedUnits);
    setSessionAccess(access);
    setSessionAdmin(isAdmin);
    setSessionReady(true);
    const loadProfile = async () => {
      try {
        const response = await fetch('/api/account/profile', { cache: 'no-store' });
        const data = await response.json() as { profile?: ProfileUpdatedDetail };
        if (response.ok && data.profile) applyProfile(data.profile);
      } catch {
        // Les cookies permettent de conserver l'en-tête de session si le profil est indisponible.
      }
    };
    void loadProfile();
    const handleProfileUpdated = (event: Event) => applyProfile((event as CustomEvent<ProfileUpdatedDetail>).detail ?? {});
    window.addEventListener('agroflux-profile-updated', handleProfileUpdated);
    return () => window.removeEventListener('agroflux-profile-updated', handleProfileUpdated);
  }, []);

  useEffect(() => {
    if (!profileMenuOpen) return undefined;
    const handleOutsideClick = (event: MouseEvent) => { if (!profileMenuRef.current?.contains(event.target as Node)) setProfileMenuOpen(false); };
    const handleEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') setProfileMenuOpen(false); };
    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('keydown', handleEscape);
    return () => { document.removeEventListener('mousedown', handleOutsideClick); document.removeEventListener('keydown', handleEscape); };
  }, [profileMenuOpen]);

  const routeUnitId = pathname.match(/^\/dashboard\/([^/]+)/)?.[1] as UnitId | undefined;
  // Une seule source de vérité pour le périmètre actif : la même table que le
  // middleware. Cela évite que la route dynamique soit affichée dans la
  // navigation globale après un clic sur une commande inter-unités.
  const pathUnitId = unitFromPath(pathname);
  const activeUnitId = routeUnitId ?? pathUnitId ?? queryUnitId;
  const activeUnit = units.find((unit) => unit.id === activeUnitId);
  const baseNavigation = activeUnitId === 'poulets' ? farmNavigation : activeUnitId === 'chevrerie' ? goatNavigation : activeUnitId === 'provenderie' ? provenderieNavigation : activeUnitId === 'bio' ? bioNavigation : activeUnitId === 'pressoir' ? pressoirNavigation : activeUnitId === 'stocks' ? centralStoreNavigation : activeUnitId === 'rh' ? rhNavigation : navigation;
  const isActive = (href: string) => {
    const matches = href === '/dashboard' ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
    if (!matches) return false;
    return !baseNavigation.flatMap((section) => section.items).some((item) => item.href !== href && item.href.length > href.length && (pathname === item.href || pathname.startsWith(`${item.href}/`)));
  };
  useEffect(() => {
    const scopedUnit = activeUnitId;
    if (!scopedUnit || !['poulets', 'chevrerie', 'provenderie', 'bio', 'pressoir', 'stocks'].includes(scopedUnit)) {
      setFarmNotifications({ lowStock: 0, pendingFollowUps: 0, payments: 0, interUnit: 0 });
      setNotificationItems([]);
      return;
    }
    const load = () => {
      const stock = readLocal<Array<{ id?: string; name?: string; quantity: number; min: number; unit?: string }>>(FARM_STORAGE_KEYS.stock, []);
      const centralStock = readLocal<Array<{ id?: string; name?: string; quantity: number; min: number; unit?: string }>>(FARM_STORAGE_KEYS.centralStock, []);
      const daily = readLocal<Array<{ date: string; building?: string }>>(FARM_STORAGE_KEYS.daily, []);
      const buildings = readLocal<Array<{ name: string; status: string }>>(FARM_STORAGE_KEYS.buildings, []);
      const invoices = readLocal<Array<{ id?: string; unit?: string; client?: string; paid: number; amount: number }>>(FARM_STORAGE_KEYS.invoices, []);
      const interUnit = readLocal<Array<{ id?: string; from: string; to: string; product: string; quantity: number; unit: string; status: string; requestedByUnit?: string }>>(FARM_STORAGE_KEYS.interUnitMovements, []);
      const feedMaterials = readLocal<Array<{ id?: string; name: string; quantity: number; min: number; unit?: string }>>(scopedUnit === 'bio' ? FARM_STORAGE_KEYS.bioMaterials : scopedUnit === 'pressoir' ? FARM_STORAGE_KEYS.pressMaterials : FARM_STORAGE_KEYS.feedMaterials, []);
      const goatFeeds = readLocal<Array<{ id?: string; name: string; quantity: number; min: number; unit?: string }>>(FARM_STORAGE_KEYS.goatFeeding, []);
      const goatHealth = readLocal<Array<{ id?: string; animalName: string; status: string }>>(FARM_STORAGE_KEYS.goatHealth, []);
      const latestDate = daily.slice().sort((a, b) => b.date.localeCompare(a.date))[0]?.date;
      const items: NotificationItem[] = [];
      if (scopedUnit === 'poulets') {
        interUnit.filter((movement) => movement.status === 'En transit' && (movement.requestedByUnit === 'poulets' || (!movement.requestedByUnit && movement.to === 'poulets'))).forEach((movement) => items.push({ id: `movement-${movement.id}-reception`, title: 'Aliment à réceptionner', detail: `${movement.quantity} ${movement.unit} · ${movement.product}`, href: '/mouvements/ferme', tone: 'blue' }));
        stock.filter((item) => Number(item.quantity) <= Number(item.min)).forEach((item) => items.push({ id: `stock-${item.id ?? item.name}-${item.quantity}`, title: 'Stock sous le seuil', detail: `${item.name ?? 'Article'} · ${item.quantity} ${item.unit ?? ''}`, href: '/stocks/ferme', tone: 'orange' }));
        buildings.filter((building) => building.status === 'Occupé' && (!latestDate || !daily.some((record) => record.date === latestDate && record.building === building.name))).forEach((building) => items.push({ id: `follow-${building.name}-${latestDate ?? 'sans-date'}`, title: 'Suivi quotidien manquant', detail: `${building.name} doit être renseigné`, href: '/poulets/suivi', tone: 'blue' }));
      } else if (scopedUnit === 'provenderie') {
        interUnit.filter((movement) => movement.from === 'provenderie' && movement.status === 'Demandée').forEach((movement) => items.push({ id: `movement-${movement.id}-demand`, title: 'Nouvelle demande d’approvisionnement', detail: `${movement.quantity} ${movement.unit} · ${movement.product}`, href: '/mouvements/provenderie', tone: 'orange' }));
        feedMaterials.filter((material) => Number(material.quantity) <= Number(material.min)).forEach((material) => items.push({ id: `material-${material.id ?? material.name}-${material.quantity}`, title: 'Matière première sous le seuil', detail: `${material.name} · ${material.quantity} ${material.unit ?? ''}`, href: '/provenderie/matieres', tone: 'orange' }));
      } else if (scopedUnit === 'bio') {
        interUnit.filter((movement) => movement.from === 'bio' && movement.status === 'Demandée').forEach((movement) => items.push({ id: `movement-${movement.id}-demand`, title: 'Nouvelle demande de produits bio', detail: `${movement.quantity} ${movement.unit} · ${movement.product}`, href: '/mouvements/bio', tone: 'orange' }));
        feedMaterials.filter((material) => Number(material.quantity) <= Number(material.min)).forEach((material) => items.push({ id: `material-${material.id ?? material.name}-${material.quantity}`, title: 'Plante naturelle sous le seuil', detail: `${material.name} · ${material.quantity} ${material.unit ?? ''}`, href: '/produits-bio/matieres', tone: 'orange' }));
      } else if (scopedUnit === 'pressoir') {
        interUnit.filter((movement) => movement.from === 'pressoir' && movement.status === 'Demandée').forEach((movement) => items.push({ id: `movement-${movement.id}-demand`, title: 'Nouvelle demande au pressoir', detail: `${movement.quantity} ${movement.unit} · ${movement.product}`, href: '/mouvements/pressoir', tone: 'orange' }));
        feedMaterials.filter((material) => Number(material.quantity) <= Number(material.min)).forEach((material) => items.push({ id: `material-${material.id ?? material.name}-${material.quantity}`, title: 'Graine sous le seuil', detail: `${material.name} · ${material.quantity} ${material.unit ?? ''}`, href: '/pressoir/matieres', tone: 'orange' }));
      } else if (scopedUnit === 'chevrerie') {
        interUnit.filter((movement) => movement.from === 'chevrerie' && movement.status === 'Demandée').forEach((movement) => items.push({ id: `movement-${movement.id}-demand`, title: 'Nouvelle demande à la chèvrerie', detail: `${movement.quantity} ${movement.unit} · ${movement.product}`, href: '/mouvements/chevrerie', tone: 'orange' }));
        goatFeeds.filter((feed) => Number(feed.quantity) <= Number(feed.min)).forEach((feed) => items.push({ id: `goat-feed-${feed.id ?? feed.name}-${feed.quantity}`, title: 'Aliment caprin sous le seuil', detail: `${feed.name} · ${feed.quantity} ${feed.unit ?? ''}`, href: '/chevrerie/alimentation', tone: 'orange' }));
        goatHealth.filter((event) => event.status === 'À surveiller' || event.status === 'Planifié').forEach((event) => items.push({ id: `goat-health-${event.id ?? event.animalName}-${event.status}`, title: 'Suivi santé à traiter', detail: `${event.animalName} · ${event.status}`, href: '/chevrerie/sante', tone: 'blue' }));
      } else {
        interUnit.filter((movement) => movement.from === 'stocks' && movement.status === 'Demandée').forEach((movement) => items.push({ id: `movement-${movement.id}-demand`, title: 'Nouvelle demande au magasin central', detail: `${movement.quantity} ${movement.unit} · ${movement.product}`, href: '/mouvements/stocks', tone: 'orange' }));
        interUnit.filter((movement) => movement.to === 'stocks' && movement.status === 'En transit').forEach((movement) => items.push({ id: `movement-${movement.id}-reception`, title: 'Article à réceptionner au magasin', detail: `${movement.quantity} ${movement.unit} · ${movement.product}`, href: '/mouvements/stocks', tone: 'blue' }));
        centralStock.filter((item) => Number(item.quantity) <= Number(item.min)).forEach((item) => items.push({ id: `central-${item.id ?? item.name}-${item.quantity}`, title: 'Article du magasin sous le seuil', detail: `${item.name ?? 'Article'} · ${item.quantity} ${item.unit ?? ''}`, href: '/stocks/central', tone: 'orange' }));
      }
      const cashHref = scopedUnit === 'poulets' ? '/caisse/ferme' : `/caisse/${scopedUnit}`;
      invoices.filter((invoice) => invoice.unit === scopedUnit && Number(invoice.paid) > 0).forEach((invoice) => items.push({ id: `payment-${invoice.id}-${invoice.paid}`, title: 'Paiement reçu', detail: `${invoice.client ?? invoice.id} · versement enregistré`, href: cashHref, tone: 'green' }));
      const reads = readLocal(FARM_STORAGE_KEYS.notificationReads, [] as string[]);
      const unreadItems = items.filter((item) => !reads.includes(item.id));
      setNotificationItems(unreadItems);
      setFarmNotifications({
        lowStock: unreadItems.filter((item) => item.id.startsWith('stock-') || item.id.startsWith('material-') || item.id.startsWith('central-') || item.id.startsWith('goat-feed-')).length,
        pendingFollowUps: unreadItems.filter((item) => item.id.startsWith('follow-') || item.id.startsWith('goat-health-')).length,
        payments: unreadItems.filter((item) => item.id.startsWith('payment-')).length,
        interUnit: unreadItems.filter((item) => item.id.startsWith('movement-')).length,
      });
    };
    load();
    return subscribeToFarmData([FARM_STORAGE_KEYS.stock, FARM_STORAGE_KEYS.centralStock, FARM_STORAGE_KEYS.daily, FARM_STORAGE_KEYS.buildings, FARM_STORAGE_KEYS.feedMaterials, FARM_STORAGE_KEYS.bioMaterials, FARM_STORAGE_KEYS.pressMaterials, FARM_STORAGE_KEYS.goatFeeding, FARM_STORAGE_KEYS.goatHealth, FARM_STORAGE_KEYS.invoices, FARM_STORAGE_KEYS.interUnitMovements], load);
  }, [activeUnitId]);

  const publishRubricCounts = useCallback((nextCounts: Record<string, number>, nextIds: Record<string, string[]>, allowSound = false) => {
    const previous = previousRubricCountsRef.current;
    const previousIds = rubricIdsRef.current;
    const newNotification = Boolean(allowSound && previous && Object.entries(nextIds).some(([href, nextRubricIds]) => nextRubricIds.some((id) => !(previousIds[href] ?? []).includes(id))));
    const increased = Boolean(allowSound && notificationSoundReadyRef.current && previous && (newNotification || Object.entries(nextCounts).some(([href, count]) => count > (previous[href] ?? 0))));
    if (!previous && notificationSoundReadyTimerRef.current === null) {
      notificationSoundReadyTimerRef.current = window.setTimeout(() => { notificationSoundReadyRef.current = true; notificationSoundReadyTimerRef.current = null; }, 1000);
    }
    previousRubricCountsRef.current = nextCounts;
    rubricCountsRef.current = nextCounts;
    rubricIdsRef.current = nextIds;
    setRubricNotificationCounts(nextCounts);
    setRubricNotificationIds(nextIds);
    if (increased && notificationSoundTimerRef.current === null) {
      notificationSoundTimerRef.current = window.setTimeout(() => {
        notificationSoundTimerRef.current = null;
        try {
          if (!Object.values(rubricCountsRef.current).some((count) => count > 0)) return;
          const sound = notificationSoundRef.current ?? new Audio('/sounds/notification.wav');
          notificationSoundRef.current = sound;
          sound.currentTime = 0;
          sound.volume = 0.35;
          void sound.play().catch(() => undefined);
        } catch {
          // Les navigateurs peuvent bloquer l’audio avant une interaction utilisateur.
        }
      }, 250);
    }
  }, []);

  useEffect(() => {
    if (!sessionReady) return undefined;
    const loadRubricCounts = (allowSound = false) => {
      const counts: Record<string, number> = {};
      const ids: Record<string, string[]> = {};
      const reads = readLocal(FARM_STORAGE_KEYS.notificationReads, [] as string[]);
      const canSee = (unitId: string) => sessionAdmin || sessionAllowedUnits.includes(unitId as UnitId);
      const canSeeRubric = (href: string, unitId?: UnitId) => sessionAdmin || (!unitId || canSee(unitId)) && hasAccessToRequirements(sessionAccess, accessForNavigation(href, unitId), sessionProfile.role);
      const add = (href: string, value: number, id?: string) => { if (value > 0 && (!id || !reads.includes(id))) { counts[href] = (counts[href] ?? 0) + value; if (id) ids[href] = [...(ids[href] ?? []), id]; } };
      const day = todayIso();
      const currentUserId = getBrowserCookie('agroflux_user_id');
      const assignedBuildingIds = parseCookieArray(getBrowserCookie('agroflux_assigned_buildings'));
      const poultryReports = readLocal<Array<{ id: string; status: string; buildingId: string; reportedById?: string }>>(FARM_STORAGE_KEYS.dagoReports, []);
      if (canSeeRubric('/poulets/dago', 'poulets')) poultryReports.filter((report) => report.status === 'En attente de réception').forEach((report) => add('/poulets/dago', 1, `dead-birds-reception-${report.id}`));
      if (canSeeRubric('/poulets/batiments', 'poulets')) poultryReports.filter((report) => report.status === 'En attente confirmation bâtiment' && (sessionAdmin || !assignedBuildingIds.length || assignedBuildingIds.includes(report.buildingId))).forEach((report) => add('/poulets/batiments', 1, `dead-birds-building-${report.id}`));
      const poultryBuildings = readLocal<Array<{ id: string; name: string; status: string }>>(FARM_STORAGE_KEYS.buildings, []);
      const poultryDailyRecords = readLocal<Array<{ date: string; building: string }>>(FARM_STORAGE_KEYS.daily, []);
      if (canSeeRubric('/poulets/suivi', 'poulets')) poultryBuildings.filter((building) => building.status === 'Occupé' && !poultryDailyRecords.some((record) => record.date === day && record.building === building.name)).forEach((building) => add('/poulets/suivi', 1, `poultry-follow-up-${building.id}-${day}`));
      const urgentPoultryChecks = readLocal<Array<{ id: string; buildingId: string; urgent?: boolean; urgentStatus?: string }>>(FARM_STORAGE_KEYS.sanitaryChecks, []);
      const newUrgentChecks = urgentPoultryChecks.filter((check) => check.urgent === true && ['Déclenchée', 'Nouvelle'].includes(check.urgentStatus ?? 'Déclenchée'));
      if (canSeeRubric('/poulets/sante', 'poulets')) newUrgentChecks.filter((check) => sessionAdmin || !assignedBuildingIds.length || assignedBuildingIds.includes(check.buildingId)).forEach((check) => add('/poulets/sante', 1, `poultry-urgent-unit-${check.id}`));
      if (canSeeRubric('/rh/sante', 'rh')) newUrgentChecks.forEach((check) => add('/rh/sante', 1, `poultry-urgent-rh-${check.id}`));
      const poultryStock = readLocal<Array<{ id: string; quantity: number; min: number }>>(FARM_STORAGE_KEYS.stock, []);
      if (canSeeRubric('/stocks/ferme', 'poulets')) poultryStock.filter((item) => Number(item.quantity) <= Number(item.min)).forEach((item) => add('/stocks/ferme', 1, `poultry-stock-${item.id}-${item.quantity}`));
      const poultryTransfers = readLocal<Array<{ id: string; status: string }>>(FARM_STORAGE_KEYS.transfers, []);
      if (canSeeRubric('/poulets/transferts', 'poulets')) poultryTransfers.filter((transfer) => !['Validé', 'Terminé', 'Annulé'].includes(transfer.status)).forEach((transfer) => add('/poulets/transferts', 1, `poultry-transfer-${transfer.id}`));
      const poultryInvoices = readLocal<Array<{ id: string; unit: string; paid: number }>>(FARM_STORAGE_KEYS.invoices, []);
      if (canSeeRubric('/factures/ferme', 'poulets')) poultryInvoices.filter((invoice) => invoice.unit === 'poulets' && Number(invoice.paid) > 0).forEach((invoice) => add('/factures/ferme', 1, `poultry-payment-${invoice.id}-${invoice.paid}`));
      const provenderieMaterials = readLocal<Array<{ id: string; name: string; quantity: number; min: number }>>(FARM_STORAGE_KEYS.feedMaterials, []);
      if (canSeeRubric('/provenderie/matieres', 'provenderie')) provenderieMaterials.filter((material) => Number(material.quantity) <= Number(material.min)).forEach((material) => add('/provenderie/matieres', 1, `provenderie-material-${material.id}-${material.quantity}`));
      const provenderieRecipes = readLocal<Array<{ id: string; status: string; ingredients?: unknown[] }>>(FARM_STORAGE_KEYS.feedRecipes, []);
      if (canSeeRubric('/provenderie/recettes', 'provenderie')) provenderieRecipes.filter((recipe) => recipe.status === 'Active' && !(recipe.ingredients ?? []).length).forEach((recipe) => add('/provenderie/recettes', 1, `provenderie-recipe-${recipe.id}`));
      const provenderieProductions = readLocal<Array<{ id: string; status: string }>>(FARM_STORAGE_KEYS.feedProductions, []);
      if (canSeeRubric('/provenderie/productions', 'provenderie')) provenderieProductions.filter((production) => production.status === 'En préparation').forEach((production) => add('/provenderie/productions', 1, `provenderie-production-${production.id}`));
      if (canSeeRubric('/provenderie/stocks', 'provenderie')) provenderieProductions.filter((production) => production.status === 'Terminée').forEach((production) => add('/provenderie/stocks', 1, `provenderie-finished-stock-${production.id}`));
      const provenderieInvoices = readLocal<Array<{ id: string; unit: string; paid: number }>>(FARM_STORAGE_KEYS.invoices, []);
      if (canSeeRubric('/factures/provenderie', 'provenderie')) provenderieInvoices.filter((invoice) => invoice.unit === 'provenderie' && Number(invoice.paid) > 0).forEach((invoice) => add('/factures/provenderie', 1, `provenderie-payment-${invoice.id}-${invoice.paid}`));
      const bioMaterials = readLocal<Array<{ id: string; name: string; quantity: number; min: number }>>(FARM_STORAGE_KEYS.bioMaterials, []);
      if (canSeeRubric('/produits-bio/matieres', 'bio')) bioMaterials.filter((material) => Number(material.quantity) <= Number(material.min)).forEach((material) => add('/produits-bio/matieres', 1, `bio-material-${material.id}-${material.quantity}`));
      const bioRecipes = readLocal<Array<{ id: string; status: string; ingredients?: unknown[] }>>(FARM_STORAGE_KEYS.bioRecipes, []);
      if (canSeeRubric('/produits-bio/recettes', 'bio')) bioRecipes.filter((recipe) => recipe.status === 'Active' && !(recipe.ingredients ?? []).length).forEach((recipe) => add('/produits-bio/recettes', 1, `bio-recipe-${recipe.id}`));
      const bioProductions = readLocal<Array<{ id: string; status: string }>>(FARM_STORAGE_KEYS.bioProductions, []);
      if (canSeeRubric('/produits-bio/productions', 'bio')) bioProductions.filter((production) => production.status === 'En préparation').forEach((production) => add('/produits-bio/productions', 1, `bio-production-${production.id}`));
      if (canSeeRubric('/produits-bio/stocks', 'bio')) bioProductions.filter((production) => production.status === 'Terminée').forEach((production) => add('/produits-bio/stocks', 1, `bio-finished-stock-${production.id}`));
      const bioInvoices = readLocal<Array<{ id: string; unit: string; paid: number }>>(FARM_STORAGE_KEYS.invoices, []);
      if (canSeeRubric('/factures/bio', 'bio')) bioInvoices.filter((invoice) => invoice.unit === 'bio' && Number(invoice.paid) > 0).forEach((invoice) => add('/factures/bio', 1, `bio-payment-${invoice.id}-${invoice.paid}`));
      const pressoirMaterials = readLocal<Array<{ id: string; name: string; quantity: number; min: number }>>(FARM_STORAGE_KEYS.pressMaterials, []);
      if (canSeeRubric('/pressoir/matieres', 'pressoir')) pressoirMaterials.filter((material) => Number(material.quantity) <= Number(material.min)).forEach((material) => add('/pressoir/matieres', 1, `pressoir-material-${material.id}-${material.quantity}`));
      const pressoirRecipes = readLocal<Array<{ id: string; status: string; ingredients?: unknown[] }>>(FARM_STORAGE_KEYS.pressRecipes, []);
      if (canSeeRubric('/pressoir/recettes', 'pressoir')) pressoirRecipes.filter((recipe) => recipe.status === 'Active' && !(recipe.ingredients ?? []).length).forEach((recipe) => add('/pressoir/recettes', 1, `pressoir-recipe-${recipe.id}`));
      const pressoirProductions = readLocal<Array<{ id: string; status: string }>>(FARM_STORAGE_KEYS.pressProductions, []);
      if (canSeeRubric('/pressoir/productions', 'pressoir')) pressoirProductions.filter((production) => production.status === 'En préparation').forEach((production) => add('/pressoir/productions', 1, `pressoir-production-${production.id}`));
      if (canSeeRubric('/pressoir/stocks', 'pressoir')) pressoirProductions.filter((production) => production.status === 'Terminée').forEach((production) => add('/pressoir/stocks', 1, `pressoir-finished-stock-${production.id}`));
      const pressoirInvoices = readLocal<Array<{ id: string; unit: string; paid: number }>>(FARM_STORAGE_KEYS.invoices, []);
      if (canSeeRubric('/factures/pressoir', 'pressoir')) pressoirInvoices.filter((invoice) => invoice.unit === 'pressoir' && Number(invoice.paid) > 0).forEach((invoice) => add('/factures/pressoir', 1, `pressoir-payment-${invoice.id}-${invoice.paid}`));
      const goatAnimals = readLocal<Array<{ id: string; status?: string }>>(FARM_STORAGE_KEYS.goatAnimals, []);
      if (canSeeRubric('/chevrerie/animaux', 'chevrerie')) goatAnimals.filter((animal) => animal.status === 'Quarantaine' || animal.status === 'Mort').forEach((animal) => add('/chevrerie/animaux', 1, `goat-animal-${animal.id}-${animal.status}`));
      const goatReproduction = readLocal<Array<{ id: string; status?: string; expectedBirth?: string }>>(FARM_STORAGE_KEYS.goatReproduction, []);
      const reproductionLimit = addDaysIso(day, 14);
      if (canSeeRubric('/chevrerie/reproduction', 'chevrerie')) goatReproduction.filter((record) => record.status === 'Mise bas' || (record.status === 'Planifiée' && Boolean(record.expectedBirth && record.expectedBirth >= day && record.expectedBirth <= reproductionLimit))).forEach((record) => add('/chevrerie/reproduction', 1, `goat-reproduction-${record.id}-${record.status}`));
      const goatHealth = readLocal<Array<{ id: string; status?: string }>>(FARM_STORAGE_KEYS.goatHealth, []);
      if (canSeeRubric('/chevrerie/sante', 'chevrerie')) goatHealth.filter((event) => event.status === 'À surveiller' || event.status === 'Planifié').forEach((event) => add('/chevrerie/sante', 1, `goat-health-${event.id}-${event.status}`));
      const goatFeeds = readLocal<Array<{ id: string; quantity: number; min: number }>>(FARM_STORAGE_KEYS.goatFeeding, []);
      if (canSeeRubric('/chevrerie/alimentation', 'chevrerie')) goatFeeds.filter((feed) => Number(feed.quantity) <= Number(feed.min)).forEach((feed) => add('/chevrerie/alimentation', 1, `goat-feed-${feed.id}-${feed.quantity}`));
      const goatProductions = readLocal<Array<{ id: string; status?: string }>>(FARM_STORAGE_KEYS.goatProductions, []);
      if (canSeeRubric('/chevrerie/productions', 'chevrerie')) goatProductions.filter((production) => production.status === 'Enregistrée').forEach((production) => add('/chevrerie/productions', 1, `goat-production-${production.id}`));
      if (canSeeRubric('/chevrerie/stocks', 'chevrerie')) goatProductions.filter((production) => production.status === 'Enregistrée').forEach((production) => add('/chevrerie/stocks', 1, `goat-stock-production-${production.id}`));
      const goatInvoices = readLocal<Array<{ id: string; unit: string; paid: number }>>(FARM_STORAGE_KEYS.invoices, []);
      if (canSeeRubric('/factures/chevrerie', 'chevrerie')) goatInvoices.filter((invoice) => invoice.unit === 'chevrerie' && Number(invoice.paid) > 0).forEach((invoice) => add('/factures/chevrerie', 1, `goat-payment-${invoice.id}-${invoice.paid}`));
      const chatPrefix = `${FARM_STORAGE_KEYS.chatMessages}:`;
      const chatMessages = Object.keys(window.localStorage).filter((key) => key.startsWith(chatPrefix)).flatMap((key) => readLocal<Array<{ id: string; recipientId: string; readBy?: string[] }>>(key, []));
      const unreadChatMessages = chatMessages.filter((message) => sameNotificationIdentity(message.recipientId, currentUserId) && !(message.readBy ?? []).some((reader) => sameNotificationIdentity(reader, currentUserId)));
      const chatHref = activeUnitId ? `/chat/${activeUnitId}` : '/chat';
      if (unreadChatMessages.length && canSeeRubric(chatHref, activeUnitId)) unreadChatMessages.forEach((message) => add(chatHref, 1, `chat-${message.id}`));
      const orders = readLocal<Array<{ id: string; unitId: string; status: string }>>(FARM_STORAGE_KEYS.customerOrders, []);
      orders.filter((order) => !['Livrée', 'Annulée'].includes(order.status) && canSee(order.unitId)).forEach((order) => add('/commandes-clients', 1, `customer-order-${order.id}`));
      const internal = readLocal<Array<{ id: string; supplierUnitId: string; recipientUnitId: string; status: string }>>(FARM_STORAGE_KEYS.internalOrders, []);
      internal.filter((order) => ['En attente', 'En livraison'].includes(order.status)).forEach((order) => { if (canSee(order.supplierUnitId)) add(`/mouvements/commandes/${order.supplierUnitId}`, 1, `internal-order-${order.id}-supplier`); if (canSee(order.recipientUnitId)) add(`/mouvements/commandes/${order.recipientUnitId}`, 1, `internal-order-${order.id}-recipient`); });
      const logistics = readLocal<Array<{ id: string; recipientUnitId?: string; recipientUserId?: string; read?: boolean }>>(FARM_STORAGE_KEYS.logisticsNotifications, []);
      logistics.filter((item) => !item.read && !reads.includes(`logistics-${item.id}`)).forEach((item) => {
        if (item.recipientUserId && item.recipientUserId === currentUserId) add('/commandes-clients/scanner', 1, `logistics-${item.id}`);
        else if (!item.recipientUserId && item.recipientUnitId && canSee(item.recipientUnitId)) add(`/mouvements/commandes/${item.recipientUnitId}`, 1, `logistics-${item.id}`);
      });
      const movements = readLocal<Array<{ from: string; to: string; status: string }>>(FARM_STORAGE_KEYS.interUnitMovements, []);
      movements.filter((movement) => ['Demandée', 'En transit'].includes(movement.status)).forEach((movement) => { if (canSee(movement.from)) add(`/mouvements/${movement.from === 'poulets' ? 'ferme' : movement.from}`, 1, `movement-${movement.from}-${movement.to}-${movement.status}-from`); if (canSee(movement.to)) add(`/mouvements/${movement.to === 'poulets' ? 'ferme' : movement.to}`, 1, `movement-${movement.from}-${movement.to}-${movement.status}-to`); });
      const tasks = readLocal<Array<{ id: string; templateId?: string; date: string; unitId: string; status: string; validationStatus?: string; startTime?: string; shift?: 'jour' | 'nuit'; scheduleMode?: 'fixe' | 'recurrence' | 'libre'; poultryPhase?: 'poussiniere' | 'croissance-finition'; lifecycleTask?: boolean; poultryAgeDay?: number; alertAfterMinutes?: number; assignedBuildingId?: string }>>(FARM_STORAGE_KEYS.dailyTaskInstances, []);
      const taskSettings = { ...DEFAULT_DAILY_TASK_SETTINGS, ...readLocal<Partial<typeof DEFAULT_DAILY_TASK_SETTINGS>>(FARM_STORAGE_KEYS.rhSettings, {}) };
      const taskRoster = readLocal<DailyTaskRosterEntry[]>(FARM_STORAGE_KEYS.dailyTaskRoster, []);
      const taskEmployees = readLocal<Array<{ id: string; linkedUserId?: string; unitId: DailyTaskUnitId }>>(FARM_STORAGE_KEYS.rhEmployees, []);
      const categoryAssignments = readLocal<PoultryCategoryAssignment[]>(FARM_STORAGE_KEYS.poultryCategoryAssignments, []);
      const currentTaskEmployeeIds = new Set([currentUserId, ...taskEmployees.filter((employee) => employee.id === currentUserId || employee.linkedUserId === currentUserId).map((employee) => employee.id)].filter(Boolean));
      const taskDates = new Set([day, currentServiceDate('nuit', new Date(), taskSettings)]);
      const taskNotifications = new Map<string, (typeof tasks)[number]>();
      tasks.filter((task) => {
        const rosterEntry = taskRoster.find((entry) => entry.unitId === task.unitId && currentTaskEmployeeIds.has(entry.employeeId));
        const assignedShift = rosterEntry ? shiftForEmployee(rosterEntry.employeeId, task.date, taskRoster, task.unitId as DailyTaskUnitId) : undefined;
        const serviceAllowed = sessionAdmin || !rosterEntry || assignedShift === (task.shift ?? 'jour');
        const categoryAssignment = task.unitId === 'poulets' && !sessionAdmin ? activePoultryCategoryAssignment(categoryAssignments, Array.from(currentTaskEmployeeIds), new Date()) : undefined;
        const categoryAllowed = task.unitId !== 'poulets' || sessionAdmin || Boolean(categoryAssignment && poultryTaskPhase(task) === categoryAssignment.poultryPhase);
        return taskDates.has(task.date) && categoryAllowed && task.scheduleMode !== 'libre' && ['À faire', 'En cours', 'Non faite'].includes(task.status) && canSee(task.unitId) && serviceAllowed && (!task.assignedBuildingId || sessionAdmin || !assignedBuildingIds.length || assignedBuildingIds.includes(task.assignedBuildingId));
      }).forEach((task) => {
        const key = task.scheduleMode === 'recurrence' ? `${task.unitId}-${task.templateId ?? task.id}` : task.id;
        if (!taskNotifications.has(key)) taskNotifications.set(key, task);
      });
      taskNotifications.forEach((task) => {
        const key = task.scheduleMode === 'recurrence' ? `${task.unitId}-${task.templateId ?? task.id}` : task.id;
        add(`/${task.unitId}/taches`, 1, `daily-task-${key}`);
      });
      tasks.filter((task) => task.date === day && task.validationStatus === 'En attente de validation RH' && (sessionAdmin || sessionAllowedUnits.includes('rh'))).forEach((task) => add('/rh/taches', 1, `daily-task-rh-${task.id}`));
      const rhAttendance = readLocal<Array<{ id: string; date: string; status?: string }>>(FARM_STORAGE_KEYS.rhAttendance, []);
      if (canSeeRubric('/rh/presences', 'rh')) rhAttendance.filter((record) => record.date === day).forEach((record) => add('/rh/presences', 1, `rh-attendance-${record.id}`));
      const rhLeave = readLocal<Array<{ id: string; status: string }>>(FARM_STORAGE_KEYS.rhLeave, []);
      if (canSeeRubric('/rh/conges', 'rh')) rhLeave.filter((record) => record.status === 'Demandé').forEach((record) => add('/rh/conges', 1, `rh-leave-${record.id}`));
      const rhPayroll = readLocal<Array<{ id: string; period?: string; status: string }>>(FARM_STORAGE_KEYS.rhPayroll, []);
      if (canSeeRubric('/rh/paie', 'rh')) rhPayroll.filter((record) => record.status === 'Préparée' || record.status === 'Bloquée').forEach((record) => add('/rh/paie', 1, `rh-payroll-${record.id}-${record.status}`));
      const rhDocuments = readLocal<Array<{ id: string; expiryDate?: string; status?: string }>>(FARM_STORAGE_KEYS.rhDocuments, []);
      const documentLimit = addDaysIso(day, 30);
      if (canSeeRubric('/rh/documents', 'rh')) rhDocuments.filter((document) => document.status === 'À renouveler' || Boolean(document.expiryDate && document.expiryDate <= documentLimit && document.expiryDate >= day)).forEach((document) => add('/rh/documents', 1, `rh-document-${document.id}-${document.expiryDate ?? document.status ?? 'a-renouveler'}`));
      const dagoReports = readLocal<Array<{ id: string; rhStatus?: string }>>(FARM_STORAGE_KEYS.dagoReports, []);
      if (sessionAdmin || sessionAllowedUnits.includes('rh')) dagoReports.filter((report) => report.rhStatus === 'En attente validation RH').forEach((report) => add('/rh/dago', 1, `dago-rh-${report.id}`));
      const healthEvents = readLocal<Array<{ id: string; date: string }>>(FARM_STORAGE_KEYS.health, []);
      const healthToday = new Date(`${day}T12:00:00`).getTime();
      healthEvents.filter((event) => { const date = new Date(`${event.date}T12:00:00`).getTime(); return Number.isFinite(date) && date <= healthToday && healthToday - date <= 7 * 86400000; }).forEach((event) => {
        if (canSee('poulets')) add('/poulets/sante', 1, `health-${event.id}`);
        if (sessionAdmin || sessionAllowedUnits.includes('rh')) add('/rh/sante', 1, `health-${event.id}`);
      });
      const custody = readLocal<Array<{ id: string; unitId: string; status: string }>>(FARM_STORAGE_KEYS.stockCustodies, []);
      custody.filter((item) => ['En cours', 'Partiellement retourné', 'Manque à facturer'].includes(item.status) && canSee(item.unitId)).forEach((item) => add(`/stocks/attributions/${item.unitId}`, 1, `custody-${item.id}`));
      const crates = readLocal<Array<{ id: string; quantityOutstanding: number }>>(FARM_STORAGE_KEYS.crateCustodies, []);
      if (canSee('poulets')) crates.filter((item) => item.quantityOutstanding > 0).forEach((item) => add('/stocks/caisses', 1, `crate-${item.id}`));
      const personnel = readLocal<Array<{ employeeId: string; explanationRequests?: Array<{ id: string; status?: string }> }>>(FARM_STORAGE_KEYS.rhPersonnelRecords, []);
      if (sessionAdmin || sessionAllowedUnits.includes('rh')) personnel.forEach((record) => (record.explanationRequests ?? []).filter((item) => ['En attente', 'Envoyée', 'À traiter'].includes(item.status ?? '')).forEach((item) => add('/rh/personnel', 1, `rh-explanation-${record.employeeId}-${item.id}`)));
      publishRubricCounts(counts, ids, allowSound);
    };
    loadRubricCounts(false);
    const unsubscribe = subscribeToFarmData([FARM_STORAGE_KEYS.customerOrders, FARM_STORAGE_KEYS.internalOrders, FARM_STORAGE_KEYS.logisticsNotifications, FARM_STORAGE_KEYS.interUnitMovements, FARM_STORAGE_KEYS.dailyTaskInstances, FARM_STORAGE_KEYS.dailyTaskRoster, FARM_STORAGE_KEYS.poultryCategoryAssignments, FARM_STORAGE_KEYS.rhEmployees, FARM_STORAGE_KEYS.dagoReports, FARM_STORAGE_KEYS.health, FARM_STORAGE_KEYS.sanitaryChecks, FARM_STORAGE_KEYS.stockCustodies, FARM_STORAGE_KEYS.crateCustodies, FARM_STORAGE_KEYS.rhPersonnelRecords, FARM_STORAGE_KEYS.notificationReads, FARM_STORAGE_KEYS.buildings, FARM_STORAGE_KEYS.daily, FARM_STORAGE_KEYS.stock, FARM_STORAGE_KEYS.transfers, FARM_STORAGE_KEYS.invoices, FARM_STORAGE_KEYS.chatMessages, FARM_STORAGE_KEYS.feedMaterials, FARM_STORAGE_KEYS.feedRecipes, FARM_STORAGE_KEYS.feedProductions, FARM_STORAGE_KEYS.bioMaterials, FARM_STORAGE_KEYS.bioRecipes, FARM_STORAGE_KEYS.bioProductions, FARM_STORAGE_KEYS.bioFinishedStock, FARM_STORAGE_KEYS.pressMaterials, FARM_STORAGE_KEYS.pressRecipes, FARM_STORAGE_KEYS.pressProductions, FARM_STORAGE_KEYS.pressFinishedStock, FARM_STORAGE_KEYS.pressMovements, FARM_STORAGE_KEYS.rhAttendance, FARM_STORAGE_KEYS.rhLeave, FARM_STORAGE_KEYS.rhPayroll, FARM_STORAGE_KEYS.rhDocuments, FARM_STORAGE_KEYS.goatAnimals, FARM_STORAGE_KEYS.goatReproduction, FARM_STORAGE_KEYS.goatHealth, FARM_STORAGE_KEYS.goatFeeding, FARM_STORAGE_KEYS.goatRations, FARM_STORAGE_KEYS.goatProductions, FARM_STORAGE_KEYS.goatFinishedStock, FARM_STORAGE_KEYS.goatMovements], () => loadRubricCounts(true));
    const timer = window.setInterval(() => loadRubricCounts(true), 30000);
    return () => { unsubscribe(); window.clearInterval(timer); };
  }, [sessionReady, sessionAdmin, sessionAllowedUnits, sessionAccess, sessionProfile.role, activeUnitId, publishRubricCounts]);

  useEffect(() => {
    if (!sessionReady) return undefined;
    let disposed = false;
    let confidentialBaselineReady = false;
    const loadConfidentialCount = async () => {
      try {
        const response = await fetch('/api/confidential-correspondence', { cache: 'no-store' });
        if (!response.ok || disposed) return;
        const data = await response.json() as { messages?: Array<{ id: string; recipientId: string; status: string }> };
        const reads = readLocal(FARM_STORAGE_KEYS.notificationReads, [] as string[]);
        const unread = (data.messages ?? []).filter((message) => message.recipientId === getBrowserCookie('agroflux_user_id') && message.status === 'Non lu' && !reads.includes(`confidential-${message.id}`));
        publishRubricCounts({ ...rubricCountsRef.current, '/courriers-confidentiels': unread.length }, { ...rubricIdsRef.current, '/courriers-confidentiels': unread.map((message) => `confidential-${message.id}`) }, confidentialBaselineReady);
        confidentialBaselineReady = true;
      } catch { /* le reste de la navigation reste disponible */ }
    };
    void loadConfidentialCount();
    const timer = window.setInterval(() => { void loadConfidentialCount(); }, 30000);
    return () => { disposed = true; window.clearInterval(timer); };
  }, [sessionReady, publishRubricCounts]);

  useEffect(() => {
    if (!sessionReady || (!sessionAdmin && !sessionAllowedUnits.includes('rh')) || (!sessionAdmin && !hasAccessToRequirements(sessionAccess, ['Messages de contact'], sessionProfile.role))) return undefined;
    let disposed = false;
    let contactBaselineReady = false;
    const loadContactCount = async () => {
      try {
        const response = await fetch('/api/contact', { cache: 'no-store' });
        if (!response.ok || disposed) return;
        const data = await response.json() as { messages?: Array<{ id: string; status: string }> };
        const reads = readLocal(FARM_STORAGE_KEYS.notificationReads, [] as string[]);
        const unread = (data.messages ?? []).filter((message) => message.status === 'Nouveau' && !reads.includes(`contact-${message.id}`));
        publishRubricCounts({ ...rubricCountsRef.current, '/rh/messages-contact': unread.length }, { ...rubricIdsRef.current, '/rh/messages-contact': unread.map((message) => `contact-${message.id}`) }, contactBaselineReady);
        contactBaselineReady = true;
      } catch { /* l’administration conserve les autres notifications si le registre est indisponible */ }
    };
    void loadContactCount();
    const timer = window.setInterval(() => { void loadContactCount(); }, 30000);
    return () => { disposed = true; window.clearInterval(timer); };
  }, [sessionReady, sessionAdmin, sessionAllowedUnits, sessionAccess, sessionProfile.role, publishRubricCounts]);

  const visibleNavigation = sessionReady ? filterNavigation(baseNavigation, sessionAllowedUnits, sessionAccess, sessionAdmin, activeUnitId, sessionProfile.role) : [];
  const settingsHref = activeUnitId === 'poulets' ? '/parametres/ferme' : activeUnitId === 'chevrerie' ? '/parametres/chevrerie' : activeUnitId === 'provenderie' ? '/parametres/provenderie' : activeUnitId === 'bio' ? '/parametres/bio' : activeUnitId === 'pressoir' ? '/parametres/pressoir' : activeUnitId === 'stocks' ? '/parametres/stocks' : activeUnitId === 'rh' ? '/parametres/rh' : '/parametres';
  const canOpenSettings = sessionAdmin || (sessionReady && hasAccessToRequirements(sessionAccess, ['Paramètres']));
  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.assign('/connexion');
  };
  const markRubricRead = (href: string) => {
    const ids = rubricNotificationIds[href] ?? [];
    if (!ids.length) return;
    const reads = readLocal(FARM_STORAGE_KEYS.notificationReads, [] as string[]);
    writeLocal(FARM_STORAGE_KEYS.notificationReads, Array.from(new Set([...reads, ...ids])));
    rubricCountsRef.current = { ...rubricCountsRef.current, [href]: 0 };
    rubricIdsRef.current = { ...rubricIdsRef.current, [href]: [] };
    setRubricNotificationCounts(rubricCountsRef.current);
    setRubricNotificationIds(rubricIdsRef.current);
  };
  const markNotificationRead = (id: string) => {
    const reads = readLocal(FARM_STORAGE_KEYS.notificationReads, [] as string[]);
    if (!reads.includes(id)) writeLocal(FARM_STORAGE_KEYS.notificationReads, [...reads, id]);
    setNotificationItems((current) => current.filter((item) => item.id !== id));
    setFarmNotifications((current) => ({ ...current, lowStock: (id.startsWith('stock-') || id.startsWith('material-') || id.startsWith('central-') || id.startsWith('goat-feed-')) ? Math.max(current.lowStock - 1, 0) : current.lowStock, pendingFollowUps: (id.startsWith('follow-') || id.startsWith('goat-health-')) ? Math.max(current.pendingFollowUps - 1, 0) : current.pendingFollowUps, payments: id.startsWith('payment-') ? Math.max(current.payments - 1, 0) : current.payments, interUnit: id.startsWith('movement-') ? Math.max(current.interUnit - 1, 0) : current.interUnit }));
    setNotificationsOpen(false);
  };

  return <div className="app-shell">
    {mobileOpen && <button className="mobile-backdrop lg:hidden" onClick={() => setMobileOpen(false)} aria-label="Fermer la navigation" />}
    <aside className={`sidebar nav-scroll fixed bottom-0 left-0 top-0 z-[100] flex flex-col overflow-y-auto ${collapsed ? 'sidebar-collapsed' : ''} ${mobileOpen ? 'mobile-open' : ''}`}>
      <div className={`flex h-[82px] shrink-0 items-center border-b border-white/10 px-5 ${collapsed ? 'justify-center px-3' : 'justify-between'}`}>
        <Logo compact={collapsed} />
        {!collapsed && <button className="hidden h-8 w-8 items-center justify-center rounded-lg text-[#9bb1a4] transition hover:bg-white/10 hover:text-white lg:flex" onClick={() => setCollapsed(true)} aria-label="Réduire la sidebar"><ChevronLeft size={17} /></button>}
        <button className="flex h-8 w-8 items-center justify-center rounded-lg text-[#9bb1a4] transition hover:bg-white/10 hover:text-white lg:hidden" onClick={() => setMobileOpen(false)} aria-label="Fermer"><X size={17} /></button>
      </div>

      <div className={`px-3 pt-5 ${collapsed ? 'flex justify-center' : ''}`}>
        {collapsed ? <button className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#285341] text-[#cfe2d2] hover:bg-[#34644f]" onClick={() => setCollapsed(false)} aria-label="Ouvrir la sidebar"><ChevronRight size={17} /></button> : <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[.06] px-3 py-2.5"><span className="relative flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white"><Image src="/scoops-le-reveil-logo.jpg" alt="Logo SCOOPS LE REVEIL" fill className="object-contain" sizes="32px" /></span><div className="min-w-0 flex-1"><p className="truncate text-[11px] font-bold text-white">SCOOPS LE REVEIL</p><p className="mt-0.5 truncate text-[10px] text-[#98b0a3]">Entreprise principale</p></div><ChevronDown size={14} className="text-[#98b0a3]" /></div>}
      </div>

      <nav className={`nav-scroll mt-6 flex-1 overflow-y-auto px-3 pb-5 ${collapsed ? 'px-3' : ''}`}>
        {visibleNavigation.map((section) => <div className="mb-6" key={section.label}>
          {!collapsed && <p className="mb-2 px-3 text-[9px] font-bold uppercase tracking-[.18em] text-[#7d9d8c]">{section.label}</p>}
          <div className="space-y-1">
            {section.items.map(({ label, href, icon: Icon, badge }) => {
              const active = isActive(href);
              const linkHref = navigationHrefWithUnitContext(href, activeUnitId);
              const movementBadge = href === '/mouvements/ferme' || href === '/mouvements/provenderie' ? (farmNotifications.interUnit ? String(farmNotifications.interUnit) : undefined) : badge;
              const notificationBadge = rubricNotificationCounts[href] !== undefined ? (rubricNotificationCounts[href] > 0 ? String(rubricNotificationCounts[href]) : undefined) : movementBadge;
              return <Link key={href} href={linkHref} onClick={() => { markRubricRead(href); setMobileOpen(false); }} title={collapsed ? label : undefined} className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-[12px] font-semibold transition ${collapsed ? 'justify-center' : ''} ${active ? 'bg-[#a4eb91] text-forest shadow-[0_8px_18px_rgba(0,0,0,.12)]' : 'text-[#b3cabe] hover:bg-white/[.08] hover:text-white'}`}>
              <Icon size={17} strokeWidth={active ? 2.4 : 2} />
              {!collapsed && <><span className="flex-1 truncate">{label}</span>{notificationBadge && <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${active ? 'bg-forest/15 text-forest' : 'bg-[#d9706b] text-white'}`}>{notificationBadge}</span>}</>}
              </Link>;
            })}
          </div>
        </div>)}
      </nav>

      <div className={`mt-auto border-t border-white/10 p-3 ${collapsed ? 'flex justify-center' : ''}`}>
        {!collapsed && <div className="mb-3 rounded-xl border border-[#96d886]/20 bg-[#a4eb91]/[.09] p-3"><div className="mb-2 flex items-center justify-between"><span className="flex items-center gap-1.5 text-[10px] font-bold text-[#ccefc4]"><Sparkles size={12} /> Plan Essentiel</span><span className="text-[10px] text-[#98b0a3]">58%</span></div><div className="h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full w-[58%] rounded-full bg-[#a4eb91]" /></div><p className="mt-2 text-[9px] leading-4 text-[#98b0a3]">6 unités sur 6 configurées</p></div>}
        {canOpenSettings && (collapsed ? <Link href={settingsHref} className="flex h-10 w-10 items-center justify-center rounded-xl text-[#afc8b8] hover:bg-white/10 hover:text-white" title="Paramètres"><Settings size={17} /></Link> : <Link href={settingsHref} className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-[12px] font-semibold text-[#b3cabe] hover:bg-white/[.08] hover:text-white"><Settings size={17} /><span>Paramètres</span></Link>)}
        {collapsed ? <button className="mt-2 flex h-10 w-10 items-center justify-center rounded-xl text-[#afc8b8] hover:bg-white/10 hover:text-white" onClick={handleLogout} title="Se déconnecter"><LogOut size={17} /></button> : <button className="mt-1 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[12px] font-semibold text-[#b3cabe] hover:bg-white/[.08] hover:text-white" onClick={handleLogout}><LogOut size={17} /><span>Se déconnecter</span></button>}
        {!collapsed && <div className="mt-3 flex items-center gap-3 border-t border-white/10 px-2 pt-3"><div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#e9ba83] text-[11px] font-black text-forest">{sessionProfile.initials}</div><div className="min-w-0 flex-1"><p className="truncate text-[11px] font-bold text-white">{sessionProfile.name}</p><p className="truncate text-[10px] text-[#8fa99a]">{sessionProfile.role}</p></div><button className="text-[#8fa99a] hover:text-white" onClick={handleLogout} aria-label="Se déconnecter"><LogOut size={15} /></button></div>}
      </div>
    </aside>

    <main className={`main-area min-h-screen ${collapsed ? 'is-collapsed' : ''}`}>
      <header className="topbar sticky top-0 z-[100] flex h-[82px] items-center justify-between gap-4 px-5 sm:px-8 lg:px-10">
        <div className="flex min-w-0 items-center gap-3">
          <button className="icon-btn h-9 w-9 lg:hidden" onClick={() => setMobileOpen(true)} aria-label="Ouvrir la navigation"><Menu size={18} /></button>
          {collapsed && <button className="icon-btn hidden h-9 w-9 lg:flex" onClick={() => setCollapsed(false)} aria-label="Ouvrir la sidebar"><PanelLeft size={17} /></button>}
          <div className={`relative ${searchOpen ? 'block' : 'hidden sm:block'}`}><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9aa69f]" size={15} /><input className="input-base h-9 w-[220px] rounded-full border-transparent bg-white pl-9 pr-3 text-[12px] shadow-[0_3px_12px_rgba(29,46,39,.035)] placeholder:text-[#a4afa9] focus:border-[#c7d8c8] sm:w-[260px]" placeholder="Rechercher..." aria-label="Rechercher" /></div>
          {activeUnit && <Link href="/selection-unite" className="unit-context-chip"><span className="h-2 w-2 rounded-full" style={{ background: activeUnit.color }} />{activeUnit.shortLabel}<ChevronDown size={13} /></Link>}
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          
          <button className="icon-btn h-9 w-9 sm:hidden" onClick={() => setSearchOpen(!searchOpen)} aria-label="Rechercher"><Search size={17} /></button>
          {sessionAdmin && <Link href="/dashboard-admin" className="inline-flex h-9 items-center gap-1.5 rounded-full border border-[#cde2cb] bg-[#edf8e9] px-2.5 text-[10px] font-bold text-[#4d8f52] transition hover:border-[#a8d3a5] hover:bg-[#e4f5df] sm:px-3" aria-label="Retourner au dashboard administrateur" title="Retourner au dashboard administrateur"><ArrowLeft size={14} /><span className="hidden sm:inline">Retour au dashboard admin</span><span className="sm:hidden">Admin</span></Link>}
          <div className="relative"><button className="icon-btn relative h-9 w-9" onClick={() => setNotificationsOpen(!notificationsOpen)} aria-label="Notifications" aria-expanded={notificationsOpen}><Bell size={17} />{notificationItems.length > 0 ? <span className="absolute -right-1 -top-1 flex min-h-4 min-w-4 items-center justify-center rounded-full bg-[#d9706b] px-1 text-[9px] font-black text-white">{notificationItems.length}</span> : <span className="pulse-dot absolute right-[7px] top-[6px] h-1.5 w-1.5 rounded-full bg-[#e9975c]" />}</button>{notificationsOpen && <div className="notification-popover"><div className="flex items-center justify-between border-b border-[#edf0eb] px-3.5 py-3"><p className="text-[12px] font-bold text-ink">Notifications</p><button className="text-[10px] font-bold text-[#5b9d5b]" onClick={() => setNotificationsOpen(false)}>Fermer</button></div><div className="max-h-[420px] overflow-y-auto">{notificationItems.length ? notificationItems.map((item) => <Link key={item.id} href={item.href} className="notification-item" onClick={() => markNotificationRead(item.id)}><span className={`notification-dot ${item.tone === 'orange' ? 'bg-[#e9975c]' : item.tone === 'green' ? 'bg-[#71bd76]' : 'bg-[#6f9fe8]'}`} /><span><strong>{item.title}</strong><small>{item.detail}</small></span></Link>) : <div className="px-3.5 py-6 text-center text-[11px] text-[#89968f]">Aucune notification dans cet espace.</div>}</div><div className="border-t border-[#edf0eb] px-3.5 py-2.5 text-center text-[10px] font-bold text-[#5b9d5b]">{notificationItems.length} notification{notificationItems.length > 1 ? 's' : ''} · {activeUnit?.shortLabel ?? 'global'}</div></div>}</div>
          <div className="hidden h-6 w-px bg-[#dfe6df] sm:block" />
          <button className="icon-btn hidden h-9 w-9 sm:flex" onClick={handleLogout} aria-label="Se déconnecter" title="Se déconnecter"><LogOut size={16} /></button>
          <div className="relative" ref={profileMenuRef}>
            <button type="button" className="flex items-center gap-2 rounded-full py-1 pl-1 pr-2 transition hover:bg-white" onClick={() => setProfileMenuOpen((current) => !current)} aria-haspopup="menu" aria-expanded={profileMenuOpen} aria-label="Ouvrir le menu du compte">
              <ProfileAvatar photo={sessionProfile.profilePhoto} initials={sessionProfile.initials} className="h-8 w-8 text-[11px]" />
              <span className="hidden text-left sm:block"><span className="block text-[11px] font-bold leading-4 text-ink">{sessionProfile.name}</span><span className="block text-[10px] leading-3 text-[#8a9790]">{sessionProfile.role}</span></span>
              <ChevronDown size={14} className={`hidden text-[#87958d] transition-transform sm:block ${profileMenuOpen ? 'rotate-180' : ''}`} />
            </button>
            {profileMenuOpen && <div className="absolute right-0 top-[calc(100%+10px)] z-[160] w-[310px] overflow-hidden rounded-2xl border border-[#e1e9df] bg-white shadow-[0_18px_45px_rgba(29,46,39,.16)]" role="menu">
              <div className="border-b border-[#edf0eb] bg-[#f7fbf5] px-4 py-4"><div className="flex items-center gap-3"><ProfileAvatar photo={sessionProfile.profilePhoto} initials={sessionProfile.initials} className="h-11 w-11 text-[13px]" /><div className="min-w-0"><p className="truncate text-[13px] font-black text-ink">{sessionProfile.name}</p><p className="mt-1 truncate text-[10px] text-[#718078]">{sessionProfile.role}</p><p className="mt-1 truncate text-[10px] font-semibold text-[#5b9d5b]">{sessionProfile.allowedUnits.length ? sessionProfile.allowedUnits.map((id) => units.find((unit) => unit.id === id)?.shortLabel ?? id).join(' · ') : 'Toutes les unités'}</p></div></div></div>
              <div className="space-y-1 p-2"><Link href="/mon-profil" role="menuitem" onClick={() => setProfileMenuOpen(false)} className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-[11px] font-semibold text-[#53675b] transition hover:bg-[#f3f8f0] hover:text-forest"><UserRound size={15} /> <span className="flex-1">Mon profil</span><span className="text-[#a2afa6]">›</span></Link><Link href="/mon-profil/mot-de-passe" role="menuitem" onClick={() => setProfileMenuOpen(false)} className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-[11px] font-semibold text-[#53675b] transition hover:bg-[#f3f8f0] hover:text-forest"><KeyRound size={15} /> <span className="flex-1">Changer le mot de passe</span><span className="text-[#a2afa6]">›</span></Link></div>
              <div className="border-t border-[#edf0eb] p-2"><button type="button" role="menuitem" className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[11px] font-semibold text-[#b45d5d] transition hover:bg-[#fff4f3]" onClick={() => { setProfileMenuOpen(false); void handleLogout(); }}><LogOut size={15} /> <span>Se déconnecter</span></button></div>
            </div>}
          </div>
        </div>
      </header>
      <div className="px-5 pb-10 pt-7 sm:px-8 lg:px-10">{children}</div>
    </main>
  </div>;
}

type NavigationSection = { label: string; items: { label: string; href: string; icon: LucideIcon; badge?: string }[] };

function navigationHrefWithUnitContext(href: string, unitId?: UnitId) {
  if (!unitId || !['/commandes-clients', '/commandes-clients/scanner', '/courriers-confidentiels', '/caisse', '/comptabilite'].includes(href)) return href;
  return `${href}?unit=${unitId}`;
}

function filterNavigation(sections: NavigationSection[], allowedUnits: UnitId[], access: string[], admin: boolean, activeUnitId: UnitId | undefined, role: string) {
  return sections.map((section) => ({
    ...section,
    items: section.items.filter((item) => {
      if (admin) return true;
      if (item.href === '/courriers-confidentiels') return allowedUnits.length > 0 && hasAccessToRequirements(access, accessForNavigation(item.href, activeUnitId), role);
      if (item.href === '/dashboard' && !['PDG', 'DG', 'ADMINISTRATRICE'].includes(role.trim().toUpperCase())) return false;
      const itemUnit = unitForNavigation(item.href) ?? activeUnitId;
      if (itemUnit && !allowedUnits.includes(itemUnit)) return false;
      return hasAccessToRequirements(access, accessForNavigation(item.href, activeUnitId), role);
    }),
  })).filter((section) => section.items.length > 0);
}

function getBrowserCookie(name: string) { const part = document.cookie.split('; ').find((item) => item.startsWith(`${name}=`)); return part ? decodeURIComponent(part.slice(name.length + 1)) : ''; }

function sameNotificationIdentity(first: string, second: string) {
  const normalize = (value: string) => value.trim().toUpperCase() === 'ADMIN-MOVIC' ? 'MOVIC' : value.trim().toUpperCase();
  return normalize(first) === normalize(second);
}

function parseCookieArray(value: string | undefined) {
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

function MoreIcon() { return <span className="flex gap-0.5"><i className="h-1 w-1 rounded-full bg-current" /><i className="h-1 w-1 rounded-full bg-current" /><i className="h-1 w-1 rounded-full bg-current" /></span>; }
