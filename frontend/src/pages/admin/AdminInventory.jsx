import { useState } from 'react';
import { api } from '../../api/client';
import { useToast } from '../../context/ToastContext';
import StatTile from '../../charts/StatTile';
import { StockStatusBadge } from '../../components/StatusBadge';
import { ErrorNote, Spinner } from '../../components/Feedback';
import { dateTime, fixed, moneyCompact, num, pct } from '../../utils/format';
import { useApi } from '../../utils/useApi';

export default function AdminInventory() {
  const toast = useToast();
  const alerts = useApi('/admin/alerts', { status: 'open' });
  const plan = useApi('/analytics/inventory', { days: 30 });
  const [restocked, setRestocked] = useState({});

  const restock = async (productId, name, newStock) => {
    try {
      await api(`/admin/products/${productId}`, { method: 'PUT', body: { stock: newStock } });
      setRestocked((prev) => ({ ...prev, [productId]: newStock }));
      toast.success(`${name} restocked to ${newStock}`);
      alerts.reload();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const s = plan.data?.summary;
  const outOfStock = new Set(alerts.data?.alerts.filter((a) => a.type === 'OUT_OF_STOCK').map((a) => a.product.id));
  const openAlerts = alerts.data?.alerts.filter((a) => a.type === 'OUT_OF_STOCK' || !outOfStock.has(a.product.id)) || [];
  return (
    <div className="dash-grid">
      <h1 className="span-2">Inventory</h1>
      {s && (
        <section className="kpi-tiles wide span-2">
          <StatTile label="Out of stock" value={num(s.out_of_stock)} hint="Active SKUs with zero stock" />
          <StatTile label="Below reorder point" value={num(s.reorder_now)} />
          <StatTile label="Current stock-out rate" value={pct(s.current_stockout_rate)} />
          <StatTile label="Median days of cover" value={`${fixed(s.median_days_of_cover, 1)} d`} />
          <StatTile label="Avg inventory turnover" value={`${fixed(s.avg_turnover, 1)}×/yr`} />
          <StatTile label="Inventory value (cost)" value={moneyCompact(s.inventory_value)} />
        </section>
      )}

      <section className="card span-2">
        <div className="row-between">
          <h3>Open stock alerts</h3>
          <span className="muted small">Raised automatically when an order pushes stock to its reorder level</span>
        </div>
        <ErrorNote error={alerts.error} onRetry={alerts.reload} />
        {alerts.data && openAlerts.length === 0 && <p className="muted">No open alerts. 🎉</p>}
        <ul className="alert-list">
          {openAlerts.map((a) => (
            <li key={a.id}>
              <StockStatusBadge status={a.type} />
              <span className="grow">
                <strong>
                  {a.product.icon} {a.product.name}
                </strong>
                <span className="muted small block">
                  {a.product.sku} · stock {a.product.stock} (reorder at {a.reorderLevel}) · since {dateTime(a.createdAt)}
                </span>
              </span>
              <button className="button small" onClick={() => restock(a.product.id, a.product.name, a.product.maxStock)}>
                Restock to {a.product.maxStock}
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="card span-2">
        <div className="row-between">
          <h3>Reorder planning</h3>
          <span className="muted small">
            Reorder point = velocity × lead time ({plan.data?.parameters.lead_time_days}d) + {plan.data?.parameters.service_level_z}σ safety stock
          </span>
        </div>
        <ErrorNote
          error={plan.error && { message: plan.error.status === 503 ? 'Analytics service is offline — start the Python service (ml/).' : plan.error.message }}
          onRetry={plan.reload}
        />
        {plan.loading && !plan.data && <Spinner />}
        {plan.data && (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Status</th>
                  <th className="num">Stock</th>
                  <th className="num">Reorder point</th>
                  <th className="num">Reorder level</th>
                  <th className="num">Velocity/day</th>
                  <th className="num">Days of cover</th>
                  <th className="num">Turnover</th>
                  <th className="num">Suggested order</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {plan.data.items.map((item) => {
                  const done = restocked[item.product_id];
                  return (
                    <tr key={item.product_id} className={done ? 'dim' : ''}>
                      <td>
                        <strong>{item.name}</strong>
                        <span className="muted small block">{item.category}</span>
                      </td>
                      <td>
                        <StockStatusBadge status={done ? 'OK' : item.status} />
                      </td>
                      <td className="num">{done ?? item.stock}</td>
                      <td className="num">{item.reorder_point}</td>
                      <td className="num">
                        {item.reorder_level}
                        {item.reorder_level_too_low && (
                          <span className="stock-low" title="Configured reorder level is below the computed reorder point">
                            {' '}
                            ⚠
                          </span>
                        )}
                      </td>
                      <td className="num">{fixed(item.velocity, 2)}</td>
                      <td className="num">{item.days_of_cover == null ? '—' : fixed(item.days_of_cover, 1)}</td>
                      <td className="num">{item.turnover_annualised == null ? '—' : `${fixed(item.turnover_annualised, 1)}×`}</td>
                      <td className="num">{item.suggested_order_qty || '—'}</td>
                      <td className="actions">
                        {item.suggested_order_qty > 0 && !done && (
                          <button
                            className="button small"
                            onClick={() => restock(item.product_id, item.name, item.stock + item.suggested_order_qty)}
                          >
                            Restock +{item.suggested_order_qty}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
