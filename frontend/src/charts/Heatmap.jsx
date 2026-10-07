import { textOn, useChartTheme } from './theme';

/**
 * Grid heatmap on a single-hue sequential ramp. Every cell shows its value on hover/focus
 * (title + aria-label); `showValues` prints values inside cells with contrast-picked text.
 */
export default function Heatmap({ rows, columns, value, format = (v) => v, max, showValues = false, legend }) {
  const theme = useChartTheme();
  const ramp = theme.sequential;
  const peak = max ?? Math.max(1, ...rows.flatMap((r) => columns.map((c) => value(r, c) ?? 0)));
  const colorFor = (v) => {
    if (v == null) return 'transparent';
    const index = Math.min(ramp.length - 1, Math.floor((v / peak) * (ramp.length - 1)));
    return ramp[Math.max(0, index)];
  };

  return (
    <div className="heatmap-wrap">
      <table className="heatmap">
        <thead>
          <tr>
            <th />
            {columns.map((c) => (
              <th key={c.key} scope="col">
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key}>
              <th scope="row">{r.label}</th>
              {columns.map((c) => {
                const v = value(r, c);
                const bg = colorFor(v);
                const text = v == null ? '' : `${r.label}, ${c.title || c.label}: ${format(v)}`;
                return (
                  <td key={c.key} title={text} aria-label={text} tabIndex={v == null ? undefined : 0}>
                    <span className="cell" style={{ background: bg, color: v == null ? undefined : textOn(bg) }}>
                      {showValues && v != null ? format(v) : ''}
                    </span>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      {legend && (
        <div className="ramp-legend">
          <span className="muted small">{legend[0]}</span>
          <span className="ramp">
            {ramp.map((color) => (
              <span key={color} style={{ background: color }} />
            ))}
          </span>
          <span className="muted small">{legend[1]}</span>
        </div>
      )}
    </div>
  );
}
