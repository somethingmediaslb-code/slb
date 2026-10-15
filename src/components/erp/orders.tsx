import {useState, useEffect} from 'react';
import {useSearch} from '@tanstack/react-router';
import {Plus,Trash2,Building2,Calendar,Package,CheckCircle2,Clock,Layers,MoreHorizontal,Phone,Mail,ClipboardList,List,LayoutGrid,MessageCircle,Share2} from 'lucide-react';
import {toast} from 'sonner';
import {Button} from '@/components/ui/button';
import {Checkbox} from '@/components/ui/checkbox';
import {Dialog,DialogContent,DialogTitle} from '@/components/ui/dialog';
import {Sheet,SheetContent,SheetHeader,SheetTitle} from '@/components/ui/sheet';
import {useFactory} from './provider';
import {Heading,Empty,AccessNotice,SearchFilter,ExportButton,AddButton,Pill,ViewTabs,FilterToken,TableCalcBar,CrmTag,SegmentedMeter,ThemedSelect,ThemedDatePicker,SegmentedControl,Pagination,MiniSparkline} from './common';
import {money,number,dateLabel,today,downloadCsv,type Row} from '@/lib/erp-data';

const freshLine=(sr:number=1)=>({sr_no:sr,box_type:'',code_remarks:'',size_dimensions:'',specification:'',ordered_qty:1,unit_rate:0,priority_signal:'Yellow'});

export function sendOrderWhatsApp(order: Row<'orders'>, items: Row<'order_items'>[], party?: Row<'party_master'> | null) {
  const companyName = order.is_self_stock ? 'Self Stocking' : (party?.company_name || 'Customer');
  const phone = party?.phone_number ? party.phone_number.replace(/\D/g, '') : '';

  const itemLines = items.map((item, idx) => {
    const sr = item.sr_no || (idx + 1);
    let l = `*Item #${sr}:* ${item.box_type || 'Box'}`;
    if (item.size_dimensions) l += `\n• Size: ${item.size_dimensions}`;
    if (item.specification) l += `\n• Spec: ${item.specification}`;
    if (item.code_remarks) l += `\n• Code / Remarks: ${item.code_remarks}`;
    l += `\n• Qty: ${number(item.ordered_qty)} units`;
    // NOTE: Rates, prices, and amounts are strictly omitted for customer privacy
    return l;
  });

  const text = [
    `*ORDER CONFIRMATION - SLBW*`,
    `--------------------------------`,
    `*Company / Party:* ${companyName}`,
    `*Order / PO No:* ${order.order_no}`,
    `*Order Date:* ${dateLabel(order.order_date)}`,
    `*Expected Delivery:* ${dateLabel(order.expected_date)}`,
    `*Medium:* ${order.medium || 'Direct'}`,
    order.remarks ? `*Remarks:* ${order.remarks}` : '',
    '',
    `*ORDER ITEM DETAILS (${items.length}):*`,
    ...itemLines,
    '',
    `--------------------------------`,
    `*SLBW Manufacturing*`
  ].filter(Boolean).join('\n');

  const url = phone ? `https://wa.me/${phone}?text=${encodeURIComponent(text)}` : `https://wa.me/?text=${encodeURIComponent(text)}`;
  window.open(url, '_blank', 'noopener,noreferrer');
}

