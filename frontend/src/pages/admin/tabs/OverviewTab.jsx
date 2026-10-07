import { Area, AreaChart, Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import ChartCard from '../../../charts/ChartCard';
import ChartTooltip from '../../../charts/ChartTooltip';
import Heatmap from '../../../charts/Heatmap';
import StatTile from '../../../charts/StatTile';
import { axisProps, useChartTheme } from '../../../charts/theme';
import { fixed, money, moneyCompact, moneyWhole, num, pct } from '../../../utils/format';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const FUNNEL_LABELS = {
  sessions: 'Sessions',
  viewed_product: 'Viewed a product',
  added_to_cart: 'Added to cart',
  started_checkout: 'Started checkout',
  placed_order: 'Placed an order',
};
const shortDate = (d) => new Date(`${d}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
const monthLabel = (m) => new Date(`${m}-01T00:00:00`).toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });

export default function OverviewTab({ data, days }) {
  const theme = useChartTheme();
  const k = data.kpis;
  const tiles = [
    ['Orders', num(k.orders.value), k.orders.change_pct, true],
    ['Average order value', money(k.aov.value), k.aov.change_pct, true],
    ['Conversion rate', pct(k.conversion_rate.value), k.conversion_rate.change_pct, true],
    ['Repeat purchase rate', pct(k.repeat_purchase_rate.value), k.repeat_purchase_rate.change_pct, true],
    ['Customer retention', pct(k.retention_rate.value), null, true, data.definitions.retention_rate],
    ['Cart abandonment', pct(k.cart_abandonment_rate.value), k.cart_abandonment_rate.change_pct, false],
    ['Predicted CLV', moneyWhole(k.clv.value), null, true, data.definitions.clv],
    ['New customers', num(k.new_customers.value), k.new_customers.change_pct, true],
    ['Cancellation rate', pct(k.cancellation_rate.value), k.cancellation_rate.change_pct, false],
  ];
  const funnel = data.funnel.map((s) => ({ ...s, label: FUNNEL_LABELS[s.step] }));
  const maxOffset = Math.max(0, ...data.cohorts.map((c) => c.retention.length));
  const heat = new Map(data.order_heatmap.map((c) => [`${c.day}-${c.hour}`, c.orders]));

  return (
    <div className="dash-grid">
      <section className="kpi-row">
        <StatTile hero label={`GMV · last ${days} days`} value={moneyCompact(k.gmv.value)} change={k.gmv.change_pct} hint={data.definitions.gmv} />
        <div className="kpi-tiles">
          {tiles.map(([label, value, change, upIsGood, hint]) => (
            <StatTile key={label} label={label} value={value} change={change} upIsGood={upIsGood} hint={hint} />
          ))}
        </div>
      </section>

      <ChartCard
        title="GMV per day"
        subtitle="Billed value of non-cancelled orders"
        className="span-2"
        table={{
          columns: [
            { key: 'date', label: 'Date', format: shortDate },
            { key: 'gmv', label: 'GMV', numeric: true, format: money },
            { key: 'orders', label: 'Orders', numeric: true },
          ],
          rows: [...data.daily].reverse(),
        }}
      >
        <ResponsiveContainer width="100%" height={260}>
          <AreaChart data={data.daily} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke={theme.grid} />
            <XAxis dataKey="date" {...axisProps(theme)} tickFormatter={shortDate} minTickGap={28} />
            <YAxis {...axisProps(theme)} axisLine={false} tickFormatter={moneyCompact} width={60} />
            <Tooltip
              cursor={{ stroke: theme.baseline, strokeWidth: 1 }}
              content={<ChartTooltip labelFormatter={shortDate} valueFormatter={money} />}
            />
            <Area
              type="monotone"
              dataKey="gmv"
              name="GMV"
              stroke={theme.series1}
              strokeWidth={2}
              fill={theme.series1}
              fillOpacity={0.1}
              activeDot={{ r: 4, stroke: theme.surface, strokeWidth: 2 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Orders per day" subtitle="Excluding cancellations">
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={data.daily} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke={theme.grid} />
            <XAxis dataKey="date" {...axisProps(theme)} tickFormatter={shortDate} minTickGap={28} />
            <YAxis {...axisProps(theme)} axisLine={false} allowDecimals={false} width={40} />
            <Tooltip cursor={{ fill: theme.grid, opacity: 0.5 }} content={<ChartTooltip labelFormatter={shortDate} />} />
            <Bar dataKey="orders" name="Orders" fill={theme.series1} radius={[4, 4, 0, 0]} maxBarSize={24} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>


      <ChartCard
        title="Monthly GMV"
        subtitle="Last 12 months · current month is partial"
        table={{
          columns: [
            { key: 'month', label: 'Month', format: monthLabel },
            { key: 'gmv', label: 'GMV', numeric: true, format: moneyWhole },
            { key: 'orders', label: 'Orders', numeric: true, format: num },
            { key: 'active_customers', label: 'Active customers', numeric: true, format: num },
            { key: 'new_customers', label: 'New customers', numeric: true, format: num },
            { key: 'aov', label: 'AOV', numeric: true, format: money },
          ],
          rows: [...data.monthly].reverse(),
        }}
      >
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={data.monthly} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke={theme.grid} />
            <XAxis dataKey="month" {...axisProps(theme)} tickFormatter={monthLabel} minTickGap={8} />
            <YAxis {...axisProps(theme)} axisLine={false} tickFormatter={moneyCompact} width={60} />
            <Tooltip cursor={{ fill: theme.grid, opacity: 0.5 }} content={<ChartTooltip labelFormatter={monthLabel} valueFormatter={moneyWhole} />} />
            <Bar dataKey="gmv" name="GMV" fill={theme.series1} radius={[4, 4, 0, 0]} maxBarSize={24} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Cohort retention" subtitle="% of each signup cohort ordering N months after their first order" className="span-2">
        <Heatmap
          rows={data.cohorts.map((c) => ({ key: c.cohort, label: `${monthLabel(c.cohort)} (${c.size})`, values: c.retention }))}
          columns={Array.from({ length: maxOffset }, (_, i) => ({ key: i, label: `M${i}`, title: `month ${i}` }))}
          value={(row, col) => row.values[col.key] ?? null}
          format={(v) => `${Math.round(v)}%`}
          max={100}
          showValues
          legend={['0%', '100%']}
        />
      </ChartCard>

      <ChartCard title="When customers order" subtitle="Orders by weekday and hour (IST)" className="span-2">
        <Heatmap
          rows={DAYS.map((label, day) => ({ key: day, label }))}
          columns={Array.from({ length: 24 }, (_, h) => ({ key: h, label: h % 3 === 0 ? `${h}` : '', title: `${h}:00` }))}
          value={(row, col) => heat.get(`${row.key}-${col.key}`) ?? 0}
          format={(v) => `${v} orders`}
          legend={['Fewer orders', 'More orders']}
        />
      </ChartCard>


      <ChartCard
        title="Conversion funnel"
        subtitle={`${pct(k.conversion_rate.value)} of sessions place an order`}
        table={{
          columns: [
            { key: 'label', label: 'Step' },
            { key: 'sessions', label: 'Sessions', numeric: true, format: num },
            { key: 'rate', label: '% of sessions', numeric: true, format: (v) => pct(v) },
          ],
          rows: funnel,
        }}
      >
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={funnel} layout="vertical" margin={{ top: 4, right: 72, left: 8, bottom: 4 }}>
            <XAxis type="number" hide />
            <YAxis type="category" dataKey="label" {...axisProps(theme)} axisLine={false} width={120} />
            <Tooltip cursor={{ fill: theme.grid, opacity: 0.5 }} content={<ChartTooltip valueFormatter={num} />} />
            <Bar dataKey="sessions" name="Sessions" fill={theme.series1} radius={[0, 4, 4, 0]} maxBarSize={24}>
              <LabelList dataKey="rate" position="right" formatter={(v) => pct(v, 0)} fill={theme.ink2} fontSize={12} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
      <section className="card">
        <h3>How CLV is computed</h3>
        <dl className="mini-stats">
          <div>
            <dt>AOV (90 days)</dt>
            <dd>{money(data.clv.aov)}</dd>
          </div>
          <div>
            <dt>Orders / customer / quarter</dt>
            <dd>{fixed(data.clv.orders_per_customer_per_quarter, 2)}</dd>
          </div>
          <div>
            <dt>Quarterly retention</dt>
            <dd>{pct(data.clv.quarterly_retention)}</dd>
          </div>
          <div>
            <dt>Expected lifetime</dt>
            <dd>{fixed(data.clv.expected_lifetime_months, 1)} months</dd>
          </div>
          <div>
            <dt>Revenue / customer (12m)</dt>
            <dd>{moneyWhole(data.clv.revenue_per_customer_12m)}</dd>
          </div>
        </dl>
        <p className="muted small">{data.definitions.clv}</p>
      </section>
      <section className="card span-2">
        <h3>Order mix</h3>
        <dl className="mini-stats">
          {data.payment_methods.map((m) => (
            <div key={m.payment_method}>
              <dt>{m.payment_method === 'cod' ? 'Cash on delivery' : 'Online payment'}</dt>
              <dd>{num(m.orders)}</dd>
            </div>
          ))}
          {data.order_statuses.map((s) => (
            <div key={s.order_status}>
              <dt>{s.order_status.replaceAll('_', ' ').toLowerCase()}</dt>
              <dd>{num(s.orders)}</dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}
