import {useState, useEffect, useRef} from 'react';
import {useSearch, useNavigate} from '@tanstack/react-router';
import {Plus,Trash2,Building2,Calendar,Package,CheckCircle2,Clock,Layers,MoreHorizontal,Phone,Mail,ClipboardList,List,LayoutGrid,Share2,ChevronDown,Search,Download,Check,Ban} from 'lucide-react';
import {toast} from 'sonner';
import {Button} from '@/components/ui/button';
import {Checkbox} from '@/components/ui/checkbox';
import {Dialog,DialogContent,DialogTitle} from '@/components/ui/dialog';
import {Sheet,SheetContent,SheetHeader,SheetTitle} from '@/components/ui/sheet';
import {useFactory} from './provider';
import {Heading,Empty,AccessNotice,SearchFilter,ExportButton,AddButton,Pill,ViewTabs,FilterToken,TableCalcBar,CrmTag,SegmentedMeter,ThemedSelect,ThemedDatePicker,SegmentedControl,Pagination,MiniSparkline,WhatsAppIcon,clearModalSearchParams,BoxDimensionInput} from './common';
import {money,number,dateLabel,today,downloadCsv,type Row} from '@/lib/erp-data';

const freshLine=(sr:number=1)=>({sr_no:sr,box_type:'',code_remarks:'',size_dimensions:'',specification:'',ordered_qty:'' as unknown as number,unit_rate:'' as unknown as number,priority_signal:'Yellow'});

