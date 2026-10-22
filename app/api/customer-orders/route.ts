import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { verifySessionToken } from '@/lib/admin-session';
import { isDelivererProfile } from '@/lib/internal-logistics';
import { listCustomerOrders, updateCustomerOrder } from '@/lib/customer-order-store';

async function getClaims() {
  const token = cookies().get('agroflux_user_token')?.value;
  const secret = process.env.ADMIN_SESSION_SECRET ?? process.env.ADMIN_PASSWORD ?? '';
  return verifySessionToken(token, secret);
}
function canUseUnit(claims: Awaited<ReturnType<typeof getClaims>>, unitId: string) { return Boolean(claims?.admin || (claims?.allowedUnits.includes(unitId) && (isDelivererProfile(claims) || claims.access.some((right) => ['Commandes clients', 'Ventes & factures', 'Clients'].includes(right))))); }
function safe(order: Awaited<ReturnType<typeof listCustomerOrders>>[number]) { return order; }

export async function GET() {
  const claims = await getClaims();
  if (!claims) return NextResponse.json({ error: 'Session invalide.' }, { status: 401 });
  const orders = await listCustomerOrders();
  return NextResponse.json({ orders: claims.admin ? orders : orders.filter((order) => canUseUnit(claims, order.unitId)) }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function PATCH(request: Request) {
  const claims = await getClaims();
  if (!claims) return NextResponse.json({ error: 'Session invalide.' }, { status: 401 });
  try {
    const body = await request.json() as { id?: string; status?: string; paidAmount?: number; paymentStatus?: string; deliveryComment?: string; deliveredBy?: string; stockDeductedAt?: string };
    const all = await listCustomerOrders();
    const existing = all.find((order) => order.id === body.id || order.code === body.id);
    if (!existing || !canUseUnit(claims, existing.unitId)) return NextResponse.json({ error: 'Commande non autorisée.' }, { status: 403 });
    const allowedStatuses = ['Reçue', 'Confirmée', 'En préparation', 'Prête', 'En livraison', 'Livrée', 'Annulée'];
    if (body.status && !allowedStatuses.includes(body.status)) return NextResponse.json({ error: 'Statut invalide.' }, { status: 400 });
    const order = await updateCustomerOrder(existing.id, { status: body.status as never, paidAmount: body.paidAmount, paymentStatus: body.paymentStatus as never, deliveryComment: body.deliveryComment, deliveredBy: body.deliveredBy, stockDeductedAt: body.stockDeductedAt });
    return NextResponse.json({ ok: true, order: safe(order!) });
  } catch { return NextResponse.json({ error: 'Modification invalide.' }, { status: 400 }); }
}
