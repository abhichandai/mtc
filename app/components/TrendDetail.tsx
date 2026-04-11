'use client';

import { useEffect, useState } from 'react';

interface Tweet {
  id?: string; text?: string; author?: string;
  author_handle?: string; author_name?: string;
  likes?: number; retweets?: number; replies?: number;
  created_at?: string; url?: string; permalink?: string;
}

interface Narrative {
  type?: 'consensus' | 'contested' | 'contrarian';
  headline: string;
  insight: string;
  signal?: string;
  content_ideas?: string[];
  // legacy field — kept for cached narratives from old format
  angle?: string;
}

interface Trend {
  title?: string; score?: number; num_comments?: number;
  subreddit?: string; url?: string; permalink?: string; author?: string;
  flair?: string; upvote_ratio?: number; preview?: string;
  created_utc?: number;
  query?: string; topic?: string; search_volume?: number;
  traffic?: number; increase_percentage?: number; growth?: number;
  categories?: Array<{ id?: number; name: string } | string>;
  related_searches?: string[];
  tweets?: Tweet[]; twitterError?: boolean;
}

function formatNumber(n?: number): string {
  if (!n) return '—';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return n.toString();
}

function timeAgo(created_utc?: number): string {
  if (!created_utc) return '';
  const hours = (Date.now() / 1000 - created_utc) / 3600;
  if (hours < 1) return `${Math.round(hours * 60)}m ago`;
  if (hours < 24) return `${Math.round(hours)}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

function timeAgoMs(ts: number): string {
  const mins = Math.round((Date.now() - ts) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

function getTopicName(trend: Trend): string {
  return trend.title || trend.query || trend.topic || 'Unknown';
}

function isRedditPost(trend: Trend): boolean {
  return !!(trend.title && trend.subreddit);
}

export default function TrendDetail({ trend, onClose, cachedNarratives, onNarrativesCached, audienceBrief, feedback, onFeedback }: {
  trend: Trend;
  onClose: () => void;
  cachedNarratives?: { narratives: Narrative[]; post_body: string; comment_count: number; generated_at: number };
  onNarrativesCached?: (url: string, data: { narratives: Narrative[]; post_body: string; comment_count: number; generated_at: number }) => void;
  audienceBrief?: string;
  feedback?: 'up' | 'down' | null;
  onFeedback?: (verdict: 'up' | 'down') => void;
}) {
  const [selectedIdeas, setSelectedIdeas] = useState<Map<string, Narrative>>(new Map());
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  const toggleIdea = (idea: string, narrative: Narrative) => {
    setSelectedIdeas(prev => {
      const next = new Map(prev);
      next.has(idea) ? next.delete(idea) : next.set(idea, narrative);
      return next;
    });
  };

  const handleSaveToList = async () => {
    if (selectedIdeas.size === 0 || saveState === 'saving') return;
    setSaveState('saving');
    try {
      // Group selected ideas by narrative
      const byNarrative = new Map<string, { narrative: Narrative; ideas: string[] }>();
      selectedIdeas.forEach((narrative, idea) => {
        const key = narrative.type || narrative.headline;
        if (!byNarrative.has(key)) byNarrative.set(key, { narrative, ideas: [] });
        byNarrative.get(key)!.ideas.push(idea);
      });
      await Promise.all(
        Array.from(byNarrative.values()).map(({ narrative, ideas }) =>
          fetch('/api/saved-ideas', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              post_title: trend.title || '',
              post_url: trend.url || trend.permalink || '',
              subreddit: trend.subreddit || '',
              narrative_type: narrative.type || '',
              narrative_headline: narrative.headline || '',
              narrative_insight: narrative.insight || '',
              narrative_signal: narrative.signal || '',
              selected_ideas: ideas,
              audience_brief: audienceBrief || '',
            }),
          })
        )
      );
      setSaveState('saved');
      setSelectedIdeas(new Map());
    } catch {
      setSaveState('error');
      setTimeout(() => setSaveState('idle'), 2000);
    }
  };
  const [narrativesState, setNarrativesState] = useState<'idle' | 'loading' | 'done' | 'error'>(
    cachedNarratives ? 'done' : 'idle'
  );
  const [narratives, setNarratives] = useState<Narrative[]>(cachedNarratives?.narratives || []);
  const [narrativeError, setNarrativeError] = useState('');
  const [commentCount, setCommentCount] = useState(cachedNarratives?.comment_count || 0);
  const [postBody, setPostBody] = useState(cachedNarratives?.post_body || trend.preview || '');
  const [generatedAt, setGeneratedAt] = useState<number | null>(cachedNarratives?.generated_at || null);
  // Track which URL the current state belongs to — only reset when card changes
  const [stateUrl, setStateUrl] = useState<string>(trend.permalink || trend.url || '');

  const topic = getTopicName(trend);
  const isReddit = isRedditPost(trend);
  const isHot = isReddit
    ? (trend.score || 0) > 1000 || (trend.num_comments || 0) > 200
    : (trend.increase_percentage || trend.growth || 0) > 500;

  useEffect(() => {
    const currentUrl = trend.permalink || trend.url || '';
    const cardChanged = currentUrl !== stateUrl;

    if (cardChanged) { setSelectedIdeas(new Map()); setSaveState('idle'); }

    if (cachedNarratives) {
      // Always apply cache when available
      setNarrativesState('done');
      setNarratives(cachedNarratives.narratives);
      setPostBody(cachedNarratives.post_body || trend.preview || '');
      setCommentCount(cachedNarratives.comment_count);
      setGeneratedAt(cachedNarratives.generated_at || null);
      setStateUrl(currentUrl);
    } else if (cardChanged) {
      // Only reset state when opening a genuinely different card.
      // Parent re-renders (Twitter enrichment, etc.) create new trend object
      // references for the SAME post — we must not reset mid-fetch in that case.
      setNarrativesState('idle');
      setNarratives([]);
      setPostBody(trend.preview || '');
      setGeneratedAt(null);
      setStateUrl(currentUrl);
    }
    // If same card + no cache: leave state alone (fetch may be in progress)

    const handleEsc = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [trend, onClose, cachedNarratives]);

  const commentUrl: string = trend.permalink || trend.url || '';
  const fetchNarratives = async () => {
    if (!commentUrl || narrativesState === 'loading') return;
    setNarrativesState('loading');
    setNarrativeError('');
    try {
      const res = await fetch(
        `/api/get-narratives?url=${encodeURIComponent(commentUrl)}&title=${encodeURIComponent(trend.title || '')}`,
        { signal: AbortSignal.timeout(55000) }
      );
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || 'Failed to generate narratives');
      const now = Date.now();
      setNarratives(data.narratives || []);
      setCommentCount(data.comment_count || 0);
      if (data.post_body) setPostBody(data.post_body);
      setGeneratedAt(now);
      setNarrativesState('done');
      if (onNarrativesCached) {
        onNarrativesCached(commentUrl, {
          narratives: data.narratives || [],
          post_body: data.post_body || '',
          comment_count: data.comment_count || 0,
          generated_at: now,
        });
      }
    } catch (e) {
      setNarrativeError(e instanceof Error ? e.message : 'Something went wrong');
      setNarrativesState('error');
    }
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>

      {/* Header */}
      <div style={{
        padding: '16px 20px', borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        position: 'sticky', top: 0, background: 'var(--surface)', zIndex: 10,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {isHot ? <div className="hot-dot" /> : <div className="live-dot" />}
          <span style={{ fontSize: 12, fontWeight: 700, color: isHot ? 'var(--hot)' : 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {isHot ? 'Hot' : 'Active'} · r/{trend.subreddit}
          </span>
          {trend.created_utc && (
            <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>· {timeAgo(trend.created_utc)}</span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {onFeedback && (
            <>
              <button onClick={() => onFeedback('up')} title="Relevant"
                style={{ background: feedback === 'up' ? 'rgba(22,163,74,0.12)' : 'none', border: `1px solid ${feedback === 'up' ? '#16a34a' : 'transparent'}`, borderRadius: 6, padding: '3px 5px', cursor: 'pointer', display: 'flex', alignItems: 'center', transition: 'all 0.15s' }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill={feedback === 'up' ? '#16a34a' : 'none'} stroke={feedback === 'up' ? '#16a34a' : 'var(--text-dim)'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3H14z"/>
                  <path d="M7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/>
                </svg>
              </button>
              <button onClick={() => onFeedback('down')} title="Not relevant"
                style={{ background: feedback === 'down' ? 'rgba(220,38,38,0.1)' : 'none', border: `1px solid ${feedback === 'down' ? '#dc2626' : 'transparent'}`, borderRadius: 6, padding: '3px 5px', cursor: 'pointer', display: 'flex', alignItems: 'center', transition: 'all 0.15s' }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill={feedback === 'down' ? '#dc2626' : 'none'} stroke={feedback === 'down' ? '#dc2626' : 'var(--text-dim)'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3H10z"/>
                  <path d="M17 2h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17"/>
                </svg>
              </button>
            </>
          )}
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4, display: 'flex', alignItems: 'center', marginLeft: 4 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>
      </div>

      {/* Scrollable body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>

        {/* Title */}
        <h2 style={{
          fontFamily: 'var(--font-ui)', fontSize: 20, fontWeight: 700,
          lineHeight: 1.3, color: 'var(--text)', letterSpacing: '-0.01em', marginBottom: 20,
        }}>
          {topic}
        </h2>

        {/* Reddit stats */}
        {isReddit && (
          <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
            <div style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 14px', flex: 1, minWidth: 80 }}>
              <div style={{ fontSize: 11, color: isHot ? 'var(--hot)' : 'var(--accent)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Upvotes</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: isHot ? 'var(--hot)' : 'var(--accent)' }}>{formatNumber(trend.score)}</div>
            </div>
            <div style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 14px', flex: 1, minWidth: 80 }}>
              <div style={{ fontSize: 11, color: 'var(--text-dim)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Comments</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text)' }}>{formatNumber(trend.num_comments)}</div>
            </div>
            {trend.upvote_ratio && (
              <div style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 14px', flex: 1, minWidth: 80 }}>
                <div style={{ fontSize: 11, color: 'var(--text-dim)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Ratio</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text)' }}>{Math.round(trend.upvote_ratio * 100)}%</div>
              </div>
            )}
          </div>
        )}

        {/* Post meta */}
        {isReddit && (trend.author || trend.flair || trend.url) && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20, alignItems: 'center' }}>
            {trend.author && <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>by u/{trend.author}</span>}
            {trend.flair && <span className="tag tag-neutral" style={{ fontSize: 11 }}>{trend.flair}</span>}
            {trend.url && (
              <a href={trend.url} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}
                style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--accent)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4, fontWeight: 600 }}>
                Open on Reddit
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3"/>
                </svg>
              </a>
            )}
          </div>
        )}

        {/* Post body preview — populated once narratives are fetched */}
        {isReddit && postBody && postBody.trim() && (
          <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6, marginBottom: 20, padding: '12px 14px', background: 'var(--surface-2)', borderRadius: 8, border: '1px solid var(--border)' }}>
            {postBody.slice(0, 400)}{postBody.length > 400 ? '...' : ''}
          </p>
        )}

        {/* ── TOP 3 NARRATIVES ── */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 16 }}>🧠</span>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>Top 3 Narratives</h3>
              {narrativesState === 'done' && commentCount > 0 && (
                <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>
                  from {commentCount} comments
                  {generatedAt ? ` · generated ${timeAgoMs(generatedAt)}` : ''}
                </span>
              )}
            </div>
            {narrativesState === 'done' && (
              <button onClick={() => {
                if (onNarrativesCached) onNarrativesCached(commentUrl, { narratives: [], post_body: '', comment_count: 0, generated_at: 0 });
                setNarrativesState('idle');
                setNarratives([]);
              }}
                style={{ background: 'none', border: 'none', fontSize: 11, color: 'var(--text-dim)', cursor: 'pointer' }}>
                Refresh
              </button>
            )}
          </div>

          {/* Idle: unlock button */}
          {narrativesState === 'idle' && (
            <button onClick={fetchNarratives} style={{
              width: '100%', background: 'var(--accent-dim)',
              border: '1px dashed rgba(124,92,252,0.4)', borderRadius: 10,
              padding: '20px 16px', cursor: 'pointer',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
            }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(124,92,252,0.14)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'var(--accent-dim)')}>
              <div style={{ fontSize: 24 }}>💡</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent)' }}>What is this community saying?</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', lineHeight: 1.4 }}>
                Analyze the top comments to surface the 3 most important narratives for your content
              </div>
              <div style={{ marginTop: 4, background: 'var(--accent)', color: '#fff', fontSize: 12, fontWeight: 700, borderRadius: 6, padding: '6px 16px' }}>
                Get Top 3 Narratives →
              </div>
            </button>
          )}

          {/* Loading */}
          {narrativesState === 'loading' && (
            <div style={{ padding: '28px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
              <div className="live-dot" style={{ width: 10, height: 10 }} />
              <p style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center' }}>Reading the community conversation...</p>
            </div>
          )}

          {/* Error */}
          {narrativesState === 'error' && (
            <div style={{ padding: '16px', background: 'var(--hot-glow)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 10, textAlign: 'center' }}>
              <p style={{ fontSize: 13, color: 'var(--hot)', marginBottom: 8 }}>{narrativeError}</p>
              <button onClick={fetchNarratives} style={{ fontSize: 12, color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>
                Try again
              </button>
            </div>
          )}

          {/* Results */}
          {narrativesState === 'done' && narratives.length > 0 && (() => {
            const typeConfig: Record<string, { label: string; color: string; bg: string; border: string }> = {
              consensus:   { label: 'CONSENSUS',   color: '#16a34a', bg: 'rgba(22,163,74,0.08)',   border: '#16a34a' },
              contested:   { label: 'CONTESTED',   color: '#dc2626', bg: 'rgba(220,38,38,0.08)',   border: '#dc2626' },
              contrarian:  { label: 'CONTRARIAN',  color: '#d97706', bg: 'rgba(217,119,6,0.08)',   border: '#d97706' },
            };
            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {narratives.map((narrative: Narrative, i: number) => {
                  const cfg = typeConfig[narrative.type || ''] || { label: `#${i+1}`, color: 'var(--accent)', bg: 'var(--surface-2)', border: 'var(--accent)' };
                  const ideas = narrative.content_ideas || (narrative.angle ? [narrative.angle] : []);
                  return (
                    <div key={i} style={{
                      background: cfg.bg, border: `1px solid var(--border)`,
                      borderRadius: 12, padding: '16px 18px',
                      borderLeft: `3px solid ${cfg.border}`,
                    }}>
                      {/* Type badge + headline */}
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 10, fontWeight: 800, color: cfg.color, background: `${cfg.border}22`, borderRadius: 4, padding: '2px 7px', letterSpacing: '0.06em', flexShrink: 0, marginTop: 2 }}>
                          {cfg.label}
                        </span>
                        <span style={{ fontSize: 15, fontWeight: 700, fontFamily: 'var(--font-ui)', color: 'var(--text)', lineHeight: 1.3 }}>
                          {narrative.headline}
                        </span>
                      </div>

                      {/* Insight */}
                      <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6, marginBottom: 12 }}>
                        {narrative.insight}
                      </p>

                      {/* Why it matters */}
                      {narrative.signal && (
                        <div style={{ marginBottom: 12 }}>
                          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-dim)', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 5 }}>
                            Why it matters
                          </div>
                          <div style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic', lineHeight: 1.6, paddingLeft: 10, borderLeft: '2px solid var(--border-bright)' }}>
                            {narrative.signal}
                          </div>
                        </div>
                      )}

                      {/* Content Ideas */}
                      {ideas.length > 0 && (
                        <div>
                          <div style={{ fontSize: 11, fontWeight: 700, color: cfg.color, letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 8 }}>
                            💡 Content Ideas
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                            {ideas.map((idea: string, j: number) => {
                              const isSelected = selectedIdeas.has(idea);
                              return (
                                <div key={j}
                                  onClick={() => toggleIdea(idea, narrative)}
                                  style={{
                                    fontSize: 12, color: 'var(--text-muted)',
                                    background: isSelected ? `${cfg.border}18` : 'var(--accent-dim)',
                                    border: `1px solid ${isSelected ? cfg.border : 'transparent'}`,
                                    borderRadius: 6, padding: '7px 10px', lineHeight: 1.5,
                                    display: 'flex', gap: 8, alignItems: 'flex-start',
                                    cursor: 'pointer', transition: 'all 0.15s',
                                  }}>
                                  {/* Checkbox */}
                                  <div style={{
                                    width: 16, height: 16, borderRadius: 4, flexShrink: 0, marginTop: 1,
                                    border: `2px solid ${isSelected ? cfg.border : 'var(--border-bright)'}`,
                                    background: isSelected ? cfg.border : 'transparent',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    transition: 'all 0.15s',
                                  }}>
                                    {isSelected && (
                                      <svg width="9" height="9" viewBox="0 0 12 12" fill="none">
                                        <path d="M2 6l3 3 5-5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                      </svg>
                                    )}
                                  </div>
                                  <span>{(() => {
                                    const colonIdx = idea.indexOf(':');
                                    if (colonIdx > 0 && colonIdx < 40) {
                                      return <><strong style={{ color: 'var(--text)' }}>{idea.slice(0, colonIdx)}</strong>{idea.slice(colonIdx)}</>;
                                    }
                                    return idea;
                                  })()}</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>

        {/* Google Trends fallback (kept for compatibility) */}
        {!isReddit && (
          <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
            {(trend.search_volume || trend.traffic || 0) > 0 && (
              <div style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 14px', flex: 1, minWidth: 100 }}>
                <div style={{ fontSize: 11, color: 'var(--text-dim)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Searches</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text)' }}>{formatNumber(trend.search_volume || trend.traffic)}</div>
              </div>
            )}
          </div>
        )}
        {!isReddit && trend.related_searches && trend.related_searches.length > 0 && (
          <div style={{ marginBottom: 24 }}>
            <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>Related Searches</h3>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {trend.related_searches.slice(0, 12).map((search, i) => (
                <span key={i} style={{ fontSize: 12, color: 'var(--text-muted)', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 10px' }}>
                  {typeof search === 'string' ? search : String(search)}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Sticky footer CTA */}
      <div style={{ padding: '16px 20px', borderTop: '1px solid var(--border)', background: 'var(--surface)', position: 'sticky', bottom: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, marginBottom: 10 }}>
          <span style={{ fontSize: 10, color: 'var(--text-dim)', letterSpacing: '0.04em' }}>⚡</span>
          <span style={{ fontSize: 10, color: 'var(--text-dim)', letterSpacing: '0.04em', fontWeight: 600 }}>POWERED BY AUDIENCE INTELLIGENCE ENGINE</span>
        </div>

        {saveState === 'saved' ? (
          // Post-save confirmation
          <div style={{
            width: '100%', padding: '12px 16px', borderRadius: 10,
            background: 'rgba(22,163,74,0.1)', border: '1px solid rgba(22,163,74,0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5"><path d="M20 6L9 17l-5-5"/></svg>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#16a34a' }}>Ideas saved to My List</span>
            </div>
            <a href="/my-list" style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent)', textDecoration: 'none' }}>
              View My List →
            </a>
          </div>
        ) : selectedIdeas.size > 0 ? (
          // Active save button
          <button className="btn-primary" onClick={handleSaveToList} disabled={saveState === 'saving'}
            style={{ width: '100%', justifyContent: 'center', gap: 6 }}>
            {saveState === 'saving' && <div style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,0.4)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />}
            {saveState === 'idle' && <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>}
            {saveState === 'error' && '✕'}
            {saveState === 'saving' ? 'Saving...' : saveState === 'error' ? 'Error — try again' : `Add ${selectedIdeas.size} idea${selectedIdeas.size > 1 ? 's' : ''} to My List`}
          </button>
        ) : (
          // Greyed-out inactive button
          <button disabled style={{
            width: '100%', padding: '12px 16px', borderRadius: 10,
            background: 'var(--surface-2)', border: '1px solid var(--border)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            cursor: 'default', opacity: 0.7,
          }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--text-dim)" strokeWidth="2"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-dim)', fontFamily: 'var(--font-ui)' }}>
              {narrativesState === 'done' ? 'Select ideas above to save them' : 'Unlock narratives to surface ideas'}
            </span>
          </button>
        )}
      </div>
    </div>
  );
}
