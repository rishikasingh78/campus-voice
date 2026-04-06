import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Plus, Heart, Eye, X, Loader2, Image as ImageIcon, ChevronLeft, ChevronRight, Trash2, Pause, Play } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ScrollArea } from "@/components/ui/scroll-area";
import { motion, AnimatePresence } from "framer-motion";

interface Story {
  id: string;
  user_id: string;
  image_url: string;
  caption: string | null;
  created_at: string;
  expires_at: string;
  profiles: {
    id: string;
    username: string;
    full_name: string | null;
    avatar_url: string | null;
  };
  likesCount: number;
  viewsCount: number;
  isLiked: boolean;
}

interface StoryGroup {
  user_id: string;
  profile: {
    id: string;
    username: string;
    full_name: string | null;
    avatar_url: string | null;
  };
  stories: Story[];
  hasUnviewed: boolean;
}

interface StoriesSectionProps {
  currentUserId: string;
}

const STORY_DURATION = 5000; // 5 seconds per story

const StoriesSection = ({ currentUserId }: StoriesSectionProps) => {
  const { toast } = useToast();
  const [storyGroups, setStoryGroups] = useState<StoryGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isViewerOpen, setIsViewerOpen] = useState(false);
  const [currentGroupIndex, setCurrentGroupIndex] = useState(0);
  const [currentStoryIndex, setCurrentStoryIndex] = useState(0);
  const [viewersModalOpen, setViewersModalOpen] = useState(false);
  const [storyViewers, setStoryViewers] = useState<any[]>([]);
  const [storyLikers, setStoryLikers] = useState<any[]>([]);
  const [newStory, setNewStory] = useState({ image_url: "", caption: "" });
  const [uploading, setUploading] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [progress, setProgress] = useState(0);
  const progressInterval = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    fetchStories();
  }, [currentUserId]);

  // Auto-advance story with progress
  useEffect(() => {
    if (isViewerOpen && !isPaused) {
      progressInterval.current = setInterval(() => {
        setProgress(prev => {
          if (prev >= 100) {
            nextStory();
            return 0;
          }
          return prev + (100 / (STORY_DURATION / 100));
        });
      }, 100);
    }

    return () => {
      if (progressInterval.current) {
        clearInterval(progressInterval.current);
      }
    };
  }, [isViewerOpen, isPaused, currentGroupIndex, currentStoryIndex]);

  // Reset progress when story changes
  useEffect(() => {
    setProgress(0);
  }, [currentGroupIndex, currentStoryIndex]);

  const fetchStories = async () => {
    try {
      setLoading(true);
      
      // Get stories from users I follow
      const { data: followingData } = await supabase
        .from("follows")
        .select("following_id")
        .eq("follower_id", currentUserId);

      const followingIds = followingData?.map(f => f.following_id) || [];

      // Fetch my own stories directly
      const { data: ownStories, error: ownError } = await supabase
        .from("stories")
        .select("*")
        .eq("user_id", currentUserId)
        .gt("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false });

      if (ownError) console.error("Own stories error:", ownError);

      // Fetch followed users' stories
      let followedStories: any[] = [];
      if (followingIds.length > 0) {
        const { data, error } = await supabase
          .from("stories")
          .select("*")
          .in("user_id", followingIds)
          .gt("expires_at", new Date().toISOString())
          .order("created_at", { ascending: false });

        if (error) console.error("Followed stories error:", error);
        followedStories = data || [];
      }

      const allStoriesRaw = [...(ownStories || []), ...followedStories];
      
      if (allStoriesRaw.length === 0) {
        setStoryGroups([]);
        setLoading(false);
        return;
      }

      // Fetch profile data separately
      const userIds = [...new Set(allStoriesRaw.map(s => s.user_id))];
      
      const { data: profilesData } = await supabase
        .from("profiles")
        .select("id, username, full_name, avatar_url")
        .in("id", userIds);

      const profilesMap = (profilesData || []).reduce((acc: any, p: any) => {
        acc[p.id] = p;
        return acc;
      }, {});

      // Fetch counts separately for each story
      const enrichedStories = await Promise.all(
        allStoriesRaw.map(async (story: any) => {
          const [{ count: likesCount }, { count: viewsCount }, { data: userLike }] = await Promise.all([
            supabase.from("story_likes").select("*", { count: "exact", head: true }).eq("story_id", story.id),
            supabase.from("story_views").select("*", { count: "exact", head: true }).eq("story_id", story.id),
            supabase.from("story_likes").select("id").eq("story_id", story.id).eq("user_id", currentUserId).maybeSingle()
          ]);

          return {
            ...story,
            profiles: profilesMap[story.user_id] || { id: story.user_id, username: "Unknown", full_name: null, avatar_url: null },
            likesCount: likesCount || 0,
            viewsCount: viewsCount || 0,
            isLiked: !!userLike,
          };
        })
      );

      // Group stories by user
      const groups: Record<string, StoryGroup> = {};
      enrichedStories.forEach((story: any) => {
        if (!groups[story.user_id]) {
          groups[story.user_id] = {
            user_id: story.user_id,
            profile: story.profiles,
            stories: [],
            hasUnviewed: false,
          };
        }
        groups[story.user_id].stories.push(story);
      });

      // Sort: current user first, then others
      const sortedGroups = Object.values(groups).sort((a, b) => {
        if (a.user_id === currentUserId) return -1;
        if (b.user_id === currentUserId) return 1;
        return 0;
      });

      setStoryGroups(sortedGroups);
    } catch (error: any) {
      console.error("Error fetching stories:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${currentUserId}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("stories")
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("stories")
        .getPublicUrl(fileName);

      setNewStory(prev => ({ ...prev, image_url: publicUrl }));
    } catch (error: any) {
      toast({ title: "Upload failed", description: error.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const handleCreateStory = async () => {
    if (!newStory.image_url) {
      toast({ title: "Please add an image", variant: "destructive" });
      return;
    }

    try {
      const { error } = await supabase.from("stories").insert({
        user_id: currentUserId,
        image_url: newStory.image_url,
        caption: newStory.caption || null,
      });

      if (error) throw error;

      toast({ title: "Story posted!", description: "Your story is now visible to followers." });
      setNewStory({ image_url: "", caption: "" });
      setIsCreateModalOpen(false);
      fetchStories();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const handleDeleteStory = async (storyId: string) => {
    try {
      const { error } = await supabase.rpc("delete_story_cascade", { story_id_param: storyId });
      if (error) throw error;
      toast({ title: "Story deleted" });
      setIsViewerOpen(false);
      fetchStories();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const openStoryViewer = async (groupIndex: number) => {
    setCurrentGroupIndex(groupIndex);
    setCurrentStoryIndex(0);
    setProgress(0);
    setIsPaused(false);
    setIsViewerOpen(true);
    
    // Record view
    const story = storyGroups[groupIndex].stories[0];
    if (story.user_id !== currentUserId) {
      try {
        await supabase.from("story_views").upsert({
          story_id: story.id,
          viewer_id: currentUserId,
        }, { onConflict: "story_id,viewer_id" });
      } catch (e) {
        console.error("Error recording view:", e);
      }
    }
  };

  const handleLikeStory = async () => {
    const story = storyGroups[currentGroupIndex]?.stories[currentStoryIndex];
    if (!story) return;

    setIsPaused(true);
    try {
      if (story.isLiked) {
        await supabase
          .from("story_likes")
          .delete()
          .eq("story_id", story.id)
          .eq("user_id", currentUserId);
      } else {
        await supabase.from("story_likes").insert({
          story_id: story.id,
          user_id: currentUserId,
        });
      }
      
      // Update local state
      setStoryGroups(prev => prev.map((group, gIdx) => {
        if (gIdx === currentGroupIndex) {
          return {
            ...group,
            stories: group.stories.map((s, sIdx) => {
              if (sIdx === currentStoryIndex) {
                return {
                  ...s,
                  isLiked: !s.isLiked,
                  likesCount: s.isLiked ? s.likesCount - 1 : s.likesCount + 1,
                };
              }
              return s;
            }),
          };
        }
        return group;
      }));
    } catch (error: any) {
      console.error("Error liking story:", error);
    }
    setIsPaused(false);
  };

  const nextStory = async () => {
    const currentGroup = storyGroups[currentGroupIndex];
    if (!currentGroup) {
      setIsViewerOpen(false);
      return;
    }
    
    if (currentStoryIndex < currentGroup.stories.length - 1) {
      const nextIndex = currentStoryIndex + 1;
      setCurrentStoryIndex(nextIndex);
      
      // Record view
      const story = currentGroup.stories[nextIndex];
      if (story.user_id !== currentUserId) {
        try {
          await supabase.from("story_views").upsert({
            story_id: story.id,
            viewer_id: currentUserId,
          }, { onConflict: "story_id,viewer_id" });
        } catch (e) {
          console.error("Error recording view:", e);
        }
      }
    } else if (currentGroupIndex < storyGroups.length - 1) {
      const nextGroupIndex = currentGroupIndex + 1;
      setCurrentGroupIndex(nextGroupIndex);
      setCurrentStoryIndex(0);
      
      // Record view
      const story = storyGroups[nextGroupIndex].stories[0];
      if (story.user_id !== currentUserId) {
        try {
          await supabase.from("story_views").upsert({
            story_id: story.id,
            viewer_id: currentUserId,
          }, { onConflict: "story_id,viewer_id" });
        } catch (e) {
          console.error("Error recording view:", e);
        }
      }
    } else {
      setIsViewerOpen(false);
    }
  };

  const prevStory = () => {
    if (currentStoryIndex > 0) {
      setCurrentStoryIndex(currentStoryIndex - 1);
    } else if (currentGroupIndex > 0) {
      setCurrentGroupIndex(currentGroupIndex - 1);
      setCurrentStoryIndex(storyGroups[currentGroupIndex - 1].stories.length - 1);
    }
  };

  const fetchStoryViewersAndLikers = async (storyId: string) => {
    setIsPaused(true);
    try {
      const { data: viewsData } = await supabase
        .from("story_views")
        .select("id, viewed_at, viewer_id")
        .eq("story_id", storyId);

      const viewerIds = viewsData?.map(v => v.viewer_id) || [];
      let viewersWithProfiles: any[] = [];
      
      if (viewerIds.length > 0) {
        const { data: viewerProfiles } = await supabase
          .from("profiles")
          .select("id, username, full_name, avatar_url")
          .in("id", viewerIds);

        viewersWithProfiles = (viewsData || []).map(v => ({
          ...v,
          profiles: viewerProfiles?.find(p => p.id === v.viewer_id)
        }));
      }

      const { data: likesData } = await supabase
        .from("story_likes")
        .select("id, created_at, user_id")
        .eq("story_id", storyId);

      const likerIds = likesData?.map(l => l.user_id) || [];
      let likersWithProfiles: any[] = [];
      
      if (likerIds.length > 0) {
        const { data: likerProfiles } = await supabase
          .from("profiles")
          .select("id, username, full_name, avatar_url")
          .in("id", likerIds);

        likersWithProfiles = (likesData || []).map(l => ({
          ...l,
          profiles: likerProfiles?.find(p => p.id === l.user_id)
        }));
      }

      setStoryViewers(viewersWithProfiles);
      setStoryLikers(likersWithProfiles);
      setViewersModalOpen(true);
    } catch (error) {
      console.error("Error fetching story insights:", error);
    }
  };

  const currentStory = storyGroups[currentGroupIndex]?.stories[currentStoryIndex];

  if (loading) {
    return (
      <div className="flex items-center gap-4 p-4 overflow-x-auto">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="flex-shrink-0 w-20 h-20 rounded-full bg-muted animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <>
      {/* Stories Row - Instagram Style */}
      <div className="bg-card/50 backdrop-blur-sm rounded-xl md:rounded-2xl p-3 md:p-4 mb-4 md:mb-6 border border-border/40">
        <div className="flex items-center gap-3 md:gap-4 overflow-x-auto pb-2 scrollbar-hide">
          {/* Add Story Button */}
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setIsCreateModalOpen(true)}
            className="flex-shrink-0 flex flex-col items-center gap-1 md:gap-2 group"
          >
            <div className="relative">
              <div className="w-16 h-16 md:w-20 md:h-20 rounded-full bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center border-2 border-dashed border-primary/50 group-hover:border-primary transition-all duration-300">
                <Plus className="h-6 w-6 md:h-7 md:w-7 text-primary" />
              </div>
            </div>
            <span className="text-[10px] md:text-xs text-muted-foreground font-medium">Your Story</span>
          </motion.button>

          {/* Story Groups */}
          {storyGroups.map((group, index) => (
            <motion.button
              key={group.user_id}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => openStoryViewer(index)}
              className="flex-shrink-0 flex flex-col items-center gap-1 md:gap-2 group"
            >
              <div className="relative">
                <div className={`w-16 h-16 md:w-20 md:h-20 rounded-full p-[3px] ${
                  group.user_id === currentUserId 
                    ? "bg-gradient-to-br from-primary to-secondary" 
                    : "bg-gradient-to-tr from-yellow-400 via-pink-500 to-purple-600"
                }`}>
                  <div className="w-full h-full rounded-full p-[2px] bg-background">
                    <Avatar className="w-full h-full">
                      <AvatarImage src={group.profile.avatar_url || undefined} className="object-cover" />
                      <AvatarFallback className="text-sm md:text-base font-semibold bg-gradient-to-br from-primary/20 to-secondary/20">
                        {group.profile.username[0].toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                  </div>
                </div>
                {group.stories.length > 1 && (
                  <span className="absolute -bottom-1 -right-1 bg-primary text-primary-foreground text-[9px] md:text-[10px] w-5 h-5 md:w-6 md:h-6 rounded-full flex items-center justify-center font-bold shadow-lg">
                    {group.stories.length}
                  </span>
                )}
              </div>
              <span className="text-[10px] md:text-xs text-muted-foreground truncate w-16 md:w-20 text-center font-medium">
                {group.user_id === currentUserId ? "Your Story" : group.profile.username}
              </span>
            </motion.button>
          ))}
          
          {storyGroups.length === 0 && (
            <p className="text-xs md:text-sm text-muted-foreground py-4 px-2">No stories yet. Follow people to see their stories!</p>
          )}
        </div>
      </div>

      {/* Create Story Modal */}
      <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle>Create Story</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Image</Label>
              {newStory.image_url ? (
                <div className="relative">
                  <img src={newStory.image_url} alt="Story preview" className="w-full h-64 object-cover rounded-lg" />
                  <Button
                    variant="destructive"
                    size="icon"
                    className="absolute top-2 right-2"
                    onClick={() => setNewStory(prev => ({ ...prev, image_url: "" }))}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center w-full h-64 border-2 border-dashed border-border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors">
                  {uploading ? (
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  ) : (
                    <>
                      <ImageIcon className="h-8 w-8 text-muted-foreground mb-2" />
                      <span className="text-sm text-muted-foreground">Click to upload image</span>
                    </>
                  )}
                  <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                </label>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="caption">Caption (optional)</Label>
              <Textarea
                id="caption"
                placeholder="Add a caption..."
                value={newStory.caption}
                onChange={(e) => setNewStory(prev => ({ ...prev, caption: e.target.value }))}
                rows={2}
              />
            </div>
            <Button onClick={handleCreateStory} className="w-full" disabled={!newStory.image_url}>
              Share Story
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Instagram-Style Story Viewer Modal */}
      <AnimatePresence>
        {isViewerOpen && currentStory && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black flex items-center justify-center"
          >
            <div className="relative w-full h-full md:max-w-md md:max-h-[90vh] md:rounded-2xl overflow-hidden">
              {/* Progress bars */}
              <div className="absolute top-2 left-2 right-2 flex gap-1 z-20">
                {storyGroups[currentGroupIndex]?.stories.map((_, idx) => (
                  <div key={idx} className="flex-1 h-[3px] bg-white/30 rounded-full overflow-hidden">
                    <motion.div 
                      className="h-full bg-white rounded-full"
                      initial={{ width: "0%" }}
                      animate={{ 
                        width: idx < currentStoryIndex 
                          ? "100%" 
                          : idx === currentStoryIndex 
                            ? `${progress}%` 
                            : "0%" 
                      }}
                      transition={{ duration: 0.1 }}
                    />
                  </div>
                ))}
              </div>

              {/* Header */}
              <div className="absolute top-8 left-4 right-4 flex items-center justify-between z-20">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full p-[2px] bg-gradient-to-tr from-yellow-400 via-pink-500 to-purple-600">
                    <Avatar className="w-full h-full border-2 border-black">
                      <AvatarImage src={currentStory.profiles.avatar_url || undefined} />
                      <AvatarFallback>{currentStory.profiles.username[0].toUpperCase()}</AvatarFallback>
                    </Avatar>
                  </div>
                  <div>
                    <p className="text-white text-sm font-semibold">{currentStory.profiles.username}</p>
                    <p className="text-white/60 text-xs">{formatDistanceToNow(new Date(currentStory.created_at), { addSuffix: true })}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={() => setIsPaused(!isPaused)}
                    className="text-white hover:bg-white/20 h-9 w-9"
                  >
                    {isPaused ? <Play className="h-5 w-5" /> : <Pause className="h-5 w-5" />}
                  </Button>
                  {currentStory.user_id === currentUserId && (
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      onClick={() => handleDeleteStory(currentStory.id)} 
                      className="text-white hover:bg-white/20 h-9 w-9"
                    >
                      <Trash2 className="h-5 w-5" />
                    </Button>
                  )}
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={() => setIsViewerOpen(false)} 
                    className="text-white hover:bg-white/20 h-9 w-9"
                  >
                    <X className="h-5 w-5" />
                  </Button>
                </div>
              </div>

              {/* Story Image */}
              <motion.img 
                key={currentStory.id}
                src={currentStory.image_url} 
                alt="Story" 
                className="w-full h-full object-contain"
                initial={{ opacity: 0, scale: 1.1 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3 }}
              />

              {/* Gradient overlays */}
              <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-black/60 to-transparent pointer-events-none" />
              <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-black/80 to-transparent pointer-events-none" />

              {/* Caption */}
              {currentStory.caption && (
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="absolute bottom-24 left-4 right-4 z-10"
                >
                  <p className="text-white text-sm bg-black/40 backdrop-blur-sm p-3 rounded-xl">{currentStory.caption}</p>
                </motion.div>
              )}

              {/* Actions */}
              <div className="absolute bottom-6 left-4 right-4 flex items-center justify-between z-20">
                <div className="flex items-center gap-4">
                  <motion.button 
                    whileTap={{ scale: 1.3 }}
                    onClick={handleLikeStory} 
                    className="flex items-center gap-2 text-white"
                  >
                    <Heart className={`h-7 w-7 transition-all ${currentStory.isLiked ? "fill-red-500 text-red-500 scale-110" : ""}`} />
                    <span className="text-sm font-medium">{currentStory.likesCount}</span>
                  </motion.button>
                  {currentStory.user_id === currentUserId && (
                    <button 
                      onClick={() => fetchStoryViewersAndLikers(currentStory.id)}
                      className="flex items-center gap-2 text-white"
                    >
                      <Eye className="h-7 w-7" />
                      <span className="text-sm font-medium">{currentStory.viewsCount}</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Navigation areas */}
              <div className="absolute inset-0 flex z-10">
                <button 
                  className="flex-1 h-full" 
                  onClick={prevStory}
                  onMouseDown={() => setIsPaused(true)}
                  onMouseUp={() => setIsPaused(false)}
                  onTouchStart={() => setIsPaused(true)}
                  onTouchEnd={() => setIsPaused(false)}
                />
                <button 
                  className="flex-1 h-full" 
                  onClick={nextStory}
                  onMouseDown={() => setIsPaused(true)}
                  onMouseUp={() => setIsPaused(false)}
                  onTouchStart={() => setIsPaused(true)}
                  onTouchEnd={() => setIsPaused(false)}
                />
              </div>

              {/* Navigation arrows (desktop) */}
              <div className="hidden md:block">
                {currentGroupIndex > 0 || currentStoryIndex > 0 ? (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={prevStory}
                    className="absolute left-2 top-1/2 -translate-y-1/2 z-30 text-white hover:bg-white/20 h-12 w-12 rounded-full"
                  >
                    <ChevronLeft className="h-8 w-8" />
                  </Button>
                ) : null}
                {currentGroupIndex < storyGroups.length - 1 || currentStoryIndex < storyGroups[currentGroupIndex]?.stories.length - 1 ? (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={nextStory}
                    className="absolute right-2 top-1/2 -translate-y-1/2 z-30 text-white hover:bg-white/20 h-12 w-12 rounded-full"
                  >
                    <ChevronRight className="h-8 w-8" />
                  </Button>
                ) : null}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Viewers/Likers Modal */}
      <Dialog open={viewersModalOpen} onOpenChange={(open) => {
        setViewersModalOpen(open);
        if (!open) setIsPaused(false);
      }}>
        <DialogContent className="max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle>Story Insights</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                <Eye className="h-4 w-4" /> Views ({storyViewers.length})
              </h4>
              <ScrollArea className="max-h-32">
                <div className="space-y-2">
                  {storyViewers.map((view: any) => (
                    <div key={view.id} className="flex items-center gap-2 p-2 rounded-lg hover:bg-muted/50">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={view.profiles?.avatar_url} />
                        <AvatarFallback>{view.profiles?.username?.[0]?.toUpperCase() || "?"}</AvatarFallback>
                      </Avatar>
                      <span className="text-sm font-medium">{view.profiles?.username || "Unknown"}</span>
                    </div>
                  ))}
                  {storyViewers.length === 0 && <p className="text-sm text-muted-foreground">No views yet</p>}
                </div>
              </ScrollArea>
            </div>
            <div>
              <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                <Heart className="h-4 w-4 text-red-500" /> Likes ({storyLikers.length})
              </h4>
              <ScrollArea className="max-h-32">
                <div className="space-y-2">
                  {storyLikers.map((like: any) => (
                    <div key={like.id} className="flex items-center gap-2 p-2 rounded-lg hover:bg-muted/50">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={like.profiles?.avatar_url} />
                        <AvatarFallback>{like.profiles?.username?.[0]?.toUpperCase() || "?"}</AvatarFallback>
                      </Avatar>
                      <span className="text-sm font-medium">{like.profiles?.username || "Unknown"}</span>
                    </div>
                  ))}
                  {storyLikers.length === 0 && <p className="text-sm text-muted-foreground">No likes yet</p>}
                </div>
              </ScrollArea>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default StoriesSection;
