import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { Project, Reference } from '@/types/database'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ReferenceUpload } from '@/components/projects/ReferenceUpload'
import Image from 'next/image'
import { AnalyzeButton } from './AnalyzeButton'

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

  // Fetch project
  const { data: project, error: projectError } = await supabase
    .from('projects')
    .select('*')
    .eq('id', projectId)
    .single()

  if (projectError || !project) {
    notFound()
  }
  
  // Fetch references
  const { data: references } = await supabase
    .from('references_table')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })

  // Cast project to type to ensure it matches
  const typedProject = project as Project
  const typedReferences = (references || []) as Reference[]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{typedProject.name}</h1>
          <p className="text-muted-foreground mt-1">
            Platform: <span className="capitalize font-medium">{typedProject.target_platform}</span>
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href="/dashboard/projects">Back to Projects</Link>
          </Button>

          <AnalyzeButton projectId={typedProject.id} disabled={typedReferences.length === 0} label={`Analyze ${typedReferences.length} References`} />


        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-6">
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
        </div>

        <div className="bg-card rounded-lg border p-6">
          <h3 className="font-semibold text-lg mb-4">References ({typedReferences.length})</h3>
          
          {typedReferences.length === 0 ? (
            <div className="rounded-md border border-dashed p-8 text-center bg-muted/20">
              <p className="text-sm text-muted-foreground">No references added yet.</p>
              <p className="text-xs text-muted-foreground mt-1">Upload images or paste URLs to start modeling.</p>
            </div>
          ) : (
            <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2">
              {typedReferences.map((ref) => (
                <div key={ref.id} className="border rounded-md p-4 flex gap-4">
                  {ref.media_url ? (
                    <div className="relative w-24 h-24 flex-shrink-0 bg-muted rounded-md overflow-hidden">
                      <Image 
                        src={ref.media_url} 
                        alt="Reference image" 
                        fill 
                        className="object-cover" 
                      />
                    </div>
                  ) : (
                    <div className="w-24 h-24 flex-shrink-0 bg-muted rounded-md flex items-center justify-center text-xs text-muted-foreground">
                      No Image
                    </div>
                  )}
                  
                  <div className="flex-1 min-w-0">
                    {ref.platform && (
                      <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold capitalize bg-primary/10 text-primary border-transparent mb-2">
                        {ref.platform}
                      </span>
                    )}
                    
                    {ref.url && (
                      <p className="text-sm font-medium truncate mb-1">
                        <a href={ref.url} target="_blank" rel="noreferrer" className="text-primary hover:underline">
                          {ref.url}
                        </a>
                      </p>
                    )}
                    
                    {ref.caption && (
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {ref.caption}
                      </p>
                    )}
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
