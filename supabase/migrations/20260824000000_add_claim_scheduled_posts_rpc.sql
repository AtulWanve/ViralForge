-- Create RPC function for atomically claiming scheduled posts
-- Uses FOR UPDATE SKIP LOCKED to prevent race conditions between concurrent workers

CREATE OR REPLACE FUNCTION claim_scheduled_posts(max_count INT)
RETURNS TABLE (id UUID)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
  UPDATE public.scheduled_posts
  SET status = 'publishing'
  WHERE id IN (
    SELECT public.scheduled_posts.id
    FROM public.scheduled_posts
    WHERE status = 'scheduled'
      AND scheduled_for <= pg_catalog.now()
    ORDER BY scheduled_for ASC
    LIMIT max_count
    FOR UPDATE SKIP LOCKED  -- Skip rows locked by other concurrent workers
  )
  RETURNING public.scheduled_posts.id;
END;
$$;

-- Only the service role may invoke this SECURITY DEFINER RPC
REVOKE EXECUTE ON FUNCTION public.claim_scheduled_posts(INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_scheduled_posts(INT) TO service_role;

-- Add index to improve performance of the claim query
CREATE INDEX IF NOT EXISTS idx_scheduled_posts_claim
ON public.scheduled_posts(scheduled_for, status)
WHERE status = 'scheduled';
