import { createFileRoute } from '@tanstack/react-router';
import { Production } from '@/components/erp/production';
import { meta } from '@/lib/erp-data';
export const Route = createFileRoute('/production')({ head: () => meta('Pending Production', 'Allocate pending packaging production to workers.'),  component: Production });
