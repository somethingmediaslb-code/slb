import {VolumeCharts} from './volume-charts';
import {useState,useEffect} from 'react';
import {Printer,MessageCircle,FilePlus,Truck,CheckCircle2} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {Checkbox} from '@/components/ui/checkbox';
import {Dialog,DialogContent,DialogTitle} from '@/components/ui/dialog';
import {useFactory} from './provider';
import {Heading,Empty,AccessNotice,SearchFilter,ExportButton,Pill,ViewTabs,FilterToken,TableCalcBar,SegmentedMeter,Pagination,DateFilterPill,ThemedDatePicker} from './common';
import {downloadCsv,dateLabel,money,today,number,type Row} from '@/lib/erp-data';

export function Dispatch(){
  const {data:d,action}=useFactory();
  const [search,setSearch]=useState('');
  const [tab,setTab]=useState<'ready'|'history'>('ready');
  const [selected,setSelected]=useState<Row<'order_items'>|null>(null);
  const [print,setPrint]=useState<Row<'delivery_challans'>|null>(null);
  const [confirmDispatchChallan,setConfirmDispatchChallan]=useState<Row<'delivery_challans'>|null>(null);
  const [busy,setBusy]=useState(false);
  const [status,setStatus]=useState('All');
  const [historyFrom,setHistoryFrom]=useState('');
  const [historyTo,setHistoryTo]=useState('');
  const [historyCompany,setHistoryCompany]=useState('All');
  const [page,setPage]=useState(1);
  const pageSize=10;

  const ready=d.items.filter(i=>i.completed_qty>i.dispatched_qty+i.reserved_qty);
  const company=(orderId:string)=>{
    const o=d.orders.find(o=>o.id===orderId);
    return o?.is_self_stock?'Self Stocking':d.parties.find(p=>p.id===o?.party_id)?.company_name??'—';
  };

  const filteredReady=ready.filter(i=>(company(i.order_id)+' '+d.orders.find(o=>o.id===i.order_id)?.order_no+' '+i.box_type+' '+i.size_dimensions).toLowerCase().includes(search.toLowerCase()));

  const filteredHistory=d.challans.filter(c=>{
    const matchesStatus=status==='All'||c.status===status;
    const cPartyName=company(c.order_id);
    const matchesCompany=historyCompany==='All'||cPartyName===historyCompany;
    const dDate=c.dispatch_date?c.dispatch_date.slice(0,10):'';
    const matchesFrom=!historyFrom||(dDate&&dDate>=historyFrom);
    const matchesTo=!historyTo||(dDate&&dDate<=historyTo);
    const matchesSearch=(c.challan_number+' '+cPartyName+' '+(c.transport_carrier??'')+' '+(c.vehicle_number??'')+' '+(c.lr_number??'')).toLowerCase().includes(search.toLowerCase());
    return matchesStatus&&matchesCompany&&matchesFrom&&matchesTo&&matchesSearch;
  });

  useEffect(()=>{
    setPage(1);
  },[search,tab,status,historyFrom,historyTo,historyCompany]);

  const paginatedReady=filteredReady.slice((page-1)*pageSize,page*pageSize);
  const paginatedHistory=filteredHistory.slice((page-1)*pageSize,page*pageSize);

  const totalReadyQty=filteredReady.reduce((sum,i)=>sum+(i.completed_qty-i.dispatched_qty-i.reserved_qty),0);
  const totalDispatchedQty=filteredHistory
    .filter(c=>c.status==='Dispatched')
    .reduce((sum,c)=>{
      return sum+d.challanItems.filter(ci=>ci.challan_id===c.id).reduce((s,i)=>s+i.dispatched_qty,0);
    },0);

  async function submit(e:React.FormEvent<HTMLFormElement>){
    e.preventDefault();
    if(!selected)return;
    setBusy(true);
    const f=new FormData(e.currentTarget);
    const ok=await action('challan',{
      order_item_id:selected.id,
      dispatched_qty:Number(f.get('qty')),
      transport_carrier:String(f.get('transport_carrier')),
      vehicle_number:String(f.get('vehicle_number')),
      lr_number:String(f.get('lr_number')),
      freight_charges:Number(f.get('freight_charges')),
      dispatch_date:new Date(String(f.get('dispatch_date'))).toISOString()
    });
    setBusy(false);
    if(ok){
      setSelected(null);
      setTab('history');
    }
  }

  function whatsapp(c:Row<'delivery_challans'>){
    const order=d.orders.find(o=>o.id===c.order_id);
    const party=d.parties.find(p=>p.id===order?.party_id);
    const companyName=company(c.order_id);
    const lines=d.challanItems.filter(i=>i.challan_id===c.id).map((i,idx)=>{
      const item=d.items.find(x=>x.id===i.order_item_id);
      let details=`*Item #${item?.sr_no ?? (idx+1)}:* ${item?.box_type || 'Box'}`;
      if(item?.code_remarks) details+=`\n• Code / Remarks: ${item.code_remarks}`;
      if(item?.size_dimensions) details+=`\n• Size: ${item.size_dimensions}`;
      if(item?.specification) details+=`\n• Specification: ${item.specification}`;
      details+=`\n• Dispatched Qty: ${number(i.dispatched_qty)} units`;
      // STRICT PRIVACY RULE: NO rates, unit prices, or total amounts
      return details;
    });

    const text=[
      `*DELIVERY CHALLAN & DISPATCH NOTICE - SLBW*`,
      `--------------------------------`,
      `*Company / Party:* ${companyName}`,
      `*Order / PO No:* ${order?.order_no || '—'}`,
      `*Delivery Challan No:* ${c.challan_number}`,
      `*Dispatch Date:* ${dateLabel(c.dispatch_date)}`,
      c.transport_carrier ? `*Carrier:* ${c.transport_carrier}` : '',
      c.vehicle_number ? `*Vehicle:* ${c.vehicle_number}` : '',
      c.lr_number ? `*LR / Tracking:* ${c.lr_number}` : '',
      '',
      `*DISPATCHED ITEMS:*`,
      ...lines,
      '',
      `--------------------------------`,
      `*SLBW Logistics & Dispatch*`
    ].filter(Boolean).join('\n');

    const phone=party?.phone_number?.replace(/\D/g,'')??'';
    const url=phone ? `https://wa.me/${phone}?text=${encodeURIComponent(text)}` : `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url,'_blank','noopener,noreferrer');
  }

  return (
    <>
      <Heading title="Dispatch & Delivery Challan">
        <ExportButton onClick={()=>downloadCsv('delivery-challans',filteredHistory)}/>
      </Heading>

      <AccessNotice/>

      {/* View Tabs */}
      <ViewTabs
        tabs={[
          {id:'ready',label:'Ready to Dispatch',count:ready.length},
          {id:'history',label:'Challan History',count:d.challans.length},
        ]}
        active={tab}
        onChange={t=>setTab(t as 'ready'|'history')}
      />

      <div className="filters">
        <SearchFilter value={search} onChange={setSearch} placeholder="Search client, PO number or challan…"/>

        {tab==='history' && (
          <>
            <DateFilterPill label="From" value={historyFrom} onChange={setHistoryFrom} placeholder="All" />
            <DateFilterPill label="To" value={historyTo} onChange={setHistoryTo} placeholder="All" />
            <FilterToken
              label="Customer"
              value={historyCompany}
              onChange={setHistoryCompany}
              options={[
                {value:'All',label:'All Customers'},
                ...Array.from(new Set(d.challans.map(c=>company(c.order_id)))).map(name=>({value:name,label:name}))
              ]}
            />
            <FilterToken
              label="Challan Status"
              value={status}
              onChange={setStatus}
              options={[
                {value:'All',label:'All statuses'},
                {value:'Delivery Challan Made',label:'Challan Generated'},
                {value:'Dispatched',label:'Out for Delivery / Dispatched'},
                {value:'Cancelled',label:'Cancelled'},
              ]}
            />
          </>
        )}
      </div>

      {tab==='ready' ? (
        <>
          <div className="desktop-table-view table-wrap">
            <table>
              <thead>
                <tr>
                  <th className="w-8">
                    <Checkbox aria-label="Select all" />
                  </th>
                  <th>Client / PO</th>
                  <th>Box Type & Dimensions</th>
                  <th className="numeric">Ordered</th>
                  <th className="numeric">Produced</th>
                  <th className="numeric">Dispatched</th>
                  <th className="numeric">Ready to Dispatch</th>
                  <th>Fulfillment</th>
                  <th className="text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {paginatedReady.length ? paginatedReady.map(i=>{
                  const available=i.completed_qty-i.dispatched_qty-i.reserved_qty;
                  const partyName=company(i.order_id);
                  const monogram=partyName === 'Self Stocking' ? 'SS' : partyName.slice(0,2).toUpperCase();
                  return (
                    <tr key={i.id} className="clickable-row" onClick={()=>setSelected(i)}>
                      <td onClick={e=>e.stopPropagation()}>
                        <Checkbox aria-label={`Select ${i.box_type}`} />
                      </td>
                      <td>
                        <div className="flex items-center gap-2.5">
                          <span className="avatar !w-6 !h-6 !text-[10px] font-semibold">
                            {monogram}
                          </span>
                          <div>
                            <div className="font-medium text-foreground">{partyName}</div>
                            <div className="text-xs text-muted-foreground">{d.orders.find(o=>o.id===i.order_id)?.order_no || '—'}</div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{i.box_type}</span>
                          <span className="text-xs text-muted-foreground">({i.size_dimensions})</span>
                        </div>
                      </td>
                      <td className="numeric font-medium">{number(i.ordered_qty)}</td>
                      <td className="numeric text-muted-foreground">{number(i.completed_qty)}</td>
                      <td className="numeric text-muted-foreground">{number(i.dispatched_qty)}</td>
                      <td className="numeric font-medium text-foreground">{number(available)}</td>
                      <td>
                        <SegmentedMeter value={i.completed_qty} total={i.ordered_qty} />
                      </td>
                      <td className="text-right" onClick={e=>e.stopPropagation()}>
                        <Button size="sm" variant="outline" onClick={()=>setSelected(i)}>
                          <FilePlus className="w-3.5 h-3.5 mr-1"/> Create Challan
                        </Button>
                      </td>
                    </tr>
                  );
                }) : (
                  <Empty columns={9} label="No completed inventory awaiting dispatch"/>
                )}
              </tbody>
              <tfoot>
                <tr className="border-t border-border bg-muted/20 font-medium">
                  <td colSpan={3} className="text-right text-xs text-muted-foreground font-semibold px-3 py-2.5">
                    Ready Totals ({number(filteredReady.length)} items):
                  </td>
                  <td className="numeric text-muted-foreground px-3 py-2.5 tabular-nums">
                    {number(filteredReady.reduce((s,i)=>s+i.ordered_qty,0))}
                  </td>
                  <td className="numeric text-muted-foreground px-3 py-2.5 tabular-nums">
                    {number(filteredReady.reduce((s,i)=>s+i.completed_qty,0))}
                  </td>
                  <td className="numeric text-muted-foreground px-3 py-2.5 tabular-nums">
                    {number(filteredReady.reduce((s,i)=>s+i.dispatched_qty,0))}
                  </td>
                  <td className="numeric font-normal text-foreground px-3 py-2.5 tabular-nums">
                    {number(totalReadyQty)}
                  </td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Mobile Card View */}
          <div className="mobile-card-view">
            {paginatedReady.length ? paginatedReady.map(i => {
              const available=i.completed_qty-i.dispatched_qty-i.reserved_qty;
              const partyName=company(i.order_id);
              const monogram=partyName === 'Self Stocking' ? 'SS' : partyName.slice(0,2).toUpperCase();
              const orderNo = d.orders.find(o=>o.id===i.order_id)?.order_no || '—';
              return (
                <div key={i.id} className="mobile-record-card" onClick={()=>setSelected(i)}>
                  <div className="mobile-card-top">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="avatar !w-6 !h-6 !text-[10px] font-semibold flex-shrink-0">
                        {monogram}
                      </span>
                      <div className="min-w-0">
                        <div className="mobile-card-title">{partyName}</div>
                        <div className="mobile-card-sub">{orderNo} · {i.box_type}</div>
                      </div>
                    </div>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-500/10 text-emerald-500">
                      {number(available)} Ready
                    </span>
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
                      <span className="mobile-card-label">Produced</span>
                      <span className="mobile-card-value">{number(i.completed_qty)}</span>
                    </div>
                    <div className="mobile-card-field">
                      <span className="mobile-card-label">Dispatched</span>
                      <span className="mobile-card-value">{number(i.dispatched_qty)}</span>
                    </div>
                    <div className="mobile-card-field">
                      <span className="mobile-card-label">Fulfillment</span>
                      <span className="mobile-card-value">{Math.round((i.completed_qty / (i.ordered_qty || 1)) * 100)}%</span>
                    </div>
                  </div>

                  <div className="mobile-card-actions">
                    <Button size="sm" variant="outline" className="w-full" onClick={(e)=>{ e.stopPropagation(); setSelected(i); }}>
                      <FilePlus className="w-3.5 h-3.5 mr-1"/> Create Delivery Challan
                    </Button>
                  </div>
                </div>
              );
            }) : (
              <Empty columns={1} label="No completed inventory awaiting dispatch" />
            )}
          </div>

          <Pagination
            currentPage={page}
            totalItems={filteredReady.length}
            pageSize={pageSize}
            onPageChange={setPage}
          />

        </>
      ) : (
        <>
          <div className="desktop-table-view table-wrap">
            <table>
              <thead>
                <tr>
                  <th className="w-8">
                    <Checkbox aria-label="Select all" />
                  </th>
                  <th>Challan Number</th>
                  <th>Customer / Account</th>
                  <th>Dispatch Date</th>
                  <th>Transporter Carrier</th>
                  <th>Vehicle #</th>
                  <th>LR #</th>
                  <th className="numeric">Freight (₹)</th>
                  <th className="numeric">Total Shipped</th>
                  <th>Delivery Status</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedHistory.length ? paginatedHistory.map(c=>{
                  const shipped=d.challanItems.filter(i=>i.challan_id===c.id).reduce((s,i)=>s+i.dispatched_qty,0);
                  const partyName=company(c.order_id);
                  const monogram=partyName === 'Self Stocking' ? 'SS' : partyName.slice(0,2).toUpperCase();
                  return (
                    <tr key={c.id}>
                      <td onClick={e=>e.stopPropagation()}>
                        <Checkbox aria-label={`Select ${c.challan_number}`} />
                      </td>
                      <td className="font-medium text-foreground">{c.challan_number}</td>
                      <td>
                        <div className="flex items-center gap-2.5">
                          <span className="avatar !w-6 !h-6 !text-[10px] font-semibold">
                            {monogram}
                          </span>
                          <span className="font-medium text-foreground">{partyName}</span>
                        </div>
                      </td>
                      <td>{dateLabel(c.dispatch_date)}</td>
                      <td>{c.transport_carrier||'—'}</td>
                      <td>{c.vehicle_number||'—'}</td>
                      <td>{c.lr_number||'—'}</td>
                      <td className="numeric text-muted-foreground">{money(c.freight_charges||0)}</td>
                      <td className="numeric font-medium text-foreground">{number(shipped)}</td>
                      <td><Pill value={c.status}/></td>
                      <td className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          {c.status==='Delivery Challan Made' && (
                            <>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={()=>setConfirmDispatchChallan(c)}
                              >
                                <CheckCircle2 className="w-3.5 h-3.5 mr-1"/> Confirm Dispatch
                              </Button>
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={async () => {
                                  if (window.confirm(`Are you sure you want to cancel ${c.challan_number}? This will immediately release reserved completed boxes back to inventory.`)) {
                                    await action('cancel_challan', { id: c.id });
                                  }
                                }}
                              >
                                Cancel challan
                              </Button>
                            </>
                          )}
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label="Print challan"
                            title="Print delivery challan"
                            onClick={()=>setPrint(c)}
                          >
                            <Printer className="w-4 h-4"/>
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label="Send WhatsApp alert"
                            title="Send dispatch WhatsApp alert"
                            disabled={c.status!=='Dispatched'}
                            onClick={()=>whatsapp(c)}
                          >
                            <MessageCircle className="w-4 h-4"/>
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                }) : (
                  <Empty columns={11} label="No delivery challans generated yet"/>
                )}
              </tbody>
              <tfoot>
                <tr className="border-t border-border bg-muted/20 font-medium">
                  <td colSpan={7} className="text-right text-xs text-muted-foreground font-medium px-3 py-2.5">
                    History Totals ({number(filteredHistory.length)} challans):
                  </td>
                  <td className="numeric font-normal text-foreground px-3 py-2.5 tabular-nums">
                    {money(filteredHistory.reduce((s,c)=>s+(c.freight_charges??0),0))}
                  </td>
                  <td className="numeric font-normal text-foreground px-3 py-2.5 tabular-nums">
                    {number(totalDispatchedQty)}
                  </td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Mobile Card View */}
          <div className="mobile-card-view">
            {paginatedHistory.length ? paginatedHistory.map(c => {
              const shipped=d.challanItems.filter(i=>i.challan_id===c.id).reduce((s,i)=>s+i.dispatched_qty,0);
              const partyName=company(c.order_id);
              const monogram=partyName === 'Self Stocking' ? 'SS' : partyName.slice(0,2).toUpperCase();
              return (
                <div key={c.id} className="mobile-record-card">
                  <div className="mobile-card-top">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="avatar !w-6 !h-6 !text-[10px] font-semibold flex-shrink-0">
                        {monogram}
                      </span>
                      <div className="min-w-0">
                        <div className="mobile-card-title">{c.challan_number}</div>
                        <div className="mobile-card-sub">{partyName}</div>
                      </div>
                    </div>
                    <Pill value={c.status}/>
                  </div>

                  <div className="mobile-card-grid">
                    <div className="mobile-card-field">
                      <span className="mobile-card-label">Dispatch Date</span>
                      <span className="mobile-card-value">{dateLabel(c.dispatch_date)}</span>
                    </div>
                    <div className="mobile-card-field">
                      <span className="mobile-card-label">Shipped Qty</span>
                      <span className="mobile-card-value font-semibold">{number(shipped)}</span>
                    </div>
                    <div className="mobile-card-field">
                      <span className="mobile-card-label">Carrier</span>
                      <span className="mobile-card-value">{c.transport_carrier || '—'}</span>
                    </div>
                    <div className="mobile-card-field">
                      <span className="mobile-card-label">Vehicle #</span>
                      <span className="mobile-card-value">{c.vehicle_number || '—'}</span>
                    </div>
                    <div className="mobile-card-field">
                      <span className="mobile-card-label">LR / Consignment #</span>
                      <span className="mobile-card-value">{c.lr_number || '—'}</span>
                    </div>
                    <div className="mobile-card-field">
                      <span className="mobile-card-label">Freight Charges</span>
                      <span className="mobile-card-value text-muted-foreground">{money(c.freight_charges || 0)}</span>
                    </div>
                  </div>

                  <div className="mobile-card-actions flex gap-2 pt-1">
                    {c.status==='Delivery Challan Made' && (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1"
                          onClick={()=>setConfirmDispatchChallan(c)}
                        >
                          <CheckCircle2 className="w-3.5 h-3.5 mr-1"/> Confirm Dispatch
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1 text-destructive hover:bg-destructive/10"
                          onClick={async () => {
                            if (window.confirm(`Are you sure you want to cancel ${c.challan_number}? This will immediately release reserved completed boxes back to inventory.`)) {
                              await action('cancel_challan', { id: c.id });
                            }
                          }}
                        >
                          Cancel challan
                        </Button>
                      </>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={()=>setPrint(c)}
                    >
                      <Printer className="w-3.5 h-3.5 mr-1"/> Print
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={c.status!=='Dispatched'}
                      onClick={()=>whatsapp(c)}
                    >
                      <MessageCircle className="w-3.5 h-3.5"/>
                    </Button>
                  </div>
                </div>
              );
            }) : (
              <Empty columns={1} label="No delivery challans generated yet"/>
            )}
          </div>

          <Pagination
            currentPage={page}
            totalItems={filteredHistory.length}
            pageSize={pageSize}
            onPageChange={setPage}
          />

        </>
      )}

      <VolumeCharts dispatch/>

      {/* Create Delivery Challan Dialog */}
      <Dialog open={!!selected} onOpenChange={()=>setSelected(null)}>
        <DialogContent className="modal-wide" aria-describedby={undefined}>
          <DialogTitle className="text-xl font-medium">Create Delivery Challan</DialogTitle>
          <div className="form-subtitle">
            Generate transport manifest and deduct stock for {selected?.box_type}.
          </div>

          <form onSubmit={submit}>
            <div className="form-grid">
              <label>
                Quantity to Dispatch
                <input
                  name="qty"
                  type="number"
                  min={1}
                  max={selected ? selected.completed_qty - selected.dispatched_qty - selected.reserved_qty : 1}
                  required
                  defaultValue={selected ? selected.completed_qty - selected.dispatched_qty - selected.reserved_qty : 1}
                />
              </label>

              <label>
                Dispatch Date
                <ThemedDatePicker name="dispatch_date" defaultValue={today()} required />
              </label>

              <label>
                Transporter / Carrier Name
                <input name="transport_carrier" placeholder="e.g. VRL Logistics, Self Pickup" required/>
              </label>

              <label>
                Vehicle Number
                <input name="vehicle_number" placeholder="e.g. MH-12-AB-1234"/>
              </label>

              <label>
                LR / Consignment Number
                <input name="lr_number" placeholder="Tracking / LR #"/>
              </label>

              <label>
                Freight Charges (₹)
                <input name="freight_charges" type="number" min={0} step=".01" defaultValue={0} required/>
              </label>
            </div>

            <div className="form-actions">
              <Button variant="outline" type="button" onClick={()=>setSelected(null)}>Cancel</Button>
              <Button type="submit" disabled={busy}>{busy?'Generating…':'Generate Challan'}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Print Challan Dialog */}
      <Dialog open={!!print} onOpenChange={()=>setPrint(null)}>
        <DialogContent className="modal-wide" aria-describedby={undefined}>
          <DialogTitle className="text-xl font-medium">Delivery Challan · {print?.challan_number}</DialogTitle>
          {print && (
            <>
              <div className="p-4 bg-secondary/50 border border-border rounded-lg my-3 grid grid-cols-3 gap-3 text-xs">
                <div>
                  <span className="text-muted-foreground block">Customer</span>
                  <strong className="text-foreground text-sm font-medium">{company(print.order_id)}</strong>
                </div>
                <div>
                  <span className="text-muted-foreground block">Order / PO</span>
                  <strong className="text-foreground text-sm font-medium">
                    {d.orders.find(o=>o.id===print.order_id)?.order_no || '—'}
                  </strong>
                </div>
                <div>
                  <span className="text-muted-foreground block">Dispatch Date</span>
                  <strong className="text-foreground text-sm font-medium">{dateLabel(print.dispatch_date)}</strong>
                </div>
                <div>
                  <span className="text-muted-foreground block">Transporter</span>
                  <span className="text-foreground font-medium">{print.transport_carrier}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block">Vehicle No.</span>
                  <span className="text-foreground">{print.vehicle_number || '—'}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block">LR Number</span>
                  <span className="text-foreground">{print.lr_number || '—'}</span>
                </div>
              </div>

              <div className="table-wrap my-3">
                <table>
                  <thead>
                    <tr>
                      <th>Serial</th>
                      <th>Box Type</th>
                      <th>Dimensions</th>
                      <th>Dispatched Qty</th>
                    </tr>
                  </thead>
                  <tbody>
                    {d.challanItems.filter(i=>i.challan_id===print.id).map(i=>{
                      const item=d.items.find(x=>x.id===i.order_item_id);
                      return (
                        <tr key={i.id}>
                          <td>#{item?.sr_no}</td>
                          <td className="font-medium">{item?.box_type}</td>
                          <td className="text-muted-foreground">{item?.size_dimensions}</td>
                          <td className="numeric font-semibold">{number(i.dispatched_qty)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-end gap-2 mt-4">
                <Button variant="outline" onClick={()=>setPrint(null)}>Close</Button>
                <Button onClick={()=>window.print()}>
                  <Printer className="w-4 h-4 mr-1"/> Print Challan
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Explicit Confirm Dispatch Step Dialog */}
      <Dialog open={!!confirmDispatchChallan} onOpenChange={()=>setConfirmDispatchChallan(null)}>
        <DialogContent className="modal-wide" aria-describedby={undefined}>
          <DialogTitle className="text-xl font-medium">Confirm Physical Dispatch · {confirmDispatchChallan?.challan_number}</DialogTitle>
          <div className="form-subtitle">
            Confirm that the shipment has physically departed the factory floor. This transitions status to Dispatched and finalizes inventory deductions.
          </div>
          {confirmDispatchChallan && (
            <div className="space-y-4 my-4">
              <div className="p-4 bg-card border border-border rounded-xl grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div>
                  <span className="text-muted-foreground block">Customer / Party</span>
                  <strong className="text-sm font-semibold text-foreground">{company(confirmDispatchChallan.order_id)}</strong>
                </div>
                <div>
                  <span className="text-muted-foreground block">Dispatch Date</span>
                  <span className="text-sm font-medium text-foreground">{dateLabel(confirmDispatchChallan.dispatch_date)}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block">Current Status</span>
                  <Pill value={confirmDispatchChallan.status}/>
                </div>
                <div>
                  <span className="text-muted-foreground block">Carrier</span>
                  <span className="text-sm font-medium text-foreground">{confirmDispatchChallan.transport_carrier||'Direct / Self'}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block">Vehicle Number</span>
                  <span className="text-sm font-medium text-foreground">{confirmDispatchChallan.vehicle_number||'—'}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block">LR / Consignment #</span>
                  <span className="text-sm font-medium text-foreground">{confirmDispatchChallan.lr_number||'—'}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block">Freight Charges</span>
                  <span className="text-sm font-medium text-foreground">{money(confirmDispatchChallan.freight_charges||0)}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block">Total Boxes</span>
                  <span className="text-sm font-semibold text-foreground">
                    {number(d.challanItems.filter(i=>i.challan_id===confirmDispatchChallan.id).reduce((s,i)=>s+i.dispatched_qty,0))} units
                  </span>
                </div>
              </div>

              <div className="form-actions">
                <Button variant="outline" type="button" onClick={()=>setConfirmDispatchChallan(null)}>
                  Cancel
                </Button>
                <Button
                  disabled={busy}
                  onClick={async()=>{
                    setBusy(true);
                    const ok=await action('dispatch',{id:confirmDispatchChallan.id});
                    setBusy(false);
                    if(ok)setConfirmDispatchChallan(null);
                  }}
                >
                  {busy?'Confirming…':'Confirm Dispatch & Depart'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
