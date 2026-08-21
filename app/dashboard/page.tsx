import { createClient } from "@/lib/supabase/server"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ProjectDeleteButton } from "@/components/projects/ProjectDeleteButton"

export default async function DashboardPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return null // Layout handles redirect
  }

  // We'll ignore errors for the empty state before DB is fully ready
  const { data: projects, error } = await supabase
    .from("projects")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })

  if (error) {
    console.error("Dashboard projects fetch error:", error)
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Your Projects</h2>
        <p className="text-muted-foreground">Manage your content generation workspaces.</p>
      </div>

      {error ? (
        <Card className="border-destructive/50 bg-destructive/10">
          <CardContent className="p-6 text-destructive">
            <h3 className="text-lg font-semibold mb-2">Failed to load projects</h3>
            <p className="text-sm">An unexpected error occurred while loading your projects. Please try again later.</p>
          </CardContent>
        </Card>
      ) : !projects || projects.length === 0 ? (
        <Card className="border-dashed bg-gray-50/50 dark:bg-gray-800/50">
          <CardContent className="flex flex-col items-center justify-center p-12 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary"><path d="M5 12h14"/><path d="M12 5v14"/></svg>
            </div>
            <h3 className="text-lg font-semibold mb-2">No projects yet</h3>
            <p className="text-sm text-muted-foreground max-w-sm mb-6">
              Create a project to start analyzing viral references and generating your own content.
            </p>
            <Button asChild className="h-10 px-4 py-2">
              <Link
                href="/dashboard/projects/new"
                prefetch={false}
              >
                Create First Project
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <div key={project.id} className="relative group block h-full">
              <div className="absolute top-4 right-4 z-10">
                <ProjectDeleteButton projectId={project.id} />
              </div>
              <Link href={`/dashboard/projects/${project.id}`} prefetch={false} className="block h-full">
                <Card className="hover:border-primary/50 transition-colors cursor-pointer h-full relative">
                  <CardHeader className="pr-12">
                    <CardTitle className="truncate">{project.name}</CardTitle>
                    <CardDescription className="line-clamp-2">
                      {project.description || "No description provided."}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between text-sm text-muted-foreground mt-auto">
                      <span className="capitalize">{project.target_platform}</span>
                      <span>{new Date(project.created_at).toLocaleDateString()}</span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
