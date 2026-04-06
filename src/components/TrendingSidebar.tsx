import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, Flame, Zap, Target } from "lucide-react";

const TrendingSidebar = () => {
  const [trendingTopics, setTrendingTopics] = useState<any[]>([]);
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    activeIssues: 0,
    campaigns: 0,
    students: 0,
    changesMade: 0,
  });

  useEffect(() => {
    fetchTrendingData();
    fetchStats();
  }, []);

  const fetchTrendingData = async () => {
    try {
      // Fetch issues with their tag counts
      const { data: issues } = await supabase
        .from("issues")
        .select("tags");

      if (issues) {
        const tagCounts: { [key: string]: number } = {};
        issues.forEach((issue: any) => {
          issue.tags?.forEach((tag: string) => {
            tagCounts[tag] = (tagCounts[tag] || 0) + 1;
          });
        });

        const topTags = Object.entries(tagCounts)
          .sort(([, a], [, b]) => (b as number) - (a as number))
          .slice(0, 5)
          .map(([name, count], index) => ({
            name,
            count,
            icon: [Zap, Flame, Target, TrendingUp, TrendingUp][index],
            color: ["text-primary", "text-success", "text-secondary", "text-warning", "text-muted-foreground"][index],
          }));

        setTrendingTopics(topTags);
      }
    } catch (error) {
      console.error("Error fetching trending data:", error);
    }
  };

  const fetchStats = async () => {
    try {
      // Only count unsolved (active) issues
      const { count: activeIssuesCount } = await supabase
        .from("issues")
        .select("*", { count: "exact", head: true })
        .eq("is_solved", false);

      // Count solved issues for "Changes Made"
      const { count: solvedCount } = await supabase
        .from("issues")
        .select("*", { count: "exact", head: true })
        .eq("is_solved", true);

      const { count: profilesCount } = await supabase
        .from("profiles")
        .select("*", { count: "exact", head: true });

      const { count: campaignsCount } = await supabase
        .from("campaigns")
        .select("*", { count: "exact", head: true })
        .eq("status", "active");

      setStats({
        activeIssues: activeIssuesCount || 0,
        campaigns: campaignsCount || 0,
        students: profilesCount || 0,
        changesMade: solvedCount || 0,
      });
    } catch (error) {
      console.error("Error fetching stats:", error);
    }
  };
  return (
    <div className="space-y-6 sticky top-24">
      {/* Trending Topics */}
      <Card className="p-6 rounded-2xl shadow-soft border-border/50">
        <div className="flex items-center gap-2 mb-4">
          <div className="h-8 w-8 rounded-lg gradient-primary flex items-center justify-center">
            <TrendingUp className="h-4 w-4 text-white" />
          </div>
          <h3 className="font-semibold">Trending Topics</h3>
        </div>
        <div className="space-y-3">
          {trendingTopics.map((topic, index) => {
            const Icon = topic.icon;
            return (
              <div
                key={topic.name}
                className="flex items-center justify-between p-3 rounded-xl hover:bg-muted/50 transition-smooth cursor-pointer group"
                onClick={() => navigate(`/?tag=${encodeURIComponent(topic.name)}`)}
              >
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-muted-foreground">
                    {index + 1}
                  </span>
                  <Icon className={`h-4 w-4 ${topic.color} group-hover:scale-110 transition-bounce`} />
                  <span className="font-medium text-sm">{topic.name}</span>
                </div>
                <Badge variant="secondary" className="rounded-full text-xs">
                  {topic.count}
                </Badge>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Quick Stats */}
      <Card className="p-6 rounded-2xl shadow-soft border-border/50 gradient-hero">
        <h3 className="font-semibold mb-4">Community Impact</h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-primary">{stats.activeIssues}</div>
            <div className="text-xs text-muted-foreground">Active Issues</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-secondary">{stats.campaigns}</div>
            <div className="text-xs text-muted-foreground">Campaigns</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-success">{stats.students}</div>
            <div className="text-xs text-muted-foreground">Students</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-warning">{stats.changesMade}</div>
            <div className="text-xs text-muted-foreground">Changes Made</div>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default TrendingSidebar;
