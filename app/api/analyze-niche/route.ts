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

    // Step 1: Use Claude to deeply understand the niche
    let nicheAnalysis: { 
      categories: string[]; 
      matchTerms: string[]; 
      description: string;
      excludeTerms: string[];
    } = {
      categories: [],
      matchTerms: keywords,
      description: nicheString,
      excludeTerms: [],
    };

    try {
      const claudeResponse = await client.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 800,
        messages: [{
          role: 'user',
          content: `You are helping a content creator find trending topics relevant to their niche.

Niche keywords: "${nicheString}"

Your job is to identify which of the 381 Google trending topics are actually relevant to this niche.

Return ONLY valid JSON (no markdown, no explanation):
{
  "categories": ["2-4 Google Trends category names that match this niche. Choose from: Sci/Tech, Health, Business, Entertainment, Sports, Politics, Education, Travel, Food, Fashion, Autos, Games, Finance"],
  "matchTerms": ["20-30 specific words/phrases/names that would appear in trending topics for this niche. Be very specific. For 'AI tools productivity solopreneurs' include terms like: ChatGPT, OpenAI, Claude, Gemini, automation, productivity app, side hustle, freelancer, creator economy, startup, SaaS, workflow, etc."],
  "excludeTerms": ["5-10 terms that would indicate a trend is NOT relevant to this niche - e.g. for AI/tech niche exclude: sports scores, celebrity gossip, TV shows unless tech-related"],
  "description": "one crisp sentence describing this creator's niche"
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

    // Step 2: Fetch ALL 381 Google Trends from Flask backend
    // First try with cache, fall back to fresh if we get too few results
    let allTrends: RawTrend[] = [];
    
    const tryFetch = async (fresh: boolean) => {
      const url = `${BACKEND_URL}/trends/google?limit=381${fresh ? '&fresh=true' : ''}`;
      const res = await fetch(url, { signal: AbortSignal.timeout(20000) });
      if (!res.ok) throw new Error(`Backend returned ${res.status}`);
      const data = await res.json();
      return data.trends || data.data?.trends || [];
    };

    allTrends = await tryFetch(false);
    
    // If cache was stale and only returned a small set, force fresh
    if (allTrends.length < 100) {
      console.log(`Only got ${allTrends.length} trends from cache, forcing fresh fetch`);
      allTrends = await tryFetch(true);
    }

    if (allTrends.length === 0) {
      throw new Error('No trends returned from backend');
    }

    // Step 3: Score trends — relevance-first, volume/growth as tiebreakers only
    const matchTermsLower = nicheAnalysis.matchTerms.map(t => t.toLowerCase());
    const categoriesLower = nicheAnalysis.categories.map(c => c.toLowerCase());
    const keywordsLower = keywords.map(k => k.toLowerCase());
    const excludeTermsLower = (nicheAnalysis.excludeTerms || []).map(t => t.toLowerCase());

    const scoredTrends = allTrends.map((trend: RawTrend) => {
      const topicLower = (trend.query || trend.topic || '').toLowerCase();
      const trendCategories = (trend.categories || []).map((c: TrendCategory) =>
        (typeof c === 'string' ? c : c.name || '').toLowerCase()
      );
      const relatedSearches = (trend.related_searches || trend.related_queries || [])
        .map((r: RelatedSearch) => (typeof r === 'string' ? r : r.query || '').toLowerCase());

      // Check for hard exclusions first
      for (const ex of excludeTermsLower) {
        if (topicLower.includes(ex)) return { ...trend, relevanceScore: -1 };
      }

      let relevanceScore = 0; // Pure relevance, no volume/growth here

      // Strongest signal: direct keyword match in the topic title
      for (const kw of keywordsLower) {
        if (topicLower.includes(kw)) relevanceScore += 50;
      }

      // Strong signal: Claude's specific match terms in the topic title
      for (const term of matchTermsLower) {
        if (term.length > 2 && topicLower.includes(term)) relevanceScore += 30;
      }

      // Medium signal: match terms found in related searches
      for (const term of matchTermsLower) {
        for (const rel of relatedSearches) {
          if (term.length > 3 && rel.includes(term)) relevanceScore += 10;
        }
      }

      // Category match (only counts if there's already some relevance signal)
      if (relevanceScore > 0) {
        for (const cat of categoriesLower) {
          for (const trendCat of trendCategories) {
            if (trendCat.includes(cat) || cat.includes(trendCat)) relevanceScore += 20;
          }
        }
      }

      // Volume and growth are ONLY tiebreakers — applied as a small fraction
      // so they never override a relevance signal
      const volume = trend.search_volume || trend.traffic || 0;
      const growth = trend.increase_percentage || trend.growth || 0;
      const volumeBoost = volume > 0 ? Math.log10(volume + 1) * 2 : 0; // max ~12 pts
      const growthBoost = growth > 0 ? Math.min(growth / 100, 5) : 0;  // max ~5 pts

      return { 
        ...trend, 
        relevanceScore: relevanceScore + volumeBoost + growthBoost 
      };
    });

    // Filter out excluded trends and those with zero relevance, then sort
    const relevantTrends = scoredTrends
      .filter(t => t.relevanceScore > 0)
      .sort((a, b) => b.relevanceScore - a.relevanceScore);

    // Take top 15 for Twitter enrichment
    const top15 = relevantTrends.slice(0, 15);

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
type TrendCategory = { id?: number; name: string } | string;
type RelatedSearch = string | { query: string };

interface RawTrend {
  query?: string;
  topic?: string;
  search_volume?: number;
  traffic?: number;
  increase_percentage?: number;
  growth?: number;
  categories?: TrendCategory[];
  related_searches?: RelatedSearch[];
  related_queries?: RelatedSearch[];
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
