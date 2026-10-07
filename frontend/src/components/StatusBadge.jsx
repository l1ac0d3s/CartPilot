import { STATUS_LABELS } from '../utils/format';

const ORDER_TONES = {
  CREATED: ['warning', '⏳'],
  CONFIRMED: ['info', '✓'],
  PREPARING: ['info', '🧺'],
  OUT_FOR_DELIVERY: ['info', '🛵'],
  DELIVERED: ['good', '✓'],
  CANCELLED: ['critical', '✕'],
};
const PAYMENT_TONES = { PENDING: 'warning', PAID: 'good', FAILED: 'critical', REFUNDED: 'neutral' };

export function OrderStatusBadge({ status }) {
  const [tone, icon] = ORDER_TONES[status] || ['neutral', '•'];
  return (
    <span className={`status status-${tone}`}>
      <span aria-hidden="true">{icon}</span> {STATUS_LABELS[status] || status}
    </span>
  );
}

export function PaymentBadge({ status, method }) {
  const label = method === 'cod' && status === 'PENDING' ? 'Pay on delivery' : status.charAt(0) + status.slice(1).toLowerCase();
  return <span className={`status status-${PAYMENT_TONES[status] || 'neutral'}`}>{label}</span>;
}

const STOCK_STATUS = {
  OUT_OF_STOCK: ['critical', '✕', 'Out of stock'],
  REORDER_NOW: ['serious', '!', 'Reorder now'],
  WATCH: ['warning', '◔', 'Watch'],
  OK: ['good', '✓', 'Healthy'],
  LOW_STOCK: ['serious', '!', 'Low stock'],
};

export function StockStatusBadge({ status }) {
  const [tone, icon, label] = STOCK_STATUS[status] || ['neutral', '•', status];
  return (
    <span className={`status status-${tone}`}>
      <span aria-hidden="true">{icon}</span> {label}
    </span>
  );
}
