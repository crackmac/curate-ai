"use client";

import { ContentCard } from "./ContentCard";
import type { CuratedContentItem } from "@/types";

interface ContentGridProps {
  items: CuratedContentItem[];
}

export function ContentGrid({ items }: ContentGridProps) {
  if (items.length === 0) {
    return (
      <div className="text-center py-20">
        <p className="text-gray-500 dark:text-gray-400 text-lg">
          No content yet.
        </p>
        <p className="text-gray-400 dark:text-gray-500 text-sm mt-2">
          Trigger an ingest to fetch stories.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {items.map((item) => (
        <ContentCard key={item.id} item={item} />
      ))}
    </div>
  );
}
