'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { Platform } from '@/types/database'

export async function createProject(formData: FormData) {
  const supabase = await createClient()
  
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    throw new Error('Not authenticated')
  }

  const name = formData.get('name') as string
  const description = formData.get('description') as string
  const target_platform = formData.get('target_platform') as Platform
  const brand_voice = formData.get('brand_voice') as string

  if (!name || !target_platform) {
    throw new Error('Name and Target Platform are required')
  }

  const { data: project, error } = await supabase
    .from('projects')
    .insert({
      user_id: user.id,
      name,
      description: description || null,
      target_platform,
      brand_voice: brand_voice || null
    })
    .select()
    .single()

  if (error) {
    console.error('Error creating project:', error)
    throw new Error('Failed to create project')
  }

  revalidatePath('/dashboard/projects')
  redirect(`/dashboard/projects/${project.id}`)
}
