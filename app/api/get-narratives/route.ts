import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || 'http://143.198.46.229:5000';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const postUrl = searchParams.get('url') || '';
    const postTitle = searchParams.get('title') || '';

    if (!postUrl) {
      return NextResponse.json({ error: 'url parameter required' }, { status: 400 });
    }

    // Step 1: Fetch top comments from backend
    const commentsRes = await fetch(
      `${BACKEND_URL}/trends/reddit/comments?url=${encodeURIComponent(postUrl)}&amount=20`,
      { signal: AbortSignal.timeout(15000) }
    );
    const commentsData = await commentsRes.json();

    if (!commentsData.success || !commentsData.comments?.length) {
      return NextResponse.json({ error: 'No comments found for this post' }, { status: 404 });
    }

    // Take top 15 comments by score for synthesis
    const topComments = commentsData.comments
      .slice(0, 15)
      .map((c: { score: number; body: string }, i: number) => `[${i + 1}] (${c.score} upvotes): ${c.body}`)
      .join('\n\n');

    // Step 2: Claude Haiku synthesizes the top 3 narratives
    const claudeResponse = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 600,
      messages: [{
        role: 'user',
        content: `You are analyzing Reddit comments to extract the top 3 narratives for a content creator.

Post title: "${postTitle}"

Top comments by upvotes:
${topComments}

Identify the 3 most distinct narratives or perspectives that people are expressing in these comments. Each narrative should represent a meaningful angle that a content creator could make content about.

Return ONLY valid JSON (no markdown, no explanation):
{
  "narratives": [
    {
      "headline": "5-8 word punchy headline for this narrative",
      "insight": "1-2 sentences on what people are saying and why it matters for content",
      "angle": "One specific content idea this suggests"
    },
    { ... },
    { ... }
  ]
}`,
      }],
    });

    const text = claudeResponse.content[0].type === 'text' ? claudeResponse.content[0].text : '';
    const parsed = JSON.parse(text.replace(/```json|```/g, '').trim());

    return NextResponse.json({
      success: true,
      narratives: parsed.narratives || [],
      comment_count: commentsData.count,
    });

  } catch (error) {
    console.error('get-narratives error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate narratives' },
      { status: 500 }
    );
  }
}
