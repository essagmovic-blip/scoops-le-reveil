import { supabaseAdmin } from './supabase-admin';
import { promises as fs } from 'fs';
import path from 'path';
import { randomBytes } from 'crypto';
import type { CustomerOrder, CustomerOrderLine, CustomerOrderStatus, CustomerOrderUnitId } from '@/lib/customer-orders';
import { customerOrderTotal } from '@/lib/customer-orders';

const storePath = path.join(process.cwd(), 'data', 'customer-orders.json');

async function writeLocalFallback(orders: CustomerOrder[]) {
  try {
    await fs.mkdir(path.dirname(storePath), { recursive: true });
    await fs.writeFile(storePath, JSON.stringify(orders, null, 2), 'utf8');
  } catch {}
}

async function readLocalFallback(): Promise<CustomerOrder[]> {
  try { return JSON.parse(await fs.readFile(storePath, 'utf8')) as CustomerOrder[]; } catch { return []; }
}

function makeCode() {
  return `CMD-CLI-${new Date().getFullYear()}-${Date.now().toString(36).toUpperCase().slice(-6)}-${randomBytes(2).toString('hex').toUpperCase()}`;
}

function mapRowToOrder(row: any): CustomerOrder {
  return {
    id: row.id,
    code: row.code,
    createdAt: row.created_at || new Date().toISOString(),
    requestedDate: row.requested_date || '',
    unitId: row.unit_id as CustomerOrderUnitId,
    customerName: row.customer_name,
    customerPhone: row.customer_phone,
    customerEmail: row.customer_email || '',
    deliveryAddress: row.delivery_address,
    note: row.note || '',
    lines: (row.lines as CustomerOrderLine[]) || [],
    amount: Number(row.amount || 0),
    paidAmount: Number(row.paid_amount || 0),
    paymentStatus: row.payment_status || 'À payer',
    status: (row.status as CustomerOrderStatus) || 'Reçue',
    qrPayload: row.qr_payload || `AGROFLUX:CLIENT:${row.code}`,
    confirmedAt: row.confirmed_at || '',
    preparedAt: row.prepared_at || '',
    readyAt: row.ready_at || '',
    departedAt: row.departed_at || '',
    deliveredAt: row.delivered_at || '',
    deliveryComment: row.delivery_comment || '',
    deliveredBy: row.delivered_by || '',
    stockDeductedAt: row.stock_deducted_at || '',
    invoiceId: row.invoice_id || '',
  };
}

function mapOrderToRow(order: CustomerOrder) {
  return {
    id: order.id,
    code: order.code,
    unit_id: order.unitId,
    customer_name: order.customerName,
    customer_phone: order.customerPhone,
    customer_email: order.customerEmail || null,
    delivery_address: order.deliveryAddress,
    requested_date: order.requestedDate || null,
    note: order.note || null,
    lines: order.lines,
    amount: order.amount,
    paid_amount: order.paidAmount,
    payment_status: order.paymentStatus,
    status: order.status,
    qr_payload: order.qrPayload,
    confirmed_at: order.confirmedAt || null,
    prepared_at: order.preparedAt || null,
    ready_at: order.readyAt || null,
    departed_at: order.departedAt || null,
    delivered_at: order.deliveredAt || null,
    delivery_comment: order.deliveryComment || null,
    delivered_by: order.deliveredBy || null,
    stock_deducted_at: order.stockDeductedAt || null,
    invoice_id: order.invoiceId || null,
    created_at: order.createdAt,
    updated_at: new Date().toISOString(),
  };
}

export async function listCustomerOrders(): Promise<CustomerOrder[]> {
  try {
    const { data, error } = await supabaseAdmin
      .from('customer_orders')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && data) {
      return data.map(mapRowToOrder);
    }
  } catch (err) {
    console.error('Error fetching customer_orders from Supabase:', err);
  }
  return readLocalFallback();
}

