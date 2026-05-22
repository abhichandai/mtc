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

// ─── Relevance ───────────────────────────────────────────────────────────────
type Fit = 'high' | 'medium' | 'low';
type RelevanceScore = { fit: Fit; bridge: string };

function fitStyle(fit: Fit): { dot: string; label: string; labelColor: string; bg: string } {
  switch (fit) {
    case 'high':   return { dot: 'var(--accent)',   label: 'High fit',   labelColor: 'var(--accent)',     bg: 'var(--accent-dim)' };
    case 'medium': return { dot: 'var(--text-muted)', label: 'Medium fit', labelColor: 'var(--text-muted)', bg: 'var(--surface-2)' };
    default:       return { dot: 'var(--text-dim)',  label: 'Low fit',    labelColor: 'var(--text-dim)',   bg: 'var(--surface-2)' };
  }
}

// ─── Pulse Card ──────────────────────────────────────────────────────────────
function PulseCard({ trend, rank, relevance, relevanceLoading }: {
  trend: PulseTrend;
  rank: number;
  relevance?: RelevanceScore;
  relevanceLoading: boolean;
}) {
  const [hover, setHover] = useState(false);
  const category = trend.categories?.[0] || 'Trending';
  const breakdown = (trend.trend_breakdown || []).slice(0, 3);
  const isLowFit = relevance?.fit === 'low';

  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        opacity: isLowFit ? 0.72 : 1,
        background: 'var(--surface)',
        border: `1px solid ${hover ? 'var(--border-bright)' : 'var(--surface-border)'}`,
        borderRadius: 12,
        padding: 20,
        boxShadow: hover ? 'var(--shadow-md)' : 'var(--shadow-sm)',
        backdropFilter: 'blur(14px)',
        WebkitBackdropFilter: 'blur(14px)',
        transform: hover ? 'translateY(-2px)' : 'none',
        transition: 'transform 0.18s, box-shadow 0.18s, border-color 0.18s, opacity 0.2s',
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

      {/* Relevance signal (Chunk 4) */}
      <div style={{ borderTop: '1px dashed var(--border)', paddingTop: 11, marginTop: 2 }}>
        {relevance ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            <span style={{
              alignSelf: 'flex-start',
              display: 'inline-flex', alignItems: 'center', gap: 6,
              fontSize: 11, fontWeight: 700, fontFamily: 'var(--font-ui)',
              letterSpacing: '0.02em', color: fitStyle(relevance.fit).labelColor,
              background: fitStyle(relevance.fit).bg, padding: '3px 9px', borderRadius: 100,
            }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: fitStyle(relevance.fit).dot, flexShrink: 0 }} />
              {fitStyle(relevance.fit).label}
            </span>
            {relevance.bridge && (
              <span style={{ fontSize: 13, lineHeight: 1.45, color: 'var(--text-muted)', fontFamily: 'var(--font-ui)' }}>
                {relevance.bridge}
              </span>
            )}
          </div>
        ) : relevanceLoading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div className="pulse-shimmer" style={{ width: 78, height: 18, borderRadius: 100 }} />
            <div className="pulse-shimmer" style={{ width: '90%', height: 12, borderRadius: 6 }} />
          </div>
        ) : (
          <span style={{ fontSize: 12, fontStyle: 'italic', color: 'var(--text-dim)', fontFamily: 'var(--font-ui)' }}>
            Relevance unavailable
          </span>
        )}
      </div>

      {/* Cross-platform footprint placeholder (Chunk 2) */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--text-dim)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
          <rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/>
        </svg>
        <span style={{ fontSize: 11, fontStyle: 'italic', color: 'var(--text-dim)', fontFamily: 'var(--font-ui)' }}>
          Cross-platform footprint — coming soon
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

// ─── Relevance cache (4h TTL, matches dashboard) ─────────────────────────────
const RELEVANCE_TTL_MS = 4 * 60 * 60 * 1000;
const RELEVANCE_PREFIX = 'mtc_pulse_relevance_';

function hashStr(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) { h = (Math.imul(h, 31) + s.charCodeAt(i)) | 0; }
  return String(h >>> 0);
}

