import { createClient } from "@/lib/supabase/server"

export async function requireAuth() {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) throw new Error("Not authenticated")
  return { supabase, user }
}
