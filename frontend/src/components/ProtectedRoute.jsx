import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Spinner } from './Feedback';

export default function ProtectedRoute({ children, admin = false }) {
  const { user, ready, isAdmin, signedOut } = useAuth();
  const location = useLocation();
  if (!ready) return <Spinner />;
  if (!user && signedOut) return <Navigate to="/" replace />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  if (admin && !isAdmin) return <Navigate to="/" replace />;
  return children;
}
