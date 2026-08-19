-- Enable pgcrypto for UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ENUM Types
CREATE TYPE user_role AS ENUM ('admin', 'user');
CREATE TYPE platform AS ENUM ('instagram', 'linkedin', 'tiktok', 'x');
CREATE TYPE asset_type AS ENUM ('image', 'video', 'carousel');
CREATE TYPE asset_state AS ENUM ('queued', 'generating', 'ready', 'failed');
CREATE TYPE post_state AS ENUM ('draft', 'scheduled', 'publishing', 'published', 'failed');

-- Tables

-- 1. Users (Extends auth.users)
CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role user_role NOT NULL DEFAULT 'user'::user_role,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Projects
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  target_platform platform NOT NULL,
  brand_voice TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. References
CREATE TABLE references_table (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  url TEXT,
  media_url TEXT,
  caption TEXT,
  platform platform,
  engagement_data JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Content Profiles
CREATE TABLE content_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL UNIQUE REFERENCES projects(id) ON DELETE CASCADE,
  visual_style TEXT NOT NULL,
  hooks TEXT[] NOT NULL,
  caption_structure TEXT NOT NULL,
  format_mix TEXT NOT NULL,
  content_pillars TEXT[] NOT NULL,
  raw_analysis JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Content Ideas
CREATE TABLE content_ideas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  hook TEXT NOT NULL,
  caption TEXT NOT NULL,
  hashtags TEXT[] NOT NULL,
  format asset_type NOT NULL,
  visual_prompt TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('proposed', 'approved', 'discarded')) DEFAULT 'proposed',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. Generated Assets
CREATE TABLE generated_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  idea_id UUID REFERENCES content_ideas(id) ON DELETE SET NULL,
  type asset_type NOT NULL,
  status asset_state NOT NULL DEFAULT 'queued'::asset_state,
  media_url TEXT,
  error_message TEXT,
  job_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. Scheduled Posts
CREATE TABLE scheduled_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  asset_id UUID NOT NULL REFERENCES generated_assets(id) ON DELETE CASCADE,
  platform platform NOT NULL,
  scheduled_for TIMESTAMP WITH TIME ZONE NOT NULL,
  status post_state NOT NULL DEFAULT 'draft'::post_state,
  publish_error TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Updated_at Trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = NOW();
   RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON projects FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_content_profiles_updated_at BEFORE UPDATE ON content_profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_generated_assets_updated_at BEFORE UPDATE ON generated_assets FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_scheduled_posts_updated_at BEFORE UPDATE ON scheduled_posts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security (RLS) Policies

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE references_table ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_ideas ENABLE ROW LEVEL SECURITY;
ALTER TABLE generated_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduled_posts ENABLE ROW LEVEL SECURITY;

-- users: Users can only read their own row.
CREATE POLICY "Users can read own row" ON users
  FOR SELECT USING (auth.uid() = id);

-- projects: Users can CRUD their own projects.
CREATE POLICY "Users can manage own projects" ON projects
  FOR ALL USING (auth.uid() = user_id);

-- references_table: Users can CRUD references for their own projects.
CREATE POLICY "Users can manage own references" ON references_table
  FOR ALL USING (
    project_id IN (
      SELECT id FROM projects WHERE user_id = auth.uid()
    )
  );

-- content_profiles: Users can CRUD content profiles for their own projects.
CREATE POLICY "Users can manage own content profiles" ON content_profiles
  FOR ALL USING (
    project_id IN (
      SELECT id FROM projects WHERE user_id = auth.uid()
    )
  );

-- content_ideas: Users can CRUD content ideas for their own projects.
CREATE POLICY "Users can manage own content ideas" ON content_ideas
  FOR ALL USING (
    project_id IN (
      SELECT id FROM projects WHERE user_id = auth.uid()
    )
  );

-- generated_assets: Users can CRUD generated assets for their own projects.
CREATE POLICY "Users can manage own generated assets" ON generated_assets
  FOR ALL USING (
    project_id IN (
      SELECT id FROM projects WHERE user_id = auth.uid()
    )
  );

-- scheduled_posts: Users can CRUD scheduled posts for their own projects.
CREATE POLICY "Users can manage own scheduled posts" ON scheduled_posts
  FOR ALL USING (
    project_id IN (
      SELECT id FROM projects WHERE user_id = auth.uid()
    )
  );
