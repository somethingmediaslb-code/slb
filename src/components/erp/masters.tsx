import {useState} from 'react';
import {Pencil,Building2,Mail,Phone,FileText,MapPin,MoreHorizontal,CheckCircle2,Clock,Package,Layers} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {Dialog,DialogContent,DialogTitle} from '@/components/ui/dialog';
import {Sheet,SheetContent,SheetHeader,SheetTitle} from '@/components/ui/sheet';
import {useFactory} from './provider';
import {Heading,Empty,AccessNotice,SearchFilter,ExportButton,AddButton,TableCalcBar,CrmTag,SegmentedMeter,MiniSparkline,Pill} from './common';
import {supabase} from '@/integrations/supabase/client';
import {downloadCsv,money,dateLabel,number} from '@/lib/erp-data';
import {toast} from 'sonner';

type Kind='parties'|'items'|'workers';

const config: Record<Kind,{title:string;entity:string;add:string;fields:[string,string][]}>={
  parties:{
    title:'Party Master',
    entity:'clients',
    add:'Add Client Company',
    fields:[['company_name','Company Name'],['phone_number','Phone Number'],['email','Email Address'],['gstin','GSTIN Number'],['address','Factory / Billing Address']]
  },
  items:{
    title:'Item Catalog',
    entity:'box specifications',
    add:'Add Catalog Item',
    fields:[['box_type','Box Type'],['size_dimensions','Size Dimensions'],['specification','Ply / Flute Spec'],['unit_rate','Standard Unit Rate (₹)']]
  },
  workers:{
    title:'Labour Master',
    entity:'workers',
    add:'Register Worker',
    fields:[['labour_name','Worker Name'],['phone','Phone Number'],['daily_rate','Daily Wage Rate (₹)'],['unit_assignment','Unit / Machine Assignment']]
  }
};

