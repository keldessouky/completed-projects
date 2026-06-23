import { api } from './client';
import { Credentials, LoginResult, User } from '../types';

export const authApi = {
  async login(credentials: Credentials): Promise<LoginResult> {
    const { data } = await api.post<LoginResult>('/auth/login', credentials);
    return data;
  },

  async register(credentials: Credentials): Promise<User> {
    const { data } = await api.post<User>('/auth/register', credentials);
    return data;
  },
};
