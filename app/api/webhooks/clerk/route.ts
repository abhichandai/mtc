import { NextRequest, NextResponse } from 'next/server';
import { Webhook } from 'svix';
import { supabase } from '@/lib/supabase';

export async function POST(req: NextRequest) {
  const secret = process.env.CLERK_WEBHOOK_SECRET;
  if (!secret) {
    console.error('CLERK_WEBHOOK_SECRET is not set');
    return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 });
  }

  // Get raw body — svix requires the raw string, not parsed JSON
  const payload = await req.text();

  const svixId = req.headers.get('svix-id');
  const svixTimestamp = req.headers.get('svix-timestamp');
  const svixSignature = req.headers.get('svix-signature');

  if (!svixId || !svixTimestamp || !svixSignature) {
    return NextResponse.json({ error: 'Missing svix headers' }, { status: 400 });
  }

  // Verify signature
  let event: { type: string; data: { id: string } };
  try {
    const wh = new Webhook(secret);
    event = wh.verify(payload, {
      'svix-id': svixId,
      'svix-timestamp': svixTimestamp,
      'svix-signature': svixSignature,
    }) as { type: string; data: { id: string } };
  } catch (err) {
    console.error('Webhook signature verification failed:', err);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  // Only handle user.created
  if (event.type !== 'user.created') {
    return NextResponse.json({ message: 'Event ignored' }, { status: 200 });
  }

  const userId = event.data.id;

  // Upsert stub profile row — onboarding_completed = false
  // ON CONFLICT DO NOTHING so we never overwrite an existing row
  const { error } = await supabase
    .from('profiles')
    .upsert({ user_id: userId, onboarding_completed: false }, { onConflict: 'user_id', ignoreDuplicates: true });

  if (error) {
    console.error('Failed to create profile for user', userId, error.message);
    // Return 500 so Clerk/Svix retries the webhook
    return NextResponse.json({ error: 'Failed to create profile' }, { status: 500 });
  }

  console.log('Profile stub created for new user:', userId);
  return NextResponse.json({ message: 'Profile created' }, { status: 200 });
}
