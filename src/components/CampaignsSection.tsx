import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { Users, Target, Plus, Calendar, TrendingUp, Trash2, Share2, Heart, MessageSquare, ArrowRight, Sparkles } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";

interface Participant {
  id: string;
  user_id: string;
  joined_at: string;
  profiles: {
    username: string;
    full_name: string | null;
    avatar_url: string | null;
  };
}

interface Campaign {
  id: string;
  title: string;
  description: string;
  goal: string;
  image_url: string | null;
  status: string;
  created_at: string;
  creator_id: string;
  participantCount: number;
  isParticipant: boolean;
  participants: Participant[];
  profiles: {
    username: string;
    full_name: string | null;
    avatar_url: string | null;
  };
}

interface CampaignsSectionProps {
  currentUserId: string;
}

const CampaignsSection = ({ currentUserId }: CampaignsSectionProps) => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [goal, setGoal] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    fetchCampaigns();

    const channel = supabase
      .channel("campaigns-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "campaigns" },
        () => fetchCampaigns()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "campaign_participants" },
        () => fetchCampaigns()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUserId]);

  const fetchCampaigns = async () => {
    const { data: campaignsData } = await supabase
      .from("campaigns")
      .select(`
        *,
        profiles:creator_id (username, full_name, avatar_url)
      `)
      .eq("status", "active")
      .order("created_at", { ascending: false });

    if (campaignsData) {
      const campaignsWithDetails = await Promise.all(
        campaignsData.map(async (campaign) => {
          // Get participant count
          const { count } = await supabase
            .from("campaign_participants")
            .select("*", { count: "exact", head: true })
            .eq("campaign_id", campaign.id);

          // Check if current user is a participant
          const { data: participation } = await supabase
            .from("campaign_participants")
            .select("id")
            .eq("campaign_id", campaign.id)
            .eq("user_id", currentUserId)
            .maybeSingle();

          // Get participants with profiles (limit to first 5 for display)
          const { data: participantsData } = await supabase
            .from("campaign_participants")
            .select(`
              id,
              user_id,
              joined_at,
              profiles:user_id (username, full_name, avatar_url)
            `)
            .eq("campaign_id", campaign.id)
            .order("joined_at", { ascending: false })
            .limit(10);

          return {
            ...campaign,
            participantCount: count || 0,
            isParticipant: !!participation,
            participants: participantsData || [],
          };
        })
      );

      setCampaigns(campaignsWithDetails);
    }
  };

  const handleCreateCampaign = async () => {
    if (!title.trim() || !description.trim() || !goal.trim()) {
      toast({ title: "Please fill all fields", variant: "destructive" });
      return;
    }

    setIsLoading(true);
    let imageUrl = null;
    
    if (imageFile) {
      const fileExt = imageFile.name.split(".").pop();
      const fileName = `${currentUserId}/${Date.now()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from("campaign-images")
        .upload(fileName, imageFile);

      if (!uploadError) {
        const { data: { publicUrl } } = supabase.storage
          .from("campaign-images")
          .getPublicUrl(fileName);
        imageUrl = publicUrl;
      }
    }

    const { error } = await supabase.from("campaigns").insert({
      title,
      description,
      goal,
      creator_id: currentUserId,
      image_url: imageUrl,
    });

    setIsLoading(false);

    if (error) {
      toast({ title: "Error creating campaign", variant: "destructive" });
    } else {
      toast({ title: "Campaign created successfully!" });
      setTitle("");
      setDescription("");
      setGoal("");
      setImageFile(null);
      setIsCreateOpen(false);
    }
  };

  const handleJoinCampaign = async (campaignId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    
    const { error } = await supabase
      .from("campaign_participants")
      .insert({ campaign_id: campaignId, user_id: currentUserId });

    if (error) {
      toast({ title: "Error joining campaign", variant: "destructive" });
    } else {
      toast({ title: "🎉 You've joined the campaign!", description: "Thank you for supporting this cause." });
    }
  };

  const handleLeaveCampaign = async (campaignId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    
    const { error } = await supabase
      .from("campaign_participants")
      .delete()
      .eq("campaign_id", campaignId)
      .eq("user_id", currentUserId);

    if (error) {
      toast({ title: "Error leaving campaign", variant: "destructive" });
    } else {
      toast({ title: "Left campaign" });
    }
  };

  const handleDeleteCampaign = async (campaignId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!confirm("Are you sure you want to delete this campaign?")) return;
    
    const { error } = await supabase
      .from("campaigns")
      .delete()
      .eq("id", campaignId);
      
    if (error) {
      toast({ title: "Error deleting campaign", variant: "destructive" });
    } else {
      toast({ title: "Campaign deleted" });
      setSelectedCampaign(null);
      fetchCampaigns();
    }
  };

  const handleShare = async (campaign: Campaign, e?: React.MouseEvent) => {
    e?.stopPropagation();
    
    const shareUrl = `${window.location.origin}/?campaign=${campaign.id}`;
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: campaign.title,
          text: campaign.description,
          url: shareUrl,
        });
      } catch {
        // User cancelled
      }
    } else {
      await navigator.clipboard.writeText(shareUrl);
      toast({ title: "Link copied to clipboard!" });
    }
  };

  const getProgressPercentage = (count: number) => {
    // Assuming goal of 100 supporters for visual progress
    return Math.min((count / 100) * 100, 100);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-primary" />
            Active Campaigns
          </h2>
          <p className="text-muted-foreground mt-1">Join movements that matter to your campus</p>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button className="rounded-full gradient-primary shadow-glow">
              <Plus className="h-4 w-4 mr-2" />
              Start Campaign
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Target className="h-5 w-5 text-primary" />
                Start a New Campaign
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div>
                <label className="text-sm font-medium mb-1 block">Campaign Title</label>
                <Input
                  placeholder="What's your campaign about?"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="rounded-xl"
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Description</label>
                <Textarea
                  placeholder="Describe your campaign and why it matters..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={4}
                  className="rounded-xl resize-none"
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Campaign Goal</label>
                <Input
                  placeholder="What do you want to achieve?"
                  value={goal}
                  onChange={(e) => setGoal(e.target.value)}
                  className="rounded-xl"
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Cover Image (optional)</label>
                <Input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setImageFile(e.target.files?.[0] || null)}
                  className="rounded-xl"
                />
              </div>
              <Button 
                onClick={handleCreateCampaign} 
                className="w-full rounded-xl gradient-primary"
                disabled={isLoading}
              >
                {isLoading ? "Creating..." : "Launch Campaign"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Campaigns Grid */}
      {campaigns.length === 0 ? (
        <Card className="p-12 text-center">
          <Target className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">No active campaigns yet</h3>
          <p className="text-muted-foreground mb-4">Be the first to start a movement!</p>
          <Button onClick={() => setIsCreateOpen(true)} className="rounded-full">
            <Plus className="h-4 w-4 mr-2" />
            Start Campaign
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {campaigns.map((campaign) => (
            <Card 
              key={campaign.id}
              className="overflow-hidden hover-lift cursor-pointer group"
              onClick={() => setSelectedCampaign(campaign)}
            >
              {/* Campaign Image */}
              {campaign.image_url ? (
                <div className="relative h-48 overflow-hidden">
                  <img
                    src={campaign.image_url}
                    alt={campaign.title}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                  <div className="absolute bottom-4 left-4 right-4">
                    <h3 className="text-xl font-bold text-white">{campaign.title}</h3>
                  </div>
                </div>
              ) : (
                <div className="p-6 pb-0">
                  <h3 className="text-xl font-bold">{campaign.title}</h3>
                </div>
              )}

              <div className="p-6 space-y-4">
                {!campaign.image_url && (
                  <p className="text-muted-foreground line-clamp-2">{campaign.description}</p>
                )}

                {/* Goal */}
                <div className="flex items-start gap-2 p-3 bg-muted/30 rounded-xl">
                  <Target className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs text-muted-foreground">Campaign Goal</p>
                    <p className="font-medium text-sm">{campaign.goal}</p>
                  </div>
                </div>

                {/* Progress */}
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Supporters</span>
                    <span className="font-semibold">{campaign.participantCount}</span>
                  </div>
                  <Progress value={getProgressPercentage(campaign.participantCount)} className="h-2" />
                </div>

                {/* Participants Avatars */}
                {campaign.participants.length > 0 && (
                  <div className="flex items-center gap-2">
                    <div className="flex -space-x-2">
                      {campaign.participants.slice(0, 5).map((p) => (
                        <Avatar key={p.id} className="h-8 w-8 border-2 border-background">
                          <AvatarImage src={p.profiles.avatar_url || undefined} />
                          <AvatarFallback className="text-xs">
                            {p.profiles.username?.[0]?.toUpperCase() || "U"}
                          </AvatarFallback>
                        </Avatar>
                      ))}
                    </div>
                    {campaign.participantCount > 5 && (
                      <span className="text-sm text-muted-foreground">
                        +{campaign.participantCount - 5} more
                      </span>
                    )}
                  </div>
                )}

                {/* Creator & Actions */}
                <div className="flex items-center justify-between pt-2 border-t border-border/50">
                  <div 
                    className="flex items-center gap-2 cursor-pointer hover:opacity-80"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/profile/${campaign.profiles.username}`);
                    }}
                  >
                    <Avatar className="h-6 w-6">
                      <AvatarImage src={campaign.profiles.avatar_url || undefined} />
                      <AvatarFallback className="text-xs">
                        {campaign.profiles.username?.[0]?.toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm text-muted-foreground">
                      @{campaign.profiles.username}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 w-8 p-0"
                      onClick={(e) => handleShare(campaign, e)}
                    >
                      <Share2 className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant={campaign.isParticipant ? "outline" : "default"}
                      className="rounded-full"
                      onClick={(e) => 
                        campaign.isParticipant 
                          ? handleLeaveCampaign(campaign.id, e)
                          : handleJoinCampaign(campaign.id, e)
                      }
                    >
                      {campaign.isParticipant ? "Leave" : "Join"}
                      {!campaign.isParticipant && <ArrowRight className="h-4 w-4 ml-1" />}
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Campaign Detail Modal */}
      <Dialog open={!!selectedCampaign} onOpenChange={() => setSelectedCampaign(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-auto">
          {selectedCampaign && (
            <>
              <DialogHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <DialogTitle className="text-2xl">{selectedCampaign.title}</DialogTitle>
                    <p className="text-sm text-muted-foreground mt-1 flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      Started {formatDistanceToNow(new Date(selectedCampaign.created_at), { addSuffix: true })}
                    </p>
                  </div>
                  {selectedCampaign.creator_id === currentUserId && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:bg-destructive/10"
                      onClick={(e) => handleDeleteCampaign(selectedCampaign.id, e)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </DialogHeader>

              {selectedCampaign.image_url && (
                <img
                  src={selectedCampaign.image_url}
                  alt={selectedCampaign.title}
                  className="w-full h-64 object-cover rounded-xl"
                />
              )}

              <div className="space-y-6">
                {/* Description */}
                <div>
                  <h4 className="font-semibold mb-2">About this campaign</h4>
                  <p className="text-muted-foreground whitespace-pre-wrap">{selectedCampaign.description}</p>
                </div>

                {/* Goal Card */}
                <Card className="p-4 bg-gradient-to-br from-primary/5 to-secondary/5">
                  <div className="flex items-center gap-3">
                    <div className="p-3 rounded-full bg-primary/10">
                      <Target className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Campaign Goal</p>
                      <p className="font-semibold">{selectedCampaign.goal}</p>
                    </div>
                  </div>
                </Card>

                {/* Stats */}
                <div className="grid grid-cols-3 gap-4">
                  <Card className="p-4 text-center">
                    <Users className="h-5 w-5 mx-auto text-primary mb-2" />
                    <p className="text-2xl font-bold">{selectedCampaign.participantCount}</p>
                    <p className="text-xs text-muted-foreground">Supporters</p>
                  </Card>
                  <Card className="p-4 text-center">
                    <TrendingUp className="h-5 w-5 mx-auto text-green-500 mb-2" />
                    <p className="text-2xl font-bold">{getProgressPercentage(selectedCampaign.participantCount).toFixed(0)}%</p>
                    <p className="text-xs text-muted-foreground">Progress</p>
                  </Card>
                  <Card className="p-4 text-center">
                    <Calendar className="h-5 w-5 mx-auto text-blue-500 mb-2" />
                    <p className="text-2xl font-bold">{Math.ceil((Date.now() - new Date(selectedCampaign.created_at).getTime()) / (1000 * 60 * 60 * 24))}</p>
                    <p className="text-xs text-muted-foreground">Days Active</p>
                  </Card>
                </div>

                {/* Supporters List */}
                {selectedCampaign.participants.length > 0 && (
                  <div>
                    <h4 className="font-semibold mb-3">Recent Supporters</h4>
                    <div className="space-y-2 max-h-48 overflow-auto">
                      {selectedCampaign.participants.map((p) => (
                        <div 
                          key={p.id}
                          className="flex items-center justify-between p-3 bg-muted/30 rounded-xl cursor-pointer hover:bg-muted/50 transition-colors"
                          onClick={() => {
                            setSelectedCampaign(null);
                            navigate(`/profile/${p.profiles.username}`);
                          }}
                        >
                          <div className="flex items-center gap-3">
                            <Avatar className="h-10 w-10">
                              <AvatarImage src={p.profiles.avatar_url || undefined} />
                              <AvatarFallback>
                                {p.profiles.username?.[0]?.toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="font-medium">{p.profiles.full_name || p.profiles.username}</p>
                              <p className="text-sm text-muted-foreground">@{p.profiles.username}</p>
                            </div>
                          </div>
                          <span className="text-xs text-muted-foreground">
                            Joined {formatDistanceToNow(new Date(p.joined_at), { addSuffix: true })}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Creator Info */}
                <div className="flex items-center justify-between p-4 bg-muted/30 rounded-xl">
                  <div 
                    className="flex items-center gap-3 cursor-pointer hover:opacity-80"
                    onClick={() => {
                      setSelectedCampaign(null);
                      navigate(`/profile/${selectedCampaign.profiles.username}`);
                    }}
                  >
                    <Avatar className="h-12 w-12">
                      <AvatarImage src={selectedCampaign.profiles.avatar_url || undefined} />
                      <AvatarFallback>
                        {selectedCampaign.profiles.username?.[0]?.toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium">{selectedCampaign.profiles.full_name || selectedCampaign.profiles.username}</p>
                      <p className="text-sm text-muted-foreground">Campaign Creator</p>
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3">
                  <Button
                    className="flex-1 rounded-xl"
                    variant={selectedCampaign.isParticipant ? "outline" : "default"}
                    onClick={() =>
                      selectedCampaign.isParticipant
                        ? handleLeaveCampaign(selectedCampaign.id)
                        : handleJoinCampaign(selectedCampaign.id)
                    }
                  >
                    {selectedCampaign.isParticipant ? (
                      "Leave Campaign"
                    ) : (
                      <>
                        Join Campaign
                        <ArrowRight className="h-4 w-4 ml-2" />
                      </>
                    )}
                  </Button>
                  <Button 
                    variant="outline" 
                    className="rounded-xl"
                    onClick={(e) => handleShare(selectedCampaign, e)}
                  >
                    <Share2 className="h-4 w-4 mr-2" />
                    Share
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CampaignsSection;
