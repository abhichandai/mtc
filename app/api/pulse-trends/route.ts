import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || 'https://mtc-backend-rust.vercel.app';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const geo = searchParams.get('geo') || 'US';
    const limit = searchParams.get('limit') || '24';

    const res = await fetch(
      `${BACKEND_URL}/pulse/trends/raw?geo=${encodeURIComponent(geo)}&limit=${encodeURIComponent(limit)}`,
      { signal: AbortSignal.timeout(20000) }
    );
    const data = await res.json();
    return NextResponse.json(data, { status: res.ok ? 200 : res.status });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to fetch Pulse trends' },
      { status: 500 }
    );
  }
}
