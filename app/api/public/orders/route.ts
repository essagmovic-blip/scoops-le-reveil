import { NextResponse } from 'next/server';
import { createCustomerOrder } from '@/lib/customer-order-store';
import { customerOrderTotal, type CustomerOrderUnitId } from '@/lib/customer-orders';

const units = ['poulets', 'provenderie', 'bio', 'pressoir', 'stocks', 'chevrerie'];

export async function POST(request: Request) {
  try {
    const body = await request.json() as { requestedDate?: string; unitId?: string; customerName?: string; customerPhone?: string; customerEmail?: string; deliveryAddress?: string; note?: string; lines?: Array<{ description?: string; quantity?: number; unit?: string; unitPrice?: number }> };
    const lines = (body.lines ?? []).map((line, index) => ({ id: `L-${Date.now()}-${index}`, description: String(line.description ?? '').trim(), quantity: Number(line.quantity ?? 0), unit: String(line.unit ?? 'unité'), unitPrice: Number(line.unitPrice ?? 0), total: Number(line.quantity ?? 0) * Number(line.unitPrice ?? 0) })).filter((line) => line.description && line.quantity > 0);
    if (!body.customerName?.trim() || !body.customerPhone?.trim() || !body.deliveryAddress?.trim() || !units.includes(String(body.unitId)) || !lines.length || customerOrderTotal(lines) < 0) return NextResponse.json({ error: 'Nom, téléphone, adresse, unité et au moins un article sont obligatoires.' }, { status: 400 });
    const order = await createCustomerOrder({ requestedDate: String(body.requestedDate ?? new Date().toISOString().slice(0, 10)), unitId: String(body.unitId) as CustomerOrderUnitId, customerName: body.customerName.trim(), customerPhone: body.customerPhone.trim(), customerEmail: String(body.customerEmail ?? '').trim(), deliveryAddress: body.deliveryAddress.trim(), note: String(body.note ?? '').trim(), lines });
    return NextResponse.json({ ok: true, order }, { status: 201 });
  } catch { return NextResponse.json({ error: 'Commande invalide.' }, { status: 400 }); }
}
