import { useState, useEffect } from 'react';
import { useNavigate } from '@tanstack/react-router';
import {
  Clock,
  CheckCircle2,
  AlertTriangle,
  PlayCircle,
  Factory,
  Layers,
  User,
  Package,
  Calendar,
  Building2,
  Timer,
  Flame,
  ArrowRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { useFactory } from './provider';
import {
  Heading,
  Empty,
  AccessNotice,
  SearchFilter,
  FilterToken,
  ViewTabs,
  Pill,
  clearModalSearchParams
} from './common';
import { money, number, dateLabel, type Row } from '@/lib/erp-data';
import { toast } from 'sonner';

function formatRemaining(nowTick: number, tentativeIso: string, startIso?: string) {
  const target = new Date(tentativeIso).getTime();
  const start = startIso ? new Date(startIso).getTime() : target - 3600000;
  const diffMs = target - nowTick;
  const totalDuration = Math.max(1000, target - start);

  if (diffMs <= 0) {
    return {
      text: '00:00 (Completed)',
      isDone: true,
      percent: 100,
      totalSeconds: 0
    };
  }

  const elapsedMs = Math.max(0, nowTick - start);
  const percent = Math.min(99, Math.max(0, Math.round((elapsedMs / totalDuration) * 100)));

  const totalSecs = Math.floor(diffMs / 1000);
  const hrs = Math.floor(totalSecs / 3600);
  const mins = Math.floor((totalSecs % 3600) / 60);
  const secs = totalSecs % 60;

  if (hrs > 0) {
    return {
      text: `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`,
      isDone: false,
      percent,
      totalSeconds: totalSecs
    };
  }

  return {
    text: `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`,
    isDone: false,
    percent,
    totalSeconds: totalSecs
  };
}

export function UnderProduction() {
  const { data: d, action, refresh } = useFactory();
  const navigate = useNavigate();

  // Realtime clock ticking every second for live timers
  const [nowTick, setNowTick] = useState<number>(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const [search, setSearch] = useState('');
  const [priorityTab, setPriorityTab] = useState<'All' | 'Red' | 'Yellow' | 'Green'>('All');
  const [selectedWorkerId, setSelectedWorkerId] = useState('All');

  // Modal to record early or exact completion for an active batch
  const [completingAlloc, setCompletingAlloc] = useState<Row<'production_allocations'> | null>(null);
  const [completeQty, setCompleteQty] = useState<number | ''>('');
  const [busy, setBusy] = useState(false);

  // Active allocations: only those assigned and still running (completed_qty < allocated_qty)
  const activeAllocations = d.allocations.filter(a => a.completed_qty < a.allocated_qty && a.status !== 'Completed');

  // Filter active allocations based on search, priority, worker
  const filteredActive = activeAllocations.filter(a => {
    if (selectedWorkerId !== 'All' && a.labour_id !== selectedWorkerId) return false;

    const item = d.items.find(i => i.id === a.order_item_id);
    const order = item ? d.orders.find(o => o.id === item.order_id) : null;
    const worker = d.workers.find(w => w.id === a.labour_id);
    const party = order?.is_self_stock ? 'Self Stocking' : d.parties.find(p => p.id === order?.party_id)?.company_name ?? '';

    if (priorityTab !== 'All' && item?.priority_signal !== priorityTab) return false;

    if (search.trim()) {
      const q = search.toLowerCase();
      const match =
        (order?.order_no || '').toLowerCase().includes(q) ||
        party.toLowerCase().includes(q) ||
        (item?.box_type || '').toLowerCase().includes(q) ||
        (item?.size_dimensions || '').toLowerCase().includes(q) ||
        (worker?.labour_name || '').toLowerCase().includes(q) ||
        (worker?.unit_assignment || '').toLowerCase().includes(q);
      if (!match) return false;
    }

    return true;
  });

  // Group active batches by Order & Order Item for prominent order recognition
  interface OrderGroup {
    order: Row<'orders'> | null;
    item: Row<'order_items'>;
    partyName: string;
    batches: Row<'production_allocations'>[];
  }

  const orderGroupsMap = new Map<string, OrderGroup>();

  for (const alloc of filteredActive) {
    const item = d.items.find(i => i.id === alloc.order_item_id);
    if (!item) continue;
    const order = d.orders.find(o => o.id === item.order_id) ?? null;
    const partyName = order?.is_self_stock
      ? 'Self Stocking'
      : d.parties.find(p => p.id === order?.party_id)?.company_name ?? 'Client Order';

    const groupKey = item.id;
    if (!orderGroupsMap.has(groupKey)) {
      orderGroupsMap.set(groupKey, {
        order,
        item,
        partyName,
        batches: []
      });
    }
    orderGroupsMap.get(groupKey)!.batches.push(alloc);
  }

  const orderGroups = Array.from(orderGroupsMap.values());

  // Aggregate KPI stats
  const totalActiveBatches = filteredActive.length;
  const totalActiveBoxes = filteredActive.reduce((sum, a) => sum + (a.allocated_qty - a.completed_qty), 0);
  const activeWorkerIds = new Set(filteredActive.map(a => a.labour_id));
  const activeLabourCost = filteredActive.reduce((sum, a) => sum + (a.allocated_qty * (a.labour_rate || 0)), 0);

  const openCompleteModal = (alloc: Row<'production_allocations'>) => {
    setCompletingAlloc(alloc);
    setCompleteQty(alloc.allocated_qty);
  };

  async function handleCompleteSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!completingAlloc) return;
    setBusy(true);
    const num = Number(completeQty) || completingAlloc.allocated_qty;
    const ok = await action('complete', {
      id: completingAlloc.id,
      completed_qty: num
    });
    setBusy(false);
    if (ok) {
      setCompletingAlloc(null);
      toast.success('Production completion recorded successfully');
    }
  }

  return (
    <>
      <Heading title="Under Production">
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={() => navigate({ to: '/production' })}
        >
          <Factory className="w-4 h-4 text-amber-500" />
          <span>Pending Production</span>
          <ArrowRight className="w-3.5 h-3.5 text-muted-foreground" />
        </Button>
      </Heading>

      <AccessNotice />

      {/* KPI Stats Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <div className="p-4 bg-card border border-border rounded-xl flex items-center justify-between">
          <div>
            <span className="text-xs text-muted-foreground block font-medium">Active Running Batches</span>
            <strong className="text-2xl font-bold text-foreground mt-0.5 block">{number(totalActiveBatches)}</strong>
            <span className="text-[11px] text-blue-500 font-medium">Timers ticking live</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-500">
            <Clock className="w-5 h-5 animate-spin" />
          </div>
        </div>

        <div className="p-4 bg-card border border-border rounded-xl flex items-center justify-between">
          <div>
            <span className="text-xs text-muted-foreground block font-medium">Units Under Production</span>
            <strong className="text-2xl font-bold text-foreground mt-0.5 block">{number(totalActiveBoxes)}</strong>
            <span className="text-[11px] text-muted-foreground">Boxes being manufactured</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-500">
            <Package className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 bg-card border border-border rounded-xl flex items-center justify-between">
          <div>
            <span className="text-xs text-muted-foreground block font-medium">Active Floor Workers</span>
            <strong className="text-2xl font-bold text-foreground mt-0.5 block">{activeWorkerIds.size}</strong>
            <span className="text-[11px] text-muted-foreground">Assigned on stations</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-500">
            <User className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 bg-card border border-border rounded-xl flex items-center justify-between">
          <div>
            <span className="text-xs text-muted-foreground block font-medium">Floor Labour Value</span>
            <strong className="text-2xl font-bold text-emerald-500 mt-0.5 block">{money(activeLabourCost)}</strong>
            <span className="text-[11px] text-muted-foreground">Running batch wages</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-500">
            <Flame className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Priority Tabs */}
      <ViewTabs
        tabs={[
          { key: 'All', label: 'All Active' },
          { key: 'Red', label: 'Urgent Red' },
          { key: 'Yellow', label: 'Medium Yellow' },
          { key: 'Green', label: 'Standard Green' }
        ]}
        active={priorityTab}
        onChange={setPriorityTab}
      />

      {/* Filters Toolbar */}
      <div className="filters mb-6">
        <SearchFilter
          value={search}
          onChange={setSearch}
          placeholder="Search PO #, client, product, worker, station…"
        />

        <FilterToken
          label="Worker / Station"
          value={selectedWorkerId}
          onChange={setSelectedWorkerId}
          options={[
            { value: 'All', label: 'All Floor Workers' },
            ...d.workers.map(w => ({
              value: w.id,
              label: `${w.labour_name}${w.unit_assignment ? ' · ' + w.unit_assignment : ''}`
            }))
          ]}
        />
      </div>

      {/* Order Recognition & Batches List (Showing multiple batches one by one) */}
      {orderGroups.length > 0 ? (
        <div className="space-y-6">
          {orderGroups.map(group => {
            const { order, item, partyName, batches } = group;
            const itemTotalOrdered = item.ordered_qty;
            const itemTotalCompleted = item.completed_qty;
            const itemFloorRunning = batches.reduce((s, b) => s + (b.allocated_qty - b.completed_qty), 0);

            return (
              <div
                key={item.id}
                className="bg-card border border-border/80 rounded-2xl overflow-hidden shadow-xs transition-all hover:border-border"
              >
                {/* 1. Single Order Recognition Header */}
                <div className="p-4 sm:p-5 bg-secondary/40 border-b border-border/70 flex flex-wrap items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <span className="font-mono font-bold text-foreground text-sm bg-background/80 px-2.5 py-1 rounded-md border border-border shadow-xs">
                        {order?.order_no || 'PO-MANUAL'}
                      </span>
                      <strong className="text-foreground text-base font-semibold">{partyName}</strong>
                      <Pill value={item.priority_signal} />
                      <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5" />
                        {order?.order_date ? dateLabel(order.order_date) : 'Today'}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap pt-1">
                      <span className="font-medium text-foreground">{item.box_type}</span>
                      <span>·</span>
                      <span className="font-mono bg-secondary px-1.5 py-0.5 rounded border border-border/60 text-foreground">
                        {item.size_dimensions || 'Standard'}
                      </span>
                      {item.specification && (
                        <>
                          <span>·</span>
                          <span className="truncate max-w-xs">{item.specification}</span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Order Progress Summary Badges */}
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <span className="text-[11px] text-muted-foreground block">PO Quantity</span>
                      <strong className="text-foreground font-semibold text-sm">
                        {number(itemTotalOrdered)} boxes
                      </strong>
                    </div>
                    <div className="h-8 w-px bg-border/60" />
                    <div className="text-right">
                      <span className="text-[11px] text-muted-foreground block">Working on Floor</span>
                      <strong className="text-blue-600 dark:text-blue-400 font-bold text-sm">
                        {number(itemFloorRunning)} boxes ({batches.length} {batches.length === 1 ? 'batch' : 'batches'})
                      </strong>
                    </div>
                    <div className="h-8 w-px bg-border/60" />
                    <div className="text-right">
                      <span className="text-[11px] text-muted-foreground block">Finished</span>
                      <strong className="text-emerald-500 font-semibold text-sm">
                        {number(itemTotalCompleted)} boxes
                      </strong>
                    </div>
                  </div>
                </div>

                {/* 2. Multiple Batches Working: Shown One by One */}
                <div className="p-4 sm:p-5 space-y-3.5 bg-background/50">
                  <div className="flex items-center justify-between text-xs text-muted-foreground font-medium pb-1 border-b border-border/40">
                    <span className="flex items-center gap-1.5 uppercase tracking-wider text-[11px]">
                      <Layers className="w-3.5 h-3.5 text-primary" />
                      <span>Active Production Batches ({batches.length})</span>
                    </span>
                    <span>Live Clock & Real-time Progress</span>
                  </div>

                  <div className="grid grid-cols-1 gap-3">
                    {batches.map((batch, batchIdx) => {
                      const worker = d.workers.find(w => w.id === batch.labour_id);
                      const isAllocDone = batch.completed_qty >= batch.allocated_qty;
                      const timing = formatRemaining(nowTick, batch.tentative_completion, batch.start_time);
                      const pendingBatchQty = Math.max(0, batch.allocated_qty - batch.completed_qty);
                      const batchCost = batch.allocated_qty * (batch.labour_rate || 0);

                      return (
                        <div
                          key={batch.id}
                          className="p-4 rounded-xl border border-border/80 bg-card hover:border-blue-500/40 transition-all shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4"
                        >
                          {/* Batch Identity & Worker Details */}
                          <div className="space-y-1.5 min-w-[260px]">
                            <div className="flex items-center gap-2">
                              <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                                Batch #{batchIdx + 1}
                              </span>
                              <strong className="text-foreground text-sm font-semibold">
                                {worker?.labour_name || 'Worker'}
                              </strong>
                              {worker?.unit_assignment && (
                                <span className="text-[11px] px-2 py-0.5 rounded bg-secondary text-muted-foreground border border-border/60">
                                  {worker.unit_assignment}
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                              <span>
                                Batch Volume: <strong className="text-foreground font-semibold">{number(batch.allocated_qty)} boxes</strong>
                              </span>
                              <span>·</span>
                              <span>
                                Rate: <strong className="text-foreground">{money(batch.labour_rate)}/box</strong>
                              </span>
                              <span>·</span>
                              <span>
                                Labour Wages: <strong className="text-emerald-500 font-medium">{money(batchCost)}</strong>
                              </span>
                            </div>
                          </div>

                          {/* Live Ticking Countdown & Progress Bar */}
                          <div className="flex-1 max-w-md space-y-1.5">
                            <div className="flex items-center justify-between text-xs">
                              <div className="flex items-center gap-2">
                                <span className="inline-flex items-center gap-1 font-mono font-bold text-sm px-2.5 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/30">
                                  <Clock className="w-3.5 h-3.5 animate-spin text-blue-500" />
                                  <span>{timing.text}</span>
                                </span>
                                <span className="text-[11px] text-muted-foreground">remaining</span>
                              </div>
                              <span className="text-xs font-medium text-foreground tabular-nums">
                                {timing.percent}% time elapsed
                              </span>
                            </div>

                            <div className="w-full h-2 rounded-full bg-secondary overflow-hidden">
                              <div
                                className={`h-full transition-all duration-300 ${
                                  timing.percent >= 90
                                    ? 'bg-amber-500'
                                    : timing.percent >= 50
                                    ? 'bg-blue-500'
                                    : 'bg-primary'
                                }`}
                                style={{ width: `${timing.percent}%` }}
                              />
                            </div>

                            <div className="flex justify-between items-center text-[10px] text-muted-foreground">
                              <span>
                                Start: {new Date(batch.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                              </span>
                              <span>
                                Target Auto-complete: {new Date(batch.tentative_completion).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                              </span>
                            </div>
                          </div>

                          {/* Quick Action: Record Completion Early */}
                          <div className="flex items-center justify-end">
                            <Button
                              variant="default"
                              size="sm"
                              className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-medium gap-1 px-3 shadow-xs"
                              onClick={() => openCompleteModal(batch)}
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Finish / Record ({number(pendingBatchQty)})</span>
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="p-12 bg-card border border-border rounded-2xl text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-secondary mx-auto flex items-center justify-center text-muted-foreground">
            <Timer className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground text-base">No active production batches currently ticking</h3>
            <p className="text-xs text-muted-foreground max-w-md mx-auto mt-1">
              All assigned production batches have completed, or no allocations are currently running with time ticking on the factory floor.
            </p>
          </div>
          <div className="pt-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => navigate({ to: '/production' })}
            >
              <Factory className="w-4 h-4 text-amber-500" />
              <span>Go to Pending Production to assign workers</span>
            </Button>
          </div>
        </div>
      )}

      {/* Record Early Completion Dialog */}
      <Dialog open={!!completingAlloc} onOpenChange={open => { if (!open) setCompletingAlloc(null); }}>
        <DialogContent className="modal-wide max-w-md" aria-describedby={undefined}>
          <DialogTitle className="text-xl font-medium">Record Batch Finished Early</DialogTitle>
          <div className="form-subtitle">
            Confirm finished box count for this worker batch. Completed boxes will be immediately transferred to Dispatch.
          </div>

          {completingAlloc && (() => {
            const worker = d.workers.find(w => w.id === completingAlloc.labour_id);
            const item = d.items.find(i => i.id === completingAlloc.order_item_id);

            return (
              <form onSubmit={handleCompleteSubmit}>
                <div className="p-3 bg-secondary/50 rounded-lg border border-border text-xs space-y-1.5 mb-4">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Worker:</span>
                    <strong className="text-foreground">{worker?.labour_name || 'Worker'} ({worker?.unit_assignment || 'Station'})</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Product Type:</span>
                    <strong className="text-foreground">{item?.box_type} · {item?.size_dimensions}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Batch Volume:</span>
                    <strong className="text-foreground">{number(completingAlloc.allocated_qty)} boxes</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Labour Rate:</span>
                    <strong className="text-emerald-500">{money(completingAlloc.labour_rate)}/box</strong>
                  </div>
                </div>

                <div className="form-grid">
                  <label className="form-wide">
                    <span>Completed Quantity (Boxes)</span>
                    <input
                      type="number"
                      required
                      min={completingAlloc.completed_qty}
                      max={completingAlloc.allocated_qty}
                      value={completeQty === '' ? '' : completeQty}
                      onChange={e => setCompleteQty(e.target.value === '' ? '' : Number(e.target.value))}
                      className="mt-1"
                    />
                  </label>
                </div>

                <div className="form-actions mt-4">
                  <Button variant="outline" type="button" onClick={() => setCompletingAlloc(null)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={busy || Number(completeQty) <= 0}>
                    {busy ? 'Saving…' : `Confirm Complete (${number(Number(completeQty))} boxes)`}
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