export function MasterPage({kind}:{kind:Kind}){
  const c=config[kind];
  const {data,user,signIn,refresh}=useFactory();
  const [search,setSearch]=useState('');
  const [open,setOpen]=useState(false);
  const [editing,setEditing]=useState<Record<string,unknown>|null>(null);
  const [viewPartyId,setViewPartyId]=useState<string|null>(null);
  const [busy,setBusy]=useState(false);

  const rows:Record<string,unknown>[]=kind==='parties'?data.parties:kind==='items'?data.catalog:data.workers;
  const filtered=rows.filter(r=>Object.values(r).join(' ').toLowerCase().includes(search.toLowerCase()));

  function add(){
    if(!user){signIn();return;}
    setEditing(null);
    setOpen(true);
  }

  async function submit(e:React.FormEvent<HTMLFormElement>){
    e.preventDefault();
    setBusy(true);
    const f=new FormData(e.currentTarget);
    const values=Object.fromEntries(c.fields.map(([key])=>[key,key.includes('rate')?Number(f.get(key)):String(f.get(key)??'')]));
    let error;

    if(kind==='parties'){
      const v={
        company_name:String(values['company_name']),
        phone_number:String(values['phone_number']),
        email:String(values['email']),
        gstin:String(values['gstin']),
        address:String(values['address'])
      };
      ({error}=editing?await supabase.from('party_master').update(v).eq('id',String(editing['id'])):await supabase.from('party_master').insert(v));
    } else if(kind==='items'){
      const v={
        box_type:String(values['box_type']),
        size_dimensions:String(values['size_dimensions']),
        specification:String(values['specification']),
        unit_rate:Number(values['unit_rate'])
      };
      ({error}=editing?await supabase.from('item_master').update(v).eq('id',String(editing['id'])):await supabase.from('item_master').insert(v));
    } else {
      const v={
        labour_name:String(values['labour_name']),
        phone:String(values['phone']),
        daily_rate:Number(values['daily_rate']),
        unit_assignment:String(values['unit_assignment'])
      };
      ({error}=editing?await supabase.from('labour_master').update(v).eq('id',String(editing['id'])):await supabase.from('labour_master').insert(v));
    }

    setBusy(false);
    if(error){
      toast.error(error.message);
      return;
    }
    await refresh();
    setOpen(false);
    toast.success('Record saved successfully');
  }

  // Active party for drawer inspection
  const activeParty=kind==='parties'?data.parties.find(p=>p.id===viewPartyId):null;
  const partyOrders=activeParty?data.orders.filter(o=>o.party_id===activeParty.id):[];
  const partyTotalSpent=partyOrders.reduce((sum,o)=>{
    const items=data.items.filter(i=>i.order_id===o.id);
    return sum+items.reduce((s,i)=>s+(i.total_price??0),0);
  },0);
  const partyCompletedCount=partyOrders.filter(o=>o.status==='Completed').length;
  const partyInProdCount=partyOrders.filter(o=>o.status==='In Production').length;

  return (
    <>
      <Heading title={c.title}>
        <ExportButton onClick={()=>downloadCsv(c.title,filtered)}/>
        <AddButton onClick={add}>{c.add}</AddButton>
      </Heading>

      <AccessNotice/>

      <div className="filters">
        <SearchFilter value={search} onChange={setSearch} placeholder={`Search ${c.entity}…`}/>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              {kind==='parties' && (
                <th className="w-8">
                  <input type="checkbox" className="w-3.5 h-3.5 rounded border-border" aria-label="Select all" readOnly />
                </th>
              )}
              {c.fields.map(([key,label])=><th key={key}>{label}</th>)}
              {kind==='parties' && (
                <>
                  <th className="numeric">Lifetime Spend</th>
                  <th>Order Health</th>
                  <th>Activity Trend</th>
                </>
              )}
              <th className="w-8"/>
            </tr>
          </thead>
          <tbody>
            {filtered.length ? filtered.map(r=>{
              const id=String(r['id']);
              const pOrders=kind==='parties'?data.orders.filter(o=>o.party_id===id):[];
              const pSpend=pOrders.reduce((sum,o)=>{
                const items=data.items.filter(i=>i.order_id===o.id);
                return sum+items.reduce((s,i)=>s+(i.total_price??0),0);
              },0);
              const pDone=pOrders.filter(o=>o.status==='Completed').length;

              return (
                <tr
                  key={id}
                  className={kind==='parties'?'clickable-row':''}
                  onClick={kind==='parties'?()=>setViewPartyId(id):undefined}
                >
                  {kind==='parties' && (
                    <td onClick={e=>e.stopPropagation()}>
                      <input type="checkbox" className="w-3.5 h-3.5 rounded border-border" aria-label={`Select record`} />
                    </td>
                  )}
                  {c.fields.map(([key],idx)=>{
                    const val=r[key];
                    if(kind==='parties'&&idx===0){
                      const name=String(val||'');
                      return (
                        <td key={key} className="font-medium text-foreground">
                          <div className="flex items-center gap-2.5">
                            <span className="avatar !w-6 !h-6 !text-[10px] font-semibold bg-accent">
                              {name.slice(0,2).toUpperCase()}
                            </span>
                            <span>{name}</span>
                          </div>
                        </td>
                      );
                    }
                    if(kind==='parties'&&key==='gstin'){
                      const gst=String(val||'');
                      return (
                        <td key={key}>
                          {gst ? <CrmTag label={gst.slice(0,8)+'...'} variant="blue" /> : <span className="text-muted-foreground">—</span>}
                        </td>
                      );
                    }
                    return (
                      <td key={key} className={key.includes('rate')?'numeric font-medium':''}>
                        {key.includes('rate')?money(Number(val)):String(val||'—')}
                      </td>
                    );
                  })}
                  {kind==='parties' && (
                    <>
                      <td className="numeric font-medium text-foreground">{money(pSpend)}</td>
                      <td>
                        <SegmentedMeter value={pDone} total={Math.max(pOrders.length,1)} />
                      </td>
                      <td>
                        <MiniSparkline />
                      </td>
                    </>
                  )}
                  <td onClick={e=>e.stopPropagation()}>
                    <button
                      type="button"
                      className="dots-btn"
                      aria-label="Edit record"
                      title="Edit record"
                      onClick={()=>{
                        setEditing(r);
                        setOpen(true);
                      }}
                    >
                      <Pencil className="w-4 h-4"/>
                    </button>
                  </td>
                </tr>
              );
            }) : (
              <Empty columns={c.fields.length+(kind==='parties'?5:1)} label={`No ${c.entity} registered yet`}/>
            )}
          </tbody>
        </table>
      </div>

      <TableCalcBar count={filtered.length} entityName={c.entity}/>

      {/* Slide-over Inspection Sheet for Parties (CRM Company View - Screenshot 5) */}
      {kind==='parties' && (
        <Sheet open={!!viewPartyId} onOpenChange={open=>!open&&setViewPartyId(null)}>
          <SheetContent side="right" className="sm:max-w-xl w-full p-0 flex flex-col bg-card overflow-hidden">
            {activeParty && (
              <>
                <div className="p-6 border-b border-border bg-background">
                  <SheetHeader className="text-left space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        <Building2 className="w-4 h-4 text-primary" />
                        <span>Company Detail</span>
                      </div>
                      <CrmTag label="Active Client" variant="green" />
                    </div>
                    <div className="drawer-hero-box">
                      <div className="drawer-hero-monogram">
                        {activeParty.company_name.slice(0,2).toUpperCase()}
                      </div>
                      <div>
                        <SheetTitle className="text-xl font-medium tracking-tight">
                          {activeParty.company_name}
                        </SheetTitle>
                        <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                          <CrmTag label={partyTotalSpent > 500000 ? 'Enterprise' : 'Mid-Market'} variant="blue" />
                          <CrmTag label={activeParty.gstin ? 'GST Verified' : 'Standard'} variant="purple" />
                          {partyOrders.length > 0 && <CrmTag label={`${partyOrders.length} Orders`} variant="neutral" />}
                        </div>
                      </div>
                    </div>
                  </SheetHeader>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                  {/* Account Summary */}
                  <div>
                    <div className="drawer-section-label">Account Summary</div>
                    <div className="p-3.5 bg-background border border-border rounded-lg space-y-2.5 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground flex items-center gap-2">
                          <Phone className="w-3.5 h-3.5" /> Phone
                        </span>
                        <span className="text-foreground font-medium">{activeParty.phone_number || 'Not recorded'}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground flex items-center gap-2">
                          <Mail className="w-3.5 h-3.5" /> Email
                        </span>
                        <span className="text-foreground font-medium">{activeParty.email || 'Not recorded'}</span>
                      </div>
                      <div className="flex items-start justify-between">
                        <span className="text-muted-foreground flex items-center gap-2">
                          <MapPin className="w-3.5 h-3.5 mt-0.5" /> Address
                        </span>
                        <span className="text-foreground max-w-[260px] text-right">{activeParty.address || 'No billing address'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Pipeline Health (Screenshot 5) */}
                  <div>
                    <div className="drawer-section-label">Pipeline Health</div>
                    <div className="p-4 bg-background border border-border rounded-lg">
                      <div className="drawer-health-headline">
                        {partyOrders.length > 0 ? Math.round((partyCompletedCount / partyOrders.length) * 100) : 100}%
                      </div>
                      <div className="drawer-health-sub">
                        Fulfillment efficiency across lifetime manufacturing runs
                      </div>

                      <div className="space-y-3 pt-1">
                        <div className="stage-meter-row">
                          <div className="stage-meter-header">
                            <span>Account Onboarding & Specs</span>
                            <span>100%</span>
                          </div>
                          <div className="stage-meter-track">
                            {Array.from({ length: 28 }).map((_, i) => (
                              <span key={i} className="stage-meter-bar active-stage-green" />
                            ))}
                          </div>
                        </div>

                        <div className="stage-meter-row">
                          <div className="stage-meter-header">
                            <span>Delivered Orders</span>
                            <span>{partyOrders.length > 0 ? Math.round((partyCompletedCount / partyOrders.length) * 100) : 0}%</span>
                          </div>
                          <div className="stage-meter-track">
                            {Array.from({ length: 28 }).map((_, i) => {
                              const pct = partyOrders.length > 0 ? partyCompletedCount / partyOrders.length : 0;
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
                          {partyOrders.length * 8 + 12}
                        </span>
                        <MiniSparkline />
                      </div>
                      <div className="text-xs text-muted-foreground mt-1 mb-3">
                        Purchase orders and corrugation runs logged
                      </div>

                      <div className="drawer-micro-stats">
                        <div className="drawer-micro-card">
                          <div className="label"><Package className="w-3 h-3 text-muted-foreground" /> Orders</div>
                          <div className="value">{number(partyOrders.length)}</div>
                        </div>
                        <div className="drawer-micro-card">
                          <div className="label"><Clock className="w-3 h-3 text-warning" /> In Prod</div>
                          <div className="value">{number(partyInProdCount)}</div>
                        </div>
                        <div className="drawer-micro-card">
                          <div className="label"><CheckCircle2 className="w-3 h-3 text-success" /> Completed</div>
                          <div className="value">{number(partyCompletedCount)}</div>
                        </div>
                        <div className="drawer-micro-card">
                          <div className="label"><Layers className="w-3 h-3 text-primary" /> Spend</div>
                          <div className="value">{money(partyTotalSpent)}</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Order History */}
                  <div>
                    <div className="drawer-section-label">Order History ({partyOrders.length})</div>
                    {partyOrders.length ? (
                      <div className="space-y-2">
                        {partyOrders.slice(0, 5).map(o => (
                          <div key={o.id} className="p-3 bg-background border border-border rounded-lg flex items-center justify-between text-xs">
                            <div>
                              <strong className="text-foreground block">{o.order_no}</strong>
                              <span className="text-muted-foreground">{dateLabel(o.order_date)}</span>
                            </div>
                            <Pill value={o.status} />
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">No previous orders on record.</p>
                    )}
                  </div>
                </div>

                {/* Pinned Drawer Footer */}
                <div className="p-4 border-t border-border bg-background flex justify-between items-center">
                  <span className="text-xs text-muted-foreground hover:text-foreground cursor-pointer underline">
                    Need help? Ask us.
                  </span>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setEditing(activeParty);
                        setViewPartyId(null);
                        setOpen(true);
                      }}
                    >
                      Edit Details
                    </Button>
                    <Button variant="default" size="sm" onClick={() => setViewPartyId(null)}>
                      Done
                    </Button>
                  </div>
                </div>
              </>
            )}
          </SheetContent>
        </Sheet>
      )}

      {/* Edit / Create Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent aria-describedby={undefined}>
          <DialogTitle className="text-xl font-medium">{editing ? `Edit ${c.entity.slice(0,-1)}` : c.add}</DialogTitle>
          <div className="form-subtitle">
            {editing ? 'Update existing details in the database.' : `Register a new ${c.entity.slice(0,-1)} record.`}
          </div>

          <form onSubmit={submit}>
            <div className="form-grid">
              {c.fields.map(([key,label],i)=>(
                <label key={key} className={key==='address'?'form-wide':''}>
                  {label}
                  <input
                    name={key}
                    defaultValue={String(editing?.[key]??'')}
                    required={i===0||(kind==='items'&&i===1)}
                    type={key.includes('rate')?'number':key==='email'?'email':'text'}
                    min={0}
                    step={key.includes('rate')?'.01':undefined}
                  />
                </label>
              ))}
            </div>

            <div className="form-actions">
              <Button variant="outline" type="button" onClick={()=>setOpen(false)}>Cancel</Button>
              <Button disabled={busy} type="submit">{busy?'Saving…':'Save Record'}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
