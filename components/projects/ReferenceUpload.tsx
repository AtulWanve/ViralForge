'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'
import { createUrlReference, createImageReference } from '@/app/actions/reference-actions'
import { Platform } from '@/types/database'
import { useRouter } from 'next/navigation'

interface ReferenceUploadProps {
  projectId: string
}

export function ReferenceUpload({ projectId }: ReferenceUploadProps) {
  const [isUploading, setIsUploading] = useState(false)
  const [uploadMode, setUploadMode] = useState<'url' | 'image'>('url')
  const [error, setError] = useState<string | null>(null)

  // State for form values
  const [url, setUrl] = useState('')
  const [platform, setPlatform] = useState<Platform>('instagram')
  const [caption, setCaption] = useState('')
  // We can't easily control file input state, so we use a key to reset it
  const [fileInputKey, setFileInputKey] = useState(Date.now())

  const router = useRouter()

  const handleUrlSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsUploading(true)
    setError(null)

    try {
      await createUrlReference(projectId, url, platform)

      // reset form
      setUrl('')
      setPlatform('instagram')
    } catch (err: unknown) {
      setError(err instanceof Error && err.message ? err.message : 'Failed to add reference')
    } finally {
      setIsUploading(false)
    }
  }

  const handleImageSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsUploading(true)
    setError(null)

    const formData = new FormData(e.currentTarget)
    const file = formData.get('file') as File

    if (!file || file.size === 0) {
      setError('Please select an image')
      setIsUploading(false)
      return
    }

    try {
      const supabase = createClient()

      // Upload to storage
      const fileExt = file.name.split('.').pop()
      const fileName = `${Math.random().toString(36).substring(2, 15)}_${Date.now()}.${fileExt}`
      const filePath = `${projectId}/${fileName}`

      const { error: uploadError, data } = await supabase.storage
        .from('references')
        .upload(filePath, file)

      if (uploadError) throw uploadError

      // Save to database
      try {
        await createImageReference(projectId, filePath, caption)
      } catch (dbErr) {
        // Cleanup uploaded file on DB failure
        await supabase.storage.from('references').remove([filePath])
        throw dbErr
      }

      setCaption('')
      setFileInputKey(Date.now())
    } catch (err: unknown) {
      console.error(err)
      setError(err instanceof Error && err.message ? err.message : 'Failed to upload image')
    } finally {
      setIsUploading(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2 mb-4 border-b pb-2">
        <button 
          className={`text-sm font-medium pb-2 -mb-2 border-b-2 ${uploadMode === 'url' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground'}`}
          onClick={() => setUploadMode('url')}
        >
          Paste URL
        </button>
        <button 
          className={`text-sm font-medium pb-2 -mb-2 border-b-2 ${uploadMode === 'image' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground'}`}
          onClick={() => setUploadMode('image')}
        >
          Upload Image
        </button>
      </div>
      
      {error && (
        <div className="bg-destructive/10 text-destructive p-3 rounded text-sm">
          {error}
        </div>
      )}

      {uploadMode === 'url' ? (
        <form onSubmit={handleUrlSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Post URL</label>
            <input
              type="url"
              name="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              required
              placeholder="https://instagram.com/p/..."
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Platform</label>
            <select
              name="platform"
              value={platform}
              onChange={(e) => setPlatform(e.target.value as Platform)}
              required
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <option value="instagram">Instagram</option>
              <option value="tiktok">TikTok</option>
              <option value="linkedin">LinkedIn</option>
              <option value="x">X (Twitter)</option>
            </select>
          </div>
          <Button type="submit" disabled={isUploading} className="w-full">
            {isUploading ? 'Adding...' : 'Add URL Reference'}
          </Button>
        </form>
      ) : (
        <form onSubmit={handleImageSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Upload Image</label>
            <input
              key={fileInputKey}
              type="file"
              name="file"
              accept="image/*"
              required
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Caption (Optional)</label>
            <textarea
              name="caption"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              rows={3}
              placeholder="Paste the caption from the original post..."
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>
          <Button type="submit" disabled={isUploading} className="w-full">
            {isUploading ? 'Uploading...' : 'Upload Reference'}
          </Button>
        </form>
      )}
    </div>
  )
}
