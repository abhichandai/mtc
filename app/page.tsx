'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';
import Image from 'next/image';

const EXAMPLES = [
  'Indie makers building and selling SaaS tools',
  'Busy moms into meal prep and family health',
  'Personal finance creators focused on debt payoff',
];

export default function LandingPage() {
  const router = useRouter();
  const { isSignedIn } = useAuth();
  const [brief, setBrief] = useState('');
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState(false);

  const isValid = brief.trim().length >= 3;

  useEffect(() => {
    if (isSignedIn) router.push('/dashboard');
  }, [isSignedIn, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid || loading) return;
    setLoading(true);
    const onboardingUrl = `/onboarding?${new URLSearchParams({ k: brief.trim() })}`;
    router.push(`/sign-up?redirect_url=${encodeURIComponent(onboardingUrl)}`);
  };

  const scrollToInput = () => {
    document.getElementById('brief-input')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setTimeout(() => document.getElementById('brief-input')?.focus(), 400);
  };

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(160deg, var(--bg-start) 0%, var(--bg-mid) 45%, var(--bg-end) 100%)', backgroundAttachment: 'fixed', display: 'flex', flexDirection: 'column' }}>

      {/* Nav */}
      <nav style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 48px', height: 64,
        borderBottom: '1px solid var(--border)',
        background: 'var(--header-bg)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        position: 'sticky', top: 0, zIndex: 50,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent)', boxShadow: '0 0 0 3px var(--accent-glow)' }} />
          <span style={{ fontFamily: 'var(--font-ui)', fontWeight: 800, fontSize: 14, letterSpacing: '-0.01em', color: 'var(--text)' }}>
            MakeThisContent
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {isSignedIn ? (
            <button onClick={() => router.push('/dashboard')} style={{ background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 8, padding: '7px 16px', fontSize: 13, fontWeight: 700, fontFamily: 'var(--font-ui)', cursor: 'pointer' }}>
              Go to dashboard →
            </button>
          ) : (
            <>
              <button
                onClick={() => router.push('/sign-in?redirect_url=/dashboard')}
                style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 8, padding: '7px 16px', fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', cursor: 'pointer', fontFamily: 'var(--font-ui)', transition: 'all 0.15s' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--accent)'; (e.currentTarget as HTMLElement).style.color = 'var(--accent)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'; (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'; }}
              >Sign in</button>
              <button
                onClick={scrollToInput}
                style={{ background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 8, padding: '7px 16px', fontSize: 13, fontWeight: 700, fontFamily: 'var(--font-ui)', cursor: 'pointer', transition: 'opacity 0.15s' }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.opacity = '0.88'}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.opacity = '1'}
              >Get started free</button>
            </>
          )}
        </div>
      </nav>

      {/* Hero */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '72px 24px 0', textAlign: 'center' }}>

        {/* Announcement pill */}
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'var(--accent-dim)', border: '1px solid var(--accent)', borderRadius: 100, padding: '5px 14px 5px 10px', marginBottom: 32 }}>
          <span style={{ background: 'var(--accent)', color: '#fff', borderRadius: 100, padding: '2px 8px', fontSize: 11, fontWeight: 700, fontFamily: 'var(--font-ui)', letterSpacing: '0.04em', textTransform: 'uppercase' as const }}>
            New
          </span>
          <span style={{ fontSize: 13, color: 'var(--accent)', fontFamily: 'var(--font-ui)', fontWeight: 500 }}>
            True Audience Intelligence for content creators
          </span>
        </div>

        {/* Headline */}
        <h1 style={{ fontFamily: 'var(--font-ui)', fontWeight: 800, fontSize: 'clamp(36px, 5vw, 60px)', lineHeight: 1.08, letterSpacing: '-0.035em', color: 'var(--text)', marginBottom: 20, maxWidth: 800 }}>
          Create Content Your Audience{' '}
          <span style={{ color: 'var(--accent)' }}>Wants to See</span>
        </h1>

        {/* Subheading */}
        <p style={{ fontSize: 17, lineHeight: 1.65, color: 'var(--text-muted)', maxWidth: 540, marginBottom: 36, fontFamily: 'var(--font-ui)' }}>
          Stop guessing what to post. MakeThisContent surfaces what your niche is actively talking about — with AI-generated content ideas tailored to your style.
        </p>

        {/* Dual CTA */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 56, flexWrap: 'wrap', justifyContent: 'center' }}>
          <button
            onClick={scrollToInput}
            style={{ background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 10, padding: '13px 28px', fontSize: 15, fontWeight: 700, fontFamily: 'var(--font-ui)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, transition: 'all 0.15s', boxShadow: '0 4px 20px var(--accent-glow)' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 8px 28px var(--accent-glow)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(0)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 20px var(--accent-glow)'; }}
          >
            Get started free
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
          </button>
          <button
            onClick={() => router.push('/sign-in?redirect_url=/dashboard')}
            style={{ background: 'var(--surface)', color: 'var(--text)', border: '1.5px solid var(--border)', borderRadius: 10, padding: '13px 28px', fontSize: 15, fontWeight: 600, fontFamily: 'var(--font-ui)', cursor: 'pointer', transition: 'all 0.15s' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--accent)'; (e.currentTarget as HTMLElement).style.color = 'var(--accent)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'; (e.currentTarget as HTMLElement).style.color = 'var(--text)'; }}
          >
            Sign in
          </button>
        </div>

        {/* Product screenshot */}
        <div style={{ width: '100%', maxWidth: 1080, borderRadius: '16px 16px 0 0', border: '1px solid rgba(124,58,237,0.15)', borderBottom: 'none', overflow: 'hidden', boxShadow: '0 -8px 60px rgba(80,50,140,0.20), 0 -2px 20px rgba(80,50,140,0.10)', background: 'var(--surface)' }}>
          {/* Fake browser bar */}
          <div style={{ background: 'var(--surface-2)', borderBottom: '1px solid var(--border)', padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ display: 'flex', gap: 6 }}>
              {['#ef4444','#f59e0b','#22c55e'].map(c => (
                <div key={c} style={{ width: 10, height: 10, borderRadius: '50%', background: c, opacity: 0.7 }} />
              ))}
            </div>
            <div style={{ flex: 1, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6, padding: '3px 10px', maxWidth: 280, margin: '0 auto', fontSize: 11, color: 'var(--text-dim)', fontFamily: 'var(--font-ui)' }}>
              app.makethiscontent.com/dashboard
            </div>
          </div>
          <Image
            src="/dashboard-screenshot.png"
            alt="MakeThisContent dashboard showing trending topics"
            width={1080}
            height={720}
            style={{ width: '100%', height: 'auto', display: 'block' }}
            priority
          />
        </div>
      </main>

      {/* Input section */}
      <section style={{ background: 'transparent', borderTop: '1px solid var(--border)', padding: '72px 24px 80px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <h2 style={{ fontFamily: 'var(--font-ui)', fontWeight: 800, fontSize: 'clamp(24px, 3vw, 36px)', letterSpacing: '-0.03em', color: 'var(--text)', marginBottom: 8, textAlign: 'center' }}>
          Try it now — describe your audience
        </h2>
        <p style={{ fontSize: 15, color: 'var(--text-muted)', fontFamily: 'var(--font-ui)', marginBottom: 32, textAlign: 'center' }}>
          No credit card required.
        </p>

        <form onSubmit={handleSubmit} style={{ width: '100%', maxWidth: 600 }}>
          <div style={{ background: 'var(--surface)', border: `1.5px solid ${focused ? 'var(--accent)' : 'var(--border)'}`, borderRadius: 14, overflow: 'hidden', boxShadow: focused ? '0 0 0 3px var(--accent-glow)' : '0 4px 24px rgba(90,70,180,0.07)', transition: 'border-color 0.15s, box-shadow 0.15s' }}>
            <label style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase' as const, color: 'var(--text-dim)', padding: '14px 18px 4px', fontFamily: 'var(--font-ui)', display: 'block', userSelect: 'none' as const }}>
              Who is your target audience?
            </label>
            <input
              id="brief-input"
              style={{ border: 'none', outline: 'none', background: 'transparent', padding: '6px 18px 14px', fontSize: 16, color: 'var(--text)', fontFamily: 'var(--font-ui)', width: '100%' }}
              placeholder="e.g. Indie makers building and selling SaaS tools"
              value={brief}
              onChange={e => setBrief(e.target.value)}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              onKeyDown={e => e.key === 'Enter' && isValid && handleSubmit(e as unknown as React.FormEvent)}
            />
          </div>

          <button
            type="submit"
            disabled={!isValid || loading}
            style={{ marginTop: 10, width: '100%', padding: '14px', background: isValid ? 'var(--accent)' : 'var(--border)', color: isValid ? '#fff' : 'var(--text-dim)', border: 'none', borderRadius: 10, fontSize: 15, fontWeight: 700, fontFamily: 'var(--font-ui)', cursor: isValid && !loading ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, transition: 'background 0.15s, transform 0.1s' }}
            onMouseEnter={e => isValid && ((e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)')}
            onMouseLeave={e => ((e.currentTarget as HTMLElement).style.transform = 'translateY(0)')}
          >
            {loading ? (
              <>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ animation: 'spin 0.8s linear infinite' }}><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>
                Setting up your dashboard...
              </>
            ) : (
              <>
                Unlock Audience Intelligence
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
              </>
            )}
          </button>
        </form>

        {/* Example pills */}
        <div style={{ marginTop: 24, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 12, color: 'var(--text-dim)', fontFamily: 'var(--font-ui)', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase' as const }}>
            Try an example
          </span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'center', maxWidth: 600 }}>
            {EXAMPLES.map((ex, i) => (
              <button
                key={i}
                onClick={() => { setBrief(ex); document.getElementById('brief-input')?.focus(); }}
                style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 100, padding: '6px 14px', fontSize: 13, color: 'var(--text-muted)', cursor: 'pointer', fontFamily: 'var(--font-ui)', transition: 'all 0.15s' }}
                onMouseEnter={e => { const el = e.currentTarget; el.style.borderColor = 'var(--accent)'; el.style.color = 'var(--accent)'; el.style.background = 'var(--accent-dim)'; }}
                onMouseLeave={e => { const el = e.currentTarget; el.style.borderColor = 'var(--border)'; el.style.color = 'var(--text-muted)'; el.style.background = 'var(--surface)'; }}
              >
                {ex}
              </button>
            ))}
          </div>
        </div>

        {/* Stats */}
        <div style={{ marginTop: 52, display: 'flex', gap: 48, flexWrap: 'wrap', justifyContent: 'center' }}>
          {[
            { num: 'Live', label: 'Reddit conversation data' },
            { num: '12', label: 'Trending topics per audience' },
            { num: 'AI', label: 'Narrative intelligence per card' },
          ].map((stat, i) => (
            <div key={i} style={{ textAlign: 'center' }}>
              <div style={{ fontFamily: 'var(--font-ui)', fontSize: 26, fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.03em' }}>{stat.num}</div>
              <div style={{ fontSize: 13, color: 'var(--text-dim)', marginTop: 3, fontFamily: 'var(--font-ui)' }}>{stat.label}</div>
            </div>
          ))}
        </div>
      </section>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
