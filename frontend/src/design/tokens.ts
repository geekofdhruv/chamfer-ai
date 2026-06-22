export const palette = {
  light: {
    paper: '#F0F4F8',
    surface: '#FFFFFF',
    subtle: '#E2E8F0',
    ink: '#0F172A',
    slate: '#475569',
    muted: '#64748B',
    cyanotype: '#0C4A6E',
    cobalt: '#1D4ED8',
    copper: '#D97706',
    patina: '#0D9488',
    heat: '#DC2626',
  },
  dark: {
    deepInk: '#0B0D10',
    anodized: '#14171C',
    machine: '#1E2229',
    subtle: '#293038',
    chalk: '#F8FAFC',
    dim: '#94A3B8',
    quiet: '#64748B',
    cobalt: '#3B82F6',
    cyan: '#06B6D4',
    copper: '#F59E0B',
    patina: '#2DD4A7',
    heat: '#EF4444',
  },
  metal: {
    steel: '#8A9499',
    aluminum: '#D1D5DB',
    oxide: '#334155',
    thread: '#475569',
    brass: '#B45309',
  },
} as const;

export type ColorMode = 'light' | 'dark';

export const colors = {
  background: palette.dark.deepInk,
  backgroundLight: palette.light.paper,
  foreground: palette.dark.chalk,
  foregroundLight: palette.light.ink,
  card: palette.dark.anodized,
  cardLight: palette.light.surface,
  popover: palette.dark.machine,
  popoverLight: palette.light.surface,
  primary: palette.dark.cobalt,
  primaryLight: palette.light.cobalt,
  secondary: palette.dark.machine,
  secondaryLight: palette.light.subtle,
  muted: palette.dark.anodized,
  mutedLight: palette.light.subtle,
  accent: palette.dark.copper,
  accentLight: palette.light.copper,
  destructive: palette.dark.heat,
  destructiveLight: palette.light.heat,
  border: palette.dark.subtle,
  borderLight: palette.light.subtle,
  input: palette.dark.subtle,
  inputLight: palette.light.subtle,
  ring: palette.dark.cobalt,
  ringLight: palette.light.cobalt,
};

export const fontFamily = {
  display: '"Space Grotesk", "Inter", system-ui, sans-serif',
  body: '"Inter", system-ui, sans-serif',
  mono: '"JetBrains Mono", "Fira Code", "SF Mono", monospace',
};

export const typeScale = {
  hero: '4rem',
  h1: '3rem',
  h2: '2.25rem',
  h3: '1.5rem',
  h4: '1.25rem',
  body: '1rem',
  small: '0.875rem',
  xs: '0.75rem',
  '2xs': '0.625rem',
};

export const space = {
  0: '0px',
  1: '4px',
  2: '8px',
  3: '12px',
  4: '16px',
  5: '20px',
  6: '24px',
  8: '32px',
  10: '40px',
  12: '48px',
  16: '64px',
  20: '80px',
  24: '96px',
};

export const radii = {
  sm: '6px',
  md: '10px',
  lg: '14px',
  xl: '20px',
  full: '9999px',
};

export const shadow = {
  sm: '0 1px 2px rgba(0,0,0,0.12)',
  md: '0 4px 12px rgba(0,0,0,0.18)',
  lg: '0 12px 32px rgba(0,0,0,0.28)',
  glow: '0 0 24px rgba(59,130,246,0.25)',
  glowCopper: '0 0 24px rgba(245,158,11,0.25)',
};

export const transition = {
  fast: '150ms cubic-bezier(0.4, 0, 0.2, 1)',
  base: '250ms cubic-bezier(0.4, 0, 0.2, 1)',
  slow: '500ms cubic-bezier(0.25, 1, 0.5, 1)',
  spring: '700ms cubic-bezier(0.25, 1, 0.5, 1)',
};

export const zIndex = {
  base: 0,
  panel: 10,
  hud: 50,
  overlay: 100,
  modal: 200,
  toast: 300,
};

export const brand = {
  name: 'VibeCAD',
  tagline: 'CAD by description.',
  description: 'Describe a part in plain language. VibeCAD generates CadQuery Python, runs it on a real OpenCASCADE B-rep kernel, and gives you a manufacturable 3D model.',
  cta: 'Start designing',
  examples: [
    'a 12-tooth spur gear',
    'a wall bracket for a shelf',
    'a 60 mm electronics enclosure',
    'a pipe connector',
  ],
};
