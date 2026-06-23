import { JSX, useEffect } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { NavBar } from './components/NavBar';
import { setUnauthorizedHandler } from './api/client';
import { Home } from './pages/Home';
import { Itineraries } from './pages/Itineraries';
import { ItineraryDetails } from './pages/ItineraryDetails';
import { LandmarkDetails } from './pages/LandmarkDetails';
import { Landmarks } from './pages/Landmarks';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { ProtectedRoute } from './routes/ProtectedRoute';
import { loggedOut } from './store/authSlice';
import { useAppDispatch } from './store/hooks';

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
      </main>
    </div>
  );
}
