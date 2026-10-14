import { createFileRoute } from '@tanstack/react-router';
import { Reports } from '@/components/erp/reports';
import { meta } from '@/lib/erp-data';

export const Route = createFileRoute('/reports')({
  head: () => meta('Reports & Realised Profit', 'Enterprise factory reports, quantity distributions, and realised profit accounting.'),
  component: Reports,
});
