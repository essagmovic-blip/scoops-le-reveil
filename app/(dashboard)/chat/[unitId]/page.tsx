import { notFound } from 'next/navigation';
import { ChatView } from '@/components/chat-view';
import { units, type UnitId } from '@/lib/data';

export default function UnitChatPage({ params }: { params: { unitId: string } }) {
  if (!units.some((unit) => unit.id === params.unitId)) notFound();
  return <ChatView contextUnitId={params.unitId as UnitId} />;
}
