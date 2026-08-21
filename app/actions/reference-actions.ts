'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { Platform } from '@/types/database'

export async function deleteReference(referenceId: string, projectId: string) {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) throw new Error('Not authenticated')

  // Verify project ownership
  const { data: project } = await supabase
    .from('projects')
    .select('id')
    .eq('id', projectId)
    .eq('user_id', user.id)
    .single()

  if (!project) throw new Error('Unauthorized')

  // RLS will ensure user owns the project
  const { data, error } = await supabase
    .from('references_table')
    .delete()
    .eq('id', referenceId)
    .eq('project_id', projectId)
    .select('id')

  if (error) throw new Error('Failed to delete reference')
  if (!data || data.length === 0) throw new Error('Reference not found')

  revalidatePath(`/dashboard/projects/${projectId}`)
}

export async function updateReference(referenceId: string, projectId: string, formData: FormData) {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) throw new Error('Not authenticated')

  // Verify project ownership
  const { data: project } = await supabase
    .from('projects')
    .select('id')
    .eq('id', projectId)
    .eq('user_id', user.id)
    .single()

  if (!project) throw new Error('Unauthorized')

  const url = formData.get('url') as string
  const caption = formData.get('caption') as string
  const platform = formData.get('platform') as Platform
  const media_url = formData.get('media_url') as string

  // RLS will ensure user owns the project
  const { data, error } = await supabase
    .from('references_table')
    .update({
      url: url || null,
      caption: caption || null,
      platform: platform || null,
      media_url: media_url || null,
    })
    .eq('id', referenceId)
    .eq('project_id', projectId)
    .select('id')

  if (error) throw new Error('Failed to update reference')
  if (!data || data.length === 0) throw new Error('Reference not found')

  revalidatePath(`/dashboard/projects/${projectId}`)
}

export async function createUrlReference(projectId: string, url: string, platform: Platform) {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) throw new Error('Not authenticated')

  // Verify project ownership
  const { data: project } = await supabase
    .from('projects')
    .select('id')
    .eq('id', projectId)
    .eq('user_id', user.id)
    .single()

  if (!project) throw new Error('Unauthorized')

  const { error } = await supabase
    .from('references_table')
    .insert({
      project_id: projectId,
      url,
      platform
    })

  if (error) throw new Error('Failed to create reference')

  revalidatePath(`/dashboard/projects/${projectId}`)
}

export async function createImageReference(projectId: string, media_url: string, caption: string) {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) throw new Error('Not authenticated')

  // Verify project ownership
  const { data: project } = await supabase
    .from('projects')
    .select('id')
    .eq('id', projectId)
    .eq('user_id', user.id)
    .single()

  if (!project) throw new Error('Unauthorized')

  const { error } = await supabase
    .from('references_table')
    .insert({
      project_id: projectId,
      media_url,
      caption
    })

  if (error) throw new Error('Failed to create reference')

  revalidatePath(`/dashboard/projects/${projectId}`)
}
