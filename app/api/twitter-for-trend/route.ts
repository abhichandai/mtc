// /root/clawd/mtc-frontend/app/api/twitter-for-trend/route.ts
//
// This is a thin Next.js proxy so the browser never hits your Flask API directly.
// It also lets you cache at the edge (revalidate: 3600).

import { NextRequest, NextResponse } from "next/server";

const FLASK_API = process.env.NEXT_PUBLIC_API_URL ?? "http://143.198.46.229:5000";

export async function GET(req: NextRequest) {
  const query = req.nextUrl.searchParams.get("query");
  const limit = req.nextUrl.searchParams.get("limit") ?? "10";

  if (!query) {
    return NextResponse.json(
      { success: false, error: "query parameter is required" },
      { status: 400 }
    );
  }

  try {
    const upstream = await fetch(
      `${FLASK_API}/trends/twitter/search?query=${encodeURIComponent(query)}&limit=${limit}`,
      {
        next: { revalidate: 3600 }, // Next.js edge cache — 1 hour
        signal: AbortSignal.timeout(12_000), // 12 s timeout
      }
    );

    const data = await upstream.json();

    return NextResponse.json(data, {
      status: upstream.ok ? 200 : upstream.status,
      headers: {
        "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=300",
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[twitter-for-trend] fetch failed:", message);

    return NextResponse.json(
      {
        success: false,
        query,
        error: "Could not reach Twitter data service. Please try again shortly.",
        fetched_at: new Date().toISOString(),
      },
      { status: 503 }
    );
  }
}
