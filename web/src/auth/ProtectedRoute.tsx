import { Navigate, Outlet } from 'react-router-dom';
import { Spinner } from '../components/ui';
import { useAuth } from './useAuth';

export function ProtectedRoute() {
  const { session, loading } = useAuth();
  if (loading) return <Spinner fullPage />;
  return session ? <Outlet /> : <Navigate to="/login" replace />;
}

export function PublicOnlyRoute() {
  const { session, loading } = useAuth();
  if (loading) return <Spinner fullPage />;
  return session ? <Navigate to="/" replace /> : <Outlet />;
}
