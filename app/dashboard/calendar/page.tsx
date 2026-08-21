import { createClient } from '@/lib/supabase/server'
import { GeneratedAsset, Project, ScheduledPost } from '@/types/database'
import { Calendar } from '@/components/ui/calendar'
import { UnscheduleButton } from '@/components/calendar/UnscheduleButton'

type CalendarProjectFields = Pick<Project, 'name' | 'target_platform'>
type CalendarAssetFields = Pick<GeneratedAsset, 'media_url' | 'type'>

interface CalendarPost extends ScheduledPost {
  project: CalendarProjectFields
  asset: CalendarAssetFields | null
}

function formatScheduled(scheduledFor: string, timeZone?: string): { formatted: string; timeZone: string } | null {
  const date = new Date(scheduledFor)
  if (Number.isNaN(date.getTime())) return null
  try {
    const effective = timeZone || 'UTC'
    return {
      formatted: new Intl.DateTimeFormat('en-US', {
        dateStyle: 'medium',
        timeStyle: 'short',
        timeZone: effective,
      }).format(date),
      timeZone: effective,
    }
  } catch {
    return {
      formatted: new Intl.DateTimeFormat('en-US', {
        dateStyle: 'medium',
        timeStyle: 'short',
        timeZone: 'UTC',
      }).format(date),
      timeZone: 'UTC',
    }
  }
}

export default async function CalendarPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return <div>Not authenticated</div>
  }

  // Fix 2: scope to current user via project join
  const { data: posts, error } = await supabase
    .from('scheduled_posts')
    .select(`
      *,
      project:projects!inner(name, target_platform, user_id),
      asset:generated_assets(media_url, type)
    `)
    .eq('project.user_id', user.id)
    .order('scheduled_for', { ascending: true })

  if (error) {
    return (
      <div className="rounded-md border border-destructive/50 bg-destructive/10 p-6 text-destructive">
        <h3 className="text-lg font-semibold mb-2">Failed to load schedule</h3>
        <p className="text-sm">An unexpected error occurred while loading your scheduled posts. Please try again later.</p>
      </div>
    )
  }

  const typedPosts = (posts || []).map((p): CalendarPost => ({
    ...(p as ScheduledPost),
    project: p.project as CalendarProjectFields,
    asset: p.asset as CalendarAssetFields | null,
  }))

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Content Calendar</h1>
      </div>

      <div className="grid gap-6 md:grid-cols-[1fr_300px]">
        <div className="bg-card rounded-lg border p-6">
          <h3 className="font-semibold text-lg mb-4">Upcoming Schedule</h3>

          {typedPosts.length === 0 ? (
            <div className="rounded-md border border-dashed p-12 text-center bg-muted/20">
              <h3 className="text-lg font-semibold mb-2">No posts scheduled</h3>
              <p className="text-muted-foreground">
                Approve content ideas to generate assets and schedule them here.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {typedPosts.map((post) => {
                const formatted = formatScheduled(post.scheduled_for, post.timezone)
                return (
                <div key={post.id} className="border rounded-md p-4 flex justify-between items-center bg-background">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold capitalize ${
                        post.status === 'published' ? 'bg-green-100 text-green-800 border-transparent dark:bg-green-900/30 dark:text-green-400' :
                        post.status === 'failed' ? 'bg-red-100 text-red-800 border-transparent dark:bg-red-900/30 dark:text-red-400' :
                        post.status === 'scheduled' ? 'bg-blue-100 text-blue-800 border-transparent dark:bg-blue-900/30 dark:text-blue-400' :
                        'bg-muted text-muted-foreground'
                      }`}>
                        {post.status}
                      </span>
                      {/* Fix 6: show post.platform, not project.target_platform */}
                      <span className="text-xs font-medium bg-primary/10 text-primary px-2 py-0.5 rounded capitalize">
                        {post.platform}
                      </span>
                    </div>
                    <p className="font-medium text-sm">{post.project?.name || 'Unknown Project'}</p>
                    {formatted && (
                      <p className="text-xs text-muted-foreground">
                        {formatted.formatted}{' '}
                        <span className="text-muted-foreground/70">({formatted.timeZone})</span>
                      </p>
                    )}

                    {post.publish_error && (
                      <p className="text-xs text-destructive mt-1">Error: {post.publish_error}</p>
                    )}
                  </div>

                  <div className="flex flex-col items-end gap-2">
                    {/* Fix 3: real thumbnail, fallback to placeholder */}
                    {post.asset?.media_url ? (
                      <img
                        src={(() => {
                          try {
                            const parsed = JSON.parse(post.asset.media_url)
                            return Array.isArray(parsed) ? parsed[0] : post.asset.media_url
                          } catch {
                            return post.asset.media_url
                          }
                        })()}
                        alt="Asset thumbnail"
                        className="w-16 h-16 rounded object-cover"
                      />
                    ) : (
                      <div className="w-16 h-16 bg-muted rounded flex items-center justify-center text-[10px] text-muted-foreground text-center">
                        Asset<br/>Pending
                      </div>
                    )}
                    {/* Fix 4: unschedule button (only for non-published posts) */}
                    {post.status === 'scheduled' && (
                      <UnscheduleButton postId={post.id} />
                    )}
                  </div>
                </div>
              );
              })}
            </div>
          )}
        </div>

        <div>
          <div className="bg-card rounded-lg border p-4 sticky top-6">
            <Calendar
              mode="single"
              selected={new Date()}
              className="rounded-md"
            />

            <div className="mt-4 pt-4 border-t">
              <h4 className="text-sm font-semibold mb-2">Publishing Status</h4>
              <div className="space-y-2 text-sm text-muted-foreground">
                <div className="flex justify-between">
                  <span>Scheduled</span>
                  <span className="font-medium text-foreground">{typedPosts.filter(p => p.status === 'scheduled').length}</span>
                </div>
                <div className="flex justify-between">
                  <span>Published</span>
                  <span className="font-medium text-foreground">{typedPosts.filter(p => p.status === 'published').length}</span>
                </div>
                <div className="flex justify-between">
                  <span>Failed</span>
                  <span className="font-medium text-foreground">{typedPosts.filter(p => p.status === 'failed').length}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
