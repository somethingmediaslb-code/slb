import {useState,useEffect} from 'react';
import {useNavigate, useSearch} from '@tanstack/react-router';
import {Pencil,Building2,Mail,Phone,FileText,MapPin,MoreHorizontal,CheckCircle2,Clock,Package,Layers,Trash2} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {Checkbox} from '@/components/ui/checkbox';
import {Dialog,DialogContent,DialogTitle} from '@/components/ui/dialog';
import {Sheet,SheetContent,SheetHeader,SheetTitle} from '@/components/ui/sheet';
import {useFactory} from './provider';
import {Heading,Empty,AccessNotice,SearchFilter,ExportButton,AddButton,TableCalcBar,CrmTag,SegmentedMeter,Pill,Pagination,clearModalSearchParams} from './common';
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
    title:'Product Types',
    entity:'product specifications',
    add:'Add Product Type',
    fields:[['box_type','Product Type'],['specification','Timber / Plywood Spec'],['unit_rate','Standard Unit Rate (₹)']]
  },
  workers:{
    title:'Labour Master',
    entity:'workers',
    add:'Register Worker',
    fields:[['labour_name','Worker Name'],['phone','Phone Number'],['daily_rate','Daily Wage Rate (₹)'],['unit_assignment','Unit / Machine Assignment']]
  }
};

