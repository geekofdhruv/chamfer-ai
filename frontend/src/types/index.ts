export interface ParameterSchema {
  type: 'int' | 'float' | 'bool' | 'string' | 'enum' | 'color';
  default: number | string | boolean;
  min?: number;
  max?: number;
  step?: number;
  description?: string;
  options?: string[];
}

export interface Parameter {
  name: string;
  default: number;
  min: number;
  max: number;
  step: number;
}

export interface ClarificationOption {
  question: string;
  key: string;
  options: string[];
  default: string;
}

export interface ClarificationAnswer {
  question: string;
  answer: string;
}

export interface WorkflowStep {
  id: string;
  icon: string;
  label: string;
  detail: string;
  status?: 'running' | 'done' | 'error';
}

export interface Message {
  role: 'user' | 'assistant';
  content: string;
  reasoning?: string;
  provider?: string;
  error?: string;
  clarification?: ClarificationOption[];
  clarificationAnswers?: ClarificationAnswer[];
  teeProof?: TEEProof;
  steps?: WorkflowStep[];
  bestEffort?: boolean;
  warning?: string;
  inspection?: InspectionData;
  snapshots?: Record<string, string>;
  dimViews?: Record<string, string>;
  visionVerified?: boolean;
  visionFeedback?: string;
}

export interface Provider {
  id: string;
  name: string;
  desc: string;
}

export interface TEEProof {
  providerAddress: string;
  chatId: string;
  signature: string;
  timestamp: number;
  verified: boolean;
}

export interface GenerationResult {
  code: string;
  parameters: Record<string, ParameterSchema>;
  description: string;
  tags: string[];
  teeProof?: TEEProof;
}

export interface InspectionData {
  shape_type?: string;
  face_count?: number;
  edge_count?: number;
  vertex_count?: number;
  volume?: number;
  surface_area?: number;
  has_volume?: boolean;
  is_valid?: boolean;
  is_solid?: boolean;
  bounding_box?: { size?: number[]; min?: number[]; max?: number[]; center?: number[] };
  center_of_mass?: number[];
  warnings?: string[];
  errors?: string[];
  all_clear?: boolean;
}
