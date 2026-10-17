import { createFileRoute } from '@tanstack/react-router';
import { MasterPage } from '@/components/erp/masters';
import { meta } from '@/lib/erp-data';

export const Route = createFileRoute('/box-types')({
  head: () => meta('Box Types', 'Configure and manage box types, dimensions and specifications.'),
  component: () => <MasterPage kind="items" title="Box Types" />
});
