import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { verifyAdminToken, verifySessionToken } from '@/lib/admin-session';
import { createContactMessage, listContactMessages, updateContactMessage, type ContactMessageStatus } from '@/lib/contact-messages-store';

async function canManageContactMessages() {
  const store = cookies();
  const expected = (process.env.ADMIN_USERNAME ?? 'MOVIC').trim().toUpperCase();
  const secret = process.env.ADMIN_SESSION_SECRET ?? process.env.ADMIN_PASSWORD ?? '';
  if (await verifyAdminToken(store.get('agroflux_admin_token')?.value, secret, expected)) return true;
  const claims = await verifySessionToken(store.get('agroflux_user_token')?.value, secret);
  return Boolean(claims && claims.allowedUnits.includes('rh') && claims.access.includes('Messages de contact'));
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as { name?: unknown; email?: unknown; phone?: unknown; subject?: unknown; message?: unknown };
    const name = String(body.name ?? '').trim(); const email = String(body.email ?? '').trim(); const phone = String(body.phone ?? '').trim(); const subject = String(body.subject ?? '').trim(); const message = String(body.message ?? '').trim();
    if (!name || !email || !subject || !message || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return NextResponse.json({ error: 'Nom, email, sujet et message valides sont obligatoires.' }, { status: 400 });
    if (name.length > 120 || email.length > 160 || phone.length > 40 || subject.length > 120 || message.length > 5000) return NextResponse.json({ error: 'Un champ dépasse la taille autorisée.' }, { status: 400 });
    const contact = await createContactMessage({ name, email, phone, subject, message });
    return NextResponse.json({ ok: true, contact }, { status: 201 });
  } catch { return NextResponse.json({ error: 'Impossible d’enregistrer votre message.' }, { status: 400 }); }
}

export async function GET() {
  if (!(await canManageContactMessages())) return NextResponse.json({ error: 'Accès réservé à l’administration ou à l’unité RH.' }, { status: 403 });
  return NextResponse.json({ messages: await listContactMessages() }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function PATCH(request: Request) {
  if (!(await canManageContactMessages())) return NextResponse.json({ error: 'Accès réservé à l’administration ou à l’unité RH.' }, { status: 403 });
  try {
    const body = await request.json() as { id?: string; status?: ContactMessageStatus };
    if (!body.id || !['Nouveau', 'Lu', 'Traité'].includes(body.status ?? '')) return NextResponse.json({ error: 'Message ou statut invalide.' }, { status: 400 });
    const message = await updateContactMessage(body.id, body.status!);
    return message ? NextResponse.json({ ok: true, message }) : NextResponse.json({ error: 'Message introuvable.' }, { status: 404 });
  } catch { return NextResponse.json({ error: 'Modification impossible.' }, { status: 400 }); }
}
