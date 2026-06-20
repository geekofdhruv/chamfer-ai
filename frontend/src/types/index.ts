export interface Parameter {
  name: string;
  default: number;
  min: number;
  max: number;
  step: number;
}

export interface Message {
  role: 'user' | 'assistant';
  content: string;
  reasoning?: string;
  provider?: string;
  error?: string;
  clarification?: string[];
}

export interface Provider {
  id: string;
  name: string;
  desc: string;
}