export async function findCustomerOrder(codeOrId: string): Promise<CustomerOrder | undefined> {
  try {
    const { data, error } = await supabaseAdmin
      .from('customer_orders')
      .select('*')
      .or(`code.eq.${codeOrId},id.eq.${codeOrId}`)
      .limit(1)
      .maybeSingle();

    if (!error && data) {
      return mapRowToOrder(data);
    }
  } catch (err) {
    console.error('Error finding customer_order in Supabase:', err);
  }
  const orders = await readLocalFallback();
  return orders.find((order) => order.code === codeOrId || order.id === codeOrId);
}

export async function createCustomerOrder(input: {
  requestedDate: string;
  unitId: CustomerOrderUnitId;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  deliveryAddress: string;
  note: string;
  lines: CustomerOrderLine[];
}): Promise<CustomerOrder> {
  const now = new Date().toISOString();
  const code = makeCode();
  const lines = input.lines.map((line, index) => ({
    ...line,
    id: line.id || `L-${Date.now()}-${index}`,
    unitPrice: Number(line.unitPrice || 0),
    total: Number(line.quantity || 0) * Number(line.unitPrice || 0),
  }));

  const order: CustomerOrder = {
    id: `ORDER-${Date.now()}`,
    code,
    createdAt: now,
    requestedDate: input.requestedDate,
    unitId: input.unitId,
    customerName: input.customerName,
    customerPhone: input.customerPhone,
    customerEmail: input.customerEmail,
    deliveryAddress: input.deliveryAddress,
    note: input.note,
    lines,
    amount: customerOrderTotal(lines),
    paidAmount: 0,
    paymentStatus: 'À payer',
    status: 'Reçue',
    qrPayload: `AGROFLUX:CLIENT:${code}`,
    confirmedAt: '',
    preparedAt: '',
    readyAt: '',
    departedAt: '',
    deliveredAt: '',
    deliveryComment: '',
    deliveredBy: '',
    stockDeductedAt: '',
    invoiceId: '',
  };

  try {
    const row = mapOrderToRow(order);
    const { error } = await supabaseAdmin.from('customer_orders').insert(row);
    if (error) console.error('Error inserting customer_order into Supabase:', error);
  } catch (err) {
    console.error('Exception inserting customer_order into Supabase:', err);
  }

  // Backup fallback local
  const orders = await readLocalFallback();
  await writeLocalFallback([order, ...orders]);
  return order;
}

export async function updateCustomerOrder(
  id: string,
  patch: Partial<Pick<CustomerOrder, 'status' | 'paidAmount' | 'paymentStatus' | 'deliveryComment' | 'deliveredBy' | 'invoiceId' | 'stockDeductedAt'>> & { now?: string }
): Promise<CustomerOrder | null> {
  const existing = await findCustomerOrder(id);
  if (!existing) return null;

  const now = patch.now || new Date().toISOString();
  const status = patch.status ?? existing.status;
  const record: CustomerOrder = {
    ...existing,
    ...patch,
    status,
    confirmedAt: status === 'Confirmée' && !existing.confirmedAt ? now : existing.confirmedAt,
    preparedAt: status === 'En préparation' && !existing.preparedAt ? now : existing.preparedAt,
    readyAt: status === 'Prête' && !existing.readyAt ? now : existing.readyAt,
    departedAt: status === 'En livraison' && !existing.departedAt ? now : existing.departedAt,
    deliveredAt: status === 'Livrée' && !existing.deliveredAt ? now : existing.deliveredAt,
    paidAmount: patch.paidAmount ?? existing.paidAmount,
    paymentStatus: patch.paymentStatus ?? existing.paymentStatus,
  };
  delete (record as CustomerOrder & { now?: string }).now;

  try {
    const row = mapOrderToRow(record);
    const { error } = await supabaseAdmin
      .from('customer_orders')
      .update(row)
      .eq('id', existing.id);
    if (error) console.error('Error updating customer_order in Supabase:', error);
  } catch (err) {
    console.error('Exception updating customer_order in Supabase:', err);
  }

  const localOrders = await readLocalFallback();
  await writeLocalFallback(localOrders.map((o) => (o.id === existing.id ? record : o)));
  return record;
}
