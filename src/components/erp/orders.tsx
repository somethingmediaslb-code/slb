import {useEffect,useState} from 'react';
import {useSearch} from '@tanstack/react-router';
import {Plus,Trash2,Building2,Calendar,Package,CheckCircle2,Clock,Layers,MoreHorizontal,Phone,Mail,ClipboardList,List,LayoutGrid} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {Dialog,DialogContent,DialogTitle} from '@/components/ui/dialog';
import {Sheet,SheetContent,SheetHeader,SheetTitle} from '@/components/ui/sheet';
import {useFactory} from './provider';
import {Heading,Empty,AccessNotice,SearchFilter,ExportButton,AddButton,Pill,ViewTabs,FilterToken,TableCalcBar,CrmTag,SegmentedMeter,MiniSparkline} from './common';
import {money,number,dateLabel,today,downloadCsv} from '@/lib/erp-data';

const freshLine=()=>({sr_no:1,box_type:'',code_remarks:'',size_dimensions:'',specification:'',ordered_qty:1,unit_rate:0,priority_signal:'Yellow'});

export function Orders(){
  const {data:d,user,signIn,action}=useFactory();
  const searchParams=useSearch({strict:false}) as {new?:boolean};
  const [open,setOpen]=useState(false);
  const [viewMode,setViewMode]=useState<'list'|'board'>('list');
  const [search,setSearch]=useState('');
  const [statusTab,setStatusTab]=useState('All');
  const [partyFilter,setPartyFilter]=useState('All');
  const [mediumFilter,setMediumFilter]=useState('All');
  const [stock,setStock]=useState(false);
  const [lines,setLines]=useState([freshLine()]);
  const [busy,setBusy]=useState(false);
  const [viewOrderId,setViewOrderId]=useState<string|null>(null);

  useEffect(()=>{
    if(searchParams.new&&user)setOpen(true);
  },[searchParams.new,user]);

  function add(){
    if(!user){signIn();return;}
    setStock(false);
    setLines([freshLine()]);
    setOpen(true);
  }

  const company=(id:string|null)=>d.parties.find(p=>p.id===id)?.company_name??'—';

  // Compute status counts for ViewTabs
  const pendingCount=d.orders.filter(o=>o.status==='Pending').length;
  const prodCount=d.orders.filter(o=>o.status==='In Production').length;
  const dispCount=d.orders.filter(o=>o.status==='Dispatched').length;
  const doneCount=d.orders.filter(o=>o.status==='Completed').length;

  const tabs=[
    {id:'All',label:'All Orders',count:d.orders.length},
    {id:'Pending',label:'Pending',count:pendingCount},
    {id:'In Production',label:'In Production',count:prodCount},
    {id:'Dispatched',label:'Dispatched',count:dispCount},
    {id:'Completed',label:'Completed',count:doneCount},
  ];

  const filtered=d.orders.filter(o=>{
    const matchesTab=statusTab==='All'||o.status===statusTab;
    const matchesParty=partyFilter==='All'||(o.is_self_stock&&partyFilter==='self')||o.party_id===partyFilter;
    const matchesMedium=mediumFilter==='All'||o.medium===mediumFilter;
    const matchesSearch=(o.order_no+' '+company(o.party_id)+' '+(o.remarks??'')).toLowerCase().includes(search.toLowerCase());
    return matchesTab&&matchesParty&&matchesMedium&&matchesSearch;
  });

  // Calculate live totals for footer dock
  const totalVolume=filtered.reduce((sum,o)=>{
    const items=d.items.filter(i=>i.order_id===o.id);
    return sum+items.reduce((s,i)=>s+i.ordered_qty,0);
  },0);

  const totalValue=filtered.reduce((sum,o)=>{
    const items=d.items.filter(i=>i.order_id===o.id);
    return sum+items.reduce((s,i)=>s+(i.total_price??0),0);
  },0);

  const totalCompleted=filtered.reduce((sum,o)=>{
    const items=d.items.filter(i=>i.order_id===o.id);
    return sum+items.reduce((s,i)=>s+i.completed_qty,0);
  },0);

  async function submit(e:React.FormEvent<HTMLFormElement>){
    e.preventDefault();
    setBusy(true);
    const f=new FormData(e.currentTarget);
    const success=await action('order',{
      party_id:stock?null:String(f.get('party_id')),
      is_self_stock:stock,
      order_date:String(f.get('order_date')),
      expected_date:String(f.get('expected_date')),
      medium:String(f.get('medium')),
      remarks:String(f.get('remarks')),
      items:lines.map((l,i)=>({...l,sr_no:i+1}))
    });
    setBusy(false);
    if(success)setOpen(false);
  }

  // Selected order details for sheet
  const activeOrder=d.orders.find(o=>o.id===viewOrderId);
  const activeParty=activeOrder?d.parties.find(p=>p.id===activeOrder.party_id):null;
  const activeItems=activeOrder?d.items.filter(i=>i.order_id===activeOrder.id):[];
  const activeTotalQty=activeItems.reduce((s,i)=>s+i.ordered_qty,0);
  const activeCompletedQty=activeItems.reduce((s,i)=>s+i.completed_qty,0);
  const activeDispatchedQty=activeItems.reduce((s,i)=>s+i.dispatched_qty,0);
  const activeTotalValue=activeItems.reduce((s,i)=>s+(i.total_price??0),0);

  // Form live preview values
  const formTotalUnits=lines.reduce((s,l)=>s+(Number(l.ordered_qty)||0),0);
  const formTotalValue=lines.reduce((s,l)=>s+((Number(l.ordered_qty)||0)*(Number(l.unit_rate)||0)),0);

  return (
    <>
      <Heading title="Order Pipeline">
        <ExportButton onClick={()=>downloadCsv('orders',filtered.map(o=>({...o,company:o.is_self_stock?'Self Stocking':company(o.party_id)})))}/>
        <AddButton onClick={add}>New order</AddButton>
      </Heading>

      <AccessNotice/>

      {/* View Tabs */}
      <ViewTabs tabs={tabs} active={statusTab} onChange={setStatusTab}/>

      {/* Filter Tokens Toolbar with View Mode Switcher */}
      <div className="filters">
        <SearchFilter value={search} onChange={setSearch} placeholder="Search order number or client…"/>

        <FilterToken
          label="Client"
          value={partyFilter}
          onChange={setPartyFilter}
          options={[
            {value:'All',label:'All clients'},
            {value:'self',label:'Self Stocking'},
            ...d.parties.map(p=>({value:p.id,label:p.company_name}))
          ]}
        />

        <FilterToken
          label="Channel"
          value={mediumFilter}
          onChange={setMediumFilter}
          options={[
            {value:'All',label:'All channels'},
            {value:'WhatsApp',label:'WhatsApp'},
            {value:'Call',label:'Phone Call'},
            {value:'Mail',label:'Email'},
            {value:'Other',label:'Direct / Other'},
          ]}
        />

        <div className="ml-auto flex items-center gap-2">
          <div className="view-mode-toggle">
            <button
              type="button"
              className={`view-mode-btn ${viewMode === 'list' ? 'active' : ''}`}
              onClick={() => setViewMode('list')}
            >
              <List className="w-3.5 h-3.5" />
              <span>Table</span>
            </button>
            <button
              type="button"
              className={`view-mode-btn ${viewMode === 'board' ? 'active' : ''}`}
              onClick={() => setViewMode('board')}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>Deals Board</span>
            </button>
          </div>
        </div>
      </div>

      {viewMode === 'board' ? (
        /* Deals Board (Kanban Columns) */
        <div className="deals-board">
          {(['Pending', 'In Production', 'Dispatched', 'Completed'] as const).map(stage => {
            const stageOrders = filtered.filter(o => o.status === stage);
            const stageValue = stageOrders.reduce((sum, o) => {
              const items = d.items.filter(i => i.order_id === o.id);
              return sum + items.reduce((s, i) => s + (i.total_price ?? 0), 0);
            }, 0);

            return (
              <div key={stage} className="deals-column">
                <div className="deals-column-header">
                  <div className="deals-column-title">
                    <span className={`pill ${stage}`} />
                    <span>{stage}</span>
                    <span className="deals-column-count">{stageOrders.length}</span>
                  </div>
                  <div className="deals-column-total">{money(stageValue)}</div>
                </div>

                <div className="deals-column-cards">
                  {stageOrders.length ? (
                    stageOrders.map(o => {
                      const items = d.items.filter(i => i.order_id === o.id);
                      const ordered = items.reduce((s, i) => s + i.ordered_qty, 0);
                      const completed = items.reduce((s, i) => s + i.completed_qty, 0);
                      const value = items.reduce((s, i) => s + (i.total_price ?? 0), 0);
                      const firstItem = items[0];

                      return (
                        <div
                          key={o.id}
                          className="deals-card"
                          onClick={() => setViewOrderId(o.id)}
                          title="Click to inspect order"
                        >
                          <div className="deals-card-top">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="avatar !w-6 !h-6 !text-[10px] font-semibold flex-shrink-0">
                                {o.is_self_stock ? 'SS' : company(o.party_id).slice(0, 2).toUpperCase()}
                              </span>
                              <div className="min-w-0">
                                <div className="deals-card-title truncate">
                                  {o.is_self_stock ? 'Self Stocking' : company(o.party_id)}
                                </div>
                                <div className="deals-card-sub">{o.order_no}</div>
                              </div>
                            </div>
                            <Pill value={o.status} />
                          </div>

                          <div className="deals-card-tags">
                            {firstItem?.specification ? (
                              <CrmTag label={firstItem.specification} variant="blue" />
                            ) : (
                              <CrmTag label="Corrugated" variant="neutral" />
                            )}
                            {firstItem?.priority_signal === 'Red' && <CrmTag label="Urgent" variant="red" />}
                            {o.medium && <CrmTag label={o.medium} variant="green" />}
                          </div>

                          <div className="deals-card-metric">
                            <span className="text-muted-foreground">{number(ordered)} boxes</span>
                            <strong>{money(value)}</strong>
                          </div>

                          <div>
                            <SegmentedMeter value={completed} total={ordered} />
                          </div>

                          <div className="deals-card-footer">
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3 text-muted-foreground" />
                              <span>{dateLabel(o.expected_date)}</span>
                            </span>
                            <MiniSparkline />
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="text-center py-12 text-xs text-muted-foreground bg-secondary/30 rounded-lg border border-dashed border-border">
                      No orders in this stage
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Main Table */
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th className="w-8">
                  <input type="checkbox" className="w-3.5 h-3.5 rounded border-border" aria-label="Select all" readOnly />
                </th>
                <th>Order ID</th>
                <th>Customer / Account</th>
                <th>Spec & Tags</th>
                <th>Order Date</th>
                <th>Due Date</th>
                <th className="numeric">Units</th>
                <th className="numeric">Order Value</th>
                <th>Fulfilment</th>
                <th>Activity Trend</th>
                <th>Status</th>
                <th className="w-8" />
              </tr>
            </thead>
            <tbody>
              {filtered.length ? filtered.map(o=>{
                const items=d.items.filter(i=>i.order_id===o.id);
                const ordered=items.reduce((s,i)=>s+i.ordered_qty,0);
                const completed=items.reduce((s,i)=>s+i.completed_qty,0);
                const value=items.reduce((s,i)=>s+(i.total_price??0),0);
                const firstItem=items[0];
                return (
                  <tr
                    key={o.id}
                    className="clickable-row"
                    onClick={()=>setViewOrderId(o.id)}
                    title="Click to view full details"
                  >
                    <td onClick={e=>e.stopPropagation()}>
                      <input type="checkbox" className="w-3.5 h-3.5 rounded border-border" aria-label={`Select ${o.order_no}`} />
                    </td>
                    <td className="font-medium text-foreground">{o.order_no}</td>
                    <td>
                      <div className="flex items-center gap-2.5">
                        <span className="avatar !w-6 !h-6 !text-[10px] font-semibold">
                          {o.is_self_stock ? 'SS' : company(o.party_id).slice(0,2).toUpperCase()}
                        </span>
                        <span className="font-medium text-foreground">{o.is_self_stock ? 'Self Stocking' : company(o.party_id)}</span>
                      </div>
                    </td>
                    <td>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {firstItem?.specification ? (
                          <CrmTag label={firstItem.specification} variant="blue" />
                        ) : (
                          <CrmTag label="Corrugated" variant="neutral" />
                        )}
                        {firstItem?.priority_signal === 'Red' && <CrmTag label="Urgent" variant="red" />}
                        {o.medium && <CrmTag label={o.medium} variant="green" />}
                        {items.length > 1 && <CrmTag label={`+${items.length - 1}`} variant="neutral" />}
                      </div>
                    </td>
                    <td>
                      <div className="flex items-center gap-1.5 text-xs">
                        <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                        <span className="text-foreground">{dateLabel(o.order_date)}</span>
                        <span className="text-muted-foreground/60">|</span>
                        <span className="text-muted-foreground">{o.medium || 'Direct'}</span>
                      </div>
                    </td>
                    <td className="text-xs text-muted-foreground">{dateLabel(o.expected_date)}</td>
                    <td className="numeric font-medium">{number(ordered)}</td>
                    <td className="numeric font-medium text-foreground">{money(value)}</td>
                    <td>
                      <SegmentedMeter value={completed} total={ordered} />
                    </td>
                    <td>
                      <MiniSparkline />
                    </td>
                    <td><Pill value={o.status}/></td>
                    <td onClick={e=>e.stopPropagation()}>
                      <button
                        type="button"
                        className="dots-btn"
                        aria-label="View order options"
                        title="View order options"
                        onClick={()=>setViewOrderId(o.id)}
                      >
                        <MoreHorizontal className="w-4 h-4"/>
                      </button>
                    </td>
                  </tr>
                );
              }) : (
                <Empty columns={12} label="No matching orders found"/>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Bottom Pinned Calculation Bar */}
      <TableCalcBar
        count={filtered.length}
        entityName="orders"
        stats={[
          {label:'Total Volume',value:`${number(totalVolume)} boxes`},
          {label:'Pipeline Value',value:money(totalValue)},
          {label:'Produced',value:`${number(totalCompleted)} boxes`},
        ]}
      />

      {/* Slide-over Inspection Sheet (CRM Details Drawer - Screenshot 5) */}
      <Sheet open={!!viewOrderId} onOpenChange={open=>!open&&setViewOrderId(null)}>
        <SheetContent side="right" className="sm:max-w-xl w-full p-0 flex flex-col bg-card overflow-hidden">
          {activeOrder && (
            <>
              <div className="p-6 border-b border-border bg-background">
                <SheetHeader className="text-left space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      <ClipboardList className="w-4 h-4 text-primary" />
                      <span>Order Details</span>
                    </div>
                    <Pill value={activeOrder.status} />
                  </div>
                  <div className="drawer-hero-box">
                    <div className="drawer-hero-monogram">
                      {activeOrder.is_self_stock ? 'SS' : company(activeOrder.party_id).slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <SheetTitle className="text-xl font-medium tracking-tight">
                        {activeOrder.order_no}
                      </SheetTitle>
                      <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                        <CrmTag label={activeOrder.is_self_stock ? 'Self Stocking' : company(activeOrder.party_id)} variant="blue" />
                        {activeItems[0]?.specification && <CrmTag label={activeItems[0].specification} variant="purple" />}
                        {activeOrder.medium && <CrmTag label={activeOrder.medium} variant="green" />}
                        {activeItems[0]?.priority_signal === 'Red' && <CrmTag label="High Priority" variant="red" />}
                      </div>
                    </div>
                  </div>
                </SheetHeader>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {/* Account Summary */}
                <div>
                  <div className="drawer-section-label">Account Summary</div>
                  <div className="p-3.5 bg-background border border-border rounded-lg flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <span className="avatar !w-8 !h-8 !text-xs font-semibold bg-accent">
                        {activeOrder.is_self_stock ? 'SS' : company(activeOrder.party_id).slice(0, 2).toUpperCase()}
                      </span>
                      <div>
                        <span className="text-sm font-medium text-foreground block">
                          {activeOrder.is_self_stock ? 'Internal Factory Stock' : company(activeOrder.party_id)}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {activeOrder.remarks ? activeOrder.remarks : 'Order registered in plant pipeline'}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      {activeParty?.email && (
                        <span className="flex items-center gap-1.5 hover:text-foreground">
                          <Mail className="w-3.5 h-3.5 text-muted-foreground" />
                          <span className="hidden sm:inline">{activeParty.email}</span>
                        </span>
                      )}
                      {activeParty?.phone_number && (
                        <span className="flex items-center gap-1.5 hover:text-foreground">
                          <Phone className="w-3.5 h-3.5 text-muted-foreground" />
                          <span>{activeParty.phone_number}</span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Pipeline Health (Screenshot 5) */}
                <div>
                  <div className="drawer-section-label">Pipeline Health</div>
                  <div className="p-4 bg-background border border-border rounded-lg">
                    <div className="drawer-health-headline">
                      {activeTotalQty > 0 ? Math.round((activeCompletedQty / activeTotalQty) * 100) : 0}%
                    </div>
                    <div className="drawer-health-sub">
                      Fulfilment health across scheduled corrugation and converting runs
                    </div>

                    <div className="space-y-3 pt-1">
                      {/* Stage 1: Planning */}
                      <div className="stage-meter-row">
                        <div className="stage-meter-header">
                          <span>Paper Planning & Slitting</span>
                          <span>100%</span>
                        </div>
                        <div className="stage-meter-track">
                          {Array.from({ length: 28 }).map((_, i) => (
                            <span key={i} className="stage-meter-bar active-stage-green" />
                          ))}
                        </div>
                      </div>

                      {/* Stage 2: Corrugation & Pasting */}
                      <div className="stage-meter-row">
                        <div className="stage-meter-header">
                          <span>Corrugation & Converting</span>
                          <span>{activeTotalQty > 0 ? Math.round((activeCompletedQty / activeTotalQty) * 100) : 0}%</span>
                        </div>
                        <div className="stage-meter-track">
                          {Array.from({ length: 28 }).map((_, i) => {
                            const pct = activeTotalQty > 0 ? activeCompletedQty / activeTotalQty : 0;
                            const isActive = i < Math.round(pct * 28);
                            return (
                              <span
                                key={i}
                                className={`stage-meter-bar ${isActive ? (pct >= 0.8 ? 'active-stage-green' : 'active-stage-amber') : ''}`}
                              />
                            );
                          })}
                        </div>
                      </div>

                      {/* Stage 3: Dispatch & Logistics */}
                      <div className="stage-meter-row">
                        <div className="stage-meter-header">
                          <span>Dispatch & Logistics</span>
                          <span>{activeTotalQty > 0 ? Math.round((activeDispatchedQty / activeTotalQty) * 100) : 0}%</span>
                        </div>
                        <div className="stage-meter-track">
                          {Array.from({ length: 28 }).map((_, i) => {
                            const pct = activeTotalQty > 0 ? activeDispatchedQty / activeTotalQty : 0;
                            const isActive = i < Math.round(pct * 28);
                            return (
                              <span
                                key={i}
                                className={`stage-meter-bar ${isActive ? 'active-stage-green' : ''}`}
                              />
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Activity Trend (Screenshot 5) */}
                <div>
                  <div className="drawer-section-label">
                    <span>Activity Trend</span>
                    <span className="text-[11px] font-normal text-muted-foreground border border-border px-2 py-0.5 rounded-full bg-card">
                      Last 30 Days ▾
                    </span>
                  </div>
                  <div className="p-4 bg-background border border-border rounded-lg">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl font-medium text-foreground">
                        {activeItems.length * 14 + 18}
                      </span>
                      <MiniSparkline />
                    </div>
                    <div className="text-xs text-muted-foreground mt-1 mb-3">
                      Spikes around corrugation schedule and dispatch review
                    </div>

                    <div className="drawer-micro-stats">
                      <div className="drawer-micro-card">
                        <div className="label"><Package className="w-3 h-3 text-muted-foreground" /> Ordered</div>
                        <div className="value">{number(activeTotalQty)}</div>
                      </div>
                      <div className="drawer-micro-card">
                        <div className="label"><CheckCircle2 className="w-3 h-3 text-success" /> Produced</div>
                        <div className="value">{number(activeCompletedQty)}</div>
                      </div>
                      <div className="drawer-micro-card">
                        <div className="label"><Clock className="w-3 h-3 text-warning" /> Dispatched</div>
                        <div className="value">{number(activeDispatchedQty)}</div>
                      </div>
                      <div className="drawer-micro-card">
                        <div className="label"><Layers className="w-3 h-3 text-primary" /> Value</div>
                        <div className="value">{money(activeTotalValue)}</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Line Items Breakdown */}
                <div>
                  <div className="drawer-section-label">Line Items ({activeItems.length})</div>
                  <div className="space-y-3">
                    {activeItems.map((item) => (
                      <div key={item.id} className="p-3.5 bg-background border border-border rounded-lg space-y-2 text-xs">
                        <div className="flex justify-between items-start">
                          <div>
                            <span className="font-semibold text-foreground text-sm block">{item.box_type}</span>
                            <span className="text-muted-foreground">{item.size_dimensions}</span>
                          </div>
                          <Pill value={item.priority_signal} />
                        </div>
                        {item.specification && (
                          <div className="text-muted-foreground bg-secondary/60 p-1.5 rounded">
                            Spec: {item.specification}
                          </div>
                        )}
                        <div className="grid grid-cols-4 gap-2 pt-2 border-t border-border/70 text-[11px]">
                          <div>
                            <span className="text-muted-foreground block">Qty</span>
                            <strong className="text-foreground">{number(item.ordered_qty)}</strong>
                          </div>
                          <div>
                            <span className="text-muted-foreground block">Rate</span>
                            <strong className="text-foreground">{money(item.unit_rate)}</strong>
                          </div>
                          <div>
                            <span className="text-muted-foreground block">Produced</span>
                            <strong className="text-foreground">{number(item.completed_qty)}</strong>
                          </div>
                          <div className="text-right">
                            <span className="text-muted-foreground block">Total</span>
                            <strong className="text-foreground font-semibold">{money(item.total_price ?? (item.ordered_qty * item.unit_rate))}</strong>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Pinned Footer (Screenshot 5: Need help? on left, Cancel + Save/Export on right) */}
              <div className="p-4 border-t border-border bg-background flex justify-between items-center">
                <span className="text-xs text-muted-foreground hover:text-foreground cursor-pointer underline">
                  Need help? Ask us.
                </span>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => downloadCsv(`order-${activeOrder.order_no}`, activeItems)}>
                    Export CSV
                  </Button>
                  <Button variant="default" size="sm" onClick={() => setViewOrderId(null)}>
                    Done
                  </Button>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* New Order Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="modal-wide" aria-describedby={undefined}>
          <DialogTitle className="text-xl font-medium">New Manufacturing Order</DialogTitle>
          <div className="form-subtitle">
            Create a customer production order or run for self-stocking inventory.
          </div>

          <form onSubmit={submit}>
            <label className="toggle-check mb-5">
              <input type="checkbox" checked={stock} onChange={e=>setStock(e.target.checked)}/>
              Self-stocking run (internal factory inventory)
            </label>

            {/* Section 1: Metadata */}
            <div className="form-section-title">1. Order Metadata</div>
            <div className="form-grid">
              <label className="form-wide">
                Client / Company
                <select aria-label="Company" name="party_id" required={!stock} disabled={stock}>
                  <option value="">{stock?'Self Stocking':'Select company'}</option>
                  {d.parties.map(p=><option key={p.id} value={p.id}>{p.company_name}</option>)}
                </select>
              </label>
              <label>
                Order Date
                <input type="date" name="order_date" defaultValue={today()} required/>
              </label>
              <label>
                Target Delivery Date
                <input type="date" name="expected_date" defaultValue={today()} required/>
              </label>
              <label>
                Intake Medium
                <select aria-label="Order medium" name="medium">
                  {['WhatsApp','Call','Mail','Other'].map(m=><option key={m}>{m}</option>)}
                </select>
              </label>
              <label>
                General Remarks / Delivery Instructions
                <input name="remarks" placeholder="e.g. Deliver before 4 PM, pallet packaging"/>
              </label>
            </div>

            {/* Section 2: Items */}
            <div className="form-section-title mt-6">2. Box Specifications & Quantities</div>
            <div className="space-y-4">
              {lines.map((l,index)=>(
                <div key={index} className="order-line">
                  <div className="order-line-head">
                    <h3 className="text-sm font-medium">Item #{index+1}</h3>
                    {lines.length>1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        aria-label="Remove item"
                        className="text-destructive hover:bg-destructive/10"
                        onClick={()=>setLines(lines.filter((_,i)=>i!==index))}
                      >
                        <Trash2 className="w-4 h-4 mr-1"/> Remove
                      </Button>
                    )}
                  </div>
                  <div className="form-grid">
                    <label>
                      Box Type
                      <input
                        list="catalog-items"
                        required
                        value={l.box_type}
                        placeholder="Select or enter box type"
                        onChange={e=>{
                          const catalog=d.catalog.find(i=>i.box_type===e.target.value);
                          setLines(lines.map((x,i)=>i===index?{
                            ...x,
                            box_type:e.target.value,
                            ...(catalog?{
                              size_dimensions:catalog.size_dimensions,
                              specification:catalog.specification??'',
                              unit_rate:catalog.unit_rate
                            }:{})
                          }:x));
                        }}
                      />
                    </label>
                    <label>
                      Size Dimensions
                      <input
                        required
                        placeholder="L x W x H (inches / mm)"
                        value={l.size_dimensions}
                        onChange={e=>setLines(lines.map((x,i)=>i===index?{...x,size_dimensions:e.target.value}:x))}
                      />
                    </label>
                    <label>
                      Specification
                      <input
                        placeholder="Ply, GSM, Flute type"
                        value={l.specification}
                        onChange={e=>setLines(lines.map((x,i)=>i===index?{...x,specification:e.target.value}:x))}
                      />
                    </label>
                    <label>
                      Quantity (Boxes)
                      <input
                        type="number"
                        min={1}
                        required
                        value={l.ordered_qty}
                        onChange={e=>setLines(lines.map((x,i)=>i===index?{...x,ordered_qty:Number(e.target.value)}:x))}
                      />
                    </label>
                    <label>
                      Unit Rate (₹)
                      <input
                        type="number"
                        min={0}
                        step=".01"
                        required={!stock}
                        value={l.unit_rate}
                        onChange={e=>setLines(lines.map((x,i)=>i===index?{...x,unit_rate:Number(e.target.value)}:x))}
                      />
                    </label>
                    <label>
                      Priority Level
                      <select
                        value={l.priority_signal}
                        onChange={e=>setLines(lines.map((x,i)=>i===index?{...x,priority_signal:e.target.value}:x))}
                      >
                        <option value="Red">High Priority · Red</option>
                        <option value="Yellow">Medium Priority · Yellow</option>
                        <option value="Green">Standard Priority · Green</option>
                      </select>
                    </label>
                    <label className="form-wide">
                      Code / Item Remarks
                      <textarea
                        value={l.code_remarks}
                        placeholder="Printing notes, die number, etc."
                        onChange={e=>setLines(lines.map((x,i)=>i===index?{...x,code_remarks:e.target.value}:x))}
                      />
                    </label>
                  </div>
                  <div className="mt-2 text-right numeric text-xs text-muted-foreground">
                    Item Total: <strong className="text-foreground">{money(l.ordered_qty*l.unit_rate)}</strong>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-3">
              <Button type="button" variant="outline" size="sm" onClick={()=>setLines([...lines,freshLine()])}>
                <Plus className="w-4 h-4 mr-1"/> Add Another Item
              </Button>
            </div>

            <datalist id="catalog-items">
              {d.catalog.map(i=><option key={i.id} value={i.box_type}/>)}
            </datalist>

            {/* Live Form Summary Banner */}
            <div className="form-calc-banner">
              <div>
                <span className="text-muted-foreground block text-xs">Total Units:</span>
                <strong className="text-foreground font-semibold text-base">{number(formTotalUnits)} boxes</strong>
              </div>
              <div className="text-right">
                <span className="text-muted-foreground block text-xs">Estimated Order Value:</span>
                <strong className="text-foreground font-semibold text-base">{money(formTotalValue)}</strong>
              </div>
            </div>

            <div className="form-actions">
              <Button type="button" variant="outline" onClick={()=>setOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={busy}>{busy?'Saving…':'Create Order'}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
