'use client';

import { useEffect, useState } from 'react';

interface Tweet {
  id?: string; text?: string; author?: string;
  author_handle?: string; author_name?: string;
  likes?: number; retweets?: number; replies?: number;
  created_at?: string; url?: string;
}

interface Narrative {
  headline: string;
  insight: string;
  angle: string;
}

interface Trend {
  title?: string; score?: number; num_comments?: number;
  subreddit?: string; url?: string; author?: string;
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

function getTopicName(trend: Trend): string {
  return trend.title || trend.query || trend.topic || 'Unknown';
}

function isRedditPost(trend: Trend): boolean {
  return !!(trend.title && trend.subreddit);
}

export default function TrendDetail({ trend, onClose }: { trend: Trend; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const [narrativesState, setNarrativesState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [narratives, setNarratives] = useState<Narrative[]>([]);
  const [narrativeError, setNarrativeError] = useState('');
  const [commentCount, setCommentCount] = useState(0);
  const [postBody, setPostBody] = useState(trend.preview || '');

  const topic = getTopicName(trend);
  const isReddit = isRedditPost(trend);
  const isHot = isReddit
    ? (trend.score || 0) > 1000 || (trend.num_comments || 0) > 200
    : (trend.increase_percentage || trend.growth || 0) > 500;

  useEffect(() => {
    setNarrativesState('idle');
    setNarratives([]);
    setPostBody(trend.preview || '');
    const handleEsc = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [trend, onClose]);

  const fetchNarratives = async () => {
    if (!trend.url || narrativesState === 'loading') return;
    setNarrativesState('loading');
    setNarrativeError('');
    try {
      const res = await fetch(
        `/api/get-narratives?url=${encodeURIComponent(trend.url)}&title=${encodeURIComponent(trend.title || '')}`,
        { signal: AbortSignal.timeout(30000) }
      );
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || 'Failed to generate narratives');
      setNarratives(data.narratives || []);
      setCommentCount(data.comment_count || 0);
      if (data.post_body) setPostBody(data.post_body);
      setNarrativesState('done');
    } catch (e) {
      setNarrativeError(e instanceof Error ? e.message : 'Something went wrong');
      setNarrativesState('error');
    }
  };

  const handleCopyIdea = () => {
    let idea = `📈 Trending on r/${trend.subreddit}: ${topic}\n\n`;
    if (narratives.length > 0) {
      idea += `🧠 Top 3 Narratives:\n`;
      narratives.forEach((n, i) => {
        idea += `${i + 1}. ${n.headline}\n   ${n.insight}\n   💡 Content angle: ${n.angle}\n\n`;
      });
    } else {
      idea += `💡 Content Idea: Create content about "${topic}" — getting traction in r/${trend.subreddit} with ${formatNumber(trend.score)} upvotes and ${formatNumber(trend.num_comments)} comments.\n\n`;
    }
    idea += `#ContentCreator #Trending`;
    navigator.clipboard.writeText(idea);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4, display: 'flex', alignItems: 'center' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6L6 18M6 6l12 12"/>
          </svg>
        </button>
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
                <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>from {commentCount} comments</span>
              )}
            </div>
            {narrativesState === 'done' && (
              <button onClick={() => { setNarrativesState('idle'); setNarratives([]); }}
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
          {narrativesState === 'done' && narratives.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {narratives.map((narrative, i) => (
                <div key={i} style={{
                  background: 'var(--surface-2)', border: '1px solid var(--border)',
                  borderRadius: 10, padding: '14px 16px',
                  borderLeft: '3px solid var(--accent)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 8 }}>
                    <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--accent)', background: 'var(--accent-dim)', borderRadius: 4, padding: '2px 7px', flexShrink: 0 }}>
                      #{i + 1}
                    </span>
                    <span style={{ fontSize: 14, fontWeight: 700, fontFamily: 'var(--font-ui)', color: 'var(--text)', lineHeight: 1.3 }}>
                      {narrative.headline}
                    </span>
                  </div>
                  <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: 10 }}>
                    {narrative.insight}
                  </p>
                  <div style={{ fontSize: 12, color: 'var(--accent)', background: 'var(--accent-dim)', borderRadius: 6, padding: '7px 10px', lineHeight: 1.4 }}>
                    <span style={{ fontWeight: 700 }}>💡 Content angle: </span>{narrative.angle}
                  </div>
                </div>
              ))}
            </div>
          )}
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
        <p style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 10 }}>
          {narrativesState === 'done' ? 'Narratives included — copy your full brief' : 'Jump on this trend — your audience is talking about it right now'}
        </p>
        <button className="btn-primary" onClick={handleCopyIdea} style={{ width: '100%', justifyContent: 'center' }}>
          {copied ? (
            <><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 6L9 17l-5-5"/></svg>Copied!</>
          ) : (
            <><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>Copy content idea</>
          )}
        </button>
      </div>
    </div>
  );
}
