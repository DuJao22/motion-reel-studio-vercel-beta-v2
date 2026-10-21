export interface ApiKeyItem {
  key: string;
  masked: string;
  type: string;
  length: number;
}

export interface StyleOption {
  id: number;
  name: string;
  desc: string;
}

export interface ResolutionOption {
  id: number;
  width: number;
  height: number;
  label: string;
}

export interface VoiceOption {
  id: string;
  label: string;
}

export interface EffortOption {
  id: number;
  name: string;
  desc: string;
}

export interface PresetsConfig {
  styles: StyleOption[];
  resolutions: ResolutionOption[];
  framerates: { value: number; label: string }[];
  voices: VoiceOption[];
  efforts: EffortOption[];
  accentPresets: string[];
}

export interface SceneData {
  role: 'hook' | 'body' | 'climax' | 'closing';
  text: string;
  sub: string;
  dur: number;
  idea?: string;
  layout?: string;
  fala?: string;
  origem?: string;
  code?: string;
  fb?: string;
  brief?: any;
  audio?: string;
  voice_at?: number;
  sub_at?: number;
  env?: number[];
  audio_dur?: number;
  emotion?: {
    tag: string;
    emoji: string;
    color: string;
  };
}

export interface ReelDNA {
  estilo: string;
  estilo_desc?: string;
  structure: string;
  transition: string;
  bpm: number;
  energy: number;
  pal: {
    bg1: string;
    bg2: string;
    acc: string;
    acc2: string;
    fg: string;
    dim: string;
  };
  fonte: {
    nome: string;
    stack: string;
    weight: number;
  };
  fx?: {
    grain: number;
    push: number;
    shake: number;
    bars: number;
  };
}

export interface ShowreelItem {
  id: string;
  title: string;
  filename: string;
  createdAt: string;
  size: number;
  htmlUrl: string;
  htmlContent?: string;
  scenes?: SceneData[];
  dna?: ReelDNA;
  jsCode?: string;
  motivo?: string;
  prompt?: string;
}

export interface GenerationEvent {
  step: string;
  message?: string;
  index?: number;
  total?: number;
  text?: string;
  role?: string;
  dur?: number;
  substep?: string;
  origem?: string;
  has_code?: boolean;
  voice?: string;
  audio?: string;
  dna?: ReelDNA;
  scenes?: SceneData[];
  title?: string;
  motivo?: string;
  total_duration?: number;
  result?: {
    id: string;
    title: string;
    filename: string;
    html_url: string;
    total_duration: number;
    scenes_count: number;
    dna: ReelDNA;
    dados: any;
    codigo_pasta: string;
    created_at: string;
  };
}
