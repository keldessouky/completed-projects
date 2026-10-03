import { createContext, useContext, useState, type ReactNode } from 'react';

export type Theme = 'day' | 'night';

interface ThemeValue {
  theme: Theme;
  toggle: () => void;
}

// Every screen on the station should be able to read the theme and flip it,
// without passing props through every layer in between.
export const ThemeContext = createContext<ThemeValue | null>(null);

// Holds the theme in state (starting with "day") and provides it to children.
export function ThemeProvider({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

// Reads the context. Outside a ThemeProvider, throw an Error whose message
// mentions ThemeProvider — fail loudly instead of rendering nonsense.
export function useTheme(): ThemeValue {
  // TODO
}

// <div className="screen day|night">{children}</div>
export function Screen({ children }: { children: ReactNode }) {
  return <div className="screen">{children}</div>;
}

// <button>Switch to night</button>  (or "Switch to day") — flips the theme.
export function ThemeButton() {
  return <button>Switch to night</button>;
}
