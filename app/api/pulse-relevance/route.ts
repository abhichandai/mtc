import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { auth } from '@clerk/nextjs/server';
import { supabase } from '@/lib/supabase';
import { briefHash } from '@/lib/pulse';

// Sonnet scoring is fast (one batched call) but give headroom for cold starts
export const maxDuration = 60;

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const PLATFORM_LABELS: Record<string, string> = {
  youtube: 'YouTube', tiktok: 'TikTok', instagram: 'Instagram',
  facebook: 'Facebook', linkedin: 'LinkedIn', podcast: 'Podcast',
  newsletter: 'Newsletter', blog: 'Blog',
};

const STYLE_LABELS: Record<string, string> = {
  educational: 'Educational breakdowns', storytelling: 'Personal storytelling',
  hot_takes: 'Hot takes & opinions', interviews: 'Interviews',
  documentary: 'Documentary', tutorials: 'Tutorials',
  trends: 'Trends & commentary', reaction: 'Reaction & commentary',
  vlog: 'Day in the life / Vlog', challenge: 'Challenge / Experiment',
  case_study: 'Case study / Deep dive', review: 'Review & comparison',
  satire: 'Satire / Comedy', qa: 'Q&A / AMA', listicle: 'List / Roundup',
};

const FORMAT_LABELS: Record<string, string> = {
  long_form: 'Long Form', short_form: 'Short Form', text: 'Text Articles',
};

type IncomingTrend = {
  id: string;
  query: string;
  categories?: string[];
  trend_breakdown?: string[];
};

function buildCreatorBlock(platforms: string[], styles: string[], brief: string, format: string): string {
  const platformStr = platforms.length ? platforms.map(p => PLATFORM_LABELS[p] || p).join(', ') : 'not specified';
  const styleStr = styles.length ? styles.map(s => STYLE_LABELS[s] || s).join(', ') : 'general';
  const formatStr = format ? FORMAT_LABELS[format] || format : 'not specified';
  return `THIS CREATOR:
Audience: ${brief || 'general audience'}.
Platform(s): ${platformStr}.
Primary format: ${formatStr}.
Content styles: ${styleStr}.`;
}

