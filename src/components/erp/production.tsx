import {useState, useEffect, useRef} from 'react';
import {UserPlus, Clock, Calendar, Layers, CheckCircle2, AlertCircle} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {Checkbox} from '@/components/ui/checkbox';
import {Dialog, DialogContent, DialogTitle} from '@/components/ui/dialog';
import {toast} from 'sonner';
import {useFactory} from './provider';
import {Heading, Empty, AccessNotice, SearchFilter, ExportButton, Pill, ViewTabs, FilterToken, TableCalcBar, Pagination, DateFilterPill, ThemedSelect, clearModalSearchParams} from './common';
import {number, money, downloadCsv, localDateTime, type Row} from '@/lib/erp-data';

function formatRemaining(now: number, tentativeCompletion: string, startTime: string) {
  const start = new Date(startTime).getTime();
  const end = new Date(tentativeCompletion).getTime();
  if (now >= end) return { isComplete: true, isPendingStart: false, text: 'Completed', percent: 100 };
  if (now < start) {
    const waitMs = start - now;
    const mins = Math.ceil(waitMs / 60000);
    return { isComplete: false, isPendingStart: true, text: `Starts in ${mins}m`, percent: 0 };
  }
  const diffMs = end - now;
  const totalMs = Math.max(1, end - start);
  const percent = Math.min(100, Math.max(0, Math.round(((now - start) / totalMs) * 100)));
  const hours = Math.floor(diffMs / 3600000);
  const mins = Math.floor((diffMs % 3600000) / 60000);
  const secs = Math.floor((diffMs % 60000) / 1000);
  const text = `${hours > 0 ? `${hours}h ` : ''}${String(mins).padStart(2, '0')}m ${String(secs).padStart(2, '0')}s remaining`;
  return { isComplete: false, isPendingStart: false, text, percent };
}

