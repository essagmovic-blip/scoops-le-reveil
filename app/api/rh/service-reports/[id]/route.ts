import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { verifySessionToken } from '@/lib/admin-session';
import { isServiceReportStatus, updateServiceReport } from '@/lib/service-report-store';

async function claims() {
  const token = cookies().get('agroflux_user_token')?.value;
  const secret = process.env.ADMIN_SESSION_SECRET ?? process.env.ADMIN_PASSWORD ?? '';
  return verifySessionToken(token, secret);
}

function canReadReports(session: Awaited<ReturnType<typeof claims>>) {
  if (!session) return false;
  return session.admin || session.allowedUnits.includes('rh') || session.access.some((item) => ['Personnel', 'Rapports RH', 'Rapports'].includes(item));
}

export async function PATCH(request: Request, context: { params: { id: string } }) {
  const session = await claims();
  if (!canReadReports(session)) return NextResponse.json({ error: 'Accès RH requis.' }, { status: 403 });
  try {
    const body = await request.json() as { status?: unknown; validationComment?: unknown };
    const status = isServiceReportStatus(body.status) ? body.status : 'Lu';
    const now = new Date().toISOString();
    const updated = await updateServiceReport(context.params.id, { status, readAt: status === 'Non lu' ? undefined : now, readBy: session?.sub ?? '', validationComment: typeof body.validationComment === 'string' ? body.validationComment.trim() : '' });
    if (!updated) return NextResponse.json({ error: 'Rapport introuvable.' }, { status: 404 });
    return NextResponse.json({ report: updated });
  } catch {
    return NextResponse.json({ error: 'Impossible de mettre à jour le rapport.' }, { status: 500 });
  }
}
