import { STATUS_LABELS, time, dateTime } from '../utils/format';

const FLOW = ['CREATED', 'CONFIRMED', 'PREPARING', 'OUT_FOR_DELIVERY', 'DELIVERED'];

/** Order tracker: Created -> Confirmed -> Preparing -> Out for delivery -> Delivered. */
export default function StatusTimeline({ order }) {
  const reached = new Map(order.statusHistory.map((h) => [h.status, h]));
  const cancelled = reached.get('CANCELLED');
  const currentIndex = FLOW.indexOf(order.orderStatus);

  return (
    <ol className="timeline">
      {FLOW.map((status, index) => {
        const entry = reached.get(status);
        const state = entry ? (index === currentIndex ? 'current' : 'done') : 'todo';
        return (
          <li key={status} className={`timeline-step ${state}`}>
            <span className="timeline-dot" aria-hidden="true" />
            <div>
              <strong>{status === 'CREATED' ? 'Order placed' : STATUS_LABELS[status]}</strong>
              {entry && <small>{time(entry.at)}</small>}
              {entry?.note && status !== 'CREATED' && <small className="muted">{entry.note}</small>}
            </div>
          </li>
        );
      })}
      {cancelled && (
        <li className="timeline-step cancelled">
          <span className="timeline-dot" aria-hidden="true" />
          <div>
            <strong>Cancelled</strong>
            <small>{dateTime(cancelled.at)}</small>
            {cancelled.note && <small className="muted">{cancelled.note}</small>}
          </div>
        </li>
      )}
    </ol>
  );
}