const SYSTEM_PROMPT = `You are the relevance engine for MakeThisContent's Pulse — a newsjacking tool that helps content creators decide which trending topics are worth making content about.

You will receive ONE creator's context and a numbered list of currently-trending topics. For EACH topic, judge how well it fits THIS specific creator's audience and content — "high", "medium", or "low".

CRITICAL RULES:
- Be honest and discriminating. A feed where everything is "high" is useless. Most trends will be "medium" or "low" for any given creator.
- "high" = a strong, clear angle this creator could make today. Includes non-obvious connections — a celebrity denim ad isn't obviously fitness, but a fitness creator could absolutely have an angle on the gym-scene discourse around it.
- "medium" = a real but secondary or stretchier angle.
- "low" = little or no genuine connection. Don't force a stretch.
- Morbid, tragic, or purely local trends (deaths, accidents, regional sports) are usually "low" for most creators unless there's a genuine angle.

Return ONLY a JSON array. No prose, no markdown fences. Exactly this shape:
[
  { "id": "<the trend id>", "fit": "high" | "medium" | "low" },
  ...
]
One entry per trend, same ids you were given.`;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Auth — needed to write the user_relevance_cache row in the new flow.
    // Best-effort: if auth fails we can still score, we just skip the cache write.
    const { userId } = await auth().catch(() => ({ userId: null as string | null }));

    // E4 dual-path: prefer master_refresh_id (new flow, reads trends from
    // master pool + writes cache). Fall back to trends-in-body (legacy flow,
    // kept so the current Pulse frontend keeps working until E5 lands).
    const masterRefreshId: number | null =
      typeof body?.master_refresh_id === 'number' ? body.master_refresh_id : null;

    let trends: IncomingTrend[] = [];

    // Phase 2: prefer pulse_trends table as source of truth.
    // If client sends `missing_ids`, look up exactly those rows.
    // If `master_refresh_id` is provided but no missing_ids, the client wants
    // a full re-score (e.g., brief changed) — read all active trends.
    // If neither, fall back to legacy `trends` in body (dashboard path).
    const missingIds: string[] | null =
      Array.isArray(body?.missing_ids) && body.missing_ids.length > 0
        ? body.missing_ids.filter((x: unknown) => typeof x === 'string')
        : null;

    if (missingIds) {
      // Score only the specified trends — look them up by id
      const { data: rows, error: rowsErr } = await supabase
        .from('pulse_trends')
        .select('id, query, trend_data, categories')
        .in('id', missingIds);
      if (rowsErr) {
        return NextResponse.json({ error: rowsErr.message }, { status: 500 });
      }
      trends = (rows || []).map(r => ({
        id: r.id,
        query: r.query,
        categories: r.categories || [],
        trend_breakdown: (r.trend_data as { trend_breakdown?: string[] })?.trend_breakdown || [],
      }));
    } else if (masterRefreshId !== null) {
      // Full re-score of the active pool (no missing_ids = score everything)
      const nowIso = new Date().toISOString();
      const { data: rows, error: rowsErr } = await supabase
        .from('pulse_trends')
        .select('id, query, trend_data, categories')
        .gt('expires_at', nowIso);
      if (rowsErr) {
        return NextResponse.json({ error: rowsErr.message }, { status: 500 });
      }
      trends = (rows || []).map(r => ({
        id: r.id,
        query: r.query,
        categories: r.categories || [],
        trend_breakdown: (r.trend_data as { trend_breakdown?: string[] })?.trend_breakdown || [],
      }));
    } else {
      // Legacy dashboard path — trends come from the client
      trends = Array.isArray(body?.trends) ? body.trends : [];
    }

    if (trends.length === 0) {
      return NextResponse.json({ success: true, scores: [] });
    }

    // Creator context — client sends it (same source the dashboard uses).
    // This is the user's own profile data; the prompt + API key stay server-side.
    let brief: string = typeof body?.brief === 'string' ? body.brief : '';
    let platforms: string[] = Array.isArray(body?.platforms) ? body.platforms : [];
    let styles: string[] = Array.isArray(body?.content_styles) ? body.content_styles : [];
    let format: string = typeof body?.content_format === 'string' ? body.content_format : '';

    // Fallback: if the client didn't send a brief, try a server-side fetch
    // (best-effort — Supabase can be slow/unavailable, so never block on it).
    if (!brief.trim() && userId) {
      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('platforms, content_styles, audience_brief, content_format')
          .eq('user_id', userId)
          .single();
        if (profile) {
          brief = profile.audience_brief || '';
          platforms = platforms.length ? platforms : (profile.platforms || []);
          styles = styles.length ? styles : (profile.content_styles || []);
          format = format || profile.content_format || '';
        }
      } catch { /* best-effort — fall through */ }
    }

    // No brief anywhere means no meaningful scoring — return neutral, don't
    // burn a Sonnet call, and don't pollute the cache with a no-brief result
    if (!brief.trim()) {
      return NextResponse.json({
        success: true,
        scores: trends.map(t => ({ id: t.id, fit: 'medium' })),
        note: 'no_brief',
      });
    }

    const creatorBlock = buildCreatorBlock(platforms, styles, brief, format);

    const trendList = trends.map((t, i) => {
      const cat = t.categories?.length ? ` [${t.categories.join(', ')}]` : '';
      const ctx = t.trend_breakdown?.length ? ` — context: ${t.trend_breakdown.slice(0, 4).join(', ')}` : '';
      return `${i + 1}. id="${t.id}" — "${t.query}"${cat}${ctx}`;
    }).join('\n');

    const userMessage = `${creatorBlock}

TRENDING TOPICS (${trends.length}):
${trendList}

Score every topic for THIS creator and return the JSON array.`;

    const resp = await client.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 4000,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
    });

    const text = resp.content[0].type === 'text' ? resp.content[0].text : '';

    // Defensive parse — strip fences, fall back to neutral scores on failure
    let scores: Array<{ id: string; fit: string }> = [];
    try {
      const cleaned = text.replace(/```json|```/g, '').trim();
      const parsed = JSON.parse(cleaned);
      if (Array.isArray(parsed)) {
        const validFits = new Set(['high', 'medium', 'low']);
        const byId = new Map(trends.map(t => [t.id, true]));
        scores = parsed
          .filter(s => s && byId.has(s.id) && validFits.has(s.fit))
          .map(s => ({ id: s.id, fit: s.fit }));
      }
    } catch {
      // parse failed — return empty so the client renders trends without a signal.
      // Don't cache this either; next page load should retry.
      return NextResponse.json({ success: true, scores: [], note: 'parse_failed' });
    }

    // Track and log Sonnet drops so we can see it happening in the logs.
    // Don't fake-fill these — leave them honestly unscored. The frontend
    // shows an explicit "Unscored" state.
    const returnedIds = new Set(scores.map(s => s.id));
    const droppedIds = trends.filter(t => !returnedIds.has(t.id)).map(t => t.id);
    if (droppedIds.length > 0) {
      console.warn(
        `[pulse-relevance] Sonnet dropped ${droppedIds.length}/${trends.length} trends ` +
        `from response: ${droppedIds.slice(0, 5).join(', ')}${droppedIds.length > 5 ? '...' : ''}`
      );
    }

    // Per-trend cache write: one row per (user, trend, brief). With stable
    // trend IDs across the 48h pool, these rows survive cron refreshes and
    // subsequent pulse-feed reads pull cached fits directly.
    if (masterRefreshId !== null && userId && scores.length > 0) {
      const hash = briefHash(brief, platforms, format, styles);
      const now = new Date().toISOString();
      const rows = scores.map(s => ({
        user_id: userId,
        trend_id: s.id,
        brief_hash: hash,
        fit: s.fit,
        scored_at: now,
      }));
      const { error: cacheErr } = await supabase
        .from('user_trend_relevance')
        .upsert(rows, { onConflict: 'user_id,trend_id,brief_hash' });
      if (cacheErr) {
        console.error('pulse-relevance per-trend cache upsert failed:', cacheErr);
      }
    }

    return NextResponse.json({ success: true, scores });
  } catch (error) {
    console.error('pulse-relevance error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Relevance scoring failed' },
      { status: 500 }
    );
  }
}
