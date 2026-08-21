"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"

export function UnscheduleButton({ postId }: { postId: string }) {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  async function handleUnschedule() {
    if (pending) return
    setPending(true)
    setError(null)
    try {
      const response = await fetch(`/api/scheduled-posts/${postId}`, {
        method: "DELETE",
      })
      if (!response.ok) {
        throw new Error(`Failed to unschedule (${response.status})`)
      }
      router.refresh()
    } catch {
      setError("Could not remove post. Please try again.")
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <Button
        variant="ghost"
        size="sm"
        className="text-xs text-destructive hover:text-destructive"
        onClick={handleUnschedule}
        disabled={pending}
      >
        {pending ? "Removing…" : "Unschedule"}
      </Button>
      {error ? (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  )
}
