'use client'

import { Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { deleteProject } from '@/app/actions/project-actions'

export function ProjectDeleteButton({ projectId }: { projectId: string }) {
  const handleDelete = (e: React.FormEvent<HTMLFormElement>) => {
    e.stopPropagation() // Prevent navigating to the project page
    if (!window.confirm('Are you sure you want to delete this project? This action cannot be undone.')) {
      e.preventDefault() // Stop the form submission
    }
  }

  return (
    <form
      action={deleteProject.bind(null, projectId)}
      onSubmit={handleDelete}
      onClick={(e) => e.stopPropagation()}
    >
      <Button
        variant="ghost"
        size="icon"
        type="submit"
        aria-label="Delete project"
        className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </form>
  )
}
