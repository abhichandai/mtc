import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// This route is invoked by Vercel cron (every 4h). It can also be called
// manually with the CRON_SECRET in the Authorization header for verification.
//
// Accumulation model (48h rolling window):
// Each refresh merges new trends into the existing pool rather than replacing
// it. Trends carry a `first_seen_at` timestamp from their first appearance.
// Existing trends get updated metrics but keep their original first_seen_at.
// Anything older than RETENTION_HOURS is pruned from the pool.

export const maxDuration = 60; // Reddit fan-out + Google fetch + DB write

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || 'https://mtc-backend-rust.vercel.app';
const RETENTION_HOURS = 48; // trends older than this are pruned

type RawTrend = {
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
  source?: string;
  velocity?: number | null;
  reddit_upvotes?: number | null;
  subreddit?: string | null;
  permalink?: string | null;
  sortVelocity?: number;
  first_seen_at?: string;
};

/** Stable merge key: source + lowercased query */
function mergeKey(t: RawTrend): string {
  return `${t.source || 'google'}:${t.query.toLowerCase().trim()}`;
}

/**
 * Tag incoming trends with source + sortVelocity (same logic as before).
 */
function tagIncoming(google: RawTrend[], reddit: RawTrend[]): RawTrend[] {
  const maxGV = Math.max(1, ...google.map(t => t.search_volume || 0));
  const g = google.map(t => ({ ...t, source: 'google' as const, sortVelocity: (t.search_volume || 0) / maxGV }));
  const r = reddit.map(t => ({ ...t, source: 'reddit' as const, sortVelocity: t.velocity ?? 0 }));
  return [...g, ...r];
}

/**
 * Merge incoming trends into the existing pool.
 * - Existing trend matched by mergeKey → update metrics, keep first_seen_at
 * - New trend → add with first_seen_at = now
 * - Trends older than RETENTION_HOURS → pruned
 * Returns the merged pool sorted by sortVelocity (descending).
 */
function mergePool(existing: RawTrend[], incoming: RawTrend[], now: string): RawTrend[] {
  const cutoff = Date.now() - RETENTION_HOURS * 60 * 60 * 1000;

  // Seed pool with existing trends that haven't expired
  const pool = new Map<string, RawTrend>();
  for (const t of existing) {
    if (t.first_seen_at && new Date(t.first_seen_at).getTime() < cutoff) continue;
    // Backfill first_seen_at for trends from before accumulation was enabled
    pool.set(mergeKey(t), t.first_seen_at ? t : { ...t, first_seen_at: now });
  }

  // Merge incoming: update metrics for known trends, add new ones
  for (const t of incoming) {
    const key = mergeKey(t);
    const prev = pool.get(key);
    if (prev) {
      // Preserve original id + first_seen_at so the trend has stable identity
      // for the full 48h. Everything else (metrics, breakdowns) takes the fresh value.
      pool.set(key, { ...t, id: prev.id, first_seen_at: prev.first_seen_at || now });
    } else {
      pool.set(key, { ...t, first_seen_at: now });
    }
  }

  return Array.from(pool.values())
    .sort((a, b) => (b.sortVelocity ?? 0) - (a.sortVelocity ?? 0));
}