function BoxTypePicker({
  value,
  onChange,
  catalog,
  required,
}: {
  value: string;
  onChange: (val: string) => void;
  catalog: Row<'item_master'>[];
  required?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close when tapping or clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent | TouchEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [open]);

  // Filter catalog items by search query
  const query = value.trim().toLowerCase();
  const filtered = catalog.filter(c =>
    c.box_type.toLowerCase().includes(query)
  );

  // Show up to 10 options at a time
  const visibleOptions = (filtered.length > 0 ? filtered : catalog).slice(0, 10);

  const handleSelect = (boxType: string) => {
    onChange(boxType);
    setOpen(false);
  };

  return (
    <div ref={containerRef} className={`relative w-full ${open ? 'z-50' : 'z-0'}`}>
      {/* Attached Textfield Area */}
      <div
        className={`relative flex items-center w-full transition-all duration-150 ${
          open
            ? 'rounded-t-lg rounded-b-none border border-primary border-b-border/30 bg-background'
            : 'rounded-lg'
        }`}
      >
        <input
          required={required}
          value={value}
          placeholder="Search or enter box type…"
          autoComplete="off"
          className={`w-full pr-10 ${
            open
              ? 'rounded-t-lg rounded-b-none border-0 focus:ring-0 focus:outline-none shadow-none'
              : ''
          }`}
          onFocus={() => {
            setOpen(true);
            setHighlightedIndex(0);
          }}
          onChange={e => {
            onChange(e.target.value);
            if (!open) setOpen(true);
            setHighlightedIndex(0);
          }}
          onKeyDown={e => {
            if (e.key === 'Escape') {
              setOpen(false);
            } else if (e.key === 'ArrowDown') {
              e.preventDefault();
              if (!open) {
                setOpen(true);
              } else if (visibleOptions.length > 0) {
                setHighlightedIndex(prev => (prev + 1) % visibleOptions.length);
              }
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              if (open && visibleOptions.length > 0) {
                setHighlightedIndex(prev => (prev - 1 + visibleOptions.length) % visibleOptions.length);
              }
            } else if (e.key === 'Enter') {
              const selectedItem = visibleOptions[highlightedIndex];
              if (open && selectedItem) {
                e.preventDefault();
                handleSelect(selectedItem.box_type);
              }
            }
          }}
        />
        <button
          type="button"
          tabIndex={-1}
          aria-label="Toggle box types dropdown"
          onClick={() => setOpen(prev => !prev)}
          className="absolute inset-y-0 right-0 flex items-center pr-3 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
        >
          <ChevronDown
            className={`w-4 h-4 transition-transform duration-200 ${
              open ? 'rotate-180 text-primary' : ''
            }`}
          />
        </button>
      </div>

      {/* Dropdown: Opens just below the textfield area, attached & curved */}
      {open && (
        <div
          className="absolute top-full left-0 right-0 z-50 -mt-px bg-card text-card-foreground border border-t-0 border-primary rounded-b-xl shadow-2xl overflow-hidden animate-in fade-in-0 duration-150"
        >
          {/* Instruction Bar: Search for a specific box type */}
          <div className="px-3.5 py-1.5 bg-muted/40 border-b border-border/70 flex items-center justify-between text-xs text-muted-foreground select-none">
            <span className="flex items-center gap-1.5 font-medium text-[11px] text-muted-foreground">
              <Search className="w-3 h-3 text-primary shrink-0" />
              <span>Search for a specific box type</span>
            </span>
            <span className="text-[10px] font-mono text-muted-foreground/80">
              {visibleOptions.length} of {catalog.length}
            </span>
          </div>

          {/* Options List (Strictly box type name, nothing else) */}
          <div className="max-h-56 overflow-y-auto divide-y divide-border/20">
            {filtered.length > 0 ? (
              visibleOptions.map((item, idx) => {
                const isSelected = item.box_type.toLowerCase() === value.trim().toLowerCase();
                const isHighlighted = idx === highlightedIndex;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onMouseDown={e => {
                      e.preventDefault();
                      handleSelect(item.box_type);
                    }}
                    onMouseEnter={() => setHighlightedIndex(idx)}
                    className={`w-full text-left px-3.5 py-2.5 text-sm transition-colors flex items-center justify-between cursor-pointer ${
                      isSelected
                        ? 'bg-primary text-primary-foreground font-medium'
                        : isHighlighted
                        ? 'bg-accent text-accent-foreground'
                        : 'text-foreground hover:bg-accent/60'
                    }`}
                  >
                    <span className="truncate">{item.box_type}</span>
                    {isSelected && (
                      <CheckCircle2 className="w-4 h-4 shrink-0 text-current ml-2" />
                    )}
                  </button>
                );
              })
            ) : catalog.length > 0 ? (
              <div className="p-3.5 text-center text-xs text-muted-foreground select-none">
                <div>No configured box type matches &quot;{value}&quot;</div>
                <div className="mt-1 text-[11px] text-primary font-medium">
                  Will use custom: &quot;{value}&quot;
                </div>
              </div>
            ) : (
              <div className="p-3.5 text-center text-xs text-muted-foreground select-none">
                No configured box types yet.
              </div>
            )}
          </div>

          {/* Footer instruction if there are more than 10 options */}
          {filtered.length > 10 && (
            <div className="px-3 py-1.5 bg-muted/20 border-t border-border/50 text-[11px] text-muted-foreground text-center select-none">
              Type in textfield to refine search ({filtered.length - 10} more available)
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function sendOrderWhatsApp(order: Row<'orders'>, items: Row<'order_items'>[], party?: Row<'party_master'> | null) {
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
  const navigate=useNavigate();
  const searchParams=useSearch({strict:false}) as {new?:boolean; view?:string};
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
  const [orderDate,setOrderDate]=useState(today());
  const [busy,setBusy]=useState(false);
  const [viewOrderId,setViewOrderId]=useState<string|null>(null);
  const [closeShortOrderId,setCloseShortOrderId]=useState<string|null>(null);
  const [closeShortReason,setCloseShortReason]=useState('');
  const [closeShortBusy,setCloseShortBusy]=useState(false);

  useEffect(()=>{
    if(searchParams.new&&user){
      setOpen(true);
      setOrderDate(today());
      clearModalSearchParams(navigate);
    }
    if(searchParams.view){
      setViewOrderId(searchParams.view);
    }
  },[searchParams.new,searchParams.view,user]);

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (!isOpen) {
      clearModalSearchParams(navigate);
      setOrderDate(today());
    }
  };

  const handleViewOrderChange = (isOpen: boolean) => {
    if (!isOpen) {
      setViewOrderId(null);
      clearModalSearchParams(navigate);
    }
  };

  function add(){
    if(!user){signIn();return;}
    setStock(false);
    setLines([freshLine()]);
    setOpen(true);
  }

  const company = (id: string | null, isStock?: boolean) =>
    isStock ? 'Self Stocking' : (d.parties.find(p => p.id === id)?.company_name ?? '—');

  // Base filtered by active search, party, and channel/medium filters
  const baseFiltered = d.orders.filter(o => {
    const matchesParty = partyFilter === 'All' || (o.is_self_stock && partyFilter === 'self') || o.party_id === partyFilter;
    const matchesMedium = mediumFilter === 'All' || o.medium === mediumFilter;
    const compName = company(o.party_id, o.is_self_stock);
    const matchesSearch = (o.order_no + ' ' + compName + ' ' + (o.remarks ?? '')).toLowerCase().includes(search.toLowerCase());
    return matchesParty && matchesMedium && matchesSearch;
  });

  // Dynamic status counts for ViewTabs based on active filter criteria
  const pendingCount = baseFiltered.filter(o => o.status === 'Pending').length;
  const prodCount = baseFiltered.filter(o => o.status === 'In Production').length;
  const partDispCount = baseFiltered.filter(o => o.status === 'Partially Dispatched').length;
  const dispCount = baseFiltered.filter(o => o.status === 'Dispatched').length;
  const doneCount = baseFiltered.filter(o => o.status === 'Completed').length;

  const tabs = [
    { id: 'All', label: 'All Orders', count: baseFiltered.length },
    { id: 'Pending', label: 'Pending', count: pendingCount },
    { id: 'In Production', label: 'In Production', count: prodCount },
    { id: 'Partially Dispatched', label: 'Partially Dispatched', count: partDispCount },
    { id: 'Dispatched', label: 'Dispatched', count: dispCount },
    { id: 'Completed', label: 'Completed', count: doneCount },
  ];

  const filtered = baseFiltered.filter(o => statusTab === 'All' || o.status === statusTab);

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
      if(!l.size_dimensions || !l.size_dimensions.trim()){
        toast.error(`Item #${i+1}: Please specify complete box dimensions (Length × Width × Height).`);
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
  const activePendingQty=Math.max(0, activeTotalQty - activeCompletedQty);
  const activeProductionPercent=activeTotalQty > 0 ? Math.min(100, Math.round((activeCompletedQty / activeTotalQty) * 100)) : 0;

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
                    <span className={cn('pill', `pill-${stage.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`)} data-status={stage} />
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
                        <span className="font-medium text-foreground">{o.is_self_stock ? 'Self Stocking' : company(o.party_id)}</span>
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
                            <WhatsAppIcon className="w-4 h-4 text-emerald-600 dark:text-emerald-400"/>
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
                  <Empty columns={10} label="No matching orders found"/>
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
                  </div>

                  <div className="mobile-card-actions justify-end">
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
      <Sheet open={!!viewOrderId} onOpenChange={handleViewOrderChange}>
        <SheetContent side="right" className="sm:max-w-xl w-full p-0 flex flex-col bg-card overflow-hidden h-[100dvh] max-h-[100dvh] inset-y-0 right-0">
          {activeOrder && (
            <>
              <div className="p-4 sm:p-6 pr-14 border-b border-border bg-background shrink-0">
                <SheetHeader className="text-left">
                  <div className="drawer-hero-box">
                    <div className="drawer-hero-monogram">
                      {activeOrder.is_self_stock ? 'SS' : company(activeOrder.party_id).slice(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <SheetTitle className="text-lg sm:text-xl font-medium tracking-tight">
                          {activeOrder.order_no}
                        </SheetTitle>
                        <Pill value={activeOrder.status} />
                      </div>
                      <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                        <CrmTag label={activeOrder.is_self_stock ? 'Internal Factory Stock' : company(activeOrder.party_id)} variant="blue" />
                        {activeItems[0]?.specification && <CrmTag label={activeItems[0].specification} variant="purple" />}
                        {activeItems.some(i => i.priority_signal === 'Red') && <CrmTag label="High Priority" variant="red" />}
                      </div>
                    </div>
                  </div>
                </SheetHeader>
              </div>

              <div
                className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-4 sm:p-6 space-y-4 sm:space-y-6"
                style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-y' }}
              >
                {/* Operational Production & Dispatch State */}
                <div>
                  <div className="drawer-section-label">Production & Dispatch State</div>
                  <div className="p-4 bg-background border border-border rounded-xl space-y-4 shadow-sm">
                    {/* Overall Progress */}
                    <div>
                      <div className="flex items-center justify-between text-xs mb-2">
                        <span className="font-semibold text-foreground flex items-center gap-1.5">
                          <Package className="w-4 h-4 text-primary" />
                          Production Completion
                        </span>
                        <span className="font-semibold tabular-nums text-foreground">
                          {activeProductionPercent}% Produced
                        </span>
                      </div>
                      <div className="w-full h-2.5 rounded-full bg-secondary overflow-hidden">
                        <div
                          className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                          style={{ width: `${activeProductionPercent}%` }}
                        />
                      </div>
                      <div className="flex justify-between items-center text-[11px] text-muted-foreground mt-1.5">
                        <span>{number(activeCompletedQty)} of {number(activeTotalQty)} units produced</span>
                        <span>{number(activePendingQty)} units pending in queue</span>
                      </div>
                    </div>

                    {/* Operational 4-Card Metrics Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-2.5 pt-2 border-t border-border/70">
                      <div className="p-2.5 sm:p-3 bg-secondary/30 border border-border/60 rounded-lg">
                        <div className="text-[10px] sm:text-[11px] uppercase tracking-wider text-muted-foreground font-medium mb-1">
                          Total Ordered
                        </div>
                        <div className="text-base sm:text-lg font-bold text-foreground tabular-nums">
                          {number(activeTotalQty)} <span className="text-xs font-normal text-muted-foreground">units</span>
                        </div>
                      </div>

                      <div className="p-2.5 sm:p-3 bg-emerald-500/5 border border-emerald-500/20 rounded-lg">
                        <div className="text-[10px] sm:text-[11px] uppercase tracking-wider text-emerald-600 dark:text-emerald-400 font-medium mb-1">
                          Produced
                        </div>
                        <div className="text-base sm:text-lg font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                          {number(activeCompletedQty)} <span className="text-xs font-normal text-muted-foreground">units</span>
                        </div>
                      </div>

                      <div className="p-2.5 sm:p-3 bg-amber-500/5 border border-amber-500/20 rounded-lg">
                        <div className="text-[10px] sm:text-[11px] uppercase tracking-wider text-amber-600 dark:text-amber-400 font-medium mb-1">
                          Pending Prod.
                        </div>
                        <div className="text-base sm:text-lg font-bold text-amber-600 dark:text-amber-400 tabular-nums">
                          {number(activePendingQty)} <span className="text-xs font-normal text-muted-foreground">units</span>
                        </div>
                      </div>

                      <div className="p-2.5 sm:p-3 bg-blue-500/5 border border-blue-500/20 rounded-lg">
                        <div className="text-[10px] sm:text-[11px] uppercase tracking-wider text-blue-600 dark:text-blue-400 font-medium mb-1">
                          Dispatched
                        </div>
                        <div className="text-base sm:text-lg font-bold text-blue-600 dark:text-blue-400 tabular-nums">
                          {number(activeDispatchedQty)} <span className="text-xs font-normal text-muted-foreground">units</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Order Details & Schedule */}
                <div>
                  <div className="drawer-section-label">Order Details & Schedule</div>
                  <div className="p-4 bg-background border border-border rounded-xl space-y-3.5 shadow-sm">
                    <div className="grid grid-cols-2 gap-3 sm:gap-4 text-xs">
                      <div>
                        <span className="text-muted-foreground block mb-0.5">Client / Account</span>
                        <strong className="text-foreground text-sm font-semibold block">
                          {activeOrder.is_self_stock ? 'Internal Factory Stock' : company(activeOrder.party_id)}
                        </strong>
                        <span className="text-[11px] text-muted-foreground">
                          {activeOrder.is_self_stock ? 'Self Stocking' : 'Commercial Client'}
                        </span>
                      </div>

                      <div>
                        <span className="text-muted-foreground block mb-0.5">Total Order Value</span>
                        <strong className="text-foreground text-sm font-semibold block">
                          {money(activeTotalValue)}
                        </strong>
                        <span className="text-[11px] text-muted-foreground">
                          {activeItems.length} line item{activeItems.length === 1 ? '' : 's'}
                        </span>
                      </div>

                      <div>
                        <span className="text-muted-foreground block mb-0.5">Order Date</span>
                        <div className="flex items-center gap-1.5 font-medium text-foreground">
                          <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                          <span>{dateLabel(activeOrder.order_date)}</span>
                        </div>
                      </div>

                      <div>
                        <span className="text-muted-foreground block mb-0.5">Due / Delivery Date</span>
                        <div className="flex items-center gap-1.5 font-medium text-foreground">
                          <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                          <span>{dateLabel(activeOrder.expected_date)}</span>
                        </div>
                      </div>
                    </div>

                    {activeOrder.remarks && (
                      <div className="pt-3 border-t border-border/70 flex items-start gap-2 text-xs">
                        <ClipboardList className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                        <div>
                          <span className="font-semibold text-foreground block">Production Notes & Instructions:</span>
                          <span className="text-muted-foreground whitespace-pre-wrap">{activeOrder.remarks}</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Line Items & Specifications */}
                <div>
                  <div className="drawer-section-label">Line Items & Specifications ({activeItems.length})</div>
                  <div className="space-y-3">
                    {activeItems.map((item, idx) => {
                      const itemPercent = item.ordered_qty > 0 ? Math.min(100, Math.round((item.completed_qty / item.ordered_qty) * 100)) : 0;
                      const itemPending = Math.max(0, item.ordered_qty - item.completed_qty);
                      return (
                        <div key={item.id || idx} className="p-3.5 bg-background border border-border rounded-xl space-y-2.5 shadow-sm">
                          <div className="flex justify-between items-start gap-2">
                            <div>
                              <span className="font-semibold text-foreground text-sm block">{item.box_type}</span>
                              <span className="font-mono text-xs text-muted-foreground bg-secondary/80 px-1.5 py-0.5 rounded inline-block mt-0.5">
                                {item.size_dimensions}
                              </span>
                            </div>
                            <Pill value={item.priority_signal} />
                          </div>

                          {item.specification && (
                            <div className="text-xs text-muted-foreground bg-secondary/50 px-2.5 py-1.5 rounded-md border border-border/50">
                              <span className="font-medium text-foreground">Specification: </span>
                              {item.specification}
                            </div>
                          )}

                          {item.code_remarks && (
                            <div className="text-[11px] text-muted-foreground">
                              <span className="font-medium text-foreground">Code/Remarks: </span>
                              {item.code_remarks}
                            </div>
                          )}

                          {/* Progress bar per item */}
                          <div className="pt-1">
                            <div className="flex justify-between items-center text-[11px] mb-1">
                              <span className="text-muted-foreground">
                                Produced: <strong className="text-foreground">{number(item.completed_qty)}</strong> / {number(item.ordered_qty)} pcs
                              </span>
                              <span className="font-medium text-foreground tabular-nums">
                                {itemPercent}%
                              </span>
                            </div>
                            <div className="w-full h-1.5 rounded-full bg-secondary overflow-hidden">
                              <div
                                className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                                style={{ width: `${itemPercent}%` }}
                              />
                            </div>
                          </div>

                          {/* Operational item metrics */}
                          <div className="grid grid-cols-4 gap-1.5 sm:gap-2 pt-2 border-t border-border/70 text-[11px]">
                            <div>
                              <span className="text-muted-foreground block text-[10px] sm:text-[11px]">Ordered</span>
                              <strong className="text-foreground text-xs sm:text-sm">{number(item.ordered_qty)}</strong>
                            </div>
                            <div>
                              <span className="text-muted-foreground block text-[10px] sm:text-[11px]">Pending</span>
                              <strong className={`text-xs sm:text-sm ${itemPending > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                                {number(itemPending)}
                              </strong>
                            </div>
                            <div>
                              <span className="text-muted-foreground block text-[10px] sm:text-[11px]">Rate</span>
                              <strong className="text-foreground text-xs sm:text-sm">{money(item.unit_rate)}</strong>
                            </div>
                            <div className="text-right">
                              <span className="text-muted-foreground block text-[10px] sm:text-[11px]">Total</span>
                              <strong className="text-foreground text-xs sm:text-sm font-semibold">
                                {money(item.total_price ?? (item.ordered_qty * item.unit_rate))}
                              </strong>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Pinned Footer: Mobile screen has only icons, desktop screen has icon + text */}
              <div className="p-3 sm:p-4 border-t border-border bg-background flex justify-between items-center gap-2 shrink-0">
                <div>
                  {isAdmin && activeOrder.status !== 'Completed' && activeOrder.status !== 'Cancelled' && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-destructive/60 text-destructive hover:bg-destructive/10 hover:text-destructive h-9 px-2.5 sm:px-3 gap-1.5"
                      title="Close order short"
                      aria-label="Close order short"
                      onClick={() => {
                        setCloseShortOrderId(activeOrder.id);
                        setCloseShortReason('');
                      }}
                    >
                      <Ban className="w-4 h-4 text-destructive shrink-0" />
                      <span className="hidden sm:inline">Close short</span>
                    </Button>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    className="h-9 px-2.5 sm:px-3 gap-1.5"
                    title="Export CSV"
                    aria-label="Export CSV"
                    onClick={() => downloadCsv(`order-${activeOrder.order_no}`, activeItems)}
                  >
                    <Download className="w-4 h-4 shrink-0" />
                    <span className="hidden sm:inline">Export CSV</span>
                  </Button>
                  <Button
                    variant="default"
                    size="sm"
                    className="h-9 px-3 sm:px-4 gap-1.5"
                    title="Done"
                    aria-label="Done"
                    onClick={() => setViewOrderId(null)}
                  >
                    <Check className="w-4 h-4 shrink-0" />
                    <span className="hidden sm:inline">Done</span>
                  </Button>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* New Order Dialog */}
      <Dialog open={open} onOpenChange={handleOpenChange}>
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
                <ThemedDatePicker
                  aria-label="Order Date"
                  name="order_date"
                  value={orderDate}
                  onChange={setOrderDate}
                  minDate={today()}
                  required
                />
              </label>
              <label>
                Target Delivery Date
                <ThemedDatePicker
                  aria-label="Target Delivery Date"
                  name="expected_date"
                  defaultValue={today()}
                  minDate={orderDate || today()}
                  required
                />
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
                      <span className="flex items-center justify-between mb-1">
                        <span>Box Type</span>
                        {d.catalog.length > 0 && (
                          <span className="text-[11px] text-muted-foreground font-normal">
                            ({d.catalog.length} configured)
                          </span>
                        )}
                      </span>
                      <BoxTypePicker
                        required
                        value={l.box_type}
                        catalog={d.catalog}
                        onChange={val => {
                          const catalog = d.catalog.find(i => i.box_type.toLowerCase() === val.toLowerCase()) || d.catalog.find(i => i.box_type === val);
                          setLines(lines.map((x,i)=>i===index?{
                            ...x,
                            box_type: val,
                            ...(catalog?{
                              size_dimensions: catalog.size_dimensions,
                              specification: catalog.specification ?? '',
                              unit_rate: catalog.unit_rate
                            }:{})
                          }:x));
                        }}
                      />
                    </label>
                    <BoxDimensionInput
                      required
                      value={l.size_dimensions}
                      onChange={val => setLines(lines.map((x,i)=>i===index?{...x,size_dimensions:val}:x))}
                    />
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
                        inputMode="numeric"
                        min={1}
                        required
                        placeholder="e.g. 100"
                        value={!l.ordered_qty ? '' : l.ordered_qty}
                        onChange={e=>setLines(lines.map((x,i)=>i===index?{...x,ordered_qty:e.target.value===''?'' as unknown as number:Number(e.target.value)}:x))}
                      />
                    </label>
                    <label>
                      Unit Rate (₹)
                      <input
                        type="number"
                        inputMode="decimal"
                        min={0}
                        step=".01"
                        required={!stock}
                        placeholder="e.g. 250.00"
                        value={!l.unit_rate ? '' : l.unit_rate}
                        onChange={e=>setLines(lines.map((x,i)=>i===index?{...x,unit_rate:e.target.value===''?'' as unknown as number:Number(e.target.value)}:x))}
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
