import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

export type ThemeMode = 'dark' | 'light';
export type AccentPalette = 'rose' | 'blue' | 'emerald' | 'amber' | 'violet' | 'cyan';
export type FontChoice = 'Inter' | 'Space Grotesk' | 'JetBrains Mono';
export type ScaleLevel = 0.85 | 0.92 | 1.0 | 1.08 | 1.15;
export type LayoutMode = 'default' | 'focused';

export interface ThemeConfig {
  mode: ThemeMode;
  accent: AccentPalette;
  fontSans: FontChoice;
  fontDisplay: FontChoice;
  fontMono: FontChoice;
  scale: ScaleLevel;
  layout: LayoutMode;
}

const STORAGE_KEY = 'theme-config';

const DEFAULT_THEME: ThemeConfig = {
  mode: 'dark',
  accent: 'rose',
  fontSans: 'Inter',
  fontDisplay: 'Space Grotesk',
  fontMono: 'JetBrains Mono',
  scale: 1.0,
  layout: 'default',
};

const ACCENT_COLORS: Record<AccentPalette, { primary: string; hover: string; subtle: string; text: string }> = {
  rose:   { primary: '#E11D48', hover: '#F43F5E', subtle: '#4C0519', text: '#FB7185' },
  blue:   { primary: '#2563EB', hover: '#3B82F6', subtle: '#1E3A5F', text: '#60A5FA' },
  emerald:{ primary: '#059669', hover: '#10B981', subtle: '#064E3B', text: '#34D399' },
  amber:  { primary: '#D97706', hover: '#F59E0B', subtle: '#78350F', text: '#FBBF24' },
  violet: { primary: '#7C3AED', hover: '#8B5CF6', subtle: '#4C1D95', text: '#A78BFA' },
  cyan:   { primary: '#0891B2', hover: '#06B6D4', subtle: '#164E63', text: '#22D3EE' },
};

const DARK_VARS: Record<string, string> = {
  '--color-bg-primary':    '#0A0A0A',
  '--color-bg-secondary':  '#121212',
  '--color-bg-tertiary':   '#080808',
  '--color-bg-elevated':   '#141414',
  '--color-bg-input':      '#0D0D0D',
  '--color-text-primary':  '#F5F5F5',
  '--color-text-secondary':'rgba(255,255,255,0.6)',
  '--color-text-muted':    'rgba(255,255,255,0.35)',
  '--color-border-subtle': 'rgba(255,255,255,0.08)',
  '--color-border-medium': 'rgba(255,255,255,0.15)',
  '--color-border-strong': 'rgba(255,255,255,0.25)',
  '--color-success':       '#10B981',
  '--color-error':         '#EF4444',
  '--color-scrollbar-track':'rgba(255,255,255,0.03)',
  '--color-scrollbar-thumb':'rgba(255,255,255,0.15)',
};

const LIGHT_VARS: Record<string, string> = {
  '--color-bg-primary':    '#FFFFFF',
  '--color-bg-secondary':  '#F5F5F5',
  '--color-bg-tertiary':   '#E5E5E5',
  '--color-bg-elevated':   '#FAFAFA',
  '--color-bg-input':      '#F0F0F0',
  '--color-text-primary':  '#0A0A0A',
  '--color-text-secondary':'rgba(0,0,0,0.6)',
  '--color-text-muted':    'rgba(0,0,0,0.35)',
  '--color-border-subtle': 'rgba(0,0,0,0.08)',
  '--color-border-medium': 'rgba(0,0,0,0.15)',
  '--color-border-strong': 'rgba(0,0,0,0.25)',
  '--color-success':       '#059669',
  '--color-error':         '#DC2626',
  '--color-scrollbar-track':'rgba(0,0,0,0.03)',
  '--color-scrollbar-thumb':'rgba(0,0,0,0.15)',
};

function getFontFamily(name: FontChoice): string {
  switch (name) {
    case 'Inter': return '"Inter", system-ui, sans-serif';
    case 'Space Grotesk': return '"Space Grotesk", system-ui, sans-serif';
    case 'JetBrains Mono': return '"JetBrains Mono", monospace';
  }
}

interface ThemeContextValue {
  config: ThemeConfig;
  setMode: (m: ThemeMode) => void;
  setAccent: (a: AccentPalette) => void;
  setFontSans: (f: FontChoice) => void;
  setFontDisplay: (f: FontChoice) => void;
  setFontMono: (f: FontChoice) => void;
  setScale: (s: ScaleLevel) => void;
  setLayout: (l: LayoutMode) => void;
  resetTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  config: DEFAULT_THEME,
  setMode: () => {},
  setAccent: () => {},
  setFontSans: () => {},
  setFontDisplay: () => {},
  setFontMono: () => {},
  setScale: () => {},
  setLayout: () => {},
  resetTheme: () => {},
});

