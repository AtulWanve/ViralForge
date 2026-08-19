import { inngest } from "@/lib/inngest/client";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

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

  // Update idea status
  const { data: idea, error } = await supabase
    .from("content_ideas")
    .update({ status: 'approved' })
    .eq('id', ideaId)
    .select()
    .single();

  if (error || !idea) {
    return NextResponse.json({ error: "Failed to update idea" }, { status: 500 });
  }

  // Trigger media generation
  await inngest.send({
    name: "viralforge/media.generate",
    data: {
      ideaId,
      projectId: idea.project_id
    }
  });

  return NextResponse.json({ success: true });
}
