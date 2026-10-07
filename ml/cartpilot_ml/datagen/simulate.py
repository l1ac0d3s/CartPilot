"""Behavioural simulation that produces CartPilot's synthetic dataset.

The data is deliberately *not* uniformly random, so the recommender and analytics have
real structure to discover:

* every customer has a persona, a personal set of staple products bought repeatedly,
  brand loyalty, a preferred weekday/time window and an order cadence;
* baskets follow complement rules (milk -> bread -> butter, pasta -> sauce, ...);
* demand is seasonal (summer drinks, winter tea, festive sweets);
* customers sign up over the year and some of them churn;
* a chronological inventory simulation applies orders, cancellations and supplier
  restocks, which yields a consistent stock ledger, low-stock alerts and stock-outs.
"""

from __future__ import annotations

import heapq
import math
import random
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone

from . import catalog

IST = timezone(timedelta(hours=5, minutes=30))

DELIVERY_FEE = 30.0
FREE_DELIVERY_THRESHOLD = 199.0
HIGH_VOLUME_TYPES = {
    "milk", "full_cream_milk", "banana", "eggs", "chips", "masala_chips", "cola", "water", "biscuits",
    "curd", "noodles", "buttermilk", "lassi", "coconut_water", "tomato", "onion", "chocolate",
}
CANCEL_REASONS = ["Ordered by mistake", "Delivery taking too long", "Changed my mind", "Wanted to add more items"]


@dataclass
class Config:
    customers: int = 2000
    products: int = 500
    target_orders: int = 11000
    days: int = 365
    seed: int = 42
    now: datetime | None = None


@dataclass
class Product:
    id: int
    sku: str
    type_key: str
    category_id: int
    category_slug: str
    name: str
    brand: str
    unit: str
    price: float
    mrp: float
    cost: float
    tax_rate: float
    popularity: float
    description: str = ""
    max_stock: int = 100
    reorder_level: int = 10
    lead_days: int = 1
    stock: int = 0
    is_available: bool = True


@dataclass
class Customer:
    id: int
    name: str
    email: str
    created_at: datetime
    persona: str
    engagement: float
    churn_at: datetime | None
    preferred_days: list[int] | None
    hours: tuple[int, int]
    basket_mean: float
    gap_mean: float
    explore_rate: float
    prefers_cod: bool
    address: str
    staples: list[tuple[str, float]] = field(default_factory=list)  # (type_key, inclusion probability)
    brand_pref: dict[str, Product] = field(default_factory=dict)


@dataclass
class PlannedOrder:
    customer: Customer
    created_at: datetime
    lines: dict[int, int]  # product_id -> qty
    outcome: str  # delivered | customer_cancel | payment_failed | store_cancel
    payment_method: str
    cancelled_at: datetime | None = None
    kept: dict[int, int] = field(default_factory=dict)
    id: int = 0


@dataclass
class Dataset:
    categories: list[dict]
    products: list[Product]
    users: list[dict]
    orders: list[dict]
    order_items: list[dict]
    status_history: list[dict]
    payments: list[dict]
    movements: list[dict]
    alerts: list[dict]
    events: list[dict]

    def summary(self) -> dict:
        return {
            "categories": len(self.categories),
            "products": len(self.products),
            "customers": sum(1 for u in self.users if u["role"] == "customer"),
            "orders": len(self.orders),
            "order_items": len(self.order_items),
            "inventory_movements": len(self.movements),
            "inventory_alerts": len(self.alerts),
            "events": len(self.events),
        }


# --------------------------------------------------------------------------- catalog


