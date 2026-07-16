"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { SourceManager } from "@/components/SourceManager";
import { TopicManager } from "@/components/TopicManager";
import { TopicScoreChart } from "@/components/TopicScoreChart";

export default function SettingsPage() {
  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="mx-auto max-w-2xl px-4 py-8">
        <div className="flex items-center gap-3 mb-8">
          <Link
            href="/"
            className="rounded-full p-2 hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors"
          >
            <ArrowLeft className="h-5 w-5 text-gray-600 dark:text-gray-400" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              Settings
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Manage your topics and content sources
            </p>
          </div>
        </div>

        <section className="mb-10">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
            Your Topics
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
            Topics steer ranking — items matching them are scored higher during
            curation.
          </p>
          <TopicManager />
        </section>

        <section className="mb-10">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
            Topic Affinity
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
            How closely each topic matches your recent activity, ranked highest
            first.
          </p>
          <TopicScoreChart />
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
            Content Sources
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
            Toggle sources on or off to customize your digest. Add custom
            sources like RSS feeds, subreddits, YouTube channels, or BlueSky
            accounts.
          </p>
          <SourceManager />
        </section>
      </div>
    </main>
  );
}
