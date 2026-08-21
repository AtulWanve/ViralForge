import { ReactNode, Suspense } from "react"
import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import Link from "next/link"
import { LayoutDashboard, Calendar, Plus, Menu } from "lucide-react"
import { Button, buttonVariants } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTrigger, SheetTitle, SheetDescription, SheetClose } from "@/components/ui/sheet"
import { UserProfile } from "@/components/layout/UserProfile"
import { UserProfileSkeleton } from "@/components/layout/UserProfileSkeleton"

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    redirect("/login")
  }

  const { data: me } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single()
  const isAdmin = me?.role === "admin"

  return (
    <div className="flex min-h-[100dvh] w-full max-w-[100vw] flex-col md:flex-row bg-gray-50 dark:bg-gray-900 overflow-x-hidden">
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
            {isAdmin && (
              <li>
                <Link href="/dashboard/admin" prefetch={false} className="flex items-center px-3 py-2 text-sm font-medium text-gray-900 dark:text-gray-100 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700">
                  <LayoutDashboard className="w-5 h-5 mr-3 text-gray-500" />
                  Admin
                </Link>
              </li>
            )}
          </ul>
        </nav>

        <div className="p-4 border-t border-gray-200 dark:border-gray-700">
          <Suspense fallback={<UserProfileSkeleton />}>
            <UserProfile />
          </Suspense>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-x-hidden overflow-y-auto w-full max-w-full min-w-0">
        <header className="h-16 flex items-center justify-between px-4 md:px-8 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 w-full max-w-full">
          <div className="flex items-center md:hidden">
            <Sheet>
              <SheetTrigger render={<button className="p-2 -ml-2 mr-2 text-gray-500 hover:text-gray-600 dark:hover:text-gray-300" />}>
                <Menu className="w-6 h-6" />
                <span className="sr-only">Toggle navigation menu</span>
              </SheetTrigger>
              <SheetContent side="left" className="w-64 p-0 flex flex-col h-full">
                <SheetTitle className="sr-only">Navigation Menu</SheetTitle>
                <SheetDescription className="sr-only">Access dashboard navigation links</SheetDescription>
                <div className="h-16 flex items-center px-6 border-b border-gray-200 dark:border-gray-700">
                  <SheetClose >
                    <Link href="/dashboard" className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-600 to-blue-500">
                      ViralForge
                    </Link>
                  </SheetClose>
                </div>
                <nav className="flex-1 overflow-y-auto py-4">
                  <ul className="space-y-1 px-3">
                    <li>
                      <SheetClose >
                        <Link href="/dashboard" prefetch={false} className="flex items-center px-3 py-2 text-sm font-medium text-gray-900 dark:text-gray-100 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700">
                          <LayoutDashboard className="w-5 h-5 mr-3 text-gray-500" />
                          Projects
                        </Link>
                      </SheetClose>
                    </li>
                    <li>
                      <SheetClose >
                        <Link href="/dashboard/assets" prefetch={false} className="flex items-center px-3 py-2 text-sm font-medium text-gray-900 dark:text-gray-100 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700">
                          <LayoutDashboard className="w-5 h-5 mr-3 text-gray-500" />
                          Assets
                        </Link>
                      </SheetClose>
                    </li>
                    <li>
                      <SheetClose >
                        <Link href="/dashboard/calendar" prefetch={false} className="flex items-center px-3 py-2 text-sm font-medium text-gray-900 dark:text-gray-100 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700">
                          <Calendar className="w-5 h-5 mr-3 text-gray-500" />
                          Calendar
                        </Link>
                      </SheetClose>
                    </li>
{isAdmin && (
                      <li>
                        <SheetClose >
                          <Link href="/dashboard/admin" prefetch={false} className="flex items-center px-3 py-2 text-sm font-medium text-gray-900 dark:text-gray-100 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700">
                            <LayoutDashboard className="w-5 h-5 mr-3 text-gray-500" />
                            Admin
                          </Link>
                        </SheetClose>
                      </li>
                    )}
                  </ul>
                </nav>
                <div className="p-4 border-t border-gray-200 dark:border-gray-700">
                  <Suspense fallback={<UserProfileSkeleton />}>
                    <UserProfile />
                  </Suspense>
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
            className={buttonVariants({ className: "inline-flex h-10 px-4 py-2" })}
          >
            <Plus className="w-4 h-4 mr-2" />
            <span className="sr-only md:not-sr-only">New Project</span>
          </Link>
        </header>
        <div className="p-4 md:p-8 w-full max-w-full overflow-x-hidden">
          {children}
        </div>
      </main>
    </div>
  )
}