def build_catalog(cfg: Config, rng: random.Random) -> tuple[list[dict], list[Product]]:
    categories = [
        {"id": i, "slug": slug, "name": name, "icon": icon, "tax_rate": tax}
        for i, (slug, name, icon, tax) in enumerate(catalog.CATEGORIES, start=1)
    ]
    by_slug = {c["slug"]: c for c in categories}

    combos = []
    for type_key, (slug, label, brands, variants, popularity) in catalog.PRODUCT_TYPES.items():
        for b_idx, brand in enumerate(brands):
            brand_factor = rng.uniform(0.9, 1.15) if b_idx else 1.0
            for v_idx, (unit, base_price) in enumerate(variants):
                weight = popularity * (0.7 ** b_idx) * (0.6 ** v_idx) * rng.uniform(0.8, 1.2)
                combos.append((type_key, slug, label, brand, unit, base_price * brand_factor, weight))

    # Trim to the requested catalog size, dropping the least popular variants first but
    # keeping at least one SKU per product type.
    per_type: dict[str, int] = {}
    for combo in combos:
        per_type[combo[0]] = per_type.get(combo[0], 0) + 1
    for combo in sorted(combos, key=lambda c: c[6]):
        if len(combos) <= cfg.products:
            break
        if per_type[combo[0]] > 1:
            combos.remove(combo)
            per_type[combo[0]] -= 1

    products = []
    for pid, (type_key, slug, label, brand, unit, price, weight) in enumerate(combos, start=1):
        price = float(max(5, round(price)))
        mrp = price if rng.random() < 0.3 else float(math.ceil(price * rng.uniform(1.04, 1.25)))
        category = by_slug[slug]
        products.append(
            Product(
                id=pid,
                sku=f"CP-{slug[:3].upper()}-{pid:04d}",
                type_key=type_key,
                category_id=category["id"],
                category_slug=slug,
                name=f"{brand} {label}",
                brand=brand,
                unit=unit,
                price=price,
                mrp=mrp,
                cost=round(price * rng.uniform(0.68, 0.85), 2),
                tax_rate=category["tax_rate"],
                popularity=weight,
                description=f"{label} by {brand}, {unit}. Delivered in minutes from your nearest CartPilot store.",
            )
        )
    return categories, products


# ------------------------------------------------------------------------- customers


def _signup_time(rng: random.Random, start: datetime, days: int) -> datetime:
    if rng.random() < 0.35:  # existing customers who joined before the observation window
        return start - timedelta(days=rng.uniform(1, 300), hours=rng.uniform(0, 24))
    # Growth: later months see more signups.
    return start + timedelta(days=days * rng.random() ** 0.75, hours=rng.uniform(0, 24))


def build_customers(cfg: Config, rng: random.Random, start: datetime, now: datetime) -> list[Customer]:
    persona_names = list(catalog.PERSONAS)
    persona_weights = [catalog.PERSONAS[p]["share"] for p in persona_names]
    customers = []
    used_emails: set[str] = set()

    for i in range(cfg.customers):
        user_id = i + 2  # user 1 is the admin
        is_demo = i == 0
        persona_key = "daily_essentials" if is_demo else rng.choices(persona_names, persona_weights)[0]
        persona = catalog.PERSONAS[persona_key]

        first, last = rng.choice(catalog.FIRST_NAMES), rng.choice(catalog.LAST_NAMES)
        if is_demo:
            name, email = "Demo Customer", "demo@cartpilot.dev"
        else:
            name = f"{first} {last}"
            base = f"{first}.{last}".lower()
            email = f"{base}@example.com"
            n = 1
            while email in used_emails:
                n += 1
                email = f"{base}{n}@example.com"
        used_emails.add(email)

        created_at = start - timedelta(days=200) if is_demo else _signup_time(rng, start, cfg.days)
        active_from = max(created_at, start)
        churn_at = None
        if not is_demo and rng.random() < 0.35:
            candidate = active_from + timedelta(days=rng.expovariate(1 / 110))
            churn_at = candidate if candidate < now else None

        lo, hi = persona["n_staples"]
        staple_types = rng.sample(persona["staples"], k=min(len(persona["staples"]), rng.randint(lo, hi)))
        if is_demo:
            staple_types = ["milk", "bread", "eggs", "butter", "curd", "banana", "tomato", "onion"]
        weights = [rng.uniform(0.25, 0.85) for _ in staple_types]
        if is_demo:
            weights = [0.85, 0.75, 0.65, 0.55, 0.35, 0.35, 0.3, 0.3]
        basket_mean = rng.uniform(*persona["basket"])
        scale = basket_mean * 0.7 / sum(weights)
        staples = [(t, min(0.95, w * scale)) for t, w in zip(staple_types, weights)]
        if is_demo:
            staples = list(zip(staple_types, weights))

        customers.append(
            Customer(
                id=user_id,
                name=name,
                email=email,
                created_at=created_at,
                persona=persona_key,
                engagement=3.5 if is_demo else min(4.0, rng.lognormvariate(0, 0.55)),
                churn_at=churn_at,
                preferred_days=persona["preferred_days"] or [rng.randrange(7)],
                hours=persona["hours"],
                basket_mean=basket_mean,
                gap_mean=rng.uniform(*persona["gap_days"]),
                explore_rate=rng.uniform(0.4, 1.3),
                prefers_cod=False if is_demo else rng.random() < 0.3,
                address=f"Flat {rng.randint(1, 40)}{rng.choice('ABCD')}, {rng.choice(catalog.LOCALITIES)}, Bengaluru",
                staples=staples,
            )
        )
    return customers


