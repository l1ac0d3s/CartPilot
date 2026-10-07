const { computeBill, evaluateCoupon } = require('../src/services/billingService');

const coupon = (overrides = {}) => ({
  code: 'SAVE10',
  description: '10% off',
  discount_type: 'PERCENT',
  discount_value: 10,
  min_order_value: 499,
  max_discount: 100,
  first_order_only: false,
  is_active: true,
  valid_until: null,
  ...overrides,
});

describe('computeBill', () => {
  test('charges delivery below the free-delivery threshold and applies per-line tax', () => {
    const bill = computeBill([
      { price: 30, quantity: 2, taxRate: 0.05 }, // 60, tax 3
      { price: 20, quantity: 1, taxRate: 0.12 }, // 20, tax 2.4
    ]);
    expect(bill).toMatchObject({ itemCount: 3, subtotal: 80, deliveryFee: 30, tax: 5.4, discount: 0, total: 115.4 });
    expect(bill.amountToFreeDelivery).toBe(119);
  });

  test('free delivery at or above the threshold', () => {
    const bill = computeBill([{ price: 199, quantity: 1, taxRate: 0 }]);
    expect(bill.deliveryFee).toBe(0);
    expect(bill.total).toBe(199);
  });

  test('empty cart costs nothing', () => {
    expect(computeBill([])).toMatchObject({ subtotal: 0, deliveryFee: 0, total: 0, amountToFreeDelivery: 0 });
  });

  test('avoids floating point drift', () => {
    const bill = computeBill([{ price: 0.1, quantity: 3, taxRate: 0 }, { price: 0.2, quantity: 1, taxRate: 0 }]);
    expect(bill.subtotal).toBe(0.5);
  });

  test('percent coupon is capped by max_discount', () => {
    const bill = computeBill([{ price: 1500, quantity: 1, taxRate: 0 }], { coupon: coupon(), couponCode: 'save10' });
    expect(bill.discount).toBe(100);
    expect(bill.total).toBe(1400);
    expect(bill.coupon).toMatchObject({ code: 'SAVE10', applied: true });
  });

  test('coupon below minimum order explains how much more to add', () => {
    const bill = computeBill([{ price: 400, quantity: 1, taxRate: 0 }], { coupon: coupon(), couponCode: 'SAVE10' });
    expect(bill.discount).toBe(0);
    expect(bill.coupon.applied).toBe(false);
    expect(bill.coupon.message).toMatch(/₹99\.00 more/);
  });

  test('unknown coupon is reported, not applied', () => {
    const bill = computeBill([{ price: 400, quantity: 1, taxRate: 0 }], { coupon: null, couponCode: 'NOPE' });
    expect(bill.coupon).toEqual({ code: 'NOPE', applied: false, message: 'Invalid coupon code' });
  });
});

describe('evaluateCoupon', () => {
  test('first-order-only coupons reject repeat customers', () => {
    const result = evaluateCoupon(coupon({ first_order_only: true, min_order_value: 0 }), 50000, { isFirstOrder: false });
    expect(result.applied).toBe(false);
  });

  test('expired coupons are rejected', () => {
    const result = evaluateCoupon(coupon({ valid_until: '2020-01-01', min_order_value: 0 }), 50000);
    expect(result).toMatchObject({ applied: false, message: 'This coupon has expired' });
  });

  test('flat discount never exceeds the subtotal', () => {
    const result = evaluateCoupon(coupon({ discount_type: 'FLAT', discount_value: 150, min_order_value: 0 }), 10000);
    expect(result.discountPaise).toBe(10000);
  });
});
