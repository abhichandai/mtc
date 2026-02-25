import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || 'http://143.198.46.229:5000';

export async function POST(req: NextRequest) {
  try {
    const { keywords } = await req.json();
    if (!keywords || !Array.isArray(keywords) || keywords.length === 0) {
      return NextResponse.json({ error: 'Keywords required' }, { status: 400 });
    }

    const nicheString = keywords.filter(Boolean).join(', ');

    // Step 1: Use Claude to understand the niche and generate matching terms
    let nicheAnalysis: { categories: string[]; matchTerms: string[]; description: string } = {
      categories: [],
      matchTerms: keywords,
      description: nicheString,
    };

    try {
      const claudeResponse = await client.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 500,
        messages: [{
          role: 'user',
          content: `You are analyzing a content creator's niche to find relevant trending topics.

Niche keywords: "${nicheString}"

Return ONLY valid JSON (no markdown, no explanation):
{
  "categories": ["list of 2-4 Google Trends category names most relevant to this niche, from: Entertainment, Sports, Sci/Tech, Health, Business, Politics, Education, Travel, Food, Fashion, Autos, Games, Finance"],
  "matchTerms": ["10-15 words/phrases that would appear in trending topics relevant to this niche"],
  "description": "one sentence describing this niche"
}`,
        }],
      });

      const text = claudeResponse.content[0].type === 'text' ? claudeResponse.content[0].text : '';
      const cleaned = text.replace(/```json|```/g, '').trim();
      nicheAnalysis = JSON.parse(cleaned);
    } catch (e) {
      console.error('Claude analysis failed, using keywords directly:', e);
      nicheAnalysis.matchTerms = keywords;
    }

    // Step 2: Fetch all Google Trends from Flask backend
    const trendsRes = await fetch(`${BACKEND_URL}/trends/google?limit=381`, {
      signal: AbortSignal.timeout(15000),
    });

    if (!trendsRes.ok) {
      throw new Error(`Backend returned ${trendsRes.status}`);
    }

    const trendsData = await trendsRes.json();
    const allTrends: RawTrend[] = trendsData.trends || trendsData.data?.trends || [];

    if (allTrends.length === 0) {
      throw new Error('No trends returned from backend');
    }

    // Step 3: Score and filter trends by niche relevance
    const matchTermsLower = nicheAnalysis.matchTerms.map(t => t.toLowerCase());
    const categoriesLower = nicheAnalysis.categories.map(c => c.toLowerCase());
    const keywordsLower = keywords.map(k => k.toLowerCase());

    const scoredTrends = allTrends.map((trend: RawTrend) => {
      const topicLower = (trend.query || trend.topic || '').toLowerCase();
      const trendCategories = (trend.categories || []).map((c: { name: string } | string) =>
        (typeof c === 'string' ? c : c.name || '').toLowerCase()
      );
      const relatedSearches = (trend.related_searches || trend.related_queries || [])
        .map((r: string | { query: string }) => (typeof r === 'string' ? r : r.query || '').toLowerCase());

      let score = 0;

      // Direct keyword match in topic
      for (const kw of keywordsLower) {
        if (topicLower.includes(kw)) score += 40;
      }

      // Match terms from Claude
      for (const term of matchTermsLower) {
        if (topicLower.includes(term)) score += 25;
        for (const rel of relatedSearches) {
          if (rel.includes(term)) score += 8;
        }
      }

      // Category match
      for (const cat of categoriesLower) {
        for (const trendCat of trendCategories) {
          if (trendCat.includes(cat) || cat.includes(trendCat)) score += 20;
        }
      }

      // Boost by search volume (log scale)
      const volume = trend.search_volume || trend.traffic || 0;
      if (volume > 0) score += Math.log10(volume + 1) * 5;

      // Boost by growth rate
      const growth = trend.increase_percentage || trend.growth || 0;
      if (growth > 0) score += Math.min(growth / 10, 10);

      return { ...trend, relevanceScore: score };
    });

    // Sort by relevance score
    scoredTrends.sort((a, b) => b.relevanceScore - a.relevanceScore);

    // Take top 15 for Twitter enrichment (we'll return top 10 after)
    const top15 = scoredTrends.slice(0, 15);

    // Step 4: Enrich with Twitter conversations
    const enrichedTrends = await Promise.allSettled(
      top15.map(async (trend) => {
        const query = trend.query || trend.topic || '';
        try {
          const twitterRes = await fetch(
            `${BACKEND_URL}/trends/twitter/search?query=${encodeURIComponent(query)}&limit=10`,
            { signal: AbortSignal.timeout(8000) }
          );
          if (!twitterRes.ok) return { ...trend, tweets: [], twitterError: true };
          const twitterData = await twitterRes.json();
          const tweets = twitterData.tweets || twitterData.data || [];
          return { ...trend, tweets: tweets.slice(0, 5) };
        } catch {
          return { ...trend, tweets: [], twitterError: true };
        }
      })
    );

    const finalTrends = enrichedTrends
      .filter(r => r.status === 'fulfilled')
      .map(r => (r as PromiseFulfilledResult<EnrichedTrend>).value)
      .slice(0, 10);

    return NextResponse.json({
      success: true,
      niche: {
        keywords,
        description: nicheAnalysis.description,
        categories: nicheAnalysis.categories,
      },
      trends: finalTrends,
      total_analyzed: allTrends.length,
    });

  } catch (error) {
    console.error('analyze-niche error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

// Types
interface RawTrend {
  query?: string;
  topic?: string;
  search_volume?: number;
  traffic?: number;
  increase_percentage?: number;
  growth?: number;
  categories?: Array<{ id?: number; name: string } | string>;
  related_searches?: Array<string | { query: string }>;
  related_queries?: Array<string | { query: string }>;
  relevanceScore?: number;
}

interface EnrichedTrend extends RawTrend {
  tweets: Tweet[];
  twitterError?: boolean;
  relevanceScore: number;
}

interface Tweet {
  id?: string;
  text?: string;
  author?: string;
  likes?: number;
  retweets?: number;
  replies?: number;
  created_at?: string;
}
