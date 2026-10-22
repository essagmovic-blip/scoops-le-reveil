'use client';

import { useState } from 'react';
import { ClipboardList, Package } from 'lucide-react';
import { DagoView } from '@/components/dago-view';
import { DeadBirdsStockView } from '@/components/dead-birds-stock-view';

export function DeadBirdsModuleView() {
  const [tab, setTab] = useState<'reports' | 'stock'>('reports');

  return (
    <div className="space-y-5">
      <div className="surface flex flex-wrap gap-1 bg-[#f0f5ee] p-1">
        <button type="button" className={`flex items-center gap-2 rounded-lg px-3 py-2.5 text-[11px] font-bold transition ${tab === 'reports' ? 'bg-white text-forest shadow-sm' : 'text-[#87948c] hover:text-ink'}`} onClick={() => setTab('reports')}><ClipboardList size={15} /> Signalements et réception</button>
        <button type="button" className={`flex items-center gap-2 rounded-lg px-3 py-2.5 text-[11px] font-bold transition ${tab === 'stock' ? 'bg-white text-forest shadow-sm' : 'text-[#87948c] hover:text-ink'}`} onClick={() => setTab('stock')}><Package size={15} /> Stock séparé</button>
      </div>
      {tab === 'reports' ? <DagoView /> : <DeadBirdsStockView />}
    </div>
  );
}
