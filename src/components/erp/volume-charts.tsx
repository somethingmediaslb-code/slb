import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts';
import { useFactory } from './provider';
import { number } from '@/lib/erp-data';

const CHART_COLORS = [
  'var(--primary)',
  '#10b981', // emerald
  '#f59e0b', // amber
  '#8b5cf6', // purple
  '#06b6d4', // cyan
  '#f43f5e', // rose
  '#3b82f6', // blue
];

export function VolumeCharts({ dispatch = false }: { dispatch?: boolean }) {
  const { data: d } = useFactory();

  // 1. Labour-wise Volume
  const workers = d.workers
    .map((w) => ({
      name: w.labour_name,
      value: d.allocations
        .filter((a) => a.labour_id === w.id)
        .reduce((s, a) => {
          const item = d.items.find((i) => i.id === a.order_item_id);
          const qty = dispatch && item?.completed_qty
            ? (a.completed_qty * item.dispatched_qty) / item.completed_qty
            : a.completed_qty;
          return s + (qty || 0);
        }, 0),
    }))
    .filter((x) => x.value > 0);

  // 2. Company-wise Volume
  const parties = d.parties
    .map((p) => ({
      name: p.company_name,
      value: d.items
        .filter((i) => d.orders.find((o) => o.id === i.order_id)?.party_id === p.id)
        .reduce((s, i) => s + (dispatch ? i.dispatched_qty : i.ordered_qty), 0),
    }))
    .filter((x) => x.value > 0);

  // Also include Self Stocking in party share
  const selfStockQty = d.items
    .filter((i) => d.orders.find((o) => o.id === i.order_id)?.is_self_stock)
    .reduce((s, i) => s + (dispatch ? i.dispatched_qty : i.ordered_qty), 0);
  if (selfStockQty > 0) {
    parties.push({ name: 'Self Stocking', value: selfStockQty });
  }

  // 3. Quantity / Box-Type-wise Distribution
  const boxTypeMap = new Map<string, number>();
  d.items.forEach((item) => {
    const qty = dispatch ? item.dispatched_qty : item.completed_qty;
    if (qty > 0) {
      const type = item.box_type || 'Standard Box';
      boxTypeMap.set(type, (boxTypeMap.get(type) || 0) + qty);
    }
  });
  const boxTypes = Array.from(boxTypeMap.entries()).map(([name, value]) => ({ name, value }));

  const charts = [
    {
      title: dispatch ? 'Labour Dispatch Contribution' : 'Labour Production Volume',
      data: workers,
      empty: dispatch ? 'No dispatched labour data yet' : 'No completed labour production yet',
    },
    {
      title: dispatch ? 'Company Dispatched Volume' : 'Company Production Volume',
      data: parties,
      empty: 'No company volume data yet',
    },
    {
      title: dispatch ? 'Box Type Dispatched Share' : 'Box Type Production Share',
      data: boxTypes,
      empty: 'No box quantity data yet',
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
      {charts.map((c) => {
        const total = c.data.reduce((sum, item) => sum + item.value, 0);
        return (
          <section key={c.title} className="bg-card border border-border rounded-xl p-4 flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-border/60">
              <h3 className="text-sm font-medium text-foreground">{c.title}</h3>
              <span className="text-xs text-muted-foreground tabular-nums font-medium">
                Total: {number(Math.round(total))}
              </span>
            </div>

            <div className="chart-surface flex-1 flex flex-col justify-center items-center py-4 min-h-[220px]">
              {c.data.length ? (
                <>
                  <ResponsiveContainer width="100%" height={170}>
                    <PieChart>
                      <Pie
                        data={c.data}
                        dataKey="value"
                        nameKey="name"
                        innerRadius={46}
                        outerRadius={72}
                        paddingAngle={2}
                        stroke="hsl(var(--card))"
                        strokeWidth={2}
                      >
                        {c.data.map((v, i) => (
                          <Cell key={v.name} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'hsl(var(--popover))',
                          borderColor: 'hsl(var(--border))',
                          borderRadius: '8px',
                          fontSize: '12px',
                          color: 'hsl(var(--popover-foreground))',
                        }}
                        formatter={(val: any) => [`${number(Math.round(Number(val)))} boxes`, 'Volume']}
                      />
                    </PieChart>
                  </ResponsiveContainer>

                  <div className="flex flex-wrap gap-2 text-[11px] justify-center mt-2 max-h-[80px] overflow-y-auto">
                    {c.data.map((v, idx) => (
                      <span
                        key={v.name}
                        className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-secondary/50 text-muted-foreground"
                      >
                        <span
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: CHART_COLORS[idx % CHART_COLORS.length] }}
                        />
                        <span className="font-medium text-foreground truncate max-w-[110px]">{v.name}</span>
                        <span className="tabular-nums font-semibold text-foreground">
                          {number(Math.round(v.value))}
                        </span>
                      </span>
                    ))}
                  </div>
                </>
              ) : (
                <div className="h-full flex items-center justify-center text-xs text-muted-foreground">
                  {c.empty}
                </div>
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}
