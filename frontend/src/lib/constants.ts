import type { Provider } from '@/types';

export const API_URL = '';

export const PROVIDERS: Provider[] = [
  { id: 'mimo-pro', name: 'MiMo 2.5 Pro', desc: 'Primary · 1T (42B active) · 10M TPM' },
  { id: 'mimo', name: 'MiMo 2.5', desc: 'Vision · 310B (15B active) · 10M TPM' },
  { id: 'mimo-flash', name: 'MiMo 2.5 Flash', desc: 'Fast · 100 RPM · 10M TPM' },
  { id: 'groq', name: 'Groq Qwen3-32B', desc: 'Fast · 6K TPM limit' },
  { id: 'groq-vision', name: 'Groq Llama 4 Scout', desc: 'Vision · 6K TPM limit' },
  { id: '0g', name: '0G Compute TEE', desc: 'Decentralized · Verified inference' },
];

export function getProviderDisplayName(id: string): string {
  return PROVIDERS.find(p => p.id === id)?.name ?? id;
}

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
