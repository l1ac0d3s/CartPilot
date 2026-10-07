import { money } from '../utils/format';

export default function BillSummary({ bill, compact = false }) {
  if (!bill) return null;
  return (
    <dl className={`bill ${compact ? 'compact' : ''}`}>
      <div>
        <dt>Item total</dt>
        <dd>{money(bill.subtotal)}</dd>
      </div>
      <div>
        <dt>Delivery fee</dt>
        <dd>{bill.deliveryFee ? money(bill.deliveryFee) : <span className="free">FREE</span>}</dd>
      </div>
      <div>
        <dt>Taxes (GST)</dt>
        <dd>{money(bill.tax)}</dd>
      </div>
      {bill.discount > 0 && (
        <div className="bill-discount">
          <dt>Discount{bill.couponCode ? ` (${bill.couponCode})` : ''}</dt>
          <dd>−{money(bill.discount)}</dd>
        </div>
      )}
      <div className="bill-total">
        <dt>To pay</dt>
        <dd>{money(bill.total)}</dd>
      </div>
    </dl>
  );
}
