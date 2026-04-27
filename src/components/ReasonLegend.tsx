"use client";

import { useState } from "react";
import { HelpCircle, X } from "lucide-react";
import { REASON_CONFIG } from "./ReasonIcon";
import type { ReasonTag } from "@/types";

const LEGEND_ORDER: ReasonTag[] = [
  "topic_match",
  "trending",
  "saved_similar",
  "high_engagement",
  "breaking",
  "deep_dive",
  "community_pick",
  "broadening",
];

export function ReasonLegend() {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-1.5 text-xs text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
      >
        <HelpCircle className="h-3.5 w-3.5" />
        Why these?
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 z-50 w-72 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 shadow-lg">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              How we pick your content
            </h3>
            <button
              onClick={() => setOpen(false)}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="space-y-2.5">
            {LEGEND_ORDER.map((reason) => {
              const config = REASON_CONFIG[reason];
              const Icon = config.icon;
              return (
                <div key={reason} className="flex items-center gap-2.5">
                  <span className={`flex items-center justify-center rounded-md p-1 ${config.bg}`}>
                    <Icon className={`h-3.5 w-3.5 ${config.color}`} />
                  </span>
                  <span className="text-xs text-gray-700 dark:text-gray-300">
                    {config.label}
                  </span>
                </div>
              );
            })}
          </div>
          <p className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800 text-[11px] text-gray-400 dark:text-gray-500">
            Each card shows why it was selected. Click the icon on any card for details.
          </p>
        </div>
      )}
    </div>
  );
}
