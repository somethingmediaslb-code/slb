import { createFileRoute } from '@tanstack/react-router';
import { Labour } from '@/components/erp/labour';
import { meta } from '@/lib/erp-data';
export const Route = createFileRoute('/labour')({ head: () => meta('Labour Management', 'Record production completion, earnings and payroll.'),  component: Labour });
