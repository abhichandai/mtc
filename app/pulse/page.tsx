'use client';

import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import Link from 'next/link';
import AppShell from '../components/AppShell';

// ─── Types (mirrors Chunk 1 /pulse/trends/raw shape) ─────────────────────────
type TrendSource = 'google' | 'reddit';

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
  // ── Multi-source (Chunk 2) ──
  source?: TrendSource;            // defaults to 'google' when absent
  velocity?: number | null;        // normalised 0–1 within source (Reddit sets this)
  reddit_upvotes?: number | null;  // Reddit only — option (b): no search_volume
  subreddit?: string | null;       // Reddit only — e.g. "r/nba"
  permalink?: string | null;       // Reddit only — thread URL (for the unlock view later)
  sortVelocity?: number;           // unified 0–1 sort key, computed client-side
  first_seen_at?: string;          // ISO timestamp — when this trend first entered the pool
};

type PulseFeedResponse = {
  success: boolean;
  trends: PulseTrend[];
  master_refresh_id: number | null;
  refreshed_at: string | null;
  google_count?: number;
  reddit_count?: number;
  total_count?: number;
  scores: Array<{ id: string; fit: string }> | null;
  scored_at?: string | null;
  cache_state?: 'hit' | 'partial' | 'miss_no_cache' | 'empty_master_pool';
  unlocked_ids?: string[];
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

// ─── Multi-source (Chunk 2) ──────────────────────────────────────────────────
function trendSource(t: PulseTrend): TrendSource {
  return t.source === 'reddit' ? 'reddit' : 'google';
}

// ─── Relevance ───────────────────────────────────────────────────────────────
type Fit = 'high' | 'medium' | 'low';
type RelevanceScore = { fit: Fit };

type EnrichmentItem = {
  title: string;
  author: string;
  author_handle?: string;
  author_url?: string;
  url: string;
  likes?: number;
  comments?: number;
  plays?: number;
  views?: number;
  shares?: number;
  followers?: number;
  is_short?: boolean;
  posted_at?: string | null;  // ISO 8601 UTC; null if platform didn't return it
};

type EnrichmentPlatform = {
  name: string;
  items: EnrichmentItem[];
};

type EnrichmentData = Record<string, EnrichmentPlatform>;

function fitStyle(fit: Fit): { dot: string; label: string; labelColor: string; bg: string } {
  switch (fit) {
    case 'high':   return { dot: 'var(--accent)',   label: 'High fit',   labelColor: 'var(--accent)',     bg: 'var(--accent-dim)' };
    case 'medium': return { dot: 'var(--text-muted)', label: 'Medium fit', labelColor: 'var(--text-muted)', bg: 'var(--surface-2)' };
    default:       return { dot: 'var(--text-dim)',  label: 'Low fit',    labelColor: 'var(--text-dim)',   bg: 'var(--surface-2)' };
  }
}

// ─── Newness tiers ──────────────────────────────────────────────────────────
type NewnessTier = 'breakout' | '<4h' | '<8h' | '<12h' | '<24h' | '<48h' | 'older';

function newnessTier(firstSeenAt?: string): NewnessTier {
  if (!firstSeenAt) return 'older';
  const hoursAgo = (Date.now() - new Date(firstSeenAt).getTime()) / (1000 * 60 * 60);
  if (hoursAgo < 1) return 'breakout';
  if (hoursAgo < 4) return '<4h';
  if (hoursAgo < 8) return '<8h';
  if (hoursAgo < 12) return '<12h';
  if (hoursAgo < 24) return '<24h';
  if (hoursAgo < 48) return '<48h';
  return 'older';
}

const NEWNESS_ORDER: Record<NewnessTier, number> = {
  breakout: 0, '<4h': 1, '<8h': 2, '<12h': 3, '<24h': 4, '<48h': 5, older: 6,
};

function newnessStyle(tier: NewnessTier): { label: string; color: string; bg: string } {
  switch (tier) {
    case 'breakout': return { label: '🔥 Breakout', color: '#e85d04', bg: 'rgba(232,93,4,0.12)' };
    case '<4h':      return { label: '< 4h',        color: 'var(--accent)', bg: 'var(--accent-dim)' };
    case '<8h':      return { label: '< 8h',        color: 'var(--accent)', bg: 'var(--accent-dim)' };
    case '<12h':     return { label: '< 12h',       color: 'var(--text-muted)', bg: 'var(--surface-2)' };
    case '<24h':     return { label: '< 24h',       color: 'var(--text-muted)', bg: 'var(--surface-2)' };
    case '<48h':     return { label: '< 48h',       color: 'var(--text-dim)', bg: 'var(--surface-2)' };
    default:         return { label: '48h+',        color: 'var(--text-dim)', bg: 'var(--surface-2)' };
  }
}

// ─── Post recency badge (for enrichment items) ──────────────────────────────
// Distinct from `newnessTier` which measures how long a trend has been in our
// pool. This measures how long ago a specific TikTok/YouTube/IG/LinkedIn post
// was published — the "what people are saying RIGHT NOW" signal.
function postRecency(postedAt?: string | null): { label: string; color: string; bg: string } | null {
  if (!postedAt) return null;
  const ms = Date.now() - new Date(postedAt).getTime();
  if (isNaN(ms) || ms < 0) return null;
  const hours = ms / (1000 * 60 * 60);
  const days = hours / 24;

  if (hours < 1)  return { label: 'just now',   color: '#16a34a', bg: 'rgba(22,163,74,0.10)' };
  if (hours < 24) return { label: `${Math.floor(hours)}h ago`, color: '#16a34a', bg: 'rgba(22,163,74,0.10)' };
  if (days < 2)   return { label: 'yesterday',  color: '#0891b2', bg: 'rgba(8,145,178,0.10)' };
  if (days < 7)   return { label: `${Math.floor(days)}d ago`,  color: '#0891b2', bg: 'rgba(8,145,178,0.10)' };
  if (days < 30)  return { label: `${Math.floor(days / 7)}w ago`, color: 'var(--text-muted)', bg: 'var(--surface-2)' };
  if (days < 365) return { label: `${Math.floor(days / 30)}mo ago`, color: 'var(--text-dim)', bg: 'var(--surface-2)' };
  return { label: `${Math.floor(days / 365)}y ago`, color: 'var(--text-dim)', bg: 'var(--surface-2)' };
}

// ─── Source identification ───────────────────────────────────────────────────
function SourceLogo({ source, size = 18 }: { source: TrendSource; size?: number }) {
  if (source === 'reddit') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="#D93A00" style={{ flexShrink: 0 }} aria-label="Reddit">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm5.01 9.05c.02.16.03.32.03.49 0 2.5-2.91 4.53-6.5 4.53s-6.5-2.03-6.5-4.53c0-.17.01-.33.03-.49a1.4 1.4 0 1 1 1.66-2.18c.84-.58 1.99-.96 3.27-1.01l.62-2.92a.3.3 0 0 1 .36-.23l2.06.44a.99.99 0 1 1-.12.55l-1.83-.39-.55 2.6c1.25.06 2.38.43 3.21 1.01a1.4 1.4 0 1 1 1.65 2.2zM9.25 12a1 1 0 1 0 2 0 1 1 0 0 0-2 0zm3.5 2.5c-.78.46-2.22.46-3 0a.32.32 0 0 0-.44.46c.6.6 1.85.65 1.94.65.09 0 1.34-.05 1.94-.65a.32.32 0 0 0-.44-.46zm.25-1.5a1 1 0 1 0 0-2 1 1 0 0 0 0 2z"/>
      </svg>
    );
  }
  // Google: multi-color G
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={{ flexShrink: 0 }} aria-label="Google Trends">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18a11 11 0 0 0 0 9.86l3.66-2.84z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1a11 11 0 0 0-9.82 6.07l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z" fill="#EA4335"/>
    </svg>
  );
}