export function Orders(){
  const {data:d,user,signIn,action,isAdmin}=useFactory();
  const searchParams=useSearch({strict:false}) as {new?:boolean};
  const [open,setOpen]=useState(false);
  const [viewMode,setViewMode]=useState<'list'|'board'>('list');
  const [search,setSearch]=useState('');
  const [statusTab,setStatusTab]=useState('All');
  const [partyFilter,setPartyFilter]=useState('All');
  const [mediumFilter,setMediumFilter]=useState('All');
  const [page,setPage]=useState(1);
  const pageSize=10;
  const [stock,setStock]=useState(false);
  const [lines,setLines]=useState([freshLine()]);
  const [busy,setBusy]=useState(false);
  const [viewOrderId,setViewOrderId]=useState<string|null>(null);
  const [closeShortOrderId,setCloseShortOrderId]=useState<string|null>(null);
  const [closeShortReason,setCloseShortReason]=useState('');
  const [closeShortBusy,setCloseShortBusy]=useState(false);

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
  const partDispCount=d.orders.filter(o=>o.status==='Partially Dispatched').length;
  const dispCount=d.orders.filter(o=>o.status==='Dispatched').length;
  const doneCount=d.orders.filter(o=>o.status==='Completed').length;

  const tabs=[
    {id:'All',label:'All Orders',count:d.orders.length},
    {id:'Pending',label:'Pending',count:pendingCount},
    {id:'In Production',label:'In Production',count:prodCount},
    {id:'Partially Dispatched',label:'Partially Dispatched',count:partDispCount},
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

  useEffect(() => {
    setPage(1);
  }, [search, statusTab, partyFilter, mediumFilter]);

  const paginated = filtered.slice((page - 1) * pageSize, page * pageSize);

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
    const f=new FormData(e.currentTarget);
    const partyVal=String(f.get('party_id')||'');
    if(!stock && (!partyVal || partyVal==='null' || partyVal==='undefined' || partyVal.trim()==='')){
      toast.error('Company selection is compulsory. Please select a party from Party Master.');
      return;
    }
    if(!lines.length){
      toast.error('At least one item is required in the order.');
      return;
    }
    for(let i=0;i<lines.length;i++){
      const l=lines[i];
      if(!l || !l.box_type.trim()){
        toast.error(`Item #${i+1}: Please select or enter a box type.`);
        return;
      }
      if(Number(l.ordered_qty)<=0){
        toast.error(`Item #${i+1}: Quantity must be at least 1.`);
        return;
      }
      if(!stock && Number(l.unit_rate)<0){
        toast.error(`Item #${i+1}: Unit rate cannot be negative.`);
        return;
      }
    }
    setBusy(true);
    const success=await action('order',{
      party_id:stock?null:partyVal,
      is_self_stock:stock,
      order_date:String(f.get('order_date')),
      expected_date:String(f.get('expected_date')),
      medium:String(f.get('medium')||'Other'),
      remarks:String(f.get('remarks')||''),
      items:lines.map((l,i)=>({
        ...l,
        sr_no:i+1,
        ordered_qty:Number(l.ordered_qty),
        unit_rate:Number(l.unit_rate)||0,
        total_price:Number(l.ordered_qty)*(Number(l.unit_rate)||0)
      }))
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
      <Heading title="Order Entry">
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

        <div className="ml-auto flex items-center">
          <SegmentedControl
            value={viewMode}
            onChange={val => setViewMode(val as 'list' | 'board')}
            options={[
              { value: 'list', label: 'Table', icon: List },
              { value: 'board', label: 'Board', icon: LayoutGrid },
            ]}
          />
        </div>
      </div>

      {viewMode === 'board' ? (
        /* Orders Board (Kanban Columns) */
        <div className="deals-board">
          {(['Pending', 'In Production', 'Partially Dispatched', 'Dispatched', 'Completed'] as const).map(stage => {
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
                              <CrmTag label="Wooden Box" variant="neutral" />
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
        <>
          {/* Main Desktop Table */}
          <div className="desktop-table-view table-wrap">
            <table>
              <thead>
                <tr>
                  <th className="w-8">
                    <Checkbox aria-label="Select all" />
                  </th>
                  <th>Order ID</th>
                  <th>Customer / Account</th>
                  <th>Spec & Tags</th>
                  <th>Order Date</th>
                  <th>Due Date</th>
                  <th className="numeric">Units</th>
                  <th className="numeric">Order Value</th>
                  <th>Fulfilment</th>
                  <th>Status</th>
                  <th className="w-8 text-right"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {paginated.length ? paginated.map(o=>{
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
                        <Checkbox aria-label={`Select ${o.order_no}`} />
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
                        <div className="flex items-center gap-1.5 whitespace-nowrap">
                          {firstItem?.specification ? (
                            <CrmTag label={firstItem.specification} variant="blue" />
                          ) : (
                            <CrmTag label="Wooden Box" variant="neutral" />
                          )}
                          {firstItem?.priority_signal === 'Red' && <CrmTag label="Urgent" variant="red" />}
                          {items.length > 1 && <CrmTag label={`+${items.length - 1}`} variant="neutral" />}
                        </div>
                      </td>
                      <td>
                        <div className="flex items-center gap-1.5 text-xs whitespace-nowrap">
                          <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                          <span className="text-foreground">{dateLabel(o.order_date)}</span>
                          <span className="text-muted-foreground/60">|</span>
                          <span className="text-muted-foreground">{o.medium || 'Direct'}</span>
                        </div>
                      </td>
                      <td className="text-xs text-muted-foreground whitespace-nowrap">{dateLabel(o.expected_date)}</td>
                      <td className="numeric font-medium">{number(ordered)}</td>
                      <td className="numeric font-medium text-foreground">{money(value)}</td>
                      <td>
                        <SegmentedMeter value={completed} total={ordered} />
                      </td>
                      <td><Pill value={o.status}/></td>
                      <td className="text-right" onClick={e=>e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label="Send Order Details to WhatsApp"
                            title="Send Order Details to WhatsApp"
                            onClick={()=>sendOrderWhatsApp(o,items,d.parties.find(p=>p.id===o.party_id))}
                          >
                            <MessageCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400"/>
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label="View order options"
                            title="View order options"
                            onClick={()=>setViewOrderId(o.id)}
                          >
                            <MoreHorizontal className="w-4 h-4"/>
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                }) : (
                  <Empty columns={11} label="No matching orders found"/>
                )}
              </tbody>
              <tfoot>
                <tr className="border-t border-border bg-muted/20 font-medium">
                  <td colSpan={6} className="text-right text-xs text-muted-foreground font-medium px-3 py-2.5">
                    Totals ({number(filtered.length)} orders):
                  </td>
                  <td className="numeric font-normal text-foreground px-3 py-2.5 tabular-nums">
                    {number(totalVolume)}
                  </td>
                  <td className="numeric font-normal text-foreground px-3 py-2.5 tabular-nums">
                    {money(totalValue)}
                  </td>
                  <td className="px-3 py-2.5 text-xs text-muted-foreground tabular-nums">
                    {number(totalCompleted)} produced
                  </td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Mobile Phone Card View (No Horizontal Sliding Required) */}
          <div className="mobile-card-view">
            {paginated.length ? paginated.map(o => {
              const items = d.items.filter(i => i.order_id === o.id);
              const ordered = items.reduce((s, i) => s + i.ordered_qty, 0);
              const completed = items.reduce((s, i) => s + i.completed_qty, 0);
              const value = items.reduce((s, i) => s + (i.total_price ?? 0), 0);
              const firstItem = items[0];
              return (
                <div
                  key={o.id}
                  className="mobile-record-card"
                  onClick={() => setViewOrderId(o.id)}
                >
                  <div className="mobile-card-top">
                    <div className="mobile-card-title-group">
                      <div className="flex items-center gap-2">
                        <span className="avatar !w-6 !h-6 !text-[10px] font-semibold flex-shrink-0">
                          {o.is_self_stock ? 'SS' : company(o.party_id).slice(0, 2).toUpperCase()}
                        </span>
                        <div className="mobile-card-title">
                          {o.is_self_stock ? 'Self Stocking' : company(o.party_id)}
                        </div>
                      </div>
                      <div className="mobile-card-sub">{o.order_no} · {dateLabel(o.order_date)}</div>
                    </div>
                    <Pill value={o.status} />
                  </div>

                  <div className="flex items-center gap-1.5 flex-wrap">
                    {firstItem?.specification && (
                      <CrmTag label={firstItem.specification} variant="blue" />
                    )}
                    {firstItem?.priority_signal === 'Red' && <CrmTag label="Urgent" variant="red" />}
                    {o.medium && <CrmTag label={o.medium} variant="green" />}
                  </div>

                  <div className="mobile-card-grid">
                    <div className="mobile-card-field">
                      <span className="mobile-card-label">Units</span>
                      <span className="mobile-card-value">{number(ordered)}</span>
                    </div>
                    <div className="mobile-card-field">
                      <span className="mobile-card-label">Order Value</span>
                      <span className="mobile-card-value">{money(value)}</span>
                    </div>
                    <div className="mobile-card-field">
                      <span className="mobile-card-label">Due Date</span>
                      <span className="mobile-card-value">{dateLabel(o.expected_date)}</span>
                    </div>
                    <div className="mobile-card-field">
                      <span className="mobile-card-label">Fulfilment</span>
                      <span className="mobile-card-value">
                        {ordered > 0 ? Math.round((completed / ordered) * 100) : 0}%
                      </span>
                    </div>
                  </div>

                  <div className="mobile-card-actions">
                    <div className="flex-1">
                      <SegmentedMeter value={completed} total={ordered} />
                    </div>
                    <button
                      type="button"
                      className="crm-btn crm-btn-secondary !h-7 !text-xs !px-3"
                      onClick={(e) => { e.stopPropagation(); setViewOrderId(o.id); }}
                    >
                      Inspect
                    </button>
                  </div>
                </div>
              );
            }) : (
              <div className="p-8 text-center text-sm text-muted-foreground bg-card border border-border rounded-xl">
                No matching orders found
              </div>
            )}
          </div>

          <Pagination
            currentPage={page}
            totalItems={filtered.length}
            pageSize={pageSize}
            onPageChange={setPage}
          />
        </>
      )}


      {/* Slide-over Inspection Sheet (CRM Details Drawer - Screenshot 5) */}
      <Sheet open={!!viewOrderId} onOpenChange={open=>!open&&setViewOrderId(null)}>
        <SheetContent side="right" className="sm:max-w-xl w-full p-0 flex flex-col bg-card overflow-hidden h-full max-h-screen">
          {activeOrder && (
            <>
              <div className="p-6 pr-14 border-b border-border bg-background">
                <SheetHeader className="text-left">
                  <div className="drawer-hero-box">
                    <div className="drawer-hero-monogram">
                      {activeOrder.is_self_stock ? 'SS' : company(activeOrder.party_id).slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <SheetTitle className="text-xl font-medium tracking-tight">
                          {activeOrder.order_no}
                        </SheetTitle>
                        <Pill value={activeOrder.status} />
                      </div>
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
                          {activeOrder.remarks ? activeOrder.remarks : 'Order registered in factory queue'}
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

                {/* Fulfillment Health */}
                <div>
                  <div className="drawer-section-label">Order Fulfilment Health</div>
                  <div className="p-4 bg-background border border-border rounded-lg space-y-4">
                    <div className="flex items-baseline gap-3 pb-2 border-b border-border/60">
                      <div className="text-3xl font-normal text-foreground tabular-nums tracking-tight">
                        {activeTotalQty > 0 ? Math.round((activeCompletedQty / activeTotalQty) * 100) : 0}%
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Fulfilment health across scheduled production runs
                      </div>
                    </div>

                    <div className="space-y-3 pt-1">
                      {/* Stage 1: Timber Cutting & Sizing */}
                      <div className="space-y-1.5">
                        <div className="flex justify-between items-center text-xs">
                          <span className="font-medium text-foreground">Timber Cutting & Sizing</span>
                          <span className="text-muted-foreground tabular-nums font-medium">100%</span>
                        </div>
                        <div className="w-full h-2 rounded-full bg-secondary overflow-hidden">
                          <div className="h-full bg-emerald-500 rounded-full w-full" />
                        </div>
                      </div>

                      {/* Stage 2: Box Assembly & Finishing */}
                      <div className="space-y-1.5">
                        <div className="flex justify-between items-center text-xs">
                          <span className="font-medium text-foreground">Box Assembly & Finishing</span>
                          <span className="text-muted-foreground tabular-nums font-medium">
                            {activeTotalQty > 0 ? Math.round((activeCompletedQty / activeTotalQty) * 100) : 0}%
                          </span>
                        </div>
                        <div className="w-full h-2 rounded-full bg-secondary overflow-hidden">
                          <div
                            className="h-full bg-primary rounded-full transition-all duration-300"
                            style={{
                              width: `${activeTotalQty > 0 ? Math.min(100, Math.round((activeCompletedQty / activeTotalQty) * 100)) : 0}%`
                            }}
                          />
                        </div>
                      </div>

                      {/* Stage 3: Dispatch & Delivery Challan */}
                      <div className="space-y-1.5">
                        <div className="flex justify-between items-center text-xs">
                          <span className="font-medium text-foreground">Dispatch & Delivery Challan</span>
                          <span className="text-muted-foreground tabular-nums font-medium">
                            {activeTotalQty > 0 ? Math.round((activeDispatchedQty / activeTotalQty) * 100) : 0}%
                          </span>
                        </div>
                        <div className="w-full h-2 rounded-full bg-secondary overflow-hidden">
                          <div
                            className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                            style={{
                              width: `${activeTotalQty > 0 ? Math.min(100, Math.round((activeDispatchedQty / activeTotalQty) * 100)) : 0}%`
                            }}
                          />
                        </div>
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

              {/* Pinned Footer: Destructive outline on left, Secondary + Primary on right */}
              <div className="p-4 border-t border-border bg-background flex justify-between items-center gap-3">
                <div>
                  {isAdmin && activeOrder.status !== 'Completed' && activeOrder.status !== 'Cancelled' && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-destructive/60 text-destructive hover:bg-destructive/10 hover:text-destructive"
                      onClick={() => {
                        setCloseShortOrderId(activeOrder.id);
                        setCloseShortReason('');
                      }}
                    >
                      Close order short
                    </Button>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-emerald-600 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10"
                    onClick={() => sendOrderWhatsApp(activeOrder, activeItems, activeParty)}
                  >
                    <MessageCircle className="w-3.5 h-3.5 mr-1" />
                    Share WhatsApp
                  </Button>
                  <Button variant="secondary" size="sm" onClick={() => downloadCsv(`order-${activeOrder.order_no}`, activeItems)}>
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
            <label className="toggle-check mb-5 flex items-center gap-2.5 cursor-pointer text-sm font-medium">
              <Checkbox checked={stock} onCheckedChange={checked => setStock(Boolean(checked))} />
              <span>Self-stocking run (internal factory inventory)</span>
            </label>

            {/* Section 1: Metadata */}
            <div className="form-section-title">1. Order Metadata</div>
            <div className="form-grid">
              <label className="form-wide">
                Client / Company
                <ThemedSelect
                  aria-label="Company"
                  name="party_id"
                  required={!stock}
                  disabled={stock}
                  placeholder={stock ? 'Self Stocking' : 'Select company'}
                  options={d.parties.map(p => ({ value: p.id, label: p.company_name }))}
                />
              </label>
              <label>
                Order Date
                <ThemedDatePicker aria-label="Order Date" name="order_date" defaultValue={today()} required />
              </label>
              <label>
                Target Delivery Date
                <ThemedDatePicker aria-label="Target Delivery Date" name="expected_date" defaultValue={today()} required />
              </label>
              <label>
                Intake Medium
                <ThemedSelect
                  aria-label="Order medium"
                  name="medium"
                  defaultValue="WhatsApp"
                  options={['WhatsApp', 'Call', 'Mail', 'Other']}
                />
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
                      <textarea
                        required
                        rows={2}
                        placeholder="L x W x H (inches / mm)"
                        value={l.size_dimensions}
                        onChange={e=>setLines(lines.map((x,i)=>i===index?{...x,size_dimensions:e.target.value}:x))}
                      />
                    </label>
                    <label>
                      Specification
                      <input
                        placeholder="Timber / Plywood type, thickness, finish, joint type"
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
                      <ThemedSelect
                        value={l.priority_signal}
                        onChange={val => setLines(lines.map((x,i)=>i===index?{...x,priority_signal:val}:x))}
                        options={['Red', 'Yellow', 'Green']}
                      />
                    </label>
                    <label className="form-wide">
                      Code / Item Remarks
                      <textarea
                        value={l.code_remarks}
                        placeholder="Stencil notes, hardware details, treatment, etc."
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
              <Button type="button" variant="outline" size="sm" onClick={()=>setLines([...lines,freshLine(lines.length+1)])}>
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

      {/* Close Order Short Dialog (Admin only) */}
      <Dialog open={!!closeShortOrderId} onOpenChange={(o) => { if (!o) setCloseShortOrderId(null); }}>
        <DialogContent className="modal-wide" aria-describedby={undefined}>
          <DialogTitle className="text-xl font-medium">Close Order Short</DialogTitle>
          <div className="form-subtitle">
            Mark order as fulfilled and cancel remaining unproduced/undispatched balance. Requires admin approval.
          </div>
          {(() => {
            const targetOrder = d.orders.find(o => o.id === closeShortOrderId);
            if (!targetOrder) return null;
            return (
              <form onSubmit={async (e) => {
                e.preventDefault();
                if (closeShortReason.trim().length < 5) return;
                setCloseShortBusy(true);
                const ok = await action('close_order_short', {
                  order_id: targetOrder.id,
                  reason: closeShortReason.trim()
                });
                setCloseShortBusy(false);
                if (ok) {
                  setCloseShortOrderId(null);
                  setCloseShortReason('');
                }
              }}>
                <div className="p-3 bg-card border border-border rounded-xl mb-4 text-xs">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-muted-foreground block">Order #</span>
                      <strong className="text-foreground text-sm">{targetOrder.order_no}</strong>
                    </div>
                    <div>
                      <span className="text-muted-foreground block">Client</span>
                      <strong className="text-foreground text-sm">{company(targetOrder.party_id)}</strong>
                    </div>
                    <div>
                      <span className="text-muted-foreground block">Current Status</span>
                      <Pill value={targetOrder.status} />
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-medium text-foreground block">
                    Reason for Closing Short (minimum 5 characters) *
                    <textarea
                      required
                      minLength={5}
                      rows={3}
                      value={closeShortReason}
                      onChange={(e) => setCloseShortReason(e.target.value)}
                      placeholder="e.g. Client requested delivery cancellation for remaining units."
                      className="w-full mt-1.5 p-2.5 rounded-lg border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </label>
                  {closeShortReason.trim().length > 0 && closeShortReason.trim().length < 5 && (
                    <p className="text-xs text-destructive">Reason must be at least 5 characters.</p>
                  )}
                </div>

                <div className="form-actions mt-5">
                  <Button type="button" variant="outline" onClick={() => setCloseShortOrderId(null)}>
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    variant="destructive"
                    disabled={closeShortBusy || closeShortReason.trim().length < 5}
                  >
                    {closeShortBusy ? 'Closing…' : 'Confirm Close Short'}
                  </Button>
                </div>
              </form>
            );
          })()}
        </DialogContent>
      </Dialog>
    </>
  );
}
