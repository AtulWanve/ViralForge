CREATE TYPE analysis_status AS ENUM ('idle', 'analyzing', 'completed', 'error'); ALTER TABLE projects ADD COLUMN analysis_status analysis_status NOT NULL DEFAULT 'idle';
