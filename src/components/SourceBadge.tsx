"use client";

const sourceColors: Record<string, { bg: string; text: string }> = {
  hackernews: { bg: "bg-orange-100 dark:bg-orange-900/30", text: "text-orange-700 dark:text-orange-300" },
  reddit: { bg: "bg-red-100 dark:bg-red-900/30", text: "text-red-700 dark:text-red-300" },
  rss: { bg: "bg-blue-100 dark:bg-blue-900/30", text: "text-blue-700 dark:text-blue-300" },
  youtube: { bg: "bg-rose-100 dark:bg-rose-900/30", text: "text-rose-700 dark:text-rose-300" },
  bluesky: { bg: "bg-sky-100 dark:bg-sky-900/30", text: "text-sky-700 dark:text-sky-300" },
};

const sourceLabels: Record<string, string> = {
  hackernews: "HN",
  reddit: "Reddit",
  rss: "RSS",
  youtube: "YouTube",
  bluesky: "BlueSky",
};

interface SourceBadgeProps {
  sourceType: string;
  sourceName: string;
}

export function SourceBadge({ sourceType, sourceName }: SourceBadgeProps) {
  const colors = sourceColors[sourceType] ?? {
    bg: "bg-gray-100 dark:bg-gray-800",
    text: "text-gray-700 dark:text-gray-300",
  };
  const label = sourceLabels[sourceType] ?? sourceName;

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${colors.bg} ${colors.text}`}
    >
      {label}
    </span>
  );
}
