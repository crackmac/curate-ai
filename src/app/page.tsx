"use client";

import { useState } from "react";
import { useDigest } from "@/hooks/useDigest";
import { DigestHeader } from "@/components/DigestHeader";
import { CategoryTabs } from "@/components/CategoryTabs";
import { ContentGrid } from "@/components/ContentGrid";
import { SkeletonCard } from "@/components/SkeletonCard";

export default function Home() {
  const [category, setCategory] = useState("all");
  const { items, date, total, isLoading, refresh } = useDigest(category);

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <DigestHeader
        date={date}
        total={total}
        onRefresh={() => refresh()}
        category={category}
      />

      <CategoryTabs selected={category} onChange={setCategory} />

      {isLoading ? (
        <div className="columns-[20rem] gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="break-inside-avoid mb-4">
              <SkeletonCard />
            </div>
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
