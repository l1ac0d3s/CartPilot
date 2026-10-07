/**
 * KPI tile: label, value and a signed delta vs the previous period. Delta colour encodes
 * direction x desirability (e.g. cancellations going up is bad) and always carries an arrow.
 */
export default function StatTile({ label, value, change, upIsGood = true, hint, hero = false }) {
  let delta = null;
  if (change != null) {
    const good = change === 0 ? null : (change > 0) === upIsGood;
    const tone = good == null ? 'neutral' : good ? 'up-good' : 'down-bad';
    delta = (
      <span className={`delta ${tone}`}>
        <span aria-hidden="true">{change > 0 ? '▲' : change < 0 ? '▼' : '■'}</span> {Math.abs(change).toFixed(1)}%
        <span className="muted"> vs prev.</span>
      </span>
    );
  }
  return (
    <div className={`stat-tile ${hero ? 'stat-hero' : ''}`} title={hint}>
      <span className="stat-label">{label}</span>
      <span className="stat-value">{value}</span>
      {delta}
    </div>
  );
}
