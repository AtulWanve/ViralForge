import { inngest } from "@/lib/inngest/client";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const resolvedParams = await params;
  const ideaId = resolvedParams.id;

  // Verify auth
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Atomically claim the idea for regeneration: validates eligibility
  // (proposed or discarded, owned by this user), discards it, and creates
  // or returns exactly one active request.
  const { data: claim, error: claimError } = await supabase.rpc(
    "claim_idea_for_regeneration",
    { p_idea_id: ideaId }
  );

  if (claimError || !claim) {
    return NextResponse.json({ error: "Failed to create regeneration request" }, { status: 500 });
  }

  if (claim.error === "unauthorized") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (claim.error === "not_found") {
    return NextResponse.json({ error: "Idea not found" }, { status: 404 });
  }

  // Note: `approved` ideas are not regenerable. If that changes, relax
  // the status filter inside the RPC, not here.
  if (claim.error === "conflict") {
    return NextResponse.json({ error: "Idea is not eligible for regeneration" }, { status: 409 });
  }

  const requestId = claim.request_id as string;
  const projectId = claim.project_id as string;

  // Trigger generation with the request ID for deduplication
  try {
    await inngest.send({
      name: "app/generate-ideas",
      data: {
        projectId,
        count: 1,
        requestId
      }
    });

    // Next.js aggressive route caching requires explicit revalidation
    revalidatePath(`/dashboard/projects/${projectId}`);

  } catch (error) {
    // If dispatch fails, mark the request as failed so it can be retried
    const dispatchMessage = error instanceof Error ? error.message : 'Unknown error';

    // The route client is user-scoped, so RLS applies to this update. Scoped
    // to 'pending' so a request already claimed by a worker (e.g. the send()
    // call actually succeeded despite the thrown error) is never overwritten;
    // a blocked or unmatched update resolves with zero rows instead of an
    // error, so both outcomes must be captured and surfaced rather than ignored.
    const { data: rolledBack, error: rollbackError } = await supabase
      .from("regeneration_requests")
      .update({
        status: 'failed',
        error_message: dispatchMessage,
        completed_at: new Date().toISOString()
      })
      .eq('id', requestId)
      .eq('status', 'pending')
      .select('id');

    if (rollbackError) {
      console.error(`Failed to mark regeneration request ${requestId} as failed: ${rollbackError.message}; dispatch error: ${dispatchMessage}`);
    } else if (!rolledBack || rolledBack.length === 0) {
      console.error(`Regeneration request ${requestId} not marked failed (zero rows updated; either blocked by RLS policy "Users can manage own regeneration requests" or concurrently moved out of 'pending'); dispatch error: ${dispatchMessage}`);
    }

    return NextResponse.json({ error: "Failed to trigger generation" }, { status: 500 });
  }

  return NextResponse.json({ success: true, requestId });
}