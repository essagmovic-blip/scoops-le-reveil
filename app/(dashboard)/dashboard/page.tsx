import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { units } from '@/lib/data';
import { DashboardView } from '@/components/dashboard-view';
import { UnitDashboardView } from '@/components/unit-dashboard-view';

export default function DashboardPage() {
  const activeUnit = cookies().get('agroflux_active_unit')?.value;
  const isKnownUnit = activeUnit && (activeUnit === 'global' || units.some((unit) => unit.id === activeUnit));
  if (isKnownUnit && activeUnit !== 'global') redirect(`/dashboard/${activeUnit}`);
  if (activeUnit === 'global') return <UnitDashboardView unitId="global" />;
  return <DashboardView />;
}
