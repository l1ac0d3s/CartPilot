import { lazy, Suspense } from 'react';
import { Link, Route, Routes } from 'react-router-dom';
import Navbar from './components/Navbar';
import ProtectedRoute from './components/ProtectedRoute';
import { EmptyState, Spinner } from './components/Feedback';
import Shop from './pages/Shop';
import ProductDetail from './pages/ProductDetail';
import Cart from './pages/Cart';
import MockPayment from './pages/MockPayment';
import Orders from './pages/Orders';
import OrderDetail from './pages/OrderDetail';
import { Login, Register } from './pages/Auth';

// The admin area (and its charting library) is only downloaded by admins.
const AdminLayout = lazy(() => import('./pages/admin/AdminLayout'));
const Dashboard = lazy(() => import('./pages/admin/Dashboard'));
const AdminProducts = lazy(() => import('./pages/admin/AdminProducts'));
const AdminOrders = lazy(() => import('./pages/admin/AdminOrders'));
const AdminInventory = lazy(() => import('./pages/admin/AdminInventory'));

const guard = (element, admin = false) => <ProtectedRoute admin={admin}>{element}</ProtectedRoute>;

export default function App() {
  return (
    <>
      <Navbar />
      <main>
        <Suspense fallback={<Spinner />}>
        <Routes>
          <Route path="/" element={<Shop />} />
          <Route path="/products/:id" element={<ProductDetail />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/cart" element={guard(<Cart />)} />
          <Route path="/pay/:orderId" element={guard(<MockPayment />)} />
          <Route path="/orders" element={guard(<Orders />)} />
          <Route path="/orders/:id" element={guard(<OrderDetail />)} />
          <Route path="/admin" element={guard(<AdminLayout />, true)}>
            <Route index element={<Dashboard />} />
            <Route path="products" element={<AdminProducts />} />
            <Route path="orders" element={<AdminOrders />} />
            <Route path="inventory" element={<AdminInventory />} />
          </Route>
          <Route
            path="*"
            element={
              <EmptyState icon="🧭" title="Page not found" action={<Link to="/" className="button">Go to the shop</Link>} />
            }
          />
        </Routes>
        </Suspense>
      </main>
      <footer className="footer">
        CartPilot · a quick-commerce demo built on synthetic data · <a href="https://github.com/l1ac0d3s/CartPilot">GitHub</a>
      </footer>
    </>
  );
}
