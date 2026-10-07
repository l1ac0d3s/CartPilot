import { NavLink, Outlet } from 'react-router-dom';
import { useApi } from '../../utils/useApi';
import { moneyWhole, num } from '../../utils/format';

const LINKS = [
  ['/admin', 'Analytics', '📊', true],
  ['/admin/orders', 'Orders', '📦'],
  ['/admin/products', 'Products', '🏷️'],
  ['/admin/inventory', 'Inventory', '🏬'],
];

export default function AdminLayout() {
  const { data: summary } = useApi('/admin/summary');
  return (
    <div className="admin">
      <aside className="admin-nav">
        <p className="admin-nav-title">Store admin</p>
        <nav>
          {LINKS.map(([to, label, icon, end]) => (
            <NavLink key={to} to={to} end={end} className="admin-link">
              <span aria-hidden="true">{icon}</span> {label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <div className="admin-body">
        {summary && (
          <div className="summary-strip">
            <span>
              <strong>{num(summary.ordersToday)}</strong> orders today
            </span>
            <span>
              <strong>{moneyWhole(summary.gmvToday)}</strong> GMV today
            </span>
            <span>
              <strong>{num(summary.activeOrders)}</strong> in progress
            </span>
            <span>
              <strong>{num(summary.awaitingPayment)}</strong> awaiting payment
            </span>
            <span className={summary.outOfStockAlerts ? 'strip-alert' : ''}>
              <strong>{num(summary.lowStockAlerts)}</strong> low-stock · <strong>{num(summary.outOfStockAlerts)}</strong>{' '}
              out of stock
            </span>
          </div>
        )}
        <Outlet />
      </div>
    </div>
  );
}
