import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

// Bridge is a single short generation — fast, but give headroom for cold starts
export const maxDuration = 30;

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

const SYSTEM_PROMPT = `You are the bridge engine for MakeThisContent's Pulse — a newsjacking tool that helps content creators ride trending topics.

Your job: write ONE sentence (two sentences max) that bridges a currently-trending topic to a specific creator's audience. The bridge should be a concrete content angle — not a vague "this could be relevant" statement.

RULES:
- Be specific. Name the angle. "React to the backlash with a hot take on why [X]" beats "This could be interesting for your audience."
- Be honest. If the connection is a stretch, say so briefly and still give the best angle you can find.
- Keep it punchy — one sentence is ideal, two max. No preamble, no "Here's the bridge:", just the bridge itself.
- Write in second person ("You could…", "Your audience…", "Cover the…").`;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      trend_title = '',
      trend_categories = [] as string[],
      trend_source = '',
      brief = '',
      platforms = [] as string[],
      content_format = '',
      content_styles = [] as string[],
    } = body;

    if (!trend_title) {
      return NextResponse.json({ success: false, error: 'trend_title required' }, { status: 400 });
    }

    if (!brief) {
      return NextResponse.json({
        success: true,
        bridge: 'Set your audience brief to see how this trend connects to your content.',
      });
    }

    const platformStr = platforms.length
      ? platforms.map((p: string) => PLATFORM_LABELS[p] || p).join(', ')
      : 'not specified';
    const styleStr = content_styles.length
      ? content_styles.map((s: string) => STYLE_LABELS[s] || s).join(', ')
      : 'general';
    const formatStr = content_format
      ? FORMAT_LABELS[content_format] || content_format
      : 'not specified';

    const userMessage = `TRENDING TOPIC: ${trend_title}
Category: ${trend_categories.join(', ') || 'General'}
Source: ${trend_source || 'unknown'}

THIS CREATOR:
Audience: ${brief}
Platform(s): ${platformStr}
Primary format: ${formatStr}
Content styles: ${styleStr}

Write the bridge.`;

    const resp = await client.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 200,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
    });

    const text = resp.content[0].type === 'text' ? resp.content[0].text.trim() : '';

    return NextResponse.json({ success: true, bridge: text });
  } catch (err) {
    console.error('[pulse-bridge] Error:', err);
    return NextResponse.json(
      { success: false, error: 'Bridge generation failed' },
      { status: 500 },
    );
  }
}
