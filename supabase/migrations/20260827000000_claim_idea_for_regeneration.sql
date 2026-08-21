-- Atomically claim an idea for regeneration: validate eligibility, discard
-- it, and create (or return) exactly one active request. A single SELECT ...
-- FOR UPDATE on the idea row serializes concurrent regenerate calls, so a
-- second claim reuses the first request instead of spawning a duplicate.
-- Idempotent by returning an existing pending/processing request when present.
CREATE OR REPLACE FUNCTION claim_idea_for_regeneration(p_idea_id UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id UUID := auth.uid();
  _project_id UUID;
  _status TEXT;
  _request_id UUID;
BEGIN
  IF _user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'unauthorized');
  END IF;

  SELECT project_id, status INTO _project_id, _status
  FROM content_ideas
  WHERE id = p_idea_id AND user_id = _user_id
  FOR UPDATE;

  IF _project_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;

  IF _status <> 'proposed' AND _status <> 'discarded' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'conflict');
  END IF;

  SELECT id INTO _request_id
  FROM regeneration_requests
  WHERE discarded_idea_id = p_idea_id AND status IN ('pending', 'processing')
  LIMIT 1;

  IF _request_id IS NOT NULL THEN
    RETURN jsonb_build_object('ok', true, 'project_id', _project_id, 'request_id', _request_id, 'existing', true);
  END IF;

  UPDATE content_ideas SET status = 'discarded' WHERE id = p_idea_id;

  INSERT INTO regeneration_requests (project_id, user_id, discarded_idea_id, status)
  VALUES (_project_id, _user_id, p_idea_id, 'pending')
  RETURNING id INTO _request_id;

  RETURN jsonb_build_object('ok', true, 'project_id', _project_id, 'request_id', _request_id, 'existing', false);
END;
$$;

-- SECURITY DEFINER runs as table owner, bypassing RLS, so the only grant is to
-- the authenticated role and the function itself enforces user_id = auth.uid().
REVOKE EXECUTE ON FUNCTION claim_idea_for_regeneration(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION claim_idea_for_regeneration(UUID) TO authenticated;