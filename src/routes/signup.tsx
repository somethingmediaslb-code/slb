import { createFileRoute } from '@tanstack/react-router';
import { SignupPage } from '@/components/erp/auth';
import { meta } from '@/lib/erp-data';

export const Route = createFileRoute('/signup')({
  head: () => meta('Create Account', 'Create your CrateERP factory workspace account.'),
  component: SignupPage,
});
