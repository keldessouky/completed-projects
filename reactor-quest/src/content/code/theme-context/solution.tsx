import { createContext, useContext, useState, type ReactNode } from 'react';

export type Theme = 'day' | 'night';

interface ThemeValue {
  theme: Theme;
  toggle: () => void;
}

export const ThemeContext = createContext<ThemeValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>('day');
  const toggle = () => setTheme((t) => (t === 'day' ? 'night' : 'day'));
  return <ThemeContext value={{ theme, toggle }}>{children}</ThemeContext>;
}

export function useTheme(): ThemeValue {
  const value = useContext(ThemeContext);
  if (!value) throw new Error('useTheme must be used inside a ThemeProvider');
  return value;
}

export function Screen({ children }: { children: ReactNode }) {
  const { theme } = useTheme();
  return <div className={`screen ${theme}`}>{children}</div>;
}

export function ThemeButton() {
  const { theme, toggle } = useTheme();
  return <button onClick={toggle}>Switch to {theme === 'day' ? 'night' : 'day'}</button>;
}
