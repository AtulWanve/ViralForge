-- Atomically delete a reference, detect whether the project has any left, and
-- reset analysis_status to idle when none remain. A single transaction replaces
-- the previous delete + select + update round-trips, so the status reset can no
-- longer be dropped by a mid-flight failure. SELECT ... FOR UPDATE on the
-- reference row serializes concurrent deletes of the same reference.
CREATE OR REPLACE FUNCTION delete_reference_and_reset_analysis(p_reference_id UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id UUID := auth.uid();
  _project_id UUID;
BEGIN
  IF _user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'unauthorized');
  END IF;

  -- Only references belonging to this user's projects may be deleted.
  SELECT r.project_id INTO _project_id
  FROM references_table r
  JOIN projects p ON p.id = r.project_id
  WHERE r.id = p_reference_id
    AND p.user_id = _user_id
  FOR UPDATE OF r, p;

  IF _project_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;

  DELETE FROM references_table WHERE id = p_reference_id;

  IF NOT EXISTS (SELECT 1 FROM references_table WHERE project_id = _project_id) THEN
    UPDATE projects SET analysis_status = 'idle' WHERE id = _project_id;
  END IF;

  RETURN jsonb_build_object('ok', true, 'project_id', _project_id);
END;
$$;

-- SECURITY DEFINER runs as table owner, bypassing RLS, so the only grant is to
-- the authenticated role and the function itself enforces user_id = auth.uid().
REVOKE EXECUTE ON FUNCTION delete_reference_and_reset_analysis(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION delete_reference_and_reset_analysis(UUID) TO authenticated;