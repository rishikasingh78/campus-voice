import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Search, LogOut, Bell, Settings as SettingsIcon, User, TrendingUp, Send, Home } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { formatDistanceToNow } from "date-fns";
import SearchUsersModal from "@/components/SearchUsersModal";
interface NavbarProps {
  onSearchClick?: () => void;
}

const Navbar = ({ onSearchClick }: NavbarProps) => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  useEffect(() => {
    fetchCurrentUser();
    fetchNotifications();

    const channel = supabase
      .channel("notifications-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
        },
        () => {
          fetchNotifications();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();
      setCurrentUser(profile);
    }
  };

  const fetchNotifications = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(10);

    if (data) {
      setNotifications(data);
      setUnreadCount(data.filter((n) => !n.read).length);
    }
  };

  const markAsRead = async (notificationId: string) => {
    await supabase
      .from("notifications")
      .update({ read: true })
      .eq("id", notificationId);

    fetchNotifications();
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast({ title: "Signed out successfully" });
    navigate("/auth");
  };

  return (
     <nav className="sticky top-0 z-50 border-b bg-card/95 backdrop-blur-lg shadow-soft">
      <div className="container mx-auto px-2 md:px-4">
        <div className="flex items-center justify-between h-14 md:h-16">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate("/")}>
            <div className="h-8 w-8 md:h-10 md:w-10 rounded-xl gradient-primary flex items-center justify-center shadow-glow">
              <img
              src="/logo.png"
              alt="Campus Voice"
              loading="lazy"
              className="h-8 w-8 md:h-10 md:w-10 rounded-xl object-cover shadow-glow"
            />
            </div>
            <div
                className="text-lg md:text-2xl font-extrabold tracking-wide bg-gradient-to-r from-orange-500 via-pink-500 to-blue-500 text-transparent bg-clip-text hidden sm:block"
                style={{ fontFamily: "'Nixmat', sans-serif" }}
              >
                Campus Voice
              </div>
          </div>

          <div className="flex items-center gap-0.5 md:gap-2">
          <Button variant="ghost" size="icon" onClick={() => navigate("/")} className="rounded-full hover:scale-105 transition-smooth h-8 w-8 md:h-10 md:w-10">
            <Home className="h-4 w-4 md:h-5 md:w-5" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => onSearchClick ? onSearchClick() : setIsSearchOpen(true)} className="rounded-full hover:scale-105 transition-smooth h-8 w-8 md:h-10 md:w-10">
            <Search className="h-4 w-4 md:h-5 md:w-5" />
          </Button>

          <Button variant="ghost" size="icon" onClick={() => navigate("/chat")} className="rounded-full hover:scale-105 transition-smooth relative h-8 w-8 md:h-10 md:w-10">
            <Send className="h-4 w-4 md:h-5 md:w-5" />
          </Button>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon" className="rounded-full relative h-8 w-8 md:h-10 md:w-10">
                <Bell className="h-4 w-4 md:h-5 md:w-5" />
                {unreadCount > 0 && (
                  <Badge className="absolute -top-1 -right-1 h-4 w-4 md:h-5 md:w-5 flex items-center justify-center p-0 text-[10px] md:text-xs rounded-full bg-destructive">
                    {unreadCount}
                  </Badge>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-72 md:w-80 rounded-2xl p-0" align="end">
              <div className="p-3 md:p-4 border-b">
                <h3 className="font-semibold text-sm md:text-base">Notifications</h3>
              </div>
              <div className="max-h-80 md:max-h-96 overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="p-6 md:p-8 text-center text-muted-foreground text-sm">
                    No notifications yet
                  </div>
                ) : (
                  notifications.map((notification) => (
                    <div
                      key={notification.id}
                      className={`p-3 md:p-4 border-b cursor-pointer hover:bg-muted/50 transition-smooth ${
                        !notification.read ? "bg-primary/5" : ""
                      }`}
                      onClick={() => {
                        markAsRead(notification.id);
                        if (notification.link) navigate(notification.link);
                      }}
                    >
                      <h4 className="font-semibold text-xs md:text-sm mb-1">{notification.title}</h4>
                      <p className="text-[10px] md:text-xs text-muted-foreground mb-2 line-clamp-2">{notification.message}</p>
                      <span className="text-[10px] md:text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </PopoverContent>
          </Popover>

          <Button
            variant="ghost"
            size="icon"
            onClick={() => currentUser && navigate(`/profile/${currentUser.username}`)}
            className="rounded-full h-8 w-8 md:h-10 md:w-10"
          >
            <User className="h-4 w-4 md:h-5 md:w-5" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/settings")}
            className="rounded-full h-8 w-8 md:h-10 md:w-10 hidden sm:flex"
          >
            <SettingsIcon className="h-4 w-4 md:h-5 md:w-5" />
          </Button>

          <Button variant="ghost" size="icon" onClick={handleLogout} className="rounded-full h-8 w-8 md:h-10 md:w-10 hidden sm:flex">
            <LogOut className="h-4 w-4 md:h-5 md:w-5" />
          </Button>
          </div>
        </div>
      </div>
      <SearchUsersModal isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />
    </nav>
  );

};

export default Navbar;
