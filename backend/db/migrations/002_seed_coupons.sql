-- Reference data: launch coupons used by the checkout flow.
INSERT INTO coupons (code, description, discount_type, discount_value, min_order_value, max_discount, first_order_only)
VALUES
    ('WELCOME50', 'Flat ₹50 off your first order above ₹199', 'FLAT',    50, 199, NULL, TRUE),
    ('SAVE10',    '10% off orders above ₹499 (up to ₹100)',   'PERCENT', 10, 499, 100,  FALSE),
    ('BIGBASKET', 'Flat ₹150 off orders above ₹999',          'FLAT',   150, 999, NULL, FALSE)
ON CONFLICT (code) DO NOTHING;
