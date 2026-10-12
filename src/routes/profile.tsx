import { createFileRoute } from '@tanstack/react-router';
import { Profile } from '@/components/erp/account';
import { meta } from '@/lib/erp-data';
export const Route = createFileRoute('/profile')({ head: () => meta('Account Profile', 'Manage your CrateERP account profile.'),  component: Profile });
