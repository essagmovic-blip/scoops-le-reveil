import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { verifySessionToken } from '@/lib/admin-session';
import { listManagedUsers } from '@/lib/server-user-store';

export async function GET() {
  const token = cookies().get('agroflux_user_token')?.value;
  const secret = process.env.ADMIN_SESSION_SECRET ?? process.env.ADMIN_PASSWORD ?? '';
  const claims = await verifySessionToken(token, secret);
  if (!claims || (!claims.admin && !claims.allowedUnits.includes('rh'))) return NextResponse.json({ error: 'Accès RH requis.' }, { status: 403 });
  const users = await listManagedUsers();
  return NextResponse.json({ users: users.filter((user) => user.status !== 'Suspendu').map((user) => ({ id: user.id, name: user.name, identifier: user.identifier, role: user.role, allowedUnits: user.allowedUnits, status: user.status })) }, { headers: { 'Cache-Control': 'no-store' } });
}
