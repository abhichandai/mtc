'use client';

import { useEffect, useState, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import TrendDetail from '../components/TrendDetail';
import AppShell from '../components/AppShell';

// ─── TEST MODE ────────────────────────────────────────────────────────────────
// Flip to false for production. When true:
//   • Skips Claude analyze-niche call (uses hardcoded subreddits)
//   • Fetches only 5 Reddit posts instead of 25
//   • Shows only 3 trend cards
//   • Skips all Twitter enrichment requests
// ─────────────────────────────────────────────────────────────────────────────
const TEST_MODE = false;
const TEST_SUBREDDITS = ['entrepreneur', 'productivity'];
const TEST_CARD_LIMIT = 3;
const TEST_FETCH_LIMIT = 5;

// ─── DASHBOARD CACHE ─────────────────────────────────────────────────────────
const CACHE_TTL_MS = 4 * 60 * 60 * 1000; // 4 hours

function getCacheKey(brief: string) {
  return `mtc_dashboard_${brief.trim().toLowerCase().slice(0, 100)}`;
}

function loadCache(brief: string): { result: ApiResult; subreddits: string[]; savedAt: number } | null {
  try {
    const raw = localStorage.getItem(getCacheKey(brief));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (Date.now() - parsed.savedAt > CACHE_TTL_MS) {
      localStorage.removeItem(getCacheKey(brief));
      return null;
    }
    return parsed;
  } catch { return null; }
}

function saveCache(brief: string, result: ApiResult, subreddits: string[]) {
  try {
    localStorage.setItem(getCacheKey(brief), JSON.stringify({ result, subreddits, savedAt: Date.now() }));
  } catch { /* storage full or unavailable — silently skip */ }
}

function clearCache(brief: string) {
  try { localStorage.removeItem(getCacheKey(brief)); } catch { /* ignore */ }
  clearAllNarrativeCaches();
}

// ─── NARRATIVE CACHE (localStorage) ──────────────────────────────────────────
const NARRATIVE_KEY_PREFIX = 'mtc_narrative_';

type NarrativeData = {
  narratives: Array<{headline: string; insight: string; angle?: string; type?: 'consensus' | 'contested' | 'contrarian'; signal?: string; content_ideas?: string[]}>;
  post_body: string;
  comment_count: number;
  generated_at: number;
};

function loadAllNarrativeCaches(): Record<string, NarrativeData> {
  try {
    const result: Record<string, NarrativeData> = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key?.startsWith(NARRATIVE_KEY_PREFIX)) continue;
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      result[key.slice(NARRATIVE_KEY_PREFIX.length)] = JSON.parse(raw);
    }
    return result;
  } catch { return {}; }
}

function saveNarrativeToCache(url: string, data: NarrativeData) {
  try { localStorage.setItem(`${NARRATIVE_KEY_PREFIX}${url.slice(0, 150)}`, JSON.stringify(data)); } catch { /* ignore */ }
}

function clearAllNarrativeCaches() {
  try {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(NARRATIVE_KEY_PREFIX)) keys.push(key);
    }
    keys.forEach(k => localStorage.removeItem(k));
  } catch { /* ignore */ }
}

