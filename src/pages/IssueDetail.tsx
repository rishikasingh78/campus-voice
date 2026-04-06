import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Navbar from "@/components/Navbar";
import IssueCard from "@/components/IssueCard";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const IssueDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [issue, setIssue] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth");
        return;
      }
      setCurrentUserId(user.id);
      await fetchIssue();
    };
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const fetchIssue = async () => {
    if (!id) return;
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("issues")
        .select(`
          *,
          profiles:user_id (
            id,
            username,
            full_name,
            avatar_url,
            role
          ),
          likes (count),
          comments (count),
          reposts (count)
        `)
        .eq("id", id)
        .single();

      if (error) throw error;

      const { data: userLike } = await supabase
        .from("likes")
        .select("id")
        .eq("issue_id", data.id)
        .eq("user_id", currentUserId)
        .maybeSingle();

      const { data: userRepost } = await supabase
        .from("reposts")
        .select("id")
        .eq("issue_id", data.id)
        .eq("user_id", currentUserId)
        .maybeSingle();

      setIssue({
        ...data,
        isLiked: !!userLike,
        isReposted: !!userRepost,
        likesCount: data.likes[0]?.count || 0,
        commentsCount: data.comments[0]?.count || 0,
        repostsCount: data.reposts[0]?.count || 0,
      });
    } catch (err: any) {
      toast({ title: "Issue not found", description: err.message, variant: "destructive" });
      navigate("/");
    } finally {
      setLoading(false);
    }
  };

  const handleLike = async (issueId: string) => {
    if (!currentUserId) return;
    if (!issue) return;

    if (issue.isLiked) {
      await supabase.from("likes").delete().eq("issue_id", issueId).eq("user_id", currentUserId);
    } else {
      await supabase.from("likes").insert({ issue_id: issueId, user_id: currentUserId });
    }
    fetchIssue();
  };

  const handleRepost = async (issueId: string) => {
    if (!currentUserId) return;
    if (!issue) return;

    if (issue.isReposted) {
      await supabase.from("reposts").delete().eq("issue_id", issueId).eq("user_id", currentUserId);
    } else {
      await supabase.from("reposts").insert({ issue_id: issueId, user_id: currentUserId });
    }
    fetchIssue();
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container mx-auto px-4 py-6">
        {loading || !issue || !currentUserId ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <IssueCard
            issue={issue}
            currentUserId={currentUserId}
            onLike={handleLike}
            onRepost={handleRepost}
          />
        )}
      </main>
    </div>
  );
};

export default IssueDetail;
