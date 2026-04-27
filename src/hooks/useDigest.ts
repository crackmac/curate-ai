"use client";

import useSWR from "swr";
import type { DigestResponse } from "@/types";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export function useDigest() {
  const { data, error, isLoading, mutate } = useSWR<DigestResponse>(
    "/api/content",
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
