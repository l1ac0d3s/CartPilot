const inr = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 });
const inrWhole = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });
const compact = new Intl.NumberFormat('en-IN', { notation: 'compact', maximumFractionDigits: 1 });
const number = new Intl.NumberFormat('en-IN');

export const money = (value) => (value == null ? '—' : inr.format(value));
export const moneyWhole = (value) => (value == null ? '—' : inrWhole.format(value));
/** ₹10.3L style compact rupees for KPI tiles and axis ticks. */
export const moneyCompact = (value) => {
  if (value == null) return '—';
  if (Math.abs(value) >= 1e7) return `₹${(value / 1e7).toFixed(2)}Cr`;
  if (Math.abs(value) >= 1e5) return `₹${(value / 1e5).toFixed(1)}L`;
  if (Math.abs(value) >= 1e3) return `₹${(value / 1e3).toFixed(1)}K`;
  return `₹${Math.round(value)}`;
};
export const num = (value) => (value == null ? '—' : number.format(value));
export const numCompact = (value) => (value == null ? '—' : compact.format(value));
export const pct = (value, digits = 1) => (value == null ? '—' : `${(value * 100).toFixed(digits)}%`);
export const fixed = (value, digits = 1) => (value == null ? '—' : Number(value).toFixed(digits));

export const dateTime = (value) =>
  value
    ? new Date(value).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })
    : '—';
export const date = (value) =>
  value ? new Date(value).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
export const time = (value) =>
  value ? new Date(value).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' }) : '';

export const STATUS_LABELS = {
  CREATED: 'Awaiting payment',
  CONFIRMED: 'Confirmed',
  PREPARING: 'Preparing',
  OUT_FOR_DELIVERY: 'Out for delivery',
  DELIVERED: 'Delivered',
  CANCELLED: 'Cancelled',
};

export const discountPct = (price, mrp) => (mrp && mrp > price ? Math.round(((mrp - price) / mrp) * 100) : 0);
