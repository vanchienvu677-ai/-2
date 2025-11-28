
export interface MaterialItem {
  id: string;
  name: string; // e.g., "Shell", "Head", "Nozzle N1"
  material: string; // e.g., "S30408", "Q345R"
  specification: string; // e.g., "DN1000", "14mm"
  weight: number; // in kg
  quantity: number;
  unitPrice: number; // Estimated cost per kg or unit
  totalPrice: number;
  category: 'plate' | 'forging' | 'pipe' | 'consumable' | 'other';
}

export interface Equipment {
  id: string;
  tag: string; // e.g., "V-2404"
  name: string; // e.g., "Buffer Tank"
  specification?: string; // e.g., "DN1200x3500" or "V=5m3"
  mainMaterial?: string; // e.g., "S30408"
  designWeight?: number; // Weight listed on the drawing title block
  pageRange?: string; // e.g., "1-3" or "Page 1"
  sourceFileId?: string; // ID of the file this came from
  materials: MaterialItem[];
  drawings: string[]; // Base64 strings or references
  lastModified: number;
  status: 'identified' | 'extracting' | 'complete' | 'error'; // For phased parsing
}

export interface UploadedFile {
  id: string;
  name: string;
  mimeType: string;
  data: string; // Base64
  previewUrl?: string; // Blob URL for UI
  pageCount?: number; // Optional, if we can parse it
}

export interface ProjectState {
  id: string;
  name: string;
  files: UploadedFile[];
  equipments: Equipment[];
  laborCostPerKg: number;
  overheadPercent: number;
  lastSaved: number;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  imageContext?: string; // Base64 of the screenshot/doc context
  isError?: boolean;
  timestamp: number;
}

export enum AppView {
  IMPORTER = 'IMPORTER', // New wizard view
  DIRECTORY = 'DIRECTORY',
  DETAIL = 'DETAIL'
}
