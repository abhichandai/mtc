// /root/clawd/mtc-frontend/app/components/TwitterSection.tsx
//
// Drop this file into app/components/ and import it in page.tsx.
// Usage: <TwitterSection query={trend.query} />

"use client";

import { useState, useCallback } from "react";

// ── Types ──────────────────────────────────────────────────────────────────────

interface Tweet {
  id: string;
  text: string;
  author: string;
  author_name: string;
  created_at: string;
  likes: number;
  retweets: number;
  replies: number;
  engagement_score: number;
  url: string;
}

interface TwitterResponse {
  success: boolean;
  query: string;
  count: number;
  tweets: Tweet[];
  fetched_at: string;
  cached: boolean;
  error?: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function TweetCard({ tweet }: { tweet: Tweet }) {
  const [expanded, setExpanded] = useState(false);
  const isLong = tweet.text.length > 200;
  const displayText = !isLong || expanded ? tweet.text : tweet.text.slice(0, 200) + "…";

  return (
    <a
      href={tweet.url}
      target="_blank"
      rel="noopener noreferrer"
      className="block group"
      onClick={(e) => {
        // Allow "Read more" click without navigating
        if ((e.target as HTMLElement).dataset.readmore) {
          e.preventDefault();
        }
      }}
    >
      <div className="bg-gray-900/60 border border-gray-700/50 rounded-xl p-4 hover:border-sky-500/40 hover:bg-gray-900/80 transition-all duration-200">
        {/* Author row */}
        <div className="flex items-center justify-between mb-2 gap-2">
          <div className="flex items-center gap-2 min-w-0">
            {/* Avatar placeholder */}
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-sky-500 to-blue-700 flex items-center justify-center text-white text-xs font-bold flex-shrink-0 select-none">
              {tweet.author_name.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-white truncate leading-tight">
                {tweet.author_name}
              </p>
              <p className="text-xs text-gray-500 truncate leading-tight">
                @{tweet.author}
              </p>
            </div>
          </div>
          <span className="text-xs text-gray-500 flex-shrink-0 group-hover:text-sky-400 transition-colors">
            {tweet.created_at ? relativeTime(tweet.created_at) : ""}
          </span>
        </div>

        {/* Tweet text */}
        <p className="text-sm text-gray-300 leading-relaxed mb-3">
          {displayText}
          {isLong && (
            <button
              data-readmore="1"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setExpanded((v) => !v);
              }}
              className="ml-1 text-sky-400 hover:text-sky-300 text-xs font-medium"
            >
              {expanded ? "Show less" : "Read more"}
            </button>
          )}
        </p>

        {/* Engagement metrics */}
        <div className="flex items-center gap-4 text-xs text-gray-500">
          <span className="flex items-center gap-1">
            <span>💙</span>
            <span>{formatCount(tweet.likes)}</span>
          </span>
          <span className="flex items-center gap-1">
            <span>🔁</span>
            <span>{formatCount(tweet.retweets)}</span>
          </span>
          <span className="flex items-center gap-1">
            <span>💬</span>
            <span>{formatCount(tweet.replies)}</span>
          </span>
          <span className="ml-auto text-sky-500/60 group-hover:text-sky-400 transition-colors">
            ↗ View
          </span>
        </div>
      </div>
    </a>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-3 animate-pulse">
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="bg-gray-900/60 border border-gray-700/30 rounded-xl p-4"
        >
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-full bg-gray-700" />
            <div className="space-y-1 flex-1">
              <div className="h-3 bg-gray-700 rounded w-24" />
              <div className="h-2 bg-gray-700 rounded w-16" />
            </div>
          </div>
          <div className="space-y-2">
            <div className="h-3 bg-gray-700 rounded w-full" />
            <div className="h-3 bg-gray-700 rounded w-4/5" />
            <div className="h-3 bg-gray-700 rounded w-3/5" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

interface TwitterSectionProps {
  query: string;
}

type FetchState = "idle" | "loading" | "success" | "error";

export default function TwitterSection({ query }: TwitterSectionProps) {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<FetchState>("idle");
  const [tweets, setTweets] = useState<Tweet[]>([]);
  const [errorMsg, setErrorMsg] = useState("");
  const [isCached, setIsCached] = useState(false);
  const [fetchedOnce, setFetchedOnce] = useState(false);

  const fetchTweets = useCallback(async () => {
    if (fetchedOnce) return; // Don't re-fetch once we have data

    setState("loading");
    setFetchedOnce(true);

    try {
      const res = await fetch(
        `/api/twitter-for-trend?query=${encodeURIComponent(query)}&limit=10`
      );
      const data: TwitterResponse = await res.json();

      if (!data.success || !data.tweets) {
        throw new Error(data.error ?? "No tweets returned");
      }

      setTweets(data.tweets);
      setIsCached(data.cached);
      setState("success");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Something went wrong";
      setErrorMsg(message);
      setState("error");
    }
  }, [query, fetchedOnce]);

  const handleToggle = () => {
    const next = !open;
    setOpen(next);
    if (next && state === "idle") {
      fetchTweets();
    }
  };

  const handleRetry = () => {
    setFetchedOnce(false);
    setState("idle");
    setErrorMsg("");
    fetchTweets();
  };

  return (
    <div className="mt-4 border-t border-gray-700/50 pt-4">
      {/* Toggle button */}
      <button
        onClick={handleToggle}
        className="w-full flex items-center justify-between text-left group"
        aria-expanded={open}
      >
        <span className="flex items-center gap-2 text-sm font-medium text-gray-400 group-hover:text-sky-400 transition-colors">
          <span className="text-base">💬</span>
          <span>See what people are saying</span>
          {state === "success" && tweets.length > 0 && (
            <span className="text-xs bg-sky-500/10 text-sky-400 border border-sky-500/20 px-2 py-0.5 rounded-full">
              {tweets.length} tweets
            </span>
          )}
          {isCached && (
            <span className="text-xs text-gray-600">· cached</span>
          )}
        </span>

        {/* Chevron */}
        <svg
          className={`w-4 h-4 text-gray-500 group-hover:text-sky-400 transition-all duration-300 ${
            open ? "rotate-180" : "rotate-0"
          }`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Expandable content */}
      <div
        className={`overflow-hidden transition-all duration-300 ease-in-out ${
          open ? "max-h-[2000px] opacity-100 mt-4" : "max-h-0 opacity-0"
        }`}
      >
        {state === "loading" && <LoadingSkeleton />}

        {state === "error" && (
          <div className="bg-red-900/20 border border-red-700/30 rounded-xl p-4 text-center">
            <p className="text-sm text-red-400 mb-3">⚠️ {errorMsg}</p>
            <button
              onClick={handleRetry}
              className="text-xs text-red-300 hover:text-white border border-red-700/40 hover:border-red-500 px-3 py-1.5 rounded-lg transition-colors"
            >
              Try again
            </button>
          </div>
        )}

        {state === "success" && tweets.length === 0 && (
          <div className="bg-gray-900/40 border border-gray-700/30 rounded-xl p-6 text-center">
            <p className="text-sm text-gray-500">
              No recent tweets found for this trend.
            </p>
          </div>
        )}

        {state === "success" && tweets.length > 0 && (
          <div className="space-y-3">
            {tweets.map((tweet) => (
              <TweetCard key={tweet.id} tweet={tweet} />
            ))}
            <p className="text-center text-xs text-gray-600 pt-1">
              Sorted by engagement ·{" "}
              <a
                href={`https://twitter.com/search?q=${encodeURIComponent(query)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sky-600 hover:text-sky-400"
              >
                View all on X/Twitter ↗
              </a>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
