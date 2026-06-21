import type { Provider } from '@/types';

export const API_URL = '';

export const PROVIDERS: Provider[] = [
  { id: 'deepseek-v4-flash', name: 'DeepSeek V4 Flash', desc: 'Fast & cheap · 1M ctx' },
  { id: 'deepseek-v4-pro', name: 'DeepSeek V4 Pro', desc: 'Pro reasoning · 1M ctx' },
  { id: 'qwen3p7-plus', name: 'Qwen 3.7 Plus', desc: 'Vision · 262K ctx' },
  { id: 'kimi-k2p6', name: 'Kimi K2.6', desc: 'Vision · 262K ctx' },
  { id: 'minimax-m3', name: 'MiniMax M3', desc: 'Vision · 512K ctx' },
  { id: 'glm-5p1', name: 'GLM 5.1', desc: '202K ctx' },
  { id: 'glm-5p2', name: 'GLM 5.2', desc: 'Opus-level · 1M ctx' },
  { id: 'mimo', name: 'MiMo 2.5', desc: 'Vision · 310B (15B active)' },
  { id: 'mimo-pro', name: 'MiMo 2.5 Pro', desc: '1T (42B active)' },
  { id: '0g', name: 'Qwen 2.5 Omni 7B', desc: '0G Decentralized · Vision' },
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
