# CrateERP Factory Role Decisions & Policy Summary

> **Document Type:** Operational Business Rules & Owner Briefing  
> **Audience:** Factory Owner / Managing Director (Non-technical plain English)  
> **Status:** Active Working Policies (Marked for final factory confirmation)

---

### Executive Summary
To protect your factory's profit margins, customer pricing, and worker piece rates, CrateERP enforces **role-based security**. On a factory floor where supervisors and gate clerks use mobile phones on shared Wi-Fi, sensitive financial numbers are physically hidden at the database level. 

Below is the one-page summary of how your factory roles are configured, with specific business policies marked **`ASSUMED - confirm with client`** for your operational sign-off.

---

### 1. Piece-Rate Setting & Shop-Floor Labour
* **Policy:** Only the **Owner (Admin)** or **Plant Manager** can set piece rates for wooden boxes, pallets, or crates.
* **Supervisor Experience:** The floor supervisor selects the carpenter and the quantity to produce. The system automatically attaches the pre-configured piece rate. The supervisor **never sees or edits** the rate on their screen.
* **Missing Rate Handling (`ASSUMED - confirm with client`):** If a custom box is allocated without a pre-set piece rate, the work continues on the floor under a **"Rate Pending"** flag. The payroll system will **skip** this work during weekly wage calculation and highlight it so the Owner can enter the agreed rate before payment is disbursed.

---

### 2. Customer & Party Privacy on the Shop Floor
* **Policy (`ASSUMED - confirm with client`):** Shop-floor supervisors see the **Customer Company Name** (e.g. *Tata Motors*, *Mahindra*) so they can stencil and label crates correctly. However, supervisors **cannot see** phone numbers, email addresses, billing addresses, GSTIN numbers, or box selling prices.
* **Gate / Dispatch Clerk:** Can see the customer name and delivery address to issue delivery challans and verify lorry receipts (LR), but **cannot see** box unit rates or invoice amounts.

---

### 3. Order Creation & Invoicing Authority
* **Policy (`ASSUMED - confirm with client`):** **Accountants CANNOT create or edit sales orders.** Order booking is reserved exclusively for the Owner and Plant Manager to prevent unverified commitments.
* **Accountant Access:** The accountant can view orders with full pricing for GST billing and payment tracking, and has full authority to record overhead expenses, worker cash advances (borrowings), and weekly payroll disbursements.

---

### 4. Gate Pass Cancellations & Order Short-Closing
* **Delivery Challan Cancellation:** A draft delivery challan can be cancelled by the **Admin** or **Manager** before the truck leaves the gate. Once a challan is marked **"Dispatched"**, it is legally final and **cannot be cancelled**.
* **Closing Orders Short (`ASSUMED - confirm with client`):** If a customer cancels an undelivered balance, **only the Owner (Admin)** can officially close the order short with a mandatory written reason (minimum 5 characters). Plant managers and clerks cannot truncate orders.

---

### 5. Who Can See Financial Numbers (Money Roles)?
The factory separates personnel into **Money Roles** and **Operations Roles**:

| Factory Role | Sees Selling Prices & Box Rates? | Sees Worker Wages & Earnings? | Sees Factory Net Profit? | Authority to Enter Expenses / Advances? |
| :--- | :---: | :---: | :---: | :---: |
| **Owner (Admin)** | **YES** | **YES** | **YES** | Full Access |
| **Plant Manager** | **YES** | **YES** | **YES** | Operations & Logistics Only |
| **Accountant** | **YES** | **YES** | **NO** (Gross margins only) | Full Expense & Wage Payment |
| **Production Supervisor** | **NO (Hidden / ₹0)** | **NO (Hidden / ₹0)** | **NO** | Physical quantities only |
| **Dispatch / Gate Clerk** | **NO (Hidden / ₹0)** | **NO (Hidden / ₹0)** | **NO** | Lorry & freight records only |
| **Auditor / Silent Viewer**| **NO** | **NO** | **NO** | Read-only operational counts |

---

### 6. Managing System Roles & Security
* **Owner-Only Administration:** Only the primary Owner account can change an employee's role or grant system access.
* **Anti-Lockout Protection:** The system strictly prevents demoting or deleting the last active Administrator.
* **New Employee Registrations:** Anyone creating a new account is automatically placed into **"Pending Verification"** and cannot see any factory data until the Owner approves them in the Admin Panel.

---

### Action Required by Client
Please review the items tagged **`ASSUMED - confirm with client`**. If you wish to change any rule (for example, allowing your accountant to enter orders directly, or hiding customer names from supervisors), let us know and the configuration table will be updated.
