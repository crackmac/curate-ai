"use client";

import { Bookmark, X, ThumbsDown } from "lucide-react";
import { useInteraction } from "@/hooks/useInteraction";
import { useState } from "react";

interface FeedbackBarProps {
  contentItemId: number;
  onDismiss: () => void;
}

export function FeedbackBar({ contentItemId, onDismiss }: FeedbackBarProps) {
  const { record } = useInteraction();
  const [saved, setSaved] = useState(false);
  const [disliked, setDisliked] = useState(false);

  return (
    <div className="flex items-center gap-1">
      <button
        onClick={() => {
          setSaved(!saved);
          record(contentItemId, "save");
        }}
        className={`rounded-md p-1.5 transition-colors ${
          saved
            ? "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30"
            : "text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
        }`}
        title="Save"
      >
        <Bookmark className="h-4 w-4" fill={saved ? "currentColor" : "none"} />
      </button>
      <button
        onClick={() => {
          setDisliked(!disliked);
          record(contentItemId, "less_like_this");
        }}
        className={`rounded-md p-1.5 transition-colors ${
          disliked
            ? "text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30"
            : "text-gray-400 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-gray-100 dark:hover:bg-gray-800"
        }`}
        title="Less like this"
      >
        <ThumbsDown className="h-4 w-4" fill={disliked ? "currentColor" : "none"} />
      </button>
      <button
        onClick={() => {
          record(contentItemId, "dismiss");
          onDismiss();
        }}
        className="rounded-md p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        title="Hide"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