# ---------------------------------------------------------------------------- orders


def _snap_time(rng: random.Random, customer: Customer, t: datetime) -> datetime:
    """Moves a raw timestamp onto the customer's habitual weekday and time of day (IST)."""
    local = t.astimezone(IST)
    if customer.preferred_days and rng.random() < 0.55:
        shift = min((d - local.weekday()) % 7 for d in customer.preferred_days)
        local += timedelta(days=shift)
    if rng.random() < 0.75:
        hour = rng.uniform(customer.hours[0], customer.hours[1])
    else:
        hour = rng.uniform(7, 23.5)
    day = local.replace(hour=0, minute=0, second=0, microsecond=0)
    return (day + timedelta(hours=hour)).astimezone(timezone.utc)


def schedule_orders(customers, rng, start, now, rate):
    schedule = []
    for c in customers:
        if c.created_at < start:  # already a customer: steady state, first order lands anywhere in one cycle
            t = start + timedelta(days=rng.uniform(0, c.gap_mean / (c.engagement * rate)))
        else:  # new signups usually order within a couple of days
            t = c.created_at + timedelta(days=rng.expovariate(1 / 2.0))
        end = c.churn_at or now
        while t < end:
            snapped = _snap_time(rng, c, t)
            if max(c.created_at, start) <= snapped < min(end, now):
                schedule.append((c, snapped))
            t += timedelta(days=rng.gammavariate(2.0, c.gap_mean / 2.0) / (c.engagement * rate))
    return schedule


class BasketBuilder:
    def __init__(self, products: list[Product], rng: random.Random):
        self.rng = rng
        self.by_type: dict[str, list[Product]] = {}
        self.by_category: dict[str, list[Product]] = {}
        for p in products:
            self.by_type.setdefault(p.type_key, []).append(p)
            self.by_category.setdefault(p.category_slug, []).append(p)
        self.all_categories = list(self.by_category)

    def pick(self, customer: Customer, type_key: str) -> Product:
        """Brand loyalty: customers mostly stick to the SKU they picked the first time."""
        preferred = customer.brand_pref.get(type_key)
        if preferred and self.rng.random() < 0.88:
            return preferred
        options = self.by_type[type_key]
        chosen = self.rng.choices(options, [p.popularity for p in options])[0]
        customer.brand_pref.setdefault(type_key, chosen)
        return chosen

    def quantity(self, product: Product) -> int:
        if product.type_key in HIGH_VOLUME_TYPES:
            return self.rng.choices([1, 2, 3], [0.55, 0.33, 0.12])[0]
        return 1 if self.rng.random() < 0.87 else 2

    def build(self, customer: Customer, when: datetime) -> dict[int, int]:
        rng = self.rng
        local = when.astimezone(IST)
        weekend = 1.15 if local.weekday() >= 5 else 1.0
        basket: dict[int, Product] = {}

        for type_key, p in customer.staples:
            prob = min(0.97, p * weekend * catalog.seasonal_multiplier(type_key, local.month, local.day))
            if rng.random() < prob:
                product = self.pick(customer, type_key)
                basket[product.id] = product

        for product in list(basket.values()):
            for comp_type, prob in catalog.COMPLEMENTS.get(product.type_key, []):
                if rng.random() < prob:
                    comp = self.pick(customer, comp_type)
                    basket.setdefault(comp.id, comp)

        explore = catalog.PERSONAS[customer.persona]["explore"]
        for _ in range(_poisson(rng, customer.explore_rate)):
            slug = rng.choice(explore) if rng.random() < 0.7 else rng.choice(self.all_categories)
            options = self.by_category[slug]
            weights = [p.popularity * catalog.seasonal_multiplier(p.type_key, local.month, local.day) for p in options]
            product = rng.choices(options, weights)[0]
            product = self.pick(customer, product.type_key) if product.type_key in customer.brand_pref else product
            basket.setdefault(product.id, product)

        if not basket:  # every order has at least one item: fall back to the top staple
            product = self.pick(customer, customer.staples[0][0])
            basket[product.id] = product

        items = list(basket.values())
        if len(items) > 12:
            items = rng.sample(items, 12)
        return {p.id: self.quantity(p) for p in items}


