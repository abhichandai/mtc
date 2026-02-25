'use client';

import { useEffect, useState, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import TrendDetail from '../components/TrendDetail';

interface Tweet {
  id?: string;
  text?: string;
  author?: string;
  author_handle?: string;
  likes?: number;
  retweets?: number;
  replies?: number;
  created_at?: string;
}

interface Trend {
  // Reddit fields
  title?: string;
  score?: number;
  num_comments?: number;
  engagement?: number;
  subreddit?: string;
  preview?: string;
  flair?: string;
  source?: string;
  // Legacy Google Trends fields (kept for compatibility)
  query?: string;
  topic?: string;
  search_volume?: number;
  traffic?: number;
  increase_percentage?: number;
  growth?: number;
  categories?: Array<{ id?: number; name: string } | string>;
  related_searches?: string[];
  // Shared
  tweets?: Tweet[];
  twitterError?: boolean;
  relevanceScore?: number;
  url?: string;
}

interface NicheData {
  keywords: string[];
  description: string;
  categories: string[];
  subreddits?: string[];
}

interface ApiResult {
  success: boolean;
  niche: NicheData;
  trends: Trend[];
  total_analyzed: number;
  error?: string;
}

function formatNumber(n?: number): string {
  if (!n) return '—';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return n.toString();
}

function getTopicName(trend: Trend): string {
  return trend.title || trend.query || trend.topic || 'Unknown';
}

function getVolume(trend: Trend): number {
  return trend.score || trend.search_volume || trend.traffic || 0;
}

function getComments(trend: Trend): number {
  return trend.num_comments || 0;
}

function getSubreddit(trend: Trend): string | null {
  return trend.subreddit || null;
}

function getGrowth(trend: Trend): number {
  return trend.increase_percentage || trend.growth || 0;
}

function getCategoryNames(trend: Trend): string[] {
  if (trend.flair) return [trend.flair];
  if (!trend.categories) return [];
  return trend.categories.map(c => typeof c === 'string' ? c : c.name || '').filter(Boolean);
}

function TrendCardSkeleton() {
  return (
    <div className="card" style={{ padding: 20, pointerEvents: 'none' }}>
      <div className="skeleton" style={{ height: 20, width: '60%', marginBottom: 12 }} />
      <div className="skeleton" style={{ height: 14, width: '40%', marginBottom: 16 }} />
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <div className="skeleton" style={{ height: 24, width: 80 }} />
        <div className="skeleton" style={{ height: 24, width: 60 }} />
      </div>
      <div className="skeleton" style={{ height: 14, width: '100%', marginBottom: 6 }} />
      <div className="skeleton" style={{ height: 14, width: '80%', marginBottom: 6 }} />
      <div className="skeleton" style={{ height: 14, width: '90%' }} />
    </div>
  );
}

function TrendCard({ trend, index, isSelected, onClick }: {
  trend: Trend;
  index: number;
  isSelected: boolean;
  onClick: () => void;
}) {
  const topic = getTopicName(trend);
  const volume = getVolume(trend);
  const comments = getComments(trend);
  const growth = getGrowth(trend);
  const cats = getCategoryNames(trend);
  const subreddit = getSubreddit(trend);
  const tweets = trend.tweets || [];
  const isReddit = trend.source === 'reddit';
  const isHot = (trend.engagement ?? 0) > 1000 || growth > 500 || (trend.relevanceScore ?? 0) > 80;

  return (
    <div
      className={`card animate-fade-up stagger-${Math.min(index + 1, 6)} ${isSelected ? 'card-selected' : ''}`}
      onClick={onClick}
      style={{ padding: '20px' }}
    >
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            {isHot ? <div className="hot-dot" /> : <div style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--accent)', flexShrink: 0, opacity: 0.6 }} />}
            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: isHot ? 'var(--hot)' : 'var(--accent)' }}>
              {isHot ? 'Hot' : 'Trending'}
            </span>
          </div>
          <h3 style={{
            fontSize: 16, fontWeight: 700, lineHeight: 1.25,
            color: 'var(--text)', letterSpacing: '-0.01em',
            wordBreak: 'break-word',
          }}>
            {topic}
          </h3>
        </div>
        <div style={{
          fontSize: 11, fontWeight: 700, color: 'var(--text-dim)',
          background: 'rgba(255,255,255,0.04)',
          borderRadius: 6, padding: '4px 8px', flexShrink: 0,
        }}>
          #{index + 1}
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
        {isReddit ? (
          <>
            {volume > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2">
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                </svg>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }} className="num">
                  {formatNumber(volume)}
                </span>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>upvotes</span>
              </div>
            )}
            {comments > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                </svg>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }} className="num">
                  {formatNumber(comments)}
                </span>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>comments</span>
              </div>
            )}
            {subreddit && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 4,
                background: 'rgba(255,69,0,0.08)',
                borderRadius: 5, padding: '3px 8px',
              }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#FF6314' }}>r/{subreddit}</span>
              </div>
            )}
          </>
        ) : (
          <>
            {volume > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
                </svg>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }} className="num">
                  {formatNumber(volume)}
                </span>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>searches</span>
              </div>
            )}
            {growth > 0 && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 4,
                background: isHot ? 'var(--hot-glow)' : 'var(--accent-dim)',
                borderRadius: 5, padding: '3px 8px',
              }}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={isHot ? 'var(--hot)' : 'var(--accent)'} strokeWidth="2.5">
                  <path d="M23 6l-9.5 9.5-5-5L1 18"/>
                  <path d="M17 6h6v6"/>
                </svg>
                <span style={{ fontSize: 12, fontWeight: 700, color: isHot ? 'var(--hot)' : 'var(--accent)' }} className="num">
                  +{growth > 9999 ? '9999' : growth}%
                </span>
              </div>
            )}
          </>
        )}
      </div>

      {/* Category tags */}
      {cats.length > 0 && (
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 14 }}>
          {cats.slice(0, 3).map((cat, i) => (
            <span key={i} className="tag tag-neutral" style={{ fontSize: 10 }}>{cat}</span>
          ))}
        </div>
      )}

      {/* Twitter previews */}
      {tweets.length > 0 ? (
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="var(--text-muted)">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
            </svg>
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)' }}>
              {tweets.length} conversation{tweets.length !== 1 ? 's' : ''} found
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {tweets.slice(0, 2).map((tweet, i) => (
              <div key={i} style={{
                fontSize: 12, color: 'var(--text-muted)',
                lineHeight: 1.4,
                padding: '8px 10px',
                background: 'rgba(255,255,255,0.02)',
                borderRadius: 6,
                borderLeft: '2px solid var(--border-bright)',
                overflow: 'hidden',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical' as const,
              }}>
                {tweet.text || '...'}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12 }}>
          <span style={{ fontSize: 12, color: 'var(--text-dim)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/>
            </svg>
            No Twitter data available
          </span>
        </div>
      )}

      {/* View more indicator */}
      <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 5, color: 'var(--text-dim)' }}>
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

  const fetchTrends = useCallback(async () => {
    if (!keywords.length) {
      router.push('/');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/analyze-niche', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keywords }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Failed to load trends');
      setResult(data);
      setLastUpdated(new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }, [keywords.join(',')]);

  useEffect(() => {
    fetchTrends();
  }, [fetchTrends]);

  if (!keywords.length) return null;

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <header style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 24px', height: 56,
        borderBottom: '1px solid var(--border)',
        background: 'rgba(7,9,14,0.9)',
        backdropFilter: 'blur(10px)',
        position: 'sticky', top: 0, zIndex: 40,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <button
            onClick={() => router.push('/')}
            style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}
          >
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
          {lastUpdated && (
            <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>Updated {lastUpdated}</span>
          )}
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

      {/* Content */}
      <main style={{ flex: 1, padding: '24px', maxWidth: 1200, width: '100%', margin: '0 auto' }}>

        {/* Loading state */}
        {loading && (
          <div>
            <div style={{ marginBottom: 24, display: 'flex', alignItems: 'center', gap: 10 }}>
              <div className="skeleton" style={{ height: 28, width: 300 }} />
              <div className="skeleton" style={{ height: 20, width: 120 }} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 14 }}>
              {Array.from({ length: 6 }).map((_, i) => <TrendCardSkeleton key={i} />)}
            </div>
            <div style={{ marginTop: 40, textAlign: 'center' }}>
              <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                <div className="live-dot" style={{ width: 10, height: 10 }} />
                <p style={{ fontSize: 14, color: 'var(--text-muted)' }}>
                  Analyzing <strong style={{ color: 'var(--accent)' }}>{keywordsParam}</strong>...
                </p>
                <p style={{ fontSize: 12, color: 'var(--text-dim)', maxWidth: 300, textAlign: 'center' }}>
                  Scanning 381 trends · Matching your niche · Fetching conversations
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Error state */}
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
            {/* Results header */}
            <div style={{ marginBottom: 24, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                  <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--text)' }}>
                    {result.trends.length} trends matched
                  </h1>
                  <span className="tag tag-accent">{result.total_analyzed} analyzed</span>
                </div>
                {result.niche.description && (
                  <p style={{ fontSize: 14, color: 'var(--text-muted)' }}>
                    {result.niche.description}
                  </p>
                )}
              </div>
              {(result.niche.subreddits || result.niche.categories || []).length > 0 && (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                  <span style={{ fontSize: 11, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>
                    From:
                  </span>
                  {(result.niche.subreddits || result.niche.categories || []).map((item, i) => (
                    <span key={i} className="tag tag-neutral" style={{ fontSize: 11 }}>
                      {result.niche.subreddits ? `r/${item}` : item}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Trend grid */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
              gap: 14,
            }}>
              {result.trends.map((trend, i) => (
                <TrendCard
                  key={i}
                  trend={trend}
                  index={i}
                  isSelected={selectedTrend === trend}
                  onClick={() => setSelectedTrend(selectedTrend === trend ? null : trend)}
                />
              ))}
            </div>

            {/* Empty state */}
            {result.trends.length === 0 && (
              <div style={{ textAlign: 'center', paddingTop: 60 }}>
                <p style={{ fontSize: 18, color: 'var(--text-muted)', marginBottom: 8 }}>
                  No matching trends found
                </p>
                <p style={{ fontSize: 14, color: 'var(--text-dim)' }}>
                  Try broader keywords or check back in a few hours when trends refresh
                </p>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Detail panel */}
      {selectedTrend && (
        <>
          <div className="panel-overlay" onClick={() => setSelectedTrend(null)} />
          <div className="panel">
            <TrendDetail trend={selectedTrend} onClose={() => setSelectedTrend(null)} />
          </div>
        </>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
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
