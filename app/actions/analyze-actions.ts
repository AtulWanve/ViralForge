'use server'

import { createClient } from '@/lib/supabase/server'
import { inngest } from '@/lib/inngest/client'
import { revalidatePath } from 'next/cache'
import { Reference, Project } from '@/types/database'

export async function checkAnalysisStatusAction(projectId: string) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      console.error('Auth error in checkAnalysisStatusAction:', authError)
      return 'unknown' as const
    }

    const { data, error } = await supabase
      .from('projects')
      .select('analysis_status, current_generation, updated_at')
      .eq('id', projectId)
      .eq('user_id', user.id)
      .maybeSingle()

    if (error) {
      console.error('Database error in checkAnalysisStatusAction:', error)
      return 'unknown' as const
    }

    if (!data) {
      console.warn('Project not found in checkAnalysisStatusAction:', projectId)
      return 'idle' as const
    }

    // If status is analyzing but updated_at is more than 10 minutes old, reset to error
    if (data.analysis_status === 'analyzing') {
      const updatedAt = new Date(data.updated_at)
      const now = new Date()
      const diffMinutes = (now.getTime() - updatedAt.getTime()) / 1000 / 60

      if (diffMinutes > 10) {
        // Auto-reset stuck analyzing status
        const staleCutoff = new Date(now.getTime() - 10 * 60 * 1000).toISOString()
        
        const { data: resetData, error: statusResetError } = await supabase
          .from('projects')
          .update({ analysis_status: 'error' })
          .eq('id', projectId)
          .eq('user_id', user.id)
          .eq('current_generation', data.current_generation)
          .eq('analysis_status', 'analyzing')
          .lt('updated_at', staleCutoff)
          .select('analysis_status')

        if (statusResetError) {
          console.error('Failed to reset stuck analyzing status:', statusResetError)
        }

        // If the update errored or matched no rows, re-read the current status
        // (it may have been completed concurrently) and return that when available.
        if (statusResetError || !resetData || resetData.length === 0) {
          const { data: refreshedProject, error: refreshError } = await supabase
            .from('projects')
            .select('analysis_status')
            .eq('id', projectId)
            .eq('user_id', user.id)
            .maybeSingle()

          if (!refreshError && refreshedProject?.analysis_status) {
            return refreshedProject.analysis_status as 'idle' | 'analyzing' | 'completed' | 'error'
          }

          // Could not confirm a new status; preserve the last known analyzing state
          return (data.analysis_status || 'analyzing') as 'idle' | 'analyzing' | 'completed' | 'error'
        }

        return 'error' as const
      }
    }

    return (data.analysis_status || 'idle') as 'idle' | 'analyzing' | 'completed' | 'error'
  } catch (err) {
    console.error('Unexpected error in checkAnalysisStatusAction:', err)
    return 'unknown' as const
  }
}

export async function analyzeProjectAction(projectId: string) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) throw new Error('Unauthorized')

  const [projectRes, referencesRes] = await Promise.all([
    supabase.from('projects').select('*').eq('id', projectId).eq('user_id', user.id).maybeSingle(),
    supabase.from('references_table').select('*').eq('project_id', projectId)
  ])

  if (projectRes.error || !projectRes.data) throw new Error(projectRes.error?.message || 'Project not found or unauthorized')
  if (referencesRes.error) throw new Error(referencesRes.error.message)

  const references = referencesRes.data as Reference[]

  if (!references || references.length === 0) return { status: 'skipped', reason: 'no references' }

  const generationId = Date.now()

  // Calculate stale cutoff: 10 minutes ago
  const staleCutoff = new Date(Date.now() - 10 * 60 * 1000).toISOString()

  const { data: updatedRows, error: updateError } = await supabase
    .from('projects')
    .update({
      analysis_status: 'analyzing',
      current_generation: generationId
    })
    .eq('id', projectId)
    .eq('user_id', user.id)
    .or(`analysis_status.neq.analyzing,analysis_status.is.null,and(analysis_status.eq.analyzing,updated_at.lt."${staleCutoff}")`)
    .select()

  if (updateError) {
    throw new Error('Failed to update project status: ' + updateError.message)
  }

  if (!updatedRows || updatedRows.length === 0) {
    // Re-read project status to check if it was just completed by another process
    const { data: currentProject } = await supabase
      .from('projects')
      .select('analysis_status')
      .eq('id', projectId)
      .eq('user_id', user.id)
      .maybeSingle()

    if (currentProject?.analysis_status === 'completed') {
      return { success: false, status: 'skipped', reason: 'analysis already completed' }
    }

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
      .eq('user_id', user.id)
      .eq('current_generation', generationId)

    throw new Error('Failed to queue analysis')
  }

  revalidatePath(`/dashboard/projects/${projectId}`)
  return { success: true, status: 'queued' }
}
