import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { Project, Reference, ContentProfile } from '@/types/database'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ReferenceUpload } from '@/components/projects/ReferenceUpload'
import Image from 'next/image'
import { AnalyzeButton } from './AnalyzeButton'
import { ProjectActions } from '@/components/projects/ProjectActions'
import { ReferenceActions } from '@/components/projects/ReferenceActions'
import { ProfileEditor } from '@/components/projects/ProfileEditor'

// Helper to get public URL or signed URL for images
async function getImageUrl(supabase: any, path: string | null) {
  if (!path) return null;
  // If it's a full URL, return it
  if (path.startsWith('http')) return path;

  // Create signed URL for private bucket
  const { data } = await supabase.storage
    .from('references')
    .createSignedUrl(path, 3600); // 1 hour expiry

  return data?.signedUrl || null;
}

interface ProjectPageProps {
  params: Promise<{ id: string }>
}

export default async function ProjectPage({ params }: ProjectPageProps) {
  const resolvedParams = await params;
  const projectId = resolvedParams.id;
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return <div>Not authenticated</div>
  }

  // Fetch project, references and profile concurrently
  const [
    { data: project, error: projectError },
    { data: references, error: referencesError },
    { data: profile, error: profileError }
  ] = await Promise.all([
    supabase
      .from('projects')
      .select('*')
      .eq('id', projectId)
      .eq('user_id', user.id)
      .maybeSingle(),
    supabase
      .from('references_table')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false }),
    supabase
      .from('content_profiles')
      .select('*')
      .eq('project_id', projectId)
      .maybeSingle()
  ])

  if (projectError) {
    throw new Error('Failed to fetch project')
  }

  if (!project) {
    notFound()
  }

  if (referencesError) {
    throw new Error('Failed to fetch references')
  }

  if (profileError) {
    throw new Error('Failed to fetch content profile')
  }

  // Cast project to type to ensure it matches
  const typedProject = project as Project
  let typedReferences = (references || []) as Reference[]
  const typedProfile = profile as ContentProfile | null

  // Fetch signed URLs for references that use storage paths
  typedReferences = await Promise.all(
    typedReferences.map(async (ref) => ({
      ...ref,
      display_url: await getImageUrl(supabase, ref.media_url)
    }))
  )


  return (
    <div className="space-y-6 w-full max-w-full overflow-x-hidden">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 w-full">
        <div className="min-w-0">
          <h1 className="text-3xl font-bold tracking-tight break-words">{typedProject.name}</h1>
          <p className="text-muted-foreground mt-1">
            Platform: <span className="capitalize font-medium">{typedProject.target_platform}</span>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <ProjectActions project={typedProject} />
          <Button variant="outline">
            <Link href="/dashboard" prefetch={false}>Back to Projects</Link>
          </Button>

          <AnalyzeButton
            projectId={typedProject.id}
            disabled={typedReferences.length === 0}
            label={`Analyze ${typedReferences.length} References`}
            initialStatus={typedProject.analysis_status}
          />


        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 w-full max-w-full">
        <div className="space-y-6 w-full max-w-full min-w-0">
          <div className="bg-card rounded-lg border p-6">
            <h3 className="font-semibold text-lg mb-2">Details</h3>
            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Description</p>
                <p className="mt-1">{typedProject.description || 'No description provided.'}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Brand Voice</p>
                <p className="mt-1">{typedProject.brand_voice || 'No brand voice specified.'}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-card rounded-lg border p-6">
            <h3 className="font-semibold text-lg mb-4">Add Reference</h3>
            <ReferenceUpload projectId={typedProject.id} />
          </div>

          {typedProfile && (
            <div className="bg-card rounded-lg border p-6 w-full max-w-full">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
                <h3 className="font-semibold text-lg">Content Profile</h3>
                <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                  <ProfileEditor profile={typedProfile} projectId={typedProject.id} />
                  <Button variant="default" size="sm" className="whitespace-nowrap">
                    <Link href={`/dashboard/projects/${typedProject.id}/generate`}>Generate Content</Link>
                  </Button>
                </div>
              </div>
              <div className="space-y-4">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Visual Style</p>
                  <p className="mt-1 text-sm">{typedProfile.visual_style}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Caption Structure</p>
                  <p className="mt-1 text-sm">{typedProfile.caption_structure}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Format Mix</p>
                  <p className="mt-1 text-sm">{typedProfile.format_mix}</p>
                </div>
                {typedProfile.hooks && typedProfile.hooks.length > 0 && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-1">Common Hooks</p>
                    <ul className="list-disc pl-5 text-sm space-y-1">
                      {typedProfile.hooks.map((hook, i) => (
                        <li key={i}>{hook}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {typedProfile.content_pillars && typedProfile.content_pillars.length > 0 && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-1">Content Pillars</p>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {typedProfile.content_pillars.map((pillar, i) => (
                        <span key={i} className="bg-secondary text-secondary-foreground text-xs px-2 py-1 rounded-md">
                          {pillar}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="bg-card rounded-lg border p-6 w-full max-w-full min-w-0">
          <h3 className="font-semibold text-lg mb-4">References ({typedReferences.length})</h3>
          
          {typedReferences.length === 0 ? (
            <div className="rounded-md border border-dashed p-8 text-center bg-muted/20">
              <p className="text-sm text-muted-foreground">No references added yet.</p>
              <p className="text-xs text-muted-foreground mt-1">Upload images or paste URLs to start modeling.</p>
            </div>
          ) : (
            <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2 w-full">
              {typedReferences.map((ref: any) => (
                <div key={ref.id} className="border rounded-md p-4 flex gap-4 w-full max-w-full min-w-0">
                  {ref.display_url ? (
                    <div className="relative w-24 h-24 flex-shrink-0 bg-muted rounded-md overflow-hidden">
                      <Image
                        src={ref.display_url}
                        alt="Reference image"
                        fill
                        sizes="96px"
                        className="object-cover"
                      />
                    </div>
                  ) : (
                    <div className="w-24 h-24 flex-shrink-0 bg-muted rounded-md flex items-center justify-center text-xs text-muted-foreground">
                      No Image
                    </div>
                  )}
                  
                  <div className="flex-1 min-w-0 overflow-hidden">
                    {ref.platform && (
                      <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold capitalize bg-primary/10 text-primary border-transparent mb-2">
                        {ref.platform}
                      </span>
                    )}
                    
                    {ref.url && (
                      <p className="text-sm font-medium truncate mb-1 overflow-hidden">
                        <a href={ref.url} target="_blank" rel="noreferrer" className="text-primary hover:underline truncate">
                          {ref.url}
                        </a>
                      </p>
                    )}
                    
                    {ref.caption && (
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {ref.caption}
                      </p>
                    )}
                    <ReferenceActions reference={ref} projectId={typedProject.id} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
