import { Bar, BarChart, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import ChartCard, { DataTable } from '../../../charts/ChartCard';
import ChartTooltip from '../../../charts/ChartTooltip';
import StatTile from '../../../charts/StatTile';
import { axisProps, useChartTheme } from '../../../charts/theme';
import { fixed, moneyCompact, moneyWhole, num, pct } from '../../../utils/format';

const growth = (v) => (v == null ? '—' : `${v > 0 ? '▲' : v < 0 ? '▼' : ''} ${Math.abs(v).toFixed(1)}%`);
const SKU_COLUMNS = [
  { key: 'name', label: 'Product' },
  { key: 'category', label: 'Category' },
  { key: 'units', label: 'Units', numeric: true, format: num },
  { key: 'revenue', label: 'Revenue', numeric: true, format: moneyWhole },
  { key: 'velocity', label: 'Velocity (units/day)', numeric: true, format: (v) => fixed(v, 2) },
  { key: 'gross_margin', label: 'Gross margin', numeric: true, format: moneyWhole },
  { key: 'stock', label: 'Stock', numeric: true, format: num },
];

export default function ProductsTab({ data, days }) {
  const theme = useChartTheme();
  const s = data.summary;
  const categoryHeight = Math.max(240, data.categories.length * 30);

  return (
    <div className="dash-grid">
      <section className="kpi-tiles wide">
        <StatTile label="Units sold" value={num(s.units_sold)} />
        <StatTile label="Avg SKU velocity" value={`${fixed(s.avg_sku_velocity, 2)}/day`} hint={data.definitions.velocity} />
        <StatTile label="Inventory turnover" value={`${fixed(s.inventory_turnover, 1)}×/yr`} hint={data.definitions.inventory_turnover} />
        <StatTile label="Stock-out rate" value={pct(s.stockout_rate)} upIsGood={false} hint={data.definitions.stockout_rate} />
        <StatTile label="Stock-out events" value={num(s.stockout_events)} />
        <StatTile label="Avg stock-out duration" value={`${fixed(s.avg_stockout_hours, 1)} h`} />
        <StatTile label="Cancellation rate" value={pct(s.cancellation_rate)} />
        <StatTile label="SKUs sold / active" value={`${num(s.skus_sold)} / ${num(s.active_skus)}`} />
      </section>

      <ChartCard
        title="Revenue by category"
        subtitle={`Last ${days} days`}
        className="span-2"
        table={{
          columns: [
            { key: 'category', label: 'Category' },
            { key: 'revenue', label: 'Revenue', numeric: true, format: moneyWhole },
            { key: 'share', label: 'Share', numeric: true, format: (v) => pct(v) },
            { key: 'growth_pct', label: 'vs prev. period', numeric: true, format: growth },
            { key: 'units', label: 'Units', numeric: true, format: num },
            { key: 'turnover_annualised', label: 'Turnover (×/yr)', numeric: true, format: (v) => fixed(v, 1) },
          ],
          rows: data.categories,
        }}
      >
        <ResponsiveContainer width="100%" height={categoryHeight}>
          <BarChart data={data.categories} layout="vertical" margin={{ top: 4, right: 64, left: 8, bottom: 4 }}>
            <XAxis type="number" hide />
            <YAxis type="category" dataKey="category" {...axisProps(theme)} axisLine={false} width={150} interval={0} />
            <Tooltip cursor={{ fill: theme.grid, opacity: 0.5 }} content={<ChartTooltip valueFormatter={moneyWhole} />} />
            <Bar dataKey="revenue" name="Revenue" fill={theme.series1} radius={[0, 4, 4, 0]} maxBarSize={20}>
              <LabelList dataKey="revenue" position="right" formatter={moneyCompact} fill={theme.ink2} fontSize={12} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <section className="card span-2">
        <h3>Top SKUs by revenue</h3>
        <DataTable columns={SKU_COLUMNS} rows={data.top_skus_by_revenue.map((r) => ({ ...r, id: r.product_id }))} />
      </section>

      <section className="card">
        <h3>Top SKUs by units</h3>
        <DataTable
          columns={[SKU_COLUMNS[0], SKU_COLUMNS[2], SKU_COLUMNS[4]]}
          rows={data.top_skus_by_units.map((r) => ({ ...r, id: r.product_id }))}
        />
      </section>

      <section className="card">
        <h3>Slowest movers</h3>
        <p className="muted small">Available SKUs with the fewest units sold — candidates for promotion or delisting.</p>
        <DataTable columns={[SKU_COLUMNS[0], SKU_COLUMNS[2], SKU_COLUMNS[6]]} rows={data.slow_movers.map((r) => ({ ...r, id: r.product_id }))} />
      </section>

      <ChartCard
        title="Why orders get cancelled"
        subtitle={`${num(s.cancelled_orders)} cancelled orders`}
        table={{ columns: [{ key: 'reason', label: 'Reason' }, { key: 'orders', label: 'Orders', numeric: true }], rows: data.cancellation_reasons }}
      >
        <ResponsiveContainer width="100%" height={Math.max(160, data.cancellation_reasons.length * 34)}>
          <BarChart data={data.cancellation_reasons} layout="vertical" margin={{ top: 4, right: 40, left: 8, bottom: 4 }}>
            <XAxis type="number" hide allowDecimals={false} />
            <YAxis type="category" dataKey="reason" {...axisProps(theme)} axisLine={false} width={190} interval={0} />
            <Tooltip cursor={{ fill: theme.grid, opacity: 0.5 }} content={<ChartTooltip />} />
            <Bar dataKey="orders" name="Orders" fill={theme.series1} radius={[0, 4, 4, 0]} maxBarSize={20}>
              <LabelList dataKey="orders" position="right" fill={theme.ink2} fontSize={12} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <section className="card">
        <h3>Out of stock right now</h3>
        {data.out_of_stock_now.length ? (
          <DataTable
            columns={[
              { key: 'name', label: 'Product' },
              { key: 'category', label: 'Category' },
              { key: 'reorder_level', label: 'Reorder level', numeric: true },
            ]}
            rows={data.out_of_stock_now}
          />
        ) : (
          <p className="muted">Every active SKU is in stock. 🎉</p>
        )}
        <p className="muted small">Restock from the Inventory page.</p>
      </section>
      <p className="muted small span-2">Revenue figures are line-item value (price × quantity, pre-tax). Margin uses cost price.</p>
    </div>
  );
}