// ─── Platform icons for enrichment display ───────────────────────────────────
function PlatformIcon({ platform, size = 16 }: { platform: string; size?: number }) {
  switch (platform) {
    case 'tiktok':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="var(--text)" style={{ flexShrink: 0 }} aria-label="TikTok">
          <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1v-3.51a6.37 6.37 0 0 0-.79-.05A6.34 6.34 0 0 0 3.15 15a6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.34-6.34V8.72A8.18 8.18 0 0 0 20.59 10V6.53a4.83 4.83 0 0 1-1-.16z"/>
        </svg>
      );
    case 'youtube':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="#FF0000" style={{ flexShrink: 0 }} aria-label="YouTube">
          <path d="M23.5 6.19a3.02 3.02 0 0 0-2.12-2.14C19.5 3.5 12 3.5 12 3.5s-7.5 0-9.38.55A3.02 3.02 0 0 0 .5 6.19 31.6 31.6 0 0 0 0 12a31.6 31.6 0 0 0 .5 5.81 3.02 3.02 0 0 0 2.12 2.14c1.88.55 9.38.55 9.38.55s7.5 0 9.38-.55a3.02 3.02 0 0 0 2.12-2.14A31.6 31.6 0 0 0 24 12a31.6 31.6 0 0 0-.5-5.81zM9.75 15.02V8.98L15.5 12l-5.75 3.02z"/>
        </svg>
      );
    case 'instagram':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="url(#ig-grad)" style={{ flexShrink: 0 }} aria-label="Instagram">
          <defs>
            <linearGradient id="ig-grad" x1="0%" y1="100%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#feda75"/><stop offset="25%" stopColor="#fa7e1e"/>
              <stop offset="50%" stopColor="#d62976"/><stop offset="75%" stopColor="#962fbf"/>
              <stop offset="100%" stopColor="#4f5bd5"/>
            </linearGradient>
          </defs>
          <path d="M12 2.16c2.71 0 3.06.01 4.12.06 1.07.05 1.65.22 2.04.36.51.2.88.44 1.26.82.38.38.62.75.82 1.26.14.39.31.97.36 2.04.05 1.06.06 1.41.06 4.12s-.01 3.06-.06 4.12c-.05 1.07-.22 1.65-.36 2.04-.2.51-.44.88-.82 1.26-.38.38-.75.62-1.26.82-.39.14-.97.31-2.04.36-1.06.05-1.41.06-4.12.06s-3.06-.01-4.12-.06c-1.07-.05-1.65-.22-2.04-.36a3.4 3.4 0 0 1-1.26-.82 3.4 3.4 0 0 1-.82-1.26c-.14-.39-.31-.97-.36-2.04C2.17 15.06 2.16 14.71 2.16 12s.01-3.06.06-4.12c.05-1.07.22-1.65.36-2.04.2-.51.44-.88.82-1.26.38-.38.75-.62 1.26-.82.39-.14.97-.31 2.04-.36C7.76 2.17 8.11 2.16 12 2.16zM12 0C9.24 0 8.85.01 7.78.06 6.71.11 5.97.3 5.32.57a5.56 5.56 0 0 0-2.01 1.31A5.56 5.56 0 0 0 2 3.89c-.27.65-.46 1.39-.51 2.46C1.44 7.42 1.43 7.81 1.43 12s.01 4.58.06 5.65c.05 1.07.24 1.81.51 2.46a5.56 5.56 0 0 0 1.31 2.01 5.56 5.56 0 0 0 2.01 1.31c.65.27 1.39.46 2.46.51C8.85 24 9.24 24 12 24s3.15-.01 4.22-.06c1.07-.05 1.81-.24 2.46-.51a5.56 5.56 0 0 0 2.01-1.31 5.56 5.56 0 0 0 1.31-2.01c.27-.65.46-1.39.51-2.46.05-1.07.06-1.46.06-5.65s-.01-4.58-.06-5.65c-.05-1.07-.24-1.81-.51-2.46A5.56 5.56 0 0 0 20.68 1.88 5.56 5.56 0 0 0 18.67.57C18.02.3 17.28.11 16.21.06 15.15.01 14.76 0 12 0zm0 5.84a6.16 6.16 0 1 0 0 12.32 6.16 6.16 0 0 0 0-12.32zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.41-11.85a1.44 1.44 0 1 0 0 2.88 1.44 1.44 0 0 0 0-2.88z"/>
        </svg>
      );
    case 'linkedin':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="#0A66C2" style={{ flexShrink: 0 }} aria-label="LinkedIn">
          <path d="M20.45 20.45h-3.55v-5.57c0-1.33-.02-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.36V9h3.41v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.45v6.29zM5.34 7.43a2.06 2.06 0 1 1 0-4.12 2.06 2.06 0 0 1 0 4.12zM7.12 20.45H3.56V9h3.56v11.45zM22.22 0H1.77C.79 0 0 .77 0 1.72v20.56C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.72V1.72C24 .77 23.2 0 22.22 0z"/>
        </svg>
      );
    default:
      return null;
  }
}

