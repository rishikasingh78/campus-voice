import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ImagePlus, X, Tag, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";

interface CreateIssueModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (issue: any) => void;
}

const issueSchema = z.object({
  title: z.string().min(5, "Title must be at least 5 characters"),
  description: z.string().min(10, "Description must be at least 10 characters"),
  tags: z.array(z.string()).min(1, "Please select at least one tag"),
});

const availableTags = [
  "Academics",
  "Facilities",
  "Food",
  "Mental Health",
  "Safety",
  "Sustainability",
  "Technology",
  "Transportation",
  "Urgent",
  "Wellness"
];

const CreateIssueModal = ({ isOpen, onClose, onSubmit }: CreateIssueModalProps) => {
  const { toast } = useToast();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeImage = () => {
    setImageFile(null);
    setImagePreview(null);
  };

  const handleSubmit = async () => {
    try {
      issueSchema.parse({ title, description, tags: selectedTags });
      setUploading(true);

      let imageUrl = null;

      if (imageFile) {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Not authenticated");

        const fileExt = imageFile.name.split(".").pop();
        const fileName = `${user.id}/${Date.now()}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from("issue-images")
          .upload(fileName, imageFile);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from("issue-images")
          .getPublicUrl(fileName);

        imageUrl = publicUrl;
      }

      onSubmit({
        title,
        description,
        tags: selectedTags,
        isAnonymous,
        image_url: imageUrl,
      });

      // Reset form
      setTitle("");
      setDescription("");
      setSelectedTags([]);
      setIsAnonymous(false);
      setImageFile(null);
      setImagePreview(null);
      onClose();
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast({
          title: "Validation Error",
          description: error.errors[0].message,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Error",
          description: (error as any).message,
          variant: "destructive",
        });
      }
    } finally {
      setUploading(false);
    }
  };

  const toggleTag = (tag: string) => {
    setSelectedTags(prev =>
      prev.includes(tag)
        ? prev.filter(t => t !== tag)
        : [...prev, tag]
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
            Create New Issue
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              placeholder="What's the issue?"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="rounded-xl border-border/50 focus:border-primary transition-smooth"
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              placeholder="Describe the issue in detail and suggest possible solutions..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={6}
              className="rounded-xl border-border/50 focus:border-primary transition-smooth resize-none"
            />
          </div>

          {/* Tags */}
          <div className="space-y-3">
            <Label className="flex items-center gap-2">
              <Tag className="h-4 w-4" />
              Tags
            </Label>
            <div className="flex flex-wrap gap-2">
              {availableTags.map((tag) => {
                const isSelected = selectedTags.includes(tag);
                return (
                  <Badge
                    key={tag}
                    variant={isSelected ? "default" : "outline"}
                    className={`rounded-full px-4 py-2 cursor-pointer transition-bounce hover:scale-105 ${
                      isSelected 
                        ? "gradient-primary text-white shadow-glow" 
                        : "hover:bg-muted border-border/50"
                    }`}
                    onClick={() => toggleTag(tag)}
                  >
                    {tag}
                    {isSelected && <X className="ml-1 h-3 w-3" />}
                  </Badge>
                );
              })}
            </div>
          </div>

          {/* Image Upload */}
          <div className="space-y-3">
            <Label className="flex items-center gap-2">
              <ImagePlus className="h-4 w-4" />
              Add Image (Optional)
            </Label>
            {imagePreview ? (
              <div className="relative rounded-xl overflow-hidden">
                <img src={imagePreview} alt="Preview" className="w-full h-48 object-cover" />
                <Button
                  variant="destructive"
                  size="icon"
                  className="absolute top-2 right-2 rounded-full"
                  onClick={removeImage}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-border/50 rounded-xl cursor-pointer hover:bg-muted/30 transition-smooth">
                <ImagePlus className="h-8 w-8 text-muted-foreground mb-2" />
                <span className="text-sm text-muted-foreground">Click to upload image</span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleImageSelect}
                />
              </label>
            )}
          </div>

          {/* Anonymous Toggle */}
          <div className="flex items-center justify-between p-4 rounded-xl bg-muted/30">
            <div>
              <Label className="text-base">Post Anonymously</Label>
              <p className="text-sm text-muted-foreground">Your identity will be hidden</p>
            </div>
            <Button
              variant={isAnonymous ? "default" : "outline"}
              size="sm"
              onClick={() => setIsAnonymous(!isAnonymous)}
              className={`rounded-full transition-smooth ${
                isAnonymous ? "gradient-secondary shadow-glow" : ""
              }`}
            >
              {isAnonymous ? "Anonymous" : "Public"}
            </Button>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <Button
              variant="outline"
              onClick={onClose}
              className="flex-1 rounded-full border-border/50"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={uploading}
              className="flex-1 rounded-full gradient-primary shadow-glow hover:shadow-large transition-smooth"
            >
              {uploading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Uploading...
                </>
              ) : (
                "Post Issue"
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CreateIssueModal;
