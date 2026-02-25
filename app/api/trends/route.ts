import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || 'http://143.198.46.229:5000';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const source = searchParams.get('source') || 'google';
    const limit = searchParams.get('limit') || '20';
    const fresh = searchParams.get('fresh') || '';

    const url = `${BACKEND_URL}/trends/${source}?limit=${limit}${fresh ? '&fresh=true' : ''}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
    const data = await res.json();

    return NextResponse.json({ success: true, data });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to fetch trends' },
      { status: 500 }
    );
  }
}
