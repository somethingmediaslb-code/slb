import { createFileRoute } from '@tanstack/react-router';
import { Settings } from '@/components/erp/account';
import { meta } from '@/lib/erp-data';
export const Route = createFileRoute('/settings')({ head: () => meta('Settings', 'Manage push notifications and account settings.'),  component: Settings });
