import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || 'http://143.198.46.229:5000';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const url = searchParams.get('url') || '';
    const amount = searchParams.get('amount') || '15';

    if (!url) {
      return NextResponse.json({ error: 'url parameter required' }, { status: 400 });
    }

    const res = await fetch(
      `${BACKEND_URL}/trends/reddit/comments?url=${encodeURIComponent(url)}&amount=${amount}`,
      { signal: AbortSignal.timeout(15000) }
    );
    const data = await res.json();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to fetch comments' },
      { status: 500 }
    );
  }
}
