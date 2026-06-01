'use client';

import { useEffect, useState } from 'react';
import AppShell from '../components/AppShell';

// ─── Types ───────────────────────────────────────────────────────────────────
interface SavedIdea {
  id: string;
  post_title: string;
  post_url: string;
  subreddit: string;
  narrative_type: string;
  narrative_headline: string;
  narrative_insight: string;
  narrative_signal: string;
  selected_ideas: string[];
  audience_brief: string;
  created_at: string;
}

interface PulseUnlock {
  trend_id: string;
  bridge: string | null;
  youtube_query: string | null;
  enrichment: Record<string, { name: string; items: Array<{ title: string; url: string; author?: string; posted_at?: string | null }> }> | null;
  trend_snapshot: { query?: string; source?: string; categories?: string[]; permalink?: string | null; subreddit?: string | null } | null;
  unlocked_at: string;
  saved_to_list: boolean;
  brief_hash: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function timeAgo(ts: string): string {
  const mins = Math.round((Date.now() - new Date(ts).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

const typeConfig: Record<string, { label: string; color: string; bg: string; border: string }> = {
  consensus:  { label: 'CONSENSUS',  color: '#16a34a', bg: 'rgba(22,163,74,0.08)',  border: '#16a34a' },
  contested:  { label: 'CONTESTED',  color: '#dc2626', bg: 'rgba(220,38,38,0.08)',  border: '#dc2626' },
  contrarian: { label: 'CONTRARIAN', color: '#d97706', bg: 'rgba(217,119,6,0.08)',  border: '#d97706' },
};

// ─── Page ────────────────────────────────────────────────────────────────────
export default function MyListPage() {
  const [tab, setTab] = useState<'aie' | 'pulse'>('aie');

  // AIE-side state
  const [ideas, setIdeas] = useState<SavedIdea[]>([]);
  const [ideasLoading, setIdeasLoading] = useState(true);
  const [ideasError, setIdeasError] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Pulse-side state
  const [unlocks, setUnlocks] = useState<PulseUnlock[]>([]);
  const [unlocksLoading, setUnlocksLoading] = useState(true);
  const [unlocksError, setUnlocksError] = useState('');
  const [copiedTrendId, setCopiedTrendId] = useState<string | null>(null);
  const [removingTrendId, setRemovingTrendId] = useState<string | null>(null);
  const [expandedTrendId, setExpandedTrendId] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/saved-ideas')
      .then(r => r.json())
      .then(data => { setIdeas(data.ideas || []); setIdeasLoading(false); })
      .catch(() => { setIdeasError('Failed to load saved ideas.'); setIdeasLoading(false); });

    fetch('/api/pulse-unlocks?saved=true')
      .then(r => r.json())
      .then(data => { setUnlocks(data.unlocks || []); setUnlocksLoading(false); })
      .catch(() => { setUnlocksError('Failed to load saved trends.'); setUnlocksLoading(false); });
  }, []);

  // ─── AIE handlers ──────────────────────────────────────────────────────────
  const handleCopy = (idea: SavedIdea) => {
    const lines = [
      `📌 ${idea.post_title}`,
      `r/${idea.subreddit} · ${idea.narrative_type.toUpperCase()}`,
      ``,
      `${idea.narrative_headline}`,
      `${idea.narrative_insight}`,
      ``,
      `💡 Content Ideas:`,
      ...idea.selected_ideas.map((s, i) => `${i + 1}. ${s}`),
    ].join('\n');
    navigator.clipboard.writeText(lines);
    setCopiedId(idea.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await fetch(`/api/saved-ideas?id=${id}`, { method: 'DELETE' });
      setIdeas(prev => prev.filter(i => i.id !== id));
    } catch { /* swallow */ }
    finally { setDeletingId(null); }
  };

  // ─── Pulse handlers ────────────────────────────────────────────────────────
  const handleCopyTrend = (u: PulseUnlock) => {
    const title = u.trend_snapshot?.query || u.trend_id;
    const lines = [
      `📌 ${title}`,
      u.trend_snapshot?.source ? `Source: ${u.trend_snapshot.source}` : '',
      '',
      u.bridge ? `💡 Your angle:\n${u.bridge}` : '',
    ].filter(Boolean).join('\n');
    navigator.clipboard.writeText(lines);
    setCopiedTrendId(u.trend_id);
    setTimeout(() => setCopiedTrendId(null), 2000);
  };

  const handleUnsave = async (u: PulseUnlock) => {
    setRemovingTrendId(u.trend_id);
    // Flip saved_to_list=false rather than deleting the row — preserves
    // the cached unlock so re-opening the trend on /pulse is still fast.
    try {
      await fetch('/api/pulse-unlocks', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trend_id: u.trend_id,
          saved_to_list: false,
          brief_hash: u.brief_hash,
        }),
      });
      setUnlocks(prev => prev.filter(x => x.trend_id !== u.trend_id));
    } catch { /* swallow */ }
    finally { setRemovingTrendId(null); }
  };

  const aieCount = ideas.length;
  const pulseCount = unlocks.length;

  return (
    <AppShell>
      <div style={{ maxWidth: 760, margin: '0 auto', padding: '40px 24px' }}>

        {/* Header */}
        <div style={{ marginBottom: 24 }}>
          <h1 style={{
            fontFamily: 'var(--font-ui)', fontWeight: 800, fontSize: 28,
            color: 'var(--text)', letterSpacing: '-0.03em', margin: '0 0 6px',
          }}>
            My List
          </h1>
          <p style={{ fontFamily: 'var(--font-ui)', fontSize: 14, color: 'var(--text-muted)', margin: 0 }}>
            Your saved content ideas and trending topics.
          </p>
        </div>

        {/* Tab strip */}
        <div style={{
          display: 'flex', gap: 4, marginBottom: 24,
          background: 'var(--surface-2)', borderRadius: 10, padding: 4,
          width: 'fit-content',
        }}>
          {([
            { key: 'aie' as const, label: 'Audience Intelligence', count: aieCount },
            { key: 'pulse' as const, label: 'Trending Topics', count: pulseCount },
          ]).map(t => {
            const active = tab === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 7,
                  background: active ? 'var(--surface)' : 'transparent',
                  color: active ? 'var(--text)' : 'var(--text-muted)',
                  border: 'none',
                  borderRadius: 7, padding: '8px 14px', cursor: 'pointer',
                  fontFamily: 'var(--font-ui)', fontWeight: 600, fontSize: 13,
                  boxShadow: active ? '0 1px 2px rgba(0,0,0,0.04)' : 'none',
                  transition: 'background 0.12s, color 0.12s',
                }}
              >
                {t.label}
                <span style={{
                  fontSize: 10, fontWeight: 700,
                  background: active ? 'var(--accent-dim)' : 'var(--surface)',
                  color: active ? 'var(--accent)' : 'var(--text-dim)',
                  padding: '2px 6px', borderRadius: 100,
                  minWidth: 18, textAlign: 'center',
                }}>
                  {t.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* ── AIE TAB ─────────────────────────────────────────────────────── */}
        {tab === 'aie' && (
          <>
            {ideasLoading && (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0' }}>
                <div style={{ width: 24, height: 24, border: '2px solid var(--border)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
              </div>
            )}

            {ideasError && (
              <div style={{ padding: 16, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 10, color: '#dc2626', fontSize: 14 }}>
                {ideasError}
              </div>
            )}

            {!ideasLoading && !ideasError && ideas.length === 0 && (
              <EmptyState
                icon={<path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>}
                title="No saved ideas yet"
                body="Unlock narratives on any trend card, select the ideas you like, and save them here."
                cta={{ label: 'Go to Dashboard →', href: '/dashboard' }}
              />
            )}

            {!ideasLoading && ideas.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {ideas.map(idea => {
                  const cfg = typeConfig[idea.narrative_type] || { label: idea.narrative_type?.toUpperCase() || '—', color: 'var(--accent)', bg: 'var(--surface-2)', border: 'var(--accent)' };
                  return (
                    <div key={idea.id} style={{
                      background: 'var(--surface)',
                      border: '1px solid var(--border)',
                      borderRadius: 14,
                      padding: '18px 20px',
                      borderLeft: `3px solid ${cfg.border}`,
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)' }}>
                          r/{idea.subreddit}
                        </span>
                        <span style={{
                          fontSize: 10, fontWeight: 800, color: cfg.color,
                          background: `${cfg.border}22`, borderRadius: 4,
                          padding: '2px 7px', letterSpacing: '0.06em',
                        }}>
                          {cfg.label}
                        </span>
                        <span style={{ fontSize: 11, color: 'var(--text-dim)', marginLeft: 'auto' }}>
                          {timeAgo(idea.created_at)}
                        </span>
                        <button
                          onClick={() => handleDelete(idea.id)}
                          disabled={deletingId === idea.id}
                          style={{
                            background: 'none', border: 'none', cursor: 'pointer',
                            color: 'var(--text-dim)', padding: 4, display: 'flex',
                            alignItems: 'center', opacity: deletingId === idea.id ? 0.4 : 1,
                          }}
                          title="Delete"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                          </svg>
                        </button>
                      </div>

                      <a
                        href={idea.post_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          display: 'block', fontFamily: 'var(--font-ui)', fontWeight: 700,
                          fontSize: 15, color: 'var(--text)', lineHeight: 1.4,
                          marginBottom: 6, textDecoration: 'none',
                        }}
                        onMouseEnter={e => (e.currentTarget.style.color = 'var(--accent)')}
                        onMouseLeave={e => (e.currentTarget.style.color = 'var(--text)')}
                      >
                        {idea.post_title}
                      </a>

                      <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: 14 }}>
                        {idea.narrative_headline}
                      </p>

                      {idea.selected_ideas?.length > 0 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
                          {idea.selected_ideas.map((s, i) => (
                            <div key={i} style={{
                              fontSize: 12, color: 'var(--text-muted)',
                              background: cfg.bg, borderRadius: 6,
                              padding: '7px 10px', lineHeight: 1.5,
                              display: 'flex', gap: 8, alignItems: 'flex-start',
                            }}>
                              <span style={{ fontWeight: 700, color: cfg.color, flexShrink: 0 }}>{i + 1}.</span>
                              <span>{(() => {
                                const colonIdx = s.indexOf(':');
                                if (colonIdx > 0 && colonIdx < 40) {
                                  return <><strong style={{ color: 'var(--text)' }}>{s.slice(0, colonIdx)}</strong>{s.slice(colonIdx)}</>;
                                }
                                return s;
                              })()}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                        <button
                          onClick={() => handleCopy(idea)}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 6,
                            fontSize: 12, fontWeight: 700,
                            color: copiedId === idea.id ? '#16a34a' : 'var(--accent)',
                            background: 'none',
                            border: `1px solid ${copiedId === idea.id ? '#16a34a' : 'var(--accent)'}`,
                            borderRadius: 7, padding: '6px 12px', cursor: 'pointer',
                            fontFamily: 'var(--font-ui)',
                          }}
                        >
                          {copiedId === idea.id ? (
                            <><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 6L9 17l-5-5"/></svg>Copied!</>
                          ) : (
                            <><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>Copy ideas</>
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* ── PULSE TAB ───────────────────────────────────────────────────── */}
        {tab === 'pulse' && (
          <>
            {unlocksLoading && (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0' }}>
                <div style={{ width: 24, height: 24, border: '2px solid var(--border)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
              </div>
            )}

            {unlocksError && (
              <div style={{ padding: 16, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 10, color: '#dc2626', fontSize: 14 }}>
                {unlocksError}
              </div>
            )}

            {!unlocksLoading && !unlocksError && unlocks.length === 0 && (
              <EmptyState
                icon={<><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></>}
                title="No saved trends yet"
                body="Unlock a trend on the Pulse page, click 'Save to My List', and it'll show up here."
                cta={{ label: 'Go to Pulse →', href: '/pulse' }}
              />
            )}

            {!unlocksLoading && unlocks.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {unlocks.map(u => (
                  <SavedTrendCard
                    key={u.trend_id}
                    unlock={u}
                    expanded={expandedTrendId === u.trend_id}
                    onToggleExpand={() => setExpandedTrendId(prev => prev === u.trend_id ? null : u.trend_id)}
                    copied={copiedTrendId === u.trend_id}
                    onCopy={() => handleCopyTrend(u)}
                    removing={removingTrendId === u.trend_id}
                    onRemove={() => handleUnsave(u)}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </AppShell>
  );
}


// ─── EmptyState ──────────────────────────────────────────────────────────────
function EmptyState({ icon, title, body, cta }: {
  icon: React.ReactNode;
  title: string;
  body: string;
  cta?: { label: string; href: string };
}) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', gap: 12, padding: '80px 0', textAlign: 'center',
    }}>
      <div style={{
        width: 52, height: 52, borderRadius: 14,
        background: 'var(--accent-dim)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          {icon}
        </svg>
      </div>
      <h2 style={{ fontFamily: 'var(--font-ui)', fontWeight: 700, fontSize: 18, color: 'var(--text)', margin: 0 }}>
        {title}
      </h2>
      <p style={{ fontFamily: 'var(--font-ui)', fontSize: 14, color: 'var(--text-muted)', margin: 0, maxWidth: 320 }}>
        {body}
      </p>
      {cta && (
        <a href={cta.href} style={{
          marginTop: 8, display: 'inline-flex', alignItems: 'center', gap: 6,
          background: 'var(--accent)', color: '#fff', fontFamily: 'var(--font-ui)',
          fontWeight: 700, fontSize: 13, borderRadius: 8, padding: '10px 18px',
          textDecoration: 'none',
        }}>
          {cta.label}
        </a>
      )}
    </div>
  );
}


// ─── SavedTrendCard ──────────────────────────────────────────────────────────
function SavedTrendCard({ unlock, expanded, onToggleExpand, copied, onCopy, removing, onRemove }: {
  unlock: PulseUnlock;
  expanded: boolean;
  onToggleExpand: () => void;
  copied: boolean;
  onCopy: () => void;
  removing: boolean;
  onRemove: () => void;
}) {
  const trend = unlock.trend_snapshot || {};
  const title = trend.query || unlock.trend_id;
  const source = trend.source || 'google';
  const category = (trend.categories?.[0] || 'Trending').toUpperCase();
  const enrichment = unlock.enrichment || {};
  const platformCount = Object.keys(enrichment).filter(k => (enrichment[k]?.items?.length || 0) > 0).length;
  const totalItems = Object.values(enrichment).reduce((sum, p) => sum + (p?.items?.length || 0), 0);

  return (
    <div style={{
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: 14,
      padding: '18px 20px',
      borderLeft: `3px solid var(--accent)`,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)' }}>
          {source === 'reddit' ? `r/${trend.subreddit || 'reddit'}` : 'Google Trends'}
        </span>
        <span style={{
          fontSize: 10, fontWeight: 800, color: 'var(--accent)',
          background: 'var(--accent-dim)', borderRadius: 4,
          padding: '2px 7px', letterSpacing: '0.06em',
        }}>
          {category}
        </span>
        <span style={{ fontSize: 11, color: 'var(--text-dim)', marginLeft: 'auto' }}>
          Saved {timeAgo(unlock.unlocked_at)}
        </span>
        <button
          onClick={onRemove}
          disabled={removing}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--text-dim)', padding: 4, display: 'flex',
            alignItems: 'center', opacity: removing ? 0.4 : 1,
          }}
          title="Remove from list"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
          </svg>
        </button>
      </div>

      <div style={{
        fontFamily: 'var(--font-ui)', fontWeight: 700,
        fontSize: 15, color: 'var(--text)', lineHeight: 1.4,
        marginBottom: 10,
      }}>
        {title}
      </div>

      {unlock.bridge && (
        <div style={{
          fontSize: 13, color: 'var(--text)', lineHeight: 1.55,
          background: 'rgba(139,92,246,0.06)',
          border: '1px solid rgba(139,92,246,0.12)',
          borderRadius: 8,
          padding: '10px 12px',
          marginBottom: 12,
        }}>
          <div style={{
            fontSize: 10, fontWeight: 700, color: 'var(--accent)',
            letterSpacing: '0.07em', textTransform: 'uppercase',
            marginBottom: 4,
          }}>
            Your angle
          </div>
          {unlock.bridge}
        </div>
      )}

      {totalItems > 0 && (
        <button
          onClick={onToggleExpand}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--text-muted)', fontSize: 12, fontFamily: 'var(--font-ui)',
            padding: 0, marginBottom: expanded ? 12 : 0,
          }}
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
            style={{ transition: 'transform 0.15s', transform: expanded ? 'rotate(0deg)' : 'rotate(-90deg)' }}>
            <path d="M6 9l6 6 6-6"/>
          </svg>
          {expanded ? 'Hide' : 'Show'} {totalItems} saved posts across {platformCount} platform{platformCount !== 1 ? 's' : ''}
        </button>
      )}

      {expanded && totalItems > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 12 }}>
          {Object.entries(enrichment).map(([platKey, plat]) => {
            if (!plat?.items?.length) return null;
            return (
              <div key={platKey}>
                <div style={{
                  fontSize: 10, fontWeight: 700, color: 'var(--text-dim)',
                  letterSpacing: '0.07em', textTransform: 'uppercase',
                  marginBottom: 6,
                }}>
                  {plat.name || platKey} · {plat.items.length}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {plat.items.map((item, i) => (
                    <a
                      key={i}
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        fontSize: 12, color: 'var(--text)',
                        lineHeight: 1.4, padding: '6px 10px',
                        background: 'var(--surface-2)', borderRadius: 6,
                        textDecoration: 'none', display: 'block',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}
                    >
                      {item.title}
                    </a>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        <a
          href="/pulse"
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            fontSize: 12, fontWeight: 700,
            color: 'var(--text-muted)', background: 'none',
            border: '1px solid var(--border)',
            borderRadius: 7, padding: '6px 12px', textDecoration: 'none',
            fontFamily: 'var(--font-ui)',
          }}
        >
          Open Pulse →
        </a>
        <button
          onClick={onCopy}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            fontSize: 12, fontWeight: 700,
            color: copied ? '#16a34a' : 'var(--accent)',
            background: 'none',
            border: `1px solid ${copied ? '#16a34a' : 'var(--accent)'}`,
            borderRadius: 7, padding: '6px 12px', cursor: 'pointer',
            fontFamily: 'var(--font-ui)',
          }}
        >
          {copied ? (
            <><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 6L9 17l-5-5"/></svg>Copied!</>
          ) : (
            <><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>Copy angle</>
          )}
        </button>
      </div>
    </div>
  );
}
