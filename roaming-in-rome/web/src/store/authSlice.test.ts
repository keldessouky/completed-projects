import { beforeEach, describe, expect, it } from 'vitest';
import authReducer, { credentialsReceived, loggedOut, AuthState } from './authSlice';

const emptyState: AuthState = { token: null, user: null };

describe('authSlice', () => {
  beforeEach(() => localStorage.clear());

  it('stores token and user (and persists them) on credentialsReceived', () => {
    const next = authReducer(
      emptyState,
      credentialsReceived({
        token: 'jwt-123',
        user: { id: 1, username: 'alice', role: 'ROLE_USER' },
      }),
    );

    expect(next.token).toBe('jwt-123');
    expect(next.user).toEqual({ id: 1, username: 'alice', role: 'ROLE_USER' });
    expect(localStorage.getItem('token')).toBe('jwt-123');
    expect(JSON.parse(localStorage.getItem('user') as string)).toEqual(next.user);
  });

  it('clears token, user, and storage on loggedOut', () => {
    const loggedIn: AuthState = {
      token: 'jwt-123',
      user: { id: 1, username: 'alice', role: 'ROLE_USER' },
    };
    localStorage.setItem('token', 'jwt-123');
    localStorage.setItem('user', JSON.stringify(loggedIn.user));

    const next = authReducer(loggedIn, loggedOut());

    expect(next).toEqual(emptyState);
    expect(localStorage.getItem('token')).toBeNull();
    expect(localStorage.getItem('user')).toBeNull();
  });
});
