-- Fixes the missing updated_at column that the update_updated_at_column()
-- trigger on regeneration_requests silently requires. Without it, every UPDATE
-- failed at runtime, stranding requests in 'processing' forever.
ALTER TABLE regeneration_requests ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Lease marker set when a worker claims a request. Lets a worker crashed mid-run
-- (row left 'processing' with a fresh/absent lease) be recovered and retried.
ALTER TABLE regeneration_requests ADD COLUMN IF NOT EXISTS claimed_at TIMESTAMP WITH TIME ZONE;

-- Fresh claim token issued each time a worker claims a request. Fences late
-- completions/failures from a stale worker that outlived its lease (a prior
-- claim token no longer matches after a crash+reclaim), so it can never act on
-- a lease it no longer owns.
ALTER TABLE regeneration_requests ADD COLUMN IF NOT EXISTS claim_token UUID;

-- Atomically claim a pending regeneration request, or recover a stale one left
-- behind by a crashed worker. FOR UPDATE SKIP LOCKED guarantees a single winner,
-- so retries never spawn duplicate generations. Returns the claim token that
-- must accompany the later complete/fail call, or NULL if the request is owned
-- by another worker (or already done).
CREATE OR REPLACE FUNCTION claim_regeneration_request(req_id UUID)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _claimed UUID;
DECLARE _token UUID;
BEGIN
  SELECT r.id INTO _claimed
  FROM regeneration_requests r
  WHERE r.id = req_id
    AND (
      r.status = 'pending'
      OR (r.status = 'processing' AND r.claimed_at IS NULL)
      OR (r.status = 'processing' AND r.claimed_at < now() - interval '15 minutes')
    )
  FOR UPDATE SKIP LOCKED;

  IF _claimed IS NULL THEN
    RETURN NULL;
  END IF;

  _token := gen_random_uuid();

  UPDATE regeneration_requests
  SET status = 'processing', claimed_at = now(), claim_token = _token
  WHERE id = _claimed;

  RETURN _token;
END;
$$;

-- Atomically insert generated ideas and mark the request completed in a single
-- transaction. Guards on the request still being claimed BY THIS WORKER
-- (status 'processing' AND the caller's claim token still current); otherwise
-- rolls back, so a retry or a stale worker never leaves duplicate ideas after a
-- failure past the insertion point.
CREATE OR REPLACE FUNCTION complete_generation_ideas(
  p_request_id UUID,
  p_project_id UUID,
  p_user_id UUID,
  p_ideas JSONB,
  p_claim_token UUID
) RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _idea JSONB;
DECLARE _request_status TEXT;
BEGIN
  SELECT status INTO _request_status
  FROM regeneration_requests
  WHERE id = p_request_id AND claim_token = p_claim_token
  FOR UPDATE;

  IF _request_status IS NULL OR _request_status <> 'processing' THEN
    RETURN FALSE;
  END IF;

  FOR _idea IN SELECT value FROM jsonb_array_elements(p_ideas) LOOP
    INSERT INTO content_ideas (project_id, user_id, hook, caption, hashtags, format, visual_prompt, status)
    VALUES (
      p_project_id,
      p_user_id,
      _idea->>'hook',
      _idea->>'caption',
      ARRAY(SELECT jsonb_array_elements_text(_idea->'hashtags')),
      (_idea->>'format')::asset_type,
      _idea->>'visual_prompt',
      'proposed'
    );
  END LOOP;

  UPDATE regeneration_requests
  SET status = 'completed', completed_at = now()
  WHERE id = p_request_id;

  RETURN TRUE;
END;
$$;

-- Only the service role may invoke these SECURITY DEFINER RPCs (mirrors
-- claim_scheduled_posts).
REVOKE EXECUTE ON FUNCTION claim_regeneration_request(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION claim_regeneration_request(UUID) TO service_role;
REVOKE EXECUTE ON FUNCTION complete_generation_ideas(UUID, UUID, UUID, JSONB, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION complete_generation_ideas(UUID, UUID, UUID, JSONB, UUID) TO service_role;