function timeAgoMs(ts: number): string {
  const mins = Math.round((Date.now() - ts) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}
// ─────────────────────────────────────────────────────────────────────────────

interface Tweet {
  id?: string;
  text?: string;
  author?: string;
  author_name?: string;
  likes?: number;
  retweets?: number;
  replies?: number;
  created_at?: string;
  url?: string;
}

interface Trend {
  // Reddit fields
  id?: string;
  title?: string;
  preview?: string;
  score?: number;
  num_comments?: number;
  engagement?: number;
  subreddit?: string;
  url?: string;
  permalink?: string;
  is_text_post?: boolean;
  author?: string;
  flair?: string;
  upvote_ratio?: number;
  // Twitter enrichment
  tweets?: Tweet[];
  twitterError?: boolean;
}

interface NicheData {
  keywords: string[];
  description: string;
  subreddits?: string[];
}

interface ApiResult {
  success: boolean;
  niche: NicheData;
  trends: Trend[];
  total_analyzed: number;
  source?: string;
  error?: string;
}

function formatNumber(n?: number): string {
  if (!n) return '0';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return n.toString();
}

function TrendCardSkeleton() {
  return (
    <div className="card" style={{ padding: 20, pointerEvents: 'none' }}>
      <div className="skeleton" style={{ height: 14, width: '30%', marginBottom: 10 }} />
      <div className="skeleton" style={{ height: 20, width: '85%', marginBottom: 8 }} />
      <div className="skeleton" style={{ height: 16, width: '70%', marginBottom: 16 }} />
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <div className="skeleton" style={{ height: 24, width: 70 }} />
        <div className="skeleton" style={{ height: 24, width: 70 }} />
      </div>
      <div className="skeleton" style={{ height: 14, width: '100%', marginBottom: 6 }} />
      <div className="skeleton" style={{ height: 14, width: '80%' }} />
    </div>
  );
}

function TrendCard({ trend, index, isSelected, onClick, feedback, onFeedback }: {
  trend: Trend;
  index: number;
  isSelected: boolean;
  onClick: () => void;
  feedback?: 'up' | 'down' | null;
  onFeedback: (verdict: 'up' | 'down') => void;
}) {
  const tweets = trend.tweets || [];
  const isHot = (trend.score || 0) > 1000 || (trend.num_comments || 0) > 200;

  return (
    <div
      className={`card animate-fade-up stagger-${Math.min(index + 1, 6)} ${isSelected ? 'card-selected' : ''}`}
      onClick={onClick}
      style={{ padding: '20px' }}
    >
      {/* Subreddit + rank + thumbs */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {isHot ? <div className="hot-dot" /> : <div className="live-dot" />}
          <span style={{
            fontSize: 11, fontWeight: 700, letterSpacing: '0.04em',
            color: isHot ? 'var(--hot)' : 'var(--accent)',
            textTransform: 'uppercase',
          }}>
            r/{trend.subreddit || 'reddit'}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {/* Thumbs up */}
          <button
            onClick={e => { e.stopPropagation(); onFeedback('up'); }}
            title="Relevant"
            style={{
              background: feedback === 'up' ? 'rgba(22,163,74,0.12)' : 'none',
              border: `1px solid ${feedback === 'up' ? '#16a34a' : 'transparent'}`,
              borderRadius: 6, padding: '3px 5px', cursor: 'pointer',
              display: 'flex', alignItems: 'center',
              transition: 'all 0.15s',
            }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill={feedback === 'up' ? '#16a34a' : 'none'} stroke={feedback === 'up' ? '#16a34a' : 'var(--text-dim)'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3H14z"/>
              <path d="M7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/>
            </svg>
          </button>
          {/* Thumbs down */}
          <button
            onClick={e => { e.stopPropagation(); onFeedback('down'); }}
            title="Not relevant"
            style={{
              background: feedback === 'down' ? 'rgba(220,38,38,0.1)' : 'none',
              border: `1px solid ${feedback === 'down' ? '#dc2626' : 'transparent'}`,
              borderRadius: 6, padding: '3px 5px', cursor: 'pointer',
              display: 'flex', alignItems: 'center',
              transition: 'all 0.15s',
            }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill={feedback === 'down' ? '#dc2626' : 'none'} stroke={feedback === 'down' ? '#dc2626' : 'var(--text-dim)'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3H10z"/>
              <path d="M17 2h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17"/>
            </svg>
          </button>
          <span style={{
            fontSize: 11, fontWeight: 700, color: 'var(--text-dim)',
            background: 'var(--surface-2)',
            borderRadius: 6, padding: '4px 8px', marginLeft: 2,
          }}>
            #{index + 1}
          </span>
        </div>
      </div>

      {/* Title */}
      <h3 style={{
        fontSize: 15, fontWeight: 700, lineHeight: 1.35,
        color: 'var(--text)', letterSpacing: '-0.01em',
        marginBottom: 12,
        display: '-webkit-box',
        WebkitLineClamp: 3,
        WebkitBoxOrient: 'vertical' as const,
        overflow: 'hidden',
      }}>
        {trend.title}
      </h3>

      {/* Stats row */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill={isHot ? 'var(--hot)' : 'var(--accent)'}>
            <path d="M12 4l8 8h-5v8H9v-8H4z"/>
          </svg>
          <span style={{ fontSize: 13, fontWeight: 700, color: isHot ? 'var(--hot)' : 'var(--accent)' }}>
            {formatNumber(trend.score)}
          </span>
          <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>upvotes</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          </svg>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)' }}>
            {formatNumber(trend.num_comments)}
          </span>
          <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>comments</span>
        </div>
      </div>

      {/* Preview text */}
      {trend.preview && (
        <p style={{
          fontSize: 12, color: 'var(--text-dim)', lineHeight: 1.5,
          marginBottom: 14,
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical' as const,
          overflow: 'hidden',
        }}>
          {trend.preview}
        </p>
      )}

      {/* Twitter previews */}
      {tweets.length > 0 && (
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12, marginBottom: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="var(--text-dim)">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
            </svg>
            <span style={{ fontSize: 11, color: 'var(--text-dim)', fontWeight: 600 }}>
              {tweets.length} tweet{tweets.length !== 1 ? 's' : ''} found
            </span>
          </div>
          <div style={{
            fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.4,
            padding: '7px 10px',
            background: 'var(--surface-2)',
            borderRadius: 6,
            borderLeft: '2px solid var(--border-bright)',
            overflow: 'hidden',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical' as const,
          }}>
            {tweets[0]?.text || '...'}
          </div>
        </div>
      )}

      {/* View more */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'var(--text-dim)', marginTop: 4 }}>
        <span style={{ fontSize: 11, fontWeight: 600 }}>View full conversation</span>
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M5 12h14M12 5l7 7-7 7"/>
        </svg>
      </div>
    </div>
  );
}

function DashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [brief, setBrief] = useState<string>(searchParams.get('k') || '');
  const keywords = [brief]; // single-element array for backward compat with API

  const [result, setResult] = useState<ApiResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTrend, setSelectedTrend] = useState<Trend | null>(null);
  const handleClosePanel = useCallback(() => setSelectedTrend(null), []);
  const [lastUpdated, setLastUpdated] = useState<string>('');
  const [lastRefreshedAt, setLastRefreshedAt] = useState<number | null>(null);
  const [feedbackMap, setFeedbackMap] = useState<Record<string, 'up' | 'down'>>({});
  const [toast, setToast] = useState<{ message: string; type: 'up' | 'down' } | null>(null);
  // Cache narratives by post URL — seeded from localStorage so they survive navigation
  const [narrativesCache, setNarrativesCache] = useState<Record<string, NarrativeData>>(() => {
    try { return loadAllNarrativeCaches(); } catch { return {}; }
  });

  // If no brief in URL, load from profile
  useEffect(() => {
    if (brief) return;
    fetch('/api/profile')
      .then(r => r.json())
      .then(data => {
        const profileBrief = data.profile?.audience_brief;
        if (profileBrief) {
          setBrief(profileBrief);
        } else {
          router.push('/onboarding');
        }
      })
      .catch(() => router.push('/onboarding'));
  }, [brief, router]);

  const handleFeedback = useCallback(async (trend: Trend, verdict: 'up' | 'down') => {
    const key = trend.permalink || trend.url || trend.title || '';
    if (!key) return;

    const existing = feedbackMap[key];
    const isUndo = existing === verdict;

    // Optimistic update — clear if same verdict, set if new/different
    setFeedbackMap(prev => {
      const next = { ...prev };
      if (isUndo) delete next[key];
      else next[key] = verdict;
      return next;
    });

    // Toast
    if (isUndo) {
      setToast({ message: '↩️ Feedback removed', type: verdict });
    } else {
      setToast({ message: verdict === 'up' ? '👍 Got it — more like this' : '👎 Got it — less like this', type: verdict });
    }
    setTimeout(() => setToast(null), 3000);

    // Persist
    try {
      if (isUndo) {
        await fetch(`/api/relevance-feedback?post_url=${encodeURIComponent(trend.url || trend.permalink || '')}`, {
          method: 'DELETE',
        });
      } else {
        await fetch('/api/relevance-feedback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            post_url: trend.url || trend.permalink || '',
            post_title: trend.title || '',
            subreddit: trend.subreddit || '',
            verdict,
          }),
        });
      }
    } catch {
      // silently fail
    }
  }, [feedbackMap]);

  const fetchTrends = useCallback(async (forceRefresh = false) => {
    if (!brief) return;

    // ── Check cache first (unless forced refresh) ──────────────────────────
    if (!forceRefresh) {
      const cached = loadCache(brief);
      if (cached) {
        setResult(cached.result);
        setLastRefreshedAt(cached.savedAt);
        setLastUpdated(new Date(cached.savedAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }));
        setLoading(false);
        return;
      }
    }

    setLoading(true);
    setError(null);
    setNarrativesCache({});
    clearAllNarrativeCaches();
    try {
      let subreddits: string[];
      let nicheDescription: string;

      if (TEST_MODE) {
        // ── TEST MODE: skip Claude call, use hardcoded subreddits ──────────────
        subreddits = TEST_SUBREDDITS;
        nicheDescription = `[TEST] ${brief}`;
      } else {
        // ── PROD: ask Claude which subreddits match this niche ─────────────────
        const nicheRes = await fetch('/api/analyze-niche', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ keywords }),
        });
        const nicheData = await nicheRes.json();
        if (!nicheRes.ok || !nicheData.success) throw new Error(nicheData.error || 'Failed to analyze niche');
        subreddits = nicheData.subreddits || ['entrepreneur', 'productivity'];
        nicheDescription = nicheData.description || brief;
      }

      // ── Fetch Reddit posts ──────────────────────────────────────────────────
      const fetchLimit = TEST_MODE ? TEST_FETCH_LIMIT : 15;
      const redditRes = await fetch(
        `/api/reddit-for-trend?subreddits=${subreddits.join(',')}&limit=${fetchLimit}`,
        { signal: AbortSignal.timeout(20000) }
      );
      const redditData = await redditRes.json();

      if (!redditData.success || !redditData.posts?.length) {
        throw new Error('No posts returned from Reddit');
      }

      const cardLimit = TEST_MODE ? TEST_CARD_LIMIT : 12;
      const topPosts = redditData.posts.slice(0, cardLimit);
      const trends: Trend[] = topPosts.map((post: Trend) => ({ ...post, tweets: [] }));

      const freshResult: ApiResult = {
        success: true,
        niche: { keywords, description: nicheDescription, subreddits },
        trends,
        total_analyzed: redditData.count || 0,
        source: 'reddit',
      };

      const now = Date.now();
      saveCache(brief, freshResult, subreddits);
      setResult(freshResult);
      setLastRefreshedAt(now);
      setLastUpdated(new Date(now).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }, [brief]);

  useEffect(() => { fetchTrends(false); }, [fetchTrends]);

  if (!brief) return (
    <AppShell>
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
        <div style={{ width: 28, height: 28, border: '3px solid var(--border)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
      </div>
    </AppShell>
  );

  return (
    <AppShell>
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <header style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 24px', height: 56,
        borderBottom: '1px solid var(--border)',
        background: 'var(--overlay-bg)',
        backdropFilter: 'blur(10px)',
        position: 'sticky', top: 0, zIndex: 40,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div className="live-dot" />
          <span style={{ fontSize: 13, color: 'var(--text-muted)', maxWidth: 360, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {brief}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {lastRefreshedAt && (
            <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>
              Refreshed {timeAgoMs(lastRefreshedAt)}
            </span>
          )}
          <button className="btn-ghost" onClick={() => { clearCache(brief); fetchTrends(true); }} disabled={loading} style={{ fontSize: 12, padding: '6px 12px' }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
              style={{ animation: loading ? 'spin 0.8s linear infinite' : 'none' }}>
              <path d="M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
            </svg>
            Refresh
          </button>
          <button className="btn-ghost" onClick={() => router.push('/settings')} style={{ fontSize: 12, padding: '6px 12px' }}>
            Change niche
          </button>
        </div>
      </header>

      <main style={{ flex: 1, padding: '24px', maxWidth: 1200, width: '100%', margin: '0 auto' }}>

        {/* Test Mode Banner */}
        {TEST_MODE && (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            background: 'rgba(124, 92, 252, 0.08)',
            border: '1px solid rgba(124, 92, 252, 0.25)',
            borderRadius: 8,
            padding: '8px 14px',
            marginBottom: 20,
            flexWrap: 'wrap',
            gap: 8,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 13 }}>🧪</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent)', letterSpacing: '0.04em' }}>
                TEST MODE
              </span>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                · {TEST_CARD_LIMIT} cards · {TEST_FETCH_LIMIT} posts fetched · Claude + Twitter calls skipped
              </span>
            </div>
            <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>
              Set <code style={{ fontFamily: 'monospace', background: 'var(--surface-2)', padding: '1px 5px', borderRadius: 3 }}>TEST_MODE = false</code> in dashboard/page.tsx for production
            </span>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div>
            <div style={{ marginBottom: 24 }}>
              <div className="skeleton" style={{ height: 28, width: 280, marginBottom: 8 }} />
              <div className="skeleton" style={{ height: 16, width: 200 }} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 14 }}>
              {Array.from({ length: 6 }).map((_, i) => <TrendCardSkeleton key={i} />)}
            </div>
            <div style={{ marginTop: 40, textAlign: 'center' }}>
              <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                <div className="live-dot" style={{ width: 10, height: 10 }} />
                <p style={{ fontSize: 14, color: 'var(--text-muted)' }}>
                  Finding what <strong style={{ color: 'var(--accent)' }}>{brief}</strong> communities are talking about...
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Error */}
        {!loading && error && (
          <div style={{ textAlign: 'center', paddingTop: 80 }}>
            <div style={{ fontSize: 40, marginBottom: 16 }}>⚡</div>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>
              Couldn&apos;t load trends
            </h2>
            <p style={{ color: 'var(--text-muted)', marginBottom: 24, fontSize: 14 }}>{error}</p>
            <button className="btn-primary" onClick={() => fetchTrends(true)} style={{ margin: '0 auto' }}>
              Try again
            </button>
          </div>
        )}

        {/* Results */}
        {!loading && !error && result && (
          <div className="animate-fade-in">
            <div style={{ marginBottom: 24, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                  <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--text)' }}>
                    {result.trends.length} topics trending now
                  </h1>
                </div>
                {result.niche.description && (
                  <p style={{ fontSize: 14, color: 'var(--text-muted)' }}>{result.niche.description}</p>
                )}
              </div>
              {result.niche.subreddits && result.niche.subreddits.length > 0 && (
                <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', alignItems: 'center' }}>
                  <span style={{ fontSize: 11, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>
                    From:
                  </span>
                  {result.niche.subreddits.slice(0, 5).map((sub, i) => (
                    <span key={i} className="tag tag-neutral" style={{ fontSize: 10 }}>r/{sub}</span>
                  ))}
                </div>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 14 }}>
              {result.trends.map((trend, i) => (
                <TrendCard
                  key={trend.id || i}
                  trend={trend}
                  index={i}
                  isSelected={selectedTrend === trend}
                  onClick={() => setSelectedTrend(selectedTrend === trend ? null : trend)}
                  feedback={feedbackMap[trend.permalink || trend.url || trend.title || ''] ?? null}
                  onFeedback={(verdict) => handleFeedback(trend, verdict)}
                />
              ))}
            </div>

            {result.trends.length === 0 && (
              <div style={{ textAlign: 'center', paddingTop: 60 }}>
                <p style={{ fontSize: 18, color: 'var(--text-muted)', marginBottom: 8 }}>No posts found</p>
                <p style={{ fontSize: 14, color: 'var(--text-dim)' }}>Try different keywords</p>
              </div>
            )}
          </div>
        )}
      </main>

      {selectedTrend && (
        <>
          <div className="panel-overlay" onClick={() => setSelectedTrend(null)} />
          <div style={{
            position: 'fixed',
            top: '50%', left: '50%',
            transform: 'translate(-50%, -50%)',
            width: 'min(860px, 95vw)',
            height: 'min(90vh, 920px)',
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 16,
            zIndex: 51,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 24px 80px rgba(0,0,0,0.15)',
            animation: 'modal-in 0.2s ease',
          }}>
            <TrendDetail
              trend={selectedTrend}
              onClose={handleClosePanel}
              cachedNarratives={narrativesCache[selectedTrend.permalink || selectedTrend.url || '']}
              onNarrativesCached={(url, data) => { saveNarrativeToCache(url, data); setNarrativesCache(prev => ({ ...prev, [url]: data })); }}
              audienceBrief={brief}
              feedback={feedbackMap[selectedTrend.permalink || selectedTrend.url || selectedTrend.title || ''] ?? null}
              onFeedback={(verdict) => handleFeedback(selectedTrend, verdict)}
            />
          </div>
        </>
      )}

      {/* Toast notification */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: 32, left: '50%', transform: 'translateX(-50%)',
          background: toast.type === 'up' ? 'rgba(22,163,74,0.95)' : 'rgba(220,38,38,0.95)',
          color: '#fff', fontFamily: 'var(--font-ui)', fontWeight: 600, fontSize: 14,
          padding: '12px 20px', borderRadius: 10,
          boxShadow: '0 4px 24px rgba(0,0,0,0.2)',
          zIndex: 100, pointerEvents: 'none',
          animation: 'fadeInUp 0.2s ease',
        }}>
          {toast.message}
        </div>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeInUp { from { opacity: 0; transform: translateX(-50%) translateY(8px); } to { opacity: 1; transform: translateX(-50%) translateY(0); } }
      `}</style>
    </div>
    </AppShell>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="live-dot" style={{ width: 10, height: 10 }} />
      </div>
    }>
      <DashboardContent />
    </Suspense>
  );
}



