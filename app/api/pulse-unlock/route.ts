import { NextRequest, NextResponse } from 'next/server';

export const maxDuration = 30;

const BACKEND_URL = process.env.BACKEND_URL || 'https://mtc-backend-rust.vercel.app';

export async function GET(req: NextRequest) {
  const query = req.nextUrl.searchParams.get('query') || '';
  const limit = req.nextUrl.searchParams.get('limit') || '5';
  const youtubeQuery = req.nextUrl.searchParams.get('youtube_query') || '';

  if (!query) {
    return NextResponse.json({ success: false, error: 'query required' }, { status: 400 });
  }

  try {
    const params = new URLSearchParams({ query, limit });
    if (youtubeQuery) params.set('youtube_query', youtubeQuery);
    const url = `${BACKEND_URL}/pulse/enrich?${params.toString()}`;
    const resp = await fetch(url, { next: { revalidate: 0 } });

    if (!resp.ok) {
      console.error('[pulse-unlock] Backend error:', resp.status);
      return NextResponse.json(
        { success: false, error: `Backend returned ${resp.status}` },
        { status: resp.status },
      );
    }

    const data = await resp.json();
    return NextResponse.json(data);
  } catch (err) {
    console.error('[pulse-unlock] Error:', err);
    return NextResponse.json(
      { success: false, error: 'Enrichment fetch failed' },
      { status: 500 },
    );
  }
}
