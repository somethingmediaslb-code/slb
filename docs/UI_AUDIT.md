# UI Polish Pass: Comprehensive UI Audit (Part 1 of 2)

> **Execution Notice**: Browser automation is unavailable in this environment (Playwright browser driver download failed with HTTP 404). All audit findings and validations are verified directly from codebase analysis and typecheck/build compilation (`READ`).

---

## 1. Design Token & Scale Audit

### A. Color Tokens vs. Hardcoded One-Off Values

#### Established Tokens (`src/styles.css` `:root` & `@theme`)
| Token Name | Token Value | Intended Usage | Contrast Ratio on `#181818` | WCAG AA Status |
| :--- | :--- | :--- | :--- | :--- |
| `--background` | `#161616` | Root application background | — | Base |
| `--card` | `#1b1d20` | Surface cards, tables, panels | — | Base |
| `--popover` | `#161616` | Floating popovers, dropdowns | — | Base |
| `--foreground` | `#f9fbff` | Primary readable text | 18.2:1 | PASS (AAA) |
| `--muted` | `#2a2a2a` | Inactive tabs, disabled tracks | — | Non-text |
| `--muted-foreground` | `#7f7f7f` | Secondary text, placeholders | 4.1:1 | **FAIL (<4.5:1)** |
| `--subtle` | `#676767` | Table headers, nav section titles | 3.1:1 | **FAIL (<4.5:1)** |
| `--soft` | `#a4a4a4` | Hovered text, active labels | 7.0:1 | PASS (AA) |
| `--faint` | `#454545` | Section label headers | 1.9:1 | **FAIL (<4.5:1)** |
| `--border` | `#232323` | Card & control borders | — | Decorative |
| `--input` | `#393939` | Form control stroke / border | — | Decorative |
| `--primary` | `#4124fb` | Primary interactive brand color | — | Accent |
| `--destructive` | `#f97373` | Delete & warning actions | 7.2:1 | PASS (AA) |
| `--success` | `#22c55e` | Confirmation, healthy run | 8.1:1 | PASS (AA) |
| `--warning` | `#fbbf24` | In-progress, amber signals | 10.4:1 | PASS (AA) |

#### One-Off Hardcoded Values Found in Stylesheet & Components
| Hardcoded Hex/RGBA | Occurrences | Duplicates / Should Map To |
| :--- | :--- | :--- |
| `#181818`, `#171717`, `#141414`, `#111111` | Input backgrounds, popover cards, shell panels, auth forms | `--card` or `--background` |
| `#1e1e1e`, `#252525`, `#262626`, `#202020` | Auth buttons, segmented controls | `--secondary` |
| `#414141`, `#484848`, `#333333`, `#363636` | Nav count borders, focus borders | `--input` or `--muted` |
| `#898b8d`, `#888888`, `#777777`, `#666666` | Search icons, auth placeholders, subtitles | `--muted-foreground` (elevated) |
| `#a1a1aa`, `#71717a`, `#cfcfcf`, `#d0d4dd` | Notifications text, pill chip labels | `--soft` / `--muted-foreground` |
| `#FFDB4B` | Hardcoded checkbox accent-color in `styles.css:153` | `--warning` or theme checkbox |

*Resolution: Elevate `--muted-foreground` from `#7f7f7f` to `#94a3b8` / `#8e8e93` (>=4.5:1) and raise table header color from `--subtle` (`#676767`) to `--muted-foreground` (`#94a3b8`) to ensure strict WCAG AA contrast compliance.*

---

### B. Border Radius Scale
- **System Tokens**: `--radius-sm: 4px; --radius-md: 6px; --radius-lg: 8px; --radius-xl: 12px;`
- **One-off anomalies**:
  - `rounded-3xl` (24px) in `auth.tsx`
  - `rounded-full` (9999px) used on pills, badges, and search inputs
  - `rounded-lg` (8px) vs `rounded-md` (6px) used inconsistently between inputs (8px) and standard buttons (6px).
- *Standardization*: Inputs, select triggers, and buttons in the core interface shall align on standard `8px` (`--radius-lg` / `--radius`).

---

### C. Spacing Scale & Control Heights
- **Height Discrepancies**:
  - Native `<input>`, `<select>`: `38px` (`min-height: 38px; padding: 8px 12px` in `styles.css:137`)
  - Shared `Button` default (`h-9`): `36px`
  - Shared `Button` sm (`h-8`): `32px`
  - Filter pills (`.segmented-filter-pill`): `30px`
  - Sidebar links (`.nav-link`): `30px` (inactive) vs `32px` (active)
  - Auth inputs / buttons: `44px` (`h-11`)
- **Spacing Scale**:
  - App uses an inconsistent mix of `2px`, `4px`, `6px`, `7px`, `8px`, `10px`, `12px`, `14px`, `16px`, `18px`, `24px`.
  - *Standardization*: Enforce strict 4px/8px rhythm (`4px`, `8px`, `12px`, `16px`, `24px`, `32px`) across padding, gap, and margins.

