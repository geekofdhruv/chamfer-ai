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

export interface Message {
  role: 'user' | 'assistant';
  content: string;
  specifications?: Specification[];
  provider?: string;
  dimViews?: Record<string, string>;
  error?: string;
  // Live-only fields (NOT stored in DB — only present during a live SSE event)
  clarification?: ClarificationOption[];
  steps?: WorkflowStep[];
}

export interface WorkflowStep {
  id: string;
  icon: string;
  label: string;
  detail: string;
  status: 'pending' | 'running' | 'done' | 'error';
  timestamp: number;
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

export interface ClarificationOption {
  question: string;
  key: string;
  options: string[];
  default: string;
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
}
