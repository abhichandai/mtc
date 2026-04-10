'use client';

import { useState, useEffect } from 'react';
import AppShell from '../components/AppShell';
import { useRouter } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';
import { useTheme, type ThemePref } from '../components/ThemeProvider';

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

const FORMATS = [
  { id: 'long_form', label: 'Long Form', desc: 'YouTube videos, podcasts, long articles' },
  { id: 'short_form', label: 'Short Form', desc: 'Reels, Shorts, TikToks, quick posts' },
  { id: 'text', label: 'Text Articles', desc: 'Newsletters, blogs, LinkedIn posts' },
];

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

export default function SettingsPage() {
  const router = useRouter();
  const { isLoaded } = useAuth();
  const { pref: themePref, setPref: setThemePref } = useTheme();

  const [loading, setLoading] = useState(true);
  const [brief, setBrief] = useState('');
  const [platforms, setPlatforms] = useState<string[]>([]);
  const [styles, setStyles] = useState<string[]>([]);
  const [contentFormat, setContentFormat] = useState<string>('');
  const [saveState, setSaveState] = useState<SaveState>('idle');

  // Reset onboarding state
  const [resetting, setResetting] = useState(false);
  const [resetDone, setResetDone] = useState(false);

  useEffect(() => {
    if (!isLoaded) return;
    async function loadProfile() {
      try {
        const res = await fetch('/api/profile');
        const data = await res.json();
        if (data.profile) {
          setBrief(data.profile.audience_brief ?? '');
          setPlatforms(data.profile.platforms ?? []);
          setStyles(data.profile.content_styles ?? []);
          setContentFormat(data.profile.content_format ?? '');
        }
      } finally {
        setLoading(false);
      }
    }
    loadProfile();
  }, [isLoaded]);

  const togglePlatform = (id: string) => {
    setPlatforms(prev => prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]);
    setSaveState('idle');
  };

  const toggleStyle = (id: string) => {
    setStyles(prev => {
      if (prev.includes(id)) return prev.filter(s => s !== id);
      if (prev.length >= MAX_STYLES) return prev;
      return [...prev, id];
    });
    setSaveState('idle');
  };

  const handleSave = async () => {
    setSaveState('saving');
    try {
      const res = await fetch('/api/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          audience_brief: brief.trim(),
          platforms,
          content_styles: styles,
          content_format: contentFormat,
        }),
      });
      if (!res.ok) throw new Error();
      setSaveState('saved');
      setTimeout(() => setSaveState('idle'), 2500);
    } catch {
      setSaveState('error');
      setTimeout(() => setSaveState('idle'), 2500);
    }
  };

  const handleResetOnboarding = async () => {
    if (resetting) return;
    setResetting(true);
    try {
      await fetch('/api/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ onboarding_completed: false }),
      });
      setResetDone(true);
    } finally {
      setResetting(false);
    }
  };

  if (!isLoaded || loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
        <div style={{ width: 28, height: 28, border: '3px solid var(--border)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <AppShell>
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>

      {/* Content */}
      <main style={{ maxWidth: 640, margin: '0 auto', padding: '48px 24px 80px' }}>
        <h1 style={{
          fontFamily: 'var(--font-ui)', fontWeight: 800,
          fontSize: 28, letterSpacing: '-0.03em',
          color: 'var(--text)', marginBottom: 4,
        }}>
          Settings
        </h1>
        <p style={{ fontSize: 14, color: 'var(--text-muted)', fontFamily: 'var(--font-ui)', marginBottom: 40 }}>
          Update your audience brief and creator profile anytime.
        </p>

        {/* ── Audience Brief ── */}
        <section style={{ marginBottom: 40 }}>
          <label style={{
            fontSize: 12, fontWeight: 700, letterSpacing: '0.07em',
            textTransform: 'uppercase', color: 'var(--text-dim)',
            fontFamily: 'var(--font-ui)', display: 'block', marginBottom: 10,
          }}>
            Who is your target audience?
          </label>
          <div style={{
            background: 'var(--surface)', border: '1.5px solid var(--border)',
            borderRadius: 12, overflow: 'hidden',
          }}>
            <textarea
              style={{
                border: 'none', outline: 'none', background: 'transparent',
                padding: '14px 16px', fontSize: 15, color: 'var(--text)',
                fontFamily: 'var(--font-ui)', width: '100%', resize: 'none',
                minHeight: 80, lineHeight: 1.5,
              }}
              placeholder="e.g. Indie makers building and selling SaaS tools"
              value={brief}
              onChange={e => { setBrief(e.target.value); setSaveState('idle'); }}
            />
          </div>
        </section>

        {/* ── Platforms ── */}
        <section style={{ marginBottom: 40 }}>
          <label style={{
            fontSize: 12, fontWeight: 700, letterSpacing: '0.07em',
            textTransform: 'uppercase', color: 'var(--text-dim)',
            fontFamily: 'var(--font-ui)', display: 'block', marginBottom: 10,
          }}>
            What platforms do you create content on?
          </label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {PLATFORMS.map(p => {
              const active = platforms.includes(p.id);
              return (
                <button key={p.id} onClick={() => togglePlatform(p.id)} style={{
                  padding: '8px 16px', borderRadius: 100,
                  border: `1.5px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
                  background: active ? 'var(--accent-dim)' : 'var(--surface)',
                  color: active ? 'var(--accent)' : 'var(--text-muted)',
                  fontFamily: 'var(--font-ui)', fontSize: 14,
                  fontWeight: active ? 700 : 500, cursor: 'pointer',
                  transition: 'all 0.15s',
                }}>
                  {p.label}
                </button>
              );
            })}
          </div>
        </section>

        {/* ── Content Format ── */}
        <section style={{ marginBottom: 40 }}>
          <label style={{
            fontSize: 12, fontWeight: 700, letterSpacing: '0.07em',
            textTransform: 'uppercase', color: 'var(--text-dim)',
            fontFamily: 'var(--font-ui)', display: 'block', marginBottom: 10,
          }}>
            What&apos;s your primary content format?
          </label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {FORMATS.map(f => {
              const active = contentFormat === f.id;
              return (
                <button key={f.id} onClick={() => { setContentFormat(f.id); setSaveState('idle'); }} style={{
                  padding: '12px 16px', borderRadius: 10,
                  border: `1.5px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
                  background: active ? 'var(--accent-dim)' : 'var(--surface)',
                  fontFamily: 'var(--font-ui)', cursor: 'pointer',
                  transition: 'all 0.15s', textAlign: 'left',
                  display: 'flex', flexDirection: 'column', gap: 2,
                }}>
                  <span style={{ fontSize: 14, fontWeight: active ? 700 : 600, color: active ? 'var(--accent)' : 'var(--text)' }}>
                    {f.label}
                  </span>
                  <span style={{ fontSize: 12, color: active ? 'var(--accent)' : 'var(--text-dim)', fontWeight: 400 }}>
                    {f.desc}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        {/* ── Styles ── */}
        <section style={{ marginBottom: 48 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 10 }}>
            <label style={{
              fontSize: 12, fontWeight: 700, letterSpacing: '0.07em',
              textTransform: 'uppercase', color: 'var(--text-dim)',
              fontFamily: 'var(--font-ui)',
            }}>
              Pick your top 3 content styles
            </label>
            <span style={{
              fontSize: 12, fontWeight: 700,
              color: styles.length === MAX_STYLES ? 'var(--accent)' : 'var(--text-dim)',
              fontFamily: 'var(--font-ui)', transition: 'color 0.2s',
            }}>
              {styles.length} / {MAX_STYLES}
            </span>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {STYLES.map(s => {
              const active = styles.includes(s.id);
              const maxed = styles.length >= MAX_STYLES && !active;
              return (
                <button key={s.id} onClick={() => toggleStyle(s.id)} style={{
                  padding: '8px 16px', borderRadius: 100,
                  border: `1.5px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
                  background: active ? 'var(--accent-dim)' : 'var(--surface)',
                  color: active ? 'var(--accent)' : maxed ? 'var(--text-dim)' : 'var(--text-muted)',
                  fontFamily: 'var(--font-ui)', fontSize: 14,
                  fontWeight: active ? 700 : 500,
                  cursor: maxed ? 'not-allowed' : 'pointer',
                  opacity: maxed ? 0.45 : 1,
                  transition: 'all 0.15s',
                }}>
                  {s.label}
                </button>
              );
            })}
          </div>
        </section>

        {/* ── Save button ── */}
        <button
          onClick={handleSave}
          disabled={saveState === 'saving'}
          style={{
            width: '100%', padding: '14px',
            background: saveState === 'saved' ? '#22c55e' : saveState === 'error' ? '#ef4444' : 'var(--accent)',
            color: '#fff', border: 'none', borderRadius: 10,
            fontSize: 15, fontWeight: 700, fontFamily: 'var(--font-ui)',
            cursor: saveState === 'saving' ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            transition: 'background 0.2s',
            marginBottom: 48,
          }}
        >
          {saveState === 'saving' && (
            <div style={{ width: 15, height: 15, border: '2px solid rgba(255,255,255,0.4)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
          )}
          {saveState === 'saved' ? '✓ Saved' : saveState === 'error' ? 'Error — try again' : 'Save Changes'}
        </button>

        {/* ── Divider ── */}
        <div style={{ borderTop: '1px solid var(--border)', marginBottom: 40 }} />

        {/* ── Appearance ── */}
        <section style={{ marginBottom: 48 }}>
          <h2 style={{
            fontFamily: 'var(--font-ui)', fontWeight: 700, fontSize: 16,
            color: 'var(--text)', marginBottom: 6, letterSpacing: '-0.02em',
          }}>
            Appearance
          </h2>
          <p style={{ fontSize: 14, color: 'var(--text-muted)', fontFamily: 'var(--font-ui)', marginBottom: 16, lineHeight: 1.6 }}>
            Choose your theme. Auto switches to dark at 8pm and back to light at 7am.
          </p>
          <div style={{ display: 'flex', gap: 8 }}>
            {([
              { id: 'auto', label: 'Auto', desc: 'Time-based' },
              { id: 'light', label: 'Light', desc: 'Always light' },
              { id: 'dark', label: 'Dark', desc: 'Always dark' },
            ] as { id: ThemePref; label: string; desc: string }[]).map(opt => {
              const active = themePref === opt.id;
              return (
                <button
                  key={opt.id}
                  onClick={() => setThemePref(opt.id)}
                  style={{
                    flex: 1, padding: '12px 16px',
                    borderRadius: 10,
                    border: `1.5px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
                    background: active ? 'var(--accent-dim)' : 'var(--surface)',
                    fontFamily: 'var(--font-ui)',
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                    textAlign: 'center' as const,
                  }}
                >
                  <p style={{ fontSize: 14, fontWeight: active ? 700 : 600, color: active ? 'var(--accent)' : 'var(--text)', marginBottom: 2 }}>
                    {opt.label}
                  </p>
                  <p style={{ fontSize: 11, color: active ? 'var(--accent)' : 'var(--text-dim)', fontWeight: 400 }}>
                    {opt.desc}
                  </p>
                </button>
              );
            })}
          </div>
        </section>

        {/* ── Divider ── */}
        <div style={{ borderTop: '1px solid var(--border)', marginBottom: 40 }} />

        {/* ── Onboarding Reset ── */}
        <section>
          <h2 style={{
            fontFamily: 'var(--font-ui)', fontWeight: 700, fontSize: 16,
            color: 'var(--text)', marginBottom: 6, letterSpacing: '-0.02em',
          }}>
            Onboarding
          </h2>
          <p style={{ fontSize: 14, color: 'var(--text-muted)', fontFamily: 'var(--font-ui)', marginBottom: 16, lineHeight: 1.6 }}>
            Reset and re-run the onboarding flow. Useful for testing or if you want to start fresh with a different audience brief.
          </p>

          <div style={{
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 12, padding: '16px 20px',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16,
          }}>
            <div>
              <p style={{ fontFamily: 'var(--font-ui)', fontWeight: 600, fontSize: 14, color: 'var(--text)', marginBottom: 2 }}>
                Re-run onboarding
              </p>
              <p style={{ fontFamily: 'var(--font-ui)', fontSize: 13, color: 'var(--text-dim)' }}>
                {resetDone
                  ? 'Done — visit /onboarding to start the flow again.'
                  : 'Marks onboarding as incomplete so you\'ll see it on next visit.'}
              </p>
            </div>

            {resetDone ? (
              <button
                onClick={() => router.push('/onboarding')}
                style={{
                  padding: '8px 16px', borderRadius: 8, flexShrink: 0,
                  background: 'var(--accent)', color: '#fff',
                  border: 'none', fontSize: 13, fontWeight: 700,
                  fontFamily: 'var(--font-ui)', cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                Go to onboarding →
              </button>
            ) : (
              <button
                onClick={handleResetOnboarding}
                disabled={resetting}
                style={{
                  padding: '8px 16px', borderRadius: 8, flexShrink: 0,
                  background: 'var(--surface-2)',
                  border: '1.5px solid var(--border)',
                  color: 'var(--text-muted)',
                  fontSize: 13, fontWeight: 600,
                  fontFamily: 'var(--font-ui)',
                  cursor: resetting ? 'not-allowed' : 'pointer',
                  whiteSpace: 'nowrap',
                  transition: 'all 0.15s',
                }}
              >
                {resetting ? 'Resetting...' : 'Reset onboarding'}
              </button>
            )}
          </div>
        </section>
      </main>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
    </AppShell>
  );
}
