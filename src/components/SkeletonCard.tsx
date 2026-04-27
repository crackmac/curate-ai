export function SkeletonCard() {
  return (
    <div className="flex flex-col rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 animate-pulse">
      <div className="flex items-center justify-between mb-3">
        <div className="h-5 w-12 rounded-full bg-gray-200 dark:bg-gray-800" />
        <div className="h-4 w-16 rounded bg-gray-200 dark:bg-gray-800" />
      </div>
      <div className="h-4 w-full rounded bg-gray-200 dark:bg-gray-800 mb-2" />
      <div className="h-4 w-3/4 rounded bg-gray-200 dark:bg-gray-800 mb-3" />
      <div className="h-3 w-full rounded bg-gray-200 dark:bg-gray-800 mb-1" />
      <div className="h-3 w-2/3 rounded bg-gray-200 dark:bg-gray-800 mb-4" />
      <div className="mt-auto pt-3 border-t border-gray-100 dark:border-gray-800">
        <div className="h-3 w-1/2 rounded bg-gray-200 dark:bg-gray-800" />
      </div>
    </div>
  );
}
