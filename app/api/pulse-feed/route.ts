import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { supabase } from '@/lib/supabase';
import { briefHash } from '@/lib/pulse';

// Phase 2: read from the normalized pulse_trends table instead of the
// JSONB snapshot blob. Active pool = rows where expires_at > now().
// Sort by sortVelocity (stored inside trend_data jsonb) descending.

export const maxDuration = 15;

type TrendRow = {
  id: string;
  source: string;
  query: string;
  first_seen_at: string;
  last_seen_at: string;
  expires_at: string;
  trend_data: Record<string, unknown>;
};

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // 1. Read active trends from the normalized pulse_trends table
  const nowIso = new Date().toISOString();
  const { data: rows, error: rowsErr } = await supabase
    .from('pulse_trends')
    .select('id, source, query, first_seen_at, last_seen_at, expires_at, trend_data')
    .gt('expires_at', nowIso)
    .order('last_seen_at', { ascending: false })
    .limit(500);

  if (rowsErr) {
    return NextResponse.json({ error: rowsErr.message }, { status: 500 });
  }

  const trendRows = (rows || []) as TrendRow[];

  if (trendRows.length === 0) {
    return NextResponse.json({
      success: true,
      trends: [],
      master_refresh_id: null,
      refreshed_at: null,
      scores: [],
      cache_state: 'empty_master_pool',
    });
  }

  // 2. Reconstruct the trend objects from trend_data jsonb. Preserve
  // first_seen_at from the column (authoritative) over what's in trend_data.
  const trends = trendRows.map(r => ({
    ...(r.trend_data as object),
    id: r.id,
    source: r.source,
    query: r.query,
    first_seen_at: r.first_seen_at,
  })) as Array<{ id: string; sortVelocity?: number; source?: string;[k: string]: unknown }>;

  // Sort by sortVelocity (descending). last_seen_at was the DB sort but
  // sortVelocity is what determines display rank.
  trends.sort((a, b) => (Number(b.sortVelocity) || 0) - (Number(a.sortVelocity) || 0));

  // 3. Profile + brief hash for cache lookup
  const { data: profile } = await supabase
    .from('profiles')
    .select('audience_brief, platforms, content_format, content_styles')
    .eq('user_id', userId)
    .maybeSingle();

  const currentBriefHash = briefHash(
    profile?.audience_brief || '',
    profile?.platforms || [],
    profile?.content_format || '',
    profile?.content_styles || []
  );

  // 4. Look up cached fits for the trends in this pool
  const trendIds = trends.map(t => t.id);
  const { data: cachedRows } = await supabase
    .from('user_trend_relevance')
    .select('trend_id, fit')
    .eq('user_id', userId)
    .eq('brief_hash', currentBriefHash)
    .in('trend_id', trendIds);

  const cachedScores = (cachedRows || []).map(r => ({ id: r.trend_id, fit: r.fit }));

  // 5. cache_state coverage
  const total = trendIds.length;
  const cached = cachedScores.length;
  const cacheState =
    cached === 0 ? 'miss_no_cache' :
    cached < total ? 'partial' :
    'hit';

  // 6. Compute source counts + a freshness signal
  const googleCount = trends.filter(t => t.source === 'google').length;
  const redditCount = trends.filter(t => t.source === 'reddit').length;
  const mostRecentLastSeen = trendRows.reduce(
    (acc, r) => r.last_seen_at > acc ? r.last_seen_at : acc,
    trendRows[0].last_seen_at
  );

  return NextResponse.json({
    success: true,
    trends,
    // master_refresh_id is deprecated — kept as a non-null placeholder so the
    // existing frontend scoring trigger still fires. Use last_seen_at as a
    // monotonic "version" of the active pool.
    master_refresh_id: Date.parse(mostRecentLastSeen),
    refreshed_at: mostRecentLastSeen,
    google_count: googleCount,
    reddit_count: redditCount,
    total_count: trends.length,
    scores: cachedScores,
    cached_count: cached,
    total_count_in_pool: total,
    cache_state: cacheState,
  });
}
