'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { useRouter } from 'next/navigation'

interface GenerateIdeasButtonProps {
  projectId: string
  disabled?: boolean
}

export function GenerateIdeasButton({ projectId, disabled }: GenerateIdeasButtonProps) {
  const [isGenerating, setIsGenerating] = useState(false)
  const router = useRouter()

  const handleGenerate = async () => {
    setIsGenerating(true)
    try {
      const res = await fetch(`/api/projects/${projectId}/generate-ideas`, {
        method: 'POST'
      })
      
      if (!res.ok) throw new Error('Failed to start generation')
      
      // Keep showing loading state for a bit while job starts
      setTimeout(() => {
        setIsGenerating(false)
        router.refresh()
      }, 2000)
    } catch (error) {
      console.error(error)
      setIsGenerating(false)
    }
  }

  return (
    <Button 
      onClick={handleGenerate} 
      disabled={disabled || isGenerating}
    >
      {isGenerating ? 'Generating...' : 'Generate New Ideas'}
    </Button>
  )
}
