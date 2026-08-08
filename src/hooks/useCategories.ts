"use client";

import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export interface Category {
  id: number;
  slug: string;
  name: string;
  ingestCron: string;
  curateCron: string;
}

export function useCategories() {
  const { data, isLoading, mutate } = useSWR<Category[]>(
    "/api/categories",
    fetcher
  );

  const create = async (input: { slug: string; name: string; ingestCron: string; curateCron: string }) => {
    const res = await fetch("/api/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    mutate();
    return res;
  };

  const update = async (id: number, patch: Partial<Omit<Category, "id">>) => {
    const res = await fetch("/api/categories", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...patch }),
    });
    mutate();
    return res;
  };

  const remove = async (id: number) => {
    const res = await fetch(`/api/categories?id=${id}`, { method: "DELETE" });
    mutate();
    return res;
  };

  return {
    categories: data ?? [],
    isLoading,
    create,
    update,
    remove,
  };
}
