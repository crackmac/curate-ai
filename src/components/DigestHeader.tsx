"use client";

import Link from "next/link";
import { RefreshCw, Settings, Sparkles } from "lucide-react";
import { useState } from "react";
import { ReasonLegend } from "./ReasonLegend";

interface DigestHeaderProps {
  date: string;
  total: number;
  onRefresh: () => void;
}

export function DigestHeader({ date, total, onRefresh }: DigestHeaderProps) {
  const [ingesting, setIngesting] = useState(false);
  const [curating, setCurating] = useState(false);

  const handleIngest = async () => {
    setIngesting(true);
    try {
      await fetch("/api/ingest", { method: "POST" });
      onRefresh();
    } finally {
      setIngesting(false);
    }
  };

  const handleCurate = async () => {
    setCurating(true);
    try {
      await fetch("/api/curate", { method: "POST" });
      onRefresh();
    } finally {
      setCurating(false);
    }
  };

  const formattedDate = date
    ? new Date(date + "T00:00:00").toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
      })
    : "";

  return (
    <header className="mb-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            CurateAI
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {formattedDate && `${formattedDate} · `}
            {total} items
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ReasonLegend />
          <button
            onClick={handleIngest}
            disabled={ingesting || curating}
            className="flex items-center gap-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-50"
          >
            <RefreshCw
              className={`h-4 w-4 ${ingesting ? "animate-spin" : ""}`}
            />
            {ingesting ? "Fetching..." : "Refresh"}
          </button>
          <button
            onClick={handleCurate}
            disabled={ingesting || curating}
            className="flex items-center gap-2 rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950 px-3 py-2 text-sm text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900 transition-colors disabled:opacity-50"
          >
            <Sparkles
              className={`h-4 w-4 ${curating ? "animate-pulse" : ""}`}
            />
            {curating ? "Curating..." : "Curate"}
          </button>
          <Link
            href="/settings"
            className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-2 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            <Settings className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </header>
  );
}