export function useTheme() {
  return useContext(ThemeContext);
}

export function xtermThemeFromConfig(config: ThemeConfig) {
  const accent = ACCENT_COLORS[config.accent];
  if (config.mode === 'light') {
    return {
      background: '#F5F5F5',
      foreground: '#1A1A1A',
      cursor: accent.primary,
      cursorAccent: '#FFFFFF',
      selectionBackground: accent.subtle,
      black: '#000000',
      red: accent.primary,
      green: '#059669',
      yellow: '#D97706',
      blue: '#2563EB',
      magenta: '#7C3AED',
      cyan: '#0891B2',
      white: '#1A1A1A',
    };
  }
  return {
    background: '#080808',
    foreground: '#e5e5e5',
    cursor: accent.primary,
    cursorAccent: '#000000',
    selectionBackground: accent.subtle,
    black: '#000000',
    red: accent.primary,
    green: '#10B981',
    yellow: '#FBBF24',
    blue: '#3B82F6',
    magenta: '#D946EF',
    cyan: '#22D3EE',
    white: '#e5e5e5',
  };
}

function normalizeConfig(raw: any): ThemeConfig {
  const c: ThemeConfig = { ...DEFAULT_THEME };
  if (raw && typeof raw === 'object') {
    if (raw.mode === 'dark' || raw.mode === 'light') c.mode = raw.mode;
    if (ACCENT_COLORS[raw.accent as AccentPalette]) c.accent = raw.accent as AccentPalette;
    if ((['Inter', 'Space Grotesk', 'JetBrains Mono'] as FontChoice[]).includes(raw.fontSans)) c.fontSans = raw.fontSans;
    if ((['Inter', 'Space Grotesk', 'JetBrains Mono'] as FontChoice[]).includes(raw.fontDisplay)) c.fontDisplay = raw.fontDisplay;
    if ((['Inter', 'Space Grotesk', 'JetBrains Mono'] as FontChoice[]).includes(raw.fontMono)) c.fontMono = raw.fontMono;
    if ([0.85, 0.92, 1.0, 1.08, 1.15].includes(raw.scale)) c.scale = raw.scale;
    if (raw.layout === 'default' || raw.layout === 'focused') c.layout = raw.layout;
  }
  return c;
}

function loadConfig(): ThemeConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return normalizeConfig(parsed);
    }
  } catch {}
  return DEFAULT_THEME;
}

function saveConfig(config: ThemeConfig) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch {}
}

function applyConfigToRoot(config: ThemeConfig) {
  try {
    const root = document.documentElement;
    const modeVars = (config.mode === 'light' ? LIGHT_VARS : DARK_VARS) || DARK_VARS;
    const accent = ACCENT_COLORS[config.accent] || ACCENT_COLORS.rose;

    for (const [key, value] of Object.entries(modeVars)) {
      root.style.setProperty(key, value);
    }

    root.style.setProperty('--color-accent', accent.primary);
    root.style.setProperty('--color-accent-hover', accent.hover);
    root.style.setProperty('--color-accent-subtle', accent.subtle);
    root.style.setProperty('--color-accent-text', accent.text);

    root.style.setProperty('--font-sans', getFontFamily(config.fontSans));
    root.style.setProperty('--font-display', getFontFamily(config.fontDisplay));
    root.style.setProperty('--font-mono', getFontFamily(config.fontMono));

    root.style.setProperty('--ui-scale', String(config.scale));

    root.setAttribute('data-theme', config.mode);
    root.style.colorScheme = config.mode;
  } catch (err) {
    console.error('[theme] failed to apply theme to root:', err);
  }
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [config, setConfig] = useState<ThemeConfig>(loadConfig);

  useEffect(() => {
    applyConfigToRoot(config);
    saveConfig(config);
  }, [config]);

  const update = useCallback((partial: Partial<ThemeConfig>) => {
    setConfig((prev) => ({ ...prev, ...partial }));
  }, []);

  const ctx: ThemeContextValue = React.useMemo(
    () => ({
      config,
      setMode: (mode) => update({ mode }),
      setAccent: (accent) => update({ accent }),
      setFontSans: (fontSans) => update({ fontSans }),
      setFontDisplay: (fontDisplay) => update({ fontDisplay }),
      setFontMono: (fontMono) => update({ fontMono }),
      setScale: (scale) => update({ scale }),
      setLayout: (layout) => update({ layout }),
      resetTheme: () => setConfig(DEFAULT_THEME),
    }),
    [config, update],
  );

  return <ThemeContext.Provider value={ctx}>{children}</ThemeContext.Provider>;
}
