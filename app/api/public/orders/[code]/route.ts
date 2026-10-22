import { NextResponse } from 'next/server';
import { findCustomerOrder } from '@/lib/customer-order-store';

export async function GET(_request: Request, { params }: { params: { code: string } }) {
  const order = await findCustomerOrder(params.code);
  if (!order) return NextResponse.json({ error: 'Commande introuvable.' }, { status: 404 });
  return NextResponse.json({ order });
}
