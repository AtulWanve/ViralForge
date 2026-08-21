import { ReactNode, Suspense } from "react"
import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import Link from "next/link"
import { LayoutDashboard, Calendar, Plus, Menu } from "lucide-react"
import { Button, buttonVariants } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTrigger, SheetTitle, SheetDescription } from "@/components/ui/sheet"
import { UserProfile } from "@/components/layout/UserProfile"
import { UserProfileSkeleton } from "@/components/layout/UserProfileSkeleton"

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    redirect("/login")
  }

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
      {/* Sidebar */}
      <aside className="hidden md:flex w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex-col">
        <div className="h-16 flex items-center px-6 border-b border-gray-200 dark:border-gray-700">
          <Link href="/dashboard" className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-600 to-blue-500">
            ViralForge
          </Link>
        </div>

        <nav className="flex-1 overflow-y-auto py-4">
          <ul className="space-y-1 px-3">
            <li>
              <Link href="/dashboard" prefetch={false} className="flex items-center px-3 py-2 text-sm font-medium text-gray-900 dark:text-gray-100 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700">
                <LayoutDashboard className="w-5 h-5 mr-3 text-gray-500" />
                Projects
              </Link>
            </li>
            <li>
              <Link href="/dashboard/assets" prefetch={false} className="flex items-center px-3 py-2 text-sm font-medium text-gray-900 dark:text-gray-100 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700">
                <LayoutDashboard className="w-5 h-5 mr-3 text-gray-500" />
                Assets
              </Link>
            </li>
            <li>
              <Link href="/dashboard/calendar" prefetch={false} className="flex items-center px-3 py-2 text-sm font-medium text-gray-900 dark:text-gray-100 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700">
                <Calendar className="w-5 h-5 mr-3 text-gray-500" />
                Calendar
              </Link>
            </li>
          </ul>
        </nav>

        <div className="p-4 border-t border-gray-200 dark:border-gray-700">
          <Suspense fallback={<UserProfileSkeleton />}>
            <UserProfile />
          </Suspense>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        <header className="h-16 flex items-center justify-between px-4 md:px-8 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center md:hidden">
            <Sheet>
              <SheetTrigger render={<button className="p-2 -ml-2 mr-2 text-gray-500 hover:text-gray-600 dark:hover:text-gray-300" />}>
                <Menu className="w-6 h-6" />
                <span className="sr-only">Toggle navigation menu</span>
              </SheetTrigger>
              <SheetContent side="left" className="w-64 p-0">
                <SheetTitle className="sr-only">Navigation Menu</SheetTitle>
                <SheetDescription className="sr-only">Access dashboard navigation links</SheetDescription>
                <div className="h-16 flex items-center px-6 border-b border-gray-200 dark:border-gray-700">
                  <Link href="/dashboard" className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-600 to-blue-500">
                    ViralForge
                  </Link>
                </div>
                <nav className="flex-1 overflow-y-auto py-4">
                  <ul className="space-y-1 px-3">
                    <li>
                      <Link href="/dashboard" prefetch={false} className="flex items-center px-3 py-2 text-sm font-medium text-gray-900 dark:text-gray-100 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700">
                        <LayoutDashboard className="w-5 h-5 mr-3 text-gray-500" />
                        Projects
                      </Link>
                    </li>
                    <li>
                      <Link href="/dashboard/assets" prefetch={false} className="flex items-center px-3 py-2 text-sm font-medium text-gray-900 dark:text-gray-100 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700">
                        <LayoutDashboard className="w-5 h-5 mr-3 text-gray-500" />
                        Assets
                      </Link>
                    </li>
                    <li>
                      <Link href="/dashboard/calendar" prefetch={false} className="flex items-center px-3 py-2 text-sm font-medium text-gray-900 dark:text-gray-100 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700">
                        <Calendar className="w-5 h-5 mr-3 text-gray-500" />
                        Calendar
                      </Link>
                    </li>
                  </ul>
                </nav>
                <div className="p-4 border-t border-gray-200 dark:border-gray-700">
                  <Link
                    href="/dashboard/projects/new"
                    prefetch={false}
                    className={buttonVariants({ className: "w-full justify-start h-10 px-4 py-2" })}
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    <span>New Project</span>
                  </Link>
                </div>
              </SheetContent>
            </Sheet>
             <Link href="/dashboard" className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-600 to-blue-500">
               ViralForge
             </Link>
          </div>
          <div className="hidden md:block"></div>
          <Link
            href="/dashboard/projects/new"
            prefetch={false}
            className={buttonVariants({ className: "hidden md:inline-flex h-10 px-4 py-2" })}
          >
            <Plus className="w-4 h-4 md:mr-2" />
            <span className="hidden md:inline">New Project</span>
          </Link>
        </header>
        <div className="p-4 md:p-8">
          {children}
        </div>
      </main>
    </div>
  )
}
