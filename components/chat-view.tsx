'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Check, CheckCheck, ChevronLeft, MessageCircle, Plus, Search, Send, ShieldCheck, UserPlus, Users, X } from 'lucide-react';
import { units, type UnitId } from '@/lib/data';
import { FARM_STORAGE_KEYS, readLocal, subscribeToFarmData, writeLocal } from '@/lib/farm-storage';
import { hasSharedUnit, unitIdsFromUser, unitLabelsFromIds } from '@/lib/user-access';
import { Modal, StatCard } from '@/components/ui';

type ChatUser = {
  id: string;
  name: string;
  identifier: string;
  role: string;
  unit: string;
  allowedUnits: string[];
  status: 'Actif' | 'Invité' | 'Suspendu';
  initials: string;
  isAdmin?: boolean;
};

type ChatMessage = {
  id: string;
  conversationId: string;
  senderId: string;
  recipientId: string;
  text: string;
  createdAt: string;
  readBy: string[];
};

const MAIN_ADMIN_ID = 'MOVIC';
const MAIN_ADMIN_USER: ChatUser = {
  id: MAIN_ADMIN_ID,
  name: 'MOVIC',
  identifier: 'MOVIC',
  role: 'Administratrice',
  unit: 'Administration',
  allowedUnits: units.map((unit) => unit.id),
  status: 'Actif',
  initials: 'MV',
  isAdmin: true,
};

