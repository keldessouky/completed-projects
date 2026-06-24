import { configureStore } from '@reduxjs/toolkit';
import { render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { ProtectedRoute } from './ProtectedRoute';
import authReducer, { AuthState } from '../store/authSlice';

function renderWithAuth(auth: AuthState): void {
  const store = configureStore({
    reducer: { auth: authReducer },
    preloadedState: { auth },
  });

  render(
    <Provider store={store}>
      <MemoryRouter initialEntries={['/itineraries']}>
        <Routes>
          <Route
            path="/itineraries"
            element={
              <ProtectedRoute>
                <div>Secret itineraries</div>
              </ProtectedRoute>
            }
          />
          <Route path="/login" element={<div>Login page</div>} />
        </Routes>
      </MemoryRouter>
    </Provider>,
  );
}

describe('ProtectedRoute', () => {
  it('redirects to /login when there is no token', () => {
    renderWithAuth({ token: null, user: null });
    expect(screen.getByText('Login page')).toBeInTheDocument();
    expect(screen.queryByText('Secret itineraries')).not.toBeInTheDocument();
  });

  it('renders the protected content when authenticated', () => {
    renderWithAuth({ token: 'jwt-123', user: { id: 1, username: 'alice', role: 'ROLE_USER' } });
    expect(screen.getByText('Secret itineraries')).toBeInTheDocument();
    expect(screen.queryByText('Login page')).not.toBeInTheDocument();
  });
});
