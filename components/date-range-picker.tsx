'use client';

import { useState } from 'react';
import { CalendarDays, Check, ChevronDown } from 'lucide-react';

export function DateRangePicker({ from, to, onApply }: { from: string; to: string; onApply: (from: string, to: string) => void }) {
  const [open, setOpen] = useState(false);
  const [draftFrom, setDraftFrom] = useState(from);
  const [draftTo, setDraftTo] = useState(to);
  const label = from === to ? from : `${from.split('-').reverse().join('/')} — ${to.split('-').reverse().join('/')}`;
  return <div className="relative"><button className="btn-secondary" onClick={() => setOpen(!open)} aria-expanded={open}><CalendarDays size={15} /> {label} <ChevronDown size={14} /></button>{open && <div className="absolute right-0 top-[calc(100%+8px)] z-50 w-[285px] rounded-2xl border border-[#e2eae1] bg-white p-4 shadow-[0_18px_40px_rgba(29,46,39,.15)]"><p className="mb-3 text-[10px] font-bold uppercase tracking-[.12em] text-[#89968f]">Choisir une période</p><div className="grid gap-3"><label className="block"><span className="field-label">Du</span><input type="date" value={draftFrom} onChange={(event) => setDraftFrom(event.target.value)} className="input-base h-9 text-[11px]" /></label><label className="block"><span className="field-label">Au</span><input type="date" value={draftTo} onChange={(event) => setDraftTo(event.target.value)} className="input-base h-9 text-[11px]" /></label></div><div className="mt-4 flex justify-end gap-2"><button className="btn-secondary px-3 py-2 text-[11px]" onClick={() => setOpen(false)}>Annuler</button><button className="btn-primary px-3 py-2 text-[11px]" onClick={() => { onApply(draftFrom, draftTo); setOpen(false); }}><Check size={14} /> Appliquer</button></div></div>}</div>;
}
