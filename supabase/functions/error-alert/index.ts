import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const ALERT_EMAIL = "a_subryan@hotmail.com";

// Rate limiting: max 10 emails per hour per error type
const recentErrors = new Map<string, number[]>();
const RATE_LIMIT = 10;
const RATE_WINDOW = 60 * 60 * 1000; // 1 hour

function isRateLimited(errorKey: string): boolean {
  const now = Date.now();
  const timestamps = recentErrors.get(errorKey) || [];

  // Clean old timestamps
  const recent = timestamps.filter(t => now - t < RATE_WINDOW);
  recentErrors.set(errorKey, recent);

  if (recent.length >= RATE_LIMIT) {
    return true;
  }

  recent.push(now);
  return false;
}

Deno.serve(async (req: Request) => {
  // CORS headers
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { error, context, url, userAgent, timestamp } = await req.json();

    if (!error) {
      return new Response(
        JSON.stringify({ error: "Missing error details" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create error key for rate limiting
    const errorKey = `${error.message || "unknown"}-${error.stack?.slice(0, 100) || ""}`;

    if (isRateLimited(errorKey)) {
      return new Response(
        JSON.stringify({ message: "Rate limited - too many similar errors" }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Format email content
    const subject = `[SupperSafe Alert] ${error.type || "Error"}: ${error.message?.slice(0, 50) || "Unknown error"}`;

    const html = `
      <h2 style="color: #B45A3C;">SupperSafe Error Alert</h2>

      <h3>Error Details</h3>
      <table style="border-collapse: collapse; width: 100%;">
        <tr>
          <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Type</td>
          <td style="padding: 8px; border: 1px solid #ddd;">${error.type || "JavaScript Error"}</td>
        </tr>
        <tr>
          <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Message</td>
          <td style="padding: 8px; border: 1px solid #ddd;">${error.message || "No message"}</td>
        </tr>
        <tr>
          <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">URL</td>
          <td style="padding: 8px; border: 1px solid #ddd;">${url || "Unknown"}</td>
        </tr>
        <tr>
          <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Timestamp</td>
          <td style="padding: 8px; border: 1px solid #ddd;">${timestamp || new Date().toISOString()}</td>
        </tr>
        <tr>
          <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Context</td>
          <td style="padding: 8px; border: 1px solid #ddd;">${context || "None"}</td>
        </tr>
        <tr>
          <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">User Agent</td>
          <td style="padding: 8px; border: 1px solid #ddd; font-size: 12px;">${userAgent || "Unknown"}</td>
        </tr>
      </table>

      ${error.stack ? `
        <h3>Stack Trace</h3>
        <pre style="background: #f5f5f5; padding: 12px; overflow-x: auto; font-size: 12px;">${error.stack}</pre>
      ` : ""}

      <hr style="margin: 20px 0; border: none; border-top: 1px solid #ddd;">
      <p style="color: #666; font-size: 12px;">This is an automated alert from SupperSafe error monitoring.</p>
    `;

    // Send email via Resend
    if (!RESEND_API_KEY) {
      console.error("RESEND_API_KEY not configured");
      return new Response(
        JSON.stringify({ error: "Email service not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "SupperSafe Alerts <alerts@suppersafe.com>",
        to: [ALERT_EMAIL],
        subject: subject,
        html: html,
      }),
    });

    if (!emailResponse.ok) {
      const errorText = await emailResponse.text();
      console.error("Resend error:", errorText);
      return new Response(
        JSON.stringify({ error: "Failed to send email" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ message: "Alert sent successfully" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (e) {
    console.error("Error alert function failed:", e);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
