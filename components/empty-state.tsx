import { Sprout } from 'lucide-react';

export function EmptyState({ title, description, action }: { title: string; description: string; action?: React.ReactNode }) {
  return <div className="surface flex min-h-[230px] flex-col items-center justify-center px-6 text-center">
    <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#eff8e9] text-[#5b9c52]"><Sprout size={22} /></div>
    <h3 className="text-[15px] font-bold text-ink">{title}</h3>
    <p className="muted mt-1 max-w-sm text-[13px] leading-5">{description}</p>
    {action && <div className="mt-4">{action}</div>}
  </div>;
}
