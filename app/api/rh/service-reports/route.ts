import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { verifySessionToken } from '@/lib/admin-session';
import { listServiceReports, saveServiceReport } from '@/lib/service-report-store';
import type { ServiceReport } from '@/lib/service-reports';

function sessionClaims() {
  const token = cookies().get('agroflux_user_token')?.value;
  const secret = process.env.ADMIN_SESSION_SECRET ?? process.env.ADMIN_PASSWORD ?? '';
  return verifySessionToken(token, secret);
}

function canReadReports(claims: Awaited<ReturnType<typeof sessionClaims>>) {
  if (!claims) return false;
  return claims.admin || claims.allowedUnits.includes('rh') || claims.access.some((item) => ['Personnel', 'Rapports RH', 'Rapports'].includes(item));
}

export async function GET() {
  const claims = await sessionClaims();
  if (!canReadReports(claims)) return NextResponse.json({ error: 'Accès RH requis.' }, { status: 403 });
  return NextResponse.json({ reports: await listServiceReports() }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(request: Request) {
  const claims = await sessionClaims();
  if (!claims) return NextResponse.json({ error: 'Session requise.' }, { status: 401 });
  try {
    const body = await request.json() as Partial<ServiceReport>;
    if (!body.id || !body.responsibleId || !body.responsibleName || body.unitId !== 'poulets' || !body.serviceDate || !body.shift) {
      return NextResponse.json({ error: 'Rapport incomplet.' }, { status: 400 });
    }
    const now = new Date().toISOString();
    const report: ServiceReport = {
      ...(body as ServiceReport),
      status: 'Non lu',
      generatedAt: body.generatedAt || now,
      submittedAt: now,
      readAt: undefined,
      readBy: undefined,
      validationComment: '',
    };
    await saveServiceReport(report);
    return NextResponse.json({ report }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Impossible d’enregistrer le rapport.' }, { status: 500 });
  }
}
