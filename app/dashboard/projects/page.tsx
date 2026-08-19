import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Project } from '@/types/database'

export default async function ProjectsPage() {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    return <div>Not authenticated</div>
  }

  const { data: projects, error } = await supabase
    .from('projects')
    .select('*')
    .order('created_at', { ascending: false })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Projects</h1>
        <Button asChild>
          <Link href="/dashboard/projects/new">New Project</Link>
        </Button>
      </div>

      {error ? (
        <div className="bg-destructive/10 text-destructive p-4 rounded-md">
          Error loading projects: {error.message}
        </div>
      ) : projects?.length === 0 ? (
        <div className="border border-dashed rounded-lg p-12 text-center bg-card">
          <h3 className="text-lg font-semibold mb-2">No projects found</h3>
          <p className="text-muted-foreground mb-4">Get started by creating your first project.</p>
          <Button asChild>
            <Link href="/dashboard/projects/new">Create Project</Link>
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {projects?.map((project: Project) => (
            <Link 
              key={project.id} 
              href={`/dashboard/projects/${project.id}`}
              className="block bg-card rounded-lg border p-6 hover:border-primary transition-colors hover:shadow-sm"
            >
              <h3 className="font-semibold text-lg mb-2 truncate">{project.name}</h3>
              <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
                {project.description || 'No description'}
              </p>
              <div className="flex items-center justify-between mt-auto">
                <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold capitalize bg-primary/10 text-primary border-transparent">
                  {project.target_platform}
                </span>
                <span className="text-xs text-muted-foreground">
                  {new Date(project.created_at).toLocaleDateString()}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
