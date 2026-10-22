import { UnitDashboardView } from '@/components/unit-dashboard-view';

export default function UnitDashboardPage({ params }: { params: { unitId: string } }) {
  return <UnitDashboardView unitId={params.unitId} />;
}
