import { createFileRoute } from '@tanstack/react-router';
import { PagePermissions } from '@/components/erp/permissions';
import { meta } from '@/lib/erp-data';

export const Route = createFileRoute('/permissions')({
  head: () => meta('Page Permissions', 'Govern workspace member page visibility & permissions in real-time.'),
  component: PagePermissions,
});
