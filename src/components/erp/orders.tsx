import {useState, useEffect, useRef} from 'react';
import {useSearch, useNavigate} from '@tanstack/react-router';
import {Plus,Trash2,Building2,Calendar,Package,CheckCircle2,Clock,Layers,MoreHorizontal,Phone,Mail,ClipboardList,List,LayoutGrid,Share2,ChevronDown,Search,Download,Check,Ban,Copy} from 'lucide-react';
import {toast} from 'sonner';
import {Button} from '@/components/ui/button';
import {Checkbox} from '@/components/ui/checkbox';
import {Dialog,DialogContent,DialogTitle} from '@/components/ui/dialog';
import {cn} from '@/lib/utils';
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
          placeholder="Search or enter product type…"
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
          aria-label="Toggle product types dropdown"
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
          {/* Instruction Bar: Search for a specific product type */}
          <div className="px-3.5 py-1.5 bg-muted/40 border-b border-border/70 flex items-center justify-between text-xs text-muted-foreground select-none">
            <span className="flex items-center gap-1.5 font-medium text-[11px] text-muted-foreground">
              <Search className="w-3 h-3 text-primary shrink-0" />
              <span>Search for a specific product type</span>
            </span>
            <span className="text-[10px] font-mono text-muted-foreground/80">
              {visibleOptions.length} of {catalog.length}
            </span>
          </div>

          {/* Options List (Strictly product type name, nothing else) */}
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
                <div>No configured product type matches &quot;{value}&quot;</div>
                <div className="mt-1 text-[11px] text-primary font-medium">
                  Will use custom: &quot;{value}&quot;
                </div>
              </div>
            ) : (
              <div className="p-3.5 text-center text-xs text-muted-foreground select-none">
                No configured product types yet.
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
    const orderItems = d.items.filter(i => i.order_id === o.id);
    const itemDetails = orderItems.map(i => `${i.box_type} ${i.specification ?? ''}`).join(' ');
    const matchesSearch = (o.order_no + ' ' + compName + ' ' + itemDetails + ' ' + (o.remarks ?? '')).toLowerCase().includes(search.toLowerCase());
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
        toast.error(`Item #${i+1}: Please select or enter a product type.`);
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
                              </div>
                            </div>
                            <Pill value={o.status} />
                          </div>

                          <div className="text-xs font-medium text-foreground py-0.5">
                            {firstItem?.box_type || 'Standard Box'}
                            {items.length > 1 && (
                              <span className="text-[11px] font-normal text-muted-foreground ml-1.5">
                                (+{items.length - 1})
                              </span>
                            )}
                          </div>

                          <div className="deals-card-metric">
                            <span className="text-muted-foreground font-medium">{number(ordered)} boxes</span>
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
                  <th>Customer Name</th>
                  <th>Product Type</th>
                  <th className="numeric">QTY of Boxes</th>
                  <th>Due Date</th>
                  <th>Status</th>
                  <th className="w-20 text-right"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {paginated.length ? paginated.map(o=>{
                  const items=d.items.filter(i=>i.order_id===o.id);
                  const ordered=items.reduce((s,i)=>s+i.ordered_qty,0);
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
                      <td>
                        <span className="font-semibold text-foreground">{o.is_self_stock ? 'Self Stocking' : company(o.party_id)}</span>
                      </td>
                      <td>
                        <div className="flex items-center gap-1.5 whitespace-nowrap">
                          <span className="font-medium text-foreground">{firstItem?.box_type || 'Standard Box'}</span>
                          {items.length > 1 && (
                            <span className="text-[11px] font-normal text-muted-foreground bg-secondary/80 px-1.5 py-0.5 rounded border border-border/60">
                              +{items.length - 1} more
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="numeric font-medium text-foreground">{number(ordered)}</td>
                      <td className="text-xs text-muted-foreground whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-muted-foreground/70" />
                          <span>{dateLabel(o.expected_date)}</span>
                        </div>
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
                  <Empty columns={7} label="No matching orders found"/>
                )}
              </tbody>
              <tfoot>
                <tr className="border-t border-border bg-muted/20 font-medium">
                  <td colSpan={3} className="text-right text-xs text-muted-foreground font-medium px-3 py-2.5">
                    Totals ({number(filtered.length)} orders):
                  </td>
                  <td className="numeric font-semibold text-foreground px-3 py-2.5 tabular-nums">
                    {number(totalVolume)}
                  </td>
                  <td colSpan={3} />
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Mobile Phone Card View (No Horizontal Sliding Required) */}
          <div className="mobile-card-view">
            {paginated.length ? paginated.map(o => {
              const items = d.items.filter(i => i.order_id === o.id);
              const ordered = items.reduce((s, i) => s + i.ordered_qty, 0);
              const firstItem = items[0];
              return (
                <div
                  key={o.id}
                  className="mobile-record-card"
                  onClick={() => setViewOrderId(o.id)}
                >
                  <div className="mobile-card-top">
                    <div className="mobile-card-title-group">
                      <div className="mobile-card-title">
                        {o.is_self_stock ? 'Self Stocking' : company(o.party_id)}
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5 font-medium">
                        {firstItem?.box_type || 'Standard Box'}
                        {items.length > 1 && ` (+${items.length - 1} more)`}
                      </div>
                    </div>
                    <Pill value={o.status} />
                  </div>

                  <div className="mobile-card-grid">
                    <div className="mobile-card-field">
                      <span className="mobile-card-label">QTY of Boxes</span>
                      <span className="mobile-card-value font-medium">{number(ordered)}</span>
                    </div>
                    <div className="mobile-card-field">
                      <span className="mobile-card-label">Due Date</span>
                      <span className="mobile-card-value">{dateLabel(o.expected_date)}</span>
                    </div>
                  </div>

                  <div className="mobile-card-actions justify-end gap-1.5">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs px-2.5 text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 hover:bg-emerald-500/10 gap-1"
                      onClick={(e) => {
                        e.stopPropagation();
                        sendOrderWhatsApp(o, items, d.parties.find(p => p.id === o.party_id));
                      }}
                    >
                      <WhatsAppIcon className="w-3.5 h-3.5" />
                      <span>WhatsApp</span>
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      className="h-7 text-xs px-2.5 gap-1"
                      onClick={(e) => {
                        e.stopPropagation();
                        setViewOrderId(o.id);
                      }}
                    >
                      <MoreHorizontal className="w-3.5 h-3.5" />
                      <span>Details</span>
                    </Button>
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


      {/* Super Clean Order Information & Inspection Dialog */}
      <Dialog open={!!viewOrderId} onOpenChange={handleViewOrderChange}>
        <DialogContent className="modal-wide max-w-3xl" aria-describedby={undefined}>
          {activeOrder && (
            <div className="space-y-5">
              {/* Clean Dialog Header with Hidden Info (Order ID, Order Date, Channel) */}
              <div className="pr-12 pb-3 border-b border-border">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <DialogTitle className="text-lg sm:text-xl font-semibold tracking-tight text-foreground m-0">
                    {activeOrder.is_self_stock ? 'Self Stocking Order' : company(activeOrder.party_id)}
                  </DialogTitle>
                  <Pill value={activeOrder.status} />
                </div>
                <div className="flex items-center gap-2 sm:gap-3 mt-2 text-xs text-muted-foreground flex-wrap">
                  <div className="flex items-center gap-1.5 font-mono text-foreground font-medium bg-secondary/80 px-2 py-0.5 rounded border border-border/70">
                    <span>{activeOrder.order_no}</span>
                    <button
                      type="button"
                      className="hover:text-primary transition-colors cursor-pointer"
                      title="Copy Order ID"
                      onClick={() => {
                        navigator.clipboard.writeText(activeOrder.order_no);
                        toast.success(`Copied ${activeOrder.order_no} to clipboard`);
                      }}
                    >
                      <Copy className="w-3 h-3" />
                    </button>
                  </div>
                  <span className="text-muted-foreground/40">•</span>
                  <div className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                    <span>Order Date: <strong className="text-foreground font-medium">{dateLabel(activeOrder.order_date)}</strong></span>
                  </div>
                  <span className="text-muted-foreground/40">•</span>
                  <div className="flex items-center gap-1">
                    <span>Channel: <strong className="text-foreground font-medium">{activeOrder.medium || 'Direct'}</strong></span>
                  </div>
                </div>
              </div>

              {/* 1. Key Metrics Cards (Hidden Order Value & Quantities Highlighted) */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
                <div className="p-3 sm:p-3.5 rounded-xl bg-secondary/30 border border-border shadow-xs">
                  <span className="text-[10px] sm:text-[11px] font-medium text-muted-foreground uppercase tracking-wider block mb-1">
                    Total Order Value
                  </span>
                  <div className="text-base sm:text-lg font-bold text-foreground">
                    {money(activeTotalValue)}
                  </div>
                  <span className="text-[10px] sm:text-[11px] text-muted-foreground block mt-0.5">
                    {activeItems.length} line item{activeItems.length === 1 ? '' : 's'}
                  </span>
                </div>

                <div className="p-3 sm:p-3.5 rounded-xl bg-secondary/30 border border-border shadow-xs">
                  <span className="text-[10px] sm:text-[11px] font-medium text-muted-foreground uppercase tracking-wider block mb-1">
                    Total Quantity
                  </span>
                  <div className="text-base sm:text-lg font-bold text-foreground">
                    {number(activeTotalQty)} <span className="text-xs font-normal text-muted-foreground">boxes</span>
                  </div>
                  <span className="text-[10px] sm:text-[11px] text-emerald-600 dark:text-emerald-400 font-medium block mt-0.5">
                    {number(activeCompletedQty)} produced ({activeProductionPercent}%)
                  </span>
                </div>

                <div className="p-3 sm:p-3.5 rounded-xl bg-secondary/30 border border-border shadow-xs">
                  <span className="text-[10px] sm:text-[11px] font-medium text-muted-foreground uppercase tracking-wider block mb-1">
                    Due / Delivery Date
                  </span>
                  <div className="text-base sm:text-lg font-semibold text-foreground">
                    {dateLabel(activeOrder.expected_date)}
                  </div>
                  <span className="text-[10px] sm:text-[11px] text-muted-foreground block mt-0.5">
                    Target schedule
                  </span>
                </div>

                <div className="p-3 sm:p-3.5 rounded-xl bg-secondary/30 border border-border shadow-xs">
                  <span className="text-[10px] sm:text-[11px] font-medium text-muted-foreground uppercase tracking-wider block mb-1">
                    Production Queue
                  </span>
                  <div className="text-base sm:text-lg font-semibold text-foreground">
                    {number(activePendingQty)} <span className="text-xs font-normal text-muted-foreground">pending</span>
                  </div>
                  <span className="text-[10px] sm:text-[11px] text-muted-foreground block mt-0.5">
                    {number(activeDispatchedQty)} dispatched
                  </span>
                </div>
              </div>

              {/* 2. Hidden Specifications & Tags Card */}
              <div className="rounded-xl border border-border bg-card p-3.5 sm:p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Specifications & Order Attributes
                  </span>
                  {activeItems.some(i => i.priority_signal === 'Red') ? (
                    <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-rose-500/10 text-rose-500 border border-rose-500/20">
                      Urgent Priority
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-secondary text-muted-foreground border border-border/60">
                      Standard Priority
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="p-3 rounded-lg bg-secondary/40 border border-border/60">
                    <span className="text-muted-foreground text-[11px] block mb-1 font-medium">Timber / Plywood Specification:</span>
                    <p className="text-foreground font-medium leading-relaxed">
                      {activeItems[0]?.specification || 'Standard Factory Spec (Untreated / Plain)'}
                    </p>
                  </div>

                  <div className="p-3 rounded-lg bg-secondary/40 border border-border/60 space-y-1">
                    <span className="text-muted-foreground text-[11px] block font-medium">Customer Contact & Channel:</span>
                    <p className="text-foreground font-medium">
                      {activeParty?.phone_number ? `${activeParty.phone_number} · via ${activeOrder.medium || 'Direct'}` : (activeOrder.medium ? `Via ${activeOrder.medium}` : 'Direct Order')}
                    </p>
                    {activeParty?.gstin && (
                      <p className="text-[11px] text-muted-foreground font-mono">GSTIN: {activeParty.gstin}</p>
                    )}
                  </div>
                </div>

                {activeOrder.remarks && (
                  <div className="p-3 rounded-lg bg-amber-500/5 border border-amber-500/20 text-xs">
                    <span className="font-semibold text-amber-600 dark:text-amber-400 block mb-0.5">
                      Production Notes & Instructions:
                    </span>
                    <p className="text-foreground whitespace-pre-wrap">{activeOrder.remarks}</p>
                  </div>
                )}
              </div>

              {/* 3. Box Line Items & Pricing Table */}
              <div className="rounded-xl border border-border bg-card overflow-hidden">
                <div className="px-3.5 py-2.5 border-b border-border bg-muted/30 flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Box Line Items ({activeItems.length})
                  </span>
                  <span className="text-xs text-muted-foreground">
                    Total Value: <strong className="text-foreground font-semibold">{money(activeTotalValue)}</strong>
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-border bg-muted/10 text-muted-foreground text-left">
                        <th className="py-2 px-3 w-8">#</th>
                        <th className="py-2 px-3">Product Type</th>
                        <th className="py-2 px-3">Size Dimensions</th>
                        <th className="py-2 px-3">Specification</th>
                        <th className="py-2 px-3 text-right">Ordered</th>
                        <th className="py-2 px-3 text-right">Unit Rate</th>
                        <th className="py-2 px-3 text-right">Total Price</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60">
                      {activeItems.map((item, idx) => (
                        <tr key={item.id || idx} className="hover:bg-muted/10 transition-colors">
                          <td className="py-2.5 px-3 text-muted-foreground font-mono">{item.sr_no || idx + 1}</td>
                          <td className="py-2.5 px-3 font-medium text-foreground">
                            {item.box_type}
                            {item.code_remarks && (
                              <span className="block text-[11px] text-muted-foreground font-normal">
                                {item.code_remarks}
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 font-mono text-muted-foreground">
                            {item.size_dimensions || '—'}
                          </td>
                          <td className="py-2.5 px-3 text-muted-foreground">
                            {item.specification ? (
                              <span className="px-1.5 py-0.5 rounded bg-secondary text-foreground text-[11px]">
                                {item.specification}
                              </span>
                            ) : (
                              '—'
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-right font-medium text-foreground">
                            {number(item.ordered_qty)}
                          </td>
                          <td className="py-2.5 px-3 text-right text-muted-foreground">
                            {money(item.unit_rate)}
                          </td>
                          <td className="py-2.5 px-3 text-right font-semibold text-foreground">
                            {money(item.total_price ?? (item.ordered_qty * item.unit_rate))}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* 4. Production Progress Bar */}
              <div className="p-3.5 sm:p-4 rounded-xl border border-border bg-card space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-foreground flex items-center gap-1.5">
                    <Package className="w-3.5 h-3.5 text-primary" />
                    Manufacturing & Dispatch Fulfillment
                  </span>
                  <span className="font-semibold text-foreground tabular-nums">
                    {number(activeCompletedQty)} / {number(activeTotalQty)} boxes ({activeProductionPercent}%)
                  </span>
                </div>
                <div className="w-full h-2 rounded-full bg-secondary overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                    style={{ width: `${activeProductionPercent}%` }}
                  />
                </div>
                <div className="flex justify-between items-center text-[11px] text-muted-foreground">
                  <span>{number(activeDispatchedQty)} boxes dispatched</span>
                  <span>{number(activePendingQty)} boxes pending</span>
                </div>
              </div>

              {/* 5. Clean Dialog Footer Actions */}
              <div className="pt-3 border-t border-border flex items-center justify-between gap-3">
                <div>
                  {isAdmin && activeOrder.status !== 'Completed' && activeOrder.status !== 'Cancelled' && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-destructive/50 text-destructive hover:bg-destructive/10 text-xs h-8 px-2.5 gap-1.5"
                      onClick={() => {
                        setCloseShortOrderId(activeOrder.id);
                        setCloseShortReason('');
                      }}
                    >
                      <Ban className="w-3.5 h-3.5" />
                      <span>Close Short</span>
                    </Button>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs h-8 px-3 gap-1.5 text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 hover:bg-emerald-500/10 border-emerald-500/30"
                    onClick={() => sendOrderWhatsApp(activeOrder, activeItems, activeParty)}
                  >
                    <WhatsAppIcon className="w-3.5 h-3.5" />
                    <span>WhatsApp</span>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs h-8 px-3 gap-1.5"
                    onClick={() => downloadCsv(`order-${activeOrder.order_no}`, activeItems)}
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>CSV</span>
                  </Button>
                  <Button
                    variant="default"
                    size="sm"
                    className="text-xs h-8 px-4 gap-1.5"
                    onClick={() => setViewOrderId(null)}
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Done</span>
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

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
                        <span>Product Type</span>
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
