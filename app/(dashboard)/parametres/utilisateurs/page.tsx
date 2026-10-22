import { UsersAdminView } from '@/components/users-admin-view';
import type { UnitId } from '@/lib/data';

export default function UsersSettingsPage({ searchParams }: { searchParams: { unit?: string } }) {
  const unitId = searchParams.unit === 'poulets' || searchParams.unit === 'chevrerie' || searchParams.unit === 'provenderie' || searchParams.unit === 'bio' || searchParams.unit === 'pressoir' || searchParams.unit === 'stocks' || searchParams.unit === 'rh' ? searchParams.unit as UnitId : undefined;
  return <UsersAdminView unitId={unitId} />;
}
