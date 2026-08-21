"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Platform, PLATFORMS } from "@/types/database"
import { schedulePost } from "@/app/actions/schedule-actions"

interface ScheduleAssetModalProps {
  assetId: string
  projectId: string
  defaultPlatform: Platform
}

export function ScheduleAssetModal({ assetId, projectId, defaultPlatform }: ScheduleAssetModalProps) {
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Fix 7: prevent double-submit
  const [pending, setPending] = useState(false)

  async function handleSubmit(formData: FormData) {
    if (pending) return
    setPending(true)
    formData.set("timezone", Intl.DateTimeFormat().resolvedOptions().timeZone)
    const result = await schedulePost(null, formData)
    if (result && "error" in result && result.error) {
      setError(result.error)
    } else {
      setError(null)
      setOpen(false)
    }
    setPending(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" className="w-full" />}>
        Schedule
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Schedule Post</DialogTitle>
          <DialogDescription>
            Choose when to publish this content.
          </DialogDescription>
        </DialogHeader>
        <form action={handleSubmit}>
          <input type="hidden" name="assetId" value={assetId} />
          <input type="hidden" name="projectId" value={projectId} />
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="datetime" className="text-right">
                Time
              </Label>
              <Input
                id="datetime"
                name="localDatetime"
                type="datetime-local"
                required
                className="col-span-3"
              />
            </div>
            {/* Fix 5: visible platform select, pre-filled from project default */}
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="platform" className="text-right">
                Platform
              </Label>
              <select
                id="platform"
                name="platform"
                defaultValue={defaultPlatform}
                required
                className="col-span-3 flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm capitalize"
              >
                {PLATFORMS.map((p) => (
                  <option key={p} value={p} className="capitalize">{p}</option>
                ))}
              </select>
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
