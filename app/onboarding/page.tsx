'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';

const PLATFORMS = [
  { id: 'youtube', label: 'YouTube' },
  { id: 'tiktok', label: 'TikTok' },
  { id: 'instagram', label: 'Instagram' },
  { id: 'facebook', label: 'Facebook' },
  { id: 'linkedin', label: 'LinkedIn' },
  { id: 'podcast', label: 'Podcast' },
  { id: 'newsletter', label: 'Newsletter' },
  { id: 'blog', label: 'Blog' },
];

const STYLES = [
  { id: 'educational', label: 'Educational breakdowns' },
  { id: 'storytelling', label: 'Personal storytelling' },
  { id: 'hot_takes', label: 'Hot takes & opinions' },
  { id: 'interviews', label: 'Interviews' },
  { id: 'documentary', label: 'Documentary' },
  { id: 'tutorials', label: 'Tutorials' },
  { id: 'trends', label: 'Trends & commentary' },
  { id: 'reaction', label: 'Reaction & commentary' },
  { id: 'vlog', label: 'Day in the life / Vlog' },
  { id: 'challenge', label: 'Challenge / Experiment' },
  { id: 'case_study', label: 'Case study / Deep dive' },
  { id: 'review', label: 'Review & comparison' },
  { id: 'satire', label: 'Satire / Comedy' },
  { id: 'qa', label: 'Q&A / AMA' },
  { id: 'listicle', label: 'List / Roundup' },
];

const MAX_STYLES = 3;

function OnboardingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { userId, isLoaded } = useAuth();

  const [step, setStep] = useState(1);
  const [brief, setBrief] = useState('');
  const [platforms, setPlatforms] = useState<string[]>([]);
  const [styles, setStyles] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [checking, setChecking] = useState(true);

  // Pre-fill brief from landing page ?k= param
  useEffect(() => {
    const k = searchParams.get('k');
    if (k) setBrief(k);
  }, [searchParams]);

  // If already onboarded, skip straight to dashboard
  useEffect(() => {
    if (!isLoaded || !userId) return;
    async function checkProfile() {
      try {
        const res = await fetch('/api/profile');
        const data = await res.json();
        if (data.profile?.onboarding_completed) {
          const k = searchParams.get('k');
          const dest = k ? `/dashboard?${new URLSearchParams({ k })}` : '/dashboard';
          router.replace(dest);
        }
      } catch {
        // ignore — proceed with onboarding
      } finally {
        setChecking(false);
      }
    }
    checkProfile();
  }, [isLoaded, userId, router, searchParams]);

  const togglePlatform = (id: string) => {
    setPlatforms(prev =>
      prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
    );
  };

  const toggleStyle = (id: string) => {
    setStyles(prev => {
      if (prev.includes(id)) return prev.filter(s => s !== id);
      if (prev.length >= MAX_STYLES) return prev;
      return [...prev, id];
    });
  };

  const handleComplete = async () => {
    if (saving) return;
    setSaving(true);
    try {
      await fetch('/api/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          audience_brief: brief.trim(),
          platforms,
          content_styles: styles,
          onboarding_completed: true,
        }),
      });
      const k = brief.trim();
      router.push(k ? `/dashboard?${new URLSearchParams({ k })}` : '/dashboard');
    } catch {
      setSaving(false);
    }
  };

  if (!isLoaded || checking) {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'var(--bg)',
      }}>
        <div style={{ width: 32, height: 32, border: '3px solid var(--border)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh', background: 'var(--bg)',
      display: 'flex', flexDirection: 'column',
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
        {/* Step indicator */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {[1, 2].map(n => (
            <div key={n} style={{
              width: n === step ? 24 : 8, height: 8,
              borderRadius: 4,
              background: n === step ? 'var(--accent)' : n < step ? 'var(--accent)' : 'var(--border)',
              transition: 'all 0.3s ease',
              opacity: n < step ? 0.4 : 1,
            }} />
          ))}
        </div>
      </nav>

      {/* Main */}
      <main style={{
        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '40px 24px',
      }}>
        <div style={{
          width: '100%', maxWidth: 600,
          animation: 'fade-up 0.35s ease both',
        }}>
          {step === 1 ? (
            <>
              <p style={{
                fontSize: 12, fontWeight: 700, letterSpacing: '0.07em',
                textTransform: 'uppercase', color: 'var(--accent)',
                fontFamily: 'var(--font-ui)', marginBottom: 12,
              }}>
                Step 1 of 2
              </p>
              <h1 style={{
                fontFamily: 'var(--font-ui)', fontWeight: 800,
                fontSize: 'clamp(26px, 3.5vw, 40px)',
                lineHeight: 1.15, letterSpacing: '-0.03em',
                color: 'var(--text)', marginBottom: 10,
              }}>
                Who is your target audience?
              </h1>
              <p style={{
                fontSize: 15, color: 'var(--text-muted)',
                fontFamily: 'var(--font-ui)', marginBottom: 32, lineHeight: 1.6,
              }}>
                Describe them in plain language — the more specific, the better the intelligence.
              </p>

              <div style={{
                background: 'var(--surface)',
                border: '1.5px solid var(--border)',
                borderRadius: 14, overflow: 'hidden',
                boxShadow: '0 4px 24px rgba(90,70,180,0.07)',
              }}>
                <label style={{
                  fontSize: 11, fontWeight: 700, letterSpacing: '0.07em',
                  textTransform: 'uppercase', color: 'var(--text-dim)',
                  padding: '14px 18px 4px', display: 'block',
                  fontFamily: 'var(--font-ui)', userSelect: 'none',
                }}>
                  Audience brief
                </label>
                <textarea
                  style={{
                    border: 'none', outline: 'none',
                    background: 'transparent',
                    padding: '6px 18px 14px',
                    fontSize: 16, color: 'var(--text)',
                    fontFamily: 'var(--font-ui)',
                    width: '100%', resize: 'none',
                    minHeight: 90,
                    lineHeight: 1.5,
                  }}
                  placeholder="e.g. Indie makers building and selling SaaS tools"
                  value={brief}
                  onChange={e => setBrief(e.target.value)}
                  autoFocus
                />
              </div>

              <button
                onClick={() => setStep(2)}
                disabled={brief.trim().length < 3}
                style={{
                  marginTop: 16, width: '100%', padding: '14px',
                  background: brief.trim().length >= 3 ? 'var(--accent)' : 'var(--border)',
                  color: brief.trim().length >= 3 ? '#fff' : 'var(--text-dim)',
                  border: 'none', borderRadius: 10,
                  fontSize: 15, fontWeight: 700,
                  fontFamily: 'var(--font-ui)',
                  cursor: brief.trim().length >= 3 ? 'pointer' : 'not-allowed',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  transition: 'all 0.15s',
                  letterSpacing: '-0.01em',
                }}
              >
                Next — What do you create?
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M5 12h14M12 5l7 7-7 7"/>
                </svg>
              </button>
            </>
          ) : (
            <>
              <p style={{
                fontSize: 12, fontWeight: 700, letterSpacing: '0.07em',
                textTransform: 'uppercase', color: 'var(--accent)',
                fontFamily: 'var(--font-ui)', marginBottom: 12,
              }}>
                Step 2 of 2
              </p>
              <h1 style={{
                fontFamily: 'var(--font-ui)', fontWeight: 800,
                fontSize: 'clamp(26px, 3.5vw, 40px)',
                lineHeight: 1.15, letterSpacing: '-0.03em',
                color: 'var(--text)', marginBottom: 10,
              }}>
                What kind of content do you make?
              </h1>
              <p style={{
                fontSize: 15, color: 'var(--text-muted)',
                fontFamily: 'var(--font-ui)', marginBottom: 32, lineHeight: 1.6,
              }}>
                This personalises the content ideas the AI generates for you.
              </p>

              {/* Platform */}
              <div style={{ marginBottom: 28 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 12 }}>
                  <p style={{
                    fontSize: 12, fontWeight: 700, letterSpacing: '0.07em',
                    textTransform: 'uppercase', color: 'var(--text-dim)',
                    fontFamily: 'var(--font-ui)', margin: 0,
                  }}>
                    What platforms do you create content on?
                  </p>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {PLATFORMS.map(p => {
                    const active = platforms.includes(p.id);
                    return (
                      <button
                        key={p.id}
                        onClick={() => togglePlatform(p.id)}
                        style={{
                          padding: '8px 16px',
                          borderRadius: 100,
                          border: `1.5px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
                          background: active ? 'var(--accent-dim)' : 'var(--surface)',
                          color: active ? 'var(--accent)' : 'var(--text-muted)',
                          fontFamily: 'var(--font-ui)',
                          fontSize: 14, fontWeight: active ? 700 : 500,
                          cursor: 'pointer',
                          transition: 'all 0.15s',
                        }}
                      >
                        {p.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Style */}
              <div style={{ marginBottom: 32 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 12 }}>
                  <p style={{
                    fontSize: 12, fontWeight: 700, letterSpacing: '0.07em',
                    textTransform: 'uppercase', color: 'var(--text-dim)',
                    fontFamily: 'var(--font-ui)', margin: 0,
                  }}>
                    Pick your top 3 content styles
                  </p>
                  <span style={{
                    fontSize: 12, fontWeight: 700,
                    color: styles.length === MAX_STYLES ? 'var(--accent)' : 'var(--text-dim)',
                    fontFamily: 'var(--font-ui)',
                    transition: 'color 0.2s',
                  }}>
                    {styles.length} / {MAX_STYLES}
                  </span>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {STYLES.map(s => {
                    const active = styles.includes(s.id);
                    const maxed = styles.length >= MAX_STYLES && !active;
                    return (
                      <button
                        key={s.id}
                        onClick={() => toggleStyle(s.id)}
                        style={{
                          padding: '8px 16px',
                          borderRadius: 100,
                          border: `1.5px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
                          background: active ? 'var(--accent-dim)' : 'var(--surface)',
                          color: active ? 'var(--accent)' : maxed ? 'var(--text-dim)' : 'var(--text-muted)',
                          fontFamily: 'var(--font-ui)',
                          fontSize: 14, fontWeight: active ? 700 : 500,
                          cursor: maxed ? 'not-allowed' : 'pointer',
                          opacity: maxed ? 0.45 : 1,
                          transition: 'all 0.15s',
                        }}
                      >
                        {s.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  onClick={() => setStep(1)}
                  style={{
                    padding: '14px 20px',
                    background: 'var(--surface)',
                    border: '1.5px solid var(--border)',
                    borderRadius: 10,
                    fontSize: 15, fontWeight: 600,
                    color: 'var(--text-muted)',
                    fontFamily: 'var(--font-ui)',
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                  }}
                >
                  ← Back
                </button>
                <button
                  onClick={handleComplete}
                  disabled={saving || (platforms.length === 0 && styles.length === 0)}
                  style={{
                    flex: 1, padding: '14px',
                    background: platforms.length > 0 || styles.length > 0 ? 'var(--accent)' : 'var(--border)',
                    color: platforms.length > 0 || styles.length > 0 ? '#fff' : 'var(--text-dim)',
                    border: 'none', borderRadius: 10,
                    fontSize: 15, fontWeight: 700,
                    fontFamily: 'var(--font-ui)',
                    cursor: !saving && (platforms.length > 0 || styles.length > 0) ? 'pointer' : 'not-allowed',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    transition: 'all 0.15s',
                    letterSpacing: '-0.01em',
                  }}
                >
                  {saving ? (
                    <>
                      <div style={{ width: 15, height: 15, border: '2px solid rgba(255,255,255,0.4)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
                      Setting up your intelligence...
                    </>
                  ) : (
                    <>
                      Start Exploring
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path d="M5 12h14M12 5l7 7-7 7"/>
                      </svg>
                    </>
                  )}
                </button>
              </div>
              <p style={{
                textAlign: 'center', marginTop: 12,
                fontSize: 12, color: 'var(--text-dim)',
                fontFamily: 'var(--font-ui)',
              }}>
                You can change these anytime in Settings.
              </p>
            </>
          )}
        </div>
      </main>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fade-up { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  );
}

export default function OnboardingPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
        <div style={{ width: 32, height: 32, border: '3px solid var(--border)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    }>
      <OnboardingContent />
    </Suspense>
  );
}
