import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import Navbar from "@/components/Navbar";
import IssueCard from "@/components/IssueCard";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Edit, MapPin, Calendar, Users, Heart, Repeat2, Camera } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";

const Profile = () => {
  const { username } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<any>(null);
  const [issues, setIssues] = useState<any[]>([]);
  const [followers, setFollowers] = useState<any[]>([]);
  const [following, setFollowing] = useState<any[]>([]);
  const [isFollowing, setIsFollowing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editForm, setEditForm] = useState({ full_name: "", bio: "", role: "" });
  const [uploading, setUploading] = useState(false);
  const [stats, setStats] = useState({ issuesCount: 0, followersCount: 0, followingCount: 0, likesCount: 0 });

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
      if (!user) navigate("/auth");
    });
  }, [navigate]);

  useEffect(() => {
    if (username) {
      fetchProfile();
    }
  }, [username]);

  const fetchProfile = async () => {
    try {
      setLoading(true);
      
      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .eq("username", username)
        .single();

      if (profileError) throw profileError;
      setProfile(profileData);
      setEditForm({
        full_name: profileData.full_name || "",
        bio: profileData.bio || "",
        role: profileData.role || "Student",
      });

      // Fetch user's issues
      const { data: issuesData } = await supabase
        .from("issues")
        .select(`
          *,
          profiles:user_id (id, username, full_name, avatar_url, role),
          likes (count),
          comments (count),
          reposts (count)
        `)
        .eq("user_id", profileData.id)
        .order("created_at", { ascending: false });

      const enrichedIssues = await Promise.all(
        (issuesData || []).map(async (issue: any) => {
          const { data: userLike } = await supabase
            .from("likes")
            .select("id")
            .eq("issue_id", issue.id)
            .eq("user_id", user?.id)
            .maybeSingle();

          const { data: userRepost } = await supabase
            .from("reposts")
            .select("id")
            .eq("issue_id", issue.id)
            .eq("user_id", user?.id)
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

      setIssues(enrichedIssues);

      // Fetch followers
      const { data: followersData } = await supabase
        .from("follows")
        .select("profiles:follower_id(id, username, full_name, avatar_url, role)")
        .eq("following_id", profileData.id);

      setFollowers(followersData?.map((f: any) => f.profiles) || []);

      // Fetch following
      const { data: followingData } = await supabase
        .from("follows")
        .select("profiles:following_id(id, username, full_name, avatar_url, role)")
        .eq("follower_id", profileData.id);

      setFollowing(followingData?.map((f: any) => f.profiles) || []);

      // Check if current user follows this profile
      if (user && user.id !== profileData.id) {
        const { data: followData } = await supabase
          .from("follows")
          .select("id")
          .eq("follower_id", user.id)
          .eq("following_id", profileData.id)
          .maybeSingle();

        setIsFollowing(!!followData);
      }

      // Calculate stats
      const { count: likesCount } = await supabase
        .from("likes")
        .select("*", { count: "exact", head: true })
        .eq("user_id", profileData.id);

      setStats({
        issuesCount: enrichedIssues.length,
        followersCount: followersData?.length || 0,
        followingCount: followingData?.length || 0,
        likesCount: likesCount || 0,
      });

    } catch (error: any) {
      toast({
        title: "Error loading profile",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleFollow = async () => {
    if (!user || !profile) return;

    try {
      if (isFollowing) {
        await supabase
          .from("follows")
          .delete()
          .eq("follower_id", user.id)
          .eq("following_id", profile.id);
        
        toast({ title: "Unfollowed" });
      } else {
        await supabase.from("follows").insert({
          follower_id: user.id,
          following_id: profile.id,
        });
        
        toast({ title: "Following!" });
      }

      setIsFollowing(!isFollowing);
      fetchProfile();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleUpdateProfile = async () => {
    if (!user || !profile) return;

    try {
      const { error } = await supabase
        .from("profiles")
        .update(editForm)
        .eq("id", profile.id);

      if (error) throw error;

      toast({ title: "Profile updated!" });
      setIsEditModalOpen(false);
      fetchProfile();
    } catch (error: any) {
      toast({
        title: "Error updating profile",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files[0] || !user || !profile) return;

    const file = e.target.files[0];
    setUploading(true);

    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("avatars")
        .getPublicUrl(fileName);

      const { error: updateError } = await supabase
        .from("profiles")
        .update({ avatar_url: publicUrl })
        .eq("id", profile.id);

      if (updateError) throw updateError;

      toast({ title: "Profile picture updated!" });
      fetchProfile();
    } catch (error: any) {
      toast({
        title: "Error uploading image",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const handleLike = async (issueId: string) => {
    if (!user) return;

    try {
      const issue = issues.find((i) => i.id === issueId);
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

      fetchProfile();
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
      const issue = issues.find((i) => i.id === issueId);
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

      fetchProfile();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  if (loading || !profile) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const isOwnProfile = user?.id === profile.id;

  return (
    <div className="min-h-screen bg-background">
      <Navbar onSearchClick={() => {}} />
      
      <main className="container mx-auto px-3 md:px-4 py-4 md:py-8 max-w-4xl">
        {/* Profile Header */}
        <Card className="p-4 md:p-8 rounded-2xl md:rounded-3xl shadow-soft border-border/50 mb-4 md:mb-6">
          <div className="flex flex-col items-center md:flex-row md:items-start gap-4 md:gap-6">
            <div className="relative group">
              <Avatar className="h-24 w-24 md:h-32 md:w-32 border-4 border-primary/20">
                <AvatarImage src={profile.avatar_url || undefined} />
                <AvatarFallback className="text-2xl md:text-3xl">{profile.username[0].toUpperCase()}</AvatarFallback>
              </Avatar>
              {isOwnProfile && (
                <label className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-smooth cursor-pointer">
                  <Camera className="h-6 w-6 md:h-8 md:w-8 text-white" />
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleAvatarUpload}
                    disabled={uploading}
                  />
                </label>
              )}
            </div>

            <div className="flex-1 text-center md:text-left w-full">
              <div className="flex flex-col md:flex-row items-center md:items-start justify-between mb-3 md:mb-4 gap-2">
                <div>
                  <h1 className="text-xl md:text-3xl font-bold">{profile.full_name || profile.username}</h1>
                  <p className="text-sm md:text-base text-muted-foreground">@{profile.username}</p>
                </div>
                {isOwnProfile ? (
                  <Button onClick={() => setIsEditModalOpen(true)} className="rounded-full text-sm" size="sm">
                    <Edit className="h-3.5 w-3.5 mr-1.5" />
                    Edit Profile
                  </Button>
                ) : (
                  <Button
                    onClick={handleFollow}
                    variant={isFollowing ? "outline" : "default"}
                    className="rounded-full text-sm"
                    size="sm"
                  >
                    {isFollowing ? "Unfollow" : "Follow"}
                  </Button>
                )}
              </div>

              <p className="text-sm text-muted-foreground mb-3 md:mb-4">{profile.bio || "No bio yet"}</p>

              <div className="flex flex-wrap justify-center md:justify-start gap-3 md:gap-4 text-xs md:text-sm text-muted-foreground">
                <div className="flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" />
                  <span>{profile.role || "Student"}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5" />
                  <span>Joined {formatDistanceToNow(new Date(profile.created_at))} ago</span>
                </div>
              </div>

              <div className="flex justify-center md:justify-start gap-4 md:gap-6 mt-3 md:mt-4">
                <div className="text-center">
                  <div className="text-lg md:text-2xl font-bold text-primary">{stats.issuesCount}</div>
                  <div className="text-[10px] md:text-xs text-muted-foreground">Issues</div>
                </div>
                <div className="text-center cursor-pointer hover:text-primary transition-smooth">
                  <div className="text-lg md:text-2xl font-bold text-secondary">{stats.followersCount}</div>
                  <div className="text-[10px] md:text-xs text-muted-foreground">Followers</div>
                </div>
                <div className="text-center cursor-pointer hover:text-primary transition-smooth">
                  <div className="text-lg md:text-2xl font-bold text-success">{stats.followingCount}</div>
                  <div className="text-[10px] md:text-xs text-muted-foreground">Following</div>
                </div>
                <div className="text-center">
                  <div className="text-lg md:text-2xl font-bold text-warning">{stats.likesCount}</div>
                  <div className="text-[10px] md:text-xs text-muted-foreground">Likes</div>
                </div>
              </div>
            </div>
          </div>
        </Card>

        {/* Tabs */}
        <Tabs defaultValue="issues" className="space-y-4 md:space-y-6">
          <TabsList className="grid w-full grid-cols-3 rounded-xl md:rounded-2xl">
            <TabsTrigger value="issues" className="rounded-lg md:rounded-xl text-xs md:text-sm">Issues</TabsTrigger>
            <TabsTrigger value="followers" className="rounded-lg md:rounded-xl text-xs md:text-sm">Followers</TabsTrigger>
            <TabsTrigger value="following" className="rounded-lg md:rounded-xl text-xs md:text-sm">Following</TabsTrigger>
          </TabsList>

          <TabsContent value="issues" className="space-y-4">
            {issues.length === 0 ? (
              <Card className="p-8 text-center rounded-2xl">
                <p className="text-muted-foreground">No issues posted yet</p>
              </Card>
            ) : (
              issues.map((issue) => (
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

          <TabsContent value="followers" className="space-y-4">
            {followers.length === 0 ? (
              <Card className="p-8 text-center rounded-2xl">
                <p className="text-muted-foreground">No followers yet</p>
              </Card>
            ) : (
              <div className="grid gap-4">
                {followers.map((follower: any) => (
                  <Card key={follower.id} className="p-4 rounded-2xl hover:shadow-soft transition-smooth">
                    <div className="flex items-center gap-4">
                      <Avatar className="h-12 w-12">
                        <AvatarImage src={follower.avatar_url || undefined} />
                        <AvatarFallback>{follower.username[0].toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <p className="font-semibold">{follower.full_name || follower.username}</p>
                        <p className="text-sm text-muted-foreground">@{follower.username}</p>
                      </div>
                      <Button
                        variant="outline"
                        className="rounded-full"
                        onClick={() => navigate(`/profile/${follower.username}`)}
                      >
                        View Profile
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="following" className="space-y-4">
            {following.length === 0 ? (
              <Card className="p-8 text-center rounded-2xl">
                <p className="text-muted-foreground">Not following anyone yet</p>
              </Card>
            ) : (
              <div className="grid gap-4">
                {following.map((followedUser: any) => (
                  <Card key={followedUser.id} className="p-4 rounded-2xl hover:shadow-soft transition-smooth">
                    <div className="flex items-center gap-4">
                      <Avatar className="h-12 w-12">
                        <AvatarImage src={followedUser.avatar_url || undefined} />
                        <AvatarFallback>{followedUser.username[0].toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <p className="font-semibold">{followedUser.full_name || followedUser.username}</p>
                        <p className="text-sm text-muted-foreground">@{followedUser.username}</p>
                      </div>
                      <Button
                        variant="outline"
                        className="rounded-full"
                        onClick={() => navigate(`/profile/${followedUser.username}`)}
                      >
                        View Profile
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </main>

      {/* Edit Profile Modal */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="rounded-3xl max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Profile</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Full Name</Label>
              <Input
                value={editForm.full_name}
                onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })}
                className="rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Input
                value={editForm.role}
                onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
                className="rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <Label>Bio</Label>
              <Textarea
                value={editForm.bio}
                onChange={(e) => setEditForm({ ...editForm, bio: e.target.value })}
                rows={4}
                className="rounded-xl"
              />
            </div>
            <div className="flex gap-3 pt-4">
              <Button variant="outline" onClick={() => setIsEditModalOpen(false)} className="flex-1 rounded-full">
                Cancel
              </Button>
              <Button onClick={handleUpdateProfile} className="flex-1 rounded-full gradient-primary">
                Save Changes
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Profile;