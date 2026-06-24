import axios from 'axios';
import { FormEvent, JSX, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { authApi } from '../api/auth';
import { credentialsReceived } from '../store/authSlice';
import { useAppDispatch } from '../store/hooks';

interface LocationState {
  from?: { pathname: string };
}

export function Login(): JSX.Element {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const justRegistered = searchParams.get('registration') === 'success';
  const from = (location.state as LocationState | null)?.from?.pathname ?? '/itineraries';

  async function handleSubmit(event: FormEvent): Promise<void> {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const result = await authApi.login({ username, password });
      dispatch(credentialsReceived(result));
      navigate(from, { replace: true });
    } catch (err) {
      const status = axios.isAxiosError(err) ? err.response?.status : undefined;
      setError(status === 401 ? 'Invalid username or password.' : 'Unable to sign in right now.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="form-page">
      <form className="card form" onSubmit={handleSubmit}>
        <h1>Sign in to start Roaming!</h1>
        {justRegistered && !error && (
          <p className="alert alert-success" role="status">
            Thanks for registering — please sign in.
          </p>
        )}
        {error && (
          <p className="alert alert-error" role="alert">
            {error}
          </p>
        )}
        <label>
          Username
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoFocus
            required
          />
        </label>
        <label>
          Password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>
        <button className="button" type="submit" disabled={submitting}>
          {submitting ? 'Signing in…' : 'Sign in'}
        </button>
        <p className="form-aside">
          Need an account? <Link to="/register">Register</Link>
        </p>
      </form>
    </section>
  );
}
