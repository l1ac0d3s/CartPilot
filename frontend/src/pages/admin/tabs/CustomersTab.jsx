import { Bar, BarChart, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import ChartCard, { DataTable } from '../../../charts/ChartCard';
import ChartTooltip from '../../../charts/ChartTooltip';
import Heatmap from '../../../charts/Heatmap';
import StatTile from '../../../charts/StatTile';
import { axisProps, useChartTheme } from '../../../charts/theme';
import { fixed, money, moneyWhole, num, pct } from '../../../utils/format';

const CUSTOMER_COLUMNS = [
  { key: 'name', label: 'Customer' },
  { key: 'segment', label: 'Segment' },
  { key: 'rfm', label: 'RFM', numeric: true },
  { key: 'recency_days', label: 'Last order', numeric: true, format: (v) => `${Math.round(v)}d ago` },
  { key: 'orders', label: 'Orders', numeric: true },
  { key: 'monetary', label: 'Spend (12m)', numeric: true, format: moneyWhole },
];

export default function CustomersTab({ data }) {
  const theme = useChartTheme();
  const s = data.summary;
  const grid = new Map(data.rf_grid.map((c) => [`${c.r}-${c.f}`, c.customers]));

  return (
    <div className="dash-grid">
      <section className="kpi-tiles wide">
        <StatTile label="Customers with orders (12m)" value={num(s.customers_with_orders)} />
        <StatTile label="Registered, never ordered" value={num(s.never_ordered)} />
        <StatTile label="Avg orders / customer" value={fixed(s.avg_orders_per_customer, 1)} />
        <StatTile label="Avg revenue / customer" value={moneyWhole(s.avg_revenue_per_customer)} />
      </section>

      <ChartCard
        title="Customers by RFM segment"
        subtitle="Recency · Frequency · Monetary value, scored 1–5 by quintile over the last 12 months"
        className="span-2"
        table={{
          columns: [
            { key: 'segment', label: 'Segment' },
            { key: 'customers', label: 'Customers', numeric: true, format: num },
            { key: 'share', label: '% customers', numeric: true, format: (v) => pct(v) },
            { key: 'revenue_share', label: '% revenue', numeric: true, format: (v) => pct(v) },
            { key: 'avg_recency_days', label: 'Avg recency', numeric: true, format: (v) => `${Math.round(v)}d` },
            { key: 'avg_orders', label: 'Avg orders', numeric: true, format: (v) => fixed(v, 1) },
            { key: 'avg_monetary', label: 'Avg spend', numeric: true, format: moneyWhole },
          ],
          rows: data.segments,
        }}
      >
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={data.segments} layout="vertical" margin={{ top: 4, right: 110, left: 8, bottom: 4 }}>
            <XAxis type="number" hide />
            <YAxis type="category" dataKey="segment" {...axisProps(theme)} axisLine={false} width={130} interval={0} />
            <Tooltip cursor={{ fill: theme.grid, opacity: 0.5 }} content={<ChartTooltip valueFormatter={num} />} />
            <Bar dataKey="customers" name="Customers" fill={theme.series1} radius={[0, 4, 4, 0]} maxBarSize={22}>
              <LabelList
                dataKey="revenue_share"
                position="right"
                formatter={(v) => `${pct(v, 0)} of revenue`}
                fill={theme.ink2}
                fontSize={12}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <section className="card span-2">
        <h3>What to do with each segment</h3>
        <ul className="segment-list">
          {data.segments.map((seg) => (
            <li key={seg.segment}>
              <div>
                <strong>{seg.segment}</strong>
                <span className="muted small">
                  {num(seg.customers)} customers · avg {fixed(seg.avg_orders, 1)} orders · last order ~{Math.round(seg.avg_recency_days)}d ago ·{' '}
                  {money(seg.avg_monetary)} avg spend
                </span>
              </div>
              <p>{seg.action}</p>
            </li>
          ))}
        </ul>
      </section>

      <ChartCard title="Recency × frequency grid" subtitle="Customers per R and F score (5 = most recent / most frequent)">
        <Heatmap
          rows={[5, 4, 3, 2, 1].map((r) => ({ key: r, label: `R${r}` }))}
          columns={[1, 2, 3, 4, 5].map((f) => ({ key: f, label: `F${f}`, title: `frequency score ${f}` }))}
          value={(row, col) => grid.get(`${row.key}-${col.key}`) ?? 0}
          format={(v) => num(v)}
          showValues
          legend={['Fewer customers', 'More']}
        />
      </ChartCard>

      <section className="card">
        <h3>At-risk customers worth winning back</h3>
        <p className="muted small">Used to order often, haven&apos;t ordered recently — ranked by 12-month spend.</p>
        <DataTable columns={CUSTOMER_COLUMNS.filter((c) => c.key !== 'segment')} rows={data.at_risk_customers.map((r) => ({ ...r, id: r.user_id }))} />
      </section>

      <section className="card span-2">
        <h3>Top customers</h3>
        <DataTable columns={CUSTOMER_COLUMNS} rows={data.top_customers.map((r) => ({ ...r, id: r.user_id }))} />
      </section>
    </div>
  );
}
