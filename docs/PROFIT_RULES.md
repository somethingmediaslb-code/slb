# CrateERP Profit & Revenue Recognition Rules

> **Document Status:** Business & Mathematical Specification.  
> **Mandatory Review:** Requires Owner Sign-Off before implementing SQL Profit Views or Reports.  
> **Target Audience:** Factory Owner, Chief Accountant, Full-Stack Engineers.

---

## 1. Principles of Realised vs Estimated Profit

In a wooden box, crate, and pallet manufacturing plant, physical production often spans multiple days, while dispatches are executed in partial truckloads. To prevent cash-flow distortion and false accounting, CrateERP enforces a strict demarcation between **Realised Financials** and **Estimated Pipeline Value**.

### 1.1 Realised Revenue & Profit (Dispatched Challans Only)
1. **Trigger Condition:** Realised revenue and realised profit are recognized **strictly and solely** when a `delivery_challan` attains status `'Dispatched'`.
2. **Exclusion of Drafts:** Challans in status `'Delivery Challan Made'` represent goods loaded on the factory staging floor or awaiting transporter pickup / LR receipt. They do **NOT** constitute realised revenue or profit.
3. **Exclusion of Cancellations:** Any challan with status `'Cancelled'` is completely excluded from financial aggregation. Its quantities are returned to the order item's available balance, and its direct labour cost is reversed from dispatch totals.

### 1.2 Estimated Profit on Undispatched Inventory (WIP / Finished Goods)
1. **Uncompleted & Unshipped Work:** Orders in `'Pending'` or `'In Production'` status, as well as completed goods staged on the floor without a dispatched challan, are tracked as **Estimated Pipeline Profit**.
2. **Strict UI Separation:** Realised Profit and Estimated Pipeline Profit must **never** be summed into a single headline metric. They must be presented in separate dashboard widgets:
   - **Realised Gross Margin:** (Actual billed deliveries out the gate minus actual labour, freight, and attributed expenses).
   - **Estimated WIP Margin:** (Expected sales value of orders in queue minus projected piece-rate labour cost).

---

## 2. Treatment of Labour Borrowings & Advances

### 2.1 Accounting Classification: Advances are NOT Factory Costs
- A **Labour Borrowing** is an advance paid to a piece-rate carpenter/worker against unearned or future piece-work wages.
- It is an asset/receivable on the company balance sheet, **not an operating manufacturing expense**.
- When payroll is processed, the borrowing is recovered by deducting it from the worker's gross piece-rate earnings (`gross - deductions = net_paid`).
- Therefore, if a borrowing is recorded in the `expenses` table or treated as an operating cost, the company would **double-count the labour cost**:
  1. Once as an expense when the cash advance is handed over to the worker.
  2. A second time inside the piece-rate labour cost (`completed_qty * labour_rate`) assigned to the finished box.

