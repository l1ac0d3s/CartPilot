/** Tooltip per the chart spec: value leads (strong), series name follows; a short line key marks identity. */
export default function ChartTooltip({ active, payload, label, labelFormatter, valueFormatter }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tooltip">
      <div className="chart-tooltip-label">{labelFormatter ? labelFormatter(label, payload) : label}</div>
      {payload.map((entry) => (
        <div key={entry.dataKey} className="chart-tooltip-row">
          <span className="line-key" style={{ background: entry.color || entry.payload?.fill }} aria-hidden="true" />
          <strong>{valueFormatter ? valueFormatter(entry.value, entry) : entry.value}</strong>
          <span>{entry.name}</span>
        </div>
      ))}
    </div>
  );
}
