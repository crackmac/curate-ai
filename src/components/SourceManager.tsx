"use client";

import { useState, useEffect } from "react";
import { Plus, AlertTriangle, Rss, Globe } from "lucide-react";

interface SourceItem {
  id: number;
  slug: string;
  name: string;
  type: string;
  url: string | null;
  description: string | null;
  isDefault: boolean;
  vetted: boolean;
  enabled: boolean;
  addedByUser: boolean;
}

const typeIcons: Record<string, string> = {
  hackernews: "Y",
  reddit: "r/",
  rss: "",
  youtube: "",
  bluesky: "",
};

const typeColors: Record<string, string> = {
  hackernews: "text-orange-500",
  reddit: "text-red-500",
  rss: "text-blue-500",
  youtube: "text-rose-500",
  bluesky: "text-sky-500",
};

export function SourceManager() {
  const [sources, setSources] = useState<SourceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);

  useEffect(() => {
    fetchSources();
  }, []);

  async function fetchSources() {
    const res = await fetch("/api/sources");
    if (res.ok) setSources(await res.json());
    setLoading(false);
  }

  async function toggleSource(sourceId: number, enabled: boolean) {
    setSources((prev) =>
      prev.map((s) => (s.id === sourceId ? { ...s, enabled } : s))
    );
    await fetch("/api/sources", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sourceId, enabled }),
    });
  }

  async function addSource(data: { name: string; type: string; url: string; config: Record<string, unknown>; description: string }) {
    const res = await fetch("/api/sources", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (res.ok) {
      setShowAdd(false);
      fetchSources();
    }
  }

  if (loading) {
    return <div className="animate-pulse space-y-3">{Array.from({ length: 5 }, (_, i) => <div key={i} className="h-14 bg-gray-100 dark:bg-gray-800 rounded-lg" />)}</div>;
  }

  const grouped = sources.reduce<Record<string, SourceItem[]>>((acc, s) => {
    (acc[s.type] ??= []).push(s);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      {Object.entries(grouped).map(([type, items]) => (
        <div key={type}>
          <h3 className={`text-sm font-semibold uppercase tracking-wide mb-2 ${typeColors[type] ?? "text-gray-500"}`}>
            {type}
          </h3>
          <div className="space-y-2">
            {items.map((source) => (
              <div
                key={source.id}
                className="flex items-center justify-between rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-4 py-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className={`text-sm font-bold ${typeColors[type] ?? ""}`}>
                    {typeIcons[type] ?? ""}
                  </span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                        {source.name}
                      </span>
                      {!source.vetted && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 dark:bg-amber-900/30 px-2 py-0.5 text-xs text-amber-700 dark:text-amber-300">
                          <AlertTriangle className="h-3 w-3" />
                          Unvetted
                        </span>
                      )}
                    </div>
                    {source.description && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                        {source.description}
                      </p>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => toggleSource(source.id, !source.enabled)}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ${
                    source.enabled
                      ? "bg-blue-600"
                      : "bg-gray-200 dark:bg-gray-700"
                  }`}
                >
                  <span
                    className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform duration-200 ${
                      source.enabled ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>
            ))}
          </div>
        </div>
      ))}

      {showAdd ? (
        <AddSourceForm onAdd={addSource} onCancel={() => setShowAdd(false)} />
      ) : (
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-700 px-4 py-3 text-sm text-gray-500 hover:border-gray-400 dark:hover:border-gray-600 hover:text-gray-700 dark:hover:text-gray-300 transition-colors w-full"
        >
          <Plus className="h-4 w-4" />
          Add custom source
        </button>
      )}
    </div>
  );
}

function AddSourceForm({
  onAdd,
  onCancel,
}: {
  onAdd: (data: { name: string; type: string; url: string; config: Record<string, unknown>; description: string }) => void;
  onCancel: () => void;
}) {
  const [type, setType] = useState("rss");
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [description, setDescription] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name || !url) return;

    let config: Record<string, unknown> = {};
    if (type === "rss") config = { feedUrl: url };
    else if (type === "reddit") config = { subreddit: url.replace(/^\/?(r\/)?/, "") };
    else if (type === "youtube") config = { channelId: url };
    else if (type === "bluesky") config = { actor: url };

    onAdd({ name, type, url, config, description });
  }

  const placeholders: Record<string, string> = {
    rss: "https://example.com/feed.xml",
    reddit: "r/subredditname",
    youtube: "UCxxxxxxxxxxxxxxxx (channel ID)",
    bluesky: "handle.bsky.social",
  };

  return (
    <form onSubmit={handleSubmit} className="rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Type</label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
          >
            <option value="rss">RSS Feed</option>
            <option value="reddit">Reddit Subreddit</option>
            <option value="youtube">YouTube Channel</option>
            <option value="bluesky">BlueSky Account</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Source name"
            className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
          />
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">URL / Identifier</label>
        <input
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder={placeholders[type] ?? "URL"}
          className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Description (optional)</label>
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What kind of content?"
          className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
        />
      </div>
      <div className="flex items-center gap-2 pt-1">
        <button
          type="submit"
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
        >
          Add Source
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md px-4 py-2 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
