import { useState, useMemo } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Download,
  Calendar,
  Building2,
  Package,
  Users,
  Truck,
  Wallet,
  Clock,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  BarChart3,
  Layers,
  ArrowUpRight,
  Filter,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useFactory } from './provider';
import {
  Heading,
  AccessNotice,
  Empty,
  SearchFilter,
  ExportButton,
  Pagination,
  DateFilterPill,
  FilterToken,
  Pill,
  CrmTag,
} from './common';
import { money, number, dateLabel, today, downloadCsv, finance, type Row } from '@/lib/erp-data';

export type ReportTab =
  | 'realised_profit'
  | 'orders'
  | 'production'
  | 'labour'
  | 'dispatch'
  | 'quantities'
  | 'payroll_borrowings'
  | 'expenses';

export function Reports() {
  const { data: d } = useFactory();
  const [tab, setTab] = useState<ReportTab>('realised_profit');
  const [search, setSearch] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [preset, setPreset] = useState<'All' | 'Day' | 'Week' | 'Month'>('All');
  const [partyFilter, setPartyFilter] = useState('All');
  const [workerFilter, setWorkerFilter] = useState('All');
  const [page, setPage] = useState(1);
  const pageSize = 12;

  // Preset Date Logic
  const handlePreset = (p: 'All' | 'Day' | 'Week' | 'Month') => {
    setPreset(p);
    const now = new Date();
    if (p === 'All') {
      setFrom('');
      setTo('');
    } else if (p === 'Day') {
      const todayStr = now.toISOString().slice(0, 10);
      setFrom(todayStr);
      setTo(todayStr);
    } else if (p === 'Week') {
      const weekAgo = new Date(now.getTime() - 7 * 86400000).toISOString().slice(0, 10);
      setFrom(weekAgo);
      setTo(now.toISOString().slice(0, 10));
    } else if (p === 'Month') {
      const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
      setFrom(firstOfMonth);
      setTo(now.toISOString().slice(0, 10));
    }
  };

  const company = (orderId: string) => {
    const o = d.orders.find((o) => o.id === orderId);
    return o?.is_self_stock ? 'Self Stocking' : d.parties.find((p) => p.id === o?.party_id)?.company_name ?? '—';
  };

  // 1. REALISED PROFIT & ACCOUNTING FLOW
  const realisedChallans = useMemo(() => {
    return finance(d).filter((r) => {
      const dDate = r.dispatch_date ? r.dispatch_date.slice(0, 10) : '';
      const matchesDate = (!from || dDate >= from) && (!to || dDate <= to);
      const partyName = company(r.order_id);
      const matchesParty = partyFilter === 'All' || partyName === partyFilter;
      const matchesSearch = (r.challan_number + ' ' + partyName + ' ' + (r.transport_carrier ?? '')).toLowerCase().includes(search.toLowerCase());
      return matchesDate && matchesParty && matchesSearch;
    });
  }, [d, from, to, partyFilter, search]);

  const totalRealisedRevenue = realisedChallans.reduce((s, r) => s + r.revenue, 0);
  const totalDirectLabour = realisedChallans.reduce((s, r) => s + r.labour, 0);
  const totalFreight = realisedChallans.reduce((s, r) => s + (r.freight_charges || 0), 0);
  const totalAttributedExpenses = realisedChallans.reduce((s, r) => s + r.expenses, 0);
  const totalNetRealisedProfit = realisedChallans.reduce((s, r) => s + r.profit, 0);
  const overallRealisedMargin = totalRealisedRevenue > 0 ? (totalNetRealisedProfit / totalRealisedRevenue) * 100 : 0;

  // Unrealised Pipeline Metrics (Separated cleanly per accounting flow)
  const unrealisedOrders = d.orders.filter((o) => o.status !== 'Completed' && o.status !== 'Cancelled');
  const unrealisedPipelineValue = unrealisedOrders.reduce((sum, o) => {
    const items = d.items.filter((i) => i.order_id === o.id);
    return sum + items.reduce((s, i) => s + Math.max(0, i.ordered_qty - i.dispatched_qty) * (i.unit_rate || 0), 0);
  }, 0);

  const wipInventoryValue = d.items.reduce((sum, i) => {
    const readyQty = Math.max(0, i.completed_qty - i.dispatched_qty);
    return sum + readyQty * (i.unit_rate || 0);
  }, 0);

  const pendingLabourLiabilities = d.allocations.reduce((sum, a) => {
    const unpaid = Math.max(0, a.completed_qty * (a.labour_rate || 0) - (a.paid_earnings || 0));
    return sum + unpaid;
  }, 0);

  // 2. ORDER ENTRY & PENDING ORDERS REPORT
  const ordersReport = useMemo(() => {
    return d.orders.filter((o) => {
      const oDate = o.order_date || '';
      const matchesDate = (!from || oDate >= from) && (!to || oDate <= to);
      const partyName = o.is_self_stock ? 'Self Stocking' : d.parties.find((p) => p.id === o.party_id)?.company_name ?? '—';
      const matchesParty = partyFilter === 'All' || partyName === partyFilter;
      const matchesSearch = (o.order_no + ' ' + partyName + ' ' + (o.remarks ?? '')).toLowerCase().includes(search.toLowerCase());
      return matchesDate && matchesParty && matchesSearch;
    }).map((o) => {
      const items = d.items.filter((i) => i.order_id === o.id);
      const ordered = items.reduce((s, i) => s + i.ordered_qty, 0);
      const produced = items.reduce((s, i) => s + i.completed_qty, 0);
      const dispatched = items.reduce((s, i) => s + i.dispatched_qty, 0);
      const value = items.reduce((s, i) => s + (i.total_price ?? (i.ordered_qty * i.unit_rate)), 0);
      const pendingDispatch = Math.max(0, ordered - dispatched);
      const partyName = o.is_self_stock ? 'Self Stocking' : d.parties.find((p) => p.id === o.party_id)?.company_name ?? '—';
      return {
        ...o,
        partyName,
        ordered,
        produced,
        dispatched,
        pendingDispatch,
        value,
        progress: ordered > 0 ? Math.round((dispatched / ordered) * 100) : 0,
      };
    });
  }, [d, from, to, partyFilter, search]);

  // 3. PRODUCTION BACKLOG & COMPLETED PRODUCTION
  const productionReport = useMemo(() => {
    return d.items.filter((item) => {
      const order = d.orders.find((o) => o.id === item.order_id);
      const oDate = order?.order_date || '';
      const matchesDate = (!from || oDate >= from) && (!to || oDate <= to);
      const partyName = order?.is_self_stock ? 'Self Stocking' : d.parties.find((p) => p.id === order?.party_id)?.company_name ?? '—';
      const matchesParty = partyFilter === 'All' || partyName === partyFilter;
      const matchesSearch = (item.box_type + ' ' + (item.size_dimensions ?? '') + ' ' + (order?.order_no ?? '')).toLowerCase().includes(search.toLowerCase());
      return matchesDate && matchesParty && matchesSearch;
    }).map((item) => {
      const order = d.orders.find((o) => o.id === item.order_id);
      const pendingAllocation = Math.max(0, item.ordered_qty - item.allocated_qty);
      const pendingCompletion = Math.max(0, item.allocated_qty - item.completed_qty);
      const partyName = order?.is_self_stock ? 'Self Stocking' : d.parties.find((p) => p.id === order?.party_id)?.company_name ?? '—';
      return {
        ...item,
        order_no: order?.order_no || '—',
        order_date: order?.order_date || '—',
        expected_date: order?.expected_date || '—',
        partyName,
        pendingAllocation,
        pendingCompletion,
        completionRate: item.ordered_qty > 0 ? Math.round((item.completed_qty / item.ordered_qty) * 100) : 0,
      };
    });
  }, [d, from, to, partyFilter, search]);

  // 4. LABOUR-WISE PRODUCTION & PRODUCTIVITY REPORT
  const labourReport = useMemo(() => {
    return d.workers.filter((w) => {
      const matchesWorker = workerFilter === 'All' || w.id === workerFilter;
      const matchesSearch = (w.labour_name + ' ' + (w.unit_assignment ?? '')).toLowerCase().includes(search.toLowerCase());
      return matchesWorker && matchesSearch;
    }).map((w) => {
      const workerAllocs = d.allocations.filter((a) => {
        if (a.labour_id !== w.id) return false;
        const aDate = a.start_time ? a.start_time.slice(0, 10) : '';
        if (from && aDate < from) return false;
        if (to && aDate > to) return false;
        return true;
      });

      const assigned = workerAllocs.reduce((s, a) => s + a.allocated_qty, 0);
      const completed = workerAllocs.reduce((s, a) => s + a.completed_qty, 0);
      const pending = Math.max(0, assigned - completed);
      const earned = workerAllocs.reduce((s, a) => s + a.completed_qty * (a.labour_rate || 0), 0);
      const borrowings = d.borrowings.filter((b) => b.labour_id === w.id);
      const totalBorrowed = borrowings.reduce((s, b) => s + b.amount, 0);
      const deductedBorrowed = borrowings.reduce((s, b) => s + b.deducted_amount, 0);
      const netAdvanceDebt = Math.max(0, totalBorrowed - deductedBorrowed);
      const netDue = Math.max(0, earned - netAdvanceDebt);

      return {
        ...w,
        allocationsCount: workerAllocs.length,
        assigned,
        completed,
        pending,
        earned,
        totalBorrowed,
        netAdvanceDebt,
        netDue,
        efficiency: assigned > 0 ? Math.round((completed / assigned) * 100) : 0,
      };
    });
  }, [d, from, to, workerFilter, search]);

  // 5. DISPATCH & DELIVERY CHALLAN REPORT
  const dispatchReport = useMemo(() => {
    return d.challans.filter((c) => {
      const dDate = c.dispatch_date ? c.dispatch_date.slice(0, 10) : '';
      const matchesDate = (!from || dDate >= from) && (!to || dDate <= to);
      const partyName = company(c.order_id);
      const matchesParty = partyFilter === 'All' || partyName === partyFilter;
      const matchesSearch = (c.challan_number + ' ' + partyName + ' ' + (c.vehicle_number ?? '') + ' ' + (c.lr_number ?? '')).toLowerCase().includes(search.toLowerCase());
      return matchesDate && matchesParty && matchesSearch;
    }).map((c) => {
      const items = d.challanItems.filter((ci) => ci.challan_id === c.id);
      const shippedQty = items.reduce((s, ci) => s + ci.dispatched_qty, 0);
      const order = d.orders.find((o) => o.id === c.order_id);
      const partyName = company(c.order_id);
      return {
        ...c,
        order_no: order?.order_no || '—',
        partyName,
        shippedQty,
        itemsCount: items.length,
      };
    });
  }, [d, from, to, partyFilter, search]);

  // 6. QUANTITY BREAKDOWN (Company-wise and Item-wise)
  const companyQuantities = useMemo(() => {
    const map = new Map<string, { company: string; ordered: number; produced: number; dispatched: number; pending: number }>();
    d.orders.forEach((o) => {
      const cName = o.is_self_stock ? 'Self Stocking' : d.parties.find((p) => p.id === o.party_id)?.company_name ?? 'Unknown';
      const items = d.items.filter((i) => i.order_id === o.id);
      const ord = items.reduce((s, i) => s + i.ordered_qty, 0);
      const prod = items.reduce((s, i) => s + i.completed_qty, 0);
      const disp = items.reduce((s, i) => s + i.dispatched_qty, 0);

      const curr = map.get(cName) || { company: cName, ordered: 0, produced: 0, dispatched: 0, pending: 0 };
      curr.ordered += ord;
      curr.produced += prod;
      curr.dispatched += disp;
      curr.pending += Math.max(0, ord - disp);
      map.set(cName, curr);
    });
    return Array.from(map.values());
  }, [d]);

  const itemQuantities = useMemo(() => {
    const map = new Map<string, { boxType: string; size: string; ordered: number; produced: number; dispatched: number; pending: number }>();
    d.items.forEach((item) => {
      const key = `${item.box_type || 'Box'}__${item.size_dimensions || 'Std'}`;
      const curr = map.get(key) || { boxType: item.box_type || 'Standard Box', size: item.size_dimensions || '—', ordered: 0, produced: 0, dispatched: 0, pending: 0 };
      curr.ordered += item.ordered_qty;
      curr.produced += item.completed_qty;
      curr.dispatched += item.dispatched_qty;
      curr.pending += Math.max(0, item.ordered_qty - item.dispatched_qty);
      map.set(key, curr);
    });
    return Array.from(map.values());
  }, [d]);

  // 7. LABOUR PAYROLL & BORROWINGS LEDGER
  const payrollLedger = useMemo(() => {
    return d.workers.map((w) => {
      const workerAllocs = d.allocations.filter((a) => a.labour_id === w.id);
      const totalProduced = workerAllocs.reduce((s, a) => s + a.completed_qty, 0);
      const totalEarnings = workerAllocs.reduce((s, a) => s + a.completed_qty * (a.labour_rate || 0), 0);
      const paidEarnings = workerAllocs.reduce((s, a) => s + (a.paid_earnings || 0), 0);
      const grossUnpaid = Math.max(0, totalEarnings - paidEarnings);

      const borrowings = d.borrowings.filter((b) => b.labour_id === w.id);
      const totalBorrowed = borrowings.reduce((s, b) => s + b.amount, 0);
      const totalDeducted = borrowings.reduce((s, b) => s + b.deducted_amount, 0);
      const remainingDebt = Math.max(0, totalBorrowed - totalDeducted);

      const netPayable = Math.max(0, grossUnpaid - remainingDebt);

      return {
        id: w.id,
        worker_name: w.labour_name,
        unit: w.unit_assignment || 'General',
        totalProduced,
        totalEarnings,
        paidEarnings,
        grossUnpaid,
        totalBorrowed,
        totalDeducted,
        remainingDebt,
        netPayable,
      };
    });
  }, [d]);

  // 8. TRANSPORTATION & OVERHEAD EXPENSES
  const expensesReport = useMemo(() => {
    return d.expenses.filter((e) => {
      const matchesDate = (!from || e.expense_date >= from) && (!to || e.expense_date <= to);
      const matchesSearch = (e.category + ' ' + (e.notes ?? '') + ' ' + (e.payment_method ?? '')).toLowerCase().includes(search.toLowerCase());
      return matchesDate && matchesSearch;
    }).map((e) => {
      const dc = d.challans.find((c) => c.id === e.reference_dc_id);
      return {
        ...e,
        challan_number: dc?.challan_number || 'Central / Shared',
      };
    });
  }, [d, from, to, search]);

  // Active Tab Data for Pagination and Export
  const activeData = useMemo(() => {
    switch (tab) {
      case 'realised_profit':
        return realisedChallans;
      case 'orders':
        return ordersReport;
      case 'production':
        return productionReport;
      case 'labour':
        return labourReport;
      case 'dispatch':
        return dispatchReport;
      case 'quantities':
        return companyQuantities;
      case 'payroll_borrowings':
        return payrollLedger;
      case 'expenses':
        return expensesReport;
      default:
        return [];
    }
  }, [tab, realisedChallans, ordersReport, productionReport, labourReport, dispatchReport, companyQuantities, payrollLedger, expensesReport]);

  const paginatedData = useMemo(() => {
    return activeData.slice((page - 1) * pageSize, page * pageSize);
  }, [activeData, page, pageSize]);

  // Export handler
  const handleExport = () => {
    downloadCsv(`slbw-report-${tab}-${today()}`, activeData as any);
  };

  const tabs = [
    { id: 'realised_profit' as const, label: 'Realised Profit', count: realisedChallans.length },
    { id: 'orders' as const, label: 'Order Entry', count: ordersReport.length },
    { id: 'production' as const, label: 'Production Backlog', count: productionReport.length },
    { id: 'labour' as const, label: 'Labour Productivity', count: labourReport.length },
    { id: 'dispatch' as const, label: 'Dispatches & DCs', count: dispatchReport.length },
    { id: 'quantities' as const, label: 'Quantity Volume', count: companyQuantities.length },
    { id: 'payroll_borrowings' as const, label: 'Payroll & Borrowings', count: payrollLedger.length },
    { id: 'expenses' as const, label: 'Transportation & Costs', count: expensesReport.length },
  ];

  return (
    <>
      <Heading title="Reports & Realised Profit">
        <ExportButton onClick={handleExport} />
      </Heading>

      <AccessNotice />

      {/* Report Categories Switcher */}
      <div className="crm-tabs" role="tablist">
        {tabs.map((t) => {
          const isSelected = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={isSelected}
              className={`crm-tab ${isSelected ? 'active' : ''}`}
              onClick={() => {
                setTab(t.id);
                setPage(1);
              }}
            >
              <span>{t.label}</span>
              <span className="crm-tab-count">{t.count}</span>
            </button>
          );
        })}
      </div>

      {/* Global Filter Bar */}
      <div className="filters">
        <SearchFilter value={search} onChange={setSearch} placeholder="Search report entries…" />

        {/* Date Preset Buttons */}
        <div className="flex items-center gap-1 bg-secondary/60 p-0.5 rounded-full text-xs">
          {(['All', 'Day', 'Week', 'Month'] as const).map((r) => (
            <button
              key={r}
              type="button"
              className={`px-3 py-1 rounded-full font-medium transition-colors ${preset === r ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
              onClick={() => handlePreset(r)}
            >
              {r === 'All' ? 'All Time' : `This ${r}`}
            </button>
          ))}
        </div>

        <DateFilterPill label="From" value={from} onChange={setFrom} placeholder="All" />
        <DateFilterPill label="To" value={to} onChange={setTo} placeholder="All" />

        {(tab === 'realised_profit' || tab === 'orders' || tab === 'production' || tab === 'dispatch') && (
          <FilterToken
            label="Company"
            value={partyFilter}
            onChange={setPartyFilter}
            options={[
              { value: 'All', label: 'All Companies' },
              { value: 'Self Stocking', label: 'Self Stocking' },
              ...d.parties.map((p) => ({ value: p.company_name, label: p.company_name })),
            ]}
          />
        )}

        {(tab === 'labour' || tab === 'payroll_borrowings') && (
          <FilterToken
            label="Worker"
            value={workerFilter}
            onChange={setWorkerFilter}
            options={[
              { value: 'All', label: 'All Workers' },
              ...d.workers.map((w) => ({ value: w.id, label: w.labour_name })),
            ]}
          />
        )}
      </div>

      {/* TAB 1: REALISED PROFIT & ACCOUNTING FLOW */}
      {tab === 'realised_profit' && (
        <div className="space-y-6">
          {/* Executive Realised Metric Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
            <div className="p-3.5 bg-card border border-border rounded-xl">
              <span className="text-[11px] text-muted-foreground block font-medium">Realised Revenue</span>
              <strong className="text-lg font-normal text-foreground tabular-nums tracking-tight">
                {money(totalRealisedRevenue)}
              </strong>
              <span className="text-[10px] text-emerald-500 block mt-0.5">Dispatched shipments</span>
            </div>

            <div className="p-3.5 bg-card border border-border rounded-xl">
              <span className="text-[11px] text-muted-foreground block font-medium">Direct Labour Cost</span>
              <strong className="text-lg font-normal text-foreground tabular-nums tracking-tight">
                {money(totalDirectLabour)}
              </strong>
              <span className="text-[10px] text-muted-foreground block mt-0.5">Piece rates incurred</span>
            </div>

            <div className="p-3.5 bg-card border border-border rounded-xl">
              <span className="text-[11px] text-muted-foreground block font-medium">Direct DC Freight</span>
              <strong className="text-lg font-normal text-foreground tabular-nums tracking-tight">
                {money(totalFreight)}
              </strong>
              <span className="text-[10px] text-muted-foreground block mt-0.5">Carrier charges</span>
            </div>

            <div className="p-3.5 bg-card border border-border rounded-xl">
              <span className="text-[11px] text-muted-foreground block font-medium">Attributed Overheads</span>
              <strong className="text-lg font-normal text-foreground tabular-nums tracking-tight">
                {money(totalAttributedExpenses)}
              </strong>
              <span className="text-[10px] text-muted-foreground block mt-0.5">Factory & operations</span>
            </div>

            <div className="p-3.5 bg-card border border-border rounded-xl">
              <span className="text-[11px] text-muted-foreground block font-medium">Net Realised Profit</span>
              <strong className={`text-lg font-medium tabular-nums tracking-tight ${totalNetRealisedProfit >= 0 ? 'text-emerald-500' : 'text-destructive'}`}>
                {money(totalNetRealisedProfit)}
              </strong>
              <span className="text-[10px] text-emerald-500 block mt-0.5">Actual realized gain</span>
            </div>

            <div className="p-3.5 bg-card border border-border rounded-xl">
              <span className="text-[11px] text-muted-foreground block font-medium">Realised Margin</span>
              <strong className="text-lg font-normal text-foreground tabular-nums tracking-tight">
                {Math.round(overallRealisedMargin * 10) / 10}%
              </strong>
              <span className="text-[10px] text-muted-foreground block mt-0.5">On net billings</span>
            </div>
          </div>

          {/* Unrealised Pipeline Notice & WIP Card */}
          <div className="p-4 bg-secondary/30 border border-border rounded-xl">
            <div className="flex items-center gap-2 mb-2">
              <AlertCircle className="w-4 h-4 text-primary" />
              <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground">
                Accounting Flow Separation · Unrealised Pipeline & WIP Balance
              </h3>
            </div>
            <p className="text-xs text-muted-foreground mb-3 leading-relaxed">
              In accordance with factory accounting standards, revenue and profit are strictly recognised only upon physical
              dispatch and Delivery Challan issuance. Orders in queue and finished inventory on the floor remain unrealised
              until dispatched.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className="p-2.5 bg-background border border-border rounded-lg">
                <span className="text-muted-foreground block text-[11px]">Unrealised PO Backlog Value:</span>
                <strong className="text-foreground text-sm font-medium">{money(unrealisedPipelineValue)}</strong>
              </div>
              <div className="p-2.5 bg-background border border-border rounded-lg">
                <span className="text-muted-foreground block text-[11px]">WIP Completed Floor Inventory:</span>
                <strong className="text-foreground text-sm font-medium">{money(wipInventoryValue)}</strong>
              </div>
              <div className="p-2.5 bg-background border border-border rounded-lg">
                <span className="text-muted-foreground block text-[11px]">Pending Unpaid Labour Liability:</span>
                <strong className="text-amber-500 text-sm font-medium">{money(pendingLabourLiabilities)}</strong>
              </div>
            </div>
          </div>

          {/* Realised DC Profit Table */}
          <div className="desktop-table-view table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Challan #</th>
                  <th>Customer / Account</th>
                  <th>Dispatch Date</th>
                  <th className="numeric">Shipped Qty</th>
                  <th className="numeric">Realised Revenue</th>
                  <th className="numeric">Direct Labour</th>
                  <th className="numeric">DC Freight</th>
                  <th className="numeric">Overheads</th>
                  <th className="numeric">Realised Profit</th>
                  <th className="numeric">Margin</th>
                </tr>
              </thead>
              <tbody>
                {paginatedData.length ? (
                  (paginatedData as typeof realisedChallans).map((r) => (
                    <tr key={r.id}>
                      <td className="font-medium text-foreground">{r.challan_number}</td>
                      <td>{company(r.order_id)}</td>
                      <td>{dateLabel(r.dispatch_date)}</td>
                      <td className="numeric font-medium">{number(r.qty)}</td>
                      <td className="numeric font-medium text-foreground">{money(r.revenue)}</td>
                      <td className="numeric text-muted-foreground">{money(r.labour)}</td>
                      <td className="numeric text-muted-foreground">{money(r.freight_charges || 0)}</td>
                      <td className="numeric text-muted-foreground">{money(Math.round(r.expenses))}</td>
                      <td className={`numeric font-semibold ${r.profit >= 0 ? 'text-emerald-500' : 'text-destructive'}`}>
                        {money(Math.round(r.profit))}
                      </td>
                      <td className="numeric font-medium text-foreground">{Math.round(r.margin * 10) / 10}%</td>
                    </tr>
                  ))
                ) : (
                  <Empty columns={10} label="No confirmed dispatches recorded in this period" />
                )}
              </tbody>
              <tfoot>
                <tr className="border-t border-border bg-muted/20 font-medium">
                  <td colSpan={3} className="text-right text-xs text-muted-foreground px-3 py-2.5">
                    Realised Totals ({number(realisedChallans.length)} challans):
                  </td>
                  <td className="numeric text-foreground px-3 py-2.5 tabular-nums">
                    {number(realisedChallans.reduce((s, r) => s + r.qty, 0))}
                  </td>
                  <td className="numeric text-foreground px-3 py-2.5 tabular-nums">
                    {money(totalRealisedRevenue)}
                  </td>
                  <td className="numeric text-muted-foreground px-3 py-2.5 tabular-nums">
                    {money(totalDirectLabour)}
                  </td>
                  <td className="numeric text-muted-foreground px-3 py-2.5 tabular-nums">
                    {money(totalFreight)}
                  </td>
                  <td className="numeric text-muted-foreground px-3 py-2.5 tabular-nums">
                    {money(Math.round(totalAttributedExpenses))}
                  </td>
                  <td className="numeric font-semibold text-emerald-500 px-3 py-2.5 tabular-nums">
                    {money(Math.round(totalNetRealisedProfit))}
                  </td>
                  <td className="numeric font-medium text-foreground px-3 py-2.5 tabular-nums">
                    {Math.round(overallRealisedMargin * 10) / 10}%
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: ORDER ENTRY & PENDING ORDERS */}
      {tab === 'orders' && (
        <div className="desktop-table-view table-wrap">
          <table>
            <thead>
              <tr>
                <th>Order #</th>
                <th>Company / Client</th>
                <th>Order Date</th>
                <th>Due Date</th>
                <th>Medium</th>
                <th className="numeric">Ordered</th>
                <th className="numeric">Produced</th>
                <th className="numeric">Dispatched</th>
                <th className="numeric">Pending Dispatch</th>
                <th className="numeric">Order Value</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {paginatedData.length ? (
                (paginatedData as typeof ordersReport).map((o) => (
                  <tr key={o.id}>
                    <td className="font-medium text-foreground">{o.order_no}</td>
                    <td>{o.partyName}</td>
                    <td>{dateLabel(o.order_date)}</td>
                    <td>{dateLabel(o.expected_date)}</td>
                    <td>{o.medium || 'Direct'}</td>
                    <td className="numeric font-medium">{number(o.ordered)}</td>
                    <td className="numeric text-muted-foreground">{number(o.produced)}</td>
                    <td className="numeric text-emerald-500">{number(o.dispatched)}</td>
                    <td className="numeric font-medium text-foreground">{number(o.pendingDispatch)}</td>
                    <td className="numeric font-semibold text-foreground">{money(o.value)}</td>
                    <td><Pill value={o.status} /></td>
                  </tr>
                ))
              ) : (
                <Empty columns={11} label="No orders found for selected criteria" />
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* TAB 3: PRODUCTION BACKLOG & COMPLETED PRODUCTION */}
      {tab === 'production' && (
        <div className="desktop-table-view table-wrap">
          <table>
            <thead>
              <tr>
                <th>PO Number</th>
                <th>Customer</th>
                <th>Box Type & Dimensions</th>
                <th>Specifications</th>
                <th className="numeric">Ordered</th>
                <th className="numeric">Allocated</th>
                <th className="numeric">Completed</th>
                <th className="numeric">Pending Alloc</th>
                <th className="numeric">Pending Finish</th>
                <th>Priority</th>
              </tr>
            </thead>
            <tbody>
              {paginatedData.length ? (
                (paginatedData as typeof productionReport).map((i) => (
                  <tr key={i.id}>
                    <td className="font-medium text-foreground">{i.order_no}</td>
                    <td>{i.partyName}</td>
                    <td>
                      <div className="flex items-center gap-1.5">
                        <span className="font-medium">{i.box_type}</span>
                        {i.size_dimensions && <span className="text-xs text-muted-foreground">({i.size_dimensions})</span>}
                      </div>
                    </td>
                    <td className="text-xs text-muted-foreground">{i.specification || '—'}</td>
                    <td className="numeric font-medium">{number(i.ordered_qty)}</td>
                    <td className="numeric text-muted-foreground">{number(i.allocated_qty)}</td>
                    <td className="numeric text-emerald-500 font-medium">{number(i.completed_qty)}</td>
                    <td className="numeric text-foreground">{number(i.pendingAllocation)}</td>
                    <td className="numeric text-amber-500 font-medium">{number(i.pendingCompletion)}</td>
                    <td><Pill value={i.priority_signal} /></td>
                  </tr>
                ))
              ) : (
                <Empty columns={10} label="No production items in this range" />
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* TAB 4: LABOUR PRODUCTIVITY REPORT */}
      {tab === 'labour' && (
        <div className="desktop-table-view table-wrap">
          <table>
            <thead>
              <tr>
                <th>Worker Name</th>
                <th>Unit / Station</th>
                <th className="numeric">Allocations</th>
                <th className="numeric">Assigned Boxes</th>
                <th className="numeric">Produced Boxes</th>
                <th className="numeric">Pending Boxes</th>
                <th>Efficiency</th>
                <th className="numeric">Gross Earnings</th>
                <th className="numeric">Advance Debt</th>
                <th className="numeric">Net Due</th>
              </tr>
            </thead>
            <tbody>
              {paginatedData.length ? (
                (paginatedData as typeof labourReport).map((w) => (
                  <tr key={w.id}>
                    <td className="font-medium text-foreground">{w.labour_name}</td>
                    <td>{w.unit_assignment || 'General Line'}</td>
                    <td className="numeric text-muted-foreground">{number(w.allocationsCount)}</td>
                    <td className="numeric font-medium">{number(w.assigned)}</td>
                    <td className="numeric text-emerald-500 font-semibold">{number(w.completed)}</td>
                    <td className="numeric text-amber-500">{number(w.pending)}</td>
                    <td>{w.efficiency}%</td>
                    <td className="numeric font-medium text-foreground">{money(w.earned)}</td>
                    <td className="numeric text-muted-foreground">{money(w.netAdvanceDebt)}</td>
                    <td className="numeric font-semibold text-foreground">{money(w.netDue)}</td>
                  </tr>
                ))
              ) : (
                <Empty columns={10} label="No labour records found" />
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* TAB 5: DISPATCH & DELIVERY CHALLANS */}
      {tab === 'dispatch' && (
        <div className="desktop-table-view table-wrap">
          <table>
            <thead>
              <tr>
                <th>Challan #</th>
                <th>PO #</th>
                <th>Customer / Account</th>
                <th>Dispatch Date</th>
                <th>Carrier</th>
                <th>Vehicle #</th>
                <th>LR #</th>
                <th className="numeric">Shipped Units</th>
                <th className="numeric">Freight Charges</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {paginatedData.length ? (
                (paginatedData as typeof dispatchReport).map((c) => (
                  <tr key={c.id}>
                    <td className="font-medium text-foreground">{c.challan_number}</td>
                    <td>{c.order_no}</td>
                    <td>{c.partyName}</td>
                    <td>{dateLabel(c.dispatch_date)}</td>
                    <td>{c.transport_carrier || 'Direct / Self'}</td>
                    <td>{c.vehicle_number || '—'}</td>
                    <td>{c.lr_number || '—'}</td>
                    <td className="numeric font-semibold text-foreground">{number(c.shippedQty)}</td>
                    <td className="numeric text-muted-foreground">{money(c.freight_charges || 0)}</td>
                    <td><Pill value={c.status} /></td>
                  </tr>
                ))
              ) : (
                <Empty columns={10} label="No delivery challans recorded" />
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* TAB 6: QUANTITY BREAKDOWN (Company-wise & Item-wise) */}
      {tab === 'quantities' && (
        <div className="space-y-8">
          <div>
            <h3 className="text-sm font-semibold mb-3">Company-Wise Quantity Distribution</h3>
            <div className="desktop-table-view table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Customer / Company</th>
                    <th className="numeric">Total Ordered</th>
                    <th className="numeric">Total Produced</th>
                    <th className="numeric">Total Dispatched</th>
                    <th className="numeric">Pending Delivery</th>
                  </tr>
                </thead>
                <tbody>
                  {companyQuantities.map((cq) => (
                    <tr key={cq.company}>
                      <td className="font-medium text-foreground">{cq.company}</td>
                      <td className="numeric font-medium">{number(cq.ordered)}</td>
                      <td className="numeric text-muted-foreground">{number(cq.produced)}</td>
                      <td className="numeric text-emerald-500 font-medium">{number(cq.dispatched)}</td>
                      <td className="numeric font-semibold text-foreground">{number(cq.pending)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold mb-3">Box Type & Item-Wise Quantity Distribution</h3>
            <div className="desktop-table-view table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Box Type</th>
                    <th>Size Dimensions</th>
                    <th className="numeric">Total Ordered</th>
                    <th className="numeric">Total Produced</th>
                    <th className="numeric">Total Dispatched</th>
                    <th className="numeric">Remaining Pending</th>
                  </tr>
                </thead>
                <tbody>
                  {itemQuantities.map((iq, idx) => (
                    <tr key={idx}>
                      <td className="font-medium text-foreground">{iq.boxType}</td>
                      <td className="text-xs text-muted-foreground">{iq.size}</td>
                      <td className="numeric font-medium">{number(iq.ordered)}</td>
                      <td className="numeric text-muted-foreground">{number(iq.produced)}</td>
                      <td className="numeric text-emerald-500 font-medium">{number(iq.dispatched)}</td>
                      <td className="numeric font-semibold text-foreground">{number(iq.pending)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 7: PAYROLL & BORROWINGS LEDGER */}
      {tab === 'payroll_borrowings' && (
        <div className="desktop-table-view table-wrap">
          <table>
            <thead>
              <tr>
                <th>Worker Name</th>
                <th>Unit Station</th>
                <th className="numeric">Produced Units</th>
                <th className="numeric">Total Piece Earnings</th>
                <th className="numeric">Gross Unpaid</th>
                <th className="numeric">Total Borrowed</th>
                <th className="numeric">Deducted Recovered</th>
                <th className="numeric">Remaining Advance Debt</th>
                <th className="numeric">Net Payable</th>
              </tr>
            </thead>
            <tbody>
              {payrollLedger.map((pl) => (
                <tr key={pl.id}>
                  <td className="font-medium text-foreground">{pl.worker_name}</td>
                  <td>{pl.unit}</td>
                  <td className="numeric font-medium">{number(pl.totalProduced)}</td>
                  <td className="numeric font-medium">{money(pl.totalEarnings)}</td>
                  <td className="numeric text-foreground">{money(pl.grossUnpaid)}</td>
                  <td className="numeric text-muted-foreground">{money(pl.totalBorrowed)}</td>
                  <td className="numeric text-emerald-500">{money(pl.totalDeducted)}</td>
                  <td className="numeric text-amber-500 font-medium">{money(pl.remainingDebt)}</td>
                  <td className="numeric font-semibold text-foreground">{money(pl.netPayable)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* TAB 8: TRANSPORTATION & OPERATIONAL EXPENSES */}
      {tab === 'expenses' && (
        <div className="desktop-table-view table-wrap">
          <table>
            <thead>
              <tr>
                <th>Expense Date</th>
                <th>Category</th>
                <th>Linked Challan / Cost Center</th>
                <th>Payment Mode</th>
                <th className="numeric">Amount</th>
                <th>Notes / Remarks</th>
              </tr>
            </thead>
            <tbody>
              {paginatedData.length ? (
                (paginatedData as typeof expensesReport).map((e) => (
                  <tr key={e.id}>
                    <td>{dateLabel(e.expense_date)}</td>
                    <td>
                      <CrmTag
                        label={e.category}
                        variant={e.category === 'Transportation' ? 'blue' : 'neutral'}
                      />
                    </td>
                    <td className="font-medium text-foreground">{e.challan_number}</td>
                    <td>{e.payment_method || 'Cash'}</td>
                    <td className="numeric font-semibold text-foreground">{money(e.amount)}</td>
                    <td className="text-xs text-muted-foreground">{e.notes || '—'}</td>
                  </tr>
                ))
              ) : (
                <Empty columns={6} label="No expenses found" />
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      <Pagination
        currentPage={page}
        totalItems={activeData.length}
        pageSize={pageSize}
        onPageChange={setPage}
      />
    </>
  );
}
