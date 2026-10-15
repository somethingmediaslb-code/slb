import {VolumeCharts} from './volume-charts';
import {useState} from 'react';
import {Button} from '@/components/ui/button';
import {Dialog,DialogContent,DialogTitle} from '@/components/ui/dialog';
import {MasterPage} from './masters';
import {useFactory} from './provider';
import {Empty,Pill,Pagination,DateFilterPill,FilterToken,ExportButton,ThemedSelect,ThemedDatePicker} from './common';
import {money,number,dateLabel,downloadCsv,type Row} from '@/lib/erp-data';
export function Labour(){
  const {data:d,action,isAdmin}=useFactory();
  const [selected,setSelected]=useState<Row<'production_allocations'>|null>(null);
  const [statementWorker,setStatementWorker]=useState<Row<'labour_master'>|null>(null);
  const [borrowModalOpen,setBorrowModalOpen]=useState(false);
  const [borrowLabourId,setBorrowLabourId]=useState('');
  const [prodRange,setProdRange]=useState<'All'|'Day'|'Week'|'Month'|'Custom'>('All');
  const [prodCustomFrom,setProdCustomFrom]=useState('');
  const [prodCustomTo,setProdCustomTo]=useState('');
  const [busy,setBusy]=useState(false);

  const [allocPage, setAllocPage] = useState(1);
  const [payrollPage, setPayrollPage] = useState(1);
  const [historyPage, setHistoryPage] = useState(1);
  const pageSize = 10;

  // Payroll date-wise report and status filter
  const [payrollFrom, setPayrollFrom] = useState('');
  const [payrollTo, setPayrollTo] = useState('');
  const [payrollStatus, setPayrollStatus] = useState('All');
  const [payrollWorkerId, setPayrollWorkerId] = useState('All');

  // Filter allocations based on productivity range
  const now = new Date();
  const filteredAllocations = d.allocations.filter(a => {
    if (prodRange === 'All') return true;
    const date = new Date(a.start_time);
    if (prodRange === 'Day') return date.toDateString() === now.toDateString();
    if (prodRange === 'Week') return (now.getTime() - date.getTime()) <= 7 * 86400000;
    if (prodRange === 'Month') return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
    if (prodRange === 'Custom') {
      const dStr = a.start_time.slice(0, 10);
      if (prodCustomFrom && dStr < prodCustomFrom) return false;
      if (prodCustomTo && dStr > prodCustomTo) return false;
      return true;
    }
    return true;
  });

  const totalAssigned = filteredAllocations.reduce((s, a) => s + a.allocated_qty, 0);
  const totalCompleted = filteredAllocations.reduce((s, a) => s + a.completed_qty, 0);
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

  const paginatedAllocations = filteredAllocations.slice((allocPage - 1) * pageSize, allocPage * pageSize);
  const paginatedWorkers = d.workers.slice((payrollPage - 1) * pageSize, payrollPage * pageSize);
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

  return (
    <>
      <MasterPage kind="workers" title="Labour Management"/>
      <section className="mt-8">
        <div className="section-header flex items-center justify-between gap-4">
          <h2>Production Allocations & Productivity Tracking</h2>
          <div className="flex items-center gap-1.5 flex-wrap">
            <div className="flex items-center gap-1 bg-secondary/60 p-0.5 rounded-full text-xs">
              {(['All', 'Day', 'Week', 'Month', 'Custom'] as const).map(r => (
                <button
                  key={r}
                  type="button"
                  className={`px-3 py-1 rounded-full font-medium transition-colors ${prodRange === r ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                  onClick={() => { setProdRange(r); setAllocPage(1); }}
                >
                  {r === 'All' ? 'All Time' : r === 'Custom' ? 'Custom Range' : `This ${r}`}
                </button>
              ))}
            </div>

            {prodRange === 'Custom' && (
              <div className="flex items-center gap-2">
                <DateFilterPill label="From" value={prodCustomFrom} onChange={v=>{ setProdCustomFrom(v); setAllocPage(1); }} placeholder="From" />
                <DateFilterPill label="To" value={prodCustomTo} onChange={v=>{ setProdCustomTo(v); setAllocPage(1); }} placeholder="To" />
              </div>
            )}
          </div>
        </div>

        {/* Productivity Summary Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 my-4">
          <div className="p-3 bg-card border border-border rounded-xl">
            <span className="text-xs text-muted-foreground block">Assigned Qty</span>
            <strong className="text-base font-semibold text-foreground">{number(totalAssigned)} boxes</strong>
          </div>
          <div className="p-3 bg-card border border-border rounded-xl">
            <span className="text-xs text-muted-foreground block">Completed Qty</span>
            <strong className="text-base font-semibold text-emerald-500">{number(totalCompleted)} boxes</strong>
          </div>
          <div className="p-3 bg-card border border-border rounded-xl">
            <span className="text-xs text-muted-foreground block">Pending Qty</span>
            <strong className="text-base font-semibold text-amber-500">{number(totalPending)} boxes</strong>
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
                <th>Box Type & Size</th>
                <th className="numeric">Assigned</th>
                <th className="numeric">Produced</th>
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
                <Empty columns={11} label="No production allocations found"/>
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Card View */}
        <div className="mobile-card-view">
          {paginatedAllocations.length ? paginatedAllocations.map(a => {
            const workerName = d.workers.find(w=>w.id===a.labour_id)?.labour_name || 'Worker';
            const boxType = d.items.find(i=>i.id===a.order_item_id)?.box_type || '—';
            const pending = a.allocated_qty - a.completed_qty;
            const pct = Math.round((a.completed_qty / (a.allocated_qty || 1)) * 100);
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
        <div className="section-header flex items-center justify-between">
          <h2>Payroll & Worker Ledger</h2>
          <Button size="sm" variant="outline" onClick={()=>{ setBorrowLabourId(d.workers[0]?.id??''); setBorrowModalOpen(true); }}>
            Record Borrowing
          </Button>
        </div>

        {/* Desktop Table View */}
        <div className="desktop-table-view table-wrap">
          <table>
            <thead>
              <tr>
                <th>Worker</th>
                <th className="numeric">Produced</th>
                <th className="numeric">Gross Unpaid</th>
                <th className="numeric">Outstanding Advances</th>
                <th className="numeric">Net Payable</th>
                <th className="text-right"/>
              </tr>
            </thead>
            <tbody>
              {paginatedWorkers.length ? paginatedWorkers.map(w=>{
                const a=d.allocations.filter(a=>a.labour_id===w.id);
                const earnings=a.reduce((s,a)=>s+a.completed_qty*a.labour_rate-a.paid_earnings,0);
                const debt=d.borrowings.filter(b=>b.labour_id===w.id).reduce((s,b)=>s+b.amount-b.deducted_amount,0);
                return (
                  <tr key={w.id}>
                    <td className="font-medium text-foreground">{w.labour_name}</td>
                    <td className="numeric">{number(a.reduce((s,a)=>s+a.completed_qty,0))}</td>
                    <td className="numeric font-medium">{money(earnings)}</td>
                    <td className="numeric text-muted-foreground">{money(debt)}</td>
                    <td className="numeric font-semibold text-foreground">{money(Math.max(0,earnings-debt))}</td>
                    <td className="text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button size="sm" variant="ghost" onClick={()=>setStatementWorker(w)}>
                          Statement
                        </Button>
                        <Button size="sm" variant="outline" disabled={!earnings} onClick={()=>{
                          if(window.confirm('Pay outstanding earnings after deducting advances?')) action('payroll',{labour_id:w.id});
                        }}>
                          Pay Payroll
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              }) : (
                <Empty columns={6}/>
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Card View */}
        <div className="mobile-card-view">
          {paginatedWorkers.length ? paginatedWorkers.map(w => {
            const a=d.allocations.filter(a=>a.labour_id===w.id);
            const earnings=a.reduce((s,a)=>s+a.completed_qty*a.labour_rate-a.paid_earnings,0);
            const debt=d.borrowings.filter(b=>b.labour_id===w.id).reduce((s,b)=>s+b.amount-b.deducted_amount,0);
            const netPayable = Math.max(0, earnings - debt);
            return (
              <div key={w.id} className="mobile-record-card">
                <div className="mobile-card-top">
                  <div className="mobile-card-title">{w.labour_name}</div>
                  <span className="font-semibold text-foreground">{money(netPayable)}</span>
                </div>

                <div className="mobile-card-grid">
                  <div className="mobile-card-field">
                    <span className="mobile-card-label">Total Produced</span>
                    <span className="mobile-card-value">{number(a.reduce((s,a)=>s+a.completed_qty,0))} boxes</span>
                  </div>
                  <div className="mobile-card-field">
                    <span className="mobile-card-label">Gross Unpaid</span>
                    <span className="mobile-card-value">{money(earnings)}</span>
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
                      if(window.confirm('Pay outstanding earnings after deducting advances?')) action('payroll',{labour_id:w.id});
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

      <Dialog open={!!selected} onOpenChange={()=>setSelected(null)}>
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
      <Dialog open={borrowModalOpen} onOpenChange={setBorrowModalOpen}>
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
                <ThemedDatePicker name="borrow_date" defaultValue={new Date().toISOString().slice(0, 10)} required />
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
      <Dialog open={!!statementWorker} onOpenChange={()=>setStatementWorker(null)}>
        <DialogContent className="modal-wide max-w-2xl" aria-describedby={undefined}>
          <DialogTitle className="text-xl font-medium">Individual Labour Statement</DialogTitle>
          {statementWorker && (() => {
            const wAllocs = d.allocations.filter(a => a.labour_id === statementWorker.id);
            const wBorrowings = d.borrowings.filter(b => b.labour_id === statementWorker.id);
            const wPayrolls = d.payroll.filter(p => p.labour_id === statementWorker.id);
            const totalEarned = wAllocs.reduce((s, a) => s + (a.completed_qty * a.labour_rate), 0);
            const totalPaid = wAllocs.reduce((s, a) => s + a.paid_earnings, 0);
            const totalBorrowed = wBorrowings.reduce((s, b) => s + b.amount, 0);
            const totalDeducted = wBorrowings.reduce((s, b) => s + b.deducted_amount, 0);
            const outstandingDebt = Math.max(0, totalBorrowed - totalDeducted);
            const unpaidEarnings = Math.max(0, totalEarned - totalPaid);
            const netPayable = Math.max(0, unpaidEarnings - outstandingDebt);

            return (
              <div className="space-y-4">
                <div className="p-4 bg-secondary/50 rounded-xl border border-border flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-foreground text-base">{statementWorker.labour_name}</h3>
                    <p className="text-xs text-muted-foreground">{statementWorker.phone || 'No phone'} · {statementWorker.unit_assignment || 'General Line'}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-xs text-muted-foreground block">Net Due</span>
                    <strong className="text-base font-semibold text-foreground">{money(netPayable)}</strong>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <div className="p-2.5 bg-card border border-border rounded-lg">
                    <span className="text-muted-foreground block text-[11px]">Gross Earned</span>
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
                            <th className="p-2 text-left">Box Type</th>
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
      <Dialog open={!!paymentModalPayroll} onOpenChange={() => setPaymentModalPayroll(null)}>
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
                      defaultValue={new Date().toISOString().slice(0, 10)}
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
