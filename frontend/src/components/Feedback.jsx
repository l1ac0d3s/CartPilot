export function Spinner({ label = 'Loading…' }) {
  return (
    <div className="spinner-wrap" role="status">
      <span className="spinner" aria-hidden="true" />
      <span className="sr-only">{label}</span>
    </div>
  );
}

export function EmptyState({ icon = '🛒', title, children, action }) {
  return (
    <div className="empty">
      <div className="empty-icon" aria-hidden="true">
        {icon}
      </div>
      <h2>{title}</h2>
      {children && <p>{children}</p>}
      {action}
    </div>
  );
}

export function ErrorNote({ error, onRetry }) {
  if (!error) return null;
  return (
    <div className="error-note" role="alert">
      <span>{error.message || 'Something went wrong'}</span>
      {onRetry && (
        <button className="link-button" onClick={onRetry}>
          Retry
        </button>
      )}
    </div>
  );
}
