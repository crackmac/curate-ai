"use client";

import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

interface Preferences {
  topics: string[];
  contentTypes: string[];
  digestSize: number;
}

export function usePreferences() {
  const { data, isLoading, mutate } = useSWR<Preferences>(
    "/api/preferences",
    fetcher
  );

  const save = async (patch: Partial<Preferences>) => {
    await fetch("/api/preferences", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    mutate();
  };

  return {
    topics: data?.topics ?? [],
    contentTypes: data?.contentTypes ?? [],
    digestSize: data?.digestSize ?? 20,
    isLoading,
    save,
  };
}
