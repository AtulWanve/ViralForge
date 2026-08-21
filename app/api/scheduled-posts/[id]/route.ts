import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params

  // Verify ownership via project join before deleting
  const { data: post } = await supabase
    .from("scheduled_posts")
    .select("id, project:projects!inner(user_id)")
    .eq("id", id)
    .eq("project.user_id", user.id)
    .maybeSingle()

  if (!post) return NextResponse.json({ error: "Not found" }, { status: 404 })

  // Only scheduled posts are cancellable; publishing/published records must survive
  const { count, error } = await supabase
    .from("scheduled_posts")
    .delete({ count: "exact" })
    .eq("id", id)
    .eq("status", "scheduled")

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (count === 0) return NextResponse.json({ error: "Not found" }, { status: 404 })

  return new NextResponse(null, { status: 204 })
}
