'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const EXAMPLES = [
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
    router.push(`/dashboard?${new URLSearchParams({ k: brief.trim() })}`);
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg)',
      display: 'flex',
      flexDirection: 'column',
    }}>

      {/* Nav */}
      <nav style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 48px', height: 64,
        borderBottom: '1px solid var(--border)',
        background: 'var(--bg)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 8, height: 8, borderRadius: '50%',
            background: 'var(--accent)',
            boxShadow: '0 0 0 3px var(--accent-glow)',
          }} />
          <span style={{
            fontFamily: 'var(--font-ui)', fontWeight: 800, fontSize: 14,
            letterSpacing: '-0.01em', color: 'var(--text)',
          }}>
            MakeThisContent
          </span>
        </div>
        <span style={{
          fontSize: 12, color: 'var(--text-dim)',
          fontFamily: 'var(--font-ui)',
        }}>
          Beta
        </span>
      </nav>

      {/* Hero */}
      <main style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: '80px 24px 120px',
        textAlign: 'center',
      }}>

        {/* Badge */}
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 100, padding: '5px 14px',
          marginBottom: 40,
        }}>
          <span style={{
            width: 6, height: 6, borderRadius: '50%',
            background: '#22c55e',
            display: 'inline-block',
          }} />
          <span style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'var(--font-ui)', fontWeight: 500 }}>
            Live Reddit intelligence
          </span>
        </div>

        {/* Heading */}
        <h1 style={{
          fontFamily: 'var(--font-ui)',
          fontWeight: 800,
          fontSize: 'clamp(42px, 6vw, 80px)',
          lineHeight: 1.05,
          letterSpacing: '-0.03em',
          color: 'var(--text)',
          marginBottom: 24,
          maxWidth: 760,
        }}>
          Know what your audience<br />
          <span style={{ color: 'var(--accent)' }}>is saying right now</span>
        </h1>

        {/* Subheading */}
        <p style={{
          fontSize: 18, lineHeight: 1.65,
          color: 'var(--text-muted)',
          maxWidth: 480, marginBottom: 56,
          fontFamily: 'var(--font-ui)',
        }}>
          Describe your target audience. We surface what they&apos;re actually talking about — and turn it into content angles.
        </p>

        {/* Input group */}
        <form onSubmit={handleSubmit} style={{ width: '100%', maxWidth: 520 }}>
          <div style={{
            display: 'flex', flexDirection: 'column', gap: 0,
            background: 'var(--surface)',
            border: '1.5px solid var(--border)',
            borderRadius: 14,
            overflow: 'hidden',
            boxShadow: '0 4px 24px rgba(90,70,180,0.07)',
            transition: 'border-color 0.15s, box-shadow 0.15s',
          }}
            onFocus={() => {}}
          >
            <label style={{
              fontSize: 11, fontWeight: 700,
              letterSpacing: '0.07em', textTransform: 'uppercase',
              color: 'var(--text-dim)',
              padding: '14px 18px 4px',
              fontFamily: 'var(--font-ui)',
              userSelect: 'none',
            }}>
              Who is your target audience?
            </label>
            <input
              style={{
                border: 'none', outline: 'none',
                background: 'transparent',
                padding: '6px 18px 14px',
                fontSize: 16, color: 'var(--text)',
                fontFamily: 'var(--font-ui)',
                width: '100%',
              }}
              placeholder="e.g. Indie makers building and selling SaaS tools"
              value={brief}
              onChange={e => setBrief(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && isValid && handleSubmit(e as unknown as React.FormEvent)}
              autoFocus
            />
          </div>

          <button
            type="submit"
            disabled={!isValid || loading}
            style={{
              marginTop: 12,
              width: '100%', padding: '14px',
              background: isValid ? 'var(--accent)' : 'var(--border)',
              color: isValid ? '#fff' : 'var(--text-dim)',
              border: 'none', borderRadius: 10,
              fontSize: 15, fontWeight: 700,
              fontFamily: 'var(--font-ui)',
              cursor: isValid && !loading ? 'pointer' : 'not-allowed',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              transition: 'background 0.15s, transform 0.1s',
              letterSpacing: '-0.01em',
            }}
            onMouseEnter={e => isValid && ((e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)')}
            onMouseLeave={e => ((e.currentTarget as HTMLElement).style.transform = 'translateY(0)')}
          >
            {loading ? (
              <>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ animation: 'spin 0.8s linear infinite' }}>
                  <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
                </svg>
                Finding trends...
              </>
            ) : (
              <>
                Show me my trends
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M5 12h14M12 5l7 7-7 7"/>
                </svg>
              </>
            )}
          </button>
        </form>

        {/* Examples */}
        <div style={{ marginTop: 28, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 12, color: 'var(--text-dim)', fontFamily: 'var(--font-ui)', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
            Try an example
          </span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'center', maxWidth: 560 }}>
            {EXAMPLES.map((ex, i) => (
              <button
                key={i}
                onClick={() => setBrief(ex)}
                style={{
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 100,
                  padding: '6px 14px',
                  fontSize: 13,
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  fontFamily: 'var(--font-ui)',
                  transition: 'all 0.15s',
                  whiteSpace: 'nowrap',
                }}
                onMouseEnter={e => {
                  const el = e.currentTarget;
                  el.style.borderColor = 'var(--accent)';
                  el.style.color = 'var(--accent)';
                  el.style.background = 'var(--accent-dim)';
                }}
                onMouseLeave={e => {
                  const el = e.currentTarget;
                  el.style.borderColor = 'var(--border)';
                  el.style.color = 'var(--text-muted)';
                  el.style.background = 'var(--surface)';
                }}
              >
                {ex}
              </button>
            ))}
          </div>
        </div>

        {/* Social proof row */}
        <div style={{
          marginTop: 72,
          display: 'flex', gap: 48,
          flexWrap: 'wrap', justifyContent: 'center',
        }}>
          {[
            { num: 'Live', label: 'Reddit conversation data' },
            { num: '9', label: 'Trending topics per search' },
            { num: 'AI', label: 'Narrative intelligence per card' },
          ].map((stat, i) => (
            <div key={i} style={{ textAlign: 'center' }}>
              <div style={{
                fontFamily: 'var(--font-ui)', fontSize: 26,
                fontWeight: 800, color: 'var(--text)',
                letterSpacing: '-0.03em',
              }}>
                {stat.num}
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-dim)', marginTop: 3, fontFamily: 'var(--font-ui)' }}>
                {stat.label}
              </div>
            </div>
          ))}
        </div>
      </main>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
