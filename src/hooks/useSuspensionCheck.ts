import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";

interface SuspensionDetails {
  is_active: boolean;
  suspension_type: string;
  reason: string | null;
  expires_at: string | null;
}

export const useSuspensionCheck = (userId: string | undefined) => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isSuspended, setIsSuspended] = useState(false);
  const [suspensionDetails, setSuspensionDetails] = useState<SuspensionDetails | null>(null);

  useEffect(() => {
    if (!userId) return;

    const checkSuspension = async () => {
      const { data } = await supabase
        .from("user_suspensions")
        .select("*")
        .eq("user_id", userId)
        .eq("is_active", true)
        .maybeSingle();

      if (data) {
        // Check if temporary suspension has expired
        if (data.suspension_type === "temporary" && data.expires_at) {
          const expiresAt = new Date(data.expires_at);
          if (expiresAt <= new Date()) {
            // Suspension expired, deactivate it
            await supabase
              .from("user_suspensions")
              .update({ is_active: false })
              .eq("id", data.id);
            return;
          }
        }

        setIsSuspended(true);
        setSuspensionDetails(data);

        // Sign out the user
        await supabase.auth.signOut();
        
        toast({
          title: data.suspension_type === "permanent" ? "Account Banned" : "Account Suspended",
          description: data.suspension_type === "permanent" 
            ? `Your account has been permanently banned. ${data.reason ? `Reason: ${data.reason}` : ""}`
            : `Your account is suspended until ${new Date(data.expires_at!).toLocaleString()}. ${data.reason ? `Reason: ${data.reason}` : ""}`,
          variant: "destructive",
        });

        navigate("/auth");
      }
    };

    checkSuspension();
  }, [userId, navigate, toast]);

  return { isSuspended, suspensionDetails };
};
