import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || 'https://mtc-backend-rust.vercel.app';

// Proxy → backend /pulse/trends/reddit (Pulse Chunk 2 — Reddit discovery source)
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const limit = searchParams.get('limit') || '24';
    // Optional: the user's subreddit list. When omitted the backend falls back
    // to its default cultural set (which mirrors profiles.pulse_subreddits).
    const subreddits = searchParams.get('subreddits') || '';

    const qs = new URLSearchParams({ limit });
    if (subreddits) qs.set('subreddits', subreddits);

    const res = await fetch(
      `${BACKEND_URL}/pulse/trends/reddit?${qs.toString()}`,
      { signal: AbortSignal.timeout(30000) }
    );
    const data = await res.json();
    return NextResponse.json(data, { status: res.ok ? 200 : res.status });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to fetch Pulse Reddit trends' },
      { status: 500 }
    );
  }
}
