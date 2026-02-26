'use client';

import { useEffect, useState } from 'react';

interface Tweet {
  id?: string;
  text?: string;
  author?: string;
  author_handle?: string;
  author_name?: string;
  likes?: number;
  retweets?: number;
  replies?: number;
  created_at?: string;
  url?: string;
}

interface Trend {
  // Reddit fields
  title?: string;
  score?: number;
  num_comments?: number;
  subreddit?: string;
  url?: string;
  author?: string;
  flair?: string;
  upvote_ratio?: number;
  preview?: string;
  // Google Trends fields (kept for compatibility)
  query?: string;
  topic?: string;
  search_volume?: number;
  traffic?: number;
  increase_percentage?: number;
  growth?: number;
  categories?: Array<{ id?: number; name: string } | string>;
  related_searches?: string[];
  // Twitter enrichment
  tweets?: Tweet[];
  twitterError?: boolean;
}

function formatNumber(n?: number): string {
  if (!n) return '—';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return n.toString();
}

function getTopicName(trend: Trend): string {
  return trend.title || trend.query || trend.topic || 'Unknown';
}

function isRedditPost(trend: Trend): boolean {
  return !!(trend.title && trend.subreddit);
}

function TweetItem({ tweet }: { tweet: Tweet }) {
  const engagement = (tweet.likes || 0) + (tweet.retweets || 0) + (tweet.replies || 0);
  const handle = tweet.author_handle || tweet.author || '?';

  return (
    <div className="tweet-card">
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 28, height: 28, borderRadius: '50%',
            background: 'var(--border-bright)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 12, fontWeight: 700, color: 'var(--text-muted)',
            flexShrink: 0,
          }}>
            {handle[0].toUpperCase()}
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', lineHeight: 1.2 }}>
              {tweet.author_name || tweet.author || 'Unknown'}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>@{handle}</div>
          </div>
        </div>
        {engagement > 0 && (
          <div style={{
            fontSize: 11, fontWeight: 600, color: 'var(--text-dim)',
            background: 'rgba(255,255,255,0.03)',
            borderRadius: 5, padding: '3px 7px',
            flexShrink: 0,
          }}>
            {formatNumber(engagement)} eng
          </div>
        )}
      </div>

      <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: 8 }}>
        {tweet.text || '...'}
      </p>

      <div style={{ display: 'flex', gap: 12 }}>
        {(tweet.likes ?? 0) > 0 && (
          <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--text-dim)' }}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
            </svg>
            {formatNumber(tweet.likes)}
          </span>
        )}
        {(tweet.retweets ?? 0) > 0 && (
          <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--text-dim)' }}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M17 1l4 4-4 4M3 11V9a4 4 0 0 1 4-4h14M7 23l-4-4 4-4M21 13v2a4 4 0 0 1-4 4H3"/>
            </svg>
            {formatNumber(tweet.retweets)}
          </span>
        )}
        {(tweet.replies ?? 0) > 0 && (
          <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--text-dim)' }}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
            {formatNumber(tweet.replies)}
          </span>
        )}
        {tweet.url && (
          <a
            href={tweet.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={e => e.stopPropagation()}
            style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-dim)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 3 }}
          >
            View
            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3"/>
            </svg>
          </a>
        )}
      </div>
    </div>
  );
}

