import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: NextRequest) {
  try {
    const { keywords } = await req.json();
    if (!keywords || !Array.isArray(keywords) || keywords.length === 0) {
      return NextResponse.json({ error: 'Keywords required' }, { status: 400 });
    }

    // keywords[0] is now the full audience brief from the free-text input
    const brief = keywords.filter(Boolean).join(' ');

    let subreddits: string[] = ['entrepreneur', 'productivity', 'SideProject'];
    let description = brief;

    try {
      const claudeResponse = await client.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 500,
        messages: [{
          role: 'user',
          content: `You are helping a content creator find what their target audience is talking about on Reddit RIGHT NOW.

Audience description: "${brief}"

Pick 6-8 subreddits where THIS specific audience actually hangs out. Prefer niche, specific communities over massive generic ones. For example:
- "indie makers building SaaS tools" → indiehackers, SideProject, microsaas, startups (not just r/entrepreneur)
- "busy moms into meal prep" → MealPrepSunday, instantpot, EatCheapAndHealthy (not just r/food)
- "personal finance creators focused on debt" → personalfinance, povertyfinance, debtfree, financialindependence

Return ONLY valid JSON (no markdown, no explanation):
{
  "subreddits": ["6-8 subreddit names, no r/ prefix, most specific and relevant communities first"],
  "description": "one sharp sentence describing this audience and what they care about"
}`,
        }],
      });

      const text = claudeResponse.content[0].type === 'text' ? claudeResponse.content[0].text : '';
      const parsed = JSON.parse(text.replace(/```json|```/g, '').trim());
      subreddits = parsed.subreddits?.slice(0, 8) || subreddits;
      description = parsed.description || description;
    } catch (e) {
      console.error('Claude analysis failed:', e);
    }

    return NextResponse.json({
      success: true,
      subreddits,
      description,
      keywords,
    });

  } catch (error) {
    console.error('analyze-niche error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
