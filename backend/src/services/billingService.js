const config = require('../config');
const { toPaise, toRupees } = require('../utils/money');

/**
 * Evaluates a coupon against a subtotal. Returns the discount in paise plus a
 * human-readable message explaining why it was (not) applied.
 */
function evaluateCoupon(coupon, subtotalPaise, { isFirstOrder = false, now = new Date() } = {}) {
  if (!coupon) return { applied: false, discountPaise: 0, message: 'Invalid coupon code' };
  if (!coupon.is_active || (coupon.valid_until && new Date(coupon.valid_until) < now)) {
    return { applied: false, discountPaise: 0, message: 'This coupon has expired' };
  }
  if (coupon.first_order_only && !isFirstOrder) {
    return { applied: false, discountPaise: 0, message: 'This coupon is only valid on your first order' };
  }
  const minPaise = toPaise(coupon.min_order_value || 0);
  if (subtotalPaise < minPaise) {
    return {
      applied: false,
      discountPaise: 0,
      message: `Add items worth ₹${toRupees(minPaise - subtotalPaise).toFixed(2)} more to use this coupon`,
    };
  }

  let discountPaise =
    coupon.discount_type === 'PERCENT'
      ? Math.floor((subtotalPaise * Number(coupon.discount_value)) / 100)
      : toPaise(coupon.discount_value);
  if (coupon.max_discount != null) discountPaise = Math.min(discountPaise, toPaise(coupon.max_discount));
  discountPaise = Math.min(discountPaise, subtotalPaise);

  return { applied: true, discountPaise, message: coupon.description };
}

/**
 * Computes the checkout bill:
 *   subtotal + delivery fee + taxes - discounts = final amount
 *
 * @param {Array<{price:number, quantity:number, taxRate:number}>} lines
 * @param {{coupon?:object|null, couponCode?:string|null, isFirstOrder?:boolean}} options
 */
function computeBill(lines, { coupon = null, couponCode = null, isFirstOrder = false } = {}) {
  const { deliveryFee, freeDeliveryThreshold } = config.billing;

  let subtotalPaise = 0;
  let taxPaise = 0;
  let itemCount = 0;
  for (const line of lines) {
    const linePaise = toPaise(line.price) * line.quantity;
    subtotalPaise += linePaise;
    taxPaise += Math.round(linePaise * Number(line.taxRate || 0));
    itemCount += line.quantity;
  }

  const thresholdPaise = toPaise(freeDeliveryThreshold);
  const deliveryPaise = subtotalPaise === 0 || subtotalPaise >= thresholdPaise ? 0 : toPaise(deliveryFee);

  let couponResult = null;
  let discountPaise = 0;
  if (couponCode) {
    const evaluation = evaluateCoupon(coupon, subtotalPaise, { isFirstOrder });
    discountPaise = evaluation.discountPaise;
    couponResult = { code: couponCode.toUpperCase(), applied: evaluation.applied, message: evaluation.message };
  }

  const totalPaise = Math.max(0, subtotalPaise + deliveryPaise + taxPaise - discountPaise);

  return {
    itemCount,
    subtotal: toRupees(subtotalPaise),
    deliveryFee: toRupees(deliveryPaise),
    tax: toRupees(taxPaise),
    discount: toRupees(discountPaise),
    total: toRupees(totalPaise),
    freeDeliveryThreshold,
    amountToFreeDelivery: subtotalPaise > 0 ? toRupees(Math.max(0, thresholdPaise - subtotalPaise)) : 0,
    coupon: couponResult,
  };
}

module.exports = { computeBill, evaluateCoupon };
