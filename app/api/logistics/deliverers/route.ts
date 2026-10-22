import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { verifySessionToken } from '@/lib/admin-session';
import { isDelivererProfile } from '@/lib/internal-logistics';
import { listManagedUsers } from '@/lib/server-user-store';

async function getClaims() {
  const token = cookies().get('agroflux_user_token')?.value;
  const secret = process.env.ADMIN_SESSION_SECRET ?? process.env.ADMIN_PASSWORD ?? '';
  return verifySessionToken(token, secret);
}

export async function GET(request: Request) {
  const claims = await getClaims();
  if (!claims) return NextResponse.json({ error: 'Session invalide.' }, { status: 401 });
  if (!claims.admin && !claims.access.includes('Commandes inter-unités') && !isDelivererProfile(claims)) {
    return NextResponse.json({ error: 'Accès logistique requis.' }, { status: 403 });
  }

  const url = new URL(request.url);
  const supplierUnitId = url.searchParams.get('supplierUnitId');
  const recipientUnitId = url.searchParams.get('recipientUnitId');
  const users = await listManagedUsers();
  const visibleUnits = new Set(claims.allowedUnits);
  const deliverers = users
    .filter((user) => user.status !== 'Suspendu' && isDelivererProfile(user))
    .filter((user) => claims.admin || user.allowedUnits.some((unit) => visibleUnits.has(unit)))
    .filter((user) => {
      const requestedUnits = [supplierUnitId, recipientUnitId].filter(Boolean) as string[];
      return !requestedUnits.length || claims.admin || requestedUnits.some((unit) => user.allowedUnits.includes(unit));
    })
    .map((user) => ({ id: user.id, name: user.name, role: user.role, allowedUnits: user.allowedUnits }));

  return NextResponse.json({ deliverers }, { headers: { 'Cache-Control': 'no-store' } });
}
