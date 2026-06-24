import { AxiosAdapter } from 'axios';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api, setUnauthorizedHandler } from './client';

const originalAdapter = api.defaults.adapter;

describe('api client', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => {
    api.defaults.adapter = originalAdapter;
    setUnauthorizedHandler(() => {});
  });

  it('attaches the bearer token from localStorage to requests', async () => {
    localStorage.setItem('token', 'jwt-abc');
    let authHeader: unknown;
    api.defaults.adapter = (async (config) => {
      authHeader = config.headers.get('Authorization');
      return { data: {}, status: 200, statusText: 'OK', headers: {}, config };
    }) as AxiosAdapter;

    await api.get('/landmarks');
    expect(authHeader).toBe('Bearer jwt-abc');
  });

  it('sends no Authorization header when no token is stored', async () => {
    let authHeader: unknown;
    api.defaults.adapter = (async (config) => {
      authHeader = config.headers.get('Authorization');
      return { data: {}, status: 200, statusText: 'OK', headers: {}, config };
    }) as AxiosAdapter;

    await api.get('/landmarks');
    expect(authHeader == null || authHeader === false).toBe(true);
  });

  it('invokes the unauthorized handler on a 401 response', async () => {
    const handler = vi.fn();
    setUnauthorizedHandler(handler);
    api.defaults.adapter = (async (config) =>
      Promise.reject(
        Object.assign(new Error('unauthorized'), {
          config,
          response: { status: 401, data: {}, statusText: 'Unauthorized', headers: {}, config },
        }),
      )) as AxiosAdapter;

    await expect(api.get('/itineraries')).rejects.toBeTruthy();
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('does not invoke the unauthorized handler on other errors', async () => {
    const handler = vi.fn();
    setUnauthorizedHandler(handler);
    api.defaults.adapter = (async (config) =>
      Promise.reject(
        Object.assign(new Error('server error'), {
          config,
          response: { status: 500, data: {}, statusText: 'Server Error', headers: {}, config },
        }),
      )) as AxiosAdapter;

    await expect(api.get('/landmarks')).rejects.toBeTruthy();
    expect(handler).not.toHaveBeenCalled();
  });
});
