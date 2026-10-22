import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { verifySessionToken } from '@/lib/admin-session';
import { readConfidentialAttachment } from '@/lib/confidential-correspondence-store';

async function getClaims() {
  const token = cookies().get('agroflux_user_token')?.value;
  const secret = process.env.ADMIN_SESSION_SECRET ?? process.env.ADMIN_PASSWORD ?? '';
  return verifySessionToken(token, secret);
}

export async function GET(_request: Request, { params }: { params: { messageId: string; attachmentId: string } }) {
  const claims = await getClaims();
  if (!claims) return NextResponse.json({ error: 'Session invalide.' }, { status: 401 });
  const attachment = await readConfidentialAttachment(params.messageId, params.attachmentId, claims.sub);
  if (!attachment) return NextResponse.json({ error: 'Pièce jointe introuvable ou non autorisée.' }, { status: 404 });
  return new Response(attachment.bytes, { headers: { 'Content-Type': attachment.mimeType, 'Content-Length': String(attachment.size), 'Content-Disposition': `attachment; filename="${attachment.fileName.replace(/"/g, '_')}"`, 'Cache-Control': 'private, no-store' } });
}
