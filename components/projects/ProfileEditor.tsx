'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Edit } from 'lucide-react'
import { updateProfile } from '@/app/actions/project-actions'
import { ContentProfile } from '@/types/database'
import { toast } from 'sonner'

interface ProfileEditorProps {
  profile: ContentProfile
  projectId: string
}

export function ProfileEditor({ profile, projectId }: ProfileEditorProps) {
  const [isEditing, setIsEditing] = useState(false)

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    try {
      await updateProfile(projectId, formData)
      setIsEditing(false)
      toast.success('Profile updated')
    } catch (err) {
      console.error(err)
      toast.error('Failed to update profile')
    }
  }

  if (!isEditing) {
    return (
      <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
        <Edit className="h-4 w-4 mr-1" /> Edit Profile
      </Button>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 w-full">
      <div>
        <label htmlFor="visual_style" className="text-sm font-medium">Visual Style</label>
        <textarea
          name="visual_style"
          id="visual_style"
          defaultValue={profile.visual_style}
          rows={2}
          className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm mt-1"
        />
      </div>
      <div>
        <label htmlFor="hooks" className="text-sm font-medium">Hooks</label>
        <textarea
          name="hooks"
          id="hooks"
          defaultValue={JSON.stringify(profile.hooks)}
          rows={2}
          className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm mt-1"
        />
        <p className="text-xs text-muted-foreground mt-1">JSON array, e.g. ["Wait until the end..."]</p>
      </div>
      <div>
        <label htmlFor="caption_structure" className="text-sm font-medium">Caption Structure</label>
        <textarea
          name="caption_structure"
          id="caption_structure"
          defaultValue={profile.caption_structure}
          rows={2}
          className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm mt-1"
        />
      </div>
      <div>
        <label htmlFor="format_mix" className="text-sm font-medium">Format Mix</label>
        <textarea
          name="format_mix"
          id="format_mix"
          defaultValue={profile.format_mix}
          rows={2}
          className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm mt-1"
        />
      </div>
      <div>
        <label htmlFor="content_pillars" className="text-sm font-medium">Content Pillars</label>
        <textarea
          name="content_pillars"
          id="content_pillars"
          defaultValue={JSON.stringify(profile.content_pillars)}
          rows={2}
          className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm mt-1"
        />
        <p className="text-xs text-muted-foreground mt-1">JSON array, e.g. ["Desk setups"]</p>
      </div>
      <div className="flex gap-2 justify-end">
        <Button type="button" variant="ghost" size="sm" onClick={() => setIsEditing(false)}>Cancel</Button>
        <Button type="submit" size="sm">Save</Button>
      </div>
    </form>
  )
}