// ─── Pulse Row (Chunk B — table layout, click to open detail modal) ──────────
function PulseRow({ trend, rank, relevance, relevanceLoading, onOpen, isLast, unlocked }: {
  trend: PulseTrend;
  rank: number;
  relevance?: RelevanceScore;
  relevanceLoading: boolean;
  onOpen: () => void;
  isLast?: boolean;
  unlocked?: boolean;
}) {
  const [hover, setHover] = useState(false);
  const source = trendSource(trend);
  const category = trend.categories?.[0] || 'Trending';
  const isLowFit = relevance?.fit === 'low';
  const compactMetric = source === 'reddit'
    ? `${formatVolume(trend.reddit_upvotes ?? null)} up · ${formatHours(trend.hours_trending)}`
    : `${formatVolume(trend.search_volume)} · ${formatHours(trend.hours_trending)}`;

  return (
    <button
      onClick={onOpen}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        width: '100%',
        opacity: isLowFit ? 0.7 : 1,
        background: hover ? 'var(--surface)' : 'transparent',
        border: 'none',
        borderBottom: isLast ? 'none' : '1px solid var(--border)',
        padding: '14px 18px',
        cursor: 'pointer',
        display: 'grid',
        gridTemplateColumns: '40px 70px minmax(0, 1fr) 130px 85px 85px 100px 18px',
        alignItems: 'center',
        gap: 14,
        textAlign: 'left',
        fontFamily: 'var(--font-ui)',
        color: 'inherit',
        transition: 'background 0.12s, opacity 0.2s',
      }}
    >
      <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-dim)', letterSpacing: '0.02em' }}>
        #{rank}
      </span>
      <span style={{ display: 'flex', justifyContent: 'center' }}>
        <SourceLogo source={source} size={18} />
      </span>
      <span style={{
        fontSize: 14.5, fontWeight: 600, color: 'var(--text)',
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        letterSpacing: '-0.01em',
        minWidth: 0,
      }}>
        {titleCase(trend.query)}
      </span>
      <span style={{
        fontSize: 10.5, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase',
        color: 'var(--accent)', background: 'var(--accent-dim)',
        padding: '3px 8px', borderRadius: 100, whiteSpace: 'nowrap',
        justifySelf: 'center',
      }}>
        {category}
      </span>
      {relevance ? (
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 5,
          fontSize: 10.5, fontWeight: 700, letterSpacing: '0.02em',
          color: fitStyle(relevance.fit).labelColor, background: fitStyle(relevance.fit).bg,
          padding: '3px 9px', borderRadius: 100, whiteSpace: 'nowrap',
          justifySelf: 'center',
        }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: fitStyle(relevance.fit).dot, flexShrink: 0 }} />
          {fitStyle(relevance.fit).label}
        </span>
      ) : relevanceLoading ? (
        <span className="pulse-shimmer" style={{ width: 70, height: 18, borderRadius: 100, display: 'inline-block', justifySelf: 'center' }} />
      ) : (
        <span
          title="Score couldn't be computed for this trend. It'll retry on next refresh."
          style={{
            fontSize: 10.5, fontWeight: 600, letterSpacing: '0.02em',
            color: 'var(--text-dim)', background: 'var(--surface-2)',
            border: '1px dashed var(--border)',
            padding: '3px 9px', borderRadius: 100, whiteSpace: 'nowrap',
            justifySelf: 'center',
          }}
        >
          Unscored
        </span>
      )}
      {(() => {
        const tier = newnessTier(trend.first_seen_at);
        const s = newnessStyle(tier);
        return (
          <span style={{
            fontSize: 10.5, fontWeight: 700, letterSpacing: '0.02em',
            color: s.color, background: s.bg,
            padding: '3px 8px', borderRadius: 100, whiteSpace: 'nowrap',
            justifySelf: 'center',
          }}>
            {s.label}
          </span>
        );
      })()}
      <span style={{
        fontSize: 12.5, color: 'var(--text-muted)', whiteSpace: 'nowrap',
        fontVariantNumeric: 'tabular-nums',
      }}>
        {compactMetric}
      </span>
      {unlocked ? (
        // Open padlock — green, matching AIE's #16a34a
        <svg
          width="16" height="16" viewBox="0 0 24 24" fill="none"
          stroke="#16a34a"
          strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
          style={{ transition: 'transform 0.15s', transform: hover ? 'scale(1.1)' : 'none' }}
          aria-label="Unlocked"
        >
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
          <path d="M7 11V7a5 5 0 0 1 9.9-1"/>
        </svg>
      ) : (
        // Closed padlock — red
        <svg
          width="16" height="16" viewBox="0 0 24 24" fill="none"
          stroke="#dc2626"
          strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
          style={{ transition: 'transform 0.15s', transform: hover ? 'scale(1.1)' : 'none' }}
          aria-label="Locked — click to unlock"
        >
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
          <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
        </svg>
      )}
    </button>
  );
}

