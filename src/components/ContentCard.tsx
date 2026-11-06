"use client";

import { useEffect, useRef, useState } from "react";
import {
  ExternalLink,
  MessageSquare,
  ArrowUp,
  Heart,
  Repeat2,
} from "lucide-react";
import { SourceBadge } from "./SourceBadge";
import { ExplanationBadge } from "./ExplanationBadge";
import { FeedbackBar } from "./FeedbackBar";
import { useInteraction } from "@/hooks/useInteraction";
import type { CuratedContentItem } from "@/types";

interface ContentCardProps {
  item: CuratedContentItem;
  onSaveChange?: (saved: boolean) => void;
}

const UNDO_WINDOW_MS = 5000;

type Hidden = { kind: "dismiss" | "less_like_this"; wasSaved: boolean };

export function ContentCard({ item, onSaveChange }: ContentCardProps) {
  const [hidden, setHidden] = useState<Hidden | null>(null);
  const [gone, setGone] = useState(false);
  const [saved, setSaved] = useState(item.saved);
  const { record } = useInteraction();
  const metadata = item.metadata as Record<string, number | string>;
  // A ref, so a parent re-render passing a new callback doesn't restart the Undo timer.
  const onSaveChangeRef = useRef(onSaveChange);
  useEffect(() => {
    onSaveChangeRef.current = onSaveChange;
  });

  // After the Undo window the hide is final.
  useEffect(() => {
    if (!hidden) return;
    const timer = setTimeout(() => {
      setGone(true);
      if (hidden.kind === "less_like_this" && hidden.wasSaved) {
        setSaved(false);
        onSaveChangeRef.current?.(false);
      }
    }, UNDO_WINDOW_MS);
    return () => clearTimeout(timer);
  }, [hidden]);

  const handleSaveChange = (next: boolean) => {
    setSaved(next);
    onSaveChange?.(next);
  };

  // Undo withdraws the Interaction; a Less Like This that cleared a Save
  // restores the Save (which also clears Less Like This).
  const undo = () => {
    if (!hidden) return;
    if (hidden.kind === "dismiss") record(item.id, "dismiss", false);
    else if (hidden.wasSaved) record(item.id, "save", true);
    else record(item.id, "less_like_this", false);
    setHidden(null);
  };

  if (gone) return null;

  if (hidden) {
    return (
      <div
        role="status"
        className="flex items-center justify-between rounded-xl border border-dashed border-gray-200 dark:border-gray-800 px-4 py-3 text-sm text-gray-500 dark:text-gray-400"
      >
        <span>Hidden</span>
        <button
          onClick={undo}
          className="font-medium text-blue-600 dark:text-blue-400 hover:underline"
        >
          Undo
        </button>
      </div>
    );
  }

  const timeAgo = item.publishedAt
    ? formatTimeAgo(new Date(item.publishedAt))
    : "";

  return (
    <article className="group relative min-w-0 overflow-hidden flex flex-col rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 shadow-sm hover:shadow-md hover:border-gray-300 dark:hover:border-gray-700 transition-all duration-200">
      <div className="flex items-center justify-between gap-2 mb-3">
        <SourceBadge
          sourceType={item.sourceType}
          sourceName={item.sourceName}
        />
        {timeAgo && (
          <span className="text-xs text-gray-400 dark:text-gray-500">
            {timeAgo}
          </span>
        )}
      </div>

      <a
        href={item.url}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => record(item.id, "click")}
        className="group/link flex-1"
      >
        {item.thumbnailUrl && (
          <div className="relative -mx-4 -mt-1 mb-3 overflow-hidden rounded-t-lg">
            <img
              src={item.thumbnailUrl}
              alt=""
              className="w-full h-40 object-cover bg-gray-100 dark:bg-gray-800"
              loading="lazy"
            />
            {(item.type === "video" || item.type === "short") && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                <div className="rounded-full bg-black/60 p-3">
                  <svg
                    className="h-6 w-6 text-white ml-0.5"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </div>
              </div>
            )}
          </div>
        )}
        {item.type === "social" && !item.thumbnailUrl ? (
          <blockquote className="border-l-2 border-sky-400 dark:border-sky-600 pl-3 mb-2 min-w-0">
            <p className="text-sm leading-relaxed break-words text-gray-800 dark:text-gray-200 group-hover/link:text-blue-600 dark:group-hover/link:text-blue-400 transition-colors">
              {item.title}
              <ExternalLink className="inline-block h-3.5 w-3.5 ml-1 opacity-0 group-hover/link:opacity-100 transition-opacity" />
            </p>
          </blockquote>
        ) : (
          <h3 className="text-sm font-semibold leading-snug break-words text-gray-900 dark:text-gray-100 group-hover/link:text-blue-600 dark:group-hover/link:text-blue-400 transition-colors mb-2">
            {item.title}
            <ExternalLink className="inline-block h-3.5 w-3.5 ml-1 opacity-0 group-hover/link:opacity-100 transition-opacity" />
          </h3>
        )}
        {item.summary && (
          <p className="text-xs break-words text-gray-500 dark:text-gray-400 line-clamp-2 mb-3">
            {item.summary}
          </p>
        )}
      </a>

      <div className="flex items-center gap-3 text-xs text-gray-400 dark:text-gray-500 mb-3 flex-wrap">
        {typeof metadata.score === "number" && metadata.score > 0 && (
          <span className="flex items-center gap-1">
            <ArrowUp className="h-3 w-3" />
            {metadata.score}
          </span>
        )}
        {typeof metadata.likeCount === "number" && metadata.likeCount > 0 && (
          <span className="flex items-center gap-1">
            <Heart className="h-3 w-3" />
            {metadata.likeCount}
          </span>
        )}
        {typeof metadata.repostCount === "number" &&
          metadata.repostCount > 0 && (
            <span className="flex items-center gap-1">
              <Repeat2 className="h-3 w-3" />
              {metadata.repostCount}
            </span>
          )}
        {typeof metadata.commentCount === "number" &&
          metadata.commentCount > 0 && (
            <a
              href={
                (metadata.hnUrl as string) ??
                (metadata.redditUrl as string) ??
                (metadata.bskyUrl as string) ??
                item.url
              }
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            >
              <MessageSquare className="h-3 w-3" />
              {metadata.commentCount}
            </a>
          )}
        {typeof metadata.replyCount === "number" && metadata.replyCount > 0 && (
          <a
            href={(metadata.bskyUrl as string) ?? item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            <MessageSquare className="h-3 w-3" />
            {metadata.replyCount}
          </a>
        )}
        {typeof metadata.viewCount === "number" && metadata.viewCount > 0 && (
          <span className="flex items-center gap-1">
            {formatCount(metadata.viewCount)} views
          </span>
        )}
        {item.author && <span>by {item.author}</span>}
      </div>

      <div className="mt-auto pt-3 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between gap-2">
        {item.explanation ? (
          <ExplanationBadge
            explanation={item.explanation}
            score={item.score}
            reason={item.reason}
          />
        ) : (
          <span />
        )}
        <FeedbackBar
          contentItemId={item.id}
          initialSaved={saved}
          initialLessLikeThis={false}
          onSaveChange={handleSaveChange}
          onHide={(kind) => setHidden({ kind, wasSaved: saved })}
        />
      </div>
    </article>
  );
}

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function formatTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