---

### D. Typography & Line-Height Scale
- **Root Issue: Widespread `line-height: 1` text clipping**:
  - `brand-title`: `line-height: 1;` (`styles.css:227`)
  - `brand-sub`: `line-height: 1;` (`styles.css:237`)
  - `nav-section-title`: `line-height: 1;` (`styles.css:265`)
  - `nav-link`: `line-height: 1; height: 30px;` with `overflow: hidden;` (`styles.css:287`) -> Clips descenders on "Order Entry", "Settings", "Dispatch & Delivery Challan", "Borrowings".
  - `crm-tab`: `line-height: 1;` (`styles.css:764`)
  - `crm-btn`: `line-height: 1;` (`styles.css:864`)
  - `pill`: `line-height: 1;` (`styles.css:887`)
  - `crm-tag`: `line-height: 1;` (`styles.css:912`)
- *Standardization*: Enforce minimum `line-height: 1.25` for all single-line labels and replace fixed heights with `min-height` and proper vertical padding.

---

## 2. Form Control & Clickable Element Audit

### A. Native `<select>` Elements
| File | Line | Usage / Context | Migration Component |
| :--- | :--- | :--- | :--- |
| `src/components/erp/orders.tsx` | 737 | New Order modal: Client / Company selector | `Select` (Radix) / ThemedSelect |
| `src/components/erp/orders.tsx` | 752 | New Order modal: Intake Medium selector | `Select` (Radix) / ThemedSelect |
| `src/components/erp/orders.tsx` | 845 | New Order item line: Priority Level selector | `Select` (Radix) / ThemedSelect |
| `src/components/erp/dashboard.tsx` | 191 | Production queue quick run: Worker / unit picker | `Select` (Radix) / ThemedSelect |
| `src/components/erp/common.tsx` | 159 | FilterToken native select fallback | Replaced with Themed Dropdown Trigger |
| `src/components/erp/production.tsx` | 363 | Labour allocation modal: Worker assignment | `Select` (Radix) / ThemedSelect |
| `src/components/erp/production.tsx` | 409 | Tentative completion modal: Shift duration | `Select` (Radix) / ThemedSelect |
| `src/components/erp/expenses.tsx` | 428 | Add Expense modal: Worker selection | `Select` (Radix) / ThemedSelect |
| `src/components/erp/expenses.tsx` | 437 | Add Expense modal: Expense Category | `Select` (Radix) / ThemedSelect |
| `src/components/erp/expenses.tsx` | 443 | Add Expense modal: Related Challan link | `Select` (Radix) / ThemedSelect |
| `src/components/erp/expenses.tsx` | 450 | Add Expense modal: Payment Method | `Select` (Radix) / ThemedSelect |
| `src/components/erp/labour.tsx` | 591 | Record Borrowing modal: Labour worker selector | `Select` (Radix) / ThemedSelect |
| `src/components/erp/labour.tsx` | 779 | Record Disbursement modal: Payment Mode | `Select` (Radix) / ThemedSelect |

---

### B. Native Date & Datetime Inputs (`type="date"`, `type="datetime-local"`)
| File | Line | Input Type | Context | Migration Component |
| :--- | :--- | :--- | :--- | :--- |
| `src/components/erp/orders.tsx` | 744 | `type="date"` | New Order: Order Date | `ThemedDatePicker` (Calendar Popover) |
| `src/components/erp/orders.tsx` | 748 | `type="date"` | New Order: Target Delivery Date | `ThemedDatePicker` (Calendar Popover) |
| `src/components/erp/dispatch.tsx` | 537 | `type="date"` | Generate Challan: Dispatch Date | `ThemedDatePicker` (Calendar Popover) |
| `src/components/erp/expenses.tsx` | 460 | `type="date"` | Record Expense: Expense Date | `ThemedDatePicker` (Calendar Popover) |
| `src/components/erp/labour.tsx` | 599 | `type="date"` | Record Borrowing: Borrow Date | `ThemedDatePicker` (Calendar Popover) |
| `src/components/erp/labour.tsx` | 790 | `type="date"` | Record Disbursement: Payment Date | `ThemedDatePicker` (Calendar Popover) |
| `src/components/erp/production.tsx` | 400 | `type="datetime-local"` | Shift tentative schedule | Themed Datetime Picker |

---

### C. Native `<datalist>` Elements
| File | Line | Usage | Migration Plan |
| :--- | :--- | :--- | :--- |
| `src/components/erp/orders.tsx` | 876 | `<datalist id="catalog-items">` (Box Type suggestions) | Integrated searchable combobox / Radix Popover command |

---

