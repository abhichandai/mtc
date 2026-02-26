'use client';

import { useEffect, useState, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import TrendDetail from '../components/TrendDetail';

// ─── TEST MODE ────────────────────────────────────────────────────────────────
// Flip to false for production. When true:
//   • Skips Claude analyze-niche call (uses hardcoded subreddits)
//   • Fetches only 5 Reddit posts instead of 25
//   • Shows only 3 trend cards
//   • Skips all Twitter enrichment requests
// ─────────────────────────────────────────────────────────────────────────────
const TEST_MODE = true;
const TEST_SUBREDDITS = ['entrepreneur', 'productivity'];
const TEST_CARD_LIMIT = 3;
const TEST_FETCH_LIMIT = 5;

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

function TrendCard({ trend, index, isSelected, onClick }: {
  trend: Trend;
  index: number;
  isSelected: boolean;
  onClick: () => void;
}) {
  const tweets = trend.tweets || [];
  const isHot = (trend.score || 0) > 1000 || (trend.num_comments || 0) > 200;

  return (
    <div
      className={`card animate-fade-up stagger-${Math.min(index + 1, 6)} ${isSelected ? 'card-selected' : ''}`}
      onClick={onClick}
      style={{ padding: '20px' }}
    >
      {/* Subreddit + rank */}
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
        <span style={{
          fontSize: 11, fontWeight: 700, color: 'var(--text-dim)',
          background: 'var(--surface-2)',
          borderRadius: 6, padding: '4px 8px',
        }}>
          #{index + 1}
        </span>
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
  const keywordsParam = searchParams.get('k') || '';
  const keywords = keywordsParam.split(',').filter(Boolean);

  const [result, setResult] = useState<ApiResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTrend, setSelectedTrend] = useState<Trend | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string>('');
  // Cache narratives by post URL so they don't regenerate on every open
  const [narrativesCache, setNarrativesCache] = useState<Record<string, {
    narratives: Array<{headline: string; insight: string; angle: string}>;
    post_body: string;
    comment_count: number;
  }>>({});

  const fetchTrends = useCallback(async () => {
    if (!keywords.length) { router.push('/'); return; }
    setLoading(true);
    setError(null);
    setNarrativesCache({});
    try {
      let subreddits: string[];
      let nicheDescription: string;

      if (TEST_MODE) {
        // ── TEST MODE: skip Claude call, use hardcoded subreddits ──────────────
        subreddits = TEST_SUBREDDITS;
        nicheDescription = `[TEST] ${keywords.join(', ')}`;
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
        nicheDescription = nicheData.description || keywords.join(', ');
      }

      // ── Fetch Reddit posts ──────────────────────────────────────────────────
      const fetchLimit = TEST_MODE ? TEST_FETCH_LIMIT : 25;
      const redditRes = await fetch(
        `/api/reddit-for-trend?subreddits=${subreddits.join(',')}&limit=${fetchLimit}`,
        { signal: AbortSignal.timeout(20000) }
      );
      const redditData = await redditRes.json();

      if (!redditData.success || !redditData.posts?.length) {
        throw new Error('No posts returned from Reddit');
      }

      // ── Slice to card limit ────────────────────────────────────────────────
      const cardLimit = TEST_MODE ? TEST_CARD_LIMIT : 10;
      const topPosts = redditData.posts.slice(0, cardLimit);

      // ── Twitter enrichment (skipped in test mode) ──────────────────────────
      let trends: Trend[];
      if (TEST_MODE) {
        trends = topPosts.map((post: Trend) => ({ ...post, tweets: [] }));
      } else {
        const enriched = await Promise.allSettled(
          topPosts.map(async (post: Trend) => {
            try {
              const twitterRes = await fetch(
                `/api/twitter-for-trend?query=${encodeURIComponent(post.title || '')}&limit=5`,
                { signal: AbortSignal.timeout(6000) }
              );
              if (!twitterRes.ok) return { ...post, tweets: [], twitterError: true };
              const td = await twitterRes.json();
              return { ...post, tweets: td.data?.tweets?.slice(0, 5) || [] };
            } catch {
              return { ...post, tweets: [], twitterError: true };
            }
          })
        );
        trends = enriched
          .filter(r => r.status === 'fulfilled')
          .map(r => (r as PromiseFulfilledResult<Trend>).value);
      }

      setResult({
        success: true,
        niche: {
          keywords,
          description: nicheDescription,
          subreddits,
        },
        trends,
        total_analyzed: redditData.count || 0,
        source: 'reddit',
      });
      setLastUpdated(new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }, [keywords.join(',')]);

  useEffect(() => { fetchTrends(); }, [fetchTrends]);

  if (!keywords.length) return null;

  return (
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <button onClick={() => router.push('/')} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
            <div className="live-dot" />
            <span style={{ fontWeight: 800, fontSize: 14, color: 'var(--text)', letterSpacing: '-0.01em' }}>MTC</span>
          </button>
          <div style={{ width: 1, height: 20, background: 'var(--border)' }} />
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {keywords.map((kw, i) => (
              <span key={i} className="tag tag-neutral" style={{ fontSize: 11 }}>{kw}</span>
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {lastUpdated && <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>Updated {lastUpdated}</span>}
          <button className="btn-ghost" onClick={fetchTrends} disabled={loading} style={{ fontSize: 12, padding: '6px 12px' }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
              style={{ animation: loading ? 'spin 0.8s linear infinite' : 'none' }}>
              <path d="M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
            </svg>
            Refresh
          </button>
          <button className="btn-ghost" onClick={() => router.push('/')} style={{ fontSize: 12, padding: '6px 12px' }}>
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
                  Finding what <strong style={{ color: 'var(--accent)' }}>{keywordsParam}</strong> communities are talking about...
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
            <button className="btn-primary" onClick={fetchTrends} style={{ margin: '0 auto' }}>
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
            width: 'min(680px, 95vw)',
            height: 'min(88vh, 860px)',
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
              onClose={() => setSelectedTrend(null)}
              cachedNarratives={selectedTrend.url ? narrativesCache[selectedTrend.url] : undefined}
              onNarrativesCached={(url, data) => setNarrativesCache(prev => ({ ...prev, [url]: data }))}
            />
          </div>
        </>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
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



