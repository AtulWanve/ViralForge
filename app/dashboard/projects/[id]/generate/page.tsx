import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { Project, ContentIdea, ContentProfile } from '@/types/database'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { IdeaList } from './IdeaList'
import { GenerateIdeasButton } from './GenerateIdeasButton'

interface GeneratePageProps {
  params: Promise<{ id: string }>
}

export default async function GeneratePage({ params }: GeneratePageProps) {
  const resolvedParams = await params;
  const projectId = resolvedParams.id;
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return <div>Not authenticated</div>
  }

  // Fetch project
  const { data: project, error: projectError } = await supabase
    .from('projects')
    .select('*')
    .eq('id', projectId)
    .single()

  if (projectError) {
    if (projectError.code === 'PGRST116') notFound()
    throw projectError
  }

  // Fetch ideas
  const { data: ideas, error: ideasError } = await supabase
    .from('content_ideas')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })

  if (ideasError) throw ideasError

  // Fetch profile to check if they can generate
  const { data: profile, error: profileError } = await supabase
    .from('content_profiles')
    .select('*')
    .eq('project_id', projectId)
    .maybeSingle()

  if (profileError) throw profileError

  const typedProject = project as Project
  const typedIdeas = (ideas || []) as ContentIdea[]
  const typedProfile = profile as ContentProfile | null

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Generate Content</h1>
          <p className="text-muted-foreground mt-1">
            Project: <Link href={`/dashboard/projects/${projectId}`} className="text-primary hover:underline">{typedProject.name}</Link>
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href={`/dashboard/projects/${projectId}`}>Back</Link>
          </Button>
          <GenerateIdeasButton 
            projectId={projectId} 
            disabled={!typedProfile} 
          />
        </div>
      </div>

      {!typedProfile && (
        <div className="bg-destructive/10 text-destructive p-4 rounded-md">
          You need to analyze references to create a Content Profile before generating ideas.
          <div className="mt-4">
            <Button variant="outline" asChild>
              <Link href={`/dashboard/projects/${projectId}`}>Go to Project</Link>
            </Button>
          </div>
        </div>
      )}

      {typedProfile && (
        <div className="bg-card rounded-lg border p-6">
          <h3 className="font-semibold text-lg mb-4">Content Ideas</h3>
          
          {typedIdeas.length === 0 ? (
            <div className="rounded-md border border-dashed p-12 text-center bg-muted/20">
              <h3 className="text-lg font-semibold mb-2">No ideas generated yet</h3>
              <p className="text-muted-foreground mb-4">
                Click "Generate New Ideas" to let AI create concepts based on your content profile.
              </p>
              <GenerateIdeasButton projectId={projectId} />
            </div>
          ) : (
            <IdeaList ideas={typedIdeas} />
          )}
        </div>
      )}
    </div>
  )
}
