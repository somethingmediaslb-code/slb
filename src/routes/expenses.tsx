import { createFileRoute } from '@tanstack/react-router';
import { Expenses } from '@/components/erp/expenses';
import { meta } from '@/lib/erp-data';
export const Route = createFileRoute('/expenses')({ head: () => meta('Expenses & Borrowings', 'Track factory costs, labour advances and realised profit.'),  component: Expenses });
