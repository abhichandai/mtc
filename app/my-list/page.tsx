'use client';

import AppShell from '../components/AppShell';

export default function MyListPage() {
  return (
    <AppShell>
      <div style={{
        minHeight: '100vh', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        background: 'var(--bg)', gap: 16,
      }}>
        <div style={{
          width: 48, height: 48, borderRadius: 12,
          background: 'var(--accent-dim)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
          </svg>
        </div>
        <h1 style={{
          fontFamily: 'var(--font-ui)', fontWeight: 800, fontSize: 22,
          color: 'var(--text)', letterSpacing: '-0.03em', margin: 0,
        }}>
          My List
        </h1>
        <p style={{
          fontFamily: 'var(--font-ui)', fontSize: 14,
          color: 'var(--text-muted)', margin: 0,
        }}>
          Your saved content ideas will appear here.
        </p>
      </div>
    </AppShell>
  );
}
