import { createFileRoute } from '@tanstack/react-router';
import { Dispatch } from '@/components/erp/dispatch';
import { meta } from '@/lib/erp-data';
export const Route = createFileRoute('/dispatch')({ head: () => meta('Dispatch & Delivery Challans', 'Manage partial deliveries and printable delivery challans.'),  component: Dispatch });
