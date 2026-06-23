import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';

const STORAGE_TOKEN_KEY = 'token';

/**
 * Single axios instance for the whole app. Base URL comes from VITE_API_URL and
 * defaults to "/api" (proxied to the server by Vite in dev).
 */
export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? '/api',
});

/**
 * Attaches the bearer token to every request when present. Reading from
 * localStorage on each request keeps the header correct across reloads and
 * after login/logout without re-instantiating the client.
 */
api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = localStorage.getItem(STORAGE_TOKEN_KEY);
  if (token) {
    config.headers.set('Authorization', `Bearer ${token}`);
  }
  return config;
});

/**
 * Optional hook the app sets so a 401 can clear auth state and redirect.
 * Kept as a setter to avoid a circular import with the Redux store.
 */
let onUnauthorized: (() => void) | null = null;
export function setUnauthorizedHandler(handler: () => void): void {
  onUnauthorized = handler;
}

api.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (error.response?.status === 401 && onUnauthorized) {
      onUnauthorized();
    }
    return Promise.reject(error);
  },
);
