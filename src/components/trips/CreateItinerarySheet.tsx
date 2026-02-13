import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { CoverPhotoPicker } from "./CoverPhotoPicker";

interface CreateItinerarySheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tripDepartDate?: string | null;
  tripReturnDate?: string | null;
  onCreate: (data: {
    name: string;
    depart_date?: string;
    return_date?: string;
    cover_image_url?: string;
    overview?: string;
  }) => Promise<any>;
}

export function CreateItinerarySheet({
  open,
  onOpenChange,
  tripDepartDate,
  tripReturnDate,
  onCreate,
}: CreateItinerarySheetProps) {
  const { user } = useAuth();
  const [name, setName] = useState("");
  const [departDate, setDepartDate] = useState(tripDepartDate || "");
  const [returnDate, setReturnDate] = useState(tripReturnDate || "");
  const [overview, setOverview] = useState("");
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelected = (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }
    setCoverFile(file);
    setCoverPreview(URL.createObjectURL(file));
  };

  const handleUrlSelected = (url: string) => {
    setCoverFile(null);
    setCoverPreview(url);
  };

  const removeCover = () => {
    setCoverFile(null);
    setCoverPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSubmit = async () => {
    if (!name.trim()) {
      toast.error("Please enter a name");
      return;
    }
    setSubmitting(true);
    try {
      let cover_image_url: string | undefined;

      // Upload cover file if selected, or use URL directly
      if (coverFile && user) {
        const ext = coverFile.name.split(".").pop() || "jpg";
        const path = `${user.id}/${Date.now()}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from("itinerary-covers")
          .upload(path, coverFile);
        if (uploadError) throw uploadError;
        const { data: urlData } = supabase.storage
          .from("itinerary-covers")
          .getPublicUrl(path);
        cover_image_url = urlData.publicUrl;
      } else if (coverPreview && !coverFile) {
        // URL was pasted or selected from library
        cover_image_url = coverPreview;
      }

      await onCreate({
        name: name.trim(),
        depart_date: departDate || undefined,
        return_date: returnDate || undefined,
        cover_image_url,
        overview: overview.trim() || undefined,
      });

      // Reset form
      setName("");
      setDepartDate(tripDepartDate || "");
      setReturnDate(tripReturnDate || "");
      setOverview("");
      removeCover();
      onOpenChange(false);
    } catch (error) {
      console.error("Error creating itinerary:", error);
      toast.error("Failed to create itinerary");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Create Itinerary</SheetTitle>
        </SheetHeader>

        <div className="space-y-6 py-6">
          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="itin-name">Name</Label>
            <Input
              id="itin-name"
              placeholder="e.g. Option 2"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </div>

          {/* Travel Dates */}
          <div className="space-y-2">
            <Label>Travel Dates</Label>
            <div className="flex items-center gap-2">
              <Input
                type="date"
                value={departDate}
                onChange={(e) => setDepartDate(e.target.value)}
                className="flex-1"
              />
              <span className="text-sm text-muted-foreground">to</span>
              <Input
                type="date"
                value={returnDate}
                onChange={(e) => setReturnDate(e.target.value)}
                className="flex-1"
              />
            </div>
          </div>

          {/* Cover Photo */}
          <CoverPhotoPicker
            coverPreview={coverPreview}
            onFileSelected={handleFileSelected}
            onUrlSelected={handleUrlSelected}
            onRemove={removeCover}
          />

          {/* Overview Statement */}
          <div className="space-y-2">
            <Label>Overview Statement</Label>
            <p className="text-xs text-muted-foreground">
              An overview statement is optional. When present it will be shown to travelers with each itinerary option.
            </p>
            <Textarea
              placeholder="Write a brief overview of this itinerary..."
              value={overview}
              onChange={(e) => setOverview(e.target.value)}
              rows={4}
            />
          </div>
        </div>

        <SheetFooter className="flex flex-row justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Discard
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? "Creating..." : "Create Itinerary"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
