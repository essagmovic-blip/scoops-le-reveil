import { NextResponse } from 'next/server';
import { deleteServiceReportsByUnit } from '@/lib/service-report-store';

export async function POST(request: Request) {
  const session = request.headers.get('cookie')?.includes('agroflux_session=active');
  if (!session) return NextResponse.json({ error: 'Session administrateur requise.' }, { status: 401 });
  try {
    const body = await request.json();
    const unitId = String(body.unitId ?? '');
    const expectedPassword = unitId === 'poulets' ? process.env.ADMIN_PASSWORD : unitId === 'provenderie' ? process.env.PROVENDERIE_DELETE_PASSWORD : ['bio', 'pressoir', 'stocks', 'chevrerie', 'rh'].includes(unitId) ? (process.env.ADMIN_PASSWORD ?? '') : '';
    if (!['poulets', 'provenderie', 'bio', 'pressoir', 'stocks', 'chevrerie', 'rh'].includes(unitId)) return NextResponse.json({ error: 'Unité non autorisée.' }, { status: 400 });
    if (!expectedPassword || body.password !== expectedPassword) return NextResponse.json({ error: 'Mot de passe de confirmation incorrect.' }, { status: 403 });
    if (unitId === 'poulets') await deleteServiceReportsByUnit(unitId);
    return NextResponse.json({ ok: true, message: 'Suppression autorisée.' });
  } catch {
    return NextResponse.json({ error: 'Requête invalide.' }, { status: 400 });
  }
}
