import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--bg)',
      padding: '24px',
    }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 32 }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--accent)', fontFamily: 'Montserrat, sans-serif', letterSpacing: '-0.02em', marginBottom: 8 }}>
            MakeThisContent
          </div>
          <div style={{ fontSize: 14, color: 'var(--text-muted)', fontFamily: 'Montserrat, sans-serif' }}>
            True Audience Intelligence
          </div>
        </div>
        <SignUp
          appearance={{
            elements: {
              rootBox: { fontFamily: 'Montserrat, sans-serif' },
              card: { boxShadow: '0 4px 24px rgba(124, 92, 252, 0.08)', border: '1px solid var(--border)' },
              headerTitle: { fontFamily: 'Montserrat, sans-serif', fontWeight: 700 },
              headerSubtitle: { fontFamily: 'Montserrat, sans-serif' },
              formButtonPrimary: {
                backgroundColor: '#7C5CFC',
                fontFamily: 'Montserrat, sans-serif',
                fontWeight: 600,
                '&:hover': { backgroundColor: '#6B4EE8' },
              },
              footerActionLink: { color: '#7C5CFC' },
            }
          }}
        />
      </div>
    </div>
  );
}
