"use client";

import { useDigest } from "@/hooks/useDigest";
import { DigestHeader } from "@/components/DigestHeader";
import { ContentGrid } from "@/components/ContentGrid";
import { SkeletonCard } from "@/components/SkeletonCard";

export default function Home() {
  const { items, date, total, isLoading, refresh } = useDigest();

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <DigestHeader date={date} total={total} onRefresh={() => refresh()} />

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : (
        <ContentGrid items={items} />
      )}

      {!isLoading && items.length > 0 && (
        <footer className="text-center py-12 text-sm text-gray-400 dark:text-gray-600">
          End of digest. Come back tomorrow!
        </footer>
      )}
    </main>
  );
}
