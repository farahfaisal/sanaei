'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';

type Theme = 'dark' | 'light';

interface ThemeContextValue {
  theme: Theme;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: 'light',
  toggleTheme: () => {},
});

export function useTheme() {
  return useContext(ThemeContext);
}

const DARK_VARS: Record<string, string> = {
  '--background': '#0F1117',
  '--foreground': '#F1F5F9',
  '--secondary': '#1A2332',
  '--secondary-foreground': '#4ADE80',
  '--muted': '#1E2535',
  '--muted-foreground': '#94A3B8',
  '--card': '#161B27',
  '--card-foreground': '#F1F5F9',
  '--border': '#2D3748',
  '--input': '#1E2535',
};

const LIGHT_VARS: Record<string, string> = {
  '--background': '#F8FAFC',
  '--foreground': '#0F172A',
  '--secondary': '#E2E8F0',
  '--secondary-foreground': '#16A34A',
  '--muted': '#F1F5F9',
  '--muted-foreground': '#64748B',
  '--card': '#FFFFFF',
  '--card-foreground': '#0F172A',
  '--border': '#CBD5E1',
  '--input': '#F1F5F9',
};

function applyTheme(theme: Theme) {
  const vars = theme === 'dark' ? DARK_VARS : LIGHT_VARS;
  const root = document.documentElement;
  Object.entries(vars).forEach(([key, value]) => {
    root.style.setProperty(key, value);
  });
  root.setAttribute('data-theme', theme);
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Light is the default; dark only if the user switched to it.
  const [theme, setTheme] = useState<Theme>('light');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('app-theme') as Theme | null;
    const initial: Theme = saved === 'dark' ? 'dark' : 'light';
    setTheme(initial);
    applyTheme(initial);
    setMounted(true);
  }, []);

  const toggleTheme = () => {
    setTheme((prev) => {
      const next: Theme = prev === 'dark' ? 'light' : 'dark';
      localStorage.setItem('app-theme', next);
      applyTheme(next);
      return next;
    });
  };

  if (!mounted) return null;

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}
