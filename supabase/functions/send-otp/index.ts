import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.78.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function buildOtpEmail(otp: string, username: string, avatarUrl: string): string {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>THRYLOS OTP</title>
</head>
<body style="margin:0; padding:0; background:#ffffff; font-family:Arial, Helvetica, sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" bgcolor="#ffffff">
<tr>
<td align="center" style="padding:30px 10px;">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;border:1px solid #d1d5db;border-radius:12px;overflow:hidden;">
<tr>
<td align="center" bgcolor="#f3f4f6" style="padding:18px;">
<img src="https://github.com/user-attachments/assets/160c433a-e006-42ee-8923-f6360223e116" alt="THRYLOS Logo" width="120" style="display:block;">
</td>
</tr>
<tr>
<td align="center" style="padding-top:30px;">
<img src="${avatarUrl}" alt="User Profile Picture" width="80" style="display:block;border-radius:50%;">
</td>
</tr>
<tr>
<td align="center" style="padding:20px 20px 10px 20px;">
<h1 style="font-size:32px; margin:0; font-weight:800;">Welcome back ${username}!</h1>
</td>
</tr>
<tr>
<td align="center">
<table width="90%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;border-radius:16px;padding:20px;">
<tr>
<td style="font-size:16px;color:#555;padding:12px 16px 4px 16px;">Logging in to</td>
</tr>
<tr>
<td style="padding:4px 16px 12px 16px;">
<table width="100%">
<tr>
<td style="font-size:16px;font-weight:bold;">THRYLOS</td>
<td align="right">
<img src="https://github.com/user-attachments/assets/eea77779-ee10-4d58-bf62-e374dff4a6ab" width="44" style="display:block;border-radius:6px;">
</td>
</tr>
</table>
</td>
</tr>
<tr>
<td style="border-top:1px solid #ddd;padding-top:12px;"></td>
</tr>
<tr>
<td style="font-size:16px;color:#555;padding:4px 16px;">From</td>
</tr>
<tr>
<td style="padding:4px 16px 12px 16px;">
<table width="100%">
<tr>
<td style="font-size:16px;font-weight:bold;">India</td>
<td align="right">
<img src="https://github.com/user-attachments/assets/3738239c-dc89-4d91-b96d-c845c2adcf64" width="35" style="display:block;border-radius:6px;">
</td>
</tr>
</table>
</td>
</tr>
</table>
</td>
</tr>
<tr>
<td align="center" style="padding:30px 40px 10px 40px;font-size:16px;color:#444;">
If you requested to log in to your THRYLOS ID, use the code below.
</td>
</tr>
<tr>
<td align="center" style="padding:10px 0 20px 0;">
<div style="background:#4f7cff;color:#fff;font-size:32px;font-weight:bold;padding:18px 36px;border-radius:14px;display:inline-block;letter-spacing:4px;">
${otp}
</div>
</td>
</tr>
<tr>
<td align="center" style="padding:0 40px 40px 40px;font-size:14px;color:#666;">
If you didn't request to log in to your THRYLOS ID, you can safely ignore this email.
</td>
</tr>
<tr>
<td bgcolor="#000000" style="padding:20px;">
<table width="100%">
<tr>
<td style="color:#ffffff;font-size:14px;">&copy; 2026 THRYLOS. All rights reserved.</td>
<td align="right">
<img src="https://github.com/user-attachments/assets/160c433a-e006-42ee-8923-f6360223e116" width="90">
</td>
</tr>
</table>
</td>
</tr>
</table>
</td>
</tr>
</table>
</body>
</html>`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const brevoApiKey = Deno.env.get("BREVO_API_KEY");
    if (!brevoApiKey) {
      throw new Error("BREVO_API_KEY is not configured");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { email, type } = await req.json();

    if (!email) {
      throw new Error("Email is required");
    }

    let username = "User";
    let avatarUrl = `https://api.dicebear.com/7.x/avataaars/svg?seed=${email}`;

    if (type === "signin") {
      // Check if user exists
      const { data: profile } = await supabase
        .from("profiles")
        .select("username, avatar_url")
        .eq("id", (await supabase.auth.admin.listUsers()).data.users.find(u => u.email === email)?.id || "")
        .maybeSingle();

      if (!profile) {
        return new Response(
          JSON.stringify({ error: "No account found with this email" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      username = profile.username || "User";
      avatarUrl = profile.avatar_url || avatarUrl;
    }

    const otp = generateOTP();

    // Invalidate previous unused OTPs for this email
    await supabase
      .from("otp_codes")
      .update({ used: true })
      .eq("email", email)
      .eq("used", false);

    // Store new OTP
    const { error: insertError } = await supabase
      .from("otp_codes")
      .insert({ email, code: otp });

    if (insertError) throw insertError;

    // Send email via Brevo
    const brevoRes = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "accept": "application/json",
        "api-key": brevoApiKey,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        sender: { name: "THRYLOS", email: "noreply@thrylosindia.in" },
        to: [{ email }],
        subject: `Your Verification Code for Campus Voice Login`,
        htmlContent: buildOtpEmail(otp, username, avatarUrl),
      }),
    });

    if (!brevoRes.ok) {
      const errBody = await brevoRes.text();
      console.error("Brevo API error:", errBody);
      throw new Error(`Failed to send email: ${brevoRes.status}`);
    }

    return new Response(
      JSON.stringify({ success: true, message: "OTP sent successfully" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error("Error in send-otp:", errMsg);
    return new Response(
      JSON.stringify({ error: errMsg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
