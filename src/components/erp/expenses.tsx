import {VolumeCharts} from './volume-charts';
import {useState} from 'react';
import {Button} from '@/components/ui/button';
import {Dialog,DialogContent,DialogTitle} from '@/components/ui/dialog';
import {useFactory} from './provider';
import {Heading,AccessNotice,Empty,SearchFilter,ExportButton,AddButton} from './common';
import {supabase} from '@/integrations/supabase/client';
import {money,finance,dateLabel,today,downloadCsv} from '@/lib/erp-data';
import {toast} from 'sonner';
export function Expenses(){
  const {data:d,user,signIn,refresh,action}=useFactory();
  const [tab,setTab]=useState('Expenses');
  const [open,setOpen]=useState(false);
  const [search,setSearch]=useState('');
  const [category,setCategory]=useState('All categories');
  const [from,setFrom]=useState('');
  const [to,setTo]=useState('');
  const [busy,setBusy]=useState(false);
  const categories=['Transportation','Raw Material','Utilities','Maintenance','Labour-related','Other'];
  const rows=d.expenses.filter(e=>(category==='All categories'||e.category===category)&&(!from||e.expense_date>=from)&&(!to||e.expense_date<=to)&&(e.category+' '+e.notes).toLowerCase().includes(search.toLowerCase()));
  const report=finance(d).filter(r=>(!from||r.dispatch_date.slice(0,10)>=from)&&(!to||r.dispatch_date.slice(0,10)<=to));

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
        <ExportButton onClick={()=>downloadCsv(tab,tab==='Reports'?report:tab==='Borrowings'?d.borrowings:rows)}/>
        {tab!=='Reports'&&<AddButton onClick={()=>{if(!user){signIn();return;}setOpen(true);}}>{tab==='Borrowings'?'Record borrowing':'Add expense'}</AddButton>}
      </Heading>
      <AccessNotice/>
      
      <div className="crm-tabs" role="tablist">
        {[
          {id:'Expenses',label:'Expenses Ledger',count:rows.length},
          {id:'Borrowings',label:'Worker Borrowings',count:d.borrowings.length},
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
        <div className="segmented-filter-pill">
          <span className="filter-pill-label">From</span>
          <span className="filter-pill-divider" aria-hidden="true" />
          <div className="filter-pill-select-wrapper">
            <input aria-label="From date" type="date" className="!border-0 !min-h-0 !p-0 !bg-transparent text-xs font-medium text-foreground outline-none cursor-pointer" value={from} onChange={e=>setFrom(e.target.value)}/>
          </div>
        </div>
        <div className="segmented-filter-pill">
          <span className="filter-pill-label">To</span>
          <span className="filter-pill-divider" aria-hidden="true" />
          <div className="filter-pill-select-wrapper">
            <input aria-label="To date" type="date" className="!border-0 !min-h-0 !p-0 !bg-transparent text-xs font-medium text-foreground outline-none cursor-pointer" value={to} onChange={e=>setTo(e.target.value)}/>
          </div>
        </div>
        {tab==='Expenses'&& (
          <div className="segmented-filter-pill">
            <span className="filter-pill-label">Category</span>
            <span className="filter-pill-divider" aria-hidden="true" />
            <div className="filter-pill-select-wrapper">
              <span className="filter-pill-value">{category}</span>
              <select aria-label="Expense category" className="filter-pill-native-select" value={category} onChange={e=>setCategory(e.target.value)}>
                {['All categories',...categories].map(v=><option key={v}>{v}</option>)}
              </select>
            </div>
          </div>
        )}
      </div>

      {tab==='Expenses' ? (
        <div className="table-wrap">
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
              {rows.length ? rows.map(e=>(
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
      ) : tab==='Borrowings' ? (
        <div className="table-wrap">
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
              {d.borrowings.length ? d.borrowings.filter(b=>(!from||b.borrow_date>=from)&&(!to||b.borrow_date<=to)).map(b=>(
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
      ) : (
        <>
          <div className="report-summary">
            {[
              {label:'Realised revenue',value:report.reduce((s,r)=>s+r.revenue,0)},
              {label:'Total costs',value:report.reduce((s,r)=>s+r.revenue-r.profit,0)},
              {label:'Realised profit',value:report.reduce((s,r)=>s+r.profit,0)}
            ].map(m=>(
              <div className="metric" key={m.label}>
                <div className="metric-top">{m.label}</div>
                <div className="metric-value">{money(m.value)}</div>
              </div>
            ))}
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Challan</th>
                  <th className="numeric">Revenue</th>
                  <th className="numeric">Labour Costs</th>
                  <th className="numeric">Freight</th>
                  <th className="numeric">Allocated Expenses</th>
                  <th className="numeric">Realised Profit</th>
                  <th className="numeric">Margin</th>
                </tr>
              </thead>
              <tbody>
                {report.length ? report.map(r=>(
                  <tr key={r.id}>
                    <td className="font-medium text-foreground">{r.challan_number}</td>
                    <td className="numeric">{money(r.revenue)}</td>
                    <td className="numeric text-muted-foreground">{money(r.labour)}</td>
                    <td className="numeric text-muted-foreground">{money(r.freight_charges)}</td>
                    <td className="numeric text-muted-foreground">{money(r.expenses)}</td>
                    <td className="numeric font-semibold text-foreground">{money(r.profit)}</td>
                    <td className="numeric font-medium">{r.margin.toFixed(1)}%</td>
                  </tr>
                )) : <Empty columns={7} label="No confirmed dispatches in this period"/>}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab==='Reports'&&<VolumeCharts dispatch/>}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="modal-wide" aria-describedby={undefined}>
          <DialogTitle>{tab==='Borrowings'?'Record labour borrowing':'Add expense'}</DialogTitle>
          <form onSubmit={submit}>
            <div className="form-grid">
              {tab==='Borrowings' ? (
                <label className="form-wide">
                  Worker
                  <select aria-label="Worker / unit" name="labour_id" required>
                    <option value="">Select worker</option>
                    {d.workers.map(w=><option key={w.id} value={w.id}>{w.labour_name}</option>)}
                  </select>
                </label>
              ) : (
                <>
                  <label>
                    Category
                    <select aria-label="Category" name="category">
                      {categories.map(c=><option key={c}>{c}</option>)}
                    </select>
                  </label>
                  <label>
                    Related challan
                    <select aria-label="Related challan" name="challan">
                      <option value="">Shared expense</option>
                      {d.challans.map(c=><option key={c.id} value={c.id}>{c.challan_number}</option>)}
                    </select>
                  </label>
                  <label>
                    Payment method
                    <select aria-label="Payment method" name="payment_method">
                      <option>Cash</option>
                      <option>Bank transfer</option>
                      <option>UPI</option>
                    </select>
                  </label>
                </>
              )}
              <label>
                Date
                <input name="date" type="date" defaultValue={today()} required/>
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
