import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const adminClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

export async function POST(req: Request) {
  const { username } = await req.json()
  if (!username || typeof username !== 'string') {
    return NextResponse.json({ error: 'Missing username' }, { status: 400 })
  }

  const { data: profile, error } = await adminClient
    .from('user_profiles')
    .select('id')
    .eq('username', username.trim().toLowerCase())
    .maybeSingle()

  if (error || !profile) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  const { data: { user }, error: userErr } = await adminClient.auth.admin.getUserById(profile.id)
  if (userErr || !user?.email) {
    return NextResponse.json({ error: 'Could not resolve email' }, { status: 404 })
  }

  return NextResponse.json({ email: user.email })
}
