import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || 'http://143.198.46.229:5000';

const REDDIT_HEADERS = {
  'User-Agent': 'MakeThisContent/1.0 (makethiscontent.com; content trend intelligence)',
  'Accept': 'application/json',
};

async function fetchSubreddit(subreddit: string, limit = 25): Promise<RedditPost[]> {
  try {
    const res = await fetch(
      `https://www.reddit.com/r/${subreddit}/hot.json?limit=${limit}&raw_json=1`,
      { headers: REDDIT_HEADERS, signal: AbortSignal.timeout(8000) }
    );
    if (!res.ok) return [];
    const data = await res.json();
    const children = data?.data?.children || [];
    return children
      .filter((c: RedditChild) => !c.data.stickied && c.data.score > 5)
      .map((c: RedditChild) => ({
        id: c.data.id,
        title: c.data.title,
        preview: c.data.selftext?.slice(0, 280) || "",
        score: c.data.score,
        num_comments: c.data.num_comments,
        engagement: c.data.score + c.data.num_comments * 3,
        subreddit: c.data.subreddit,
        url: `https://reddit.com${c.data.permalink}`,
        external_url: c.data.is_self ? null : c.data.url,
        is_text_post: c.data.is_self,
        author: c.data.author,
        created_utc: c.data.created_utc,
        flair: c.data.link_flair_text || "",
        source: "reddit",
      }));
  } catch {
    return [];
  }
}

export async function POST(req: NextRequest) {
  try {
    const { keywords } = await req.json();
    if (!keywords || !Array.isArray(keywords) || keywords.length === 0) {
      return NextResponse.json({ error: "Keywords required" }, { status: 400 });
    }

    const nicheString = keywords.filter(Boolean).join(", ");

    let subreddits: string[] = ["entrepreneur", "productivity", "SideProject"];
    let description = nicheString;

    try {
      const claudeResponse = await client.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 500,
        messages: [{
          role: "user",
          content: `You are helping a content creator find what their niche audience is talking about RIGHT NOW on Reddit.

Their niche: "${nicheString}"

Return ONLY valid JSON (no markdown):
{
  "subreddits": ["6-8 real, active subreddit names (no r/ prefix) where this audience actually posts. Prefer specific niche communities. For AI tools productivity solopreneurs: ChatGPT, SideProject, entrepreneur, productivity, artificial, OpenAI, nocode, startups"],
  "description": "one sharp sentence describing this niche audience"
}`,
        }],
      });

      const text = claudeResponse.content[0].type === "text" ? claudeResponse.content[0].text : "";
      const parsed = JSON.parse(text.replace(/```json|```/g, "").trim());
      subreddits = parsed.subreddits || subreddits;
      description = parsed.description || description;
    } catch (e) {
      console.error("Claude analysis failed:", e);
    }

    // Fetch from Vercel edge (not VPS) - Reddit doesn't block Vercel IPs
    const results = await Promise.allSettled(
      subreddits.map(sub => fetchSubreddit(sub, 20))
    );

    const allPosts: RedditPost[] = results
      .filter(r => r.status === "fulfilled")
      .flatMap(r => (r as PromiseFulfilledResult<RedditPost[]>).value);

    const seen = new Set<string>();
    const deduped = allPosts
      .filter(p => {
        const k = p.title.toLowerCase();
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      })
      .sort((a, b) => b.engagement - a.engagement);

    if (deduped.length === 0) {
      throw new Error("No posts returned from Reddit");
    }

    const top15 = deduped.slice(0, 15);

    // Enrich with Twitter via backend
    const enriched = await Promise.allSettled(
      top15.map(async (post) => {
        const query = post.title.slice(0, 100);
        try {
          const twitterRes = await fetch(
            `${BACKEND_URL}/trends/twitter/search?query=${encodeURIComponent(query)}&limit=5`,
            { signal: AbortSignal.timeout(6000) }
          );
          if (!twitterRes.ok) return { ...post, tweets: [], twitterError: true };
          const twitterData = await twitterRes.json();
          return { ...post, tweets: (twitterData.tweets || []).slice(0, 5) };
        } catch {
          return { ...post, tweets: [], twitterError: true };
        }
      })
    );

    const finalTrends = enriched
      .filter(r => r.status === "fulfilled")
      .map(r => (r as PromiseFulfilledResult<EnrichedPost>).value)
      .slice(0, 10);

    return NextResponse.json({
      success: true,
      niche: { keywords, description, subreddits },
      trends: finalTrends,
      total_analyzed: deduped.length,
      sources: subreddits,
    });

  } catch (error) {
    console.error("analyze-niche error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

interface RedditChild {
  data: {
    id: string; title: string; selftext: string; score: number;
    num_comments: number; subreddit: string; permalink: string;
    url: string; is_self: boolean; author: string; created_utc: number;
    link_flair_text: string; stickied: boolean;
  };
}

interface RedditPost {
  id: string; title: string; preview: string; score: number;
  num_comments: number; engagement: number; subreddit: string;
  url: string; external_url: string | null; is_text_post: boolean;
  author: string; created_utc: number; flair: string; source: string;
}

interface Tweet {
  id?: string; text?: string; author?: string; author_name?: string;
  likes?: number; retweets?: number; replies?: number;
  created_at?: string; url?: string;
}

interface EnrichedPost extends RedditPost {
  tweets: Tweet[];
  twitterError?: boolean;
}
