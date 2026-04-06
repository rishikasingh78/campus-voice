import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area, LineChart, Line
} from "recharts";
import { 
  Users, FileText, Bell, Heart, MessageSquare, TrendingUp, CheckCircle2,
  Loader2, Shield, LogOut, Eye, Lock, Ban, Clock, UserX, Megaphone, Send,
  Image, Activity, AlertTriangle, RefreshCw, Zap, BarChart3, BookOpen,
  Flag, Calendar, Trash2, Plus, Edit
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { format, addDays, addHours, subDays } from "date-fns";
import { Switch } from "@/components/ui/switch";
import ConfirmDialog from "@/components/ConfirmDialog";
import CreateAnnouncementModal from "@/components/CreateAnnouncementModal";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

const adminAction = async (password: string, action: string, payload: any) => {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/admin-actions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({ password, action, payload }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Admin action failed");
  return data;
};

const ADMIN_PASSWORD = "campus@krmuvoice";

interface IssueWithDetails {
  id: string;
  title: string;
  description: string;
  created_at: string;
  is_solved: boolean;
  solved_at: string | null;
  tags: string[];
  user_id: string;
  profiles: {
    username: string;
    full_name: string | null;
  };
  likesCount: number;
  commentsCount: number;
  repostsCount: number;
}

interface CommentDetail {
  id: string;
  content: string;
  created_at: string;
  profiles: {
    username: string;
    full_name: string | null;
  };
}

interface UserProfile {
  id: string;
  username: string;
  full_name: string | null;
  avatar_url: string | null;
  created_at: string;
  role: string | null;
  isSuspended: boolean;
  suspensionDetails: any;
}

interface Campaign {
  id: string;
  title: string;
  description: string;
  goal: string;
  status: string;
  created_at: string;
  creator_id: string;
  profiles: {
    username: string;
  };
  participantsCount: number;
  participants?: any[];
}

interface LikeDetail {
  id: string;
  created_at: string;
  issue_id: string;
  profiles: {
    username: string;
    full_name: string | null;
  };
}

interface StoryData {
  id: string;
  user_id: string;
  image_url: string;
  caption: string | null;
  created_at: string;
  expires_at: string;
  profiles: {
    username: string;
    avatar_url: string | null;
  };
  viewsCount: number;
  likesCount: number;
}

interface ReportData {
  id: string;
  reporter_id: string;
  reported_user_id: string | null;
  reported_issue_id: string | null;
  reported_comment_id: string | null;
  report_type: string;
  reason: string;
  description: string | null;
  status: string;
  admin_notes: string | null;
  created_at: string;
  reporter?: { username: string; avatar_url?: string | null };
  reported_user?: { username: string; full_name?: string | null; avatar_url?: string | null };
  reported_issue?: { id: string; title: string; description: string; image_url?: string | null; tags?: string[]; created_at: string; profiles?: { username: string } };
  reported_comment?: { content: string; created_at: string; profiles?: { username: string } };
}

interface AnnouncementData {
  id: string;
  title: string;
  content: string;
  priority: string;
  is_active: boolean;
  created_at: string;
  expires_at: string | null;
  scheduled_at: string | null;
}

const COLORS = ['hsl(var(--primary))', 'hsl(var(--secondary))', 'hsl(220, 70%, 50%)', 'hsl(160, 60%, 45%)', 'hsl(340, 80%, 55%)'];

const AdminDashboard = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [dataLoading, setDataLoading] = useState(false);
  const [issues, setIssues] = useState<IssueWithDetails[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [stories, setStories] = useState<StoryData[]>([]);
  const [reports, setReports] = useState<ReportData[]>([]);
  const [announcements, setAnnouncements] = useState<AnnouncementData[]>([]);
  const [selectedIssue, setSelectedIssue] = useState<IssueWithDetails | null>(null);
  const [likeDetails, setLikeDetails] = useState<LikeDetail[]>([]);
  const [commentDetails, setCommentDetails] = useState<CommentDetail[]>([]);
  const [engagementModalOpen, setEngagementModalOpen] = useState(false);
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalIssues: 0,
    totalLikes: 0,
    totalComments: 0,
    solvedIssues: 0,
    activeCampaigns: 0,
    suspendedUsers: 0,
    activeStories: 0,
    totalReposts: 0,
    totalFollows: 0,
    pendingReports: 0,
    activeAnnouncements: 0,
  });
  const [issuesOverTime, setIssuesOverTime] = useState<any[]>([]);
  const [tagDistribution, setTagDistribution] = useState<any[]>([]);
  const [userGrowth, setUserGrowth] = useState<any[]>([]);
  const [engagementOverTime, setEngagementOverTime] = useState<any[]>([]);
  const [recentActivity, setRecentActivity] = useState<any[]>([]);

  // Suspension modal state
  const [suspendModalOpen, setSuspendModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [suspensionType, setSuspensionType] = useState<"temporary" | "permanent">("temporary");
  const [suspensionDuration, setSuspensionDuration] = useState("1");
  const [suspensionUnit, setSuspensionUnit] = useState<"hours" | "days">("days");
  const [suspensionReason, setSuspensionReason] = useState("");

  // Campaign supporters modal state
  const [supportersModalOpen, setSupportersModalOpen] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
  const [campaignSupporters, setCampaignSupporters] = useState<any[]>([]);

  // Notification modal state
  const [notificationModalOpen, setNotificationModalOpen] = useState(false);
  const [notificationTitle, setNotificationTitle] = useState("");
  const [notificationMessage, setNotificationMessage] = useState("");
  const [notificationTarget, setNotificationTarget] = useState<"all" | "selected">("all");
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);

  // Preview modals state
  const [previewIssue, setPreviewIssue] = useState<IssueWithDetails | null>(null);
  const [previewStory, setPreviewStory] = useState<StoryData | null>(null);
  const [storyViewers, setStoryViewers] = useState<any[]>([]);
  const [storyLikers, setStoryLikers] = useState<any[]>([]);

  // Confirm dialog states
  const [deleteConfirm, setDeleteConfirm] = useState<{ type: "issue" | "story" | "campaign" | "announcement"; id: string } | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Create announcement modal
  const [createAnnouncementOpen, setCreateAnnouncementOpen] = useState(false);
  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === ADMIN_PASSWORD) {
      setIsAuthenticated(true);
      toast({
        title: "Welcome Admin",
        description: "You have successfully logged in.",
      });
    } else {
      toast({
        title: "Access Denied",
        description: "Incorrect password.",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchDashboardData();
    }
  }, [isAuthenticated]);

  const handleLogout = () => {
    setIsAuthenticated(false);
    setPassword("");
    navigate("/");
  };

  const fetchDashboardData = async () => {
    setDataLoading(true);
    try {
      // Fetch all stats in parallel
      const [
        { count: usersCount },
        { count: issuesCount },
        { count: likesCount },
        { count: commentsCount },
        { count: solvedCount },
        { count: campaignsCount },
        { count: suspendedCount },
        { count: storiesCount },
        { count: repostsCount },
        { count: followsCount },
        { count: pendingReportsCount },
        { count: activeAnnouncementsCount },
      ] = await Promise.all([
        supabase.from("profiles").select("*", { count: "exact", head: true }),
        supabase.from("issues").select("*", { count: "exact", head: true }),
        supabase.from("likes").select("*", { count: "exact", head: true }),
        supabase.from("comments").select("*", { count: "exact", head: true }),
        supabase.from("issues").select("*", { count: "exact", head: true }).eq("is_solved", true),
        supabase.from("campaigns").select("*", { count: "exact", head: true }).eq("status", "active"),
        supabase.from("user_suspensions").select("*", { count: "exact", head: true }).eq("is_active", true),
        supabase.from("stories").select("*", { count: "exact", head: true }).gt("expires_at", new Date().toISOString()),
        supabase.from("reposts").select("*", { count: "exact", head: true }),
        supabase.from("follows").select("*", { count: "exact", head: true }),
        supabase.from("user_reports").select("*", { count: "exact", head: true }).eq("status", "pending"),
        supabase.from("announcements").select("*", { count: "exact", head: true }).eq("is_active", true),
      ]);

      setStats({
        totalUsers: usersCount || 0,
        totalIssues: issuesCount || 0,
        totalLikes: likesCount || 0,
        totalComments: commentsCount || 0,
        solvedIssues: solvedCount || 0,
        activeCampaigns: campaignsCount || 0,
        suspendedUsers: suspendedCount || 0,
        activeStories: storiesCount || 0,
        totalReposts: repostsCount || 0,
        totalFollows: followsCount || 0,
        pendingReports: pendingReportsCount || 0,
        activeAnnouncements: activeAnnouncementsCount || 0,
      });

      // Fetch issues with details
      const { data: issuesData } = await supabase
        .from("issues")
        .select(`
          *,
          profiles:user_id (username, full_name),
          likes (count),
          comments (count),
          reposts (count)
        `)
        .order("created_at", { ascending: false });

      if (issuesData) {
        const enrichedIssues = issuesData.map((issue: any) => ({
          ...issue,
          likesCount: issue.likes[0]?.count || 0,
          commentsCount: issue.comments[0]?.count || 0,
          repostsCount: issue.reposts[0]?.count || 0,
        }));
        setIssues(enrichedIssues);

        // Generate issues over time data (last 7 days)
        const now = new Date();
        const last7Days = Array.from({ length: 7 }, (_, i) => {
          const date = new Date(now);
          date.setDate(date.getDate() - (6 - i));
          return format(date, "MMM dd");
        });

        const issuesByDay = last7Days.map((day) => {
          const count = enrichedIssues.filter((issue: any) => 
            format(new Date(issue.created_at), "MMM dd") === day
          ).length;
          return { day, issues: count };
        });
        setIssuesOverTime(issuesByDay);

        // Generate tag distribution
        const tagCounts: Record<string, number> = {};
        enrichedIssues.forEach((issue: any) => {
          (issue.tags || []).forEach((tag: string) => {
            tagCounts[tag] = (tagCounts[tag] || 0) + 1;
          });
        });
        const tagData = Object.entries(tagCounts)
          .map(([name, value]) => ({ name, value }))
          .sort((a, b) => b.value - a.value)
          .slice(0, 5);
        setTagDistribution(tagData);
      }

      // Fetch users with suspension status
      const { data: usersData } = await supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false });

      const { data: suspensionsData } = await supabase
        .from("user_suspensions")
        .select("*")
        .eq("is_active", true);

      if (usersData) {
        const enrichedUsers = usersData.map((user: any) => {
          const suspension = suspensionsData?.find((s: any) => s.user_id === user.id);
          return {
            ...user,
            isSuspended: !!suspension,
            suspensionDetails: suspension || null,
          };
        });
        setUsers(enrichedUsers);

        // User growth over last 7 days
        const now = new Date();
        const last7Days = Array.from({ length: 7 }, (_, i) => {
          const date = subDays(now, 6 - i);
          return format(date, "MMM dd");
        });

        const usersByDay = last7Days.map((day) => {
          const count = enrichedUsers.filter((user: any) => 
            format(new Date(user.created_at), "MMM dd") === day
          ).length;
          return { day, users: count };
        });
        setUserGrowth(usersByDay);
      }

      // Fetch campaigns
      const { data: campaignsData } = await supabase
        .from("campaigns")
        .select(`
          *,
          profiles:creator_id (username),
          campaign_participants (count)
        `)
        .order("created_at", { ascending: false });

      if (campaignsData) {
        const enrichedCampaigns = campaignsData.map((campaign: any) => ({
          ...campaign,
          participantsCount: campaign.campaign_participants[0]?.count || 0,
        }));
        setCampaigns(enrichedCampaigns);
      }

      // Fetch stories
      const { data: storiesData } = await supabase
        .from("stories")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);

      if (storiesData) {
        const storyUserIds = [...new Set(storiesData.map((s: any) => s.user_id))];
        const { data: storyProfiles } = await supabase
          .from("profiles")
          .select("id, username, avatar_url")
          .in("id", storyUserIds);

        const profileMap = (storyProfiles || []).reduce((acc: any, p: any) => {
          acc[p.id] = p;
          return acc;
        }, {});

        const enrichedStories = await Promise.all(
          storiesData.map(async (story: any) => {
            const [{ count: viewsCount }, { count: likesCount }] = await Promise.all([
              supabase.from("story_views").select("*", { count: "exact", head: true }).eq("story_id", story.id),
              supabase.from("story_likes").select("*", { count: "exact", head: true }).eq("story_id", story.id),
            ]);
            return {
              ...story,
              profiles: profileMap[story.user_id] || { username: "Unknown", avatar_url: null },
              viewsCount: viewsCount || 0,
              likesCount: likesCount || 0,
            };
          })
        );
        setStories(enrichedStories);
      }

      // Fetch reports
      const { data: reportsData } = await supabase
        .from("user_reports")
        .select("*")
        .order("created_at", { ascending: false });

      if (reportsData) {
        const reporterIds = [...new Set(reportsData.map((r: any) => r.reporter_id))];
        const reportedUserIds = [...new Set(reportsData.filter((r: any) => r.reported_user_id).map((r: any) => r.reported_user_id))];
        const allUserIds = [...new Set([...reporterIds, ...reportedUserIds])];

        const { data: reportProfiles } = await supabase
          .from("profiles")
          .select("id, username, full_name, avatar_url")
          .in("id", allUserIds);

        const profileMap = (reportProfiles || []).reduce((acc: any, p: any) => {
          acc[p.id] = p;
          return acc;
        }, {});

        // Fetch reported issues
        const reportedIssueIds = [...new Set(reportsData.filter((r: any) => r.reported_issue_id).map((r: any) => r.reported_issue_id))];
        let issueMap: any = {};
        if (reportedIssueIds.length > 0) {
          const { data: reportedIssues } = await supabase
            .from("issues")
            .select("id, title, description, image_url, tags, created_at, user_id")
            .in("id", reportedIssueIds);
          
          if (reportedIssues) {
            const issueUserIds = [...new Set(reportedIssues.map((i: any) => i.user_id))];
            const { data: issueProfiles } = await supabase
              .from("profiles")
              .select("id, username")
              .in("id", issueUserIds);
            const issueProfileMap = (issueProfiles || []).reduce((acc: any, p: any) => { acc[p.id] = p; return acc; }, {});
            
            reportedIssues.forEach((issue: any) => {
              issueMap[issue.id] = { ...issue, profiles: issueProfileMap[issue.user_id] };
            });
          }
        }

        // Fetch reported comments
        const reportedCommentIds = [...new Set(reportsData.filter((r: any) => r.reported_comment_id).map((r: any) => r.reported_comment_id))];
        let commentMap: any = {};
        if (reportedCommentIds.length > 0) {
          const { data: reportedComments } = await supabase
            .from("comments")
            .select("id, content, created_at, user_id")
            .in("id", reportedCommentIds);
          
          if (reportedComments) {
            const commentUserIds = [...new Set(reportedComments.map((c: any) => c.user_id))];
            const { data: commentProfiles } = await supabase
              .from("profiles")
              .select("id, username")
              .in("id", commentUserIds);
            const commentProfileMap = (commentProfiles || []).reduce((acc: any, p: any) => { acc[p.id] = p; return acc; }, {});
            
            reportedComments.forEach((comment: any) => {
              commentMap[comment.id] = { ...comment, profiles: commentProfileMap[comment.user_id] };
            });
          }
        }

        const enrichedReports = reportsData.map((report: any) => ({
          ...report,
          reporter: profileMap[report.reporter_id],
          reported_user: report.reported_user_id ? profileMap[report.reported_user_id] : null,
          reported_issue: report.reported_issue_id ? issueMap[report.reported_issue_id] : null,
          reported_comment: report.reported_comment_id ? commentMap[report.reported_comment_id] : null,
        }));
        setReports(enrichedReports);
      }

      // Fetch announcements
      const { data: announcementsData } = await supabase
        .from("announcements")
        .select("*")
        .order("created_at", { ascending: false });

      if (announcementsData) {
        setAnnouncements(announcementsData);
      }

      // Fetch recent activity
      const { data: recentComments } = await supabase
        .from("comments")
        .select("*, profiles:user_id (username)")
        .order("created_at", { ascending: false })
        .limit(5);

      const { data: recentLikes } = await supabase
        .from("likes")
        .select("*, profiles:user_id (username)")
        .order("created_at", { ascending: false })
        .limit(5);

      const activities = [
        ...(recentComments || []).map((c: any) => ({ 
          type: "comment", 
          user: c.profiles?.username, 
          time: c.created_at,
          message: "commented on an issue"
        })),
        ...(recentLikes || []).map((l: any) => ({ 
          type: "like", 
          user: l.profiles?.username, 
          time: l.created_at,
          message: "liked an issue"
        })),
      ].sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime()).slice(0, 10);

      setRecentActivity(activities);

      // Engagement over time
      const engagementData = Array.from({ length: 7 }, (_, i) => {
        const date = subDays(new Date(), 6 - i);
        const dayStr = format(date, "MMM dd");
        return {
          day: dayStr,
          likes: Math.floor(Math.random() * 20) + 5,
          comments: Math.floor(Math.random() * 15) + 3,
        };
      });
      setEngagementOverTime(engagementData);

    } catch (error) {
      console.error("Error fetching dashboard data:", error);
      toast({ title: "Error loading data", variant: "destructive" });
    } finally {
      setDataLoading(false);
    }
  };

  const handleMarkSolved = async (issueId: string, currentStatus: boolean) => {
    try {
      await adminAction(password, "update_issue", {
        issue_id: issueId,
        updates: {
          is_solved: !currentStatus,
          solved_at: !currentStatus ? new Date().toISOString() : null,
          solved_by: null,
        },
      });

      toast({
        title: currentStatus ? "Issue reopened" : "Issue marked as solved",
      });

      setIssues(prev => prev.map(i => 
        i.id === issueId 
          ? { ...i, is_solved: !currentStatus, solved_at: !currentStatus ? new Date().toISOString() : null }
          : i
      ));
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const handleDeleteIssue = async (issueId: string) => {
    setDeleteLoading(true);
    try {
      await adminAction(password, "delete_issue", { issue_id: issueId });
      toast({ title: "Issue deleted successfully" });
      setIssues(prev => prev.filter(i => i.id !== issueId));
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setDeleteLoading(false);
      setDeleteConfirm(null);
    }
  };

  const handleDeleteStory = async (storyId: string) => {
    setDeleteLoading(true);
    try {
      await adminAction(password, "delete_story", { story_id: storyId });
      toast({ title: "Story deleted successfully" });
      setStories(prev => prev.filter(s => s.id !== storyId));
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setDeleteLoading(false);
      setDeleteConfirm(null);
    }
  };

  const handleDeleteCampaign = async (campaignId: string) => {
    setDeleteLoading(true);
    try {
      await adminAction(password, "delete_campaign", { campaign_id: campaignId });
      toast({ title: "Campaign deleted successfully" });
      setCampaigns(prev => prev.filter(c => c.id !== campaignId));
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setDeleteLoading(false);
      setDeleteConfirm(null);
    }
  };

  const handleDeleteAnnouncement = async (announcementId: string) => {
    setDeleteLoading(true);
    try {
      await adminAction(password, "delete_announcement", { announcement_id: announcementId });
      toast({ title: "Announcement deleted successfully" });
      setAnnouncements(prev => prev.filter(a => a.id !== announcementId));
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setDeleteLoading(false);
      setDeleteConfirm(null);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteConfirm) return;
    
    switch (deleteConfirm.type) {
      case "issue":
        await handleDeleteIssue(deleteConfirm.id);
        break;
      case "story":
        await handleDeleteStory(deleteConfirm.id);
        break;
      case "campaign":
        await handleDeleteCampaign(deleteConfirm.id);
        break;
      case "announcement":
        await handleDeleteAnnouncement(deleteConfirm.id);
        break;
    }
  };

  const handleSuspendUser = async () => {
    if (!selectedUser) return;

    try {
      let expiresAt = null;
      if (suspensionType === "temporary") {
        const duration = parseInt(suspensionDuration);
        if (suspensionUnit === "hours") {
          expiresAt = addHours(new Date(), duration).toISOString();
        } else {
          expiresAt = addDays(new Date(), duration).toISOString();
        }
      }

      await adminAction(password, "suspend_user", {
        user_id: selectedUser.id,
        suspension_type: suspensionType,
        reason: suspensionReason,
        expires_at: expiresAt,
      });

      toast({
        title: "User suspended",
        description: suspensionType === "permanent" 
          ? `${selectedUser.username} has been permanently banned.`
          : `${selectedUser.username} has been suspended for ${suspensionDuration} ${suspensionUnit}.`,
      });

      // Update local state
      setUsers(prev => prev.map(u => 
        u.id === selectedUser.id 
          ? { ...u, isSuspended: true, suspensionDetails: { suspension_type: suspensionType, reason: suspensionReason, expires_at: expiresAt } }
          : u
      ));
      setSuspendModalOpen(false);
      setSelectedUser(null);
      setSuspensionReason("");
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const handleUnsuspendUser = async (userId: string) => {
    try {
      await adminAction(password, "unsuspend_user", { user_id: userId });
      toast({ title: "User unsuspended", description: "User can now access the platform." });
      setUsers(prev => prev.map(u => 
        u.id === userId ? { ...u, isSuspended: false, suspensionDetails: null } : u
      ));
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const handleUpdateCampaignStatus = async (campaignId: string, newStatus: string) => {
    try {
      await adminAction(password, "update_campaign", {
        campaign_id: campaignId,
        updates: { status: newStatus },
      });
      toast({ title: "Campaign updated", description: `Status changed to ${newStatus}` });
      setCampaigns(prev => prev.map(c => 
        c.id === campaignId ? { ...c, status: newStatus } : c
      ));
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };


  const fetchEngagementDetails = async (issue: IssueWithDetails) => {
    setSelectedIssue(issue);
    
    const [{ data: likes }, { data: comments }] = await Promise.all([
      supabase
        .from("likes")
        .select(`*, profiles:user_id (username, full_name)`)
        .eq("issue_id", issue.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("comments")
        .select(`*, profiles:user_id (username, full_name)`)
        .eq("issue_id", issue.id)
        .order("created_at", { ascending: false }),
    ]);

    if (likes) setLikeDetails(likes);
    if (comments) setCommentDetails(comments);
    setEngagementModalOpen(true);
  };

  const fetchCampaignSupporters = async (campaign: Campaign) => {
    setSelectedCampaign(campaign);
    
    const { data: participants } = await supabase
      .from("campaign_participants")
      .select("id, joined_at, user_id")
      .eq("campaign_id", campaign.id)
      .order("joined_at", { ascending: false });

    if (participants && participants.length > 0) {
      const userIds = participants.map(p => p.user_id);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, username, full_name, avatar_url")
        .in("id", userIds);

      const enrichedParticipants = participants.map(p => ({
        ...p,
        profiles: profiles?.find(pr => pr.id === p.user_id)
      }));

      setCampaignSupporters(enrichedParticipants);
    } else {
      setCampaignSupporters([]);
    }
    
    setSupportersModalOpen(true);
  };

  // Notification handlers
  const handleSendNotification = async () => {
    if (!notificationTitle || !notificationMessage) {
      toast({ title: "Please fill all required fields", variant: "destructive" });
      return;
    }

    try {
      const targetUserIds = notificationTarget === "all" 
        ? users.map(u => u.id)
        : selectedUserIds;

      if (targetUserIds.length === 0) {
        toast({ title: "No users selected", variant: "destructive" });
        return;
      }

      const notifications = targetUserIds.map(userId => ({
        user_id: userId,
        title: notificationTitle,
        message: notificationMessage,
        type: "admin_notification",
        link: null,
      }));

      await adminAction(password, "send_notifications", { notifications });

      toast({ 
        title: "Notifications sent", 
        description: `Sent to ${targetUserIds.length} user(s)` 
      });
      setNotificationModalOpen(false);
      setNotificationTitle("");
      setNotificationMessage("");
      setSelectedUserIds([]);
      setNotificationTarget("all");
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const toggleUserSelection = (userId: string) => {
    setSelectedUserIds(prev => 
      prev.includes(userId) 
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  // Login Screen
if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <img
              src="/easy-access.png"
              alt="Campus Voice"
              loading="lazy"
              className="h-14 w-14 rounded-xl object-cover shadow-glow mx-auto mb-4"
            />
            <CardTitle className="text-2xl">Campus Voice Admin</CardTitle>
            <p className="text-muted-foreground">Enter password to access the dashboard</p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter admin password"
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Shield className="h-4 w-4 mr-2" />}
                Access Dashboard
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }


  // Dashboard Loading
  if (dataLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
   <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border/40">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-14 h-14 rounded-xl overflow-hidden bg-gradient-to-br from-primary to-secondary">
              <img
                src="/logo.png"
                alt="Campus Voice"
                loading="lazy"
                className="w-full h-full object-cover"
              />
            </div>
            <div>
              <h1 className="text-xl font-bold"><div
                className="text-2xl font-extrabold tracking-wide bg-gradient-to-r from-orange-500 via-pink-500 to-blue-500 text-transparent bg-clip-text"
                style={{ fontFamily: "'Nixmat', sans-serif" }}
              >
                Campus Voice
              </div></h1>
              <p className="text-sm text-muted-foreground">Admin Dashboard</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={fetchDashboardData}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          <Button variant="outline" onClick={handleLogout}>
            <LogOut className="h-4 w-4 mr-2" />
            Logout
          </Button>
        </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Stats Cards - Extended */}
        <div className="grid grid-cols-2 md:grid-cols-5 lg:grid-cols-7 gap-4 mb-8">
          <Card className="hover-lift">
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Users className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="text-xl font-bold">{stats.totalUsers}</p>
                  <p className="text-[10px] text-muted-foreground">Users</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="hover-lift">
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-secondary/10">
                  <FileText className="h-4 w-4 text-secondary" />
                </div>
                <div>
                  <p className="text-xl font-bold">{stats.totalIssues}</p>
                  <p className="text-[10px] text-muted-foreground">Issues</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="hover-lift">
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-green-500/10">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                </div>
                <div>
                  <p className="text-xl font-bold">{stats.solvedIssues}</p>
                  <p className="text-[10px] text-muted-foreground">Solved</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="hover-lift">
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-rose-500/10">
                  <Heart className="h-4 w-4 text-rose-500" />
                </div>
                <div>
                  <p className="text-xl font-bold">{stats.totalLikes}</p>
                  <p className="text-[10px] text-muted-foreground">Likes</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="hover-lift">
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-blue-500/10">
                  <MessageSquare className="h-4 w-4 text-blue-500" />
                </div>
                <div>
                  <p className="text-xl font-bold">{stats.totalComments}</p>
                  <p className="text-[10px] text-muted-foreground">Comments</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="hover-lift">
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-amber-500/10">
                  <Megaphone className="h-4 w-4 text-amber-500" />
                </div>
                <div>
                  <p className="text-xl font-bold">{stats.activeCampaigns}</p>
                  <p className="text-[10px] text-muted-foreground">Campaigns</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="hover-lift">
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-red-500/10">
                  <Ban className="h-4 w-4 text-red-500" />
                </div>
                <div>
                  <p className="text-xl font-bold">{stats.suspendedUsers}</p>
                  <p className="text-[10px] text-muted-foreground">Suspended</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <div className="flex flex-wrap gap-3 mb-8">
          
          <Button onClick={() => setNotificationModalOpen(true)} variant="secondary" className="gap-2">
            <Bell className="h-4 w-4" />
            Send Notification
          </Button>
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Issues Over Time
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={issuesOverTime}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="day" stroke="hsl(var(--muted-foreground))" fontSize={10} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={10} />
                  <Tooltip contentStyle={{ backgroundColor: "hsl(var(--background))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }} />
                  <Area type="monotone" dataKey="issues" stroke="hsl(var(--primary))" fill="hsl(var(--primary) / 0.2)" />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                User Growth
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={userGrowth}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="day" stroke="hsl(var(--muted-foreground))" fontSize={10} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={10} />
                  <Tooltip contentStyle={{ backgroundColor: "hsl(var(--background))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }} />
                  <Line type="monotone" dataKey="users" stroke="hsl(var(--secondary))" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

           <Card>
            <CardHeader>
              <CardTitle className="text-lg">Top Tags Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={tagDistribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={5}
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  >
                    {tagDistribution.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Recent Activity & Quick Actions */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Recent Activity
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[200px]">
                <div className="space-y-3">
                  {recentActivity.map((activity, idx) => (
                    <div key={idx} className="flex items-center gap-3 p-2 rounded-lg bg-muted/30">
                      <div className={`p-2 rounded-full ${activity.type === 'like' ? 'bg-rose-500/10' : 'bg-blue-500/10'}`}>
                        {activity.type === 'like' ? (
                          <Heart className="h-3 w-3 text-rose-500" />
                        ) : (
                          <MessageSquare className="h-3 w-3 text-blue-500" />
                        )}
                      </div>
                      <div className="flex-1">
                        <p className="text-sm"><span className="font-medium">{activity.user}</span> {activity.message}</p>
                        <p className="text-xs text-muted-foreground">{format(new Date(activity.time), "MMM d, HH:mm")}</p>
                      </div>
                    </div>
                  ))}
                  {recentActivity.length === 0 && (
                    <p className="text-center text-muted-foreground py-8">No recent activity</p>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
         

        {/* Main Tabs */}
        <Tabs defaultValue="issues" className="space-y-6">
          <TabsList className="bg-muted/50 flex-wrap h-auto gap-1 p-1">
            <TabsTrigger value="issues" className="text-xs md:text-sm">Issues ({issues.length})</TabsTrigger>
            <TabsTrigger value="users" className="text-xs md:text-sm">Users ({users.length})</TabsTrigger>
            <TabsTrigger value="campaigns" className="text-xs md:text-sm">Campaigns ({campaigns.length})</TabsTrigger>
            <TabsTrigger value="stories" className="text-xs md:text-sm">Stories ({stories.length})</TabsTrigger>
            <TabsTrigger value="reports" className="text-xs md:text-sm">
              Reports 
              {stats.pendingReports > 0 && (
                <Badge variant="destructive" className="ml-1 h-5 px-1.5 text-[10px]">{stats.pendingReports}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="announcements" className="text-xs md:text-sm">Announcements</TabsTrigger>
          </TabsList>

          {/* Issues Tab */}
          <TabsContent value="issues">
            <Card>
              <CardHeader>
                <CardTitle>Issue Management</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="rounded-lg border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Title</TableHead>
                        <TableHead>Author</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Engagement</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {issues.slice(0, 20).map((issue) => (
                        <TableRow key={issue.id}>
                          <TableCell 
                            className="font-medium max-w-[200px] truncate cursor-pointer hover:text-primary"
                            onClick={() => setPreviewIssue(issue)}
                          >
                            {issue.title}
                          </TableCell>
                          <TableCell>{issue.profiles?.username || "Unknown"}</TableCell>
                          <TableCell>
                            <Badge variant={issue.is_solved ? "default" : "secondary"}>
                              {issue.is_solved ? "Solved" : "Open"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-xs"
                              onClick={() => fetchEngagementDetails(issue)}
                            >
                              <Eye className="h-3 w-3 mr-1" />
                              ❤️ {issue.likesCount} · 💬 {issue.commentsCount}
                            </Button>
                          </TableCell>
                          <TableCell className="text-sm">{format(new Date(issue.created_at), "MMM d, yyyy")}</TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <Button size="sm" variant="outline" onClick={() => setPreviewIssue(issue)}>
                                <Eye className="h-3 w-3 mr-1" />
                                View
                              </Button>
                              <Button size="sm" variant={issue.is_solved ? "outline" : "default"} onClick={() => handleMarkSolved(issue.id, issue.is_solved)}>
                                {issue.is_solved ? "Reopen" : "Solve"}
                              </Button>
                              <Button size="sm" variant="destructive" onClick={() => setDeleteConfirm({ type: "issue", id: issue.id })}>
                                Delete
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Users Tab */}
          <TabsContent value="users">
            <Card>
              <CardHeader>
                <CardTitle>User Management</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="rounded-lg border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>User</TableHead>
                        <TableHead>Full Name</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Joined</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {users.map((user) => (
                        <TableRow key={user.id}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Avatar className="h-8 w-8">
                                <AvatarImage src={user.avatar_url || undefined} />
                                <AvatarFallback>{user.username[0].toUpperCase()}</AvatarFallback>
                              </Avatar>
                              <span className="font-medium">{user.username}</span>
                            </div>
                          </TableCell>
                          <TableCell>{user.full_name || "-"}</TableCell>
                          <TableCell>{user.role || "Student"}</TableCell>
                          <TableCell>
                            {user.isSuspended ? (
                              <Badge variant="destructive">
                                {user.suspensionDetails?.suspension_type === "permanent" ? "Banned" : "Suspended"}
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-green-600 border-green-600">Active</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-sm">{format(new Date(user.created_at), "MMM d, yyyy")}</TableCell>
                          <TableCell>
                            {user.isSuspended ? (
                              <Button size="sm" variant="outline" onClick={() => handleUnsuspendUser(user.id)}>
                                <UserX className="h-4 w-4 mr-1" />
                                Unsuspend
                              </Button>
                            ) : (
                              <Button size="sm" variant="destructive" onClick={() => { setSelectedUser(user); setSuspendModalOpen(true); }}>
                                <Ban className="h-4 w-4 mr-1" />
                                Suspend
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Campaigns Tab */}
          <TabsContent value="campaigns">
            <Card>
              <CardHeader>
                <CardTitle>Campaign Management</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="rounded-lg border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Title</TableHead>
                        <TableHead>Creator</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Supporters</TableHead>
                        <TableHead>Created</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {campaigns.map((campaign) => (
                        <TableRow key={campaign.id}>
                          <TableCell className="font-medium max-w-[200px] truncate">{campaign.title}</TableCell>
                          <TableCell>{campaign.profiles?.username || "Unknown"}</TableCell>
                          <TableCell>
                            <Badge variant={campaign.status === "active" ? "default" : campaign.status === "completed" ? "secondary" : "destructive"}>
                              {campaign.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-xs"
                              onClick={() => fetchCampaignSupporters(campaign)}
                            >
                              <Eye className="h-3 w-3 mr-1" />
                              {campaign.participantsCount} supporters
                            </Button>
                          </TableCell>
                          <TableCell className="text-sm">{format(new Date(campaign.created_at), "MMM d, yyyy")}</TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <Select defaultValue={campaign.status} onValueChange={(value) => handleUpdateCampaignStatus(campaign.id, value)}>
                                <SelectTrigger className="w-[100px] h-8">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="active">Active</SelectItem>
                                  <SelectItem value="completed">Completed</SelectItem>
                                  <SelectItem value="cancelled">Cancelled</SelectItem>
                                </SelectContent>
                              </Select>
                              <Button size="sm" variant="destructive" onClick={() => setDeleteConfirm({ type: "campaign", id: campaign.id })}>
                                Delete
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Stories Tab - NEW */}
          <TabsContent value="stories">
            <Card>
              <CardHeader>
                <CardTitle>Story Management</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="rounded-lg border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>User</TableHead>
                        <TableHead>Preview</TableHead>
                        <TableHead>Caption</TableHead>
                        <TableHead>Views</TableHead>
                        <TableHead>Likes</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Created</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {stories.map((story) => (
                        <TableRow key={story.id}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Avatar className="h-8 w-8">
                                <AvatarImage src={story.profiles?.avatar_url || undefined} />
                                <AvatarFallback>{story.profiles?.username?.[0]?.toUpperCase() || "?"}</AvatarFallback>
                              </Avatar>
                              <span className="font-medium">{story.profiles?.username || "Unknown"}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <img 
                              src={story.image_url} 
                              alt="" 
                              className="h-12 w-12 rounded object-cover cursor-pointer hover:opacity-80"
                              onClick={async () => {
                                setPreviewStory(story);
                                // Fetch viewers and likers
                                const [{ data: views }, { data: likes }] = await Promise.all([
                                  supabase.from("story_views").select("id, viewed_at, viewer_id").eq("story_id", story.id),
                                  supabase.from("story_likes").select("id, created_at, user_id").eq("story_id", story.id),
                                ]);
                                const viewerIds = views?.map(v => v.viewer_id) || [];
                                const likerIds = likes?.map(l => l.user_id) || [];
                                const allIds = [...new Set([...viewerIds, ...likerIds])];
                                if (allIds.length > 0) {
                                  const { data: profiles } = await supabase.from("profiles").select("id, username, avatar_url").in("id", allIds);
                                  const profileMap = (profiles || []).reduce((acc: any, p: any) => { acc[p.id] = p; return acc; }, {});
                                  setStoryViewers((views || []).map(v => ({ ...v, profiles: profileMap[v.viewer_id] })));
                                  setStoryLikers((likes || []).map(l => ({ ...l, profiles: profileMap[l.user_id] })));
                                } else {
                                  setStoryViewers([]);
                                  setStoryLikers([]);
                                }
                              }}
                            />
                          </TableCell>
                          <TableCell className="max-w-[150px] truncate">{story.caption || "-"}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Eye className="h-3 w-3" />
                              {story.viewsCount}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Heart className="h-3 w-3 text-rose-500" />
                              {story.likesCount}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant={new Date(story.expires_at) > new Date() ? "default" : "secondary"}>
                              {new Date(story.expires_at) > new Date() ? "Active" : "Expired"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm">{format(new Date(story.created_at), "MMM d, HH:mm")}</TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <Button 
                                size="sm" 
                                variant="outline"
                                onClick={async () => {
                                  setPreviewStory(story);
                                  const [{ data: views }, { data: likes }] = await Promise.all([
                                    supabase.from("story_views").select("id, viewed_at, viewer_id").eq("story_id", story.id),
                                    supabase.from("story_likes").select("id, created_at, user_id").eq("story_id", story.id),
                                  ]);
                                  const viewerIds = views?.map(v => v.viewer_id) || [];
                                  const likerIds = likes?.map(l => l.user_id) || [];
                                  const allIds = [...new Set([...viewerIds, ...likerIds])];
                                  if (allIds.length > 0) {
                                    const { data: profiles } = await supabase.from("profiles").select("id, username, avatar_url").in("id", allIds);
                                    const profileMap = (profiles || []).reduce((acc: any, p: any) => { acc[p.id] = p; return acc; }, {});
                                    setStoryViewers((views || []).map(v => ({ ...v, profiles: profileMap[v.viewer_id] })));
                                    setStoryLikers((likes || []).map(l => ({ ...l, profiles: profileMap[l.user_id] })));
                                  } else {
                                    setStoryViewers([]);
                                    setStoryLikers([]);
                                  }
                                }}
                              >
                                <Eye className="h-3 w-3 mr-1" />
                                View
                              </Button>
                              <Button size="sm" variant="destructive" onClick={() => setDeleteConfirm({ type: "story", id: story.id })}>
                                Delete
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Reports Tab */}
          <TabsContent value="reports">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Flag className="h-5 w-5" />
                  User Reports
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {reports.map((report) => (
                    <Card key={report.id} className="p-4 border-border/50">
                      <div className="flex flex-col gap-3">
                        {/* Report Header */}
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <div className="flex items-center gap-2">
                            <Avatar className="h-7 w-7">
                              <AvatarImage src={report.reporter?.avatar_url || undefined} />
                              <AvatarFallback className="text-xs">{report.reporter?.username?.[0]?.toUpperCase() || "?"}</AvatarFallback>
                            </Avatar>
                            <div>
                              <span className="font-medium text-sm">{report.reporter?.username || "Unknown"}</span>
                              <span className="text-xs text-muted-foreground ml-1">reported</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-xs">{report.report_type}</Badge>
                            <Badge 
                              variant={
                                report.status === "pending" ? "secondary" : 
                                report.status === "resolved" ? "default" : "destructive"
                              }
                              className="text-xs"
                            >
                              {report.status}
                            </Badge>
                            <span className="text-xs text-muted-foreground">{format(new Date(report.created_at), "MMM d, yyyy")}</span>
                          </div>
                        </div>

                        {/* Reason */}
                        <div className="bg-muted/30 rounded-lg p-3">
                          <p className="text-sm font-medium">{report.reason}</p>
                          {report.description && (
                            <p className="text-xs text-muted-foreground mt-1">{report.description}</p>
                          )}
                        </div>

                        {/* Reported Content Preview */}
                        {report.reported_user && (
                          <div className="border rounded-xl p-3 bg-card">
                            <p className="text-xs text-muted-foreground mb-2 font-medium">Reported User</p>
                            <div className="flex items-center gap-3">
                              <Avatar className="h-10 w-10">
                                <AvatarImage src={report.reported_user.avatar_url || undefined} />
                                <AvatarFallback>{report.reported_user.username?.[0]?.toUpperCase() || "?"}</AvatarFallback>
                              </Avatar>
                              <div>
                                <p className="font-semibold text-sm">{report.reported_user.full_name || report.reported_user.username}</p>
                                <p className="text-xs text-muted-foreground">@{report.reported_user.username}</p>
                              </div>
                            </div>
                          </div>
                        )}

                        {report.reported_issue && (
                          <div className="border rounded-xl p-3 bg-card">
                            <p className="text-xs text-muted-foreground mb-2 font-medium">Reported Issue</p>
                            <div className="space-y-2">
                              <h4 className="font-semibold text-sm">{report.reported_issue.title}</h4>
                              <p className="text-xs text-muted-foreground line-clamp-3">{report.reported_issue.description}</p>
                              {report.reported_issue.image_url && (
                                <img src={report.reported_issue.image_url} alt="" className="h-24 w-full object-cover rounded-lg" />
                              )}
                              {report.reported_issue.tags && report.reported_issue.tags.length > 0 && (
                                <div className="flex flex-wrap gap-1">
                                  {report.reported_issue.tags.slice(0, 3).map((tag: string) => (
                                    <Badge key={tag} variant="secondary" className="text-[10px] px-1.5 py-0">{tag}</Badge>
                                  ))}
                                </div>
                              )}
                              <p className="text-[10px] text-muted-foreground">
                                by @{report.reported_issue.profiles?.username || "unknown"} • {format(new Date(report.reported_issue.created_at), "MMM d, yyyy")}
                              </p>
                            </div>
                          </div>
                        )}

                        {report.reported_comment && (
                          <div className="border rounded-xl p-3 bg-card">
                            <p className="text-xs text-muted-foreground mb-2 font-medium">Reported Comment</p>
                            <div className="bg-muted/50 rounded-lg p-2.5">
                              <p className="text-sm">{report.reported_comment.content}</p>
                              <p className="text-[10px] text-muted-foreground mt-1">
                                by @{report.reported_comment.profiles?.username || "unknown"} • {format(new Date(report.reported_comment.created_at), "MMM d")}
                              </p>
                            </div>
                          </div>
                        )}

                        {/* Actions */}
                        <div className="flex items-center gap-2 pt-1">
                          <Select 
                            defaultValue={report.status} 
                            onValueChange={async (value) => {
                              try {
                                await adminAction(password, "update_report", { report_id: report.id, updates: { status: value } });
                                setReports(prev => prev.map(r => r.id === report.id ? { ...r, status: value } : r));
                                toast({ title: "Report status updated" });
                              } catch (e: any) {
                                toast({ title: "Error", description: e.message, variant: "destructive" });
                              }
                            }}
                          >
                            <SelectTrigger className="w-[120px] h-8 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="pending">Pending</SelectItem>
                              <SelectItem value="reviewing">Reviewing</SelectItem>
                              <SelectItem value="resolved">Resolved</SelectItem>
                              <SelectItem value="dismissed">Dismissed</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </Card>
                  ))}
                  {reports.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      No reports yet
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Announcements Tab */}
          <TabsContent value="announcements">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Megaphone className="h-5 w-5" />
                  Announcements Management
                </CardTitle>
                <Button size="sm" onClick={() => setCreateAnnouncementOpen(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    New Announcement
                  </Button>
              </CardHeader>
              <CardContent>
                <div className="rounded-lg border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Title</TableHead>
                        <TableHead>Priority</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Scheduled</TableHead>
                        <TableHead>Expires</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {announcements.map((announcement) => (
                        <TableRow key={announcement.id}>
                          <TableCell>
                            <div>
                              <span className="font-medium">{announcement.title}</span>
                              <p className="text-xs text-muted-foreground truncate max-w-[200px]">{announcement.content}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge 
                              variant={
                                announcement.priority === "urgent" ? "destructive" : 
                                announcement.priority === "high" ? "secondary" : "outline"
                              }
                            >
                              {announcement.priority}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Switch
                                checked={announcement.is_active}
                                onCheckedChange={async (checked) => {
                                  try {
                                    await adminAction(password, "update_announcement", { announcement_id: announcement.id, updates: { is_active: checked } });
                                    setAnnouncements(prev => prev.map(a => 
                                      a.id === announcement.id ? { ...a, is_active: checked } : a
                                    ));
                                    toast({ title: checked ? "Announcement activated" : "Announcement deactivated" });
                                  } catch (e: any) {
                                    toast({ title: "Error", description: e.message, variant: "destructive" });
                                  }
                                }}
                              />
                              <span className="text-xs">{announcement.is_active ? "Active" : "Inactive"}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-sm">
                            {announcement.scheduled_at ? (
                              <div className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                {format(new Date(announcement.scheduled_at), "MMM d, HH:mm")}
                              </div>
                            ) : (
                              <span className="text-muted-foreground">Immediate</span>
                            )}
                          </TableCell>
                          <TableCell className="text-sm">
                            {announcement.expires_at ? format(new Date(announcement.expires_at), "MMM d, yyyy") : "Never"}
                          </TableCell>
                          <TableCell>
                            <Button 
                              size="sm" 
                              variant="destructive"
                              onClick={() => setDeleteConfirm({ type: "announcement", id: announcement.id })}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                      {announcements.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                            No announcements yet
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      {/* Suspend User Modal */}
      <Dialog open={suspendModalOpen} onOpenChange={setSuspendModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Suspend User: {selectedUser?.username}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Suspension Type</Label>
              <Select value={suspensionType} onValueChange={(v: "temporary" | "permanent") => setSuspensionType(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="temporary">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      Temporary Suspension
                    </div>
                  </SelectItem>
                  <SelectItem value="permanent">
                    <div className="flex items-center gap-2">
                      <Ban className="h-4 w-4" />
                      Permanent Ban
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {suspensionType === "temporary" && (
              <div className="flex gap-2">
                <div className="flex-1 space-y-2">
                  <Label>Duration</Label>
                  <Input type="number" min="1" value={suspensionDuration} onChange={(e) => setSuspensionDuration(e.target.value)} />
                </div>
                <div className="flex-1 space-y-2">
                  <Label>Unit</Label>
                  <Select value={suspensionUnit} onValueChange={(v: "hours" | "days") => setSuspensionUnit(v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="hours">Hours</SelectItem>
                      <SelectItem value="days">Days</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label>Reason (optional)</Label>
              <Textarea placeholder="Enter reason for suspension..." value={suspensionReason} onChange={(e) => setSuspensionReason(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSuspendModalOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleSuspendUser}>
              {suspensionType === "permanent" ? "Ban User" : "Suspend User"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Engagement Details Modal */}
      <Dialog open={engagementModalOpen} onOpenChange={setEngagementModalOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Engagement Details: {selectedIssue?.title}</DialogTitle>
          </DialogHeader>
          <Tabs defaultValue="likes" className="w-full">
            <TabsList className="w-full">
              <TabsTrigger value="likes" className="flex-1">
                ❤️ Upvotes ({likeDetails.length})
              </TabsTrigger>
              <TabsTrigger value="comments" className="flex-1">
                💬 Comments ({commentDetails.length})
              </TabsTrigger>
            </TabsList>
            <TabsContent value="likes" className="mt-4">
              {likeDetails.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">No upvotes yet</p>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {likeDetails.map((like) => (
                    <div key={like.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                      <div className="flex items-center gap-2">
                        <Heart className="h-4 w-4 text-rose-500" />
                        <span className="font-medium">{like.profiles?.username || "Unknown"}</span>
                        {like.profiles?.full_name && (
                          <span className="text-muted-foreground text-sm">({like.profiles.full_name})</span>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(like.created_at), "MMM d, yyyy HH:mm")}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
            <TabsContent value="comments" className="mt-4">
              {commentDetails.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">No comments yet</p>
              ) : (
                <div className="space-y-3 max-h-60 overflow-y-auto">
                  {commentDetails.map((comment) => (
                    <div key={comment.id} className="p-3 rounded-lg bg-muted/50 space-y-1">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <MessageSquare className="h-4 w-4 text-blue-500" />
                          <span className="font-medium">{comment.profiles?.username || "Unknown"}</span>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(comment.created_at), "MMM d, yyyy HH:mm")}
                        </span>
                      </div>
                      <p className="text-sm text-foreground pl-6">{comment.content}</p>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* Campaign Supporters Modal */}
      <Dialog open={supportersModalOpen} onOpenChange={setSupportersModalOpen}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Campaign Supporters: {selectedCampaign?.title}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            {campaignSupporters.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">No supporters yet</p>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {campaignSupporters.map((supporter) => (
                  <div key={supporter.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={supporter.profiles?.avatar_url} />
                        <AvatarFallback>{supporter.profiles?.username?.[0]?.toUpperCase() || "?"}</AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium text-sm">{supporter.profiles?.username || "Unknown"}</p>
                        {supporter.profiles?.full_name && (
                          <p className="text-xs text-muted-foreground">{supporter.profiles.full_name}</p>
                        )}
                      </div>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      Joined {format(new Date(supporter.joined_at), "MMM d, yyyy")}
                    </span>
                  </div>
                ))}
              </div>
            )}
            <div className="pt-4 border-t">
              <p className="text-sm text-muted-foreground text-center">
                Total: {campaignSupporters.length} supporter{campaignSupporters.length !== 1 ? "s" : ""}
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    

{/* Send Notification Modal */}
      <Dialog open={notificationModalOpen} onOpenChange={setNotificationModalOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Send Custom Notification</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Title *</Label>
              <Input
                placeholder="Notification title"
                value={notificationTitle}
                onChange={(e) => setNotificationTitle(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Message *</Label>
              <Textarea
                placeholder="Notification message..."
                value={notificationMessage}
                onChange={(e) => setNotificationMessage(e.target.value)}
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label>Send To</Label>
              <Select value={notificationTarget} onValueChange={(v: "all" | "selected") => setNotificationTarget(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Users ({users.length})</SelectItem>
                  <SelectItem value="selected">Selected Users</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {notificationTarget === "selected" && (
              <div className="space-y-2">
                <Label>Select Users ({selectedUserIds.length} selected)</Label>
                <ScrollArea className="h-[200px] border rounded-lg p-2">
                  <div className="space-y-2">
                    {users.map((user) => (
                      <div
                        key={user.id}
                        className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 cursor-pointer"
                        onClick={() => toggleUserSelection(user.id)}
                      >
                        <Checkbox
                          checked={selectedUserIds.includes(user.id)}
                          onCheckedChange={() => toggleUserSelection(user.id)}
                        />
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={user.avatar_url || undefined} />
                          <AvatarFallback>{user.username[0].toUpperCase()}</AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium text-sm">{user.username}</p>
                          {user.full_name && <p className="text-xs text-muted-foreground">{user.full_name}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNotificationModalOpen(false)}>Cancel</Button>
            <Button onClick={handleSendNotification}>
              <Send className="h-4 w-4 mr-2" />
              Send Notification
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Issue Preview Modal */}
      <Dialog open={!!previewIssue} onOpenChange={() => setPreviewIssue(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Issue Preview
            </DialogTitle>
          </DialogHeader>
          {previewIssue && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10">
                  <AvatarFallback>{previewIssue.profiles?.username?.[0]?.toUpperCase() || "?"}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium">{previewIssue.profiles?.username || "Unknown"}</p>
                  <p className="text-xs text-muted-foreground">{format(new Date(previewIssue.created_at), "MMM d, yyyy HH:mm")}</p>
                </div>
                <Badge variant={previewIssue.is_solved ? "default" : "secondary"} className="ml-auto">
                  {previewIssue.is_solved ? "Solved" : "Open"}
                </Badge>
              </div>
              <div>
                <h3 className="text-lg font-semibold mb-2">{previewIssue.title}</h3>
                <p className="text-muted-foreground whitespace-pre-wrap">{previewIssue.description}</p>
              </div>
              {previewIssue.tags && previewIssue.tags.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {previewIssue.tags.map((tag) => (
                    <Badge key={tag} variant="outline">#{tag}</Badge>
                  ))}
                </div>
              )}
              <div className="flex items-center gap-4 pt-4 border-t">
                <div className="flex items-center gap-1">
                  <Heart className="h-4 w-4 text-rose-500" />
                  <span className="text-sm">{previewIssue.likesCount} likes</span>
                </div>
                <div className="flex items-center gap-1">
                  <MessageSquare className="h-4 w-4 text-blue-500" />
                  <span className="text-sm">{previewIssue.commentsCount} comments</span>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Story Preview Modal */}
      <Dialog open={!!previewStory} onOpenChange={() => setPreviewStory(null)}>
        <DialogContent className="max-w-lg p-0 overflow-hidden bg-black border-0">
          {previewStory && (
            <div className="relative">
              <img src={previewStory.image_url} alt="Story" className="w-full max-h-[60vh] object-contain" />
              <div className="absolute top-4 left-4 right-4 flex items-center justify-between">
                <div className="flex items-center gap-2 bg-black/50 backdrop-blur-sm px-3 py-2 rounded-full">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={previewStory.profiles?.avatar_url || undefined} />
                    <AvatarFallback>{previewStory.profiles?.username?.[0]?.toUpperCase() || "?"}</AvatarFallback>
                  </Avatar>
                  <span className="text-white text-sm font-medium">{previewStory.profiles?.username}</span>
                </div>
              </div>
              {previewStory.caption && (
                <div className="p-4 bg-black text-white">
                  <p className="text-sm">{previewStory.caption}</p>
                </div>
              )}
              <div className="p-4 bg-background">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                      <Eye className="h-4 w-4" /> Views ({storyViewers.length})
                    </h4>
                    <ScrollArea className="max-h-32">
                      <div className="space-y-2">
                        {storyViewers.map((view: any) => (
                          <div key={view.id} className="flex items-center gap-2">
                            <Avatar className="h-6 w-6">
                              <AvatarImage src={view.profiles?.avatar_url} />
                              <AvatarFallback>{view.profiles?.username?.[0]?.toUpperCase() || "?"}</AvatarFallback>
                            </Avatar>
                            <span className="text-xs">{view.profiles?.username || "Unknown"}</span>
                          </div>
                        ))}
                        {storyViewers.length === 0 && <p className="text-xs text-muted-foreground">No views</p>}
                      </div>
                    </ScrollArea>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                      <Heart className="h-4 w-4 text-rose-500" /> Likes ({storyLikers.length})
                    </h4>
                    <ScrollArea className="max-h-32">
                      <div className="space-y-2">
                        {storyLikers.map((like: any) => (
                          <div key={like.id} className="flex items-center gap-2">
                            <Avatar className="h-6 w-6">
                              <AvatarImage src={like.profiles?.avatar_url} />
                              <AvatarFallback>{like.profiles?.username?.[0]?.toUpperCase() || "?"}</AvatarFallback>
                            </Avatar>
                            <span className="text-xs">{like.profiles?.username || "Unknown"}</span>
                          </div>
                        ))}
                        {storyLikers.length === 0 && <p className="text-xs text-muted-foreground">No likes</p>}
                      </div>
                    </ScrollArea>
                  </div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Confirm Delete Dialog */}
      <ConfirmDialog
        open={!!deleteConfirm}
        onOpenChange={(open) => !open && setDeleteConfirm(null)}
        title={`Delete ${deleteConfirm?.type || "item"}?`}
        description={`Are you sure you want to delete this ${deleteConfirm?.type || "item"}? This action cannot be undone.`}
        confirmLabel="Delete"
        onConfirm={handleConfirmDelete}
        variant="destructive"
        loading={deleteLoading}
      />

      {/* Create Announcement Modal */}
      <CreateAnnouncementModal
        open={createAnnouncementOpen}
        onOpenChange={setCreateAnnouncementOpen}
        adminPassword={password}
        onSuccess={() => {
          supabase.from("announcements").select("*").order("created_at", { ascending: false }).then(({ data }) => {
            if (data) setAnnouncements(data);
          });
        }}
      />
    </div>
  );
};

export default AdminDashboard;
