'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const EXAMPLE_NICHES = [
  'Indie makers building and selling SaaS tools',
  'Busy moms into meal prep and family health',
  'Personal finance creators focused on debt payoff',
];

export default function LandingPage() {
  const router = useRouter();
  const [brief, setBrief] = useState('');
  const [loading, setLoading] = useState(false);

  const isValid = brief.trim().length >= 3;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid || loading) return;
    setLoading(true);
    const params = new URLSearchParams({ k: brief.trim() });
    router.push(`/dashboard?${params}`);
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden' }}>
      <div className="grid-bg" />

      <div className="glow-orb" style={{
        width: 600, height: 400, top: -100, left: '50%', transform: 'translateX(-50%)',
        background: 'radial-gradient(ellipse, rgba(124,92,252,0.07) 0%, transparent 70%)',
      }} />
      <div className="glow-orb" style={{
        width: 300, height: 300, bottom: '10%', right: '5%',
        background: 'radial-gradient(ellipse, rgba(124,92,252,0.04) 0%, transparent 70%)',
      }} />

      {/* Header */}
      <header style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '20px 32px', position: 'relative', zIndex: 10,
        borderBottom: '1px solid var(--border)',
        backdropFilter: 'blur(10px)', background: 'var(--header-bg)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div className="live-dot" />
          <span style={{ fontFamily: 'var(--font-ui)', fontWeight: 800, fontSize: 15, letterSpacing: '-0.01em', color: 'var(--text)' }}>
            MakeThisContent
          </span>
        </div>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          fontSize: 12, color: 'var(--text-muted)',
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 100, padding: '5px 12px',
        }}>
          <span style={{ color: 'var(--accent)', fontWeight: 700 }}>LIVE</span>
          <span>·</span>
          <span>Trend Intelligence</span>
        </div>
      </header>

      {/* Main */}
      <main style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: '60px 24px', position: 'relative', zIndex: 10,
      }}>

        {/* Hero */}
        <div className="animate-fade-up" style={{ textAlign: 'center', maxWidth: 720, marginBottom: 64 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginBottom: 24 }}>
            <span className="tag tag-accent">New</span>
            <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Real-time conversation intelligence</span>
          </div>

          <h1 style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'clamp(40px, 7vw, 80px)',
            fontWeight: 400, lineHeight: 1.05,
            letterSpacing: '-0.02em', color: 'var(--text)', marginBottom: 24,
          }}>
            Know what your audience<br />
            <span style={{ fontStyle: 'italic', color: 'var(--accent)' }}>is saying right now</span>
          </h1>

          <p style={{ fontSize: 17, color: 'var(--text-muted)', lineHeight: 1.6, maxWidth: 520, margin: '0 auto' }}>
            Describe your target audience. We&apos;ll surface what they&apos;re talking about right now — and show you exactly what content angles are resonating.
          </p>
        </div>

        {/* Input card */}
        <div className="animate-fade-up stagger-2" style={{
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 16, padding: '32px',
          width: '100%', maxWidth: 560,
          boxShadow: '0 24px 80px rgba(90,70,180,0.08)',
        }}>
          <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-dim)', marginBottom: 12 }}>
            Who is your target audience?
          </p>

          <form onSubmit={handleSubmit}>
            <input
              className="input-field"
              placeholder="e.g. Indie makers building and selling SaaS tools"
              value={brief}
              onChange={e => setBrief(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && isValid && handleSubmit(e as unknown as React.FormEvent)}
              autoFocus
              style={{ marginBottom: 16 }}
            />

            <button className="btn-primary" type="submit" disabled={!isValid || loading} style={{ width: '100%', padding: '14px' }}>
              {loading ? (
                <>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ animation: 'spin 0.8s linear infinite' }}>
                    <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
                  </svg>
                  Finding your trends...
                </>
              ) : (
                <>
                  Show me my trends
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M5 12h14M12 5l7 7-7 7"/>
                  </svg>
                </>
              )}
            </button>
          </form>

          {/* Examples */}
          <div style={{ marginTop: 20, borderTop: '1px solid var(--border)', paddingTop: 20 }}>
            <p style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 10, fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
              Try an example
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {EXAMPLE_NICHES.map((example, i) => (
                <button
                  key={i}
                  onClick={() => setBrief(example)}
                  style={{
                    background: 'var(--surface-2)', border: '1px solid var(--border)',
                    borderRadius: 8, padding: '8px 12px',
                    fontSize: 13, color: 'var(--text-muted)',
                    cursor: 'pointer', textAlign: 'left',
                    fontFamily: 'var(--font-ui)', transition: 'all 0.15s',
                  }}
                  onMouseEnter={e => {
                    (e.currentTarget).style.borderColor = 'var(--accent)';
                    (e.currentTarget).style.color = 'var(--text)';
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget).style.borderColor = 'var(--border)';
                    (e.currentTarget).style.color = 'var(--text-muted)';
                  }}
                >
                  {example}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="animate-fade-up stagger-4" style={{
          display: 'flex', gap: 40, marginTop: 52,
          flexWrap: 'wrap', justifyContent: 'center',
        }}>
          {[
            { num: 'Live', label: 'Reddit conversation data' },
            { num: '9', label: 'Trending topics for your niche' },
            { num: 'AI', label: 'Narrative intelligence per topic' },
          ].map((stat, i) => (
            <div key={i} style={{ textAlign: 'center' }}>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 400, color: 'var(--text)', letterSpacing: '-0.03em' }}>
                {stat.num}
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>{stat.label}</div>
            </div>
          ))}
        </div>
      </main>

      {/* Footer */}
      <footer style={{
        padding: '16px 32px', borderTop: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        position: 'relative', zIndex: 10,
      }}>
        <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>
          makethiscontent.com · Powered by Reddit + AI
        </span>
      </footer>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
