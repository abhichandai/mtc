import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { auth } from '@clerk/nextjs/server';
import { supabase } from '@/lib/supabase';

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

You will receive ONE creator's context and a numbered list of currently-trending topics. For EACH topic, you do two things:

1. Judge how well it fits THIS specific creator's audience and content — "high", "medium", or "low".
2. Write a ONE-LINE bridge: the specific angle that connects this trend to THIS creator's audience. The bridge is a teaser of the content angle — the hook that makes them want to make a video about it.

The bridge is the most important part. A great bridge surfaces a NON-OBVIOUS connection. Example: a celebrity denim ad is not obviously a fitness story — but "the gym-scene critique everyone's arguing about" makes it one for a fitness creator. Find that angle.

CRITICAL RULES:
- Do NOT force a stretch. If a trend genuinely has no real angle for this creator, mark it "low" and write a short honest bridge like "No natural angle for your audience" or a one-line note on why. A feed where everything is "high" is useless — be honest and discriminating.
- "high" = a strong, clear angle this creator could make today. "medium" = a real but secondary or stretchier angle. "low" = little or no genuine connection.
- Bridges must be SPECIFIC to the trend and this creator — never generic ("you could discuss this topic"). Reference the actual angle.
- Keep each bridge to one sentence, ~10-20 words.
- Morbid, tragic, or purely local trends (deaths, accidents, regional sports) are usually "low" for most creators unless there's a genuine angle.

Return ONLY a JSON array. No prose, no markdown fences. Exactly this shape:
[
  { "id": "<the trend id>", "fit": "high" | "medium" | "low", "bridge": "<one-line angle>" },
  ...
]
One entry per trend, same ids you were given.`;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const trends: IncomingTrend[] = Array.isArray(body?.trends) ? body.trends : [];

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
    if (!brief.trim()) {
      try {
        const { userId } = await auth();
        if (userId) {
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
        }
      } catch { /* best-effort — fall through */ }
    }

    // No brief anywhere means no meaningful scoring — return neutral, don't burn a Sonnet call
    if (!brief.trim()) {
      return NextResponse.json({
        success: true,
        scores: trends.map(t => ({ id: t.id, fit: 'medium', bridge: '' })),
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
    let scores: Array<{ id: string; fit: string; bridge: string }> = [];
    try {
      const cleaned = text.replace(/```json|```/g, '').trim();
      const parsed = JSON.parse(cleaned);
      if (Array.isArray(parsed)) {
        const validFits = new Set(['high', 'medium', 'low']);
        const byId = new Map(trends.map(t => [t.id, true]));
        scores = parsed
          .filter(s => s && byId.has(s.id) && validFits.has(s.fit))
          .map(s => ({ id: s.id, fit: s.fit, bridge: typeof s.bridge === 'string' ? s.bridge : '' }));
      }
    } catch {
      // parse failed — return empty so the client renders trends without a signal
      return NextResponse.json({ success: true, scores: [], note: 'parse_failed' });
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
