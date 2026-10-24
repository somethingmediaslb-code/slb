import {VolumeCharts} from './volume-charts';
import {useState, useEffect} from 'react';
import {useNavigate, useSearch} from '@tanstack/react-router';
import {Button} from '@/components/ui/button';
import {Dialog,DialogContent,DialogTitle} from '@/components/ui/dialog';
import {useFactory} from './provider';
import {Heading,AccessNotice,Empty,SearchFilter,ExportButton,AddButton,Pagination,DateFilterPill,FilterToken,ThemedSelect,ThemedDatePicker,clearModalSearchParams} from './common';
import {supabase} from '@/integrations/supabase/client';
import {money,finance,dateLabel,today,downloadCsv,formatLocalDate} from '@/lib/erp-data';
import {toast} from 'sonner';
export function Expenses(){
  const {data:d,user,signIn,refresh,action}=useFactory();
  const navigate=useNavigate();
  const searchParams=useSearch({strict:false}) as {new?:boolean};
  const [tab,setTab]=useState('Expenses');
  const [open,setOpen]=useState(false);
  const [search,setSearch]=useState('');
  const [category,setCategory]=useState('All categories');
  const [from,setFrom]=useState('');
  const [to,setTo]=useState('');
  const [rangePreset,setRangePreset]=useState<'All'|'Day'|'Week'|'Month'|'Custom'>('All');
  const [reportCompany,setReportCompany]=useState('All');
  const [busy,setBusy]=useState(false);
  const [page,setPage]=useState(1);
  const pageSize=10;

  useEffect(()=>{
    if(searchParams.new&&user){
      setOpen(true);
      clearModalSearchParams(navigate);
    }
  },[searchParams.new,user]);

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (!isOpen) {
      clearModalSearchParams(navigate);
    }
  };

  const company=(orderId:string)=>{
    const o=d.orders.find(o=>o.id===orderId);
    return o?.is_self_stock?'Self Stocking':d.parties.find(p=>p.id===o?.party_id)?.company_name??'—';
  };

  const setPreset=(preset:'All'|'Day'|'Week'|'Month')=>{
    setRangePreset(preset);
    const now=new Date();
    if(preset==='All'){
      setFrom('');
      setTo('');
    }else if(preset==='Day'){
      const todayStr=formatLocalDate(now);
      setFrom(todayStr);
      setTo(todayStr);
    }else if(preset==='Week'){
      const weekAgo=formatLocalDate(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7));
      setFrom(weekAgo);
      setTo(formatLocalDate(now));
    }else if(preset==='Month'){
      const firstOfMonth=formatLocalDate(new Date(now.getFullYear(), now.getMonth(), 1));
      setFrom(firstOfMonth);
      setTo(formatLocalDate(now));
    }
  };

  const categories=['Transportation','Raw Material','Utilities','Maintenance','Labour-related','Other'];
  const rows=d.expenses.filter(e=>(category==='All categories'||e.category===category)&&(!from||e.expense_date>=from)&&(!to||e.expense_date<=to)&&(e.category+' '+e.notes).toLowerCase().includes(search.toLowerCase()));
  const borrowingsFiltered = d.borrowings.filter(b => {
    const matchesDate = (!from || b.borrow_date >= from) && (!to || b.borrow_date <= to);
    const workerName = d.workers.find(w => w.id === b.labour_id)?.labour_name || '';
    const matchesSearch = (workerName + ' ' + (b.remarks || '')).toLowerCase().includes(search.toLowerCase());
    return matchesDate && matchesSearch;
  });
  const report=finance(d).filter(r=>{
    const matchesDate = (!from||r.dispatch_date.slice(0,10)>=from)&&(!to||r.dispatch_date.slice(0,10)<=to);
    const partyName = company(r.order_id);
    const matchesCompany = reportCompany === 'All' || partyName === reportCompany;
    const matchesSearch = (r.challan_number + ' ' + partyName).toLowerCase().includes(search.toLowerCase());
    return matchesDate && matchesCompany && matchesSearch;
  });

  useEffect(()=>{
    setPage(1);
  },[tab,search,category,from,to,reportCompany]);

  const paginatedRows = rows.slice((page-1)*pageSize, page*pageSize);
  const paginatedBorrowings = borrowingsFiltered.slice((page-1)*pageSize, page*pageSize);
  const paginatedReport = report.slice((page-1)*pageSize, page*pageSize);

  async function submit(e:React.FormEvent<HTMLFormElement>){
    e.preventDefault();
    setBusy(true);
    const f=new FormData(e.currentTarget);
    if(tab==='Borrowings'){
      const ok=await action('borrow',{labour_id:String(f.get('labour_id')),borrow_date:String(f.get('date')),amount:Number(f.get('amount')),remarks:String(f.get('notes'))});
      setBusy(false);
      if(ok)setOpen(false);
      return;
    }
    const {error}=await supabase.from('expenses').insert({expense_date:String(f.get('date')),category:String(f.get('category')),amount:Number(f.get('amount')),payment_method:String(f.get('payment_method')),notes:String(f.get('notes')),reference_dc_id:String(f.get('challan'))||null});
    setBusy(false);
    if(error){toast.error(error.message);return;}
    await refresh();
    setOpen(false);
    toast.success('Expense saved');
  }

  return (
    <>
      <Heading title="Expenses & Borrowings">
        <ExportButton onClick={()=>downloadCsv(tab,tab==='Reports'?report:tab==='Borrowings'?borrowingsFiltered:rows)}/>
        {tab!=='Reports'&&<AddButton onClick={()=>{if(!user){signIn();return;}setOpen(true);}}>{tab==='Borrowings'?'Record borrowing':'Add expense'}</AddButton>}
      </Heading>
      <AccessNotice/>
      
      <div className="crm-tabs" role="tablist">
        {[
          {id:'Expenses',label:'Expenses Ledger',count:rows.length},
          {id:'Borrowings',label:'Worker Borrowings',count:borrowingsFiltered.length},
          {id:'Reports',label:'P&L Margin Reports',count:report.length}
        ].map(t=>{
          const isSelected=tab===t.id;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={isSelected}
              className={`crm-tab ${isSelected?'active':''}`}
              onClick={()=>setTab(t.id)}
            >
              <span>{t.label}</span>
              <span className="crm-tab-count">{t.count}</span>
            </button>
          );
        })}
      </div>

      <div className="filters">
        <SearchFilter value={search} onChange={setSearch}/>
        
        {/* Day/Week/Month Preset Shortcuts */}
        <div className="flex items-center gap-1 bg-card border border-border p-0.5 rounded-lg text-xs h-8 shadow-xs">
          {(['All', 'Day', 'Week', 'Month'] as const).map(r => (
            <button
              key={r}
              type="button"
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${rangePreset === r ? 'bg-primary text-primary-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'}`}
              onClick={() => setPreset(r)}
            >
              {r === 'All' ? 'All Time' : `This ${r}`}
            </button>
          ))}
        </div>

        <DateFilterPill label="From" value={from} onChange={v => { setFrom(v); setRangePreset('Custom'); }} placeholder="All" />
        <DateFilterPill label="To" value={to} onChange={v => { setTo(v); setRangePreset('Custom'); }} placeholder="All" />
        {tab==='Expenses' && (
          <FilterToken
            label="Category"
            value={category}
            options={['All categories', ...categories]}
            onChange={setCategory}
            allValue="All categories"
          />
        )}
        {tab==='Reports' && (
          <FilterToken
            label="Customer"
            value={reportCompany}
            onChange={setReportCompany}
            options={[
              { value: 'All', label: 'All Customers' },
              ...Array.from(new Set(finance(d).map(r => company(r.order_id)))).map(name => ({ value: name, label: name }))
            ]}
          />
        )}
      </div>

      {tab==='Expenses' ? (
        <>
          <div className="desktop-table-view table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Category</th>
                  <th>Challan</th>
                  <th>Payment Method</th>
                  <th className="numeric">Amount</th>
                  <th>Remarks</th>
                </tr>
              </thead>
              <tbody>
                {paginatedRows.length ? paginatedRows.map(e=>(
                  <tr key={e.id}>
                    <td>{dateLabel(e.expense_date)}</td>
                    <td><span className="crm-tag neutral">{e.category}</span></td>
                    <td>{d.challans.find(c=>c.id===e.reference_dc_id)?.challan_number??'Shared'}</td>
                    <td>{e.payment_method}</td>
                    <td className="numeric font-medium text-foreground">{money(e.amount)}</td>
                    <td>{e.notes||'—'}</td>
                  </tr>
                )) : <Empty columns={6}/>}
              </tbody>
            </table>
          </div>

          {/* Mobile Card View */}
          <div className="mobile-card-view">
            {paginatedRows.length ? paginatedRows.map(e => (
              <div key={e.id} className="mobile-record-card">
                <div className="mobile-card-top">
                  <div className="min-w-0">
                    <div className="mobile-card-title">{dateLabel(e.expense_date)}</div>
                    <div className="mobile-card-sub">{e.payment_method}</div>
                  </div>
                  <span className="crm-tag neutral">{e.category}</span>
                </div>

                <div className="mobile-card-grid">
                  <div className="mobile-card-field">
                    <span className="mobile-card-label">Amount</span>
                    <span className="mobile-card-value font-semibold text-foreground">{money(e.amount)}</span>
                  </div>
                  <div className="mobile-card-field">
                    <span className="mobile-card-label">Challan Ref</span>
                    <span className="mobile-card-value">{d.challans.find(c=>c.id===e.reference_dc_id)?.challan_number??'Shared / General'}</span>
                  </div>
                </div>

                {e.notes && (
                  <div className="text-xs text-muted-foreground mt-1">
                    Notes: <span className="text-foreground">{e.notes}</span>
                  </div>
                )}
              </div>
            )) : (
              <Empty columns={1} label="No expenses logged" />
            )}
          </div>

          <Pagination
            currentPage={page}
            totalItems={rows.length}
            pageSize={pageSize}
            onPageChange={setPage}
          />
        </>
      ) : tab==='Borrowings' ? (
        <>
          <div className="desktop-table-view table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Worker</th>
                  <th>Date</th>
                  <th className="numeric">Borrowed</th>
                  <th className="numeric">Deducted</th>
                  <th className="numeric">Outstanding</th>
                  <th>Remarks</th>
                </tr>
              </thead>
              <tbody>
                {paginatedBorrowings.length ? paginatedBorrowings.map(b=>(
                  <tr key={b.id}>
                    <td className="font-medium text-foreground">{d.workers.find(w=>w.id===b.labour_id)?.labour_name}</td>
                    <td>{dateLabel(b.borrow_date)}</td>
                    <td className="numeric font-medium">{money(b.amount)}</td>
                    <td className="numeric text-muted-foreground">{money(b.deducted_amount)}</td>
                    <td className="numeric font-semibold text-foreground">{money(b.amount-b.deducted_amount)}</td>
                    <td>{b.remarks||'—'}</td>
                  </tr>
                )) : <Empty columns={6}/>}
              </tbody>
            </table>
          </div>

          {/* Mobile Card View */}
          <div className="mobile-card-view">
            {paginatedBorrowings.length ? paginatedBorrowings.map(b => {
              const workerName = d.workers.find(w=>w.id===b.labour_id)?.labour_name || 'Worker';
              const outstanding = b.amount - b.deducted_amount;
              return (
                <div key={b.id} className="mobile-record-card">
                  <div className="mobile-card-top">
                    <div className="min-w-0">
                      <div className="mobile-card-title">{workerName}</div>
                      <div className="mobile-card-sub">{dateLabel(b.borrow_date)}</div>
                    </div>
                    <span className="font-semibold text-foreground">{money(outstanding)}</span>
                  </div>

                  <div className="mobile-card-grid">
                    <div className="mobile-card-field">
                      <span className="mobile-card-label">Borrowed</span>
                      <span className="mobile-card-value font-medium">{money(b.amount)}</span>
                    </div>
                    <div className="mobile-card-field">
                      <span className="mobile-card-label">Deducted</span>
                      <span className="mobile-card-value text-muted-foreground">{money(b.deducted_amount)}</span>
                    </div>
                    <div className="mobile-card-field">
                      <span className="mobile-card-label">Outstanding Due</span>
                      <span className="mobile-card-value font-semibold text-foreground">{money(outstanding)}</span>
                    </div>
                    <div className="mobile-card-field">
                      <span className="mobile-card-label">Status</span>
                      <span className="mobile-card-value">{outstanding <= 0 ? 'Fully Cleared' : 'Active Balance'}</span>
                    </div>
                  </div>

                  {b.remarks && (
                    <div className="text-xs text-muted-foreground mt-1">
                      Remarks: <span className="text-foreground">{b.remarks}</span>
                    </div>
                  )}
                </div>
              );
            }) : (
              <Empty columns={1} label="No worker borrowings logged" />
            )}
          </div>

          <Pagination
            currentPage={page}
            totalItems={borrowingsFiltered.length}
            pageSize={pageSize}
            onPageChange={setPage}
          />
        </>
      ) : (
        <>
          <div className="report-summary">
            {(() => {
              const undispatchedItems = d.items.filter(i => i.ordered_qty > i.dispatched_qty);
              const undispatchedRev = undispatchedItems.reduce((s, i) => s + ((i.ordered_qty - i.dispatched_qty) * i.unit_rate), 0);
              const totalRealisedRev = report.reduce((s, r) => s + r.revenue, 0);
              const totalRealisedProf = report.reduce((s, r) => s + r.profit, 0);
              const marginRatio = totalRealisedRev > 0 ? Math.max(0.05, totalRealisedProf / totalRealisedRev) : 0.18;
              const estimatedProf = Math.round(undispatchedRev * marginRatio);

              return [
                {label:'Realised revenue',value:totalRealisedRev,sub:'Dispatched deliveries'},
                {label:'Realised profit',value:totalRealisedProf,sub:'Dispatched orders'},
                {label:'Estimated profit (undispatched orders)',value:estimatedProf,sub:'Pending order queue (estimated)'}
              ].map(m=>(
                <div className="metric" key={m.label}>
                  <div className="metric-top">{m.label}</div>
                  <div className="metric-value">{money(m.value)}</div>
                  <div className="text-[11px] text-muted-foreground mt-1">{m.sub}</div>
                </div>
              ));
            })()}
          </div>
          <div className="desktop-table-view table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Challan</th>
                  <th>Customer</th>
                  <th>Dispatch Date</th>
                  <th className="numeric">Revenue</th>
                  <th className="numeric">Labour Costs</th>
                  <th className="numeric">Transport Charge</th>
                  <th className="numeric">Allocated Expenses</th>
                  <th className="numeric">Realised Profit</th>
                  <th className="numeric">Margin</th>
                </tr>
              </thead>
              <tbody>
                {paginatedReport.length ? paginatedReport.map(r=>(
                  <tr key={r.id}>
                    <td className="font-medium text-foreground">{r.challan_number}</td>
                    <td>{company(r.order_id)}</td>
                    <td>{dateLabel(r.dispatch_date)}</td>
                    <td className="numeric">{money(r.revenue)}</td>
                    <td className="numeric text-muted-foreground">{money(r.labour)}</td>
                    <td className="numeric text-muted-foreground">{money(r.freight_charges)}</td>
                    <td className="numeric text-muted-foreground">{money(r.expenses)}</td>
                    <td className="numeric font-semibold text-foreground">{money(r.profit)}</td>
                    <td className="numeric font-medium">{r.margin.toFixed(1)}%</td>
                  </tr>
                )) : <Empty columns={9} label="No confirmed dispatches in this period"/>}
              </tbody>
            </table>
          </div>

          {/* Mobile Card View */}
          <div className="mobile-card-view">
            {paginatedReport.length ? paginatedReport.map(r => (
              <div key={r.id} className="mobile-record-card">
                <div className="mobile-card-top">
                  <div>
                    <div className="mobile-card-title">{r.challan_number}</div>
                    <div className="mobile-card-sub">{company(r.order_id)} · {dateLabel(r.dispatch_date)}</div>
                  </div>
                  <span className="font-semibold text-emerald-500">{r.margin.toFixed(1)}% margin</span>
                </div>

                <div className="mobile-card-grid">
                  <div className="mobile-card-field">
                    <span className="mobile-card-label">Revenue</span>
                    <span className="mobile-card-value font-medium">{money(r.revenue)}</span>
                  </div>
                  <div className="mobile-card-field">
                    <span className="mobile-card-label">Labour Cost</span>
                    <span className="mobile-card-value text-muted-foreground">{money(r.labour)}</span>
                  </div>
                  <div className="mobile-card-field">
                    <span className="mobile-card-label">Transport Charge</span>
                    <span className="mobile-card-value text-muted-foreground">{money(r.freight_charges)}</span>
                  </div>
                  <div className="mobile-card-field">
                    <span className="mobile-card-label">Realised Profit</span>
                    <span className="mobile-card-value font-semibold text-foreground">{money(r.profit)}</span>
                  </div>
                </div>
              </div>
            )) : (
              <Empty columns={1} label="No confirmed dispatches in this period" />
            )}
          </div>

          <Pagination
            currentPage={page}
            totalItems={report.length}
            pageSize={pageSize}
            onPageChange={setPage}
          />
        </>
      )}

      {tab==='Reports'&&<VolumeCharts dispatch/>}

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="modal-wide" aria-describedby={undefined}>
          <DialogTitle>{tab==='Borrowings'?'Record labour borrowing':'Add expense'}</DialogTitle>
          <form onSubmit={submit}>
            <div className="form-grid">
              {tab==='Borrowings' ? (
                <label className="form-wide">
                  Worker
                  <ThemedSelect
                    name="labour_id"
                    placeholder="Select worker"
                    options={d.workers.map(w=>({value:w.id, label:w.labour_name}))}
                    required
                  />
                </label>
              ) : (
                <>
                  <label>
                    Category
                    <ThemedSelect
                      name="category"
                      defaultValue="Transportation"
                      options={categories.map(c=>({value:c, label:c}))}
                    />
                  </label>
                  <label>
                    Related challan
                    <ThemedSelect
                      name="challan"
                      placeholder="Shared expense"
                      options={[
                        {value:'', label:'Shared / General Overhead'},
                        ...d.challans.filter(c => c.status !== 'Cancelled').map(c=>({
                          value: c.id,
                          label: `${c.challan_number} · Transport: ₹${c.freight_charges || 0}`
                        }))
                      ]}
                    />
                  </label>
                  <label>
                    Payment method
                    <ThemedSelect
                      name="payment_method"
                      defaultValue="Cash"
                      options={['Cash','Bank transfer','UPI'].map(m=>({value:m, label:m}))}
                    />
                  </label>
                </>
              )}
              <label>
                Date
                <ThemedDatePicker name="date" defaultValue={today()} required />
              </label>
              <label>
                Amount
                <input type="number" name="amount" min=".01" step=".01" required/>
              </label>
              <label className="form-wide">
                Remarks
                <textarea name="notes"/>
              </label>
            </div>
            <div className="form-actions">
              <Button variant="outline" type="button" onClick={()=>setOpen(false)}>Cancel</Button>
              <Button disabled={busy} type="submit">{busy?'Saving…':'Save'}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
