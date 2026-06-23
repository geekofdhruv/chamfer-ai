export interface ParameterSchema {
  type: 'int' | 'float' | 'bool' | 'string' | 'enum' | 'color';
  default: number | string | boolean;
  min?: number;
  max?: number;
  step?: number;
  description?: string;
  options?: string[];
}

export interface RootHashData {
  code?: string;
  stl?: string;
  step?: string;
  glb?: string;
  dimViews?: string;
}

export interface Parameter {
  name: string;
  default: number;
  min: number;
  max: number;
  step: number;
}

export interface Specification {
  question: string;
  answer: string;
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
  status?: 'pending' | 'running' | 'done' | 'error';
  timestamp?: number;
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
  images?: string[];
  sessionId?: string;
  editMode?: boolean;
  warning?: string;
  inspection?: InspectionData;
  snapshots?: Record<string, string>;
  dimViews?: Record<string, string>;
  visionVerified?: boolean;
  visionFeedback?: string;
  timestamp?: number;
  rootHashes?: RootHashData;
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
  is_closed?: boolean | null;
  bounding_box?: {
    size?: number[];
    min?: number[];
    max?: number[];
    center?: number[];
  };
  center_of_mass?: number[];
  warnings?: string[];
  errors?: string[];
  all_clear?: boolean;
  visionChecking?: boolean;
  visionVerified?: boolean;
  visionFeedback?: string;
}

export interface TEEProof {
  providerAddress: string;
  chatId: string;
  signature: string;
  timestamp: number;
  verified: boolean;
}

export interface Message {
  role: 'user' | 'assistant';
  content: string;
  specifications?: Specification[];
  provider?: string;
  dimViews?: Record<string, string>;
  error?: string;
  clarification?: ClarificationOption[];
  clarificationAnswers?: ClarificationAnswer[];
  teeProof?: TEEProof;
  steps?: WorkflowStep[];
  bestEffort?: boolean;
  warning?: string;
  inspection?: InspectionData;
  snapshots?: Record<string, string>;
  visionVerified?: boolean;
  visionFeedback?: string;
  timestamp?: number;
}

export interface Provider {
  id: string;
  name: string;
  desc: string;
}

export interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  parameters?: Record<string, number>;
  created_at: string;
  updated_at: string;
}

export interface SessionListItem {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  message_count?: number;
}

export interface SavedModel {
  id: string;
  name: string;
  root_hash_stl?: string;
  root_hash_step?: string;
  root_hash_glb?: string;
  root_hash_snapshots?: string;
  root_hash_inspection?: string;
  parameters?: Record<string, number>;
  inspection?: InspectionData;
  bounding_box?: { size?: number[] };
  created_at: string;
}

export interface RootHashData {
  code?: string;
  stl?: string;
  step?: string;
  glb?: string;
  dimViews?: string;
  snapshots?: string;
  inspection?: string;
}

export interface GenerationResult {
  code: string;
  parameters: Record<string, ParameterSchema>;
  description: string;
  tags: string[];
  teeProof?: TEEProof;
}
