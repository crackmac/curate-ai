"use client";

import Link from "next/link";
import {
  RefreshCw,
  Settings,
  Sparkles,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { useState } from "react";
import { ReasonLegend } from "./ReasonLegend";

interface DigestHeaderProps {
  date: string;
  total: number;
  onRefresh: () => void;
  category?: string;
}

interface IngestResult {
  ingested: number;
  errors: string[];
  skipped: string[];
  empty: string[];
}

export function DigestHeader({
  date,
  total,
  onRefresh,
  category,
}: DigestHeaderProps) {
  const [ingesting, setIngesting] = useState(false);
  const [curating, setCurating] = useState(false);
  const [ingestResult, setIngestResult] = useState<IngestResult | null>(null);
  const [showDetail, setShowDetail] = useState(false);

  const handleIngest = async () => {
    setIngesting(true);
    try {
      const url =
        category && category !== "all"
          ? `/api/ingest?category=${encodeURIComponent(category)}`
          : "/api/ingest";
      const res = await fetch(url, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setIngestResult({
          ingested: 0,
          errors: [data.error ?? "ingest request failed"],
          skipped: [],
          empty: [],
        });
      } else {
        setIngestResult({
          ingested: data.ingested ?? 0,
          errors: data.errors ?? [],
          skipped: data.skipped ?? [],
          empty: data.empty ?? [],
        });
      }
      onRefresh();
    } catch (err) {
      setIngestResult({
        ingested: 0,
        errors: [err instanceof Error ? err.message : "network error"],
        skipped: [],
        empty: [],
      });
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

      {ingestResult && <IngestReport result={ingestResult} show={showDetail} onToggle={() => setShowDetail((s) => !s)} />}
    </header>
  );
}

function IngestReport({
  result,
  show,
  onToggle,
}: {
  result: IngestResult;
  show: boolean;
  onToggle: () => void;
}) {
  const { ingested, errors, skipped, empty } = result;
  const hasIssues = errors.length > 0 || skipped.length > 0 || empty.length > 0;

  return (
    <div
      className={`mt-4 rounded-lg border px-3 py-2 text-sm ${
        errors.length > 0
          ? "border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-300"
          : hasIssues
            ? "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300"
            : "border-green-200 bg-green-50 text-green-800 dark:border-green-900 dark:bg-green-950 dark:text-green-300"
      }`}
    >
      <button
        onClick={onToggle}
        disabled={!hasIssues}
        className="flex w-full items-center gap-1 text-left font-medium disabled:cursor-default"
      >
        {hasIssues &&
          (show ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          ))}
        <span>
          Fetched {ingested} items · {errors.length} errors · {skipped.length}{" "}
          skipped · {empty.length} empty
        </span>
      </button>

      {show && hasIssues && (
        <div className="mt-2 space-y-2">
          {errors.length > 0 && (
            <div>
              <p className="font-semibold">Errors</p>
              <ul className="list-disc pl-5">
                {errors.map((e, i) => (
                  <li key={i} className="break-words">
                    {e}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {skipped.length > 0 && (
            <div>
              <p className="font-semibold">Skipped</p>
              <ul className="list-disc pl-5">
                {skipped.map((s, i) => (
                  <li key={i} className="break-words">
                    {s}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {empty.length > 0 && (
            <div>
              <p className="font-semibold">Returned no items</p>
              <ul className="list-disc pl-5">
                {empty.map((s, i) => (
                  <li key={i} className="break-words">
                    {s}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
