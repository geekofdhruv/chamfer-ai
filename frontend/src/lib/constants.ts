import type { Provider } from '@/types';

export const API_URL = '';

export const PROVIDERS: Provider[] = [
  { id: 'mimo-pro', name: 'MiMo 2.5 Pro', desc: 'Primary · 1T (42B active) · 10M TPM' },
  { id: 'mimo', name: 'MiMo 2.5', desc: 'Vision · 310B (15B active) · 10M TPM' },
  { id: 'mimo-flash', name: 'MiMo 2.5 Flash', desc: 'Fast · 100 RPM · 10M TPM' },
  { id: 'deepseek-v4-flash', name: 'DeepSeek V4 Flash', desc: 'Fast & cheap · 1M ctx' },
  { id: 'deepseek-v4-pro', name: 'DeepSeek V4 Pro', desc: 'Pro reasoning · 1M ctx' },
  { id: 'qwen3p7-plus', name: 'Qwen 3.7 Plus', desc: 'Vision · 262K ctx' },
  { id: 'kimi-k2p6', name: 'Kimi K2.6', desc: 'Vision · 262K ctx' },
  { id: 'minimax-m3', name: 'MiniMax M3', desc: 'Vision · 512K ctx' },
  { id: 'glm-5p1', name: 'GLM 5.1', desc: '202K ctx' },
  { id: 'glm-5p2', name: 'GLM 5.2', desc: 'Opus-level · 1M ctx' },
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

export type ViewPresetId =
  | 'iso'
  | 'top'
  | 'bottom'
  | 'front'
  | 'back'
  | 'left'
  | 'right';

export interface ViewPreset {
  id: ViewPresetId;
  label: string;
  position: [number, number, number];
}

export const VIEW_PRESETS: ViewPreset[] = [
  { id: 'iso',   label: 'Iso',   position: [80, 80, 80] },
  { id: 'top',   label: 'Top',   position: [0, 120, 0.001] },
  { id: 'bottom',label: 'Bot',   position: [0, -120, 0.001] },
  { id: 'front', label: 'Front', position: [0, 0, 120] },
  { id: 'back',  label: 'Back',  position: [0, 0, -120] },
  { id: 'left',  label: 'Left',  position: [-120, 0, 0.001] },
  { id: 'right', label: 'Right', position: [120, 0, 0.001] },
];
