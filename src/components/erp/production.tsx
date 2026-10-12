import {useState} from 'react';
import {UserPlus,Clock,Hammer,Calendar} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {Dialog,DialogContent,DialogTitle} from '@/components/ui/dialog';
import {useFactory} from './provider';
import {Heading,Empty,AccessNotice,SearchFilter,ExportButton,Pill,ViewTabs,FilterToken,TableCalcBar,MiniProgress,SegmentedMeter,MiniSparkline} from './common';
import {number,money,downloadCsv,type Row} from '@/lib/erp-data';

export function Production(){
  const {data:d,action}=useFactory();
  const [search,setSearch]=useState('');
  const [priorityTab,setPriorityTab]=useState('All');
  const [party,setParty]=useState('All');
  const [startDate,setStartDate]=useState('');
  const [endDate,setEndDate]=useState('');
  const [selected,setSelected]=useState<Row<'order_items'>|null>(null);
  const [qty,setQty]=useState(1);
  const [rate,setRate]=useState(0);
  const [hours,setHours]=useState(1);
  const [start,setStart]=useState(new Date().toISOString().slice(0,16));
  const [busy,setBusy]=useState(false);

  // Compute pending items (where ordered > allocated)
  const pendingItems=d.items.filter(i=>i.ordered_qty>i.allocated_qty);
  const redCount=pendingItems.filter(i=>i.priority_signal==='Red').length;
  const yellowCount=pendingItems.filter(i=>i.priority_signal==='Yellow').length;
  const greenCount=pendingItems.filter(i=>i.priority_signal==='Green').length;

  const tabs=[
    {id:'All',label:'All Queue',count:pendingItems.length},
    {id:'Red',label:'High Priority',count:redCount},
    {id:'Yellow',label:'Medium Priority',count:yellowCount},
    {id:'Green',label:'Standard',count:greenCount},
  ];

  const filtered=pendingItems.filter(i=>{
    const o=d.orders.find(o=>o.id===i.order_id);
    const matchesPriority=priorityTab==='All'||i.priority_signal===priorityTab;
    const matchesParty=party==='All'||(o?.is_self_stock&&party==='self')||o?.party_id===party;
    const matchesStart=!startDate||(o?.order_date??'')>=startDate;
    const matchesEnd=!endDate||(o?.order_date??'')<=endDate;
    const matchesSearch=(i.box_type+' '+i.size_dimensions+' '+(o?.order_no??'')).toLowerCase().includes(search.toLowerCase());
    return matchesPriority&&matchesParty&&matchesStart&&matchesEnd&&matchesSearch;
  });

  const totalUnallocated=filtered.reduce((sum,i)=>sum+(i.ordered_qty-i.allocated_qty),0);
  const totalOrdered=filtered.reduce((sum,i)=>sum+i.ordered_qty,0);

  async function submit(e:React.FormEvent<HTMLFormElement>){
    e.preventDefault();
    if(!selected)return;
    setBusy(true);
    const f=new FormData(e.currentTarget);
    const ok=await action('allocate',{
      order_item_id:selected.id,
      labour_id:String(f.get('labour_id')),
      allocated_qty:qty,
      labour_rate:rate,
      duration_hours:hours,
      start_time:new Date(start).toISOString()
    });
    setBusy(false);
    if(ok)setSelected(null);
  }

  const selectedOrder=selected?d.orders.find(o=>o.id===selected.order_id):null;

  return (
    <>
      <Heading title="Production Queue">
        <ExportButton onClick={()=>downloadCsv('pending-production',filtered)}/>
      </Heading>

      <AccessNotice/>

      {/* Priority View Tabs */}
      <ViewTabs tabs={tabs} active={priorityTab} onChange={setPriorityTab}/>

      {/* Filter Toolbar */}
      <div className="filters">
        <SearchFilter value={search} onChange={setSearch} placeholder="Search box type, size or order #…"/>

        <FilterToken
          label="Client"
          value={party}
          onChange={setParty}
          options={[
            {value:'All',label:'All clients'},
            {value:'self',label:'Self Stocking'},
            ...d.parties.map(p=>({value:p.id,label:p.company_name}))
          ]}
        />

        <div className="segmented-filter-pill">
          <span className="filter-pill-label">From</span>
          <span className="filter-pill-divider" aria-hidden="true" />
          <div className="filter-pill-select-wrapper">
            <input
              aria-label="From date"
              type="date"
              className="!border-0 !min-h-0 !p-0 !bg-transparent text-xs font-medium text-foreground outline-none cursor-pointer"
              value={startDate}
              onChange={e=>setStartDate(e.target.value)}
            />
          </div>
        </div>

        <div className="segmented-filter-pill">
          <span className="filter-pill-label">To</span>
          <span className="filter-pill-divider" aria-hidden="true" />
          <div className="filter-pill-select-wrapper">
            <input
              aria-label="To date"
              type="date"
              className="!border-0 !min-h-0 !p-0 !bg-transparent text-xs font-medium text-foreground outline-none cursor-pointer"
              value={endDate}
              onChange={e=>setEndDate(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th className="w-8">
                <input type="checkbox" className="w-3.5 h-3.5 rounded border-border" aria-label="Select all" readOnly />
              </th>
              <th>Order ID</th>
              <th>Customer / Account</th>
              <th>Box Type & Dimensions</th>
              <th className="numeric">Ordered</th>
              <th className="numeric">Allocated</th>
              <th className="numeric">Pending</th>
              <th>Allocation Ratio</th>
              <th>Run Trend</th>
              <th>Priority</th>
              <th className="text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length ? filtered.map(i=>{
              const o=d.orders.find(o=>o.id===i.order_id);
              const remaining=i.ordered_qty-i.allocated_qty;
              const partyName=o?.is_self_stock ? 'Self Stocking' : d.parties.find(p=>p.id===o?.party_id)?.company_name ?? '—';
              const monogram=o?.is_self_stock ? 'SS' : partyName.slice(0,2).toUpperCase();
              return (
                <tr key={i.id} className="clickable-row" onClick={()=>{
                  setSelected(i);
                  setQty(remaining);
                }}>
                  <td onClick={e=>e.stopPropagation()}>
                    <input type="checkbox" className="w-3.5 h-3.5 rounded border-border" aria-label={`Select ${i.box_type}`} />
                  </td>
                  <td className="font-medium text-foreground">{o?.order_no || '—'}</td>
                  <td>
                    <div className="flex items-center gap-2.5">
                      <span className="avatar !w-6 !h-6 !text-[10px] font-semibold">
                        {monogram}
                      </span>
                      <span className="font-medium text-foreground">{partyName}</span>
                    </div>
                  </td>
                  <td>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{i.box_type}</span>
                      <span className="text-xs text-muted-foreground">({i.size_dimensions})</span>
                    </div>
                  </td>
                  <td className="numeric font-medium">{number(i.ordered_qty)}</td>
                  <td className="numeric text-muted-foreground">{number(i.allocated_qty)}</td>
                  <td className="numeric font-medium text-foreground">{number(remaining)}</td>
                  <td>
                    <SegmentedMeter value={i.allocated_qty} total={i.ordered_qty} />
                  </td>
                  <td>
                    <MiniSparkline />
                  </td>
                  <td><Pill value={i.priority_signal}/></td>
                  <td className="text-right" onClick={e=>e.stopPropagation()}>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={()=>{
                        setSelected(i);
                        setQty(remaining);
                      }}
                    >
                      <UserPlus className="w-3.5 h-3.5 mr-1"/> Assign Labour
                    </Button>
                  </td>
                </tr>
              );
            }) : (
              <Empty columns={11} label="No items in production queue"/>
            )}
          </tbody>
        </table>
      </div>

      {/* Calculation Bar */}
      <TableCalcBar
        count={filtered.length}
        entityName="line items"
        stats={[
          {label:'Total Required',value:`${number(totalOrdered)} boxes`},
          {label:'Remaining to Allocate',value:`${number(totalUnallocated)} boxes`},
        ]}
      />

      {/* Assign Labour Dialog */}
      <Dialog open={!!selected} onOpenChange={()=>setSelected(null)}>
        <DialogContent className="modal-wide" aria-describedby={undefined}>
          <DialogTitle className="text-xl font-medium">Assign Labour to Production</DialogTitle>
          <div className="form-subtitle">
            Allocate workers and machine time for {selected?.box_type} ({selectedOrder?.order_no}).
          </div>

          <form onSubmit={submit}>
            <div className="form-section-title">1. Allocation Target</div>
            <div className="p-3 bg-secondary/50 border border-border rounded-lg mb-4 text-xs grid grid-cols-3 gap-3">
              <div>
                <span className="text-muted-foreground block">Box Type</span>
                <strong className="text-foreground text-sm font-medium">{selected?.box_type}</strong>
              </div>
              <div>
                <span className="text-muted-foreground block">Dimensions</span>
                <strong className="text-foreground text-sm font-medium">{selected?.size_dimensions}</strong>
              </div>
              <div>
                <span className="text-muted-foreground block">Available to Allocate</span>
                <strong className="text-foreground text-sm font-medium">
                  {selected ? number(selected.ordered_qty - selected.allocated_qty) : 0} boxes
                </strong>
              </div>
            </div>

            <div className="form-section-title">2. Worker Assignment & Schedule</div>
            <div className="form-grid">
              <label className="form-wide">
                Worker / Unit Station
                <select aria-label="Worker / unit" name="labour_id" required>
                  <option value="">Select worker or production team</option>
                  {d.workers.map(w=>(
                    <option key={w.id} value={w.id}>
                      {w.labour_name}{w.unit_assignment ? ` · ${w.unit_assignment}` : ''}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Quantity to Assign
                <input
                  type="number"
                  min={1}
                  max={selected ? selected.ordered_qty - selected.allocated_qty : 1}
                  required
                  value={qty}
                  onChange={e=>setQty(Number(e.target.value))}
                />
              </label>

              <label>
                Labour Rate Per Box (₹)
                <input
                  type="number"
                  min={0}
                  step=".01"
                  required
                  value={rate}
                  onChange={e=>setRate(Number(e.target.value))}
                />
              </label>

              <label>
                Scheduled Start Time
                <input
                  type="datetime-local"
                  required
                  value={start}
                  onChange={e=>setStart(e.target.value)}
                />
              </label>

              <label>
                Estimated Duration
                <select value={hours} onChange={e=>setHours(Number(e.target.value))}>
                  {Array.from({length:10},(_,i)=>(
                    <option key={i} value={i+1}>
                      {i+1} hour{i>0?'s':''}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {/* Live Calculation Banner */}
            <div className="form-calc-banner">
              <div>
                <span className="text-muted-foreground block text-xs">Estimated Completion</span>
                <strong className="text-foreground font-medium text-xs">
                  {new Date(new Date(start).getTime() + hours*3600000).toLocaleString()}
                </strong>
              </div>
              <div className="text-right">
                <span className="text-muted-foreground block text-xs">Estimated Labour Expense</span>
                <strong className="text-foreground font-semibold text-base">{money(qty*rate)}</strong>
              </div>
            </div>

            <div className="form-actions">
              <Button variant="outline" type="button" onClick={()=>setSelected(null)}>Cancel</Button>
              <Button type="submit" disabled={busy}>{busy?'Assigning…':'Confirm Allocation'}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
