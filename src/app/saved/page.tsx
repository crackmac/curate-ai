"use client";

import Link from "next/link";
import useSWR from "swr";
import { ArrowLeft, Bookmark } from "lucide-react";
import { ContentCard } from "@/components/ContentCard";
import { SkeletonCard } from "@/components/SkeletonCard";
import type { CuratedContentItem } from "@/types";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function SavedPage() {
  const { data, isLoading, mutate } = useSWR<{ items: CuratedContentItem[] }>(
    "/api/saved",
    fetcher,
  );
  const items = data?.items ?? [];

  // Un-saving here removes the item from the Saved List straight away.
  const handleSaveChange = (id: number, saved: boolean) => {
    if (saved) return;
    mutate(
      (current) =>
        current && { items: current.items.filter((i) => i.id !== id) },
      { revalidate: false },
    );
  };

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex items-center gap-3 mb-8">
        <Link
          href="/"
          aria-label="Back to digest"
          className="rounded-full p-2 hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors"
        >
          <ArrowLeft className="h-5 w-5 text-gray-600 dark:text-gray-400" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            Saved
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Everything you&apos;ve saved, newest first
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="columns-[20rem] gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="break-inside-avoid mb-4">
              <SkeletonCard />
            </div>
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-20">
          <Bookmark className="mx-auto h-8 w-8 text-gray-300 dark:text-gray-700 mb-3" />
          <p className="text-gray-500 dark:text-gray-400 text-lg">
            Nothing saved yet.
          </p>
          <p className="text-gray-400 dark:text-gray-500 text-sm mt-2">
            Use the bookmark on any card in your digest to keep it here.
          </p>
        </div>
      ) : (
        <div className="columns-[20rem] gap-4">
          {items.map((item) => (
            <div key={item.id} className="break-inside-avoid mb-4">
              <ContentCard
                item={item}
                onSaveChange={(saved) => handleSaveChange(item.id, saved)}
              />
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
