'use client';

import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Check, Download, FileText, Inbox, LockKeyhole, MailWarning, Paperclip, Plus, Send, ShieldCheck, X } from 'lucide-react';
import { Modal, SectionHeading, StatCard } from '@/components/ui';

type ConfidentialAttachment = { id: string; fileName: string; mimeType: string; size: number };
type PendingAttachment = { fileName: string; mimeType: string; size: number; data: string };
type ConfidentialMessage = { id: string; createdAt: string; senderId: string; senderName: string; recipientId: string; recipientName: string; subject: string; body: string; attachments?: ConfidentialAttachment[]; status: 'Non lu' | 'Lu'; readAt: string };
type Recipient = { id: string; name: string; role: string };

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const MAX_TOTAL_SIZE = 10 * 1024 * 1024;

export function ConfidentialCorrespondenceView() {
  const [messages, setMessages] = useState<ConfidentialMessage[]>([]);
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [currentUserId, setCurrentUserId] = useState('');
  const [tab, setTab] = useState<'inbox' | 'sent'>('inbox');
  const [composeOpen, setComposeOpen] = useState(false);
  const [selected, setSelected] = useState<ConfidentialMessage | null>(null);
  const [attachments, setAttachments] = useState<PendingAttachment[]>([]);
  const [feedback, setFeedback] = useState('');

  useEffect(() => {
    const part = document.cookie.split('; ').find((item) => item.startsWith('agroflux_user_id='));
    if (part) setCurrentUserId(decodeURIComponent(part.slice('agroflux_user_id='.length)));
    void load();
  }, []);

  async function load() {
    try {
      const response = await fetch('/api/confidential-correspondence', { cache: 'no-store' });
      const data = await response.json() as { messages?: ConfidentialMessage[]; recipients?: Recipient[]; error?: string };
      if (response.ok) { setMessages((data.messages ?? []).map((message) => ({ ...message, attachments: message.attachments ?? [] }))); setRecipients(data.recipients ?? []); } else setFeedback(data.error ?? 'Accès refusé.');
    } catch { setFeedback('Le service de courrier confidentiel est indisponible.'); }
  }

  const inbox = useMemo(() => messages.filter((message) => message.recipientId === currentUserId), [messages, currentUserId]);
  const sent = useMemo(() => messages.filter((message) => message.senderId === currentUserId), [messages, currentUserId]);
  const visible = tab === 'inbox' ? inbox : sent;
  const unread = inbox.filter((message) => message.status === 'Non lu').length;

  function notify(message: string) { setFeedback(message); window.setTimeout(() => setFeedback(''), 4500); }

  async function selectAttachments(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = '';
    if (!files.length) return;
    if (attachments.length + files.length > 5) { notify('Un courrier ne peut pas contenir plus de 5 pièces jointes.'); return; }
    if (files.some((file) => file.size > MAX_FILE_SIZE)) { notify('Chaque pièce jointe doit peser au maximum 5 Mo.'); return; }
    const total = attachments.reduce((sum, attachment) => sum + attachment.size, 0) + files.reduce((sum, file) => sum + file.size, 0);
    if (total > MAX_TOTAL_SIZE) { notify('La taille totale des pièces jointes ne doit pas dépasser 10 Mo.'); return; }
    try {
      const next = await Promise.all(files.map(async (file) => ({ fileName: file.name, mimeType: file.type || 'application/octet-stream', size: file.size, data: await fileToDataUrl(file) })));
      setAttachments((current) => [...current, ...next]);
    } catch { notify('Une pièce jointe n’a pas pu être chargée.'); }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const response = await fetch('/api/confidential-correspondence', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ recipientId: String(form.get('recipientId') ?? ''), subject: String(form.get('subject') ?? ''), body: String(form.get('body') ?? ''), attachments }) });
    const data = await response.json() as { message?: ConfidentialMessage; error?: string };
    if (!response.ok) { notify(data.error ?? 'Envoi impossible.'); return; }
    setMessages((current) => [{ ...data.message!, attachments: data.message?.attachments ?? [] }, ...current]);
    setAttachments([]);
    setComposeOpen(false);
    notify('Le courrier confidentiel et ses pièces jointes ont été envoyés.');
  }

  async function openMessage(message: ConfidentialMessage) {
    setSelected(message);
    if (message.recipientId === currentUserId && message.status === 'Non lu') {
      const response = await fetch('/api/confidential-correspondence', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: message.id }) });
      const data = await response.json() as { message?: ConfidentialMessage };
      if (response.ok && data.message) setMessages((current) => current.map((item) => item.id === message.id ? { ...data.message!, attachments: data.message?.attachments ?? [] } : item));
    }
  }

  return <div className="fade-in space-y-7"><div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between"><div><Link href="/dashboard" className="mb-4 inline-flex items-center gap-2 text-[11px] font-bold text-[#6c8176] hover:text-forest">← Retour au dashboard</Link><p className="eyebrow mb-2">Communication · Confidentiel</p><h1 className="page-title">Courriers confidentiels</h1><p className="muted mt-2 max-w-2xl text-[13px] leading-5">Adressez un courrier à RH, PDG ou DG, avec des pièces jointes comme dans un email. Les contenus et fichiers restent privés entre l’expéditeur et le destinataire.</p></div><button className="btn-primary" onClick={() => { setAttachments([]); setComposeOpen(true); }}><Plus size={15} /> Nouveau courrier</button></div><div className="flex items-start gap-3 rounded-xl border border-[#e2d9f0] bg-[#f7f2fc] px-4 py-3 text-[11px] leading-5 text-[#70578f]"><LockKeyhole size={16} className="mt-0.5 shrink-0" /><span><strong>Confidentialité :</strong> le message et les pièces jointes sont chiffrés côté serveur. Seuls l’expéditeur et le destinataire peuvent les consulter.</span></div>{feedback && <div className="flex items-center gap-2 rounded-xl border border-[#cde8c7] bg-[#effaeb] px-4 py-3 text-[12px] font-semibold text-[#4d8f51]"><Check size={14} />{feedback}</div>}<div className="grid gap-4 sm:grid-cols-3"><StatCard label="Courriers reçus" value={String(inbox.length)} change={unread ? `${unread} non lu(s)` : 'Tout est lu'} detail="accès privé" icon={Inbox} tone="blue" /><StatCard label="Courriers envoyés" value={String(sent.length)} change="historique personnel" detail="vos signalements" icon={Send} tone="purple" /><StatCard label="Destinataires" value={String(recipients.length)} change="RH · PDG · DG" detail="répertoire restreint" icon={ShieldCheck} tone="green" /></div><div className="surface overflow-hidden"><div className="flex gap-2 border-b border-[#edf0eb] px-5 pt-5"><button className={`rounded-t-lg px-3 py-2.5 text-[11px] font-bold ${tab === 'inbox' ? 'border-b-2 border-[#5b9d5b] text-[#4d9352]' : 'text-[#89968f]'}`} onClick={() => setTab('inbox')}><Inbox size={14} className="mr-1 inline" /> Réception {unread ? `(${unread})` : ''}</button><button className={`rounded-t-lg px-3 py-2.5 text-[11px] font-bold ${tab === 'sent' ? 'border-b-2 border-[#5b9d5b] text-[#4d9352]' : 'text-[#89968f]'}`} onClick={() => setTab('sent')}><Send size={14} className="mr-1 inline" /> Envoyés</button></div><div className="divide-y divide-[#edf0eb]">{visible.length ? visible.map((message) => <button key={message.id} className={`flex w-full items-start gap-3 px-5 py-4 text-left transition hover:bg-[#f8fbf7] ${message.status === 'Non lu' && tab === 'inbox' ? 'bg-[#fffaf0]' : ''}`} onClick={() => void openMessage(message)}><span className={`mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${message.status === 'Non lu' ? 'bg-[#fff2e2] text-[#bd7737]' : 'bg-[#edf8e9] text-[#5b9d5b]'}`}><MailWarning size={15} /></span><span className="min-w-0 flex-1"><span className="flex flex-wrap items-center justify-between gap-2"><strong className="truncate text-[12px] text-ink">{message.subject}</strong><small className="text-[9px] text-[#89968f]">{new Date(message.createdAt).toLocaleString('fr-FR')}</small></span><span className="mt-1 block text-[10px] text-[#718078]">{tab === 'inbox' ? `De : ${message.senderName}` : `À : ${message.recipientName}`}</span><span className="mt-2 block truncate text-[10px] text-[#89968f]">{message.body}</span>{message.attachments?.length ? <span className="mt-2 flex items-center gap-1 text-[10px] font-semibold text-[#6385bd]"><Paperclip size={12} /> {message.attachments.length} pièce{message.attachments.length > 1 ? 's' : ''} jointe{message.attachments.length > 1 ? 's' : ''}</span> : null}</span>{message.status === 'Non lu' && tab === 'inbox' && <span className="rounded-full bg-[#e9975c] px-2 py-1 text-[9px] font-bold text-white">Nouveau</span>}</button>) : <div className="px-6 py-16 text-center text-[11px] text-[#89968f]">Aucun courrier confidentiel dans cette boîte.</div>}</div></div><Modal open={composeOpen} onClose={() => setComposeOpen(false)} title="Nouveau courrier confidentiel"><form onSubmit={submit} className="space-y-5"><div className="rounded-xl border border-[#e2d9f0] bg-[#f7f2fc] p-3 text-[11px] leading-5 text-[#70578f]">Votre identité sera visible uniquement par le destinataire du courrier et par vous dans vos courriers envoyés. Maximum : 5 fichiers et 10 Mo au total.</div><label className="block"><span className="field-label">Destinataire</span><select name="recipientId" className="input-base" required><option value="">Choisir RH, PDG ou DG</option>{recipients.map((recipient) => <option key={recipient.id} value={recipient.id}>{recipient.name} · {recipient.role}</option>)}</select></label><label className="block"><span className="field-label">Objet</span><input name="subject" className="input-base" placeholder="Objet du courrier" required /></label><label className="block"><span className="field-label">Message</span><textarea name="body" className="input-base min-h-[180px] resize-y" placeholder="Rédigez votre courrier confidentiel..." required /></label><div><span className="field-label">Pièces jointes</span><label className="mt-1 flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-[#cbdccc] bg-[#f8fbf7] px-4 py-3 text-[11px] font-bold text-[#5b8f60] hover:bg-[#f1f8ef]"><Paperclip size={15} /> Ajouter un fichier<input type="file" multiple accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt" className="hidden" onChange={(event) => void selectAttachments(event)} /></label>{attachments.length > 0 && <div className="mt-2 space-y-2">{attachments.map((attachment, index) => <div key={`${attachment.fileName}-${index}`} className="flex items-center gap-2 rounded-lg border border-[#edf0eb] bg-white px-3 py-2 text-[10px]"><FileText size={14} className="text-[#6385bd]" /><span className="min-w-0 flex-1 truncate font-semibold text-ink">{attachment.fileName}</span><span className="text-[#89968f]">{formatBytes(attachment.size)}</span><button type="button" className="text-[#b45d5d]" onClick={() => setAttachments((current) => current.filter((_, currentIndex) => currentIndex !== index))} aria-label={`Retirer ${attachment.fileName}`}><X size={14} /></button></div>)}</div>}</div><div className="flex justify-end gap-2"><button type="button" className="btn-secondary" onClick={() => setComposeOpen(false)}><X size={14} /> Annuler</button><button type="submit" className="btn-primary"><Send size={15} /> Envoyer confidentiellement</button></div></form></Modal>{selected && <div className="fixed inset-0 z-[80] flex items-center justify-center bg-[#102d23]/35 p-4" onMouseDown={() => setSelected(null)}><div className="surface max-h-[90vh] w-full max-w-2xl overflow-auto p-6" onMouseDown={(event) => event.stopPropagation()}><div className="flex items-start justify-between gap-3"><div><p className="eyebrow">Courrier confidentiel</p><h2 className="mt-1 text-xl font-black text-forest">{selected.subject}</h2><p className="mt-1 text-[10px] text-[#89968f]">De : {selected.senderName} · À : {selected.recipientName} · {new Date(selected.createdAt).toLocaleString('fr-FR')}</p></div><button className="icon-btn h-8 w-8" onClick={() => setSelected(null)} aria-label="Fermer"><X size={15} /></button></div><div className="mt-6 whitespace-pre-wrap rounded-xl border border-[#edf0eb] bg-[#fbfcfa] p-5 text-[12px] leading-6 text-[#44564b]">{selected.body}</div>{selected.attachments?.length ? <div className="mt-5"><p className="field-label">Pièces jointes</p><div className="mt-2 space-y-2">{selected.attachments.map((attachment) => <a key={attachment.id} href={`/api/confidential-correspondence/${selected.id}/attachments/${attachment.id}`} className="flex items-center gap-3 rounded-xl border border-[#dce8db] bg-[#f7fbf5] px-3 py-3 text-[11px] font-semibold text-[#53675b] hover:bg-[#eef8eb]" download><FileText size={16} className="text-[#6385bd]" /><span className="min-w-0 flex-1 truncate">{attachment.fileName}</span><span className="text-[10px] text-[#89968f]">{formatBytes(attachment.size)}</span><Download size={14} className="text-[#5b9d5b]" /></a>)}</div></div> : null}</div></div>}</div>;
}

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('Fichier illisible'));
    reader.onerror = () => reject(reader.error ?? new Error('Fichier illisible'));
    reader.readAsDataURL(file);
  });
}

function formatBytes(value: number) {
  if (value < 1024) return `${value} o`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(0)} Ko`;
  return `${(value / (1024 * 1024)).toFixed(1)} Mo`;
}
