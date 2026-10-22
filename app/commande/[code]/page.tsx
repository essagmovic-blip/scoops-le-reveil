import { CustomerOrderTrackingView } from '@/components/customer-order-tracking-view';
export default function CustomerOrderTrackingPage({ params }: { params: { code: string } }) { return <CustomerOrderTrackingView code={params.code} />; }
