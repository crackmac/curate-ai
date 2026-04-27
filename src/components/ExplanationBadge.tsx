"use client";

import { useState } from "react";
import { ReasonIcon } from "./ReasonIcon";
import type { ReasonTag } from "@/types";

interface ExplanationBadgeProps {
  explanation: string;
  score?: number;
  reason?: ReasonTag;
}

export function ExplanationBadge({ explanation, score, reason }: ExplanationBadgeProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <button
      onClick={() => setExpanded(!expanded)}
      className="flex items-start gap-1.5 text-left text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
    >
      <span className="mt-0.5 shrink-0">
        <ReasonIcon reason={reason ?? "topic_match"} />
      </span>
      <span className={expanded ? "" : "line-clamp-1"}>
        {score != null && score > 0 && (
          <span className="font-medium text-gray-600 dark:text-gray-300 mr-1">
            {score}%
          </span>
        )}
        {explanation}
      </span>
    </button>
  );
}