function relevanceKey(trends: PulseTrend[]): string {
  return RELEVANCE_PREFIX + hashStr(trends.map(t => t.id).sort().join('|'));
}

function loadRelevanceCache(trends: PulseTrend[]): Record<string, RelevanceScore> | null {
  try {
    const raw = localStorage.getItem(relevanceKey(trends));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (Date.now() - parsed.savedAt > RELEVANCE_TTL_MS) {
      localStorage.removeItem(relevanceKey(trends));
      return null;
    }
    return parsed.scores;
  } catch { return null; }
}

function saveRelevanceCache(trends: PulseTrend[], scores: Record<string, RelevanceScore>) {
  try {
    localStorage.setItem(relevanceKey(trends), JSON.stringify({ scores, savedAt: Date.now() }));
  } catch { /* ignore */ }
}

// ─── Page ────────────────────────────────────────────────────────────────────
export default function PulsePage() {
  const [result, setResult] = useState<PulseResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hiddenCats, setHiddenCats] = useState<Set<string>>(new Set());
  const [relevance, setRelevance] = useState<Record<string, RelevanceScore>>({});
  const [relevanceLoading, setRelevanceLoading] = useState(false);
  const [sortMode, setSortMode] = useState<'trending' | 'relevant'>('trending');
  const [profileLoaded, setProfileLoaded] = useState(false);

  // Creator context held in a ref so scoreRelevance always reads the latest
  const creatorCtxRef = useRef<{ brief: string; platforms: string[]; format: string; styles: string[] }>({
    brief: '', platforms: [], format: '', styles: [],
  });

  // Fetch the creator's profile client-side (same source the dashboard uses).
  // The brief travels to the relevance route in the request body — mirrors
  // analyze-niche, and avoids depending on a server-side Supabase fetch.
  useEffect(() => {
    fetch('/api/profile')
      .then(r => r.json())
      .then(d => {
        const p = d?.profile;
        if (p) {
          creatorCtxRef.current = {
            brief: p.audience_brief || '',
            platforms: p.platforms || [],
            format: p.content_format || '',
            styles: p.content_styles || [],
          };
        }
      })
      .catch(() => { /* best-effort */ })
      .finally(() => setProfileLoaded(true));
  }, []);

  // Restore persisted category filter after mount (avoids SSR mismatch)
  useEffect(() => { setHiddenCats(loadHiddenCategories()); }, []);

  // Score trends for relevance — cache-first, Sonnet on miss. Sends creator
  // context (brief etc.) in the body; the route keeps prompt + API key server-side.
  const scoreRelevance = useCallback(async (trendList: PulseTrend[]) => {
    if (trendList.length === 0) return;
    const cached = loadRelevanceCache(trendList);
    if (cached) { setRelevance(cached); return; }

    setRelevance({});
    setRelevanceLoading(true);
    try {
      const ctx = creatorCtxRef.current;
      const res = await fetch('/api/pulse-relevance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brief: ctx.brief,
          platforms: ctx.platforms,
          content_format: ctx.format,
          content_styles: ctx.styles,
          trends: trendList.map(t => ({
            id: t.id, query: t.query, categories: t.categories, trend_breakdown: t.trend_breakdown,
          })),
        }),
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.scores)) {
        const map: Record<string, RelevanceScore> = {};
        for (const s of data.scores) {
          if (s?.id && (s.fit === 'high' || s.fit === 'medium' || s.fit === 'low')) {
            map[s.id] = { fit: s.fit, bridge: typeof s.bridge === 'string' ? s.bridge : '' };
          }
        }
        setRelevance(map);
        // Only cache real scores — never cache an all-neutral fallback
        if (data.note !== 'no_brief' && data.note !== 'parse_failed' && Object.keys(map).length > 0) {
          saveRelevanceCache(trendList, map);
        }
      }
    } catch { /* leave unscored — cards render without a signal */ }
    finally { setRelevanceLoading(false); }
  }, []);

  const fetchTrends = useCallback(async (forceRefresh = false) => {
    setLoading(true);
    setError(null);
    if (forceRefresh) { try { localStorage.removeItem(relevanceKey(result?.trends || [])); } catch { /* ignore */ } }
    try {
      const res = await fetch('/api/pulse-trends?geo=US&limit=24');
      const data: PulseResult = await res.json();
      if (!data.success) {
        setError(data.error || 'Could not load trends right now.');
      } else {
        if (forceRefresh) { try { localStorage.removeItem(relevanceKey(data.trends || [])); } catch { /* ignore */ } }
        setResult(data);
      }
    } catch {
      setError('Could not load trends right now.');
    } finally {
      setLoading(false);
    }
  }, [result]);

  useEffect(() => { fetchTrends(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const trends = useMemo(() => result?.trends || [], [result]);

  // Score relevance once BOTH the trend set and the profile are ready, so the
  // brief is always available when we call the scorer (avoids the no-brief path).
  useEffect(() => {
    if (profileLoaded && trends.length > 0) scoreRelevance(trends);
  }, [profileLoaded, trends, scoreRelevance]);


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

  // Trending rank is fixed by velocity order — stays meaningful even when sorted by relevance
  const trendingRank = useMemo(() => {
    const m: Record<string, number> = {};
    trends.forEach((t, i) => { m[t.id] = i + 1; });
    return m;
  }, [trends]);

  // Apply sort to the (already category-filtered) trends
  const displayTrends = useMemo(() => {
    if (sortMode === 'trending') return visibleTrends;
    const order: Record<Fit, number> = { high: 0, medium: 1, low: 2 };
    // Array.sort is stable — equal-fit trends keep their trending order
    return [...visibleTrends].sort((a, b) => {
      const fa = order[relevance[a.id]?.fit ?? 'medium'];
      const fb = order[relevance[b.id]?.fit ?? 'medium'];
      return fa - fb;
    });
  }, [visibleTrends, sortMode, relevance]);

  const hasAnyScores = Object.keys(relevance).length > 0;

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
            <button className="btn-ghost" onClick={() => fetchTrends(true)} disabled={loading} style={{ fontSize: 12, padding: '6px 12px' }}>
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
              <button className="btn-ghost" onClick={() => fetchTrends(true)} style={{ fontSize: 13, padding: '8px 16px' }}>
                Try again
              </button>
            </div>
          )}

          {/* Feed */}
          {!loading && !error && (
            <>
              <div style={{ marginBottom: 24, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
                <div>
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
                    What the internet is searching for in the last 24–72 hours. Ride a wave before it crests — niche-tailored angles unlock on each card.
                  </p>
                </div>

                {/* Sort toggle */}
                {hasAnyScores && (
                  <div style={{
                    display: 'inline-flex', background: 'var(--surface-2)', border: '1px solid var(--border)',
                    borderRadius: 100, padding: 3, flexShrink: 0,
                  }}>
                    {(['trending', 'relevant'] as const).map(mode => {
                      const active = sortMode === mode;
                      return (
                        <button
                          key={mode}
                          onClick={() => setSortMode(mode)}
                          style={{
                            fontSize: 12.5, fontWeight: active ? 700 : 500, fontFamily: 'var(--font-ui)',
                            padding: '6px 14px', borderRadius: 100, border: 'none', cursor: 'pointer',
                            background: active ? 'var(--surface-solid)' : 'transparent',
                            color: active ? 'var(--accent)' : 'var(--text-muted)',
                            boxShadow: active ? 'var(--shadow-xs)' : 'none',
                            transition: 'all 0.15s', whiteSpace: 'nowrap',
                          }}
                        >
                          {mode === 'trending' ? 'Trending' : 'Relevant to me'}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 14 }}>
                {displayTrends.map((trend) => (
                  <PulseCard
                    key={trend.id}
                    trend={trend}
                    rank={trendingRank[trend.id]}
                    relevance={relevance[trend.id]}
                    relevanceLoading={relevanceLoading}
                  />
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

      <style>{`
        .pulse-shimmer {
          background: linear-gradient(90deg, var(--surface-2) 25%, var(--border) 37%, var(--surface-2) 63%);
          background-size: 400% 100%;
          animation: pulseShimmer 1.4s ease-in-out infinite;
        }
        @keyframes pulseShimmer {
          0% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
      `}</style>
    </AppShell>
  );
}
