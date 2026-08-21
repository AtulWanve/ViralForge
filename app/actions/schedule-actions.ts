"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import { Platform, PLATFORMS } from "@/types/database"
import { resolveToUtc } from "@/lib/time"

export async function schedulePost(prevState: unknown, formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Unauthorized")

  const assetId = formData.get("assetId") as string
  const projectId = formData.get("projectId") as string
  const platform = formData.get("platform") as string
  const localDatetime = formData.get("localDatetime") as string
  const timezone = (formData.get("timezone") as string) || "UTC"

  if (!assetId || !projectId || !platform || !localDatetime) {
    return { error: "Missing required fields" }
  }

  // Fix 9: runtime-validate platform before any DB work
  if (!(PLATFORMS as readonly string[]).includes(platform)) {
    return { error: "Invalid platform" }
  }

  const { data: project } = await supabase
    .from("projects")
    .select("user_id")
    .eq("id", projectId)
    .eq("user_id", user.id)
    .maybeSingle()

  if (!project) return { error: "Project not found" }

  // Fix 1: verify asset belongs to this project (prevents IDOR)
  const { data: asset } = await supabase
    .from("generated_assets")
    .select("id, status, media_url")
    .eq("id", assetId)
    .eq("project_id", projectId)
    .maybeSingle()

  if (!asset) return { error: "Asset not found" }
  if (asset.status !== "ready" || !asset.media_url) {
    return { error: "Asset is not ready to be scheduled" }
  }

  const utc = resolveToUtc(localDatetime, timezone)
  if (!utc) return { error: "Invalid date/time for timezone " + timezone }

  if (new Date(utc).getTime() < Date.now()) {
    return { error: "Scheduled time must be in the future" }
  }

  const { error } = await supabase
    .from("scheduled_posts")
    .insert({
      project_id: projectId,
      asset_id: assetId,
      platform: platform as Platform,
      scheduled_for: utc,
      timezone,
      status: "scheduled",
    })

  if (error) return { error: error.message }

  revalidatePath("/dashboard/calendar")
  return { success: true }
}