export function Production() {
  const {data: d, action} = useFactory();
  const [search, setSearch] = useState('');
  const [priorityTab, setPriorityTab] = useState('All');
  const [party, setParty] = useState('All');
  const [boxSize, setBoxSize] = useState('All');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [allocStatusFilter, setAllocStatusFilter] = useState('All');
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const [selected, setSelected] = useState<Row<'order_items'> | null>(null);
  const [batchesModalItem, setBatchesModalItem] = useState<Row<'order_items'> | null>(null);
  const [selectedLabourId, setSelectedLabourId] = useState<string>('');
  const [qty, setQty] = useState<number | ''>(1);
  const [rate, setRate] = useState<number | ''>('');
  const [hours, setHours] = useState(1);
  const [start, setStart] = useState(localDateTime());
  const [busy, setBusy] = useState(false);
  const [nowTick, setNowTick] = useState<number>(Date.now());
  const autoCompletingIds = useRef<Set<string>>(new Set());

  // Real-time second-by-second ticker for accurate countdowns & automatic dispatch completion
  useEffect(() => {
    const timer = setInterval(() => {
      setNowTick(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Automatic completion engine: checks whenever an allocation's scheduled duration has completed
  useEffect(() => {
    const now = Date.now();
    const incompleteAllocs = d.allocations.filter(a => a.completed_qty < a.allocated_qty);
    for (const alloc of incompleteAllocs) {
      const endTime = new Date(alloc.tentative_completion).getTime();
      if (now >= endTime && !autoCompletingIds.current.has(alloc.id)) {
        autoCompletingIds.current.add(alloc.id);
        action('complete', {
          id: alloc.id,
          completed_qty: alloc.allocated_qty
        }).then(ok => {
          if (ok) {
            toast.success(`Production complete: ${number(alloc.allocated_qty)} boxes automatically finished and sent to Ready to Dispatch!`);
          }
        }).finally(() => {
          autoCompletingIds.current.delete(alloc.id);
        });
      }
    }
  }, [nowTick, d.allocations, action]);

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

  const openAssignModal = (item: Row<'order_items'>, pendingQty: number) => {
    setSelected(item);
    setQty(pendingQty);
    setStart(localDateTime());
    setHours(1);
    if (d.workers.length > 0) {
      const initialWorker = d.workers[0];
      setSelectedLabourId(initialWorker.id);
      setRate(initialWorker.daily_rate);
    } else {
      setSelectedLabourId('');
      setRate('');
    }
  };

  const handleWorkerChange = (workerId: string) => {
    setSelectedLabourId(workerId);
    const worker = d.workers.find(w => w.id === workerId);
    if (worker) {
      setRate(worker.daily_rate);
    }
  };

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selected) return;
    setBusy(true);
    const f = new FormData(e.currentTarget);
    const labourId = selectedLabourId || String(f.get('labour_id'));
    const numQty = Number(qty) || 0;
    const numRate = Number(rate) || 0;
    const ok = await action('allocate', {
      order_item_id: selected.id,
      labour_id: labourId,
      allocated_qty: numQty,
      labour_rate: numRate,
      duration_hours: hours,
      start_time: new Date(start).toISOString()
    });
    setBusy(false);
    if (ok) {
      setSelected(null);
      setSelectedLabourId('');
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
        <SearchFilter value={search} onChange={setSearch} placeholder="Search product type, size or client…" />

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
            label="Product Size"
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

      {/* Desktop Table View (No Horizontal Scroll Needed) */}
      <div className="desktop-table-view table-wrap">
        <table className="w-full">
          <thead>
            <tr>
              <th className="w-8">
                <Checkbox aria-label="Select all" />
              </th>
              <th>Customer</th>
              <th>Product Type & Size</th>
              <th className="numeric">Ordered</th>
              <th className="numeric">Allocated</th>
              <th className="numeric">Completed</th>
              <th className="numeric">Unassigned</th>
              <th>Progress</th>
              <th>Priority</th>
              <th className="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {paginated.length ? paginated.map(i => {
              const o = d.orders.find(ord => ord.id === i.order_id);
              const unallocated = Math.max(0, i.ordered_qty - i.allocated_qty);
              const inProgress = Math.max(0, i.allocated_qty - i.completed_qty);
              const itemAllocations = d.allocations.filter(a => a.order_item_id === i.id);
              const partyName = o?.is_self_stock ? 'Self Stocking' : d.parties.find(p => p.id === o?.party_id)?.company_name ?? '—';

              const completedPct = i.ordered_qty > 0 ? (i.completed_qty / i.ordered_qty) * 100 : 0;
              const inProgressPct = i.ordered_qty > 0 ? (inProgress / i.ordered_qty) * 100 : 0;
              const unallocatedPct = i.ordered_qty > 0 ? (unallocated / i.ordered_qty) * 100 : 0;

              return (
                <tr key={i.id} className="clickable-row group" onClick={() => setBatchesModalItem(i)}>
                  <td onClick={e => e.stopPropagation()}>
                    <Checkbox aria-label={`Select ${i.box_type}`} />
                  </td>
                  <td>
                    <span className="font-semibold text-foreground">{partyName}</span>
                  </td>
                  <td>
                    <div className="flex items-center gap-1.5 whitespace-nowrap">
                      <span className="font-medium text-foreground">{i.box_type}</span>
                      <span className="text-[11px] text-muted-foreground font-mono bg-secondary/80 px-1.5 py-0.5 rounded border border-border/60">
                        {i.size_dimensions}
                      </span>
                    </div>
                  </td>
                  <td className="numeric font-medium text-foreground">{number(i.ordered_qty)}</td>
                  <td className="numeric text-blue-600 dark:text-blue-400 font-medium">{number(i.allocated_qty)}</td>
                  <td className="numeric text-emerald-500 font-medium">{number(i.completed_qty)}</td>
                  <td className="numeric">
                    {unallocated > 0 ? (
                      <span className="font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20 text-xs">
                        {number(unallocated)}
                      </span>
                    ) : (
                      <span className="text-muted-foreground text-xs font-mono">0</span>
                    )}
                  </td>
                  <td>
                    {/* Compact Pipeline Meter */}
                    <div className="w-20 space-y-0.5" title={`Completed: ${i.completed_qty}, In Work: ${inProgress}, Pending Assign: ${unallocated}`}>
                      <div className="w-full h-1.5 rounded-full bg-secondary overflow-hidden flex">
                        {completedPct > 0 && <div style={{width: `${completedPct}%`}} className="h-full bg-emerald-500" />}
                        {inProgressPct > 0 && <div style={{width: `${inProgressPct}%`}} className="h-full bg-blue-500" />}
                        {unallocatedPct > 0 && <div style={{width: `${unallocatedPct}%`}} className="h-full bg-amber-500" />}
                      </div>
                      <span className="text-[10px] text-muted-foreground block">{Math.round(completedPct)}% done</span>
                    </div>
                  </td>
                  <td><Pill value={i.priority_signal} /></td>
                  <td className="text-right" onClick={e => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-1.5">
                      {unallocated > 0 && (
                        <Button
                          variant="default"
                          size="sm"
                          className="h-7 text-xs bg-amber-600 hover:bg-amber-700 text-white font-medium gap-1 px-2.5 shadow-xs"
                          title={`Assign remaining ${number(unallocated)} boxes`}
                          onClick={() => openAssignModal(i, unallocated)}
                        >
                          <UserPlus className="w-3.5 h-3.5" />
                          <span>Assign ({number(unallocated)})</span>
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs px-2.5 gap-1"
                        title="View worker batches & live schedule"
                        onClick={() => setBatchesModalItem(i)}
                      >
                        <Layers className="w-3.5 h-3.5" />
                        <span>Batches ({itemAllocations.length})</span>
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            }) : (
              <Empty columns={10} label="No items in production queue" />
            )}
          </tbody>
          <tfoot>
            <tr className="border-t border-border bg-muted/20 font-medium">
              <td colSpan={3} className="text-right text-xs text-muted-foreground font-medium px-3 py-2.5">
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

      {/* Mobile Card View (No Horizontal Sliding Required) */}
      <div className="mobile-card-view">
        {paginated.length ? paginated.map(i => {
          const o = d.orders.find(ord => ord.id === i.order_id);
          const unallocated = Math.max(0, i.ordered_qty - i.allocated_qty);
          const inProgress = Math.max(0, i.allocated_qty - i.completed_qty);
          const itemAllocations = d.allocations.filter(a => a.order_item_id === i.id);
          const partyName = o?.is_self_stock ? 'Self Stocking' : d.parties.find(p => p.id === o?.party_id)?.company_name ?? '—';

          const completedPct = i.ordered_qty > 0 ? (i.completed_qty / i.ordered_qty) * 100 : 0;
          const inProgressPct = i.ordered_qty > 0 ? (inProgress / i.ordered_qty) * 100 : 0;
          const unallocatedPct = i.ordered_qty > 0 ? (unallocated / i.ordered_qty) * 100 : 0;

          return (
            <div
              key={i.id}
              className="mobile-record-card"
              onClick={() => setBatchesModalItem(i)}
            >
              <div className="mobile-card-top">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="min-w-0">
                    <div className="mobile-card-title">{partyName}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{i.box_type}</div>
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
                  <span className="mobile-card-value font-medium">{number(i.ordered_qty)}</span>
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
                  <span className="mobile-card-label">Unassigned</span>
                  <span className={`mobile-card-value font-bold ${unallocated > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground'}`}>
                    {number(unallocated)}
                  </span>
                </div>
              </div>

              {/* Mobile Pipeline Bar */}
              <div className="space-y-1 pt-1">
                <div className="w-full h-1.5 rounded-full bg-secondary overflow-hidden flex">
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
                    className="flex-1 h-7 text-xs bg-amber-600 hover:bg-amber-700 text-white font-medium gap-1 shadow-xs"
                    onClick={() => openAssignModal(i, unallocated)}
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    <span>Assign ({number(unallocated)})</span>
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  className={`${unallocated > 0 ? '' : 'flex-1'} h-7 text-xs px-2.5 gap-1`}
                  onClick={() => setBatchesModalItem(i)}
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>Batches ({itemAllocations.length})</span>
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

      {/* Super Clean Worker Batches & Production Schedule Dialog */}
      <Dialog open={!!batchesModalItem} onOpenChange={open => { if (!open) setBatchesModalItem(null); }}>
        <DialogContent className="modal-wide max-w-2xl" aria-describedby={undefined}>
          {(() => {
            if (!batchesModalItem) return null;
            const item = batchesModalItem;
            const o = d.orders.find(ord => ord.id === item.order_id);
            const partyName = o?.is_self_stock ? 'Self Stocking' : (d.parties.find(p => p.id === o?.party_id)?.company_name ?? '—');
            const itemAllocations = d.allocations.filter(a => a.order_item_id === item.id);
            const unallocated = Math.max(0, item.ordered_qty - item.allocated_qty);

            return (
              <div className="space-y-5">
                {/* Header */}
                <div className="pr-12 pb-3 border-b border-border">
                  <div className="flex items-center gap-2 flex-wrap">
                    <DialogTitle className="text-lg sm:text-xl font-semibold tracking-tight text-foreground m-0">
                      Batches: {item.box_type}
                    </DialogTitle>
                    <Pill value={item.priority_signal} />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Customer: <strong className="text-foreground">{partyName}</strong> · Size: <span className="font-mono">{item.size_dimensions}</span>
                  </p>
                </div>

                {/* Summary Strip */}
                <div className="grid grid-cols-3 gap-2.5">
                  <div className="p-3 rounded-xl bg-secondary/30 border border-border">
                    <span className="text-[10px] sm:text-[11px] font-medium text-muted-foreground uppercase tracking-wider block mb-0.5">
                      Total Ordered
                    </span>
                    <strong className="text-base sm:text-lg font-bold text-foreground">
                      {number(item.ordered_qty)} <span className="text-xs font-normal text-muted-foreground">boxes</span>
                    </strong>
                  </div>

                  <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                    <span className="text-[10px] sm:text-[11px] font-medium text-emerald-600 dark:text-emerald-400 uppercase tracking-wider block mb-0.5">
                      Ready to Dispatch
                    </span>
                    <strong className="text-base sm:text-lg font-bold text-emerald-600 dark:text-emerald-400">
                      {number(item.completed_qty)} <span className="text-xs font-normal text-muted-foreground">boxes</span>
                    </strong>
                  </div>

                  <div className={`p-3 rounded-xl border ${unallocated > 0 ? 'bg-amber-500/10 border-amber-500/20' : 'bg-secondary/30 border-border'}`}>
                    <span className={`text-[10px] sm:text-[11px] font-medium uppercase tracking-wider block mb-0.5 ${unallocated > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground'}`}>
                      Pending Allocation
                    </span>
                    <strong className={`text-base sm:text-lg font-bold ${unallocated > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-foreground'}`}>
                      {number(unallocated)} <span className="text-xs font-normal text-muted-foreground">boxes</span>
                    </strong>
                  </div>
                </div>

                {/* Unassigned Quick Action Banner */}
                {unallocated > 0 && (
                  <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                      <span className="text-amber-900 dark:text-amber-200">
                        <strong>{number(unallocated)} boxes</strong> still need worker allocation.
                      </span>
                    </div>
                    <Button
                      variant="default"
                      size="sm"
                      className="bg-amber-600 hover:bg-amber-700 text-white font-medium text-xs h-7 px-3 shrink-0 gap-1.5"
                      onClick={() => {
                        const itm = item;
                        setBatchesModalItem(null);
                        openAssignModal(itm, unallocated);
                      }}
                    >
                      <UserPlus className="w-3.5 h-3.5" />
                      <span>Assign Labour</span>
                    </Button>
                  </div>
                )}

                {/* Batches List */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs font-semibold text-foreground">
                    <span>Allocated Worker Batches ({itemAllocations.length})</span>
                    <span className="text-[11px] text-muted-foreground font-normal">
                      {number(item.allocated_qty)} of {number(item.ordered_qty)} boxes assigned
                    </span>
                  </div>

                  {itemAllocations.length > 0 ? (
                    <div className="space-y-2.5">
                      {itemAllocations.map((alloc, idx) => {
                        const worker = d.workers.find(w => w.id === alloc.labour_id);
                        const isAllocDone = alloc.completed_qty >= alloc.allocated_qty;
                        const timing = formatRemaining(nowTick, alloc.tentative_completion, alloc.start_time);

                        return (
                          <div
                            key={alloc.id}
                            className="p-3.5 rounded-xl border border-border bg-card shadow-xs space-y-2.5"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-semibold text-foreground">
                                    Batch #{idx + 1}: {worker?.labour_name || 'Worker'}
                                  </span>
                                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-secondary text-muted-foreground border border-border/60">
                                    {worker?.unit_assignment || 'General Station'}
                                  </span>
                                </div>
                                <div className="text-[11px] text-muted-foreground mt-0.5">
                                  Rate: <strong className="text-foreground">{money(alloc.labour_rate)}/box</strong> (Labour Total: {money(alloc.allocated_qty * alloc.labour_rate)})
                                </div>
                              </div>

                              <div>
                                {isAllocDone ? (
                                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                    <span>Completed → Ready to Dispatch</span>
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600 dark:text-blue-400 bg-blue-500/10 px-2.5 py-1 rounded-full border border-blue-500/20">
                                    <Clock className="w-3.5 h-3.5 animate-spin" />
                                    <span>{timing.text}</span>
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Batch Progress Bar & Live Status */}
                            <div>
                              <div className="flex justify-between items-center text-[11px] mb-1">
                                <span className="text-muted-foreground">
                                  Volume: <strong className="text-foreground">{number(alloc.allocated_qty)} boxes</strong>
                                </span>
                                <span className="text-[11px] font-medium text-foreground tabular-nums">
                                  {isAllocDone ? '100% completed' : `${timing.percent}% time elapsed`}
                                </span>
                              </div>
                              <div className="w-full h-1.5 rounded-full bg-secondary overflow-hidden">
                                <div
                                  className={`h-full transition-all duration-300 ${isAllocDone ? 'bg-emerald-500' : 'bg-blue-500'}`}
                                  style={{ width: `${isAllocDone ? 100 : timing.percent}%` }}
                                />
                              </div>
                            </div>

                            <div className="flex justify-between items-center text-[10px] text-muted-foreground pt-1 border-t border-border/50">
                              <span>Start: {new Date(alloc.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                              <span>
                                {isAllocDone
                                  ? 'Transferred to Dispatch Manifest'
                                  : `Auto-completes at ${new Date(alloc.tentative_completion).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="p-6 bg-secondary/20 border border-dashed border-border rounded-xl text-center text-xs text-muted-foreground space-y-1">
                      <div className="font-semibold text-foreground">No batches assigned yet</div>
                      <p>Allocate workers to initiate automated production timers.</p>
                    </div>
                  )}
                </div>

                {/* Footer */}
                <div className="pt-3 border-t border-border flex justify-end">
                  <Button variant="default" size="sm" onClick={() => setBatchesModalItem(null)}>
                    Done
                  </Button>
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Assign Labour Dialog (Fetches Rate from Labour Management & Sets Automated Duration) */}
      <Dialog open={!!selected} onOpenChange={(open) => { if (!open) { setSelected(null); clearModalSearchParams(); } }}>
        <DialogContent className="modal-wide max-w-2xl" aria-describedby={undefined}>
          <DialogTitle className="text-xl font-medium">Assign Labour to Production</DialogTitle>

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
                        <span className="text-muted-foreground block text-[11px]">Priority</span>
                        {selected && <Pill value={selected.priority_signal} />}
                      </div>
                      <div>
                        <span className="text-muted-foreground block text-[11px]">Total PO Ordered</span>
                        <strong className="text-foreground text-sm font-medium">{selected ? number(selected.ordered_qty) : 0} boxes</strong>
                      </div>
                      <div>
                        <span className="text-muted-foreground block text-[11px]">Remaining to Assign</span>
                        <strong className="text-amber-600 dark:text-amber-400 font-bold text-sm">{number(pendingPoQty)} boxes</strong>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <span className="text-muted-foreground block text-[11px]">Product Type & Size</span>
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

                  {exceedsPending && (
                    <div className="p-3 bg-destructive/10 border border-destructive/30 rounded-lg text-xs text-destructive space-y-1 mb-4">
                      <strong className="font-semibold block">⚠️ Assigned quantity ({number(numQty)}) exceeds remaining unallocated quantity ({number(pendingPoQty)} boxes)</strong>
                      <p>You cannot allocate more than the pending PO balance.</p>
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
                      Worker / Unit Station (Rate auto-fetched from Labour Management)
                      <ThemedSelect
                        name="labour_id"
                        value={selectedLabourId}
                        onChange={handleWorkerChange}
                        placeholder="Select worker or production team"
                        options={d.workers.map(w => ({
                          value: w.id,
                          label: `${w.labour_name}${w.unit_assignment ? ' · ' + w.unit_assignment : ''} (Standard: ₹${w.daily_rate}/box)`
                        }))}
                        required
                      />
                    </label>

                    <label>
                      <span>Quantity to Assign (Max {number(pendingPoQty)})</span>
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
                      <div className="flex items-center justify-between">
                        <span>Labour Rate Per Box (₹)</span>
                        <span className="text-[11px] text-muted-foreground font-normal">Fetched from Master</span>
                      </div>
                      <input
                        type="number"
                        min={0}
                        step=".01"
                        placeholder="e.g. 15.00"
                        value={rate === 0 || rate === '' ? '' : rate}
                        onChange={e => setRate(e.target.value === '' ? '' : Number(e.target.value))}
                        className="mt-1"
                      />
                    </label>

                    <label>
                      Scheduled Start Time
                      <input
                        type="datetime-local"
                        required
                        value={start}
                        onChange={e => setStart(e.target.value)}
                        className="mt-1"
                      />
                    </label>

                    <label>
                      Estimated Duration (1 to 10 Hours)
                      <ThemedSelect
                        name="duration_hours"
                        value={String(hours)}
                        onChange={v => setHours(Number(v))}
                        options={Array.from({length: 10}, (_, idx) => ({
                          value: String(idx + 1),
                          label: `${idx + 1} hour${idx > 0 ? 's' : ''}`
                        }))}
                      />
                    </label>
                  </div>

                  {/* Automated Completion & Timing Info */}
                  <div className="p-3 bg-secondary/40 border border-border rounded-xl text-xs space-y-1.5 my-3">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-foreground flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-primary" />
                        Automated Completion & Dispatch Flow
                      </span>
                      <strong className="text-foreground font-medium">
                        Completion at {new Date(new Date(start).getTime() + hours * 3600000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}, {new Date(new Date(start).getTime() + hours * 3600000).toLocaleDateString()}
                      </strong>
                    </div>
                  </div>

                  {/* Live Calculation Banner */}
                  <div className="form-calc-banner">
                    <div>
                      <span className="text-muted-foreground block text-xs">Total Estimated Cost</span>
                      <strong className="text-foreground font-semibold text-base">
                        {money((Number(qty) || 0) * (Number(rate) || 0))}
                      </strong>
                    </div>
                    <div className="text-right">
                      <span className="text-muted-foreground block text-xs">Batch Quantity</span>
                      <strong className="text-foreground font-medium text-sm">{number(Number(qty) || 0)} boxes</strong>
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
    </>
  );
}
