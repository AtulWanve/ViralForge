'use server'

import { createClient } from '@/lib/supabase/server'
import { inngest } from '@/lib/inngest/client'
import { revalidatePath } from 'next/cache'
import { Reference, Project } from '@/types/database'

export async function checkAnalysisStatusAction(projectId: string) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) throw new Error('Unauthorized')

  const { data, error } = await supabase
    .from('projects')
    .select('analysis_status')
    .eq('id', projectId)
    .eq('user_id', user.id)
    .single()

  if (error || !data) throw new Error(error?.message || 'Project not found')

  return data.analysis_status as 'idle' | 'analyzing' | 'completed' | 'error'
}

export async function analyzeProjectAction(projectId: string) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) throw new Error('Unauthorized')

  const [projectRes, referencesRes] = await Promise.all([
    supabase.from('projects').select('*').eq('id', projectId).eq('user_id', user.id).single(),
    supabase.from('references_table').select('*').eq('project_id', projectId)
  ])

  if (projectRes.error || !projectRes.data) throw new Error(projectRes.error?.message || 'Project not found or unauthorized')
  if (referencesRes.error) throw new Error(referencesRes.error.message)

  const references = referencesRes.data as Reference[]

  if (!references || references.length === 0) return { status: 'skipped', reason: 'no references' }

  const generationId = Date.now()

  const { data: updatedRows, error: updateError } = await supabase
    .from('projects')
    .update({
      analysis_status: 'analyzing',
      current_generation: generationId
    })
    .eq('id', projectId)
    .or('analysis_status.neq.analyzing,analysis_status.is.null')
    .select()

  if (updateError) {
    throw new Error('Failed to update project status: ' + updateError.message)
  }

  if (!updatedRows || updatedRows.length === 0) {
    return { success: false, status: 'skipped', reason: 'already analyzing' }
  }

  try {
    await inngest.send({
      name: 'viralforge/project.analyze',
      data: { projectId, generationId }
    })
  } catch (err) {
    // Attempt to revert status if Inngest fails, but only if the generation still matches
    await supabase
      .from('projects')
      .update({ analysis_status: 'error' })
      .eq('id', projectId)
      .eq('current_generation', generationId)

    throw new Error('Failed to queue analysis')
  }

  revalidatePath(`/dashboard/projects/${projectId}`)
  return { success: true, status: 'queued' }
}
