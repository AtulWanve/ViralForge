-- Create regeneration_requests table for idempotent regeneration tracking
CREATE TABLE regeneration_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  discarded_idea_id UUID REFERENCES content_ideas(id) ON DELETE SET NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'processing', 'completed', 'failed')) DEFAULT 'pending',
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Add indexes for efficient lookups
CREATE INDEX idx_regeneration_requests_project_id ON regeneration_requests(project_id);
CREATE INDEX idx_regeneration_requests_user_id ON regeneration_requests(user_id);
CREATE INDEX idx_regeneration_requests_status ON regeneration_requests(status);
CREATE INDEX idx_regeneration_requests_created_at ON regeneration_requests(created_at);

-- Add user_id column to content_ideas for direct user ownership (improves query performance)
ALTER TABLE content_ideas
ADD COLUMN user_id UUID REFERENCES users(id) ON DELETE CASCADE;

-- Backfill user_id from projects table for existing rows
UPDATE content_ideas
SET user_id = projects.user_id
FROM projects
WHERE content_ideas.project_id = projects.id;

-- Make user_id NOT NULL after backfill
ALTER TABLE content_ideas
ALTER COLUMN user_id SET NOT NULL;

-- Add index for user_id lookups
CREATE INDEX idx_content_ideas_user_id ON content_ideas(user_id);

-- Enable RLS on regeneration_requests
ALTER TABLE regeneration_requests ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can manage their own regeneration requests
CREATE POLICY "Users can manage own regeneration requests" ON regeneration_requests
  FOR ALL USING (auth.uid() = user_id);

-- Add updated_at trigger for regeneration_requests
CREATE TRIGGER update_regeneration_requests_updated_at 
  BEFORE UPDATE ON regeneration_requests 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();
