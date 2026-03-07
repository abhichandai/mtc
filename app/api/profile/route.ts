import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { supabase } from '@/lib/supabase';

// GET /api/profile — fetch the current user's profile
export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (error && error.code !== 'PGRST116') {
    // PGRST116 = no rows found — expected for new users
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ profile: data ?? null });
}

// POST /api/profile — create or update the current user's profile
export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const { audience_brief, platforms, content_styles, content_format, onboarding_completed } = body;

  const { data, error } = await supabase
    .from('profiles')
    .upsert(
      {
        user_id: userId,
        ...(audience_brief !== undefined && { audience_brief }),
        ...(platforms !== undefined && { platforms }),
        ...(content_styles !== undefined && { content_styles }),
        ...(content_format !== undefined && { content_format }),
        ...(onboarding_completed !== undefined && { onboarding_completed }),
        // Clear subreddit cache when the brief changes so analyze-niche recomputes on next load
        ...(audience_brief !== undefined && { cached_subreddits: null, cached_brief: null }),
      },
      { onConflict: 'user_id' }
    )
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ profile: data });
}
