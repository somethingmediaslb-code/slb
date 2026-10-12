import { createFileRoute } from '@tanstack/react-router';
import { Orders } from '@/components/erp/orders';
import { meta } from '@/lib/erp-data';
export const Route = createFileRoute('/orders')({ head: () => meta('Order Entry', 'Create manufacturing orders and track outstanding quantities.'), validateSearch: (search: Record<string, unknown>) => ({ new: search.new === true || search.new === 'true' }), component: Orders });
