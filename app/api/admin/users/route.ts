import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { verifyAdminToken } from '@/lib/admin-session';
import { deleteManagedUser, listManagedUsers, updateManagedUser, upsertManagedUser } from '@/lib/server-user-store';
import { normalizeUserPermissions } from '@/lib/user-access';

async function requireAdmin() {
  const expected = (process.env.ADMIN_USERNAME ?? 'MOVIC').trim().toUpperCase();
  const secret = process.env.ADMIN_SESSION_SECRET ?? process.env.ADMIN_PASSWORD ?? '';
  const token = cookies().get('agroflux_admin_token')?.value;
  return verifyAdminToken(token, secret, expected);
}

function safeUser(user: Awaited<ReturnType<typeof listManagedUsers>>[number]) {
  return {
    id: user.id,
    name: user.name,
    identifier: user.identifier,
    role: user.role,
    allowedUnits: user.allowedUnits,
    access: user.access,
    assignedBuildings: user.assignedBuildings ?? [],
    phone: user.phone ?? '',
    profilePhoto: user.profilePhoto ?? '',
    status: user.status,
    passwordSet: Boolean(user.passwordHash),
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

export async function GET() {
  if (!(await requireAdmin())) return NextResponse.json({ error: 'Accès administrateur requis.' }, { status: 403 });
  const users = await listManagedUsers();
  return NextResponse.json({ users: users.map(safeUser) });
}

export async function POST(request: Request) {
  if (!(await requireAdmin())) return NextResponse.json({ error: 'Accès administrateur requis.' }, { status: 403 });
  try {
    const body = await request.json();
    const name = String(body.name ?? '').trim();
    const identifier = String(body.identifier ?? '').trim();
    const role = String(body.role ?? '').trim();
    const allowedUnits = Array.isArray(body.allowedUnits) ? body.allowedUnits.map(String) : [];
    const access = Array.isArray(body.access) ? body.access.map(String) : [];
    const assignedBuildings = Array.isArray(body.assignedBuildings) ? body.assignedBuildings.map(String) : [];
    const phone = body.phone === undefined ? undefined : String(body.phone).trim();
    const profilePhoto = body.profilePhoto === undefined ? undefined : String(body.profilePhoto);
    const password = body.password ? String(body.password) : '';
    const permissions = normalizeUserPermissions(allowedUnits, access);
    if (!name || !identifier || !role || !permissions.allowedUnits.length || (!body.id && !password)) {
      return NextResponse.json({ error: 'Nom, identifiant, rôle, unité autorisée et mot de passe sont obligatoires.' }, { status: 400 });
    }
    const user = await upsertManagedUser({
      id: body.id,
      name,
      identifier,
      role,
      allowedUnits: permissions.allowedUnits,
      access: permissions.access,
      assignedBuildings,
      phone,
      profilePhoto,
      status: body.status === 'Actif' || body.status === 'Suspendu' ? body.status : 'Invité',
      password: password || undefined,
    });
    return NextResponse.json({ ok: true, user: safeUser(user) });
  } catch {
    return NextResponse.json({ error: 'Utilisateur invalide.' }, { status: 400 });
  }
}

export async function PATCH(request: Request) {
  if (!(await requireAdmin())) return NextResponse.json({ error: 'Accès administrateur requis.' }, { status: 403 });
  try {
    const body = await request.json();
    const patchAllowedUnits = Array.isArray(body.allowedUnits) ? body.allowedUnits.map(String) : undefined;
    if (patchAllowedUnits && !normalizeUserPermissions(patchAllowedUnits, Array.isArray(body.access) ? body.access.map(String) : []).allowedUnits.length) {
      return NextResponse.json({ error: 'Un utilisateur doit conserver au moins une unité autorisée.' }, { status: 400 });
    }
    const patch = {
      name: body.name === undefined ? undefined : String(body.name),
      identifier: body.identifier === undefined ? undefined : String(body.identifier),
      role: body.role === undefined ? undefined : String(body.role),
      allowedUnits: patchAllowedUnits,
      access: Array.isArray(body.access) ? body.access.map(String) : undefined,
      assignedBuildings: Array.isArray(body.assignedBuildings) ? body.assignedBuildings.map(String) : undefined,
      phone: body.phone === undefined ? undefined : String(body.phone).trim(),
      profilePhoto: body.profilePhoto === undefined ? undefined : String(body.profilePhoto),
      status: body.status === 'Actif' || body.status === 'Suspendu' || body.status === 'Invité' ? body.status : undefined,
      password: body.password ? String(body.password) : undefined,
    };
    const user = await updateManagedUser(String(body.id ?? ''), patch);
    if (!user) return NextResponse.json({ error: 'Utilisateur introuvable.' }, { status: 404 });
    return NextResponse.json({ ok: true, user: safeUser(user) });
  } catch {
    return NextResponse.json({ error: 'Modification invalide.' }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  if (!(await requireAdmin())) return NextResponse.json({ error: 'Accès administrateur requis.' }, { status: 403 });
  try {
    const body = await request.json();
    await deleteManagedUser(String(body.id ?? ''));
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Suppression invalide.' }, { status: 400 });
  }
}
