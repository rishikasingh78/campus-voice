import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { X, Megaphone, AlertTriangle, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Announcement {
  id: string;
  title: string;
  content: string;
  priority: string;
  created_at: string;
  expires_at: string | null;
  scheduled_at: string | null;
}

const AnnouncementBanner = () => {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [dismissedIds, setDismissedIds] = useState<string[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    fetchAnnouncements();
    
    // Subscribe to realtime changes
    const channel = supabase
      .channel('announcements')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'announcements' }, () => {
        fetchAnnouncements();
      })
      .subscribe();

    // Check for scheduled announcements every minute
    const interval = setInterval(fetchAnnouncements, 60000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, []);

  const fetchAnnouncements = async () => {
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from("announcements")
      .select("*")
      .eq("is_active", true)
      .or(`expires_at.is.null,expires_at.gt.${now}`)
      .or(`scheduled_at.is.null,scheduled_at.lte.${now}`)
      .order("priority", { ascending: false })
      .order("created_at", { ascending: false });

    if (!error && data) {
      // Filter out dismissed announcements
      const stored = localStorage.getItem("dismissedAnnouncements");
      const dismissed = stored ? JSON.parse(stored) : [];
      setDismissedIds(dismissed);
      setAnnouncements(data.filter(a => !dismissed.includes(a.id)));
    }
  };

  const handleDismiss = (id: string) => {
    const newDismissed = [...dismissedIds, id];
    setDismissedIds(newDismissed);
    localStorage.setItem("dismissedAnnouncements", JSON.stringify(newDismissed));
    setAnnouncements(prev => prev.filter(a => a.id !== id));
  };

  if (announcements.length === 0) return null;

  const current = announcements[currentIndex] || announcements[0];

  const getPriorityStyles = (priority: string) => {
    switch (priority) {
      case "urgent":
        return "bg-gradient-to-r from-red-500/90 to-orange-500/90 text-white border-red-400/50";
      case "high":
        return "bg-gradient-to-r from-amber-500/90 to-yellow-500/90 text-white border-amber-400/50";
      default:
        return "bg-gradient-to-r from-primary/90 to-secondary/90 text-white border-primary/50";
    }
  };

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case "urgent":
        return <AlertTriangle className="h-4 w-4 md:h-5 md:w-5 flex-shrink-0" />;
      case "high":
        return <Megaphone className="h-4 w-4 md:h-5 md:w-5 flex-shrink-0" />;
      default:
        return <Info className="h-4 w-4 md:h-5 md:w-5 flex-shrink-0" />;
    }
  };

  return (
    <div className={cn(
      "relative overflow-hidden rounded-xl md:rounded-2xl border shadow-lg backdrop-blur-sm mb-4 md:mb-6",
      getPriorityStyles(current.priority)
    )}>
      {/* Animated background pattern */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute inset-0 bg-gradient-to-r from-white/20 via-transparent to-white/20 animate-pulse" />
      </div>
      
      <div className="relative p-3 md:p-4">
        <div className="flex items-start gap-2 md:gap-3">
          {getPriorityIcon(current.priority)}
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="font-semibold text-sm md:text-base truncate">{current.title}</h4>
              {announcements.length > 1 && (
                <span className="text-[10px] md:text-xs opacity-80 bg-white/20 px-1.5 md:px-2 py-0.5 rounded-full">
                  {currentIndex + 1}/{announcements.length}
                </span>
              )}
            </div>
            <p className="text-xs md:text-sm opacity-90 mt-0.5 md:mt-1 line-clamp-2">{current.content}</p>
          </div>
          
          <div className="flex items-center gap-1 flex-shrink-0">
            {announcements.length > 1 && (
              <div className="flex gap-1 mr-1 md:mr-2">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 md:h-8 md:w-8 text-white/80 hover:text-white hover:bg-white/20"
                  onClick={() => setCurrentIndex((prev) => (prev - 1 + announcements.length) % announcements.length)}
                >
                  ‹
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 md:h-8 md:w-8 text-white/80 hover:text-white hover:bg-white/20"
                  onClick={() => setCurrentIndex((prev) => (prev + 1) % announcements.length)}
                >
                  ›
                </Button>
              </div>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 md:h-8 md:w-8 text-white/80 hover:text-white hover:bg-white/20"
              onClick={() => handleDismiss(current.id)}
            >
              <X className="h-3 w-3 md:h-4 md:w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AnnouncementBanner;
