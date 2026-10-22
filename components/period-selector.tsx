'use client';

import { useState } from 'react';
import { CalendarDays, Check, ChevronDown } from 'lucide-react';

const periods = ['Ce mois-ci', 'Le mois dernier', '3 derniers mois', 'Cette année'];

export function PeriodSelector({ defaultValue = 'Ce mois-ci', onChange }: { defaultValue?: string; onChange?: (value: string) => void }) {
  const [value, setValue] = useState(defaultValue);
  const [open, setOpen] = useState(false);
  return <div className="relative"><button className="btn-secondary" onClick={() => setOpen(!open)} aria-expanded={open}><CalendarDays size={15} /> {value} <ChevronDown size={14} /></button>{open && <div className="absolute right-0 top-[calc(100%+8px)] z-40 w-[175px] rounded-xl border border-[#e2eae1] bg-white p-1.5 shadow-[0_16px_35px_rgba(29,46,39,.12)]"><p className="px-2.5 pb-1.5 pt-1 text-[9px] font-bold uppercase tracking-[.12em] text-[#9aa59f]">Période</p>{periods.map((period) => <button key={period} className="flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-[11px] font-semibold text-[#66766d] hover:bg-[#f3f8f1] hover:text-forest" onClick={() => { setValue(period); onChange?.(period); setOpen(false); }}>{period}{period === value && <Check size={13} className="text-[#5b9d5b]" />}</button>)}</div>}</div>;
}
