import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { verifySessionToken } from '@/lib/admin-session';
import { createConfidentialMessage, listConfidentialMessagesFor, markConfidentialMessageRead, type ConfidentialAttachmentInput } from '@/lib/confidential-correspondence-store';
import { listManagedUsers } from '@/lib/server-user-store';

async function session() { const token = cookies().get('agroflux_user_token')?.value; const secret = process.env.ADMIN_SESSION_SECRET ?? process.env.ADMIN_PASSWORD ?? ''; return verifySessionToken(token, secret); }
function isRecipient(user: { role?: string; allowedUnits?: string[]; identifier?: string }) { const role = (user.role ?? '').trim().toUpperCase(); return ['PDG', 'DG', 'ADMINISTRATRICE'].includes(role) || role.includes('RH') || (user.allowedUnits ?? []).includes('rh') || user.identifier?.toUpperCase() === (process.env.ADMIN_USERNAME ?? 'MOVIC').trim().toUpperCase(); }
async function recipients() { const managed = await listManagedUsers(); const adminId = (process.env.ADMIN_USERNAME ?? 'MOVIC').trim().toUpperCase(); const options = managed.filter(isRecipient).map((user) => ({ id: user.id, name: user.name, role: user.role })); if (!options.some((user) => user.id === adminId)) options.push({ id: adminId, name: adminId, role: 'Administrateur principal' }); return options; }

export async function GET() { const claims = await session(); if (!claims) return NextResponse.json({ error: 'Session invalide.' }, { status: 401 }); return NextResponse.json({ messages: await listConfidentialMessagesFor(claims.sub), recipients: (await recipients()).filter((user) => user.id !== claims.sub) }, { headers: { 'Cache-Control': 'no-store' } }); }

export async function POST(request: Request) {
  const claims = await session();
  if (!claims) return NextResponse.json({ error: 'Session invalide.' }, { status: 401 });
  try {
    const body = await request.json() as { recipientId?: string; subject?: string; body?: string; attachments?: ConfidentialAttachmentInput[] };
    const options = await recipients();
    const recipient = options.find((user) => user.id === body.recipientId && user.id !== claims.sub);
    const subject = String(body.subject ?? '').trim(); const messageBody = String(body.body ?? '').trim();
    const attachments = Array.isArray(body.attachments) ? body.attachments.slice(0, 5).map((attachment) => ({ fileName: String(attachment.fileName ?? ''), mimeType: String(attachment.mimeType ?? ''), data: String(attachment.data ?? '') })) : [];
    if (!recipient || !subject || !messageBody) return NextResponse.json({ error: 'Destinataire, objet et contenu sont obligatoires.' }, { status: 400 });
    const senderName = cookies().get('agroflux_user_name')?.value ?? claims.sub;
    const message = await createConfidentialMessage({ senderId: claims.sub, senderName, recipientId: recipient.id, recipientName: recipient.name, subject, body: messageBody, attachments });
    return NextResponse.json({ ok: true, message }, { status: 201 });
  } catch { return NextResponse.json({ error: 'Courrier confidentiel invalide.' }, { status: 400 }); }
}

export async function PATCH(request: Request) {
  const claims = await session();
  if (!claims) return NextResponse.json({ error: 'Session invalide.' }, { status: 401 });
  try { const body = await request.json() as { id?: string }; const message = await markConfidentialMessageRead(String(body.id ?? ''), claims.sub); if (!message) return NextResponse.json({ error: 'Courrier introuvable ou non autorisé.' }, { status: 403 }); return NextResponse.json({ ok: true, message }); } catch { return NextResponse.json({ error: 'Lecture impossible.' }, { status: 400 }); }
}
