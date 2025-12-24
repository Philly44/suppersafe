import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

interface PushMessage {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  sound?: 'default' | null;
  badge?: number;
}

interface SavedRestaurant {
  user_id: string;
  establishment_id: string;
  establishment_name: string;
}

interface PushToken {
  user_id: string;
  token: string;
}

interface Inspection {
  establishment_id: number;
  establishment_name: string;
  inspection_date: string;
  establishment_status: string;
  severity: string;
}

serve(async (req) => {
  try {
    // Verify request is authorized (use a secret or cron job)
    const authHeader = req.headers.get('Authorization');
    const expectedAuth = `Bearer ${Deno.env.get('CRON_SECRET')}`;

    // Allow service role key or cron secret
    if (authHeader !== expectedAuth && !authHeader?.includes('service_role')) {
      return new Response('Unauthorized', { status: 401 });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get inspections from the last 24 hours
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    console.log(`Checking for inspections since ${yesterdayStr}`);

    // Get recent inspections
    const { data: recentInspections, error: inspError } = await supabase
      .from('dinesafe')
      .select('establishment_id, establishment_name, inspection_date, establishment_status, severity')
      .gte('inspection_date', yesterdayStr)
      .order('inspection_date', { ascending: false });

    if (inspError) {
      console.error('Error fetching inspections:', inspError);
      throw inspError;
    }

    if (!recentInspections || recentInspections.length === 0) {
      console.log('No recent inspections found');
      return new Response(JSON.stringify({ message: 'No recent inspections' }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Get unique establishment IDs
    const establishmentIds = [...new Set(recentInspections.map((i: Inspection) => String(i.establishment_id)))];
    console.log(`Found ${establishmentIds.length} establishments with recent inspections`);

    // Find users who have saved these establishments
    const { data: savedRestaurants, error: savedError } = await supabase
      .from('saved_restaurants')
      .select('user_id, establishment_id, establishment_name')
      .in('establishment_id', establishmentIds);

    if (savedError) {
      console.error('Error fetching saved restaurants:', savedError);
      throw savedError;
    }

    if (!savedRestaurants || savedRestaurants.length === 0) {
      console.log('No users have saved these establishments');
      return new Response(JSON.stringify({ message: 'No matching saved restaurants' }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    console.log(`Found ${savedRestaurants.length} saved restaurant matches`);

    // Get push tokens for these users
    const userIds = [...new Set(savedRestaurants.map((s: SavedRestaurant) => s.user_id))];

    const { data: pushTokens, error: tokenError } = await supabase
      .from('push_tokens')
      .select('user_id, token')
      .in('user_id', userIds);

    if (tokenError) {
      console.error('Error fetching push tokens:', tokenError);
      throw tokenError;
    }

    if (!pushTokens || pushTokens.length === 0) {
      console.log('No push tokens found for users');
      return new Response(JSON.stringify({ message: 'No push tokens' }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Create a map of user_id to tokens
    const userTokenMap = new Map<string, string[]>();
    pushTokens.forEach((pt: PushToken) => {
      const tokens = userTokenMap.get(pt.user_id) || [];
      tokens.push(pt.token);
      userTokenMap.set(pt.user_id, tokens);
    });

    // Create inspection status map
    const inspectionMap = new Map<string, Inspection>();
    recentInspections.forEach((insp: Inspection) => {
      const key = String(insp.establishment_id);
      if (!inspectionMap.has(key)) {
        inspectionMap.set(key, insp);
      }
    });

    // Build notifications to send
    const notifications: PushMessage[] = [];
    const notificationLogs: { user_id: string; establishment_id: string; inspection_date: string }[] = [];

    for (const saved of savedRestaurants as SavedRestaurant[]) {
      const tokens = userTokenMap.get(saved.user_id);
      if (!tokens) continue;

      const inspection = inspectionMap.get(saved.establishment_id);
      if (!inspection) continue;

      // Check if we already sent a notification for this
      const { data: existingLog } = await supabase
        .from('notification_logs')
        .select('id')
        .eq('user_id', saved.user_id)
        .eq('establishment_id', saved.establishment_id)
        .eq('inspection_date', inspection.inspection_date)
        .maybeSingle();

      if (existingLog) {
        console.log(`Already notified user ${saved.user_id} about ${saved.establishment_name}`);
        continue;
      }

      // Build notification message
      const status = inspection.establishment_status || 'inspected';
      const hasViolations = inspection.severity && !inspection.severity.toUpperCase().startsWith('N');

      let body = `${saved.establishment_name} was just inspected.`;
      if (status === 'Pass' && !hasViolations) {
        body = `Great news! ${saved.establishment_name} passed inspection with no violations.`;
      } else if (status === 'Pass') {
        body = `${saved.establishment_name} passed inspection. Tap to see details.`;
      } else if (status === 'Conditional Pass') {
        body = `${saved.establishment_name} received a conditional pass. Tap to see why.`;
      } else if (status === 'Closed') {
        body = `Alert: ${saved.establishment_name} has been closed. Tap for details.`;
      }

      for (const token of tokens) {
        notifications.push({
          to: token,
          title: 'Restaurant Inspection Alert',
          body,
          data: {
            establishmentId: saved.establishment_id,
            establishmentName: saved.establishment_name,
          },
          sound: 'default',
        });
      }

      notificationLogs.push({
        user_id: saved.user_id,
        establishment_id: saved.establishment_id,
        inspection_date: inspection.inspection_date,
      });
    }

    if (notifications.length === 0) {
      console.log('No new notifications to send');
      return new Response(JSON.stringify({ message: 'No new notifications' }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    console.log(`Sending ${notifications.length} notifications`);

    // Send notifications via Expo Push API
    const response = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(notifications),
    });

    const result = await response.json();
    console.log('Push API response:', result);

    // Log sent notifications
    if (notificationLogs.length > 0) {
      const { error: logError } = await supabase
        .from('notification_logs')
        .insert(notificationLogs);

      if (logError) {
        console.error('Error logging notifications:', logError);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        notificationsSent: notifications.length,
        pushResult: result,
      }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
