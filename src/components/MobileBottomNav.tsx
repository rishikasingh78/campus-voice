import { useNavigate, useLocation } from "react-router-dom";
import { Home, Search, Send, Bell, User, Settings as SettingsIcon } from "lucide-react";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";

interface MobileBottomNavProps {
  onSearchClick?: () => void;
}

const MobileBottomNav = ({ onSearchClick }: MobileBottomNavProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    fetchUser();
    fetchUnread();
  }, []);

  const fetchUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("username")
        .eq("id", user.id)
        .single();
      setCurrentUser(profile);
    }
  };

  const fetchUnread = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { count } = await supabase
      .from("notifications")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("read", false);
    setUnreadCount(count || 0);
  };

  const navItems = [
    { icon: Home, label: "Home", path: "/", onClick: () => navigate("/") },
    { icon: Search, label: "Search", path: "/search", onClick: onSearchClick },
    { icon: Send, label: "Chat", path: "/chat", onClick: () => navigate("/chat") },
    { icon: User, label: "Profile", path: `/profile/${currentUser?.username}`, onClick: () => currentUser && navigate(`/profile/${currentUser.username}`) },
    { icon: SettingsIcon, label: "Settings", path: "/settings", onClick: () => navigate("/settings") },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card/95 backdrop-blur-lg border-t border-border/50 sm:hidden safe-area-bottom">
      <div className="flex items-center justify-around h-14 px-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path || (item.path === "/" && location.pathname === "/");
          return (
            <button
              key={item.label}
              onClick={item.onClick}
              className={`flex flex-col items-center justify-center gap-0.5 w-14 h-full relative transition-colors ${
                isActive ? "text-primary" : "text-muted-foreground"
              }`}
            >
              <div className="relative">
                <Icon className="h-5 w-5" />
                {item.label === "Chat" && unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1.5 h-3.5 w-3.5 rounded-full bg-destructive text-destructive-foreground text-[8px] flex items-center justify-center font-bold">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </div>
              <span className="text-[10px] font-medium">{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default MobileBottomNav;
