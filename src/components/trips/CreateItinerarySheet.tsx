import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { ImagePlus, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }
    setCoverFile(file);
    setCoverPreview(URL.createObjectURL(file));
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (!file || !file.type.startsWith("image/")) return;
    setCoverFile(file);
    setCoverPreview(URL.createObjectURL(file));
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

      // Upload cover if selected
      if (coverFile && user) {
        const ext = coverFile.name.split(".").pop();
        const path = `${user.id}/${Date.now()}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from("itinerary-covers")
          .upload(path, coverFile);
        if (uploadError) throw uploadError;
        const { data: urlData } = supabase.storage
          .from("itinerary-covers")
          .getPublicUrl(path);
        cover_image_url = urlData.publicUrl;
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
          <div className="space-y-2">
            <Label>Cover Photo</Label>
            <p className="text-xs text-muted-foreground">Add an image to bring this trip to life.</p>

            {coverPreview ? (
              <div className="relative rounded-lg overflow-hidden border">
                <img
                  src={coverPreview}
                  alt="Cover preview"
                  className="w-full h-48 object-cover"
                />
                <button
                  onClick={removeCover}
                  className="absolute top-2 right-2 bg-background/80 hover:bg-background rounded-full p-1"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <div
                onClick={() => fileInputRef.current?.click()}
                onDrop={handleDrop}
                onDragOver={(e) => e.preventDefault()}
                className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-colors"
              >
                <ImagePlus className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm font-medium">Add photo</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Drag and drop or paste from clipboard
                </p>
                <button
                  type="button"
                  className="text-sm font-medium mt-2 hover:underline"
                  onClick={(e) => {
                    e.stopPropagation();
                    fileInputRef.current?.click();
                  }}
                >
                  Choose file
                </button>
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
            />
          </div>

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
