import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || 'http://143.198.46.229:5000';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const subreddits = searchParams.get('subreddits') || '';
    const limit = searchParams.get('limit') || '25';
    const fresh = searchParams.get('fresh') || 'false';

    if (!subreddits) {
      return NextResponse.json({ error: 'subreddits parameter required' }, { status: 400 });
    }

    const res = await fetch(
      `${BACKEND_URL}/trends/reddit?subreddits=${encodeURIComponent(subreddits)}&limit=${limit}&fresh=${fresh}`,
      { signal: AbortSignal.timeout(20000) }
    );
    const data = await res.json();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to fetch Reddit posts' },
      { status: 500 }
    );
  }
}
