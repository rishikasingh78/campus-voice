import { useEffect, useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Search, Loader2, UserPlus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface SearchUsersModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SearchUsersModal = ({ isOpen, onClose }: SearchUsersModalProps) => {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string>("");
  const debounceRef = useRef<number | null>(null);

  // useEffect instead of useState to fetch current user once
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setCurrentUserId(user.id);
    });
  }, []);

  // New: debounce-driven suggestions as the user types (no UI changes)
  useEffect(() => {
    // clear results when query is empty
    if (!searchQuery.trim()) {
      setUsers([]);
      return;
    }

    // debounce
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    debounceRef.current = window.setTimeout(() => {
      handleSearch();
    }, 300);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery]);

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;

    try {
      setLoading(true);

      // ensure currentUserId is set (in case auth call hasn't resolved yet)
      if (!currentUserId) {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (user) setCurrentUserId(user.id);
      }

      // Search backend for typed words: match username OR full_name (suggestions)
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .or(`username.ilike.%${searchQuery}%,full_name.ilike.%${searchQuery}%`)
        .limit(10);

      if (error) throw error;

      // Check if current user is following each user
      const usersWithFollowStatus = await Promise.all(
        (data || []).map(async (user) => {
          const { data: followData } = await supabase
            .from("follows")
            .select("id")
            .eq("follower_id", currentUserId)
            .eq("following_id", user.id)
            .maybeSingle();

          return { ...user, isFollowing: !!followData };
        })
      );

      setUsers(usersWithFollowStatus);
    } catch (error: any) {
      toast({
        title: "Search failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleFollow = async (userId: string) => {
    const { error } = await supabase
      .from("follows")
      .insert({ follower_id: currentUserId, following_id: userId });

    if (error) {
      toast({
        title: "Error",
        description: "Failed to follow user",
        variant: "destructive",
      });
    } else {
      toast({ title: "Following user!" });
      setUsers(users.map(user => 
        user.id === userId ? { ...user, isFollowing: true } : user
      ));
    }
  };

  const handleUnfollow = async (userId: string) => {
    const { error } = await supabase
      .from("follows")
      .delete()
      .eq("follower_id", currentUserId)
      .eq("following_id", userId);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to unfollow user",
        variant: "destructive",
      });
    } else {
      toast({ title: "Unfollowed user" });
      setUsers(users.map(user => 
        user.id === userId ? { ...user, isFollowing: false } : user
      ));
    }
  };

  // New: open a profile page for a user (opens in same tab)
  const viewProfile = (username?: string) => {
    if (!username) return;
    // Adjust path if your app uses a different route (e.g. /u/ or /profile/[id])
    window.location.href = `/profile/${encodeURIComponent(username)}`;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      {/* responsive modal: full width on mobile with side margins */}
      <DialogContent className="w-full max-w-2xl sm:rounded-3xl rounded-xl mx-4 sm:mx-auto p-4">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold">Search Users</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* stack on mobile, row on sm+ */}
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by username..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                className="pl-10 rounded-xl"
                aria-label="Search users"
              />
            </div>
            <Button
              onClick={handleSearch}
              disabled={loading}
              className="rounded-xl gradient-primary w-full sm:w-auto"
              size="sm"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Search"}
            </Button>
          </div>

          <div className="space-y-3 max-h-[60vh] sm:max-h-96 overflow-y-auto">
            {users.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {searchQuery ? "No users found" : "Search for users to follow"}
              </div>
            ) : (
              users.map((user) => (
                <div
                  key={user.id}
                  className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-3 sm:p-4 rounded-xl hover:bg-muted/50 transition-smooth gap-3"
                >
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10 sm:h-12 sm:w-12 border-2 border-primary/10">
                      {user.avatar_url ? (
                        <AvatarImage src={user.avatar_url} />
                      ) : (
                        <AvatarFallback>
                          {(user.username?.[0] || "").toUpperCase()}
                        </AvatarFallback>
                      )}
                    </Avatar>
                    <div className="min-w-0">
                      <p
                        className="font-semibold truncate cursor-pointer"
                        onClick={() => viewProfile(user.username)}
                        title={`View ${user.username}'s profile`}
                      >
                        {user.full_name || user.username}
                      </p>
                      <p className="text-sm text-muted-foreground">@{user.username}</p>
                      {user.role && <p className="text-xs text-muted-foreground">{user.role}</p>}
                    </div>
                  </div>

                  <div className="w-full sm:w-auto flex justify-end items-center gap-2">
                    {/* View profile button */}
                    <Button
                      size="sm"
                      variant="outline"
                      className="rounded-full px-3"
                      onClick={() => viewProfile(user.username)}
                    >
                      View Profile
                    </Button>

                    {/* Follow / Unfollow / You (disabled) */}
                    {user.id === currentUserId ? (
                      <Button size="sm" variant="outline" className="rounded-full px-4" disabled>
                        You
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        onClick={() => user.isFollowing ? handleUnfollow(user.id) : handleFollow(user.id)}
                        variant={user.isFollowing ? "outline" : "default"}
                        className="rounded-full px-4"
                      >
                        {user.isFollowing ? "Following" : "Follow"}
                      </Button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SearchUsersModal;