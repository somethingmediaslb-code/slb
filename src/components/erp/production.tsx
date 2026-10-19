import {useState, useEffect} from 'react';
import {UserPlus, Clock, Hammer, Calendar, ChevronDown, ChevronUp, Layers, CheckCircle2, AlertCircle, ArrowRight} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {Checkbox} from '@/components/ui/checkbox';
import {Dialog, DialogContent, DialogTitle} from '@/components/ui/dialog';
import {useFactory} from './provider';
import {Heading, Empty, AccessNotice, SearchFilter, ExportButton, Pill, ViewTabs, FilterToken, TableCalcBar, MiniProgress, SegmentedMeter, Pagination, DateFilterPill, ThemedSelect, clearModalSearchParams} from './common';
import {number, money, downloadCsv, localDateTime, type Row} from '@/lib/erp-data';

export function Production() {
  const {data: d, action} = useFactory();
  const [search, setSearch] = useState('');
  const [priorityTab, setPriorityTab] = useState('All');
  const [party, setParty] = useState('All');
  const [boxSize, setBoxSize] = useState('All');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [allocStatusFilter, setAllocStatusFilter] = useState('All');
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const [selected, setSelected] = useState<Row<'order_items'> | null>(null);
  const [completeItem, setCompleteItem] = useState<Row<'order_items'> | null>(null);
  const [completeAlloc, setCompleteAlloc] = useState<Row<'production_allocations'> | null>(null);
  const [completeQty, setCompleteQty] = useState<number | ''>('');
  const [qty, setQty] = useState<number | ''>(1);
  const [rate, setRate] = useState<number | ''>('');
  const [hours, setHours] = useState(1);
  const [start, setStart] = useState(localDateTime());
  const [busy, setBusy] = useState(false);

  // Compute pending items: active orders where items are not yet fully completed
  const pendingItems = d.items.filter(i => {
    const o = d.orders.find(ord => ord.id === i.order_id);
    if (o && (o.status === 'Completed' || o.status === 'Cancelled')) return false;
    return i.completed_qty < i.ordered_qty;
  });

  // Base pending items filtered by active party, size, date range, and search filters
  const basePending = pendingItems.filter(i => {
    const o = d.orders.find(o => o.id === i.order_id);
    const matchesParty = party === 'All' || (o?.is_self_stock && party === 'self') || o?.party_id === party;
    const matchesSize = boxSize === 'All' || i.size_dimensions === boxSize;
    const matchesStart = !startDate || (o?.order_date ?? '') >= startDate;
    const matchesEnd = !endDate || (o?.order_date ?? '') <= endDate;
    const matchesSearch = (i.box_type + ' ' + i.size_dimensions + ' ' + (o?.order_no ?? '')).toLowerCase().includes(search.toLowerCase());
    return matchesParty && matchesSize && matchesStart && matchesEnd && matchesSearch;
  });

  const redCount = basePending.filter(i => i.priority_signal === 'Red').length;
  const yellowCount = basePending.filter(i => i.priority_signal === 'Yellow').length;
  const greenCount = basePending.filter(i => i.priority_signal === 'Green').length;

  const sizeOptions = Array.from(new Set(pendingItems.map(i => i.size_dimensions).filter(Boolean)));

  const tabs = [
    {id: 'All', label: 'All Queue', count: basePending.length},
    {id: 'Red', label: 'Red Priority', count: redCount},
    {id: 'Yellow', label: 'Yellow Priority', count: yellowCount},
    {id: 'Green', label: 'Green Priority', count: greenCount},
  ];

  const filtered = basePending
    .filter(i => priorityTab === 'All' || i.priority_signal === priorityTab)
    .filter(i => {
      const unalloc = Math.max(0, i.ordered_qty - i.allocated_qty);
      if (allocStatusFilter === 'All') return true;
      if (allocStatusFilter === 'unallocated') return unalloc > 0;
      if (allocStatusFilter === 'partial') return i.allocated_qty > 0 && unalloc > 0;
      if (allocStatusFilter === 'fully_allocated') return unalloc === 0;
      return true;
    });

  useEffect(() => {
    setPage(1);
  }, [search, priorityTab, party, boxSize, startDate, endDate, allocStatusFilter]);

  const paginated = filtered.slice((page - 1) * pageSize, page * pageSize);

  const totalUnallocated = filtered.reduce((sum, i) => sum + Math.max(0, i.ordered_qty - i.allocated_qty), 0);
  const totalOrdered = filtered.reduce((sum, i) => sum + i.ordered_qty, 0);
  const totalAllocated = filtered.reduce((sum, i) => sum + i.allocated_qty, 0);
  const totalCompleted = filtered.reduce((sum, i) => sum + i.completed_qty, 0);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selected) return;
    setBusy(true);
    const f = new FormData(e.currentTarget);
    const numQty = Number(qty) || 0;
    const numRate = Number(rate) || 0;
    const ok = await action('allocate', {
      order_item_id: selected.id,
      labour_id: String(f.get('labour_id')),
      allocated_qty: numQty,
      labour_rate: numRate,
      duration_hours: hours,
      start_time: new Date(start).toISOString()
    });
    setBusy(false);
    if (ok) setSelected(null);
  }

  async function submitCompletion(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const item = completeItem || (completeAlloc ? d.items.find(i => i.id === completeAlloc.order_item_id) : null);
    const itemAllocs = item ? d.allocations.filter(a => a.order_item_id === item.id) : [];
    const targetAlloc = completeAlloc || itemAllocs[0];
    if (!targetAlloc) return;
    const enteredQty = completeQty === '' ? 0 : Number(completeQty);
    setBusy(true);
    const ok = await action('complete', {
      id: targetAlloc.id,
      completed_qty: Math.min(enteredQty, targetAlloc.allocated_qty)
    });
    setBusy(false);
    if (ok) {
      setCompleteItem(null);
      setCompleteAlloc(null);
    }
  }

  const selectedOrder = selected ? d.orders.find(o => o.id === selected.order_id) : null;

  return (
    <>
      <Heading title="Pending Production">
        <ExportButton onClick={() => downloadCsv('pending-production', filtered)} />
      </Heading>

      <AccessNotice />

      {/* Priority View Tabs */}
      <ViewTabs tabs={tabs} active={priorityTab} onChange={setPriorityTab} />

      {/* Filter Toolbar */}
      <div className="filters">
        <SearchFilter value={search} onChange={setSearch} placeholder="Search box type, size or order #…" />

        <FilterToken
          label="Client"
          value={party}
          onChange={setParty}
          options={[
            {value: 'All', label: 'All clients'},
            {value: 'self', label: 'Self Stocking'},
            ...d.parties.map(p => ({value: p.id, label: p.company_name}))
          ]}
        />

        <FilterToken
          label="Allocation State"
          value={allocStatusFilter}
          onChange={setAllocStatusFilter}
          options={[
            {value: 'All', label: 'All states'},
            {value: 'unallocated', label: `Needs Allocation (${basePending.filter(i => i.ordered_qty - i.allocated_qty > 0).length})`},
            {value: 'partial', label: `Partially Assigned (${basePending.filter(i => i.allocated_qty > 0 && i.ordered_qty - i.allocated_qty > 0).length})`},
            {value: 'fully_allocated', label: `Fully Assigned (${basePending.filter(i => i.ordered_qty - i.allocated_qty === 0).length})`},
          ]}
        />

        {sizeOptions.length > 0 && (
          <FilterToken
            label="Box Size"
            value={boxSize}
            onChange={setBoxSize}
            options={[
              {value: 'All', label: 'All sizes'},
              ...sizeOptions.map(s => ({value: s, label: s}))
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
              <th className="numeric">Pending Assign</th>
              <th>Pipeline Progress</th>
              <th>Priority</th>
              <th className="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {paginated.length ? paginated.map(i => {
              const o = d.orders.find(o => o.id === i.order_id);
              const unallocated = Math.max(0, i.ordered_qty - i.allocated_qty);
              const inProgress = Math.max(0, i.allocated_qty - i.completed_qty);
              const itemAllocations = d.allocations.filter(a => a.order_item_id === i.id);
              const partyName = o?.is_self_stock ? 'Self Stocking' : d.parties.find(p => p.id === o?.party_id)?.company_name ?? '—';
              const isExpanded = expandedItemId === i.id;

              const completedPct = i.ordered_qty > 0 ? (i.completed_qty / i.ordered_qty) * 100 : 0;
              const inProgressPct = i.ordered_qty > 0 ? (inProgress / i.ordered_qty) * 100 : 0;
              const unallocatedPct = i.ordered_qty > 0 ? (unallocated / i.ordered_qty) * 100 : 0;

              return (
                <>
                  <tr key={i.id} className="clickable-row group" onClick={() => setExpandedItemId(isExpanded ? null : i.id)}>
                    <td onClick={e => e.stopPropagation()}>
                      <Checkbox aria-label={`Select ${i.box_type}`} />
                    </td>
                    <td className="font-medium text-foreground">
                      <div className="flex items-center gap-1.5">
                        <span>{o?.order_no || '—'}</span>
                        <span className="text-[10px] text-muted-foreground group-hover:text-primary transition-colors">
                          {isExpanded ? <ChevronUp className="w-3.5 h-3.5 inline" /> : <ChevronDown className="w-3.5 h-3.5 inline" />}
                        </span>
                      </div>
                    </td>
                    <td>
                      <span className="font-medium text-foreground">{partyName}</span>
                    </td>
                    <td>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{i.box_type}</span>
                        <span className="text-xs text-muted-foreground font-mono bg-secondary/80 px-1 rounded">({i.size_dimensions})</span>
                      </div>
                    </td>
                    <td className="numeric font-medium">{number(i.ordered_qty)}</td>
                    <td className="numeric text-blue-600 dark:text-blue-400 font-medium">{number(i.allocated_qty)}</td>
                    <td className="numeric text-emerald-500 font-medium">{number(i.completed_qty)}</td>
                    <td className="numeric">
                      {unallocated > 0 ? (
                        <span className="inline-flex items-center gap-1 font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                          {number(unallocated)}
                        </span>
                      ) : (
                        <span className="text-muted-foreground text-xs">0 (All assigned)</span>
                      )}
                    </td>
                    <td>
                      {/* 3-Color Pipeline Meter */}
                      <div className="w-28 space-y-1" title={`Completed: ${i.completed_qty}, In Work: ${inProgress}, Pending Assign: ${unallocated}`}>
                        <div className="w-full h-2 rounded-full bg-secondary overflow-hidden flex">
                          {completedPct > 0 && <div style={{width: `${completedPct}%`}} className="h-full bg-emerald-500" />}
                          {inProgressPct > 0 && <div style={{width: `${inProgressPct}%`}} className="h-full bg-blue-500" />}
                          {unallocatedPct > 0 && <div style={{width: `${unallocatedPct}%`}} className="h-full bg-amber-500" />}
                        </div>
                        <div className="flex justify-between text-[10px] text-muted-foreground">
                          <span>{Math.round(completedPct)}% done</span>
                          {unallocated > 0 && <span className="text-amber-600 dark:text-amber-400 font-medium">{number(unallocated)} left</span>}
                        </div>
                      </div>
                    </td>
                    <td><Pill value={i.priority_signal} /></td>
                    <td className="text-right" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1.5">
                        {unallocated > 0 && (
                          <Button
                            variant="default"
                            size="sm"
                            className="h-8 text-xs bg-amber-600 hover:bg-amber-700 text-white font-medium gap-1 px-2.5 shadow-sm"
                            title={`Assign remaining ${number(unallocated)} boxes`}
                            onClick={() => {
                              setSelected(i);
                              setQty(unallocated);
                              setRate('');
                            }}
                          >
                            <UserPlus className="w-3.5 h-3.5" />
                            <span>Assign ({number(unallocated)})</span>
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 text-xs px-2.5 gap-1"
                          title="View and manage worker batches"
                          onClick={() => setExpandedItemId(isExpanded ? null : i.id)}
                        >
                          <Layers className="w-3.5 h-3.5" />
                          <span>Batches ({itemAllocations.length})</span>
                          {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                        </Button>
                      </div>
                    </td>
                  </tr>

                  {/* Desktop Expanded Batch Manager Sub-Row */}
                  {isExpanded && (
                    <tr className="bg-muted/15 border-b border-border">
                      <td colSpan={11} className="p-0">
                        <div className="p-4 bg-secondary/20 border-y border-border/80 space-y-4">
                          {/* Header banner */}
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border/60">
                            <div>
                              <div className="text-sm font-semibold text-foreground flex items-center gap-2">
                                <span>Batches & Production Pipeline: {i.box_type}</span>
                                <span className="font-mono text-xs text-muted-foreground bg-secondary px-1.5 py-0.5 rounded border border-border">
                                  {i.size_dimensions}
                                </span>
                              </div>
                              <div className="text-xs text-muted-foreground mt-0.5">
                                Order #{o?.order_no} · Total Requirement: <strong className="text-foreground">{number(i.ordered_qty)} boxes</strong>
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              {unallocated > 0 ? (
                                <Button
                                  variant="default"
                                  size="sm"
                                  className="gap-1.5 bg-amber-600 hover:bg-amber-700 text-white font-medium text-xs h-8"
                                  onClick={() => {
                                    setSelected(i);
                                    setQty(unallocated);
                                    setRate('');
                                  }}
                                >
                                  <UserPlus className="w-3.5 h-3.5" />
                                  <span>Assign Remaining ({number(unallocated)} boxes)</span>
                                </Button>
                              ) : (
                                <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">
                                  ✓ All {number(i.ordered_qty)} boxes fully allocated
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Pipeline Legend & Bar */}
                          <div className="space-y-1.5 bg-background p-3 rounded-lg border border-border/60">
                            <div className="flex justify-between items-center text-xs">
                              <span className="font-medium text-foreground">Order Volume Pipeline</span>
                              <div className="flex items-center gap-3 text-[11px]">
                                <span className="text-emerald-600 dark:text-emerald-400 font-medium">● Completed: {number(i.completed_qty)}</span>
                                <span className="text-blue-600 dark:text-blue-400 font-medium">● In Work: {number(inProgress)}</span>
                                <span className="text-amber-600 dark:text-amber-400 font-medium">● Pending Assign: {number(unallocated)}</span>
                              </div>
                            </div>
                            <div className="w-full h-2 rounded-full bg-secondary overflow-hidden flex">
                              {completedPct > 0 && <div style={{width: `${completedPct}%`}} className="h-full bg-emerald-500" />}
                              {inProgressPct > 0 && <div style={{width: `${inProgressPct}%`}} className="h-full bg-blue-500" />}
                              {unallocatedPct > 0 && <div style={{width: `${unallocatedPct}%`}} className="h-full bg-amber-500" />}
                            </div>
                          </div>

                          {/* Active Worker Batches Table */}
                          <div className="space-y-2">
                            <div className="text-xs font-semibold text-foreground flex items-center justify-between">
                              <span>Assigned Worker Batches ({itemAllocations.length})</span>
                              {itemAllocations.length > 0 && (
                                <span className="text-[11px] text-muted-foreground">
                                  Total Assigned: <strong className="text-foreground">{number(i.allocated_qty)}</strong> of {number(i.ordered_qty)} boxes
                                </span>
                              )}
                            </div>

                            {itemAllocations.length > 0 ? (
                              <div className="border border-border rounded-lg overflow-hidden bg-background shadow-xs">
                                <table className="w-full text-xs">
                                  <thead>
                                    <tr className="border-b border-border bg-muted/40 text-[11px] text-muted-foreground">
                                      <th className="text-left p-2.5">Worker / Station</th>
                                      <th className="text-right p-2.5">Allocated</th>
                                      <th className="text-right p-2.5">Completed</th>
                                      <th className="text-right p-2.5">Rate</th>
                                      <th className="text-right p-2.5">Est. Labour</th>
                                      <th className="text-center p-2.5">Batch Status</th>
                                      <th className="text-right p-2.5">Action</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {itemAllocations.map(alloc => {
                                      const worker = d.workers.find(w => w.id === alloc.labour_id);
                                      const isAllocDone = alloc.completed_qty >= alloc.allocated_qty;
                                      return (
                                        <tr key={alloc.id} className="border-b border-border/60 last:border-0 hover:bg-muted/20">
                                          <td className="p-2.5 font-medium text-foreground">
                                            <div>{worker?.labour_name || 'Worker'}</div>
                                            <div className="text-[10px] text-muted-foreground">{worker?.unit_assignment || 'General Station'}</div>
                                          </td>
                                          <td className="p-2.5 text-right font-medium">{number(alloc.allocated_qty)}</td>
                                          <td className="p-2.5 text-right font-medium text-emerald-600 dark:text-emerald-400">
                                            {number(alloc.completed_qty)}
                                          </td>
                                          <td className="p-2.5 text-right text-muted-foreground">{money(alloc.labour_rate)}</td>
                                          <td className="p-2.5 text-right font-medium text-foreground">{money(alloc.allocated_qty * alloc.labour_rate)}</td>
                                          <td className="p-2.5 text-center">
                                            {isAllocDone ? (
                                              <span className="text-[10px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">
                                                Finished ({number(alloc.completed_qty)}/{number(alloc.allocated_qty)})
                                              </span>
                                            ) : (
                                              <span className="text-[10px] font-medium text-blue-600 dark:text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded">
                                                In Work ({number(alloc.allocated_qty - alloc.completed_qty)} left)
                                              </span>
                                            )}
                                          </td>
                                          <td className="p-2.5 text-right">
                                            {!isAllocDone && (
                                              <Button
                                                variant="outline"
                                                size="sm"
                                                className="h-7 text-xs px-2.5 gap-1 border-primary/30 text-primary hover:bg-primary/10"
                                                onClick={() => {
                                                  setCompleteAlloc(alloc);
                                                  setCompleteItem(i);
                                                  setCompleteQty(alloc.completed_qty);
                                                }}
                                              >
                                                <Hammer className="w-3 h-3" />
                                                <span>Record Output</span>
                                              </Button>
                                            )}
                                          </td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            ) : (
                              <div className="p-4 bg-background border border-dashed border-border rounded-lg text-center text-xs text-muted-foreground space-y-1">
                                <div className="font-medium text-foreground">No labour assigned yet</div>
                                <div>Click "Assign Remaining" above to allocate workers to this production order.</div>
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              );
            }) : (
              <Empty columns={11} label="No items in production queue" />
            )}
          </tbody>
          <tfoot>
            <tr className="border-t border-border bg-muted/20 font-medium">
              <td colSpan={4} className="text-right text-xs text-muted-foreground font-medium px-3 py-2.5">
                Queue Totals ({number(filtered.length)} items):
              </td>
              <td className="numeric font-normal text-foreground px-3 py-2.5 tabular-nums">
                {number(totalOrdered)}
              </td>
              <td className="numeric text-blue-600 dark:text-blue-400 font-medium px-3 py-2.5 tabular-nums">
                {number(totalAllocated)}
              </td>
              <td className="numeric text-emerald-500 font-medium px-3 py-2.5 tabular-nums">
                {number(totalCompleted)}
              </td>
              <td className="numeric font-bold text-amber-600 dark:text-amber-400 px-3 py-2.5 tabular-nums">
                {number(totalUnallocated)}
              </td>
              <td colSpan={3} />
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Mobile Card View (Fully Responsive Mechanism) */}
      <div className="mobile-card-view">
        {paginated.length ? paginated.map(i => {
          const o = d.orders.find(o => o.id === i.order_id);
          const unallocated = Math.max(0, i.ordered_qty - i.allocated_qty);
          const inProgress = Math.max(0, i.allocated_qty - i.completed_qty);
          const itemAllocations = d.allocations.filter(a => a.order_item_id === i.id);
          const partyName = o?.is_self_stock ? 'Self Stocking' : d.parties.find(p => p.id === o?.party_id)?.company_name ?? '—';
          const isExpanded = expandedItemId === i.id;

          const completedPct = i.ordered_qty > 0 ? (i.completed_qty / i.ordered_qty) * 100 : 0;
          const inProgressPct = i.ordered_qty > 0 ? (inProgress / i.ordered_qty) * 100 : 0;
          const unallocatedPct = i.ordered_qty > 0 ? (unallocated / i.ordered_qty) * 100 : 0;

          return (
            <div
              key={i.id}
              className="mobile-record-card"
              onClick={() => setExpandedItemId(isExpanded ? null : i.id)}
            >
              <div className="mobile-card-top">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="min-w-0">
                    <div className="mobile-card-title">{partyName}</div>
                    <div className="mobile-card-sub">{o?.order_no || '—'} · {i.box_type}</div>
                  </div>
                </div>
                <Pill value={i.priority_signal} />
              </div>

              <div className="text-xs text-muted-foreground flex items-center justify-between">
                <span>Dimensions: <span className="text-foreground font-mono font-medium">{i.size_dimensions || 'Standard'}</span></span>
                {unallocated > 0 ? (
                  <span className="text-[11px] font-semibold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded">
                    {number(unallocated)} pending assign
                  </span>
                ) : (
                  <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">
                    All assigned
                  </span>
                )}
              </div>

              <div className="mobile-card-grid">
                <div className="mobile-card-field">
                  <span className="mobile-card-label">Ordered</span>
                  <span className="mobile-card-value">{number(i.ordered_qty)}</span>
                </div>
                <div className="mobile-card-field">
                  <span className="mobile-card-label">Allocated</span>
                  <span className="mobile-card-value text-blue-600 dark:text-blue-400 font-medium">{number(i.allocated_qty)}</span>
                </div>
                <div className="mobile-card-field">
                  <span className="mobile-card-label">Completed</span>
                  <span className="mobile-card-value text-emerald-500 font-medium">{number(i.completed_qty)}</span>
                </div>
                <div className="mobile-card-field">
                  <span className="mobile-card-label">Pending Assign</span>
                  <span className={`mobile-card-value font-bold ${unallocated > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground'}`}>
                    {number(unallocated)}
                  </span>
                </div>
              </div>

              {/* 3-Color Mobile Pipeline Bar */}
              <div className="space-y-1 pt-1">
                <div className="w-full h-2 rounded-full bg-secondary overflow-hidden flex">
                  {completedPct > 0 && <div style={{width: `${completedPct}%`}} className="h-full bg-emerald-500" />}
                  {inProgressPct > 0 && <div style={{width: `${inProgressPct}%`}} className="h-full bg-blue-500" />}
                  {unallocatedPct > 0 && <div style={{width: `${unallocatedPct}%`}} className="h-full bg-amber-500" />}
                </div>
                <div className="flex justify-between text-[10px] text-muted-foreground">
                  <span>{Math.round(completedPct)}% completed</span>
                  <span className="text-amber-600 dark:text-amber-400 font-medium">{number(unallocated)} to assign</span>
                </div>
              </div>

              {/* Mobile Actions Bar */}
              <div className="flex items-center gap-2 pt-2" onClick={e => e.stopPropagation()}>
                {unallocated > 0 && (
                  <Button
                    variant="default"
                    size="sm"
                    className="flex-1 h-8 text-xs bg-amber-600 hover:bg-amber-700 text-white font-medium gap-1 shadow-sm"
                    onClick={() => {
                      setSelected(i);
                      setQty(unallocated);
                      setRate('');
                    }}
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    <span>Assign ({number(unallocated)})</span>
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  className={`${unallocated > 0 ? '' : 'flex-1'} h-8 text-xs px-2.5 gap-1`}
                  onClick={() => setExpandedItemId(isExpanded ? null : i.id)}
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>Batches ({itemAllocations.length})</span>
                  {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </Button>
              </div>

              {/* Mobile Expanded Batch Manager */}
              {isExpanded && (
                <div className="mt-3 pt-3 border-t border-border space-y-3" onClick={e => e.stopPropagation()}>
                  <div className="text-xs font-semibold text-foreground flex items-center justify-between">
                    <span>Active Worker Batches ({itemAllocations.length})</span>
                    <span className="text-[11px] text-muted-foreground">{number(i.allocated_qty)} of {number(i.ordered_qty)} assigned</span>
                  </div>

                  {itemAllocations.length > 0 ? (
                    <div className="space-y-2">
                      {itemAllocations.map(alloc => {
                        const worker = d.workers.find(w => w.id === alloc.labour_id);
                        const isAllocDone = alloc.completed_qty >= alloc.allocated_qty;
                        return (
                          <div key={alloc.id} className="p-2.5 bg-background border border-border rounded-lg space-y-2 text-xs">
                            <div className="flex justify-between items-start">
                              <div>
                                <span className="font-semibold text-foreground block">{worker?.labour_name || 'Worker'}</span>
                                <span className="text-[10px] text-muted-foreground">{worker?.unit_assignment || 'Station'}</span>
                              </div>
                              <span className={`text-[10px] font-medium px-2 py-0.5 rounded ${isAllocDone ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-blue-500/10 text-blue-600 dark:text-blue-400'}`}>
                                {isAllocDone ? 'Completed' : 'In Work'}
                              </span>
                            </div>

                            <div className="grid grid-cols-3 gap-2 text-[11px] pt-1 border-t border-border/60">
                              <div>
                                <span className="text-muted-foreground block text-[10px]">Allocated</span>
                                <strong className="text-foreground">{number(alloc.allocated_qty)}</strong>
                              </div>
                              <div>
                                <span className="text-muted-foreground block text-[10px]">Completed</span>
                                <strong className="text-emerald-600 dark:text-emerald-400">{number(alloc.completed_qty)}</strong>
                              </div>
                              <div>
                                <span className="text-muted-foreground block text-[10px]">Rate</span>
                                <span className="text-foreground font-medium">{money(alloc.labour_rate)}</span>
                              </div>
                            </div>

                            {!isAllocDone && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="w-full h-7 text-xs gap-1 border-primary/30 text-primary hover:bg-primary/10 mt-1"
                                onClick={() => {
                                  setCompleteAlloc(alloc);
                                  setCompleteItem(i);
                                  setCompleteQty(alloc.completed_qty);
                                }}
                              >
                                <Hammer className="w-3 h-3" />
                                <span>Record Output</span>
                              </Button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="p-3 bg-background border border-dashed border-border rounded-lg text-center text-xs text-muted-foreground">
                      No workers assigned yet. Click "Assign" to allocate labour.
                    </div>
                  )}

                  {unallocated > 0 && (
                    <Button
                      variant="default"
                      size="sm"
                      className="w-full h-8 text-xs bg-amber-600 hover:bg-amber-700 text-white font-medium gap-1"
                      onClick={() => {
                        setSelected(i);
                        setQty(unallocated);
                        setRate('');
                      }}
                    >
                      <UserPlus className="w-3.5 h-3.5" />
                      <span>Assign Remaining Balance ({number(unallocated)} boxes)</span>
                    </Button>
                  )}
                </div>
              )}
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

      {/* Assign Labour Dialog (Handles Initial & Remaining Allocations) */}
      <Dialog open={!!selected} onOpenChange={(open) => { if (!open) { setSelected(null); clearModalSearchParams(); } }}>
        <DialogContent className="modal-wide" aria-describedby={undefined}>
          <DialogTitle className="text-xl font-medium">Assign Labour to Production</DialogTitle>
          <div className="form-subtitle">
            Allocate workers and machine time for {selected?.box_type} ({selectedOrder?.order_no}).
          </div>

          <form onSubmit={submit}>
            {(() => {
              const pendingPoQty = selected ? Math.max(0, selected.ordered_qty - selected.allocated_qty) : 0;
              const numQty = typeof qty === 'number' ? qty : Number(qty) || 0;
              const exceedsPending = numQty > pendingPoQty;
              const remainingAfterAssign = Math.max(0, pendingPoQty - numQty);
              const partyName = selectedOrder?.is_self_stock ? 'Self Stocking' : (d.parties.find(p => p.id === selectedOrder?.party_id)?.company_name ?? '—');
              const itemExistingAllocations = selected ? d.allocations.filter(a => a.order_item_id === selected.id) : [];

              return (
                <>
                  <div className="form-section-title">1. Order Specifications & Allocation Balance</div>
                  <div className="p-3.5 bg-secondary/50 border border-border rounded-xl mb-4 text-xs space-y-3">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pb-3 border-b border-border/60">
                      <div>
                        <span className="text-muted-foreground block text-[11px]">Party / Customer</span>
                        <strong className="text-foreground text-sm font-medium">{partyName}</strong>
                      </div>
                      <div>
                        <span className="text-muted-foreground block text-[11px]">PO / Order #</span>
                        <strong className="text-foreground text-sm font-medium">{selectedOrder?.order_no || '—'}</strong>
                      </div>
                      <div>
                        <span className="text-muted-foreground block text-[11px]">Priority</span>
                        {selected && <Pill value={selected.priority_signal} />}
                      </div>
                      <div>
                        <span className="text-muted-foreground block text-[11px]">Total PO Ordered</span>
                        <strong className="text-foreground text-sm font-medium">{selected ? number(selected.ordered_qty) : 0} boxes</strong>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <span className="text-muted-foreground block text-[11px]">Box Type & Size</span>
                        <span className="text-foreground font-medium">{selected?.box_type} · {selected?.size_dimensions}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground block text-[11px]">Full Specifications</span>
                        <span className="text-foreground font-medium">{selected?.specification || 'Standard specification'}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground block text-[11px]">Code / Remarks</span>
                        <span className="text-muted-foreground">{selected?.code_remarks || '—'}</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-3 pt-2 border-t border-border/60 text-xs">
                      <div>
                        <span className="text-muted-foreground block text-[11px]">Already Allocated</span>
                        <span className="text-blue-600 dark:text-blue-400 font-semibold">{selected ? number(selected.allocated_qty) : 0} boxes</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground block text-[11px]">Already Completed</span>
                        <span className="text-emerald-500 font-semibold">{selected ? number(selected.completed_qty) : 0} boxes</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground block text-[11px]">Remaining to Assign</span>
                        <strong className="text-amber-600 dark:text-amber-400 font-bold text-sm">{number(pendingPoQty)} boxes</strong>
                      </div>
                    </div>
                  </div>

                  {/* List of existing allocations if partial */}
                  {itemExistingAllocations.length > 0 && (
                    <div className="p-3 bg-background border border-border rounded-lg text-xs space-y-2 mb-4">
                      <div className="font-semibold text-foreground flex items-center justify-between">
                        <span>Current Worker Assignments ({itemExistingAllocations.length}):</span>
                        <span className="text-muted-foreground text-[11px]">{number(selected?.allocated_qty ?? 0)} of {number(selected?.ordered_qty ?? 0)} assigned</span>
                      </div>
                      <div className="divide-y divide-border/60">
                        {itemExistingAllocations.map((a, idx) => {
                          const w = d.workers.find(wk => wk.id === a.labour_id);
                          return (
                            <div key={a.id} className="py-1.5 flex items-center justify-between text-[11px]">
                              <span className="font-medium text-foreground">
                                Batch #{idx + 1}: {w?.labour_name || 'Worker'} ({w?.unit_assignment || 'Station'})
                              </span>
                              <span className="text-muted-foreground">
                                {number(a.allocated_qty)} boxes ({number(a.completed_qty)} completed) · {money(a.labour_rate)}/box
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <div className="form-section-title">2. New Worker Assignment & Batch Sizing</div>

                  {exceedsPending && (
                    <div className="p-3 bg-destructive/10 border border-destructive/30 rounded-lg text-xs text-destructive space-y-1 mb-4">
                      <strong className="font-semibold block">⚠️ Assigned quantity ({number(numQty)}) exceeds remaining unallocated quantity ({number(pendingPoQty)} boxes)</strong>
                      <p>You cannot allocate more than the pending PO balance. If you need to produce more, please increase the quantity in Order Entry first.</p>
                    </div>
                  )}

                  {!exceedsPending && numQty > 0 && numQty < pendingPoQty && (
                    <div className="p-2.5 bg-blue-500/10 border border-blue-500/20 rounded-lg text-xs text-blue-600 dark:text-blue-400 flex items-center justify-between mb-4">
                      <span>Remaining unassigned balance after this batch:</span>
                      <strong className="font-semibold">{number(remainingAfterAssign)} boxes (can be assigned to another worker)</strong>
                    </div>
                  )}

                  <div className="form-grid">
                    <label className="form-wide">
                      Worker / Unit Station
                      <ThemedSelect
                        name="labour_id"
                        placeholder="Select worker or production team"
                        options={d.workers.map(w => ({
                          value: w.id,
                          label: `${w.labour_name}${w.unit_assignment ? ' · ' + w.unit_assignment : ''}`
                        }))}
                        required
                      />
                    </label>

                    <label>
                      <div className="flex items-center justify-between">
                        <span>Quantity to Assign (Max {number(pendingPoQty)})</span>
                        <div className="flex gap-1">
                          <button
                            type="button"
                            className="text-[10px] px-2 py-0.5 rounded bg-secondary hover:bg-muted font-medium text-foreground border border-border"
                            onClick={() => setQty(pendingPoQty)}
                          >
                            Assign All ({number(pendingPoQty)})
                          </button>
                          {pendingPoQty >= 2 && (
                            <button
                              type="button"
                              className="text-[10px] px-2 py-0.5 rounded bg-secondary hover:bg-muted font-medium text-foreground border border-border"
                              onClick={() => setQty(Math.floor(pendingPoQty / 2))}
                            >
                              Half ({number(Math.floor(pendingPoQty / 2))})
                            </button>
                          )}
                        </div>
                      </div>
                      <input
                        type="number"
                        min={1}
                        max={pendingPoQty}
                        required
                        value={qty === '' ? '' : qty}
                        onChange={e => setQty(e.target.value === '' ? '' : Number(e.target.value))}
                        className="mt-1"
                      />
                    </label>

                    <label>
                      Labour Rate Per Box (₹)
                      <input
                        type="number"
                        min={0}
                        step=".01"
                        placeholder="e.g. 15.00"
                        value={rate === 0 || rate === '' ? '' : rate}
                        onChange={e => setRate(e.target.value === '' ? '' : Number(e.target.value))}
                      />
                    </label>

                    <label>
                      Scheduled Start Time
                      <input
                        type="datetime-local"
                        required
                        value={start}
                        onChange={e => setStart(e.target.value)}
                      />
                    </label>

                    <label>
                      Estimated Duration (1 to 10 Hours)
                      <ThemedSelect
                        name="duration_hours"
                        value={String(hours)}
                        onChange={v => setHours(Number(v))}
                        options={Array.from({length: 10}, (_, i) => ({
                          value: String(i + 1),
                          label: `${i + 1} hour${i > 0 ? 's' : ''}`
                        }))}
                      />
                    </label>
                  </div>

                  {/* Live Calculation Banner */}
                  <div className="form-calc-banner">
                    <div>
                      <span className="text-muted-foreground block text-xs">Estimated Completion</span>
                      <strong className="text-foreground font-medium text-xs">
                        {new Date(new Date(start).getTime() + hours * 3600000).toLocaleString()}
                      </strong>
                    </div>
                    <div className="text-right">
                      <span className="text-muted-foreground block text-xs">Total Batch Labour Price ({number(Number(qty) || 0)} × ₹{rate || '0.00'})</span>
                      <strong className="text-foreground font-semibold text-base">{money((Number(qty) || 0) * (Number(rate) || 0))}</strong>
                    </div>
                  </div>

                  <div className="form-actions">
                    <Button variant="outline" type="button" onClick={() => setSelected(null)}>Cancel</Button>
                    <Button type="submit" disabled={busy || exceedsPending || numQty <= 0}>
                      {busy ? 'Assigning…' : `Confirm Batch Allocation (${number(numQty)} boxes)`}
                    </Button>
                  </div>
                </>
              );
            })()}
          </form>
        </DialogContent>
      </Dialog>

      {/* Record Completed Output Dialog (Targets Specific Worker Allocation) */}
      <Dialog open={!!completeItem || !!completeAlloc} onOpenChange={(open) => { if (!open) { setCompleteItem(null); setCompleteAlloc(null); clearModalSearchParams(); } }}>
        <DialogContent className="modal-wide" aria-describedby={undefined}>
          <DialogTitle className="text-xl font-medium">Record Completed Production Output</DialogTitle>
          {(() => {
            const item = completeItem || (completeAlloc ? d.items.find(i => i.id === completeAlloc.order_item_id) : null);
            const itemAllocs = item ? d.allocations.filter(a => a.order_item_id === item.id) : [];
            const activeAlloc = completeAlloc || itemAllocs[0];
            const activeWorker = activeAlloc ? d.workers.find(w => w.id === activeAlloc.labour_id) : null;

            return (
              <form onSubmit={submitCompletion}>
                <div className="form-subtitle">
                  Record finished boxes manufactured by workers for {item?.box_type} ({item?.size_dimensions}).
                </div>

                {/* If multiple batches exist for this item, let user switch between them */}
                {itemAllocs.length > 1 && (
                  <div className="mb-4">
                    <label className="text-xs font-medium text-foreground block mb-1.5">
                      Select Worker Batch to Update Output:
                    </label>
                    <ThemedSelect
                      value={activeAlloc?.id || ''}
                      onChange={(allocId) => {
                        const found = itemAllocs.find(a => a.id === allocId);
                        if (found) {
                          setCompleteAlloc(found);
                          setCompleteQty(found.completed_qty);
                        }
                      }}
                      options={itemAllocs.map(a => {
                        const w = d.workers.find(wk => wk.id === a.labour_id);
                        return {
                          value: a.id,
                          label: `${w?.labour_name || 'Worker'} — ${number(a.allocated_qty)} boxes allocated (${number(a.completed_qty)} previously completed)`
                        };
                      })}
                    />
                  </div>
                )}

                {activeAlloc && (
                  <div className="p-3.5 bg-secondary/40 border border-border rounded-xl text-xs space-y-2 mb-4">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div>
                        <span className="text-muted-foreground block text-[11px]">Assigned Worker</span>
                        <strong className="text-foreground text-sm">{activeWorker?.labour_name || 'Worker'}</strong>
                        <span className="text-[10px] text-muted-foreground block">{activeWorker?.unit_assignment || 'General Station'}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground block text-[11px]">Batch Allocated</span>
                        <strong className="text-foreground text-sm">{number(activeAlloc.allocated_qty)} boxes</strong>
                      </div>
                      <div>
                        <span className="text-muted-foreground block text-[11px]">Previously Completed</span>
                        <strong className="text-emerald-600 dark:text-emerald-400 text-sm">{number(activeAlloc.completed_qty)} boxes</strong>
                      </div>
                      <div>
                        <span className="text-muted-foreground block text-[11px]">Remaining for Worker</span>
                        <strong className="text-blue-600 dark:text-blue-400 text-sm">{number(Math.max(0, activeAlloc.allocated_qty - activeAlloc.completed_qty))} boxes</strong>
                      </div>
                    </div>
                  </div>
                )}

                <div className="form-grid">
                  <label className="form-wide">
                    <div className="flex items-center justify-between">
                      <span>Total Completed Quantity for this Batch (Boxes)</span>
                      {activeAlloc && (
                        <button
                          type="button"
                          className="text-[10px] px-2 py-0.5 rounded bg-secondary hover:bg-muted font-medium text-foreground border border-border"
                          onClick={() => setCompleteQty(activeAlloc.allocated_qty)}
                        >
                          Mark 100% Finished ({number(activeAlloc.allocated_qty)} boxes)
                        </button>
                      )}
                    </div>
                    <input
                      type="number"
                      min={activeAlloc?.completed_qty ?? 0}
                      max={activeAlloc?.allocated_qty ?? 0}
                      placeholder={`Max ${activeAlloc?.allocated_qty ?? 0} boxes`}
                      required
                      value={completeQty === '' ? '' : completeQty}
                      onChange={e => setCompleteQty(e.target.value === '' ? '' : Number(e.target.value))}
                      className="mt-1"
                    />
                  </label>
                </div>
                <div className="form-actions">
                  <Button variant="outline" type="button" onClick={() => { setCompleteItem(null); setCompleteAlloc(null); }}>Cancel</Button>
                  <Button type="submit" disabled={busy || !activeAlloc}>
                    {busy ? 'Saving…' : 'Save Completed Output'}
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
