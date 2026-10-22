import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { verifySessionToken } from '@/lib/admin-session';
import { findHRDocumentFile, readHRDocumentBytes } from '@/lib/hr-document-store';
async function allowed() { const token = cookies().get('agroflux_user_token')?.value; const secret = process.env.ADMIN_SESSION_SECRET ?? process.env.ADMIN_PASSWORD ?? ''; const claims = await verifySessionToken(token, secret); return claims && (claims.admin || claims.allowedUnits.includes('rh')); }
export async function GET(_request: Request, { params }: { params: { id: string } }) { if (!(await allowed())) return NextResponse.json({ error: 'Accès RH requis.' }, { status: 403 }); const record = await findHRDocumentFile(params.id); if (!record) return NextResponse.json({ error: 'Document introuvable.' }, { status: 404 }); const bytes = await readHRDocumentBytes(record); return new Response(bytes, { headers: { 'Content-Type': record.mimeType, 'Content-Length': String(record.size), 'Content-Disposition': `attachment; filename="${record.fileName.replace(/"/g, '')}"`, 'Cache-Control': 'private, no-store' } }); }
