import { NextResponse } from 'next/server';
import { readAdminPasswordHash } from '@/lib/admin-credential-store';
import { createAdminToken, createSessionToken } from '@/lib/admin-session';
import { findManagedUser, verifyManagedPassword } from '@/lib/server-user-store';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const username = String(body.username ?? '').trim();
    const password = String(body.password ?? '');
    const expectedUsername = process.env.ADMIN_USERNAME?.trim();
    const expectedPassword = process.env.ADMIN_PASSWORD;
    if (!expectedUsername || !expectedPassword) return NextResponse.json({ error: 'Les identifiants administrateur ne sont pas configurés sur le serveur.' }, { status: 503 });
    const isMainAdministrator = username.toLowerCase() === expectedUsername.toLowerCase();
    let managedUser: Awaited<ReturnType<typeof findManagedUser>> = undefined;
    if (isMainAdministrator) {
      const overrideHash = await readAdminPasswordHash();
      const validPassword = overrideHash ? verifyManagedPassword(password, overrideHash) : password === expectedPassword;
      if (!validPassword) return NextResponse.json({ error: 'Identifiant ou mot de passe incorrect.' }, { status: 401 });
    } else {
      managedUser = await findManagedUser(username);
      if (!managedUser || managedUser.status === 'Suspendu' || !verifyManagedPassword(password, managedUser.passwordHash)) return NextResponse.json({ error: 'Identifiant ou mot de passe incorrect.' }, { status: 401 });
    }
    const sessionSecret = process.env.ADMIN_SESSION_SECRET ?? expectedPassword;
    const response = NextResponse.json({ ok: true, redirect: isMainAdministrator ? '/dashboard-admin' : '/selection-unite' });
    const identityId = isMainAdministrator ? expectedUsername.toUpperCase() : managedUser!.id;
    const sessionToken = isMainAdministrator ? await createAdminToken(identityId, sessionSecret) : await createSessionToken({ sub: identityId, role: managedUser!.role, allowedUnits: managedUser!.allowedUnits, access: managedUser!.access, assignedBuildings: managedUser!.assignedBuildings ?? [], admin: false }, sessionSecret);
    response.cookies.set('agroflux_user_token', sessionToken, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', maxAge: 60 * 60 * 24 * 7, path: '/' });
    response.cookies.set('agroflux_user', identityId, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', maxAge: 60 * 60 * 24 * 7, path: '/' });
    response.cookies.set('agroflux_user_id', identityId, { sameSite: 'lax', secure: process.env.NODE_ENV === 'production', maxAge: 60 * 60 * 24 * 7, path: '/' });
    response.cookies.set('agroflux_user_name', isMainAdministrator ? expectedUsername.toUpperCase() : managedUser!.name, { sameSite: 'lax', secure: process.env.NODE_ENV === 'production', maxAge: 60 * 60 * 24 * 7, path: '/' });
    response.cookies.set('agroflux_is_admin', isMainAdministrator ? '1' : '0', { sameSite: 'lax', secure: process.env.NODE_ENV === 'production', maxAge: 60 * 60 * 24 * 7, path: '/' });
    response.cookies.set('agroflux_allowed_units', JSON.stringify(isMainAdministrator ? [] : managedUser!.allowedUnits), { sameSite: 'lax', secure: process.env.NODE_ENV === 'production', maxAge: 60 * 60 * 24 * 7, path: '/' });
    response.cookies.set('agroflux_access', JSON.stringify(isMainAdministrator ? [] : managedUser!.access), { sameSite: 'lax', secure: process.env.NODE_ENV === 'production', maxAge: 60 * 60 * 24 * 7, path: '/' });
    response.cookies.set('agroflux_assigned_buildings', JSON.stringify(isMainAdministrator ? [] : managedUser!.assignedBuildings ?? []), { sameSite: 'lax', secure: process.env.NODE_ENV === 'production', maxAge: 60 * 60 * 24 * 7, path: '/' });
    response.cookies.set('agroflux_role', isMainAdministrator ? 'Administratrice' : managedUser!.role, { sameSite: 'lax', secure: process.env.NODE_ENV === 'production', maxAge: 60 * 60 * 24 * 7, path: '/' });
    response.cookies.set('agroflux_session', 'active', { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', maxAge: 60 * 60 * 24 * 7, path: '/' });
    if (isMainAdministrator) {
      response.cookies.set('agroflux_admin_token', await createAdminToken(expectedUsername.toUpperCase(), sessionSecret), { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', maxAge: 60 * 60 * 24 * 7, path: '/' });
      response.cookies.set('agroflux_active_unit', '', { sameSite: 'lax', secure: process.env.NODE_ENV === 'production', expires: new Date(0), path: '/' });
    } else response.cookies.set('agroflux_admin_token', '', { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', expires: new Date(0), path: '/' });
    return response;
  } catch { return NextResponse.json({ error: 'Requête de connexion invalide.' }, { status: 400 }); }
}
