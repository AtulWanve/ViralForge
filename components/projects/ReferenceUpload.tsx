'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'
import { Platform } from '@/types/database'
import { useRouter } from 'next/navigation'

interface ReferenceUploadProps {
  projectId: string
}

export function ReferenceUpload({ projectId }: ReferenceUploadProps) {
  const [isUploading, setIsUploading] = useState(false)
  const [uploadMode, setUploadMode] = useState<'url' | 'image'>('url')
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const handleUrlSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsUploading(true)
    setError(null)
    
    const formData = new FormData(e.currentTarget)
    const url = formData.get('url') as string
    const platform = formData.get('platform') as Platform
    
    try {
      const supabase = createClient()
      const { error: dbError } = await supabase
        .from('references_table')
        .insert({
          project_id: projectId,
          url,
          platform
        })
        
      if (dbError) throw dbError
      
      router.refresh()
      // reset form
      ;(e.target as HTMLFormElement).reset()
    } catch (err: any) {
      setError(err.message || 'Failed to add reference')
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
    const caption = formData.get('caption') as string
    
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
      
      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('references')
        .getPublicUrl(filePath)
        
      // Save to database
      const { error: dbError } = await supabase
        .from('references_table')
        .insert({
          project_id: projectId,
          media_url: publicUrl,
          caption
        })
        
      if (dbError) throw dbError
      
      router.refresh()
      ;(e.target as HTMLFormElement).reset()
    } catch (err: any) {
      console.error(err)
      setError(err.message || 'Failed to upload image')
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
              required
              placeholder="https://instagram.com/p/..."
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Platform</label>
            <select 
              name="platform" 
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
