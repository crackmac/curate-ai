"use client";

import { useState } from "react";
import { X, Plus } from "lucide-react";
import { usePreferences } from "@/hooks/usePreferences";

export function TopicManager() {
  const { topics, isLoading, save } = usePreferences();
  const [input, setInput] = useState("");

  const addTopic = () => {
    const value = input.trim().toLowerCase();
    if (!value || topics.includes(value)) {
      setInput("");
      return;
    }
    save({ topics: [...topics, value] });
    setInput("");
  };

  const removeTopic = (topic: string) => {
    save({ topics: topics.filter((t) => t !== topic) });
  };

  if (isLoading) {
    return <p className="text-sm text-gray-400">Loading topics…</p>;
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-2">
        {topics.length === 0 && (
          <p className="text-sm text-gray-400">
            No topics yet. Add keywords that describe what you want to read.
          </p>
        )}
        {topics.map((topic) => (
          <span
            key={topic}
            className="inline-flex items-center gap-1 rounded-full bg-blue-100 dark:bg-blue-950 px-3 py-1 text-sm text-blue-700 dark:text-blue-300"
          >
            {topic}
            <button
              onClick={() => removeTopic(topic)}
              className="rounded-full hover:bg-blue-200 dark:hover:bg-blue-900"
              aria-label={`Remove ${topic}`}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </span>
        ))}
      </div>

      <div className="flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addTopic();
            }
          }}
          placeholder="Add a topic or keyword…"
          className="flex-1 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:border-blue-400 focus:outline-none"
        />
        <button
          onClick={addTopic}
          className="flex items-center gap-1 rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950 px-3 py-2 text-sm text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Add
        </button>
      </div>
    </div>
  );
}
