"""Generate and load CartPilot's synthetic dataset.

    python -m cartpilot_ml.datagen --reset
"""

import argparse
import time

from ..config import DATABASE_URL
from .load import ADMIN_PASSWORD, DEMO_PASSWORD, load
from .simulate import Config, generate


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--customers", type=int, default=2000)
    parser.add_argument("--products", type=int, default=500)
    parser.add_argument("--orders", type=int, default=11000, help="approximate number of orders to generate")
    parser.add_argument("--days", type=int, default=365, help="length of transaction history")
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--database-url", default=DATABASE_URL)
    parser.add_argument("--reset", action="store_true", help="wipe existing app data before loading")
    args = parser.parse_args()

    started = time.perf_counter()
    dataset = generate(Config(customers=args.customers, products=args.products, target_orders=args.orders,
                              days=args.days, seed=args.seed))
    print(f"generated in {time.perf_counter() - started:.1f}s:")
    for table, count in dataset.summary().items():
        print(f"  {table:<22} {count:>8,}")

    started = time.perf_counter()
    load(dataset, args.database_url, reset=args.reset)
    print(f"loaded into PostgreSQL in {time.perf_counter() - started:.1f}s")
    print(f"\nadmin login:    admin@cartpilot.dev / {ADMIN_PASSWORD}")
    print(f"demo customer:  demo@cartpilot.dev / {DEMO_PASSWORD}  (every synthetic customer uses this password)")


if __name__ == "__main__":
    main()
