import { JSX } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAppSelector } from '../store/hooks';

/**
 * Wraps routes that require authentication. Unauthenticated users are sent to
 * /login (remembering where they were headed). This replaces the original
 * app's broken `requiresAuth: false //change back` guard.
 */
export function ProtectedRoute({ children }: { children: JSX.Element }): JSX.Element {
  const token = useAppSelector((state) => state.auth.token);
  const location = useLocation();

  if (!token) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }
  return children;
}
