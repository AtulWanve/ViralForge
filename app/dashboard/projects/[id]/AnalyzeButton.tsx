'use client'

import { useState, useTransition, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { analyzeProjectAction, checkAnalysisStatusAction } from '@/app/actions/analyze-actions'
import { useRouter } from 'next/navigation'

export interface AnalyzeButtonProps {
  projectId: string
  disabled: boolean
  label: string
  initialStatus?: string | null
}

export function AnalyzeButton({ projectId, disabled, label, initialStatus }: AnalyzeButtonProps) {
  const [isPending, startTransition] = useTransition()
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [status, setStatus] = useState(initialStatus)
  const [isPollingTimeout, setIsPollingTimeout] = useState(false)
  const router = useRouter()

  useEffect(() => {
    let intervalId: NodeJS.Timeout
    let attempts = 0
    const MAX_ATTEMPTS = 60
    let cancelled = false

    // Check status immediately on mount if analyzing
    if (status === 'analyzing' && !isPollingTimeout) {
      // Immediate check on mount
      checkAnalysisStatusAction(projectId).then(currentStatus => {
        if (cancelled || currentStatus === 'unknown') return
        if (currentStatus !== 'analyzing') {
          setStatus(currentStatus)
          if (currentStatus === 'error') {
            setErrorMessage('Analysis failed or timed out. Please try again.')
          }
          router.refresh()
        }
      }).catch(error => {
        if (cancelled) return
        console.error("Initial status check error:", error)
      })

      intervalId = setInterval(async () => {
        try {
          attempts++
          const currentStatus = await checkAnalysisStatusAction(projectId)
          if (cancelled) return
          if (currentStatus === 'unknown') {
            if (attempts >= MAX_ATTEMPTS) {
              setIsPollingTimeout(true)
              setErrorMessage('Analysis is taking longer than expected but is still running in the background.')
              if (intervalId) clearInterval(intervalId)
            }
            return
          }
          if (currentStatus !== 'analyzing') {
            setStatus(currentStatus)
            setIsPollingTimeout(false)
            if (currentStatus === 'error') {
              setErrorMessage('Analysis failed or timed out. Please try again.')
            }
            router.refresh()
            if (intervalId) clearInterval(intervalId)
            return
          }

          if (attempts >= MAX_ATTEMPTS) {
            setIsPollingTimeout(true)
            setErrorMessage('Analysis is taking longer than expected but is still running in the background.')
            if (intervalId) clearInterval(intervalId)
          }
        } catch (error) {
          console.error("Polling error:", error)
          if (cancelled) return
          if (attempts >= MAX_ATTEMPTS) {
            setIsPollingTimeout(true)
            setErrorMessage('Analysis is taking longer than expected but is still running in the background.')
            if (intervalId) clearInterval(intervalId)
          } else {
            setErrorMessage('Unable to check status right now. Retrying...')
          }
        }
      }, 3000)
    }

    return () => {
      cancelled = true
      if (intervalId) clearInterval(intervalId)
    }
  }, [status, projectId, router, isPollingTimeout])

  const handleAnalyze = () => {
    setErrorMessage(null)
    setIsPollingTimeout(false)
    startTransition(async () => {
      try {
        await analyzeProjectAction(projectId)
        setStatus('analyzing')
      } catch (error) {
        console.error(error)
        setErrorMessage('Analysis failed to start. Please try again.')
      }
    })
  }

  const handleRefreshStatus = () => {
    setErrorMessage(null)
    startTransition(async () => {
      try {
        const currentStatus = await checkAnalysisStatusAction(projectId)
        if (currentStatus === 'unknown') {
          setErrorMessage('Unable to check status right now. Please try again.')
          return
        }
        setStatus(currentStatus)
        if (currentStatus !== 'analyzing') {
          setIsPollingTimeout(false)
          if (currentStatus === 'error') {
            setErrorMessage('Analysis failed in background. Please try again.')
          }
          router.refresh()
        } else {
          setErrorMessage('Analysis is still running in the background.')
        }
      } catch (error) {
        console.error("Refresh error:", error)
        setErrorMessage('Failed to check status. Please try again.')
      }
    })
  }

  const isAnalyzing = status === 'analyzing'
  const isButtonDisabled = disabled || (isAnalyzing && !isPollingTimeout) || isPending

  return (
    <div className="flex flex-col items-end gap-2">
      <Button
        onClick={isPollingTimeout ? handleRefreshStatus : handleAnalyze}
        disabled={isButtonDisabled}
      >
        {isPending ? 'Working...' : isPollingTimeout ? 'Refresh Status' : isAnalyzing ? 'Analyzing...' : label}
      </Button>
      {errorMessage && (
        <p className="text-sm text-destructive" role="alert">{errorMessage}</p>
      )}
    </div>
  )
}
