import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { supabase } from '@/lib/supabase';

// GET /api/saved-ideas — fetch all saved ideas for the current user
export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data, error } = await supabase
    .from('saved_ideas')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ideas: data });
}

// POST /api/saved-ideas — save a new idea object
export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const {
    post_title,
    post_url,
    subreddit,
    narrative_type,
    narrative_headline,
    narrative_insight,
    narrative_signal,
    selected_ideas,
    audience_brief,
  } = body;

  const { data, error } = await supabase
    .from('saved_ideas')
    .insert({
      user_id: userId,
      post_title,
      post_url,
      subreddit,
      narrative_type,
      narrative_headline,
      narrative_insight,
      narrative_signal,
      selected_ideas: selected_ideas ?? [],
      audience_brief,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ idea: data });
}

// DELETE /api/saved-ideas?id=<uuid> — delete a saved idea by id
export async function DELETE(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const id = req.nextUrl.searchParams.get('id');
  if (!id) {
    return NextResponse.json({ error: 'id required' }, { status: 400 });
  }

  const { error } = await supabase
    .from('saved_ideas')
    .delete()
    .eq('id', id)
    .eq('user_id', userId); // safety: can only delete your own

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
