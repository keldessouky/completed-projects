import { JSX, lazy, Suspense, useEffect } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { NavBar } from './components/NavBar';
import { setUnauthorizedHandler } from './api/client';
import { ProtectedRoute } from './routes/ProtectedRoute';
import { loggedOut } from './store/authSlice';
import { useAppDispatch } from './store/hooks';

// Route-level code splitting: each page is its own chunk, loaded on demand,
// keeping the initial bundle small.
const Home = lazy(() => import('./pages/Home').then((m) => ({ default: m.Home })));
const Login = lazy(() => import('./pages/Login').then((m) => ({ default: m.Login })));
const Register = lazy(() => import('./pages/Register').then((m) => ({ default: m.Register })));
const Landmarks = lazy(() => import('./pages/Landmarks').then((m) => ({ default: m.Landmarks })));
const LandmarkDetails = lazy(() =>
  import('./pages/LandmarkDetails').then((m) => ({ default: m.LandmarkDetails })),
);
const Itineraries = lazy(() =>
  import('./pages/Itineraries').then((m) => ({ default: m.Itineraries })),
);
const ItineraryDetails = lazy(() =>
  import('./pages/ItineraryDetails').then((m) => ({ default: m.ItineraryDetails })),
);

export function App(): JSX.Element {
  const dispatch = useAppDispatch();

  // When any request comes back 401 (e.g. an expired token), drop the session.
  useEffect(() => {
    setUnauthorizedHandler(() => dispatch(loggedOut()));
  }, [dispatch]);

  return (
    <div className="app">
      <NavBar />
      <main className="content">
        <Suspense fallback={<p className="status" role="status">Loading…</p>}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/landmarks" element={<Landmarks />} />
            <Route path="/landmarks/:id" element={<LandmarkDetails />} />
            <Route
              path="/itineraries"
              element={
                <ProtectedRoute>
                  <Itineraries />
                </ProtectedRoute>
              }
            />
            <Route
              path="/itineraries/:id"
              element={
                <ProtectedRoute>
                  <ItineraryDetails />
                </ProtectedRoute>
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </main>
    </div>
  );
}
