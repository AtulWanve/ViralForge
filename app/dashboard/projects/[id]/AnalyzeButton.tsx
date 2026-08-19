'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { useRouter } from 'next/navigation'

interface AnalyzeButtonProps {
  projectId: string
  disabled: boolean
  label: string
}

export function AnalyzeButton({ projectId, disabled, label }: AnalyzeButtonProps) {
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const router = useRouter()

  const handleAnalyze = async () => {
    setIsAnalyzing(true)
    try {
      const res = await fetch(`/api/projects/${projectId}/analyze`, {
        method: 'POST'
      })
      
      if (!res.ok) throw new Error('Failed to start analysis')
      
      // Keep showing loading state for a bit while job starts
      setTimeout(() => {
        setIsAnalyzing(false)
        router.refresh()
      }, 2000)
    } catch (error) {
      console.error(error)
      setIsAnalyzing(false)
    }
  }

  return (
    <Button 
      onClick={handleAnalyze} 
      disabled={disabled || isAnalyzing}
    >
      {isAnalyzing ? 'Analyzing...' : label}
    </Button>
  )
}
