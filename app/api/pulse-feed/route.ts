import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { supabase } from '@/lib/supabase';
import crypto from 'crypto';

// E3: the read route the frontend will consume. Replaces today's
// 'fetch Google + fetch Reddit + combine client-side' flow with a single
// DB read from the master pool, plus the user's cached relevance scores
// if they're still valid (master snapshot + brief both unchanged).
//
// Returns: trends + master_refresh_id + scores (or null on miss).
// The frontend uses scores=null as the signal to call /api/pulse-relevance.

export const maxDuration = 15; // pure DB reads — should be fast

// Hash of (brief + platforms + format + styles). Used to invalidate the
// cache when the creator changes any input to the scorer. Must match the
// hash produced by /api/pulse-relevance (E4 will use the same function).
export function briefHash(brief: string, platforms: string[], format: string, styles: string[]): string {
  const normalized = JSON.stringify({
    brief: (brief || '').trim(),
    platforms: [...(platforms || [])].sort(),
    format: format || '',
    styles: [...(styles || [])].sort(),
  });
  return crypto.createHash('sha256').update(normalized).digest('hex').slice(0, 16);
}

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
    // Bootstrap case — master pool has never been populated. Frontend can
    // surface a friendly empty state; cron or manual refresh will fix it.
    return NextResponse.json({
      success: true,
      trends: [],
      master_refresh_id: null,
      refreshed_at: null,
      scores: null,
      cache_state: 'empty_master_pool',
    });
  }

  // 2. User's profile (for brief_hash comparison against the cached one)
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

  // 3. User's cache row, if any
  const { data: cache } = await supabase
    .from('user_relevance_cache')
    .select('master_refresh_id, brief_hash, scores, scored_at')
    .eq('user_id', userId)
    .maybeSingle();

  // 4. Decide whether to serve cached scores
  const cacheHit =
    cache &&
    cache.master_refresh_id === master.id &&
    cache.brief_hash === currentBriefHash;

  return NextResponse.json({
    success: true,
    trends: master.trends,
    master_refresh_id: master.id,
    refreshed_at: master.refreshed_at,
    google_count: master.google_count,
    reddit_count: master.reddit_count,
    total_count: master.total_count,
    scores: cacheHit ? cache!.scores : null,
    scored_at: cacheHit ? cache!.scored_at : null,
    cache_state: cacheHit
      ? 'hit'
      : cache
        ? (cache.master_refresh_id !== master.id ? 'miss_stale_master' : 'miss_brief_changed')
        : 'miss_no_cache',
  });
}
