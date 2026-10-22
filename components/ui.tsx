import type { LucideIcon } from 'lucide-react';
import { ArrowUpRight, MoreHorizontal } from 'lucide-react';
import Link from 'next/link';
import { formatFCFA } from '@/lib/format';

export function SectionHeading({ eyebrow, title, description, action }: { eyebrow?: string; title: string; description?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {eyebrow && <p className="eyebrow mb-2">{eyebrow}</p>}
        <h2 className="text-[19px] font-semibold tracking-[-.035em] text-ink">{title}</h2>
        {description && <p className="muted mt-1 text-[13px] leading-5">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function StatCard({ label, value, change, trend = 'up', icon: Icon, tone = 'green', detail }: { label: string; value: string | number; change?: string; trend?: 'up' | 'down' | 'neutral'; icon: LucideIcon; tone?: 'green' | 'orange' | 'blue' | 'purple'; detail?: string }) {
  const tones = {
    green: 'stat-icon-green', orange: 'stat-icon-orange', blue: 'stat-icon-blue', purple: 'stat-icon-purple',
  };
  return (
    <div className="surface flex min-h-[145px] flex-col justify-between p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[12px] font-semibold text-[#77857e]">{label}</p>
          <p className="mt-2 text-[26px] font-bold tracking-[-.055em] text-ink">{typeof value === 'number' ? formatFCFA(value) : value}</p>
        </div>
        <div className={`stat-icon ${tones[tone]}`}><Icon size={19} strokeWidth={2.2} /></div>
      </div>
      {(change || detail) && <div className="mt-4 flex items-center gap-2 text-[11px] font-semibold">
        {change && <span className={trend === 'down' ? 'text-[#d2766e]' : trend === 'neutral' ? 'text-[#85918a]' : 'text-[#4c9c58]'}>{change}</span>}
        {detail && <span className="font-medium text-[#8b9891]">{detail}</span>}
      </div>}
    </div>
  );
}

export function MiniProgress({ value, color = 'green', label, right }: { value: number; color?: 'green' | 'orange' | 'blue' | 'red'; label?: string; right?: string }) {
  const colors = { green: '#7fcf74', orange: '#e9975c', blue: '#6f9fe8', red: '#d9706b' };
  return <div>
    {(label || right) && <div className="mb-2 flex items-center justify-between text-[11px] font-semibold"><span className="text-[#6f7d75]">{label}</span><span className="text-ink">{right}</span></div>}
    <div className="h-2 overflow-hidden rounded-full bg-[#edf1eb]"><div className="h-full rounded-full transition-all" style={{ width: `${Math.min(value, 100)}%`, background: colors[color] }} /></div>
  </div>;
}

export function MoreButton({ href }: { href?: string }) {
  const content = <span className="icon-btn h-8 w-8"><MoreHorizontal size={16} /></span>;
  return href ? <Link href={href} aria-label="Voir plus">{content}</Link> : <button aria-label="Voir plus">{content}</button>;
}

export function ViewAll({ href, label = 'Voir tout' }: { href: string; label?: string }) {
  return <Link href={href} className="inline-flex items-center gap-1 text-[12px] font-bold text-[#4d8e4d] hover:text-forest">{label}<ArrowUpRight size={14} /></Link>;
}

export function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  if (!open) return null;
  return <div className="fixed inset-0 z-[80] flex items-center justify-center bg-[#102d23]/35 p-4 backdrop-blur-[3px]" onMouseDown={onClose}>
    <div className="surface max-h-[90vh] w-full max-w-lg overflow-auto p-6" onMouseDown={(e) => e.stopPropagation()}>
      <div className="mb-5 flex items-center justify-between"><h2 className="text-lg font-bold tracking-[-.03em]">{title}</h2><button className="icon-btn h-8 w-8 text-lg" onClick={onClose} aria-label="Fermer">×</button></div>
      {children}
    </div>
  </div>;
}
