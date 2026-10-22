import { notFound } from 'next/navigation';
import { InterUnitOrdersView } from '@/components/inter-unit-orders-view';
import { units, type UnitId } from '@/lib/data';

export default function ScopedInternalOrdersPage({ params }: { params: { unitId: string } }) {
  const valid = units.some((unit) => unit.id === params.unitId && unit.id !== 'rh');
  if (!valid) notFound();
  return <InterUnitOrdersView scopeUnitId={params.unitId as Exclude<UnitId, 'rh'>} />;
}
