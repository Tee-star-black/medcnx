'use client';

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

export type Theme = 'light' | 'dark';

type ThemeContextValue = {
  theme: Theme;
  mounted: boolean;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
};

const ThemeContext =
  createContext<ThemeContextValue | null>(null);

type ThemeProviderProps = {
  children: ReactNode;
};

const STORAGE_KEY = 'medcnx_theme';

function getInitialTheme(): Theme {
  const savedTheme =
    window.localStorage.getItem(STORAGE_KEY);

  if (
    savedTheme === 'light' ||
    savedTheme === 'dark'
  ) {
    return savedTheme;
  }

  return window.matchMedia(
    '(prefers-color-scheme: dark)',
  ).matches
    ? 'dark'
    : 'light';
}

export function ThemeProvider({
  children,
}: ThemeProviderProps) {
  const [theme, setThemeState] =
    useState<Theme>('light');

  const [mounted, setMounted] =
    useState(false);

  useEffect(() => {
    setThemeState(getInitialTheme());
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) {
      return;
    }

    const root =
      document.documentElement;

    root.dataset.theme = theme;

    root.classList.toggle(
      'dark',
      theme === 'dark',
    );

    window.localStorage.setItem(
      STORAGE_KEY,
      theme,
    );
  }, [mounted, theme]);

  function setTheme(nextTheme: Theme) {
    setThemeState(nextTheme);
  }

  function toggleTheme() {
    setThemeState((currentTheme) =>
      currentTheme === 'light'
        ? 'dark'
        : 'light',
    );
  }

  const value = useMemo(
    () => ({
      theme,
      mounted,
      setTheme,
      toggleTheme,
    }),
    [mounted, theme],
  );

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);

  if (!context) {
    throw new Error(
      'useTheme must be used within ThemeProvider.',
    );
  }

  return context;
}