-- Atomically save a project's content profile only when it is newer than the
-- stored one. Locks the projects row FOR UPDATE to serialize concurrent
-- analyses for the same project, then compares the incoming raw_analysis
-- generationId against the stored one and writes only when the stored value is
-- absent or lower. Replaces the previous read-then-upsert round-trips in
-- analyze-project so an older analysis can never clobber a newer one.
CREATE OR REPLACE FUNCTION save_profile_if_newer(
  p_project_id UUID,
  p_visual_style TEXT,
  p_hooks TEXT[],
  p_caption_structure TEXT,
  p_format_mix TEXT,
  p_content_pillars TEXT[],
  p_raw_analysis JSONB
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _existing JSONB;
  _stored_gen BIGINT;
  _incoming_gen BIGINT;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM projects WHERE id = p_project_id FOR UPDATE) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'project_not_found');
  END IF;

  SELECT raw_analysis INTO _existing
  FROM content_profiles
  WHERE project_id = p_project_id;

  BEGIN
    _incoming_gen := (p_raw_analysis->>'generationId')::bigint;
  EXCEPTION WHEN others THEN
    _incoming_gen := NULL;
  END;

  IF _existing IS NOT NULL THEN
    BEGIN
      _stored_gen := (_existing->>'generationId')::bigint;
    EXCEPTION WHEN others THEN
      _stored_gen := NULL;
    END;
  END IF;

  -- A stored generation that is strictly newer means this analysis is stale and
  -- must be entirely skipped (a newer analysis owns the project). An EQUAL
  -- stored generation means this analysis is already current (the profile was
  -- written but the caller may not yet have completed the projects status
  -- transition), so the caller should proceed to finish that transition.
  IF _existing IS NOT NULL AND _stored_gen IS NOT NULL THEN
    IF _incoming_gen IS NULL OR _stored_gen > _incoming_gen THEN
      RETURN jsonb_build_object('ok', true, 'applied', false, 'reason', 'stale');
    END IF;
    IF _incoming_gen IS NOT NULL AND _stored_gen = _incoming_gen THEN
      RETURN jsonb_build_object('ok', true, 'applied', false, 'reason', 'same_generation');
    END IF;
  END IF;

  INSERT INTO content_profiles (project_id, visual_style, hooks, caption_structure, format_mix, content_pillars, raw_analysis)
  VALUES (p_project_id, p_visual_style, p_hooks, p_caption_structure, p_format_mix, p_content_pillars, p_raw_analysis)
  ON CONFLICT (project_id) DO UPDATE SET
    visual_style = EXCLUDED.visual_style,
    hooks = EXCLUDED.hooks,
    caption_structure = EXCLUDED.caption_structure,
    format_mix = EXCLUDED.format_mix,
    content_pillars = EXCLUDED.content_pillars,
    raw_analysis = EXCLUDED.raw_analysis;

  RETURN jsonb_build_object('ok', true, 'applied', true, 'reason', 'applied');
END;
$$;

-- Only the analyze worker (service role) calls this; SECURITY DEFINER bypasses
-- RLS, so no public/authenticated grant is needed.
REVOKE EXECUTE ON FUNCTION save_profile_if_newer(UUID, TEXT, TEXT[], TEXT, TEXT, TEXT[], JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION save_profile_if_newer(UUID, TEXT, TEXT[], TEXT, TEXT, TEXT[], JSONB) TO service_role;