import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

// Raise Vercel function timeout to 60s (max on Hobby plan with Fluid Compute)
export const maxDuration = 60;

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || 'http://143.198.46.229:5000';

const SYSTEM_PROMPT = `You are the Audience Intelligence Engine for MakeThisContent — a tool that helps content creators understand what their audience is actually discussing, debating, and feeling.

Your job is NOT to summarise comments. Your job is to map the debate topology of a Reddit thread — identify the distinct positions, tensions, and perspectives that represent genuinely different points of view.

You will receive a list of comments with their scores (upvotes), depth (0 = top-level, 1+ = reply), controversiality flag, and age in hours. Use all of this signal.

Find exactly 3 narratives. Each must fit one of these types:

1. CONSENSUS — The dominant view. What most of the community agrees on. High-score comments that reinforce each other. This is what the crowd believes.

2. CONTESTED — Where active disagreement lives. Look for: comments that directly push back on the consensus, high controversiality scores, reply chains where people debate rather than agree, competing camps with significant upvotes on both sides.

3. CONTRARIAN — A surprising minority take that challenges the premise or offers an unexpected angle. It may have fewer upvotes than the consensus but it has some upvote signal — it's not noise, it's a genuine alternative view the community has partially endorsed.

CRITICAL RULES:
- If you genuinely cannot find a CONTESTED narrative (thread is pure consensus), say so honestly. Do not fabricate disagreement.
- If you genuinely cannot find a CONTRARIAN narrative, say so. Do not force one.
- Each narrative must be meaningfully distinct. No two narratives should be variations of the same idea.
- Prioritise recency: a comment from 2 hours ago with 50 upvotes is more relevant than one from 5 days ago with 200 upvotes. Weight accordingly.
- The content angle must be SPECIFIC and ACTIONABLE — a creator should be able to start writing or filming immediately from your suggestion.

Return ONLY valid JSON. No markdown, no explanation, no preamble.`;

interface Comment {
  score: number;
  body: string;
  depth: number;
  controversiality: number;
  created_utc: number;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const postUrl = searchParams.get('url') || '';
    const postTitle = searchParams.get('title') || '';

    if (!postUrl) {
      return NextResponse.json({ error: 'url parameter required' }, { status: 400 });
    }

    // Fetch full comment tree from backend (now returns recursively flattened tree)
    const commentsRes = await fetch(
      `${BACKEND_URL}/trends/reddit/comments?url=${encodeURIComponent(postUrl)}`,
      { signal: AbortSignal.timeout(20000) }
    );
    const commentsData = await commentsRes.json();

    if (!commentsData.success || !commentsData.comments?.length) {
      return NextResponse.json({ error: 'No comments found for this post' }, { status: 404 });
    }

    const postBody = commentsData.post_body || '';
    const now = Math.floor(Date.now() / 1000);

    // Send all comments with recency-weighted metadata — no cap
    // maxDuration = 60 gives Sonnet enough time to analyse the full corpus
    const allComments = commentsData.comments
      .map((c: Comment, i: number) => {
        const ageHours = c.created_utc ? Math.round((now - c.created_utc) / 3600) : 0;
        const depthLabel = c.depth === 0 ? 'top-level' : `reply (depth ${c.depth})`;
        const controversial = c.controversiality === 1 ? ' [CONTROVERSIAL]' : '';
        return `[${i + 1}] ${depthLabel} | score: ${c.score} | age: ${ageHours}h ago${controversial}\n${c.body}`;
      })
      .join('\n\n---\n\n');

    const userMessage = `Post title: "${postTitle}"
${postBody ? `\nPost body: "${postBody.slice(0, 600)}"\n` : ''}
Total comments analysed: ${commentsData.comments.length}

COMMENTS:
${allComments}

Identify the 3 narratives in this thread. Return this exact JSON structure:
{
  "narratives": [
    {
      "type": "consensus" | "contested" | "contrarian",
      "headline": "5-8 word punchy headline",
      "insight": "2-3 sentences: what people are saying, why it matters, what tension or agreement exists",
      "signal": "1-2 sentences written like a senior analyst's note — explain what the community is doing or feeling that made this narrative stand out. Write about people and their views, not about data points. No mention of comment counts, scores, or recency. Example tone: 'The community keeps returning to this because it resolves an anxiety most people here share' not 'Multiple high-scored comments indicate...'.",
      "content_ideas": [
        "Idea 1 — an educational or explainer angle on this narrative (teach something the community understands that most people outside it don't)",
        "Idea 2 — a story, documentary, or personal experience angle (show it through a real example, case study, or lived journey)",
        "Idea 3 — a debate, hot take, or contrarian challenge angle (pick a side, make a bold claim, or challenge a widely held belief related to this narrative)"
      ]
    }
  ],
  "thread_type": "debate" | "advice" | "experience-sharing" | "mixed",
  "missing_narratives": "null or brief explanation if contested/contrarian genuinely not present"
}`;

    const claudeResponse = await client.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 1200,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
    });

    const text = claudeResponse.content[0].type === 'text' ? claudeResponse.content[0].text : '';
    const parsed = JSON.parse(text.replace(/```json|```/g, '').trim());

    return NextResponse.json({
      success: true,
      narratives: parsed.narratives || [],
      thread_type: parsed.thread_type || 'mixed',
      missing_narratives: parsed.missing_narratives || null,
      comment_count: commentsData.count,
      post_body: postBody,
    });

  } catch (error) {
    console.error('get-narratives error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate narratives' },
      { status: 500 }
    );
  }
}
