import { createFileRoute } from '@tanstack/react-router';
import { Admin } from '@/components/erp/account';
import { meta } from '@/lib/erp-data';
export const Route = createFileRoute('/admin')({ head: () => meta('Admin Panel', 'Review administrative access to factory operations.'),  component: Admin });
