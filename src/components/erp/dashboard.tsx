import {useState} from 'react';
import {Link} from '@tanstack/react-router';
import {Bell,ArrowUpRight,ClipboardList,Factory,Truck,IndianRupee,CalendarDays,Plus,ChevronRight,TrendingUp} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {useFactory} from './provider';
import {Heading,Empty,ExportButton,Pill,CrmTag,SegmentedMeter,MiniSparkline} from './common';
import {finance,money,number,dateLabel,downloadCsv} from '@/lib/erp-data';
import {enablePush} from '@/lib/push';
import {toast} from 'sonner';
import {ResponsiveContainer,BarChart,Bar,XAxis,YAxis,Tooltip} from 'recharts';

export function Dashboard(){
  const {data:d,user,signIn}=useFactory();
  const [period,setPeriod]=useState('This month');
  const [pushBusy,setPushBusy]=useState(false);
  const report=finance(d);
  const recent=d.orders.slice().sort((a,b)=>(b.created_at??'').localeCompare(a.created_at??'')).slice(0,6);
  const pending=d.items.reduce((s,i)=>s+i.ordered_qty-i.allocated_qty,0);
  const ready=d.items.reduce((s,i)=>s+i.completed_qty-i.dispatched_qty-i.reserved_qty,0);
  const profit=report.reduce((s,r)=>s+r.profit,0);
  const totalOrders=d.orders.length;
  const radius=52;
  const circumference=2*Math.PI*radius;
  const pipelineStages=[
    {status:'Pending',label:'Pending',color:'#f59e0b'},
    {status:'In Production',label:'In Production',color:'var(--primary)'},
    {status:'Dispatched',label:'Dispatched',color:'#64748b'},
    {status:'Completed',label:'Completed',color:'#10b981'},
  ];
  let accumulatedOffset=0;
  const donutSlices=pipelineStages.map(stage=>{
    const count=d.orders.filter(o=>o.status===stage.status).length;
    const fraction=totalOrders>0?count/totalOrders:0;
    const strokeDash=fraction*circumference;
    const offset=accumulatedOffset;
    accumulatedOffset+=strokeDash;
    return {...stage,count,strokeDash,offset};
  });

  const chart=Array.from({length:period==='This week'?7:6},(_,i)=>{
    const now=new Date();
    if(period==='This week') now.setDate(now.getDate()-6+i);
    else now.setMonth(now.getMonth()-5+i);
    const matches=(value:string)=>{
      const date=new Date(value);
      return period==='This week'
        ? date.toDateString()===now.toDateString()
        : date.getMonth()===now.getMonth()&&date.getFullYear()===now.getFullYear();
    };
    return {
      month:now.toLocaleDateString('en-US',period==='This week'?{weekday:'short'}:{month:'short'}),
      ordered:d.orders.filter(o=>matches(o.order_date)).length,
      dispatched:d.challans.filter(c=>c.status==='Dispatched'&&matches(c.dispatch_date)).length
    };
  });

  async function push(){
    if(!user){signIn();return;}
    setPushBusy(true);
    try{
      await enablePush();
      toast.success('Notifications enabled');
    }catch(e){
      toast.error(e instanceof Error?e.message:'Could not enable notifications');
    }finally{
      setPushBusy(false);
    }
  }

  return (
    <>
      <Heading title="Factory Dashboard" badge="Live Production Sync">
        <Button variant="outline" size="sm" onClick={()=>setPeriod(period==='This month'?'This week':'This month')}>
          <CalendarDays className="w-3.5 h-3.5 mr-1"/>
          {period}
          <ChevronRight className="w-3.5 h-3.5 ml-1"/>
        </Button>
        <Button size="sm" asChild>
          <Link to="/orders" search={{new:true}}>
            <Plus className="w-3.5 h-3.5 mr-1"/>New Order
          </Link>
        </Button>
      </Heading>

      <div className="notification-banner">
        <div className="banner-title">
          <Bell size={18}/>
          <span>Real-time dispatch and production push updates available for mobile</span>
        </div>
        <Button variant="outline" size="sm" disabled={pushBusy} onClick={push}>
          {pushBusy?'Enabling…':'Enable notifications'}
          <ArrowUpRight className="w-3.5 h-3.5 ml-1"/>
        </Button>
      </div>

      <div className="metrics">
        {[
          {label:'Total Orders',value:number(d.orders.length),icon:ClipboardList,footer:'Active pipeline',change:'+14%'},
          {label:'Pending Production',value:number(pending),icon:Factory,footer:'Pieces awaiting cut',change:'Queue active'},
          {label:'Ready to Dispatch',value:number(ready),icon:Truck,footer:'Completed inventory',change:'Staged in bay'},
          {label:'Realised Profit',value:money(profit),icon:IndianRupee,footer:'Dispatched orders',change:'+8.2% margin'}
        ].map(m=>(
          <div className="metric" key={m.label}>
            <div className="metric-top">
              <span>{m.label}</span>
              <span className="metric-icon"><m.icon size={16}/></span>
            </div>
            <div className="metric-value">{m.value}</div>
            <div className="metric-footer">
              <span className="text-foreground font-medium flex items-center gap-1">
                <TrendingUp size={11} className="text-emerald-600"/>
                {m.change}
              </span>
              <span className="text-muted-foreground/50">·</span>
              <span>{m.footer}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="dashboard-columns">
        <section className="section-block">
          <div className="section-header">
            <h2>Order & Dispatch Overview</h2>
            <select
              aria-label="Chart period"
              className="w-auto! min-h-8! py-1! text-xs! rounded-full!"
              value={period}
              onChange={e=>setPeriod(e.target.value)}
            >
              <option>This month</option>
              <option>This week</option>
            </select>
          </div>
          <div className="chart-surface">
            <div className="chart-legend">
              <span><i className="legend-dot"/>Orders Received</span>
              <span><i className="legend-dot secondary"/>Dispatched</span>
            </div>
            {d.orders.length ? (
              <ResponsiveContainer width="100%" height={190}>
                <BarChart data={chart}>
                  <XAxis dataKey="month" tick={{fill:'var(--muted-foreground)',fontSize:11}} axisLine={false} tickLine={false}/>
                  <YAxis tick={{fill:'var(--muted-foreground)',fontSize:11}} axisLine={false} tickLine={false}/>
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
                              <span className="w-2 h-2 rounded-full bg-input inline-block" />
                              Dispatched
                            </span>
                            <strong className="text-foreground tabular-nums">{dispatched}</strong>
                          </div>
                        </div>
                      );
                    }}
                  />
                  <Bar dataKey="ordered" fill="var(--primary)" radius={[3,3,0,0]} maxBarSize={36}/>
                  <Bar dataKey="dispatched" fill="var(--input)" radius={[3,3,0,0]} maxBarSize={36}/>
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
            <h2>Order Pipeline Distribution</h2>
            <span className="text-muted-foreground text-xs">{number(totalOrders)} orders total</span>
          </div>
          <div className="chart-surface donut-surface">
            <div className="donut-wrap">
              <div className="donut-container">
                <svg width="140" height="140" viewBox="0 0 140 140" className="transform -rotate-90">
                  <circle
                    cx="70"
                    cy="70"
                    r={radius}
                    fill="none"
                    stroke="var(--muted)"
                    strokeWidth="14"
                  />
                  {totalOrders > 0 && donutSlices.map(slice => {
                    if (slice.count === 0) return null;
                    return (
                      <circle
                        key={slice.status}
                        cx="70"
                        cy="70"
                        r={radius}
                        fill="none"
                        stroke={slice.color}
                        strokeWidth="14"
                        strokeDasharray={`${slice.strokeDash} ${circumference - slice.strokeDash}`}
                        strokeDashoffset={-slice.offset}
                        style={{ transition: 'stroke-dasharray 0.4s ease, stroke-dashoffset 0.4s ease' }}
                      />
                    );
                  })}
                </svg>
                <div className="donut-center-text">
                  <strong>{number(totalOrders)}</strong>
                  <small>Active Pipeline</small>
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
          <h2>Recent Orders Pipeline</h2>
          <Button variant="ghost" size="sm" asChild>
            <Link to="/orders">
              View all orders
              <ArrowUpRight className="w-3.5 h-3.5 ml-1"/>
            </Link>
          </Button>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th className="w-8">
                  <input type="checkbox" className="w-3.5 h-3.5 rounded border-border" aria-label="Select all" readOnly />
                </th>
                <th>Order Number</th>
                <th>Customer / Account</th>
                <th>Order Date</th>
                <th className="numeric">Quantity</th>
                <th>Fulfilment</th>
                <th>Trend</th>
                <th>Priority</th>
                <th>Status</th>
                <th className="w-8"/>
              </tr>
            </thead>
            <tbody>
              {recent.length ? recent.map(o=>{
                const items=d.items.filter(i=>i.order_id===o.id);
                const totalQty=items.reduce((s,i)=>s+i.ordered_qty,0);
                const completedQty=items.reduce((s,i)=>s+i.completed_qty,0);
                const partyName=o.is_self_stock ? 'Self Stocking' : d.parties.find(p=>p.id===o.party_id)?.company_name ?? '—';
                const monogram=o.is_self_stock ? 'SS' : partyName.slice(0,2).toUpperCase();
                return (
                  <tr key={o.id} className="clickable-row">
                    <td>
                      <input type="checkbox" className="w-3.5 h-3.5 rounded border-border" aria-label={`Select ${o.order_no}`} />
                    </td>
                    <td className="font-medium text-foreground">{o.order_no}</td>
                    <td>
                      <div className="flex items-center gap-2.5">
                        <span className="avatar !w-6 !h-6 !text-[10px] font-semibold">
                          {monogram}
                        </span>
                        <span className="font-medium text-foreground">{partyName}</span>
                      </div>
                    </td>
                    <td>{dateLabel(o.order_date)}</td>
                    <td className="numeric font-medium">{number(totalQty)}</td>
                    <td>
                      <SegmentedMeter value={completedQty} total={totalQty} />
                    </td>
                    <td>
                      <MiniSparkline />
                    </td>
                    <td><Pill value={items[0]?.priority_signal ?? 'Yellow'}/></td>
                    <td><Pill value={o.status}/></td>
                    <td>
                      <Button variant="ghost" size="icon" asChild>
                        <Link to="/orders" aria-label="View order">
                          <ArrowUpRight className="w-4 h-4"/>
                        </Link>
                      </Button>
                    </td>
                  </tr>
                );
              }) : (
                <Empty columns={10} label="No orders received yet"/>
              )}
            </tbody>
          </table>
        </div>
        <div className="table-note">
          <span>Showing {recent.length} of {d.orders.length} total orders</span>
          <span>Live Corrugated Plant Records</span>
        </div>
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
