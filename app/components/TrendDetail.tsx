'use client';

import { useEffect, useState } from 'react';

interface Tweet {
  id?: string;
  text?: string;
  author?: string;
  author_handle?: string;
  likes?: number;
  retweets?: number;
  replies?: number;
  created_at?: string;
}

interface Trend {
  query?: string;
  topic?: string;
  search_volume?: number;
  traffic?: number;
  increase_percentage?: number;
  growth?: number;
  categories?: Array<{ id?: number; name: string } | string>;
  tweets?: Tweet[];
  twitterError?: boolean;
  relevanceScore?: number;
  related_searches?: string[];
  news_tokens?: string[];
}

interface Perspective {
  theme: string;
  count: number;
  tweets: Tweet[];
  sentiment: 'positive' | 'negative' | 'neutral';
}

function formatNumber(n?: number): string {
  if (!n) return '—';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return n.toString();
}

function getTopicName(trend: Trend): string {
  return trend.query || trend.topic || 'Unknown';
}

function getVolume(trend: Trend): number {
  return trend.search_volume || trend.traffic || 0;
}

function getGrowth(trend: Trend): number {
  return trend.increase_percentage || trend.growth || 0;
}

function getCategoryNames(trend: Trend): string[] {
  if (!trend.categories) return [];
  return trend.categories.map(c => typeof c === 'string' ? c : c.name || '').filter(Boolean);
}

// Simple perspective grouping from tweets
function groupIntoPerspectives(tweets: Tweet[]): Perspective[] {
  if (!tweets.length) return [];
  
  // Simple grouping: just show all tweets as individual perspectives for now
  // In a real implementation, we'd use NLP clustering
  const themes = ['Breaking reaction', 'Analysis', 'Opinion', 'News coverage', 'Discussion'];
  
  const groups: Perspective[] = [];
  const chunkSize = Math.ceil(tweets.length / Math.min(3, tweets.length));
  
  for (let i = 0; i < tweets.length; i += chunkSize) {
    const chunk = tweets.slice(i, i + chunkSize);
    if (!chunk.length) continue;
    const totalLikes = chunk.reduce((s, t) => s + (t.likes || 0), 0);
    groups.push({
      theme: themes[groups.length] || `Thread ${groups.length + 1}`,
      count: chunk.length,
      tweets: chunk,
      sentiment: totalLikes > 100 ? 'positive' : 'neutral',
    });
  }
  
  return groups;
}

function TweetItem({ tweet }: { tweet: Tweet }) {
  const engagement = (tweet.likes || 0) + (tweet.retweets || 0) + (tweet.replies || 0);
  
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
            {(tweet.author || tweet.author_handle || '?')[0].toUpperCase()}
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', lineHeight: 1.2 }}>
              {tweet.author || 'Unknown'}
            </div>
            {tweet.author_handle && (
              <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>@{tweet.author_handle}</div>
            )}
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
      </div>
    </div>
  );
}

