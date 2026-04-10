'use client';

import { createContext, useContext, useEffect, useState, useCallback } from 'react';

export type ThemePref = 'auto' | 'light' | 'dark';

interface ThemeContextValue {
  pref: ThemePref;
  resolved: 'light' | 'dark';
  setPref: (p: ThemePref) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  pref: 'auto',
  resolved: 'light',
  setPref: () => {},
});

export function useTheme() {
  return useContext(ThemeContext);
}

const STORAGE_KEY = 'mtc_theme_pref';

/** Returns 'dark' if current hour is 20:00–06:59, otherwise 'light' */
function timeBasedTheme(): 'light' | 'dark' {
  const h = new Date().getHours();
  return h >= 20 || h < 7 ? 'dark' : 'light';
}

function resolveTheme(pref: ThemePref): 'light' | 'dark' {
  if (pref === 'light') return 'light';
  if (pref === 'dark') return 'dark';
  return timeBasedTheme();
}

function applyTheme(resolved: 'light' | 'dark') {
  document.documentElement.setAttribute('data-theme', resolved);
}

export default function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [pref, setPrefState] = useState<ThemePref>('auto');
  const [resolved, setResolved] = useState<'light' | 'dark'>('light');

  // On mount, read stored preference and apply
  useEffect(() => {
    const stored = (localStorage.getItem(STORAGE_KEY) as ThemePref) || 'auto';
    const res = resolveTheme(stored);
    setPrefState(stored);
    setResolved(res);
    applyTheme(res);
  }, []);

  // For 'auto', re-check every minute so it flips at 7am/8pm automatically
  useEffect(() => {
    if (pref !== 'auto') return;
    const interval = setInterval(() => {
      const res = timeBasedTheme();
      setResolved(res);
      applyTheme(res);
    }, 60_000);
    return () => clearInterval(interval);
  }, [pref]);

  const setPref = useCallback((p: ThemePref) => {
    const res = resolveTheme(p);
    localStorage.setItem(STORAGE_KEY, p);
    setPrefState(p);
    setResolved(res);
    applyTheme(res);
  }, []);

  return (
    <ThemeContext.Provider value={{ pref, resolved, setPref }}>
      {children}
    </ThemeContext.Provider>
  );
}
