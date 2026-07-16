"use client";

import useSWR from "swr";
import type { DigestResponse } from "@/types";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export function useDigest(category?: string) {
  const key =
    category && category !== "all"
      ? `/api/content?category=${encodeURIComponent(category)}`
      : "/api/content";
  const { data, error, isLoading, mutate } = useSWR<DigestResponse>(
    key,
    fetcher
  );

  return {
    items: data?.items ?? [],
    date: data?.date ?? "",
    total: data?.total ?? 0,
    isLoading,
    error,
    refresh: mutate,
  };
}
