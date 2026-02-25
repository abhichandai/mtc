import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || 'http://143.198.46.229:5000';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const query = searchParams.get('query') || '';
    const limit = searchParams.get('limit') || '10';

    if (!query) return NextResponse.json({ error: 'Query required' }, { status: 400 });

    const res = await fetch(
      `${BACKEND_URL}/trends/twitter/search?query=${encodeURIComponent(query)}&limit=${limit}`,
      { signal: AbortSignal.timeout(10000) }
    );
    const data = await res.json();
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to fetch tweets' },
      { status: 500 }
    );
  }
}
