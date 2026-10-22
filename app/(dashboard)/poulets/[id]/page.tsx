import { PoultryBatchDetailView } from '@/components/poultry-batch-detail-view';

export default function PoultryBatchPage({ params }: { params: { id: string } }) {
  return <PoultryBatchDetailView id={params.id} />;
}
