import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { email, turnstileToken, referredBy } = await req.json()

    // 1. Validate email
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return new Response(
        JSON.stringify({ error: 'Invalid email format' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 2. Verify Turnstile token
    if (turnstileToken) {
      const turnstileRes = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          secret: Deno.env.get('TURNSTILE_SECRET_KEY')!,
          response: turnstileToken,
        }),
      })
      const turnstileData = await turnstileRes.json()
      if (!turnstileData.success) {
        return new Response(
          JSON.stringify({ error: 'Security check failed' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    // 3. Create Supabase client (service role for DB access)
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const normalizedEmail = email.toLowerCase()

    // 4. Check for existing user
    const { data: existingUser } = await supabaseAdmin
      .from('waitlist')
      .select('referral_code, queue_position')
      .eq('email', normalizedEmail)
      .single()

    if (existingUser) {
      // User already exists - just return their data (no magic link to avoid rate limits)
      return new Response(
        JSON.stringify({
          success: true,
          existing: true,
          referral_code: existingUser.referral_code,
          queue_position: existingUser.queue_position,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 5. Generate referral code
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    let code = 'SUPPER-'
    for (let i = 0; i < 4; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length))
    }

    // 6. Get next queue position (atomic)
    const { data: positionData } = await supabaseAdmin.rpc('get_next_queue_position')
    const queuePosition = positionData || 248

    // 7. Insert new waitlist entry
    const { error: insertError } = await supabaseAdmin
      .from('waitlist')
      .insert({
        email: normalizedEmail,
        referral_code: code,
        queue_position: queuePosition,
        referred_by: referredBy || null,
      })

    if (insertError) {
      console.error('Insert error:', insertError)
      return new Response(
        JSON.stringify({ error: 'Failed to join waitlist' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 8. Increment referrer count if applicable
    if (referredBy) {
      await supabaseAdmin.rpc('increment_referrer_count', { referrer_code: referredBy })
    }

    return new Response(
      JSON.stringify({
        success: true,
        existing: false,
        referral_code: code,
        queue_position: queuePosition,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (err) {
    console.error('Signup error:', err)
    return new Response(
      JSON.stringify({ error: 'Something went wrong' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
