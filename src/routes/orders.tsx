import { createFileRoute } from '@tanstack/react-router';
import { Orders } from '@/components/erp/orders';
import { meta } from '@/lib/erp-data';
export const Route = createFileRoute('/orders')({
  head: () => meta('Order Entry', 'Create manufacturing orders and track outstanding quantities.'),
  validateSearch: (search: Record<string, unknown>): { new?: boolean; view?: string } => ({
    new: search['new'] === true || search['new'] === 'true',
    view: typeof search['view'] === 'string' ? search['view'] : undefined,
  }),
  component: Orders,
});
