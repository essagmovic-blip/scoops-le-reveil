import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { verifySessionToken } from '@/lib/admin-session';
import { listManagedUsers } from '@/lib/server-user-store';
import { hasSharedUnit, unitLabelsFromIds } from '@/lib/user-access';

function isMainAdministrator(user: { id: string; identifier: string }) {
  const expected = (process.env.ADMIN_USERNAME ?? 'MOVIC').trim().toLowerCase();
  return user.id.toLowerCase() === expected || user.identifier.trim().toLowerCase() === expected || user.id.toLowerCase() === 'admin-movic';
}

export async function GET() {
  const token = cookies().get('agroflux_user_token')?.value;
  const secret = process.env.ADMIN_SESSION_SECRET ?? process.env.ADMIN_PASSWORD ?? '';
  const claims = await verifySessionToken(token, secret);
  if (!claims) return NextResponse.json({ error: 'Session invalide.' }, { status: 401 });

  const managedUsers = await listManagedUsers();
  const users = managedUsers
    .filter((user) => user.status !== 'Suspendu' && user.id !== claims.sub)
    .filter((user) => claims.admin || (!isMainAdministrator(user) && hasSharedUnit({ allowedUnits: claims.allowedUnits }, user)))
    .map((user) => ({
      id: user.id,
      name: user.name,
      identifier: user.identifier,
      role: user.role,
      unit: unitLabelsFromIds(user.allowedUnits).join(' · '),
      allowedUnits: user.allowedUnits,
      status: user.status,
      initials: user.name.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase(),
    }));

  return NextResponse.json({
    currentUserId: claims.sub,
    admin: claims.admin,
    allowedUnits: claims.allowedUnits,
    users,
  }, { headers: { 'Cache-Control': 'no-store' } });
}
