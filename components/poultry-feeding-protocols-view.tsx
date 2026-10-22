'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Check, Droplets, Edit3, Link2, Lock, Save, Wheat, X } from 'lucide-react';
import { poultryBuildings } from '@/lib/data';
import { FARM_STORAGE_KEYS, readLocal, subscribeToFarmData, writeLocal } from '@/lib/farm-storage';
import { Modal, SectionHeading } from '@/components/ui';
import { applyPoultryProtocolChange, getActivePoultryProtocol, linkPoultryPendingTaskInstances, linkPoultryTaskTemplates, poultryProtocolDefaultSteps, poultryProtocolTypeLabel, seedPoultryProtocols, type PoultryProtocol, type PoultryProtocolType } from '@/lib/poultry-protocols';
import { filterDeletedTaskTemplates, type DailyTaskInstance, type DailyTaskTemplate } from '@/lib/daily-tasks';

type BuildingOption = { id: string; name: string };
const protocolTypes: PoultryProtocolType[] = ['eau', 'aliment'];
const fallbackBuildings: BuildingOption[] = poultryBuildings.map((building) => ({ id: building.id, name: building.name }));

export function PoultryFeedingProtocolsView({ readOnly = false }: { readOnly?: boolean }) {
  const [protocols, setProtocols] = useState<PoultryProtocol[]>([]);
  const [templates, setTemplates] = useState<DailyTaskTemplate[]>([]);
  const [buildings, setBuildings] = useState<BuildingOption[]>(fallbackBuildings);
  const [editingType, setEditingType] = useState<PoultryProtocolType | null>(null);
  const [editingBuildingId, setEditingBuildingId] = useState('');
  const [editingProtocolId, setEditingProtocolId] = useState('');
  const [open, setOpen] = useState(false);
  const [canEdit, setCanEdit] = useState(false);
  const [feedback, setFeedback] = useState('');

  useEffect(() => {
    const cookie = (name: string) => {
      const part = document.cookie.split('; ').find((item) => item.startsWith(`${name}=`));
      return part ? decodeURIComponent(part.slice(name.length + 1)) : '';
    };
    const isAdmin = cookie('agroflux_is_admin') === '1';
    let access: string[] = [];
    let assignedBuildings: string[] = [];
    try { access = JSON.parse(cookie('agroflux_access') || '[]') as string[]; } catch { access = []; }
    try { assignedBuildings = JSON.parse(cookie('agroflux_assigned_buildings') || '[]') as string[]; } catch { assignedBuildings = []; }
    const canManage = !readOnly && (isAdmin || access.includes('Paramètres') || access.includes('Santé et traitement') && assignedBuildings.length === 0);
    setCanEdit(canManage);

    const load = () => {
      const storedBuildings = readLocal<BuildingOption[]>(FARM_STORAGE_KEYS.buildings, []);
      const allBuildings = storedBuildings.length ? storedBuildings.map((building) => ({ id: building.id, name: building.name })) : fallbackBuildings;
      const visibleBuildings = isAdmin || !assignedBuildings.length ? allBuildings : allBuildings.filter((building) => assignedBuildings.includes(building.id));
      const protocolBuildings = isAdmin || !assignedBuildings.length ? allBuildings : visibleBuildings;
      setBuildings(visibleBuildings);

      const deletedTemplateIds = readLocal<string[]>(FARM_STORAGE_KEYS.dailyTaskDeletedTemplates, []);
      const storedTemplates = filterDeletedTaskTemplates(readLocal<DailyTaskTemplate[]>(FARM_STORAGE_KEYS.dailyTaskTemplates, []), deletedTemplateIds);
      const storedProtocols = readLocal<PoultryProtocol[]>(FARM_STORAGE_KEYS.poultryProtocols, []);
      const nextProtocols = seedPoultryProtocols(storedProtocols, storedTemplates, protocolBuildings);
      const nextTemplates = filterDeletedTaskTemplates(linkPoultryTaskTemplates(storedTemplates, nextProtocols), deletedTemplateIds);
      const storedInstances = readLocal<DailyTaskInstance[]>(FARM_STORAGE_KEYS.dailyTaskInstances, []);
      const nextInstances = linkPoultryPendingTaskInstances(storedInstances, nextProtocols);
      if (JSON.stringify(storedProtocols) !== JSON.stringify(nextProtocols)) writeLocal(FARM_STORAGE_KEYS.poultryProtocols, nextProtocols);
      if (JSON.stringify(storedTemplates) !== JSON.stringify(nextTemplates)) writeLocal(FARM_STORAGE_KEYS.dailyTaskTemplates, nextTemplates);
      if (JSON.stringify(storedInstances) !== JSON.stringify(nextInstances)) writeLocal(FARM_STORAGE_KEYS.dailyTaskInstances, nextInstances);
      setProtocols(nextProtocols);
      setTemplates(nextTemplates);
    };
    load();
    return subscribeToFarmData([FARM_STORAGE_KEYS.poultryProtocols, FARM_STORAGE_KEYS.dailyTaskTemplates, FARM_STORAGE_KEYS.dailyTaskDeletedTemplates, FARM_STORAGE_KEYS.dailyTaskInstances, FARM_STORAGE_KEYS.buildings], load);
  }, [readOnly]);

  const legacyProtocols = useMemo(() => protocols.filter((protocol) => protocol.active && !protocol.buildingId), [protocols]);
  const editingProtocol = editingProtocolId ? protocols.find((protocol) => protocol.id === editingProtocolId) : undefined;
  const activeEditingProtocol = editingType && editingBuildingId ? getActivePoultryProtocol(protocols, editingType, editingBuildingId) : undefined;
  const formProtocol = editingProtocol ?? activeEditingProtocol;

  function notify(message: string) {
    setFeedback(message);
    window.setTimeout(() => setFeedback(''), 4500);
  }

  function openEditor(type: PoultryProtocolType, buildingId: string, protocolId = '') {
    if (!canEdit || !buildingId) return;
    setEditingType(type);
    setEditingBuildingId(buildingId);
    setEditingProtocolId(protocolId || getActivePoultryProtocol(protocols, type, buildingId)?.id || '');
    setOpen(true);
  }

  function linkedCount(type: PoultryProtocolType, buildingId: string, protocolId?: string) {
    return templates.filter((template) => template.unitId === 'poulets' && template.category === `service-${type}` && template.assignedBuildingId === buildingId && (!protocolId || template.protocolId === protocolId)).length;
  }

  function saveProtocol(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingType || !canEdit) return;
    const form = new FormData(event.currentTarget);
    const buildingId = String(form.get('buildingId') ?? '').trim();
    const building = buildings.find((item) => item.id === buildingId);
    const name = String(form.get('name') ?? '').trim();
    const steps = String(form.get('steps') ?? '').split('\n').map((step) => step.trim()).filter(Boolean);
    if (!building) {
      notify('Sélectionnez le bâtiment concerné par ce protocole.');
      return;
    }
    if (!name || !steps.length) {
      notify('Indiquez un nom et au moins une étape de protocole.');
      return;
    }
    const current = getActivePoultryProtocol(protocols, editingType, buildingId);
    const now = new Date().toISOString();
    const nextVersion = current ? current.version + 1 : Math.max(0, ...protocols.filter((protocol) => protocol.type === editingType && protocol.buildingId === buildingId).map((protocol) => Number(protocol.version) || 0)) + 1;
    const sameBuildingEditing = editingProtocol?.buildingId === buildingId && editingProtocol.type === editingType;
    const nextProtocol: PoultryProtocol = {
      id: current?.id ?? (sameBuildingEditing ? editingProtocol.id : `PROTO-POULETS-${editingType.toUpperCase()}-${buildingId}-${Date.now()}`),
      type: editingType,
      buildingId,
      buildingName: building.name,
      name,
      steps,
      version: nextVersion,
      active: true,
      createdAt: current?.createdAt ?? (sameBuildingEditing ? editingProtocol.createdAt : now),
      updatedAt: now,
    };
    const nextProtocols = [...protocols.map((protocol) => protocol.type === editingType && protocol.buildingId === buildingId ? { ...protocol, active: false } : protocol).map((protocol) => editingProtocol?.id === protocol.id && !protocol.buildingId ? { ...protocol, active: false } : protocol).filter((protocol) => protocol.id !== nextProtocol.id), nextProtocol];
    const deletedTemplateIds = readLocal<string[]>(FARM_STORAGE_KEYS.dailyTaskDeletedTemplates, []);
    const storedTemplates = filterDeletedTaskTemplates(readLocal<DailyTaskTemplate[]>(FARM_STORAGE_KEYS.dailyTaskTemplates, templates), deletedTemplateIds);
    const storedInstances = readLocal<DailyTaskInstance[]>(FARM_STORAGE_KEYS.dailyTaskInstances, []);
    const synced = applyPoultryProtocolChange(nextProtocol, storedTemplates, storedInstances);
    const nextTemplates = filterDeletedTaskTemplates(linkPoultryTaskTemplates(synced.templates, nextProtocols), deletedTemplateIds);
    const nextInstances = linkPoultryPendingTaskInstances(synced.instances, nextProtocols);
    setProtocols(nextProtocols);
    setTemplates(nextTemplates);
    writeLocal(FARM_STORAGE_KEYS.poultryProtocols, nextProtocols);
    writeLocal(FARM_STORAGE_KEYS.dailyTaskTemplates, nextTemplates);
    writeLocal(FARM_STORAGE_KEYS.dailyTaskInstances, nextInstances);
    setOpen(false);
    setEditingType(null);
    setEditingBuildingId('');
    setEditingProtocolId('');
    notify(`Le protocole ${poultryProtocolTypeLabel(editingType).toLowerCase()} du ${building.name} est maintenant en version ${nextProtocol.version}. Les tâches ouvertes de ce bâtiment utilisent cette version.`);
  }

  return <section className="surface overflow-hidden">
    <div className="flex flex-col gap-4 border-b border-[#edf0eb] px-5 py-5 sm:px-6 lg:flex-row lg:items-end lg:justify-between">
      <SectionHeading eyebrow="Santé et traitement · Protocoles par bâtiment" title="Protocoles eau et aliment" description="Chaque protocole est rattaché à un seul bâtiment. Les tâches eau et aliment reprennent uniquement le protocole actif de leur bâtiment." />
      {!canEdit && <span className="inline-flex items-center gap-1.5 rounded-full bg-[#f1f5ef] px-3 py-1.5 text-[10px] font-bold text-[#66766d]"><Lock size={12} /> Lecture seule</span>}
    </div>
    {feedback && <div className="mx-5 mt-4 flex items-center gap-2 rounded-xl border border-[#cde8c7] bg-[#effaeb] px-4 py-3 text-[11px] font-semibold text-[#4d8f51] sm:mx-6"><Check size={14} />{feedback}</div>}
    <div className="space-y-5 p-5 sm:p-6">
      {buildings.length ? buildings.map((building) => <section key={building.id} className="rounded-2xl border border-[#e1ebe0] bg-[#fbfcfa] p-4 sm:p-5"><div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#e7eee5] pb-4"><div><p className="eyebrow mb-1">Bâtiment concerné</p><h3 className="text-[18px] font-black text-ink">{building.name}</h3></div><span className="rounded-full bg-white px-3 py-1.5 text-[10px] font-bold text-[#5b8f60]">Configuration indépendante</span></div><div className="mt-4 grid gap-4 lg:grid-cols-2">{protocolTypes.map((type) => { const protocol = getActivePoultryProtocol(protocols, type, building.id); const Icon = type === 'eau' ? Droplets : Wheat; return <article key={`${building.id}-${type}`} className="rounded-xl border border-[#e1ebe0] bg-white p-4"><div className="flex items-start justify-between gap-3"><span className={`flex h-10 w-10 items-center justify-center rounded-xl ${type === 'eau' ? 'bg-[#edf3ff] text-[#6385bd]' : 'bg-[#fff2e2] text-[#bd7737]'}`}><Icon size={18} /></span>{canEdit && <button type="button" className="icon-btn h-8 w-8" onClick={() => openEditor(type, building.id, protocol?.id)} aria-label={`${protocol ? 'Modifier' : 'Créer'} le protocole ${poultryProtocolTypeLabel(type).toLowerCase()} du ${building.name}`} title={protocol ? 'Modifier ce protocole' : 'Créer ce protocole'}><Edit3 size={14} /></button>}</div><div className="mt-4 flex flex-wrap items-center gap-2"><h4 className="text-[14px] font-black text-ink">{protocol?.name ?? `Protocole ${poultryProtocolTypeLabel(type)} non configuré`}</h4>{protocol && <span className="rounded-full bg-[#edf8e9] px-2 py-1 text-[9px] font-bold text-[#5b9d5b]">Version {protocol.version}</span>}</div>{protocol ? <><p className="mt-1 text-[10px] text-[#89968f]">{linkedCount(type, building.id, protocol.id)} modèle(s) de tâche de ce bâtiment lié(s)</p><ol className="mt-4 space-y-2">{protocol.steps.map((step, index) => <li key={`${building.id}-${type}-${index}-${step}`} className="flex items-start gap-2 text-[11px] font-semibold leading-5 text-[#65766c]"><span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#f5faf2] text-[9px] font-black text-[#5b9d5b]">{index + 1}</span><span>{step}</span></li>)}</ol><div className="mt-4 flex items-center gap-1.5 border-t border-[#e7eee5] pt-3 text-[10px] text-[#7b8b80]"><Link2 size={12} className="text-[#5b9d5b]" /> Modifié le {formatProtocolDate(protocol.updatedAt)}</div></> : <div className="mt-4 rounded-xl border border-[#f0d5ad] bg-[#fffaf2] px-3 py-3 text-[10px] leading-5 text-[#986c3e]">Aucun protocole spécifique n’est affecté à ce bâtiment. Les nouvelles tâches de ce service doivent être configurées avec un protocole de ce bâtiment.</div>}</article>; })}</div></section>) : <div className="rounded-xl border border-[#f0d5ad] bg-[#fffaf2] px-4 py-5 text-center text-[11px] text-[#986c3e]">Aucun bâtiment autorisé dans votre périmètre.</div>}
      {legacyProtocols.length > 0 && <div className="rounded-xl border border-[#f0d5ad] bg-[#fffaf2] p-4"><p className="text-[12px] font-black text-[#986c3e]">Protocoles historiques à affecter</p><p className="mt-1 text-[10px] leading-5 text-[#986c3e]">Ces anciens protocoles ne sont appliqués à aucun bâtiment tant qu’une affectation explicite n’a pas été enregistrée.</p><div className="mt-3 space-y-2">{legacyProtocols.map((protocol) => <div key={protocol.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white px-3 py-2"><span className="text-[10px] font-bold text-ink">{protocol.name} · {poultryProtocolTypeLabel(protocol.type)}</span>{canEdit && buildings[0] && <button type="button" className="btn-secondary px-2.5 py-1.5 text-[10px]" onClick={() => openEditor(protocol.type, buildings[0].id, protocol.id)}>Affecter à un bâtiment</button>}</div>)}</div></div>}
    </div>
    <div className="border-t border-[#edf0eb] bg-[#f5faf2] px-5 py-3 text-[10px] leading-5 text-[#6d9071] sm:px-6">Une modification s’applique uniquement aux tâches « À faire » et « En cours » du bâtiment sélectionné. Les tâches terminées conservent leur protocole et leur version historiques.</div>
    <Modal open={open} onClose={() => { setOpen(false); setEditingType(null); setEditingBuildingId(''); setEditingProtocolId(''); }} title={`${formProtocol ? 'Modifier' : 'Créer'} le protocole ${editingType ? poultryProtocolTypeLabel(editingType).toLowerCase() : ''}`}>
      {editingType && <form key={`${editingType}-${editingBuildingId}-${editingProtocolId}-${formProtocol?.version ?? 0}`} onSubmit={saveProtocol} className="space-y-5"><p className="muted text-[12px] leading-5">Le bâtiment sélectionné détermine les tâches qui recevront ce protocole. Une nouvelle version ne modifie pas les autres bâtiments.</p><label className="block"><span className="field-label">Bâtiment concerné</span><select name="buildingId" className="input-base" value={editingBuildingId} onChange={(event) => { setEditingBuildingId(event.target.value); setEditingProtocolId(''); }} required><option value="">Choisir un bâtiment</option>{buildings.map((building) => <option key={building.id} value={building.id}>{building.name}</option>)}</select></label><label className="block"><span className="field-label">Nom du protocole</span><input name="name" className="input-base" defaultValue={formProtocol?.name ?? `${`Protocole ${poultryProtocolTypeLabel(editingType)}`} · ${buildings.find((building) => building.id === editingBuildingId)?.name ?? 'bâtiment'}`} required /></label><label className="block"><span className="field-label">Étapes du protocole — une étape par ligne</span><textarea name="steps" className="input-base min-h-[150px] resize-y" defaultValue={formProtocol?.steps.join('\n') ?? poultryProtocolDefaultSteps(editingType).join('\n')} required /></label><div className="flex justify-end gap-2"><button type="button" className="btn-secondary" onClick={() => { setOpen(false); setEditingType(null); setEditingBuildingId(''); setEditingProtocolId(''); }}><X size={14} /> Annuler</button><button type="submit" className="btn-primary"><Save size={15} /> Enregistrer pour ce bâtiment</button></div></form>}
    </Modal>
  </section>;
}

function formatProtocolDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'date inconnue' : date.toLocaleDateString('fr-FR');
}
