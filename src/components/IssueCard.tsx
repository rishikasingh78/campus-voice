import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ArrowBigUp, MessageCircle, Share2, Bookmark, Repeat2, CheckCircle2, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import CommentsModal from "./CommentsModal";

interface Issue {
  id: string;
  title: string;
  description: string;
  profiles: { id: string; username: string; full_name: string | null; avatar_url: string | null; role: string | null; };
  likesCount: number;
  commentsCount: number;
  repostsCount: number;
  tags: string[];
  created_at: string;
  image_url?: string | null;
  isLiked: boolean;
  isReposted: boolean;
  is_anonymous: boolean;
  is_solved?: boolean;
}

interface IssueCardProps {
  issue: Issue;
  onLike: (issueId: string) => void;
  onRepost: (issueId: string) => void;
  currentUserId: string;
}

const IssueCard = ({ issue, onLike, onRepost, currentUserId }: IssueCardProps) => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [isCommentsOpen, setIsCommentsOpen] = useState(false);

  const displayAuthor = issue.is_anonymous
    ? { username: "Anonymous", full_name: "Anonymous User", avatar_url: null, role: "Student" }
    : issue.profiles;

  useEffect(() => { checkBookmark(); }, [issue.id, currentUserId]);

  const checkBookmark = async () => {
    if (!currentUserId) return;
    const { data } = await supabase.from("bookmarks").select("id").eq("issue_id", issue.id).eq("user_id", currentUserId).maybeSingle();
    setIsBookmarked(!!data);
  };

  const handleBookmark = async () => {
    if (!currentUserId) return;
    try {
      if (isBookmarked) {
        await supabase.from("bookmarks").delete().eq("issue_id", issue.id).eq("user_id", currentUserId);
        toast({ title: "Removed from bookmarks" });
      } else {
        await supabase.from("bookmarks").insert({ issue_id: issue.id, user_id: currentUserId });
        toast({ title: "Added to bookmarks" });
      }
      setIsBookmarked(!isBookmarked);
    } catch (error: any) {
      toast({ title: "Error", description: "Something went wrong. Try again.", variant: "destructive" });
    }
  };

  const handleShare = async () => {
    const shareUrl = `${window.location.origin}/issue/${issue.id}`;
    if (navigator.share) {
      try { await navigator.share({ title: issue.title, text: issue.description, url: shareUrl }); } catch {}
    } else {
      await navigator.clipboard.writeText(shareUrl);
      toast({ title: "Link copied!" });
    }
  };

  const handleDelete = async () => {
    if (!confirm("Delete this issue?")) return;
    try {
      await supabase.from("issues").delete().eq("id", issue.id);
      toast({ title: "Issue deleted" });
      window.location.reload();
    } catch {
      toast({ title: "Could not delete", description: "Please try again.", variant: "destructive" });
    }
  };

  return (
    <Card className="p-3 md:p-5 hover-lift border-border/40 rounded-xl md:rounded-2xl shadow-soft relative overflow-hidden">
      {/* Solved ribbon */}
      {issue.is_solved && (
        <div className="absolute top-0 right-0 z-10">
          <div className="bg-gradient-to-r from-emerald-500 to-green-500 text-white text-[9px] font-bold px-3 py-0.5 rounded-bl-lg flex items-center gap-1">
            <CheckCircle2 className="h-2.5 w-2.5" /> SOLVED
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center gap-2.5 mb-2.5">
        <div className={`flex items-center gap-2 flex-1 min-w-0 ${!issue.is_anonymous ? 'cursor-pointer' : ''}`}
          onClick={() => { if (!issue.is_anonymous) navigate(`/profile/${displayAuthor.username}`); }}>
          <Avatar className="h-8 w-8 md:h-9 md:w-9 border border-border/50 flex-shrink-0">
            <AvatarImage src={displayAuthor.avatar_url || undefined} />
            <AvatarFallback className="text-xs">{displayAuthor.username[0].toUpperCase()}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="text-xs md:text-sm font-semibold truncate">{displayAuthor.full_name || displayAuthor.username}</p>
            <p className="text-[10px] md:text-xs text-muted-foreground truncate">
              @{displayAuthor.username} · {formatDistanceToNow(new Date(issue.created_at), { addSuffix: true })}
            </p>
          </div>
        </div>
        {issue.profiles?.id === currentUserId && (
          <Button variant="ghost" size="icon" onClick={handleDelete} className="h-7 w-7 rounded-full text-muted-foreground hover:text-destructive flex-shrink-0">
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>

      {/* Content */}
      <div className="space-y-2">
        <h3 className="text-sm md:text-base font-semibold leading-snug hover:text-primary transition-smooth cursor-pointer"
          onClick={() => navigate(`/issue/${issue.id}`)}>
          {issue.title}
        </h3>
        <p className="text-xs md:text-sm text-muted-foreground leading-relaxed line-clamp-3">
          {issue.description}
        </p>
      </div>

      {/* Image */}
      {issue.image_url && (
        <img src={issue.image_url} alt={issue.title}
          className="w-full rounded-xl object-cover max-h-52 md:max-h-64 mt-2.5 cursor-pointer"
          onClick={() => navigate(`/issue/${issue.id}`)} loading="lazy" />
      )}

      {/* Tags */}
      {issue.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2.5">
          {issue.tags.map((tag) => (
            <Badge key={tag} variant="secondary" className="rounded-full px-2 py-0.5 text-[10px] md:text-xs">
              {tag}
            </Badge>
          ))}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-0.5 mt-3 pt-2.5 border-t border-border/30">
        <Button variant="ghost" size="sm" onClick={() => onLike(issue.id)}
          className={cn("rounded-full h-8 px-2.5 text-xs gap-1", issue.isLiked && "text-primary bg-primary/10")}>
          <ArrowBigUp className={cn("h-4 w-4", issue.isLiked && "fill-current")} />
          <span>{issue.likesCount}</span>
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setIsCommentsOpen(true)}
          className="rounded-full h-8 px-2.5 text-xs gap-1">
          <MessageCircle className="h-3.5 w-3.5" />
          <span>{issue.commentsCount}</span>
        </Button>
        <Button variant="ghost" size="sm" onClick={() => onRepost(issue.id)}
          className={cn("rounded-full h-8 px-2.5 text-xs gap-1", issue.isReposted && "text-emerald-500 bg-emerald-500/10")}>
          <Repeat2 className="h-3.5 w-3.5" />
          <span>{issue.repostsCount}</span>
        </Button>
        <Button variant="ghost" size="sm" onClick={handleShare}
          className="rounded-full h-8 px-2.5 text-xs gap-1">
          <Share2 className="h-3.5 w-3.5" />
        </Button>
        <Button variant="ghost" size="icon" onClick={handleBookmark}
          className={cn("rounded-full h-8 w-8 ml-auto", isBookmarked && "text-amber-500 bg-amber-500/10")}>
          <Bookmark className={cn("h-3.5 w-3.5", isBookmarked && "fill-current")} />
        </Button>
      </div>

      <CommentsModal open={isCommentsOpen} onOpenChange={setIsCommentsOpen} issueId={issue.id} currentUserId={currentUserId} />
    </Card>
  );
};

export default IssueCard;
