import {useState} from 'react';
import {Link, useNavigate} from '@tanstack/react-router';
import {Bell,ArrowUpRight,ClipboardList,Factory,Truck,IndianRupee,CalendarDays,Plus,ChevronRight,TrendingUp} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {Checkbox} from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem
} from '@/components/ui/dropdown-menu';
import {useFactory} from './provider';
import {Heading,Empty,ExportButton,Pill,CrmTag,SegmentedMeter,Pagination,ThemedSelect} from './common';
import {finance,money,number,dateLabel,downloadCsv} from '@/lib/erp-data';
import {enablePush} from '@/lib/push';
import {toast} from 'sonner';
import {ResponsiveContainer,BarChart,Bar,XAxis,YAxis,Tooltip,CartesianGrid} from 'recharts';

export function Dashboard(){
  const navigate = useNavigate();
  const {data:d,user,signIn}=useFactory();
  const [period,setPeriod]=useState('This month');
  const [pushBusy,setPushBusy]=useState(false);
  const [pushGranted,setPushGranted]=useState(()=>(typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted'));
  const [orderPage,setOrderPage]=useState(1);
  const orderPageSize=10;
  const report=finance(d);
  const allRecentOrders=d.orders.slice().sort((a,b)=>(b.created_at??'').localeCompare(a.created_at??''));
  const paginatedOrders=allRecentOrders.slice((orderPage-1)*orderPageSize, orderPage*orderPageSize);
  const pending = d.items.reduce((s, i) => {
    const o = d.orders.find(ord => ord.id === i.order_id);
    if (o && (o.status === 'Completed' || o.status === 'Cancelled')) return s;
    return s + Math.max(0, i.ordered_qty - i.allocated_qty);
  }, 0);
  const ready = d.items.reduce((s, i) => {
    const o = d.orders.find(ord => ord.id === i.order_id);
    if (o && o.status === 'Cancelled') return s;
    return s + Math.max(0, i.completed_qty - i.dispatched_qty - (i.reserved_qty || 0));
  }, 0);
  const profit=report.reduce((s,r)=>s+r.profit,0);
  const totalOrders=d.orders.length;

  // Real period calculations
  const now = new Date();
  const isThisWeek = period === 'This week';
  const isThisYear = period === 'This year';
  const currentPeriodOrders = d.orders.filter(o => {
    if (!o.order_date) return false;
    const od = new Date(o.order_date);
    if (isThisWeek) {
      const diffDays = (now.getTime() - od.getTime()) / (1000 * 3600 * 24);
      return diffDays >= 0 && diffDays <= 7;
    }
    if (isThisYear) {
      return od.getFullYear() === now.getFullYear();
    }
    return od.getMonth() === now.getMonth() && od.getFullYear() === now.getFullYear();
  }).length;

  const prevPeriodOrders = d.orders.filter(o => {
    if (!o.order_date) return false;
    const od = new Date(o.order_date);
    if (isThisWeek) {
      const diffDays = (now.getTime() - od.getTime()) / (1000 * 3600 * 24);
      return diffDays > 7 && diffDays <= 14;
    }
    if (isThisYear) {
      return od.getFullYear() === now.getFullYear() - 1;
    }
    const prevMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    return od.getMonth() === prevMonthDate.getMonth() && od.getFullYear() === prevMonthDate.getFullYear();
  }).length;

  const orderDelta = prevPeriodOrders > 0
    ? `${((currentPeriodOrders - prevPeriodOrders) / prevPeriodOrders * 100) >= 0 ? '+' : ''}${Math.round(((currentPeriodOrders - prevPeriodOrders) / prevPeriodOrders) * 100)}%`
    : null;

  // Real profit delta
  const currProfit = report.filter(r => {
    if (!r.dispatch_date) return false;
    const dd = new Date(r.dispatch_date);
    if (isThisWeek) {
      const diffDays = (now.getTime() - dd.getTime()) / (1000 * 3600 * 24);
      return diffDays >= 0 && diffDays <= 7;
    }
    if (isThisYear) {
      return dd.getFullYear() === now.getFullYear();
    }
    return dd.getMonth() === now.getMonth() && dd.getFullYear() === now.getFullYear();
  }).reduce((s, r) => s + r.profit, 0);

  const prevProfit = report.filter(r => {
    if (!r.dispatch_date) return false;
    const dd = new Date(r.dispatch_date);
    if (isThisWeek) {
      const diffDays = (now.getTime() - dd.getTime()) / (1000 * 3600 * 24);
      return diffDays > 7 && diffDays <= 14;
    }
    if (isThisYear) {
      return dd.getFullYear() === now.getFullYear() - 1;
    }
    const prevMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    return dd.getMonth() === prevMonthDate.getMonth() && dd.getFullYear() === prevMonthDate.getFullYear();
  }).reduce((s, r) => s + r.profit, 0);

  const profitDelta = prevProfit > 0
    ? `${((currProfit - prevProfit) / prevProfit * 100) >= 0 ? '+' : ''}${Math.round(((currProfit - prevProfit) / prevProfit) * 100)}%`
    : null;
  const radius=60;
  const circumference=2*Math.PI*radius;
  const orderStages=[
    {status:'Pending',label:'Pending',color:'#f59e0b'},
    {status:'In Production',label:'In Production',color:'var(--primary)'},
    {status:'Partially Dispatched',label:'Partially Dispatched',color:'#8b5cf6'},
    {status:'Dispatched',label:'Dispatched',color:'#64748b'},
    {status:'Completed',label:'Completed',color:'#10b981'},
  ];
  let accumulatedOffset=0;
  const donutSlices=orderStages.map(stage=>{
    const count=d.orders.filter(o=>o.status===stage.status).length;
    const fraction=totalOrders>0?count/totalOrders:0;
    const strokeDash=fraction*circumference;
    const offset=accumulatedOffset;
    accumulatedOffset+=strokeDash;
    return {...stage,count,strokeDash,offset};
  });

  const chartLength = isThisWeek ? 7 : isThisYear ? 12 : 6;
  const chart=Array.from({length:chartLength},(_,i)=>{
    let chartDate=new Date();
    if(isThisWeek) {
      chartDate.setDate(chartDate.getDate()-6+i);
    } else if(isThisYear) {
      chartDate = new Date(now.getFullYear(), i, 1);
    } else {
      chartDate.setMonth(chartDate.getMonth()-5+i);
    }
    const matches=(value:string)=>{
      const date=new Date(value);
      if(isThisWeek) {
        return date.toDateString()===chartDate.toDateString();
      }
      return date.getMonth()===chartDate.getMonth()&&date.getFullYear()===chartDate.getFullYear();
    };
    return {
      month:chartDate.toLocaleDateString('en-US',isThisWeek?{weekday:'short'}:{month:'short'}),
      ordered:d.orders.filter(o=>matches(o.order_date)).length,
      dispatched:d.challans.filter(c=>c.status==='Dispatched'&&matches(c.dispatch_date)).length
    };
  });

  async function push(){
    if(!user){signIn();return;}
    setPushBusy(true);
    try{
      await enablePush();
      setPushGranted(true);
      toast.success('Notifications enabled');
    }catch(e){
      toast.error(e instanceof Error?e.message:'Could not enable notifications');
    }finally{
      setPushBusy(false);
    }
  }

  return (
    <>
      <Heading title="Dashboard">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              <CalendarDays className="w-3.5 h-3.5 mr-1"/>
              {period}
              <ChevronRight className="w-3.5 h-3.5 ml-1"/>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={()=>setPeriod('This week')}>This week</DropdownMenuItem>
            <DropdownMenuItem onClick={()=>setPeriod('This month')}>This month</DropdownMenuItem>
            <DropdownMenuItem onClick={()=>setPeriod('This year')}>This year</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <Button size="sm" asChild>
          <Link to="/orders" search={{new:true}}>
            <Plus className="w-3.5 h-3.5 mr-1"/>New Order
          </Link>
        </Button>
      </Heading>

      {!pushGranted && (
        <div className="notification-banner">
          <div className="banner-title">
            <Bell size={18} className="shrink-0 text-primary mt-0.5" />
            <span>Real-time dispatch and production push updates available for mobile</span>
          </div>
          <Button variant="outline" size="sm" className="w-full sm:w-auto shrink-0 justify-center" disabled={pushBusy} onClick={push}>
            {pushBusy?'Enabling…':'Enable notifications'}
            <ArrowUpRight className="w-3.5 h-3.5 ml-1"/>
          </Button>
        </div>
      )}

      <div className="metrics">
        {[
          {label:'Total Orders',value:number(d.orders.length),icon:ClipboardList,footer:'Active orders',change:orderDelta},
          {label:'Pending Production',value:number(pending),icon:Factory,footer:'Pieces awaiting cut',change:null},
          {label:'Ready to Dispatch',value:number(ready),icon:Truck,footer:'Completed inventory',change:null},
          {label:'Realised Profit',value:money(profit),icon:IndianRupee,footer:'Dispatched orders',change:profitDelta}
        ].map(m=>(
          <div className="metric" key={m.label}>
            <div className="metric-top">
              <span>{m.label}</span>
              <span className="metric-icon"><m.icon size={16}/></span>
            </div>
            <div className="metric-value">{m.value}</div>
            <div className="metric-footer">
              {m.change ? (
                <>
                  <span className="text-foreground font-medium flex items-center gap-1">
                    <TrendingUp size={11} className="text-emerald-600"/>
                    {m.change}
                  </span>
                  <span className="text-muted-foreground/50">·</span>
                </>
              ) : null}
              <span>{m.footer}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="dashboard-columns">
        <section className="section-block">
          <div className="section-header">
            <h2>Order & Dispatch Overview</h2>
            <ThemedSelect
              className="w-32! h-8! text-xs!"
              wrapperClassName="w-auto shrink-0"
              value={period}
              onChange={setPeriod}
              options={[
                { value: 'This week', label: 'This week' },
                { value: 'This month', label: 'This month' },
                { value: 'This year', label: 'This year' }
              ]}
            />
          </div>
          <div className="chart-surface">
            <div className="chart-legend">
              <span><i className="legend-dot"/>Orders Received</span>
              <span><i className="legend-dot secondary"/>Dispatched</span>
            </div>
            {d.orders.length ? (
              <ResponsiveContainer width="100%" height={190}>
                <BarChart data={chart} margin={{ top: 10, right: 10, left: -16, bottom: 0 }} barGap={4}>
                  <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} opacity={0.5} />
                  <XAxis dataKey="month" tick={{fill:'var(--muted-foreground)',fontSize:11}} axisLine={{stroke:'var(--border)',opacity:0.4}} tickLine={false}/>
                  <YAxis allowDecimals={false} tickCount={5} tick={{fill:'var(--muted-foreground)',fontSize:11}} axisLine={false} tickLine={false}/>
                  <Tooltip
                    cursor={false}
                    content={({ active, payload, label }) => {
                      if (!active || !payload || !payload.length) return null;
                      const ordered = Number(payload.find(p => p.dataKey === 'ordered')?.value ?? 0);
                      const dispatched = Number(payload.find(p => p.dataKey === 'dispatched')?.value ?? 0);
                      if (ordered === 0 && dispatched === 0) return null;
                      return (
                        <div className="bg-card text-foreground border border-border shadow-lg rounded-lg p-2.5 text-xs min-w-[130px]">
                          <div className="font-semibold text-foreground mb-1.5">{label}</div>
                          <div className="flex items-center justify-between gap-3 py-0.5">
                            <span className="flex items-center gap-1.5 text-muted-foreground">
                              <span className="w-2 h-2 rounded-full bg-primary inline-block" />
                              Orders
                            </span>
                            <strong className="text-foreground tabular-nums">{ordered}</strong>
                          </div>
                          <div className="flex items-center justify-between gap-3 py-0.5">
                            <span className="flex items-center gap-1.5 text-muted-foreground">
                              <span className="w-2 h-2 rounded-full bg-muted-foreground/60 inline-block" />
                              Dispatched
                            </span>
                            <strong className="text-foreground tabular-nums">{dispatched}</strong>
                          </div>
                        </div>
                      );
                    }}
                  />
                  <Bar dataKey="ordered" fill="var(--primary)" radius={[3,3,0,0]} maxBarSize={isThisYear ? 16 : 22}/>
                  <Bar dataKey="dispatched" fill="var(--muted-foreground)" opacity={0.65} radius={[3,3,0,0]} maxBarSize={isThisYear ? 16 : 22}/>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <>
                <div className="chart-grid">
                  {[30,20,10,0].map(n=><div className="chart-grid-row" key={n}><span>{n}</span></div>)}
                  <div className="chart-empty">No orders in this period</div>
                </div>
                <div className="chart-months">
                  {chart.map(c=><span key={c.month}>{c.month}</span>)}
                </div>
              </>
            )}
          </div>
        </section>

        <section className="section-block">
          <div className="section-header">
            <h2>Order Status Distribution</h2>
            <span className="text-muted-foreground text-xs">{number(totalOrders)} orders total</span>
          </div>
          <div className="chart-surface donut-surface">
            <div className="donut-wrap">
              <div className="donut-container">
                <svg width="156" height="156" viewBox="0 0 156 156" className="transform -rotate-90">
                  <circle
                    cx="78"
                    cy="78"
                    r={radius}
                    fill="none"
                    stroke="var(--muted)"
                    strokeWidth="12"
                  />
                  {totalOrders > 0 && donutSlices.map(slice => {
                    if (slice.count === 0) return null;
                    return (
                      <circle
                        key={slice.status}
                        cx="78"
                        cy="78"
                        r={radius}
                        fill="none"
                        stroke={slice.color}
                        strokeWidth="12"
                        strokeDasharray={`${slice.strokeDash} ${circumference - slice.strokeDash}`}
                        strokeDashoffset={-slice.offset}
                        style={{ transition: 'stroke-dasharray 0.4s ease, stroke-dashoffset 0.4s ease' }}
                      />
                    );
                  })}
                </svg>
                <div className="donut-center-text">
                  <strong>{number(totalOrders)}</strong>
                  <small>Active Orders</small>
                </div>
              </div>

              <div className="status-legend">
                {donutSlices.map(s => (
                  <div className="status-line" key={s.status}>
                    <span className="status-dot" style={{ backgroundColor: s.color }} />
                    <span className="status-label">{s.label}</span>
                    <strong className="status-count">{number(s.count)}</strong>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      </div>

      <section>
        <div className="section-header">
          <h2>Recent Factory Orders</h2>
          <Button variant="ghost" size="sm" asChild>
            <Link to="/orders">
              View all orders
              <ArrowUpRight className="w-3.5 h-3.5 ml-1"/>
            </Link>
          </Button>
        </div>

        {/* Desktop Table View */}
        <div className="desktop-table-view table-wrap">
          <table>
            <thead>
              <tr>
                <th className="w-8">
                  <Checkbox aria-label="Select all" />
                </th>
                <th>Order Number</th>
                <th>Customer / Account</th>
                <th>Order Date</th>
                <th className="numeric">Quantity</th>
                <th>Priority</th>
                <th>Status</th>
                <th className="w-8"/>
              </tr>
            </thead>
            <tbody>
              {paginatedOrders.length ? paginatedOrders.map(o=>{
                const items=d.items.filter(i=>i.order_id===o.id);
                const totalQty=items.reduce((s,i)=>s+i.ordered_qty,0);
                const partyName=o.is_self_stock ? 'Self Stocking' : d.parties.find(p=>p.id===o.party_id)?.company_name ?? '—';
                return (
                  <tr
                    key={o.id}
                    className="clickable-row"
                    onClick={() => navigate({ to: '/orders', search: { view: o.id } })}
                    title="Click to view order details"
                  >
                    <td onClick={e=>e.stopPropagation()}>
                      <Checkbox aria-label={`Select ${o.order_no}`} />
                    </td>
                    <td className="font-medium text-foreground">{o.order_no}</td>
                    <td>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-foreground">{partyName}</span>
                      </div>
                    </td>
                    <td>{dateLabel(o.order_date)}</td>
                    <td className="numeric font-medium">{number(totalQty)}</td>
                    <td><Pill value={items[0]?.priority_signal ?? 'Yellow'}/></td>
                    <td><Pill value={o.status}/></td>
                    <td className="w-8" onClick={e=>e.stopPropagation()}>
                      <Button variant="ghost" size="icon-sm" asChild>
                        <Link to="/orders" search={{ view: o.id }} aria-label="View order">
                          <ArrowUpRight className="w-4 h-4"/>
                        </Link>
                      </Button>
                    </td>
                  </tr>
                );
              }) : (
                <Empty columns={8} label="No orders received yet"/>
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Card View */}
        <div className="mobile-card-view">
          {paginatedOrders.length ? paginatedOrders.map(o => {
            const items = d.items.filter(i => i.order_id === o.id);
            const totalQty = items.reduce((s, i) => s + i.ordered_qty, 0);
            const partyName = o.is_self_stock ? 'Self Stocking' : d.parties.find(p => p.id === o.party_id)?.company_name ?? '—';
            return (
              <div
                key={o.id}
                className="mobile-record-card cursor-pointer"
                onClick={() => navigate({ to: '/orders', search: { view: o.id } })}
              >
                <div className="mobile-card-top">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="min-w-0">
                      <div className="mobile-card-title">{o.order_no}</div>
                      <div className="mobile-card-sub">{partyName}</div>
                    </div>
                  </div>
                  <Pill value={o.status} />
                </div>

                <div className="mobile-card-grid">
                  <div className="mobile-card-field">
                    <span className="mobile-card-label">Order Date</span>
                    <span className="mobile-card-value">{dateLabel(o.order_date)}</span>
                  </div>
                  <div className="mobile-card-field">
                    <span className="mobile-card-label">Quantity</span>
                    <span className="mobile-card-value font-medium">{number(totalQty)}</span>
                  </div>
                  <div className="mobile-card-field">
                    <span className="mobile-card-label">Priority</span>
                    <span className="mobile-card-value"><Pill value={items[0]?.priority_signal ?? 'Yellow'}/></span>
                  </div>
                  <div className="mobile-card-field">
                    <span className="mobile-card-label">Items Count</span>
                    <span className="mobile-card-value">{items.length} skus</span>
                  </div>
                </div>

                <div className="mobile-card-actions" onClick={e => e.stopPropagation()}>
                  <div className="flex-1" />
                  <Button variant="outline" size="sm" asChild>
                    <Link to="/orders" search={{ view: o.id }}>
                      View <ArrowUpRight className="w-3.5 h-3.5 ml-1"/>
                    </Link>
                  </Button>
                </div>
              </div>
            );
          }) : (
            <Empty columns={1} label="No orders received yet" />
          )}
        </div>

        <Pagination
          currentPage={orderPage}
          totalItems={allRecentOrders.length}
          pageSize={orderPageSize}
          onPageChange={setOrderPage}
        />
      </section>

      <section className="mt-8">
        <div className="section-header">
          <h2>Financial Realisation Summary</h2>
          <ExportButton onClick={()=>downloadCsv('realised-profit',report)}/>
        </div>
        <div className="report-summary">
          {[
            {label:'Realised Revenue',value:report.reduce((s,r)=>s+r.revenue,0)},
            {label:'Production & Operating Costs',value:report.reduce((s,r)=>s+r.revenue-r.profit,0)},
            {label:'Realised Operating Profit',value:profit}
          ].map(x=>(
            <div key={x.label} className="metric">
              <div className="metric-top">{x.label}</div>
              <div className="metric-value">{money(x.value)}</div>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