### D. Raw `<button>` Elements Not Using Shared `Button` Component
| File | Line | Element / Class | Purpose | Migration |
| :--- | :--- | :--- | :--- | :--- |
| `src/components/erp/common.tsx` | 53 | `<button className="crm-btn crm-btn-secondary">` | `ExportButton` | Use shared `Button variant="outline"` |
| `src/components/erp/common.tsx` | 64 | `<button className="crm-btn crm-btn-primary">` | `AddButton` | Use shared `Button variant="default"` |
| `src/components/erp/common.tsx` | 111 | `<button className="crm-tab">` | `ViewTabs` trigger | Shared `TabsTrigger` primitive |
| `src/components/erp/common.tsx` | 252, 260 | `<button className="crm-calendar-nav-btn">` | Calendar month prev/next | `Button variant="ghost" size="icon"` |
| `src/components/erp/common.tsx` | 290 | `<button className="crm-calendar-day">` | Calendar date day cell | Themed Day Button |
| `src/components/erp/common.tsx` | 312, 322 | `<button className="crm-calendar-action-btn">` | Calendar Clear/Today | `Button variant="ghost" size="sm"` |
| `src/components/erp/common.tsx` | 362 | `<button className="segmented-filter-pill">` | `DateFilterPill` trigger | Themed Filter Trigger |
| `src/components/erp/common.tsx` | 533, 546 | `<button className="crm-pagination-btn">` | `Pagination` Previous/Next | `Button variant="outline" size="sm"` |
| `src/components/erp/orders.tsx` | 163, 171 | `<button className="view-mode-btn">` | Table vs Board toggle | Reusable `SegmentedToggle` |
| `src/components/erp/orders.tsx` | 354 | `<button className="dots-btn">` | Row `...` options menu | `Button variant="ghost" size="icon"` |
| `src/components/erp/orders.tsx` | 435 | `<button className="crm-btn crm-btn-primary">` | Mobile card action | `Button variant="default" size="sm"` |
| `src/components/erp/shell.tsx` | 457 | `<button className="sidebar-user-trigger">` | User profile popout trigger | Standardized interactive button |
| `src/components/erp/shell.tsx` | 497 | `<button className="topbar-icon-btn">` | Mobile menu hamburger | `Button variant="ghost" size="icon"` |
| `src/components/erp/shell.tsx` | 515 | `<button className="topbar-icon-btn">` | Notification bell | `Button variant="ghost" size="icon"` |
| `src/components/erp/shell.tsx` | 539 | `<button className="notification-mark-all">` | Mark all read | `Button variant="ghost" size="sm"` |
| `src/components/erp/shell.tsx` | 551, 558 | `<button className="notification-tab-btn">` | Notif tabs (All/Unread) | Standardized mini tab |
| `src/components/erp/masters.tsx` | 231, 243 | `<button className="dots-btn">` | Row edit/delete action | `Button variant="ghost" size="icon"` |
| `src/components/erp/masters.tsx` | 323, 374, 425 | `<button className="crm-tab">` | Master view tabs | Shared `TabsTrigger` |
| `src/components/erp/account.tsx` | 110, 132 | `<button className="crm-tab">` | Account view tabs | Shared `TabsTrigger` |
| `src/components/erp/account.tsx` | 168 | `<button className="crm-btn crm-btn-secondary">` | Edit Profile | `Button variant="outline" size="sm"` |
| `src/components/erp/account.tsx` | 550, 862 | `<button>` | Handover modal role pills | `Button variant="outline" size="sm"` |

---

## 3. Containers with Overflow & Scrollbars Audit

| Container Class / Component | Overflow Property | Current Behavior | Target Polish |
| :--- | :--- | :--- | :--- |
| `html, body` | `overflow-x: hidden;` | Page scroll | Global thin themed scrollbar |
| `.sidebar-scroll` | `overflow-y: auto; overflow-x: hidden;` | Hidden via `scrollbar-width: none` | Maintain seamless clean nav scroll |
| `.crm-tabs` | `overflow-x: auto;` (unconstrained y) | Showed native vertical scrollbar with arrows | Set `overflow-x: auto; overflow-y: hidden;` with thin themed/hidden scrollbar |
| `.table-wrap` / `.desktop-table-view` | `overflow-x: auto;` | Tables scroll horizontally | Card wrapper scrolls horizontally with `position: sticky; top: 0` header |
| `SheetContent` (Drawer) | `.flex-1 overflow-y-auto` | Native scroll in drawer body | Apply thin themed scrollbar token |
| `DialogContent` (`.modal-wide`) | `overflow-y: auto` | Dialog modal body scroll | Constrain max-height, thin themed scrollbar |
| `.notification-list-scroll` | `overflow-y: auto; max-height: 380px;` | Notifications list | Thin themed scrollbar |
| `.deals-board` (Kanban) | Horizontal card layout | Can clip on tablet/mobile | Smooth horizontal overflow with thin scrollbar |
