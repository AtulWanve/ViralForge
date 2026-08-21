"use server"

import { createClient } from "@/lib/supabase/server"
import { GeneratedAsset, Project, Platform } from "@/types/database"

export async function getAssets(): Promise<(GeneratedAsset & { projects: Pick<Project, 'name' | 'target_platform'> | null })[]> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Unauthorized")

  const { data, error } = await supabase
    .from("generated_assets")
    .select(`
      *,
      projects!inner (name, target_platform)
    `)
    .eq('projects.user_id', user.id)
    .order('created_at', { ascending: false })

  if (error) throw error

  return data || []
}
