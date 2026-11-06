"use client";

import { Bookmark, X, ThumbsDown } from "lucide-react";
import { useInteraction } from "@/hooks/useInteraction";
import { useState } from "react";

interface FeedbackBarProps {
  contentItemId: number;
  initialSaved: boolean;
  initialLessLikeThis: boolean;
  onSaveChange?: (saved: boolean) => void;
  // Called when Dismiss or Less Like This hides the card.
  onHide: (kind: "dismiss" | "less_like_this") => void;
}

export function FeedbackBar({
  contentItemId,
  initialSaved,
  initialLessLikeThis,
  onSaveChange,
  onHide,
}: FeedbackBarProps) {
  const { record } = useInteraction();
  const [saved, setSaved] = useState(initialSaved);
  const [disliked, setDisliked] = useState(initialLessLikeThis);

  return (
    <div className="flex items-center gap-1">
      <button
        onClick={() => {
          // Mutually exclusive with Less Like This (the API enforces it too).
          setSaved(!saved);
          if (!saved) setDisliked(false);
          record(contentItemId, "save", !saved);
          onSaveChange?.(!saved);
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
          // Turning it on also clears a Save (mutually exclusive) and hides the card.
          setDisliked(!disliked);
          if (!disliked) setSaved(false);
          record(contentItemId, "less_like_this", !disliked);
          if (!disliked) onHide("less_like_this");
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
          onHide("dismiss");
        }}
        className="rounded-md p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        title="Hide"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
