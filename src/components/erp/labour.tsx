import {VolumeCharts} from './volume-charts';
import {useState} from 'react';
import {Button} from '@/components/ui/button';
import {Dialog,DialogContent,DialogTitle} from '@/components/ui/dialog';
import {MasterPage} from './masters';
import {useFactory} from './provider';
import {Empty,Pill} from './common';
import {money,number,dateLabel,type Row} from '@/lib/erp-data';
export function Labour(){
  const {data:d,action}=useFactory();
  const [selected,setSelected]=useState<Row<'production_allocations'>|null>(null);
  const [busy,setBusy]=useState(false);

  async function complete(e:React.FormEvent<HTMLFormElement>){
    e.preventDefault();
    if(!selected)return;
    setBusy(true);
    const qty=Number(new FormData(e.currentTarget).get('completed_qty'));
    if(await action('complete',{id:selected.id,completed_qty:qty}))setSelected(null);
    setBusy(false);
  }

  return (
    <>
      <MasterPage kind="workers"/>
      <section className="mt-8">
        <div className="section-header">
          <h2>Production Allocations</h2>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Worker</th>
                <th>Box Type</th>
                <th className="numeric">Assigned</th>
                <th className="numeric">Completed</th>
                <th className="numeric">Pending</th>
                <th>Completion</th>
                <th>Tentative Completion</th>
                <th>Status</th>
                <th className="text-right"/>
              </tr>
            </thead>
            <tbody>
              {d.allocations.length ? d.allocations.map(a=>(
                <tr key={a.id}>
                  <td className="font-medium text-foreground">{d.workers.find(w=>w.id===a.labour_id)?.labour_name}</td>
                  <td>{d.items.find(i=>i.id===a.order_item_id)?.box_type}</td>
                  <td className="numeric font-medium">{number(a.allocated_qty)}</td>
                  <td className="numeric text-muted-foreground">{number(a.completed_qty)}</td>
                  <td className="numeric font-medium text-foreground">{number(a.allocated_qty-a.completed_qty)}</td>
                  <td>{Math.round(a.completed_qty/a.allocated_qty*100)}%</td>
                  <td>{new Date(a.tentative_completion).toLocaleString('en-GB',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}</td>
                  <td><Pill value={a.status}/></td>
                  <td className="text-right">
                    {a.completed_qty<a.allocated_qty&& (
                      <Button size="sm" variant="outline" onClick={()=>setSelected(a)}>Record Completion</Button>
                    )}
                  </td>
                </tr>
              )) : (
                <Empty columns={9} label="No production allocations"/>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-8">
        <div className="section-header">
          <h2>Payroll & Worker Ledger</h2>
        </div>
        <div className="table-wrap">
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
              {d.workers.length ? d.workers.map(w=>{
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
                      <Button size="sm" variant="outline" disabled={!earnings} onClick={()=>{
                        if(window.confirm('Pay outstanding earnings after deducting advances?')) action('payroll',{labour_id:w.id});
                      }}>
                        Pay Payroll
                      </Button>
                    </td>
                  </tr>
                );
              }) : (
                <Empty columns={6}/>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-8">
        <div className="section-header">
          <h2>Payroll History</h2>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Worker</th>
                <th>Date</th>
                <th className="numeric">Gross</th>
                <th className="numeric">Deductions</th>
                <th className="numeric">Net Paid</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {d.payroll.length ? d.payroll.map(p=>(
                <tr key={p.id}>
                  <td className="font-medium text-foreground">{d.workers.find(w=>w.id===p.labour_id)?.labour_name}</td>
                  <td>{p.payout_date?dateLabel(p.payout_date):'—'}</td>
                  <td className="numeric">{money(p.gross)}</td>
                  <td className="numeric text-muted-foreground">{money(p.deductions)}</td>
                  <td className="numeric font-medium text-foreground">{money(p.net_paid)}</td>
                  <td><Pill value={p.status ?? 'Paid'}/></td>
                </tr>
              )) : (
                <Empty columns={6}/>
              )}
            </tbody>
          </table>
        </div>
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
    </>
  );
}
