import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const maxDuration = 10;

export async function GET() {
  try {
    // Lightweight query — just checks the connection is alive
    const { error } = await supabase.from('profiles').select('user_id').limit(1);

    if (error) {
      console.error('[keepalive] Supabase ping failed:', error.message);
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    console.log('[keepalive] Supabase ping successful');
    return NextResponse.json({ ok: true, timestamp: new Date().toISOString() });
  } catch (err) {
    console.error('[keepalive] Unexpected error:', err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
