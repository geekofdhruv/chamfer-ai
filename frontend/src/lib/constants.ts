import type { Provider } from '@/types';

export const API_URL = '';

export const PROVIDERS: Provider[] = [
  { id: 'mimo', name: 'MiMo', desc: '310B (15B active)' },
  { id: 'mimo-pro', name: 'Pro', desc: '1T (42B active)' },
  { id: '0g', name: '0G', desc: 'Decentralized' },
];

export const PLACEHOLDER_PROMPTS = [
  'make me a gear with 12 teeth',
  'design a mounting bracket',
  'create a spring coil',
  'build a phone stand',
  'make a pipe connector',
  'design a gear knob',
  'create a box with rounded edges',
  'make a mechanical pulley',
];

export const PARAM_PHASES = [
  { at: 0, label: 'rebuilding geometry' },
  { at: 40, label: 'applying parameters' },
  { at: 75, label: 'generating mesh' },
  { at: 100, label: 'complete' },
];
