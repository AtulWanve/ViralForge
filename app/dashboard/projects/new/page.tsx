import { createProject } from '@/app/actions/project-actions'
import { Button } from '@/components/ui/button'

export default function NewProjectPage() {
  return (
    <div className="max-w-2xl mx-auto py-8">
      <h2 className="text-2xl font-bold tracking-tight mb-6">Create New Project</h2>
      
      <form action={createProject} className="space-y-6 bg-card p-6 rounded-lg border shadow-sm">
        <div className="space-y-2">
          <label htmlFor="name" className="text-sm font-medium">Project Name</label>
          <input 
            type="text" 
            id="name" 
            name="name" 
            required 
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            placeholder="e.g., Tech Startup Launch"
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="description" className="text-sm font-medium">Description (Optional)</label>
          <textarea 
            id="description" 
            name="description" 
            rows={3}
            className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            placeholder="What is this project about?"
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="target_platform" className="text-sm font-medium">Target Platform</label>
          <select 
            id="target_platform" 
            name="target_platform" 
            required
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <option value="instagram">Instagram</option>
            <option value="tiktok">TikTok</option>
            <option value="linkedin">LinkedIn</option>
            <option value="x">X (Twitter)</option>
          </select>
        </div>

        <div className="space-y-2">
          <label htmlFor="brand_voice" className="text-sm font-medium">Brand Voice (Optional)</label>
          <textarea 
            id="brand_voice" 
            name="brand_voice" 
            rows={3}
            className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            placeholder="e.g., Professional, enthusiastic, authoritative"
          />
        </div>

        <Button type="submit" className="w-full">Create Project</Button>
      </form>
    </div>
  )
}