export default function TrendDetail({ trend, onClose }: { trend: Trend; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const topic = getTopicName(trend);
  const volume = getVolume(trend);
  const growth = getGrowth(trend);
  const cats = getCategoryNames(trend);
  const tweets = trend.tweets || [];
  const perspectives = groupIntoPerspectives(tweets);
  const relatedSearches = trend.related_searches || [];
  const isHot = growth > 500;

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  const handleCopyIdea = () => {
    const idea = `📈 Trending: ${topic}\n\n` +
      `💡 Content Idea: Create content about "${topic}" — this topic has ${formatNumber(volume)} searches and is growing +${growth}%.\n\n` +
      `🐦 What people are saying:\n${tweets.slice(0, 3).map(t => `• ${t.text || ''}`).join('\n')}\n\n` +
      `Jump on this conversation now! #ContentCreator #Trending`;
    
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
            {isHot ? 'Hot Trend' : 'Trending'}
          </span>
        </div>
        <button
          onClick={onClose}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--text-muted)', padding: 4, borderRadius: 6,
            transition: 'color 0.15s',
          }}
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
          fontSize: 26, fontWeight: 400, lineHeight: 1.15,
          color: 'var(--text)', letterSpacing: '-0.02em',
          marginBottom: 16,
        }}>
          {topic}
        </h2>
        
        {/* Stats row */}
        <div style={{
          display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap',
        }}>
          {volume > 0 && (
            <div style={{
              background: 'var(--surface-2)', border: '1px solid var(--border)',
              borderRadius: 8, padding: '10px 14px', flex: 1, minWidth: 100,
            }}>
              <div style={{ fontSize: 11, color: 'var(--text-dim)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
                Searches
              </div>
              <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text)' }} className="num">
                {formatNumber(volume)}
              </div>
            </div>
          )}
          {growth > 0 && (
            <div style={{
              background: isHot ? 'var(--hot-glow)' : 'var(--accent-dim)',
              border: `1px solid ${isHot ? 'rgba(255,69,69,0.2)' : 'rgba(170,255,47,0.2)'}`,
              borderRadius: 8, padding: '10px 14px', flex: 1, minWidth: 100,
            }}>
              <div style={{ fontSize: 11, color: isHot ? 'var(--hot)' : 'var(--accent)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
                Growth
              </div>
              <div style={{ fontSize: 20, fontWeight: 800, color: isHot ? 'var(--hot)' : 'var(--accent)' }} className="num">
                +{growth > 9999 ? '9999' : growth}%
              </div>
            </div>
          )}
          {tweets.length > 0 && (
            <div style={{
              background: 'var(--surface-2)', border: '1px solid var(--border)',
              borderRadius: 8, padding: '10px 14px', flex: 1, minWidth: 100,
            }}>
              <div style={{ fontSize: 11, color: 'var(--text-dim)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
                Tweets
              </div>
              <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text)' }} className="num">
                {tweets.length}
              </div>
            </div>
          )}
        </div>
        
        {/* Categories */}
        {cats.length > 0 && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 24 }}>
            {cats.map((cat, i) => <span key={i} className="tag tag-neutral">{cat}</span>)}
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
                What people are saying
              </h3>
              <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 'auto' }}>
                {tweets.length} conversation{tweets.length !== 1 ? 's' : ''}
              </span>
            </div>
            
            {/* Perspective groups */}
            {perspectives.length > 1 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {perspectives.map((group, gi) => (
                  <div key={gi}>
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      marginBottom: 8, padding: '6px 0',
                    }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        {group.theme}
                      </span>
                      <span style={{
                        fontSize: 10, fontWeight: 700, color: 'var(--text-dim)',
                        background: 'rgba(255,255,255,0.04)',
                        borderRadius: 100, padding: '2px 7px',
                      }}>
                        {group.count} tweet{group.count !== 1 ? 's' : ''}
                      </span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {group.tweets.map((tweet, ti) => (
                        <TweetItem key={ti} tweet={tweet} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {tweets.map((tweet, i) => <TweetItem key={i} tweet={tweet} />)}
              </div>
            )}
          </div>
        ) : (
          <div style={{
            background: 'var(--surface-2)', border: '1px solid var(--border)',
            borderRadius: 10, padding: '24px', textAlign: 'center', marginBottom: 24,
          }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--text-dim)" strokeWidth="1.5" style={{ margin: '0 auto 8px' }}>
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
            </svg>
            <p style={{ fontSize: 14, color: 'var(--text-dim)' }}>No Twitter data for this trend</p>
          </div>
        )}
        
        {/* Related searches */}
        {relatedSearches.length > 0 && (
          <div style={{ marginBottom: 24 }}>
            <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>
              Related Searches
            </h3>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {relatedSearches.slice(0, 12).map((search, i) => (
                <span key={i} style={{
                  fontSize: 12, color: 'var(--text-muted)',
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid var(--border)',
                  borderRadius: 6, padding: '4px 10px',
                }}>
                  {typeof search === 'string' ? search : String(search)}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* CTA footer */}
      <div style={{
        padding: '16px 20px',
        borderTop: '1px solid var(--border)',
        background: 'var(--surface)',
        position: 'sticky', bottom: 0,
      }}>
        <p style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 10 }}>
          Jump on this trend — your audience is talking about it right now
        </p>
        <button
          className="btn-primary"
          onClick={handleCopyIdea}
          style={{ width: '100%', justifyContent: 'center' }}
        >
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
