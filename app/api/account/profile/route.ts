import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { readAccountProfile, writeAccountProfile } from '@/lib/account-profile-store';
import { verifySessionToken } from '@/lib/admin-session';
import { findManagedUserById, updateManagedUser } from '@/lib/server-user-store';
import { units } from '@/lib/data';
import { unitLabelsFromIds } from '@/lib/user-access';

async function getClaims() {
  const token = cookies().get('agroflux_user_token')?.value;
  const secret = process.env.ADMIN_SESSION_SECRET ?? process.env.ADMIN_PASSWORD ?? '';
  return verifySessionToken(token, secret);
}

function safeProfile(profile: { id: string; name: string; identifier: string; role: string; allowedUnits: string[]; access: string[]; status: string; phone?: string; profilePhoto?: string }) {
  return { ...profile, phone: profile.phone ?? '', profilePhoto: profile.profilePhoto ?? '', unitLabels: unitLabelsFromIds(profile.allowedUnits) };
}

export async function GET() {
  const claims = await getClaims();
  if (!claims) return NextResponse.json({ error: 'Session invalide.' }, { status: 401 });

  if (claims.admin) {
    const expectedUsername = (process.env.ADMIN_USERNAME ?? 'MOVIC').trim().toUpperCase();
    const personal = await readAccountProfile(claims.sub);
    return NextResponse.json({ profile: safeProfile({ id: claims.sub, name: expectedUsername, identifier: expectedUsername, role: 'Administratrice', allowedUnits: units.map((unit) => unit.id), access: ['Accès administrateur global'], status: 'Actif', ...personal }) }, { headers: { 'Cache-Control': 'no-store' } });
  }

  const user = await findManagedUserById(claims.sub);
  if (!user) return NextResponse.json({ error: 'Utilisateur introuvable.' }, { status: 404 });
  return NextResponse.json({ profile: safeProfile({ id: user.id, name: user.name, identifier: user.identifier, role: user.role, allowedUnits: user.allowedUnits, access: user.access, status: user.status, phone: user.phone, profilePhoto: user.profilePhoto }) }, { headers: { 'Cache-Control': 'no-store' } });
}

function validatePatch(body: unknown) {
  const value = body as { phone?: unknown; profilePhoto?: unknown };
  const phone = value.phone === undefined ? undefined : String(value.phone).trim();
  const profilePhoto = value.profilePhoto === undefined ? undefined : String(value.profilePhoto);
  if (phone !== undefined && phone.length > 40) return { error: 'Le numéro de téléphone est trop long.' };
  if (profilePhoto !== undefined && profilePhoto.length > 2_500_000) return { error: 'La photo dépasse la taille maximale de 2 Mo.' };
  if (profilePhoto && !/^data:image\/(png|jpe?g|webp|gif);base64,[a-z0-9+/=]+$/i.test(profilePhoto)) return { error: 'Format de photo non accepté.' };
  return { phone, profilePhoto };
}

export async function PATCH(request: Request) {
  const claims = await getClaims();
  if (!claims) return NextResponse.json({ error: 'Session invalide.' }, { status: 401 });
  try {
    const patch = validatePatch(await request.json());
    if ('error' in patch && patch.error) return NextResponse.json({ error: patch.error }, { status: 400 });
    const profilePatch = { phone: patch.phone, profilePhoto: patch.profilePhoto };
    if (claims.admin) {
      const saved = await writeAccountProfile(claims.sub, profilePatch);
      return NextResponse.json({ ok: true, profile: safeProfile({ id: claims.sub, name: (process.env.ADMIN_USERNAME ?? 'MOVIC').trim().toUpperCase(), identifier: (process.env.ADMIN_USERNAME ?? 'MOVIC').trim().toUpperCase(), role: 'Administratrice', allowedUnits: units.map((unit) => unit.id), access: ['Accès administrateur global'], status: 'Actif', ...saved }) });
    }
    const user = await updateManagedUser(claims.sub, profilePatch);
    if (!user) return NextResponse.json({ error: 'Utilisateur introuvable.' }, { status: 404 });
    return NextResponse.json({ ok: true, profile: safeProfile({ id: user.id, name: user.name, identifier: user.identifier, role: user.role, allowedUnits: user.allowedUnits, access: user.access, status: user.status, phone: user.phone, profilePhoto: user.profilePhoto }) });
  } catch {
    return NextResponse.json({ error: 'Profil invalide.' }, { status: 400 });
  }
}