def _poisson(rng: random.Random, lam: float) -> int:
    threshold, k, prod = math.exp(-lam), 0, rng.random()
    while prod > threshold:
        k += 1
        prod *= rng.random()
    return k


# ------------------------------------------------------------------------- inventory


def _next_restock(t: datetime, lead_days: int) -> datetime:
    local = t.astimezone(IST)
    arrival = (local + timedelta(days=lead_days)).replace(hour=6, minute=0, second=0, microsecond=0)
    return arrival.astimezone(timezone.utc)


def configure_stock(products: list[Product], planned: list[PlannedOrder], days: int, rng: random.Random):
    demand: dict[int, int] = {}
    for order in planned:
        for pid, qty in order.lines.items():
            demand[pid] = demand.get(pid, 0) + qty
    for p in products:
        daily = demand.get(p.id, 0) / days
        p.lead_days = rng.choices([1, 2, 3], [0.6, 0.3, 0.1])[0]
        cover = rng.uniform(0.5, 0.9) if rng.random() < 0.12 else rng.uniform(1.1, 1.7)  # some SKUs under-provisioned
        p.reorder_level = max(3, math.ceil(daily * (p.lead_days + 1) * cover) + 2)
        p.max_stock = p.reorder_level + max(10, math.ceil(daily * rng.uniform(5, 9)) + 5)


def simulate_inventory(products: list[Product], planned: list[PlannedOrder], start: datetime, now: datetime):
    """Replays orders, cancellations and supplier restocks in time order."""
    by_id = {p.id: p for p in products}
    movements: list[dict] = []
    alerts: list[dict] = []
    open_alerts: dict[tuple[int, str], dict] = {}
    pending_restock: set[int] = set()

    opening = start - timedelta(days=1)
    for p in products:
        p.stock = p.max_stock
        movements.append(_movement(p, p.max_stock, "INITIAL", None, opening))

    queue: list = []
    seq = 0

    def push(when, kind, payload):
        nonlocal seq
        seq += 1
        heapq.heappush(queue, (when, seq, kind, payload))

    for order in planned:
        push(order.created_at, "order", order)

    def sync_alerts(p: Product, when: datetime):
        def open_alert(kind):
            if (p.id, kind) not in open_alerts:
                alert = {"product_id": p.id, "alert_type": kind, "stock_level": p.stock,
                         "reorder_level": p.reorder_level, "created_at": when, "resolved_at": None}
                open_alerts[(p.id, kind)] = alert
                alerts.append(alert)

        def resolve(kind):
            alert = open_alerts.pop((p.id, kind), None)
            if alert:
                alert["resolved_at"] = when

        open_alert("LOW_STOCK") if p.stock <= p.reorder_level else resolve("LOW_STOCK")
        open_alert("OUT_OF_STOCK") if p.stock == 0 else resolve("OUT_OF_STOCK")
        if p.stock <= p.reorder_level and p.id not in pending_restock:
            pending_restock.add(p.id)
            push(_next_restock(when, p.lead_days), "restock", p.id)

    while queue:
        when, _, kind, payload = heapq.heappop(queue)
        if when > now:
            break
        if kind == "order":
            order: PlannedOrder = payload
            for pid, qty in order.lines.items():
                p = by_id[pid]
                take = min(qty, p.stock)
                if take == 0:
                    continue  # stock-out: the line is lost demand
                order.kept[pid] = take
                p.stock -= take
                movements.append(_movement(p, -take, "ORDER", order, when))
                sync_alerts(p, when)
            if order.kept and order.outcome != "delivered":
                push(order.cancelled_at, "cancel", order)
        elif kind == "cancel":
            order = payload
            for pid, qty in sorted(order.kept.items()):
                p = by_id[pid]
                p.stock += qty
                movements.append(_movement(p, qty, "CANCEL", order, when))
                sync_alerts(p, when)
        elif kind == "restock":
            p = by_id[payload]
            pending_restock.discard(p.id)
            if p.max_stock > p.stock:
                added = p.max_stock - p.stock
                p.stock = p.max_stock
                movements.append(_movement(p, added, "RESTOCK", None, when))
            sync_alerts(p, when)
    return movements, alerts


