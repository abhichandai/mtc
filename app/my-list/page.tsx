'use client';

import { useEffect, useState } from 'react';
import AppShell from '../components/AppShell';

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

export default function MyListPage() {
  const [ideas, setIdeas] = useState<SavedIdea[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/saved-ideas')
      .then(r => r.json())
      .then(data => { setIdeas(data.ideas || []); setLoading(false); })
      .catch(() => { setError('Failed to load saved ideas.'); setLoading(false); });
  }, []);

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
    } catch {
      // silently fail
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <AppShell>
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '40px 24px' }}>

        {/* Header */}
        <div style={{ marginBottom: 32 }}>
          <h1 style={{
            fontFamily: 'var(--font-ui)', fontWeight: 800, fontSize: 28,
            color: 'var(--text)', letterSpacing: '-0.03em', margin: '0 0 6px',
          }}>
            My List
          </h1>
          <p style={{ fontFamily: 'var(--font-ui)', fontSize: 14, color: 'var(--text-muted)', margin: 0 }}>
            {loading ? '' : ideas.length === 0 ? 'No saved ideas yet.' : `${ideas.length} saved idea${ideas.length > 1 ? 's' : ''}`}
          </p>
        </div>

        {/* Loading */}
        {loading && (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0' }}>
            <div style={{ width: 24, height: 24, border: '2px solid var(--border)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
          </div>
        )}

        {/* Error */}
        {error && (
          <div style={{ padding: 16, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 10, color: '#dc2626', fontSize: 14 }}>
            {error}
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && ideas.length === 0 && (
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
                <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
              </svg>
            </div>
            <h2 style={{ fontFamily: 'var(--font-ui)', fontWeight: 700, fontSize: 18, color: 'var(--text)', margin: 0 }}>
              No saved ideas yet
            </h2>
            <p style={{ fontFamily: 'var(--font-ui)', fontSize: 14, color: 'var(--text-muted)', margin: 0, maxWidth: 300 }}>
              Unlock narratives on any trend card, select the ideas you like, and save them here.
            </p>
            <a href="/dashboard" style={{
              marginTop: 8, display: 'inline-flex', alignItems: 'center', gap: 6,
              background: 'var(--accent)', color: '#fff', fontFamily: 'var(--font-ui)',
              fontWeight: 700, fontSize: 13, borderRadius: 8, padding: '10px 18px',
              textDecoration: 'none',
            }}>
              Go to Dashboard →
            </a>
          </div>
        )}

        {/* Idea cards */}
        {!loading && ideas.length > 0 && (
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
                  {/* Top row: subreddit + type badge + timestamp + delete */}
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

                  {/* Post title (links to Reddit) */}
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

                  {/* Narrative headline */}
                  <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: 14 }}>
                    {idea.narrative_headline}
                  </p>

                  {/* Selected ideas */}
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

                  {/* Footer: copy button */}
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
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </AppShell>
  );
}
