'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { Platform } from '@/types/database'

const ALLOWLISTED_HOSTS: Record<string, Platform> = {
  'instagram.com': 'instagram',
  'www.instagram.com': 'instagram',
  'tiktok.com': 'tiktok',
  'www.tiktok.com': 'tiktok',
  'linkedin.com': 'linkedin',
  'www.linkedin.com': 'linkedin',
  'x.com': 'x',
  'www.x.com': 'x',
  'twitter.com': 'x',
  'www.twitter.com': 'x'
}

function validateMediaUrl(mediaUrl: string) {
  const parsedUrl = (() => {
    try {
      return new URL(mediaUrl)
    } catch {
      throw new Error('Invalid media URL')
    }
  })()

  if (parsedUrl.protocol !== 'https:') {
    throw new Error('Only HTTPS media URLs are allowed')
  }
}

async function assertProjectOwnership(
  supabase: Awaited<ReturnType<typeof createClient>>,
  projectId: string,
  userId: string
) {
  const { data: project, error } = await supabase
    .from('projects')
    .select('id')
    .eq('id', projectId)
    .eq('user_id', userId)
    .maybeSingle()

  if (error) throw new Error('Failed to verify project ownership: ' + error.message)

  if (!project) throw new Error('Unauthorized')
}

function validateReferenceUrl(url: string | null, platform: Platform | null) {
  if (!url) return
  if (!url.startsWith('https://')) {
    throw new Error('Only HTTPS URLs are allowed')
  }
  try {
    const parsedUrl = new URL(url)
    if (!Object.hasOwn(ALLOWLISTED_HOSTS, parsedUrl.hostname)) {
      throw new Error(`Host ${parsedUrl.hostname} is not on the allowlist`)
    }
    const canonical = ALLOWLISTED_HOSTS[parsedUrl.hostname]
    if (platform && canonical !== platform) {
      throw new Error(`Platform ${platform} does not match URL host ${parsedUrl.hostname}`)
    }
  } catch (e) {
    throw new Error(e instanceof Error ? e.message : 'Invalid URL')
  }
}

export async function deleteReference(referenceId: string) {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) throw new Error('Not authenticated')

  // Atomic delete + remaining-reference check + analysis status reset.
  // The RPC resolves the project from the reference and scopes to this user.
  const { data, error } = await supabase.rpc('delete_reference_and_reset_analysis', {
    p_reference_id: referenceId
  })

  if (error) throw new Error('Failed to delete reference: ' + error.message)

  const result = data as { ok: boolean; project_id?: string; error?: string } | null
  if (!result?.ok) {
    if (result?.error === 'unauthorized') throw new Error('Unauthorized')
    throw new Error('Failed to delete reference')
  }

  // The RPC resolves the owning project server-side; trust it over the
  // caller-supplied projectId so the correct page is revalidated.
  if (result.project_id) {
    revalidatePath(`/dashboard/projects/${result.project_id}`)
  }
}

export async function updateReference(referenceId: string, projectId: string, formData: FormData) {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) throw new Error('Not authenticated')

  await assertProjectOwnership(supabase, projectId, user.id)

  const url = formData.get('url') as string
  const caption = formData.get('caption') as string
  const platform = formData.get('platform') as Platform
  const media_url = formData.get('media_url') as string

  if (media_url) validateMediaUrl(media_url)
  validateReferenceUrl(url, platform)

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
    .maybeSingle()

  if (error) throw new Error('Failed to update reference: ' + error.message)
  if (!data) throw new Error('Reference not found for this project')

  revalidatePath(`/dashboard/projects/${projectId}`)
}

export async function createUrlReference(projectId: string, url: string, platform: Platform) {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) throw new Error('Not authenticated')

  validateReferenceUrl(url, platform)

  await assertProjectOwnership(supabase, projectId, user.id)

  // Mock Scraper Attempt
  // Wait a couple of seconds to simulate scraping
  await new Promise(resolve => setTimeout(resolve, 2000))

  const mockCaptions = [
    "Here's how I scaled my startup to $10k MRR in 30 days! 🚀 #startup #saas",
    "3 mind-blowing AI tools you need to try today 🤯👇",
    "Stop doing your marketing like it's 2010. Do this instead...",
    "A day in the life of a software engineer working from home ☕️💻",
    "The secret to viral content? It's simpler than you think."
  ]
  const mockImages = [
    "https://images.unsplash.com/photo-1555421689-491a97ff2040?w=500&q=80",
    "https://images.unsplash.com/photo-1432888498266-38ffec3eaf0a?w=500&q=80",
    "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=500&q=80"
  ]

  const scrapedCaption = mockCaptions[Math.floor(Math.random() * mockCaptions.length)]
  const scrapedMediaUrl = mockImages[Math.floor(Math.random() * mockImages.length)]

  const { error } = await supabase
    .from('references_table')
    .insert({
      project_id: projectId,
      url,
      platform,
      caption: scrapedCaption,
      media_url: scrapedMediaUrl
    })

  if (error) throw new Error('Failed to create reference: ' + error.message)

  revalidatePath(`/dashboard/projects/${projectId}`)
}

export async function createImageReference(projectId: string, media_url: string, caption: string) {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) throw new Error('Not authenticated')

  validateMediaUrl(media_url)

  await assertProjectOwnership(supabase, projectId, user.id)

  const { error } = await supabase
    .from('references_table')
    .insert({
      project_id: projectId,
      media_url,
      caption
    })

  if (error) throw new Error('Failed to create reference: ' + error.message)

  revalidatePath(`/dashboard/projects/${projectId}`)
}
