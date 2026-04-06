import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User, Session } from "@supabase/supabase-js";
import Navbar from "@/components/Navbar";
import MobileBottomNav from "@/components/MobileBottomNav";
import IssueCard from "@/components/IssueCard";
import TrendingSidebar from "@/components/TrendingSidebar";
import CreateIssueModal from "@/components/CreateIssueModal";
import FilterBar from "@/components/FilterBar";
import SearchUsersModal from "@/components/SearchUsersModal";
import CampaignsSection from "@/components/CampaignsSection";
import StoriesSection from "@/components/StoriesSection";
import AnnouncementBanner from "@/components/AnnouncementBanner";
import { Button } from "@/components/ui/button";
import { Plus, Loader2, Sparkles } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useSuspensionCheck } from "@/hooks/useSuspensionCheck";

const Index = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [issues, setIssues] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState("home");
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [searchParams] = useSearchParams();

  useSuspensionCheck(user?.id);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (!session) navigate("/auth");
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (!session) navigate("/auth");
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  useEffect(() => {
    if (user) fetchIssues();
  }, [user, selectedFilter, selectedTag]);

  const fetchIssues = async () => {
    try {
      setLoading(true);
      let query = supabase
        .from("issues")
        .select(`
          *,
          profiles:user_id (id, username, full_name, avatar_url, role),
          likes (count),
          comments (count),
          reposts (count)
        `)
        .order("created_at", { ascending: false });

      const { data, error } = await query;
      if (error) throw error;

      const enrichedIssues = await Promise.all(
        (data || []).map(async (issue: any) => {
          const { data: userLike } = await supabase
            .from("likes").select("id").eq("issue_id", issue.id).eq("user_id", user?.id).maybeSingle();
          const { data: userRepost } = await supabase
            .from("reposts").select("id").eq("issue_id", issue.id).eq("user_id", user?.id).maybeSingle();

          return {
            ...issue,
            isLiked: !!userLike,
            isReposted: !!userRepost,
            likesCount: issue.likes[0]?.count || 0,
            commentsCount: issue.comments[0]?.count || 0,
            repostsCount: issue.reposts[0]?.count || 0,
          };
        })
      );

      const now = new Date().getTime();
      let finalIssues = enrichedIssues;

      switch (selectedFilter) {
        case "trending":
          finalIssues = enrichedIssues.filter((i: any) => i.likesCount > 5).sort((a: any, b: any) => b.likesCount - a.likesCount);
          break;
        case "recent":
          finalIssues = enrichedIssues.filter((i: any) => now - new Date(i.created_at).getTime() <= 24 * 60 * 60 * 1000)
            .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
          break;
        case "discussed":
          finalIssues = enrichedIssues.filter((i: any) => i.commentsCount > 5).sort((a: any, b: any) => b.commentsCount - a.commentsCount);
          break;
        case "hot":
          finalIssues = enrichedIssues.filter((i: any) => i.likesCount > 5)
            .sort((a: any, b: any) => (b.likesCount + b.commentsCount) - (a.likesCount + a.commentsCount));
          break;
        default:
          finalIssues = enrichedIssues;
      }

      if (selectedTag) {
        finalIssues = finalIssues.filter((i: any) => (i.tags || []).includes(selectedTag));
      }

      setIssues(finalIssues);
    } catch (error: any) {
      toast({ title: "Something went wrong", description: "Could not load issues. Please try again.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const tag = searchParams.get("tag");
    setSelectedTag(tag);
  }, [searchParams]);

  const handleLike = async (issueId: string) => {
    if (!user) return;
    try {
      const issue = issues.find((i) => i.id === issueId);
      if (!issue) return;
      if (issue.isLiked) {
        await supabase.from("likes").delete().eq("issue_id", issueId).eq("user_id", user.id);
      } else {
        await supabase.from("likes").insert({ issue_id: issueId, user_id: user.id });
      }
      fetchIssues();
    } catch (error: any) {
      toast({ title: "Error", description: "Something went wrong. Try again.", variant: "destructive" });
    }
  };

  const handleRepost = async (issueId: string) => {
    if (!user) return;
    try {
      const issue = issues.find((i) => i.id === issueId);
      if (!issue) return;
      if (issue.isReposted) {
        await supabase.from("reposts").delete().eq("issue_id", issueId).eq("user_id", user.id);
        toast({ title: "Repost removed" });
      } else {
        await supabase.from("reposts").insert({ issue_id: issueId, user_id: user.id });
        toast({ title: "Reposted!", description: "Issue shared to your followers" });
      }
      fetchIssues();
    } catch (error: any) {
      toast({ title: "Error", description: "Something went wrong. Try again.", variant: "destructive" });
    }
  };

  const handleCreateIssue = async (newIssue: any) => {
    if (!user) return;
    try {
      const { error } = await supabase.from("issues").insert({
        user_id: user.id,
        title: newIssue.title,
        description: newIssue.description,
        tags: newIssue.tags,
        image_url: newIssue.image_url,
        is_anonymous: newIssue.isAnonymous,
      });
      if (error) throw error;
      toast({ title: "Issue created!", description: "Your issue has been posted to the community" });
      fetchIssues();
    } catch (error: any) {
      toast({ title: "Could not create issue", description: "Please check your input and try again.", variant: "destructive" });
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar onSearchClick={() => setIsSearchModalOpen(true)} />
      
      <main className="container mx-auto px-3 md:px-4 pt-3 pb-20 sm:pb-6 md:py-8">
        <div className="flex flex-col lg:flex-row gap-4 md:gap-8">
          <div className="flex-1 space-y-3 md:space-y-5 max-w-2xl mx-auto w-full lg:max-w-none lg:mx-0">
            <AnnouncementBanner />

            {/* Hero - compact on mobile, expanded on desktop */}
            <div className="relative overflow-hidden rounded-2xl md:rounded-3xl gradient-hero border border-border/30">
              <div className="p-4 md:p-8 lg:p-10">
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles className="h-4 w-4 md:h-5 md:w-5 text-primary" />
                  <span className="text-[10px] md:text-xs font-semibold uppercase tracking-wider text-primary">Campus Voice</span>
                </div>
                <h1 className="text-xl md:text-3xl lg:text-4xl font-bold mb-1.5 md:mb-3 bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent leading-tight">
                  Your Voice, Your Campus
                </h1>
                <p className="text-xs md:text-sm text-muted-foreground mb-3 md:mb-5 max-w-lg leading-relaxed">
                  Post issues, discuss solutions, and drive real change together.
                </p>
                <Button 
                  onClick={() => setIsCreateModalOpen(true)}
                  size="sm"
                  className="gradient-primary shadow-glow hover:shadow-large transition-smooth text-xs md:text-sm h-8 md:h-10 px-4 md:px-5 rounded-full"
                >
                  <Plus className="mr-1.5 h-3.5 w-3.5 md:h-4 md:w-4" />
                  Create Issue
                </Button>
              </div>
            </div>

            <StoriesSection currentUserId={user.id} />

            <FilterBar selectedFilter={selectedFilter} onFilterChange={setSelectedFilter} />

            {selectedTag && (
              <div className="flex items-center gap-2 animate-fade-in flex-wrap">
                <span className="text-xs text-muted-foreground">Filtering by:</span>
                <span className="text-xs font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-full">#{selectedTag}</span>
                <Button variant="ghost" size="sm" onClick={() => navigate("/")} className="h-6 text-[10px] rounded-full">Clear</Button>
              </div>
            )}

            {selectedFilter === "campaigns" ? (
              <CampaignsSection currentUserId={user.id} />
            ) : loading ? (
              <div className="flex items-center justify-center py-16">
                <div className="flex flex-col items-center gap-3">
                  <Loader2 className="h-7 w-7 animate-spin text-primary" />
                  <span className="text-xs text-muted-foreground">Loading issues...</span>
                </div>
              </div>
            ) : issues.length === 0 ? (
              <div className="text-center py-16">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
                  <Plus className="h-7 w-7 text-muted-foreground" />
                </div>
                <p className="text-muted-foreground text-sm md:text-base font-medium">No issues yet</p>
                <p className="text-muted-foreground text-xs mt-1">Be the first to post!</p>
              </div>
            ) : (
              <div className="space-y-3">
                {issues.map((issue) => (
                  <IssueCard
                    key={issue.id}
                    issue={issue}
                    onLike={handleLike}
                    onRepost={handleRepost}
                    currentUserId={user.id}
                  />
                ))}
              </div>
            )}
          </div>

          <aside className="hidden lg:block lg:w-80 sticky top-20 self-start">
            <TrendingSidebar />
          </aside>
        </div>
      </main>

      <CreateIssueModal isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} onSubmit={handleCreateIssue} />
      <SearchUsersModal isOpen={isSearchModalOpen} onClose={() => setIsSearchModalOpen(false)} />

      {/* FAB for mobile */}
      <Button
        onClick={() => setIsCreateModalOpen(true)}
        size="lg"
        className="sm:hidden fixed bottom-[4.5rem] right-4 rounded-full h-12 w-12 p-0 gradient-primary shadow-large hover:shadow-glow transition-smooth z-40"
      >
        <Plus className="h-5 w-5" />
      </Button>

      <MobileBottomNav onSearchClick={() => setIsSearchModalOpen(true)} />
    </div>
  );
};

export default Index;