export default function TrendDetail({ trend, onClose }: { trend: Trend; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const topic = getTopicName(trend);
  const tweets = trend.tweets || [];
  const isReddit = isRedditPost(trend);
  const isHot = isReddit
    ? (trend.score || 0) > 1000 || (trend.num_comments || 0) > 200
    : (trend.increase_percentage || trend.growth || 0) > 500;

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  const handleCopyIdea = () => {
    let idea: string;
    if (isReddit) {
      idea = `📈 Trending on r/${trend.subreddit}: ${topic}\n\n` +
        `💡 Content Idea: Create content about "${topic}" — this is getting traction in the r/${trend.subreddit} community with ${formatNumber(trend.score)} upvotes and ${formatNumber(trend.num_comments)} comments.\n\n`;
      if (tweets.length > 0) {
        idea += `🐦 Also trending on Twitter:\n${tweets.slice(0, 3).map(t => `• ${t.text || ''}`).join('\n')}\n\n`;
      }
      idea += `Jump on this conversation now! #ContentCreator #Trending`;
    } else {
      const volume = trend.search_volume || trend.traffic || 0;
      const growth = trend.increase_percentage || trend.growth || 0;
      idea = `📈 Trending: ${topic}\n\n` +
        `💡 Content Idea: Create content about "${topic}" — this topic has ${formatNumber(volume)} searches and is growing +${growth}%.\n\n` +
        `🐦 What people are saying:\n${tweets.slice(0, 3).map(t => `• ${t.text || ''}`).join('\n')}\n\n` +
        `Jump on this conversation now! #ContentCreator #Trending`;
    }

    navigator.clipboard.writeText(idea).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Panel header */}
      <div style={{
        padding: '16px 20px',
        borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        position: 'sticky', top: 0, background: 'var(--surface)', zIndex: 10,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {isHot ? <div className="hot-dot" /> : <div className="live-dot" />}
          <span style={{ fontSize: 12, fontWeight: 700, color: isHot ? 'var(--hot)' : 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {isReddit ? `r/${trend.subreddit}` : isHot ? 'Hot Trend' : 'Trending'}
          </span>
        </div>
        <button
          onClick={onClose}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4, borderRadius: 6, transition: 'color 0.15s' }}
          onMouseEnter={e => (e.currentTarget.style.color = 'var(--text)')}
          onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6L6 18M6 6l12 12"/>
          </svg>
        </button>
      </div>

      {/* Scrollable content */}
      <div style={{ flex: 1, overflow: 'auto', padding: '20px' }}>

        {/* Topic title */}
        <h2 style={{
          fontFamily: 'var(--font-display)',
          fontSize: 22, fontWeight: 400, lineHeight: 1.2,
          color: 'var(--text)', letterSpacing: '-0.02em',
          marginBottom: 16,
        }}>
          {topic}
        </h2>

        {/* Reddit stats */}
        {isReddit && (
          <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
            <div style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 14px', flex: 1, minWidth: 90 }}>
              <div style={{ fontSize: 11, color: isHot ? 'var(--hot)' : 'var(--accent)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Upvotes</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: isHot ? 'var(--hot)' : 'var(--accent)' }} className="num">{formatNumber(trend.score)}</div>
            </div>
            <div style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 14px', flex: 1, minWidth: 90 }}>
              <div style={{ fontSize: 11, color: 'var(--text-dim)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Comments</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text)' }} className="num">{formatNumber(trend.num_comments)}</div>
            </div>
            {trend.upvote_ratio && (
              <div style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 14px', flex: 1, minWidth: 90 }}>
                <div style={{ fontSize: 11, color: 'var(--text-dim)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Ratio</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text)' }} className="num">{Math.round(trend.upvote_ratio * 100)}%</div>
              </div>
            )}
          </div>
        )}

        {/* Google Trends stats */}
        {!isReddit && (
          <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
            {(trend.search_volume || trend.traffic || 0) > 0 && (
              <div style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 14px', flex: 1, minWidth: 100 }}>
                <div style={{ fontSize: 11, color: 'var(--text-dim)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Searches</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text)' }} className="num">{formatNumber(trend.search_volume || trend.traffic)}</div>
              </div>
            )}
            {(trend.increase_percentage || trend.growth || 0) > 0 && (
              <div style={{ background: isHot ? 'var(--hot-glow)' : 'var(--accent-dim)', border: `1px solid ${isHot ? 'rgba(255,69,69,0.2)' : 'rgba(170,255,47,0.2)'}`, borderRadius: 8, padding: '10px 14px', flex: 1, minWidth: 100 }}>
                <div style={{ fontSize: 11, color: isHot ? 'var(--hot)' : 'var(--accent)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Growth</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: isHot ? 'var(--hot)' : 'var(--accent)' }} className="num">+{(trend.increase_percentage || trend.growth || 0) > 9999 ? '9999' : (trend.increase_percentage || trend.growth)}%</div>
              </div>
            )}
            {tweets.length > 0 && (
              <div style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 14px', flex: 1, minWidth: 100 }}>
                <div style={{ fontSize: 11, color: 'var(--text-dim)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Tweets</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text)' }} className="num">{tweets.length}</div>
              </div>
            )}
          </div>
        )}

        {/* Reddit post meta */}
        {isReddit && (trend.author || trend.flair || trend.url) && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20, alignItems: 'center' }}>
            {trend.author && (
              <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>by u/{trend.author}</span>
            )}
            {trend.flair && (
              <span className="tag tag-neutral" style={{ fontSize: 11 }}>{trend.flair}</span>
            )}
            {trend.url && (
              <a
                href={trend.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={e => e.stopPropagation()}
                style={{
                  marginLeft: 'auto', fontSize: 12, color: 'var(--accent)',
                  textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4,
                  fontWeight: 600,
                }}
              >
                Open on Reddit
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3"/>
                </svg>
              </a>
            )}
          </div>
        )}

        {/* Preview text */}
        {isReddit && trend.preview && (
          <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6, marginBottom: 20, padding: '12px 14px', background: 'var(--surface-2)', borderRadius: 8, border: '1px solid var(--border)' }}>
            {trend.preview}
          </p>
        )}

        {/* Google Trends categories */}
        {!isReddit && trend.categories && trend.categories.length > 0 && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 24 }}>
            {trend.categories.map((c, i) => (
              <span key={i} className="tag tag-neutral">{typeof c === 'string' ? c : c.name}</span>
            ))}
          </div>
        )}

        {/* Twitter conversations */}
        {tweets.length > 0 ? (
          <div style={{ marginBottom: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="var(--text-muted)">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
              </svg>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>
                Also on Twitter
              </h3>
              <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 'auto' }}>
                {tweets.length} conversation{tweets.length !== 1 ? 's' : ''}
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {tweets.map((tweet, i) => <TweetItem key={i} tweet={tweet} />)}
            </div>
          </div>
        ) : (
          <div style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 10, padding: '20px', textAlign: 'center', marginBottom: 24 }}>
            <p style={{ fontSize: 13, color: 'var(--text-dim)' }}>No Twitter data for this trend</p>
          </div>
        )}

        {/* Related searches (Google Trends only) */}
        {!isReddit && trend.related_searches && trend.related_searches.length > 0 && (
          <div style={{ marginBottom: 24 }}>
            <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>
              Related Searches
            </h3>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {trend.related_searches.slice(0, 12).map((search, i) => (
                <span key={i} style={{ fontSize: 12, color: 'var(--text-muted)', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 10px' }}>
                  {typeof search === 'string' ? search : String(search)}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* CTA footer */}
      <div style={{ padding: '16px 20px', borderTop: '1px solid var(--border)', background: 'var(--surface)', position: 'sticky', bottom: 0 }}>
        <p style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 10 }}>
          Jump on this trend — your audience is talking about it right now
        </p>
        <button className="btn-primary" onClick={handleCopyIdea} style={{ width: '100%', justifyContent: 'center' }}>
          {copied ? (
            <>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M20 6L9 17l-5-5"/>
              </svg>
              Copied to clipboard!
            </>
          ) : (
            <>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
              </svg>
              Copy content idea
            </>
          )}
        </button>
      </div>
    </div>
  );
}
