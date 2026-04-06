import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.78.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { email, code, type, username, fullName } = await req.json();

    if (!email || !code) {
      throw new Error("Email and OTP code are required");
    }

    // Find valid OTP
    const { data: otpRecord, error: otpError } = await supabase
      .from("otp_codes")
      .select("*")
      .eq("email", email)
      .eq("code", code)
      .eq("used", false)
      .gte("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (otpError) throw otpError;

    if (!otpRecord) {
      return new Response(
        JSON.stringify({ error: "Invalid or expired OTP" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Mark OTP as used
    await supabase
      .from("otp_codes")
      .update({ used: true })
      .eq("id", otpRecord.id);

    if (type === "signup") {
      // Create user account
      const tempPassword = crypto.randomUUID();
      const { data: signUpData, error: signUpError } = await supabase.auth.admin.createUser({
        email,
        password: tempPassword,
        email_confirm: true,
        user_metadata: {
          username: username || `user_${Date.now()}`,
          full_name: fullName || "",
        },
      });

      if (signUpError) {
        if (signUpError.message.includes("already been registered") || signUpError.message.includes("already exists")) {
          return new Response(
            JSON.stringify({ error: "An account with this email already exists. Please sign in instead." }),
            { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        throw signUpError;
      }

      // Generate session token for the new user
      const { data: tokenData, error: tokenError } = await supabase.auth.admin.generateLink({
        type: "magiclink",
        email,
      });

      if (tokenError) throw tokenError;

      // Sign in with the generated token
      return new Response(
        JSON.stringify({ 
          success: true, 
          type: "signup_complete",
          message: "Account created successfully",
          email,
          password: tempPassword,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } else {
      // Sign in - generate a temporary password reset to create a session
      const { data: users } = await supabase.auth.admin.listUsers();
      const user = users.users.find(u => u.email === email);
      
      if (!user) {
        return new Response(
          JSON.stringify({ error: "No account found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Update user password to a temp one and return it for client-side sign in
      const tempPassword = crypto.randomUUID();
      const { error: updateError } = await supabase.auth.admin.updateUserById(user.id, {
        password: tempPassword,
      });

      if (updateError) throw updateError;

      return new Response(
        JSON.stringify({ 
          success: true, 
          type: "signin_complete",
          email,
          password: tempPassword,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error("Error in verify-otp:", errMsg);
    return new Response(
      JSON.stringify({ error: errMsg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
