import { createFileRoute } from '@tanstack/react-router';
import { MasterPage } from '@/components/erp/masters';
import { meta } from '@/lib/erp-data';

export const Route = createFileRoute('/box-types')({
  head: () => meta('Product Types', 'Configure and manage product types, dimensions and specifications.'),
  component: () => <MasterPage kind="items" title="Product Types" />
});
