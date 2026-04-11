import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { auth } from '@clerk/nextjs/server';
import { supabase } from '@/lib/supabase';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: NextRequest) {
  try {
    const { keywords } = await req.json();
    if (!keywords || !Array.isArray(keywords) || keywords.length === 0) {
      return NextResponse.json({ error: 'Keywords required' }, { status: 400 });
    }

    const brief = keywords.filter(Boolean).join(' ');

    // Check Supabase cache first — if the brief matches what we last computed, reuse
    let userId: string | null = null;
    try {
      const authResult = await auth();
      userId = authResult.userId;
      if (userId) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('cached_subreddits, cached_brief')
          .eq('user_id', userId)
          .single();

        if (profile?.cached_subreddits?.length && profile.cached_brief === brief) {
          return NextResponse.json({
            success: true,
            subreddits: profile.cached_subreddits,
            description: brief,
            keywords,
            cached: true,
          });
        }
      }
    } catch { /* cache check is best-effort */ }

    // Not cached — fetch feedback signal (if enough exists) then call Claude
    let audienceSignalBlock = '';
    if (userId) {
      try {
        const { data: feedbackRows } = await supabase
          .from('relevance_feedback')
          .select('post_title, subreddit, verdict')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(100);

        if (feedbackRows && feedbackRows.length >= 5) {
          const upvoted = feedbackRows.filter(r => r.verdict === 'up');
          const downvoted = feedbackRows.filter(r => r.verdict === 'down');

          // Compute per-subreddit net scores
          const subScores: Record<string, number> = {};
          feedbackRows.forEach(r => {
            subScores[r.subreddit] = (subScores[r.subreddit] || 0) + (r.verdict === 'up' ? 1 : -1);
          });
          const lowSignalSubs = Object.entries(subScores)
            .filter(([, score]) => score <= -7)
            .map(([sub]) => sub);

          const upLines = upvoted.slice(0, 10).map(r => `- "${r.post_title}" (r/${r.subreddit})`).join('\n');
          const downLines = downvoted.slice(0, 10).map(r => `- "${r.post_title}" (r/${r.subreddit})`).join('\n');

          audienceSignalBlock = `
AUDIENCE SIGNAL (from ${feedbackRows.length} user interactions — use this to refine subreddit selection):

Topics this creator found relevant:
${upLines || '(none yet)'}

Topics they found irrelevant:
${downLines || '(none yet)'}
${lowSignalSubs.length > 0 ? `
Low-signal subreddits (net -7 or worse dislikes): ${lowSignalSubs.map(s => `r/${s}`).join(', ')}
→ Consider replacing these with more targeted alternatives that match the topics this creator cares about.
` : ''}
Use this signal to identify what specific topics and angles this creator's audience responds to, and prioritise communities likely to surface similar content.
`;
        }
      } catch { /* feedback fetch is best-effort */ }
    }
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
${audienceSignalBlock}
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

    // Store in Supabase for future requests
    if (userId) {
      try {
        await supabase
          .from('profiles')
          .update({ cached_subreddits: subreddits, cached_brief: brief })
          .eq('user_id', userId);
      } catch { /* cache write is best-effort */ }
    }

    return NextResponse.json({
      success: true,
      subreddits,
      description,
      keywords,
      cached: false,
    });

  } catch (error) {
    console.error('analyze-niche error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
