"use client";

import { useCategories } from "@/hooks/useCategories";

interface CategoryTabsProps {
  selected: string;
  onChange: (category: string) => void;
}

export function CategoryTabs({ selected, onChange }: CategoryTabsProps) {
  const { categories, isLoading } = useCategories();

  if (isLoading || categories.length === 0) return null;

  const tabs = [{ slug: "all", name: "All" }, ...categories];

  return (
    <nav className="mb-6 flex flex-wrap gap-2 border-b border-gray-200 dark:border-gray-800">
      {tabs.map((tab) => {
        const active = tab.slug === selected;
        return (
          <button
            key={tab.slug}
            onClick={() => onChange(tab.slug)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
              active
                ? "border-blue-500 text-blue-600 dark:text-blue-400"
                : "border-transparent text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
            }`}
          >
            {tab.name}
          </button>
        );
      })}
    </nav>
  );
}