### 2.2 Current Code Audit & Gap Confirmation
- **Current Behavior in Code:**  
  In [`src/lib/erp-data.ts`](file:///e:/ERP-box/slb/src/lib/erp-data.ts#L11), the calculation is:
  ```ts
  const shared = d.expenses.filter(e => !e.reference_dc_id).reduce((s, e) => s + e.amount, 0);
  ```
  The current code filters only `!e.reference_dc_id`. If an expense is logged with category `'Labour Borrowing'`, it is currently **erroneously included in shared expenses** and subtracted from net profit, causing duplicate wage subtraction!
- **Mandated Rule for Database View / Engine:**  
  All profit queries and views must explicitly filter out borrowing advances:
  ```sql
  WHERE expenses.category <> 'Labour Borrowing'
  ```
  Labour borrowings must be tracked exclusively in `labour_borrowings` and settled via `labour_payroll`.

---

## 3. Direct Labour Cost Assignment (`challan_items.direct_labour_cost`)

### 3.1 Assignment Methodology (Weighted Average Piece-Rate)
When a delivery challan line is created in `factory_action('challan', ...)`:
1. The system computes the **weighted average piece-rate** paid for all completed units of that specific order item:
   $$\text{Effective Labour Rate} = \frac{\sum (\text{completed\_qty} \times \text{labour\_rate})}{\sum \text{completed\_qty}}$$
2. The direct labour cost stored on the challan item is:
   $$\text{challan\_items.direct\_labour\_cost} = \text{dispatched\_qty} \times \text{Effective Labour Rate}$$

### 3.2 Assumptions & Operational Limits
- **Assumption:** The piece-rate logged during allocation accurately represents the actual manufacturing wage paid for the physical units being loaded into the truck.
- **Operational Limitation (Non-FIFO Batching):** If 50 boxes were made by a senior carpenter at ₹40/box and 50 boxes were made by a trainee at ₹30/box (average ₹35), shipping 50 boxes assigns a direct labour cost of ₹1,750 (50 × ₹35), regardless of which physical stack the loader lifted into the truck.
- **Audit Requirement:** The direct labour cost is fixed at the moment the challan is prepared. If labour rates are later adjusted in past allocations, the historical snapshot on `challan_items` remains immutable to ensure audited dispatch margins do not fluctuate retroactively.

---

## 4. Shared Expenses & Freight Allocation Across Challans

### 4.1 Direct vs Shared Expenses
1. **Direct Freight (`delivery_challans.freight_charges`):**  
   Attributed 100% to the specific challan. If the customer pays freight directly to the truck driver (To-Pay basis), freight is recorded as 0. If the factory pays the transporter, it is deducted from the challan's margin.
2. **Direct Challan Expense (`expenses.reference_dc_id IS NOT NULL`):**  
   Attributed 100% to the referenced delivery challan (e.g. specific loading/unloading coolie charges, strapping tape bought specifically for that shipment).
3. **Shared Overhead / Operating Expenses (`expenses.reference_dc_id IS NULL`):**  
   Expenses such as factory nails, diesel generator fuel, saw sharpening, electricity, or general hardware that cannot be tied to a single challan.

### 4.2 Allocation Formula (Allocation by Dispatched Quantity)
To adhere to the single-count accounting rule ("an expense is counted once and only once"):
- Shared expenses incurred within a given reporting period (e.g. month or financial year) are apportioned across all challans dispatched within that same period based on **dispatched piece quantity**:
  $$\text{Challan Shared Expense} = \text{Total Period Shared Expenses} \times \frac{\text{Challan Total Qty}}{\text{Total Period Dispatched Qty}}$$
- If a delivery challan contains high-value custom machinery crates and cheap pine pallets, allocation by quantity can slightly bias overhead onto simpler crates. The alternative is allocation by **Dispatched Revenue Value**:
  $$\text{Challan Shared Expense} = \text{Total Period Shared Expenses} \times \frac{\text{Challan Revenue}}{\text{Total Period Dispatched Revenue}}$$
- **Default Recommendation for Crate Factories:** **Dispatched Quantity Allocation** (current implementation in `erp-data.ts`), as physical overhead (nails, handling, power) scales primarily with box volume and unit count rather than selling price.

---

## 5. Comprehensive Worked Example with Real Numbers

Consider a scenario in Financial Year 26-27:

### Order Details:
- **Order No:** `26-27/PO-0015`
- **Customer:** Auto Components Ltd.
- **Item 1:** 100 Heavy Duty Engine Crates @ **₹800 / crate**. Total Order Value = ₹80,000.

### Production Allocations:
- **Batch 1 (50 units):** Allocated to Carpenter Ramesh @ **₹70 / crate**. (Completed: 50 units, Cost = ₹3,500).
- **Batch 2 (50 units):** Allocated to Carpenter Suresh @ **₹60 / crate**. (Completed: 50 units, Cost = ₹3,000).
- **Total Completed:** 100 units. Total Piece-rate Cost = ₹6,500.
- **Effective Labour Rate:** $\frac{₹6,500}{100} =$ **₹65.00 / crate**.

### Additional Factory Activity during the Month:
- **Labour Advance Paid:** Ramesh takes an advance of **₹2,000** (recorded in `labour_borrowings`).  
  *Accounting Rule:* Ignored in profit calculation. Excluded from expenses.
- **Direct Freight:** ₹1,500 paid for truck delivery of Challan 1.
- **General Overhead (Shared Nails & Strapping):** ₹2,600 total unlinked shared expenses incurred across all factory jobs.
- **Factory-Wide Total Dispatched Qty in Month:** 200 crates (this order represents 60 crates shipped this month, other orders represent 140 crates).

---

### Challan 1 Lifecycle (`26-27/DC-0021`):
- **Dispatched Qty:** 60 crates.
- **Status:** `'Dispatched'`.
- **Vehicle:** `GJ-01-XY-9876`.

#### Financial Computation:
1. **Realised Revenue:**  
   $$60 \text{ crates} \times ₹800 = \mathbf{₹48,000.00}$$
2. **Direct Labour Cost:**  
   $$60 \text{ crates} \times ₹65.00 = \mathbf{₹3,900.00}$$
3. **Direct Freight:**  
   $$\mathbf{₹1,500.00}$$
4. **Apportioned Shared Overhead:**  
   $$₹2,600 \times \left(\frac{60}{200}\right) = \mathbf{₹780.00}$$
5. **Realised Net Profit:**  
   $$₹48,000 - ₹3,900 - ₹1,500 - ₹780 = \mathbf{₹41,820.00}$$
6. **Realised Gross Margin:**  
   $$\frac{₹41,820}{₹48,000} \times 100 = \mathbf{87.13\%}$$

---

### Staged / Undispatched Balance (40 Crates remaining in Factory):
- **Completed Qty on Floor:** 40 crates.
- **Status:** Unshipped (WIP Finished Goods).
- **Realised Revenue:** **₹0.00** (NOT recognized).
- **Realised Profit:** **₹0.00** (NOT recognized).
- **Estimated Pipeline Revenue:** $40 \times ₹800 = \mathbf{₹32,000.00}$.
- **Estimated WIP Cost:** $40 \times ₹65 = \mathbf{₹2,600.00}$.
- **Estimated Pipeline Margin:** $\mathbf{₹29,400.00}$ *(clearly tagged as Estimated Pipeline WIP, never mixed with Realised Cash Profit)*.
