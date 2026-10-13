import { createFileRoute } from '@tanstack/react-router';
import { LoginPage } from '@/components/erp/auth';
import { meta } from '@/lib/erp-data';

export const Route = createFileRoute('/login')({
  head: () => meta('Sign In', 'Sign in to your CrateERP factory workspace.'),
  component: LoginPage,
});
