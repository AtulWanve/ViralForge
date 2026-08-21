'use client'

import { ContentIdea } from '@/types/database'
import { Button } from '@/components/ui/button'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'

interface IdeaListProps {
  ideas: ContentIdea[]
}

export function IdeaList({ ideas }: IdeaListProps) {
  const router = useRouter()
  const [processingId, setProcessingId] = useState<string | null>(null)

  const handleApprove = async (id: string) => {
    setProcessingId(id)
    try {
      const res = await fetch(`/api/ideas/${id}/approve`, {
        method: 'POST'
      })
      if (!res.ok) throw new Error('Failed to approve')
      
      setTimeout(() => {
        router.refresh()
        setProcessingId(null)
      }, 1000)
    } catch (err) {
      console.error(err)
      setProcessingId(null)
    }
  }

  const handleDiscard = async (id: string) => {
    setProcessingId(id)
    try {
      const res = await fetch(`/api/ideas/${id}/discard`, { method: 'POST' })
      if (!res.ok) throw new Error('Failed to discard')
      router.refresh()
    } catch (err) {
      console.error(err)
      toast.error('Failed to discard idea')
    } finally {
      setProcessingId(null)
    }
  }

  const handleRegenerate = async (id: string) => {
    setProcessingId(id)
    try {
      const res = await fetch(`/api/ideas/${id}/regenerate`, { method: 'POST' })
      if (!res.ok) throw new Error('Failed to regenerate')
      router.refresh()
    } catch (err) {
      console.error(err)
      toast.error('Failed to regenerate idea')
    } finally {
      setProcessingId(null)
    }
  }

  return (
    <div className="space-y-6">
      {ideas.map((idea) => (
        <div key={idea.id} className="border rounded-lg p-5 bg-card flex flex-col gap-4 shadow-sm">
          <div className="flex justify-between items-start">
            <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold capitalize ${
              idea.status === 'approved' ? 'bg-green-100 text-green-800 border-transparent dark:bg-green-900/30 dark:text-green-400' :
              idea.status === 'discarded' ? 'bg-muted text-muted-foreground' :
              'bg-blue-100 text-blue-800 border-transparent dark:bg-blue-900/30 dark:text-blue-400'
            }`}>
              {idea.status}
            </span>
            <span className="text-xs text-muted-foreground font-mono bg-muted px-2 py-1 rounded">
              {idea.format}
            </span>
          </div>
          
          <div>
            <h4 className="font-semibold text-lg mb-1">Hook: {idea.hook}</h4>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{idea.caption}</p>
          </div>
          
          <div className="flex flex-wrap gap-2">
            {idea.hashtags.map((tag, i) => (
              <span key={i} className="text-xs text-primary bg-primary/10 px-2 py-1 rounded-md">
                {tag.startsWith('#') ? tag : `#${tag}`}
              </span>
            ))}
          </div>

          <div className="text-xs bg-muted/50 p-3 rounded-md border text-muted-foreground">
            <span className="font-semibold">Visual Prompt:</span> {idea.visual_prompt}
          </div>
          
          {idea.status === 'proposed' && (
            <div className="flex gap-2 justify-end mt-2 pt-4 border-t">
              <Button
                variant="outline"
                className="text-destructive hover:bg-destructive/10"
                onClick={() => handleDiscard(idea.id)}
                disabled={processingId === idea.id}
              >
                {processingId === idea.id ? 'Discarding...' : 'Discard'}
              </Button>
              <Button
                variant="outline"
                onClick={() => handleRegenerate(idea.id)}
                disabled={processingId === idea.id}
              >
                {processingId === idea.id ? 'Regenerating...' : 'Discard & Regenerate'}
              </Button>
              <Button
                className="bg-green-600 hover:bg-green-700 text-white"
                onClick={() => handleApprove(idea.id)}
                disabled={processingId === idea.id}
              >
                {processingId === idea.id ? 'Approving...' : 'Approve & Generate Assets'}
              </Button>
            </div>
          )}

          {idea.status === 'approved' && (
            <div className="flex gap-2 justify-end mt-2 pt-4 border-t">
              <Button variant="outline">
                <a href={`/dashboard/assets`}>View Asset Progress</a>
              </Button>
            </div>
          )}

          {idea.status === 'discarded' && (
            <div className="flex gap-2 justify-end mt-2 pt-4 border-t">
              <Button
                variant="outline"
                onClick={() => handleRegenerate(idea.id)}
                disabled={processingId === idea.id}
              >
                {processingId === idea.id ? 'Regenerating...' : 'Regenerate'}
              </Button>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
