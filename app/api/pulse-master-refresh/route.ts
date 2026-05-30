import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// This route is invoked by Vercel cron (every 4h). It can also be called
// manually with the CRON_SECRET in the Authorization header for verification.
// Auth follows the Vercel-cron-recommended pattern: a shared secret.

export const maxDuration = 60; // Reddit fan-out + Google fetch + DB write

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || 'https://mtc-backend-rust.vercel.app';
const KEEP_SNAPSHOTS = 2; // current + previous, for race-safety

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
};

/**
 * Mirrors the frontend's combineAndSort. Reddit trends already carry a 0-1
 * `velocity`; Google trends get one derived from search_volume within the
 * Google set so the two feeds interleave fairly on a unified sort key.
 */
function combineAndSort(google: RawTrend[], reddit: RawTrend[]): RawTrend[] {
  const maxGV = Math.max(1, ...google.map(t => t.search_volume || 0));
  const g = google.map(t => ({ ...t, source: 'google' as const, sortVelocity: (t.search_volume || 0) / maxGV }));
  const r = reddit.map(t => ({ ...t, source: 'reddit' as const, sortVelocity: t.velocity ?? 0 }));
  return [...g, ...r].sort((a, b) => (b.sortVelocity ?? 0) - (a.sortVelocity ?? 0));
}

async function fetchSource(url: string): Promise<RawTrend[]> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(45000) });
    if (!res.ok) return [];
    const data = await res.json();
    return data.success && Array.isArray(data.trends) ? data.trends : [];
  } catch {
    return [];
  }
}

export async function GET(req: NextRequest) {
  // Auth: Vercel cron sends Authorization: Bearer <CRON_SECRET>. Manual
  // verification can pass the same header. No Clerk — this is a system route.
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

  // Fetch both sources in parallel. Tolerate one failing — same posture as
  // the frontend currently has.
  const [google, reddit] = await Promise.all([
    fetchSource(`${BACKEND_URL}/pulse/trends/raw?geo=US&limit=24`),
    fetchSource(`${BACKEND_URL}/pulse/trends/reddit?limit=24`),
  ]);

  if (google.length === 0 && reddit.length === 0) {
    return NextResponse.json(
      { success: false, error: 'Both sources returned empty; not writing a snapshot' },
      { status: 502 }
    );
  }

  const trends = combineAndSort(google, reddit);

  // Insert the new snapshot
  const { data: inserted, error: insertErr } = await supabase
    .from('pulse_trends_master')
    .insert({
      trends,
      google_count: google.length,
      reddit_count: reddit.length,
      total_count: trends.length,
    })
    .select('id, refreshed_at')
    .single();

  if (insertErr || !inserted) {
    return NextResponse.json(
      { success: false, error: insertErr?.message || 'Insert failed' },
      { status: 500 }
    );
  }

  // Prune to the latest KEEP_SNAPSHOTS rows. Stale user_relevance_cache rows
  // cascade-delete with them (FK behavior).
  const { data: keepRows } = await supabase
    .from('pulse_trends_master')
    .select('id')
    .order('refreshed_at', { ascending: false })
    .limit(KEEP_SNAPSHOTS);

  const keepIds = (keepRows || []).map(r => r.id);
  let pruned = 0;
  if (keepIds.length > 0) {
    const { error: deleteErr, count } = await supabase
      .from('pulse_trends_master')
      .delete({ count: 'exact' })
      .not('id', 'in', `(${keepIds.join(',')})`);
    if (!deleteErr) pruned = count || 0;
  }

  return NextResponse.json({
    success: true,
    snapshot_id: inserted.id,
    refreshed_at: inserted.refreshed_at,
    google_count: google.length,
    reddit_count: reddit.length,
    total_count: trends.length,
    pruned,
  });
}