async function fetchSource(url: string, label: string): Promise<RawTrend[]> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(45000) });
    if (!res.ok) {
      console.error(`[pulse-master-refresh] ${label} HTTP ${res.status} from ${url}`);
      return [];
    }
    const data = await res.json();
    if (!data.success) {
      console.error(`[pulse-master-refresh] ${label} success=false: ${data.error || 'unknown error'}`);
      return [];
    }
    const trends = Array.isArray(data.trends) ? data.trends : [];
    if (trends.length === 0) {
      console.warn(`[pulse-master-refresh] ${label} returned 0 trends (legitimate empty response)`);
    }
    return trends;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[pulse-master-refresh] ${label} fetch failed: ${msg}`);
    return [];
  }
}

export async function GET(req: NextRequest) {
  const expectedSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get('authorization');
  if (!expectedSecret) {
    return NextResponse.json(
      { error: 'Server misconfiguration: CRON_SECRET env var not set' },
      { status: 500 }
    );
  }
  if (authHeader !== `Bearer ${expectedSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // 1. Fetch both sources in parallel
  const [google, reddit] = await Promise.all([
    fetchSource(`${BACKEND_URL}/pulse/trends/raw?geo=US&limit=24`, 'google'),
    fetchSource(`${BACKEND_URL}/pulse/trends/reddit?limit=24`, 'reddit'),
  ]);

  if (google.length === 0 && reddit.length === 0) {
    return NextResponse.json(
      { success: false, error: 'Both sources returned empty; not updating the pool' },
      { status: 502 }
    );
  }

  // 2. Read the existing (non-expired) pool from the normalized pulse_trends
  // table. This is the source of truth post-Phase-3 (snapshot table retired).
  // We reconstruct RawTrend[] from each row's trend_data jsonb, overriding
  // first_seen_at with the authoritative column value so merge identity holds.
  const { data: existingRows } = await supabase
    .from('pulse_trends')
    .select('trend_data, first_seen_at')
    .gt('expires_at', new Date().toISOString());

  const existingPool: RawTrend[] = (existingRows || []).map(r => ({
    ...(r.trend_data as RawTrend),
    first_seen_at: r.first_seen_at,
  }));

  // 3. Tag incoming trends with source + sortVelocity, then merge
  const now = new Date().toISOString();
  const incoming = tagIncoming(google, reddit);
  const merged = mergePool(existingPool, incoming, now);

  // Count how many from each source are in the final pool
  const googleInPool = merged.filter(t => t.source === 'google').length;
  const redditInPool = merged.filter(t => t.source === 'reddit').length;

  // 4. Upsert each merged trend into pulse_trends (the only write target now).
  // expires_at is first_seen_at + RETENTION — a trend has a hard lifespan of
  // RETENTION_HOURS from when it FIRST appeared, regardless of how long it keeps
  // trending. This puts the merge cutoff, the prune, and the feed all on a single
  // first-seen clock, so there are no frozen-but-unpruned trends lingering past
  // the window.
  const trendRows = merged.map(t => {
    const firstSeen = t.first_seen_at || now;
    const expiresAt = new Date(
      new Date(firstSeen).getTime() + RETENTION_HOURS * 60 * 60 * 1000
    ).toISOString();
    return {
      id: t.id,
      source: t.source || 'google',
      query: t.query,
      first_seen_at: firstSeen,
      last_seen_at: now,
      expires_at: expiresAt,
      trend_data: t,
      categories: t.categories || [],
    };
  });

  let trendsUpserted = 0;
  if (trendRows.length > 0) {
    // Chunk in case of large pools — Supabase has a per-request size cap.
    const CHUNK = 100;
    for (let i = 0; i < trendRows.length; i += CHUNK) {
      const chunk = trendRows.slice(i, i + CHUNK);
      const { error: upsertErr, count } = await supabase
        .from('pulse_trends')
        .upsert(chunk, {
          onConflict: 'id',
          // Don't overwrite first_seen_at on conflict — keep the original
          ignoreDuplicates: false,
          count: 'exact',
        });
      if (upsertErr) {
        console.error(`[pulse-master-refresh] pulse_trends upsert failed: ${upsertErr.message}`);
      } else {
        trendsUpserted += count || 0;
      }
    }
  }

  // 5. Prune expired trends from pulse_trends. Best-effort — don't fail the
  // cron if this errors.
  const { count: trendsPruned } = await supabase
    .from('pulse_trends')
    .delete({ count: 'exact' })
    .lt('expires_at', new Date().toISOString());

  return NextResponse.json({
    success: true,
    refreshed_at: now,
    fresh_google: google.length,
    fresh_reddit: reddit.length,
    pool_total: merged.length,
    pool_google: googleInPool,
    pool_reddit: redditInPool,
    carried_over: existingPool.length,
    trends_upserted: trendsUpserted,
    trends_pruned: trendsPruned || 0,
  });
}
