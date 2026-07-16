"use client";

import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

interface CategoryTabsProps {
  selected: string;
  onChange: (category: string) => void;
}

export function CategoryTabs({ selected, onChange }: CategoryTabsProps) {
  const { data: categories } = useSWR<string[]>("/api/categories", fetcher);

  if (!categories || categories.length <= 1) return null;

  return (
    <nav className="mb-6 flex flex-wrap gap-2 border-b border-gray-200 dark:border-gray-800">
      {categories.map((category) => {
        const active = category === selected;
        return (
          <button
            key={category}
            onClick={() => onChange(category)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium capitalize transition-colors ${
              active
                ? "border-blue-500 text-blue-600 dark:text-blue-400"
                : "border-transparent text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
            }`}
          >
            {category}
          </button>
        );
      })}
    </nav>
  );
}
