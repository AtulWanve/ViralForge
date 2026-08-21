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

  // Only discard ideas that are still proposed
  const { data: existing, error: fetchError } = await supabase
    .from("content_ideas")
    .select("status, project_id")
    .eq('id', ideaId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (fetchError) {
    return NextResponse.json({ error: "Failed to update idea" }, { status: 500 });
  }

  if (!existing) {
    return NextResponse.json({ error: "Idea not found" }, { status: 404 });
  }

  if (existing.status !== 'proposed') {
    return NextResponse.json(
      { error: "Idea is not eligible for discard" },
      { status: 409 }
    );
  }

  // Update idea status
  const { error } = await supabase
    .from("content_ideas")
    .update({ status: 'discarded' })
    .eq('id', ideaId)
    .eq('user_id', user.id)
    .eq('status', 'proposed');

  if (error) {
    return NextResponse.json({ error: "Failed to update idea" }, { status: 500 });
  }

  // Next.js aggressive route caching requires explicit revalidation
  revalidatePath(`/dashboard/projects/${existing.project_id}`);

  return NextResponse.json({ success: true });
}