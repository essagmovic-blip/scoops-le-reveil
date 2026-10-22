'use client';

import { FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import { Building2, Check, Edit3, Eye, EyeOff, FileCog, Globe2, Plus, Save, ShieldCheck, Trash2, Users, Video } from 'lucide-react';
import { Modal, SectionHeading } from '@/components/ui';
import { FARM_STORAGE_KEYS, readLocal, writeLocal } from '@/lib/farm-storage';
import { getYouTubeVideoId, type PublicPromoVideo } from '@/lib/public-site';

export function AdminSettingsView() {
  const [saved, setSaved] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({});
  const [promoVideos, setPromoVideos] = useState<PublicPromoVideo[]>([]);
  const [videoOpen, setVideoOpen] = useState(false);
  const [editingVideo, setEditingVideo] = useState<PublicPromoVideo | null>(null);
  const [videoFeedback, setVideoFeedback] = useState('');

  useEffect(() => {
    const settings = readLocal<Record<string, unknown>>('agroflux-settings-global', {});
    setValues(Object.fromEntries(Object.entries(settings).map(([key, value]) => [key, String(value)])));
    setPromoVideos(readLocal<PublicPromoVideo[]>(FARM_STORAGE_KEYS.publicPromoVideos, []));
  }, []);

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const next = Object.fromEntries(Array.from(form.entries()).map(([key, value]) => [key, String(value)]));
    writeLocal('agroflux-settings-global', { ...next, savedAt: new Date().toISOString() });
    setValues(next);
    setSaved(true);
    window.setTimeout(() => setSaved(false), 5000);
  }

  const field = (name: string, label: string, value: string, type = 'text') => (
    <label className="block">
      <span className="field-label">{label}</span>
      <input name={name} type={type} className="input-base" defaultValue={values[name] ?? value} />
    </label>
  );

  function notifyVideo(message: string) {
    setVideoFeedback(message);
    window.setTimeout(() => setVideoFeedback(''), 4500);
  }

  function openNewVideo() {
    setEditingVideo(null);
    setVideoOpen(true);
  }

  function openEditVideo(video: PublicPromoVideo) {
    setEditingVideo(video);
    setVideoOpen(true);
  }

  function saveVideo(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const title = String(form.get('title') ?? '').trim();
    const description = String(form.get('description') ?? '').trim();
    const youtubeUrl = String(form.get('youtubeUrl') ?? '').trim();
    const videoId = getYouTubeVideoId(youtubeUrl);
    if (!title || !videoId) {
      notifyVideo(!title ? 'Le titre de la vidéo est obligatoire.' : 'Veuillez saisir un lien YouTube valide.');
      return;
    }
    const rawOrder = Number(form.get('order') ?? promoVideos.length + 1);
    const order = Number.isFinite(rawOrder) && rawOrder > 0 ? Math.round(rawOrder) : promoVideos.length + 1;
    const item: PublicPromoVideo = {
      id: editingVideo?.id ?? `VIDEO-${Date.now()}`,
      title,
      description,
      youtubeUrl,
      active: form.get('active') === 'on',
      order,
    };
    const next = editingVideo
      ? promoVideos.map((current) => current.id === editingVideo.id ? item : current)
      : [...promoVideos, item];
    setPromoVideos(next);
    writeLocal(FARM_STORAGE_KEYS.publicPromoVideos, next);
    setVideoOpen(false);
    setEditingVideo(null);
    notifyVideo(`La vidéo « ${title} » a été ${editingVideo ? 'modifiée' : 'ajoutée'}.`);
  }

  function toggleVideo(video: PublicPromoVideo) {
    const next = promoVideos.map((item) => item.id === video.id ? { ...item, active: !item.active } : item);
    setPromoVideos(next);
    writeLocal(FARM_STORAGE_KEYS.publicPromoVideos, next);
    notifyVideo(video.active ? 'La vidéo a été retirée de la page d’accueil.' : 'La vidéo est maintenant visible sur la page d’accueil.');
  }

  function deleteVideo(video: PublicPromoVideo) {
    if (!window.confirm(`Supprimer définitivement la vidéo « ${video.title} » ?`)) return;
    const next = promoVideos.filter((item) => item.id !== video.id);
    setPromoVideos(next);
    writeLocal(FARM_STORAGE_KEYS.publicPromoVideos, next);
    notifyVideo('La vidéo a été supprimée.');
  }

  const orderedVideos = [...promoVideos].sort((a, b) => a.order - b.order || a.title.localeCompare(b.title, 'fr'));

  return (
    <div className="fade-in space-y-7">
      <div>
        <p className="eyebrow mb-2">Administration · Configuration globale</p>
        <h1 className="page-title">Réglages globaux du SaaS</h1>
        <p className="muted mt-2 max-w-2xl text-[13px]">Ces informations concernent SCOOPS LE REVEIL dans son ensemble. Les paramètres propres à chaque unité restent dans leur espace respectif.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        <AdminSettingLink href="/dashboard-admin/utilisateurs" icon={Users} label="Utilisateurs globaux" />
        <AdminSettingLink href="/dashboard-admin/unites" icon={Building2} label="Gestion des unités" />
        <AdminSettingLink href="/dashboard-admin/communication" icon={Globe2} label="Communication publique" />
        <AdminSettingLink href="/dashboard-admin/parametres" icon={FileCog} label="Réglages généraux" active />
      </div>

      <form key={`settings-${String(values.savedAt ?? 'default')}`} onSubmit={save} className="surface p-5 sm:p-7">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#edf8e9] text-[#5b9d5b]"><Building2 size={18} /></span>
          <div><h2 className="text-[17px] font-bold text-ink">Identité de la société</h2><p className="mt-1 text-[11px] text-[#87958d]">Ces informations sont utilisables par les pages et documents publics.</p></div>
        </div>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {field('companyName', 'Nom légal', 'SOCIETE COOPERATIVE SIMPLIFIEE')}
          {field('companyBrand', 'Nom commercial', 'SCOOPS LE REVEIL')}
          {field('companyCity', 'Ville', 'Obala')}
          {field('companyPhone', 'Téléphone', '')}
          {field('companyEmail', 'Email', '', 'email')}
          <label className="block sm:col-span-2"><span className="field-label">Adresse</span><textarea name="companyAddress" className="input-base min-h-[80px] resize-none" defaultValue={values.companyAddress ?? 'Obala, Centre, Cameroun'} /></label>
        </div>
        <div className="mt-6 flex justify-end"><button type="submit" className="btn-primary"><Save size={15} /> Enregistrer les modifications</button></div>
        {saved && <div role="status" className="mt-4 flex items-center justify-end gap-2 rounded-xl border border-[#cde8c7] bg-[#effaeb] px-3 py-2.5 text-[11px] font-bold text-[#4d8f51]"><Check size={14} /> Modifications enregistrées et conservées.</div>}
      </form>

      <form key={`security-${String(values.savedAt ?? 'default')}`} onSubmit={save} className="surface p-5 sm:p-7">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#edf3ff] text-[#6385bd]"><ShieldCheck size={18} /></span>
          <div><h2 className="text-[17px] font-bold text-ink">Politique de session</h2><p className="mt-1 text-[11px] text-[#87958d]">Le compte MOVIC reste protégé côté serveur par un jeton administrateur signé.</p></div>
        </div>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <label className="block"><span className="field-label">Durée de session affichée</span><select name="sessionDuration" className="input-base" defaultValue={values.sessionDuration ?? '7'}><option value="1">1 jour</option><option value="7">7 jours</option><option value="30">30 jours</option></select></label>
          <label className="block"><span className="field-label">Double validation</span><select name="twoFactor" className="input-base" defaultValue={values.twoFactor ?? 'off'}><option value="off">Désactivée</option><option value="on">Activée</option></select></label>
        </div>
        <div className="mt-6 flex justify-end"><button type="submit" className="btn-primary"><Save size={15} /> Enregistrer la sécurité</button></div>
      </form>

      <section className="surface p-5 sm:p-7">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <SectionHeading eyebrow="Communication · Page d’accueil" title="Vidéos promotionnelles" description="Ajoutez des liens YouTube, définissez leur ordre et choisissez les vidéos visibles dans le nouvel espace public de la page d’accueil." />
          <button type="button" className="btn-primary shrink-0" onClick={openNewVideo}><Plus size={15} /> Ajouter une vidéo</button>
        </div>
        {videoFeedback && <div role="status" className="mt-5 flex items-center gap-2 rounded-xl border border-[#cde8c7] bg-[#effaeb] px-4 py-3 text-[11px] font-semibold text-[#4d8f51]"><Check size={14} />{videoFeedback}</div>}
        <div className="mt-5 flex items-start gap-3 rounded-xl border border-[#dcebdd] bg-[#f5faf2] px-4 py-3 text-[11px] leading-5 text-[#5b8f60]"><Video size={16} className="mt-0.5 shrink-0" /><span>Seuls les liens YouTube valides sont acceptés. Une vidéo doit être <strong>active</strong> pour apparaître sur la page d’accueil. Les vidéos sont affichées par ordre croissant.</span></div>
        {orderedVideos.length ? (
          <div className="mt-5 divide-y divide-[#edf0eb] rounded-2xl border border-[#edf0eb]">
            {orderedVideos.map((video) => (
              <article key={video.id} className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:p-5">
                <div className="flex h-16 w-24 shrink-0 items-center justify-center rounded-xl bg-[#19382e] text-[#a4eb91]"><Video size={24} /></div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2"><h3 className="text-[13px] font-bold text-ink">{video.title}</h3><span className={`rounded-full px-2 py-1 text-[9px] font-bold ${video.active ? 'bg-[#eaf7e7] text-[#579a58]' : 'bg-[#edf0ec] text-[#74817a]'}`}>{video.active ? 'Visible' : 'En pause'}</span><span className="rounded-full bg-[#edf3ff] px-2 py-1 text-[9px] font-bold text-[#6385bd]">Ordre {video.order}</span></div>
                  {video.description && <p className="mt-1 line-clamp-2 text-[11px] leading-5 text-[#718078]">{video.description}</p>}
                  <p className="mt-2 truncate text-[10px] text-[#8a9890]">{video.youtubeUrl}</p>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2 sm:justify-end">
                  <button type="button" className="icon-btn h-8 w-8" onClick={() => openEditVideo(video)} aria-label={`Modifier ${video.title}`}><Edit3 size={14} /></button>
                  <button type="button" className="btn-secondary px-2.5 py-1.5 text-[10px]" onClick={() => toggleVideo(video)}>{video.active ? <><EyeOff size={13} /> Masquer</> : <><Eye size={13} /> Publier</>}</button>
                  <button type="button" className="icon-btn h-8 w-8 text-[#b45d5d]" onClick={() => deleteVideo(video)} aria-label={`Supprimer ${video.title}`}><Trash2 size={14} /></button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="mt-5 rounded-2xl border border-dashed border-[#dce8db] px-6 py-12 text-center"><Video size={28} className="mx-auto text-[#a5b2a8]" /><p className="mt-3 text-[12px] font-bold text-[#53675b]">Aucune vidéo promotionnelle configurée</p><p className="mt-2 text-[11px] text-[#89968f]">Ajoutez un lien YouTube pour alimenter l’espace vidéo de la page d’accueil.</p></div>
        )}
      </section>

      <Modal open={videoOpen} onClose={() => { setVideoOpen(false); setEditingVideo(null); }} title={editingVideo ? 'Modifier une vidéo promotionnelle' : 'Ajouter une vidéo promotionnelle'}>
        <form onSubmit={saveVideo} className="space-y-5">
          <div className="rounded-xl border border-[#dcebdd] bg-[#f5faf2] px-3 py-2.5 text-[11px] leading-5 text-[#5b8f60]">La vidéo sera intégrée depuis YouTube dans l’espace public de la page d’accueil. Aucun fichier vidéo n’est téléversé dans AgroFlux.</div>
          <label className="block"><span className="field-label">Lien YouTube</span><input name="youtubeUrl" type="url" className="input-base" defaultValue={editingVideo?.youtubeUrl ?? ''} placeholder="https://www.youtube.com/watch?v=..." required /></label>
          <label className="block"><span className="field-label">Titre public</span><input name="title" className="input-base" defaultValue={editingVideo?.title ?? ''} placeholder="Ex. Au cœur de nos élevages" required /></label>
          <label className="block"><span className="field-label">Description courte</span><textarea name="description" className="input-base min-h-[90px] resize-none" defaultValue={editingVideo?.description ?? ''} placeholder="Présentez le contenu de la vidéo en quelques lignes." /></label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block"><span className="field-label">Ordre d’affichage</span><input name="order" type="number" min="1" step="1" className="input-base" defaultValue={editingVideo?.order ?? promoVideos.length + 1} /></label>
            <label className="flex items-center gap-2 self-end rounded-xl border border-[#e6ede5] px-3 py-3 text-[11px] font-semibold text-[#65766c]"><input name="active" type="checkbox" defaultChecked={editingVideo?.active ?? true} className="h-3.5 w-3.5 accent-[#5da561]" /> Publier sur la page d’accueil</label>
          </div>
          <div className="flex justify-end gap-2"><button type="button" className="btn-secondary" onClick={() => { setVideoOpen(false); setEditingVideo(null); }}>Annuler</button><button type="submit" className="btn-primary"><Save size={15} /> Enregistrer la vidéo</button></div>
        </form>
      </Modal>
    </div>
  );
}

function AdminSettingLink({ href, icon: Icon, label, active }: { href: string; icon: typeof Users; label: string; active?: boolean }) {
  return <Link href={href} className={`flex items-center gap-2 rounded-xl border px-3 py-3 text-[11px] font-bold transition ${active ? 'border-[#bdd9bc] bg-[#edf8e9] text-[#4d8f52]' : 'border-[#edf0eb] bg-white text-[#718078] hover:border-[#cde3cc] hover:text-ink'}`}><Icon size={15} />{label}</Link>;
}
