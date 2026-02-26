'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';

const EXAMPLE_NICHES = [
  ['AI tools', 'productivity', 'solopreneurs'],
  ['fitness', 'nutrition', 'weight loss'],
  ['crypto', 'DeFi', 'Web3'],
  ['parenting', 'education', 'kids'],
  ['mental health', 'anxiety', 'wellness'],
  ['gaming', 'esports', 'streaming'],
];

export default function LandingPage() {
  const router = useRouter();
  const [keywords, setKeywords] = useState(['', '', '']);
  const [loading, setLoading] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);
  const inputRefs = [useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null)];

  const isValid = keywords.filter(k => k.trim().length > 0).length >= 2;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid || loading) return;
    const filled = keywords.filter(k => k.trim()).map(k => k.trim());
    setLoading(true);
    const params = new URLSearchParams({ k: filled.join(',') });
    router.push(`/dashboard?${params}`);
  };

  const setExample = (example: string[]) => {
    setKeywords([example[0], example[1], example[2]]);
  };

  const updateKeyword = (index: number, value: string) => {
    const next = [...keywords];
    next[index] = value;
    setKeywords(next);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, index: number) => {
    if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      if (index < 2) {
        inputRefs[index + 1].current?.focus();
      } else if (isValid) {
        handleSubmit(e as unknown as React.FormEvent);
      }
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden' }}>
      {/* Grid background */}
      <div className="grid-bg" />

      {/* Glow orbs */}
      <div className="glow-orb" style={{
        width: 600, height: 400,
        top: -100, left: '50%', transform: 'translateX(-50%)',
        background: 'radial-gradient(ellipse, rgba(124,92,252,0.07) 0%, transparent 70%)',
      }} />
      <div className="glow-orb" style={{
        width: 300, height: 300,
        bottom: '10%', right: '5%',
        background: 'radial-gradient(ellipse, rgba(124,92,252,0.04) 0%, transparent 70%)',
      }} />

      {/* Header */}
      <header style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '20px 32px',
        position: 'relative', zIndex: 10,
        borderBottom: '1px solid var(--border)',
        backdropFilter: 'blur(10px)',
        background: 'var(--header-bg)',
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

      {/* Main content */}
      <main style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: '60px 24px',
        position: 'relative', zIndex: 10,
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
            fontWeight: 400,
            lineHeight: 1.05,
            letterSpacing: '-0.02em',
            color: 'var(--text)',
            marginBottom: 24,
          }}>
            Know what your audience<br />
            <span style={{ fontStyle: 'italic', color: 'var(--accent)' }}>is saying right now</span>
          </h1>
          
          <p style={{
            fontSize: 17, color: 'var(--text-muted)',
            lineHeight: 1.6, maxWidth: 520, margin: '0 auto',
          }}>
            Enter 3 keywords that describe your niche. We&apos;ll surface the 10 most relevant trending topics — and show you exactly what conversations are happening around them.
          </p>
        </div>

        {/* Input card */}
        <div className="animate-fade-up stagger-2" style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 16,
          padding: '32px',
          width: '100%', maxWidth: 560,
          boxShadow: '0 24px 80px rgba(90,70,180,0.08)',
        }}>
          <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-dim)', marginBottom: 20 }}>
            Describe your niche in 3 keywords
          </p>
          
          <form onSubmit={handleSubmit}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
              {[0, 1, 2].map((i) => (
                <div key={i} style={{ position: 'relative' }}>
                  <span style={{
                    position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)',
                    fontSize: 12, fontWeight: 700, color: focusedIndex === i ? 'var(--accent)' : 'var(--text-dim)',
                    transition: 'color 0.15s',
                    userSelect: 'none',
                  }}>
                    {i + 1}
                  </span>
                  <input
                    ref={inputRefs[i]}
                    className="input-field"
                    style={{ paddingLeft: 36 }}
                    placeholder={['Your main topic (e.g. fitness)', 'Sub-topic (e.g. nutrition)', 'Audience (e.g. beginners)'][i]}
                    value={keywords[i]}
                    onChange={(e) => updateKeyword(i, e.target.value)}
                    onFocus={() => setFocusedIndex(i)}
                    onBlur={() => setFocusedIndex(null)}
                    onKeyDown={(e) => handleKeyDown(e, i)}
                    autoFocus={i === 0}
                  />
                </div>
              ))}
            </div>
            
            <button className="btn-primary" type="submit" disabled={!isValid || loading} style={{ width: '100%', padding: '14px' }}>
              {loading ? (
                <>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ animation: 'spin 0.8s linear infinite' }}>
                    <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
                  </svg>
                  Analyzing your niche...
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
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {EXAMPLE_NICHES.map((example, i) => (
                <button
                  key={i}
                  onClick={() => setExample(example)}
                  style={{
                    background: 'var(--surface-2)',
                    border: '1px solid var(--border)',
                    borderRadius: 6,
                    padding: '5px 10px',
                    fontSize: 12,
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                    fontFamily: 'var(--font-ui)',
                  }}
                  onMouseEnter={e => {
                    (e.target as HTMLElement).style.borderColor = 'var(--border-bright)';
                    (e.target as HTMLElement).style.color = 'var(--text)';
                  }}
                  onMouseLeave={e => {
                    (e.target as HTMLElement).style.borderColor = 'var(--border)';
                    (e.target as HTMLElement).style.color = 'var(--text-muted)';
                  }}
                >
                  {example.join(' · ')}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Stats row */}
        <div className="animate-fade-up stagger-4" style={{
          display: 'flex', gap: 40, marginTop: 52,
          flexWrap: 'wrap', justifyContent: 'center',
        }}>
          {[
            { num: '381', label: 'Trends analyzed per query' },
            { num: 'Live', label: 'Twitter conversation data' },
            { num: '10', label: 'Ranked results for your niche' },
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
        padding: '16px 32px',
        borderTop: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        position: 'relative', zIndex: 10,
      }}>
        <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>
          makethiscontent.com · Data from Google Trends + Twitter
        </span>
      </footer>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

