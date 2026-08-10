'use client';

import { useState, useEffect, useRef } from 'react';
import { Sun, Moon, Monitor, Check } from 'lucide-react';
import { trackFeatureUse } from '../lib/gtag';

type ThemeMode = 'dark' | 'light' | 'system';

// Reads the same source the blocking inline script in app/layout.tsx reads.
// Used as a lazy useState initializer (not a useEffect) so React's state
// matches the DOM the script already produced from its very first render —
// per Next's "Syncing with React state" guidance, a useEffect read runs one
// tick too late and can let a hydration-triggered client re-render (which
// rebuilds <html> from JSX, where data-theme isn't set) win the race, leaving
// the DOM on the CSS default (dark) while this component's state still shows
// the stored preference.
function readStoredTheme(): ThemeMode {
  if (typeof window === 'undefined') return 'system';
  const stored = localStorage.getItem('allmcps-theme');
  return stored === 'dark' || stored === 'light' || stored === 'system' ? stored : 'system';
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

  // Update DOM data-theme attribute only when the mode actually changes here
  // (explicit selection or a live system-preference shift while mode === 'system').
  // Skips the redundant re-apply-on-mount that duplicated the inline script's work.
  const didMountRef = useRef(false);
  useEffect(() => {
    if (!mounted) return;

    const applyTheme = (mode: ThemeMode) => {
      const root = document.documentElement;
      let effectiveTheme: 'dark' | 'light' = 'dark';

      if (mode === 'system') {
        effectiveTheme = window.matchMedia('(prefers-color-scheme: dark)').matches
          ? 'dark'
          : 'light';
      } else {
        effectiveTheme = mode;
      }

      root.setAttribute('data-theme', effectiveTheme);
    };

    if (didMountRef.current) {
      applyTheme(themeMode);
    }
    didMountRef.current = true;

    if (themeMode === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handleChange = () => applyTheme('system');
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }
  }, [themeMode, mounted]);

  // Click outside & Escape key listeners
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
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
    localStorage.setItem('allmcps-theme', mode);
    setIsOpen(false);
    trackFeatureUse('theme_switcher', { mode });
  };

  if (!mounted) return null;

  // Determine current active display icon
  const getDisplayIcon = () => {
    if (themeMode === 'light') return <Sun size={18} />;
    if (themeMode === 'dark') return <Moon size={18} />;
    return <Monitor size={18} />;
  };

  return (
    <div className="theme-switcher-container" ref={containerRef}>
      {isOpen && (
        <div className="theme-switcher-popover" role="menu" aria-label="Select theme mode">
          <button
            type="button"
            className={`theme-switcher-option ${themeMode === 'light' ? 'is-active' : ''}`}
            onClick={() => handleSelectMode('light')}
            role="menuitem"
          >
            <Sun size={15} />
            <span style={{ flex: 1 }}>Light</span>
            {themeMode === 'light' && <Check size={14} />}
          </button>
          <button
            type="button"
            className={`theme-switcher-option ${themeMode === 'dark' ? 'is-active' : ''}`}
            onClick={() => handleSelectMode('dark')}
            role="menuitem"
          >
            <Moon size={15} />
            <span style={{ flex: 1 }}>Dark</span>
            {themeMode === 'dark' && <Check size={14} />}
          </button>
          <button
            type="button"
            className={`theme-switcher-option ${themeMode === 'system' ? 'is-active' : ''}`}
            onClick={() => handleSelectMode('system')}
            role="menuitem"
          >
            <Monitor size={15} />
            <span style={{ flex: 1 }}>System</span>
            {themeMode === 'system' && <Check size={14} />}
          </button>
        </div>
      )}

      <button
        type="button"
        className="theme-switcher-btn"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-label={`Theme: ${themeMode}. Open theme menu`}
        aria-expanded={isOpen}
        aria-haspopup="menu"
        title={`Theme: ${themeMode.charAt(0).toUpperCase() + themeMode.slice(1)}`}
      >
        {getDisplayIcon()}
      </button>
    </div>
  );
}
