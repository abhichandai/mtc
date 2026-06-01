import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { supabase } from '@/lib/supabase';
import { briefHash } from '@/lib/pulse';

// Persistent unlock storage for Pulse trends. Reads the (user, trend, brief)
// tuple; writes a row when the user unlocks. Future "My List" feature flips
// saved_to_list on a separate PATCH (not implemented in this route yet).

export const maxDuration = 10;

async function resolveBriefHash(userId: string, bodyHash?: string): Promise<string> {
  if (bodyHash) return bodyHash;
  // Fallback — recompute from profile. Same pattern pulse-feed uses.
  const { data: profile } = await supabase
    .from('profiles')
    .select('audience_brief, platforms, content_format, content_styles')
    .eq('user_id', userId)
    .maybeSingle();
  return briefHash(
    profile?.audience_brief || '',
    profile?.platforms || [],
    profile?.content_format || '',
    profile?.content_styles || []
  );
}

// GET /api/pulse-unlocks?trend_id=X
// Returns: { success: true, unlock: { bridge, youtube_query, enrichment, ... } | null }
export async function GET(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const trendId = req.nextUrl.searchParams.get('trend_id');
  if (!trendId) {
    return NextResponse.json({ error: 'trend_id required' }, { status: 400 });
  }

  const hash = await resolveBriefHash(userId);

  const { data, error } = await supabase
    .from('pulse_unlocks')
    .select('bridge, youtube_query, enrichment, trend_snapshot, unlocked_at, saved_to_list')
    .eq('user_id', userId)
    .eq('trend_id', trendId)
    .eq('brief_hash', hash)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, unlock: data || null });
}

// POST /api/pulse-unlocks
// Body: { trend_id, bridge?, youtube_query?, enrichment?, trend_snapshot? }
// Upserts the row. Idempotent — calling twice keeps the original unlocked_at
// via DO NOTHING on conflict in PG... actually we want to update fields if
// provided, so we use a proper upsert. Old unlocked_at is preserved by NOT
// setting it on conflict.
export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: {
    trend_id?: string;
    bridge?: string;
    youtube_query?: string;
    enrichment?: unknown;
    trend_snapshot?: unknown;
    brief_hash?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (!body.trend_id) {
    return NextResponse.json({ error: 'trend_id required' }, { status: 400 });
  }

  const hash = await resolveBriefHash(userId, body.brief_hash);

  // First, check if a row already exists — if it does we keep unlocked_at
  // (when they first unlocked it) and only fill missing fields.
  const { data: existing } = await supabase
    .from('pulse_unlocks')
    .select('bridge, enrichment')
    .eq('user_id', userId)
    .eq('trend_id', body.trend_id)
    .eq('brief_hash', hash)
    .maybeSingle();

  const row = {
    user_id: userId,
    trend_id: body.trend_id,
    brief_hash: hash,
    // Prefer fresh values from body, but never overwrite existing with null
    bridge: body.bridge ?? existing?.bridge ?? null,
    youtube_query: body.youtube_query ?? null,
    enrichment: body.enrichment ?? existing?.enrichment ?? null,
    trend_snapshot: body.trend_snapshot ?? null,
  };

  const { error } = await supabase
    .from('pulse_unlocks')
    .upsert(row, { onConflict: 'user_id,trend_id,brief_hash' });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