def _movement(p: Product, change: int, reason: str, order, when: datetime) -> dict:
    return {"product_id": p.id, "change": change, "reason": reason, "order": order,
            "stock_after": p.stock, "created_at": when}


# --------------------------------------------------------------------------- billing


def bill(lines: list[tuple[Product, int]], coupon: str | None) -> dict:
    subtotal = sum(round(p.price * 100) * q for p, q in lines)
    tax = sum(round(round(p.price * 100) * q * p.tax_rate) for p, q in lines)
    delivery = 0 if subtotal >= FREE_DELIVERY_THRESHOLD * 100 else round(DELIVERY_FEE * 100)
    discount = 0
    if coupon == "WELCOME50":
        discount = 5000
    elif coupon == "BIGBASKET":
        discount = 15000
    elif coupon == "SAVE10":
        discount = min(subtotal // 10, 10000)
    total = subtotal + delivery + tax - discount
    return {k: v / 100 for k, v in
            dict(subtotal=subtotal, tax_amount=tax, delivery_fee=delivery, discount_amount=discount, total_amount=total).items()}


# ------------------------------------------------------------------------------ main


def generate(cfg: Config) -> Dataset:
    rng = random.Random(cfg.seed)
    now = (cfg.now or datetime.now(timezone.utc)).astimezone(timezone.utc)
    start = now - timedelta(days=cfg.days)

    categories, products = build_catalog(cfg, rng)
    customers = build_customers(cfg, rng, start, now)

    # Calibrate the global order rate so the dataset lands near the target order count.
    rate = 1.0
    for _ in range(3):
        schedule = schedule_orders(customers, random.Random(cfg.seed + 1), start, now, rate)
        rate *= cfg.target_orders / max(1, len(schedule))
    schedule = schedule_orders(customers, random.Random(cfg.seed + 1), start, now, rate)
    demo = customers[0]  # make sure the demo account has shopped recently
    if max((when for c, when in schedule if c is demo), default=start) < now - timedelta(days=3):
        recent = (now - timedelta(days=2)).astimezone(IST).replace(hour=8, minute=30, second=0, microsecond=0)
        schedule.append((demo, recent.astimezone(timezone.utc)))
    schedule.sort(key=lambda item: item[1])

    builder = BasketBuilder(products, rng)
    planned: list[PlannedOrder] = []
    for customer, when in schedule:
        method = "cod" if (rng.random() < 0.9) == customer.prefers_cod else "online"
        roll = rng.random()
        if method == "online" and roll < 0.02:
            outcome = "payment_failed"
        elif roll < 0.045:
            outcome = "customer_cancel"
        elif roll < 0.053:
            outcome = "store_cancel"
        else:
            outcome = "delivered"
        order = PlannedOrder(customer, when, builder.build(customer, when), outcome, method)
        order.cancelled_at = when + timedelta(
            minutes={"payment_failed": 30, "customer_cancel": rng.uniform(2, 8), "store_cancel": rng.uniform(5, 15)}.get(outcome, 0)
        )
        planned.append(order)

    configure_stock(products, planned, cfg.days, rng)
    movements, alerts = simulate_inventory(products, planned, start, now)

    # A few batches were written off (expired / damaged) a few hours ago and are now out of stock.
    for p in rng.sample([p for p in products if 0 < p.stock <= p.reorder_level * 2], 3):
        last_change = max(m["created_at"] for m in movements if m["product_id"] == p.id)
        when = min(now - timedelta(minutes=1), max(now - timedelta(hours=rng.uniform(1, 6)), last_change + timedelta(minutes=1)))
        change, p.stock = -p.stock, 0
        movements.append(_movement(p, change, "ADJUSTMENT", None, when))
        for kind in ("LOW_STOCK", "OUT_OF_STOCK"):
            if not any(a["product_id"] == p.id and a["alert_type"] == kind and a["resolved_at"] is None for a in alerts):
                alerts.append({"product_id": p.id, "alert_type": kind, "stock_level": 0,
                               "reorder_level": p.reorder_level, "created_at": when, "resolved_at": None})

    # Seasonal / discontinued SKUs are hidden from the storefront.
    month = now.astimezone(IST).month
    for p in products:
        if p.type_key == "mango" and month not in (4, 5, 6, 7):
            p.is_available = False
    for p in rng.sample(products, 4):
        p.is_available = False

    by_id = {p.id: p for p in products}
    kept_orders = [o for o in planned if o.kept]
    for idx, order in enumerate(kept_orders, start=1):
        order.id = idx

    users = [{"id": 1, "name": "Store Admin", "email": "admin@cartpilot.dev", "role": "admin",
              "created_at": start - timedelta(days=400)}]
    users += [{"id": c.id, "name": c.name, "email": c.email, "role": "customer", "created_at": c.created_at}
              for c in customers]

    orders, items, history, payments = [], [], [], []
    seen_customers: set[int] = set()
    for order in kept_orders:
        c, t = order.customer, order.created_at
        lines = [(by_id[pid], qty) for pid, qty in sorted(order.kept.items())]
        subtotal = sum(p.price * q for p, q in lines)
        first_order = c.id not in seen_customers
        seen_customers.add(c.id)
        coupon = None
        if first_order and subtotal >= 199 and rng.random() < 0.5:
            coupon = "WELCOME50"
        elif subtotal >= 999 and rng.random() < 0.3:
            coupon = "BIGBASKET"
        elif subtotal >= 499 and rng.random() < 0.15:
            coupon = "SAVE10"
        amounts = bill(lines, coupon)

        age_min = (now - t).total_seconds() / 60
        delivery_minutes = min(45.0, max(8.0, rng.lognormvariate(math.log(14), 0.3)))
        timeline = [("CREATED", t, "Order placed")]
        status, payment_status, delivered_at, cancelled_at, cancel_reason = "CREATED", "PENDING", None, None, None

        def advance(new_status, at, note=None):
            nonlocal status
            if at <= now:
                status = new_status
                timeline.append((new_status, at, note))
                return True
            return False

        if order.outcome == "payment_failed":
            payment_status = "FAILED"
            cancelled_at = order.cancelled_at
            if advance("CANCELLED", cancelled_at, "Payment not completed in time"):
                cancel_reason = "Payment not completed in time"
        else:
            confirmed_at = t + timedelta(seconds=rng.uniform(20, 90))
            if method_paid := (order.payment_method == "online" and confirmed_at <= now):
                payment_status = "PAID"
            advance("CONFIRMED", confirmed_at, "Payment received via mock" if order.payment_method == "online"
                    else "Cash on delivery order confirmed")
            if order.outcome == "customer_cancel":
                if advance("CANCELLED", order.cancelled_at, rng.choice(CANCEL_REASONS)):
                    cancelled_at, cancel_reason = order.cancelled_at, timeline[-1][2]
                    payment_status = "REFUNDED" if method_paid else "PENDING"
            else:
                preparing_at = confirmed_at + timedelta(minutes=rng.uniform(0.5, 2))
                advance("PREPARING", preparing_at)
                if order.outcome == "store_cancel":
                    if advance("CANCELLED", max(order.cancelled_at, preparing_at + timedelta(minutes=1)),
                               "Item unavailable at store"):
                        cancelled_at, cancel_reason = timeline[-1][1], "Item unavailable at store"
                        payment_status = "REFUNDED" if method_paid else "PENDING"
                else:
                    dispatched_at = preparing_at + timedelta(minutes=rng.uniform(2, 5))
                    advance("OUT_FOR_DELIVERY", dispatched_at)
                    done_at = t + timedelta(minutes=delivery_minutes)
                    if advance("DELIVERED", done_at):
                        delivered_at = done_at
                        payment_status = "PAID"

        last_update = timeline[-1][1]
        orders.append({
            "id": order.id, "user_id": c.id, **amounts, "coupon_code": coupon,
            "payment_method": order.payment_method, "payment_status": payment_status, "order_status": status,
            "delivery_address": c.address, "cancel_reason": cancel_reason, "created_at": t,
            "updated_at": last_update, "delivered_at": delivered_at, "cancelled_at": cancelled_at,
        })
        for p, q in lines:
            items.append({"order_id": order.id, "product_id": p.id, "product_name": p.name, "quantity": q,
                          "price": p.price, "tax_rate": p.tax_rate})
        for s, at, note in timeline:
            history.append({"order_id": order.id, "status": s, "note": note, "created_at": at})

        if order.payment_method == "online":
            p_status = {"PAID": "SUCCEEDED", "REFUNDED": "REFUNDED", "FAILED": "FAILED"}.get(payment_status, "PENDING")
            payments.append({"order_id": order.id, "provider": "mock", "provider_ref": f"mock_seed_{order.id}",
                             "amount": amounts["total_amount"], "status": p_status,
                             "failure_reason": "Payment not completed in time" if p_status == "FAILED" else None,
                             "created_at": t, "updated_at": last_update})
        elif payment_status == "PAID":
            payments.append({"order_id": order.id, "provider": "cod", "provider_ref": None,
                             "amount": amounts["total_amount"], "status": "SUCCEEDED", "failure_reason": None,
                             "created_at": delivered_at, "updated_at": delivered_at})

    for m in movements:
        m["reference_id"] = m.pop("order").id if m["order"] is not None else None

    events = build_events(rng, kept_orders, customers, builder, products, now)
    return Dataset(categories, products, users, orders, items, history, payments, movements, alerts, events)


# ---------------------------------------------------------------------------- events


def build_events(rng, orders, customers, builder: BasketBuilder, products, now) -> list[dict]:
    """Funnel sessions: converting sessions per order, plus abandoned-cart and browse-only sessions."""
    events: list[dict] = []

    def session_id() -> str:
        return f"seed-{rng.getrandbits(64):016x}"

    def emit(sid, user_id, kind, at, product_id=None, order_id=None):
        if at <= now:
            events.append({"session_id": sid, "user_id": user_id, "event_type": kind, "product_id": product_id,
                           "order_id": order_id, "created_at": at})

    previous: dict[int, datetime] = {}
    for order in orders:
        c, t = order.customer, order.created_at
        sid = session_id()
        at = t - timedelta(minutes=rng.uniform(3, 12))
        for pid in order.lines:  # includes lines later lost to stock-outs
            if rng.random() < 0.5:
                emit(sid, c.id, "product_view", at, pid)
                at += timedelta(seconds=rng.uniform(5, 40))
            emit(sid, c.id, "add_to_cart", at, pid)
            at += timedelta(seconds=rng.uniform(5, 40))
        emit(sid, c.id, "checkout_started", t - timedelta(seconds=rng.uniform(10, 50)))
        emit(sid, c.id, "order_placed", t, order_id=order.id)

        window_start = previous.get(c.id, max(c.created_at, t - timedelta(days=10)))
        previous[c.id] = t
        span = (t - window_start).total_seconds()
        if span <= 600:
            continue
        if rng.random() < 0.45:  # abandoned cart between orders
            sid = session_id()
            at = window_start + timedelta(seconds=rng.uniform(0, span - 600))
            for _ in range(rng.randint(1, 3)):
                product = builder.pick(c, rng.choice(c.staples)[0])
                if rng.random() < 0.6:
                    emit(sid, c.id, "product_view", at, product.id)
                at += timedelta(seconds=rng.uniform(5, 60))
                emit(sid, c.id, "add_to_cart", at, product.id)
            if rng.random() < 0.3:
                emit(sid, c.id, "checkout_started", at + timedelta(seconds=30))
        if rng.random() < 0.6:  # browse-only visit
            sid = session_id()
            at = window_start + timedelta(seconds=rng.uniform(0, span - 600))
            if rng.random() < 0.3:
                emit(sid, c.id, "search", at)
            for _ in range(rng.randint(1, 4)):
                at += timedelta(seconds=rng.uniform(5, 60))
                emit(sid, c.id, "product_view", at, rng.choice(products).id)

    for _ in range(len(orders) // 5):  # anonymous visitors who never log in
        sid = session_id()
        at = now - timedelta(days=rng.uniform(0, 365))
        for _ in range(rng.randint(1, 3)):
            emit(sid, None, "product_view", at, rng.choice(products).id)
            at += timedelta(seconds=rng.uniform(5, 60))
    return events
