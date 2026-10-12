import { createFileRoute } from '@tanstack/react-router';
import { MasterPage } from '@/components/erp/masters';
import { meta } from '@/lib/erp-data';
export const Route = createFileRoute('/items')({ head: () => meta('Item Master', 'Manage packaging types, dimensions and specifications.'),  component: () => <MasterPage kind="items" /> });
