'use client';

import { Check, Monitor, Moon, Sun } from 'lucide-react';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { trackFeatureUse } from '../lib/gtag';

type ThemeMode = 'dark' | 'light' | 'system';

declare global {
  interface Window {
    __allmcpsTheme?: 'dark' | 'light';
  }
}

const useIsomorphicLayoutEffect =
  typeof window !== 'undefined' ? useLayoutEffect : useEffect;

// Reads the same source the blocking inline script in app/layout.tsx reads.
// Used as a lazy useState initializer (not a useEffect) so React's state
// matches the DOM the script already produced from its very first render.
function readStoredTheme(): ThemeMode {
  if (typeof window === 'undefined') return 'system';
  try {
    const stored = localStorage.getItem('allmcps-theme');
    return stored === 'dark' || stored === 'light' || stored === 'system'
      ? stored
      : 'system';
  } catch {
    return 'system';
  }
}

export function ThemeSwitcher() {
  const [themeMode, setThemeMode] = useState<ThemeMode>(readStoredTheme);
  const [isOpen, setIsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Defers rendering the toggle until after hydration (SSR always renders
  // `null` here) — themeMode itself is already correct from the lazy
  // initializer above.
  useEffect(() => {
    setMounted(true);
  }, []);

  // Synchronously update DOM data-theme attribute whenever mode changes or system preference shifts.
  // Using layout effect ensures the attribute is applied BEFORE the browser paints any frame,
  // preventing any hydration-triggered flash of dark mode default styles.
  useIsomorphicLayoutEffect(() => {
    document.documentElement.setAttribute('data-hydrated', 'true');

    const applyTheme = (mode: ThemeMode) => {
      const root = document.documentElement;
      const effectiveTheme: 'dark' | 'light' =
        mode === 'system'
          ? window.matchMedia('(prefers-color-scheme: dark)').matches
            ? 'dark'
            : 'light'
          : mode;

      window.__allmcpsTheme = effectiveTheme;
      if (root.getAttribute('data-theme') !== effectiveTheme) {
        root.setAttribute('data-theme', effectiveTheme);
      }
    };

    applyTheme(themeMode);

    if (themeMode === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handleChange = () => applyTheme('system');
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }
  }, [themeMode]);

  // Click outside & Escape key listeners
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const handleSelectMode = (mode: ThemeMode) => {
    setThemeMode(mode);
    try {
      localStorage.setItem('allmcps-theme', mode);
    } catch {}
    setIsOpen(false);
    trackFeatureUse('theme_switcher', { mode });
  };

  if (!mounted) return null;

  const options: { mode: ThemeMode; label: string; Icon: typeof Sun }[] = [
    { mode: 'light', label: 'Light', Icon: Sun },
    { mode: 'dark', label: 'Dark', Icon: Moon },
    { mode: 'system', label: 'System', Icon: Monitor },
  ];
  const Current = options.find((o) => o.mode === themeMode)?.Icon ?? Monitor;

  return (
    <div className="acct-theme" ref={containerRef}>
      {isOpen && (
        <div
          className="acct-theme-menu"
          role="menu"
          aria-label="Select theme mode"
        >
          {options.map(({ mode, label, Icon }) => (
            <button
              key={mode}
              type="button"
              className={`acct-theme-option ${themeMode === mode ? 'is-active' : ''}`}
              onClick={() => handleSelectMode(mode)}
              role="menuitemradio"
              aria-checked={themeMode === mode}
            >
              <Icon size={15} aria-hidden="true" />
              <span>{label}</span>
              {themeMode === mode && (
                <Check
                  size={14}
                  className="acct-theme-check"
                  aria-hidden="true"
                />
              )}
            </button>
          ))}
        </div>
      )}

      <button
        type="button"
        className="acct-theme-btn"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-label={`Theme: ${themeMode}. Open theme menu`}
        aria-expanded={isOpen}
        aria-haspopup="menu"
        title={`Theme: ${themeMode.charAt(0).toUpperCase() + themeMode.slice(1)}`}
      >
        <Current size={16} aria-hidden="true" />
      </button>
    </div>
  );
}