export function MasterPage({kind,title,department}:{kind:Kind;title?:string;department?:string}){
  const c=config[kind];
  const pageTitle=title||c.title;
  const {data,user,signIn,refresh}=useFactory();
  const navigate=useNavigate();
  const searchParams=useSearch({strict:false}) as {new?:boolean};
  const [search,setSearch]=useState('');
  const [open,setOpen]=useState(false);
  const [editing,setEditing]=useState<Record<string,unknown>|null>(null);
  const [viewPartyId,setViewPartyId]=useState<string|null>(null);
  const [busy,setBusy]=useState(false);

  useEffect(()=>{
    if(searchParams.new&&user){
      setEditing(null);
      setOpen(true);
      clearModalSearchParams(navigate);
    }
  },[searchParams.new,user]);

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (!isOpen) {
      setEditing(null);
      clearModalSearchParams(navigate);
    }
  };

  const handleViewPartyChange = (isOpen: boolean) => {
    if (!isOpen) {
      setViewPartyId(null);
      clearModalSearchParams(navigate);
    }
  };

  async function deleteRecord(row:Record<string,unknown>){
    if(!user){signIn();return;}
    const id=String(row['id']);
    const name=String(row['company_name']||row['box_type']||row['labour_name']||'record');
    if(!window.confirm(`Are you sure you want to delete "${name}"? This cannot be undone.`))return;
    setBusy(true);
    const table=kind==='parties'?'party_master':kind==='items'?'item_master':'labour_master';
    const {error}=await supabase.from(table).delete().eq('id',id);
    setBusy(false);
    if(error){
      toast.error(error.message);
      return;
    }
    await refresh();
    toast.success('Record deleted successfully');
  }

  const [page,setPage]=useState(1);
  const pageSize=10;

  const rawWorkers = department === 'Production'
    ? data.workers.filter(w => (w as any).department !== 'Transport' && !(w as any).vehicle_number)
    : data.workers;

  const rows:Record<string,unknown>[]=kind==='parties'?data.parties:kind==='items'?data.catalog:rawWorkers;
  const filtered=rows.filter(r=>Object.values(r).join(' ').toLowerCase().includes(search.toLowerCase()));

  useEffect(()=>{
    setPage(1);
  },[search]);

  const paginated=filtered.slice((page-1)*pageSize,page*pageSize);

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
      const compName = String(values['company_name'] ?? '').trim();
      if (!compName) {
        toast.error('Company / Party name is required.');
        setBusy(false);
        return;
      }
      const v={
        company_name:compName,
        phone_number:String(values['phone_number'] ?? '').trim(),
        email:String(values['email'] ?? '').trim(),
        gstin:String(values['gstin'] ?? '').trim(),
        address:String(values['address'] ?? '').trim()
      };
      ({error}=editing?await supabase.from('party_master').update(v).eq('id',String(editing['id'])):await supabase.from('party_master').insert(v));
    } else if(kind==='items'){
      const boxType = String(values['box_type'] ?? '').trim();
      if (!boxType) {
        toast.error('Product type name is required.');
        setBusy(false);
        return;
      }
      const v={
        box_type:boxType,
        size_dimensions:String(values['size_dimensions'] ?? editing?.['size_dimensions'] ?? 'Standard').trim(),
        specification:String(values['specification'] ?? '').trim(),
        unit_rate:Math.max(0, Number(values['unit_rate']) || 0)
      };
      ({error}=editing?await supabase.from('item_master').update(v).eq('id',String(editing['id'])):await supabase.from('item_master').insert(v));
    } else {
      const labourName = String(values['labour_name'] ?? '').trim();
      if (!labourName) {
        toast.error('Labour / Worker name is required.');
        setBusy(false);
        return;
      }
      const v={
        labour_name:labourName,
        phone:String(values['phone'] ?? '').trim(),
        daily_rate:Math.max(0, Number(values['daily_rate']) || 0),
        unit_assignment:String(values['unit_assignment'] ?? '').trim(),
        department: department || (editing ? (editing['department'] as string) : 'Production')
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
      <Heading title={pageTitle}>
        <ExportButton onClick={()=>downloadCsv(pageTitle,filtered)}/>
        <AddButton onClick={add}>{c.add}</AddButton>
      </Heading>

      <AccessNotice/>

      <div className="filters">
        <SearchFilter value={search} onChange={setSearch} placeholder={`Search ${c.entity}…`}/>
      </div>

      {/* Desktop Table View */}
      <div className="desktop-table-view table-wrap">
        <table>
          <thead>
            <tr>
              {kind==='parties' && (
                <th className="w-8">
                  <Checkbox aria-label="Select all" />
                </th>
              )}
              {c.fields.map(([key,label])=><th key={key}>{label}</th>)}
              {kind==='parties' && (
                <>
                  <th className="numeric">Lifetime Spend</th>
                  <th>Order Health</th>
                </>
              )}
              <th className="w-16 text-right"/>
            </tr>
          </thead>
          <tbody>
            {paginated.length ? paginated.map(r=>{
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
                      <Checkbox aria-label={`Select record`} />
                    </td>
                  )}
                  {c.fields.map(([key],idx)=>{
                    const val=r[key];
                    if(kind==='parties'&&idx===0){
                      const name=String(val||'');
                      return (
                        <td key={key} className="font-medium text-foreground">
                          <span>{name}</span>
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
                    </>
                  )}
                  <td onClick={e=>e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Edit record"
                        title="Edit record"
                        onClick={()=>{
                          setEditing(r);
                          setOpen(true);
                        }}
                      >
                        <Pencil className="w-4 h-4"/>
                      </Button>
                      <Button
                        variant="destructive"
                        size="icon-sm"
                        aria-label="Delete record"
                        title="Delete record"
                        onClick={()=>deleteRecord(r)}
                      >
                        <Trash2 className="w-4 h-4"/>
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            }) : (
              <Empty columns={c.fields.length+(kind==='parties'?4:1)} label={`No ${c.entity} registered yet`}/>
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile Card View (No Horizontal Sliding Required) */}
      <div className="mobile-card-view">
        {paginated.length ? paginated.map(r => {
          const id = String(r['id']);
          const pOrders = kind === 'parties' ? data.orders.filter(o => o.party_id === id) : [];
          const pSpend = pOrders.reduce((sum, o) => {
            const items = data.items.filter(i => i.order_id === o.id);
            return sum + items.reduce((s, i) => s + (i.total_price ?? 0), 0);
          }, 0);
          const pDone = pOrders.filter(o => o.status === 'Completed').length;

          if (kind === 'parties') {
            const name = String(r['company_name'] || 'Client');
            const gstin = String(r['gstin'] || '');
            const phone = String(r['phone_number'] || '—');
            const email = String(r['email'] || '—');
            return (
              <div
                key={id}
                className="mobile-record-card"
                onClick={() => setViewPartyId(id)}
              >
                <div className="mobile-card-top">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="min-w-0">
                      <div className="mobile-card-title">{name}</div>
                      <div className="mobile-card-sub">{phone}</div>
                    </div>
                  </div>
                  {gstin && <CrmTag label={gstin.slice(0, 10)} variant="blue" />}
                </div>

                <div className="mobile-card-grid">
                  <div className="mobile-card-field">
                    <span className="mobile-card-label">Lifetime Spend</span>
                    <span className="mobile-card-value">{money(pSpend)}</span>
                  </div>
                  <div className="mobile-card-field">
                    <span className="mobile-card-label">Orders Run</span>
                    <span className="mobile-card-value">{pOrders.length}</span>
                  </div>
                  <div className="mobile-card-field">
                    <span className="mobile-card-label">Email</span>
                    <span className="mobile-card-value truncate">{email}</span>
                  </div>
                  <div className="mobile-card-field">
                    <span className="mobile-card-label">Fulfilment</span>
                    <span className="mobile-card-value">
                      {pOrders.length > 0 ? Math.round((pDone / pOrders.length) * 100) : 0}%
                    </span>
                  </div>
                </div>

                <div className="mobile-card-actions">
                  <div className="flex-1">
                    <SegmentedMeter value={pDone} total={Math.max(pOrders.length, 1)} />
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditing(r);
                      setOpen(true);
                    }}
                  >
                    Edit
                  </Button>
                </div>
              </div>
            );
          }

          if (kind === 'items') {
            const boxType = String(r['box_type'] || 'Custom Box');
            const spec = String(r['specification'] || 'Standard');
            const rate = Number(r['unit_rate'] || 0);
            return (
              <div
                key={id}
                className="mobile-record-card"
                onClick={() => {
                  setEditing(r);
                  setOpen(true);
                }}
              >
                <div className="mobile-card-top">
                  <div className="mobile-card-title-group">
                    <div className="mobile-card-title">{boxType}</div>
                    <div className="mobile-card-sub">{spec}</div>
                  </div>
                  <CrmTag label={money(rate)} variant="blue" />
                </div>

                <div className="mobile-card-grid">
                  <div className="mobile-card-field">
                    <span className="mobile-card-label">Standard Rate</span>
                    <span className="mobile-card-value">{money(rate)}</span>
                  </div>
                  <div className="mobile-card-field">
                    <span className="mobile-card-label">Specification</span>
                    <span className="mobile-card-value">{spec}</span>
                  </div>
                </div>

                <div className="mobile-card-actions">
                  <span className="text-xs text-muted-foreground">Catalog Item</span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditing(r);
                      setOpen(true);
                    }}
                  >
                    Edit
                  </Button>
                </div>
              </div>
            );
          }

          // workers
          const workerName = String(r['labour_name'] || 'Worker');
          const phone = String(r['phone'] || '—');
          const unit = String(r['unit_assignment'] || 'General');
          const dailyRate = Number(r['daily_rate'] || 0);
          return (
            <div
              key={id}
              className="mobile-record-card"
              onClick={() => {
                setEditing(r);
                setOpen(true);
              }}
            >
              <div className="mobile-card-top">
                <div className="mobile-card-title-group">
                  <div className="mobile-card-title">{workerName}</div>
                  <div className="mobile-card-sub">{phone}</div>
                </div>
                <CrmTag label={unit} variant="purple" />
              </div>

              <div className="mobile-card-grid">
                <div className="mobile-card-field">
                  <span className="mobile-card-label">Daily Wage</span>
                  <span className="mobile-card-value">{money(dailyRate)}</span>
                </div>
                <div className="mobile-card-field">
                  <span className="mobile-card-label">Assignment</span>
                  <span className="mobile-card-value">{unit}</span>
                </div>
              </div>

              <div className="mobile-card-actions">
                <span className="text-xs text-muted-foreground">Team Member</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditing(r);
                    setOpen(true);
                  }}
                >
                  Edit
                </Button>
              </div>
            </div>
          );
        }) : (
          <div className="p-8 text-center text-sm text-muted-foreground bg-card border border-border rounded-xl">
            No {c.entity} registered yet
          </div>
        )}
      </div>

      <Pagination
        currentPage={page}
        totalItems={filtered.length}
        pageSize={pageSize}
        onPageChange={setPage}
      />

      <TableCalcBar count={filtered.length} entityName={c.entity}/>

      {/* Slide-over Inspection Sheet for Parties (CRM Company View - Screenshot 5) */}
      {kind==='parties' && (
        <Sheet open={!!viewPartyId} onOpenChange={handleViewPartyChange}>
          <SheetContent side="right" className="sm:max-w-xl w-full p-0 flex flex-col bg-card overflow-hidden">
            {activeParty && (
              <>
                <div className="p-6 border-b border-border bg-background">
                  <SheetHeader className="text-left space-y-3">
                    <div className="flex items-center justify-end">
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

                  {/* Order Fulfillment Health */}
                  <div>
                    <div className="drawer-section-label">Order Fulfilment Health</div>
                    <div className="p-4 bg-background border border-border rounded-lg space-y-4">
                      <div className="flex items-baseline gap-3 pb-2 border-b border-border/60">
                        <div className="text-3xl font-normal text-foreground tabular-nums tracking-tight">
                          {partyOrders.length > 0 ? Math.round((partyCompletedCount / partyOrders.length) * 100) : 100}%
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Fulfillment efficiency across lifetime manufacturing runs
                        </div>
                      </div>

                      <div className="space-y-3 pt-1">
                        <div className="space-y-1.5">
                          <div className="flex justify-between items-center text-xs">
                            <span className="font-medium text-foreground">Account Onboarding & Specs</span>
                            <span className="text-muted-foreground tabular-nums font-medium">100%</span>
                          </div>
                          <div className="w-full h-2 rounded-full bg-secondary overflow-hidden">
                            <div className="h-full bg-emerald-500 rounded-full w-full" />
                          </div>
                        </div>

                        <div className="space-y-1.5">
                          <div className="flex justify-between items-center text-xs">
                            <span className="font-medium text-foreground">Delivered Orders</span>
                            <span className="text-muted-foreground tabular-nums font-medium">
                              {partyOrders.length > 0 ? Math.round((partyCompletedCount / partyOrders.length) * 100) : 0}%
                            </span>
                          </div>
                          <div className="w-full h-2 rounded-full bg-secondary overflow-hidden">
                            <div
                              className="h-full bg-primary rounded-full transition-all duration-300"
                              style={{
                                width: `${partyOrders.length > 0 ? Math.min(100, Math.round((partyCompletedCount / partyOrders.length) * 100)) : 0}%`
                              }}
                            />
                          </div>
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
                <div className="p-4 border-t border-border bg-background flex justify-end items-center gap-2">
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
              </>
            )}
          </SheetContent>
        </Sheet>
      )}

      {/* Edit / Create Dialog */}
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent aria-describedby={undefined}>
          <DialogTitle className="text-xl font-medium">{editing ? `Edit ${c.entity.slice(0,-1)}` : c.add}</DialogTitle>
          <div className="form-subtitle">
            {editing ? 'Update existing details in the database.' : `Register a new ${c.entity.slice(0,-1)} record.`}
          </div>

          <form onSubmit={submit}>
            <div className="form-grid">
              {c.fields.map(([key,label],i)=>{
                return (
                  <label key={key} className={key==='address'?'form-wide':''}>
                    {label}
                    <input
                      name={key}
                      defaultValue={String(editing?.[key]??'')}
                      required={i===0}
                      type={key.includes('rate')?'number':key==='email'?'email':'text'}
                      min={0}
                      step={key.includes('rate')?'.01':undefined}
                    />
                  </label>
                );
              })}
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
