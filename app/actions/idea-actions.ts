'use server'

import { requireAuth } from '@/lib/auth'
import { inngest } from '@/lib/inngest/client'
import { revalidatePath } from 'next/cache'

export async function generateIdeasAction(projectId: string) {
  const { supabase, user } = await requireAuth()

  // Verify ownership
  const { data: project } = await supabase
    .from('projects')
    .select('id')
    .eq('id', projectId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!project) throw new Error('Project not found')

  // Trigger idea generation
  await inngest.send({
    name: 'app/generate-ideas',
    data: {
      projectId
    }
  })

  revalidatePath(`/dashboard/projects/${projectId}`)
  revalidatePath(`/dashboard/projects/${projectId}/generate`)
}

