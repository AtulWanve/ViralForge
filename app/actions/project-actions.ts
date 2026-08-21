'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { Platform, PLATFORMS } from '@/types/database'
import { z } from 'zod'

const ProjectSchema = z.object({
  name: z.string({ invalid_type_error: 'Name must be a string' }).trim().min(1, 'Name is required'),
  description: z.string({ invalid_type_error: 'Description must be a string' }).trim().optional(),
  target_platform: z.enum(PLATFORMS, { invalid_type_error: 'Invalid platform' }),
  brand_voice: z.string({ invalid_type_error: 'Brand voice must be a string' }).trim().optional()
})

function parseProjectFormData(formData: FormData) {
  const parsed = ProjectSchema.safeParse({
    name: formData.get('name'),
    description: formData.get('description') || undefined,
    target_platform: formData.get('target_platform'),
    brand_voice: formData.get('brand_voice') || undefined
  })
  if (!parsed.success) throw new Error(parsed.error.errors[0].message)
  return parsed.data
}

export async function createProject(formData: FormData) {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    throw new Error('Not authenticated')
  }

  const { name, description, target_platform, brand_voice } = parseProjectFormData(formData)

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

  revalidatePath('/dashboard')
  redirect(`/dashboard/projects/${project.id}`)
}

export async function deleteProject(projectId: string) {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) throw new Error('Not authenticated')

  const { data, error } = await supabase
    .from('projects')
    .delete()
    .eq('id', projectId)
    .eq('user_id', user.id)
    .select()

  if (error) throw new Error('Failed to delete project')
  if (!data || data.length !== 1) throw new Error('Project not found')

  revalidatePath('/dashboard')
  redirect('/dashboard')
}

export async function updateProject(projectId: string, formData: FormData) {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) throw new Error('Not authenticated')

  const { name, description, target_platform, brand_voice } = parseProjectFormData(formData)

  const { data, error } = await supabase
    .from('projects')
    .update({
      name,
      description: description || null,
      target_platform,
      brand_voice: brand_voice || null
    })
    .eq('id', projectId)
    .eq('user_id', user.id)
    .select()

  if (error) throw new Error('Failed to update project')
  if (!data || data.length !== 1) throw new Error('Project not found')

  revalidatePath(`/dashboard/projects/${projectId}`)
  revalidatePath('/dashboard')
}
