import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// This endpoint ONLY does Claude niche analysis and returns subreddits.
// Reddit fetching happens client-side in the browser (avoids server IP blocks).

export async function POST(req: NextRequest) {
  try {
    const { keywords } = await req.json();
    if (!keywords || !Array.isArray(keywords) || keywords.length === 0) {
      return NextResponse.json({ error: 'Keywords required' }, { status: 400 });
    }

    const nicheString = keywords.filter(Boolean).join(', ');

    let subreddits: string[] = ['entrepreneur', 'productivity', 'SideProject'];
    let description = nicheString;

    try {
      const claudeResponse = await client.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 500,
        messages: [{
          role: 'user',
          content: `You are helping a content creator find what their niche audience is talking about RIGHT NOW on Reddit.

Their niche: "${nicheString}"

Return ONLY valid JSON (no markdown, no explanation):
{
  "subreddits": ["6-8 real, active subreddit names (no r/ prefix). Pick the most specific communities for this niche. Examples for 'AI tools productivity solopreneurs': ChatGPT, SideProject, entrepreneur, productivity, artificial, OpenAI, nocode, startups"],
  "description": "one sharp sentence describing this niche audience and what they care about"
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
