'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { ArrowLeftRight, Check, ClipboardList, MoveRight, X } from 'lucide-react';
import { Modal, SectionHeading } from '@/components/ui';
import { FARM_STORAGE_KEYS, readLocal, subscribeToFarmData, writeLocal } from '@/lib/farm-storage';
import { movePoultrySubjects, poultrySubjectLocationLabel, poultrySubjectLocationTotal, syncPoultrySubjectLocations, type PoultryLocationBuilding, type PoultrySubjectLocation, type PoultrySubjectLocationMovement, type PoultrySubjectLocationState } from '@/lib/poultry-subject-locations';

type Props = { buildings: PoultryLocationBuilding[] };
type Feedback = { type: 'success' | 'error'; message: string };

export function PoultrySubjectLocationsView({ buildings }: Props) {
  const [locations, setLocations] = useState<PoultrySubjectLocationState[]>([]);
  const [movements, setMovements] = useState<PoultrySubjectLocationMovement[]>([]);
  const [selectedBuilding, setSelectedBuilding] = useState<PoultryLocationBuilding | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  useEffect(() => {
    const load = () => {
      const current = readLocal<PoultrySubjectLocationState[]>(FARM_STORAGE_KEYS.poultrySubjectLocations, []);
      const next = syncPoultrySubjectLocations(buildings, current);
      if (JSON.stringify(current) !== JSON.stringify(next)) writeLocal(FARM_STORAGE_KEYS.poultrySubjectLocations, next);
      setLocations(next);
      setMovements(readLocal<PoultrySubjectLocationMovement[]>(FARM_STORAGE_KEYS.poultrySubjectLocationMovements, []));
    };
    load();
    return subscribeToFarmData([FARM_STORAGE_KEYS.poultrySubjectLocations, FARM_STORAGE_KEYS.poultrySubjectLocationMovements, FARM_STORAGE_KEYS.buildings], load);
  }, [buildings]);

  const activeBuildings = useMemo(() => buildings.filter((building) => building.batch && building.batch !== '—' && Number(building.current || 0) > 0), [buildings]);

  function notify(message: string, type: Feedback['type'] = 'success') {
    setFeedback({ type, message });
    window.setTimeout(() => setFeedback(null), 4500);
  }

  function stateFor(building: PoultryLocationBuilding) {
    return locations.find((state) => state.buildingId === building.id && state.batchId === building.batch);
  }

  function saveMovement(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedBuilding) return;
    const form = new FormData(event.currentTarget);
    const from = String(form.get('from') ?? 'grande-salle') as PoultrySubjectLocation;
    const to = String(form.get('to') ?? 'clinique') as PoultrySubjectLocation;
    const quantity = Number(form.get('quantity') ?? 0);
    const reason = String(form.get('reason') ?? '').trim();
    const cookie = (name: string) => { const part = document.cookie.split('; ').find((item) => item.startsWith(`${name}=`)); return part ? decodeURIComponent(part.slice(name.length + 1)) : ''; };
    const result = movePoultrySubjects({ building: selectedBuilding, from, to, quantity, reason, operatorId: cookie('agroflux_user_id') || 'unknown', operatorName: cookie('agroflux_user_name') || 'Responsable bâtiment' });
    if (!result.ok) {
      notify(result.message, 'error');
      return;
    }
    setLocations(readLocal<PoultrySubjectLocationState[]>(FARM_STORAGE_KEYS.poultrySubjectLocations, []));
    setMovements(readLocal<PoultrySubjectLocationMovement[]>(FARM_STORAGE_KEYS.poultrySubjectLocationMovements, []));
    setSelectedBuilding(null);
    notify(`${quantity} sujet(s) déplacé(s) de ${poultrySubjectLocationLabel(from)} vers ${poultrySubjectLocationLabel(to)} dans ${selectedBuilding.name}.`);
  }

  return <section className="surface overflow-hidden"><div className="border-b border-[#edf0eb] px-5 py-5 sm:px-6"><SectionHeading eyebrow="Effectifs par emplacement" title="Grande salle et Clinique" description="Le stock vivant de chaque bâtiment est séparé entre la grande salle et la clinique. Les déplacements sont historisés sans modifier le total de la bande." /></div>{feedback && <div className={`mx-5 mt-4 flex items-start gap-2 rounded-xl px-4 py-3 text-[11px] font-semibold sm:mx-6 ${feedback.type === 'error' ? 'border border-[#f0c9c5] bg-[#fff4f3] text-[#b85b59]' : 'border border-[#cde8c7] bg-[#effaeb] text-[#4d9352]'}`}><Check size={15} className="mt-0.5 shrink-0" />{feedback.message}</div>}<div className="grid gap-4 p-5 sm:grid-cols-2 sm:p-6">{activeBuildings.length ? activeBuildings.map((building) => { const state = stateFor(building); const total = state ? poultrySubjectLocationTotal(state) : Number(building.current || 0); return <article key={building.id} className="rounded-2xl border border-[#e1ebe0] bg-[#fbfcfa] p-4"><div className="flex items-start justify-between gap-3"><div><p className="text-[13px] font-black text-ink">{building.name}</p><p className="mt-1 text-[10px] text-[#89968f]">{building.batch} · {total} sujet(s) vivants suivis</p></div><button type="button" className="btn-secondary px-2.5 py-1.5 text-[10px]" onClick={() => setSelectedBuilding(building)}><ArrowLeftRight size={13} /> Déplacer</button></div><div className="mt-4 grid grid-cols-2 gap-3"><div className="rounded-xl bg-white p-3"><p className="text-[10px] font-semibold text-[#718078]">Grande salle</p><p className="mt-1 text-[22px] font-black tracking-[-.05em] text-[#3e7546]">{state?.grandeSalleQuantity ?? building.current ?? 0}</p><p className="text-[9px] text-[#89968f]">sujet(s)</p></div><div className="rounded-xl bg-[#faf7fd] p-3"><p className="text-[10px] font-semibold text-[#8066a6]">Clinique</p><p className="mt-1 text-[22px] font-black tracking-[-.05em] text-[#8066a6]">{state?.clinicQuantity ?? 0}</p><p className="text-[9px] text-[#89968f]">sujet(s) vivants</p></div></div></article>; }) : <div className="rounded-xl border border-dashed border-[#dce8db] px-5 py-10 text-center text-[11px] text-[#89968f] sm:col-span-2"><ClipboardList size={25} className="mx-auto mb-2 text-[#b4c3b7]" />Aucun bâtiment occupé avec une bande active.</div>}</div><div className="border-t border-[#edf0eb] bg-[#fbfcfa] px-5 py-4 sm:px-6"><div className="flex items-center gap-2 text-[11px] font-bold text-[#66766d]"><MoveRight size={14} className="text-[#5b9d5b]" /> Derniers mouvements Grande salle ↔ Clinique</div>{movements.length ? <div className="mt-3 space-y-2">{movements.slice(0, 6).map((movement) => <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-[#718078]" key={movement.id}><strong className="text-ink">{movement.buildingName}</strong><span>{movement.quantity} · {poultrySubjectLocationLabel(movement.from)} → {poultrySubjectLocationLabel(movement.to)}</span><span>{movement.operatorName} · {movement.date}</span><span className="truncate">{movement.reason}</span></div>)}</div> : <p className="mt-2 text-[10px] text-[#89968f]">Aucun déplacement enregistré.</p>}</div><Modal open={Boolean(selectedBuilding)} onClose={() => setSelectedBuilding(null)} title={selectedBuilding ? `Déplacer des sujets · ${selectedBuilding.name}` : 'Déplacer des sujets'}>{selectedBuilding && <form onSubmit={saveMovement} className="space-y-5"><div className="rounded-xl border border-[#dce8db] bg-[#f5faf2] p-4 text-[11px] leading-5 text-[#5b8f60]">Le déplacement conserve la même bande et le même total vivant. Seul le nombre de sujets dans chaque emplacement change.</div><div className="grid gap-4 sm:grid-cols-2"><label className="block"><span className="field-label">Depuis</span><select name="from" className="input-base" defaultValue="grande-salle"><option value="grande-salle">Grande salle</option><option value="clinique">Clinique</option></select></label><label className="block"><span className="field-label">Vers</span><select name="to" className="input-base" defaultValue="clinique"><option value="clinique">Clinique</option><option value="grande-salle">Grande salle</option></select></label><label className="block"><span className="field-label">Quantité</span><input name="quantity" type="number" min="1" step="1" className="input-base" required /></label><label className="block"><span className="field-label">Bande</span><input className="input-base bg-[#f5faf2]" value={selectedBuilding.batch ?? ''} readOnly /></label></div><label className="block"><span className="field-label">Motif obligatoire</span><textarea name="reason" className="input-base min-h-[80px] resize-none" placeholder="Observation, traitement, retour en salle…" required /></label><div className="flex justify-end gap-2"><button type="button" className="btn-secondary" onClick={() => setSelectedBuilding(null)}><X size={14} /> Annuler</button><button type="submit" className="btn-primary"><ArrowLeftRight size={15} /> Enregistrer le déplacement</button></div></form>}</Modal></section>;
}
