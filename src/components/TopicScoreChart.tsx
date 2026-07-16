"use client";

import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

interface TopicScore {
  topic: string;
  score: number;
}

interface TopicScoresResponse {
  scores: TopicScore[];
  cold: boolean;
}

export function TopicScoreChart() {
  const { data, isLoading } = useSWR<TopicScoresResponse>(
    "/api/preferences/topic-scores",
    fetcher
  );

  if (isLoading) {
    return <p className="text-sm text-gray-400">Computing affinity…</p>;
  }

  if (!data || data.scores.length === 0) {
    return (
      <p className="text-sm text-gray-400">
        Add topics above to see how strongly they match your interests.
      </p>
    );
  }

  if (data.cold) {
    return (
      <p className="text-sm text-gray-400">
        Interact with content (click or save items) to build affinity scores for
        your topics.
      </p>
    );
  }

  const maxScore = Math.max(...data.scores.map((s) => s.score), 1);

  return (
    <div className="space-y-2">
      {data.scores.map(({ topic, score }) => (
        <div key={topic} className="flex items-center gap-2 text-sm">
          <span className="w-32 shrink-0 truncate text-gray-700 dark:text-gray-300">
            {topic}
          </span>
          <div className="h-3 flex-1 rounded bg-gray-100 dark:bg-gray-800">
            <div
              className="h-3 rounded bg-blue-500"
              style={{ width: `${(score / maxScore) * 100}%` }}
            />
          </div>
          <span className="w-8 shrink-0 text-right text-xs text-gray-500">
            {score}
          </span>
        </div>
      ))}
    </div>
  );
}
