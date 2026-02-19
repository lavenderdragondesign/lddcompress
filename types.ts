
export interface ProcessingFile {
  name: string;
  data: ArrayBuffer;
  size: number;
  previewUrl: string; // Stable URL created once during ingestion
  mimeType: string;
}

export interface ProcessedResult {
  name: string;
  data: Uint8Array;
  originalSize: number;
  newSize: number;
  mimeType: string;
}

export interface AppState {
  status: 'idle' | 'processing' | 'done' | 'error';
  progress: number;
  currentFile: string;
  currentFileUrl: string | null;
  results: ProcessedResult[];
  totalOriginalSize: number;
  totalNewSize: number;
  error?: string;
  squeezeAttempt: number;
  eta: number | null; // Estimated seconds remaining
}

export interface WorkerMessage {
  type: 'START' | 'PROGRESS' | 'DONE' | 'ERROR';
  payload?: any;
}
