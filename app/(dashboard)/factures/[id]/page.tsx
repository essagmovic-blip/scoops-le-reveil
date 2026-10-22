import { InvoiceDetailView } from '@/components/invoice-detail-view';

export default function InvoiceDetailPage({ params }: { params: { id: string } }) {
  return <InvoiceDetailView id={params.id} />;
}
