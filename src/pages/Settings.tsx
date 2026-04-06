import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { useTheme } from "next-themes";
import Navbar from "@/components/Navbar";
import IssueCard from "@/components/IssueCard";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Loader2, Moon, Sun, Heart, Repeat2, Bookmark, Bell, BellRing, BellOff } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { usePushNotifications } from "@/hooks/usePushNotifications";

const Settings = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { theme, setTheme } = useTheme();
  const [user, setUser] = useState<User | null>(null);
  const [likedIssues, setLikedIssues] = useState<any[]>([]);
  const [repostedIssues, setRepostedIssues] = useState<any[]>([]);
  const [bookmarkedIssues, setBookmarkedIssues] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const { isSupported, isSubscribed, loading: pushLoading, subscribe, unsubscribe } = usePushNotifications(user?.id || null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
      if (!user) navigate("/auth");
    });
  }, [navigate]);

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);

  const fetchData = async () => {
    if (!user) return;

    try {
      setLoading(true);

      // Fetch liked issues
      const { data: likes } = await supabase
        .from("likes")
        .select(`
          issue_id,
          issues (
            *,
            profiles:user_id (id, username, full_name, avatar_url, role),
            likes (count),
            comments (count),
            reposts (count)
          )
        `)
        .eq("user_id", user.id);

      // Fetch reposted issues
      const { data: reposts } = await supabase
        .from("reposts")
        .select(`
          issue_id,
          issues (
            *,
            profiles:user_id (id, username, full_name, avatar_url, role),
            likes (count),
            comments (count),
            reposts (count)
          )
        `)
        .eq("user_id", user.id);

      // Fetch bookmarked issues
      const { data: bookmarks } = await supabase
        .from("bookmarks")
        .select(`
          issue_id,
          issues (
            *,
            profiles:user_id (id, username, full_name, avatar_url, role),
            likes (count),
            comments (count),
            reposts (count)
          )
        `)
        .eq("user_id", user.id);

      // Enrich issues with user interaction data
      const enrichIssues = async (issuesList: any[]) => {
        return Promise.all(
          issuesList.map(async (item: any) => {
            const issue = item.issues;
            if (!issue) return null;

            const { data: userLike } = await supabase
              .from("likes")
              .select("id")
              .eq("issue_id", issue.id)
              .eq("user_id", user.id)
              .maybeSingle();

            const { data: userRepost } = await supabase
              .from("reposts")
              .select("id")
              .eq("issue_id", issue.id)
              .eq("user_id", user.id)
              .maybeSingle();

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
      };

      const enrichedLikes = await enrichIssues(likes || []);
      const enrichedReposts = await enrichIssues(reposts || []);
      const enrichedBookmarks = await enrichIssues(bookmarks || []);

      setLikedIssues(enrichedLikes.filter(Boolean));
      setRepostedIssues(enrichedReposts.filter(Boolean));
      setBookmarkedIssues(enrichedBookmarks.filter(Boolean));
    } catch (error: any) {
      toast({
        title: "Error loading data",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleLike = async (issueId: string) => {
    if (!user) return;

    try {
      const issue = [...likedIssues, ...repostedIssues, ...bookmarkedIssues].find((i) => i.id === issueId);
      if (!issue) return;

      if (issue.isLiked) {
        await supabase
          .from("likes")
          .delete()
          .eq("issue_id", issueId)
          .eq("user_id", user.id);
      } else {
        await supabase.from("likes").insert({
          issue_id: issueId,
          user_id: user.id,
        });
      }

      fetchData();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleRepost = async (issueId: string) => {
    if (!user) return;

    try {
      const issue = [...likedIssues, ...repostedIssues, ...bookmarkedIssues].find((i) => i.id === issueId);
      if (!issue) return;

      if (issue.isReposted) {
        await supabase
          .from("reposts")
          .delete()
          .eq("issue_id", issueId)
          .eq("user_id", user.id);
      } else {
        await supabase.from("reposts").insert({
          issue_id: issueId,
          user_id: user.id,
        });
      }

      fetchData();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handlePushToggle = async () => {
    if (isSubscribed) {
      const success = await unsubscribe();
      if (success) {
        toast({ title: "Push notifications disabled" });
      } else {
        toast({ title: "Failed to disable notifications", variant: "destructive" });
      }
    } else {
      const success = await subscribe();
      if (success) {
        toast({ title: "Push notifications enabled!", description: "You'll receive alerts even when the site is closed." });
      } else {
        toast({ title: "Failed to enable notifications", description: "Please allow notifications in your browser.", variant: "destructive" });
      }
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar onSearchClick={() => {}} />
      
      <main className="container mx-auto px-3 md:px-4 py-4 md:py-8 max-w-4xl">
        <h1 className="text-2xl md:text-4xl font-bold mb-4 md:mb-8 bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
          Settings
        </h1>

        <Tabs defaultValue="preferences" className="space-y-4 md:space-y-6">
          <TabsList className="grid w-full grid-cols-4 rounded-xl md:rounded-2xl h-auto">
            <TabsTrigger value="preferences" className="rounded-lg md:rounded-xl text-[10px] md:text-sm py-2">Preferences</TabsTrigger>
            <TabsTrigger value="liked" className="rounded-lg md:rounded-xl text-[10px] md:text-sm py-2">Liked</TabsTrigger>
            <TabsTrigger value="reposts" className="rounded-lg md:rounded-xl text-[10px] md:text-sm py-2">Reposts</TabsTrigger>
            <TabsTrigger value="bookmarks" className="rounded-lg md:rounded-xl text-[10px] md:text-sm py-2">Bookmarks</TabsTrigger>
          </TabsList>

          <TabsContent value="preferences">
            <Card className="p-4 md:p-6 rounded-xl md:rounded-2xl space-y-4 md:space-y-6">
              <div>
                <h3 className="text-lg font-semibold mb-4">Appearance</h3>
                <div className="flex items-center justify-between p-4 rounded-xl bg-muted/30">
                  <div className="flex items-center gap-3">
                    {theme === "dark" ? (
                      <Moon className="h-5 w-5 text-primary" />
                    ) : (
                      <Sun className="h-5 w-5 text-warning" />
                    )}
                    <div>
                      <Label className="text-base">Dark Mode</Label>
                      <p className="text-sm text-muted-foreground">
                        Toggle between light and dark theme
                      </p>
                    </div>
                  </div>
                  <Switch
                    checked={theme === "dark"}
                    onCheckedChange={(checked) => setTheme(checked ? "dark" : "light")}
                  />
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold mb-4">Push Notifications</h3>
                <div className="space-y-3">
                  {/* Browser Push Notifications */}
                  <div className="flex items-center justify-between p-4 rounded-xl bg-gradient-to-r from-primary/5 to-secondary/5 border border-primary/20">
                    <div className="flex items-center gap-3">
                      {isSubscribed ? (
                        <BellRing className="h-5 w-5 text-primary" />
                      ) : (
                        <BellOff className="h-5 w-5 text-muted-foreground" />
                      )}
                      <div>
                        <Label className="text-base font-medium">Browser Push Notifications</Label>
                        <p className="text-sm text-muted-foreground">
                          {isSupported 
                            ? "Receive alerts even when the site is closed"
                            : "Push notifications are not supported in your browser"
                          }
                        </p>
                      </div>
                    </div>
                    {isSupported ? (
                      <Button
                        variant={isSubscribed ? "outline" : "default"}
                        size="sm"
                        onClick={handlePushToggle}
                        disabled={pushLoading}
                        className="min-w-[100px]"
                      >
                        {pushLoading ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : isSubscribed ? (
                          "Disable"
                        ) : (
                          "Enable"
                        )}
                      </Button>
                    ) : (
                      <span className="text-xs text-muted-foreground">Not supported</span>
                    )}
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold mb-4">In-App Notifications</h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-4 rounded-xl bg-muted/30">
                    <div>
                      <Label className="text-base">New Issues</Label>
                      <p className="text-sm text-muted-foreground">
                        Get notified about new issues
                      </p>
                    </div>
                    <Switch defaultChecked />
                  </div>
                  <div className="flex items-center justify-between p-4 rounded-xl bg-muted/30">
                    <div>
                      <Label className="text-base">Comments</Label>
                      <p className="text-sm text-muted-foreground">
                        Notifications for comments on your issues
                      </p>
                    </div>
                    <Switch defaultChecked />
                  </div>
                  <div className="flex items-center justify-between p-4 rounded-xl bg-muted/30">
                    <div>
                      <Label className="text-base">Followers</Label>
                      <p className="text-sm text-muted-foreground">
                        Get notified when someone follows you
                      </p>
                    </div>
                    <Switch defaultChecked />
                  </div>
                </div>
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="liked" className="space-y-4">
            {likedIssues.length === 0 ? (
              <Card className="p-8 text-center rounded-2xl">
                <Heart className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground">No liked issues yet</p>
              </Card>
            ) : (
              likedIssues.map((issue) => (
                <IssueCard
                  key={issue.id}
                  issue={issue}
                  onLike={handleLike}
                  onRepost={handleRepost}
                  currentUserId={user?.id || ""}
                />
              ))
            )}
          </TabsContent>

          <TabsContent value="reposts" className="space-y-4">
            {repostedIssues.length === 0 ? (
              <Card className="p-8 text-center rounded-2xl">
                <Repeat2 className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground">No reposted issues yet</p>
              </Card>
            ) : (
              repostedIssues.map((issue) => (
                <IssueCard
                  key={issue.id}
                  issue={issue}
                  onLike={handleLike}
                  onRepost={handleRepost}
                  currentUserId={user?.id || ""}
                />
              ))
            )}
          </TabsContent>

          <TabsContent value="bookmarks" className="space-y-4">
            {bookmarkedIssues.length === 0 ? (
              <Card className="p-8 text-center rounded-2xl">
                <Bookmark className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground">No bookmarked issues yet</p>
              </Card>
            ) : (
              bookmarkedIssues.map((issue) => (
                <IssueCard
                  key={issue.id}
                  issue={issue}
                  onLike={handleLike}
                  onRepost={handleRepost}
                  currentUserId={user?.id || ""}
                />
              ))
            )}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default Settings;
