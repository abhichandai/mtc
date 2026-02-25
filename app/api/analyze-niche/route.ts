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

Return ONLY valid JSON (no markdown, no explanation):
{
  "googleCategories": ["2-4 Google Trends category names. Choose ONLY from this exact list: Technology, Science, Business and Finance, Jobs and Education, Health, Sports, Entertainment, Politics, Law and Government, Climate, Games, Travel and Transportation, Food and Drink, Shopping, Hobbies and Leisure, Beauty and Fashion, Autos and Vehicles, Other"],
  "matchPhrases": ["10-15 MULTI-WORD phrases or specific proper nouns that would appear verbatim in trending topic titles. NEVER include single common words. Good examples: 'openai', 'chatgpt', 'artificial intelligence', 'machine learning', 'side hustle', 'solopreneur'. Bad examples: 'app', 'tech', 'short', 'tools', 'content' (too short/generic and cause false matches)"],
  "description": "one crisp sentence describing this creator's niche"
}`,
        }],
      });

      const text = claudeResponse.content[0].type === 'text' ? claudeResponse.content[0].text : '';
      const cleaned = text.replace(/```json|```/g, '').trim();
      const parsed = JSON.parse(cleaned);
      nicheAnalysis = {
        categories: parsed.googleCategories || [],
        matchTerms: parsed.matchPhrases || keywords,
        description: parsed.description || nicheString,
        excludeTerms: [],
      };
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

    // Step 3: Score trends — category gate first, then whole-word phrase matching
    const matchPhrasesLower = nicheAnalysis.matchTerms.map(t => t.toLowerCase().trim());
    const relevantCategories = nicheAnalysis.categories.map(c => c.toLowerCase());
    const keywordsLower = keywords.map(k => k.toLowerCase());

    // Helper: whole-word match (prevents "app" matching "approval")
    const wholeWordMatch = (text: string, phrase: string): boolean => {
      if (phrase.includes(' ')) {
        // Multi-word phrase: just check if it appears as a substring (already specific enough)
        return text.includes(phrase);
      }
      // Single word: require word boundaries
      const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      return new RegExp(`\\b${escaped}\\b`).test(text);
    };

    const scoredTrends = allTrends.map((trend: RawTrend) => {
      const topicLower = (trend.query || trend.topic || '').toLowerCase();
      const trendCategories = (trend.categories || []).map((c: TrendCategory) =>
        (typeof c === 'string' ? c : c.name || '').toLowerCase()
      );
      const relatedSearches = (trend.related_searches || trend.related_queries || [])
        .map((r: RelatedSearch) => (typeof r === 'string' ? r : r.query || '').toLowerCase());

      // GATE 1: Category must match — if no category overlap, skip entirely
      // (Exception: if we have very few relevant categories, be more lenient)
      const hasCategoryMatch = relevantCategories.length === 0 || 
        trendCategories.some(tc => 
          relevantCategories.some(rc => tc.includes(rc) || rc.includes(tc))
        );

      if (!hasCategoryMatch) return { ...trend, relevanceScore: 0 };

      let relevanceScore = 0;

      // Direct keyword match in topic title (whole word)
      for (const kw of keywordsLower) {
        if (wholeWordMatch(topicLower, kw)) relevanceScore += 60;
      }

      // Match phrase in topic title (whole word)
      for (const phrase of matchPhrasesLower) {
        if (phrase.length > 3 && wholeWordMatch(topicLower, phrase)) relevanceScore += 40;
      }

      // Match phrase in related searches (whole word)
      for (const phrase of matchPhrasesLower) {
        for (const rel of relatedSearches) {
          if (phrase.length > 4 && wholeWordMatch(rel, phrase)) relevanceScore += 8;
        }
      }

      // Category match adds bonus points (only when already relevant)
      if (relevanceScore > 0) {
        relevanceScore += 15; // base bonus for being in the right category
      } else {
        // In the right category but no keyword match — include with low score
        // so we can still surface some results when keyword matches are scarce
        relevanceScore = 5;
      }

      // Volume/growth only as minor tiebreakers
      const volume = trend.search_volume || trend.traffic || 0;
      const growth = trend.increase_percentage || trend.growth || 0;
      if (volume > 0) relevanceScore += Math.log10(volume + 1) * 1.5; // max ~6 pts
      if (growth > 0) relevanceScore += Math.min(growth / 200, 3);     // max ~3 pts

      return { ...trend, relevanceScore };
    });

    // Filter to only trends with a category match (score > 0), sort by relevance
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
      total_matched: relevantTrends.length,
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
