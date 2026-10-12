import {VolumeCharts} from './volume-charts';
import {useState} from 'react';
import {Printer,MessageCircle,FilePlus,Truck,CheckCircle2} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {Dialog,DialogContent,DialogTitle} from '@/components/ui/dialog';
import {useFactory} from './provider';
import {Heading,Empty,AccessNotice,SearchFilter,ExportButton,Pill,ViewTabs,FilterToken,TableCalcBar,SegmentedMeter,MiniSparkline} from './common';
import {downloadCsv,dateLabel,money,today,number,type Row} from '@/lib/erp-data';

export function Dispatch(){
  const {data:d,action}=useFactory();
  const [search,setSearch]=useState('');
  const [tab,setTab]=useState<'ready'|'history'>('ready');
  const [selected,setSelected]=useState<Row<'order_items'>|null>(null);
  const [print,setPrint]=useState<Row<'delivery_challans'>|null>(null);
  const [busy,setBusy]=useState(false);
  const [status,setStatus]=useState('All');

  const ready=d.items.filter(i=>i.completed_qty>i.dispatched_qty+i.reserved_qty);
  const company=(orderId:string)=>{
    const o=d.orders.find(o=>o.id===orderId);
    return o?.is_self_stock?'Self Stocking':d.parties.find(p=>p.id===o?.party_id)?.company_name??'—';
  };

  const filteredReady=ready.filter(i=>(company(i.order_id)+' '+d.orders.find(o=>o.id===i.order_id)?.order_no+' '+i.box_type+' '+i.size_dimensions).toLowerCase().includes(search.toLowerCase()));

  const filteredHistory=d.challans.filter(c=>{
    const matchesStatus=status==='All'||c.status===status;
    const matchesSearch=(c.challan_number+' '+company(c.order_id)+' '+(c.transport_carrier??'')).toLowerCase().includes(search.toLowerCase());
    return matchesStatus&&matchesSearch;
  });

  const totalReadyQty=filteredReady.reduce((sum,i)=>sum+(i.completed_qty-i.dispatched_qty-i.reserved_qty),0);
  const totalDispatchedQty=filteredHistory.reduce((sum,c)=>{
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
    const lines=d.challanItems.filter(i=>i.challan_id===c.id).map(i=>{
      const item=d.items.find(x=>x.id===i.order_item_id);
      return 'Item '+item?.sr_no+': '+item?.box_type+', '+item?.size_dimensions+', dispatched quantity '+i.dispatched_qty;
    });
    const text=[company(c.order_id),'PO: '+order?.order_no,'Challan: '+c.challan_number,...lines].join('\n');
    const phone=party?.phone_number?.replace(/\D/g,'')??'';
    window.open('https://wa.me/'+phone+'?text='+encodeURIComponent(text),'_blank','noopener,noreferrer');
  }

  return (
    <>
      <Heading title="Dispatch & Delivery">
        <ExportButton onClick={()=>downloadCsv('delivery-challans',filteredHistory)}/>
      </Heading>

      <AccessNotice/>

      {/* View Tabs */}
      <ViewTabs
        tabs={[
          {id:'ready',label:'Awaiting Dispatch',count:ready.length},
          {id:'history',label:'Challan History',count:d.challans.length},
        ]}
        active={tab}
        onChange={t=>setTab(t as 'ready'|'history')}
      />

      <div className="filters">
        <SearchFilter value={search} onChange={setSearch} placeholder="Search client, PO number or challan…"/>

        {tab==='history' && (
          <FilterToken
            label="Challan Status"
            value={status}
            onChange={setStatus}
            options={[
              {value:'All',label:'All statuses'},
              {value:'Delivery Challan Made',label:'Challan Generated'},
              {value:'Dispatched',label:'Out for Delivery / Dispatched'},
            ]}
          />
        )}
      </div>

      {tab==='ready' ? (
        <>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th className="w-8">
                    <input type="checkbox" className="w-3.5 h-3.5 rounded border-border" aria-label="Select all" readOnly />
                  </th>
                  <th>Client / PO</th>
                  <th>Box Type & Dimensions</th>
                  <th className="numeric">Ordered</th>
                  <th className="numeric">Produced</th>
                  <th className="numeric">Dispatched</th>
                  <th className="numeric">Ready to Ship</th>
                  <th>Fulfillment</th>
                  <th>Trend</th>
                  <th className="text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredReady.length ? filteredReady.map(i=>{
                  const available=i.completed_qty-i.dispatched_qty-i.reserved_qty;
                  const partyName=company(i.order_id);
                  const monogram=partyName === 'Self Stocking' ? 'SS' : partyName.slice(0,2).toUpperCase();
                  return (
                    <tr key={i.id} className="clickable-row" onClick={()=>setSelected(i)}>
                      <td onClick={e=>e.stopPropagation()}>
                        <input type="checkbox" className="w-3.5 h-3.5 rounded border-border" aria-label={`Select ${i.box_type}`} />
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
                      <td>
                        <MiniSparkline />
                      </td>
                      <td className="text-right" onClick={e=>e.stopPropagation()}>
                        <Button size="sm" variant="outline" onClick={()=>setSelected(i)}>
                          <FilePlus className="w-3.5 h-3.5 mr-1"/> Create Challan
                        </Button>
                      </td>
                    </tr>
                  );
                }) : (
                  <Empty columns={10} label="No completed inventory awaiting dispatch"/>
                )}
              </tbody>
            </table>
          </div>

          <TableCalcBar
            count={filteredReady.length}
            entityName="items"
            stats={[
              {label:'Ready to Dispatch',value:`${number(totalReadyQty)} boxes`},
            ]}
          />
        </>
      ) : (
        <>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th className="w-8">
                    <input type="checkbox" className="w-3.5 h-3.5 rounded border-border" aria-label="Select all" readOnly />
                  </th>
                  <th>Challan Number</th>
                  <th>Customer / Account</th>
                  <th>Dispatch Date</th>
                  <th>Transporter Carrier</th>
                  <th>Vehicle #</th>
                  <th className="numeric">Total Shipped</th>
                  <th>Status</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredHistory.length ? filteredHistory.map(c=>{
                  const shipped=d.challanItems.filter(i=>i.challan_id===c.id).reduce((s,i)=>s+i.dispatched_qty,0);
                  const partyName=company(c.order_id);
                  const monogram=partyName === 'Self Stocking' ? 'SS' : partyName.slice(0,2).toUpperCase();
                  return (
                    <tr key={c.id}>
                      <td onClick={e=>e.stopPropagation()}>
                        <input type="checkbox" className="w-3.5 h-3.5 rounded border-border" aria-label={`Select ${c.challan_number}`} />
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
                      <td className="numeric font-medium text-foreground">{number(shipped)}</td>
                      <td><Pill value={c.status}/></td>
                      <td className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          {c.status==='Delivery Challan Made' && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={()=>{
                                if(window.confirm('Confirm this delivery has physically departed?')) {
                                  action('dispatch',{id:c.id});
                                }
                              }}
                            >
                              <CheckCircle2 className="w-3.5 h-3.5 mr-1"/> Confirm Exit
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label="Print challan"
                            title="Print delivery challan"
                            onClick={()=>setPrint(c)}
                          >
                            <Printer className="w-4 h-4"/>
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
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
                  <Empty columns={9} label="No delivery challans generated yet"/>
                )}
              </tbody>
            </table>
          </div>

          <TableCalcBar
            count={filteredHistory.length}
            entityName="challans"
            stats={[
              {label:'Total Dispatched',value:`${number(totalDispatchedQty)} boxes`},
            ]}
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
                <input name="dispatch_date" type="date" defaultValue={today()} required/>
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
    </>
  );
}
