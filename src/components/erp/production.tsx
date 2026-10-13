import {useState,useEffect} from 'react';
import {UserPlus,Clock,Hammer,Calendar} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {Checkbox} from '@/components/ui/checkbox';
import {Dialog,DialogContent,DialogTitle} from '@/components/ui/dialog';
import {useFactory} from './provider';
import {Heading,Empty,AccessNotice,SearchFilter,ExportButton,Pill,ViewTabs,FilterToken,TableCalcBar,MiniProgress,SegmentedMeter,Pagination,DateFilterPill,ThemedSelect} from './common';
import {number,money,downloadCsv,type Row} from '@/lib/erp-data';

export function Production(){
  const {data:d,action}=useFactory();
  const [search,setSearch]=useState('');
  const [priorityTab,setPriorityTab]=useState('All');
  const [party,setParty]=useState('All');
  const [boxSize,setBoxSize]=useState('All');
  const [startDate,setStartDate]=useState('');
  const [endDate,setEndDate]=useState('');
  const [page,setPage]=useState(1);
  const pageSize=10;
  const [selected,setSelected]=useState<Row<'order_items'>|null>(null);
  const [completeItem,setCompleteItem]=useState<Row<'order_items'>|null>(null);
  const [completeQty,setCompleteQty]=useState(0);
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

  const sizeOptions=Array.from(new Set(pendingItems.map(i=>i.size_dimensions).filter(Boolean)));

  const tabs=[
    {id:'All',label:'All Queue',count:pendingItems.length},
    {id:'Red',label:'Red Priority',count:redCount},
    {id:'Yellow',label:'Yellow Priority',count:yellowCount},
    {id:'Green',label:'Green Priority',count:greenCount},
  ];

  const filtered=pendingItems.filter(i=>{
    const o=d.orders.find(o=>o.id===i.order_id);
    const matchesPriority=priorityTab==='All'||i.priority_signal===priorityTab;
    const matchesParty=party==='All'||(o?.is_self_stock&&party==='self')||o?.party_id===party;
    const matchesSize=boxSize==='All'||i.size_dimensions===boxSize;
    const matchesStart=!startDate||(o?.order_date??'')>=startDate;
    const matchesEnd=!endDate||(o?.order_date??'')<=endDate;
    const matchesSearch=(i.box_type+' '+i.size_dimensions+' '+(o?.order_no??'')).toLowerCase().includes(search.toLowerCase());
    return matchesPriority&&matchesParty&&matchesSize&&matchesStart&&matchesEnd&&matchesSearch;
  });

  useEffect(()=>{
    setPage(1);
  },[search,priorityTab,party,boxSize,startDate,endDate]);

  const paginated=filtered.slice((page-1)*pageSize,page*pageSize);

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

  async function submitCompletion(e:React.FormEvent<HTMLFormElement>){
    e.preventDefault();
    if(!completeItem)return;
    const itemAllocations=d.allocations.filter(a=>a.order_item_id===completeItem.id);
    const primaryAlloc=itemAllocations[0];
    if(!primaryAlloc){
      setSelected(null);
      return;
    }
    setBusy(true);
    const ok=await action('complete',{
      id:primaryAlloc.id,
      completed_qty:Math.min(completeQty, completeItem.allocated_qty)
    });
    setBusy(false);
    if(ok)setCompleteItem(null);
  }

  const selectedOrder=selected?d.orders.find(o=>o.id===selected.order_id):null;

  return (
    <>
      <Heading title="Pending Production">
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

        {sizeOptions.length > 0 && (
          <FilterToken
            label="Box Size"
            value={boxSize}
            onChange={setBoxSize}
            options={[
              {value:'All',label:'All sizes'},
              ...sizeOptions.map(s=>({value:s,label:s}))
            ]}
          />
        )}

        <DateFilterPill label="From" value={startDate} onChange={setStartDate} placeholder="All" />
        <DateFilterPill label="To" value={endDate} onChange={setEndDate} placeholder="All" />
      </div>

      {/* Desktop Table View */}
      <div className="desktop-table-view table-wrap">
        <table>
          <thead>
            <tr>
              <th className="w-8">
                <Checkbox aria-label="Select all" />
              </th>
              <th>Order ID</th>
              <th>Customer / Account</th>
              <th>Box Type & Dimensions</th>
              <th className="numeric">Ordered</th>
              <th className="numeric">Allocated</th>
              <th className="numeric">Completed</th>
              <th className="numeric">Remaining</th>
              <th>Allocation Ratio</th>
              <th>Priority</th>
              <th className="text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {paginated.length ? paginated.map(i=>{
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
                    <Checkbox aria-label={`Select ${i.box_type}`} />
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
                  <td className="numeric text-emerald-500 font-medium">{number(i.completed_qty)}</td>
                  <td className="numeric font-medium text-foreground">{number(remaining)}</td>
                  <td>
                    <SegmentedMeter value={i.allocated_qty} total={i.ordered_qty} />
                  </td>
                  <td><Pill value={i.priority_signal}/></td>
                  <td className="text-right" onClick={e=>e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-1.5">
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
                      {i.allocated_qty > i.completed_qty && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={()=>{
                            setCompleteItem(i);
                            setCompleteQty(i.completed_qty);
                          }}
                        >
                          Complete
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            }) : (
              <Empty columns={11} label="No items in production queue"/>
            )}
          </tbody>
          <tfoot>
            <tr className="border-t border-border bg-muted/20 font-medium">
              <td colSpan={4} className="text-right text-xs text-muted-foreground font-semibold px-3 py-2.5">
                Queue Totals ({number(filtered.length)} items):
              </td>
              <td className="numeric font-semibold text-foreground px-3 py-2.5 tabular-nums">
                {number(totalOrdered)}
              </td>
              <td className="numeric text-muted-foreground px-3 py-2.5 tabular-nums">
                {number(filtered.reduce((s,i)=>s+i.allocated_qty,0))}
              </td>
              <td className="numeric text-emerald-500 font-medium px-3 py-2.5 tabular-nums">
                {number(filtered.reduce((s,i)=>s+i.completed_qty,0))}
              </td>
              <td className="numeric font-semibold text-foreground px-3 py-2.5 tabular-nums">
                {number(totalUnallocated)}
              </td>
              <td colSpan={3} />
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Mobile Card View (No Horizontal Sliding Required) */}
      <div className="mobile-card-view">
        {paginated.length ? paginated.map(i => {
          const o = d.orders.find(o => o.id === i.order_id);
          const remaining = i.ordered_qty - i.allocated_qty;
          const partyName = o?.is_self_stock ? 'Self Stocking' : d.parties.find(p => p.id === o?.party_id)?.company_name ?? '—';
          const monogram = o?.is_self_stock ? 'SS' : partyName.slice(0, 2).toUpperCase();
          return (
            <div
              key={i.id}
              className="mobile-record-card"
              onClick={() => {
                setSelected(i);
                setQty(remaining);
              }}
            >
              <div className="mobile-card-top">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="avatar !w-6 !h-6 !text-[10px] font-semibold flex-shrink-0">
                    {monogram}
                  </span>
                  <div className="min-w-0">
                    <div className="mobile-card-title">{partyName}</div>
                    <div className="mobile-card-sub">{o?.order_no || '—'} · {i.box_type}</div>
                  </div>
                </div>
                <Pill value={i.priority_signal} />
              </div>

              <div className="text-xs text-muted-foreground">
                Dimensions: <span className="text-foreground font-medium">{i.size_dimensions || 'Standard'}</span>
              </div>

              <div className="mobile-card-grid">
                <div className="mobile-card-field">
                  <span className="mobile-card-label">Ordered</span>
                  <span className="mobile-card-value">{number(i.ordered_qty)}</span>
                </div>
                <div className="mobile-card-field">
                  <span className="mobile-card-label">Allocated</span>
                  <span className="mobile-card-value">{number(i.allocated_qty)}</span>
                </div>
                <div className="mobile-card-field">
                  <span className="mobile-card-label">Completed</span>
                  <span className="mobile-card-value text-emerald-500 font-medium">{number(i.completed_qty)}</span>
                </div>
                <div className="mobile-card-field">
                  <span className="mobile-card-label">Remaining</span>
                  <span className="mobile-card-value">{number(remaining)}</span>
                </div>
              </div>

              <div className="mobile-card-actions">
                <div className="flex-1">
                  <SegmentedMeter value={i.allocated_qty} total={i.ordered_qty} />
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelected(i);
                    setQty(remaining);
                  }}
                >
                  Assign Labour
                </Button>
              </div>
            </div>
          );
        }) : (
          <div className="p-8 text-center text-sm text-muted-foreground bg-card border border-border rounded-xl">
            No items in production queue
          </div>
        )}
      </div>

      <Pagination
        currentPage={page}
        totalItems={filtered.length}
        pageSize={pageSize}
        onPageChange={setPage}
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
                <ThemedSelect
                  name="labour_id"
                  placeholder="Select worker or production team"
                  options={d.workers.map(w=>({
                    value: w.id,
                    label: `${w.labour_name}${w.unit_assignment ? ' · ' + w.unit_assignment : ''}`
                  }))}
                  required
                />
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
                <ThemedSelect
                  name="duration_hours"
                  value={String(hours)}
                  onChange={v=>setHours(Number(v))}
                  options={Array.from({length:10},(_,i)=>({
                    value: String(i+1),
                    label: `${i+1} hour${i>0?'s':''}`
                  }))}
                />
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

      {/* Update Completed Quantity Dialog */}
      <Dialog open={!!completeItem} onOpenChange={()=>setCompleteItem(null)}>
        <DialogContent className="modal-wide" aria-describedby={undefined}>
          <DialogTitle className="text-xl font-medium">Update Completed Quantity</DialogTitle>
          <div className="form-subtitle">
            Record finished production units for {completeItem?.box_type}. Completed quantity must not exceed allocated quantity ({completeItem?.allocated_qty} boxes).
          </div>
          <form onSubmit={submitCompletion}>
            <div className="form-grid">
              <label className="form-wide">
                Completed Quantity (Boxes)
                <input
                  type="number"
                  min={completeItem?.completed_qty ?? 0}
                  max={completeItem?.allocated_qty ?? 0}
                  required
                  value={completeQty}
                  onChange={e=>setCompleteQty(Number(e.target.value))}
                />
              </label>
            </div>
            <div className="form-actions">
              <Button variant="outline" type="button" onClick={()=>setCompleteItem(null)}>Cancel</Button>
              <Button type="submit" disabled={busy}>{busy?'Saving…':'Save Completed Quantity'}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
