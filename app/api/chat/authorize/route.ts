import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import type { UnitId } from '@/lib/data';
import { verifySessionToken } from '@/lib/admin-session';
import { findManagedUserById } from '@/lib/server-user-store';
import { hasSharedUnit, unitIdsFromUser } from '@/lib/user-access';

function isMainAdministratorId(value: string) {
  const normalized = value.trim().toLowerCase();
  const expected = (process.env.ADMIN_USERNAME ?? 'MOVIC').trim().toLowerCase();
  return normalized === expected || normalized === 'movic' || normalized === 'admin-movic';
}

export async function POST(request: Request) {
  const token = cookies().get('agroflux_user_token')?.value;
  const secret = process.env.ADMIN_SESSION_SECRET ?? process.env.ADMIN_PASSWORD ?? '';
  const claims = await verifySessionToken(token, secret);
  if (!claims) return NextResponse.json({ error: 'Session invalide.' }, { status: 401 });

  try {
    const body = await request.json() as { recipientId?: string; contextUnitId?: string };
    const recipientId = String(body.recipientId ?? '').trim();
    if (!recipientId || recipientId === claims.sub) return NextResponse.json({ error: 'Destinataire invalide.' }, { status: 400 });

    // MOVIC peut contacter toute personne. Un utilisateur normal peut aussi
    // répondre à l’administrateur, mais jamais cibler directement un autre
    // profil hors de ses unités autorisées.
    if (claims.admin || isMainAdministratorId(recipientId)) return NextResponse.json({ ok: true });

    const recipient = await findManagedUserById(recipientId);
    if (!recipient || recipient.status === 'Suspendu' || !hasSharedUnit({ allowedUnits: claims.allowedUnits }, recipient)) {
      return NextResponse.json({ error: 'Destinataire hors du périmètre autorisé.' }, { status: 403 });
    }
    if (body.contextUnitId) {
      const requestedUnit = String(body.contextUnitId);
      if (!claims.allowedUnits.includes(requestedUnit) || !unitIdsFromUser(recipient.allowedUnits).includes(requestedUnit as UnitId)) {
        return NextResponse.json({ error: 'Destinataire non autorisé dans cette unité.' }, { status: 403 });
      }
    }
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Requête de messagerie invalide.' }, { status: 400 });
  }
}
