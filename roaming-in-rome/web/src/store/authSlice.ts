import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { LoginResult, User } from '../types';

const TOKEN_KEY = 'token';
const USER_KEY = 'user';

export interface AuthState {
  token: string | null;
  user: User | null;
}

/** Rehydrate auth from localStorage so a reload keeps the session. */
function loadInitialState(): AuthState {
  const token = localStorage.getItem(TOKEN_KEY);
  const userJson = localStorage.getItem(USER_KEY);
  let user: User | null = null;
  if (userJson) {
    try {
      user = JSON.parse(userJson) as User;
    } catch {
      user = null;
    }
  }
  return { token, user };
}

const authSlice = createSlice({
  name: 'auth',
  initialState: loadInitialState(),
  reducers: {
    credentialsReceived(state, action: PayloadAction<LoginResult>) {
      state.token = action.payload.token;
      state.user = action.payload.user;
      localStorage.setItem(TOKEN_KEY, action.payload.token);
      localStorage.setItem(USER_KEY, JSON.stringify(action.payload.user));
    },
    loggedOut(state) {
      state.token = null;
      state.user = null;
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
    },
  },
});

export const { credentialsReceived, loggedOut } = authSlice.actions;
export default authSlice.reducer;
