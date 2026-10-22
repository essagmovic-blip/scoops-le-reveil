import { notFound } from 'next/navigation';
import { StockCustodyView } from '@/components/stock-custody-view';
import { units, type UnitId } from '@/lib/data';

export default function StockCustodyPage({ params }: { params: { unitId: string } }) {
  const allowed = units.some((unit) => unit.id === params.unitId && unit.id !== 'rh');
  if (!allowed) notFound();
  return <StockCustodyView unitId={params.unitId as Exclude<UnitId, 'rh'>} />;
}
