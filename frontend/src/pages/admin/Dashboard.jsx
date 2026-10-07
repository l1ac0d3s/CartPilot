import { useState } from 'react';
import { ErrorNote, Spinner } from '../../components/Feedback';
import { useApi } from '../../utils/useApi';
import OverviewTab from './tabs/OverviewTab';
import ProductsTab from './tabs/ProductsTab';
import CustomersTab from './tabs/CustomersTab';

const PERIODS = [
  [7, 'Last 7 days'],
  [30, 'Last 30 days'],
  [90, 'Last 90 days'],
  [365, 'Last 12 months'],
];
const TABS = [
  ['business', 'Overview', OverviewTab],
  ['products', 'Products', ProductsTab],
  ['customers', 'Customers (RFM)', CustomersTab],
];

export default function Dashboard() {
  const [days, setDays] = useState(30);
  const [tab, setTab] = useState('business');
  const path = `/analytics/${tab}`;
  const { data: raw, dataPath, error, loading, reload } = useApi(path, { days });
  // Only another period of the same tab may be shown dimmed; another tab's data has a different shape.
  const data = dataPath === path ? raw : null;
  const Tab = TABS.find(([key]) => key === tab)[2];

  return (
    <div className="dashboard">
      <div className="dashboard-head">
        <h1>Analytics</h1>
        {/* One filter row scopes every chart below it. */}
        <div className="filter-row">
          <div className="segmented" role="tablist" aria-label="Dashboard section">
            {TABS.map(([key, label]) => (
              <button key={key} role="tab" aria-selected={tab === key} className={tab === key ? 'active' : ''} onClick={() => setTab(key)}>
                {label}
              </button>
            ))}
          </div>
          {tab !== 'customers' && (
            <label className="sort">
              <span className="sr-only">Period</span>
              <select value={days} onChange={(e) => setDays(Number(e.target.value))}>
                {PERIODS.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
      </div>
      <ErrorNote
        error={error && { message: error.status === 503 ? 'Analytics service is offline — start the Python service (ml/).' : error.message }}
        onRetry={reload}
      />
      {loading && !data && <Spinner label="Crunching numbers…" />}
      {/* Refetching keeps the previous render, dimmed, instead of flashing a skeleton. */}
      {data && (
        <div className={loading ? 'dim' : ''}>
          <Tab data={data} days={days} />
        </div>
      )}
    </div>
  );
}
