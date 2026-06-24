import axios from 'axios';
import { FormEvent, JSX, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { authApi } from '../api/auth';

export function Register(): JSX.Element {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();

  async function handleSubmit(event: FormEvent): Promise<void> {
    event.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError('Password & Confirm Password do not match.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    setSubmitting(true);
    try {
      await authApi.register({ username, password });
      navigate('/login?registration=success');
    } catch (err) {
      const status = axios.isAxiosError(err) ? err.response?.status : undefined;
      if (status === 409) {
        setError('That username is already taken.');
      } else if (status === 400) {
        setError('Please check your details and try again.');
      } else {
        setError('There were problems registering this user.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="form-page">
      <form className="card form" onSubmit={handleSubmit}>
        <h1>Create Account</h1>
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
        <label>
          Confirm Password
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
          />
        </label>
        <button className="button" type="submit" disabled={submitting}>
          {submitting ? 'Creating…' : 'Create Account'}
        </button>
        <p className="form-aside">
          Have an account? <Link to="/login">Sign in</Link>
        </p>
      </form>
    </section>
  );
}
