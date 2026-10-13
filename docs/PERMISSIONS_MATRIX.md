# CrateERP Permissions & Role Access Matrix (Phase 1B Specification)

> **Document Status:** Active Specification (Decisions Approved / Implemented).  
> **Target Release:** Phase 1B (Roles & Privacy).  
> **Audience:** Factory Owner, System Architects, Full-Stack Engineering.

---

## 1. Role Taxonomy

| Role Slug | Display Title | Typical User | Core Mandate |
| :--- | :--- | :--- | :--- |
| `admin` | Owner / Factory Admin | Factory Owner, Managing Partner | Full financial, operational, and administrative control. |
| `manager` | Factory General Manager | Operations Head / Plant Manager | Oversees orders, production, inventory, logistics, and non-sensitive costs. Cannot edit user roles or close orders short. |
| `supervisor` | Production Supervisor | Floor Supervisor (Android on floor) | Dispatches piece-work allocations, logs completions, views physical queue. Blind to prices, billing totals, and labour wage payouts. |
| `accountant` | Accounts & Billing Clerk | Bookkeeper / Accounts Desk | Manages expenses, borrowing deductions, and disbursement records. Can view orders with prices for invoicing. Cannot create or edit orders. |
| `dispatch_clerk` | Dispatch & Logistics Clerk | Gate / Loading Bay Clerk | Creates and confirms delivery challans, vehicle numbers, LR details. Blind to order unit rates and labour rates. |
| `viewer` | Read-Only Stakeholder | Auditor / Silent Partner | Read-only view into operational statuses without mutation authority or money details. |
| `pending` | Unapproved New Account | Newly Registered User | Zero data access; parked on landing screen until assigned an active role by an `admin`. |

---

## 2. Granular Role Capabilities Matrix (`role_permissions` Table)

Access control is data-driven through the `role_permissions` table and checked dynamically via `fn_has_capability(capability text)`.

| Capability Slug | Description | `admin` | `manager` | `supervisor` | `accountant` | `dispatch_clerk` | `viewer` | `pending` |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| `view_money` | See rates, totals, revenue, profit, wages, borrowings | **YES** | **YES** | NO | **YES** | NO | NO | NO |
| `create_order` | Book new purchase orders & stock orders | **YES** | **YES** | NO | NO | NO | NO | NO |
| `edit_order` | Edit line items, dimensions, expected dates | **YES** | **YES** | NO | NO | NO | NO | NO |
| `assign_labour` | Allocate production to carpenters & log completions | **YES** | **YES** | **YES** | NO | NO | NO | NO |
| `set_rates` | Define item default piece-rates & override rates | **YES** | **YES** | NO | NO | NO | NO | NO |
| `create_challan`| Draft delivery challan & reserve inventory | **YES** | **YES** | NO | NO | **YES** | NO | NO |
| `confirm_dispatch`| Confirm gate dispatch & deduct physical stock | **YES** | **YES** | NO | NO | **YES** | NO | NO |
| `cancel_challan`| Cancel pending draft delivery challan | **YES** | **YES** | NO | NO | NO | NO | NO |
| `close_order_short`| Truncate undelivered balance with reason | **YES** | NO | NO | NO | NO | NO | NO |
| `run_payroll` | Calculate weekly piece-rate earnings batch | **YES** | **YES** | NO | **YES** | NO | NO | NO |
| `record_payment`| Disburse cash/bank payment to labour | **YES** | NO | NO | **YES** | NO | NO | NO |
| `manage_expenses`| Record factory expenses & operational overhead | **YES** | **YES** | NO | **YES** | NO | NO | NO |
| `manage_borrowings`| Issue advances/borrowings to workers | **YES** | **YES** | NO | **YES** | NO | NO | NO |
| `manage_masters` | Edit Party, Item, and Worker master records | **YES** | **YES** | NO | NO | NO | NO | NO |
| `manage_users` | Assign roles and grant access in Admin Panel | **YES** | NO | NO | NO | NO | NO | NO |
| `view_audit` | Inspect security audit trails and change history | **YES** | NO | NO | NO | NO | NO | NO |

---

## 3. Approved Business Decisions (Implemented in Phase 1B)

1. **Piece Rate Setting & Missing Rate Behavior:**
   - Piece rates are defined by `admin` or `manager` in `item_master.default_labour_rate`.
   - Floor supervisors assign labour and quantity; `factory_action('allocate')` automatically copies `default_labour_rate` into `production_allocations.labour_rate`. Supervisors never see or edit the rate.
   - If an item has no piece rate configured, the allocation is created with `labour_rate = NULL` and status `'Rate Pending'`.
   - `factory_action('payroll')` strictly skips allocations with `labour_rate IS NULL` and returns an error reporting the count of unrated allocations.
2. **Supervisor Party Visibility:**
   - Supervisors see the customer `company_name` only. Contact fields (`phone_number`, `contact_person`, `email`, `address`, `gstin`) and financial prices are masked as `NULL`.
3. **Accountant Order Authority:**
   - The accountant cannot create or edit orders (`create_order` and `edit_order` are denied).
   - The accountant can view orders with full pricing for invoicing, and has full access to `manage_expenses`, `manage_borrowings`, `run_payroll`, and `record_payment`.
4. **Cancellation and Closing Authority:**
   - Delivery challans can be cancelled before confirmation by `admin` and `manager`. Confirmed dispatched challans can never be cancelled.
   - Closing orders short is strictly reserved for `admin`.
5. **Dispatch Clerk Authority:**
   - Can draft and confirm delivery challans, enter vehicle and transport details (`create_challan`, `confirm_dispatch`).
   - Blind to order prices, billing totals, profit, and payroll (`view_money = false`).
6. **Payroll & System Administration:**
   - Recording payroll disbursements (`record_payment`) is authorized for `admin` and `accountant`.
   - `manager` can inspect payroll records (`run_payroll`) but cannot execute payments.
   - Admin Panel and user role assignments (`manage_users`) are restricted to `admin` only.

---

## 4. Architectural Implementation Strategy

### 4.1 Column-Level Privacy via Sanitized Views
- Base tables with money or contact information (`order_items`, `production_allocations`, `challan_items`, `expenses`, `labour_borrowings`, `labour_payroll`, `labour_payroll_disbursements`) enforce RLS allowing direct SELECT strictly to roles with `fn_has_capability('view_money')`.
- All other clients query the sanitized views (`v_orders`, `v_order_items`, `v_production_allocations`, `v_delivery_challans`, `v_challan_items`, `v_expenses`, `v_labour_borrowings`, `v_labour_payroll`, `v_labour_payroll_disbursements`, `v_party_master`, `v_item_master`).
- The views are owned by the database migration role (NOT `security_invoker`), returning identical column signatures with restricted values evaluated via `CASE WHEN fn_has_capability('view_money') THEN col ELSE NULL END`.

### 4.2 Zero-Data Realtime Event Ping Architecture
- Sensitive base tables are removed from `supabase_realtime` to prevent Postgres WAL from broadcasting rate/wage payloads to client sockets.
- Clients subscribe to a data-less event table: `public.factory_data_pings (id, table_name, changed_at)`.
- Lightweight triggers on business tables write change pings upon `INSERT`, `UPDATE`, or `DELETE`. The frontend subscribes to `factory_data_pings` and invalidates the TanStack Query cache.

### 4.3 RPC Capability Guardrails
Every action in `factory_action` and `soft_delete_record` opens with:
```sql
PERFORM public.fn_require_capability('<capability_name>');
```
If the caller lacks the required capability, an exception with SQLSTATE `42501` is raised.
