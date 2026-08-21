'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Edit, Trash2 } from 'lucide-react'
import { deleteProject, updateProject } from '@/app/actions/project-actions'
import { Platform, Project } from '@/types/database'
import { toast } from 'sonner'

export function ProjectActions({ project }: { project: Project }) {
  const [isEditing, setIsEditing] = useState(false)

  const handleUpdate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    try {
      await updateProject(project.id, formData)
      setIsEditing(false)
    } catch (err) {
      console.error(err)
      toast.error('Failed to update project')
    }
  }

  if (isEditing) {
    return (
      <form onSubmit={handleUpdate} className="bg-card rounded-lg border p-6 space-y-4 mb-6">
        <h3 className="font-semibold">Edit Project</h3>
        <div>
          <label className="text-sm font-medium">Name</label>
          <input name="name" defaultValue={project.name} required className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="text-sm font-medium">Description</label>
          <textarea name="description" defaultValue={project.description || ''} className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="text-sm font-medium">Brand Voice</label>
          <textarea name="brand_voice" defaultValue={project.brand_voice || ''} className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="text-sm font-medium">Platform</label>
          <select name="target_platform" defaultValue={project.target_platform} required className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
            <option value="instagram">Instagram</option>
            <option value="tiktok">TikTok</option>
            <option value="linkedin">LinkedIn</option>
            <option value="x">X (Twitter)</option>
          </select>
        </div>
        <div className="flex gap-2 justify-end">
          <Button type="button" variant="ghost" onClick={() => setIsEditing(false)}>Cancel</Button>
          <Button type="submit">Save</Button>
        </div>
      </form>
    )
  }

  return (
    <div className="flex gap-2">
      <Button variant="outline" size="icon" aria-label="Edit project" onClick={() => setIsEditing(true)}>
        <Edit className="h-4 w-4" />
      </Button>
      <form action={deleteProject.bind(null, project.id)} onSubmit={(e) => {
        if (!window.confirm('Are you sure you want to delete this project? This action cannot be undone.')) {
          e.preventDefault()
        }
      }}>
        <Button variant="destructive" size="icon" type="submit" aria-label="Delete project">
          <Trash2 className="h-4 w-4" />
        </Button>
      </form>
    </div>
  )
}
