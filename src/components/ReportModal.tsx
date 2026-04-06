import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/hooks/use-toast";
import { AlertTriangle, Flag, Loader2 } from "lucide-react";

interface ReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  reportType: "user" | "issue" | "comment";
  targetId: string;
  targetName?: string;
  reporterId: string;
}

const REPORT_REASONS = [
  { value: "spam", label: "Spam or misleading", description: "Fake content or promotions" },
  { value: "harassment", label: "Harassment or bullying", description: "Targeting someone with abuse" },
  { value: "hate_speech", label: "Hate speech", description: "Attacks based on identity" },
  { value: "violence", label: "Violence or threats", description: "Promoting or depicting harm" },
  { value: "inappropriate", label: "Inappropriate content", description: "Adult or explicit material" },
  { value: "impersonation", label: "Impersonation", description: "Pretending to be someone else" },
  { value: "other", label: "Other", description: "Something else not listed" },
];

const ReportModal = ({
  isOpen,
  onClose,
  reportType,
  targetId,
  targetName,
  reporterId,
}: ReportModalProps) => {
  const { toast } = useToast();
  const [reason, setReason] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!reason) {
      toast({ title: "Please select a reason", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const reportData: any = {
        reporter_id: reporterId,
        report_type: reportType,
        reason,
        description: description || null,
      };

      if (reportType === "user") {
        reportData.reported_user_id = targetId;
      } else if (reportType === "issue") {
        reportData.reported_issue_id = targetId;
      } else if (reportType === "comment") {
        reportData.reported_comment_id = targetId;
      }

      const { error } = await supabase.from("user_reports").insert(reportData);

      if (error) throw error;

      toast({
        title: "Report submitted",
        description: "Thank you. We'll review this and take appropriate action.",
      });
      onClose();
      setReason("");
      setDescription("");
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Flag className="h-5 w-5 text-destructive" />
            Report {reportType === "user" ? "User" : reportType === "issue" ? "Issue" : "Comment"}
          </DialogTitle>
        </DialogHeader>

        {targetName && (
          <div className="bg-muted/50 rounded-lg p-3 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">
              Reporting: <span className="font-medium text-foreground">{targetName}</span>
            </span>
          </div>
        )}

        <div className="space-y-4">
          <div className="space-y-3">
            <Label>Why are you reporting this?</Label>
            <RadioGroup value={reason} onValueChange={setReason}>
              {REPORT_REASONS.map((r) => (
                <label
                  key={r.value}
                  className="flex items-start gap-3 p-3 rounded-lg border border-border hover:bg-muted/50 cursor-pointer transition-colors"
                >
                  <RadioGroupItem value={r.value} className="mt-0.5" />
                  <div>
                    <p className="font-medium text-sm">{r.label}</p>
                    <p className="text-xs text-muted-foreground">{r.description}</p>
                  </div>
                </label>
              ))}
            </RadioGroup>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Additional details (optional)</Label>
            <Textarea
              id="description"
              placeholder="Provide any additional context..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <Button variant="outline" onClick={onClose} className="flex-1">
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={loading || !reason} className="flex-1">
            {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Flag className="h-4 w-4 mr-2" />}
            Submit Report
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ReportModal;
