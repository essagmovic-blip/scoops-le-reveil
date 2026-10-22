import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { readAdminPasswordHash, writeAdminPasswordHash } from '@/lib/admin-credential-store';
import { verifySessionToken } from '@/lib/admin-session';
import { findManagedUserById, hashManagedPassword, updateManagedUser, verifyManagedPassword } from '@/lib/server-user-store';

async function getClaims() {
  const token = cookies().get('agroflux_user_token')?.value;
  const secret = process.env.ADMIN_SESSION_SECRET ?? process.env.ADMIN_PASSWORD ?? '';
  return verifySessionToken(token, secret);
}

export async function POST(request: Request) {
  const claims = await getClaims();
  if (!claims) return NextResponse.json({ error: 'Session invalide.' }, { status: 401 });
  try {
    const body = await request.json() as { currentPassword?: unknown; newPassword?: unknown; confirmation?: unknown };
    const currentPassword = String(body.currentPassword ?? '');
    const newPassword = String(body.newPassword ?? '');
    const confirmation = String(body.confirmation ?? '');
    if (newPassword.length < 8) return NextResponse.json({ error: 'Le nouveau mot de passe doit contenir au moins 8 caractères.' }, { status: 400 });
    if (newPassword !== confirmation) return NextResponse.json({ error: 'La confirmation du nouveau mot de passe ne correspond pas.' }, { status: 400 });

    if (claims.admin) {
      const overrideHash = await readAdminPasswordHash();
      const currentIsValid = overrideHash ? verifyManagedPassword(currentPassword, overrideHash) : currentPassword === process.env.ADMIN_PASSWORD;
      if (!currentIsValid) return NextResponse.json({ error: 'Le mot de passe actuel est incorrect.' }, { status: 400 });
      await writeAdminPasswordHash(hashManagedPassword(newPassword));
      return NextResponse.json({ ok: true, message: 'Mot de passe administrateur modifié.' });
    }

    const user = await findManagedUserById(claims.sub);
    if (!user || !verifyManagedPassword(currentPassword, user.passwordHash)) return NextResponse.json({ error: 'Le mot de passe actuel est incorrect.' }, { status: 400 });
    const updated = await updateManagedUser(user.id, { password: newPassword });
    if (!updated) return NextResponse.json({ error: 'Utilisateur introuvable.' }, { status: 404 });
    return NextResponse.json({ ok: true, message: 'Mot de passe modifié.' });
  } catch {
    return NextResponse.json({ error: 'Requête de changement de mot de passe invalide.' }, { status: 400 });
  }
}
