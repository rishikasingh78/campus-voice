import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.78.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ADMIN_PASSWORD = "campus@krmuvoice";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { password, action, payload } = await req.json();

    if (password !== ADMIN_PASSWORD) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    let result: any = { success: true };

    switch (action) {
      case "delete_issue": {
        const { issue_id } = payload;
        await supabase.from("likes").delete().eq("issue_id", issue_id);
        await supabase.from("comments").delete().eq("issue_id", issue_id);
        await supabase.from("reposts").delete().eq("issue_id", issue_id);
        await supabase.from("bookmarks").delete().eq("issue_id", issue_id);
        await supabase.from("pinned_issues").delete().eq("issue_id", issue_id);
        const { error } = await supabase.from("issues").delete().eq("id", issue_id);
        if (error) throw error;
        break;
      }

      case "delete_story": {
        const { story_id } = payload;
        await supabase.from("story_likes").delete().eq("story_id", story_id);
        await supabase.from("story_views").delete().eq("story_id", story_id);
        const { error } = await supabase.from("stories").delete().eq("id", story_id);
        if (error) throw error;
        break;
      }

      case "delete_campaign": {
        const { campaign_id } = payload;
        await supabase.from("campaign_participants").delete().eq("campaign_id", campaign_id);
        const { error } = await supabase.from("campaigns").delete().eq("id", campaign_id);
        if (error) throw error;
        break;
      }

      case "delete_announcement": {
        const { announcement_id } = payload;
        const { error } = await supabase.from("announcements").delete().eq("id", announcement_id);
        if (error) throw error;
        break;
      }

      case "update_issue": {
        const { issue_id, updates } = payload;
        const { error } = await supabase.from("issues").update(updates).eq("id", issue_id);
        if (error) throw error;
        break;
      }

      case "update_announcement": {
        const { announcement_id, updates } = payload;
        const { error } = await supabase.from("announcements").update(updates).eq("id", announcement_id);
        if (error) throw error;
        break;
      }

      case "update_campaign": {
        const { campaign_id, updates } = payload;
        const { error } = await supabase.from("campaigns").update(updates).eq("id", campaign_id);
        if (error) throw error;
        break;
      }

      case "update_report": {
        const { report_id, updates } = payload;
        const { error } = await supabase.from("user_reports").update(updates).eq("id", report_id);
        if (error) throw error;
        break;
      }

      case "suspend_user": {
        const { user_id, suspension_type, reason, expires_at } = payload;
        const { error } = await supabase.from("user_suspensions").insert({
          user_id,
          suspension_type,
          reason,
          expires_at,
          suspended_by: "admin",
        });
        if (error) throw error;
        break;
      }

      case "unsuspend_user": {
        const { user_id } = payload;
        const { error } = await supabase
          .from("user_suspensions")
          .update({ is_active: false })
          .eq("user_id", user_id)
          .eq("is_active", true);
        if (error) throw error;
        break;
      }

      case "send_notifications": {
        const { notifications } = payload;
        const { error } = await supabase.from("notifications").insert(notifications);
        if (error) throw error;
        break;
      }

      case "create_announcement": {
        const { announcement } = payload;
        const { error } = await supabase.from("announcements").insert(announcement);
        if (error) throw error;
        break;
      }

      default:
        return new Response(JSON.stringify({ error: "Unknown action" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error("Admin action error:", errMsg);
    return new Response(JSON.stringify({ error: errMsg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
