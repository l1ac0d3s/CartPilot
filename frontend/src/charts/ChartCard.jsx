import { useState } from 'react';

/**
 * Card wrapper for a chart with a "Table" toggle, so every chart has an accessible
 * table-view twin and values are never gated behind hover.
 */
export default function ChartCard({ title, subtitle, table, children, className = '', dim = false }) {
  const [view, setView] = useState('chart');
  return (
    <section className={`card chart-card ${className} ${dim ? 'dim' : ''}`}>
      <header className="chart-card-head">
        <div>
          <h3>{title}</h3>
          {subtitle && <p className="muted small">{subtitle}</p>}
        </div>
        {table && (
          <div className="segmented" role="group" aria-label={`${title} view`}>
            <button className={view === 'chart' ? 'active' : ''} onClick={() => setView('chart')}>
              Chart
            </button>
            <button className={view === 'table' ? 'active' : ''} onClick={() => setView('table')}>
              Table
            </button>
          </div>
        )}
      </header>
      {view === 'chart' || !table ? children : <DataTable {...table} />}
    </section>
  );
}

export function DataTable({ columns, rows, maxHeight = 320 }) {
  return (
    <div className="table-wrap" style={{ maxHeight }}>
      <table className="table">
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.key} className={c.numeric ? 'num' : ''}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={row.id ?? i}>
              {columns.map((c) => (
                <td key={c.key} className={c.numeric ? 'num' : ''}>
                  {c.format ? c.format(row[c.key], row) : row[c.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
