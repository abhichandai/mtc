import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { supabase } from '@/lib/supabase';

// POST /api/relevance-feedback — upsert a thumbs up/down on a post
export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { post_url, post_title, subreddit, verdict } = await req.json();

  if (!post_url || !post_title || !subreddit || !['up', 'down'].includes(verdict)) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  // Upsert — if user already rated this post, update the verdict
  const { error } = await supabase
    .from('relevance_feedback')
    .upsert(
      { user_id: userId, post_url, post_title, subreddit, verdict },
      { onConflict: 'user_id,post_url' }
    );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

// DELETE /api/relevance-feedback?post_url=<url> — remove feedback for a post
// DELETE /api/relevance-feedback — remove ALL feedback for the user (reset)
export async function DELETE(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const post_url = req.nextUrl.searchParams.get('post_url');

  const query = supabase
    .from('relevance_feedback')
    .delete()
    .eq('user_id', userId);

  const { error } = post_url
    ? await query.eq('post_url', post_url)
    : await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data, error } = await supabase
    .from('relevance_feedback')
    .select('post_url, post_title, subreddit, verdict')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ feedback: data });
}
