import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Register } from './Register';
import { authApi } from '../api/auth';

vi.mock('../api/auth', () => ({ authApi: { register: vi.fn() } }));

function renderRegister(): void {
  render(
    <MemoryRouter>
      <Register />
    </MemoryRouter>,
  );
}

describe('Register client-side validation', () => {
  beforeEach(() => vi.clearAllMocks());

  it('blocks submission when the passwords do not match', async () => {
    const user = userEvent.setup();
    renderRegister();

    await user.type(screen.getByLabelText('Username'), 'alice');
    await user.type(screen.getByLabelText('Password'), 'password123');
    await user.type(screen.getByLabelText('Confirm Password'), 'different1');
    await user.click(screen.getByRole('button', { name: /create account/i }));

    expect(screen.getByRole('alert')).toHaveTextContent(/do not match/i);
    expect(authApi.register).not.toHaveBeenCalled();
  });

  it('blocks submission when the password is too short', async () => {
    const user = userEvent.setup();
    renderRegister();

    await user.type(screen.getByLabelText('Username'), 'alice');
    await user.type(screen.getByLabelText('Password'), 'short');
    await user.type(screen.getByLabelText('Confirm Password'), 'short');
    await user.click(screen.getByRole('button', { name: /create account/i }));

    expect(screen.getByRole('alert')).toHaveTextContent(/at least 8/i);
    expect(authApi.register).not.toHaveBeenCalled();
  });

  it('calls the API when the input is valid', async () => {
    vi.mocked(authApi.register).mockResolvedValue({ id: 1, username: 'alice', role: 'ROLE_USER' });
    const user = userEvent.setup();
    renderRegister();

    await user.type(screen.getByLabelText('Username'), 'alice');
    await user.type(screen.getByLabelText('Password'), 'password123');
    await user.type(screen.getByLabelText('Confirm Password'), 'password123');
    await user.click(screen.getByRole('button', { name: /create account/i }));

    expect(authApi.register).toHaveBeenCalledWith({ username: 'alice', password: 'password123' });
  });
});
