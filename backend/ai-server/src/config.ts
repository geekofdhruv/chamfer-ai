export interface ProviderConfig {
  baseUrl: string;
  model: string;
  apiKey: string;
  supportsVision: boolean;
  maxTokens?: number;
}

const FIREWORKS_BASE = 'https://api.fireworks.ai/inference/v1';
const fwKey = process.env.FIREWORKS_API_KEY || '';

export const config = {
  port: parseInt(process.env.PORT || '4000'),
  cadServerUrl: process.env.CAD_SERVER_URL || 'http://localhost:5000',
  providers: {
    '0g': {
      baseUrl: 'https://router-api.0g.ai/v1',
      model: '0GM-1.0-35B-A3B',
      apiKey: process.env.OG_API_KEY || '',
      supportsVision: true,
      maxTokens: 4096,
    },
    'mimo': {
      baseUrl: 'https://api.xiaomimimo.com/v1',
      model: 'mimo-v2.5',
      apiKey: process.env.MIMO_API_KEY || '',
      supportsVision: true,
      maxTokens: 8192,
    },
    'mimo-pro': {
      baseUrl: 'https://api.xiaomimimo.com/v1',
      model: 'mimo-v2.5-pro',
      apiKey: process.env.MIMO_API_KEY || '',
      supportsVision: false,
      maxTokens: 8192,
    },
    'mimo-flash': {
      baseUrl: 'https://api.xiaomimimo.com/v1',
      model: 'mimo-v2-flash',
      apiKey: process.env.MIMO_API_KEY || '',
      supportsVision: false,
      maxTokens: 4096,
    },
    'deepseek-v4-flash': {
      baseUrl: FIREWORKS_BASE,
      model: 'accounts/fireworks/models/deepseek-v4-flash',
      apiKey: fwKey,
      supportsVision: false,
    },
    'deepseek-v4-pro': {
      baseUrl: FIREWORKS_BASE,
      model: 'accounts/fireworks/models/deepseek-v4-pro',
      apiKey: fwKey,
      supportsVision: false,
    },
    'minimax-m3': {
      baseUrl: FIREWORKS_BASE,
      model: 'accounts/fireworks/models/minimax-m3',
      apiKey: fwKey,
      supportsVision: true,
    },
    'glm-5p1': {
      baseUrl: FIREWORKS_BASE,
      model: 'accounts/fireworks/models/glm-5p1',
      apiKey: fwKey,
      supportsVision: false,
    },
    'glm-5p2': {
      baseUrl: FIREWORKS_BASE,
      model: 'accounts/fireworks/models/glm-5p2',
      apiKey: fwKey,
      supportsVision: false,
    },
    'qwen3p7-plus': {
      baseUrl: FIREWORKS_BASE,
      model: 'accounts/fireworks/models/qwen3p7-plus',
      apiKey: fwKey,
      supportsVision: true,
    },
    'kimi-k2p6': {
      baseUrl: FIREWORKS_BASE,
      model: 'accounts/fireworks/models/kimi-k2p6',
      apiKey: fwKey,
      supportsVision: true,
    },
    'groq': {
      baseUrl: 'https://api.groq.com/openai/v1',
      model: 'qwen/qwen3-32b',
      apiKey: process.env.GROQ_API_KEY || '',
      supportsVision: false,
      maxTokens: 4096,
    },
    'groq-vision': {
      baseUrl: 'https://api.groq.com/openai/v1',
      model: 'meta-llama/llama-4-scout-17b-16e-instruct',
      apiKey: process.env.GROQ_API_KEY || '',
      supportsVision: true,
      maxTokens: 4096,
    },
  } as Record<string, ProviderConfig>,
};
