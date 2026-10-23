import {VolumeCharts} from './volume-charts';
import {useState} from 'react';
import {Button} from '@/components/ui/button';
import {Dialog,DialogContent,DialogTitle} from '@/components/ui/dialog';
import {MasterPage} from './masters';
import {useFactory} from './provider';
import {Empty,Pill,Pagination,DateFilterPill,FilterToken,ExportButton,ThemedSelect,ThemedDatePicker,clearModalSearchParams,ViewTabs,SearchFilter,WhatsAppIcon} from './common';
import {money,number,dateLabel,downloadCsv,today,formatLocalDate,type Row} from '@/lib/erp-data';
import {Truck,Plus,Pencil,Trash2,CheckCircle2} from 'lucide-react';
import {supabase} from '@/integrations/supabase/client';
import {toast} from 'sonner';

export function Labour(){
  const {data:d,action,isAdmin,refresh}=useFactory();
  const [deptTab, setDeptTab] = useState<'production' | 'transport'>('production');

  // Transport Labour Department state
  const [transportSearch, setTransportSearch] = useState('');
  const [transportModalOpen, setTransportModalOpen] = useState(false);
  const [editingTransporter, setEditingTransporter] = useState<Row<'labour_master'> | null>(null);
  const [transportBusy, setTransportBusy] = useState(false);
  const [transportPage, setTransportPage] = useState(1);

  const [selected,setSelected]=useState<Row<'production_allocations'>|null>(null);
  const [statementWorker,setStatementWorker]=useState<Row<'labour_master'>|null>(null);
  const [borrowModalOpen,setBorrowModalOpen]=useState(false);
  const [borrowLabourId,setBorrowLabourId]=useState('');

  // Productivity Tracking: Worker & Date Filters
  const [allocWorkerId, setAllocWorkerId] = useState('All');
  const [prodRange,setProdRange]=useState<'All'|'Today'|'Yesterday'|'Week'|'Month'|'Exact'|'Custom'>('All');
  const [prodSpecificDate, setProdSpecificDate] = useState('');
  const [prodCustomFrom,setProdCustomFrom]=useState('');
  const [prodCustomTo,setProdCustomTo]=useState('');
  const [busy,setBusy]=useState(false);

  const [allocPage, setAllocPage] = useState(1);
  const [payrollPage, setPayrollPage] = useState(1);
  const [historyPage, setHistoryPage] = useState(1);
  const pageSize = 10;

  // Payroll & Ledger worker search and date mode
  const [ledgerMode, setLedgerMode] = useState<'all_time' | 'filtered'>('all_time');
  const [ledgerSearch, setLedgerSearch] = useState('');
  const [statementRange, setStatementRange] = useState<'All' | 'Today' | 'Yesterday' | 'Week' | 'Month'>('All');

  // Payroll date-wise report and status filter
  const [payrollFrom, setPayrollFrom] = useState('');
  const [payrollTo, setPayrollTo] = useState('');
  const [payrollStatus, setPayrollStatus] = useState('All');
  const [payrollWorkerId, setPayrollWorkerId] = useState('All');

  // Filter allocations based on worker and date range
  const now = new Date();
  const todayStr = formatLocalDate(now);
  const yesterdayDate = new Date(now.getTime() - 86400000);
  const yesterdayStr = formatLocalDate(yesterdayDate);

  const filteredAllocations = d.allocations.filter(a => {
    if (allocWorkerId !== 'All' && a.labour_id !== allocWorkerId) return false;
    const aDateStr = a.start_time ? a.start_time.slice(0, 10) : '';
    if (prodRange === 'All') return true;
    if (prodRange === 'Exact') {
      return prodSpecificDate ? aDateStr === prodSpecificDate : true;
    }
    if (prodRange === 'Today') return aDateStr === todayStr;
    if (prodRange === 'Yesterday') return aDateStr === yesterdayStr;
    if (prodRange === 'Week') {
      const date = new Date(a.start_time);
      return (now.getTime() - date.getTime()) <= 7 * 86400000;
    }
    if (prodRange === 'Month') {
      const date = new Date(a.start_time);
      return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
    }
    if (prodRange === 'Custom') {
      if (prodCustomFrom && aDateStr < prodCustomFrom) return false;
      if (prodCustomTo && aDateStr > prodCustomTo) return false;
      return true;
    }
    return true;
  });

  const totalAssigned = filteredAllocations.reduce((s, a) => s + a.allocated_qty, 0);
  const totalCompleted = filteredAllocations.reduce((s, a) => s + a.completed_qty, 0);
  const totalEarnedForPeriod = filteredAllocations.reduce((s, a) => s + (a.completed_qty * (a.labour_rate || 0)), 0);
  const totalUnpaidForPeriod = filteredAllocations.reduce((s, a) => s + Math.max(0, (a.completed_qty * (a.labour_rate || 0)) - (a.paid_earnings || 0)), 0);
  const totalPending = Math.max(0, totalAssigned - totalCompleted);
  const completionRate = totalAssigned > 0 ? Math.round((totalCompleted / totalAssigned) * 100) : 0;

  // Date-wise payroll report filtering
  const filteredPayroll = d.payroll.filter(p => {
    const pDate = p.payout_date ? p.payout_date.slice(0, 10) : (p.created_at ? p.created_at.slice(0, 10) : '');
    if (payrollFrom && pDate && pDate < payrollFrom) return false;
    if (payrollTo && pDate && pDate > payrollTo) return false;
    const statusVal = p.status ?? 'Pending';
    if (payrollStatus !== 'All' && statusVal !== payrollStatus) return false;
    if (payrollWorkerId !== 'All' && p.labour_id !== payrollWorkerId) return false;
    return true;
  });

  const totalPayrollGross = filteredPayroll.reduce((s, p) => s + p.gross, 0);
  const totalPayrollDeductions = filteredPayroll.reduce((s, p) => s + p.deductions, 0);
  const totalPayrollNetPaid = filteredPayroll.reduce((s, p) => s + p.net_paid, 0);

  // Split workers into Transport and Production
  const transportWorkers = d.workers.filter(w => 
    (w as any).department === 'Transport' || 
    Boolean((w as any).vehicle_number) ||
    (w.unit_assignment && w.unit_assignment.toLowerCase().includes('transport'))
  );
  const productionWorkers = d.workers.filter(w => !transportWorkers.some(tw => tw.id === w.id));

  const filteredTransportWorkers = transportWorkers.filter(w => {
    const q = transportSearch.toLowerCase();
    const name = (w.labour_name || '').toLowerCase();
    const veh = ((w as any).vehicle_number || '').toLowerCase();
    const phone = (w.phone || '').toLowerCase();
    const unit = (w.unit_assignment || '').toLowerCase();
    return name.includes(q) || veh.includes(q) || phone.includes(q) || unit.includes(q);
  });

  const paginatedTransport = filteredTransportWorkers.slice((transportPage - 1) * pageSize, transportPage * pageSize);
  const filteredLedgerWorkers = productionWorkers.filter(w => {
    if (!ledgerSearch) return true;
    const q = ledgerSearch.toLowerCase();
    return (w.labour_name || '').toLowerCase().includes(q) || (w.unit_assignment || '').toLowerCase().includes(q);
  });
  const paginatedWorkers = filteredLedgerWorkers.slice((payrollPage - 1) * pageSize, payrollPage * pageSize);
  const paginatedPayroll = filteredPayroll.slice((historyPage - 1) * pageSize, historyPage * pageSize);

  async function complete(e:React.FormEvent<HTMLFormElement>){
    e.preventDefault();
    if(!selected)return;
    setBusy(true);
    const qty=Number(new FormData(e.currentTarget).get('completed_qty'));
    if(await action('complete',{id:selected.id,completed_qty:qty}))setSelected(null);
    setBusy(false);
  }

  async function recordBorrowing(e:React.FormEvent<HTMLFormElement>){
    e.preventDefault();
    setBusy(true);
    const f=new FormData(e.currentTarget);
    const ok=await action('borrow',{
      labour_id:String(f.get('labour_id')),
      borrow_date:String(f.get('borrow_date')),
      amount:Number(f.get('amount')),
      remarks:String(f.get('remarks')??'')
    });
    setBusy(false);
    if(ok)setBorrowModalOpen(false);
  }

  const [paymentModalPayroll, setPaymentModalPayroll] = useState<Row<'labour_payroll'> | null>(null);

  async function recordPayment(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!paymentModalPayroll) return;
    setBusy(true);
    const f = new FormData(e.currentTarget);
    const amount = Number(f.get('amount'));
    const mode = String(f.get('payment_mode') || 'Cash');
    const date = String(f.get('disbursed_at') || new Date().toISOString());
    const ref = String(f.get('reference_notes') || '');
    const ok = await action('disburse', {
      payroll_id: paymentModalPayroll.id,
      amount,
      payment_mode: mode,
      disbursed_at: date,
      reference_notes: ref
    });
    setBusy(false);
    if (ok) setPaymentModalPayroll(null);
  }

  async function saveTransporter(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setTransportBusy(true);
    const f = new FormData(e.currentTarget);
    const name = String(f.get('labour_name') || '').trim();
    const vehicle = String(f.get('vehicle_number') || '').trim();
    const freight = Math.max(0, Number(f.get('fixed_freight_charges')) || 0);
    const phone = String(f.get('phone') || '').trim();
    const unit = String(f.get('unit_assignment') || '').trim() || `Transport • ${vehicle}`;

    if (!name) {
      toast.error('Transporter / Labour name is required');
      setTransportBusy(false);
      return;
    }
    if (!vehicle) {
      toast.error('Vehicle number is required');
      setTransportBusy(false);
      return;
    }

    const payload: any = {
      labour_name: name,
      phone: phone,
      vehicle_number: vehicle,
      fixed_freight_charges: freight,
      daily_rate: freight,
      department: 'Transport',
      unit_assignment: unit
    };

    let error;
    if (editingTransporter) {
      const res = await (supabase.from as any)('labour_master').update(payload).eq('id', editingTransporter.id);
      error = res.error;
    } else {
      const res = await (supabase.from as any)('labour_master').insert(payload);
      error = res.error;
    }

    setTransportBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success(editingTransporter ? 'Transporter details updated' : 'Transporter registered successfully');
    setTransportModalOpen(false);
    setEditingTransporter(null);
    await refresh();
  }

  async function deleteTransporter(w: Row<'labour_master'>) {
    if (!window.confirm(`Are you sure you want to delete transporter "${w.labour_name}"? This cannot be undone.`)) return;
    setTransportBusy(true);
    const { error } = await (supabase.from as any)('labour_master').delete().eq('id', w.id);
    setTransportBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success('Transporter removed successfully');
    await refresh();
  }

  return (
    <>
      {/* Department Switcher Tabs */}
      <div className="mb-6">
        <ViewTabs
          tabs={[
            { id: 'production', label: 'Production Labour Department', count: productionWorkers.length },
            { id: 'transport', label: 'Transport Labour Department', count: transportWorkers.length },
          ]}
          active={deptTab}
          onChange={t => setDeptTab(t as 'production' | 'transport')}
        />
      </div>

      {deptTab === 'transport' ? (
        <div className="space-y-6">
          {/* Transport Department Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 bg-card border border-border rounded-xl">
            <div>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                  <Truck className="w-4 h-4" />
                </div>
                <h2 className="text-lg font-semibold text-foreground">Transport Labour & Transporters</h2>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Manage carrier drivers, vehicle registration numbers, and fixed freight rates. These auto-sync into Delivery Challans in realtime.
              </p>
            </div>
            <Button
              onClick={() => {
                setEditingTransporter(null);
                setTransportModalOpen(true);
              }}
              className="flex items-center gap-1.5 shadow-sm"
            >
              <Plus className="w-4 h-4" /> Register Transporter / Driver
            </Button>
          </div>

          {/* Department Quick KPI Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-4 bg-card border border-border rounded-xl">
              <span className="text-xs text-muted-foreground block font-medium">Registered Transporters</span>
              <strong className="text-xl font-bold text-foreground mt-0.5 block">{transportWorkers.length}</strong>
              <span className="text-[11px] text-muted-foreground">Active in Logistics</span>
            </div>
            <div className="p-4 bg-card border border-border rounded-xl">
              <span className="text-xs text-muted-foreground block font-medium">Fleet Vehicles</span>
              <strong className="text-xl font-bold text-primary mt-0.5 block">
                {new Set(transportWorkers.map(w => (w as any).vehicle_number).filter(Boolean)).size}
              </strong>
              <span className="text-[11px] text-muted-foreground">Active vehicles</span>
            </div>
            <div className="p-4 bg-card border border-border rounded-xl">
              <span className="text-xs text-muted-foreground block font-medium">Avg Fixed Freight</span>
              <strong className="text-xl font-bold text-foreground mt-0.5 block">
                {transportWorkers.length ? money(Math.round(transportWorkers.reduce((s, w) => s + ((w as any).fixed_freight_charges || w.daily_rate || 0), 0) / transportWorkers.length)) : money(0)}
              </strong>
              <span className="text-[11px] text-muted-foreground">Per trip standard</span>
            </div>
            <div className="p-4 bg-card border border-border rounded-xl">
              <span className="text-xs text-muted-foreground block font-medium">Challans Delivered</span>
              <strong className="text-xl font-bold text-emerald-500 mt-0.5 block">
                {d.challans.filter(c => transportWorkers.some(tw => tw.labour_name === c.transport_carrier || (tw as any).vehicle_number === c.vehicle_number)).length}
              </strong>
              <span className="text-[11px] text-muted-foreground">Linked shipments</span>
            </div>
          </div>

          {/* Search Filter */}
          <div className="filters">
            <SearchFilter 
              value={transportSearch} 
              onChange={v => { setTransportSearch(v); setTransportPage(1); }} 
              placeholder="Search transporter name, vehicle number, phone…" 
            />
          </div>

          {/* Desktop Table View */}
          <div className="desktop-table-view table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Transporter / Driver</th>
                  <th>Vehicle Number</th>
                  <th className="numeric">Fixed Freight (₹)</th>
                  <th>Phone Number</th>
                  <th>Route / Unit</th>
                  <th className="numeric">Delivered Challans</th>
                  <th className="w-24 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedTransport.length ? paginatedTransport.map(w => {
                  const vehicle = (w as any).vehicle_number;
                  const freight = (w as any).fixed_freight_charges ?? w.daily_rate ?? 0;
                  const challanCount = d.challans.filter(c => c.transport_carrier === w.labour_name || (vehicle && c.vehicle_number === vehicle)).length;
                  return (
                    <tr key={w.id}>
                      <td className="font-medium text-foreground">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-md bg-secondary flex items-center justify-center text-muted-foreground">
                            <Truck className="w-3.5 h-3.5" />
                          </div>
                          <span>{w.labour_name}</span>
                        </div>
                      </td>
                      <td>
                        {vehicle ? (
                          <span className="inline-flex items-center font-mono font-semibold px-2 py-0.5 bg-secondary/80 border border-border rounded text-xs text-foreground uppercase tracking-wide">
                            {vehicle}
                          </span>
                        ) : (
                          <span className="text-muted-foreground text-xs italic">No vehicle #</span>
                        )}
                      </td>
                      <td className="numeric font-semibold text-foreground">
                        {money(freight)}
                      </td>
                      <td>
                        {w.phone ? (
                          <div className="flex items-center gap-2">
                            <a href={`tel:${w.phone}`} className="text-primary hover:underline font-mono text-xs">
                              {w.phone}
                            </a>
                            <a 
                              href={`https://wa.me/${w.phone.replace(/\D/g, '')}`} 
                              target="_blank" 
                              rel="noreferrer"
                              className="text-emerald-500 hover:text-emerald-400 p-1"
                              title="Chat on WhatsApp"
                            >
                              <WhatsAppIcon className="w-3.5 h-3.5" />
                            </a>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="text-muted-foreground text-xs">
                        {w.unit_assignment || 'General Logistics'}
                      </td>
                      <td className="numeric font-medium text-foreground">
                        {challanCount > 0 ? (
                          <span className="inline-flex items-center gap-1 text-emerald-500 font-semibold">
                            <CheckCircle2 className="w-3.5 h-3.5" /> {challanCount}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">0</span>
                        )}
                      </td>
                      <td className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            title="Edit Transporter"
                            onClick={() => {
                              setEditingTransporter(w);
                              setTransportModalOpen(true);
                            }}
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="destructive"
                            size="icon-sm"
                            title="Delete Transporter"
                            onClick={() => deleteTransporter(w)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                }) : (
                  <Empty columns={7} label="No transport labour registered yet. Click 'Register Transporter' above." />
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile Card View */}
          <div className="mobile-card-view">
            {paginatedTransport.length ? paginatedTransport.map(w => {
              const vehicle = (w as any).vehicle_number;
              const freight = (w as any).fixed_freight_charges ?? w.daily_rate ?? 0;
              const challanCount = d.challans.filter(c => c.transport_carrier === w.labour_name || (vehicle && c.vehicle_number === vehicle)).length;
              return (
                <div key={w.id} className="mobile-record-card">
                  <div className="mobile-card-top">
                    <div className="flex items-center gap-2">
                      <Truck className="w-4 h-4 text-primary" />
                      <div className="mobile-card-title">{w.labour_name}</div>
                    </div>
                    <strong className="text-foreground text-sm">{money(freight)}</strong>
                  </div>

                  <div className="mobile-card-grid">
                    <div className="mobile-card-field">
                      <span className="mobile-card-label">Vehicle Number</span>
                      <span className="mobile-card-value font-mono font-semibold">{vehicle || '—'}</span>
                    </div>
                    <div className="mobile-card-field">
                      <span className="mobile-card-label">Labour Phone</span>
                      <span className="mobile-card-value">{w.phone || '—'}</span>
                    </div>
                    <div className="mobile-card-field">
                      <span className="mobile-card-label">Fixed Freight</span>
                      <span className="mobile-card-value font-semibold text-emerald-500">{money(freight)}</span>
                    </div>
                    <div className="mobile-card-field">
                      <span className="mobile-card-label">Challans</span>
                      <span className="mobile-card-value">{challanCount} trips</span>
                    </div>
                  </div>

                  <div className="mobile-card-actions flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1"
                      onClick={() => {
                        setEditingTransporter(w);
                        setTransportModalOpen(true);
                      }}
                    >
                      <Pencil className="w-3.5 h-3.5 mr-1" /> Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => deleteTransporter(w)}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              );
            }) : (
              <Empty columns={1} label="No transport labour registered yet" />
            )}
          </div>

          <Pagination
            currentPage={transportPage}
            totalItems={filteredTransportWorkers.length}
            pageSize={pageSize}
            onPageChange={setTransportPage}
          />
        </div>
      ) : (
        <>
          <MasterPage kind="workers" title="Production Labour Management" department="Production"/>
          <section className="mt-8">
        <div className="section-header flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h2>Production Allocations & Productivity Tracking</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Filter by worker and date to see exact finished work and wages to be paid.
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <FilterToken
              label="Worker"
              value={allocWorkerId}
              onChange={v => { setAllocWorkerId(v); setAllocPage(1); }}
              options={[
                { value: 'All', label: 'All Workers' },
                ...productionWorkers.map(w => ({ value: w.id, label: w.labour_name }))
              ]}
            />

            <div className="flex items-center gap-1 bg-card border border-border p-0.5 rounded-lg text-xs h-8 shadow-xs">
              {(['All', 'Today', 'Yesterday', 'Week', 'Month', 'Exact', 'Custom'] as const).map(r => (
                <button
                  key={r}
                  type="button"
                  className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${prodRange === r ? 'bg-primary text-primary-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'}`}
                  onClick={() => {
                    setProdRange(r);
                    if (r === 'Exact' && !prodSpecificDate) setProdSpecificDate(today());
                    setAllocPage(1);
                  }}
                >
                  {r === 'All' ? 'All Time' : r === 'Exact' ? 'Pick Date' : r === 'Custom' ? 'Custom Range' : r === 'Week' ? 'This Week' : r === 'Month' ? 'This Month' : r}
                </button>
              ))}
            </div>

            {prodRange === 'Exact' && (
              <DateFilterPill label="Date" value={prodSpecificDate} onChange={v => { setProdSpecificDate(v); setAllocPage(1); }} placeholder="Select Date" />
            )}

            {prodRange === 'Custom' && (
              <div className="flex items-center gap-2">
                <DateFilterPill label="From" value={prodCustomFrom} onChange={v=>{ setProdCustomFrom(v); setAllocPage(1); }} placeholder="From" />
                <DateFilterPill label="To" value={prodCustomTo} onChange={v=>{ setProdCustomTo(v); setAllocPage(1); }} placeholder="To" />
              </div>
            )}
          </div>
        </div>

        {/* Productivity & Monetary Summary Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 my-4">
          <div className="p-3 bg-card border border-border rounded-xl">
            <span className="text-xs text-muted-foreground block">Assigned Qty</span>
            <strong className="text-base font-semibold text-foreground">{number(totalAssigned)} boxes</strong>
          </div>
          <div className="p-3 bg-card border border-border rounded-xl">
            <span className="text-xs text-muted-foreground block">Completed Qty</span>
            <strong className="text-base font-semibold text-emerald-500">{number(totalCompleted)} boxes</strong>
          </div>
          <div className="p-3 bg-card border border-border rounded-xl">
            <span className="text-xs text-muted-foreground block">Wages Earned (Selected)</span>
            <strong className="text-base font-bold text-emerald-500">{money(totalEarnedForPeriod)}</strong>
          </div>
          <div className="p-3 bg-card border border-border rounded-xl">
            <span className="text-xs text-muted-foreground block">Unpaid Balance</span>
            <strong className="text-base font-semibold text-amber-500">{money(totalUnpaidForPeriod)}</strong>
          </div>
          <div className="p-3 bg-card border border-border rounded-xl">
            <span className="text-xs text-muted-foreground block">Completion Rate</span>
            <strong className="text-base font-semibold text-foreground">{completionRate}%</strong>
          </div>
        </div>

        {/* Desktop Table View */}
        <div className="desktop-table-view table-wrap">
          <table>
            <thead>
              <tr>
                <th>Worker</th>
                <th>Order / PO #</th>
                <th>Product Type & Size</th>
                <th className="numeric">Assigned</th>
                <th className="numeric">Produced</th>
                <th className="numeric">Rate / Box</th>
                <th className="numeric">Earned Amount</th>
                <th className="numeric">Pending</th>
                <th>Progress</th>
                <th>Scheduled Start</th>
                <th>Tentative Completion</th>
                <th>Status</th>
                <th className="text-right"/>
              </tr>
            </thead>
            <tbody>
              {paginatedAllocations.length ? paginatedAllocations.map(a=>{
                const item = d.items.find(i=>i.id===a.order_item_id);
                const order = item ? d.orders.find(o=>o.id===item.order_id) : null;
                const worker = d.workers.find(w=>w.id===a.labour_id);
                const pending = Math.max(0, a.allocated_qty - a.completed_qty);
                const progressPct = a.allocated_qty > 0 ? Math.round((a.completed_qty / a.allocated_qty) * 100) : 0;
                const earned = a.completed_qty * (a.labour_rate || 0);

                return (
                  <tr key={a.id}>
                    <td className="font-medium text-foreground">{worker?.labour_name || 'Worker'}</td>
                    <td className="text-xs text-muted-foreground font-medium">{order?.order_no || '—'}</td>
                    <td>
                      <div className="flex items-center gap-1.5">
                        <span className="font-medium">{item?.box_type || '—'}</span>
                        {item?.size_dimensions && <span className="text-xs text-muted-foreground">({item.size_dimensions})</span>}
                      </div>
                    </td>
                    <td className="numeric font-medium">{number(a.allocated_qty)}</td>
                    <td className="numeric text-emerald-500 font-medium">{number(a.completed_qty)}</td>
                    <td className="numeric font-medium text-foreground">{money(a.labour_rate)}</td>
                    <td className="numeric text-emerald-500 font-semibold">{money(earned)}</td>
                    <td className="numeric font-medium text-foreground">{number(pending)}</td>
                    <td>{progressPct}%</td>
                    <td className="text-xs text-muted-foreground">
                      {new Date(a.start_time).toLocaleString('en-GB',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}
                    </td>
                    <td className="text-xs text-muted-foreground">
                      {new Date(a.tentative_completion).toLocaleString('en-GB',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}
                    </td>
                    <td><Pill value={a.status}/></td>
                    <td className="text-right">
                      {a.completed_qty < a.allocated_qty && (
                        <Button size="sm" variant="outline" onClick={()=>setSelected(a)}>Record Completion</Button>
                      )}
                    </td>
                  </tr>
                );
              }) : (
                <Empty columns={13} label="No production allocations found for selected filter"/>
              )}
            </tbody>
            {filteredAllocations.length > 0 && (
              <tfoot>
                <tr className="border-t border-border bg-muted/20 font-medium">
                  <td colSpan={4} className="text-right text-xs text-muted-foreground font-medium px-3 py-2.5">
                    Filter Totals ({filteredAllocations.length} allocations):
                  </td>
                  <td className="numeric text-emerald-500 font-medium px-3 py-2.5 tabular-nums">
                    {number(totalCompleted)} boxes
                  </td>
                  <td className="numeric text-muted-foreground px-3 py-2.5">—</td>
                  <td className="numeric text-emerald-500 font-bold px-3 py-2.5 tabular-nums">
                    {money(totalEarnedForPeriod)}
                  </td>
                  <td className="numeric text-amber-500 font-medium px-3 py-2.5 tabular-nums">
                    {number(totalPending)}
                  </td>
                  <td colSpan={5} />
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        {/* Mobile Card View */}
        <div className="mobile-card-view">
          {paginatedAllocations.length ? paginatedAllocations.map(a => {
            const workerName = d.workers.find(w=>w.id===a.labour_id)?.labour_name || 'Worker';
            const boxType = d.items.find(i=>i.id===a.order_item_id)?.box_type || '—';
            const pending = a.allocated_qty - a.completed_qty;
            const pct = Math.round((a.completed_qty / (a.allocated_qty || 1)) * 100);
            const earned = a.completed_qty * (a.labour_rate || 0);
            return (
              <div key={a.id} className="mobile-record-card">
                <div className="mobile-card-top">
                  <div className="min-w-0">
                    <div className="mobile-card-title">{workerName}</div>
                    <div className="mobile-card-sub">{boxType}</div>
                  </div>
                  <Pill value={a.status}/>
                </div>

                <div className="mobile-card-grid">
                  <div className="mobile-card-field">
                    <span className="mobile-card-label">Assigned</span>
                    <span className="mobile-card-value">{number(a.allocated_qty)}</span>
                  </div>
                  <div className="mobile-card-field">
                    <span className="mobile-card-label">Completed</span>
                    <span className="mobile-card-value font-semibold text-foreground">{number(a.completed_qty)}</span>
                  </div>
                  <div className="mobile-card-field">
                    <span className="mobile-card-label">Labour Rate</span>
                    <span className="mobile-card-value">{money(a.labour_rate)}/box</span>
                  </div>
                  <div className="mobile-card-field">
                    <span className="mobile-card-label">Earned Pay</span>
                    <span className="mobile-card-value text-emerald-500 font-bold">{money(earned)}</span>
                  </div>
                  <div className="mobile-card-field">
                    <span className="mobile-card-label">Pending</span>
                    <span className="mobile-card-value text-amber-500 font-medium">{number(pending)}</span>
                  </div>
                  <div className="mobile-card-field">
                    <span className="mobile-card-label">Progress</span>
                    <span className="mobile-card-value">{pct}%</span>
                  </div>
                </div>

                <div className="text-xs text-muted-foreground">
                  Target: {new Date(a.tentative_completion).toLocaleString('en-GB',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}
                </div>

                {a.completed_qty < a.allocated_qty && (
                  <div className="mobile-card-actions">
                    <Button size="sm" variant="outline" className="w-full" onClick={()=>setSelected(a)}>
                      Record Completion
                    </Button>
                  </div>
                )}
              </div>
            );
          }) : (
            <Empty columns={1} label="No production allocations" />
          )}
        </div>

        <Pagination
          currentPage={allocPage}
          totalItems={d.allocations.length}
          pageSize={pageSize}
          onPageChange={setAllocPage}
        />

        {/* Labour & Production Volume Charts */}
        <VolumeCharts />
      </section>

      <section className="mt-8">
        <div className="section-header flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h2>Payroll & Worker Ledger</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {ledgerMode === 'date_filtered'
                ? `Daily work & wages breakdown for ${prodRange === 'Today' ? 'Today' : prodRange === 'Yesterday' ? 'Yesterday' : prodRange === 'Exact' ? prodSpecificDate : 'selected date filter'}`
                : 'All-time cumulative unpaid balances & ledger due'}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1 bg-card border border-border p-0.5 rounded-lg text-xs h-8 shadow-xs">
              <button
                type="button"
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${ledgerMode === 'all_time' ? 'bg-primary text-primary-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'}`}
                onClick={() => setLedgerMode('all_time')}
              >
                All-Time Balance
              </button>
              <button
                type="button"
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${ledgerMode === 'date_filtered' ? 'bg-primary text-primary-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'}`}
                onClick={() => setLedgerMode('date_filtered')}
              >
                Daily / Filtered Work
              </button>
            </div>
            <SearchFilter
              value={ledgerSearch}
              onChange={v => { setLedgerSearch(v); setPayrollPage(1); }}
              placeholder="Search worker name…"
            />
            <Button size="sm" variant="outline" onClick={()=>{ setBorrowLabourId(d.workers[0]?.id??''); setBorrowModalOpen(true); }}>
              Record Borrowing
            </Button>
          </div>
        </div>

        {/* Desktop Table View */}
        <div className="desktop-table-view table-wrap">
          <table>
            <thead>
              <tr>
                <th>Worker</th>
                <th className="numeric">{ledgerMode === 'date_filtered' ? `Produced (${prodRange === 'Today' ? 'Today' : prodRange === 'Yesterday' ? 'Yesterday' : prodRange === 'Exact' ? prodSpecificDate : 'Filtered'})` : 'Total Produced'}</th>
                <th className="numeric">{ledgerMode === 'date_filtered' ? 'Earned Pay (Selected)' : 'Gross Unpaid'}</th>
                <th className="numeric">{ledgerMode === 'date_filtered' ? 'Advances (Period)' : 'Outstanding Advances'}</th>
                <th className="numeric">Net Payable</th>
                <th className="text-right"/>
              </tr>
            </thead>
            <tbody>
              {paginatedWorkers.length ? paginatedWorkers.map(w=>{
                const workerAllocs = ledgerMode === 'date_filtered'
                  ? filteredAllocations.filter(a => a.labour_id === w.id)
                  : d.allocations.filter(a => a.labour_id === w.id);

                const produced = workerAllocs.reduce((s,a)=>s+a.completed_qty,0);
                const earnings = ledgerMode === 'date_filtered'
                  ? workerAllocs.reduce((s,a)=>s + (a.completed_qty * (a.labour_rate || 0)),0)
                  : workerAllocs.reduce((s,a)=>s + (a.completed_qty * (a.labour_rate || 0)) - (a.paid_earnings || 0),0);

                const workerBorrowings = ledgerMode === 'date_filtered'
                  ? d.borrowings.filter(b => {
                      if (b.labour_id !== w.id) return false;
                      const bDate = b.borrow_date ? b.borrow_date.slice(0, 10) : '';
                      if (prodRange === 'Today') return bDate === todayStr;
                      if (prodRange === 'Yesterday') return bDate === yesterdayStr;
                      if (prodRange === 'Exact') return bDate === prodSpecificDate;
                      return true;
                    })
                  : d.borrowings.filter(b => b.labour_id === w.id);

                const debt = workerBorrowings.reduce((s,b)=>s + b.amount - (ledgerMode === 'date_filtered' ? 0 : b.deducted_amount),0);
                const netPayable = Math.max(0, earnings - debt);

                return (
                  <tr key={w.id}>
                    <td className="font-medium text-foreground">
                      <div>
                        <span>{w.labour_name}</span>
                        {w.unit_assignment && <span className="text-xs text-muted-foreground block">{w.unit_assignment}</span>}
                      </div>
                    </td>
                    <td className="numeric font-medium">{number(produced)}</td>
                    <td className="numeric font-medium text-emerald-500">{money(earnings)}</td>
                    <td className="numeric text-muted-foreground">{money(debt)}</td>
                    <td className="numeric font-bold text-foreground">{money(netPayable)}</td>
                    <td className="text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button size="sm" variant="ghost" onClick={()=>setStatementWorker(w)}>
                          Statement
                        </Button>
                        <Button size="sm" variant="outline" disabled={!earnings} onClick={()=>{
                          if(window.confirm(`Pay ${money(netPayable)} to ${w.labour_name}?`)) action('payroll',{labour_id:w.id});
                        }}>
                          Pay Payroll
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              }) : (
                <Empty columns={6} label="No workers match the selected search or criteria"/>
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Card View */}
        <div className="mobile-card-view">
          {paginatedWorkers.length ? paginatedWorkers.map(w => {
            const workerAllocs = ledgerMode === 'date_filtered'
              ? filteredAllocations.filter(a => a.labour_id === w.id)
              : d.allocations.filter(a => a.labour_id === w.id);

            const produced = workerAllocs.reduce((s,a)=>s+a.completed_qty,0);
            const earnings = ledgerMode === 'date_filtered'
              ? workerAllocs.reduce((s,a)=>s + (a.completed_qty * (a.labour_rate || 0)),0)
              : workerAllocs.reduce((s,a)=>s + (a.completed_qty * (a.labour_rate || 0)) - (a.paid_earnings || 0),0);

            const workerBorrowings = ledgerMode === 'date_filtered'
              ? d.borrowings.filter(b => {
                  if (b.labour_id !== w.id) return false;
                  const bDate = b.borrow_date ? b.borrow_date.slice(0, 10) : '';
                  if (prodRange === 'Today') return bDate === todayStr;
                  if (prodRange === 'Yesterday') return bDate === yesterdayStr;
                  if (prodRange === 'Exact') return bDate === prodSpecificDate;
                  return true;
                })
              : d.borrowings.filter(b => b.labour_id === w.id);

            const debt = workerBorrowings.reduce((s,b)=>s + b.amount - (ledgerMode === 'date_filtered' ? 0 : b.deducted_amount),0);
            const netPayable = Math.max(0, earnings - debt);
            return (
              <div key={w.id} className="mobile-record-card">
                <div className="mobile-card-top">
                  <div className="mobile-card-title">{w.labour_name}</div>
                  <span className="font-semibold text-foreground">{money(netPayable)}</span>
                </div>

                <div className="mobile-card-grid">
                  <div className="mobile-card-field">
                    <span className="mobile-card-label">Produced Boxes</span>
                    <span className="mobile-card-value">{number(produced)} boxes</span>
                  </div>
                  <div className="mobile-card-field">
                    <span className="mobile-card-label">{ledgerMode === 'date_filtered' ? 'Earned Pay' : 'Gross Unpaid'}</span>
                    <span className="mobile-card-value font-medium text-emerald-500">{money(earnings)}</span>
                  </div>
                  <div className="mobile-card-field">
                    <span className="mobile-card-label">Advances Debt</span>
                    <span className="mobile-card-value text-muted-foreground">{money(debt)}</span>
                  </div>
                  <div className="mobile-card-field">
                    <span className="mobile-card-label">Net Due</span>
                    <span className="mobile-card-value font-semibold text-foreground">{money(netPayable)}</span>
                  </div>
                </div>

                <div className="mobile-card-actions">
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full"
                    disabled={!earnings}
                    onClick={()=>{
                      if(window.confirm(`Pay ${money(netPayable)} to ${w.labour_name}?`)) action('payroll',{labour_id:w.id});
                    }}
                  >
                    Pay Payroll ({money(netPayable)})
                  </Button>
                </div>
              </div>
            );
          }) : (
            <Empty columns={1} label="No workers registered" />
          )}
        </div>

        <Pagination
          currentPage={payrollPage}
          totalItems={d.workers.length}
          pageSize={pageSize}
          onPageChange={setPayrollPage}
        />
      </section>

      <section className="mt-8">
        <div className="section-header flex items-center justify-between gap-4">
          <h2>Payroll History & Date-wise Report</h2>
          <ExportButton
            onClick={() => downloadCsv('payroll-report', filteredPayroll.map(p => ({
              Worker: d.workers.find(w => w.id === p.labour_id)?.labour_name ?? '—',
              Date: p.payout_date ? dateLabel(p.payout_date) : (p.created_at ? dateLabel(p.created_at) : '—'),
              Gross: p.gross,
              Deductions: p.deductions,
              NetPaid: p.net_paid,
              Status: p.status ?? 'Pending'
            })))}
          />
        </div>

        {/* Date-wise Payroll Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 my-4">
          <div className="p-3 bg-card border border-border rounded-xl">
            <span className="text-xs text-muted-foreground block">Total Gross</span>
            <strong className="text-base font-semibold text-foreground">{money(totalPayrollGross)}</strong>
          </div>
          <div className="p-3 bg-card border border-border rounded-xl">
            <span className="text-xs text-muted-foreground block">Total Deductions</span>
            <strong className="text-base font-semibold text-amber-500">{money(totalPayrollDeductions)}</strong>
          </div>
          <div className="p-3 bg-card border border-border rounded-xl">
            <span className="text-xs text-muted-foreground block">Net Paid</span>
            <strong className="text-base font-semibold text-emerald-500">{money(totalPayrollNetPaid)}</strong>
          </div>
          <div className="p-3 bg-card border border-border rounded-xl">
            <span className="text-xs text-muted-foreground block">Records</span>
            <strong className="text-base font-semibold text-foreground">{number(filteredPayroll.length)} entries</strong>
          </div>
        </div>

        {/* Date-wise and Status Filters */}
        <div className="filters mb-4">
          <DateFilterPill label="From" value={payrollFrom} onChange={v => { setPayrollFrom(v); setHistoryPage(1); }} placeholder="All" />
          <DateFilterPill label="To" value={payrollTo} onChange={v => { setPayrollTo(v); setHistoryPage(1); }} placeholder="All" />
          <FilterToken
            label="Payment Status"
            value={payrollStatus}
            onChange={v => { setPayrollStatus(v); setHistoryPage(1); }}
            options={[
              { value: 'All', label: 'All statuses' },
              { value: 'Paid', label: 'Paid' },
              { value: 'Partially Paid', label: 'Partially Paid' },
              { value: 'Pending', label: 'Pending' }
            ]}
          />
          <FilterToken
            label="Worker"
            value={payrollWorkerId}
            onChange={v => { setPayrollWorkerId(v); setHistoryPage(1); }}
            options={[
              { value: 'All', label: 'All Workers' },
              ...d.workers.map(w => ({ value: w.id, label: w.labour_name }))
            ]}
          />
        </div>

        {/* Desktop Table View */}
        <div className="desktop-table-view table-wrap">
          <table>
            <thead>
              <tr>
                <th>Worker</th>
                <th>Date</th>
                <th className="numeric">Gross</th>
                <th className="numeric">Deductions</th>
                <th className="numeric">Net Payable</th>
                <th className="numeric">Paid</th>
                <th className="numeric">Balance</th>
                <th>Status</th>
                <th className="text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {paginatedPayroll.length ? paginatedPayroll.map(p=>{
                const paid = Number(p.amount_paid ?? 0);
                const balance = Math.max(0, p.net_paid - paid);
                const isPaid = (p.status ?? 'Pending') === 'Paid' || balance <= 0;
                return (
                  <tr key={p.id}>
                    <td className="font-medium text-foreground">{d.workers.find(w=>w.id===p.labour_id)?.labour_name}</td>
                    <td>{p.payout_date?dateLabel(p.payout_date):'—'}</td>
                    <td className="numeric">{money(p.gross)}</td>
                    <td className="numeric text-muted-foreground">{money(p.deductions)}</td>
                    <td className="numeric font-medium text-foreground">{money(p.net_paid)}</td>
                    <td className="numeric text-emerald-500">{money(paid)}</td>
                    <td className="numeric font-medium text-amber-500">{money(balance)}</td>
                    <td><Pill value={p.status ?? 'Pending'}/></td>
                    <td className="text-right">
                      {!isPaid && isAdmin && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs px-2.5"
                          onClick={() => setPaymentModalPayroll(p)}
                        >
                          Record payment
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              }) : (
                <Empty columns={9}/>
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Card View */}
        <div className="mobile-card-view">
          {paginatedPayroll.length ? paginatedPayroll.map(p => {
            const workerName = d.workers.find(w=>w.id===p.labour_id)?.labour_name || 'Worker';
            const paid = Number(p.amount_paid ?? 0);
            const balance = Math.max(0, p.net_paid - paid);
            const isPaid = (p.status ?? 'Pending') === 'Paid' || balance <= 0;
            return (
              <div key={p.id} className="mobile-record-card">
                <div className="mobile-card-top">
                  <div className="min-w-0">
                    <div className="mobile-card-title">{workerName}</div>
                    <div className="mobile-card-sub">{p.payout_date ? dateLabel(p.payout_date) : '—'}</div>
                  </div>
                  <Pill value={p.status ?? 'Pending'}/>
                </div>

                <div className="mobile-card-grid">
                  <div className="mobile-card-field">
                    <span className="mobile-card-label">Gross</span>
                    <span className="mobile-card-value">{money(p.gross)}</span>
                  </div>
                  <div className="mobile-card-field">
                    <span className="mobile-card-label">Deductions</span>
                    <span className="mobile-card-value text-muted-foreground">{money(p.deductions)}</span>
                  </div>
                  <div className="mobile-card-field">
                    <span className="mobile-card-label">Net Payable</span>
                    <span className="mobile-card-value font-semibold text-foreground">{money(p.net_paid)}</span>
                  </div>
                  <div className="mobile-card-field">
                    <span className="mobile-card-label">Paid</span>
                    <span className="mobile-card-value text-emerald-500">{money(paid)}</span>
                  </div>
                  <div className="mobile-card-field">
                    <span className="mobile-card-label">Balance</span>
                    <span className="mobile-card-value text-amber-500 font-medium">{money(balance)}</span>
                  </div>
                  <div className="mobile-card-field">
                    <span className="mobile-card-label">Status</span>
                    <span className="mobile-card-value">{p.status ?? 'Pending'}</span>
                  </div>
                </div>

                {!isPaid && isAdmin && (
                  <div className="mobile-card-actions">
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full h-8 text-xs"
                      onClick={() => setPaymentModalPayroll(p)}
                    >
                      Record payment
                    </Button>
                  </div>
                )}
              </div>
            );
          }) : (
            <Empty columns={1} label="No payroll records found" />
          )}
        </div>

        <Pagination
          currentPage={historyPage}
          totalItems={filteredPayroll.length}
          pageSize={pageSize}
          onPageChange={setHistoryPage}
        />
      </section>

      <VolumeCharts/>
        </>
      )}

      {/* Register / Edit Transport Labour Modal */}
      <Dialog open={transportModalOpen} onOpenChange={open => { if(!open){ setTransportModalOpen(false); setEditingTransporter(null); } }}>
        <DialogContent className="modal-wide" aria-describedby={undefined}>
          <DialogTitle className="text-xl font-medium">
            {editingTransporter ? 'Edit Transport Labour / Transporter' : 'Register Transport Labour / Transporter'}
          </DialogTitle>
          <div className="form-subtitle">
            Enter transporter details and fixed freight rates. These will auto-populate in Delivery Challans upon selection.
          </div>

          <form onSubmit={saveTransporter}>
            <div className="form-grid">
              <label>
                Transporter / Labour Name
                <input
                  name="labour_name"
                  defaultValue={editingTransporter?.labour_name || ''}
                  placeholder="e.g. Ramesh Sharma, Apex Logistics"
                  required
                />
              </label>

              <label>
                Vehicle Number
                <input
                  name="vehicle_number"
                  defaultValue={(editingTransporter as any)?.vehicle_number || ''}
                  placeholder="e.g. MH-12-AB-1234"
                  required
                />
              </label>

              <label>
                Fix Freight Charges (₹)
                <input
                  type="number"
                  min={0}
                  step=".01"
                  name="fixed_freight_charges"
                  defaultValue={(editingTransporter as any)?.fixed_freight_charges ?? editingTransporter?.daily_rate ?? ''}
                  placeholder="e.g. 750"
                  required
                />
              </label>

              <label>
                Labour Phone Number
                <input
                  type="tel"
                  name="phone"
                  defaultValue={editingTransporter?.phone || ''}
                  placeholder="e.g. 9876543210"
                />
              </label>

              <label className="col-span-full">
                Route / Unit Assignment (Optional)
                <input
                  name="unit_assignment"
                  defaultValue={editingTransporter?.unit_assignment || ''}
                  placeholder="e.g. Factory Dedicated Truck, Pune-Mumbai Route"
                />
              </label>
            </div>

            <div className="form-actions">
              <Button
                variant="outline"
                type="button"
                onClick={() => {
                  setTransportModalOpen(false);
                  setEditingTransporter(null);
                }}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={transportBusy}>
                {transportBusy ? 'Saving…' : editingTransporter ? 'Update Transporter' : 'Register Transporter'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!selected} onOpenChange={(open)=>{ if(!open){ setSelected(null); clearModalSearchParams(); } }}>
        <DialogContent className="modal-wide" aria-describedby={undefined}>
          <DialogTitle>Record Production Completion</DialogTitle>
          <div className="form-subtitle">
            Update finished box count for worker allocation.
          </div>
          <form onSubmit={complete}>
            <div className="form-grid">
              <label className="form-wide">
                Total Completed Quantity
                <input
                  name="completed_qty"
                  type="number"
                  min={selected?.completed_qty??0}
                  max={selected?.allocated_qty??0}
                  defaultValue={selected?.allocated_qty??0}
                  required
                />
              </label>
            </div>
            <div className="form-actions">
              <Button variant="outline" type="button" onClick={()=>setSelected(null)}>Cancel</Button>
              <Button disabled={busy} type="submit">{busy?'Saving…':'Save Completion'}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Record Borrowing Dialog */}
      <Dialog open={borrowModalOpen} onOpenChange={(open)=>{ setBorrowModalOpen(open); if(!open) clearModalSearchParams(); }}>
        <DialogContent className="modal-wide" aria-describedby={undefined}>
          <DialogTitle className="text-xl font-medium">Record Worker Borrowing / Advance</DialogTitle>
          <div className="form-subtitle">
            Log an advance or cash borrowing for a labourer. It will be automatically deducted during payroll.
          </div>
          <form onSubmit={recordBorrowing}>
            <div className="form-grid">
              <label className="form-wide">
                Labourer / Worker
                <ThemedSelect
                  name="labour_id"
                  defaultValue={borrowLabourId || (d.workers[0]?.id ?? '')}
                  options={d.workers.map(w=>({
                    value: w.id,
                    label: `${w.labour_name} (${w.unit_assignment || 'General'})`
                  }))}
                  required
                />
              </label>
              <label>
                Borrowing Date
                <ThemedDatePicker name="borrow_date" defaultValue={today()} required />
              </label>
              <label>
                Amount (₹)
                <input type="number" min={1} step=".01" name="amount" placeholder="e.g. 500" required />
              </label>
              <label className="form-wide">
                Remarks / Reason
                <input name="remarks" placeholder="e.g. Emergency advance, festival allowance" />
              </label>
            </div>
            <div className="form-actions">
              <Button variant="outline" type="button" onClick={()=>setBorrowModalOpen(false)}>Cancel</Button>
              <Button disabled={busy} type="submit">{busy?'Recording…':'Record Borrowing'}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Individual Labour Statement Dialog */}
      <Dialog open={!!statementWorker} onOpenChange={(open)=>{ if(!open){ setStatementWorker(null); clearModalSearchParams(); } }}>
        <DialogContent className="modal-wide max-w-2xl" aria-describedby={undefined}>
          <DialogTitle className="text-xl font-medium">Individual Labour Statement</DialogTitle>
          {statementWorker && (() => {
            const rawAllocs = d.allocations.filter(a => a.labour_id === statementWorker.id);
            const wAllocs = rawAllocs.filter(a => {
              const aDate = a.start_time ? a.start_time.slice(0, 10) : '';
              if (statementRange === 'All') return true;
              if (statementRange === 'Today') return aDate === todayStr;
              if (statementRange === 'Yesterday') return aDate === yesterdayStr;
              if (statementRange === 'Week') {
                const dt = new Date(a.start_time);
                return (now.getTime() - dt.getTime()) <= 7 * 86400000;
              }
              if (statementRange === 'Month') {
                const dt = new Date(a.start_time);
                return dt.getMonth() === now.getMonth() && dt.getFullYear() === now.getFullYear();
              }
              return true;
            });

            const wBorrowings = d.borrowings.filter(b => b.labour_id === statementWorker.id);
            const wPayrolls = d.payroll.filter(p => p.labour_id === statementWorker.id);
            const totalEarned = wAllocs.reduce((s, a) => s + (a.completed_qty * (a.labour_rate || 0)), 0);
            const totalPaid = wAllocs.reduce((s, a) => s + a.paid_earnings, 0);
            const totalBorrowed = wBorrowings.reduce((s, b) => s + b.amount, 0);
            const totalDeducted = wBorrowings.reduce((s, b) => s + b.deducted_amount, 0);
            const outstandingDebt = Math.max(0, totalBorrowed - totalDeducted);
            const unpaidEarnings = Math.max(0, totalEarned - totalPaid);
            const netPayable = Math.max(0, unpaidEarnings - (statementRange === 'All' ? outstandingDebt : 0));

            return (
              <div className="space-y-4">
                <div className="p-4 bg-secondary/50 rounded-xl border border-border flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <h3 className="font-semibold text-foreground text-base">{statementWorker.labour_name}</h3>
                    <p className="text-xs text-muted-foreground">{statementWorker.phone || 'No phone'} · {statementWorker.unit_assignment || 'General Line'}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-xs text-muted-foreground block">{statementRange === 'All' ? 'Net Due (All Time)' : `Pay Due (${statementRange})`}</span>
                    <strong className="text-base font-semibold text-foreground">{money(netPayable)}</strong>
                  </div>
                </div>

                {/* Statement Date Range Filter */}
                <div className="flex items-center justify-between gap-2 flex-wrap pb-1">
                  <span className="text-xs font-semibold text-foreground">Statement Period:</span>
                  <div className="flex items-center gap-1 bg-card border border-border p-0.5 rounded-lg text-xs h-7 shadow-xs">
                    {(['All', 'Today', 'Yesterday', 'Week', 'Month'] as const).map(r => (
                      <button
                        key={r}
                        type="button"
                        className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${statementRange === r ? 'bg-primary text-primary-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'}`}
                        onClick={() => setStatementRange(r)}
                      >
                        {r === 'All' ? 'All Time' : r === 'Week' ? 'This Week' : r === 'Month' ? 'This Month' : r}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <div className="p-2.5 bg-card border border-border rounded-lg">
                    <span className="text-muted-foreground block text-[11px]">{statementRange === 'All' ? 'Gross Earned' : `Earned (${statementRange})`}</span>
                    <strong className="text-foreground">{money(totalEarned)}</strong>
                  </div>
                  <div className="p-2.5 bg-card border border-border rounded-lg">
                    <span className="text-muted-foreground block text-[11px]">Unpaid Gross</span>
                    <strong className="text-foreground">{money(unpaidEarnings)}</strong>
                  </div>
                  <div className="p-2.5 bg-card border border-border rounded-lg">
                    <span className="text-muted-foreground block text-[11px]">Total Borrowed</span>
                    <strong className="text-foreground">{money(totalBorrowed)}</strong>
                  </div>
                  <div className="p-2.5 bg-card border border-border rounded-lg">
                    <span className="text-muted-foreground block text-[11px]">Outstanding Debt</span>
                    <strong className="text-amber-500">{money(outstandingDebt)}</strong>
                  </div>
                </div>

                <div>
                  <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider mb-2">Recent Allocations</h4>
                  <div className="max-h-40 overflow-y-auto border border-border rounded-lg text-xs">
                    {wAllocs.length ? (
                      <table className="w-full">
                        <thead className="bg-secondary/40 text-muted-foreground">
                          <tr>
                            <th className="p-2 text-left">Product Type</th>
                            <th className="p-2 text-right">Assigned</th>
                            <th className="p-2 text-right">Done</th>
                            <th className="p-2 text-right">Rate</th>
                            <th className="p-2 text-right">Earned</th>
                          </tr>
                        </thead>
                        <tbody>
                          {wAllocs.map(a => (
                            <tr key={a.id} className="border-t border-border">
                              <td className="p-2">{d.items.find(i=>i.id===a.order_item_id)?.box_type || '—'}</td>
                              <td className="p-2 text-right">{a.allocated_qty}</td>
                              <td className="p-2 text-right font-medium">{a.completed_qty}</td>
                              <td className="p-2 text-right">{money(a.labour_rate)}</td>
                              <td className="p-2 text-right font-medium">{money(a.completed_qty * a.labour_rate)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : (
                      <div className="p-3 text-center text-muted-foreground">No allocations recorded.</div>
                    )}
                  </div>
                </div>

                <div>
                  <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider mb-2">Borrowings & Advances</h4>
                  <div className="max-h-32 overflow-y-auto border border-border rounded-lg text-xs">
                    {wBorrowings.length ? (
                      <table className="w-full">
                        <thead className="bg-secondary/40 text-muted-foreground">
                          <tr>
                            <th className="p-2 text-left">Date</th>
                            <th className="p-2 text-left">Remarks</th>
                            <th className="p-2 text-right">Amount</th>
                            <th className="p-2 text-right">Deducted</th>
                          </tr>
                        </thead>
                        <tbody>
                          {wBorrowings.map(b => (
                            <tr key={b.id} className="border-t border-border">
                              <td className="p-2">{b.borrow_date}</td>
                              <td className="p-2 text-muted-foreground">{b.remarks || '—'}</td>
                              <td className="p-2 text-right">{money(b.amount)}</td>
                              <td className="p-2 text-right text-emerald-500">{money(b.deducted_amount)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : (
                      <div className="p-3 text-center text-muted-foreground">No borrowings logged.</div>
                    )}
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <Button variant="outline" size="sm" onClick={()=>setStatementWorker(null)}>Close Statement</Button>
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Record Payment Dialog */}
      <Dialog open={!!paymentModalPayroll} onOpenChange={(open)=>{ if(!open){ setPaymentModalPayroll(null); clearModalSearchParams(); } }}>
        <DialogContent className="modal-wide" aria-describedby={undefined}>
          <DialogTitle className="text-xl font-medium">Record Payroll Payment</DialogTitle>
          <div className="form-subtitle">
            Disburse payment against pending or partially paid labour payroll.
          </div>
          {paymentModalPayroll && (() => {
            const paid = Number(paymentModalPayroll.amount_paid ?? 0);
            const balance = Math.max(0, paymentModalPayroll.net_paid - paid);
            const worker = d.workers.find(w => w.id === paymentModalPayroll.labour_id);
            return (
              <form onSubmit={recordPayment}>
                <div className="p-3 bg-card border border-border rounded-xl mb-4 text-xs grid grid-cols-3 gap-2">
                  <div>
                    <span className="text-muted-foreground block">Worker</span>
                    <strong className="text-foreground text-sm">{worker?.labour_name ?? '—'}</strong>
                  </div>
                  <div>
                    <span className="text-muted-foreground block">Net Payable</span>
                    <strong className="text-foreground text-sm">{money(paymentModalPayroll.net_paid)}</strong>
                  </div>
                  <div>
                    <span className="text-muted-foreground block">Balance Due</span>
                    <strong className="text-amber-500 text-sm">{money(balance)}</strong>
                  </div>
                </div>
                <div className="form-grid">
                  <label>
                    Amount to Pay (₹)
                    <input
                      type="number"
                      min={0.01}
                      max={balance}
                      step=".01"
                      name="amount"
                      defaultValue={balance}
                      required
                    />
                  </label>
                  <label>
                    Payment Mode
                    <ThemedSelect
                      name="payment_mode"
                      defaultValue="Cash"
                      options={['Cash','UPI','Bank Transfer','Cheque','Other'].map(m=>({value:m, label:m}))}
                    />
                  </label>
                  <label>
                    Disbursement Date
                    <ThemedDatePicker
                      name="disbursed_at"
                      defaultValue={today()}
                      required
                    />
                  </label>
                  <label>
                    Reference / Notes
                    <input
                      name="reference_notes"
                      placeholder="e.g. UPI Ref / Cash Voucher #"
                    />
                  </label>
                </div>
                <div className="form-actions">
                  <Button variant="outline" type="button" onClick={() => setPaymentModalPayroll(null)}>Cancel</Button>
                  <Button disabled={busy} type="submit">{busy ? 'Recording…' : 'Confirm Payment'}</Button>
                </div>
              </form>
            );
          })()}
        </DialogContent>
      </Dialog>
    </>
  );
}
