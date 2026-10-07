import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { useCart } from '../context/CartContext';
import ProductCard from './ProductCard';

const COMPONENT_LABELS = {
  frequency: 'Purchase frequency',
  recency: 'Recency',
  category_affinity: 'Category affinity',
  co_purchase: 'Bought together',
  availability: 'Availability',
};

function ScoreBreakdown({ item, weights }) {
  if (!item.components) return null;
  return (
    <details className="why">
      <summary>Why? · score {item.score.toFixed(2)}</summary>
      <ul>
        {Object.entries(item.components).map(([key, value]) => (
          <li key={key}>
            <span>{COMPONENT_LABELS[key] || key}</span>
            <span className="why-meter" aria-hidden="true">
              <span style={{ width: `${Math.round(value * 100)}%` }} />
            </span>
            <span className="why-value">
              {value.toFixed(2)} × {weights?.[key]}
            </span>
          </li>
        ))}
      </ul>
    </details>
  );
}

/**
 * "Add to your usual cart": personalised recommendations from the scoring engine.
 * Re-fetches whenever the cart's contents change.
 */
export default function Recommendations({ title = 'Add to your usual cart', k, layout = 'row' }) {
  const { cart } = useCart();
  const [data, setData] = useState(null);
  const cartKey = cart.items.map((item) => item.product.id).sort().join(',');

  useEffect(() => {
    let active = true;
    api('/recommendations', { query: { k } })
      .then((result) => active && setData(result))
      .catch(() => active && setData(null));
    return () => {
      active = false;
    };
  }, [cartKey, k]);

  if (!data?.items?.length) return null;
  const subtitle =
    data.strategy === 'cold_start'
      ? 'Popular picks to get you started'
      : data.strategy === 'fallback'
        ? 'Based on your past orders'
        : data.cartSize > 0 && data.avgBasketSize
          ? `Your usual basket has ~${Math.round(data.avgBasketSize)} items — you have ${data.cartSize}`
          : 'Based on what you usually buy';

  return (
    <section className="recs" aria-label={title}>
      <div className="section-head">
        <div>
          <h2>{title}</h2>
          <p className="muted">{subtitle}</p>
        </div>
        <span className="pill">✨ Personalised</span>
      </div>
      <div className={layout === 'row' ? 'product-row' : 'product-grid'}>
        {data.items.map((item) => (
          <ProductCard
            key={item.product.id}
            product={item.product}
            footer={
              <div className="rec-meta">
                <p className="rec-reason">{item.reasons[0]}</p>
                <ScoreBreakdown item={item} weights={data.weights} />
              </div>
            }
          />
        ))}
      </div>
    </section>
  );
}
