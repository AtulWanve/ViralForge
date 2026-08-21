export function UserProfileSkeleton() {
  return (
    <>
      <div className="flex items-center mb-4">
        <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 animate-pulse mr-3" />
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-32" />
      </div>
      <div className="h-9 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-full" />
    </>
  )
}