"use client";

import {
  Target,
  TrendingUp,
  Bookmark,
  Flame,
  Zap,
  BookOpen,
  Users,
  Compass,
} from "lucide-react";
import type { ReasonTag } from "@/types";

interface ReasonConfig {
  icon: typeof Target;
  label: string;
  color: string;
  bg: string;
}

export const REASON_CONFIG: Record<ReasonTag, ReasonConfig> = {
  topic_match: {
    icon: Target,
    label: "Matches your interests",
    color: "text-blue-600 dark:text-blue-400",
    bg: "bg-blue-100 dark:bg-blue-900/30",
  },
  trending: {
    icon: TrendingUp,
    label: "Trending now",
    color: "text-orange-600 dark:text-orange-400",
    bg: "bg-orange-100 dark:bg-orange-900/30",
  },
  saved_similar: {
    icon: Bookmark,
    label: "Similar to your saves",
    color: "text-violet-600 dark:text-violet-400",
    bg: "bg-violet-100 dark:bg-violet-900/30",
  },
  high_engagement: {
    icon: Flame,
    label: "High engagement",
    color: "text-red-600 dark:text-red-400",
    bg: "bg-red-100 dark:bg-red-900/30",
  },
  breaking: {
    icon: Zap,
    label: "Breaking news",
    color: "text-amber-600 dark:text-amber-400",
    bg: "bg-amber-100 dark:bg-amber-900/30",
  },
  deep_dive: {
    icon: BookOpen,
    label: "Deep dive",
    color: "text-emerald-600 dark:text-emerald-400",
    bg: "bg-emerald-100 dark:bg-emerald-900/30",
  },
  community_pick: {
    icon: Users,
    label: "Community pick",
    color: "text-pink-600 dark:text-pink-400",
    bg: "bg-pink-100 dark:bg-pink-900/30",
  },
  broadening: {
    icon: Compass,
    label: "Broadening horizons",
    color: "text-teal-600 dark:text-teal-400",
    bg: "bg-teal-100 dark:bg-teal-900/30",
  },
};

interface ReasonIconProps {
  reason: ReasonTag;
  showLabel?: boolean;
  size?: "sm" | "md";
}

export function ReasonIcon({ reason, showLabel = false, size = "sm" }: ReasonIconProps) {
  const config = REASON_CONFIG[reason] ?? REASON_CONFIG.topic_match;
  const Icon = config.icon;
  const iconSize = size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4";

  return (
    <span
      className={`inline-flex items-center gap-1 ${config.color}`}
      title={config.label}
    >
      <Icon className={iconSize} />
      {showLabel && <span className="text-xs">{config.label}</span>}
    </span>
  );
}