export function ChatView({ contextUnitId }: { contextUnitId?: UnitId }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [users, setUsers] = useState<ChatUser[]>([]);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [query, setQuery] = useState('');
  const [messageText, setMessageText] = useState('');
  const [newConversationOpen, setNewConversationOpen] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [currentUser, setCurrentUser] = useState<ChatUser | null>(null);
  const [identityReady, setIdentityReady] = useState(false);

  useEffect(() => {
    const identity = readSessionIdentity();
    setCurrentUser(identity);
    setIdentityReady(true);
  }, []);

  const currentUserId = currentUser?.id ?? '';
  const storageKey = currentUser ? storageKeyForUser(currentUser.id) : '';
  const contextUnit = contextUnitId ? units.find((unit) => unit.id === contextUnitId) : undefined;

  useEffect(() => {
    if (!currentUser) return undefined;
    let disposed = false;

    const load = async () => {
      const localUsers = readLocal<StoredChatUser[]>(FARM_STORAGE_KEYS.users, []);
      let remoteUsers: ChatUser[] = [];
      try {
        const response = await fetch('/api/chat/contacts', { cache: 'no-store' });
        if (response.ok) {
          const data = await response.json() as { users?: ChatUser[] };
          remoteUsers = Array.isArray(data.users) ? data.users : [];
        }
      } catch {
        // Le mode local continue de fonctionner si l’API des contacts n’est pas disponible.
      }

      const storedMessages = readLocal<ChatMessage[]>(storageKey, []);
      if (disposed) return;
      setMessages(storedMessages);

      const candidates = dedupeUsers([
        MAIN_ADMIN_USER,
        ...remoteUsers,
        ...localUsers.map(toChatUser),
      ]);
      setUsers(candidates);
    };

    void load();
    return subscribeToFarmData([FARM_STORAGE_KEYS.users, storageKey], () => { void load(); });
  }, [currentUser, storageKey]);

  const contextAllowed = useCallback((target: ChatUser) => !contextUnitId || unitIdsFromUser(target.allowedUnits).includes(contextUnitId), [contextUnitId]);
  const canStartConversation = useCallback((target: ChatUser) => {
    if (!currentUser || sameIdentity(target.id, currentUser.id) || target.status === 'Suspendu') return false;
    if (currentUser.isAdmin) return true;
    if (isMainAdministrator(target) || !hasSharedUnit(currentUser, target)) return false;
    return contextAllowed(target);
  }, [contextAllowed, currentUser]);
  const hasAdminInitiatedConversation = useCallback((target: ChatUser) => {
    if (!currentUser || !isMainAdministrator(target)) return false;
    const expectedConversation = conversationId(currentUser.id, target.id);
    return messages.some((message) => message.conversationId === expectedConversation && sameIdentity(message.senderId, target.id) && sameIdentity(message.recipientId, currentUser.id));
  }, [currentUser, messages]);
  const canSendMessage = (target: ChatUser) => canStartConversation(target) || hasAdminInitiatedConversation(target);

  const conversationUsers = useMemo(
    () => users.filter((user) => canStartConversation(user) || hasAdminInitiatedConversation(user)),
    [canStartConversation, hasAdminInitiatedConversation, users],
  );
  const startableUsers = useMemo(() => users.filter((user) => canStartConversation(user)), [canStartConversation, users]);
  const selectedUser = conversationUsers.find((user) => sameIdentity(user.id, selectedUserId));
  const visibleUsers = useMemo(
    () => conversationUsers.filter((user) => `${user.name} ${user.identifier} ${user.role} ${user.unit}`.toLowerCase().includes(query.toLowerCase())),
    [conversationUsers, query],
  );
  const selectedMessages = useMemo(
    () => selectedUser
      ? messages.filter((message) => message.conversationId === conversationId(currentUserId, selectedUser.id)).sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      : [],
    [currentUserId, messages, selectedUser],
  );

  function notify(message: string) {
    setFeedback(message);
    window.setTimeout(() => setFeedback(''), 3800);
  }

  function selectUser(userId: string) {
    const target = conversationUsers.find((user) => sameIdentity(user.id, userId));
    if (!target) return;
    setSelectedUserId(target.id);
    setNewConversationOpen(false);
    setMessages((current) => {
      const next = current.map((message) => message.recipientId === currentUserId && sameIdentity(message.senderId, target.id) && !message.readBy.includes(currentUserId)
        ? { ...message, readBy: [...message.readBy, currentUserId] }
        : message);
      writeLocal(storageKey, next);
      return next;
    });
  }

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = messageText.trim();
    if (!selectedUser || !text) return;

    // Ce contrôle est volontairement répété au moment de l’envoi. Une personne
    // ne peut donc pas contourner le filtre en injectant un autre identifiant
    // dans l’état de l’interface.
    if (!canSendMessage(selectedUser)) {
      notify('Message bloqué : ce destinataire ne partage aucune unité autorisée avec vous.');
      return;
    }

    try {
      const authorization = await fetch('/api/chat/authorize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipientId: selectedUser.id, contextUnitId }),
      });
      if (!authorization.ok) {
        const data = await authorization.json().catch(() => ({})) as { error?: string };
        notify(data.error ?? 'Message bloqué par les droits de la session.');
        return;
      }
    } catch {
      notify('Message non envoyé : le contrôle serveur est indisponible.');
      return;
    }

    const now = new Date().toISOString();
    const message: ChatMessage = {
      id: `MSG-${Date.now()}`,
      conversationId: conversationId(currentUserId, selectedUser.id),
      senderId: currentUserId,
      recipientId: selectedUser.id,
      text,
      createdAt: now,
      readBy: [currentUserId],
    };
    const currentMessages = readLocal<ChatMessage[]>(storageKey, []);
    const next = [...currentMessages, message];
    writeLocal(storageKey, next);
    setMessages(next);

    const recipientKey = storageKeyForUser(selectedUser.id);
    const recipientMessages = readLocal<ChatMessage[]>(recipientKey, []);
    writeLocal(recipientKey, [...recipientMessages, message]);
    setMessageText('');
  }

  function handleComposerKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      event.currentTarget.form?.requestSubmit();
    }
  }

  const latestByUser = (userId: string) => messages
    .filter((message) => message.conversationId === conversationId(currentUserId, userId))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  const unreadByUser = (userId: string) => messages
    .filter((message) => message.conversationId === conversationId(currentUserId, userId) && sameIdentity(message.senderId, userId) && !message.readBy.includes(currentUserId)).length;
  const orderedUsers = [...visibleUsers].sort((a, b) => (latestByUser(b.id)?.createdAt ?? '').localeCompare(latestByUser(a.id)?.createdAt ?? '') || a.name.localeCompare(b.name));
  const unreadTotal = conversationUsers.reduce((sum, user) => sum + unreadByUser(user.id), 0);
  const returnHref = contextUnitId ? `/dashboard/${contextUnitId}` : currentUser?.isAdmin ? '/dashboard-admin' : '/dashboard';

  if (!identityReady || !currentUser) {
    return <div className="surface flex min-h-[300px] items-center justify-center text-[12px] text-[#89968f]">Chargement de votre identité…</div>;
  }

  return <div className="fade-in space-y-6">
    <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <Link href={returnHref} className="mb-4 inline-flex items-center gap-2 text-[11px] font-bold text-[#6c8176] hover:text-forest">← Retour au dashboard</Link>
        <p className="eyebrow mb-2">{contextUnit ? `${contextUnit.label} · Communication` : 'Communication · Interne'}</p>
        <h1 className="page-title">Messagerie privée</h1>
        <p className="muted mt-2 max-w-2xl text-[13px]">Échangez uniquement avec les utilisateurs qui partagent une unité autorisée avec vous. MOVIC conserve l’accès global de supervision.</p>
      </div>
      <div className="flex flex-wrap gap-2"><button className="btn-primary" onClick={() => setNewConversationOpen(true)}><Plus size={15} /> Nouvelle conversation</button></div>
    </div>
    <div className="flex items-start gap-3 rounded-xl border border-[#f1ddbc] bg-[#fff9ed] px-4 py-3 text-[11px] leading-5 text-[#986c3e]"><ShieldCheck size={16} className="mt-0.5 shrink-0" /><span><strong>Périmètre de confidentialité :</strong> cette liste et l’envoi sont contrôlés par les unités autorisées de votre session. L’historique reste encore local à ce navigateur jusqu’au branchement d’une base de données partagée.</span></div>
    {feedback && <div className="flex items-center gap-2 rounded-xl border border-[#cde8c7] bg-[#effaeb] px-4 py-3 text-[12px] font-semibold text-[#4d8f51]"><Check size={14} />{feedback}</div>}
    <div className="grid gap-4 sm:grid-cols-3"><StatCard label="Contacts disponibles" value={String(conversationUsers.length)} change={contextUnit ? contextUnit.label : currentUser.isAdmin ? 'toutes unités' : 'unités en commun'} detail="utilisateurs autorisés" icon={Users} tone="green" /><StatCard label="Conversations" value={String(conversationUsers.filter((user) => Boolean(latestByUser(user.id))).length)} change="historique local" detail="dans cet espace" icon={MessageCircle} tone="blue" /><StatCard label="Messages non lus" value={String(unreadTotal)} change={unreadTotal ? 'À consulter' : 'Aucun'} detail="pour l’utilisateur actuel" icon={CheckCheck} tone="orange" /></div>
    <div className="surface min-h-[610px] overflow-hidden md:grid md:grid-cols-[320px_minmax(0,1fr)]">
      <aside className="border-b border-[#edf0eb] md:border-b-0 md:border-r">
        <div className="flex items-center justify-between border-b border-[#edf0eb] px-4 py-4"><div><p className="eyebrow">Messagerie</p><h2 className="mt-1 text-[16px] font-bold text-ink">Conversations</h2></div><button className="icon-btn h-9 w-9" onClick={() => setNewConversationOpen(true)} aria-label="Nouvelle conversation"><Plus size={16} /></button></div>
        <div className="border-b border-[#edf0eb] p-3"><div className="relative"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9aa69f]" /><input value={query} onChange={(event) => setQuery(event.target.value)} className="input-base h-9 rounded-lg bg-[#fbfcfa] pl-9 text-[11px]" placeholder="Rechercher un utilisateur..." /></div></div>
        <div className="max-h-[475px] overflow-y-auto p-2">{orderedUsers.length ? orderedUsers.map((user) => { const latest = latestByUser(user.id); const unread = unreadByUser(user.id); return <button key={user.id} className={`flex w-full items-center gap-3 rounded-xl p-3 text-left transition ${selectedUserId === user.id ? 'bg-[#edf8e9]' : 'hover:bg-[#f7faf5]'}`} onClick={() => selectUser(user.id)}><span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#dff3d9] text-[11px] font-black text-[#49884d]">{user.initials}<span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-white bg-[#72bd76]" /></span><span className="min-w-0 flex-1"><span className="flex items-center justify-between gap-2"><strong className="truncate text-[11px] text-ink">{user.name}</strong>{latest && <small className="shrink-0 text-[9px] text-[#9aa59f]">{formatTime(latest.createdAt)}</small>}</span><span className="mt-1 flex items-center justify-between gap-2"><small className="truncate text-[10px] text-[#87958d]">{latest?.text ?? `${user.role} · ${user.unit}`}</small>{unread > 0 && <b className="flex h-4 min-w-4 items-center justify-center rounded-full bg-[#5b9d5b] px-1 text-[9px] text-white">{unread}</b>}</span></span></button>; }) : <div className="px-4 py-12 text-center"><Users size={27} className="mx-auto text-[#b4c3b7]" /><p className="mt-3 text-[12px] font-bold text-ink">Aucun contact disponible</p><p className="mt-1 text-[10px] leading-5 text-[#89968f]">Aucun utilisateur ne partage une unité autorisée avec cette session.</p></div>}</div>
      </aside>
      <section className="flex min-h-[610px] flex-col bg-[#fbfcfa]">{selectedUser ? <><header className="flex items-center gap-3 border-b border-[#edf0eb] bg-white px-5 py-4"><button className="icon-btn h-8 w-8 md:hidden" onClick={() => setSelectedUserId('')} aria-label="Retour aux conversations"><ChevronLeft size={16} /></button><span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#dff3d9] text-[11px] font-black text-[#49884d]">{selectedUser.initials}</span><div className="min-w-0 flex-1"><h2 className="truncate text-[13px] font-bold text-ink">{selectedUser.name}</h2><p className="mt-1 truncate text-[10px] text-[#87958d]">{selectedUser.role} · {selectedUser.unit} · {selectedUser.identifier}</p></div><span className="rounded-full bg-[#edf8e9] px-2.5 py-1 text-[9px] font-bold text-[#5b9d5b]">{selectedUser.isAdmin ? 'Administration' : 'Autorisé'}</span></header><div className="flex-1 space-y-3 overflow-y-auto px-4 py-5 sm:px-8">{selectedMessages.length ? <>{selectedMessages.map((message) => <div key={message.id} className={`flex ${sameIdentity(message.senderId, currentUserId) ? 'justify-end' : 'justify-start'}`}><div className={`max-w-[78%] rounded-2xl px-4 py-3 shadow-sm ${sameIdentity(message.senderId, currentUserId) ? 'rounded-br-md bg-[#2f6850] text-white' : 'rounded-bl-md border border-[#e3ebe2] bg-white text-ink'}`}><p className="whitespace-pre-wrap text-[12px] leading-5">{message.text}</p><div className={`mt-2 flex items-center justify-end gap-1 text-[9px] ${sameIdentity(message.senderId, currentUserId) ? 'text-[#c5e5c6]' : 'text-[#9aa59f]'}`}><span>{formatTime(message.createdAt)}</span>{sameIdentity(message.senderId, currentUserId) && (message.readBy.includes(selectedUser.id) ? <CheckCheck size={12} /> : <Check size={12} />)}</div></div></div>)}<div className="pt-2 text-center text-[9px] text-[#a0aaa4]">Historique de la conversation avec {selectedUser.name}</div></> : <div className="flex h-full min-h-[330px] flex-col items-center justify-center text-center"><span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#edf8e9] text-[#5b9d5b]"><MessageCircle size={26} /></span><h3 className="mt-4 text-[14px] font-bold text-ink">Commencer la conversation</h3><p className="mt-2 max-w-xs text-[11px] leading-5 text-[#89968f]">Envoyez un message à {selectedUser.name}. Votre historique sera rattaché à cette conversation.</p></div>}</div><form onSubmit={sendMessage} className="border-t border-[#edf0eb] bg-white p-4"><div className="flex items-end gap-2 rounded-2xl border border-[#dfe8df] bg-[#fbfcfa] p-2 focus-within:border-[#8bc884]"><textarea value={messageText} onChange={(event) => setMessageText(event.target.value)} onKeyDown={handleComposerKeyDown} className="max-h-32 min-h-[42px] flex-1 resize-none border-0 bg-transparent px-2 py-2 text-[12px] leading-5 outline-none placeholder:text-[#a0aaa4]" placeholder="Écrire un message..." aria-label="Message" /><button type="submit" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#2f6850] text-white transition hover:bg-[#24563f] disabled:cursor-not-allowed disabled:opacity-40" disabled={!messageText.trim()} aria-label="Envoyer"><Send size={16} /></button></div><p className="mt-2 px-2 text-[9px] text-[#9aa59f]">Entrée pour envoyer · Maj + Entrée pour une nouvelle ligne</p></form></> : <div className="flex flex-1 flex-col items-center justify-center px-8 text-center"><span className="flex h-16 w-16 items-center justify-center rounded-3xl bg-[#edf8e9] text-[#5b9d5b]"><MessageCircle size={30} /></span><h2 className="mt-5 text-[18px] font-bold tracking-[-.03em] text-ink">Votre messagerie interne</h2><p className="mt-2 max-w-sm text-[12px] leading-5 text-[#89968f]">Sélectionnez une conversation ou démarrez un nouvel échange avec un utilisateur de votre périmètre.</p><button className="btn-primary mt-5" onClick={() => setNewConversationOpen(true)}><UserPlus size={15} /> Choisir un utilisateur</button></div>}</section>
    </div>
    <Modal open={newConversationOpen} onClose={() => setNewConversationOpen(false)} title="Nouvelle conversation"><div className="space-y-3"><p className="muted text-[11px] leading-5">Choisissez uniquement un utilisateur partageant une unité autorisée avec vous.</p>{startableUsers.length ? startableUsers.map((user) => <button key={user.id} className="flex w-full items-center gap-3 rounded-xl border border-[#edf0eb] p-3 text-left transition hover:border-[#bcdcbc] hover:bg-[#f7fbf5]" onClick={() => selectUser(user.id)}><span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#dff3d9] text-[10px] font-black text-[#49884d]">{user.initials}</span><span className="min-w-0 flex-1"><strong className="block text-[11px] text-ink">{user.name}</strong><small className="mt-1 block truncate text-[10px] text-[#87958d]">{user.role} · {user.unit}</small></span><span className="text-[10px] font-bold text-[#5b9d5b]">Ouvrir</span></button>) : <div className="rounded-xl border border-dashed border-[#dce8db] px-4 py-7 text-center text-[11px] text-[#89968f]">Aucun utilisateur actif dans votre périmètre.</div>}<button className="btn-secondary mt-2 w-full" onClick={() => setNewConversationOpen(false)}><X size={14} /> Fermer</button></div></Modal>
  </div>;
}

type StoredChatUser = {
  id: string;
  initials?: string;
  name: string;
  identifier: string;
  role: string;
  unit: string;
  allowedUnits?: string[];
  status: 'Actif' | 'Invité' | 'Suspendu';
};

function readSessionIdentity(): ChatUser | null {
  const userId = getCookie('agroflux_user_id');
  if (!userId) return null;
  const managed = readLocal<StoredChatUser[]>(FARM_STORAGE_KEYS.users, []).find((user) => sameIdentity(user.id, userId) || user.identifier.toLowerCase() === userId.toLowerCase());
  const admin = getCookie('agroflux_is_admin') === '1' || canonicalIdentity(userId) === MAIN_ADMIN_ID;
  const cookieAllowedUnits = readJsonCookie<string[]>('agroflux_allowed_units');
  const allowedUnits = admin ? units.map((unit) => unit.id) : cookieAllowedUnits ?? managed?.allowedUnits ?? [];
  const name = getCookie('agroflux_user_name') || managed?.name || userId;
  const identifier = managed?.identifier || userId;
  return {
    id: userId,
    name,
    identifier,
    role: admin ? 'Administratrice' : getCookie('agroflux_role') || managed?.role || 'Utilisateur',
    unit: unitLabelsFromIds(allowedUnits).join(' · '),
    allowedUnits,
    status: managed?.status || 'Actif',
    initials: managed?.initials || name.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase(),
    isAdmin: admin,
  };
}

function toChatUser(user: StoredChatUser): ChatUser {
  return {
    id: user.id,
    name: user.name,
    identifier: user.identifier,
    role: user.role,
    unit: unitLabelsFromIds(user.allowedUnits ?? []).join(' · '),
    allowedUnits: user.allowedUnits ?? [],
    status: user.status,
    initials: user.initials ?? user.name.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase(),
    isAdmin: isMainAdministrator(user),
  };
}

function dedupeUsers(candidates: ChatUser[]) {
  return candidates.filter((user, index, list) => list.findIndex((item) => sameIdentity(item.id, user.id) || item.identifier.toLowerCase() === user.identifier.toLowerCase()) === index);
}

function isMainAdministrator(user: { id: string; identifier: string; isAdmin?: boolean }) {
  return Boolean(user.isAdmin) || canonicalIdentity(user.id) === MAIN_ADMIN_ID || canonicalIdentity(user.identifier) === MAIN_ADMIN_ID;
}

function canonicalIdentity(value: string) {
  const normalized = value.trim().toUpperCase();
  return normalized === 'MOVIC' || normalized === 'ADMIN-MOVIC' ? MAIN_ADMIN_ID : value;
}

function sameIdentity(first: string, second: string) {
  return canonicalIdentity(first) === canonicalIdentity(second);
}

function conversationId(first: string, second: string) {
  return [canonicalIdentity(first), canonicalIdentity(second)].sort().join('::');
}

function storageKeyForUser(id: string) {
  return `${FARM_STORAGE_KEYS.chatMessages}:${canonicalIdentity(id)}`;
}

function readJsonCookie<T>(name: string): T | undefined {
  let value = getCookie(name);
  if (!value) return undefined;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return JSON.parse(value) as T;
    } catch {
      try { value = decodeURIComponent(value); } catch { return undefined; }
    }
  }
  return undefined;
}

function getCookie(name: string) {
  if (typeof document === 'undefined') return '';
  const part = document.cookie.split('; ').find((item) => item.startsWith(`${name}=`));
  return part ? decodeURIComponent(part.slice(name.length + 1)) : '';
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' }).format(new Date(value));
}