// ─── Pulse Trend Detail Modal (matches the dashboard AIE drawer pattern) ─────
function PulseTrendDetail({ trend, relevance, onClose, bridge, onBridgeLoaded, creatorCtx, enrichment, onEnrichmentLoaded }: {
  trend: PulseTrend;
  relevance?: RelevanceScore;
  onClose: () => void;
  bridge?: string;
  onBridgeLoaded?: (trendId: string, bridge: string) => void;
  creatorCtx?: { brief: string; platforms: string[]; format: string; styles: string[] };
  enrichment?: EnrichmentData;
  onEnrichmentLoaded?: (trendId: string, data: EnrichmentData) => void;
}) {
  const source = trendSource(trend);
  const category = trend.categories?.[0] || 'Trending';
  const [bridgeLoading, setBridgeLoading] = useState(false);
  const [localBridge, setLocalBridge] = useState(bridge || '');
  const [youtubeQuery, setYoutubeQuery] = useState<string>('');
  const [enrichLoading, setEnrichLoading] = useState(false);
  const [localEnrichment, setLocalEnrichment] = useState<EnrichmentData | null>(enrichment || null);
  const [collapsedPlatforms, setCollapsedPlatforms] = useState<Set<string>>(new Set());

  const handleUnlock = () => {
    if (enrichLoading || localEnrichment) return;
    setEnrichLoading(true);
    const params = new URLSearchParams({ query: trend.query, limit: '5' });
    if (youtubeQuery) params.set('youtube_query', youtubeQuery);
    fetch(`/api/pulse-unlock?${params.toString()}`)
      .then(r => r.json())
      .then(d => {
        if (d.success && d.platforms) {
          setLocalEnrichment(d.platforms);
          onEnrichmentLoaded?.(trend.id, d.platforms);
          // Persist the unlock so it survives page reload and is available
          // across devices. Fire-and-forget — UX shouldn't block on the write.
          fetch('/api/pulse-unlocks', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              trend_id: trend.id,
              bridge: localBridge || null,
              youtube_query: youtubeQuery || null,
              enrichment: d.platforms,
              trend_snapshot: trend,
            }),
          }).catch(() => { /* swallow — DB write is best-effort */ });
        }
      })
      .catch(() => {})
      .finally(() => setEnrichLoading(false));
  };

  // Sync if parent cache updates
  useEffect(() => { if (enrichment) setLocalEnrichment(enrichment); }, [enrichment]);

  // On mount: check Supabase for a persisted unlock first. If found, populate
  // bridge + enrichment from there (zero Sonnet/ScrapeCreators calls). If not,
  // fall back to fresh bridge generation. Skip the whole thing if the parent
  // already passed a cached bridge (in-session hit).
  useEffect(() => {
    if (localBridge && localEnrichment) return; // fully hydrated already
    if (!creatorCtx?.brief) return;

    let cancelled = false;
    setBridgeLoading(true);

    // First check: persisted unlock in Supabase
    fetch(`/api/pulse-unlocks?trend_id=${encodeURIComponent(trend.id)}`)
      .then(r => r.json())
      .then(data => {
        if (cancelled) return;
        if (data.success && data.unlock) {
          // Hit — populate from DB, skip Sonnet entirely
          const u = data.unlock;
          if (u.bridge) {
            setLocalBridge(u.bridge);
            onBridgeLoaded?.(trend.id, u.bridge);
          }
          if (u.youtube_query) setYoutubeQuery(u.youtube_query);
          if (u.enrichment) {
            setLocalEnrichment(u.enrichment);
            onEnrichmentLoaded?.(trend.id, u.enrichment);
          }
          setBridgeLoading(false);
          return;
        }
        // Miss — fall back to fresh bridge generation
        return fetch('/api/pulse-bridge', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            trend_title: trend.query,
            trend_categories: trend.categories || [],
            trend_source: trendSource(trend),
            brief: creatorCtx.brief,
            platforms: creatorCtx.platforms,
            content_format: creatorCtx.format,
            content_styles: creatorCtx.styles,
          }),
        })
          .then(r => r.json())
          .then(d => {
            if (cancelled) return;
            if (d.success && d.bridge) {
              setLocalBridge(d.bridge);
              onBridgeLoaded?.(trend.id, d.bridge);
            }
            if (d.success && d.youtube_query) {
              setYoutubeQuery(d.youtube_query);
            }
          })
          .finally(() => { if (!cancelled) setBridgeLoading(false); });
      })
      .catch(() => { if (!cancelled) setBridgeLoading(false); });

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync if parent cache updates
  useEffect(() => { if (bridge) setLocalBridge(bridge); }, [bridge]);

  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onEsc);
    return () => window.removeEventListener('keydown', onEsc);
  }, [onClose]);

  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{
        padding: '16px 20px', borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: 'var(--surface)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <SourceLogo source={source} size={18} />
          <span style={{
            fontSize: 11, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase',
            color: 'var(--accent)',
          }}>
            {category}
          </span>
        </div>
        <button
          onClick={onClose}
          aria-label="Close"
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--text-muted)', padding: 4, display: 'flex', alignItems: 'center',
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>

      {/* Body */}
      <div style={{ padding: '22px 24px', overflowY: 'auto', flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 18 }}>
        <h2 style={{
          fontFamily: 'var(--font-ui)', fontSize: 22, fontWeight: 800,
          lineHeight: 1.25, letterSpacing: '-0.02em', color: 'var(--text)',
          margin: 0,
        }}>
          {titleCase(trend.query)}
        </h2>

        {/* Source + velocity + full metrics */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          {source === 'reddit' ? (
            <a
              href={trend.permalink || '#'}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                fontSize: 12.5, fontWeight: 600, color: '#D93A00',
                background: 'rgba(217,58,0,0.10)',
                padding: '5px 11px', borderRadius: 100,
                textDecoration: 'none', letterSpacing: '0.01em',
                fontFamily: 'var(--font-ui)',
              }}
            >
              <SourceLogo source="reddit" size={13} />
              {trend.subreddit || 'Reddit'}
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: 2 }}>
                <path d="M7 17L17 7M7 7h10v10"/>
              </svg>
            </a>
          ) : (
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              fontSize: 12.5, fontWeight: 600,
              color: 'var(--text-muted)', background: 'var(--surface-2)',
              padding: '5px 11px', borderRadius: 100, letterSpacing: '0.01em',
              fontFamily: 'var(--font-ui)',
            }}>
              <SourceLogo source="google" size={13} />
              Google Trends
            </span>
          )}

          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            fontSize: 11, fontWeight: 700,
            color: 'var(--hot)', background: 'var(--hot-glow)',
            padding: '4px 10px', borderRadius: 100, letterSpacing: '0.02em',
            fontFamily: 'var(--font-ui)',
          }}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 19V5M5 12l7-7 7 7"/>
            </svg>
            {velocityLabel(trend.velocity_pct)}
          </span>
        </div>

        {/* Metrics detail */}
        <div style={{
          display: 'flex', gap: 18, padding: '12px 14px',
          background: 'var(--surface-2)', borderRadius: 10,
          fontSize: 13, color: 'var(--text-muted)', fontFamily: 'var(--font-ui)',
        }}>
          <span>
            {source === 'reddit' ? (
              <><strong style={{ color: 'var(--text)', fontWeight: 700 }}>{formatVolume(trend.reddit_upvotes ?? null)}</strong> upvotes</>
            ) : (
              <><strong style={{ color: 'var(--text)', fontWeight: 700 }}>{formatVolume(trend.search_volume)}</strong> searches</>
            )}
          </span>
          <span>·</span>
          <span>trending <strong style={{ color: 'var(--text)', fontWeight: 700 }}>{formatHours(trend.hours_trending)}</strong></span>
        </div>

        {/* Breakdown chips */}
        {trend.trend_breakdown && trend.trend_breakdown.length > 0 && (
          <div>
            <div style={{
              fontSize: 11, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase',
              color: 'var(--text-dim)', marginBottom: 8, fontFamily: 'var(--font-ui)',
            }}>
              Context
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
              {trend.trend_breakdown.slice(0, 6).map((term, i) => (
                <span key={i} style={{
                  fontSize: 12, fontFamily: 'var(--font-ui)', color: 'var(--text-muted)',
                  background: 'var(--surface)', border: '1px solid var(--border)',
                  padding: '4px 11px', borderRadius: 100,
                }}>
                  {term}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Fit */}
        <div>
          <div style={{
            fontSize: 11, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase',
            color: 'var(--text-dim)', marginBottom: 8, fontFamily: 'var(--font-ui)',
          }}>
            Relevance to your audience
          </div>
          {relevance ? (
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              fontSize: 12, fontWeight: 700, fontFamily: 'var(--font-ui)',
              letterSpacing: '0.02em', color: fitStyle(relevance.fit).labelColor,
              background: fitStyle(relevance.fit).bg, padding: '5px 11px', borderRadius: 100,
            }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: fitStyle(relevance.fit).dot, flexShrink: 0 }} />
              {fitStyle(relevance.fit).label}
            </span>
          ) : (
            <span style={{ fontSize: 12.5, fontStyle: 'italic', color: 'var(--text-dim)', fontFamily: 'var(--font-ui)' }}>
              Relevance signal not yet available
            </span>
          )}
        </div>

        {/* Bridge — the content angle connecting this trend to the creator's audience */}
        <div style={{
          padding: '16px 18px',
          background: 'linear-gradient(135deg, rgba(139,92,246,0.06), rgba(139,92,246,0.02))',
          border: '1px solid rgba(139,92,246,0.15)',
          borderRadius: 12,
        }}>
          <div style={{
            fontSize: 11, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase',
            color: 'var(--accent)', marginBottom: 8, fontFamily: 'var(--font-ui)',
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/>
            </svg>
            Your angle
          </div>
          {bridgeLoading ? (
            <div className="pulse-shimmer" style={{
              height: 20, borderRadius: 6,
            }} />
          ) : localBridge ? (
            <p style={{
              fontSize: 14, lineHeight: 1.55, color: 'var(--text)',
              fontFamily: 'var(--font-ui)', margin: 0, fontWeight: 500,
            }}>
              {localBridge}
            </p>
          ) : (
            <p style={{
              fontSize: 13, color: 'var(--text-dim)', fontStyle: 'italic',
              fontFamily: 'var(--font-ui)', margin: 0,
            }}>
              Set your audience brief to see your angle on this trend.
            </p>
          )}
        </div>

        {/* Unlock button + enrichment content */}
        {!localEnrichment ? (
          <button
            onClick={handleUnlock}
            disabled={enrichLoading}
            style={{
              width: '100%', padding: '14px 20px',
              background: enrichLoading
                ? 'linear-gradient(135deg, rgba(139,92,246,0.08), rgba(139,92,246,0.04))'
                : 'linear-gradient(135deg, rgba(139,92,246,0.15), rgba(139,92,246,0.08))',
              border: '1px solid rgba(139,92,246,0.25)',
              borderRadius: 12, cursor: enrichLoading ? 'wait' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              fontFamily: 'var(--font-ui)', fontSize: 13.5, fontWeight: 700,
              color: 'var(--accent)', letterSpacing: '0.01em',
              transition: 'all 0.15s ease',
            }}
          >
            {enrichLoading ? (
              <>
                <span className="pulse-shimmer" style={{ width: 16, height: 16, borderRadius: 4, display: 'inline-block' }} />
                Searching across platforms…
              </>
            ) : (
              <>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/>
                </svg>
                See what platforms are saying
              </>
            )}
          </button>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {(['tiktok', 'youtube', 'instagram', 'linkedin'] as const).map(platformKey => {
              const platform = localEnrichment[platformKey];
              if (!platform || platform.items.length === 0) return null;
              return (
                <div key={platformKey} style={{
                  border: '1px solid var(--border)',
                  borderRadius: 12,
                  background: 'var(--surface-1)',
                  overflow: 'hidden',
                }}>
                  <button
                    onClick={() => setCollapsedPlatforms(prev => {
                      const next = new Set(prev);
                      next.has(platformKey) ? next.delete(platformKey) : next.add(platformKey);
                      return next;
                    })}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      fontSize: 12, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase',
                      color: 'var(--text)', fontFamily: 'var(--font-ui)',
                      background: 'var(--surface-2)', border: 'none',
                      borderBottom: collapsedPlatforms.has(platformKey) ? 'none' : '1px solid var(--border)',
                      cursor: 'pointer',
                      padding: '12px 16px', width: '100%', textAlign: 'left',
                      transition: 'background 0.15s ease',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-3, var(--surface-2))')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'var(--surface-2)')}
                  >
                    <PlatformIcon platform={platformKey} size={18} />
                    {platform.name}
                    <span style={{
                      fontWeight: 600, fontSize: 10,
                      color: 'var(--text-muted)', background: 'var(--surface-1)',
                      border: '1px solid var(--border)',
                      padding: '2px 8px', borderRadius: 100, letterSpacing: '0.02em',
                      textTransform: 'none',
                    }}>
                      {platform.items.length} result{platform.items.length !== 1 ? 's' : ''}
                    </span>
                    <svg
                      width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                      strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                      style={{ marginLeft: 'auto', transition: 'transform 0.15s ease', transform: collapsedPlatforms.has(platformKey) ? 'rotate(-90deg)' : 'rotate(0deg)', color: 'var(--text-muted)' }}
                    >
                      <path d="M6 9l6 6 6-6"/>
                    </svg>
                  </button>
                  {!collapsedPlatforms.has(platformKey) && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: 10 }}>
                    {platform.items.map((item, idx) => {
                      const recency = postRecency(item.posted_at);
                      return (
                      <a
                        key={idx}
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          display: 'flex', flexDirection: 'column', gap: 4,
                          padding: '10px 14px',
                          background: 'var(--surface-2)', borderRadius: 10,
                          border: '1px solid var(--border)',
                          textDecoration: 'none', color: 'var(--text)',
                          transition: 'border-color 0.15s ease',
                        }}
                        onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--accent)')}
                        onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
                      >
                        <span style={{
                          fontSize: 13, fontWeight: 600, lineHeight: 1.4,
                          fontFamily: 'var(--font-ui)',
                          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                        }}>
                          {item.title}
                        </span>
                        <div style={{
                          display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap',
                          fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-ui)',
                        }}>
                          <span style={{ fontWeight: 600 }}>{item.author}</span>
                          {recency && (
                            <span style={{
                              fontSize: 10, fontWeight: 700,
                              color: recency.color, background: recency.bg,
                              padding: '2px 7px', borderRadius: 100,
                              letterSpacing: '0.02em',
                            }}>{recency.label}</span>
                          )}
                          {(item.views != null && item.views > 0) && (
                            <span style={{
                              fontSize: 10, fontWeight: 600,
                              color: 'var(--text-muted)', background: 'var(--surface-1)',
                              border: '1px solid var(--border)',
                              padding: '2px 7px', borderRadius: 100, letterSpacing: '0.02em',
                            }}>{formatVolume(item.views)} views</span>
                          )}
                          {(item.plays != null && item.plays > 0) && (
                            <span style={{
                              fontSize: 10, fontWeight: 600,
                              color: 'var(--text-muted)', background: 'var(--surface-1)',
                              border: '1px solid var(--border)',
                              padding: '2px 7px', borderRadius: 100, letterSpacing: '0.02em',
                            }}>{formatVolume(item.plays)} plays</span>
                          )}
                          {(item.likes != null && item.likes > 0) && (
                            <span style={{
                              fontSize: 10, fontWeight: 600,
                              color: 'var(--text-muted)', background: 'var(--surface-1)',
                              border: '1px solid var(--border)',
                              padding: '2px 7px', borderRadius: 100, letterSpacing: '0.02em',
                            }}>{formatVolume(item.likes)} likes</span>
                          )}
                          {(item.comments != null && item.comments > 0) && (
                            <span style={{
                              fontSize: 10, fontWeight: 600,
                              color: 'var(--text-muted)', background: 'var(--surface-1)',
                              border: '1px solid var(--border)',
                              padding: '2px 7px', borderRadius: 100, letterSpacing: '0.02em',
                            }}>{formatVolume(item.comments)} comments</span>
                          )}
                          {(item.shares != null && item.shares > 0) && (
                            <span style={{
                              fontSize: 10, fontWeight: 600,
                              color: 'var(--text-muted)', background: 'var(--surface-1)',
                              border: '1px solid var(--border)',
                              padding: '2px 7px', borderRadius: 100, letterSpacing: '0.02em',
                            }}>{formatVolume(item.shares)} shares</span>
                          )}
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: 'auto', flexShrink: 0 }}>
                            <path d="M7 17L17 7M7 7h10v10"/>
                          </svg>
                        </div>
                      </a>
                      );
                    })}
                  </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
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
  const [result, setResult] = useState<PulseFeedResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hiddenCats, setHiddenCats] = useState<Set<string>>(new Set());
  const [relevance, setRelevance] = useState<Record<string, RelevanceScore>>({});
  const [relevanceLoading, setRelevanceLoading] = useState(false);
  const [viewMode, setViewMode] = useState<'relevant' | 'all'>('relevant');
  const [sortBy, setSortBy] = useState<'default' | 'fit' | 'newness' | 'activity'>('default');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [brief, setBrief] = useState<string>('');

  // Chunk B — table layout state
  const PAGE_SIZE = 10;
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedTrend, setSelectedTrend] = useState<PulseTrend | null>(null);
  const handleClosePanel = useCallback(() => setSelectedTrend(null), []);

  // Lock background scroll when modal is open
  useEffect(() => {
    if (selectedTrend) {
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = ''; };
    }
  }, [selectedTrend]);
  const [bridgeCache, setBridgeCache] = useState<Record<string, string>>({});
  const [enrichmentCache, setEnrichmentCache] = useState<Record<string, EnrichmentData>>({});
  const [unlockedIds, setUnlockedIds] = useState<Set<string>>(new Set());

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
          setBrief(p.audience_brief || '');
        }
      })
      .catch(() => { /* best-effort */ })
      .finally(() => setProfileLoaded(true));
  }, []);

  // Restore persisted category filter after mount (avoids SSR mismatch)
  useEffect(() => { setHiddenCats(loadHiddenCategories()); }, []);

  // Score relevance for the trends that don't have a cached fit yet.
  // missingIds=null means score everything (e.g. brief changed); a non-empty
  // array means only score those, and merge results into existing state.
  const scoreRelevance = useCallback(async (masterRefreshId: number, missingIds: string[] | null) => {
    // Only clear state on a full re-score. On a partial fill, keep existing fits.
    if (missingIds === null) setRelevance({});
    setRelevanceLoading(true);
    try {
      const ctx = creatorCtxRef.current;
      const res = await fetch('/api/pulse-relevance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          master_refresh_id: masterRefreshId,
          brief: ctx.brief,
          platforms: ctx.platforms,
          content_format: ctx.format,
          content_styles: ctx.styles,
          ...(missingIds ? { missing_ids: missingIds } : {}),
        }),
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.scores)) {
        setRelevance(prev => {
          const next = missingIds === null ? {} : { ...prev };
          for (const s of data.scores) {
            if (s?.id && (s.fit === 'high' || s.fit === 'medium' || s.fit === 'low')) {
              next[s.id] = { fit: s.fit };
            }
          }
          return next;
        });
      }
    } catch { /* leave unscored — cards render without a signal */ }
    finally { setRelevanceLoading(false); }
  }, []);

  // E5: Single fetch to /api/pulse-feed. Server returns the latest master
  // pool snapshot + the user's cached scores (if still valid). On a cache
  // hit, scores arrive in the same response — no second Sonnet call needed.
  // On a miss, we fire pulse-relevance to score + write the cache row.
  const fetchTrends = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/pulse-feed');
      const data: PulseFeedResponse = await res.json();

      if (!data.success) {
        setError('Could not load trends right now.');
        return;
      }
      if (data.cache_state === 'empty_master_pool') {
        setResult(data);
        setError('Trends are still warming up. Check back in a few minutes.');
        return;
      }

      setResult(data);

      // Apply whatever cached scores came back. cache_state tells us if we
      // have everything ('hit'), nothing ('miss_no_cache'), or a subset ('partial').
      // The scoring trigger useEffect below will request the missing ones.
      if (data.scores && data.scores.length > 0) {
        const map: Record<string, RelevanceScore> = {};
        for (const s of data.scores) {
          if (s?.id && (s.fit === 'high' || s.fit === 'medium' || s.fit === 'low')) {
            map[s.id] = { fit: s.fit as Fit };
          }
        }
        setRelevance(map);
      } else {
        // No cached scores at all — clear so the shimmer shows on existing rows.
        setRelevance({});
      }

      // Populate unlocked state for lock/unlock icons
      setUnlockedIds(new Set(data.unlocked_ids || []));
    } catch {
      setError('Could not load trends right now.');
    } finally {
      setLoading(false);
    }
  }, []);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchTrends(); }, []);

  const trends = useMemo(() => result?.trends || [], [result]);
  const masterRefreshId = result?.master_refresh_id ?? null;
  const cacheState = result?.cache_state;

  // Trigger scoring for trends that don't have a cached fit yet. Waits for
  // the profile so brief is in hand. With per-trend caching, only newly-merged
  // trends typically need scoring on each refresh — not the whole pool.
  useEffect(() => {
    if (!profileLoaded) return;
    if (!masterRefreshId) return;
    if (cacheState === 'hit') return; // all trends already have cached fits
    if (trends.length === 0) return;

    // Determine which trend IDs are missing a fit
    const missingIds = trends.filter(t => !relevance[t.id]).map(t => t.id);
    if (missingIds.length === 0) return; // nothing to score
    scoreRelevance(masterRefreshId, missingIds);
    // We intentionally omit `relevance` from deps — we only want to fire once
    // when the feed lands. After scoring writes, relevance updates and we don't
    // want to re-fire and clobber it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileLoaded, masterRefreshId, cacheState, trends.length, scoreRelevance]);


  // Categories present in the current feed (unique, sorted)
  const availableCategories = useMemo(() => {
    return [...new Set(trends.map(trendCategory))].sort();
  }, [trends]);

  // Trends after category filter, then (under 'relevant' view) hiding low-fit.
  const visibleTrends = useMemo(() => {
    let list = hiddenCats.size === 0 ? trends : trends.filter(t => !hiddenCats.has(trendCategory(t)));
    if (viewMode === 'relevant') {
      // Hide only CONFIRMED low-fit. Unscored trends stay visible — fail open
      // during progressive fill and when there's no brief. (Chunk 2: multi-source
      // volume makes default-hide-low worth the slight reflow when scores land.)
      list = list.filter(t => relevance[t.id]?.fit !== 'low');
    }
    return list;
  }, [trends, hiddenCats, viewMode, relevance]);

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

  // Apply sort to the (already filtered) trends.
  // - sortBy='default' uses the smart default (fit→newness in relevant mode,
  //   newness in show-all mode).
  // - Otherwise the user picked a column; we sort by that with sortDir.
  const displayTrends = useMemo(() => {
    const arr = [...visibleTrends];
    const fitOrder: Record<Fit, number> = { high: 0, medium: 1, low: 2 };

    // Helpers — these all return "smaller = higher rank" by default
    const fitRank = (t: PulseTrend) => fitOrder[relevance[t.id]?.fit ?? 'medium'];
    const newnessRank = (t: PulseTrend) => NEWNESS_ORDER[newnessTier(t.first_seen_at)];
    const activityRank = (t: PulseTrend) => {
      // For Reddit: upvotes. For Google: search volume. Both higher = more active.
      // Return as negative so "smaller = higher rank" matches the other helpers.
      const val = (t.reddit_upvotes ?? t.search_volume ?? 0);
      return -val;
    };

    if (sortBy === 'default') {
      if (viewMode === 'all') {
        arr.sort((a, b) => newnessRank(a) - newnessRank(b));
      } else {
        arr.sort((a, b) => {
          const fa = fitRank(a); const fb = fitRank(b);
          if (fa !== fb) return fa - fb;
          return newnessRank(a) - newnessRank(b);
        });
      }
      return arr;
    }

    const dir = sortDir === 'desc' ? 1 : -1; // 'desc' = best first (smaller rank → top)
    if (sortBy === 'fit') {
      arr.sort((a, b) => dir * (fitRank(a) - fitRank(b)) || (newnessRank(a) - newnessRank(b)));
    } else if (sortBy === 'newness') {
      arr.sort((a, b) => dir * (newnessRank(a) - newnessRank(b)) || (fitRank(a) - fitRank(b)));
    } else if (sortBy === 'activity') {
      arr.sort((a, b) => dir * (activityRank(a) - activityRank(b)));
    }
    return arr;
  }, [visibleTrends, viewMode, relevance, sortBy, sortDir]);

  // Reset to page 1 when user-initiated filters/sort change (not on data updates)
  useEffect(() => { setCurrentPage(1); }, [hiddenCats, viewMode, sortBy, sortDir]);

  // Header click handler — toggle direction if same column, else switch column
  const handleSort = useCallback((col: 'fit' | 'newness' | 'activity') => {
    setSortBy(prev => {
      if (prev === col) {
        setSortDir(d => d === 'desc' ? 'asc' : 'desc');
        return prev;
      }
      setSortDir('desc'); // default direction when switching columns
      return col;
    });
  }, []);

  // Pagination — clamp page if list shrinks
  const totalPages = Math.max(1, Math.ceil(displayTrends.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const pageStart = (safePage - 1) * PAGE_SIZE;
  const pageTrends = displayTrends.slice(pageStart, pageStart + PAGE_SIZE);

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
            {result?.refreshed_at && !loading && (
              <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>
                Refreshed {timeAgo(result.refreshed_at)}
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
            <button className="btn-ghost" onClick={() => fetchTrends()} disabled={loading} style={{ fontSize: 12, padding: '6px 12px' }}>
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
              <button className="btn-ghost" onClick={() => fetchTrends()} style={{ fontSize: 13, padding: '8px 16px' }}>
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
                  <p style={{ fontSize: 15, lineHeight: 1.6, color: 'var(--text-muted)', fontFamily: 'var(--font-ui)', maxWidth: 620, margin: '0 0 14px' }}>
                    What&apos;s breaking out across the web — and where it fits your audience. Ride a wave before it crests.
                  </p>

                  {/* Audience indicator (Chunk D) — shows what 'your audience' refers to */}
                  {profileLoaded && brief && (
                    <div style={{
                      display: 'inline-flex', alignItems: 'center', gap: 9,
                      background: 'var(--surface-2)', border: '1px solid var(--border)',
                      borderRadius: 100, padding: '6px 12px 6px 11px',
                      fontFamily: 'var(--font-ui)', fontSize: 12.5,
                      maxWidth: '100%', minWidth: 0,
                    }}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                        <circle cx="12" cy="7" r="4"/>
                      </svg>
                      <span style={{
                        fontSize: 10.5, fontWeight: 700, letterSpacing: '0.07em',
                        textTransform: 'uppercase', color: 'var(--text-dim)', flexShrink: 0,
                      }}>
                        Your audience
                      </span>
                      <span style={{
                        color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap', minWidth: 0, maxWidth: 460,
                      }}
                      title={brief}>
                        {brief}
                      </span>
                      <Link href="/settings" style={{
                        fontSize: 12, fontWeight: 600, color: 'var(--accent)',
                        textDecoration: 'none', flexShrink: 0, marginLeft: 2,
                      }}>
                        Edit
                      </Link>
                    </div>
                  )}
                  {profileLoaded && !brief && (
                    <Link href="/settings" style={{
                      display: 'inline-flex', alignItems: 'center', gap: 8,
                      background: 'var(--accent-dim)', border: '1px solid var(--accent)',
                      borderRadius: 100, padding: '7px 14px',
                      fontFamily: 'var(--font-ui)', fontSize: 13, fontWeight: 600,
                      color: 'var(--accent)', textDecoration: 'none',
                    }}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                        <circle cx="12" cy="7" r="4"/>
                      </svg>
                      Set your audience to unlock fit scoring →
                    </Link>
                  )}
                </div>

                {/* View toggle */}
                {hasAnyScores && (
                  <div style={{
                    display: 'inline-flex', background: 'var(--surface-2)', border: '1px solid var(--border)',
                    borderRadius: 100, padding: 3, flexShrink: 0,
                  }}>
                    {(['relevant', 'all'] as const).map(mode => {
                      const active = viewMode === mode;
                      return (
                        <button
                          key={mode}
                          onClick={() => setViewMode(mode)}
                          style={{
                            fontSize: 12.5, fontWeight: active ? 700 : 500, fontFamily: 'var(--font-ui)',
                            padding: '6px 14px', borderRadius: 100, border: 'none', cursor: 'pointer',
                            background: active ? 'var(--surface-solid)' : 'transparent',
                            color: active ? 'var(--accent)' : 'var(--text-muted)',
                            boxShadow: active ? 'var(--shadow-xs)' : 'none',
                            transition: 'all 0.15s', whiteSpace: 'nowrap',
                          }}
                        >
                          {mode === 'relevant' ? 'Relevant to me' : 'Show all trends'}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <div style={{
                background: 'var(--surface)',
                border: '1px solid var(--surface-border)',
                borderRadius: 12,
                boxShadow: 'var(--shadow-sm)',
                backdropFilter: 'blur(14px)',
                WebkitBackdropFilter: 'blur(14px)',
                overflow: 'hidden',
              }}>
                {/* Column headers — Fit, Newness, Activity are sortable */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '40px 70px minmax(0, 1fr) 130px 85px 85px 100px 18px',
                  alignItems: 'center',
                  gap: 14,
                  padding: '10px 18px',
                  borderBottom: '1px solid var(--border)',
                  background: 'var(--surface-2)',
                  fontFamily: 'var(--font-ui)',
                  fontSize: 10.5, fontWeight: 700, letterSpacing: '0.07em',
                  textTransform: 'uppercase',
                  color: 'var(--text-dim)',
                  textAlign: 'center',
                }}>
                  <span>#</span>
                  <span>Source</span>
                  <span>Trend</span>
                  <span>Category</span>
                  {(['fit', 'newness', 'activity'] as const).map(col => {
                    const active = sortBy === col;
                    const label = col === 'fit' ? 'Fit' : col === 'newness' ? 'Newness' : 'Activity';
                    return (
                      <button
                        key={col}
                        onClick={() => handleSort(col)}
                        style={{
                          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                          background: 'none', border: 'none', cursor: 'pointer',
                          font: 'inherit', letterSpacing: 'inherit', textTransform: 'inherit',
                          color: active ? 'var(--accent)' : 'var(--text-dim)',
                          padding: 0,
                        }}
                        title={`Sort by ${label}`}
                      >
                        {label}
                        {active ? (
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                            {sortDir === 'desc' ? <polyline points="6 9 12 15 18 9"/> : <polyline points="6 15 12 9 18 15"/>}
                          </svg>
                        ) : (
                          // Subtle two-arrow indicator that this is sortable
                          <svg width="8" height="10" viewBox="0 0 8 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.4 }}>
                            <polyline points="2 4 4 2 6 4"/>
                            <polyline points="2 6 4 8 6 6"/>
                          </svg>
                        )}
                      </button>
                    );
                  })}
                  <span />
                </div>

                {pageTrends.map((trend, i) => (
                  <PulseRow
                    key={trend.id}
                    trend={trend}
                    rank={trendingRank[trend.id]}
                    relevance={relevance[trend.id]}
                    relevanceLoading={relevanceLoading}
                    onOpen={() => setSelectedTrend(trend)}
                    isLast={i === pageTrends.length - 1}
                    unlocked={unlockedIds.has(trend.id)}
                  />
                ))}
              </div>

              {/* Pagination — hidden if everything fits on one page */}
              {totalPages > 1 && (
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12,
                  marginTop: 24, paddingTop: 8, fontFamily: 'var(--font-ui)',
                }}>
                  <button
                    className="btn-ghost"
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={safePage <= 1}
                    style={{ fontSize: 12.5, padding: '6px 14px', opacity: safePage <= 1 ? 0.4 : 1 }}
                  >
                    ← Prev
                  </button>
                  <span style={{ fontSize: 13, color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>
                    Page <strong style={{ color: 'var(--text)' }}>{safePage}</strong> of {totalPages}
                  </span>
                  <button
                    className="btn-ghost"
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={safePage >= totalPages}
                    style={{ fontSize: 12.5, padding: '6px 14px', opacity: safePage >= totalPages ? 0.4 : 1 }}
                  >
                    Next →
                  </button>
                </div>
              )}

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

      {/* Detail modal (mirrors the dashboard AIE drawer pattern) */}
      {selectedTrend && (
        <>
          <div className="panel-overlay" onClick={handleClosePanel} />
          <div style={{
            position: 'fixed',
            top: '50%', left: '50%',
            transform: 'translate(-50%, -50%)',
            width: 'min(1100px, 95vw)',
            maxHeight: '95vh',
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 16,
            zIndex: 51,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 24px 80px rgba(0,0,0,0.15)',
            animation: 'modal-in 0.2s ease',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
          }}>
            <PulseTrendDetail
              trend={selectedTrend}
              relevance={relevance[selectedTrend.id]}
              onClose={handleClosePanel}
              bridge={bridgeCache[selectedTrend.id]}
              onBridgeLoaded={(id, b) => setBridgeCache(prev => ({ ...prev, [id]: b }))}
              creatorCtx={creatorCtxRef.current}
              enrichment={enrichmentCache[selectedTrend.id]}
              onEnrichmentLoaded={(id, data) => {
                setEnrichmentCache(prev => ({ ...prev, [id]: data }));
                // Optimistically mark as unlocked so the row icon flips
                // without waiting for the next feed fetch.
                setUnlockedIds(prev => {
                  if (prev.has(id)) return prev;
                  const next = new Set(prev);
                  next.add(id);
                  return next;
                });
              }}
            />
          </div>
        </>
      )}
    </AppShell>
  );
}
