import { notFound } from 'next/navigation';
import { UnitContactsView } from '@/components/unit-contacts-view';
import { units, type UnitId } from '@/lib/data';

export default function UnitSuppliersPage({ params }: { params: { unitId: string } }) {
  if (!units.some((unit) => unit.id === params.unitId)) notFound();
  return <UnitContactsView unitId={params.unitId as UnitId} type="fournisseurs" />;
}
