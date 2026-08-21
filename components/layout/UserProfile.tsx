import { createClient } from "@/lib/supabase/server"
import { LogOut } from "lucide-react"
import { redirect } from "next/navigation"
import { signout } from "@/app/actions/auth-actions"

export async function UserProfile() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  return (
    <>
      <div className="flex items-center mb-4">
        <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center text-purple-700 font-bold mr-3">
          {user.email?.charAt(0).toUpperCase()}
        </div>
        <div className="text-sm overflow-hidden text-ellipsis whitespace-nowrap">
          {user.email}
        </div>
      </div>
      <form action={signout}>
        <button className="flex w-full items-center px-3 py-2 text-sm font-medium text-red-600 dark:text-red-400 rounded-md hover:bg-red-50 dark:hover:bg-red-900/10">
          <LogOut className="w-4 h-4 mr-3" />
          Sign Out
        </button>
      </form>
    </>
  )
}