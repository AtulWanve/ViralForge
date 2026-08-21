'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Edit, Trash2 } from 'lucide-react'
import { deleteReference, updateReference } from '@/app/actions/reference-actions'
import { Reference } from '@/types/database'
import { toast } from 'sonner'

export function ReferenceActions({ reference, projectId }: { reference: Reference, projectId: string }) {
  const [isEditing, setIsEditing] = useState(false)

  const handleUpdate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    try {
      await updateReference(reference.id, projectId, formData)
      setIsEditing(false)
    } catch (error) {
      toast.error('Failed to update reference')
      console.error(error)
    }
  }

  if (isEditing) {
    return (
      <form onSubmit={handleUpdate} className="flex flex-col gap-2 w-full">
        <input name="url" defaultValue={reference.url || ''} placeholder="URL" className="flex h-8 w-full rounded-md border border-input bg-background px-3 text-xs" />
        <textarea name="caption" defaultValue={reference.caption || ''} placeholder="Caption" className="flex min-h-16 w-full rounded-md border border-input bg-background px-3 py-2 text-xs" />
        <input name="media_url" defaultValue={reference.media_url || ''} placeholder="Media URL (Image Link)" className="flex h-8 w-full rounded-md border border-input bg-background px-3 text-xs" />
        <select name="platform" defaultValue={reference.platform || ''} className="flex h-8 w-full rounded-md border border-input bg-background px-3 text-xs">
          <option value="">No Platform</option>
          <option value="instagram">Instagram</option>
          <option value="tiktok">TikTok</option>
          <option value="linkedin">LinkedIn</option>
          <option value="x">X</option>
        </select>
        <div className="flex gap-2 justify-end mt-2">
          <Button type="button" variant="ghost" size="sm" onClick={() => setIsEditing(false)}>Cancel</Button>
          <Button type="submit" size="sm">Save</Button>
        </div>
      </form>
    )
  }

  return (
    <div className="flex gap-1 justify-end opacity-50 hover:opacity-100 transition-opacity mt-2">
      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setIsEditing(true)}>
        <Edit className="h-3 w-3" />
        <span className="sr-only">Edit reference</span>
      </Button>
      <form action={() => deleteReference(reference.id, projectId)} onSubmit={(e) => {
        if (!window.confirm('Are you sure you want to delete this reference?')) {
          e.preventDefault()
        }
      }}>
        <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:bg-destructive/10 hover:text-destructive" type="submit">
          <Trash2 className="h-3 w-3" />
          <span className="sr-only">Delete reference</span>
        </Button>
      </form>
    </div>
  )
}
