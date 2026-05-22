'use client';

import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import AppShell from '../components/AppShell';

// ─── Types (mirrors Chunk 1 /pulse/trends/raw shape) ─────────────────────────
type PulseTrend = {
  id: string;
  query: string;
  search_volume: number | null;
  velocity_pct: number | null;
  active: boolean;
  started_at: string | null;
  hours_trending: number | null;
  categories: string[];
  trend_breakdown: string[];
  news_page_token: string | null;
};

type PulseResult = {
  success: boolean;
  source?: string;
  geo?: string;
  fetched_at?: string;
  count?: number;
  total_active_available?: number;
  trends?: PulseTrend[];
  error?: string;
};

// ─── Formatting helpers ──────────────────────────────────────────────────────
function formatVolume(n: number | null): string {
  if (!n || n <= 0) return '—';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}K`;
  return String(n);
}

function formatHours(h: number | null): string {
  if (h == null || h < 0) return '—';
  if (h < 1) return '<1h';
  if (h < 24) return `${Math.round(h)}h`;
  const d = Math.floor(h / 24);
  return d === 1 ? '1d+' : `${d}d`;
}

function titleCase(s: string): string {
  return s.replace(/\b\w/g, c => c.toUpperCase());
}

function velocityLabel(pct: number | null): string {
  if (pct == null) return 'Rising';
  if (pct >= 1000) return 'Breakout';
  if (pct >= 500) return 'Surging';
  return `+${pct}%`;
}

function timeAgo(iso?: string): string {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  return `${h}h ago`;
}

// ─── Pulse Card ──────────────────────────────────────────────────────────────
function PulseCard({ trend, rank }: { trend: PulseTrend; rank: number }) {
  const [hover, setHover] = useState(false);
  const category = trend.categories?.[0] || 'Trending';
  const breakdown = (trend.trend_breakdown || []).slice(0, 3);

  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        background: 'var(--surface)',
        border: `1px solid ${hover ? 'var(--border-bright)' : 'var(--surface-border)'}`,
        borderRadius: 12,
        padding: 20,
        boxShadow: hover ? 'var(--shadow-md)' : 'var(--shadow-sm)',
        backdropFilter: 'blur(14px)',
        WebkitBackdropFilter: 'blur(14px)',
        transform: hover ? 'translateY(-2px)' : 'none',
        transition: 'transform 0.18s, box-shadow 0.18s, border-color 0.18s',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}
    >
      {/* Top row — category badge + velocity + rank */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <span style={{
          fontFamily: 'var(--font-ui)', fontSize: 11, fontWeight: 700,
          letterSpacing: '0.05em', textTransform: 'uppercase',
          color: 'var(--accent)', background: 'var(--accent-dim)',
          padding: '3px 9px', borderRadius: 100, whiteSpace: 'nowrap',
          overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 180,
        }}>
          {category}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            fontFamily: 'var(--font-ui)', fontSize: 11, fontWeight: 700,
            color: 'var(--hot)', background: 'var(--hot-glow)',
            padding: '3px 9px', borderRadius: 100, letterSpacing: '0.02em',
          }}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 19V5M5 12l7-7 7 7"/>
            </svg>
            {velocityLabel(trend.velocity_pct)}
          </span>
          <span style={{ fontFamily: 'var(--font-ui)', fontSize: 12, fontWeight: 700, color: 'var(--text-dim)' }}>
            #{rank}
          </span>
        </div>
      </div>

      {/* Trend title */}
      <h3 style={{
        fontFamily: 'var(--font-ui)', fontSize: 19, fontWeight: 700,
        lineHeight: 1.25, letterSpacing: '-0.02em', color: 'var(--text)',
        margin: 0,
      }}>
        {titleCase(trend.query)}
      </h3>

      {/* Metrics row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 13, color: 'var(--text-muted)', fontFamily: 'var(--font-ui)' }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
          </svg>
          <strong style={{ color: 'var(--text)', fontWeight: 700 }}>{formatVolume(trend.search_volume)}</strong> searches
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 13, color: 'var(--text-muted)', fontFamily: 'var(--font-ui)' }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>
          </svg>
          trending {formatHours(trend.hours_trending)}
        </span>
      </div>

      {/* Context chips (trend_breakdown) */}
      {breakdown.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {breakdown.map((term, i) => (
            <span key={i} style={{
              fontSize: 12, fontFamily: 'var(--font-ui)', color: 'var(--text-muted)',
              background: 'var(--surface-2)', border: '1px solid var(--border)',
              padding: '3px 9px', borderRadius: 100, whiteSpace: 'nowrap',
              overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 200,
            }}>
              {term}
            </span>
          ))}
        </div>
      )}

      {/* Placeholder footer — Chunks 2 & 4 land here */}
      <div style={{
        borderTop: '1px dashed var(--border)', paddingTop: 11, marginTop: 2,
        display: 'flex', alignItems: 'center', gap: 7,
      }}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--text-dim)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
          <rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/>
        </svg>
        <span style={{ fontSize: 11.5, fontStyle: 'italic', color: 'var(--text-dim)', fontFamily: 'var(--font-ui)' }}>
          Cross-platform footprint + niche relevance — coming soon
        </span>
      </div>
    </div>
  );
}

// ─── Category filter dropdown ────────────────────────────────────────────────
function CategoryFilter({
  available, hidden, onToggle, onShowAll, onHideAll,
}: {
  available: string[];
  hidden: Set<string>;
  onToggle: (cat: string) => void;
  onShowAll: () => void;
  onHideAll: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  if (available.length === 0) return null;

  const shownCount = available.length - available.filter(c => hidden.has(c)).length;
  const isFiltered = shownCount < available.length;

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        className="btn-ghost"
        onClick={() => setOpen(o => !o)}
        style={{ fontSize: 12, padding: '6px 12px', display: 'inline-flex', alignItems: 'center', gap: 6 }}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z"/>
        </svg>
        Categories
        {isFiltered && (
          <span style={{
            fontSize: 10, fontWeight: 700, color: 'var(--accent)',
            background: 'var(--accent-dim)', borderRadius: 100, padding: '1px 6px',
          }}>
            {shownCount}/{available.length}
          </span>
        )}
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 6px)', right: 0, zIndex: 60,
          minWidth: 200, background: 'var(--surface-solid)',
          border: '1px solid var(--border)', borderRadius: 12,
          boxShadow: 'var(--shadow-md)', padding: 8,
          backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)',
        }}>
          {/* Show all / hide all */}
          <div style={{ display: 'flex', gap: 6, padding: '4px 6px 8px', borderBottom: '1px solid var(--border)', marginBottom: 6 }}>
            <button onClick={onShowAll} style={{
              flex: 1, fontSize: 11, fontWeight: 600, fontFamily: 'var(--font-ui)',
              color: 'var(--accent)', background: 'var(--accent-dim)', border: 'none',
              borderRadius: 6, padding: '5px 0', cursor: 'pointer',
            }}>Show all</button>
            <button onClick={onHideAll} style={{
              flex: 1, fontSize: 11, fontWeight: 600, fontFamily: 'var(--font-ui)',
              color: 'var(--text-muted)', background: 'var(--surface-2)', border: 'none',
              borderRadius: 6, padding: '5px 0', cursor: 'pointer',
            }}>Hide all</button>
          </div>

          {/* Category checkboxes */}
          <div style={{ display: 'flex', flexDirection: 'column', maxHeight: 280, overflowY: 'auto' }}>
            {available.map(cat => {
              const shown = !hidden.has(cat);
              return (
                <button
                  key={cat}
                  onClick={() => onToggle(cat)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 9,
                    padding: '8px 8px', borderRadius: 6, border: 'none',
                    background: 'none', cursor: 'pointer', width: '100%',
                    textAlign: 'left', transition: 'background 0.12s',
                  }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--surface-2)'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'none'}
                >
                  <span style={{
                    width: 16, height: 16, borderRadius: 4, flexShrink: 0,
                    border: `1.5px solid ${shown ? 'var(--accent)' : 'var(--border)'}`,
                    background: shown ? 'var(--accent)' : 'transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'all 0.12s',
                  }}>
                    {shown && (
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M20 6L9 17l-5-5"/>
                      </svg>
                    )}
                  </span>
                  <span style={{
                    fontSize: 13, fontFamily: 'var(--font-ui)', fontWeight: 500,
                    color: shown ? 'var(--text)' : 'var(--text-dim)',
                    whiteSpace: 'nowrap',
                  }}>
                    {cat}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Category persistence ────────────────────────────────────────────────────
const HIDDEN_CATS_KEY = 'mtc_pulse_hidden_categories';

function loadHiddenCategories(): Set<string> {
  try {
    const raw = localStorage.getItem(HIDDEN_CATS_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch { return new Set(); }
}

function saveHiddenCategories(hidden: Set<string>) {
  try { localStorage.setItem(HIDDEN_CATS_KEY, JSON.stringify([...hidden])); } catch { /* ignore */ }
}

function trendCategory(t: PulseTrend): string {
  return t.categories?.[0] || 'Trending';
}

// ─── Page ────────────────────────────────────────────────────────────────────
export default function PulsePage() {
  const [result, setResult] = useState<PulseResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hiddenCats, setHiddenCats] = useState<Set<string>>(new Set());

  // Restore persisted category filter after mount (avoids SSR mismatch)
  useEffect(() => { setHiddenCats(loadHiddenCategories()); }, []);

  const fetchTrends = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/pulse-trends?geo=US&limit=24');
      const data: PulseResult = await res.json();
      if (!data.success) {
        setError(data.error || 'Could not load trends right now.');
      } else {
        setResult(data);
      }
    } catch {
      setError('Could not load trends right now.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchTrends(); }, [fetchTrends]);

  const trends = useMemo(() => result?.trends || [], [result]);

  // Categories present in the current feed (unique, sorted)
  const availableCategories = useMemo(() => {
    return [...new Set(trends.map(trendCategory))].sort();
  }, [trends]);

  // Trends after applying the category filter
  const visibleTrends = useMemo(() => {
    if (hiddenCats.size === 0) return trends;
    return trends.filter(t => !hiddenCats.has(trendCategory(t)));
  }, [trends, hiddenCats]);

  const toggleCategory = useCallback((cat: string) => {
    setHiddenCats(prev => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat); else next.add(cat);
      saveHiddenCategories(next);
      return next;
    });
  }, []);

  const showAllCategories = useCallback(() => {
    setHiddenCats(() => { const next = new Set<string>(); saveHiddenCategories(next); return next; });
  }, []);

  const hideAllCategories = useCallback(() => {
    setHiddenCats(() => { const next = new Set(availableCategories); saveHiddenCategories(next); return next; });
  }, [availableCategories]);

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
            <span style={{ fontSize: 13, color: 'var(--text-muted)', fontFamily: 'var(--font-ui)' }}>
              Trending across the web
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {result?.fetched_at && !loading && (
              <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>
                Refreshed {timeAgo(result.fetched_at)}
              </span>
            )}
            {!loading && !error && availableCategories.length > 0 && (
              <CategoryFilter
                available={availableCategories}
                hidden={hiddenCats}
                onToggle={toggleCategory}
                onShowAll={showAllCategories}
                onHideAll={hideAllCategories}
              />
            )}
            <button className="btn-ghost" onClick={fetchTrends} disabled={loading} style={{ fontSize: 12, padding: '6px 12px' }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                style={{ animation: loading ? 'spin 0.8s linear infinite' : 'none' }}>
                <path d="M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
              </svg>
              Refresh
            </button>
          </div>
        </header>

        <main style={{ flex: 1, padding: '24px', maxWidth: 1200, width: '100%', margin: '0 auto' }}>

          {/* Loading */}
          {loading && (
            <div style={{ minHeight: '50vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ width: 28, height: 28, border: '3px solid var(--border)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
            </div>
          )}

          {/* Error */}
          {!loading && error && (
            <div style={{
              background: 'var(--surface)', border: '1px solid var(--surface-border)',
              borderRadius: 12, padding: 32, textAlign: 'center', maxWidth: 440, margin: '64px auto',
              backdropFilter: 'blur(14px)', boxShadow: 'var(--shadow-sm)',
            }}>
              <p style={{ fontSize: 15, color: 'var(--text)', fontFamily: 'var(--font-ui)', fontWeight: 600, margin: '0 0 8px' }}>
                {error}
              </p>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', fontFamily: 'var(--font-ui)', margin: '0 0 20px' }}>
                The trends service may be warming up. Try again in a moment.
              </p>
              <button className="btn-ghost" onClick={fetchTrends} style={{ fontSize: 13, padding: '8px 16px' }}>
                Try again
              </button>
            </div>
          )}

          {/* Feed */}
          {!loading && !error && (
            <>
              <div style={{ marginBottom: 24 }}>
                <h1 style={{
                  fontFamily: 'var(--font-ui)', fontSize: 32, fontWeight: 800,
                  letterSpacing: '-0.03em', color: 'var(--text)', margin: '0 0 8px',
                }}>
                  {visibleTrends.length} trends right now
                  {visibleTrends.length < trends.length && (
                    <span style={{ fontSize: 15, fontWeight: 500, color: 'var(--text-dim)', marginLeft: 10 }}>
                      {trends.length - visibleTrends.length} hidden by filters
                    </span>
                  )}
                </h1>
                <p style={{ fontSize: 15, lineHeight: 1.6, color: 'var(--text-muted)', fontFamily: 'var(--font-ui)', maxWidth: 620, margin: 0 }}>
                  What the internet is searching for in the last 24–72 hours. Ride a wave before it crests — cross-platform signal and niche-tailored angles are on the way.
                </p>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 14 }}>
                {visibleTrends.map((trend, i) => (
                  <PulseCard key={trend.id} trend={trend} rank={i + 1} />
                ))}
              </div>

              {trends.length === 0 && (
                <div style={{ textAlign: 'center', padding: '64px 24px', color: 'var(--text-muted)', fontFamily: 'var(--font-ui)' }}>
                  No active trends found right now. Try refreshing.
                </div>
              )}
              {trends.length > 0 && visibleTrends.length === 0 && (
                <div style={{ textAlign: 'center', padding: '64px 24px', color: 'var(--text-muted)', fontFamily: 'var(--font-ui)' }}>
                  Every category is hidden. Open Categories and show some to see trends.
                </div>
              )}
            </>
          )}
        </main>
      </div>
    </AppShell>
  );
}
