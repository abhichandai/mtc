import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { supabase } from '@/lib/supabase';
import { briefHash } from '@/lib/pulse';

// Returns: trends + master_refresh_id + scores (cached fits for trends in the pool).
// Per-trend cache: with the 48h accumulation pool, trend IDs are stable across
// cron cycles, so a trend keeps its fit score for its full lifetime as long as
// the brief hasn't changed. scores may be partial — the frontend asks
// pulse-relevance to score the remaining trends.

export const maxDuration = 15;

type RawTrend = { id: string; [k: string]: unknown };

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // 1. Latest master snapshot
  const { data: master, error: masterErr } = await supabase
    .from('pulse_trends_master')
    .select('id, refreshed_at, trends, google_count, reddit_count, total_count')
    .order('refreshed_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (masterErr) {
    return NextResponse.json({ error: masterErr.message }, { status: 500 });
  }
  if (!master) {
    return NextResponse.json({
      success: true,
      trends: [],
      master_refresh_id: null,
      refreshed_at: null,
      scores: null,
      cache_state: 'empty_master_pool',
    });
  }

  // 2. User's profile for brief_hash
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

  // 3. Look up cached fits for the trends in this snapshot
  const trendIds = (master.trends as RawTrend[] || []).map(t => t.id);

  let cachedScores: Array<{ id: string; fit: string }> = [];
  if (trendIds.length > 0) {
    const { data: rows } = await supabase
      .from('user_trend_relevance')
      .select('trend_id, fit')
      .eq('user_id', userId)
      .eq('brief_hash', currentBriefHash)
      .in('trend_id', trendIds);

    cachedScores = (rows || []).map(r => ({ id: r.trend_id, fit: r.fit }));
  }

  // 4. Decide cache_state based on coverage
  const total = trendIds.length;
  const cached = cachedScores.length;
  const cacheState =
    total === 0 ? 'empty_master_pool' :
    cached === 0 ? 'miss_no_cache' :
    cached < total ? 'partial' :
    'hit';

  return NextResponse.json({
    success: true,
    trends: master.trends,
    master_refresh_id: master.id,
    refreshed_at: master.refreshed_at,
    google_count: master.google_count,
    reddit_count: master.reddit_count,
    total_count: master.total_count,
    scores: cachedScores,
    cached_count: cached,
    total_count_in_pool: total,
    cache_state: cacheState,
  });
}
