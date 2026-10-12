import { createFileRoute } from '@tanstack/react-router';
import { Dashboard } from '@/components/erp/dashboard';
import { meta } from '@/lib/erp-data';
export const Route = createFileRoute('/')({ head: () => meta('Dashboard', 'Factory orders, production, dispatch and realised profit.'),  component: Dashboard });
