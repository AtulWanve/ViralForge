export type UserRole = 'admin' | 'user';
export const PLATFORMS = ['instagram', 'linkedin', 'tiktok', 'x'] as const;
export type Platform = typeof PLATFORMS[number];
export const ASSET_TYPES = ['image', 'video', 'carousel'] as const;
export type AssetType = typeof ASSET_TYPES[number];
export type AssetState = 'queued' | 'generating' | 'ready' | 'failed';
export type PostState = 'draft' | 'scheduled' | 'publishing' | 'published' | 'failed';

export interface User {
  id: string; // UUID from Supabase Auth
  email: string;
  role: UserRole;
  created_at: string;
}

export interface Project {
  id: string; // UUID
  user_id: string; // References User.id
  name: string;
  description: string | null;
  target_platform: Platform;
  brand_voice: string | null;
  analysis_status: 'idle' | 'analyzing' | 'completed' | 'error';
  current_generation: number | null;
  created_at: string;
  updated_at: string;
}

export interface Reference {
  id: string; // UUID
  project_id: string; // References Project.id
  url: string | null; // Null if manual upload
  media_url: string | null; // Stored in Supabase Storage
  caption: string | null;
  platform: Platform | null;
  engagement_data: any | null; // JSONB
  created_at: string;
}

export interface ContentProfile {
  id: string; // UUID
  project_id: string; // References Project.id, UNIQUE
  visual_style: string;
  hooks: string[];
  caption_structure: string;
  format_mix: string;
  content_pillars: string[];
  raw_analysis: any; // Full JSON response from Gemini
  created_at: string;
  updated_at: string;
}

export interface ContentIdea {
  id: string; // UUID
  project_id: string; // References Project.id
  hook: string;
  caption: string;
  hashtags: string[];
  format: AssetType;
  visual_prompt: string;
  status: 'proposed' | 'approved' | 'discarded';
  created_at: string;
}

export interface GeneratedAsset {
  id: string; // UUID
  project_id: string; // References Project.id
  idea_id: string | null; // References ContentIdea.id
  type: AssetType;
  status: AssetState;
  media_url: string | null; // Single URL for image/video; JSON-stringified string[] for carousel assets
  error_message: string | null;
  job_id: string | null; // Inngest event ID
  created_at: string;
  updated_at: string;
}

export interface ScheduledPost {
  id: string; // UUID
  project_id: string; // References Project.id
  asset_id: string; // References GeneratedAsset.id
  platform: Platform;
  scheduled_for: string; // ISO DateTime
  timezone: string; // IANA timezone
  status: PostState;
  publish_error: string | null;
  created_at: string;
  updated_at: string;
}
