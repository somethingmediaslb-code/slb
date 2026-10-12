import { createFileRoute } from '@tanstack/react-router';
import { MasterPage } from '@/components/erp/masters';
import { meta } from '@/lib/erp-data';
export const Route = createFileRoute('/parties')({ head: () => meta('Party Master', 'Manage factory customers and company records.'),  component: () => <MasterPage kind="parties" /> });
