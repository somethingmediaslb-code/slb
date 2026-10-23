import { createFileRoute } from '@tanstack/react-router';
import { UnderProduction } from '@/components/erp/under-production';
import { meta } from '@/lib/erp-data';

export const Route = createFileRoute('/under-production')({
  head: () => meta('Under Production', 'Monitor running production batches, live ticking timers, and multiple floor allocations.'),
  component: UnderProduction
});
