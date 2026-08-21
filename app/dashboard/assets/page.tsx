import { getAssets } from "@/app/actions/asset-actions"
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"
import { ScheduleAssetModal } from "@/components/assets/ScheduleAssetModal"
import { Platform } from "@/types/database"

export default async function AssetsPage() {
  const assets = await getAssets()

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Assets</h2>
        <p className="text-muted-foreground">View your generated assets here.</p>
      </div>

      {assets.length === 0 ? (
        <div className="p-12 text-center border rounded-lg bg-card text-muted-foreground">
          No assets generated yet. Analyze a project and generate ideas first!
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {assets.map((asset) => (
            <Card key={asset.id} className="overflow-hidden flex flex-col">
              <div className="aspect-video bg-muted flex items-center justify-center border-b overflow-hidden relative">
                {asset.media_url ? (
                  asset.type === 'image' ? (
                    <img src={asset.media_url} alt="Generated asset" className="w-full h-full object-cover" />
                  ) : asset.type === 'video' ? (
                    <video src={asset.media_url} controls className="w-full h-full object-cover" />
                  ) : asset.type === 'carousel' ? (
                    <div className="grid grid-cols-3 gap-1 w-full h-full">
                      {(() => {
                        try {
                          const urls: string[] = JSON.parse(asset.media_url)
                          return urls.map((u, i) => (
                            <img key={i} src={u} alt={`Carousel slide ${i + 1}`} className="w-full h-full object-cover" />
                          ))
                        } catch {
                          return <a href={asset.media_url} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline break-all px-4 text-center">View carousel ↗</a>
                        }
                      })()}
                    </div>
                  ) : (
                    <a href={asset.media_url} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline break-all px-4 text-center">
                      View {asset.type} ↗
                    </a>
                  )
                ) : (
                  <span className="text-muted-foreground capitalize">{asset.type} placeholder</span>
                )}
              </div>
              <CardHeader className="p-4 pb-2">
                <div className="flex justify-between items-start gap-2">
                  <CardTitle className="text-base truncate">
                    <Link href={`/dashboard/projects/${asset.project_id}`} className="hover:underline">
                      {asset.projects?.name || 'Project Link'}
                    </Link>
                  </CardTitle>
                  <Badge variant={asset.status === 'ready' ? 'default' : asset.status === 'failed' ? 'destructive' : 'secondary'}>
                    {asset.status}
                  </Badge>
                </div>
                <CardDescription className="capitalize">{asset.type}</CardDescription>
              </CardHeader>
              <CardContent className="p-4 pt-2 flex-grow">
                {asset.error_message && (
                  <p className="text-sm text-destructive mt-2">{asset.error_message}</p>
                )}
                <div className="text-xs text-muted-foreground mt-2">
                  Generated: {new Date(asset.created_at).toLocaleDateString('en-US', { timeZone: 'UTC' })}
                </div>
              </CardContent>
              {asset.status === 'ready' && (
                <CardFooter className="p-4 pt-0">
                  <ScheduleAssetModal
                    assetId={asset.id}
                    projectId={asset.project_id}
                    defaultPlatform={(asset.projects?.target_platform as Platform) || "instagram"}
                  />
                </CardFooter>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
